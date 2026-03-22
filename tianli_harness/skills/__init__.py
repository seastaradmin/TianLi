"""Skills module for TianLi."""

from .adapters import BrowserDevtoolsAdapter, UIDesignReviewAdapter, WebDesignGuidelinesAdapter
from .claw_proxy import OpenClawSkillManager
from .registry import LocalSkillExecutor, LocalSkillRegistry, SkillDispatchPlanner, SkillProfile

__all__ = [
    "BrowserDevtoolsAdapter",
    "LocalSkillExecutor",
    "LocalSkillRegistry",
    "OpenClawSkillManager",
    "SkillDispatchPlanner",
    "SkillProfile",
    "UIDesignReviewAdapter",
    "WebDesignGuidelinesAdapter",
]
