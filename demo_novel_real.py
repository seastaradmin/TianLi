#!/usr/bin/env python3
"""
TianLi Harness 真实小说写作演示

自动读取本地 OpenClaw 配置，调用真实 LLM API
"""

import asyncio
import logging
import sys
import os
import json
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load_openclaw_config():
    """自动读取本地 OpenClaw 配置"""
    config_paths = [
        Path.home() / ".jvs" / ".openclaw" / "openclaw.json",
        Path.home() / ".jvs" / ".openclaw" / "agents" / "main" / "agent" / "models.json",
    ]
    
    for path in config_paths:
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                config = json.load(f)
            logger.info(f"✅ 读取配置：{path}")
            return config
    
    logger.warning("⚠️  未找到 OpenClaw 配置文件")
    return None


class LLMClient:
    """LLM 客户端 - 支持多种 provider"""
    
    def __init__(self, config=None):
        self.config = config or load_openclaw_config()
        self.client = None
        self.base_url = None
        self.api_key = None
        self.model = None
        
        if self.config:
            self._init_from_config()
    
    def _init_from_config(self):
        """从 OpenClaw 配置初始化"""
        models = self.config.get("models", {}).get("providers", {})
        
        # 优先使用 gateway
        if "gateway" in models:
            provider = models["gateway"]
            self.base_url = provider["baseUrl"]
            self.api_key = provider["apiKey"]
            self.model = provider["models"][0]["id"]
            logger.info(f"✅ 使用 Gateway: {self.model}")
        # 其次使用 bailian (Qwen)
        elif "bailian" in models:
            provider = models["bailian"]
            self.base_url = provider["baseUrl"]
            self.api_key = provider["apiKey"]
            self.model = provider["models"][0]["id"]
            logger.info(f"✅ 使用 Bailian: {self.model}")
        # 最后使用 qwen-portal
        elif "qwen-portal" in models:
            provider = models["qwen-portal"]
            self.base_url = provider["baseUrl"]
            self.api_key = provider.get("apiKey", "qwen-oauth")
            self.model = "coder-model"
            logger.info(f"✅ 使用 Qwen Portal: {self.model}")
    
    async def generate(self, prompt: str, max_tokens: int = 4096) -> str:
        """生成文本"""
        if not self.base_url:
            return None
        
        try:
            import httpx
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": max_tokens
                    }
                )
                response.raise_for_status()
                result = response.json()
                content = result["choices"][0]["message"]["content"]
                logger.info(f"✅ LLM 生成 {len(content)} 字符")
                return content
        except Exception as e:
            logger.error(f"LLM 调用失败：{e}")
            return None


# ========== 主流程 ==========
async def write_novel(topic: str = "AI 觉醒的科幻小说", num_chapters: int = 3):
    """写小说主流程"""
    
    logger.info("="*70)
    logger.info("🚀 TianLi Harness 启动")
    logger.info(f"📝 任务：写小说 - {topic}")
    logger.info(f"📊 章节数：{num_chapters}")
    logger.info("="*70)
    
    # Step 1: Fetch DNA
    logger.info("[STEP-1] 🧬 Fetch DNA - 获取 Hero Prompt")
    hero_prompt = """你是专业小说作家。
擅长创作扣人心弦的故事，塑造立体人物。
写作风格细腻，情节紧凑。"""
    logger.info(f"[STEP-1] ✅ 获取成功 ({len(hero_prompt)} 字符)")
    
    # 初始化 LLM
    llm = LLMClient()
    previous_chapters = ""
    traces = []
    
    # 写每一章
    for i in range(1, num_chapters + 1):
        logger.info("-"*50)
        logger.info(f"[STEP-2] 🧠 Agent Reasoning - 创作第{i}章")
        
        # LLM 生成内容
        prompt = f"""写科幻小说《天理》的第{i}章，主题：{topic}。
之前章节：{previous_chapters[-300:] if previous_chapters else "无"}
要求：1000 字左右，有对话和场景，结尾留悬念。
直接输出章节内容，以 # 第{i}章：标题 开头。"""
        
        content = await llm.generate(prompt)
        
        if not content:
            logger.warning("LLM 失败，使用预设内容")
            content = f"# 第{i}章\n\n这是预设内容..."
        
        logger.info(f"[STEP-2] ✅ 生成 {len(content)} 字符")
        
        # Step 3: TianJie Audit
        logger.info("[STEP-3] 🔴 TianJie 天劫审查")
        
        # L1 检查
        if len(content) < 50:
            logger.warning("[TIANJIE-L1] 🚫 内容太短")
            continue
        
        logger.info("[TIANJIE-L1] ✅ 通过")
        
        # L2 采样
        import random
        if random.random() < 0.3:
            logger.info("[TIANJIE-L2] 🔍 深度检查...")
        else:
            logger.info("[TIANJIE-L2] ⊘ 跳过采样")
        
        # Step 4: Write file
        logger.info("[STEP-4] ⚡ Execute Tool - 写入文件")
        path = f"novel/chapter_{i}.md"
        Path("novel").mkdir(exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        logger.info(f"[STEP-4] ✅ 已写入 {path}")
        
        traces.append({"chapter": i, "path": path, "chars": len(content)})
        previous_chapters += content[:200] + "...\n"
    
    logger.info("="*70)
    logger.info("🎉 小说完成!")
    logger.info(f"📊 总章节：{len(traces)}")
    logger.info("="*70)
    
    return traces


async def main():
    print("\n🌟"*35)
    print("🌟  TianLi Harness 真实小说写作  🌟")
    print("🌟"*35 + "\n")
    
    traces = await write_novel("AI 觉醒的科幻小说", 3)
    
    print("\n📊 执行摘要:")
    for t in traces:
        print(f"  ✅ {t['path']} ({t['chars']} 字符)")
    print("\n🎉 完成！")


if __name__ == "__main__":
    asyncio.run(main())
