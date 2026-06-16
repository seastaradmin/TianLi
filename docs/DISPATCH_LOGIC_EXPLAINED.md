# 天理项目分发逻辑详解

**日期:** 2026-03-24  
**文件:** `core/dispatcher.py`

---

## 🎯 核心问题

**如何保证用户的问题可以抵达最合适的 Hero？**

**答案:** 三层匹配机制

```
用户问题
    ↓
[1] 规则匹配 (Rule-based)
    ↓
[2] LLM 排序 (LLM Ranking)
    ↓
[3] Fallback 机制
    ↓
最合适的 Hero
```

---

## 📊 完整分发流程

### 步骤 1: 任务标准化

```python
def normalize_task(self, content: str) -> TaskEnvelope:
    # 1. 清理文本
    cleaned = " ".join(content.strip().split())
    
    # 2. 提取关键词 (tags)
    tags = self._extract_tags(content)
    # 示例："生成 PPT" → ["生成", "ppt"]
    
    # 3. 创建任务信封
    return TaskEnvelope(
        task_id="task-xxx",
        content=cleaned,
        tags=tags,
        max_fanout=2,  # 最多 2 个 Hero 并行
        dispatch_mode="hybrid",  # 规则 + LLM
    )
```

**示例:**
```
用户输入："生成天理产品宣讲 PPT"
    ↓
TaskEnvelope:
  - content: "生成天理产品宣讲 PPT"
  - tags: ["生成", "天理", "产品", "宣讲", "ppt"]
  - max_fanout: 2
```

---

### 步骤 2: 规则匹配 (核心)

```python
def _rule_candidates(self, task, profiles):
    # 1. 获取所有启用的 Heroes
    enabled_profiles = [p for p in profiles if p.enabled]
    
    # 2. 检查用户是否指定了 Hero
    if task.pinned_hero_ids:
        return pinned_matches  # 直接用指定的
    
    # 3. 为每个 Hero 打分
    scored = [
        (profile, self._score(task, profile))
        for profile in enabled_profiles
        if self._match_strength(task, profile) > 0
    ]
    
    # 4. 按分数排序
    scored.sort(key=lambda x: x[1], reverse=True)
    
    return scored
```

---

### 步骤 3: 评分机制 (关键)

```python
def _score(self, task, profile) -> float:
    # 基础分：routing_priority (0.0-1.0)
    score = profile.routing_priority
    
    # 加分项 1: 匹配强度
    score += self._match_strength(task, profile)
    
    # 加分项 2: 默认 Hero
    if profile in default_hero_ids:
        score += 0.25
    
    return score
```

**示例分数:**
```
ppt-creator-hero:
  - routing_priority: 0.9
  - match_strength: 3.5 (tags 匹配 + 工具匹配)
  - 默认 Hero: +0.25
  = 总分：4.65

engineering-hero:
  - routing_priority: 0.8
  - match_strength: 1.2
  = 总分：2.0
```

---

### 步骤 4: 匹配强度计算

```python
def _match_strength(self, task, profile) -> float:
    strength = 0.0
    
    # 1. Tags 匹配 (权重 1.25)
    task_terms = set(task.tags)  # ["生成", "ppt"]
    profile_terms = set(profile.tags + profile.task_types)
    strength += len(task_terms & profile_terms) * 1.25
    # 匹配 2 个 → +2.5
    
    # 2. Capabilities 匹配 (权重 1.5)
    for capability in profile.capabilities:
        if matches(capability.name, task.content):
            strength += capability.weight * 1.5
    # ppt-creation 匹配 → +2.5 * 1.5 = +3.75
    
    # 3. 工具匹配 (权重 1.0)
    for tool, keywords in TOOL_KEYWORDS.items():
        if tool in profile.tools:
            if any(matches(kw, task.content) for kw in keywords):
                strength += 1.0
    # "生成" 匹配 Write → +1.0
    
    return strength
```

**TOOL_KEYWORDS 映射:**
```python
TOOL_KEYWORDS = {
    "Read": ("read", "查看", "inspect", "analyze", "读取"),
    "Write": ("write", "create", "generate", "写", "draft", "实现"),
    "Edit": ("edit", "modify", "update", "改", "调整"),
    "Grep": ("find", "search", "grep", "搜", "查找"),
    "Glob": ("files", "file", "目录", "glob", "list"),
    "Bash": ("run", "shell", "bash", "command", "命令"),
}
```

---

### 步骤 5: LLM 排序 (可选)

```python
async def _rank_candidates(self, task, candidates):
    # 只在 hybrid/llm 模式下使用
    if dispatch_mode not in ["hybrid", "llm"]:
        return candidates
    
    # 调用 LLM 重新排序
    prompt = f"""
    Task: {task.content}
    Tags: {task.tags}
    Candidates: {candidates}
    
    Return JSON array of hero_ids sorted best to worst.
    """
    
    response = await llm.messages.create(prompt)
    ranked_ids = json.loads(response)
    
    # 给排名靠前的 Hero 加分
    for i, hero_id in enumerate(ranked_ids):
        boost = 1.0 - i * 0.1  # 第 1 名 +1.0, 第 2 名 +0.9...
        candidates[hero_id].score += boost
    
    return candidates
```

**作用:**
- 规则匹配是基础
- LLM 提供更智能的排序
- 处理复杂/模糊的任务

---

### 步骤 6: Fallback 机制

```python
def _rule_candidates(self, task, profiles):
    scored = [...]  # 规则匹配结果
    
    # 如果没有匹配的 Hero
    if not scored:
        # 使用默认 Hero
        defaults = [p for p in profiles if p in default_hero_ids]
        if defaults:
            fallback_used = True
            scored = [(p, p.routing_priority + 0.5) for p in defaults]
        else:
            # 最后手段：用 routing_priority 最高的
            fallback_used = True
            scored = [(p, p.routing_priority) for p in profiles]
    
    return scored
```

**保证:**
- ✅ 永远不会没有 Hero
- ✅ 至少有默认 Hero 兜底
- ✅ 保证任务可以执行

---

## 🎯 实际案例

### 案例 1: "生成产品宣讲 PPT"

**任务分析:**
```
content: "生成产品宣讲 PPT"
tags: ["生成", "产品", "宣讲", "ppt"]
```

**匹配过程:**
```
1. ppt-creator-hero:
   - tags 匹配："ppt" → +1.25
   - task_types 匹配："presentation" → +1.25
   - capabilities 匹配："ppt-creation" → +3.75
   - tools 匹配："Write" (生成) → +1.0
   - routing_priority: 0.9
   = 总分：8.15 ✅ 第一名

2. ui-ux-hero:
   - tags 匹配："产品" → +1.25
   - capabilities 匹配："design" → +2.0
   - routing_priority: 0.7
   = 总分：3.95

3. engineering-hero:
   - tags 匹配：无
   - routing_priority: 0.8
   = 总分：0.8
```

**结果:** 选择 `ppt-creator-hero`

---

### 案例 2: "修复登录 bug"

**任务分析:**
```
content: "修复登录 bug"
tags: ["修复", "登录", "bug"]
```

**匹配过程:**
```
1. qa-hero:
   - tags 匹配："bug" → +1.25
   - task_types 匹配："testing" → +1.25
   - capabilities 匹配："testing" → +3.0
   - routing_priority: 0.6
   = 总分：6.1 ✅

2. backend-hero:
   - tags 匹配："登录" → +1.25
   - tools 匹配："Edit" (修复) → +1.0
   - routing_priority: 0.7
   = 总分：2.95
```

**结果:** 选择 `qa-hero` (先诊断问题)

---

### 案例 3: "做个网站落地页"

**任务分析:**
```
content: "做个网站落地页"
tags: ["做", "网站", "落地页"]
```

**匹配过程:**
```
1. ui-ux-hero:
   - tags 匹配："网站" → +1.25
   - task_types 匹配："landing page" → +1.25
   - capabilities 匹配："ui-design" → +3.75
   - tools 匹配："Write" (做) → +1.0
   - routing_priority: 0.9
   = 总分：8.15 ✅

2. frontend-hero:
   - tags 匹配："网站" → +1.25
   - capabilities 匹配："react" → +3.0
   - routing_priority: 0.7
   = 总分：5.95
```

**结果:** 选择 `ui-ux-hero` (设计优先)

---

## 🔧 配置说明

### 在 config.yaml 中

```yaml
dispatch:
  mode: "hybrid"  # 规则 + LLM
  max_fanout: 2   # 最多 2 个 Hero 并行
  router_model: "doubao-seed-2.0-code"  # LLM 排序用
  default_hero_ids:
    - "engineering-hero"
    - "pm-hero"
```

### Hero 配置

```python
"ppt-creator-hero": {
    "routing_priority": 0.9,  # 基础优先级
    "tags": ["ppt", "presentation"],
    "task_types": ["create ppt", "presentation"],
    "tools": ["Read", "Write", "Bash"],
    "capabilities": [
        {"name": "ppt-creation", "weight": 2.5},
        {"name": "slide-design", "weight": 2.0},
    ],
    "max_parallel_tasks": 2,  # 最多并行处理 2 个任务
}
```

---

## 📊 分发策略对比

| 策略 | 优点 | 缺点 | 使用场景 |
|------|------|------|----------|
| **规则匹配** | 快速、可预测 | 不够灵活 | 简单明确的任务 |
| **LLM 排序** | 智能、灵活 | 慢、成本高 | 复杂/模糊的任务 |
| **混合模式** | 平衡性能和智能 | 配置复杂 | 默认推荐 |
| **手动指定** | 完全控制 | 需要用户知识 | 高级用户 |

---

## 🎯 质量保证

### 1. 匹配度阈值

```python
# 只有匹配度 > 0 的 Hero 才会被考虑
if self._match_strength(task, profile) > 0:
    scored.append(...)
```

### 2. 多 Hero 协作

```python
max_fanout = 2  # 可以选择多个 Hero
selected = ranked[:max_fanout]

# 示例：
# 1. ui-ux-hero (设计)
# 2. frontend-hero (实现)
```

### 3. 可解释性

```python
def _reason_for_selection(self, task, profile, score):
    if profile in pinned_hero_ids:
        return "用户指定"
    if fallback_used:
        return "默认 Hero"
    matched = task.tags & profile.tags
    return f"匹配 tags: {matched}, 分数：{score}"
```

---

## 🔍 调试技巧

### 查看分发日志

```python
# 在 HarnessEngine 中
result = await engine.run(task_id, user_input)
print(f"选中的 Hero: {result['selected_heroes']}")
print(f"分数：{result['hero_scores']}")
print(f"选择原因：{result['reasoning']}")
```

### 测试分发

```python
from tianli_harness.core.dispatcher import TaskDispatcher
from tianli_harness.core.registry import HeroRegistry

registry = HeroRegistry(config)
dispatcher = TaskDispatcher(config, registry)

task, decision, heroes = await dispatcher.dispatch(
    "生成产品宣讲 PPT"
)

print(f"选中：{decision.selected_hero_ids}")
print(f"分数：{decision.candidate_scores}")
```

---

## 📝 总结

**天理项目的分发逻辑:**

1. **规则匹配为基础** - 快速、可靠
2. **LLM 排序为增强** - 智能、灵活
3. **Fallback 机制兜底** - 永不失败
4. **可解释性** - 知道为什么选这个 Hero

**保证用户问题抵达最合适 Hero 的关键:**
- ✅ Tags 匹配 (关键词)
- ✅ Capabilities 匹配 (能力)
- ✅ Tools 匹配 (工具)
- ✅ Routing Priority (优先级)
- ✅ LLM 智能排序 (可选)
- ✅ Fallback 机制 (保证有 Hero)

---

**GitHub:** https://github.com/seastaradmin/TianLi/blob/main/docs/DISPATCH_LOGIC_EXPLAINED.md
