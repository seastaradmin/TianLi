"""OpenClaw Skill Manager - Strong-typed tool execution proxy."""

from typing import Any, Dict, Callable, Awaitable


class OpenClawSkillManager:
    """Manages OpenClaw tool execution."""

    def __init__(self, executor: Callable[[str, Dict[str, Any]], Awaitable[Any]]):
        """
        Initialize skill manager.
        
        Args:
            executor: Async function that executes tools (tool_name, params) -> result
        """
        self.executor = executor

    async def execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Any:
        """
        Execute a tool via OpenClaw.
        
        Args:
            tool_name: Name of the tool to execute
            parameters: Tool parameters as dict
            
        Returns:
            Tool execution result
        """
        return await self.executor(tool_name, parameters)
