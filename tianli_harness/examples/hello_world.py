"""
Example: Run TianLi Harness with a simple hero prompt

This example demonstrates how to use TianLi Harness with OpenClaw.
"""

import asyncio
import anthropic
from tianli_harness import HarnessConfig, HarnessEngine
from tianli_harness.skills.claw_proxy import OpenClawSkillManager


async def example_openclaw_executor(tool_name: str, params: dict):
    """
    Example executor that just logs and returns.
    
    In real use, this is injected from OpenClaw context.
    """
    print(f"[OpenClaw execute] {tool_name} with {params}")
    return f"Executed {tool_name} successfully"


async def main():
    """Run the example."""
    # Initialize
    client = anthropic.AsyncAnthropic()
    config = HarnessConfig(
        hero_id="example-hero",
        superpowers=["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
        drift_threshold=0.4,
        repo_owner="agency-agency",
        repo_name="agency-agents",
    )
    
    # Create skill manager and engine
    skill_manager = OpenClawSkillManager(example_openclaw_executor)
    engine = HarnessEngine(config, client, example_openclaw_executor)

    # Run
    print("Starting TianLi Harness...")
    result = await engine.run(
        thread_id="example-001",
        user_input="Help me implement a simple hello world function"
    )

    print(f"\nStatus: {result['current_status']}")
    if result.get("evolution_patch"):
        print(f"\nEvolution patch:\n{result['evolution_patch']}")
    
    print(f"\nTraces: {len(result.get('traces', []))} tool calls executed")


if __name__ == "__main__":
    asyncio.run(main())
