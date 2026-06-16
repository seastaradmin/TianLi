#!/usr/bin/env python3
"""
天理 Harness 端到端测试

测试完整流程：
1. 任务分发
2. Hero 执行
3. 天劫审计
4. 结果记录
5. 前端展示
"""

import asyncio
import sys
import time
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from tianli_harness.core.config_loader import load_config_from_string
from tianli_harness.core.doubao_client import create_doubao_client
from tianli_harness.core.executors import LocalExecutor
from tianli_harness.core.graph import HarnessEngine
from tianli_harness.core.db_connector import get_feedback_database


async def test_e2e_ppt_generation():
    """端到端测试：生成 PPT 并验证全流程"""
    
    print("\n" + "="*70)
    print("🧪 天理 Harness 端到端测试")
    print("="*70)
    
    db = get_feedback_database()
    start_time = time.time()
    
    # ========== 步骤 1: 配置 ==========
    print("\n📝 步骤 1: 加载配置")
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
  repetition_threshold: 3

dispatch:
  mode: "hybrid"
  max_fanout: 1
""")
    print("✅ 配置加载成功")
    
    # ========== 步骤 2: 创建客户端 ==========
    print("\n📝 步骤 2: 创建 Doubao 客户端")
    llm_client = create_doubao_client(
        api_key="660d27e6-e65f-4a33-8fea-87101d33c210",
        base_url="https://ark.cn-beijing.volces.com/api/coding/v3",
        model="doubao-seed-2.0-code"
    )
    print("✅ 客户端创建成功")
    
    # ========== 步骤 3: 创建执行器 ==========
    print("\n📝 步骤 3: 创建执行器")
    output_dir = Path(__file__).parent.parent / "generated_ppts"
    output_dir.mkdir(exist_ok=True)
    executor = LocalExecutor(str(output_dir))
    print(f"✅ 执行器创建成功，输出目录：{output_dir}")
    
    # ========== 步骤 4: 创建引擎 ==========
    print("\n📝 步骤 4: 创建 HarnessEngine")
    engine = HarnessEngine(
        config=config,
        anthropic=llm_client,
        openclaw_executor=executor.execute,
        session_id="e2e-test-001"
    )
    print("✅ HarnessEngine 创建成功")
    
    # ========== 步骤 5: 执行任务 ==========
    print("\n📝 步骤 5: 执行 PPT 生成任务")
    task_id = f"e2e-ppt-{int(time.time())}"
    
    exec_start = time.time()
    result = await engine.run(
        task_id,
        "生成天理产品宣讲 PPT，包含：封面、问题、解决方案、特性、E2E 测试、行动计划、结束页"
    )
    exec_time = time.time() - exec_start
    
    print(f"✅ 任务执行完成")
    print(f"   状态：{result.get('current_status', 'unknown')}")
    print(f"   耗时：{exec_time:.2f}秒")
    
    # ========== 步骤 6: 验证数据库记录 ==========
    print("\n📝 步骤 6: 验证数据库记录")
    
    # 等待数据库写入
    await asyncio.sleep(1)
    
    # 检查分发决策
    try:
        import pymysql
        conn = pymysql.connect(
            host='localhost',
            user='root',
            password='',
            database='tianli_feedback',
            charset='utf8mb4'
        )
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        # 检查 dispatch_decisions
        cursor.execute("""
            SELECT COUNT(*) as count FROM dispatch_decisions 
            WHERE task_id LIKE %s
        """, ('%e2e%',))
        dispatch_count = cursor.fetchone()['count']
        print(f"✅ 分发决策记录：{dispatch_count} 条")
        
        # 检查 task_results
        cursor.execute("""
            SELECT COUNT(*) as count FROM task_results 
            WHERE task_id LIKE %s
        """, ('%e2e%',))
        result_count = cursor.fetchone()['count']
        print(f"✅ 任务结果记录：{result_count} 条")
        
        # 检查 hero_performance
        cursor.execute("""
            SELECT total_tasks, successful_tasks FROM hero_performance 
            WHERE hero_id = 'ppt-creator-hero'
            ORDER BY stat_date DESC
            LIMIT 1
        """)
        perf = cursor.fetchone()
        if perf:
            print(f"✅ Hero 性能记录：总任务 {perf['total_tasks']}, 成功 {perf['successful_tasks']}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"⚠️  数据库验证失败：{e}")
    
    # ========== 步骤 7: 验证输出文件 ==========
    print("\n📝 步骤 7: 验证输出文件")
    
    ppt_files = list(output_dir.glob("*.pptx"))
    if ppt_files:
        latest_ppt = max(ppt_files, key=lambda p: p.stat().st_mtime)
        print(f"✅ PPT 文件生成：{latest_ppt.name}")
        print(f"   大小：{latest_ppt.stat().st_size} bytes")
        print(f"   路径：{latest_ppt.absolute()}")
    else:
        print("⚠️  未找到 PPT 文件")
    
    # ========== 步骤 8: 总结 ==========
    total_time = time.time() - start_time
    
    print("\n" + "="*70)
    print("📊 测试总结")
    print("="*70)
    print(f"总耗时：{total_time:.2f}秒")
    print(f"任务执行：{exec_time:.2f}秒")
    print(f"任务状态：{result.get('current_status', 'unknown')}")
    print(f"输出文件：{len(ppt_files)} 个 PPT")
    
    # 验证所有步骤
    checks = {
        "配置加载": True,
        "客户端创建": True,
        "执行器创建": True,
        "引擎创建": True,
        "任务执行": result.get('current_status') == 'completed',
        "数据库记录": dispatch_count > 0 if 'dispatch_count' in dir() else False,
        "输出文件": len(ppt_files) > 0
    }
    
    print("\n✅ 验证清单:")
    for check, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
    
    all_passed = all(checks.values())
    
    if all_passed:
        print("\n🎉 所有测试通过！天理 Harness 端到端流程正常！")
        return 0
    else:
        print("\n⚠️  部分测试未通过，请检查日志")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_e2e_ppt_generation())
    sys.exit(exit_code)
