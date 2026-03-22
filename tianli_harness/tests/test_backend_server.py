"""Backend integration tests for the TianLi galaxy runner."""

import json
from pathlib import Path

import pytest

from backend_server import StartTaskRequest, TianLiHarnessRunner, VerdictRequest, state
from tianli_harness.core.registry import HeroRegistry
from tianli_harness.skills.adapters import UIDesignReviewAdapter, WebDesignGuidelinesAdapter
from tianli_harness.skills.registry import LocalSkillExecutor, LocalSkillRegistry, SkillDispatchPlanner


def _reset_state() -> None:
    state.total_steps = 0
    state.early_exits = 0
    state.l1_passes = 0
    state.l2_checks = 0
    state.logs = []
    state.heroes = {}
    state.tasks = {}
    state.flows = {}
    state.latest_dispatch_decision = None
    state.latest_run_summary = None
    state.events = []
    state._event_counter = 0


def _registry_payload() -> dict:
    return {
        "heroes": [
            {
                "hero_id": "builder/forge",
                "display_name": "Forge",
                "description": "Primary builder",
                "tags": ["frontend", "backend", "implement"],
                "task_types": ["coding"],
                "tools": ["Read", "Write", "Edit"],
                "linked_skills": ["ui-design-review"],
                "routing_priority": 0.95,
                "star_position": {"x": 0.28, "y": 0.35},
                "system_prompt": "Build the core solution.",
            },
            {
                "hero_id": "scribe/lumen",
                "display_name": "Lumen",
                "description": "Consulting writer",
                "tags": ["docs", "design", "report"],
                "task_types": ["documentation"],
                "tools": ["Read", "Write"],
                "linked_skills": ["web-design-guidelines"],
                "routing_priority": 0.82,
                "star_position": {"x": 0.7, "y": 0.26},
                "system_prompt": "Provide consulting support.",
            },
        ],
        "remote_sources": [],
    }


def _write_skill(root: Path, skill_id: str, description: str) -> None:
    skill_dir = root / skill_id
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        "\n".join(
            [
                "---",
                f"name: {skill_id}",
                f"description: {description}",
                "---",
                "",
                "# Skill",
                f"Use {skill_id} for targeted guidance.",
            ]
        ),
        encoding="utf-8",
    )


@pytest.mark.asyncio
async def test_verdict_rejection_reroutes_task(tmp_path: Path):
    _reset_state()
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps(_registry_payload()), encoding="utf-8")
    skills_root = tmp_path / "skills"
    _write_skill(skills_root, "ui-design-review", "Review visual design choices.")
    _write_skill(skills_root, "web-design-guidelines", "Check web UI structure.")

    runner = TianLiHarnessRunner()
    runner.base_config.hero_registry_path = str(registry_path)
    runner.base_config.default_hero_ids = ["builder/forge", "scribe/lumen"]
    runner.base_config.skill_search_paths = [str(skills_root)]
    runner.registry = HeroRegistry(runner.base_config)
    runner.skill_registry = LocalSkillRegistry(runner.base_config)
    runner.skill_dispatcher = SkillDispatchPlanner(runner.base_config, runner.skill_registry)
    runner.skill_executor = LocalSkillExecutor(
        runner.base_config,
        adapters=[
            UIDesignReviewAdapter(runner.base_config, repo_root=Path("/Users/ping/Desktop/TianLi")),
            WebDesignGuidelinesAdapter(
                runner.base_config,
                repo_root=Path("/Users/ping/Desktop/TianLi"),
                guideline_fetcher=lambda: "",
            ),
        ],
    )

    await runner.bootstrap()

    start_result = await runner.start(
        StartTaskRequest(
            task="Implement the feature and produce a design summary",
            maxFanout=2,
            collaborationMode="primary_consult",
        )
    )
    task_id = start_result["taskId"]

    await runner.active_runs[task_id]

    assert state.tasks[task_id]["status"] == "judgment_pending"
    assert state.tasks[task_id]["verdictRound"] == 0
    assert len(state.tasks[task_id]["skillDispatches"]) >= 1
    assert any(dispatch["status"] == "applied" for dispatch in state.tasks[task_id]["skillDispatches"])
    assert any(dispatch["executionStatus"] == "completed" for dispatch in state.tasks[task_id]["skillDispatches"])
    assert any(dispatch["contribution"] for dispatch in state.tasks[task_id]["skillDispatches"])

    verdict_result = await runner.submit_verdict(
        VerdictRequest(
            taskId=task_id,
            verdict="reject",
            judgmentNote="主方案不错，但需要更清晰的交付摘要。",
        )
    )

    assert verdict_result["status"] == "rerouting"

    await runner.active_runs[task_id]

    assert state.tasks[task_id]["status"] == "judgment_pending"
    assert state.tasks[task_id]["verdictRound"] == 1
    assert state.tasks[task_id]["judgmentNote"] == "主方案不错，但需要更清晰的交付摘要。"
    assert len(state.tasks[task_id]["history"]) == 1
    assert any(flow["round"] == 1 for flow in state.flows.values() if flow["taskId"] == task_id)
    assert any(dispatch["status"] == "applied" for dispatch in state.tasks[task_id]["skillDispatches"])
    assert any(dispatch["executionStatus"] == "completed" for dispatch in state.tasks[task_id]["skillDispatches"])
