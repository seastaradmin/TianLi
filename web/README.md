# TianLi Console Web

天理 Harness 跨平台控制台 - 网页 / 桌面 / 移动端

## 🚀 快速开始

### 安装依赖

```bash
cd web
npm install
```

### 开发模式

```bash
# 仅启动前端（使用模拟数据）
npm run dev

# 启动 SSE 测试服务器 + 前端（实时日志推送）
npm run dev:all

# 或手动启动测试服务器（另开终端）
npm run server
```

访问 http://localhost:1420 查看控制台

## 📦 技术栈

- **前端框架**: React 18 + TypeScript + Vite
- **样式**: TailwindCSS
- **状态管理**: Zustand
- **实时通信**: SSE (Server-Sent Events) / WebSocket
- **桌面打包**: Tauri v2 (Rust)
- **测试**: Vitest + React Testing Library

## 🏗️ 架构

详见 [ARCHITECTURE.md](./ARCHITECTURE.md)

### 目录结构

```
web/
├── src/
│   ├── components/       # 可复用 UI 组件
│   │   ├── Header.tsx
│   │   ├── StatsBar.tsx
│   │   ├── ControlPanel.tsx
│   │   ├── LogViewer.tsx
│   │   ├── LogLine.tsx
│   │   ├── FlowDiagram.tsx
│   │   └── StatusCard.tsx
│   ├── stores/           # Zustand 状态管理
│   │   ├── logStore.ts   # 日志状态
│   │   └── statsStore.ts # 统计数据
│   ├── hooks/            # 自定义 Hooks
│   │   ├── useSSE.ts     # SSE 连接
│   │   └── useWebSocket.ts
│   ├── types/            # TypeScript 类型
│   │   └── index.ts
│   ├── utils/            # 工具函数
│   │   └── time.ts
│   ├── test/             # 测试文件
│   │   ├── setup.ts
│   │   ├── stores.test.ts
│   │   └── components.test.tsx
│   ├── App.tsx           # 主应用
│   ├── main.tsx          # 入口
│   └── index.css         # 全局样式
├── server.js             # SSE 测试服务器
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── ARCHITECTURE.md       # 架构文档
```

## 🎮 功能特性

- ✅ 实时日志流查看（SSE 推送）
- ✅ 执行状态监控（空闲/运行中/完成/错误）
- ✅ 天劫审查统计（L1 通过/L2 检查/早期退出）
- ✅ 自动滚动日志（可开关）
- ✅ 日志导出功能
- ✅ 响应式设计（手机/平板/桌面）
- ✅ 暗色主题
- ✅ 架构流程可视化

## 🧪 测试

```bash
# 运行测试（监视模式）
npm run test

# 运行一次测试
npm run test:run

# 生成覆盖率报告
npm run test:coverage
```

## 📱 构建桌面应用

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

## 🔌 集成真实后端

### SSE 接口

后端需要实现以下 SSE 端点：

```
GET /api/logs

Events:
- event: log
  data: {"id":1,"time":"10:00:00","level":"INFO","module":"TEST","msg":"message"}

- event: stats
  data: {"status":"running","totalSteps":5,"earlyExits":0,"l1Passes":3,"l2Checks":1}

- event: status
  data: "running" | "idle" | "completed" | "error"
```

### 配置连接地址

创建 `.env` 文件：

```bash
# .env
VITE_SSE_URL=http://your-backend-server:3456/api/logs
```

### WebSocket 备选

如需双向通信，可使用 WebSocket：

```typescript
import { useWebSocket } from './hooks/useWebSocket'

const { sendCommand, isConnected } = useWebSocket('ws://localhost:3456/ws', {
  onLog: handleLog,
  onStats: handleStats
})

// 发送命令
sendCommand('START')
sendCommand('STOP')
```

## 📊 状态管理

### LogStore

```typescript
import { useLogStore } from './stores'

const logs = useLogStore(state => state.logs)
const addLog = useLogStore(state => state.addLog)
const clearLogs = useLogStore(state => state.clearLogs)
```

### StatsStore

```typescript
import { useStatsStore } from './stores'

const stats = useStatsStore(state => state)
const incrementStep = useStatsStore(state => state.incrementStep)
```

## 🎨 组件使用

```typescript
import { Header, StatsBar, LogViewer, FlowDiagram } from './components'

function App() {
  return (
    <div>
      <Header title="My Console" />
      <StatsBar stats={stats} />
      <LogViewer status={status} />
      <FlowDiagram />
    </div>
  )
}
```

## 📝 开发指南

### 添加新组件

1. 在 `src/components/` 创建 `.tsx` 文件
2. 导出组件
3. 在 `components/index.ts` 中添加导出

### 添加新状态

1. 在 `src/stores/` 创建 store
2. 使用 `create` 从 zustand 创建状态
3. 在 `stores/index.ts` 中导出

### 调试 SSE

```bash
# 使用 curl 测试 SSE 连接
curl -N http://localhost:3456/api/logs

# 或使用浏览器 DevTools → Network → EventSource
```

## 📄 许可证

MIT
