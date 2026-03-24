# PPTX Skill 调研报告

**日期:** 2026-03-24  
**目的:** 了解如何正确调用 OpenClaw 的 pptx skill

---

## 📊 调研结果

### pptx skill 的工作方式

**不是通过 CLI 调用，而是通过脚本！**

**核心脚本:**
```
~/.agents/skills/pptx/scripts/
├── add_slide.py      # 添加幻灯片
├── clean.py          # 清理文件
├── thumbnail.py      # 生成缩略图
└── office/
    ├── unpack.py     # 解包 PPTX
    ├── pack.py       # 打包 PPTX
    └── soffic e.py   # LibreOffice 转换
```

---

## 🎯 PPT 生成流程

### 方式 1: 使用 PptxGenJS（推荐）

**依赖:**
```bash
npm install -g pptxgenjs
```

**JavaScript 代码:**
```javascript
const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'TianLi Harness';
pres.title = 'TianLi Harness - 产品宣讲';

// 添加幻灯片
let slide = pres.addSlide();
slide.addText("TianLi Harness", {
  x: 0.5, y: 0.5, fontSize: 36, bold: true
});

// 保存
pres.writeFile({ fileName: "Presentation.pptx" });
```

### 方式 2: 使用 python-pptx（当前实现）

**依赖:**
```bash
pip install python-pptx
```

**Python 代码:**
```python
from pptx import Presentation

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = "TianLi Harness"
prs.save("presentation.pptx")
```

### 方式 3: 使用 XML 编辑（复杂）

**流程:**
```bash
# 1. 解包 PPTX
python scripts/office/unpack.py template.pptx unpacked/

# 2. 添加幻灯片
python scripts/add_slide.py unpacked/ slideLayout2.xml

# 3. 编辑 XML
# 手动编辑 slide{N}.xml 文件

# 4. 清理
python scripts/clean.py unpacked/

# 5. 打包
python scripts/office/pack.py unpacked/ output.pptx
```

---

## 🔍 关键发现

### 1. pptx skill 不是 CLI 工具

**错误理解:**
```bash
# ❌ 这样调用是不对的
openclaw skill run pptx --action create --title "TianLi"
```

**正确理解:**
- pptx skill 是一组脚本和文档
- 需要手动调用这些脚本
- 或者使用 PptxGenJS/python-pptx

### 2. 推荐使用 PptxGenJS

**原因:**
- ✅ 更强大的功能
- ✅ 更好的设计支持
- ✅ 支持复杂布局
- ✅ 官方推荐

### 3. python-pptx 也可以

**优点:**
- ✅ 简单易用
- ✅ Python 原生
- ✅ 无需 Node.js

**缺点:**
- ❌ 功能相对较少
- ❌ 设计选项有限

---

## 🎯 实现方案

### 方案 1: 集成 PptxGenJS（推荐）

**创建 Node.js 脚本:**
```javascript
// tianli_ppt_generator.js
const pptxgen = require("pptxgenjs");

async function createPresentation(title, slides, outputPath) {
  let pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'TianLi Harness';
  pres.title = title;

  // 添加标题页
  let slide = pres.addSlide();
  slide.addText(title, { x: 0.5, y: 0.5, fontSize: 36, bold: true });

  // 添加内容页
  for (let slideData of slides) {
    let slide = pres.addSlide();
    slide.addText(slideData.title, { x: 0.5, y: 0.3, fontSize: 24, bold: true });
    slide.addText(slideData.content, { x: 0.5, y: 1.0, fontSize: 14 });
  }

  await pres.writeFile({ fileName: outputPath });
  return { success: true, output: outputPath };
}

// CLI 调用
if (require.main === module) {
  const args = process.argv.slice(2);
  // 解析参数并调用 createPresentation
}

module.exports = { createPresentation };
```

**在 Python 中调用:**
```python
import subprocess
import json

async def create_ppt_with_pptxgenjs(title: str, slides: list, output: str):
    result = subprocess.run([
        "node", "tianli_ppt_generator.js",
        "--title", title,
        "--output", output,
        "--slides", json.dumps(slides)
    ], capture_output=True, text=True)
    
    return json.loads(result.stdout)
```

### 方案 2: 保持当前 python-pptx 实现

**优点:**
- ✅ 已经工作
- ✅ 简单可靠
- ✅ 无需额外依赖

**缺点:**
- ❌ 没有利用 pptx skill 的高级功能
- ❌ 设计选项有限

### 方案 3: 混合方案

```python
async def create_pptx(self, title: str, slides: list, output_path: str):
    # 尝试 1: 使用 PptxGenJS（如果有）
    if self.has_pptxgenjs():
        return await self.create_with_pptxgenjs(title, slides, output_path)
    
    # Fallback: 使用 python-pptx
    return await self.create_with_python_pptx(title, slides, output_path)
```

---

## 📊 对比总结

| 方式 | 复杂度 | 功能 | 设计 | 推荐度 |
|------|--------|------|------|--------|
| **PptxGenJS** | 中 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **python-pptx** | 低 | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **XML 编辑** | 高 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

---

## 🎯 建议

### 短期（保持现状）

- ✅ 继续使用 python-pptx
- ✅ 简单可靠，已经工作
- ✅ 专注于天理核心功能

### 长期（可选优化）

- ⏳ 集成 PptxGenJS
- ⏳ 提供更强大的设计选项
- ⏳ 支持模板和主题

---

## 📁 相关文件

| 文件 | 位置 |
|------|------|
| pptx skill | `~/.agents/skills/pptx/` |
| SKILL.md | `~/.agents/skills/pptx/SKILL.md` |
| pptxgenjs.md | `~/.agents/skills/pptx/pptxgenjs.md` |
| scripts | `~/.agents/skills/pptx/scripts/` |

---

## 🎊 结论

**当前实现（python-pptx）是合理的！**

**原因:**
1. ✅ 简单可靠
2. ✅ 已经工作
3. ✅ 无需复杂集成
4. ✅ 满足基本需求

**pptx skill 的真正用途:**
- 提供文档和最佳实践
- 提供脚本工具（unpack/pack/thumbnail）
- 不是直接调用的 CLI 工具

**下一步:**
- 保持当前实现
- 如果需要更强大功能，再集成 PptxGenJS

---

**GitHub:** https://github.com/seastaradmin/TianLi/blob/main/docs/PPTX_SKILL_RESEARCH.md
