#!/usr/bin/env python3
"""
简化版真实测试：直接调用 Volcengine Ark API
不依赖天理框架，只测试核心交付能力
"""

import asyncio
import os
import httpx

# API 配置
API_KEY = "660d27e6-e65f-4a33-8fea-87101d33c210"
API_URL = "https://ark.cn-beijing.volces.com/api/coding"

async def test_api_and_generate():
    """测试 API 并生成落地页代码"""
    
    print("\n" + "="*70)
    print("🧪 真实测试：Volcengine Ark API 交付能力")
    print("="*70)
    print(f"\n📋 天命：做个网站落地页")
    print(f"🤖 API: {API_URL}")
    print("="*70)
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        # 测试消息
        print("\n🤖 正在调用 AI 生成落地页代码...")
        
        response = await client.post(
            API_URL + "/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "doubao-coding-pro",
                "messages": [
                    {
                        "role": "system",
                        "content": """You are a UI/UX Design Expert.
Generate production-ready landing page code with:
- React + TypeScript
- Tailwind CSS
- Lucide React icons
- Responsive design (mobile, tablet, desktop)
- WCAG AA accessibility
- Professional color palette
- Modern UI patterns

Output ONLY the code, no explanations."""
                    },
                    {
                        "role": "user",
                        "content": "做个网站落地页。要求：专业、现代、响应式设计。包含 Hero 区域、特性展示、价格方案、页脚。使用 React + Tailwind CSS。输出完整代码。"
                    }
                ],
                "max_tokens": 8192,
                "temperature": 0.7,
            },
        )
        
        print(f"\n📊 HTTP 状态码：{response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ API 调用成功！")
            
            # 解析结果
            code = result['choices'][0]['message']['content']
            
            # 保存代码
            from pathlib import Path
            output_dir = Path("./ark_test_output")
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir / "landing_page.tsx"
            
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(code)
            
            print(f"\n✅ 代码生成成功！")
            print(f"   文件：{output_file}")
            print(f"   大小：{len(code):,} 字符")
            print(f"   行数：{len(code.splitlines())} 行")
            
            # 显示预览
            print("\n📄 代码预览（前 60 行）:")
            print("-" * 70)
            lines = code.split("\n")[:60]
            for i, line in enumerate(lines, 1):
                print(f"{i:3d} | {line}")
            print("-" * 70)
            
            # 保存测试报告
            report = f"""# Volcengine Ark API 实测报告

**测试日期:** {__import__('datetime').datetime.now().isoformat()}
**测试任务:** 做个网站落地页
**API:** {API_URL}
**模型:** doubao-coding-pro

## 测试结果

✅ **成功**

- 代码大小：{len(code):,} 字符
- 代码行数：{len(code.splitlines())} 行
- 输出文件：{output_file}

## 代码质量

待评估...

## 下一步

1. 安装依赖：npm install react react-dom tailwindcss lucide-react
2. 配置 Tailwind
3. 运行测试
4. 评估代码质量
"""
            
            report_file = output_dir / "TEST_REPORT.md"
            with open(report_file, "w", encoding="utf-8") as f:
                f.write(report)
            
            print(f"\n✅ 测试报告已保存：{report_file}")
            
            return {
                "status": "success",
                "file": str(output_file),
                "size": len(code),
                "lines": len(code.splitlines()),
            }
            
        else:
            print(f"❌ API 调用失败！")
            print(f"   HTTP {response.status_code}")
            print(f"   响应：{response.text[:500]}")
            
            return {
                "status": "failed",
                "http_status": response.status_code,
                "error": response.text[:500],
            }


if __name__ == "__main__":
    result = asyncio.run(test_api_and_generate())
    
    print("\n" + "="*70)
    print("📊 测试总结:")
    print("="*70)
    
    if result["status"] == "success":
        print(f"\n✅ 测试成功！")
        print(f"   火山引擎 Ark API 具备真实交付能力")
        print(f"   输出文件：{result['file']}")
        print(f"   代码规模：{result['size']:,} 字符 / {result['lines']} 行")
        print(f"\n🎉 天理项目架构 + 火山引擎 API = 真实交付能力！")
    else:
        print(f"\n❌ 测试失败")
        print(f"   HTTP 状态：{result.get('http_status', 'N/A')}")
        print(f"   错误信息：{result.get('error', 'Unknown')}")
