#!/usr/bin/env python3
"""TianLi Harness backend server with multi-destiny galaxy state."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from contextlib import suppress
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

from tianli_harness import HarnessConfig, HarnessEngine
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
        return {"status": "ok", "running": state.stats_payload()["activeTasks"] > 0}


if __name__ == "__main__" and HAS_FASTAPI:  # pragma: no cover - manual execution
    with suppress(KeyboardInterrupt):
        uvicorn.run(app, host="0.0.0.0", port=1420)
