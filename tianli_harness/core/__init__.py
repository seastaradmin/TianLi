"""Core module for TianLi Harness - Lazy loading to avoid circular dependencies."""

# 基础模块（无外部依赖）
from tianli_harness.core.state import (
    ActionTrace,
    DispatchDecision,
    DispatchTarget,
    HarnessConfig,
    HeroCapability,
    HeroProfile,
    RemoteHeroSource,
    SkillDispatch,
    TaskEnvelope,
    TaskFlowEvent,
    TianLiState,
)

from tianli_harness.core.heroes import (
    PREDEFINED_HEROES,
    get_all_predefined_heroes,
    get_heroes_by_category,
    get_heroes_by_task_type,
    get_heroes_by_tool,
    get_predefined_hero,
)

from tianli_harness.core.memory import get_project_memory

from tianli_harness.core.executors import get_orchestrator

# 可选模块（有外部依赖，延迟导入）
def __getattr__(name):
    """Lazy loading for optional modules"""
    
    if name == "HarnessEngine":
        try:
            from tianli_harness.core.graph import HarnessEngine
            return HarnessEngine
        except ImportError as e:
            raise ImportError(
                f"{name} requires langgraph. Install with: pip install langgraph"
            ) from e
    
    elif name == "build_harness_graph":
        try:
            from tianli_harness.core.graph import build_harness_graph
            return build_harness_graph
        except ImportError as e:
            raise ImportError(
                f"{name} requires langgraph. Install with: pip install langgraph"
            ) from e
    
    elif name == "TianJieInterceptor":
        try:
            from tianli_harness.core.interceptor import TianJieInterceptor
            return TianJieInterceptor
        except ImportError as e:
            raise ImportError(
                f"{name} requires langgraph. Install with: pip install langgraph"
            ) from e
    
    elif name == "AuditResult":
        try:
            from tianli_harness.core.interceptor import AuditResult
            return AuditResult
        except ImportError as e:
            raise ImportError(
                f"{name} requires langgraph. Install with: pip install langgraph"
            ) from e
    
    elif name == "TianYanOptimizer":
        try:
            from tianli_harness.core.optimizer import TianYanOptimizer
            return TianYanOptimizer
        except ImportError as e:
            raise ImportError(
                f"{name} requires langgraph. Install with: pip install langgraph"
            ) from e
    
    elif name == "execute_parallel_tasks":
        try:
            from tianli_harness.core.parallel import execute_parallel_tasks
            return execute_parallel_tasks
        except ImportError as e:
            raise ImportError(
                f"{name} requires langgraph. Install with: pip install langgraph"
            ) from e
    
    elif name == "TrendResearcher":
        try:
            from tianli_harness.core.trend_researcher import TrendResearcher
            return TrendResearcher
        except ImportError as e:
            raise ImportError(
                f"{name} requires langgraph. Install with: pip install langgraph"
            ) from e
    
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


# 明确导出列表
__all__ = [
    # 基础模块
    "ActionTrace",
    "DispatchDecision",
    "DispatchTarget",
    "HarnessConfig",
    "HeroCapability",
    "HeroProfile",
    "RemoteHeroSource",
    "SkillDispatch",
    "TaskEnvelope",
    "TaskFlowEvent",
    "TianLiState",
    "PREDEFINED_HEROES",
    "get_all_predefined_heroes",
    "get_heroes_by_category",
    "get_heroes_by_task_type",
    "get_heroes_by_tool",
    "get_predefined_hero",
    "get_project_memory",
    "get_orchestrator",
    
    # 可选模块（延迟加载）
    "HarnessEngine",
    "build_harness_graph",
    "TianJieInterceptor",
    "AuditResult",
    "TianYanOptimizer",
    "execute_parallel_tasks",
    "TrendResearcher",
]
