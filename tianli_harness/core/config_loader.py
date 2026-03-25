"""YAML configuration loader for TianLi Harness."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

from tianli_harness.core.state import HarnessConfig, RemoteHeroSource


@dataclass
class TianjieConfig:
    """TianJie (天劫) audit configuration."""

    drift_threshold: float = 0.4
    repetition_threshold: int = 3
    l2_sample_ratio: float = 0.3
    forbidden_words: List[str] = field(default_factory=list)


@dataclass
class TianyanConfig:
    """TianYan (天演) evolution configuration."""

    enabled: bool = True
    auto_commit: bool = False
    github_token: Optional[str] = None


@dataclass
class DispatchConfig:
    """Dispatch configuration."""

    mode: str = "hybrid"
    max_fanout: int = 2
    router_model: str = "claude-3-5-haiku-latest"
    audit_model: str = "claude-3-5-haiku-latest"
    default_hero_ids: List[str] = field(default_factory=list)


@dataclass
class HeroConfig:
    """Hero configuration."""

    id: str
    superpowers: List[str] = field(default_factory=list)
    use_predefined: bool = False


@dataclass
class TianLiYAMLConfig:
    """Root YAML configuration structure."""

    hero: HeroConfig
    tianjie: TianjieConfig = field(default_factory=TianjieConfig)
    tianyan: TianyanConfig = field(default_factory=TianyanConfig)
    dispatch: DispatchConfig = field(default_factory=DispatchConfig)
    checkpoint_path: str = "./tianli_harness/checkpoints.sqlite"
    skill_search_paths: List[str] = field(default_factory=list)
    max_skill_fanout: int = 2
    local_hero_prompts: Dict[str, str] = field(default_factory=dict)
    remote_sources: List[RemoteHeroSource] = field(default_factory=list)


class ConfigLoader:
    """Load TianLi Harness configuration from YAML files."""

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path
        if yaml is None:
            raise ImportError(
                "PyYAML is required for YAML configuration support. "
                "Install it with: pip install pyyaml"
            )

    def load(self, path: Optional[str] = None) -> TianLiYAMLConfig:
        """Load configuration from YAML file."""
        config_path = path or self.config_path
        if not config_path:
            raise ValueError("No configuration path provided")

        path_obj = Path(config_path)
        if not path_obj.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")

        content = path_obj.read_text(encoding="utf-8")
        data = yaml.safe_load(content)

        return self._parse_config(data)

    def load_from_string(self, yaml_content: str) -> TianLiYAMLConfig:
        """Load configuration from YAML string."""
        data = yaml.safe_load(yaml_content)
        return self._parse_config(data)

    def _parse_config(self, data: Dict[str, Any]) -> TianLiYAMLConfig:
        """Parse raw YAML data into typed configuration."""
        # Parse hero config
        hero_data = data.get("hero", {})
        hero = HeroConfig(
            id=hero_data.get("id", "engineering-hero"),
            superpowers=hero_data.get("superpowers", []),
            use_predefined=hero_data.get("use_predefined", False),
        )

        # Parse TianJie config
        tianjie_data = data.get("tianjie", {})
        tianjie = TianjieConfig(
            drift_threshold=tianjie_data.get("drift_threshold", 0.4),
            repetition_threshold=tianjie_data.get("repetition_threshold", 3),
            l2_sample_ratio=tianjie_data.get("l2_sample_ratio", 0.3),
            forbidden_words=tianjie_data.get("forbidden_words", []),
        )

        # Parse TianYan config
        tianyan_data = data.get("tianyan", {})
        tianyan = TianyanConfig(
            enabled=tianyan_data.get("enabled", True),
            auto_commit=tianyan_data.get("auto_commit", False),
            github_token=tianyan_data.get("github_token") or os.getenv("GITHUB_TOKEN"),
        )

        # Parse dispatch config
        dispatch_data = data.get("dispatch", {})
        dispatch = DispatchConfig(
            mode=dispatch_data.get("mode", "hybrid"),
            max_fanout=dispatch_data.get("max_fanout", 2),
            router_model=dispatch_data.get("router_model", "claude-3-5-haiku-latest"),
            audit_model=dispatch_data.get("audit_model", "claude-3-5-haiku-latest"),
            default_hero_ids=dispatch_data.get("default_hero_ids", []),
        )

        # Parse remote sources
        remote_sources_data = data.get("remote_sources", [])
        remote_sources = [
            RemoteHeroSource(
                source_id=src.get("source_id", ""),
                kind=src.get("kind", ""),
                url=src.get("url", ""),
                owner=src.get("owner", ""),
                repo=src.get("repo", ""),
                hero_ids=src.get("hero_ids", []),
                categories=src.get("categories", []),
                pages=src.get("pages", []),
                limit=src.get("limit", 0),
                enabled=src.get("enabled", True),
            )
            for src in remote_sources_data
        ]

        return TianLiYAMLConfig(
            hero=hero,
            tianjie=tianjie,
            tianyan=tianyan,
            dispatch=dispatch,
            checkpoint_path=data.get("checkpoint_path", "./tianli_harness/checkpoints.sqlite"),
            skill_search_paths=data.get("skill_search_paths", []),
            max_skill_fanout=data.get("max_skill_fanout", 2),
            local_hero_prompts=data.get("local_hero_prompts", {}),
            remote_sources=remote_sources,
        )

    def to_harness_config(self, yaml_config: TianLiYAMLConfig) -> HarnessConfig:
        """Convert YAML config to HarnessConfig for backward compatibility."""
        return HarnessConfig(
            hero_id=yaml_config.hero.id,
            superpowers=yaml_config.hero.superpowers,
            drift_threshold=yaml_config.tianjie.drift_threshold,
            repetition_threshold=yaml_config.tianjie.repetition_threshold,
            l2_sample_ratio=yaml_config.tianjie.l2_sample_ratio,
            forbidden_words=yaml_config.tianjie.forbidden_words,
            github_token=yaml_config.tianyan.github_token,
            dispatch_mode=yaml_config.dispatch.mode,
            max_fanout=yaml_config.dispatch.max_fanout,
            default_hero_ids=yaml_config.dispatch.default_hero_ids,
            router_model=yaml_config.dispatch.router_model,
            audit_model=yaml_config.dispatch.audit_model,
            checkpoint_path=yaml_config.checkpoint_path,
            skill_search_paths=yaml_config.skill_search_paths,
            max_skill_fanout=yaml_config.max_skill_fanout,
            local_hero_prompts=yaml_config.local_hero_prompts,
            remote_sources=yaml_config.remote_sources,
        )


def load_config(config_path: str) -> HarnessConfig:
    """Convenience function to load configuration from YAML file."""
    loader = ConfigLoader(config_path)
    yaml_config = loader.load()
    return loader.to_harness_config(yaml_config)


def load_config_from_string(yaml_content: str) -> HarnessConfig:
    """Convenience function to load configuration from YAML string."""
    loader = ConfigLoader()
    yaml_config = loader.load_from_string(yaml_content)
    return loader.to_harness_config(yaml_config)
