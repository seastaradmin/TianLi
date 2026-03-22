"""Unit tests for HeroRegistry."""

import json
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import pytest

from tianli_harness.core.registry import HeroRegistry
from tianli_harness.core.state import HarnessConfig, RemoteHeroSource


@pytest.mark.asyncio
async def test_registry_merges_remote_profiles(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(
        json.dumps(
            {
                "heroes": [
                    {
                        "hero_id": "builder/forge",
                        "display_name": "Forge",
                        "tags": ["local-tag"],
                        "task_types": ["coding"],
                        "tools": ["Read", "Write"],
                        "routing_priority": 0.9,
                        "system_prompt": "Local prompt",
                    }
                ],
                "remote_sources": [],
            }
        ),
        encoding="utf-8",
    )

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write"],
        hero_registry_path=str(registry_path),
    )
    registry = HeroRegistry(config)
    registry.remote_cache_path = tmp_path / "heroes.remote-cache.json"
    registry.remote_cache_path.write_text(
        json.dumps(
            {
                "heroes": [
                    {
                        "hero_id": "builder/forge",
                        "display_name": "Remote Forge",
                        "tags": ["remote-tag"],
                        "task_types": ["implementation"],
                        "tools": ["Edit"],
                        "routing_priority": 0.5,
                        "system_prompt": "Remote prompt",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    profiles = await registry.list_profiles(refresh_remote=False)

    assert len(profiles) == 1
    assert profiles[0].display_name == "Forge"
    assert "local-tag" in profiles[0].tags
    assert "remote-tag" in profiles[0].tags
    assert "Edit" in profiles[0].tools
    assert profiles[0].system_prompt == "Local prompt"


@pytest.mark.asyncio
async def test_registry_refreshes_generic_json_source(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps({"heroes": [], "remote_sources": []}), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write"],
        hero_registry_path=str(registry_path),
        remote_sources=[
            RemoteHeroSource(
                source_id="skills",
                kind="generic_json",
                url="https://example.com/heroes.json",
            )
        ],
    )
    registry = HeroRegistry(config)
    registry.remote_cache_path = tmp_path / "heroes.remote-cache.json"

    mock_response = Mock()
    mock_response.json.return_value = {
        "heroes": [
            {
                "hero_id": "remote/skill",
                "display_name": "Remote Skill",
                "tags": ["skill"],
                "task_types": ["automation"],
                "tools": ["Read"],
                "routing_priority": 0.7,
            }
        ]
    }
    mock_response.raise_for_status = Mock()

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        imported, errors = await registry.refresh_remote_sources()

    assert errors == []
    assert len(imported) == 1
    assert imported[0].hero_id == "remote/skill"
    cached = json.loads(registry.remote_cache_path.read_text(encoding="utf-8"))
    assert cached["heroes"][0]["hero_id"] == "remote/skill"


@pytest.mark.asyncio
async def test_registry_preserves_cached_remote_profiles_on_refresh_failure(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(
        json.dumps(
            {
                "heroes": [],
                "remote_sources": [
                    {
                        "source_id": "agency-agents",
                        "kind": "agency_agents",
                        "owner": "seastaradmin",
                        "repo": "agency-agents",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write"],
        hero_registry_path=str(registry_path),
    )
    registry = HeroRegistry(config)
    registry.remote_cache_path = tmp_path / "heroes.remote-cache.json"
    registry.remote_cache_path.write_text(
        json.dumps(
            {
                "heroes": [
                    {
                        "hero_id": "agency/design/ui-designer",
                        "display_name": "UI Designer",
                        "display_name_zh": "设计 · 界面 设计师",
                        "display_name_en": "UI Designer",
                        "description": "Imported hero",
                        "source": "agency-agents",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with patch.object(registry, "_refresh_source", AsyncMock(side_effect=RuntimeError("boom"))):
        imported, errors = await registry.refresh_remote_sources()

    assert len(errors) == 1
    assert imported[0].hero_id == "agency/design/ui-designer"
    cached = json.loads(registry.remote_cache_path.read_text(encoding="utf-8"))
    assert cached["heroes"][0]["hero_id"] == "agency/design/ui-designer"


@pytest.mark.asyncio
async def test_registry_refreshes_agency_agents_source_from_github_html(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps({"heroes": [], "remote_sources": []}), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write"],
        hero_registry_path=str(registry_path),
        remote_sources=[
            RemoteHeroSource(
                source_id="agency-agents",
                kind="agency_agents",
                owner="seastaradmin",
                repo="agency-agents",
                categories=["design"],
                limit=1,
            )
        ],
    )
    registry = HeroRegistry(config)
    registry.remote_cache_path = tmp_path / "heroes.remote-cache.json"

    category_response = Mock()
    category_response.text = """
    <a href="/seastaradmin/agency-agents/blob/main/design/design-ui-designer.md">design-ui-designer.md</a>
    """
    category_response.raise_for_status = Mock()

    raw_response = Mock()
    raw_response.text = """---
name: UI Designer
description: Expert in polished interface systems.
---
"""
    raw_response.raise_for_status = Mock()

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[category_response, raw_response])
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        imported, errors = await registry.refresh_remote_sources()

    assert errors == []
    assert len(imported) == 1
    assert imported[0].hero_id == "agency/design/ui-designer"
    assert imported[0].display_name_en == "UI Designer"
    assert imported[0].display_name_zh.startswith("设计")


@pytest.mark.asyncio
async def test_registry_refreshes_skills_directory_source_from_root_and_pages(tmp_path: Path):
    registry_path = tmp_path / "heroes.json"
    registry_path.write_text(json.dumps({"heroes": [], "remote_sources": []}), encoding="utf-8")

    config = HarnessConfig(
        hero_id="builder/forge",
        superpowers=["Read", "Write"],
        hero_registry_path=str(registry_path),
        remote_sources=[
            RemoteHeroSource(
                source_id="skills.sh",
                kind="skills_directory",
                url="https://skills.sh",
                pages=["", "trending"],
                limit=2,
            )
        ],
    )
    registry = HeroRegistry(config)
    registry.remote_cache_path = tmp_path / "heroes.remote-cache.json"

    root_response = Mock()
    root_response.text = """
    <a href="/anthropics/skills/frontend-design">Frontend Design</a>
    """
    root_response.raise_for_status = Mock()

    trending_response = Mock()
    trending_response.text = """
    <a href="/anthropics/skills/algorithmic-art">Algorithmic Art</a>
    """
    trending_response.raise_for_status = Mock()

    skill_a_response = Mock()
    skill_a_response.text = "<h1>Frontend Design</h1><h2>Design polished interfaces.</h2>"
    skill_a_response.raise_for_status = Mock()

    skill_b_response = Mock()
    skill_b_response.text = "<h1>Algorithmic Art</h1><h2>Create visual systems.</h2>"
    skill_b_response.raise_for_status = Mock()

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(
            side_effect=[root_response, trending_response, skill_a_response, skill_b_response]
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client_class.return_value = mock_client

        imported, errors = await registry.refresh_remote_sources()

    assert errors == []
    assert len(imported) == 2
    assert imported[0].hero_id == "skill/anthropics/skills/frontend-design"
    assert imported[1].hero_id == "skill/anthropics/skills/algorithmic-art"
