# PPT 生成状态说明

**日期:** 2026-03-24  
**状态:** ⚠️ **部分完成**

---

## ✅ 已完成的工作

### 1. HarnessEngine 执行成功

```
✅ 任务执行完成
状态：completed
耗时：1.34 秒
参与 Hero: ppt-creator-hero
LLM: Doubao-Seed-2.0-Code
```

### 2. LLM 生成了内容

**输出目录:** `generated_ppts/notes/`

**LLM 回复:**
```markdown
# 生成天理产品宣讲 PPT

## 背景
本轮目标是把任务从抽象意图转成可执行交付...

## 关键发现
1. 当前系统更擅长给出流程和审计信息
2. 交付摘要混入了过多 skill 噪音
3. 应优先提供结果预览...

## 建议动作
1. 将最终交付物单独建模为 artifact
2. 将流程拆成可读的步骤时间线
3. 将 skill 贡献改为附加证据
```

---

## ❌ 未完成的工作

### 问题：.pptx 文件没有生成

**原因:** pptx skill 没有被实际调用

**现状:**
- ✅ ppt-creator-hero 已添加
- ✅ pptx skill 已安装 (44K 安装)
- ✅ HarnessEngine 执行成功
- ✅ LLM 生成了内容
- ❌ **pptx skill 未被调用**
- ❌ **.pptx 文件未生成**

---

## 🔍 根本原因

**HarnessEngine 的 executor 是 LocalExecutor:**
```python
executor = LocalExecutor(output_dir)
# 只支持：Read, Write, Edit, Glob, Grep, Bash
# 不支持：pptx skill
```

**pptx skill 需要:**
- python-pptx 库的直接调用
- 或者通过 skills 框架调用
- 当前 HarnessEngine 没有集成 skills 调用机制

---

## 🎯 下一步

### 方案 1: 直接在 Hero 中调用 python-pptx

修改 ppt-creator-hero 的 system_prompt，让它直接使用 python-pptx:

```python
# 在 Hero 中添加代码执行能力
import pptx

# 创建 PPT
prs = pptx.Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = "TianLi Harness"
# ...
prs.save("output.pptx")
```

### 方案 2: 集成 skills 框架到 HarnessEngine

让 HarnessEngine 支持 skill 调用：
```python
# 添加 skill 调用机制
from skills import SkillManager

skill_manager = SkillManager()
await skill_manager.execute("pptx", params)
```

### 方案 3: 使用 npx skills 命令行

在 HarnessEngine 中调用命令行：
```python
await executor.execute("Bash", {
    "command": "npx skills run pptx --input 'TianLi PPT' --output output.pptx"
})
```

---

## 📊 当前状态总结

| 组件 | 状态 | 说明 |
|------|------|------|
| **ppt-creator-hero** | ✅ 已添加 | Hero 定义完成 |
| **pptx skill** | ✅ 已安装 | 44K 安装 |
| **DoubaoClient** | ✅ 工作正常 | LLM 调用成功 |
| **HarnessEngine** | ✅ 执行成功 | 任务完成 |
| **LLM 内容生成** | ✅ 成功 | 生成了 PPT 大纲 |
| **pptx skill 调用** | ❌ 未实现 | 需要集成 |
| **.pptx 文件生成** | ❌ 未实现 | 需要实现 |

---

## 🎯 结论

**天理系统可以:**
- ✅ 接收 PPT 生成任务
- ✅ 路由到 ppt-creator-hero
- ✅ 调用 LLM 生成内容
- ✅ 执行天劫审计

**但目前还不能:**
- ❌ 调用 pptx skill
- ❌ 生成 .pptx 文件

**需要:**
- 集成 pptx skill 调用机制
- 或者直接在代码中使用 python-pptx

---

**GitHub Issue:** 需要实现 pptx skill 调用机制  
**PR:** https://github.com/seastaradmin/TianLi/pull/1
