#!/usr/bin/env python3
"""TianLi Harness backend server with multi-destiny galaxy state."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from collections import Counter, defaultdict
from contextlib import suppress
from dataclasses import asdict, is_dataclass
from datetime import datetime, timedelta
from pathlib import Path
from shutil import disk_usage
from typing import Any, Dict, List, Literal, Optional
from urllib.parse import quote

from tianli_harness import HarnessConfig, HarnessEngine
from tianli_harness.core.db_connector import get_feedback_database
from tianli_harness.core.dispatcher import TaskDispatcher
from tianli_harness.core.registry import HeroRegistry
from tianli_harness.core.state import DispatchDecision, HeroProfile, SkillDispatch, TaskEnvelope
from tianli_harness.skills.registry import LocalSkillExecutor, LocalSkillRegistry, SkillDispatchPlanner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


ACTIVE_TASK_STATUSES = {"issued", "routing", "consulting", "running", "synthesizing"}
BUSY_HERO_STATUSES = {"routing", "consulting", "running", "recovering"}
TERMINAL_TASK_STATUSES = {"accepted", "completed", "failed", "error", "early_exit"}
RANGE_TO_DELTA = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, StreamingResponse
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel, Field
    import uvicorn

    HAS_FASTAPI = True
except ImportError:  # pragma: no cover - environment-dependent
    HAS_FASTAPI = False


if HAS_FASTAPI:
    class StartTaskRequest(BaseModel):
        task: str = Field(..., min_length=1)
        pinnedHeroIds: List[str] = Field(default_factory=list)
        maxFanout: Optional[int] = None
        dispatchMode: Optional[str] = None
        collaborationMode: Optional[str] = "primary_consult"


    class VerdictRequest(BaseModel):
        taskId: str = Field(..., min_length=1)
        verdict: Literal["approve", "reject"]
        judgmentNote: str = ""
else:
    class StartTaskRequest:  # pragma: no cover - compatibility fallback
        def __init__(
            self,
            task: str,
            pinnedHeroIds: Optional[List[str]] = None,
            maxFanout: Optional[int] = None,
            dispatchMode: Optional[str] = None,
            collaborationMode: Optional[str] = "primary_consult",
        ):
            self.task = task
            self.pinnedHeroIds = pinnedHeroIds or []
            self.maxFanout = maxFanout
            self.dispatchMode = dispatchMode
            self.collaborationMode = collaborationMode or "primary_consult"


    class VerdictRequest:  # pragma: no cover - compatibility fallback
        def __init__(self, taskId: str, verdict: str, judgmentNote: str = ""):
            self.taskId = taskId
            self.verdict = verdict
            self.judgmentNote = judgmentNote


def _jsonable(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if is_dataclass(value):
        return _jsonable(asdict(value))
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


def _now_iso() -> str:
    return datetime.now().isoformat()


def _task_sort_key(task: Dict[str, Any]) -> tuple:
    return (task.get("updatedAt", ""), task.get("createdAt", ""))


PROJECT_ROOT = Path(__file__).parent.resolve()
DELIVERABLE_ROOT_NAMES = ("generated_ppts", "generated_docs", "outputs", "artifacts")


def _resolve_deliverable_roots() -> List[Path]:
    return [root for name in DELIVERABLE_ROOT_NAMES if (root := PROJECT_ROOT / name).exists()]


def _is_within(parent: Path, candidate: Path) -> bool:
    try:
        candidate.relative_to(parent)
        return True
    except ValueError:
        return False


def _collect_deliverables(limit: int = 24) -> List[Dict[str, Any]]:
    deliverables: List[Dict[str, Any]] = []

    for root in _resolve_deliverable_roots():
        for path in root.rglob("*"):
            if not path.is_file():
                continue

            stat = path.stat()
            relative_path = path.relative_to(PROJECT_ROOT).as_posix()
            deliverables.append(
                {
                    "id": relative_path,
                    "fileName": path.name,
                    "relativePath": relative_path,
                    "rootName": root.name,
                    "fileType": path.suffix.lstrip(".").lower() or "file",
                    "sizeBytes": stat.st_size,
                    "modifiedAt": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "downloadUrl": f"/api/deliverables/download?path={quote(relative_path)}",
                }
            )

    deliverables.sort(key=lambda item: item["modifiedAt"], reverse=True)
    return deliverables[:limit]


def _resolve_deliverable_path(relative_path: str) -> Path:
    candidate = (PROJECT_ROOT / relative_path).resolve()

    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="Deliverable not found")

    if not any(_is_within(root, candidate) for root in _resolve_deliverable_roots()):
        raise HTTPException(status_code=403, detail="Deliverable path is outside allowed roots")

    return candidate


def _feedback_db():
    return get_feedback_database()


def _normalize_time_range(value: Optional[str]) -> str:
    if value in RANGE_TO_DELTA:
        return str(value)
    return "24h"


def _range_start(value: Optional[str]) -> datetime:
    normalized = _normalize_time_range(value)
    return datetime.now() - RANGE_TO_DELTA[normalized]


def _parse_json_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item]
    if isinstance(value, str) and value:
        with suppress(Exception):
            loaded = json.loads(value)
            if isinstance(loaded, list):
                return [str(item) for item in loaded if item]
    return []


def _parse_json_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value:
        with suppress(Exception):
            loaded = json.loads(value)
            if isinstance(loaded, dict):
                return loaded
    return {}


def _parse_json_sequence(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value:
        with suppress(Exception):
            loaded = json.loads(value)
            if isinstance(loaded, list):
                return loaded
    return []


def _count_violations(value: Any) -> int:
    return len(_parse_json_sequence(value))


def _status_progress(status: str) -> int:
    progress_map = {
        "issued": 6,
        "routing": 18,
        "consulting": 35,
        "running": 52,
        "synthesizing": 76,
        "judgment_pending": 92,
        "accepted": 100,
        "completed": 100,
        "rejected": 48,
        "early_exit": 58,
        "failed": 100,
        "error": 100,
        "recovering": 64,
    }
    return progress_map.get(status, 0)


def _status_tone(status: str) -> str:
    if status in {"accepted", "completed"}:
        return "success"
    if status in {"failed", "error", "rejected"}:
        return "danger"
    if status in {"judgment_pending", "synthesizing"}:
        return "warning"
    if status in {"routing", "consulting", "running", "issued", "recovering"}:
        return "info"
    return "neutral"


def _coerce_dt(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value:
        with suppress(ValueError):
            return datetime.fromisoformat(value)
    return None


def _iso_or_empty(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str):
        return value
    return ""


def _bucket_points(range_value: str) -> List[datetime]:
    now = datetime.now()
    normalized = _normalize_time_range(range_value)
    if normalized == "24h":
        start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=23)
        return [start + timedelta(hours=index) for index in range(24)]
    days = 7 if normalized == "7d" else 30
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return [start + timedelta(days=index) for index in range(days)]


def _bucket_key(value: datetime, range_value: str) -> str:
    normalized = _normalize_time_range(range_value)
    if normalized == "24h":
        return value.replace(minute=0, second=0, microsecond=0).isoformat()
    return value.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def _bucket_label(value: datetime, range_value: str) -> str:
    normalized = _normalize_time_range(range_value)
    return value.strftime("%H:%M") if normalized == "24h" else value.strftime("%m-%d")


def _latest_runtime_or_db_status(task_id: str, result_rows: List[Dict[str, Any]]) -> str:
    runtime_task = state.tasks.get(task_id)
    if runtime_task and runtime_task.get("status"):
        return str(runtime_task["status"])
    for row in reversed(result_rows):
        current_status = row.get("current_status")
        if current_status:
            return str(current_status)
        if row.get("status"):
            return str(row["status"])
    return "running" if result_rows else "idle"


def _build_session_summaries(limit: int = 10, time_range: Optional[str] = None) -> List[Dict[str, Any]]:
    db = _feedback_db()
    since = _range_start(time_range) if time_range else None
    dispatch_rows = db.fetch_recent_dispatch_decisions(limit=max(limit * 16, 160), since=since)
    result_rows = db.fetch_recent_task_results(limit=max(limit * 24, 240), since=since)

    dispatch_by_task: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in dispatch_rows:
        dispatch_by_task[str(row.get("task_id", ""))].append(row)

    results_by_task: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in result_rows:
        results_by_task[str(row.get("task_id", ""))].append(row)

    task_ids = {task_id for task_id in dispatch_by_task if task_id} | {task_id for task_id in results_by_task if task_id}
    task_ids |= set(state.tasks.keys())

    summaries: List[Dict[str, Any]] = []
    for task_id in task_ids:
        task_dispatches = sorted(dispatch_by_task.get(task_id, []), key=lambda row: row.get("created_at") or datetime.min)
        task_results = sorted(results_by_task.get(task_id, []), key=lambda row: row.get("created_at") or datetime.min)
        runtime_task = state.tasks.get(task_id, {})

        start_dt = _coerce_dt(runtime_task.get("createdAt")) or (
            task_dispatches[0].get("created_at") if task_dispatches else None
        )
        last_activity_dt = (
            _coerce_dt(runtime_task.get("updatedAt"))
            or (task_results[-1].get("created_at") if task_results else None)
            or (task_dispatches[-1].get("created_at") if task_dispatches else None)
        )
        if not start_dt:
            continue

        status = _latest_runtime_or_db_status(task_id, task_results)
        is_terminal = status in TERMINAL_TASK_STATUSES or status in {"accepted", "completed", "failed", "error"}
        end_dt = _coerce_dt(runtime_task.get("completedAt")) or ((task_results[-1].get("created_at")) if is_terminal and task_results else None)
        effective_end = end_dt or last_activity_dt or datetime.now()
        duration_seconds = max((effective_end - start_dt).total_seconds(), 0.0)

        hero_counter: Counter[str] = Counter()
        primary_hero_id = runtime_task.get("primaryHeroId")
        for dispatch in task_dispatches:
            selected_hero_ids = _parse_json_list(dispatch.get("selected_hero_ids"))
            hero_counter.update(selected_hero_ids)
            primary_hero_id = primary_hero_id or dispatch.get("primary_hero_id")

        l1_rows = [bool(row["l1_passed"]) for row in task_results if row.get("l1_passed") is not None]
        l2_rows = [bool(row["l2_passed"]) for row in task_results if row.get("l2_passed") is not None]
        l2_scores = [float(row["l2_score"]) for row in task_results if row.get("l2_score") is not None]
        early_exits = sum(
            1
            for row in task_results
            if str(row.get("current_status") or row.get("status") or "") == "early_exit"
        )
        evolution_patches = sum(1 for row in task_results if row.get("evolution_patch"))
        title = str(runtime_task.get("title") or (task_dispatches[0].get("user_input") if task_dispatches else task_id))

        summaries.append(
            {
                "session_id": task_id,
                "task_id": task_id,
                "title": title,
                "start_time": start_dt.isoformat(),
                "end_time": end_dt.isoformat() if isinstance(end_dt, datetime) else None,
                "duration_seconds": round(duration_seconds, 2),
                "total_requests": max(len(task_dispatches), 1 if runtime_task or task_results else 0),
                "successful_completions": 1 if status in {"accepted", "completed"} else 0,
                "early_exits": early_exits,
                "l1_pass_rate": round(sum(l1_rows) / len(l1_rows), 4) if l1_rows else 0.0,
                "l2_pass_rate": round(sum(l2_rows) / len(l2_rows), 4) if l2_rows else 0.0,
                "avg_l2_score": round(sum(l2_scores) / len(l2_scores), 4) if l2_scores else 0.0,
                "tool_calls": {
                    "total": sum(hero_counter.values()),
                    "by_tool": dict(hero_counter),
                },
                "status": status,
                "evolution_patches": evolution_patches,
                "primary_hero_id": primary_hero_id,
                "selected_hero_ids": list(hero_counter.keys()) or list(runtime_task.get("selectedHeroIds", [])),
                "updated_at": _iso_or_empty(last_activity_dt),
                "pending_verdict": status == "judgment_pending",
            }
        )

    summaries.sort(key=lambda item: item.get("updated_at") or item.get("start_time") or "", reverse=True)
    return summaries[:limit]


def _build_metrics(time_range: Optional[str]) -> Dict[str, Any]:
    normalized = _normalize_time_range(time_range)
    db = _feedback_db()
    result_rows = db.fetch_recent_task_results(limit=4000, since=_range_start(normalized))
    sessions = _build_session_summaries(limit=200, time_range=normalized)

    l1_rows = [bool(row["l1_passed"]) for row in result_rows if row.get("l1_passed") is not None]
    l2_rows = [bool(row["l2_passed"]) for row in result_rows if row.get("l2_passed") is not None]
    latencies = [int(row["execution_time_ms"]) for row in result_rows if row.get("execution_time_ms") is not None]
    total_violations = sum(_count_violations(row.get("violations")) for row in result_rows)
    early_exit_rows = sum(
        1 for row in result_rows if str(row.get("current_status") or row.get("status") or "") == "early_exit"
    )
    evolution_patches = sum(1 for row in result_rows if row.get("evolution_patch"))

    if not result_rows and state.tasks:
        early_exit_rows = sum(1 for task in state.tasks.values() if task.get("status") == "early_exit")

    return {
        "totalSessions": len(sessions),
        "totalRequests": sum(session.get("total_requests", 0) for session in sessions),
        "l1PassRate": round(sum(l1_rows) / len(l1_rows), 4) if l1_rows else 0.0,
        "l2PassRate": round(sum(l2_rows) / len(l2_rows), 4) if l2_rows else 0.0,
        "earlyExitRate": round(early_exit_rows / len(result_rows), 4) if result_rows else 0.0,
        "avgLatencyMs": round(sum(latencies) / len(latencies), 2) if latencies else 0,
        "totalViolations": total_violations,
        "evolutionPatches": evolution_patches,
        "timeRange": normalized,
    }


def _build_chart_data(metric: str, time_range: Optional[str]) -> List[Dict[str, Any]]:
    normalized = _normalize_time_range(time_range)
    bucket_values = _bucket_points(normalized)
    bucket_map = {
        _bucket_key(point, normalized): {
            "timestamp": point.isoformat(),
            "label": _bucket_label(point, normalized),
            "value": 0,
        }
        for point in bucket_values
    }

    if metric == "requests":
        for session in _build_session_summaries(limit=500, time_range=normalized):
            start_dt = _coerce_dt(session.get("start_time"))
            if not start_dt:
                continue
            key = _bucket_key(start_dt, normalized)
            if key in bucket_map:
                bucket_map[key]["value"] += int(session.get("total_requests", 0) or 0)
        return list(bucket_map.values())

    if metric in {"pass-rates", "pass_rates"}:
        db = _feedback_db()
        rows = db.fetch_recent_task_results(limit=4000, since=_range_start(normalized))
        rate_map = {
            key: {
                "timestamp": value["timestamp"],
                "label": value["label"],
                "l1_total": 0,
                "l1_pass": 0,
                "l2_total": 0,
                "l2_pass": 0,
            }
            for key, value in bucket_map.items()
        }
        for row in rows:
            created_at = _coerce_dt(row.get("created_at"))
            if not created_at:
                continue
            key = _bucket_key(created_at, normalized)
            if key not in rate_map:
                continue
            if row.get("l1_passed") is not None:
                rate_map[key]["l1_total"] += 1
                rate_map[key]["l1_pass"] += 1 if bool(row["l1_passed"]) else 0
            if row.get("l2_passed") is not None:
                rate_map[key]["l2_total"] += 1
                rate_map[key]["l2_pass"] += 1 if bool(row["l2_passed"]) else 0
        return [
            {
                "timestamp": value["timestamp"],
                "label": value["label"],
                "l1": round((value["l1_pass"] / value["l1_total"]) * 100, 2) if value["l1_total"] else 0,
                "l2": round((value["l2_pass"] / value["l2_total"]) * 100, 2) if value["l2_total"] else 0,
            }
            for value in rate_map.values()
        ]

    return []


def _build_runtime_messages(task: Dict[str, Any]) -> List[Dict[str, Any]]:
    task_id = str(task.get("taskId") or "")
    if not task_id:
        return []

    messages: List[Dict[str, Any]] = [
        {
            "id": f"{task_id}-user",
            "task_id": task_id,
            "round": 0,
            "role": "user",
            "content": str(task.get("title") or task_id),
            "hero_id": None,
            "status": "issued",
            "timestamp": str(task.get("createdAt") or ""),
        }
    ]

    delivery_summary = str(task.get("deliverySummary") or "")
    if delivery_summary:
        messages.append(
            {
                "id": f"{task_id}-delivery",
                "task_id": task_id,
                "round": int(task.get("verdictRound") or 0),
                "role": "assistant",
                "content": delivery_summary,
                "hero_id": task.get("primaryHeroId"),
                "status": task.get("status"),
                "timestamp": str(task.get("completedAt") or task.get("updatedAt") or ""),
            }
        )

    for index, verdict in enumerate(task.get("verdictHistory", [])):
        verdict_name = "approve" if verdict.get("verdict") == "approve" else "reject"
        note = str(verdict.get("note") or "无补充说明")
        messages.append(
            {
                "id": f"{task_id}-verdict-{index}",
                "task_id": task_id,
                "round": int(verdict.get("round") or 0),
                "role": "assistant",
                "content": f"裁决 {verdict_name}：{note}",
                "hero_id": task.get("primaryHeroId"),
                "status": "accepted" if verdict_name == "approve" else "rejected",
                "timestamp": str(verdict.get("timestamp") or task.get("updatedAt") or ""),
            }
        )

    return [message for message in messages if message.get("timestamp")]


def _build_conversations(limit: int = 50) -> List[Dict[str, Any]]:
    db = _feedback_db()
    rows = db.fetch_conversation_messages(limit_tasks=limit)
    grouped: Dict[str, Dict[str, Any]] = {}

    for row in rows:
        task_id = str(row.get("task_id") or "")
        if not task_id:
            continue
        created_at = row.get("created_at")
        timestamp = created_at.isoformat() if isinstance(created_at, datetime) else str(created_at or "")
        conversation = grouped.setdefault(
            task_id,
            {
                "task_id": task_id,
                "session_id": task_id,
                "messages": [],
                "started_at": timestamp,
                "last_message_at": timestamp,
                "hero_id": row.get("hero_id"),
                "status": row.get("status") or "issued",
            },
        )
        conversation["messages"].append(
            {
                "id": str(row.get("id")),
                "task_id": task_id,
                "round": int(row.get("round") or 0),
                "role": row.get("role") or "assistant",
                "content": row.get("content") or "",
                "timestamp": timestamp,
                "hero_id": row.get("hero_id"),
                "status": row.get("status"),
            }
        )
        conversation["started_at"] = min(conversation["started_at"], timestamp)
        conversation["last_message_at"] = max(conversation["last_message_at"], timestamp)
        if row.get("hero_id"):
            conversation["hero_id"] = row.get("hero_id")
        if row.get("status"):
            conversation["status"] = row.get("status")

    for task_id, task in state.tasks.items():
        if task_id in grouped:
            grouped[task_id]["status"] = task.get("status") or grouped[task_id]["status"]
            grouped[task_id]["hero_id"] = task.get("primaryHeroId") or grouped[task_id]["hero_id"]
            continue
        runtime_messages = _build_runtime_messages(task)
        if not runtime_messages:
            continue
        grouped[task_id] = {
            "task_id": task_id,
            "session_id": task_id,
            "messages": runtime_messages,
            "started_at": runtime_messages[0]["timestamp"],
            "last_message_at": runtime_messages[-1]["timestamp"],
            "hero_id": task.get("primaryHeroId"),
            "status": task.get("status") or "issued",
        }

    conversations = []
    for conversation in grouped.values():
        conversation["messages"].sort(key=lambda item: (item.get("timestamp", ""), item.get("id", "")))
        conversation["message_count"] = len(conversation["messages"])
        conversation["title"] = next(
            (message["content"] for message in conversation["messages"] if message.get("role") == "user"),
            conversation["task_id"],
        )
        conversations.append(conversation)

    conversations.sort(key=lambda item: item.get("last_message_at", ""), reverse=True)
    return conversations[:limit]


async def _build_skills_inventory(
    registry: HeroRegistry,
    skill_registry: LocalSkillRegistry,
) -> Dict[str, Any]:
    heroes = await registry.list_profiles(refresh_remote=False)
    linked_by_skill: Dict[str, List[str]] = defaultdict(list)
    hero_name_map: Dict[str, str] = {}
    for hero in heroes:
        if hero.hero_id.startswith("skill/"):
            continue
        hero_name_map[hero.hero_id] = hero.display_name_zh or hero.display_name
        for skill_id in hero.linked_skills:
            linked_by_skill[skill_id].append(hero.hero_id)

    resolved_profiles: Dict[str, Any] = {}
    for root in skill_registry.roots:
        if not root.exists():
            continue
        for path in sorted(root.rglob("SKILL.md")):
            skill_id = path.parent.name
            if skill_id in resolved_profiles:
                continue
            profile = await skill_registry.resolve(skill_id)
            if profile:
                resolved_profiles[skill_id] = profile

    all_skill_ids = sorted(set(linked_by_skill.keys()) | set(resolved_profiles.keys()))
    items = []
    for skill_id in all_skill_ids:
        profile = resolved_profiles.get(skill_id)
        linked_heroes = sorted(linked_by_skill.get(skill_id, []))
        items.append(
            {
                "skill_id": skill_id,
                "name": profile.name if profile else skill_id,
                "description": profile.description if profile else "Linked by hero registry, but not found in local skill roots.",
                "installed": profile is not None,
                "available": profile is not None,
                "source": profile.source_path if profile else "hero-registry-link",
                "hero_ids": linked_heroes,
                "hero_names": [hero_name_map.get(hero_id, hero_id) for hero_id in linked_heroes],
                "hero_count": len(linked_heroes),
            }
        )

    items.sort(key=lambda item: (not item["installed"], -item["hero_count"], item["skill_id"]))

    return {
        "items": items,
        "summary": {
            "total": len(items),
            "installed": len([item for item in items if item["installed"]]),
            "linked": len([item for item in items if item["hero_count"] > 0]),
            "missing": len([item for item in items if not item["installed"]]),
        },
    }


def _build_active_tasks(limit: int = 20) -> Dict[str, Any]:
    tasks = sorted(state.tasks.values(), key=_task_sort_key, reverse=True)[:limit]
    items: List[Dict[str, Any]] = []
    for task in tasks:
        hero_entries = []
        for hero_id in task.get("selectedHeroIds", []):
            hero = state.heroes.get(hero_id, {})
            flow = next(
                (
                    item
                    for item in sorted(
                        state.flows.values(),
                        key=lambda current: (current.get("round", 0), current.get("createdAt", "")),
                        reverse=True,
                    )
                    if item.get("taskId") == task.get("taskId") and item.get("heroId") == hero_id
                ),
                None,
            )
            detail = next(
                (item for item in task.get("deliveryDetails", []) if item.get("heroId") == hero_id),
                {},
            )
            lane_status = str(
                detail.get("status")
                or (flow or {}).get("status")
                or hero.get("status")
                or task.get("status")
                or "idle"
            )
            hero_entries.append(
                {
                    "id": f"{task.get('taskId')}-{hero_id}",
                    "hero_id": hero_id,
                    "name": hero.get("displayNameZh") or hero.get("displayName") or hero_id,
                    "role": detail.get("role") or (flow or {}).get("role") or ("primary" if hero_id == task.get("primaryHeroId") else "consult"),
                    "status": lane_status,
                    "progress": _status_progress(lane_status),
                    "started_at": (flow or {}).get("createdAt") or task.get("createdAt"),
                    "completed_at": task.get("completedAt") if lane_status in TERMINAL_TASK_STATUSES | {"judgment_pending", "accepted"} else None,
                    "result": detail.get("summaryZh") or detail.get("summary") or "",
                    "skill_dispatches": detail.get("skillDispatches") or [],
                }
            )

        items.append(
            {
                "task_id": task.get("taskId"),
                "title": task.get("title"),
                "status": task.get("status"),
                "tone": _status_tone(str(task.get("status") or "")),
                "overall_progress": _status_progress(str(task.get("status") or "")),
                "started_at": task.get("createdAt"),
                "updated_at": task.get("updatedAt"),
                "completed_at": task.get("completedAt"),
                "primary_hero_id": task.get("primaryHeroId"),
                "selected_hero_ids": task.get("selectedHeroIds", []),
                "round": task.get("verdictRound", 0),
                "delivery_summary": task.get("deliverySummary") or "",
                "judgment_note": task.get("judgmentNote") or "",
                "sub_agents": hero_entries,
            }
        )

    return {
        "items": items,
        "summary": {
            "running": len([item for item in items if item["status"] in ACTIVE_TASK_STATUSES]),
            "judgment_pending": len([item for item in items if item["status"] == "judgment_pending"]),
            "completed": len([item for item in items if item["status"] in {"accepted", "completed"}]),
        },
    }


def _resource_memory_mb() -> int:
    with suppress(Exception):
        import resource

        rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if rss > 10_000_000:
            return int(rss / (1024 * 1024))
        return int(rss / 1024)
    return 0


def _build_health_payload() -> Dict[str, Any]:
    with suppress(Exception):
        cpu_load = os.getloadavg()[0]
    if "cpu_load" not in locals():
        cpu_load = 0.0
    disk = disk_usage(PROJECT_ROOT)
    disk_percent = round((disk.used / disk.total) * 100, 2) if disk.total else 0.0
    memory_mb = _resource_memory_mb()
    db = _feedback_db()
    db_connected = bool(getattr(db, "connection", None))

    resource_status = "healthy"
    if disk_percent >= 90 or memory_mb >= 4096:
        resource_status = "warning"

    return {
        "executor": {
            "status": "healthy" if state.global_status() != "error" else "error",
            "platforms": {
                "local": True,
                "database": db_connected,
                "remote_heroes": any(hero.get("source") not in {"local", "", None} for hero in state.heroes.values()),
                "skills": True,
            },
        },
        "resources": {
            "status": resource_status,
            "cpu_percent": round(cpu_load * 100, 2),
            "memory_mb": memory_mb,
            "disk_percent": disk_percent,
        },
        "audit": {
            "status": "healthy",
            "active_rules": len(harness_runner.base_config.forbidden_words),
            "l2_sample_rate": harness_runner.base_config.l2_sample_ratio,
            "last_update": _now_iso(),
        },
        "running": state.stats_payload()["activeTasks"] > 0,
    }


class LiveServerState:
    """In-memory live state mirrored to the web console."""

    def __init__(self):
        self.total_steps = 0
        self.early_exits = 0
        self.l1_passes = 0
        self.l2_checks = 0
        self.logs: List[Dict[str, Any]] = []
        self.heroes: Dict[str, Dict[str, Any]] = {}
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.flows: Dict[str, Dict[str, Any]] = {}
        self.latest_dispatch_decision: Optional[Dict[str, Any]] = None
        self.latest_run_summary: Optional[Dict[str, Any]] = None
        self.events: List[Dict[str, Any]] = []
        self._event_counter = 0

    def sync_heroes(self, heroes: List[HeroProfile]) -> None:
        synced: Dict[str, Dict[str, Any]] = {}
        for hero in heroes:
            existing = self.heroes.get(hero.hero_id, {})
            current_task_ids = list(existing.get("currentTaskIds", []))
            current_task_id = current_task_ids[0] if current_task_ids else None
            synced[hero.hero_id] = {
                "heroId": hero.hero_id,
                "displayName": hero.display_name,
                "displayNameZh": hero.display_name_zh or hero.display_name,
                "displayNameEn": hero.display_name_en or hero.display_name,
                "description": hero.description,
                "descriptionZh": hero.description_zh or hero.description,
                "descriptionEn": hero.description_en or hero.description,
                "tags": hero.tags,
                "tools": hero.tools,
                "linkedSkills": hero.linked_skills,
                "color": hero.color,
                "x": hero.star_position.get("x", 0.5),
                "y": hero.star_position.get("y", 0.5),
                "status": existing.get("status", "idle"),
                "load": existing.get("load", 0.0),
                "queueDepth": existing.get("queueDepth", 0),
                "currentTaskId": current_task_id,
                "currentTaskIds": current_task_ids,
                "source": hero.source,
            }
        self.heroes = synced

    def emit(self, event_name: str, payload: Any) -> None:
        self._event_counter += 1
        self.events.append(
            {
                "id": self._event_counter,
                "event": event_name,
                "data": _jsonable(payload),
            }
        )
        self.events = self.events[-5000:]

    def add_log(
        self,
        module: str,
        msg: str = "",
        level: str = "INFO",
        data: Optional[Dict[str, Any]] = None,
        msg_zh: Optional[str] = None,
        msg_en: Optional[str] = None,
    ) -> None:
        resolved_zh = msg_zh or msg or msg_en or ""
        resolved_en = msg_en or msg or msg_zh or ""
        entry = {
            "id": f"log-{len(self.logs) + 1}",
            "time": datetime.now().strftime("%H:%M:%S"),
            "level": level,
            "module": module,
            "msg": resolved_zh or resolved_en,
            "msgZh": resolved_zh,
            "msgEn": resolved_en,
            "data": data or {},
        }
        self.logs.append(entry)
        self.logs = self.logs[-1000:]
        self.emit("log", entry)
        self.emit("stats", self.stats_payload())

    def global_status(self) -> str:
        task_statuses = {task.get("status", "idle") for task in self.tasks.values()}
        if task_statuses & ACTIVE_TASK_STATUSES:
            return "running"
        if "judgment_pending" in task_statuses:
            return "judgment_pending"
        if "rejected" in task_statuses:
            return "rejected"
        if "accepted" in task_statuses:
            return "accepted"
        if task_statuses & {"failed", "error"}:
            return "error"
        return "idle"

    def stats_payload(self) -> Dict[str, Any]:
        return {
            "status": self.global_status(),
            "totalSteps": self.total_steps,
            "earlyExits": self.early_exits,
            "l1Passes": self.l1_passes,
            "l2Checks": self.l2_checks,
            "activeHeroes": len(
                [hero for hero in self.heroes.values() if hero.get("status") in BUSY_HERO_STATUSES]
            ),
            "activeTasks": len(
                [
                    task
                    for task in self.tasks.values()
                    if task.get("status") in ACTIVE_TASK_STATUSES or task.get("status") == "judgment_pending"
                ]
            ),
        }

    def snapshot(self) -> Dict[str, Any]:
        tasks = sorted(self.tasks.values(), key=_task_sort_key, reverse=True)
        flows = sorted(self.flows.values(), key=lambda flow: (flow.get("round", 0), flow.get("createdAt", "")))
        judgment_queue = [task for task in tasks if task.get("status") == "judgment_pending"]
        return {
            "status": self.global_status(),
            "stats": self.stats_payload(),
            "heroGalaxy": list(self.heroes.values()),
            "activeTasks": tasks,
            "judgmentQueue": judgment_queue,
            "lightFlows": flows,
            "latestDispatchDecision": self.latest_dispatch_decision,
            "latestRunSummary": self.latest_run_summary,
            "logs": self.logs[-120:],
        }

    def push_snapshot(self) -> None:
        self.emit("sky_state", self.snapshot())


state = LiveServerState()


class TianLiHarnessRunner:
    """Coordinates hero registry, dispatch, verdicts, and hero execution."""

    def __init__(self):
        self.base_config = HarnessConfig(
            hero_id="architect/navigator",
            superpowers=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
            dispatch_mode="hybrid",
            max_fanout=3,
            default_hero_ids=["builder/forge", "auditor/sentinel", "scribe/lumen"],
            max_skill_fanout=2,
        )
        self.registry = HeroRegistry(self.base_config)
        self.skill_registry = LocalSkillRegistry(self.base_config)
        self.skill_dispatcher = SkillDispatchPlanner(self.base_config, self.skill_registry)
        self.skill_executor = LocalSkillExecutor(self.base_config)
        self.active_runs: Dict[str, asyncio.Task] = {}

    async def bootstrap(self) -> None:
        registry_doc = self.registry._load_document(self.registry.registry_path)
        remote_cache_doc = self.registry._load_document(self.registry.remote_cache_path)
        if registry_doc.get("remote_sources") and not remote_cache_doc.get("heroes"):
            with suppress(Exception):
                await self.registry.refresh_remote_sources(registry_doc)
        heroes = await self.registry.list_profiles(refresh_remote=False)
        state.sync_heroes(heroes)
        state.push_snapshot()

    def _log(self, module: str, zh: str, en: str, level: str = "INFO", data: Optional[Dict[str, Any]] = None) -> None:
        state.add_log(module, level=level, data=data, msg_zh=zh, msg_en=en)

    def _persist_conversation_message(
        self,
        task_id: str,
        round_index: int,
        role: str,
        content: str,
        hero_id: Optional[str] = None,
        status: Optional[str] = None,
    ) -> None:
        if not content.strip():
            return
        with suppress(Exception):
            _feedback_db().log_conversation_message(
                task_id=task_id,
                round_index=round_index,
                role=role,
                content=content.strip(),
                hero_id=hero_id,
                status=status,
            )

    def _hero_name(self, hero: HeroProfile | Dict[str, Any], language: str) -> str:
        if isinstance(hero, HeroProfile):
            if language == "zh":
                return hero.display_name_zh or hero.display_name
            return hero.display_name_en or hero.display_name
        if language == "zh":
            return str(hero.get("displayNameZh") or hero.get("displayName") or hero.get("displayNameEn") or hero.get("heroId") or "该 Hero")
        return str(hero.get("displayNameEn") or hero.get("displayName") or hero.get("displayNameZh") or hero.get("heroId") or "This hero")

    def _role_label(self, role: str, language: str) -> str:
        if language == "zh":
            return "主链路" if role == "primary" else "协商链路"
        return "primary lane" if role == "primary" else "consult lane"

    async def refresh_remote_sources(self) -> Dict[str, Any]:
        imported, errors = await self.registry.refresh_remote_sources()
        heroes = await self.registry.list_profiles(refresh_remote=False)
        state.sync_heroes(heroes)
        self._log(
            "REGISTRY",
            f"刷新远程星使来源，导入 {len(imported)} 个条目",
            f"Refreshed remote hero sources and imported {len(imported)} entries",
        )
        state.push_snapshot()
        return {"imported": len(imported), "errors": errors, "heroes": _jsonable(imported)}

    async def start(self, payload: StartTaskRequest) -> Dict[str, Any]:
        heroes = await self.registry.list_profiles(refresh_remote=False)
        state.sync_heroes(heroes)

        dispatcher = TaskDispatcher(self.base_config, self.registry, router_client=None)
        task, decision, selected_profiles = await dispatcher.dispatch(
            content=payload.task,
            pinned_hero_ids=payload.pinnedHeroIds,
            max_fanout=payload.maxFanout,
            dispatch_mode=payload.dispatchMode,
            collaboration_mode=payload.collaborationMode or "primary_consult",
        )

        self._persist_conversation_message(
            task_id=task.task_id,
            round_index=task.verdict_round,
            role="user",
            content=payload.task,
            status="issued",
        )
        self._materialize_dispatch(task, decision, selected_profiles)
        run_task = asyncio.create_task(self._execute_task(task, decision, selected_profiles))
        self.active_runs[task.task_id] = run_task

        self._log("DISPATCH", f"天命已下达：{payload.task}", f"Destiny issued: {payload.task}")
        return {
            "status": "started",
            "taskId": task.task_id,
            "selectedHeroIds": decision.selected_hero_ids,
            "primaryHeroId": decision.primary_hero_id,
        }

    async def submit_verdict(self, payload: VerdictRequest) -> Dict[str, Any]:
        task = state.tasks.get(payload.taskId)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.get("status") != "judgment_pending":
            raise HTTPException(status_code=409, detail="Task is not waiting for judgment")

        note = payload.judgmentNote.strip()
        task.setdefault("verdictHistory", []).append(
            {
                "verdict": payload.verdict,
                "note": note,
                "round": task.get("verdictRound", 0),
                "timestamp": _now_iso(),
            }
        )

        if payload.verdict == "approve":
            task["status"] = "accepted"
            task["verdictStatus"] = "approved"
            task["judgmentNote"] = note
            task["updatedAt"] = _now_iso()
            self._set_round_flow_status(task["taskId"], task.get("verdictRound", 0), "accepted")
            state.latest_run_summary = {
                "taskId": task["taskId"],
                "status": "accepted",
                "selectedHeroIds": task.get("selectedHeroIds", []),
                "completedAt": _now_iso(),
                "deliverySummary": task.get("deliverySummary", ""),
                "deliverySummaryZh": task.get("deliverySummaryZh", task.get("deliverySummary", "")),
                "deliverySummaryEn": task.get("deliverySummaryEn", task.get("deliverySummary", "")),
            }
            state.emit(
                "verdict_recorded",
                {
                    "taskId": task["taskId"],
                    "verdict": "approve",
                    "judgmentNote": note,
                    "round": task.get("verdictRound", 0),
                },
            )
            self._persist_conversation_message(
                task_id=task["taskId"],
                round_index=int(task.get("verdictRound", 0)),
                role="assistant",
                content=f"裁决通过。{note or '本轮交付被接受。'}",
                hero_id=task.get("primaryHeroId"),
                status="accepted",
            )
            self._log("JUDGMENT", f"裁决通过：{task['title']}", f"Verdict approved: {task['title']}")
            state.push_snapshot()
            return {"status": "accepted", "taskId": task["taskId"]}

        task["status"] = "rejected"
        task["verdictStatus"] = "rejected"
        task["judgmentNote"] = note
        task["updatedAt"] = _now_iso()
        self._set_round_flow_status(task["taskId"], task.get("verdictRound", 0), "rejected")
        state.emit(
            "verdict_recorded",
            {
                "taskId": task["taskId"],
                "verdict": "reject",
                "judgmentNote": note,
                "round": task.get("verdictRound", 0),
            },
        )
        self._persist_conversation_message(
            task_id=task["taskId"],
            round_index=int(task.get("verdictRound", 0)),
            role="assistant",
            content=f"裁决打回。{note or '请根据裁决意见重新生成交付。'}",
            hero_id=task.get("primaryHeroId"),
            status="rejected",
        )
        self._log("JUDGMENT", f"裁决打回：{task['title']}", f"Verdict rejected: {task['title']}", level="WARN")
        state.push_snapshot()

        reroute_task = asyncio.create_task(self._reroute_task(task["taskId"], note))
        self.active_runs[task["taskId"]] = reroute_task
        return {
            "status": "rerouting",
            "taskId": task["taskId"],
            "nextRound": task.get("verdictRound", 0) + 1,
        }

    def stop(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        if task_id:
            cancelled = self._cancel_task(task_id)
            state.push_snapshot()
            return {"status": "stopped" if cancelled else "not_found", "taskId": task_id}

        cancelled = []
        for current_task_id in list(self.active_runs):
            if self._cancel_task(current_task_id):
                cancelled.append(current_task_id)
        self._log("DISPATCH", "手动停止所有活跃天命", "Manually stopped all active destinies", level="WARN")
        state.push_snapshot()
        return {"status": "stopped", "taskIds": cancelled}

    def _cancel_task(self, task_id: str) -> bool:
        running = self.active_runs.pop(task_id, None)
        if running and not running.done():
            running.cancel()
        task = state.tasks.get(task_id)
        if task and task.get("status") in ACTIVE_TASK_STATUSES:
            task["status"] = "failed"
            task["updatedAt"] = _now_iso()
            self._set_round_flow_status(task_id, task.get("verdictRound", 0), "failed")
            self._log("DISPATCH", f"已停止天命：{task['title']}", f"Stopped destiny: {task['title']}", level="WARN")
        return task is not None

    async def _reroute_task(self, task_id: str, judgment_note: str) -> None:
        await asyncio.sleep(0.2)
        existing = state.tasks.get(task_id)
        if not existing:
            return

        dispatcher = TaskDispatcher(self.base_config, self.registry, router_client=None)
        task, decision, selected_profiles = await dispatcher.dispatch(
            content=existing["title"],
            pinned_hero_ids=existing.get("pinnedHeroIds", []),
            max_fanout=existing.get("maxFanout"),
            dispatch_mode=existing.get("dispatchMode"),
            collaboration_mode=existing.get("collaborationMode"),
            verdict_round=int(existing.get("verdictRound", 0)) + 1,
            judgment_note=judgment_note,
        )

        task.task_id = task_id
        decision.task_id = task_id

        self._materialize_dispatch(task, decision, selected_profiles)
        await self._execute_task(task, decision, selected_profiles)

    def _materialize_dispatch(
        self,
        task: TaskEnvelope,
        decision: DispatchDecision,
        selected_profiles: List[HeroProfile],
    ) -> None:
        existing = state.tasks.get(task.task_id)
        history = list(existing.get("history", [])) if existing else []
        if existing and existing.get("deliverySummary"):
            history.append(
                {
                    "round": existing.get("verdictRound", 0),
                    "deliverySummary": existing.get("deliverySummary"),
                    "deliverySummaryZh": existing.get("deliverySummaryZh", existing.get("deliverySummary", "")),
                    "deliverySummaryEn": existing.get("deliverySummaryEn", existing.get("deliverySummary", "")),
                    "selectedHeroIds": existing.get("selectedHeroIds", []),
                    "verdictStatus": existing.get("verdictStatus"),
                    "judgmentNote": existing.get("judgmentNote", ""),
                    "completedAt": existing.get("completedAt"),
                }
            )

        created_at = existing.get("createdAt") if existing else task.created_at.isoformat()
        state.tasks[task.task_id] = {
            "taskId": task.task_id,
            "title": task.content,
            "status": "routing",
            "pinnedHeroIds": task.pinned_hero_ids,
            "selectedHeroIds": decision.selected_hero_ids,
            "primaryHeroId": decision.primary_hero_id,
            "consultHeroIds": decision.consult_hero_ids,
            "candidateHeroIds": list(decision.candidate_scores.keys()),
            "maxFanout": task.max_fanout,
            "dispatchMode": task.dispatch_mode,
            "collaborationMode": task.collaboration_mode,
            "createdAt": created_at,
            "updatedAt": _now_iso(),
            "reasoning": decision.reasoning,
            "verdictRound": task.verdict_round,
            "judgmentNote": task.judgment_note,
            "verdictStatus": None,
            "deliverySummary": "",
            "deliverySummaryZh": "",
            "deliverySummaryEn": "",
            "deliveryDetails": [],
            "skillDispatches": [],
            "completedAt": None,
            "history": history,
            "verdictHistory": list(existing.get("verdictHistory", [])) if existing else [],
        }

        state.latest_dispatch_decision = _jsonable(decision)
        state.emit(
            "destiny_issued",
            {
                "taskId": task.task_id,
                "title": task.content,
                "round": task.verdict_round,
                "collaborationMode": task.collaboration_mode,
            },
        )
        state.emit("dispatch_decision", state.latest_dispatch_decision)
        primary_name = next(
            (
                profile.display_name_zh or profile.display_name
                for profile in selected_profiles
                if profile.hero_id == decision.primary_hero_id
            ),
            decision.primary_hero_id or "主星使",
        )
        consult_names = [
            profile.display_name_zh or profile.display_name
            for profile in selected_profiles
            if profile.hero_id in (decision.consult_hero_ids or [])
        ]
        summary_parts = [
            f"第 {task.verdict_round + 1} 轮已完成分发。",
            f"主星使：{primary_name}。",
        ]
        if consult_names:
            summary_parts.append(f"协商星使：{'、'.join(consult_names)}。")
        if decision.reasoning:
            summary_parts.append(f"分发理由：{decision.reasoning}")
        self._persist_conversation_message(
            task_id=task.task_id,
            round_index=task.verdict_round,
            role="assistant",
            content=" ".join(summary_parts),
            hero_id=decision.primary_hero_id,
            status="routing",
        )

        if decision.consult_hero_ids:
            state.emit(
                "hero_consultation",
                {
                    "taskId": task.task_id,
                    "primaryHeroId": decision.primary_hero_id,
                    "consultHeroIds": decision.consult_hero_ids,
                    "round": task.verdict_round,
                },
            )

        for index, profile in enumerate(selected_profiles):
            is_primary = index == 0
            role = "primary" if is_primary else "consult"
            hero_status = "routing" if is_primary else "consulting"
            hero = state.heroes.get(profile.hero_id)
            if not hero:
                continue
            current_task_ids = list(hero.get("currentTaskIds", []))
            if task.task_id not in current_task_ids:
                current_task_ids.append(task.task_id)
            hero["currentTaskIds"] = current_task_ids
            hero["currentTaskId"] = current_task_ids[0] if current_task_ids else None
            hero["queueDepth"] = len(current_task_ids)
            hero["status"] = hero_status
            hero["load"] = min(1.0, 0.35 + 0.25 * hero["queueDepth"])

            flow_id = f"flow-{task.task_id}-r{task.verdict_round}-{profile.hero_id.replace('/', '-')}"
            state.flows[flow_id] = {
                "id": flow_id,
                "taskId": task.task_id,
                "source": task.task_id,
                "target": profile.hero_id,
                "heroId": profile.hero_id,
                "status": hero_status,
                "phase": hero_status,
                "label": profile.display_name,
                "role": role,
                "round": task.verdict_round,
                "animated": True,
                "createdAt": _now_iso(),
            }
            state.emit(
                "task_flow",
                {
                    "taskId": task.task_id,
                    "heroId": profile.hero_id,
                    "status": hero_status,
                    "flowId": flow_id,
                    "round": task.verdict_round,
                    "role": role,
                },
            )

        state.push_snapshot()
        self._log(
            "DISPATCH",
            f"第 {task.verdict_round + 1} 轮分发：{', '.join(decision.selected_hero_ids)}",
            f"Round {task.verdict_round + 1} dispatch: {', '.join(decision.selected_hero_ids)}",
            data=state.latest_dispatch_decision,
        )

    async def _execute_task(
        self,
        task: TaskEnvelope,
        decision: DispatchDecision,
        selected_profiles: List[HeroProfile],
    ) -> None:
        try:
            results = await asyncio.gather(
                *(
                    self._run_hero(
                        task=task,
                        profile=profile,
                        role="primary" if index == 0 else "consult",
                    )
                    for index, profile in enumerate(selected_profiles)
                ),
                return_exceptions=True,
            )
            self._complete_task(task, decision, results)
        except asyncio.CancelledError:  # pragma: no cover - stop path
            raise
        except Exception as exc:  # pragma: no cover - defensive runtime guard
            logger.exception("Harness run failed")
            task_state = state.tasks.get(task.task_id)
            if task_state:
                task_state["status"] = "error"
                task_state["updatedAt"] = _now_iso()
            self._log("HARNESS", f"运行失败：{exc}", f"Harness run failed: {exc}", level="ERROR")
            state.push_snapshot()
        finally:
            self.active_runs.pop(task.task_id, None)

    async def _run_hero(self, task: TaskEnvelope, profile: HeroProfile, role: str) -> Dict[str, Any]:
        hero = state.heroes[profile.hero_id]
        flow_id = f"flow-{task.task_id}-r{task.verdict_round}-{profile.hero_id.replace('/', '-')}"

        hero["status"] = "running" if role == "primary" else "consulting"
        hero["load"] = min(1.0, 0.6 + 0.15 * max(hero.get("queueDepth", 1), 1))
        task_state = state.tasks[task.task_id]
        task_state["status"] = "running"
        task_state["updatedAt"] = _now_iso()

        state.flows[flow_id]["status"] = "running" if role == "primary" else "consulting"
        state.flows[flow_id]["phase"] = state.flows[flow_id]["status"]
        state.emit("hero", hero)
        state.push_snapshot()
        self._log(
            "HERO",
            f"{self._hero_name(profile, 'zh')} 开始执行（{self._role_label(role, 'zh')}）",
            f"{self._hero_name(profile, 'en')} started execution on the {self._role_label(role, 'en')}",
        )

        skill_dispatches = await self.skill_dispatcher.dispatch_for_hero(task, profile)
        self._record_skill_dispatches(task.task_id, profile.hero_id, role, skill_dispatches)
        skill_dispatches = await self.skill_executor.execute_for_hero(task, profile, role, skill_dispatches)
        self._record_skill_results(task.task_id, profile.hero_id, role, skill_dispatches)
        skill_context = self.skill_dispatcher.build_context(skill_dispatches)
        hero_prompt = self._compose_hero_prompt(profile.system_prompt, skill_context)

        config = HarnessConfig(
            hero_id=profile.hero_id,
            superpowers=profile.tools or self.base_config.superpowers,
            drift_threshold=self.base_config.drift_threshold,
            repetition_threshold=self.base_config.repetition_threshold,
            l2_sample_ratio=self.base_config.l2_sample_ratio,
            forbidden_words=self.base_config.forbidden_words,
            repo_owner=self.base_config.repo_owner,
            repo_name=self.base_config.repo_name,
            github_token=self.base_config.github_token,
            dispatch_mode=self.base_config.dispatch_mode,
            max_fanout=1,
            default_hero_ids=self.base_config.default_hero_ids,
            hero_registry_path=self.base_config.hero_registry_path,
            remote_sources=self.base_config.remote_sources,
            router_model=self.base_config.router_model,
            audit_model=self.base_config.audit_model,
            checkpoint_path=self.base_config.checkpoint_path,
            local_hero_prompts={profile.hero_id: hero_prompt},
            skill_search_paths=self.base_config.skill_search_paths,
            max_skill_fanout=self.base_config.max_skill_fanout,
        )
        engine = HarnessEngine(config, None, self._simulate_executor)
        run_input = self._hero_task_prompt(task, profile, role, skill_context)
        result = await engine.run(
            f"{task.task_id}-r{task.verdict_round}-{profile.hero_id.replace('/', '-')}",
            run_input,
        )

        traces = result.get("traces", [])
        state.total_steps += len(traces)
        state.l1_passes += len([trace for trace in traces if trace.is_valid])
        state.l2_checks += len([trace for trace in traces if trace.audit_stage == "L2" or trace.audit_score is not None])

        hero_status = "completed"
        flow_status = "completed"
        if result.get("current_status") == "early_exit":
            hero_status = "recovering"
            flow_status = "early_exit"
            state.early_exits += 1
            self._log(
                "TIANYAN",
                f"{self._hero_name(profile, 'zh')} 触发了天劫并进入天演",
                f"{self._hero_name(profile, 'en')} triggered an early exit and entered evolution",
                level="WARN",
            )
        else:
            self._log(
                "HERO",
                f"{self._hero_name(profile, 'zh')} 已提交{'主方案' if role == 'primary' else '协商意见'}",
                f"{self._hero_name(profile, 'en')} submitted its {'primary proposal' if role == 'primary' else 'consult note'}",
            )

        hero["status"] = hero_status
        hero["load"] = max(0.0, hero["load"] - 0.3)
        state.flows[flow_id]["status"] = flow_status
        state.flows[flow_id]["phase"] = flow_status
        state.flows[flow_id]["animated"] = False
        state.emit(
            "task_flow",
            {
                "taskId": task.task_id,
                "heroId": profile.hero_id,
                "status": flow_status,
                "flowId": flow_id,
                "round": task.verdict_round,
                "role": role,
                "evolutionPatch": result.get("evolution_patch", ""),
            },
        )
        state.push_snapshot()

        for trace in traces:
            self._log(
                "TRACE",
                f"{self._hero_name(profile, 'zh')} · {trace.tool_name} · {trace.audit_reason or trace.observation[:80]}",
                f"{self._hero_name(profile, 'en')} · {trace.tool_name} · {trace.audit_reason or trace.observation[:80]}",
                level="INFO" if trace.is_valid else "WARN",
            )

        summary_zh, summary_en = self._result_summary_pair(profile, role, traces, result, skill_dispatches)
        return {
            "heroId": profile.hero_id,
            "displayName": profile.display_name,
            "displayNameZh": profile.display_name_zh or profile.display_name,
            "displayNameEn": profile.display_name_en or profile.display_name,
            "role": role,
            "status": result.get("current_status", flow_status),
            "steps": len(traces),
            "summary": summary_zh,
            "summaryZh": summary_zh,
            "summaryEn": summary_en,
            "evolutionPatch": result.get("evolution_patch", ""),
            "skillDispatches": self._serialize_skill_dispatches(skill_dispatches),
        }

    def _complete_task(self, task: TaskEnvelope, decision: DispatchDecision, results: List[Any]) -> None:
        task_state = state.tasks.get(task.task_id)
        if not task_state:
            return

        hero_results = []
        for result in results:
            if isinstance(result, Exception):
                hero_results.append({"status": "error", "error": str(result), "role": "consult"})
                continue
            hero_results.append(result)

        task_state["status"] = "synthesizing"
        task_state["updatedAt"] = _now_iso()
        state.emit(
            "task_flow",
            {
                "taskId": task.task_id,
                "status": "synthesizing",
                "round": task.verdict_round,
                "primaryHeroId": decision.primary_hero_id,
            },
        )
        state.push_snapshot()

        delivery_summary_zh, delivery_summary_en = self._build_delivery_summary_pair(task, decision, hero_results)
        task_state["status"] = "judgment_pending"
        task_state["deliverySummary"] = delivery_summary_zh
        task_state["deliverySummaryZh"] = delivery_summary_zh
        task_state["deliverySummaryEn"] = delivery_summary_en
        task_state["deliveryDetails"] = hero_results
        task_state["completedAt"] = _now_iso()
        task_state["updatedAt"] = _now_iso()
        self._set_round_flow_status(task.task_id, task.verdict_round, "judgment_pending")
        self._release_heroes(task.task_id)

        state.latest_run_summary = {
            "taskId": task.task_id,
            "selectedHeroIds": decision.selected_hero_ids,
            "status": "judgment_pending",
            "results": hero_results,
            "completedAt": task_state["completedAt"],
            "deliverySummary": delivery_summary_zh,
            "deliverySummaryZh": delivery_summary_zh,
            "deliverySummaryEn": delivery_summary_en,
        }
        state.emit(
            "delivery_ready",
            {
                "taskId": task.task_id,
                "round": task.verdict_round,
                "deliverySummary": delivery_summary_zh,
                "deliverySummaryZh": delivery_summary_zh,
                "deliverySummaryEn": delivery_summary_en,
                "selectedHeroIds": decision.selected_hero_ids,
            },
        )
        self._persist_conversation_message(
            task_id=task.task_id,
            round_index=task.verdict_round,
            role="assistant",
            content=delivery_summary_zh,
            hero_id=decision.primary_hero_id,
            status="judgment_pending",
        )
        state.push_snapshot()
        self._log("HARNESS", f"交付已提交裁决：{task.content}", f"Delivery submitted for judgment: {task.content}")

    def _release_heroes(self, task_id: str) -> None:
        for hero in state.heroes.values():
            current_task_ids = [current for current in hero.get("currentTaskIds", []) if current != task_id]
            hero["currentTaskIds"] = current_task_ids
            hero["currentTaskId"] = current_task_ids[0] if current_task_ids else None
            hero["queueDepth"] = len(current_task_ids)
            if current_task_ids:
                hero["status"] = "running"
                hero["load"] = min(1.0, 0.35 + 0.2 * len(current_task_ids))
            else:
                hero["status"] = "idle"
                hero["load"] = 0.0

    def _set_round_flow_status(self, task_id: str, round_index: int, status: str) -> None:
        for flow in state.flows.values():
            if flow.get("taskId") != task_id or flow.get("round") != round_index:
                continue
            if flow.get("status") == "early_exit" and status in {"judgment_pending", "accepted"}:
                continue
            flow["status"] = status
            flow["phase"] = status
            flow["animated"] = False

    def _hero_task_prompt(self, task: TaskEnvelope, profile: HeroProfile, role: str, skill_context: str) -> str:
        skill_suffix = f"\n\n并行 skill briefs：\n{skill_context}" if skill_context else ""
        if role == "primary":
            return f"{task.content}{skill_suffix}"
        return (
            "你是协商团 Hero，请围绕主 Hero 的最终交付提供补充方案、风险提醒或证据。\n"
            f"当前天命：{task.content}\n"
            f"裁决轮次：{task.verdict_round + 1}\n"
            f"若存在上轮打回意见，请优先吸收：{task.judgment_note or '无'}"
            f"{skill_suffix}"
        )

    def _compose_hero_prompt(self, base_prompt: str, skill_context: str) -> str:
        if not skill_context:
            return base_prompt
        return f"{base_prompt}\n\n{skill_context}".strip()

    def _record_skill_dispatches(
        self,
        task_id: str,
        hero_id: str,
        role: str,
        dispatches: List[SkillDispatch],
    ) -> None:
        task_state = state.tasks.get(task_id)
        if task_state is None or not dispatches:
            return

        stored = task_state.setdefault("skillDispatches", [])
        for dispatch in dispatches:
            payload = self._skill_payload(task_id, hero_id, role, dispatch)
            self._upsert_skill_payload(stored, payload)
            state.emit("skill_dispatch", payload)
            if dispatch.status == "applied":
                self._log(
                    "SKILL",
                    f"{hero_id} 已并行挂载 skill {dispatch.skill_id}",
                    f"{hero_id} mounted skill {dispatch.skill_id} in parallel",
                    data=payload,
                )
            else:
                self._log(
                    "SKILL",
                    f"{hero_id} 关联的 skill {dispatch.skill_id} 当前不可用",
                    f"Skill {dispatch.skill_id} linked to {hero_id} is currently unavailable",
                    level="WARN",
                    data=payload,
                )
        task_state["updatedAt"] = _now_iso()
        state.push_snapshot()

    def _record_skill_results(
        self,
        task_id: str,
        hero_id: str,
        role: str,
        dispatches: List[SkillDispatch],
    ) -> None:
        task_state = state.tasks.get(task_id)
        if task_state is None or not dispatches:
            return

        stored = task_state.setdefault("skillDispatches", [])
        for dispatch in dispatches:
            if dispatch.status != "applied":
                continue
            payload = self._skill_payload(task_id, hero_id, role, dispatch)
            self._upsert_skill_payload(stored, payload)
            state.emit("skill_result", payload)
            if dispatch.execution_status == "completed":
                self._log(
                    "SKILL",
                    f"{hero_id} 的 skill {dispatch.skill_id} 已产出并行子结论",
                    f"Skill {dispatch.skill_id} for {hero_id} produced a parallel contribution",
                    data=payload,
                )
            elif dispatch.execution_status == "error":
                self._log(
                    "SKILL",
                    f"{hero_id} 的 skill {dispatch.skill_id} 执行失败",
                    f"Skill {dispatch.skill_id} for {hero_id} failed during execution",
                    level="WARN",
                    data=payload,
                )

        task_state["updatedAt"] = _now_iso()
        state.push_snapshot()

    def _skill_payload(self, task_id: str, hero_id: str, role: str, dispatch: SkillDispatch) -> Dict[str, Any]:
        return {
            "taskId": task_id,
            "heroId": hero_id,
            "role": role,
            "skillId": dispatch.skill_id,
            "status": dispatch.status,
            "summary": dispatch.summary,
            "guidance": dispatch.guidance,
            "sourcePath": dispatch.source_path,
            "matchScore": dispatch.match_score,
            "reason": dispatch.reason,
            "executionStatus": dispatch.execution_status,
            "contribution": dispatch.contribution,
            "latencyMs": dispatch.latency_ms,
        }

    def _upsert_skill_payload(self, stored: List[Dict[str, Any]], payload: Dict[str, Any]) -> None:
        for item in stored:
            if (
                item.get("heroId") == payload["heroId"]
                and item.get("role") == payload["role"]
                and item.get("skillId") == payload["skillId"]
            ):
                item.update(payload)
                return
        stored.append(payload)

    def _serialize_skill_dispatches(self, dispatches: List[SkillDispatch]) -> List[Dict[str, Any]]:
        return [
            {
                "skillId": dispatch.skill_id,
                "status": dispatch.status,
                "summary": dispatch.summary,
                "guidance": dispatch.guidance,
                "sourcePath": dispatch.source_path,
                "matchScore": dispatch.match_score,
                "reason": dispatch.reason,
                "executionStatus": dispatch.execution_status,
                "contribution": dispatch.contribution,
                "latencyMs": dispatch.latency_ms,
            }
            for dispatch in dispatches
        ]

    def _result_summary_pair(
        self,
        profile: HeroProfile,
        role: str,
        traces: List[Any],
        result: Dict[str, Any],
        skill_dispatches: List[SkillDispatch],
    ) -> tuple[str, str]:
        step_count = len(traces)
        applied_skills = [dispatch.skill_id for dispatch in skill_dispatches if dispatch.status == "applied"]
        completed_skills = [dispatch.skill_id for dispatch in skill_dispatches if dispatch.execution_status == "completed"]
        zh_name = self._hero_name(profile, "zh")
        en_name = self._hero_name(profile, "en")
        zh_skill_text = f" 并行调用了 {', '.join(applied_skills)} skill。" if applied_skills else ""
        en_skill_text = f" Parallel skills used: {', '.join(applied_skills)}." if applied_skills else ""
        if completed_skills:
            zh_skill_text = f"{zh_skill_text} 其中 {', '.join(completed_skills)} 已先行产出子结论。".strip()
            en_skill_text = f"{en_skill_text} Completed ahead of time: {', '.join(completed_skills)}.".strip()
        if result.get("current_status") == "early_exit":
            return (
                f"{zh_name} 在{self._role_label(role, 'zh')}中触发天劫，并生成了一份天演补丁建议。{zh_skill_text}".strip(),
                f"{en_name} triggered an early exit on the {self._role_label(role, 'en')} and produced an evolution patch suggestion. {en_skill_text}".strip(),
            )
        if role == "primary":
            return (
                f"{zh_name} 作为主星使完成了 {step_count} 步执行并提交主方案。{zh_skill_text}".strip(),
                f"{en_name} completed {step_count} steps as the primary hero and submitted the primary proposal. {en_skill_text}".strip(),
            )
        return (
            f"{zh_name} 作为协商星使提交了 {step_count} 步补充意见。{zh_skill_text}".strip(),
            f"{en_name} submitted {step_count} consult steps as a consult hero. {en_skill_text}".strip(),
        )

    def _build_delivery_summary_pair(
        self,
        task: TaskEnvelope,
        decision: DispatchDecision,
        results: List[Dict[str, Any]],
    ) -> tuple[str, str]:
        primary_name = next(
            (self._hero_name(result, "zh") for result in results if result.get("role") == "primary"),
            decision.primary_hero_id or "主星使",
        )
        primary_name_en = next(
            (self._hero_name(result, "en") for result in results if result.get("role") == "primary"),
            decision.primary_hero_id or "primary hero",
        )
        consult_names_zh = [self._hero_name(result, "zh") for result in results if result.get("role") == "consult"]
        consult_names_en = [self._hero_name(result, "en") for result in results if result.get("role") == "consult"]
        early_exit_names_zh = [self._hero_name(result, "zh") for result in results if result.get("status") == "early_exit"]
        early_exit_names_en = [self._hero_name(result, "en") for result in results if result.get("status") == "early_exit"]

        parts_zh = [
            f"第 {task.verdict_round + 1} 轮交付已完成。",
            f"天命内容：{task.content}",
            f"主星使：{primary_name}",
        ]
        parts_en = [
            f"Round {task.verdict_round + 1} delivery completed.",
            f"Destiny: {task.content}",
            f"Primary hero: {primary_name_en}",
        ]
        if consult_names_zh:
            parts_zh.append(f"协商团：{'、'.join(consult_names_zh)}")
        if consult_names_en:
            parts_en.append(f"Consult heroes: {', '.join(consult_names_en)}")
        if task.judgment_note:
            parts_zh.append(f"已吸收上一轮裁决意见：{task.judgment_note}")
            parts_en.append(f"Absorbed the previous verdict note: {task.judgment_note}")
        for result in results:
            summary_zh = result.get("summaryZh") or result.get("summary")
            summary_en = result.get("summaryEn") or result.get("summary")
            if summary_zh:
                parts_zh.append(str(summary_zh))
            if summary_en:
                parts_en.append(str(summary_en))
            skill_dispatches = result.get("skillDispatches", [])
            applied_skills = [
                dispatch.get("skillId") or dispatch.get("skill_id")
                for dispatch in skill_dispatches
                if isinstance(dispatch, dict) and dispatch.get("status") == "applied"
            ]
            applied_skills = [skill_id for skill_id in applied_skills if skill_id]
            if applied_skills:
                parts_zh.append(f"{self._hero_name(result, 'zh')} 本轮并行调用了 skill：{'、'.join(applied_skills)}。")
                parts_en.append(f"{self._hero_name(result, 'en')} used skills in parallel this round: {', '.join(applied_skills)}.")
            completed_contributions = [
                dispatch.get("contribution", "")
                for dispatch in skill_dispatches
                if isinstance(dispatch, dict) and dispatch.get("executionStatus") == "completed" and dispatch.get("contribution")
            ]
            if completed_contributions:
                shortened = self._shorten_contribution(completed_contributions[0])
                parts_zh.append(f"{self._hero_name(result, 'zh')} 的 skill 子结论：{shortened}")
                parts_en.append(f"Skill contribution from {self._hero_name(result, 'en')}: {shortened}")
        if early_exit_names_zh:
            parts_zh.append(f"以下星使在过程中触发天劫/天演：{'、'.join(early_exit_names_zh)}。")
        if early_exit_names_en:
            parts_en.append(f"The following heroes triggered early exit or evolution during the run: {', '.join(early_exit_names_en)}.")
        return " ".join(parts_zh), " ".join(parts_en)

    def _shorten_contribution(self, contribution: str) -> str:
        normalized = " ".join(contribution.split())
        if len(normalized) <= 140:
            return normalized
        return f"{normalized[:137]}..."

    async def _simulate_executor(self, tool_name: str, params: Dict[str, Any]) -> str:
        if tool_name == "Read":
            file_path = Path(params.get("file_path", "README.md"))
            if not file_path.is_absolute():
                file_path = Path(__file__).parent / file_path
            if file_path.exists():
                return file_path.read_text(encoding="utf-8")[:240]
            return f"File not found: {file_path}"
        if tool_name == "Glob":
            root = Path(__file__).parent
            pattern = params.get("pattern", "**/*")
            matches = [str(path.relative_to(root)) for path in root.glob(pattern)]
            return "\n".join(matches[:20])
        if tool_name == "Grep":
            pattern = params.get("pattern", "")
            root = Path(__file__).parent
            matches = []
            for path in root.rglob("*"):
                if not path.is_file():
                    continue
                try:
                    text = path.read_text(encoding="utf-8")
                except Exception:
                    continue
                if pattern and pattern in text:
                    matches.append(str(path.relative_to(root)))
                if len(matches) >= 10:
                    break
            return "\n".join(matches) or f"No matches for {pattern}"
        if tool_name == "Write":
            return f"Prepared content for {params.get('file_path', 'output.md')} without mutating the repo."
        if tool_name == "Edit":
            return f"Prepared edit plan for {params.get('file_path', 'README.md')} without mutating the repo."
        if tool_name == "Bash":
            return str(Path(__file__).parent)
        return f"Executed {tool_name} with {params}"


harness_runner = TianLiHarnessRunner()


if HAS_FASTAPI:
    app = FastAPI(title="TianLi Harness API", version="3.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    WEB_DIR = Path(__file__).parent / "web"
    if WEB_DIR.exists():
        app.mount("/web", StaticFiles(directory=str(WEB_DIR)), name="web")

    @app.on_event("startup")
    async def startup_event():
        await harness_runner.bootstrap()

    @app.get("/")
    async def root():
        index_html = WEB_DIR / "index.html"
        dashboard_html = WEB_DIR / "dashboard.html"
        if index_html.exists():
            return FileResponse(str(index_html))
        if dashboard_html.exists():
            return FileResponse(str(dashboard_html))
        return {"status": "ok"}

    @app.get("/api/logs")
    @app.get("/api/logs/stream")
    async def stream_logs(request: Request):
        async def generate():
            last_index = 0
            for log in state.logs[-50:]:
                yield f"event: log\ndata: {json.dumps(_jsonable(log), ensure_ascii=False)}\n\n"
            yield f"event: stats\ndata: {json.dumps(state.stats_payload(), ensure_ascii=False)}\n\n"
            yield f"event: sky_state\ndata: {json.dumps(state.snapshot(), ensure_ascii=False)}\n\n"
            if state.latest_dispatch_decision:
                yield (
                    "event: dispatch_decision\n"
                    f"data: {json.dumps(state.latest_dispatch_decision, ensure_ascii=False)}\n\n"
                )
            if state.latest_run_summary:
                yield (
                    "event: delivery_ready\n"
                    f"data: {json.dumps(state.latest_run_summary, ensure_ascii=False)}\n\n"
                )
            last_index = len(state.events)

            while True:
                if await request.is_disconnected():
                    break
                if len(state.events) > last_index:
                    for event in state.events[last_index:]:
                        yield f"event: {event['event']}\ndata: {json.dumps(event['data'], ensure_ascii=False)}\n\n"
                    last_index = len(state.events)
                await asyncio.sleep(0.2)

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.get("/api/status")
    async def get_status():
        return state.snapshot()

    @app.get("/api/heroes")
    async def get_heroes():
        return {"heroes": list(state.heroes.values())}

    @app.get("/api/deliverables")
    async def get_deliverables(limit: int = 24):
        return {"items": _collect_deliverables(limit=max(1, min(limit, 100)))}

    @app.get("/api/deliverables/download")
    async def download_deliverable(path: str):
        file_path = _resolve_deliverable_path(path)
        return FileResponse(str(file_path), filename=file_path.name)

    @app.get("/api/metrics")
    async def get_metrics(range: str = "24h"):
        return _build_metrics(range)

    @app.get("/api/sessions")
    async def get_sessions(limit: int = 10, range: Optional[str] = None):
        safe_limit = max(1, min(limit, 100))
        return _build_session_summaries(limit=safe_limit, time_range=range)

    @app.get("/api/charts/{metric}")
    async def get_chart(metric: str, range: str = "24h"):
        return _build_chart_data(metric, range)

    @app.get("/api/conversations")
    async def get_conversations(limit: int = 50):
        safe_limit = max(1, min(limit, 100))
        return {"items": _build_conversations(limit=safe_limit)}

    @app.get("/api/skills")
    async def get_skills():
        return await _build_skills_inventory(harness_runner.registry, harness_runner.skill_registry)

    @app.get("/api/tasks/active")
    async def get_active_tasks(limit: int = 20):
        safe_limit = max(1, min(limit, 100))
        return _build_active_tasks(limit=safe_limit)

    @app.post("/api/skills/refresh")
    async def refresh_skills():
        return await harness_runner.refresh_remote_sources()

    @app.post("/api/run/start")
    async def start_run(payload: StartTaskRequest):
        return await harness_runner.start(payload)

    @app.post("/api/tasks/start")
    async def start_task(payload: StartTaskRequest):
        return await harness_runner.start(payload)

    @app.post("/api/run/verdict")
    async def submit_verdict(payload: VerdictRequest):
        return await harness_runner.submit_verdict(payload)

    @app.post("/api/run/stop")
    async def stop_run(taskId: Optional[str] = None):
        return harness_runner.stop(taskId)

    @app.get("/api/tasks/{task_id}")
    async def get_task(task_id: str):
        return state.tasks.get(task_id, {})

    @app.get("/api/logs/history")
    async def get_logs_history(limit: int = 100):
        return state.logs[-limit:]

    @app.get("/api/health")
    async def health_check():
        return _build_health_payload()


if __name__ == "__main__" and HAS_FASTAPI:  # pragma: no cover - manual execution
    with suppress(KeyboardInterrupt):
        uvicorn.run(app, host="0.0.0.0", port=1420)
