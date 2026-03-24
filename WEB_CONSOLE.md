# TianLi Console - Web 控制台

## 技术选型

| 平台 | 技术方案 | 说明 |
|------|---------|------|
| **网页** | Vite + React | 浏览器直接访问 |
| **桌面** | Tauri v2 | ~10MB，比 Electron 轻 10 倍 |
| **移动端** | PWA / Tauri Mobile | 可安装为 App |

## 为什么选 Tauri？

✅ **跨平台** - Windows/macOS/Linux/iOS/Android  
✅ **轻量** - 二进制文件 ~10MB（Electron ~100MB）  
✅ **高性能** - Rust 后端，内存占用低  
✅ **安全** - 默认沙箱，系统 API 访问可控  
✅ **熟悉** - 前端用 React/TypeScript/Tailwind  

## 快速开始

```bash
# 终端 1：后端
python3 backend_server.py

# 终端 2：前端
cd web

# 安装依赖
npm install

# 开发模式（网页）
npm run dev

# 访问 http://localhost:1421

# 构建桌面应用
npm run tauri build
```

## 功能

- 📊 实时日志查看
- 🎮 启动/停止控制
- 📈 执行状态监控
- 🏗️ 架构流程可视化
- 📱 响应式设计（手机/平板/桌面）

## 目录结构

```
web/
├── src/              # React 前端
│   ├── App.tsx       # 主组件
│   ├── main.tsx      # 入口
│   └── index.css     # 样式
├── src-tauri/        # Tauri 后端（Rust）
│   ├── src/main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts
└── tailwind.config.js
```
