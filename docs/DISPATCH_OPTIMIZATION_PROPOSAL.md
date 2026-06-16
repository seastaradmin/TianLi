# 分发逻辑优化建议

**日期:** 2026-03-24  
**当前实现:** `core/dispatcher.py`

---

## 📊 当前实现分析

### ✅ 优点

1. **规则匹配快速可靠**
   - Tags 匹配：O(n) 复杂度
   - 工具匹配：预定义映射
   - 可预测、易调试

2. **LLM 排序提供智能**
   - 处理模糊任务
   - 理解语义
   - 动态调整

3. **Fallback 机制保证可用性**
   - 永远不会失败
   - 至少有默认 Hero

4. **可解释性强**
   - 知道为什么选这个 Hero
   - 分数透明
   - 易于调试

---

## ⚠️ 问题和优化空间

### 问题 1: 静态权重配置

**现状:**
```python
# 权重是硬编码的
strength += len(task_terms & profile_terms) * 1.25  # 固定 1.25
strength += capability.weight * 1.5  # 固定 1.5
```

**问题:**
- ❌ 无法根据实际效果调整
- ❌ 不同场景可能需要不同权重
- ❌ 需要手动调优

**优化方案:**
```python
# 动态权重学习
class AdaptiveDispatcher:
    def __init__(self):
        self.weights = {
            "tag_match": 1.25,
            "capability_match": 1.5,
            "tool_match": 1.0,
        }
        self.load_from_history()
    
    def update_weights(self, success_feedback):
        # 根据成功/失败反馈调整权重
        if success_feedback["matched_by_tags"]:
            self.weights["tag_match"] *= 1.05
        if success_feedback["matched_by_capability"]:
            self.weights["capability_match"] *= 1.05
```

**预期效果:**
- ✅ 越用越准
- ✅ 自动适应不同场景
- ✅ 减少手动调优

---

### 问题 2: 缺少用户反馈循环

**现状:**
```python
# 分发后没有收集反馈
task, decision, heroes = await dispatcher.dispatch(content)
result = await engine.run(task_id, content)
# 结束，没有记录这次分发是否成功
```

**问题:**
- ❌ 不知道分发的 Hero 是否合适
- ❌ 无法从历史中学习
- ❌ 同样的错误可能重复

**优化方案:**
```python
# 添加反馈收集
class DispatcherWithFeedback:
    async def dispatch(self, content):
        task, decision, heroes = await super().dispatch(content)
        
        # 记录分发决策
        self.log_dispatch(task, decision, heroes)
        
        return task, decision, heroes
    
    def collect_feedback(self, task_id, success, user_rating=None):
        # 收集成功/失败反馈
        feedback = {
            "task_id": task_id,
            "success": success,
            "user_rating": user_rating,
            "dispatch_decision": self.get_decision(task_id),
        }
        self.feedback_log.append(feedback)
        
        # 定期更新权重
        if len(self.feedback_log) >= 100:
            self.update_weights()
```

**预期效果:**
- ✅ 知道哪些分发是成功的
- ✅ 从历史中学习
- ✅ 持续改进

---

### 问题 3: 语义匹配不够强

**现状:**
```python
def _matches_keyword(self, keyword, content, token_set):
    # 简单的字符串匹配
    if keyword in content:
        return True
    # 或者 token 匹配
    return keyword in token_set
```

**问题:**
- ❌ "PPT" 和 "presentation" 不匹配
- ❌ "bug" 和 "问题" 不匹配
- ❌ 缺少同义词支持

**优化方案:**
```python
# 使用词向量/嵌入
class SemanticMatcher:
    def __init__(self):
        # 加载预训练的词向量
        self.model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
        
        # 或者使用简单的同义词映射
        self.synonyms = {
            "ppt": ["presentation", "幻灯片", "演示文稿"],
            "bug": ["问题", "错误", "缺陷", "issue"],
            "feature": ["功能", "特性", "需求"],
        }
    
    def matches(self, keyword, content):
        # 方案 1: 同义词匹配
        if keyword in self.synonyms:
            for synonym in self.synonyms[keyword]:
                if synonym in content:
                    return True
        
        # 方案 2: 词向量相似度
        keyword_embedding = self.model.encode(keyword)
        content_embedding = self.model.encode(content)
        similarity = cosine_similarity(keyword_embedding, content_embedding)
        return similarity > 0.7
```

**预期效果:**
- ✅ "PPT" 匹配 "presentation"
- ✅ "bug" 匹配 "问题"
- ✅ 更强的语义理解

---

### 问题 4: 缺少多轮对话上下文

**现状:**
```python
# 每次分发都是独立的
async def dispatch(self, content):
    # 不考虑之前的对话历史
    task = self.normalize_task(content)
```

**问题:**
- ❌ 用户说"继续"，不知道继续什么
- ❌ 用户说"修改一下"，不知道修改什么
- ❌ 缺少上下文理解

**优化方案:**
```python
class ContextAwareDispatcher:
    def __init__(self):
        self.conversation_history = []
    
    async def dispatch(self, content, session_id):
        # 添加上下文
        context = self.get_context(session_id)
        
        # 如果是"继续"、"修改"等
        if self.is_continuation(content):
            # 使用上次的 Hero
            last_hero = self.get_last_hero(session_id)
            return last_hero
        
        # 如果是新任务
        task = self.normalize_task(content, context)
        heroes = await self.match(task)
        
        # 记录上下文
        self.save_context(session_id, task, heroes)
        
        return heroes
    
    def is_continuation(self, content):
        continuation_keywords = ["继续", "接着", "然后", "修改", "优化"]
        return any(kw in content for kw in continuation_keywords)
```

**预期效果:**
- ✅ 理解"继续"的含义
- ✅ 保持对话连贯性
- ✅ 更好的用户体验

---

### 问题 5: 缺少 A/B 测试框架

**现状:**
```python
# 只有一种分发策略
heroes = await self.dispatch(content)
```

**问题:**
- ❌ 不知道当前策略是否最优
- ❌ 无法对比不同策略
- ❌ 难以量化改进效果

**优化方案:**
```python
class ABTestDispatcher:
    def __init__(self):
        self.strategies = {
            "rules_only": RulesOnlyStrategy(),
            "hybrid": HybridStrategy(),
            "llm_only": LLMOnlyStrategy(),
        }
        self.traffic_split = {
            "rules_only": 0.2,
            "hybrid": 0.6,
            "llm_only": 0.2,
        }
    
    async def dispatch(self, content):
        # 根据流量分配选择策略
        strategy = self.select_strategy()
        
        # 记录 A/B 测试
        self.log_ab_test(content, strategy)
        
        # 执行分发
        heroes = await strategy.dispatch(content)
        
        return heroes
    
    def collect_feedback(self, task_id, success):
        # 记录不同策略的成功率
        self.ab_test_log[task_id]["success"] = success
        
        # 定期分析
        if len(self.ab_test_log) >= 1000:
            self.analyze_results()
```

**预期效果:**
- ✅ 量化不同策略的效果
- ✅ 数据驱动优化
- ✅ 持续改进

---

### 问题 6: 缺少 Hero 负载均衡

**现状:**
```python
# 总是选择分数最高的 Hero
selected = ranked[:max_fanout]
```

**问题:**
- ❌ 热门 Hero 可能过载
- ❌ 冷门 Hero 利用率低
- ❌ 影响整体性能

**优化方案:**
```python
class LoadBalancedDispatcher:
    def __init__(self):
        self.hero_load = {}  # 当前负载
        self.hero_capacity = {}  # 容量
    
    async def dispatch(self, content):
        candidates = await self.match(content)
        
        # 考虑负载
        for hero, score in candidates:
            load_factor = self.get_load_factor(hero)
            score *= load_factor  # 负载高的降分
        
        # 重新排序
        candidates.sort(key=lambda x: x[1], reverse=True)
        selected = candidates[:max_fanout]
        
        # 更新负载
        for hero in selected:
            self.hero_load[hero] += 1
        
        return selected
    
    def get_load_factor(self, hero):
        load = self.hero_load.get(hero, 0)
        capacity = self.hero_capacity.get(hero, 10)
        
        if load >= capacity:
            return 0.1  # 严重降分
        elif load >= capacity * 0.8:
            return 0.5  # 中度降分
        else:
            return 1.0  # 不影响
```

**预期效果:**
- ✅ 平衡 Hero 负载
- ✅ 提高整体性能
- ✅ 避免单点过载

---

## 🎯 优先级建议

### P0 - 立即实施

1. **添加反馈收集**
   - 改动小
   - 效果明显
   - 为后续优化打基础

2. **增强语义匹配**
   - 添加同义词映射
   - 改动小
   - 立即改善匹配质量

### P1 - 短期实施

3. **动态权重学习**
   - 需要反馈数据
   - 中等改动
   - 持续提升匹配质量

4. **多轮对话上下文**
   - 需要上下文管理
   - 中等改动
   - 改善用户体验

### P2 - 长期实施

5. **A/B 测试框架**
   - 需要大量数据
   - 大改动
   - 数据驱动优化

6. **负载均衡**
   - 需要监控系统
   - 大改动
   - 提高整体性能

---

## 📊 预期效果对比

| 优化 | 匹配准确率 | 用户满意度 | 实施难度 |
|------|------------|------------|----------|
| **反馈收集** | +5% | +10% | ⭐ |
| **语义匹配** | +15% | +15% | ⭐⭐ |
| **动态权重** | +10% | +10% | ⭐⭐⭐ |
| **对话上下文** | +5% | +20% | ⭐⭐ |
| **A/B 测试** | +10% | +5% | ⭐⭐⭐⭐ |
| **负载均衡** | 0% | +10% | ⭐⭐⭐⭐ |

---

## 🔧 实施建议

### 第一步：反馈收集（1-2 天）

```python
# 添加简单的反馈接口
def collect_feedback(task_id, success, rating=None):
    with open("feedback.jsonl", "a") as f:
        f.write(json.dumps({
            "task_id": task_id,
            "success": success,
            "rating": rating,
            "timestamp": datetime.now().isoformat()
        }) + "\n")
```

### 第二步：语义匹配（2-3 天）

```python
# 添加同义词映射
SYNONYMS = {
    "ppt": ["presentation", "幻灯片", "演示文稿"],
    "bug": ["问题", "错误", "缺陷", "issue"],
    # ...
}

def matches_with_synonyms(keyword, content):
    if keyword in content:
        return True
    for synonym in SYNONYMS.get(keyword, []):
        if synonym in content:
            return True
    return False
```

### 第三步：动态权重（3-5 天）

```python
# 基于反馈调整权重
def update_weights_from_feedback():
    feedback = load_feedback()
    
    # 分析哪些匹配方式更成功
    tag_success = count_success_by_type(feedback, "tag_match")
    capability_success = count_success_by_type(feedback, "capability_match")
    
    # 调整权重
    weights["tag_match"] *= (1 + tag_success_rate)
    weights["capability_match"] *= (1 + capability_success_rate)
```

---

## 📝 总结

**当前实现已经很好，但有明确优化空间:**

### 立即可做（P0）
- ✅ 反馈收集
- ✅ 语义匹配（同义词）

### 短期可做（P1）
- ✅ 动态权重学习
- ✅ 对话上下文

### 长期规划（P2）
- ✅ A/B 测试框架
- ✅ 负载均衡

**预期总体提升:**
- 匹配准确率：+30-40%
- 用户满意度：+50-60%
- 系统性能：+20-30%

---

**GitHub:** https://github.com/seastaradmin/TianLi/blob/main/docs/DISPATCH_OPTIMIZATION_PROPOSAL.md
