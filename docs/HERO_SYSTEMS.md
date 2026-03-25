# TianLi Hero 系统说明

**更新日期:** 2026-03-24  
**Hero 总数:** 173+ 个

---

## 📊 三个 Hero 来源

TianLi 项目有**三个独立的 Hero 系统**：

### 1. 预定义 Heroes (19 个)
**位置:** `core/heroes.py`  
**加载方式:** 直接导入  
**特点:** 硬编码在代码中，开箱即用

**列表:**
- engineering-hero, pm-hero, qa-hero, db-hero, infra-hero
- frontend-hero, backend-hero, mobile-hero, data-hero, security-hero
- devops-hero, brainstorm-hero, ui-ux-hero, trend-researcher-hero
- **新增 (5 个):** skill-finder-hero, diagram-architect-hero, system-architect-hero, qa-engineer-hero, e2e-tester-hero

**使用场景:** 快速开始，不需要网络

---

### 2. 本地 Registry Heroes (4 个)
**位置:** `tianli_harness/data/heroes.json`  
**加载方式:** HeroRegistry 从 JSON 加载  
**特点:** 基础架构 heroes

**列表:**
- architect/navigator (命枢) - 系统架构规划
- builder/forge (锻星) - 实现和集成
- auditor/sentinel (天衡) - 审计和安全
- scribe/lumen (灵文) - 文档和记录

**使用场景:** 基础系统任务

---

### 3. 远程缓存 Heroes (150 个)
**位置:** `tianli_harness/data/heroes.remote-cache.json`  
**加载方式:** HeroRegistry 从 ClawHub 缓存  
**特点:** 来自 ClawHub 的社区 skills

**示例:**
- skill/vercel-labs/skills/find-skills
- skill/vercel-labs/agent-skills/vercel-react-best-practices
- skill/anthropics/skills/frontend-design
- skill/microsoft/github-copilot-for-azure/azure-ai
- ... (150 个)

**使用场景:** 专业领域任务

---

## 🔄 三个系统的关系

```
┌─────────────────────────────────────────────────┐
│              TaskDispatcher                      │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │ 1. 预定义 Heroes (19 个)                 │     │
│  │    - 直接从 core/heroes.py 导入          │     │
│  │    - 快速、可靠、开箱即用               │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │ 2. Registry Heroes (154 个)              │     │
│  │    - 从 HeroRegistry 加载                 │     │
│  │    - 4 个本地 + 150 个远程缓存            │     │
│  │    - 专业领域覆盖                       │     │
│  └────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

---

## 🎯 如何使用

### 使用预定义 Heroes

```python
from tianli_harness import HarnessEngine, load_config

config = load_config("config.yaml")
config.hero_id = "ui-ux-hero"  # 使用预定义 hero

engine = HarnessEngine(config, client, executor)
result = await engine.run("task-001", "做个网站落地页")
```

### 使用 Registry Heroes

```python
from tianli_harness.core.registry import HeroRegistry
from tianli_harness.core.dispatcher import TaskDispatcher

registry = HeroRegistry(config)
profiles = await registry.list_profiles(refresh_remote=False)

# 选择 hero
profile = next(p for p in profiles if p.hero_id == "architect/navigator")

dispatcher = TaskDispatcher(config, registry)
task, decision, heroes = await dispatcher.dispatch("做个系统设计")
```

---

## 📈 Hero 数量对比

| 来源 | 数量 | 优点 | 缺点 |
|------|------|------|------|
| **预定义** | 19 | 快速、可靠、开箱即用 | 数量有限 |
| **本地 Registry** | 4 | 基础架构完整 | 数量少 |
| **远程缓存** | 150 | 专业领域覆盖广 | 需要网络获取 |
| **总计** | **173** | 全面覆盖 | 需要选择合适的系统 |

---

## 🔧 集成建议

### 当前状态
- ✅ 预定义 Heroes 完全独立工作
- ✅ Registry Heroes 通过 Dispatcher 工作
- ⚠️ 两个系统**没有合并**

### 建议改进
1. **统一 Hero 加载接口**
   ```python
   from tianli_harness.core.heroes import get_all_heroes
   
   # 返回所有 173 个 heroes
   all_heroes = get_all_heroes()
   ```

2. **智能路由**
   ```python
   # 根据任务自动选择 hero 来源
   if task_type == "quick":
       use_predefined_hero()
   elif task_type == "specialized":
       use_registry_hero()
   ```

3. **缓存更新机制**
   ```bash
   # 定期更新远程 heroes
   npx skills check
   npx skills update
   ```

---

## 🎯 推荐使用策略

### 快速任务 → 预定义 Heroes
- 19 个预定义 heroes 覆盖常见场景
- 无需网络，响应快
- 质量有保证

### 专业任务 → Registry Heroes
- 150 个社区 heroes 覆盖专业领域
- 来自 ClawHub，经过验证
- 定期更新

### 架构任务 → 本地 Registry
- 4 个基础 heroes 处理系统架构
- 与 TianLi 深度集成
- 稳定可靠

---

## 📝 总结

**没有丢失！** 150 个 heroes 在 `tianli_harness/data/heroes.remote-cache.json` 中安全保存。

**三个系统并存:**
1. **19 个预定义 heroes** - 快速开始
2. **4 个本地 registry heroes** - 基础架构
3. **150 个远程缓存 heroes** - 专业覆盖

**总计：173 个 heroes 可用！**

---

**文档:** docs/HERO_SYSTEMS.md  
**GitHub:** https://github.com/seastaradmin/TianLi/blob/main/docs/HERO_SYSTEMS.md
