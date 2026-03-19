#!/usr/bin/env python3
"""
TianLi Harness 真实 OpenClaw 集成

使用 OpenClawSkillManager 管理 OpenClaw 工具调用
"""

import asyncio
import sys
import os
import json

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tianli_harness import HarnessConfig, HarnessEngine, DNAFetcher
from tianli_harness.skills.claw_proxy import OpenClawSkillManager


# ============================================================================
# 真实 OpenClaw 执行器
# ============================================================================

class RealOpenClawExecutor:
    """
    真实的 OpenClaw 工具执行器
    
    通过 OpenClaw CLI 或 API 调用工具
    """
    
    def __init__(self, workspace: str = None):
        """
        初始化 OpenClaw 执行器
        
        Args:
            workspace: OpenClaw 工作区路径，默认使用用户工作区
        """
        self.workspace = workspace or os.path.expanduser("~/.jvs/.openclaw/workspace")
        self.call_history = []
    
    async def execute(self, tool_name: str, params: dict) -> str:
        """
        执行 OpenClaw 工具
        
        Args:
            tool_name: 工具名称 (Read, Write, Bash, Glob, Grep, Edit 等)
            params: 工具参数
            
        Returns:
            执行结果
        """
        # 记录调用历史
        self.call_history.append({
            "tool": tool_name,
            "params": params,
            "timestamp": asyncio.get_event_loop().time()
        })
        
        print(f"\n🔧 [OpenClaw] 执行工具：{tool_name}")
        print(f"   参数：{json.dumps(params, ensure_ascii=False, indent=2)}")
        
        try:
            # 根据工具名称调用不同的实现
            if tool_name == "Read":
                result = await self._read(params)
            elif tool_name == "Write":
                result = await self._write(params)
            elif tool_name == "Bash":
                result = await self._bash(params)
            elif tool_name == "Glob":
                result = await self._glob(params)
            elif tool_name == "Grep":
                result = await self._grep(params)
            elif tool_name == "Edit":
                result = await self._edit(params)
            else:
                result = f"⚠️ 未知工具：{tool_name}"
            
            print(f"   ✅ 成功")
            return result
            
        except Exception as e:
            print(f"   ❌ 失败：{e}")
            return f"Error: {str(e)}"
    
    async def _read(self, params: dict) -> str:
        """Read 工具 - 读取文件内容"""
        file_path = params.get("file_path") or params.get("path")
        if not file_path:
            raise ValueError("缺少 file_path 参数")
        
        # 如果是相对路径，转到 workspace
        if not os.path.isabs(file_path):
            file_path = os.path.join(self.workspace, file_path)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return f"📄 文件内容 ({len(content)} 字符):\n{content[:500]}..."
    
    async def _write(self, params: dict) -> str:
        """Write 工具 - 写入文件"""
        file_path = params.get("file_path") or params.get("path")
        content = params.get("content", "")
        
        if not file_path:
            raise ValueError("缺少 file_path 参数")
        
        # 如果是相对路径，转到 workspace
        if not os.path.isabs(file_path):
            file_path = os.path.join(self.workspace, file_path)
        
        # 创建目录
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return f"✅ 文件已写入：{file_path} ({len(content)} 字符)"
    
    async def _bash(self, params: dict) -> str:
        """Bash 工具 - 执行 shell 命令"""
        command = params.get("command", "")
        if not command:
            raise ValueError("缺少 command 参数")
        
        # 安全限制：禁止危险命令
        dangerous = ["rm -rf /", "sudo", "mkfs", "dd if="]
        for d in dangerous:
            if d in command:
                return f"🚫 禁止执行危险命令：{command}"
        
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=self.workspace
        )
        
        stdout, stderr = await proc.communicate()
        
        output = stdout.decode('utf-8', errors='replace')
        error = stderr.decode('utf-8', errors='replace')
        
        result = f"命令：{command}\n"
        if output:
            result += f"输出:\n{output}"
        if error:
            result += f"错误:\n{error}"
        result += f"退出码：{proc.returncode}"
        
        return result
    
    async def _glob(self, params: dict) -> str:
        """Glob 工具 - 查找匹配的文件"""
        import glob as glob_module
        
        pattern = params.get("pattern", "*")
        path = params.get("path", self.workspace)
        
        if not os.path.isabs(path):
            path = os.path.join(self.workspace, path)
        
        matches = glob_module.glob(os.path.join(path, pattern), recursive=True)
        
        return f"找到 {len(matches)} 个匹配文件:\n" + "\n".join(matches[:20])
    
    async def _grep(self, params: dict) -> str:
        """Grep 工具 - 搜索文件内容"""
        pattern = params.get("pattern", "")
        path = params.get("path", self.workspace)
        
        if not pattern:
            raise ValueError("缺少 pattern 参数")
        
        import subprocess
        
        proc = await asyncio.create_subprocess_exec(
            "grep", "-r", "--include=*.py", "--include=*.md", "--include=*.txt",
            pattern, path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        output = stdout.decode('utf-8', errors='replace')
        lines = output.strip().split('\n')[:20]
        
        return f"找到 {len(lines)} 处匹配:\n" + "\n".join(lines)
    
    async def _edit(self, params: dict) -> str:
        """Edit 工具 - 编辑文件（简单实现：读取 - 替换 - 写入）"""
        file_path = params.get("file_path")
        old_text = params.get("old_text", "")
        new_text = params.get("new_text", "")
        
        if not file_path:
            raise ValueError("缺少 file_path 参数")
        
        if not os.path.isabs(file_path):
            file_path = os.path.join(self.workspace, file_path)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if old_text:
            content = content.replace(old_text, new_text)
        else:
            content = new_text
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return f"✅ 文件已编辑：{file_path}"
    
    def get_call_history(self) -> list:
        """获取调用历史"""
        return self.call_history
    
    def clear_history(self):
        """清空调用历史"""
        self.call_history.clear()


# ============================================================================
# 演示：使用 OpenClawSkillManager 管理 OpenClaw
# ============================================================================

async def demo_with_real_executor():
    """演示使用真实 OpenClaw 执行器"""
    print("\n" + "="*70)
    print("🚀 TianLi Harness + 真实 OpenClaw 集成演示")
    print("="*70)
    
    # 1. 创建真实 OpenClaw 执行器
    executor = RealOpenClawExecutor()
    
    # 2. 创建 OpenClawSkillManager（代理层）
    skill_manager = OpenClawSkillManager(executor.execute)
    
    # 3. 测试直接调用
    print("\n📋 测试 1: 直接通过 SkillManager 调用工具")
    print("-" * 50)
    
    result = await skill_manager.execute_tool("Bash", {
        "command": "echo 'Hello from OpenClaw!'"
    })
    print(f"结果：{result}")
    
    # 测试 2: 读取文件
    print("\n📋 测试 2: 读取 AGENTS.md 文件")
    print("-" * 50)
    
    result = await skill_manager.execute_tool("Read", {
        "file_path": "/Users/ping/.jvs/.openclaw/workspace/AGENTS.md"
    })
    print(f"结果：{result[:200]}...")
    
    # 测试 3: Glob 查找文件
    print("\n📋 测试 3: 查找 Python 文件")
    print("-" * 50)
    
    result = await skill_manager.execute_tool("Glob", {
        "pattern": "*.py",
        "path": "/Users/ping/Desktop/学生计划 tokens 方案/天理/tianli_harness"
    })
    print(f"结果：{result}")
    
    # 4. 显示调用历史
    print("\n📊 调用历史统计")
    print("-" * 50)
    history = executor.get_call_history()
    print(f"总调用次数：{len(history)}")
    for i, call in enumerate(history, 1):
        print(f"  {i}. {call['tool']} - {call['params']}")
    
    return executor


async def demo_harness_with_openclaw():
    """演示完整 Harness 引擎使用 OpenClaw"""
    print("\n" + "="*70)
    print("🎯 TianLi Harness 引擎 + OpenClaw 完整演示")
    print("="*70)
    
    # 创建执行器
    executor = RealOpenClawExecutor()
    
    # 配置 Harness
    config = HarnessConfig(
        hero_id="design/design-ux-architect",
        superpowers=["Read", "Write", "Glob", "Bash"],
        drift_threshold=0.4,
        l2_sample_ratio=0.0,  # 测试时关闭 L2
        repo_owner="seastaradmin",
        repo_name="agency-agents",
    )
    
    print(f"\n⚙️  配置:")
    print(f"   Hero: {config.hero_id}")
    print(f"   工具：{config.superpowers}")
    print(f"   L2 采样率：{config.l2_sample_ratio * 100}%")
    
    # 创建引擎
    engine = HarnessEngine(config, None, executor.execute)
    
    # 运行
    print(f"\n▶️  运行 Harness...")
    result = await engine.run(
        thread_id="demo-001",
        user_input="帮我查看当前目录有哪些 Python 文件"
    )
    
    print(f"\n📊 结果:")
    print(f"   状态：{result['current_status']}")
    print(f"   执行步数：{len(result.get('traces', []))}")
    
    if result.get('traces'):
        print(f"\n📝 执行轨迹:")
        for trace in result['traces'][:5]:
            print(f"   - Step {trace.step}: {trace.tool_name} → {trace.observation[:50]}...")
    
    return result


async def main():
    """主函数"""
    print("\n" + "🌟"*35)
    print("🌟  TianLi Harness 真实 OpenClaw 集成  🌟")
    print("🌟"*35)
    
    try:
        # 演示 1: 直接使用 OpenClawSkillManager
        executor = await demo_with_real_executor()
        
        # 演示 2: 完整 Harness 引擎
        await demo_harness_with_openclaw()
        
        print("\n" + "="*70)
        print("✅ 演示完成!")
        print("="*70)
        print("\n💡 关键点:")
        print("   • OpenClawSkillManager 作为代理层管理工具调用")
        print("   • 可以记录调用历史、添加权限检查、日志等")
        print("   • 解耦了 TianLi Harness 和 OpenClaw 的具体实现")
        print()
        
    except Exception as e:
        print(f"\n❌ 演示失败：{e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
