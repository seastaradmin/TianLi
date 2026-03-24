"""Parallel execution with git worktrees for TianLi Harness."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
import subprocess

logger = logging.getLogger(__name__)


@dataclass
class ParallelTask:
    """Task definition for parallel execution."""
    
    task_id: str
    hero_id: str
    description: str
    input_data: Dict[str, Any] = field(default_factory=dict)
    priority: int = 0  # Higher = more important
    timeout_seconds: int = 300
    worktree_name: Optional[str] = None


@dataclass
class ParallelResult:
    """Result from parallel task execution."""
    
    task_id: str
    hero_id: str
    status: str  # success, failure, timeout, error
    output: Any = None
    error: Optional[str] = None
    worktree_path: Optional[str] = None
    execution_time_ms: int = 0
    metrics: Dict[str, Any] = field(default_factory=dict)


class GitWorktreeManager:
    """Manage git worktrees for isolated parallel execution."""
    
    def __init__(self, repo_path: str, base_worktree_dir: str = ".tianli/worktrees"):
        self.repo_path = Path(repo_path)
        self.base_worktree_dir = self.repo_path / base_worktree_dir
        self.worktrees: Dict[str, Path] = {}
        
        # Ensure worktree directory exists
        self.base_worktree_dir.mkdir(parents=True, exist_ok=True)
    
    def create_worktree(self, name: str, branch: str = "main") -> Path:
        """Create a new worktree for isolated execution."""
        worktree_path = self.base_worktree_dir / name
        
        try:
            # Check if worktree already exists
            if worktree_path.exists():
                logger.warning(f"Worktree {name} already exists, removing...")
                self.remove_worktree(name)
            
            # Create worktree
            cmd = [
                "git", "worktree", "add",
                "-b", f"worktree/{name}",
                str(worktree_path),
                branch
            ]
            
            result = subprocess.run(
                cmd,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"Failed to create worktree: {result.stderr}")
            
            self.worktrees[name] = worktree_path
            logger.info(f"Created worktree {name} at {worktree_path}")
            
            return worktree_path
            
        except Exception as e:
            logger.error(f"Failed to create worktree {name}: {e}")
            raise
    
    def remove_worktree(self, name: str):
        """Remove a worktree."""
        worktree_path = self.base_worktree_dir / name
        
        try:
            # Remove worktree using git
            cmd = ["git", "worktree", "remove", str(worktree_path), "--force"]
            subprocess.run(
                cmd,
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Clean up directory if still exists
            if worktree_path.exists():
                shutil.rmtree(worktree_path)
            
            if name in self.worktrees:
                del self.worktrees[name]
            
            logger.info(f"Removed worktree {name}")
            
        except Exception as e:
            logger.error(f"Failed to remove worktree {name}: {e}")
            # Force remove directory
            if worktree_path.exists():
                shutil.rmtree(worktree_path, ignore_errors=True)
    
    def cleanup_all(self):
        """Remove all worktrees."""
        for name in list(self.worktrees.keys()):
            try:
                self.remove_worktree(name)
            except Exception:
                pass
        
        # Remove base directory
        if self.base_worktree_dir.exists():
            shutil.rmtree(self.base_worktree_dir, ignore_errors=True)


class ParallelExecutor:
    """Execute multiple tasks in parallel with isolation."""
    
    def __init__(
        self,
        repo_path: str,
        max_parallel: int = 3,
        base_worktree_dir: str = ".tianli/worktrees",
    ):
        self.repo_path = Path(repo_path)
        self.max_parallel = max_parallel
        self.worktree_manager = GitWorktreeManager(repo_path, base_worktree_dir)
        self.semaphore = asyncio.Semaphore(max_parallel)
    
    async def execute_parallel(
        self,
        tasks: List[ParallelTask],
        executor_callback=None,
    ) -> List[ParallelResult]:
        """
        Execute multiple tasks in parallel using git worktrees for isolation.
        
        Args:
            tasks: List of tasks to execute
            executor_callback: Async callback to execute each task
                              Signature: async def execute(task, worktree_path) -> result
        
        Returns:
            List of ParallelResult objects
        """
        if not tasks:
            return []
        
        logger.info(f"Starting parallel execution of {len(tasks)} tasks (max {self.max_parallel} concurrent)")
        
        # Create worktrees for all tasks
        for i, task in enumerate(tasks):
            if not task.worktree_name:
                task.worktree_name = f"task-{task.task_id}-{i}"
        
        # Execute tasks with semaphore for concurrency control
        async def execute_with_semaphore(task: ParallelTask) -> ParallelResult:
            async with self.semaphore:
                return await self._execute_single_task(task, executor_callback)
        
        # Run all tasks concurrently (limited by semaphore)
        results = await asyncio.gather(
            *[execute_with_semaphore(task) for task in tasks],
            return_exceptions=True
        )
        
        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append(ParallelResult(
                    task_id=tasks[i].task_id,
                    hero_id=tasks[i].hero_id,
                    status="error",
                    error=str(result),
                ))
            else:
                processed_results.append(result)
        
        logger.info(f"Completed parallel execution: {len(processed_results)} tasks")
        
        return processed_results
    
    async def _execute_single_task(
        self,
        task: ParallelTask,
        executor_callback,
    ) -> ParallelResult:
        """Execute a single task in isolated worktree."""
        start_time = datetime.now()
        worktree_path = None
        
        try:
            # Create isolated worktree
            worktree_path = self.worktree_manager.create_worktree(task.worktree_name)
            
            # Execute task with timeout
            if executor_callback:
                # Use provided callback
                output = await asyncio.wait_for(
                    executor_callback(task, worktree_path),
                    timeout=task.timeout_seconds
                )
            else:
                # Default: just return task info
                output = {
                    "task_id": task.task_id,
                    "hero_id": task.hero_id,
                    "description": task.description,
                    "worktree": str(worktree_path),
                }
            
            execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            return ParallelResult(
                task_id=task.task_id,
                hero_id=task.hero_id,
                status="success",
                output=output,
                worktree_path=str(worktree_path),
                execution_time_ms=execution_time_ms,
            )
            
        except asyncio.TimeoutError:
            execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.warning(f"Task {task.task_id} timed out after {task.timeout_seconds}s")
            
            return ParallelResult(
                task_id=task.task_id,
                hero_id=task.hero_id,
                status="timeout",
                error=f"Task timed out after {task.timeout_seconds} seconds",
                worktree_path=str(worktree_path) if worktree_path else None,
                execution_time_ms=execution_time_ms,
            )
            
        except Exception as e:
            execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            logger.error(f"Task {task.task_id} failed: {e}")
            
            return ParallelResult(
                task_id=task.task_id,
                hero_id=task.hero_id,
                status="error",
                error=str(e),
                worktree_path=str(worktree_path) if worktree_path else None,
                execution_time_ms=execution_time_ms,
            )
    
    def cleanup(self):
        """Clean up all worktrees."""
        logger.info("Cleaning up all worktrees...")
        self.worktree_manager.cleanup_all()


class TaskDecomposer:
    """Decompose complex tasks into parallel sub-tasks."""
    
    def __init__(self, llm_client=None):
        self.llm_client = llm_client
    
    async def decompose(
        self,
        task_description: str,
        available_heroes: List[str],
        max_subtasks: int = 5,
    ) -> List[ParallelTask]:
        """
        Decompose a complex task into parallel sub-tasks.
        
        Args:
            task_description: High-level task description
            available_heroes: List of available hero IDs
            max_subtasks: Maximum number of sub-tasks to create
        
        Returns:
            List of ParallelTask objects
        """
        if not self.llm_client:
            # Fallback: simple keyword-based decomposition
            return self._simple_decompose(task_description, available_heroes, max_subtasks)
        
        # Use LLM for intelligent decomposition
        prompt = f"""You are a task decomposition expert.

Given a high-level task, break it down into independent sub-tasks that can be executed in parallel.

Task: {task_description}

Available Heroes: {', '.join(available_heroes)}

Create up to {max_subtasks} sub-tasks. For each sub-task, specify:
1. A unique task_id (short, descriptive)
2. The best hero_id for this sub-task
3. A clear description of what to do
4. Priority (0-10, higher = more important)

Return ONLY a JSON array of sub-tasks in this format:
[
  {{
    "task_id": "subtask-1",
    "hero_id": "engineering-hero",
    "description": "Implement the backend API",
    "priority": 8
  }},
  ...
]
"""
        
        try:
            response = await self.llm_client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Parse response
            import json
            text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
            subtasks_data = json.loads(text)
            
            # Convert to ParallelTask objects
            subtasks = []
            for i, data in enumerate(subtasks_data):
                subtasks.append(ParallelTask(
                    task_id=data.get("task_id", f"subtask-{i}"),
                    hero_id=data.get("hero_id", available_heroes[0]),
                    description=data.get("description", ""),
                    priority=data.get("priority", 5),
                ))
            
            return subtasks
            
        except Exception as e:
            logger.error(f"Failed to decompose task with LLM: {e}")
            return self._simple_decompose(task_description, available_heroes, max_subtasks)
    
    def _simple_decompose(
        self,
        task_description: str,
        available_heroes: List[str],
        max_subtasks: int,
    ) -> List[ParallelTask]:
        """Simple keyword-based task decomposition."""
        subtasks = []
        
        # Simple heuristics based on keywords
        keywords_to_heroes = {
            "frontend": "frontend-hero",
            "backend": "backend-hero",
            "database": "db-hero",
            "api": "backend-hero",
            "ui": "frontend-hero",
            "test": "qa-hero",
            "deploy": "devops-hero",
            "security": "security-hero",
        }
        
        for keyword, hero_id in keywords_to_heroes.items():
            if keyword in task_description.lower() and hero_id in available_heroes:
                subtasks.append(ParallelTask(
                    task_id=f"{keyword}-task",
                    hero_id=hero_id,
                    description=f"Handle {keyword} aspects of: {task_description}",
                    priority=5,
                ))
        
        # If no subtasks created, create a single general task
        if not subtasks:
            subtasks.append(ParallelTask(
                task_id="general-task",
                hero_id=available_heroes[0] if available_heroes else "engineering-hero",
                description=task_description,
                priority=5,
            ))
        
        return subtasks[:max_subtasks]


class ResultMerger:
    """Merge results from parallel sub-tasks."""
    
    def __init__(self, llm_client=None):
        self.llm_client = llm_client
    
    async def merge(
        self,
        original_task: str,
        results: List[ParallelResult],
    ) -> Dict[str, Any]:
        """
        Merge results from parallel sub-tasks into coherent output.
        
        Args:
            original_task: Original high-level task description
            results: Results from parallel execution
        
        Returns:
            Merged result dictionary
        """
        # Separate successful and failed results
        successful = [r for r in results if r.status == "success"]
        failed = [r for r in results if r.status != "success"]
        
        if not self.llm_client:
            # Simple merge: concatenate outputs
            return self._simple_merge(original_task, successful, failed)
        
        # Use LLM for intelligent merging
        prompt = f"""You are a result synthesis expert.

Original Task: {original_task}

Sub-task Results:
"""
        
        for i, result in enumerate(successful):
            prompt += f"\n{i+1}. {result.hero_id} ({result.task_id}):\n{result.output}\n"
        
        if failed:
            prompt += "\nFailed Sub-tasks:\n"
            for result in failed:
                prompt += f"- {result.hero_id} ({result.task_id}): {result.error}\n"
        
        prompt += """
Synthesize these results into a coherent, comprehensive answer to the original task.
Address any failures and explain how they impact the overall result.

Return a structured JSON object with:
- summary: Brief overview
- details: Detailed synthesis
- warnings: Any concerns or limitations
- next_steps: Recommended follow-up actions
"""
        
        try:
            response = await self.llm_client.messages.create(
                model="claude-3-5-haiku-latest",
                max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            import json
            text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text")
            merged = json.loads(text)
            
            return {
                **merged,
                "successful_subtasks": len(successful),
                "failed_subtasks": len(failed),
                "total_execution_time_ms": sum(r.execution_time_ms for r in results),
            }
            
        except Exception as e:
            logger.error(f"Failed to merge results with LLM: {e}")
            return self._simple_merge(original_task, successful, failed)
    
    def _simple_merge(
        self,
        original_task: str,
        successful: List[ParallelResult],
        failed: List[ParallelResult],
    ) -> Dict[str, Any]:
        """Simple merge by concatenating outputs."""
        outputs = []
        for result in successful:
            outputs.append(f"## {result.hero_id} ({result.task_id})\n{result.output}")
        
        warnings = []
        for result in failed:
            warnings.append(f"{result.hero_id} ({result.task_id}): {result.error}")
        
        return {
            "summary": f"Completed {len(successful)} sub-tasks for: {original_task}",
            "details": "\n\n".join(outputs),
            "warnings": warnings if warnings else None,
            "successful_subtasks": len(successful),
            "failed_subtasks": len(failed),
            "total_execution_time_ms": sum(r.execution_time_ms for r in results),
        }


# Convenience function
async def execute_parallel_tasks(
    tasks: List[Dict[str, Any]],
    repo_path: str = ".",
    max_parallel: int = 3,
    executor_callback=None,
) -> List[ParallelResult]:
    """
    Execute tasks in parallel with git worktree isolation.
    
    Simple wrapper for ParallelExecutor.
    
    Args:
        tasks: List of task dictionaries with keys: task_id, hero_id, description
        repo_path: Path to git repository
        max_parallel: Maximum concurrent tasks
        executor_callback: Optional async callback for task execution
    
    Returns:
        List of ParallelResult objects
    """
    # Convert dicts to ParallelTask objects
    parallel_tasks = [
        ParallelTask(
            task_id=task.get("task_id", f"task-{i}"),
            hero_id=task.get("hero_id", "engineering-hero"),
            description=task.get("description", ""),
            input_data=task.get("input_data", {}),
            priority=task.get("priority", 0),
        )
        for i, task in enumerate(tasks)
    ]
    
    executor = ParallelExecutor(repo_path, max_parallel)
    
    try:
        results = await executor.execute_parallel(parallel_tasks, executor_callback)
        return results
    finally:
        executor.cleanup()
