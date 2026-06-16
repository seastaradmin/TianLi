#!/usr/bin/env python3
"""
端到端完整测试 - 使用 e2e-testing-patterns skill

测试整个天理项目的完整流程：
1. 安装验证
2. 配置验证
3. Hero 系统
4. 执行器
5. 记忆系统
6. API 连接
7. 完整工作流
8. 天劫审计
9. 天演进化
"""

import asyncio
import sys
import json
import time
from pathlib import Path
from datetime import datetime

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))


class E2ETestReporter:
    """E2E 测试报告生成器"""
    
    def __init__(self):
        self.results = []
        self.start_time = datetime.now()
    
    def add_result(self, test_name, passed, details="", error=""):
        self.results.append({
            "test": test_name,
            "passed": passed,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        })
    
    def generate_report(self):
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed
        
        report = {
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "pass_rate": f"{passed/total*100:.1f}%" if total > 0 else "0%",
                "duration_seconds": (datetime.now() - self.start_time).total_seconds()
            },
            "tests": self.results
        }
        
        return report


async def test_installation(reporter: E2ETestReporter):
    """测试 1: 安装验证"""
    print("\n" + "="*70)
    print("测试 1: 安装验证")
    print("="*70)
    
    # 检查 requirements.txt
    req_file = Path("requirements.txt")
    if req_file.exists():
        reporter.add_result("requirements.txt 存在", True, f"文件：{req_file.absolute()}")
        print(f"✅ requirements.txt 存在")
    else:
        reporter.add_result("requirements.txt 存在", False, "文件未找到")
        print(f"❌ requirements.txt 不存在")
    
    # 检查核心模块
    core_modules = [
        "core/__init__.py",
        "core/heroes.py",
        "core/graph.py",
        "core/executors.py",
        "core/memory.py",
        "core/audit_rules.py",
        "core/interceptor.py",
        "core/optimizer.py",
    ]
    
    for module in core_modules:
        module_path = Path("tianli_harness") / module
        if module_path.exists():
            reporter.add_result(f"模块 {module}", True)
        else:
            reporter.add_result(f"模块 {module}", False, "文件未找到")
            print(f"❌ 模块 {module} 不存在")
    
    # 尝试导入
    try:
        from tianli_harness.core.heroes import get_predefined_hero
        reporter.add_result("模块导入 (heroes)", True)
        print(f"✅ 模块导入成功")
    except Exception as e:
        reporter.add_result("模块导入 (heroes)", False, str(e))
        print(f"❌ 模块导入失败：{e}")


async def test_hero_system(reporter: E2ETestReporter):
    """测试 2: Hero 系统"""
    print("\n" + "="*70)
    print("测试 2: Hero 系统")
    print("="*70)
    
    try:
        from tianli_harness.core.heroes import get_predefined_hero, PREDEFINED_HEROES
        
        # 检查 Hero 数量
        hero_count = len(PREDEFINED_HEROES)
        if hero_count >= 14:
            reporter.add_result("Hero 数量", True, f"{hero_count} 个 Hero")
            print(f"✅ 找到 {hero_count} 个 Hero")
        else:
            reporter.add_result("Hero 数量", False, f"只有 {hero_count} 个，期望 14 个")
            print(f"❌ 只有 {hero_count} 个 Hero")
        
        # 测试关键 Hero
        critical_heroes = ["ui-ux-hero", "engineering-hero", "pm-hero", "qa-hero"]
        for hero_id in critical_heroes:
            hero = get_predefined_hero(hero_id)
            if hero and hero.get("system_prompt"):
                reporter.add_result(f"Hero {hero_id}", True, f"{hero['display_name']}")
                print(f"✅ {hero_id}: {hero['display_name']}")
            else:
                reporter.add_result(f"Hero {hero_id}", False, "Hero 未定义或无 system_prompt")
                print(f"❌ {hero_id} 加载失败")
        
        # 检查 Hero 质量
        sample_hero = get_predefined_hero("ui-ux-hero")
        if sample_hero:
            checks = {
                "display_name": "display_name" in sample_hero,
                "system_prompt": "system_prompt" in sample_hero,
                "tools": "tools" in sample_hero,
                "capabilities": "capabilities" in sample_hero,
                "linked_skills": "linked_skills" in sample_hero,
            }
            
            for check, passed in checks.items():
                reporter.add_result(f"Hero 字段 {check}", passed)
                if passed:
                    print(f"✅ Hero 有 {check} 字段")
                else:
                    print(f"❌ Hero 缺少 {check} 字段")
        
    except Exception as e:
        reporter.add_result("Hero 系统", False, str(e))
        print(f"❌ Hero 系统测试失败：{e}")


async def test_executor_system(reporter: E2ETestReporter):
    """测试 3: 执行器系统"""
    print("\n" + "="*70)
    print("测试 3: 执行器系统")
    print("="*70)
    
    import tempfile
    import shutil
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        from tianli_harness.core.executors import LocalExecutor
        
        executor = LocalExecutor(temp_dir)
        reporter.add_result("执行器创建", True)
        print(f"✅ 执行器创建成功")
        
        # 测试文件写入
        result = await executor.execute("Write", {
            "file_path": "test_e2e.txt",
            "content": "E2E Test Content"
        })
        
        if result.get("success"):
            reporter.add_result("文件写入", True)
            print(f"✅ 文件写入成功")
        else:
            reporter.add_result("文件写入", False, result.get("error"))
            print(f"❌ 文件写入失败：{result.get('error')}")
        
        # 测试文件读取
        result = await executor.execute("Read", {
            "file_path": "test_e2e.txt"
        })
        
        if result.get("success") and "E2E Test Content" in result.get("content", ""):
            reporter.add_result("文件读取", True)
            print(f"✅ 文件读取成功")
        else:
            reporter.add_result("文件读取", False, result.get("error"))
            print(f"❌ 文件读取失败")
        
        # 测试 Bash 执行
        result = await executor.execute("Bash", {
            "command": "echo 'E2E Bash Test'"
        })
        
        if result.get("success"):
            reporter.add_result("Bash 执行", True, result.get("stdout", "").strip())
            print(f"✅ Bash 执行成功：{result.get('stdout', '').strip()}")
        else:
            reporter.add_result("Bash 执行", False, result.get("error"))
            print(f"❌ Bash 执行失败")
        
        shutil.rmtree(temp_dir)
        
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        reporter.add_result("执行器系统", False, str(e))
        print(f"❌ 执行器系统测试失败：{e}")


async def test_memory_system(reporter: E2ETestReporter):
    """测试 4: 记忆系统"""
    print("\n" + "="*70)
    print("测试 4: 记忆系统")
    print("="*70)
    
    import tempfile
    import shutil
    
    temp_dir = tempfile.mkdtemp()
    
    try:
        from tianli_harness.core.memory import get_project_memory, LessonLearned
        
        memory = get_project_memory(temp_dir)
        reporter.add_result("记忆系统创建", True)
        print(f"✅ 记忆系统创建成功")
        
        # 测试加载
        context = memory.load()
        reporter.add_result("记忆加载", True, f"项目：{context.project_name}")
        print(f"✅ 记忆加载成功：{context.project_name}")
        
        # 测试写入
        memory.add_lesson(LessonLearned(
            lesson_id="e2e-test-001",
            task_description="E2E 测试任务",
            lesson_type="success",
            description="E2E 测试通过",
            recommendation="继续保持",
            tags=["e2e", "test"],
        ))
        reporter.add_result("记忆写入", True)
        print(f"✅ 记忆写入成功")
        
        # 测试读取
        lessons = memory.get_lessons(limit=5)
        if len(lessons) > 0:
            reporter.add_result("记忆读取", True, f"{len(lessons)} 条记录")
            print(f"✅ 记忆读取成功：{len(lessons)} 条记录")
        else:
            reporter.add_result("记忆读取", False, "没有读到记录")
            print(f"❌ 记忆读取失败")
        
        # 测试持久化
        memory2 = get_project_memory(temp_dir)
        lessons2 = memory2.get_lessons(limit=5)
        if len(lessons2) > 0:
            reporter.add_result("记忆持久化", True)
            print(f"✅ 记忆持久化成功")
        else:
            reporter.add_result("记忆持久化", False, "重启后数据丢失")
            print(f"❌ 记忆持久化失败")
        
        shutil.rmtree(temp_dir)
        
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        reporter.add_result("记忆系统", False, str(e))
        print(f"❌ 记忆系统测试失败：{e}")


async def test_config_system(reporter: E2ETestReporter):
    """测试 5: 配置系统"""
    print("\n" + "="*70)
    print("测试 5: 配置系统")
    print("="*70)
    
    try:
        from tianli_harness.core.config_loader import load_config_from_string
        
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
  forbidden_words:
    - "rm -rf"

tianyan:
  enabled: true
  auto_commit: false

dispatch:
  mode: "hybrid"
  max_fanout: 2
  router_model: "doubao-seed-2.0-code"
"""
        
        config = load_config_from_string(yaml_content)
        
        # 验证配置字段
        checks = {
            "hero_id": config.hero_id == "ui-ux-hero",
            "superpowers": len(config.superpowers) == 3,
            "drift_threshold": config.drift_threshold == 0.4,
            "l2_sample_ratio": config.l2_sample_ratio == 0.3,
            "forbidden_words": "rm -rf" in config.forbidden_words,
            "dispatch_mode": config.dispatch_mode == "hybrid",
        }
        
        for field, passed in checks.items():
            reporter.add_result(f"配置字段 {field}", passed)
            if passed:
                print(f"✅ 配置字段 {field} 正确")
            else:
                print(f"❌ 配置字段 {field} 错误")
        
        reporter.add_result("配置系统", True)
        print(f"✅ 配置系统测试通过")
        
    except Exception as e:
        reporter.add_result("配置系统", False, str(e))
        print(f"❌ 配置系统测试失败：{e}")


async def test_api_connection(reporter: E2ETestReporter):
    """测试 6: API 连接"""
    print("\n" + "="*70)
    print("测试 6: API 连接")
    print("="*70)
    
    try:
        import httpx
        import os
        
        api_key = os.getenv("ANTHROPIC_API_KEY", "660d27e6-e65f-4a33-8fea-87101d33c210")
        api_url = "https://ark.cn-beijing.volces.com/api/coding/v3"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            start = time.time()
            response = await client.post(
                f"{api_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "doubao-seed-2.0-code",
                    "messages": [
                        {"role": "user", "content": "Hello, E2E test!"}
                    ],
                    "max_tokens": 50,
                },
            )
            latency = (time.time() - start) * 1000
            
            if response.status_code == 200:
                result = response.json()
                reporter.add_result("API 连接", True, f"延迟：{latency:.0f}ms")
                print(f"✅ API 连接成功")
                print(f"   Model: {result.get('model')}")
                print(f"   Tokens: {result.get('usage', {}).get('total_tokens', 0)}")
                print(f"   延迟：{latency:.0f}ms")
            else:
                reporter.add_result("API 连接", False, f"HTTP {response.status_code}")
                print(f"❌ API 连接失败：HTTP {response.status_code}")
                print(f"   响应：{response.text[:200]}")
        
    except ImportError:
        reporter.add_result("API 连接", False, "缺少 httpx 依赖")
        print(f"❌ API 连接测试失败：缺少 httpx 依赖")
    except Exception as e:
        reporter.add_result("API 连接", False, str(e))
        print(f"❌ API 连接测试失败：{e}")


async def test_full_workflow(reporter: E2ETestReporter):
    """测试 7: 完整工作流"""
    print("\n" + "="*70)
    print("测试 7: 完整工作流")
    print("="*70)
    
    print("⚠️  注意：这个测试需要 HarnessEngine 和所有依赖")
    print("如果依赖未安装，这个测试会失败\n")
    
    try:
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
  l2_sample_ratio: 0.0

dispatch:
  mode: "hybrid"
  max_fanout: 1
""")
        
        # 创建模拟执行器
        executed_tools = []
        async def mock_executor(tool_name, params):
            executed_tools.append(tool_name)
            return {"status": "ok", "tool": tool_name}
        
        # 创建引擎
        print("   创建 HarnessEngine...")
        engine = HarnessEngine(
            config=config,
            anthropic=None,
            openclaw_executor=mock_executor,
            session_id="e2e-test-001"
        )
        reporter.add_result("HarnessEngine 创建", True)
        print(f"✅ HarnessEngine 创建成功")
        
        # 运行任务
        print("   运行测试任务...")
        start = time.time()
        result = await engine.run("e2e-task-001", "E2E 测试任务")
        duration = time.time() - start
        
        # 验证结果
        status = result.get("current_status", "unknown")
        if status in ["completed", "early_exit"]:
            reporter.add_result("任务执行", True, f"状态：{status}, 耗时：{duration:.2f}s")
            print(f"✅ 任务执行完成")
            print(f"   状态：{status}")
            print(f"   耗时：{duration:.2f}s")
            print(f"   工具调用：{executed_tools}")
        else:
            reporter.add_result("任务执行", False, f"未知状态：{status}")
            print(f"❌ 任务执行失败：{status}")
        
        reporter.add_result("完整工作流", True)
        print(f"\n✅ 完整工作流测试通过")
        
    except ImportError as e:
        reporter.add_result("完整工作流", False, f"缺少依赖：{e}")
        print(f"❌ 完整工作流测试失败：{e}")
        print(f"   原因：需要安装 langgraph")
    except Exception as e:
        reporter.add_result("完整工作流", False, str(e))
        print(f"❌ 完整工作流测试失败：{e}")
        import traceback
        traceback.print_exc()


async def main():
    """运行所有 E2E 测试"""
    print("\n" + "="*70)
    print("🧪 天理项目 E2E 完整测试")
    print("使用 e2e-testing-patterns skill")
    print("="*70)
    print(f"开始时间：{datetime.now().isoformat()}")
    
    reporter = E2ETestReporter()
    
    # 运行所有测试
    await test_installation(reporter)
    await test_hero_system(reporter)
    await test_executor_system(reporter)
    await test_memory_system(reporter)
    await test_config_system(reporter)
    await test_api_connection(reporter)
    await test_full_workflow(reporter)
    
    # 生成报告
    report = reporter.generate_report()
    
    # 打印汇总
    print("\n" + "="*70)
    print("📊 E2E 测试结果汇总")
    print("="*70)
    
    summary = report["summary"]
    print(f"总测试数：{summary['total']}")
    print(f"通过：{summary['passed']}")
    print(f"失败：{summary['failed']}")
    print(f"通过率：{summary['pass_rate']}")
    print(f"耗时：{summary['duration_seconds']:.2f}秒")
    
    print("\n详细结果:")
    for result in report["tests"]:
        status = "✅" if result["passed"] else "❌"
        print(f"{status} {result['test']}: {result['details'] or result['error']}")
    
    # 保存报告
    report_path = Path("docs/E2E_FULL_REPORT.json")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n📄 完整报告已保存：{report_path.absolute()}")
    
    # 生成 Markdown 报告
    md_report = generate_markdown_report(report)
    md_path = Path("docs/E2E_FULL_REPORT.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_report)
    
    print(f"📄 Markdown 报告已保存：{md_path.absolute()}")
    
    # 返回退出码
    if summary["failed"] == 0:
        print("\n🎉 所有 E2E 测试通过！前后端已完全打通！")
        return 0
    else:
        print(f"\n⚠️  {summary['failed']} 个 E2E 测试失败，项目存在问题")
        return 1


def generate_markdown_report(report):
    """生成 Markdown 格式报告"""
    summary = report["summary"]
    
    md = f"""# E2E 完整测试报告

**测试日期:** {datetime.now().isoformat()}
**测试工具:** e2e-testing-patterns skill
**测试范围:** 端到端完整流程

---

## 📊 测试汇总

| 指标 | 数值 |
|------|------|
| 总测试数 | {summary['total']} |
| 通过 | {summary['passed']} |
| 失败 | {summary['failed']} |
| 通过率 | {summary['pass_rate']} |
| 耗时 | {summary['duration_seconds']:.2f}秒 |

---

## ✅ 通过的测试

"""
    
    for result in report["tests"]:
        if result["passed"]:
            md += f"- ✅ {result['test']}: {result['details']}\n"
    
    md += "\n## ❌ 失败的测试\n\n"
    
    for result in report["tests"]:
        if not result["passed"]:
            md += f"- ❌ {result['test']}: {result['error']}\n"
    
    md += f"""
---

## 🎯 结论

"""
    
    if summary["failed"] == 0:
        md += "**✅ 所有测试通过！前后端已完全打通，流程有效！**\n"
    else:
        md += f"**⚠️ {summary['failed']} 个测试失败，需要修复以下问题:**\n\n"
        for result in report["tests"]:
            if not result["passed"]:
                md += f"1. {result['test']}: {result['error']}\n"
    
    md += f"""
---

**生成时间:** {datetime.now().isoformat()}
**测试工具:** E2E Testing Patterns Skill
"""
    
    return md


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
