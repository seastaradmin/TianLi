#!/usr/bin/env python3
"""
真实测试：用天理 HarnessEngine 生成产品宣讲 PPT

完整调用天理系统，从任务输入到 PPT 输出
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from tianli_harness.core.config_loader import load_config_from_string
from tianli_harness.core.doubao_client import create_doubao_client
from tianli_harness.core.executors import LocalExecutor
from tianli_harness.core.graph import HarnessEngine


class PPTTaskTracker:
    """PPT 任务执行跟踪器"""
    
    def __init__(self):
        self.call_chain = []
        self.start_time = datetime.now()
    
    def log(self, stage, hero=None, action="", details=""):
        self.call_chain.append({
            "timestamp": datetime.now().isoformat(),
            "stage": stage,
            "hero": hero,
            "action": action,
            "details": details
        })
        print(f"\n{'='*70}")
        print(f"📍 {stage}")
        if hero:
            print(f"   🦸 Hero: {hero}")
        if action:
            print(f"   ⚙️  动作：{action}")
        if details:
            print(f"   📝 {details[:200]}")
    
    def generate_report(self):
        duration = (datetime.now() - self.start_time).total_seconds()
        return {
            "task": "生成天理产品宣讲 PPT",
            "start_time": self.start_time.isoformat(),
            "duration_seconds": duration,
            "call_chain": self.call_chain
        }


async def test_real_ppt_generation():
    """用 HarnessEngine 实际生成 PPT"""
    
    tracker = PPTTaskTracker()
    
    print("\n" + "="*70)
    print("🎯 真实测试：用天理 HarnessEngine 生成产品宣讲 PPT")
    print("="*70)
    
    tracker.log(
        stage="1. 任务输入",
        action="用户请求",
        details="生成天理产品宣讲 PPT"
    )
    
    # 加载配置
    tracker.log(
        stage="2. 配置加载",
        action="加载 YAML 配置",
        details="配置 ppt-creator-hero"
    )
    
    config = load_config_from_string("""
hero:
  id: "ppt-creator-hero"
  use_predefined: true
  superpowers:
    - Read
    - Write
    - Bash

tianjie:
  drift_threshold: 0.4
  l2_sample_ratio: 0.3

dispatch:
  mode: "hybrid"
  max_fanout: 1
""")
    
    tracker.log(
        stage="2.1 配置完成",
        hero="ppt-creator-hero",
        details=f"L2 采样率：{config.l2_sample_ratio}"
    )
    
    # 创建 Doubao 客户端
    tracker.log(
        stage="3. LLM 客户端初始化",
        action="创建 DoubaoClient",
        details="API: https://ark.cn-beijing.volces.com/api/coding/v3"
    )
    
    llm_client = create_doubao_client(
        api_key="660d27e6-e65f-4a33-8fea-87101d33c210",
        base_url="https://ark.cn-beijing.volces.com/api/coding/v3",
        model="doubao-seed-2.0-code"
    )
    
    tracker.log(
        stage="3.1 LLM 客户端就绪",
        details="Doubao-Seed-2.0-Code 模型"
    )
    
    # 创建执行器 - 保存到项目目录
    tracker.log(
        stage="4. 执行器初始化",
        action="创建 LocalExecutor",
        details="用于文件读写和 PPT 生成"
    )
    
    output_dir = Path(__file__).parent.parent / "generated_ppts"
    output_dir.mkdir(exist_ok=True)
    executor = LocalExecutor(str(output_dir))
    
    tracker.log(
        stage="4.1 执行器就绪",
        details=f"输出目录：{output_dir.absolute()}"
    )
    
    # 创建 HarnessEngine
    tracker.log(
        stage="5. 引擎初始化",
        action="创建 HarnessEngine",
        details="配置 LLM 客户端、执行器、审计系统"
    )
    
    engine = HarnessEngine(
        config=config,
        anthropic=llm_client,
        openclaw_executor=executor.execute,
        session_id="ppt-gen-tianli-001"
    )
    
    tracker.log(
        stage="5.1 引擎就绪",
        details="HarnessEngine 创建成功"
    )
    
    # 执行任务
    tracker.log(
        stage="6. 任务执行",
        action="调用 engine.run()",
        details="任务：生成天理产品宣讲 PPT"
    )
    
    import time
    start = time.time()
    
    try:
        result = await engine.run(
            "ppt-task-tianli-001",
            "生成天理产品宣讲 PPT，包含：封面、问题、解决方案、特性、E2E 测试、行动计划、结束页"
        )
        
        duration = time.time() - start
        
        tracker.log(
            stage="6.1 执行完成",
            details=f"耗时：{duration:.2f}秒，状态：{result.get('current_status', 'unknown')}"
        )
        
        # 列出文件
        ppt_files = list(output_dir.glob("*.pptx"))
        if ppt_files:
            tracker.log(
                stage="7. PPT 文件生成",
                action="找到生成的文件",
                details=""
            )
            print(f"\n📄 生成的 PPT 文件:")
            for ppt_file in ppt_files:
                print(f"   ✅ {ppt_file.absolute()} ({ppt_file.stat().st_size} bytes)")
        else:
            tracker.log(
                stage="7. 检查输出",
                action="查找 .pptx 文件",
                details=f"目录内容：{list(output_dir.iterdir())}"
            )
            print(f"\n⚠️  未找到 .pptx 文件")
            print(f"   目录内容：{list(output_dir.iterdir())}")
        
        # 打印总结
        print("\n" + "="*70)
        print("📊 执行总结")
        print("="*70)
        print(f"总耗时：{duration:.2f}秒")
        print(f"参与 Hero: ppt-creator-hero")
        print(f"LLM: Doubao-Seed-2.0-Code")
        print(f"输出目录：{output_dir.absolute()}")
        print(f"状态：{result.get('current_status')}")
        
        if ppt_files:
            print(f"\n✅ 天理系统成功生成 PPT！")
        else:
            print(f"\n⚠️  任务完成但未找到 .pptx 文件")
            print(f"   可能 pptx skill 未正确调用，需要进一步调试")
        
    except Exception as e:
        duration = time.time() - start
        print(f"\n❌ 执行失败：{e}")
        import traceback
        traceback.print_exc()
        
        tracker.log(
            stage="执行失败",
            details=str(e)
        )
    
    # 生成报告
    report = tracker.generate_report()
    
    import json
    report_file = Path("docs/REAL_PPT_EXECUTION_REPORT.json")
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n📄 执行报告：{report_file.absolute()}")
    
    # 清理
    await llm_client.close()
    
    return report


if __name__ == "__main__":
    asyncio.run(test_real_ppt_generation())
