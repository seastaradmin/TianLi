"""State and domain models for TianLi Harness."""

from __future__ import annotations

import operator

from dataclasses import dataclass, field
from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional, TypedDict


@dataclass
class HeroCapability:
    """A named capability that helps route tasks to a hero."""

    name: str
    weight: float = 1.0


@dataclass
class RemoteHeroSource:
    """Remote source used to import hero or skill metadata into the local registry."""

    source_id: str
    kind: str
    url: str = ""
    owner: str = ""
    repo: str = ""
    hero_ids: List[str] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    pages: List[str] = field(default_factory=list)
    limit: int = 0
    enabled: bool = True


@dataclass
class HeroProfile:
    """Runtime hero profile used by the dispatcher and UI."""

    hero_id: str
    display_name: str
    description: str = ""
    display_name_zh: str = ""
    display_name_en: str = ""
    description_zh: str = ""
    description_en: str = ""
    tags: List[str] = field(default_factory=list)
    task_types: List[str] = field(default_factory=list)
    tools: List[str] = field(default_factory=list)
    linked_skills: List[str] = field(default_factory=list)
    capabilities: List[HeroCapability] = field(default_factory=list)
    star_position: Dict[str, float] = field(default_factory=lambda: {"x": 0.5, "y": 0.5})
    routing_priority: float = 0.5
    fallback_heroes: List[str] = field(default_factory=list)
    max_parallel_tasks: int = 1
    enabled: bool = True
    system_prompt: str = ""
    color: str = "#7dd3fc"
    source: str = "local"


@dataclass
class SkillDispatch:
    """A resolved skill assignment attached to a hero run."""

    skill_id: str
    status: str
    summary: str = ""
    guidance: str = ""
    source_path: str = ""
    match_score: float = 0.0
    reason: str = ""
    execution_status: str = "pending"
    contribution: str = ""
    latency_ms: int = 0


@dataclass
class HarnessConfig:
    """Configuration for TianLi Harness."""

    hero_id: str
    superpowers: List[str]
    drift_threshold: float = 0.4
    repetition_threshold: int = 3
    l2_sample_ratio: float = 0.3
    forbidden_words: List[str] = field(default_factory=list)
    repo_owner: str = "agency-agency"
    repo_name: str = "agency-agents"
    github_token: Optional[str] = None
    dispatch_mode: str = "hybrid"
    max_fanout: int = 1
    default_hero_ids: List[str] = field(default_factory=list)
    hero_registry_path: Optional[str] = None
    remote_sources: List[RemoteHeroSource] = field(default_factory=list)
    router_model: str = "claude-3-5-haiku-latest"
    audit_model: str = "claude-3-5-haiku-latest"
    checkpoint_path: str = "./tianli_harness/checkpoints.sqlite"
    local_hero_prompts: Dict[str, str] = field(default_factory=dict)
    skill_search_paths: List[str] = field(default_factory=list)
    max_skill_fanout: int = 2


@dataclass
class ActionTrace:
    """Trace of a single tool action and its audit result."""

    step: int
    tool_name: str
    observation: str
    hero_id: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    is_valid: bool = True
    audit_score: Optional[float] = None
    audit_reason: str = ""
    audit_stage: str = ""
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class TaskEnvelope:
    """Normalized task metadata used for dispatch decisions."""

    task_id: str
    content: str
    pinned_hero_ids: List[str] = field(default_factory=list)
    max_fanout: int = 1
    dispatch_mode: str = "hybrid"
    collaboration_mode: str = "primary_consult"
    tags: List[str] = field(default_factory=list)
    verdict_round: int = 0
    judgment_note: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class DispatchTarget:
    """A selected hero target for a task."""

    hero_id: str
    score: float
    reason: str


@dataclass
class DispatchDecision:
    """Final dispatch decision used by the backend and UI."""

    task_id: str
    strategy: str
    selected_hero_ids: List[str]
    primary_hero_id: Optional[str]
    consult_hero_ids: List[str] = field(default_factory=list)
    coordination_mode: str = "primary_consult"
    candidate_scores: Dict[str, float] = field(default_factory=dict)
    selected_targets: List[DispatchTarget] = field(default_factory=list)
    reasoning: str = ""
    fallback_used: bool = False
    model_used: Optional[str] = None


@dataclass
class TaskFlowEvent:
    """Event describing movement of work through the sky map."""

    event_id: str
    task_id: str
    source: str
    target: str
    status: str
    hero_id: Optional[str] = None
    label: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)


class TianLiState(TypedDict, total=False):
    """State for the TianLi Harness LangGraph workflow."""

    config: HarnessConfig
    task: TaskEnvelope
    messages: Annotated[List[Dict[str, Any]], operator.add]
    traces: Annotated[List[ActionTrace], operator.add]
    task_flow: Annotated[List[TaskFlowEvent], operator.add]
    current_status: str
    evolution_patch: str
    pending_tool_call: Optional[Dict[str, Any]]
    pending_audit: Optional[Dict[str, Any]]
    dispatch_decision: Optional[DispatchDecision]
