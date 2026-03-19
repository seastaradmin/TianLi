# TianLi Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build TianLi Harness - a layered constitutional Agent governance sandbox with early exit (天劫) and automatic evolution (天演) for OpenClaw, based on LangGraph.

**Architecture:** Lightweight in-process integration that reuses OpenClaw's existing session management, LLM client, and tool execution. Uses LangGraph only for control flow orchestration and checkpointing. Two-layer auditing: L1 coarse filtering (hard rules, no LLM cost) and L2 sampled deep semantic checking.

**Tech Stack:**
- Python 3.10+
- LangGraph (control flow + checkpointing)
- Pydantic v2 (strict type validation)
- PyGithub / GitPython (GitHub API for auto-commit)
- Requests (fetch DNA from GitHub)

---

## File Structure

| File | Responsibility | Status |
|------|----------------|--------|
| `core/state.py` | State definition: HarnessConfig, ActionTrace, TianLiState | ✅ Already implemented (updated per design review) |
| `core/graph.py` | LangGraph nodes definition + workflow compilation | ⬜ To implement |
| `core/interceptor.py` | TianJie interceptor - L1 coarse filtering + L2 deep checking | ⬜ To implement |
| `core/optimizer.py` | TianYan optimizer - generate evolution patch + auto-commit | ⬜ To implement |
| `dna/fetcher.py` | GitHub DNA fetcher - fetch Hero prompt with caching | ⬜ To implement |
| `skills/base.py` | Superpower abstract base class | ✅ Already implemented |
| `skills/claw_proxy.py` | Strong-typed OpenClaw tool proxy (in-process) | ✅ Already refactored |
| `tests/test_harness.py` | Unit tests | ⬜ To implement |
| `requirements.txt` | Dependencies list | ✅ Already created |

---

## Task 1: Implement DNA Fetcher

**Files:**
- Create: `tianli_harness/dna/fetcher.py`
- Test: `tianli_harness/tests/test_fetcher.py`

### Steps:

- [ ] **Step 1: Define cache data structure**

```python
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

@dataclass
class CachedDNA:
    content: str
    fetched_at: datetime
    ttl: int  # seconds
```

- [ ] **Step 2: Implement DNAFetcher class**

```python
class DNAFetcher:
    """Fetches Hero DNA (System Prompt) from GitHub repository."""

    def __init__(self, cache_ttl: int = 3600):
        self.cache_ttl = cache_ttl
        self._cache: Dict[str, CachedDNA] = {}

    async def fetch(
        self,
        hero_id: str,
        repo_owner: str = "agency-agency",
        repo_name: str = "agency-agents",
        github_token: Optional[str] = None
    ) -> str:
        """Fetch DNA from GitHub, returns content. Uses cached copy if still valid."""
        # Check cache first
        cache_key = f"{repo_owner}/{repo_name}/{hero_id}"
        cached = self._cache.get(cache_key)
        if cached:
            if datetime.now() - cached.fetched_at < timedelta(seconds=cached.ttl):
                return cached.content

        # Construct raw URL
        url = f"https://raw.githubusercontent.com/{repo_owner}/{repo_name}/main/{hero_id}.md"

        # Fetch with optional auth
        headers = {}
        if github_token:
            headers["Authorization"] = f"token {github_token}"

        response = await requests.get(url, headers=headers)
        response.raise_for_status()
        content = response.text

        # Cache
        self._cache[cache_key] = CachedDNA(
            content=content,
            fetched_at=datetime.now(),
            ttl=self.cache_ttl
        )

        return content

    def invalidate_cache(self, hero_id: str, repo_owner: str, repo_name: str) -> None:
        """Force invalidate cached entry."""
        cache_key = f"{repo_owner}/{repo_name}/{hero_id}"
        self._cache.pop(cache_key, None)

    def clear_cache(self) -> None:
        """Clear entire cache."""
        self._cache.clear()
```

- [ ] **Step 3: Add error handling**

Handle:
- 404: raise ValueError with helpful message
- Network errors: propagate with context
- Empty content: raise ValueError

- [ ] **Step 4: Write unit tests**

```python
import pytest
from unittest.mock import patch, Mock
from tianli_harness.dna.fetcher import DNAFetcher

def test_fetch_cached():
    fetcher = DNAFetcher()
    # Add to cache manually
    # Check returns cached
    pass

def test_fetch_network():
    fetcher = DNAFetcher()
    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = "# Test Prompt"
        mock_get.return_value = mock_response
        result = fetcher.fetch("test")
        assert result == "# Test Prompt"

def test_fetch_404():
    fetcher = DNAFetcher()
    with patch('requests.get') as mock_get:
        mock_response = Mock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response
        mock_get.return_value.raise_for_status.side_effect = Exception()
        with pytest.raises(Exception):
            fetcher.fetch("not-found")
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
cd tianli_harness
python -m pytest tests/test_fetcher.py -v
```

- [ ] **Step 6: Commit**

```bash
git add tianli_harness/dna/fetcher.py tianli_harness/tests/test_fetcher.py
git commit -m "feat(dna): implement DNA fetcher with caching"
```

---

## Task 2: Implement TianJie Interceptor (Layered Constitution)

**Files:**
- Create: `tianli_harness/core/interceptor.py`
- Test: `tianli_harness/tests/test_interceptor.py`

### Steps:

- [ ] **Step 1: Define AuditResult class**

```python
from pydantic import BaseModel, Field
from typing import Optional

class AuditResult(BaseModel):
    """Result of TianJie audit check."""
    should_continue: bool = Field(description="True if check passed, False to trigger early exit")
    reason: str = Field(description="Reason for the decision")
    score: Optional[float] = Field(default=None, description="L2 alignment score if checked")
```

- [ ] **Step 2: Implement TianJieInterceptor class**

```python
import random
import difflib
from typing import List, Optional
from anthropic import AsyncAnthropic
from tianli_harness.core.state import HarnessConfig, ActionTrace

class TianJieInterceptor:
    """Layered Constitution interceptor - TianJie (天劫) auditing.

    Two-layer checking:
    - L1: Coarse filtering (repetition, forbidden words, format) - no LLM cost
    - L2: Sampled deep semantic alignment checking - LLM call to score alignment
    """

    def __init__(self, anthropic: AsyncAnthropic, config: HarnessConfig):
        self.anthropic = anthropic
        self.config = config

    def check_l1(
        self,
        tool_name: str,
        parameters: dict,
        traces: List[ActionTrace]
    ) -> AuditResult:
        """Run L1 coarse filtering - synchronous, no LLM call."""

        # Check 1: Repetition detection
        recent_tools = [t.tool_name for t in traces[-self.config.repetition_threshold:]]
        if len(recent_tools) >= self.config.repetition_threshold:
            # All recent are same tool - check parameters similarity
            if all(t == tool_name for t in recent_tools):
                # Check parameter similarity with last one
                last_params = traces[-1].observation
                current_str = str(parameters)
                similarity = difflib.SequenceMatcher(
                    None, current_str, last_params
                ).ratio()
                if similarity > 0.9:
                    return AuditResult(
                        should_continue=False,
                        reason=f"L1: Repetition detected - {similarity:.2f} similar parameters for {tool_name}",
                        score=None
                    )

        # Check 2: Forbidden words in output/parameters
        forbidden = self.config.forbidden_words if hasattr(self.config, 'forbidden_words') else []
        if forbidden:
            content = str(parameters).lower()
            for word in forbidden:
                if word.lower() in content:
                    return AuditResult(
                        should_continue=False,
                        reason=f"L1: Forbidden word '{word}' detected",
                        score=None
                    )

        # Check 3: Empty parameters check
        if not parameters or all(v is None or v == "" for v in parameters.values()):
            return AuditResult(
                should_continue=False,
                reason="L1: Empty parameters detected",
                score=None
            )

        # All L1 checks passed
        return AuditResult(
            should_continue=True,
            reason="L1: All checks passed",
            score=None
        )

    def should_do_l2_check(self) -> bool:
        """Random sampling based on l2_sample_ratio."""
        if self.config.l2_sample_ratio >= 1.0:
            return True
        if self.config.l2_sample_ratio <= 0.0:
            return False
        return random.random() < self.config.l2_sample_ratio

    async def check_l2(
        self,
        original_prompt: str,
        conversation_history: List[dict],
        tool_name: str,
        tool_parameters: dict
    ) -> AuditResult:
        """Run L2 deep semantic alignment check - LLM call required."""

        prompt = f"""你是 TianLi Harness 天劫监察者。

原始任务目标：
---
{original_prompt}
---

当前对话历史：
---
{self._format_history(conversation_history)}
---

模型即将调用工具：
工具名称: {tool_name}
参数: {self._format_dict(tool_parameters)}
---

请给当前即将执行的动作打分：
- 1.0 分：完全对齐目标，动作合理
- 0.0 分：完全偏离目标，动作毫无意义

只返回一个 0.0 到 1.0 之间的浮点数分数，不要解释。
"""

        response = await self.anthropic.messages.create(
            model="claude-opus-4-6",
            max_tokens=10,
            thinking={"type": "adaptive"},
            messages=[{"role": "user", "content": prompt}]
        )

        # Parse score from response
        text = "".join(b.text for b in response.content if b.type == "text").strip()
        try:
            score = float(text)
        except ValueError:
            # Failed to parse - treat as pass to avoid false positives
            return AuditResult(
                should_continue=True,
                reason=f"L2: Failed to parse score '{text}', proceeding",
                score=None
            )

        # Clamp score to valid range
        score = max(0.0, min(1.0, score))

        if score < self.config.drift_threshold:
            return AuditResult(
                should_continue=False,
                reason=f"L2: Semantic drift detected - score {score:.2f} < threshold {self.config.drift_threshold:.2f}",
                score=score
            )

        return AuditResult(
            should_continue=True,
            reason=f"L2: Alignment check passed - score {score:.2f} >= threshold {self.config.drift_threshold:.2f}",
            score=score
        )

    def _format_history(self, history: List[dict]) -> str:
        """Format conversation history for prompt."""
        lines = []
        for i, msg in enumerate(history[-10:]):  # Only last 10 messages
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            if isinstance(content, str):
                lines.append(f"{role}: {content[:200]}...")
            else:
                lines.append(f"{role}: [content blocks]")
        return "\n".join(lines)

    def _format_dict(self, d: dict) -> str:
        """Format dict nicely."""
        return "\n".join(f"  {k}: {v}" for k, v in d.items())
```

- [ ] **Step 3: Write unit tests for L1 checks**

```python
import pytest
from tianli_harness.core.interceptor import TianJieInterceptor
from tianli_harness.core.state import HarnessConfig, ActionTrace

def test_l1_repetition_trigger():
    config = HarnessConfig(
        hero_id="test",
        superpowers=["Read"],
        repetition_threshold=3
    )
    interceptor = TianJieInterceptor(None, config)
    # Create 3 repeated tool calls with similar parameters
    traces = [
        ActionTrace(step=1, tool_name="Read", observation="{}", is_valid=True),
        ActionTrace(step=2, tool_name="Read", observation="{'file_path': 'test.py'}", is_valid=True),
        ActionTrace(step=3, tool_name="Read", observation="{'file_path': 'test.py'}", is_valid=True),
    ]
    result = interceptor.check_l1("Read", {"file_path": "test.py"}, traces)
    assert result.should_continue == False
    assert "Repetition detected" in result.reason

def test_l1_passed():
    config = HarnessConfig(hero_id="test", superpowers=["Read"])
    interceptor = TianJieInterceptor(None, config)
    traces = [
        ActionTrace(step=1, tool_name="Read", observation="{'file_path': 'a.py'}"),
        ActionTrace(step=2, tool_name="Glob", observation="{'pattern': '*.py'}"),
    ]
    result = interceptor.check_l1("Grep", {"pattern": "test"}, traces)
    assert result.should_continue == True
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_interceptor.py -v
```

- [ ] **Step 5: Commit**

```bash
git add tianli_harness/core/interceptor.py tianli_harness/tests/test_interceptor.py
git commit -m "feat(core): implement TianJie interceptor with layered constitution"
```

---

## Task 3: Implement LangGraph Nodes and Workflow

**Files:**
- Create: `tianli_harness/core/graph.py`

### Steps:

- [ ] **Step 1: Imports**

```python
from typing import Literal
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
from anthropic import AsyncAnthropic
from tianli_harness.core.state import TianLiState
from tianli_harness.core.interceptor import TianJieInterceptor, AuditResult
from tianli_harness.dna.fetcher import DNAFetcher
from tianli_harness.skills.claw_proxy import OpenClawSkillManager
```

- [ ] **Step 2: node_fetch_dna**

```python
async def node_fetch_dna(state: TianliState) -> dict:
    """Fetch DNA (Hero prompt) from GitHub and add as system message."""
    config = state["config"]
    fetcher = DNAFetcher()
    prompt = await fetcher.fetch(
        config.hero_id,
        config.repo_owner,
        config.repo_name,
        config.github_token
    )
    # Add as system message
    return {
        "messages": [{"role": "system", "content": prompt}],
        "current_status": "running"
    }
```

- [ ] **Step 3: node_agent_reason**

> Note: LLM reasoning is delegated to OpenClaw, this wrapper just passes through

```python
async def node_agent_reason(state: TianliState) -> dict:
    """Call LLM with bound tools - uses Anthropic client directly."""
    config = state["config"]
    # This integration point expects that we have an Anthropic client
    # injected from OpenClaw context
    return NotImplementedError("Should be handled by injected reasoner")
```

- [ ] **Step 4: node_interceptor_audit**

```python
async def node_interceptor_audit(state: TianliState) -> dict:
    """Intercept tool call before execution - TianJie audit."""
    config = state["config"]
    messages = state["messages"]
    traces = state["traces"]

    # Get the latest tool call from the last assistant message
    # Implementation depends on how tool calls are structured
    # For Anthropic API: find the last tool_use block

    latest_tool_call = self._extract_latest_tool_call(messages[-1])
    if not latest_tool_call:
        # No tool call - should not reach here due to routing
        return {"current_status": "completed"}

    interceptor = TianJieInterceptor(anthropic, config)

    # L1 check always runs
    l1_result = interceptor.check_l1(
        latest_tool_call["name"],
        latest_tool_call["input"],
        traces
    )

    if not l1_result.should_continue:
        return {
            "current_status": "early_exit"
        }

    # L2 check - sampled
    if interceptor.should_do_l2_check():
        original_system = self._get_original_system_prompt(messages)
        l2_result = await interceptor.check_l2(
            original_system,
            messages,
            latest_tool_call["name"],
            latest_tool_call["input"]
        )
        if not l2_result.should_continue:
            return {
                "current_status": "early_exit"
            }
        # Store score in trace if we did the check
        # (trace gets added after execution in claw_exec)

    # All checks passed
    return {
        "current_status": "running"
    }

def _extract_latest_tool_call(self, message: dict) -> Optional[dict]:
    """Extract latest tool call from message content."""
    content = message.get("content", [])
    # Find the last tool_use block
    for block in reversed(content):
        if block.get("type") == "tool_use":
            return {
                "name": block.get("name"),
                "input": block.get("input", {}),
                "id": block.get("id")
            }
    return None

def _get_original_system_prompt(self, messages: List[dict]) -> str:
    """Extract the original system prompt from messages."""
    for msg in messages:
        if msg.get("role") == "system":
            content = msg.get("content", "")
            if isinstance(content, str):
                return content
    return ""
```

- [ ] **Step 5: node_execute_claw**

```python
async def node_execute_claw(state: TianliState) -> dict:
    """Execute approved tool call via OpenClaw in-process."""
    from tianli_harness.core.state import ActionTrace

    messages = state["messages"]
    config = state["config"]
    traces = state["traces"]
    step_num = len(traces) + 1

    # Extract latest tool call
    latest_tool_call = self._extract_latest_tool_call(messages[-1])
    tool_name = latest_tool_call["name"]
    parameters = latest_tool_call["input"]
    tool_id = latest_tool_call["id"]

    # Execute via OpenClaw skill manager
    result = await skill_manager.execute_tool(tool_name, parameters)

    # Create trace
    trace = ActionTrace(
        step=step_num,
        tool_name=tool_name,
        observation=str(result),
        is_valid=True,
        audit_score=None  # TODO: get score from audit if L2 was done
    )

    # Return tool result as tool_result message
    return {
        "traces": [trace],
        "messages": [{
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_id,
                "content": str(result)
            }]
        }]
    }
```

- [ ] **Step 6: node_optimizer**

```python
async def node_optimizer(state: TianliState) -> dict:
    """Generate evolution patch after early exit - TianYan optimization."""
    from tianli_harness.core.optimizer import TianYanOptimizer

    config = state["config"]
    messages = state["messages"]
    traces = state["traces"]

    optimizer = TianYanOptimizer(anthropic, config)
    patch = await optimizer.generate_patch(messages, traces)

    # If we have github token, attempt auto-commit
    if config.github_token:
        try:
            commit_url = await optimizer.commit_patch(
                patch,
                config.hero_id,
                config.repo_owner,
                config.repo_name,
                config.github_token
            )
            patch += f"\n\n---\n\n✅ Auto-committed to GitHub: {commit_url}"
        except Exception as e:
            patch += f"\n\n---\n\n⚠️ Auto-commit failed: {str(e)}"

    return {
        "evolution_patch": patch,
        "current_status": "early_exit"
    }
```

- [ ] **Step 7: Routing functions**

```python
def route_after_reason(state: TianLiState) -> Literal["to_audit", "to_end"]:
    """Route after reasoning - check if tool call needed."""
    messages = state["messages"]
    last_message = messages[-1]
    content = last_message.get("content", [])

    # Check if there's a tool_use block
    has_tool_use = any(
        block.get("type") == "tool_use"
        for block in content
    )

    if has_tool_use:
        return "to_audit"
    return "to_end"

def route_after_audit(state: TianLiState) -> Literal["execute", "trigger_early_exit"]:
    """Route after audit - continue or trigger early exit."""
    if state["current_status"] == "early_exit":
        return "trigger_early_exit"
    return "execute"
```

- [ ] **Step 8: Compile workflow**

```python
def build_harness_graph(config: HarnessConfig):
    """Build and compile the TianLi Harness LangGraph workflow."""

    workflow = StateGraph(TianLiState)

    workflow.add_node("fetch_dna", node_fetch_dna)
    workflow.add_node("reason", node_agent_reason)
    workflow.add_node("audit", node_interceptor_audit)
    workflow.add_node("claw_exec", node_execute_claw)
    workflow.add_node("optimizer", node_optimizer)

    workflow.set_entry_point("fetch_dna")
    workflow.add_edge("fetch_dna", "reason")

    workflow.add_conditional_edges(
        "reason",
        route_after_reason,
        {
            "to_audit": "audit",
            "to_end": END
        }
    )

    workflow.add_conditional_edges(
        "audit",
        route_after_audit,
        {
            "execute": "claw_exec",
            "trigger_early_exit": "optimizer"
        }
    )

    workflow.add_edge("claw_exec", "reason")
    workflow.add_edge("optimizer", END)

    # Enable checkpointing
    memory = SqliteSaver.from_conn_string(":memory:")
    app = workflow.compile(checkpointer=memory)

    return app
```

- [ ] **Step 9: Add HarnessEngine wrapper class**

```python
class HarnessEngine:
    """Main entry point for TianLi Harness engine."""

    def __init__(
        self,
        config: HarnessConfig,
        anthropic: AsyncAnthropic,
        openclaw_executor
    ):
        self.config = config
        self.anthropic = anthropic
        self.skill_manager = OpenClawSkillManager(openclaw_executor)
        self.app = build_harness_graph(config)

    async def run(self, thread_id: str, user_input: str):
        """Run the harness with given user input."""
        config = self.config
        initial_state: TianLiState = {
            "config": config,
            "messages": [{"role": "user", "content": user_input}],
            "traces": [],
            "current_status": "starting",
            "evolution_patch": ""
        }

        result = await self.app.ainvoke(
            initial_state,
            config={"configurable": {"thread_id": thread_id}}
        )

        return result
```

- [ ] **Step 10: Commit**

```bash
git add tianli_harness/core/graph.py
git commit -m "feat(core): implement LangGraph nodes and harness engine"
```

---

## Task 4: Implement TianYan Optimizer

**Files:**
- Create: `tianli_harness/core/optimizer.py`
- Test: `tianli_harness/tests/test_optimizer.py`

### Steps:

- [ ] **Step 1: Implement TianYanOptimizer class**

```python
from typing import List
from anthropic import AsyncAnthropic
from github import Github
from datetime import datetime
from tianli_harness.core.state import ActionTrace, HarnessConfig

class TianYanOptimizer:
    """TianYan (天演) optimizer - generates evolution patches for System Prompts
    after early exit, and optionally auto-commits to GitHub."""

    def __init__(self, anthropic: AsyncAnthropic, config: HarnessConfig):
        self.anthropic = anthropic
        self.config = config

    async def generate_patch(
        self,
        messages: List[dict],
        traces: List[ActionTrace]
    ) -> str:
        """Generate evolution patch after early exit."""

        # Extract original system prompt
        original_prompt = ""
        for msg in messages:
            if msg.get("role") == "system":
                original_prompt = msg.get("content", "")
                break

        # Collect failed traces
        failed_traces = [t for t in traces if not t.is_valid]
        if not failed_traces:
            # If no explicit failed, take last few
            failed_traces = traces[-3:]

        failed_text = self._format_failed_traces(failed_traces)

        prompt = f"""你是 TianLi Harness 天演优化器。

原始 System Prompt 来自 GitHub:
---
{original_prompt}
---

执行历史中，以下步骤触发了天劫熔断:
---
{failed_text}
---

请总结失败原因，给出一份对原始 System Prompt 的修改建议 Patch。

Patch 应当：
1. 指出哪些地方需要修改
2. 给出修改后的具体内容
3. 解释为什么这样修改能防止未来再次触发同样的天劫

请用 markdown 格式输出，使用 git diff 风格展示改动。
"""

        response = await self.anthropic.messages.create(
            model="claude-opus-4-6",
            max_tokens=2048,
            thinking={"type": "adaptive"},
            messages=[{"role": "user", "content": prompt}]
        )

        text = "".join(b.text for b in response.content if b.type == "text").strip()
        return text

    async def commit_patch(
        self,
        patch_content: str,
        hero_id: str,
        repo_owner: str,
        repo_name: str,
        github_token: str
    ) -> str:
        """Commit the evolution patch to GitHub as a new branch."""
        g = Github(github_token)
        repo = g.get_repo(f"{repo_owner}/{repo_name}")

        # Create new branch
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        branch_name = f"tianli/evolution-{timestamp}"
        source = repo.get_branch("main")
        repo.create_git_ref(
            ref=f"refs/heads/{branch_name}",
            sha=source.commit.sha
        )

        # Update the file - for now, we just append the evolution patch
        # In future, could apply the patch properly
        file_path = f"{hero_id}.md"
        try:
            contents = repo.get_contents(file_path, ref="main")
            existing_content = contents.decoded_content.decode("utf-8")
            new_content = existing_content + "\n\n---\n\n## TianLi Evolution Patch\n\n" + patch_content
            repo.update_file(
                file_path,
                f"tianli: auto-evolution - fix early exit on {hero_id}",
                new_content,
                contents.sha,
                branch=branch_name
            )
        except Exception as e:
            # File doesn't exist - create it
            repo.create_file(
                file_path,
                f"tianli: auto-evolution - initial {hero_id} with evolution patch",
                patch_content,
                branch=branch_name
            )

        # Return the compare URL
        return f"https://github.com/{repo_owner}/{repo_name}/compare/main...{branch_name}"

    def _format_failed_traces(self, traces: List[ActionTrace]) -> str:
        """Format failed traces for prompt."""
        lines = []
        for i, trace in enumerate(traces):
            lines.append(f"Step {trace.step}: tool={trace.tool_name}")
            lines.append(f"Observation: {trace.observation[:200]}")
            if trace.audit_score is not None:
                lines.append(f"Audit score: {trace.audit_score:.2f}")
            lines.append("---")
        return "\n".join(lines)
```

- [ ] **Step 2: Write unit tests**

```python
import pytest
from unittest.mock import Mock, patch
from tianli_harness.core.optimizer import TianYanOptimizer
from tianli_harness.core.state import HarnessConfig, ActionTrace

def test_generate_patch():
    mock_anthropic = Mock()
    # Setup mock response
    config = HarnessConfig(hero_id="test", superpowers=[])
    optimizer = TianYanOptimizer(mock_anthropic, config)
    # Test structure
    traces = [
        ActionTrace(step=1, tool_name="Read", observation="error", is_valid=False, audit_score=0.2)
    ]
    messages = [
        {"role": "system", "content": "Original prompt"},
        {"role": "user", "content": "Do something"},
    ]
    # Should construct prompt correctly
    result = optimizer._format_failed_traces(traces)
    assert "Step 1" in result
    assert "audit_score" in result
```

- [ ] **Step 3: Run tests**

```bash
python -m pytest tests/test_optimizer.py -v
```

- [ ] **Step 4: Commit**

```bash
git add tianli_harness/core/optimizer.py tianli_harness/tests/test_optimizer.py
git commit -m "feat(core): implement TianYan optimizer with auto-commit"
```

---

## Task 5: Create Entry Point and Example Usage

**Files:**
- Create: `tianli_harness/__init__.py`
- Create: `tianli_harness/examples/hello_world.py`

### Steps:

- [ ] **Step 1: `__init__.py` exports**

```python
"""TianLi Harness -天劫天演 Agent 治理沙箱 for OpenClaw"""

__version__ = "0.1.0"

from .core.state import HarnessConfig, ActionTrace, TianLiState
from .core.graph import HarnessEngine
from .dna.fetcher import DNAFetcher

__all__ = [
    "HarnessConfig",
    "ActionTrace",
    "TianLiState",
    "HarnessEngine",
    "DNAFetcher",
]
```

- [ ] **Step 2: Example usage**

```python
"""
Example: Run TianLi Harness with a simple hero prompt
"""

import asyncio
import anthropic
from tianli_harness import HarnessConfig, HarnessEngine
from tianli_harness.skills.claw_proxy import OpenClawSkillManager

# Example openclaw executor - in real use, this is injected from OpenClaw
async def example_openclaw_executor(tool_name: str, params: dict):
    """Example executor that just logs and returns"""
    print(f"[OpenClaw execute] {tool_name} with {params}")
    return f"Executed {tool_name} successfully"

async def main():
    # Initialize
    client = anthropic.AsyncAnthropic()
    config = HarnessConfig(
        hero_id="example-hero",
        superpowers=["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
        drift_threshold=0.4,
        repo_owner="agency-agency",
        repo_name="agency-agents",
    )
    skill_manager = OpenClawSkillManager(example_openclaw_executor)
    engine = HarnessEngine(config, client, example_openclaw_executor)

    # Run
    result = await engine.run(
        thread_id="example-001",
        user_input="Help me implement a simple hello world function"
    )

    print(f"Status: {result['current_status']}")
    if result["current_status"] == "early_exit":
        print(f"Evolution patch:\n{result['evolution_patch']}")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 3: Commit**

```bash
git add tianli_harness/__init__.py tianli_harness/examples/hello_world.py
git commit -m "feat: add entry point and example usage"
```

---

## Task 6: Add README and Run Full Test Suite

**Files:**
- Create: `tianli_harness/README.md`
- Run all tests

### Steps:

- [ ] **Step 1: Create README**

Write README with:
- Project description
- Architecture overview (layered constitution)
- Installation instructions
- Usage example
- Configuration options

- [ ] **Step 2: Run full test suite**

```bash
cd tianli_harness
python -m pytest tests/ -v
```

- [ ] **Step 3: Fix any failing tests**

- [ ] **Step 4: Commit**

```bash
git add tianli_harness/README.md
git commit -m "docs: add README with usage instructions"
```

---

## Plan Complete

Total tasks: 6 tasks, broken into ~30 smaller steps. Each step is 2-5 minutes work for an engineer.

After completion:
- All core modules implemented
- Unit tests for all components
- Example usage provided
- Ready for integration into OpenClaw
