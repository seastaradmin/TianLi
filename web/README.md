# TianLi Console Web

天理 Harness 跨平台控制台 - 网页 / 桌面 / 移动端

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **样式**: TailwindCSS
- **桌面**: Tauri v2 (Rust)
- **状态管理**: Zustand (可选)

## 开发

```bash
# 安装依赖
npm install

# 开发模式 (http://localhost:1420)
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 构建桌面应用

```bash
# 安装 Tauri CLI
npm install -g @tauri-apps/cli

# 构建桌面应用
npm run tauri build

# 输出位置:
# - macOS: src-tauri/target/release/bundle/dmg/
# - Windows: src-tauri/target/release/bundle/msi/
# - Linux: src-tauri/target/release/bundle/deb/
```

## 构建移动端

```bash
# 添加 Android 支持
npm run tauri android add

# 添加 iOS 支持
npm run tauri ios add

# 构建 Android APK
npm run tauri android build

# 构建 iOS IPA
npm run tauri ios build
```

## 功能特性

- ✅ 实时日志流查看
- ✅ 执行状态监控（空闲/运行中/完成/错误）
- ✅ 天劫审查统计（L1 通过/L2 检查/早期退出）
- ✅ 自动滚动日志
- ✅ 响应式设计（手机/平板/桌面）
- ✅ 暗色主题

## 截图

运行 `npm run dev` 后访问 http://localhost:1420 查看

## 目录结构

```
web/
├── src/                    # 前端源码
│   ├── App.tsx             # 主组件
│   ├── main.tsx            # 入口
│   └── index.css           # 全局样式
├── src-tauri/              # Tauri 后端
│   ├── src/main.rs         # Rust 入口
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 许可证

MIT
