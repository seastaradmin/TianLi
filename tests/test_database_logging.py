#!/usr/bin/env python3
"""
Test database logging for dispatch and execution
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tianli_harness.core.db_connector import get_feedback_database


async def test_database_logging():
    """Test database logging"""
    
    print("="*70)
    print("测试数据库日志记录")
    print("="*70)
    
    db = get_feedback_database()
    
    # Test 1: Log dispatch decision
    print("\n📝 测试 1: 记录分发决策")
    dispatch_id = db.log_dispatch_decision(
        task_id="test-task-001",
        session_id="test-session-001",
        user_input="生成产品宣讲 PPT",
        task_tags=["生成", "ppt", "产品"],
        selected_hero_ids=["ppt-creator-hero"],
        primary_hero_id="ppt-creator-hero",
        consult_hero_ids=None,
        candidate_scores={"ppt-creator-hero": 8.15, "ui-ux-hero": 3.95},
        dispatch_reason="Matched tags: ppt, 生成 with score 8.15",
        dispatch_mode="hybrid",
        collaboration_mode="primary_consult",
        fallback_used=False
    )
    
    if dispatch_id:
        print(f"✅ 分发决策记录成功，dispatch_id: {dispatch_id}")
    else:
        print("❌ 分发决策记录失败")
    
    # Test 2: Log task result
    print("\n📊 测试 2: 记录任务结果")
    success = db.log_task_result(
        task_id="test-task-001",
        dispatch_id=dispatch_id,
        status="completed",
        current_status="completed",
        execution_time_ms=1180,
        total_tokens=229,
        l1_passed=True,
        l2_passed=True,
        l2_score=0.92,
        violations=None,
        evolution_patch=None
    )
    
    if success:
        print("✅ 任务结果记录成功")
    else:
        print("❌ 任务结果记录失败")
    
    # Test 3: Update hero performance
    print("\n🦸 测试 3: 更新 Hero 性能")
    success = db.update_hero_performance(
        hero_id="ppt-creator-hero",
        success=True,
        execution_time_ms=1180,
        l2_score=0.92
    )
    
    if success:
        print("✅ Hero 性能更新成功")
    else:
        print("❌ Hero 性能更新失败")
    
    # Test 4: Get weights
    print("\n⚖️  测试 4: 获取权重配置")
    weights = db.get_hero_weights()
    if weights:
        print(f"✅ 获取到 {len(weights)} 个权重配置:")
        for name, config in weights.items():
            print(f"   - {name}: {config['value']}")
    else:
        print("❌ 获取权重配置失败")
    
    # Test 5: Get synonyms
    print("\n📚 测试 5: 获取同义词")
    synonyms = db.get_synonyms("ppt")
    if synonyms:
        print(f"✅ 'ppt' 的同义词：{synonyms}")
    else:
        print("❌ 获取同义词失败")
    
    # Test 6: Log user feedback
    print("\n💬 测试 6: 记录用户反馈")
    success = db.log_user_feedback(
        task_id="test-task-001",
        dispatch_id=dispatch_id,
        rating=5,
        success=True,
        feedback_text="PPT 生成效果很好！",
        feedback_type="positive",
        tags=["ppt", "满意"]
    )
    
    if success:
        print("✅ 用户反馈记录成功")
    else:
        print("❌ 用户反馈记录失败")
    
    # Summary
    print("\n" + "="*70)
    print("📊 测试总结")
    print("="*70)
    print("✅ 所有数据库操作测试完成")
    print(f"📄 数据库：tianli_feedback")
    print(f"🔌 连接：root@localhost:3306")
    
    db.close()


if __name__ == "__main__":
    asyncio.run(test_database_logging())
