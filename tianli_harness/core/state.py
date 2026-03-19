"""State definitions for TianLi Harness."""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime


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


@dataclass
class ActionTrace:
    """Trace of a single tool action."""
    step: int
    tool_name: str
    observation: str
    is_valid: bool = True
    audit_score: Optional[float] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class TianLiState:
    """State for TianLi Harness LangGraph workflow."""
    config: HarnessConfig
    messages: List[Dict[str, Any]]
    traces: List[ActionTrace]
    current_status: Literal["starting", "running", "early_exit", "completed"] = "starting"
    evolution_patch: str = ""
