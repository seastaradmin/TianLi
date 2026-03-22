"""Unit tests for the TianLi dispatcher."""

import json
from pathlib import Path

import pytest

from tianli_harness.core.dispatcher import TOKEN_PATTERN, TaskDispatcher
from tianli_harness.core.registry import HeroRegistry
from tianli_harness.core.state import HarnessConfig


def _registry_payload():
    return {
        "heroes": [
            {
                "hero_id": "builder/forge",
                "display_name": "Forge",
                "tags": ["frontend", "backend", "implement"],
                "task_types": ["coding"],
                "tools": ["Read", "Write", "Edit"],
                "routing_priority": 0.9,
                "system_prompt": "Builder prompt",
            },
            {
                "hero_id": "auditor/sentinel",
                "display_name": "Sentinel",
                "tags": ["review", "testing", "quality"],
                "task_types": ["review"],
                "tools": ["Read", "Grep", "Glob"],
                "routing_priority": 0.8,
                "system_prompt": "Audit prompt",
            },
        ],
        "remote_sources": [],
    }


@pytest.mark.asyncio
async def test_dispatch_pinned_hero(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps(_registry_payload()), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write", "Edit", "Grep", "Glob"],
        hero_registry_path=str(registry_path),
        default_hero_ids=["builder/forge"],
    )
    registry = HeroRegistry(config)
    dispatcher = TaskDispatcher(config, registry)

    task, decision, profiles = await dispatcher.dispatch(
        content="Please review this architecture",
        pinned_hero_ids=["auditor/sentinel"],
        max_fanout=1,
    )

    assert task.pinned_hero_ids == ["auditor/sentinel"]
    assert decision.selected_hero_ids == ["auditor/sentinel"]
    assert decision.primary_hero_id == "auditor/sentinel"
    assert decision.consult_hero_ids == []
    assert profiles[0].hero_id == "auditor/sentinel"


@pytest.mark.asyncio
async def test_dispatch_falls_back_to_default(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps(_registry_payload()), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write", "Edit", "Grep", "Glob"],
        hero_registry_path=str(registry_path),
        default_hero_ids=["builder/forge"],
    )
    registry = HeroRegistry(config)
    dispatcher = TaskDispatcher(config, registry)

    _, decision, _profiles = await dispatcher.dispatch(
        content="Compose a symphony for moonlight clouds",
        max_fanout=1,
    )

    assert decision.selected_hero_ids == ["builder/forge"]
    assert decision.coordination_mode == "primary_consult"
    assert decision.fallback_used is True


@pytest.mark.asyncio
async def test_dispatch_does_not_match_partial_slug_tokens(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps(_registry_payload()), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write", "Edit", "Grep", "Glob"],
        hero_registry_path=str(registry_path),
        default_hero_ids=["builder/forge"],
    )
    registry = HeroRegistry(config)
    dispatcher = TaskDispatcher(config, registry)

    lowered = "compose a symphony for moonlight clouds"
    token_set = set(TOKEN_PATTERN.findall(lowered))

    assert dispatcher._matches_keyword("gh", lowered, token_set) is False
    assert dispatcher._matches_keyword("moonlight", lowered, token_set) is True


@pytest.mark.asyncio
async def test_dispatch_respects_max_fanout(tmp_path: Path):
    payload = _registry_payload()
    payload["heroes"].append(
        {
            "hero_id": "scribe/lumen",
            "display_name": "Lumen",
            "tags": ["docs", "design", "report"],
            "task_types": ["documentation"],
            "tools": ["Read", "Write"],
            "routing_priority": 0.75,
            "system_prompt": "Docs prompt",
        }
    )
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps(payload), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write", "Edit", "Grep", "Glob"],
        hero_registry_path=str(registry_path),
        default_hero_ids=["builder/forge", "auditor/sentinel"],
        max_fanout=3,
    )
    registry = HeroRegistry(config)
    dispatcher = TaskDispatcher(config, registry)

    _, decision, _profiles = await dispatcher.dispatch(
        content="Implement the feature and then review the quality and docs",
        max_fanout=2,
    )

    assert len(decision.selected_hero_ids) == 2
    assert decision.primary_hero_id in decision.selected_hero_ids
    assert len(decision.consult_hero_ids) == 1
    assert set(decision.selected_hero_ids).issubset({"builder/forge", "auditor/sentinel", "scribe/lumen"})


@pytest.mark.asyncio
async def test_dispatch_solo_mode_limits_fanout(tmp_path: Path):
    payload = _registry_payload()
    payload["heroes"].append(
        {
            "hero_id": "scribe/lumen",
            "display_name": "Lumen",
            "tags": ["docs", "report"],
            "task_types": ["documentation"],
            "tools": ["Read", "Write"],
            "routing_priority": 0.75,
            "system_prompt": "Docs prompt",
        }
    )
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps(payload), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write", "Edit", "Grep", "Glob"],
        hero_registry_path=str(registry_path),
        default_hero_ids=["builder/forge", "auditor/sentinel"],
        max_fanout=3,
    )
    registry = HeroRegistry(config)
    dispatcher = TaskDispatcher(config, registry)

    task, decision, _profiles = await dispatcher.dispatch(
        content="Implement and document the feature",
        max_fanout=3,
        collaboration_mode="solo",
    )

    assert task.collaboration_mode == "solo"
    assert task.max_fanout == 1
    assert len(decision.selected_hero_ids) == 1
    assert decision.consult_hero_ids == []
    assert decision.coordination_mode == "solo"
