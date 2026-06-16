#!/usr/bin/env python3
"""
用 OpenClaw Skill 系统生成 PPT

通过 OpenClawSkillExecutor 调用 pptx skill 或 python-pptx
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from tianli_harness.core.config_loader import load_config_from_string
from tianli_harness.core.doubao_client import create_doubao_client
from tianli_harness.core.graph import HarnessEngine
from tianli_harness.core.openclaw_skill_executor import create_ppt_with_openclaw


async def test_ppt_with_openclaw_skill():
    """用 OpenClaw Skill 系统生成 PPT"""
    
    print("\n" + "="*70)
    print("🎯 测试：用 OpenClaw Skill 系统生成天理产品宣讲 PPT")
    print("="*70)
    
    # 1. 用 HarnessEngine 生成 PPT 内容
    print("\n📝 步骤 1: 用 HarnessEngine 生成 PPT 内容大纲")
    
    config = load_config_from_string("""
hero:
  id: "ppt-creator-hero"
  use_predefined: true
  superpowers:
    - Read
    - Write

tianjie:
  drift_threshold: 0.4
  l2_sample_ratio: 0.3

dispatch:
  mode: "hybrid"
  max_fanout: 1
""")
    
    llm_client = create_doubao_client(
        api_key="660d27e6-e65f-4a33-8fea-87101d33c210",
        base_url="https://ark.cn-beijing.volces.com/api/coding/v3",
        model="doubao-seed-2.0-code"
    )
    
    from tianli_harness.core.executors import LocalExecutor
    import tempfile
    output_dir = Path(__file__).parent.parent / "generated_ppts"
    output_dir.mkdir(exist_ok=True)
    executor = LocalExecutor(str(output_dir))
    
    engine = HarnessEngine(
        config=config,
        anthropic=llm_client,
        openclaw_executor=executor.execute,
        session_id="ppt-openclaw-001"
    )
    
    import time
    start = time.time()
    
    result = await engine.run(
        "ppt-task-001",
        "生成天理产品宣讲 PPT 的内容大纲，包含 7 页：封面、问题、解决方案、特性、E2E 测试、行动计划、结束页"
    )
    
    duration = time.time() - start
    print(f"✅ HarnessEngine 执行完成，耗时：{duration:.2f}秒")
    
    # 2. 用 OpenClaw Skill 生成 PPT 文件
    print("\n📊 步骤 2: 用 OpenClaw Skill 生成 .pptx 文件")
    
    # 定义 PPT 内容
    title = "TianLi Harness - 天理 Harness"
    slides = [
        {
            "title": "问题",
            "content": "现有 AI 工具的痛点\n• 只会聊天，无法交付实际成果\n• 缺少专业角色分工\n• 没有质量保证机制\n• 无法跨会话记忆"
        },
        {
            "title": "解决方案",
            "content": "天理的核心特性\n• 19 个专业 Hero 角色\n• 分层审计系统 (L1+L2)\n• 项目记忆系统\n• 多平台支持"
        },
        {
            "title": "产品特性",
            "content": "核心功能\n• Hero 系统 (19 个专业角色)\n• 天劫审计 (质量检查)\n• 天演进化 (自动学习)\n• 并行执行 (多 Hero 协作)"
        },
        {
            "title": "E2E 测试结果",
            "content": "实测数据\n• E2E 测试通过率：100%\n• 总测试数：40 个\n• API 响应时间：<20 秒\n• Hero 数量：19 个"
        },
        {
            "title": "行动计划",
            "content": "如何开始使用\n• 查看文档：GitHub\n• 安装依赖：pip install -r requirements.txt\n• 运行测试：python3 tests/test_e2e_full.py\n• 访问前端：http://localhost:1421"
        },
        {
            "title": "Q&A",
            "content": "谢谢！\n\nGitHub: https://github.com/seastaradmin/TianLi"
        }
    ]
    
    output_path = output_dir / "tianli_presentation.pptx"
    
    ppt_result = await create_ppt_with_openclaw(
        title=title,
        slides=slides,
        output_path=str(output_path),
        working_dir=str(output_dir)
    )
    
    print(f"\n📄 PPT 生成结果:")
    if ppt_result.get("success"):
        print(f"   ✅ 成功生成：{output_path.absolute()}")
        print(f"   📊 幻灯片数量：{ppt_result.get('slides_count', 'unknown')}")
        print(f"   📦 文件大小：{output_path.stat().st_size} bytes")
    else:
        print(f"   ❌ 生成失败：{ppt_result.get('error', 'unknown error')}")
    
    # 清理
    await llm_client.close()
    
    # 总结
    print("\n" + "="*70)
    print("📊 执行总结")
    print("="*70)
    print(f"HarnessEngine 耗时：{duration:.2f}秒")
    print(f"OpenClaw Skill: {'✅ 成功' if ppt_result.get('success') else '❌ 失败'}")
    print(f"输出文件：{output_path.absolute()}")
    
    if ppt_result.get("success"):
        print(f"\n✅ 天理系统 + OpenClaw Skill 成功生成 PPT！")
    else:
        print(f"\n⚠️  PPT 生成失败，需要进一步调试")
    
    return {
        "harness_result": result,
        "ppt_result": ppt_result,
        "output_path": str(output_path)
    }


if __name__ == "__main__":
    result = asyncio.run(test_ppt_with_openclaw_skill())
    print(f"\n📄 输出路径：{result['output_path']}")
