# TianLi Harness - 快速开始

## 项目结构

```
tianli_harness/
├── tianli_harness/       # 核心代码
│   ├── core/             # LangGraph 工作流
│   ├── dna/              # Hero Prompt 获取
│   ├── skills/           # OpenClaw 集成
│   └── tests/            # 单元测试
├── web/                  # Web 控制台
├── novel/                # 演示输出
├── demo_*.py             # 演示脚本
└── test_*.py             # 测试脚本
```

## 快速体验

### 1. 运行演示

```bash
# 天劫审查演示
python3 demo_tianjie.py

# 小说写作演示（模拟）
python3 demo_novel_writing.py

# 小说写作演示（真实写文件）
python3 demo_novel_real.py
```

### 2. 运行测试

```bash
# 单元测试
python3 -m pytest tianli_harness/tests/ -v

# 完整架构测试
python3 test_full_workflow.py
```

### 3. 启动 Web 控制台

```bash
cd web
npm install
npm run dev
# 访问 http://localhost:1420
```

## 核心概念

### 天劫 (TianJie) - 审查系统

**L1 粗过滤**（无 LLM 成本）:
- 重复检测
- 禁止词检测
- 空参数检测

**L2 深度检查**（采样，LLM 调用）:
- 目标对齐评分 (0.0-1.0)
- 语义漂移检测

### 天演 (TianYan) - 优化系统

触发早期退出时:
1. 生成改进 Patch
2. 自动提交 GitHub
3. 创建对比 URL

### 工作流

```
User Input → Fetch DNA → Agent Reason → TianJie Audit → Execute Tool
                                              ↓
                                      Early Exit? → TianYan
```

## 配置

编辑 `HarnessConfig`:

```python
config = HarnessConfig(
    hero_id="my-hero",          # Hero Prompt 文件名
    superpowers=["Read", "Write"],
    drift_threshold=0.4,        # L2 阈值
    l2_sample_ratio=0.3,        # L2 采样率 30%
    repetition_threshold=3,     # 重复检测阈值
    forbidden_words=["delete"]  # 禁止词
)
```

## 集成 OpenClaw

```python
from tianli_harness import HarnessEngine

async def openclaw_executor(tool_name: str, params: dict):
    # 你的 OpenClaw 工具执行逻辑
    return result

engine = HarnessEngine(config, anthropic_client, openclaw_executor)
result = await engine.run(thread_id="session-001", user_input="帮我写代码")
```

## 了解更多

- [README.md](README.md) - 完整文档
- [WEB_CONSOLE.md](WEB_CONSOLE.md) - Web 控制台说明
- [docs/](docs/) - 详细文档
