# TianLi Harness 设计文档

**项目:** TianLi Harness - 天劫天演 Agent 治理沙箱
**日期:** 2026-03-20
**设计人:** Claude (via Superpowers brainstorming)
**架构方案:** 方案 B - 轻量集成，复用 OpenClaw 会话

---

## 1. 概述

TianLi Harness 是一个基于 LangGraph 的 Agent 治理沙箱，为 OpenClaw 提供：

- **动态 DNA 加载**：从 GitHub 动态拉取 System Prompt（"Hero DNA"）
- **分层宪法天劫**：提前熔断偏离任务的工具调用
- **天演自动优化**：熔断后自动生成 Prompt 修正建议，支持自动提交 GitHub

核心目标：让 AI 编码更可控，减少语义漂移，自动迭代优化 System Prompt。

---

## 2. 架构定位

**TianLi Harness 作为 OpenClaw 进程内的 skill/harness 模块集成：**

- ✅ 复用 OpenClaw 已有：会话管理、LLM 客户端、多会话能力
- ✅ 新增：天劫拦截、天演优化、DNA 动态加载
- ✅ 无冗余，性能高效
- ✅ 符合龙虾"开源多会话"设计哲学

---

## 3. 目录结构

```
tianli_harness/
├── core/
│   ├── state.py          # 状态定义（已完成）
│   ├── graph.py          # LangGraph 控制流编排
│   ├── interceptor.py    # 天劫流式监测器（分层宪法）
│   └── optimizer.py      # 天演优化器（生成 Patch）
├── dna/
│   └── fetcher.py       # GitHub DNA 拉取器
├── skills/
│   ├── base.py          # Superpower 抽象基类（已完成）
│   └── claw_proxy.py    # OpenClaw 强类型工具封装（已完成基础骨架）
├── tests/
│   └── test_harness.py  # 单元测试
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-03-20-tianli-harness-design.md # 本文档
```

---

## 4. 数据模型

### 4.1 配置模型

```python
class HarnessConfig(BaseModel):
    hero_id: str           # GitHub 上的英雄 MD 文件名
    superpowers: List[str] # 需挂载的技能集，含 OpenClaw
    drift_threshold: float # 语义偏移阈值，超过触发天劫 (default 0.4)
    repo_owner: str        # GitHub 仓库拥有者 (default "agency-agency")
    repo_name: str         # GitHub 仓库名 (default "agency-agents")
    github_token: Optional[str] # GitHub API Token，用于自动提交
```

### 4.2 追踪模型

```python
class ActionTrace(BaseModel):
    step: int             # 步骤序号
    tool_name: str        # 工具名称
    observation: str     # 执行结果
    is_valid: bool        # 是否通过天劫检查 (default True)
    audit_score: Optional[float] # L2 语义对齐分数
```

### 4.3 状态定义

```python
class TianLiState(TypedDict):
    config: HarnessConfig
    messages: Annotated[list, operator.add]
    traces: Annotated[List[ActionTrace], operator.add]
    current_status: str  # "running", "early_exit", "completed"
    evolution_patch: str # 存放需要提交到 GitHub 的 Prompt 修正建议
```

---

## 5. 分层宪法 - 天劫拦截

### 5.1 L1 粗筛（同步，低成本）

**检查项：**

1. **重复检测**：连续 N 次调用同一个工具且参数相似 → 熔断
2. **禁忌词检测**：输出包含配置的禁忌词 → 熔断
3. **格式校验**：Tool Call JSON 格式不合法 → 熔断
4. **空调用检测**：空参数或无意义调用 → 熔断

**特点：** 不涉及深层语义，误判率极低，速度快。

### 5.2 L2 抽样深检（异步，LLM 调用）

**触发时机：**
- 每次工具调用前（可配置抽样频率，默认每次都检）
- 或每累计 500 token 抽样一次

**检查逻辑：**
```
给定原始任务目标：{{target}}
当前对话历史：{{history}}
模型即将调用工具：{{tool_call}}

请给当前即将执行的动作打分：
- 1.0 分：完全对齐目标，动作合理
- 0.0 分：完全偏离目标，动作毫无意义

只返回一个 0.0 到 1.0 之间的浮点数分数，不要解释。
```

**判决：** `score < drift_threshold` → 触发熔断 (`early_exit`)

**设计原则：** 监察模型只决定"偏不偏"，不决定"好不好"。大方向没偏，细节交给英雄发挥。

---

## 6. LangGraph 控制流

### 6.1 节点定义

| 节点 | 职责 |
|------|------|
| `fetch_dna` | 根据 config 从 GitHub 拉取 Hero Prompt，作为 System Message 加入 state |
| `reason` | 调用 LLM（复用 OpenClaw），绑定工具，必须开启流式输出 |
| `audit` | 天劫拦截检查（L1 → L2），设置状态 |
| `claw_exec` | 工具调用通过检查，转发给 OpenClaw 执行，结果追加到 trace |
| `optimizer` | 熔断触发，进入天演优化，生成 evolution_patch，可选自动提交 |

### 6.2 路由逻辑

```python
workflow.set_entry_point("fetch_dna")
workflow.add_edge("fetch_dna", "reason")

# 原因后：是否需要调用工具
workflow.add_conditional_edges(
    "reason",
    route_after_reason,
    {
        "to_audit": "audit",     # 需要调用工具 → 进入天劫检查
        "to_end": END           # 不需要调用 → 完成
    }
)

# 检查后：通过/熔断
workflow.add_conditional_edges(
    "audit",
    route_after_audit,
    {
        "execute": "claw_exec",      # 通过 → 执行工具
        "trigger_early_exit": "optimizer" # 偏离 → 熔断进入天演
    }
)

workflow.add_edge("claw_exec", "reason")       # 执行完回到推理
workflow.add_edge("optimizer", END)            # 优化完结束，等待重启
```

### 6.3 持久化

开启 LangGraph Checkpoint：
```python
memory = SqliteSaver.from_conn_string(":memory:")
# 或持久化到文件：./tianli_harness/checkpoints.sqlite
app = workflow.compile(checkpointer=memory)
```

支持从 checkpoint 恢复会话。

---

## 7. 天演优化流程

### 7.1 触发条件

`current_status == "early_exit"` → 进入 optimizer。

### 7.2 优化 prompt

```
你是 TianLi Harness 天演优化器。

原始 System Prompt 来自 GitHub:
---
{{original_prompt}}
---

执行历史中，以下步骤触发了天劫熔断：
---
{{failed_traces}}
---

请总结失败原因，给出一份对原始 System Prompt 的修改建议 Patch。
Patch 应当：
1. 指出哪些地方需要修改
2. 给出修改后的具体内容
3. 解释为什么这样修改能防止未来再次触发同样的天劫

请用 markdown 格式输出。
```

### 7.3 输出与提交

- **默认**：只将 Patch 存入 `state["evolution_patch"]`，返回给调用者
- **配置了 `github_token`**：自动创建 commit 到原 GitHub 仓库
  - 分支：`tianli/evolution-{timestamp}`
  - commit message：`tianli: auto-evolution - fix early exit on [hero_id]`
  - 可选创建 PR

---

## 8. DNA 动态加载

### 8.1 获取逻辑

1. 构造 URL：`https://raw.githubusercontent.com/{owner}/{repo}/main/{hero_id}.md`
2. HTTP GET 获取内容
3. 缓存结果（可选 TTL）
4. 作为 System Prompt 加入 state messages

### 8.2 错误处理

- 404：返回错误，提示检查 hero_id 和仓库配置
- 网络错误：重试 → 失败后返回错误给调用者

---

## 9. OpenClaw 集成

### 9.1 工具强类型封装

所有 OpenClaw 工具参数使用 Pydantic v2 定义：

- `ReadFileParams` - 读取文件
- `GlobSearchParams` - 全局搜索
- `GrepSearchParams` - 内容搜索
- `BashExecuteParams` - 执行命令
- `EditFileParams` - 编辑文件
- `WriteFileParams` - 写入文件

`OpenClawSkillManager` 统一管理：
- `get_tools()` → 获取所有工具
- `get_openai_functions()` → 转换为 OpenAI function format
- `execute_tool()` → 转发执行到 OpenClaw

### 9.2 进程内调用 vs HTTP

当前设计：进程内直接调用（方案 B），复用 OpenClaw 已有 LLM 客户端和会话管理，避免冗余。

---

## 10. 依赖

```
langgraph>=0.1.0
langchain>=0.1.0
pydantic>=2.0.0
GitPython>=3.1.0
PyGithub>=2.1.0
requests>=2.31.0
python-dotenv>=1.0.0
pytest>=7.4.0
pytest-cov>=4.1.0
```

---

## 11. 验收标准

1. ✅ 能从 GitHub 动态拉取 Hero Prompt
2. ✅ L1 粗筛能正确检测重复/格式错误并熔断
3. ✅ L2 深检能正确计算语义对齐分数并在漂移时熔断
4. ✅ 熔断后能生成正确的 Prompt 修改 Patch
5. ✅ 配置 token 后能自动提交 Patch 到 GitHub
6. ✅ LangGraph checkpoint 能正确保存恢复会话
7. ✅ 所有 OpenClaw 工具都有 Pydantic 强类型定义
8. ✅ 复用 OpenClaw 会话，无冗余性能浪费

---

## 12. 下一步

设计评审通过后，由 `writing-plans` 生成详细实现计划，逐个模块开发。
