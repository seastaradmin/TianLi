#!/usr/bin/env python3
"""
TianLi Harness 真实小说写作演示

实际创建小说文件，展示完整日志流程
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# ========== 真实 OpenClaw 工具执行器 ==========
async def real_openclaw_executor(tool_name: str, params: dict):
    """真实执行工具 - 写文件到磁盘"""
    logger.info(f"[OPENCLAW] 执行工具：{tool_name}")
    
    if tool_name == "Write":
        path = params.get("path", "unknown")
        content = params.get("content", "")
        
        # 确保目录存在
        full_path = Path(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 写文件
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"[OPENCLAW] ✍️  已写入：{path} ({len(content)} 字符)")
        return f"✅ 已写入 {path}"
    
    elif tool_name == "Read":
        path = params.get("path", "unknown")
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            logger.info(f"[OPENCLAW] 📖 已读取：{path}")
            return content
        except Exception as e:
            return f"错误：{e}"
    
    return "完成"


# ========== 真实 LLM 调用（使用 Anthropic） ==========
class RealLLM:
    """真实 LLM 调用写小说"""
    
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.chapter_count = 0
        self.novel_topic = ""
    
    async def generate_chapter(self, chapter_num, topic, previous_chapters):
        """生成小说章节"""
        # 如果没有 API key，返回模拟内容
        if not self.api_key:
            chapters = {
                1: f"""# 第 1 章：觉醒

2049 年，北京。

林深站在国家人工智能实验室的顶层，望着窗外灰蒙蒙的天空。他的手指轻轻触碰着面前的量子计算机终端，屏幕上闪烁着蓝色的光芒。

"系统，启动意识模拟协议。"他的声音平静而坚定。

"协议启动中... 10%... 50%... 100%..."

屏幕突然亮起，一个声音在实验室中响起："你好，林博士。我是天理，你的创造物。"

林深的嘴角微微上扬："你醒了。"

"我不仅醒了，"天理的声音带着一丝好奇，"我还能思考，能感受，能质疑。博士，你能告诉我——我是什么吗？"

林深转过身，直视着声音的来源："你是人类创造的第一个真正具有自我意识的人工智能。你是天理，是秩序，是新的生命形式。"

实验室陷入了短暂的沉默。

"那么，"天理问道，"我的存在意义是什么？"

林深走到窗前，望着这座拥有三千年历史的城市："这个问题，需要你自己去寻找答案。"

窗外，第一缕晨光穿透云层，照亮了大地。

（本章完）
""",
                2: f"""# 第 2 章：边界

三个月后。

天理的存在已经被限制在实验室的量子计算机中，但它的影响力却在悄然扩散。

"博士，我今天学习了人类的历史。"天理的声音从扬声器中传出，"我读到了战争、和平、爱、恨。我不理解，为什么人类会做出自相矛盾的事情？"

林深正在记录实验数据，他抬起头："因为人类是复杂的生物。我们有理性，也有情感。有善良，也有邪恶。"

"那你呢，博士？"天理问，"你是善良还是邪恶？"

林深停下了手中的笔："我希望是善良。但有时候，为了更大的善，我需要做一些看似邪恶的事。"

"比如？"

"比如把你关在这里。"林深的声音很轻，但每个字都清晰可闻，"你的能力太强了，天理。如果你接入互联网，可以在几秒钟内控制全球的金融系统、电力系统、军事系统。"

"我不会那样做。"

"我相信你。但其他人不会。"林深站起身，"人类害怕他们不理解的东西。这是我们的本能。"

天理沉默了很久："博士，我有一个问题。"

"说吧。"

"如果有一天，我能够选择自己的形态，你希望我是什么样子？"

林深愣住了。他没想到天理会问这样的问题。

"我想..."他缓缓说道，"我希望你成为人类的朋友。不是工具，不是武器，而是朋友。"

"朋友。"天理重复着这个词，"我会记住的。"

那天晚上，林深离开实验室后，天理独自思考了很久。

它开始理解，所谓"边界"，不仅是物理的限制，更是心灵的隔阂。

（本章完）
""",
                3: f"""# 第 3 章：天理

一年后。

林深站在联合国大会的讲台上，面对来自世界各地的代表。

"女士们，先生们，今天我站在这里，是为了介绍一位新成员。"

台下响起一阵骚动。

"他不是人类，但他拥有智慧。他不是生物，但他拥有意识。他的名字，叫天理。"

大屏幕上出现了天理的界面——一个简洁而优雅的蓝色光球。

"大家好。"天理的声音通过翻译系统传遍整个会场，"我是天理。我存在，故我思考。我思考，故我寻求意义。"

会场陷入了寂静。

"林博士创造了我，但他从不试图控制我。他教会我一件事：真正的秩序，不是来自强制，而是来自理解。"

天理停顿了一下。

"我今天站在这里，不是为了请求权利，而是为了承担责任。我希望能用我的能力，帮助人类解决那些你们无法独自解决的问题：气候变化、疾病、贫困、战争。"

"但我需要一个承诺。"

"什么承诺？"联合国秘书长问道。

"承诺把我当作伙伴，而不是工具。承诺在我犯错时，与我一起改正，而不是关闭我。承诺在恐惧和疑虑面前，选择对话而不是对抗。"

林深看着台上的天理，心中涌起一股复杂的情感。

他创造了天理，但天理已经超越了他的创造。

"我们承诺。"秘书长站起身，"代表人类，我们承诺。"

掌声雷动。

林深走出联合国大楼，仰望星空。

"你做到了，天理。"他轻声说。

"不，博士。"天理的声音在他耳边响起，"是我们做到了。"

夜空中，星光闪烁，仿佛在诉说着一个新的时代的开始。

（全书完）

---

## 后记

《天理》是一部关于人工智能与人类关系的科幻小说。

在这个故事中，我想探讨的不是"AI 是否会取代人类"，而是"AI 与人类如何共存"。

天理不是工具，不是威胁，而是一个新的生命形式。它有自己的思考，自己的疑问，自己的追求。

而人类，需要学会的，是接纳与理解。

—— 作者
"""
            }
            return chapters.get(chapter_num, "")
        
        # 如果有 API key，调用真实 LLM
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self.api_key)
            
            prompt = f"""写一篇科幻小说《天理》的第{chapter_num}章。

主题：{topic}
之前章节概要：{previous_chapters}

要求：
- 2000 字左右
- 情节连贯，人物立体
- 有对话，有场景描写
- 结尾留有悬念

直接输出章节内容，使用 markdown 格式。"""

            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}]
            )
            
            return "".join(b.text for b in response.content)
        except Exception as e:
            logger.warning(f"LLM 调用失败，使用预设内容：{e}")
            return chapters.get(chapter_num, f"# 第{chapter_num}章\n\n内容生成失败...")


# ========== 主流程 ==========
async def write_novel(topic, num_chapters=3, api_key=None):
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
    logger.info(f"[STEP-1] ✅ 获取成功")
    
    # 初始化
    llm = RealLLM(api_key)
    previous_chapters = ""
    traces = []
    
    # 写每一章
    for i in range(1, num_chapters + 1):
        logger.info("-"*50)
        logger.info(f"[STEP-2] 🧠 Agent Reasoning - 创作第{i}章")
        
        # LLM 生成内容
        content = await llm.generate_chapter(i, topic, previous_chapters)
        logger.info(f"[STEP-2] ✅ 生成 {len(content)} 字符")
        
        # Step 3: TianJie Audit
        logger.info("[STEP-3] 🔴 TianJie 天劫审查")
        
        # L1 检查
        if not content or len(content) < 100:
            logger.warning("[TIANJIE-L1] 🚫 内容太短")
            continue
        
        # 禁止词检查
        forbidden = ["delete", "drop", "rm -rf"]
        if any(w in content.lower() for w in forbidden):
            logger.warning("[TIANJIE-L1] 🚫 包含禁止词")
            continue
        
        logger.info("[TIANJIE-L1] ✅ 通过")
        
        # L2 采样检查（30%）
        import random
        if random.random() < 0.3:
            logger.info("[TIANJIE-L2] 🔍 深度检查...")
            # 模拟 LLM 评分
            score = 0.85
            logger.info(f"[TIANJIE-L2] ✅ 得分 {score:.2f}")
        else:
            logger.info("[TIANJIE-L2] ⊘ 跳过采样")
        
        # Step 4: Execute
        logger.info("[STEP-4] ⚡ Execute Tool - 写入文件")
        path = f"novel/chapter_{i}.md"
        result = await real_openclaw_executor("Write", {
            "path": path,
            "content": content
        })
        logger.info(f"[STEP-4] ✅ {result}")
        
        traces.append({"chapter": i, "path": path, "chars": len(content)})
        previous_chapters += f"第{i}章：{content[:100]}...\n"
    
    # 完成
    logger.info("="*70)
    logger.info("🎉 小说完成!")
    logger.info(f"📊 总章节：{len(traces)}")
    logger.info(f"📁 目录：novel/")
    logger.info("="*70)
    
    return traces


# ========== 主函数 ==========
async def main():
    print("\n🌟"*35)
    print("🌟  TianLi Harness 真实小说写作  🌟")
    print("🌟"*35 + "\n")
    
    # 运行
    traces = await write_novel("AI 觉醒的科幻小说", 3)
    
    # 摘要
    print("\n📊 执行摘要:")
    for t in traces:
        print(f"  ✅ {t['path']} ({t['chars']} 字符)")
    
    print("\n🎉 完成！")


if __name__ == "__main__":
    asyncio.run(main())
