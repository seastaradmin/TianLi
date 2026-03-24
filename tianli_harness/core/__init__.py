"""Core module for TianLi Harness - State, Graph, Interceptor, Optimizer, and more."""

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

from tianli_harness.core.graph import HarnessEngine, build_harness_graph

from tianli_harness.core.interceptor import AuditResult, TianJieInterceptor

from tianli_harness.core.optimizer import TianYanOptimizer

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

from tianli_harness.core.parallel import execute_parallel_tasks

from tianli_harness.core.trend_researcher import TrendResearcher
