"""LangGraph nodes and workflow compilation for TianLi Harness."""

from typing import Literal, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.sqlite import SqliteSaver
from tianli_harness.core.state import TianLiState, HarnessConfig, ActionTrace
from tianli_harness.core.interceptor import TianJieInterceptor
from tianli_harness.dna.fetcher import DNAFetcher
from tianli_harness.skills.claw_proxy import OpenClawSkillManager


class HarnessGraphBuilder:
    """Builder for TianLi Harness LangGraph workflow."""

    def __init__(self, anthropic, skill_manager: OpenClawSkillManager):
        """
        Initialize graph builder.
        
        Args:
            anthropic: AsyncAnthropic client
            skill_manager: OpenClaw skill manager
        """
        self.anthropic = anthropic
        self.skill_manager = skill_manager

    async def node_fetch_dna(self, state: TianLiState) -> dict:
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

    async def node_agent_reason(self, state: TianLiState) -> dict:
        """
        Call LLM with bound tools.
        
        Note: In this integration, LLM reasoning is delegated to OpenClaw.
        This is a placeholder that expects tool calls to be injected.
        """
        # This is a placeholder - in real integration, OpenClaw's LLM would be called here
        # For now, we assume the messages already contain tool calls from OpenClaw
        return {"current_status": "running"}

    async def node_interceptor_audit(self, state: TianLiState) -> dict:
        """Intercept tool call before execution - TianJie audit."""
        config = state["config"]
        messages = state["messages"]
        traces = state["traces"]

        # Get the latest tool call from the last assistant message
        latest_tool_call = self._extract_latest_tool_call(messages[-1])
        if not latest_tool_call:
            # No tool call - should not reach here due to routing
            return {"current_status": "completed"}

        interceptor = TianJieInterceptor(self.anthropic, config)

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

    async def node_execute_claw(self, state: TianLiState) -> dict:
        """Execute approved tool call via OpenClaw in-process."""
        messages = state["messages"]
        traces = state["traces"]
        step_num = len(traces) + 1

        # Extract latest tool call
        latest_tool_call = self._extract_latest_tool_call(messages[-1])
        if not latest_tool_call:
            return {"current_status": "completed"}
            
        tool_name = latest_tool_call["name"]
        parameters = latest_tool_call["input"]
        tool_id = latest_tool_call.get("id", "unknown")

        # Execute via OpenClaw skill manager
        result = await self.skill_manager.execute_tool(tool_name, parameters)

        # Create trace
        trace = ActionTrace(
            step=step_num,
            tool_name=tool_name,
            observation=str(result),
            is_valid=True,
            audit_score=None
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

    def _extract_latest_tool_call(self, message: dict) -> Optional[dict]:
        """Extract latest tool call from message content."""
        content = message.get("content", [])
        
        # Handle string content (no tool calls)
        if isinstance(content, str):
            return None
            
        # Find the last tool_use block
        if isinstance(content, list):
            for block in reversed(content):
                if isinstance(block, dict) and block.get("type") == "tool_use":
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


def route_after_reason(state: TianLiState) -> Literal["to_audit", "to_end"]:
    """Route after reasoning - check if tool call needed."""
    messages = state["messages"]
    if not messages:
        return "to_end"
        
    last_message = messages[-1]
    content = last_message.get("content", [])

    # Handle string content
    if isinstance(content, str):
        return "to_end"

    # Check if there's a tool_use block
    has_tool_use = False
    if isinstance(content, list):
        has_tool_use = any(
            isinstance(block, dict) and block.get("type") == "tool_use"
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


def build_harness_graph(
    config: HarnessConfig,
    anthropic,
    skill_manager: OpenClawSkillManager
):
    """Build and compile the TianLi Harness LangGraph workflow."""
    
    builder = HarnessGraphBuilder(anthropic, skill_manager)

    workflow = StateGraph(TianLiState)

    workflow.add_node("fetch_dna", builder.node_fetch_dna)
    workflow.add_node("reason", builder.node_agent_reason)
    workflow.add_node("audit", builder.node_interceptor_audit)
    workflow.add_node("claw_exec", builder.node_execute_claw)

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
            "trigger_early_exit": END
        }
    )

    workflow.add_edge("claw_exec", "reason")

    # Enable checkpointing
    memory = SqliteSaver.from_conn_string(":memory:")
    app = workflow.compile(checkpointer=memory)

    return app


class HarnessEngine:
    """Main entry point for TianLi Harness engine."""

    def __init__(
        self,
        config: HarnessConfig,
        anthropic,
        openclaw_executor
    ):
        """
        Initialize Harness Engine.
        
        Args:
            config: Harness configuration
            anthropic: AsyncAnthropic client
            openclaw_executor: Async function for OpenClaw tool execution
        """
        self.config = config
        self.anthropic = anthropic
        self.skill_manager = OpenClawSkillManager(openclaw_executor)
        self.app = build_harness_graph(config, anthropic, self.skill_manager)

    async def run(self, thread_id: str, user_input: str):
        """
        Run the harness with given user input.
        
        Args:
            thread_id: Unique thread identifier for checkpointing
            user_input: User's initial prompt
            
        Returns:
            Final state dict
        """
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
