"""Multi-platform tool executor abstraction for TianLi Harness."""

from __future__ import annotations

import asyncio
import json
import logging
import subprocess
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)


class ToolExecutor(Protocol):
    """Protocol for tool executors."""

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call and return result."""
        ...

    async def health_check(self) -> bool:
        """Check if executor is healthy and ready."""
        ...


class BaseExecutor(ABC):
    """Base class for tool executors."""

    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir)
        self._healthy = True

    @abstractmethod
    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call."""
        pass

    async def health_check(self) -> bool:
        """Check executor health."""
        return self._healthy

    async def _run_command(
        self,
        command: str,
        timeout: int = 120,
        cwd: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """Run a shell command and return result."""
        start_time = time.time()
        
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd or self.working_dir,
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            return {
                "success": process.returncode == 0,
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "returncode": process.returncode,
                "latency_ms": latency_ms,
            }
        except asyncio.TimeoutError:
            return {
                "success": False,
                "error": f"Command timed out after {timeout}s",
                "latency_ms": timeout * 1000,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "latency_ms": int((time.time() - start_time) * 1000),
            }

    def _read_file(self, file_path: str) -> Dict[str, Any]:
        """Read a file and return content."""
        try:
            path = self.working_dir / file_path
            if not path.exists():
                return {"success": False, "error": f"File not found: {file_path}"}
            
            content = path.read_text(encoding="utf-8")
            return {
                "success": True,
                "content": content,
                "size_bytes": len(content),
                "lines": len(content.splitlines()),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _write_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Write content to a file."""
        try:
            path = self.working_dir / file_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            return {"success": True, "bytes_written": len(content)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _edit_file(
        self,
        file_path: str,
        old_text: str,
        new_text: str,
    ) -> Dict[str, Any]:
        """Edit a file by replacing text."""
        try:
            path = self.working_dir / file_path
            if not path.exists():
                return {"success": False, "error": f"File not found: {file_path}"}
            
            content = path.read_text(encoding="utf-8")
            if old_text not in content:
                return {
                    "success": False,
                    "error": "Old text not found in file",
                }
            
            new_content = content.replace(old_text, new_text, 1)
            path.write_text(new_content, encoding="utf-8")
            return {"success": True, "replacements": 1}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _glob_files(self, pattern: str) -> Dict[str, Any]:
        """Find files matching a pattern."""
        try:
            matches = [
                str(p.relative_to(self.working_dir))
                for p in self.working_dir.glob(pattern)
                if p.is_file()
            ]
            return {
                "success": True,
                "matches": matches,
                "count": len(matches),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _grep_files(
        self,
        pattern: str,
        path: str = ".",
        include: str = "*",
    ) -> Dict[str, Any]:
        """Search for pattern in files."""
        try:
            import subprocess
            result = subprocess.run(
                ["grep", "-r", "--include=" + include, pattern, path],
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=30,
            )
            
            lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
            return {
                "success": True,
                "matches": lines,
                "count": len(lines),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class OpenClawExecutor(BaseExecutor):
    """Tool executor for OpenClaw integration."""

    def __init__(self, openclaw_callback, working_dir: str = "."):
        super().__init__(working_dir)
        self.openclaw_callback = openclaw_callback

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool via OpenClaw callback."""
        try:
            result = await self.openclaw_callback(tool_name, params)
            return {
                "success": True,
                "result": result,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class LocalExecutor(BaseExecutor):
    """Local tool executor (no external dependencies)."""

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool locally."""
        start_time = time.time()
        
        try:
            if tool_name == "Read":
                result = self._read_file(params.get("file_path", ""))
            elif tool_name == "Write":
                result = self._write_file(
                    params.get("file_path", ""),
                    params.get("content", ""),
                )
            elif tool_name == "Edit":
                result = self._edit_file(
                    params.get("file_path", ""),
                    params.get("old_text", ""),
                    params.get("new_text", ""),
                )
            elif tool_name == "Glob":
                result = self._glob_files(params.get("pattern", "**/*"))
            elif tool_name == "Grep":
                result = self._grep_files(
                    params.get("pattern", ""),
                    params.get("path", "."),
                    params.get("include", "*"),
                )
            elif tool_name == "Bash":
                result = await self._run_command(
                    params.get("command", ""),
                    timeout=params.get("timeout", 120),
                )
            else:
                return {
                    "success": False,
                    "error": f"Unknown tool: {tool_name}",
                }
            
            # Add latency
            result["latency_ms"] = int((time.time() - start_time) * 1000)
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "latency_ms": int((time.time() - start_time) * 1000),
            }


class CursorExecutor(BaseExecutor):
    """Tool executor for Cursor IDE integration via MCP."""

    def __init__(self, cursor_socket_url: str = "ws://localhost:8080", working_dir: str = "."):
        super().__init__(working_dir)
        self.cursor_socket_url = cursor_socket_url
        self._socket = None

    async def connect(self):
        """Connect to Cursor MCP server."""
        try:
            import websockets
            self._socket = await websockets.connect(self.cursor_socket_url)
            self._healthy = True
        except Exception as e:
            logger.warning(f"Failed to connect to Cursor: {e}")
            self._healthy = False

    async def close(self):
        """Close connection."""
        if self._socket:
            await self._socket.close()
            self._socket = None

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool via Cursor MCP."""
        if not self._socket:
            await self.connect()
        
        if not self._socket:
            # Fallback to local execution
            local = LocalExecutor(self.working_dir)
            return await local.execute(tool_name, params)
        
        try:
            message = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": params,
                },
            }
            
            await self._socket.send(json.dumps(message))
            response = await asyncio.wait_for(self._socket.recv(), timeout=60)
            result = json.loads(response)
            
            return {
                "success": "error" not in result,
                "result": result.get("result"),
                "error": result.get("error", {}).get("message"),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


class ClaudeCodeExecutor(BaseExecutor):
    """Tool executor for Claude Code integration."""

    def __init__(self, claude_code_socket: str = "http://localhost:9090", working_dir: str = "."):
        super().__init__(working_dir)
        self.claude_code_socket = claude_code_socket

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool via Claude Code API."""
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.claude_code_socket}/v1/tools/execute",
                    json={
                        "tool": tool_name,
                        "params": params,
                        "working_dir": str(self.working_dir),
                    },
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": True,
                        "result": result,
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}: {response.text}",
                    }
        except Exception as e:
            # Fallback to local execution
            local = LocalExecutor(self.working_dir)
            return await local.execute(tool_name, params)


class OpenCodeExecutor(BaseExecutor):
    """Tool executor for OpenCode integration."""

    def __init__(self, opencode_socket: str = "http://localhost:8888", working_dir: str = "."):
        super().__init__(working_dir)
        self.opencode_socket = opencode_socket

    async def execute(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute tool via OpenCode API."""
        try:
            import httpx
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.opencode_socket}/api/tools/execute",
                    json={
                        "tool_name": tool_name,
                        "parameters": params,
                        "cwd": str(self.working_dir),
                    },
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {
                        "success": result.get("success", False),
                        "result": result.get("output"),
                        "error": result.get("error"),
                    }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status_code}: {response.text}",
                    }
        except Exception as e:
            # Fallback to local execution
            local = LocalExecutor(self.working_dir)
            return await local.execute(tool_name, params)


class ExecutorFactory:
    """Factory for creating tool executors."""

    @staticmethod
    def create(
        platform: str,
        working_dir: str = ".",
        **kwargs,
    ) -> ToolExecutor:
        """Create executor for specified platform."""
        platform = platform.lower()
        
        executors = {
            "openclaw": lambda: OpenClawExecutor(
                kwargs.get("callback"),
                working_dir,
            ),
            "local": lambda: LocalExecutor(working_dir),
            "cursor": lambda: CursorExecutor(
                kwargs.get("socket_url", "ws://localhost:8080"),
                working_dir,
            ),
            "claude-code": lambda: ClaudeCodeExecutor(
                kwargs.get("socket", "http://localhost:9090"),
                working_dir,
            ),
            "claudecode": lambda: ClaudeCodeExecutor(
                kwargs.get("socket", "http://localhost:9090"),
                working_dir,
            ),
            "opencode": lambda: OpenCodeExecutor(
                kwargs.get("socket", "http://localhost:8888"),
                working_dir,
            ),
        }
        
        if platform not in executors:
            logger.warning(
                f"Unknown platform '{platform}', falling back to local executor"
            )
            return LocalExecutor(working_dir)
        
        return executors[platform]()


class MultiPlatformOrchestrator:
    """Orchestrate tool execution across multiple platforms."""

    def __init__(self, default_platform: str = "local", working_dir: str = "."):
        self.default_platform = default_platform
        self.working_dir = working_dir
        self.executors: Dict[str, ToolExecutor] = {}
        self.platform_fallback_order = [
            "local",
            "openclaw",
            "cursor",
            "claude-code",
            "opencode",
        ]

    def register_executor(self, platform: str, executor: ToolExecutor):
        """Register an executor for a platform."""
        self.executors[platform] = executor

    def get_executor(self, platform: Optional[str] = None) -> ToolExecutor:
        """Get executor for platform, with fallback."""
        platform = platform or self.default_platform
        
        if platform in self.executors:
            return self.executors[platform]
        
        # Try fallback order
        for fallback in self.platform_fallback_order:
            if fallback in self.executors:
                logger.info(f"Platform '{platform}' not available, using '{fallback}'")
                return self.executors[fallback]
        
        # Create default local executor
        logger.warning("No executor available, creating local executor")
        return LocalExecutor(self.working_dir)

    async def execute(
        self,
        tool_name: str,
        params: Dict[str, Any],
        platform: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute tool on specified platform with automatic fallback."""
        executor = self.get_executor(platform)
        
        start_time = time.time()
        result = await executor.execute(tool_name, params)
        result["platform"] = executor.__class__.__name__
        result["total_latency_ms"] = int((time.time() - start_time) * 1000)
        
        return result

    async def health_check(self, platform: Optional[str] = None) -> Dict[str, bool]:
        """Check health of all or specified executor."""
        if platform:
            if platform in self.executors:
                return {platform: await self.executors[platform].health_check()}
            return {platform: False}
        
        results = {}
        for plat, executor in self.executors.items():
            results[plat] = await executor.health_check()
        return results


# Global orchestrator instance
_orchestrator: Optional[MultiPlatformOrchestrator] = None


def get_orchestrator(
    default_platform: str = "local",
    working_dir: str = ".",
) -> MultiPlatformOrchestrator:
    """Get or create global orchestrator."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiPlatformOrchestrator(default_platform, working_dir)
    return _orchestrator


def reset_orchestrator():
    """Reset global orchestrator (for testing)."""
    global _orchestrator
    _orchestrator = None
