#!/usr/bin/env python3
"""
端到端集成测试 - 验证前后端是否打通

测试整个流程：
1. 加载配置
2. 创建引擎
3. 执行任务
4. 验证结果
"""

import asyncio
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))


async def test_imports():
    """测试 1: 验证所有模块可以导入"""
    print("\n" + "="*60)
    print("测试 1: 验证模块导入")
    print("="*60)
    
    errors = []
    
    try:
        from tianli_harness.core.heroes import get_predefined_hero, PREDEFINED_HEROES
        print("✅ heroes 模块导入成功")
        print(f"   找到 {len(PREDEFINED_HEROES)} 个 Hero")
    except Exception as e:
        errors.append(f"heroes 导入失败：{e}")
        print(f"❌ heroes 模块导入失败：{e}")
    
    try:
        from tianli_harness.core.config_loader import load_config
        print("✅ config_loader 模块导入成功")
    except Exception as e:
        errors.append(f"config_loader 导入失败：{e}")
        print(f"❌ config_loader 模块导入失败：{e}")
    
    try:
        from tianli_harness.core.memory import get_project_memory
        print("✅ memory 模块导入成功")
    except Exception as e:
        errors.append(f"memory 导入失败：{e}")
        print(f"❌ memory 模块导入失败：{e}")
    
    try:
        from tianli_harness.core.executors import get_orchestrator
        print("✅ executors 模块导入成功")
    except Exception as e:
        errors.append(f"executors 导入失败：{e}")
        print(f"❌ executors 模块导入失败：{e}")
    
    # 关键测试：HarnessEngine
    try:
        from tianli_harness.core.graph import HarnessEngine
        print("✅ graph 模块导入成功 (HarnessEngine)")
    except ImportError as e:
        errors.append(f"graph 导入失败：{e}")
        print(f"❌ graph 模块导入失败：{e}")
        print(f"   原因：{str(e)}")
    
    if errors:
        print(f"\n❌ 导入测试失败：{len(errors)} 个错误")
        for error in errors:
            print(f"   - {error}")
        return False
    else:
        print("\n✅ 所有模块导入成功")
        return True


async def test_hero_loading():
    """测试 2: 验证 Hero 可以加载"""
    print("\n" + "="*60)
    print("测试 2: 验证 Hero 加载")
    print("="*60)
    
    from tianli_harness.core.heroes import get_predefined_hero
    
    test_heroes = [
        "ui-ux-hero",
        "engineering-hero",
        "pm-hero",
    ]
    
    errors = []
    
    for hero_id in test_heroes:
        hero = get_predefined_hero(hero_id)
        if hero:
            print(f"✅ {hero_id}: {hero['display_name']}")
        else:
            errors.append(f"{hero_id} 加载失败")
            print(f"❌ {hero_id} 加载失败")
    
    if errors:
        print(f"\n❌ Hero 加载测试失败：{len(errors)} 个错误")
        return False
    else:
        print("\n✅ 所有 Hero 加载成功")
        return True


async def test_config_loading():
    """测试 3: 验证配置加载"""
    print("\n" + "="*60)
    print("测试 3: 验证配置加载")
    print("="*60)
    
    from tianli_harness.core.config_loader import load_config, load_config_from_string
    
    # 测试从字符串加载
    yaml_content = """
hero:
  id: "ui-ux-hero"
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
"""
    
    try:
        config = load_config_from_string(yaml_content)
        print(f"✅ 配置加载成功")
        print(f"   Hero ID: {config.hero_id}")
        print(f"   Superpowers: {config.superpowers}")
        print(f"   L2 Sample Ratio: {config.l2_sample_ratio}")
        return True
    except Exception as e:
        print(f"❌ 配置加载失败：{e}")
        return False


async def test_memory_system():
    """测试 4: 验证记忆系统"""
    print("\n" + "="*60)
    print("测试 4: 验证记忆系统")
    print("="*60)
    
    from tianli_harness.core.memory import get_project_memory
    import tempfile
    import shutil
    
    # 创建临时目录
    temp_dir = tempfile.mkdtemp()
    
    try:
        memory = get_project_memory(temp_dir)
        
        # 测试加载
        context = memory.load()
        print(f"✅ 记忆系统加载成功")
        print(f"   项目：{context.project_name}")
        
        # 测试写入
        from tianli_harness.core.memory import LessonLearned
        memory.add_lesson(LessonLearned(
            lesson_id="test-001",
            task_description="测试任务",
            lesson_type="success",
            description="测试成功",
            recommendation="继续保持",
        ))
        print(f"✅ 记忆写入成功")
        
        # 测试读取
        lessons = memory.get_lessons(limit=5)
        print(f"✅ 记忆读取成功：{len(lessons)} 条记录")
        
        shutil.rmtree(temp_dir)
        print("\n✅ 记忆系统测试通过")
        return True
        
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        print(f"❌ 记忆系统测试失败：{e}")
        return False


async def test_executor():
    """测试 5: 验证执行器"""
    print("\n" + "="*60)
    print("测试 5: 验证执行器")
    print("="*60)
    
    from tianli_harness.core.executors import LocalExecutor
    import tempfile
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        executor = LocalExecutor(temp_dir)
        
        # 测试文件写入
        result = await executor.execute("Write", {
            "file_path": "test.txt",
            "content": "Hello, TianLi!"
        })
        
        if result.get("success"):
            print(f"✅ 文件写入成功")
        else:
            print(f"❌ 文件写入失败：{result.get('error')}")
            return False
        
        # 测试文件读取
        result = await executor.execute("Read", {
            "file_path": "test.txt"
        })
        
        if result.get("success"):
            content = result.get("content", "")
            print(f"✅ 文件读取成功：{content}")
        else:
            print(f"❌ 文件读取失败：{result.get('error')}")
            return False
        
        # 测试 Bash 执行
        result = await executor.execute("Bash", {
            "command": "echo 'Hello from Bash'"
        })
        
        if result.get("success"):
            print(f"✅ Bash 执行成功：{result.get('stdout', '').strip()}")
        else:
            print(f"❌ Bash 执行失败：{result.get('error')}")
            return False
        
        import shutil
        shutil.rmtree(temp_dir)
        print("\n✅ 执行器测试通过")
        return True
        
    except Exception as e:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        print(f"❌ 执行器测试失败：{e}")
        return False


async def test_api_connection():
    """测试 6: 验证 API 连接"""
    print("\n" + "="*60)
    print("测试 6: 验证 API 连接")
    print("="*60)
    
    import httpx
    import os
    
    api_key = os.getenv("ANTHROPIC_API_KEY", "660d27e6-e65f-4a33-8fea-87101d33c210")
    api_url = "https://ark.cn-beijing.volces.com/api/coding/v3"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{api_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "doubao-seed-2.0-code",
                    "messages": [
                        {"role": "user", "content": "Hello, are you available?"}
                    ],
                    "max_tokens": 50,
                },
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ API 连接成功")
                print(f"   Model: {result.get('model')}")
                print(f"   Tokens: {result.get('usage', {}).get('total_tokens', 0)}")
                return True
            else:
                print(f"❌ API 连接失败：HTTP {response.status_code}")
                print(f"   响应：{response.text[:200]}")
                return False
                
    except Exception as e:
        print(f"❌ API 连接测试失败：{e}")
        return False


async def test_full_workflow():
    """测试 7: 完整流程测试（简化版）"""
    print("\n" + "="*60)
    print("测试 7: 完整流程测试")
    print("="*60)
    
    print("\n⚠️  注意：这个测试需要 HarnessEngine 正常工作")
    print("如果前面的测试有失败，这个测试很可能也会失败\n")
    
    try:
        # 尝试导入 HarnessEngine
        from tianli_harness.core.graph import HarnessEngine
        from tianli_harness.core.config_loader import load_config_from_string
        
        # 创建配置
        config = load_config_from_string("""
hero:
  id: "ui-ux-hero"
  use_predefined: true
  superpowers:
    - Read
    - Write
    - Bash

tianjie:
  drift_threshold: 0.4
  l2_sample_ratio: 0.0  # 禁用 L2 审计加速测试

dispatch:
  mode: "hybrid"
  max_fanout: 1
""")
        
        # 创建模拟执行器
        async def mock_executor(tool_name, params):
            print(f"   📝 执行工具：{tool_name}")
            return {"status": "ok", "tool": tool_name}
        
        # 创建引擎
        print("   创建 HarnessEngine...")
        engine = HarnessEngine(
            config=config,
            anthropic=None,  # 不使用 LLM
            openclaw_executor=mock_executor,
            session_id="test-e2e-001"
        )
        
        print("✅ HarnessEngine 创建成功")
        
        # 运行任务
        print("   运行测试任务...")
        result = await engine.run("test-task-001", "测试任务")
        
        print(f"✅ 任务执行完成")
        print(f"   状态：{result.get('current_status', 'unknown')}")
        
        return True
        
    except ImportError as e:
        print(f"❌ HarnessEngine 导入失败：{e}")
        print(f"   原因：缺少依赖 (langgraph)")
        return False
        
    except Exception as e:
        print(f"❌ 完整流程测试失败：{e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """运行所有测试"""
    print("\n" + "="*70)
    print("🧪 天理项目端到端集成测试")
    print("="*70)
    
    results = {
        "模块导入": await test_imports(),
        "Hero 加载": await test_hero_loading(),
        "配置加载": await test_config_loading(),
        "记忆系统": await test_memory_system(),
        "执行器": await test_executor(),
        "API 连接": await test_api_connection(),
        "完整流程": await test_full_workflow(),
    }
    
    # 汇总结果
    print("\n" + "="*70)
    print("📊 测试结果汇总")
    print("="*70)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"{status} - {test_name}")
    
    print(f"\n总计：{passed}/{total} 测试通过 ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 所有测试通过！前后端已打通，流程有效！")
        return 0
    else:
        print(f"\n⚠️  {total - passed} 个测试失败，项目存在问题")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
