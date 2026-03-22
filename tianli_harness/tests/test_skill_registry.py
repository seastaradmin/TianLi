"""Tests for local skill registry and dispatch planner."""

import json
from pathlib import Path

import pytest

from tianli_harness.core.state import HarnessConfig, HeroProfile, TaskEnvelope
from tianli_harness.skills.adapters import UIDesignReviewAdapter, WebDesignGuidelinesAdapter
from tianli_harness.skills.registry import LocalSkillExecutor, LocalSkillRegistry, SkillDispatchPlanner


def _write_skill(root: Path, skill_id: str, description: str, body: str) -> None:
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
                body,
            ]
        ),
        encoding="utf-8",
    )


@pytest.mark.asyncio
async def test_local_skill_registry_resolves_skill(tmp_path: Path):
    _write_skill(
        tmp_path,
        "ui-design-review",
        "Review visual polish and hierarchy.",
        "Use this skill to evaluate visual quality and hierarchy decisions.",
    )
    config = HarnessConfig(
        hero_id="scribe/lumen",
        superpowers=["Read", "Write"],
        skill_search_paths=[str(tmp_path)],
    )

    registry = LocalSkillRegistry(config)
    resolved = await registry.resolve("ui-design-review")

    assert resolved is not None
    assert resolved.skill_id == "ui-design-review"
    assert resolved.description == "Review visual polish and hierarchy."
    assert "visual quality" in resolved.guidance


@pytest.mark.asyncio
async def test_skill_dispatch_planner_selects_and_builds_context(tmp_path: Path):
    _write_skill(
        tmp_path,
        "web-design-guidelines",
        "Check web UI structure and accessibility.",
        "Use this skill to verify web UI structure, interface clarity, and accessibility tradeoffs.",
    )
    _write_skill(
        tmp_path,
        "ui-design-review",
        "Review visual design choices.",
        "Use this skill to improve visual hierarchy, palette, and typography.",
    )

    config = HarnessConfig(
        hero_id="scribe/lumen",
        superpowers=["Read", "Write"],
        skill_search_paths=[str(tmp_path)],
        max_skill_fanout=2,
    )
    planner = SkillDispatchPlanner(config)
    hero = HeroProfile(
        hero_id="scribe/lumen",
        display_name="Lumen",
        tags=["design", "ux", "docs"],
        task_types=["documentation", "design"],
        linked_skills=["web-design-guidelines", "ui-design-review"],
    )
    task = TaskEnvelope(
        task_id="task-1",
        content="Design a cleaner frontend page and improve the UI hierarchy.",
        tags=["design", "frontend", "ui"],
    )

    dispatches = await planner.dispatch_for_hero(task, hero)
    context = planner.build_context(dispatches)

    assert len(dispatches) == 2
    assert all(dispatch.status == "applied" for dispatch in dispatches)
    assert "Local skill briefings selected for this run" in context
    assert "web-design-guidelines" in context or "ui-design-review" in context


@pytest.mark.asyncio
async def test_local_skill_executor_generates_parallel_contributions(tmp_path: Path):
    _write_skill(
        tmp_path,
        "ui-design-review",
        "Review visual design choices.",
        "Use this skill to improve visual hierarchy, palette, and typography.",
    )
    config = HarnessConfig(
        hero_id="scribe/lumen",
        superpowers=["Read", "Write"],
        skill_search_paths=[str(tmp_path)],
        max_skill_fanout=1,
    )
    planner = SkillDispatchPlanner(config)
    executor = LocalSkillExecutor(
        config,
        adapters=[
            UIDesignReviewAdapter(config, repo_root=Path("/Users/ping/Desktop/TianLi")),
            WebDesignGuidelinesAdapter(config, repo_root=Path("/Users/ping/Desktop/TianLi"), guideline_fetcher=lambda: ""),
        ],
    )
    hero = HeroProfile(
        hero_id="scribe/lumen",
        display_name="Lumen",
        tags=["design", "ux"],
        task_types=["design"],
        linked_skills=["ui-design-review"],
    )
    task = TaskEnvelope(
        task_id="task-2",
        content="Redesign the galaxy homepage so the first screen feels like a single starfield stage.",
        tags=["design", "ui"],
    )

    dispatches = await planner.dispatch_for_hero(task, hero)
    executed = await executor.execute_for_hero(task, hero, "primary", dispatches)
    context = planner.build_context(executed)

    assert len(executed) == 1
    assert executed[0].execution_status == "completed"
    assert executed[0].contribution
    assert "Contribution:" in context
