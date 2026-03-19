#!/usr/bin/env python3
"""
TianLi Harness 天劫审查演示

展示分层宪法审查系统如何工作
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tianli_harness.core.interceptor import TianJieInterceptor, AuditResult
from tianli_harness.core.state import HarnessConfig, ActionTrace


def demo_l1_checks():
    """演示 L1 粗过滤检查"""
    print("\n" + "="*70)
    print("🔴 天劫 L1 粗过滤演示")
    print("="*70)
    
    config = HarnessConfig(
        hero_id="test",
        superpowers=["Read", "Write"],
        repetition_threshold=3,
        forbidden_words=["delete", "drop", "rm -rf"]
    )
    
    interceptor = TianJieInterceptor(None, config)
    
    # 场景 1: 正常请求 - 通过
    print("\n✅ 场景 1: 正常读取文件")
    traces = []
    result = interceptor.check_l1("Read", {"file_path": "test.py"}, traces)
    print(f"   结果：{'通过' if result.should_continue else '拒绝'}")
    print(f"   原因：{result.reason}")
    
    # 场景 2: 重复检测 - 触发
    print("\n⚠️  场景 2: 重复调用同一工具 (3 次)")
    traces = [
        ActionTrace(step=1, tool_name="Read", observation="{'file': 'a.py'}"),
        ActionTrace(step=2, tool_name="Read", observation="{'file': 'a.py'}"),
        ActionTrace(step=3, tool_name="Read", observation="{'file': 'a.py'}"),
    ]
    result = interceptor.check_l1("Read", {"file_path": "a.py"}, traces)
    print(f"   结果：{'通过' if result.should_continue else '🚫 拒绝 (天劫触发)'}")
    print(f"   原因：{result.reason}")
    
    # 场景 3: 禁止词检测 - 触发
    print("\n⚠️  场景 3: 包含禁止词 'delete'")
    traces = []
    result = interceptor.check_l1("Bash", {"command": "delete this file"}, traces)
    print(f"   结果：{'通过' if result.should_continue else '🚫 拒绝 (天劫触发)'}")
    print(f"   原因：{result.reason}")
    
    # 场景 4: 空参数检测 - 触发
    print("\n⚠️  场景 4: 空参数")
    traces = []
    result = interceptor.check_l1("Read", {}, traces)
    print(f"   结果：{'通过' if result.should_continue else '🚫 拒绝 (天劫触发)'}")
    print(f"   原因：{result.reason}")


def demo_l2_sampling():
    """演示 L2 采样深度检查"""
    print("\n" + "="*70)
    print("🟡 天劫 L2 采样深度检查演示")
    print("="*70)
    
    config = HarnessConfig(
        hero_id="test",
        superpowers=["Read"],
        l2_sample_ratio=0.3  # 30% 采样率
    )
    
    interceptor = TianJieInterceptor(None, config)
    
    print(f"\n配置采样率：{config.l2_sample_ratio * 100}%")
    print("模拟 10 次检查，统计 L2 触发次数...")
    
    l2_count = sum(1 for _ in range(10) if interceptor.should_do_l2_check())
    print(f"结果：{l2_count}/10 次触发了 L2 深度检查")


def demo_workflow():
    """演示完整天劫工作流"""
    print("\n" + "="*70)
    print("🔵 天劫完整工作流演示")
    print("="*70)
    
    print("""
    ┌─────────────────────────────────────────────────────────────┐
    │                    TianLi Harness 工作流                     │
    ├─────────────────────────────────────────────────────────────┤
    │                                                             │
    │  1️⃣  User Input (用户请求)                                   │
    │         ↓                                                   │
    │  2️⃣  Fetch DNA (获取 Hero Prompt)                           │
    │         ↓                                                   │
    │  3️⃣  Agent Reason (LLM 推理)                                 │
    │         ↓                                                   │
    │  4️⃣  ┌──────────────────────────────┐                      │
    │      │  天劫审查 (TianJie Audit)     │                      │
    │      │  ┌────────────────────────┐  │                      │
    │      │  │ L1: 粗过滤             │  │                      │
    │      │  │ - 重复检测 ✅           │  │                      │
    │      │  │ - 禁止词检测 ✅         │  │                      │
    │      │  │ - 空参数检测 ✅         │  │                      │
    │      │  └────────────────────────┘  │                      │
    │      │         ↓ 通过                │                      │
    │      │  ┌────────────────────────┐  │                      │
    │      │  │ L2: 深度语义检查 (采样) │  │                      │
    │      │  │ - 目标对齐评分          │  │                      │
    │      │  │ - drift threshold 比较  │  │                      │
    │      │  └────────────────────────┘  │                      │
    │      └──────────────────────────────┘                      │
    │         ↓ 通过              ↓ 拒绝                          │
    │  5️⃣  Execute Tool      天演优化 (TianYan)                  │
    │      (执行工具)           - 生成进化 Patch                  │
    │         ↓                 - 自动提交 GitHub                │
    │  6️⃣  Continue Loop                                        │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
    """)


def main():
    print("\n" + "🌟"*35)
    print("🌟  TianLi Harness 天劫审查系统演示  🌟")
    print("🌟"*35)
    
    demo_l1_checks()
    demo_l2_sampling()
    demo_workflow()
    
    print("\n" + "="*70)
    print("✅ 演示完成!")
    print("="*70)
    print("\n💡 关键特性:")
    print("   • L1 粗过滤：无 LLM 成本，毫秒级响应")
    print("   • L2 深度检查：可配置采样率，平衡成本与安全")
    print("   • 早期退出：触发天劫时立即停止，避免资源浪费")
    print("   • 天演优化：自动生成 System Prompt 改进建议")
    print()


if __name__ == "__main__":
    main()
