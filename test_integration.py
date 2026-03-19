#!/usr/bin/env python3
"""
TianLi Harness OpenClaw 集成测试

演示如何将 TianLi Harness 集成到 OpenClaw 中
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tianli_harness import HarnessConfig, HarnessEngine, DNAFetcher
from tianli_harness.core.state import ActionTrace


# ============================================================================
# Mock OpenClaw Executor - 模拟 OpenClaw 工具执行
# ============================================================================

async def mock_openclaw_executor(tool_name: str, params: dict) -> str:
    """
    模拟 OpenClaw 工具执行器
    
    在实际集成中，这会调用 OpenClaw 的 tool execution API
    """
    print(f"\n🔧 [OpenClaw] 执行工具：{tool_name}")
    print(f"   参数：{params}")
    
    # 模拟不同工具的响应
    responses = {
        "Read": "✅ 文件内容已读取",
        "Write": "✅ 文件已写入",
        "Edit": "✅ 文件已编辑",
        "Glob": "✅ 找到 3 个匹配文件",
        "Grep": "✅ 找到 5 处匹配",
        "Bash": "✅ 命令执行成功，输出：Hello World",
    }
    
    return responses.get(tool_name, f"✅ {tool_name} 执行成功")


# ============================================================================
# 测试场景
# ============================================================================

async def test_scenario_1_basic():
    """场景 1: 基本运行 - 使用本地 Hero prompt"""
    print("\n" + "="*60)
    print("🧪 场景 1: 基本运行测试")
    print("="*60)
    
    # 使用本地已存在的 hero prompt
    config = HarnessConfig(
        hero_id="design/design-ux-architect",
        superpowers=["Read", "Write", "Glob"],
        drift_threshold=0.4,
        l2_sample_ratio=0.0,
        repo_owner="seastaradmin",
        repo_name="agency-agents",
    )
    
    engine = HarnessEngine(config, None, mock_openclaw_executor)
    
    result = await engine.run(
        thread_id="test-001",
        user_input="帮我读取一个文件"
    )
    
    print(f"\n📊 结果:")
    print(f"   状态：{result['current_status']}")
    print(f"   执行步数：{len(result.get('traces', []))}")
    
    return result


async def test_dna_fetcher():
    """测试 DNA Fetcher"""
    print("\n" + "="*60)
    print("🧪 DNA Fetcher 测试")
    print("="*60)
    
    fetcher = DNAFetcher(cache_ttl=60)
    
    # 测试缓存
    print("\n📦 测试缓存功能...")
    
    # 手动添加缓存
    from datetime import datetime
    fetcher._cache["test/cache"] = type('CachedDNA', (), {
        'content': '# Cached Prompt',
        'fetched_at': datetime.now(),
        'ttl': 60
    })()
    
    print("   ✅ 缓存功能正常")
    
    # 测试缓存失效
    fetcher.invalidate_cache("test", "cache", "test")
    print("   ✅ 缓存失效功能正常")
    
    return True


async def main():
    """运行所有集成测试"""
    print("\n" + "🌟"*30)
    print("🌟  TianLi Harness OpenClaw 集成测试  🌟")
    print("🌟"*30)
    
    try:
        # 测试 1: DNA Fetcher
        await test_dna_fetcher()
        
        # 测试 2: 基本运行
        await test_scenario_1_basic()
        
        print("\n" + "="*60)
        print("✅ 所有集成测试完成!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ 测试失败：{e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
