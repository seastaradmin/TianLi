# 天理 Harness - 星空界面

## 星空页面

### 推荐使用

**🌟 可见星空页面** - `http://localhost:1421/visible.html`

使用纯 DOM 元素渲染，确保所有设备都能看到星星效果。

**特性：**
- 300 颗闪烁星星（带发光效果）
- 多种颜色（白/蓝/粉/黄）
- 底部输入框
- 右侧产物抽屉（输入任务后按回车，2 秒后弹出）
- 产物展示：文件名、类型、大小、提供者信息、下载按钮

### 其他页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 控制台首页 | `/` | 原有管理界面 |
| 仪表盘 | `/dashboard` | 数据图表 |
| 交付结果 | `/deliverables` | 产物列表 |
| 实时日志 | `/live-logs` | SSE 日志流 |
| 对话历史 | `/conversation-history` | 任务对话 |
| 技能管理 | `/skill-manager` | Hero 技能 |
| Sub-agents | `/sub-agents` | 子代理可视化 |
| 实验星图 | `/galaxy` | 星座图（原实现） |

### 技术实现

**可见星空页面** (`visible.html`):
- 纯 DOM + CSS 动画
- 无需 WebGL
- 兼容所有浏览器
- 截图友好

**Three.js 版本** (`simple.html`, `pure.html` 等):
- React Three Fiber
- 10000+ 颗星星
- 真实恒星光谱颜色
- 需要 WebGL 支持

## 部署

### 开发环境

```bash
cd web
npm run dev
```

访问：http://localhost:1421/visible.html

### 生产环境

```bash
cd web
npm run build
```

构建产物在 `dist/` 目录。

## 产物抽屉功能

1. 打开星空页面
2. 在底部输入框输入任意任务
3. 按回车键
4. 2 秒后右侧弹出产物抽屉
5. 查看产物详情和下载

## 文件结构

```
web/
├── visible.html          # 推荐星空页面
├── simple.html           # Three.js 简化版
├── pure.html             # Three.js 纯净版
├── nasa.html             # NASA 主题版
├── starry.html           # 早期版本
├── src/
│   ├── components/
│   │   ├── starry/       # Three.js 星空组件
│   │   └── console/      # 控制台组件
│   ├── pages/
│   │   ├── SimpleStarrySky.tsx
│   │   ├── NasaStarrySky.tsx
│   │   └── ...
│   └── data/
│       └── hipparcos-stars.ts  # Hipparcos 星表数据
└── package.json
```

## 更新日志

### 2026-03-25
- ✅ 添加可见星空页面（DOM 渲染）
- ✅ 产物抽屉功能
- ✅ 真实恒星光谱数据
- ✅ Three.js 多版本实现
