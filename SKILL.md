---
name: tianli-harness
description: 天理 Harness - Agent 治理沙箱，提供天劫（早期退出）和天演（自动进化）功能，基于 LangGraph 的分层宪法审计系统
license: Apache-2.0
metadata:
  author: seastaradmin
  version: "0.1.0"
  repository: https://github.com/seastaradmin/TianLi
---

# TianLi Harness (天理 Harness)

**天劫天演 Agent 治理沙箱 for OpenClaw**

A layered constitutional Agent governance sandbox with early exit (天劫) and automatic evolution (天演) for OpenClaw, based on LangGraph.

## 🎯 什么时候使用这个 Skill

当用户需要：

- **审计 Agent 行为** - 检查 tool call 是否符合预设规则
- **防止 Agent 失控** - 实现早期退出机制（天劫）
- **自动优化 Prompt** - 根据失败案例自动进化（天演）
- **分层宪法检查** - L1 快速规则过滤 + L2 深度语义检查
- **集成 OpenClaw** - 在现有 session 管理上增加治理层

## 📦 安装

### 方式 1: 从 GitHub 安装（推荐）

```bash
cd ~/.jvs/.openclaw/workspace/
git clone https://github.com/seastaradmin/TianLi.git
cd TianLi
export PYTHONPATH=$(pwd)
```

### 方式 2: 使用 Skill（OpenClaw 用户）

SKILL.md 已在项目根目录，OpenClaw 会自动识别。

### 方式 3: pip 安装（未来发布后）

```bash
pip install tianli-harness
```

## 🏗️ 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                      User Input                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Fetch DNA (Hero Prompt from GitHub)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Agent Reasoning (LLM generates tool call)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. TianJie Interceptor (天劫 - Constitutional Audit)        │
│     ┌──────────────────────────────────────────────────┐    │
│     │ L1: Coarse Filtering (no LLM cost)                │    │
│     │   - Repetition detection                          │    │
│     │   - Forbidden words                               │    │
│     │   - Empty parameters                              │    │
│     └──────────────────────────────────────────────────┘    │
│     ┌──────────────────────────────────────────────────┐    │
│     │ L2: Deep Semantic Check (sampled, LLM call)       │    │
│     │   - Alignment scoring (0.0-1.0)                   │    │
│     │   - Drift detection                               │    │
│     └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │               │
            ┌───────▼───────┐ ┌─────▼────────┐
            │  PASS         │ │  FAIL        │
            │  Continue     │ │  Early Exit  │
            └───────┬───────┘ └─────┬────────┘
                    │               │
                    ▼               ▼
┌───────────────────────────┐ ┌────────────────────────────┐
│  4. Execute Tool (OpenClaw)│ │  5. TianYan Optimizer     │
│                           │ │     (天演 - Evolution)      │
│                           │ │     - Generate patch        │
│                           │ │     - Auto-commit to GitHub │
└───────────────────────────┘ └────────────────────────────┘
```

## 🚀 快速开始

### 基本使用

```python
import asyncio
import anthropic
from tianli_harness import HarnessConfig, HarnessEngine

async def openclaw_executor(tool_name: str, params: dict):
    """你的 OpenClaw tool 执行器"""
    # 调用 OpenClaw sessions_send 或其他工具
    pass

async def main():
    client = anthropic.AsyncAnthropic()
    config = HarnessConfig(
        hero_id="my-hero",  # GitHub: agency-agency/agency-agents/my-hero.md
        l2_sample_rate=0.3,  # 30% 的请求进行 L2 深度检查
    )
    
    engine = HarnessEngine(config, client, openclaw_executor)
    
    # 处理用户输入
    result = await engine.process("帮我检查一下这个工具调用")
    print(result)

asyncio.run(main())
```

### 配置选项

```python
from tianli_harness import HarnessConfig

config = HarnessConfig(
    # 必需
    hero_id="my-hero",
    
    # 可选
    l2_sample_rate=0.3,      # L2 检查采样率 (0.0-1.0)
    alignment_threshold=0.7,  # 对齐阈值
    max_retries=3,           # 最大重试次数
    github_token="ghp_xxx",  # 用于自动提交进化补丁
)
```

## 📁 项目结构

```
tianli_harness/
├── tianli_harness/          # Python 包
│   ├── core/
│   │   ├── state.py         # 状态管理
│   │   ├── graph.py         # LangGraph 工作流
│   │   └── engine.py        # 主引擎
│   ├── dna/
│   │   └── fetcher.py       # Hero Prompt 获取
│   ├── skills/
│   │   └── ...              # 技能定义
│   └── tests/
│       └── ...              # 测试
├── web/                     # Web 控制台
├── novel/                   # 小说输出示例
├── docs/                    # 文档
├── backend_server.py        # Python 后端
└── demo_*.py                # 演示脚本
```

## 🔧 核心功能

### 1. 天劫 (TianJie) - 早期退出

```python
from tianli_harness.core import TianJieInterceptor

interceptor = TianJieInterceptor(config)

# L1 快速检查
l1_result = await interceptor.l1_check(action_trace)
if not l1_result.passed:
    print(f"❌ L1 失败：{l1_result.reason}")

# L2 深度检查（采样）
if should_sample():
    l2_result = await interceptor.l2_check(action_trace)
    if l2_result.alignment_score < config.alignment_threshold:
        print(f"❌ L2 失败：对齐度 {l2_result.alignment_score}")
```

### 2. 天演 (TianYan) - 自动进化

```python
from tianli_harness.dna import TianYanOptimizer

optimizer = TianYanOptimizer(config, github_client)

# 生成进化补丁
patch = await optimizer.generate_patch(failed_trace)

# 自动提交到 GitHub
await optimizer.commit_patch(patch, "feat: 优化 Hero Prompt")
```

### 3. DNA 获取

```python
from tianli_harness.dna import DNAFetcher

fetcher = DNAFetcher(github_token)

# 从 GitHub 获取 Hero Prompt
hero_prompt = await fetcher.fetch("agency-agency/agency-agents/my-hero.md")
```

## 🧪 测试

```bash
cd ~/.jvs/.openclaw/workspace/TianLi
python3 -m pytest tianli_harness/tests/ -v
```

### 运行演示

```bash
# 完整流程演示
python demo_tianjie.py

# 小说写作演示
python demo_novel_writing.py
```

## 🌐 Web 控制台

启动 Web 控制台查看实时日志和统计：

```bash
cd ~/.jvs/.openclaw/workspace/TianLi/web
npm install
npm run dev
```

然后访问 `http://localhost:1420`

## 📊 使用场景

### 场景 1: 防止 Agent 重复调用工具

```python
# 天劫 L1 会检测到重复的工具调用
# 自动阻止并提示 Agent 更换策略
```

### 场景 2: 确保 Agent 遵守特定规则

```python
# 在 Hero Prompt 中定义规则
# 天劫 L2 会进行语义对齐检查
```

### 场景 3: 自动优化 Prompt

```python
# 当检查失败时
# 天演自动生成改进建议并提交补丁
```

## 🔗 相关资源

- **GitHub**: https://github.com/seastaradmin/TianLi
- **架构文档**: `docs/ARCHITECTURE.md`
- **快速开始**: `QUICKSTART.md`
- **Web 控制台**: `WEB_CONSOLE.md`

## ⚠️ 注意事项

1. **需要 Anthropic API** - 用于 L2 深度检查
2. **GitHub Token** - 用于自动提交进化补丁（可选）
3. **Python 3.10+** - 需要较新的 Python 版本
4. **LangGraph** - 核心依赖

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

```bash
git clone https://github.com/seastaradmin/TianLi.git
cd TianLi
pip install -r requirements.txt
```

---

**天理 Harness** - 让你的 Agent 更可控、更智能、更安全 🦐
