#!/usr/bin/env python3
"""
Example: Parallel Execution with TianLi Harness

This example demonstrates how to use TianLi's parallel execution
feature to decompose and execute complex tasks across multiple heroes.

Compare with DeerFlow's sub-agent approach:
- DeerFlow: Lead Agent → Sub-Agents → Docker Sandbox
- TianLi: Task Decomposer → Parallel Heroes → Git Worktrees
"""

import asyncio
from tianli_harness.core.parallel import (
    ParallelExecutor,
    ParallelTask,
    TaskDecomposer,
    ResultMerger,
    execute_parallel_tasks,
)
from tianli_harness import HarnessEngine, load_config
from tianli_harness.core.memory import get_project_memory


async def example_1_simple_parallel():
    """
    Example 1: Simple parallel execution with predefined tasks.
    
    This is similar to DeerFlow's sub-agent spawning, but uses
    git worktrees instead of Docker containers for isolation.
    """
    print("\n" + "="*60)
    print("Example 1: Simple Parallel Execution")
    print("="*60)
    
    # Define tasks for different heroes
    tasks = [
        {
            "task_id": "frontend-task",
            "hero_id": "frontend-hero",
            "description": "Implement login form with React and Tailwind CSS",
            "priority": 8,
        },
        {
            "task_id": "backend-task",
            "hero_id": "backend-hero",
            "description": "Create authentication API endpoints",
            "priority": 8,
        },
        {
            "task_id": "db-task",
            "hero_id": "db-hero",
            "description": "Design user schema and migration",
            "priority": 9,
        },
        {
            "task_id": "qa-task",
            "hero_id": "qa-hero",
            "description": "Write security tests for authentication",
            "priority": 7,
        },
    ]
    
    # Execute in parallel (max 3 concurrent)
    results = await execute_parallel_tasks(
        tasks,
        repo_path=".",
        max_parallel=3,
    )
    
    # Process results
    print("\n📊 Results:")
    for result in results:
        status_emoji = "✅" if result.status == "success" else "❌"
        print(f"{status_emoji} {result.hero_id}: {result.task_id} - {result.status}")
        if result.output:
            print(f"   Output: {str(result.output)[:100]}...")
        if result.error:
            print(f"   Error: {result.error}")
    
    print(f"\n⏱️  Total execution time: {sum(r.execution_time_ms for r in results) / 1000:.2f}s")
    
    return results


async def example_2_intelligent_decomposition():
    """
    Example 2: Intelligent task decomposition.
    
    This mimics DeerFlow's lead agent decomposition, but uses
    TianLi's professional heroes instead of generic sub-agents.
    """
    print("\n" + "="*60)
    print("Example 2: Intelligent Task Decomposition")
    print("="*60)
    
    # Complex high-level task
    complex_task = """
    Build a complete e-commerce platform with:
    - User registration and login
    - Product catalog with search and filtering
    - Shopping cart and checkout
    - Payment integration (Stripe)
    - Order management
    - Admin dashboard
    """
    
    # Available heroes
    available_heroes = [
        "frontend-hero",
        "backend-hero",
        "db-hero",
        "security-hero",
        "devops-hero",
    ]
    
    # Decompose task
    decomposer = TaskDecomposer(llm_client=None)  # Pass Anthropic client for LLM decomposition
    subtasks = await decomposer.decompose(
        complex_task,
        available_heroes,
        max_subtasks=5,
    )
    
    print(f"\n📋 Decomposed into {len(subtasks)} sub-tasks:")
    for i, task in enumerate(subtasks, 1):
        print(f"{i}. {task.hero_id}: {task.description[:80]}...")
    
    # Execute sub-tasks in parallel
    executor = ParallelExecutor(repo_path=".", max_parallel=3)
    
    async def mock_executor(task, worktree_path):
        """Mock executor - replace with real HarnessEngine"""
        return {
            "task": task.description,
            "hero": task.hero_id,
            "worktree": worktree_path,
            "status": "completed",
        }
    
    try:
        results = await executor.execute_parallel(subtasks, mock_executor)
        
        # Merge results
        merger = ResultMerger(llm_client=None)  # Pass Anthropic client for LLM merging
        merged = await merger.merge(complex_task, results)
        
        print(f"\n📦 Merged Result:")
        print(f"Summary: {merged.get('summary', 'N/A')}")
        print(f"Successful: {merged.get('successful_subtasks', 0)}")
        print(f"Failed: {merged.get('failed_subtasks', 0)}")
        
        if merged.get('warnings'):
            print(f"\n⚠️  Warnings:")
            for warning in merged['warnings']:
                print(f"  - {warning}")
        
        return merged
        
    finally:
        executor.cleanup()


async def example_3_with_harness_engine():
    """
    Example 3: Parallel execution with real HarnessEngine.
    
    This shows how to integrate parallel execution with
    TianLi's constitutional audit system.
    """
    print("\n" + "="*60)
    print("Example 3: Parallel Execution with Audit")
    print("="*60)
    
    # Load configuration
    config = load_config("examples/tianli-config.yaml")
    
    # Mock OpenClaw executor
    async def mock_openclaw_executor(tool_name, params):
        return {"status": "ok", "tool": tool_name}
    
    # Create tasks for parallel execution
    tasks = [
        ParallelTask(
            task_id="auth-feature",
            hero_id="backend-hero",
            description="Implement JWT authentication",
            priority=9,
        ),
        ParallelTask(
            task_id="ui-login",
            hero_id="frontend-hero",
            description="Create login UI component",
            priority=8,
        ),
        ParallelTask(
            task_id="db-users",
            hero_id="db-hero",
            description="Design users table schema",
            priority=9,
        ),
    ]
    
    # Execute with audit
    executor = ParallelExecutor(repo_path=".", max_parallel=2)
    
    async def execute_with_audit(task, worktree_path):
        """Execute task with constitutional audit"""
        # Create hero-specific engine
        config.hero_id = task.hero_id
        engine = HarnessEngine(config, None, mock_openclaw_executor)
        
        # Run with audit
        result = await engine.run(task.task_id, task.description)
        
        return {
            "task_id": task.task_id,
            "hero_id": task.hero_id,
            "status": result.get("current_status", "unknown"),
            "audit_passed": result.get("current_status") != "early_exit",
            "evolution_patch": result.get("evolution_patch", ""),
            "worktree": str(worktree_path),
        }
    
    try:
        results = await executor.execute_parallel(tasks, execute_with_audit)
        
        print("\n📊 Audit Results:")
        for result in results:
            status = result.output
            if status:
                audit_status = "✅ Passed" if status.get("audit_passed") else "❌ Failed (Early Exit)"
                print(f"{status['hero_id']}: {audit_status}")
                
                if status.get("evolution_patch"):
                    print(f"   Evolution patch generated!")
        
        return results
        
    finally:
        executor.cleanup()


async def example_4_compare_with_deerflow():
    """
    Example 4: Compare TianLi vs DeerFlow approach.
    
    DeerFlow: Lead Agent → Sub-Agents (Docker) → Merge
    TianLi: Decomposer → Heroes (Worktrees) + Audit → Merge
    """
    print("\n" + "="*60)
    print("Example 4: TianLi vs DeerFlow Comparison")
    print("="*60)
    
    task = "Build a SaaS dashboard with analytics"
    
    print(f"\n📝 Task: {task}")
    
    print("\n🦌 DeerFlow Approach:")
    print("1. Lead Agent decomposes into sub-tasks")
    print("2. Spawns 5-10 Sub-Agents in Docker containers")
    print("3. Each sub-agent works independently")
    print("4. Results merged by lead agent")
    print("5. Total time: ~10-30 minutes")
    print("6. Isolation: Docker (strong)")
    print("7. Audit: None")
    
    print("\n🦐 TianLi Approach:")
    print("1. TaskDecomposer breaks into 3-5 hero tasks")
    print("2. ParallelExecutor runs heroes in git worktrees")
    print("3. Each hero passes through TianJie audit")
    print("4. Early exit if audit fails (saves tokens)")
    print("5. ResultMerger synthesizes outputs")
    print("6. Total time: ~5-15 minutes")
    print("7. Isolation: Git Worktrees (medium)")
    print("8. Audit: L1+L2 (15+ rules)")
    
    print("\n💡 Key Differences:")
    print("- DeerFlow: More parallelism, less governance")
    print("- TianLi: Balanced parallelism + audit")
    print("- DeerFlow: Docker isolation (stronger)")
    print("- TianLi: Constitutional audit (unique)")
    print("- DeerFlow: Long-running tasks (hours)")
    print("- TianLi: Fast iteration (minutes)")


async def main():
    """Run all examples."""
    print("\n" + "🦐"*30)
    print("TianLi Parallel Execution Examples")
    print("🦐"*30)
    
    # Run examples
    await example_1_simple_parallel()
    await example_2_intelligent_decomposition()
    await example_3_with_harness_engine()
    await example_4_compare_with_deerflow()
    
    print("\n" + "="*60)
    print("Examples Complete!")
    print("="*60)
    print("\n📚 Next Steps:")
    print("1. Read docs/VS_DEERFLOW.md for detailed comparison")
    print("2. Try parallel execution with your own tasks")
    print("3. Integrate with your existing HarnessEngine workflow")
    print("4. Contribute to TianLi on GitHub!")
    print("\n🔗 GitHub: https://github.com/seastaradmin/TianLi")
    print("📖 Docs: https://github.com/seastaradmin/TianLi/docs")


if __name__ == "__main__":
    asyncio.run(main())
