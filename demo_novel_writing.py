#!/usr/bin/env python3
"""
TianLi Harness 小说写作演示

使用 TianLi Harness 架构来写一篇小说，展示完整日志流程
"""

import asyncio
import logging
import sys
import os
from datetime import datetime

# Setup logging - 显示完整流程
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# ========== 模拟 OpenClaw 工具执行器 ==========
async def mock_openclaw_executor(tool_name: str, params: dict):
    """模拟 OpenClaw 工具执行 - 写小说场景"""
    logger.info(f"[OPENCLAW] 执行工具：{tool_name}, 参数：{params}")
    
    if tool_name == "Write":
        path = params.get("path", "unknown")
        content = params.get("content", "")
        logger.info(f"[OPENCLAW] ✍️  写入文件：{path} ({len(content)} 字符)")
        return f"✅ 已写入 {path}"
    
    elif tool_name == "Read":
        path = params.get("path", "unknown")
        logger.info(f"[OPENCLAW] 📖 读取文件：{path}")
        return "文件内容..."
    
    elif tool_name == "Edit":
        path = params.get("path", "unknown")
        logger.info(f"[OPENCLAW] ✏️  编辑文件：{path}")
        return f"✅ 已编辑 {path}"
    
    elif tool_name == "Glob":
        pattern = params.get("pattern", "*")
        logger.info(f"[OPENCLAW] 🔍 搜索文件：{pattern}")
        return ["chapter_1.md", "chapter_2.md"]
    
    elif tool_name == "Bash":
        cmd = params.get("command", "")
        logger.info(f"[OPENCLAW] 💻 执行命令：{cmd[:50]}...")
        return "命令执行完成"
    
    return "工具执行完成"


# ========== 模拟 LLM 推理（生成小说内容） ==========
class MockLLM:
    """模拟 LLM 生成小说内容"""
    
    def __init__(self):
        self.chapter_count = 0
    
    async def generate_tool_call(self, conversation_history):
        """模拟 LLM 推理并返回工具调用"""
        self.chapter_count += 1
        
        if self.chapter_count <= 3:
            # 写小说章节
            return {
                "role": "assistant",
                "content": [{
                    "type": "tool_use",
                    "id": f"call_{self.chapter_count}",
                    "name": "Write",
                    "input": {
                        "path": f"novel/chapter_{self.chapter_count}.md",
                        "content": f"# 第{self.chapter_count}章\n\n这是小说内容..."
                    }
                }]
            }
        else:
            # 完成小说
            return {
                "role": "assistant",
                "content": "小说已完成！共 3 章。"
            }


# ========== 简化版 TianLi Harness 引擎 ==========
class SimpleHarnessEngine:
    """简化版 TianLi Harness 引擎 - 用于演示日志流程"""
    
    def __init__(self, llm, executor):
        self.llm = llm
        self.executor = executor
        self.traces = []
        self.messages = []
        
        # 配置
        self.forbidden_words = ["delete", "drop", "rm -rf"]
        self.repetition_threshold = 3
        self.drift_threshold = 0.4
    
    def check_l1(self, tool_name, params):
        """L1 粗过滤"""
        logger.debug(f"[TIANJIE-L1] 检查：{tool_name}")
        
        # 空参数检查
        if not params:
            logger.warning(f"[TIANJIE-L1] 🚫 拒绝：空参数")
            return False
        
        # 禁止词检查
        content = str(params).lower()
        for word in self.forbidden_words:
            if word in content:
                logger.warning(f"[TIANJIE-L1] 🚫 拒绝：包含禁止词 '{word}'")
                return False
        
        # 重复检测
        recent = [t["tool_name"] for t in self.traces[-self.repetition_threshold:]]
        if len(recent) >= self.repetition_threshold and all(t == tool_name for t in recent):
            logger.warning(f"[TIANJIE-L1] 🚫 拒绝：重复调用 {tool_name}")
            return False
        
        logger.info(f"[TIANJIE-L1] ✅ 通过")
        return True
    
    async def check_l2(self, tool_name, params):
        """L2 深度检查（采样）"""
        import random
        if random.random() > 0.3:  # 30% 采样率
            logger.debug(f"[TIANJIE-L2] ⊘ 跳过采样")
            return True
        
        logger.info(f"[TIANJIE-L2] 🔍 深度检查：{tool_name}")
        # 模拟 LLM 评分
        score = 0.85  # 假设得分
        if score < self.drift_threshold:
            logger.warning(f"[TIANJIE-L2] 🚫 拒绝：得分 {score:.2f} < 阈值 {self.drift_threshold:.2f}")
            return False
        
        logger.info(f"[TIANJIE-L2] ✅ 通过 (得分：{score:.2f})")
        return True
    
    async def run(self, user_input):
        """运行完整流程"""
        logger.info("="*70)
        logger.info("🚀 TianLi Harness 启动")
        logger.info(f"📝 任务：{user_input}")
        logger.info("="*70)
        
        # Step 1: Fetch DNA (获取 Hero Prompt)
        logger.info("[STEP-1] 🧬 Fetch DNA - 获取 Hero Prompt")
        hero_prompt = """你是专业小说作家。
擅长创作扣人心弦的故事，塑造立体人物。
写作风格细腻，情节紧凑。"""
        logger.info(f"[STEP-1] ✅ 获取成功 ({len(hero_prompt)} 字符)")
        self.messages.append({"role": "system", "content": hero_prompt})
        
        # Step 2: Agent Reasoning + 执行循环
        step = 0
        while True:
            step += 1
            logger.info("-"*50)
            logger.info(f"[STEP-2] 🧠 Agent Reasoning - 第{step}轮推理")
            
            # 模拟 LLM 推理
            response = await self.llm.generate_tool_call(self.messages)
            logger.info(f"[STEP-2] 生成响应：{response['content'][:50] if isinstance(response['content'], str) else 'tool_call'}")
            
            # 检查是否完成
            if isinstance(response['content'], str) and not response['content'].startswith("tool"):
                logger.info("[STEP-2] ✅ 小说完成，退出循环")
                break
            
            # 提取工具调用
            if isinstance(response['content'], list):
                for block in response['content']:
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        tool_name = block["name"]
                        params = block["input"]
                        
                        # Step 3: TianJie Audit
                        logger.info("[STEP-3] 🔴 TianJie 天劫审查")
                        
                        # L1 检查
                        if not self.check_l1(tool_name, params):
                            logger.warning("[STEP-3] 🚫 L1 拒绝，触发天演优化")
                            break
                        
                        # L2 检查（采样）
                        if not await self.check_l2(tool_name, params):
                            logger.warning("[STEP-3] 🚫 L2 拒绝，触发天演优化")
                            break
                        
                        # Step 4: Execute Tool
                        logger.info("[STEP-4] ⚡ Execute Tool - 执行工具")
                        result = await self.executor(tool_name, params)
                        logger.info(f"[STEP-4] ✅ 执行完成：{result}")
                        
                        # 记录 trace
                        self.traces.append({
                            "step": step,
                            "tool_name": tool_name,
                            "result": result
                        })
                        self.messages.append(response)
        
        # 完成
        logger.info("="*70)
        logger.info("🎉 TianLi Harness 任务完成")
        logger.info(f"📊 总步数：{len(self.traces)}")
        logger.info(f"📊 最终状态：小说写作完成")
        logger.info("="*70)
        
        return {
            "status": "completed",
            "traces": self.traces,
            "messages": self.messages
        }


# ========== 主函数 ==========
async def main():
    print("\n" + "🌟"*35)
    print("🌟  TianLi Harness 小说写作演示  🌟")
    print("🌟"*35 + "\n")
    
    # 创建引擎
    llm = MockLLM()
    engine = SimpleHarnessEngine(llm, mock_openclaw_executor)
    
    # 运行任务
    result = await engine.run("写一篇关于 AI 觉醒的科幻小说，共 3 章")
    
    print("\n" + "📊"*35)
    print("📊  执行摘要")
    print("📊"*35)
    print(f"✅ 状态：{result['status']}")
    print(f"📝 章节数：{len(result['traces'])}")
    print(f"💬 消息数：{len(result['messages'])}")
    
    print("\n📋 执行流程:")
    for trace in result['traces']:
        print(f"  Step {trace['step']}: {trace['tool_name']} → {trace['result']}")
    
    print("\n" + "🎉"*35)
    print("🎉  演示完成!")
    print("🎉"*35 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
