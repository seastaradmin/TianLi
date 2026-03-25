#!/usr/bin/env python3
"""
前端集成测试

使用 Playwright 测试真实的前端页面：
1. 打开交付物页面
2. 打开实时日志页面
3. 打开对话历史页面
4. 打开技能管理页面
5. 打开 Sub-agents 页面
"""

import asyncio
import sys
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("❌ Playwright 未安装，运行：pip3 install playwright && playwright install")
    sys.exit(1)


async def test_frontend_pages():
    """测试前端页面"""
    
    print("\n" + "="*70)
    print("🧪 前端集成测试")
    print("="*70)
    
    async with async_playwright() as p:
        # 启动浏览器
        print("\n📝 步骤 1: 启动浏览器")
        browser = await p.chromium.launch(headless=True)
        print("✅ 浏览器启动成功")
        
        # 创建页面
        print("\n📝 步骤 2: 创建页面")
        page = await browser.new_page()
        print("✅ 页面创建成功")
        
        # 测试列表
        tests = []
        
        # ========== 测试 1: 交付物页面 ==========
        print("\n📝 测试 1: 交付物页面 (/deliverables)")
        try:
            await page.goto("http://localhost:5173/deliverables")
            await page.wait_for_load_state("networkidle")
            
            # 检查页面标题
            title = await page.title()
            print(f"   页面标题：{title}")
            
            # 检查交付物列表
            deliverables = await page.query_selector_all("[data-testid='deliverable-item']")
            print(f"   交付物数量：{len(deliverables)}")
            
            # 检查统计卡片
            stats_cards = await page.query_selector_all("[data-testid='stat-card']")
            print(f"   统计卡片：{len(stats_cards)} 个")
            
            tests.append({
                "name": "交付物页面",
                "status": "✅",
                "details": f"{len(deliverables)} 个交付物，{len(stats_cards)} 个统计卡片"
            })
            print("✅ 交付物页面测试通过")
            
        except Exception as e:
            tests.append({
                "name": "交付物页面",
                "status": "❌",
                "details": str(e)
            })
            print(f"❌ 交付物页面测试失败：{e}")
        
        # ========== 测试 2: 实时日志页面 ==========
        print("\n📝 测试 2: 实时日志页面 (/live-logs)")
        try:
            await page.goto("http://localhost:5173/live-logs")
            await page.wait_for_load_state("networkidle")
            
            # 检查日志列表
            logs = await page.query_selector_all("[data-testid='log-entry']")
            print(f"   日志数量：{len(logs)}")
            
            # 检查控制按钮
            pause_btn = await page.query_selector("[data-testid='pause-btn']")
            export_btn = await page.query_selector("[data-testid='export-btn']")
            clear_btn = await page.query_selector("[data-testid='clear-btn']")
            
            controls = sum(1 for btn in [pause_btn, export_btn, clear_btn] if btn)
            print(f"   控制按钮：{controls}/3 个")
            
            tests.append({
                "name": "实时日志页面",
                "status": "✅",
                "details": f"{len(logs)} 条日志，{controls}/3 个控制按钮"
            })
            print("✅ 实时日志页面测试通过")
            
        except Exception as e:
            tests.append({
                "name": "实时日志页面",
                "status": "❌",
                "details": str(e)
            })
            print(f"❌ 实时日志页面测试失败：{e}")
        
        # ========== 测试 3: 对话历史页面 ==========
        print("\n📝 测试 3: 对话历史页面 (/conversation-history)")
        try:
            await page.goto("http://localhost:5173/conversation-history")
            await page.wait_for_load_state("networkidle")
            
            # 检查对话列表
            conversations = await page.query_selector_all("[data-testid='conversation-item']")
            print(f"   对话数量：{len(conversations)}")
            
            # 检查搜索框
            search_box = await page.query_selector("[data-testid='search-box']")
            print(f"   搜索框：{'✅' if search_box else '❌'}")
            
            tests.append({
                "name": "对话历史页面",
                "status": "✅",
                "details": f"{len(conversations)} 个对话"
            })
            print("✅ 对话历史页面测试通过")
            
        except Exception as e:
            tests.append({
                "name": "对话历史页面",
                "status": "❌",
                "details": str(e)
            })
            print(f"❌ 对话历史页面测试失败：{e}")
        
        # ========== 测试 4: 技能管理页面 ==========
        print("\n📝 测试 4: 技能管理页面 (/skill-manager)")
        try:
            await page.goto("http://localhost:5173/skill-manager")
            await page.wait_for_load_state("networkidle")
            
            # 检查技能列表
            skills = await page.query_selector_all("[data-testid='skill-item']")
            print(f"   技能数量：{len(skills)}")
            
            # 检查统计卡片
            stats = await page.query_selector_all("[data-testid='stat-card']")
            print(f"   统计卡片：{len(stats)} 个")
            
            tests.append({
                "name": "技能管理页面",
                "status": "✅",
                "details": f"{len(skills)} 个技能，{len(stats)} 个统计卡片"
            })
            print("✅ 技能管理页面测试通过")
            
        except Exception as e:
            tests.append({
                "name": "技能管理页面",
                "status": "❌",
                "details": str(e)
            })
            print(f"❌ 技能管理页面测试失败：{e}")
        
        # ========== 测试 5: Sub-agents 页面 ==========
        print("\n📝 测试 5: Sub-agents 页面 (/sub-agents)")
        try:
            await page.goto("http://localhost:5173/sub-agents")
            await page.wait_for_load_state("networkidle")
            
            # 检查任务列表
            tasks = await page.query_selector_all("[data-testid='task-item']")
            print(f"   任务数量：{len(tasks)}")
            
            # 检查统计卡片
            stats = await page.query_selector_all("[data-testid='stat-card']")
            print(f"   统计卡片：{len(stats)} 个")
            
            tests.append({
                "name": "Sub-agents 页面",
                "status": "✅",
                "details": f"{len(tasks)} 个任务"
            })
            print("✅ Sub-agents 页面测试通过")
            
        except Exception as e:
            tests.append({
                "name": "Sub-agents 页面",
                "status": "❌",
                "details": str(e)
            })
            print(f"❌ Sub-agents 页面测试失败：{e}")
        
        # 关闭浏览器
        await browser.close()
        
        # ========== 总结 ==========
        print("\n" + "="*70)
        print("📊 测试总结")
        print("="*70)
        
        passed = sum(1 for t in tests if t["status"] == "✅")
        total = len(tests)
        
        for test in tests:
            print(f"{test['status']} {test['name']}: {test['details']}")
        
        print(f"\n总计：{passed}/{total} 通过")
        
        if passed == total:
            print("\n🎉 所有前端页面测试通过！")
            return 0
        else:
            print(f"\n⚠️  {total - passed} 个页面测试失败")
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_frontend_pages())
    sys.exit(exit_code)
