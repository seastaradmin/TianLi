# TianLi Harness Web 控制台 - 架构设计文档

**版本:** 1.0  
**日期:** 2026-03-20  
**作者:** Superposer (架构规划)

---

## 1. 概述

TianLi Harness Web 控制台是一个跨平台的实时监控界面，用于可视化和控制 TianLi Harness 天劫天演 Agent 治理沙箱的执行流程。

### 1.1 核心功能

- 📊 **实时日志推送** - WebSocket 流式传输执行日志
- 🎮 **执行控制** - 启动/停止/重启 Harness 工作流
- 📈 **状态监控** - L1/L2 审查通过率、天劫触发统计
- 🏗️ **流程可视化** - LangGraph 节点执行状态
- 🔧 **配置管理** - Hero DNA、审查阈值、GitHub 集成

### 1.2 支持平台

| 平台 | 技术方案 | 优先级 |
|------|---------|--------|
| **桌面应用** | Tauri v2 (Windows/macOS/Linux) | P0 |
| **网页版** | Vite + React (浏览器) | P0 |
| **移动端** | PWA / Tauri Mobile (iOS/Android) | P1 |

---

## 2. 通信架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Layer (前端)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React UI  │  │  Tauri API  │  │   WebSocket Client      │  │
│  │  Components │  │   (Rust)    │  │   (日志推送/控制命令)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Bridge Layer (通信桥接)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              TianLi Bridge Server (Python/HTTP)             ││
│  │  - WebSocket 服务器 (日志推送)                               ││
│  │  - REST API (控制命令/状态查询)                              ││
│  │  - 事件总线 (内部通信)                                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 进程内调用 / IPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Core Layer (TianLi Harness)                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ LangGraph   │  │  TianJie    │  │      TianYan            │  │
│  │  Workflow   │  │ Interceptor │  │    Optimizer            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 通信模式选择

| 通信类型 | 协议 | 方向 | 用途 |
|---------|------|------|------|
| **实时日志** | WebSocket | Server → Client | 流式推送执行日志、状态更新 |
| **控制命令** | WebSocket / HTTP | Client → Server | 启动/停止/配置修改 |
| **状态查询** | HTTP (REST) | Client → Server | 获取当前状态、历史记录 |
| **文件操作** | HTTP (REST) | Client → Server | 上传/下载 DNA、Patch 文件 |
| **桌面原生** | Tauri IPC | Client → Rust | 系统通知、文件对话框、托盘 |

### 2.3 为什么选择 WebSocket 为主通信协议？

✅ **实时性** - 日志推送延迟 < 100ms，优于 HTTP 轮询  
✅ **双向通信** - 单个连接支持双向数据流  
✅ **低开销** - 建立连接后，数据包头部开销小  
✅ **断线重连** - 原生支持连接状态管理  
✅ **Tauri 友好** - `@tauri-apps/plugin-websocket` 原生支持

---

## 3. API 接口规范

### 3.1 WebSocket API

#### 3.1.1 连接建立

```typescript
// 连接 URL
ws://localhost:8765/harness

// 连接后发送握手消息
{
  "type": "handshake",
  "version": "1.0",
  "clientId": "uuid-v4"
}

// 服务器响应
{
  "type": "handshake_ack",
  "serverVersion": "1.0.0",
  "sessionId": "session-uuid"
}
```

#### 3.1.2 消息类型定义

```typescript
// TypeScript 类型定义
type WSMessage =
  | LogMessage
  | StatusMessage
  | ControlCommand
  | ControlResponse
  | ErrorMessage;

interface LogMessage {
  type: "log";
  payload: {
    timestamp: string;      // ISO 8601
    level: "DEBUG" | "INFO" | "WARN" | "ERROR";
    module: string;         // "FETCH_DNA" | "TIANJIE_L1" | "TIANJIE_L2" | "EXECUTE" | "OPTIMIZER"
    message: string;
    data?: Record<string, any>;
  };
}

interface StatusMessage {
  type: "status";
  payload: {
    harnessStatus: "idle" | "running" | "completed" | "early_exit" | "error";
    currentStep: number;
    totalSteps: number;
    l1Passes: number;
    l1Failures: number;
    l2Checks: number;
    l2Failures: number;
    earlyExits: number;
    currentHeroId: string;
  };
}

type ControlCommand =
  | { type: "start"; config: HarnessConfig }
  | { type: "stop"; reason?: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "get_status" }
  | { type: "get_logs"; limit?: number };

interface ControlResponse {
  type: "control_response";
  command: string;
  success: boolean;
  error?: string;
  data?: any;
}

interface ErrorMessage {
  type: "error";
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}
```

#### 3.1.3 日志推送格式

```typescript
// 日志级别枚举
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

// 日志模块枚举
type LogModule =
  | "SYSTEM"
  | "FETCH_DNA"
  | "AGENT_REASON"
  | "TIANJIE_L1"
  | "TIANJIE_L2"
  | "EXECUTE"
  | "OPENCLAW"
  | "OPTIMIZER"
  | "GITHUB";

// 日志条目
interface LogEntry {
  id: string;              // UUID
  timestamp: string;       // ISO 8601
  level: LogLevel;
  module: LogModule;
  message: string;
  traceId?: string;        // 关联到具体 ActionTrace
  data?: {
    toolName?: string;
    parameters?: any;
    score?: number;
    patch?: string;
  };
}

// 批量推送（性能优化）
interface BatchLogMessage {
  type: "log_batch";
  payload: {
    logs: LogEntry[];
    count: number;
  };
}
```

### 3.2 HTTP REST API

#### 3.2.1 端点定义

```yaml
# OpenAPI 3.0 规范
openapi: 3.0.0
info:
  title: TianLi Harness API
  version: 1.0.0

paths:
  /api/v1/status:
    get:
      summary: 获取当前运行状态
      responses:
        200:
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HarnessStatus'

  /api/v1/runs:
    get:
      summary: 获取历史执行记录
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        200:
          description: 成功
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/RunRecord'

  /api/v1/runs/{runId}:
    get:
      summary: 获取单次执行详情
      parameters:
        - name: runId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RunDetail'

  /api/v1/config:
    get:
      summary: 获取当前配置
      responses:
        200:
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HarnessConfig'
    put:
      summary: 更新配置
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/HarnessConfig'
      responses:
        200:
          description: 成功

  /api/v1/dna:
    post:
      summary: 上传自定义 DNA
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                heroId:
                  type: string
      responses:
        201:
          description: 创建成功

  /api/v1/patches:
    get:
      summary: 获取天演 Patch 历史
      responses:
        200:
          description: 成功
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/EvolutionPatch'

  /api/v1/health:
    get:
      summary: 健康检查
      responses:
        200:
          description: 服务正常

components:
  schemas:
    HarnessStatus:
      type: object
      properties:
        status:
          type: string
          enum: [idle, running, completed, early_exit, error]
        currentRunId:
          type: string
        uptime:
          type: integer
        stats:
          $ref: '#/components/schemas/RunStats'

    RunStats:
      type: object
      properties:
        totalRuns:
          type: integer
        successfulRuns:
          type: integer
        earlyExitRate:
          type: number
        avgSteps:
          type: number
        avgDuration:
          type: number

    RunRecord:
      type: object
      properties:
        runId:
          type: string
        heroId:
          type: string
        status:
          type: string
        startTime:
          type: string
          format: date-time
        endTime:
          type: string
          format: date-time
        steps:
          type: integer
        earlyExit:
          type: boolean

    RunDetail:
      allOf:
        - $ref: '#/components/schemas/RunRecord'
        - type: object
          properties:
            config:
              $ref: '#/components/schemas/HarnessConfig'
            logs:
              type: array
              items:
                $ref: '#/components/schemas/LogEntry'
            traces:
              type: array
              items:
                $ref: '#/components/schemas/ActionTrace'
            evolutionPatch:
              type: string

    HarnessConfig:
      type: object
      properties:
        heroId:
          type: string
        superpowers:
          type: array
          items:
            type: string
        driftThreshold:
          type: number
          minimum: 0
          maximum: 1
        l2SampleRatio:
          type: number
          minimum: 0
          maximum: 1
        repoOwner:
          type: string
        repoName:
          type: string
        githubToken:
          type: string
          writeOnly: true
        forbiddenWords:
          type: array
          items:
            type: string
        repetitionThreshold:
          type: integer

    EvolutionPatch:
      type: object
      properties:
        id:
          type: string
        runId:
          type: string
        heroId:
          type: string
        createdAt:
          type: string
          format: date-time
        patchContent:
          type: string
        committedToGithub:
          type: boolean
        githubUrl:
          type: string

    ActionTrace:
      type: object
      properties:
        step:
          type: integer
        toolName:
          type: string
        parameters:
          type: object
        observation:
          type: string
        isValid:
          type: boolean
        auditScore:
          type: number
```

### 3.3 Tauri 原生 API

```typescript
// src-tauri/src/lib.rs 中定义的命令

// 系统通知
#[tauri::command]
async fn send_notification(title: String, body: String) -> Result<(), String>

// 文件对话框
#[tauri::command]
async fn open_file_dialog(filters: Vec<String>) -> Result<Option<String>, String>

// 系统托盘菜单
#[tauri::command]
async fn update_tray_status(status: String) -> Result<(), String>

// 剪贴板操作
#[tauri::command]
async fn copy_to_clipboard(text: String) -> Result<(), String>

// 外部浏览器打开
#[tauri::command]
async fn open_url(url: String) -> Result<(), String>
```

---

## 4. 前端组件结构

### 4.1 组件树

```
App
├── Header
│   ├── Logo
│   └── Title
│
├── Dashboard
│   ├── StatusCards
│   │   ├── StatusCard (状态)
│   │   ├── StatusCard (总步数)
│   │   ├── StatusCard (天劫触发)
│   │   ├── StatusCard (L1 通过)
│   │   └── StatusCard (L2 检查)
│   │
│   ├── ControlBar
│   │   ├── StartButton
│   │   ├── StopButton
│   │   ├── PauseButton
│   │   ├── ConfigButton
│   │   └── AutoScrollToggle
│   │
│   ├── LogViewer
│   │   ├── LogToolbar
│   │   ├── LogList
│   │   │   └── LogEntry (重复)
│   │   └── AutoScrollAnchor
│   │
│   └── StatsPanel
│       ├── RunHistory
│       └── PerformanceChart
│
├── ArchitectureView
│   ├── FlowDiagram
│   │   ├── StepBadge (重复)
│   │   └── ConnectionArrow
│   ├── Legend
│   └── DetailPanel
│
├── ConfigPanel (Modal/Drawer)
│   ├── DNAConfig
│   ├── ThresholdConfig
│   ├── GitHubConfig
│   └── AdvancedConfig
│
├── RunHistoryPanel (Modal/Drawer)
│   ├── RunList
│   ├── RunDetail
│   └── PatchViewer
│
└── Footer
    └── VersionInfo
```

### 4.2 状态管理 (Zustand)

```typescript
// store/harnessStore.ts
import { create } from 'zustand';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  module: string;
  message: string;
  data?: any;
}

interface RunStats {
  totalSteps: number;
  l1Passes: number;
  l1Failures: number;
  l2Checks: number;
  l2Failures: number;
  earlyExits: number;
}

interface HarnessState {
  // 连接状态
  wsConnected: boolean;
  wsConnecting: boolean;
  wsError: string | null;

  // 运行状态
  status: 'idle' | 'running' | 'paused' | 'completed' | 'early_exit' | 'error';
  currentRunId: string | null;
  currentHeroId: string | null;

  // 日志
  logs: LogEntry[];
  maxLogs: number;

  // 统计
  stats: RunStats;

  // 配置
  config: HarnessConfig | null;

  // 历史
  runs: RunRecord[];

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendCommand: (cmd: ControlCommand) => void;
  startRun: (config: HarnessConfig) => void;
  stopRun: (reason?: string) => void;
  clearLogs: () => void;
  loadConfig: () => Promise<void>;
  saveConfig: (config: HarnessConfig) => Promise<void>;
  loadRuns: () => Promise<void>;
}

export const useHarnessStore = create<HarnessState>((set, get) => ({
  // 初始状态
  wsConnected: false,
  wsConnecting: false,
  wsError: null,
  status: 'idle',
  currentRunId: null,
  currentHeroId: null,
  logs: [],
  maxLogs: 1000,
  stats: {
    totalSteps: 0,
    l1Passes: 0,
    l1Failures: 0,
    l2Checks: 0,
    l2Failures: 0,
    earlyExits: 0,
  },
  config: null,
  runs: [],

  // WebSocket 连接
  connect: () => {
    set({ wsConnecting: true });
    const ws = new WebSocket('ws://localhost:8765/harness');
    
    ws.onopen = () => {
      set({ wsConnected: true, wsConnecting: false, wsError: null });
      // 发送握手
      ws.send(JSON.stringify({
        type: 'handshake',
        version: '1.0',
        clientId: crypto.randomUUID(),
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleWSMessage(msg, set, get);
    };

    ws.onerror = () => {
      set({ wsConnected: false, wsConnecting: false, wsError: '连接失败' });
    };

    ws.onclose = () => {
      set({ wsConnected: false, wsConnecting: false });
      // 自动重连逻辑
      setTimeout(() => get().connect(), 3000);
    };
  },

  disconnect: () => {
    // 关闭连接
  },

  sendCommand: (cmd) => {
    // 发送命令到 WebSocket
  },

  startRun: (config) => {
    set({ status: 'running', currentRunId: crypto.randomUUID() });
    get().sendCommand({ type: 'start', config });
  },

  stopRun: (reason) => {
    get().sendCommand({ type: 'stop', reason });
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  loadConfig: async () => {
    const res = await fetch('/api/v1/config');
    const config = await res.json();
    set({ config });
  },

  saveConfig: async (config) => {
    await fetch('/api/v1/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    set({ config });
  },

  loadRuns: async () => {
    const res = await fetch('/api/v1/runs?limit=50');
    const runs = await res.json();
    set({ runs });
  },
}));

function handleWSMessage(
  msg: WSMessage,
  set: any,
  get: any
) {
  switch (msg.type) {
    case 'log':
    case 'log_batch':
      set((state: any) => ({
        logs: [...state.logs, ...(msg.payload.logs || [msg.payload])].slice(-state.maxLogs),
      }));
      break;

    case 'status':
      set({
        status: msg.payload.harnessStatus,
        stats: {
          totalSteps: msg.payload.totalSteps,
          l1Passes: msg.payload.l1Passes,
          l1Failures: msg.payload.l1Failures,
          l2Checks: msg.payload.l2Checks,
          l2Failures: msg.payload.l2Failures,
          earlyExits: msg.payload.earlyExits,
        },
      });
      break;

    case 'control_response':
      if (msg.command === 'stop') {
        set({ status: 'idle' });
      }
      break;

    case 'error':
      set({ wsError: msg.payload.message });
      break;
  }
}
```

### 4.3 核心组件实现

```typescript
// components/LogViewer.tsx
import React, { useRef, useEffect } from 'react';
import { useHarnessStore } from '../store/harnessStore';

interface LogViewerProps {
  autoScroll?: boolean;
}

export const LogViewer: React.FC<LogViewerProps> = ({ autoScroll = true }) => {
  const logs = useHarnessStore((state) => state.logs);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <LogToolbar />
      <div className="p-3 h-96 overflow-y-auto font-mono text-sm bg-gray-950">
        {logs.length === 0 ? (
          <EmptyState />
        ) : (
          logs.map((log) => <LogEntry key={log.id} log={log} />)
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

// components/LogEntry.tsx
export const LogEntry: React.FC<{ log: LogEntry }> = ({ log }) => {
  const colors = {
    DEBUG: 'text-gray-400 bg-gray-800',
    INFO: 'text-blue-400 bg-blue-900/20',
    WARN: 'text-yellow-400 bg-yellow-900/20',
    ERROR: 'text-red-400 bg-red-900/20',
  };

  return (
    <div className="flex gap-2 mb-1 hover:bg-gray-900/50 p-1 rounded">
      <span className="text-gray-600 w-16 flex-shrink-0">
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[log.level]}`}>
        {log.level}
      </span>
      <span className="text-purple-400 w-24 flex-shrink-0 text-xs">
        {log.module}
      </span>
      <span className="text-gray-300">{log.message}</span>
    </div>
  );
};

// components/StatusCards.tsx
export const StatusCards: React.FC = () => {
  const { status, stats } = useHarnessStore();

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatusCard
        title="状态"
        value={getStatusText(status)}
        color={getStatusColor(status)}
      />
      <StatusCard title="总步数" value={stats.totalSteps.toString()} />
      <StatusCard
        title="天劫触发"
        value={stats.earlyExits.toString()}
        color={stats.earlyExits > 0 ? 'red' : 'green'}
      />
      <StatusCard
        title="L1 通过"
        value={stats.l1Passes.toString()}
        color="blue"
      />
      <StatusCard
        title="L2 检查"
        value={stats.l2Checks.toString()}
        color="purple"
      />
    </div>
  );
};

// components/ArchitectureDiagram.tsx
export const ArchitectureDiagram: React.FC = () => {
  const steps = [
    { num: 1, label: 'Fetch DNA', desc: '获取 Hero Prompt' },
    { num: 2, label: 'Agent Reason', desc: 'LLM 推理' },
    { num: 3, label: 'TianJie Audit', desc: '天劫审查', highlight: true },
    { num: 4, label: 'Execute', desc: '执行工具' },
    { num: 5, label: 'Optimizer', desc: '天演优化 (熔断时)' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <h2 className="font-bold mb-3">🏗️ 架构流程</h2>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <React.Fragment key={step.num}>
            <StepBadge {...step} />
            {i < steps.length - 1 && <Arrow />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
```

---

## 5. 实时日志推送方案

### 5.1 推送架构

```
┌──────────────────┐     WebSocket      ┌──────────────────┐
│  TianLi Harness  │ ─────────────────> │   Web Console    │
│   (Python Core)  │                    │   (React/Tauri)  │
│                  │                    │                  │
│ 1. 生成日志事件  │                    │ 1. 接收消息      │
│ 2. 发送到事件总线│                    │ 2. 解析消息类型  │
│ 3. WebSocket 广播 │                    │ 3. 更新 Zustand  │
│                  │                    │ 4. 渲染 UI       │
└──────────────────┘                    └──────────────────┘
```

### 5.2 后端实现 (Python)

```python
# bridge/websocket_server.py
import asyncio
import json
from datetime import datetime
from typing import Set
from websockets.server import serve, WebSocketServerProtocol

class WebSocketBridge:
    """WebSocket 桥接服务器"""

    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[WebSocketServerProtocol] = set()
        self.sessions: dict[str, dict] = {}

    async def register(self, websocket: WebSocketServerProtocol) -> str:
        """注册新客户端连接"""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {
            "ws": websocket,
            "connected_at": datetime.now(),
            "last_activity": datetime.now(),
        }
        self.clients.add(websocket)
        return session_id

    async def unregister(self, websocket: WebSocketServerProtocol):
        """注销客户端连接"""
        self.clients.discard(websocket)
        # 清理会话
        for session_id, session in list(self.sessions.items()):
            if session["ws"] == websocket:
                del self.sessions[session_id]

    async def broadcast(self, message: dict):
        """广播消息到所有客户端"""
        if not self.clients:
            return

        payload = json.dumps(message)
        await asyncio.gather(
            *[client.send(payload) for client in self.clients],
            return_exceptions=True
        )

    async def send_log(self, log_entry: dict):
        """推送日志条目"""
        await self.broadcast({
            "type": "log",
            "payload": log_entry
        })

    async def send_status(self, status: dict):
        """推送状态更新"""
        await self.broadcast({
            "type": "status",
            "payload": status
        })

    async def handler(self, websocket: WebSocketServerProtocol):
        """WebSocket 连接处理器"""
        session_id = await self.register(websocket)
        print(f"Client connected: {session_id}")

        try:
            async for message in websocket:
                data = json.loads(message)
                await self.handle_message(data, websocket)
        except Exception as e:
            print(f"Client error: {e}")
        finally:
            await self.unregister(websocket)
            print(f"Client disconnected: {session_id}")

    async def handle_message(self, data: dict, websocket: WebSocketServerProtocol):
        """处理客户端消息"""
        msg_type = data.get("type")

        if msg_type == "handshake":
            await websocket.send(json.dumps({
                "type": "handshake_ack",
                "serverVersion": "1.0.0",
                "sessionId": self.sessions[id(websocket)]["session_id"]
            }))

        elif msg_type == "start":
            # 转发到 Harness 引擎
            await self.forward_to_harness(data)

        elif msg_type == "stop":
            await self.forward_to_harness(data)

        elif msg_type == "get_status":
            status = await self.get_harness_status()
            await websocket.send(json.dumps({
                "type": "status",
                "payload": status
            }))

    async def forward_to_harness(self, data: dict):
        """转发命令到 Harness 引擎"""
        # 通过事件总线或直接调用
        pass

    async def get_harness_status(self) -> dict:
        """获取 Harness 当前状态"""
        # 从 Harness 引擎获取
        pass

    async def start(self):
        """启动 WebSocket 服务器"""
        async with serve(self.handler, self.host, self.port):
            print(f"WebSocket server started on ws://{self.host}:{self.port}")
            await asyncio.Future()  # 运行直到取消
```

### 5.3 日志事件集成

```python
# core/logging.py
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Any
import uuid

class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"

class LogModule(Enum):
    SYSTEM = "SYSTEM"
    FETCH_DNA = "FETCH_DNA"
    AGENT_REASON = "AGENT_REASON"
    TIANJIE_L1 = "TIANJIE_L1"
    TIANJIE_L2 = "TIANJIE_L2"
    EXECUTE = "EXECUTE"
    OPENCLAW = "OPENCLAW"
    OPTIMIZER = "OPTIMIZER"
    GITHUB = "GITHUB"

@dataclass
class LogEntry:
    id: str
    timestamp: str
    level: str
    module: str
    message: str
    traceId: Optional[str] = None
    data: Optional[dict] = None

    @classmethod
    def create(
        cls,
        level: LogLevel,
        module: LogModule,
        message: str,
        traceId: Optional[str] = None,
        data: Optional[dict] = None
    ) -> "LogEntry":
        return cls(
            id=str(uuid.uuid4()),
            timestamp=datetime.now().isoformat(),
            level=level.value,
            module=module.value,
            message=message,
            traceId=traceId,
            data=data
        )

    def to_dict(self) -> dict:
        return asdict(self)

# 在 Harness 节点中集成日志
class TianLiHarness:
    def __init__(self, ws_bridge: WebSocketBridge):
        self.ws_bridge = ws_bridge

    async def log(self, level: LogLevel, module: LogModule, message: str, data: dict = None):
        """记录并推送日志"""
        entry = LogEntry.create(level, module, message, data=data)
        await self.ws_bridge.send_log(entry.to_dict())

    async def node_fetch_dna(self, state: TianLiState) -> dict:
        await self.log(LogLevel.INFO, LogModule.FETCH_DNA, "🧬 Fetch DNA - 获取 Hero Prompt")
        try:
            prompt = await self.fetcher.fetch(...)
            await self.log(
                LogLevel.INFO,
                LogModule.FETCH_DNA,
                f"✅ 获取成功 ({len(prompt)} 字符)"
            )
            return {"messages": [{"role": "system", "content": prompt}]}
        except Exception as e:
            await self.log(
                LogLevel.ERROR,
                LogModule.FETCH_DNA,
                f"❌ 获取失败：{str(e)}"
            )
            raise
```

### 5.4 性能优化

```typescript
// 前端批量处理
interface LogBatchProcessor {
  buffer: LogEntry[];
  flushInterval: number;
  maxBufferSize: number;

  add(log: LogEntry) {
    this.buffer.push(log);
    
    // 达到阈值立即刷新
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length === 0) return;
    
    // 批量更新状态
    set((state) => ({
      logs: [...state.logs, ...this.buffer].slice(-state.maxLogs)
    }));
    
    this.buffer = [];
  }
}

// 虚拟滚动（大量日志时）
import { useVirtualizer } from '@tanstack/react-virtual';

export const VirtualLogList: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24, // 每行高度
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-96 overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <LogEntry log={logs[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 6. 跨平台兼容性

### 6.1 响应式设计断点

```css
/* TailwindCSS 断点配置 */
/* tailwind.config.js */
module.exports = {
  theme: {
    screens: {
      'sm': '640px',   /* 手机横屏 */
      'md': '768px',   /* 平板 */
      'lg': '1024px',  /* 桌面小屏 */
      'xl': '1280px',  /* 桌面标准 */
      '2xl': '1536px', /* 桌面大屏 */
    },
  },
};
```

### 6.2 平台适配策略

| 平台 | 适配策略 | 特殊处理 |
|------|---------|---------|
| **桌面 (Tauri)** | 完整功能 | 系统通知、托盘、原生菜单 |
| **网页 (浏览器)** | 完整功能 | WebSocket 降级为 HTTP 轮询 |
| **移动 (PWA)** | 简化布局 | 触摸优化、隐藏复杂图表 |
| **移动 (Tauri)** | 完整功能 | 同 PWA + 原生能力 |

### 6.3 平台检测与适配

```typescript
// utils/platform.ts
export type Platform = 'tauri' | 'web' | 'mobile';

export function getPlatform(): Platform {
  if ('__TAURI__' in window) {
    // Tauri 环境
    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
      return 'mobile';
    }
    return 'tauri';
  }
  // 浏览器环境
  if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
    return 'mobile';
  }
  return 'web';
}

// 条件渲染
import { getPlatform } from '../utils/platform';

export const NativeFeatures: React.FC = () => {
  const platform = getPlatform();
  
  if (platform !== 'tauri') return null;
  
  return (
    <div>
      <TrayIcon />
      <SystemNotification />
    </div>
  );
};
```

### 6.4 Tauri 配置

```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "TianLi Console",
  "version": "1.0.0",
  "identifier": "com.tianli.console",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "TianLi Console",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg", "deb", "msi"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "plugins": {
    "websocket": {
      "all": true
    },
    "notification": {
      "all": true
    },
    "dialog": {
      "all": true
    },
    "shell": {
      "all": false
    }
  }
}
```

---

## 7. 技术选型理由

### 7.1 前端框架：React 18

| 考量 | 选择理由 |
|------|---------|
| **生态成熟** | 最大的前端社区，组件库丰富 |
| **Tauri 集成** | 官方推荐，文档完善 |
| **性能** | Concurrent Features 支持高频率日志渲染 |
| **团队熟悉度** | 降低学习成本 |

### 7.2 状态管理：Zustand

| 考量 | 选择理由 |
|------|---------|
| **轻量** | ~1KB，比 Redux 小 10 倍 |
| **简洁** | 无需 Provider 包裹，直接 hook 使用 |
| **性能** | 选择器优化，避免不必要重渲染 |
| **TypeScript** | 原生类型支持 |

### 7.3 样式方案：TailwindCSS

| 考量 | 选择理由 |
|------|---------|
| **开发效率** | 原子化 CSS，无需切换文件 |
| **一致性** | 设计系统内置，避免样式漂移 |
| **性能** | PurgeCSS 自动移除未使用样式 |
| **响应式** | 内置断点，移动端优先 |

### 7.4 跨平台框架：Tauri v2

| 考量 | Tauri | Electron |
|------|-------|----------|
| **包体积** | ~10MB | ~100MB |
| **内存占用** | ~50MB | ~200MB |
| **安全性** | 默认沙箱 | 需手动配置 |
| **移动端** | iOS/Android 支持 | 不支持 |
| **后端语言** | Rust (高性能) | Node.js |

### 7.5 通信协议：WebSocket

| 考量 | WebSocket | HTTP 轮询 | SSE |
|------|-----------|----------|-----|
| **实时性** | <100ms | 1-5s 延迟 | <100ms |
| **双向通信** | ✅ | ❌ | ❌ |
| **连接开销** | 低 (长连接) | 高 (频繁握手) | 低 |
| **浏览器支持** | 广泛 | 广泛 | 广泛 |
| **Tauri 支持** | 原生插件 | 内置 | 需封装 |

### 7.6 构建工具：Vite

| 考量 | 选择理由 |
|------|---------|
| **开发速度** | HMR 毫秒级更新 |
| **生产构建** | Rollup 优化，代码分割 |
| **TypeScript** | 原生支持，无需额外配置 |
| **Tauri 集成** | 官方模板默认 |

---

## 8. 安全考虑

### 8.1 WebSocket 安全

```typescript
// 生产环境使用 WSS
const WS_URL = import.meta.env.PROD
  ? `wss://${window.location.host}/harness`
  : 'ws://localhost:8765/harness';

// 连接验证
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'handshake',
    version: '1.0',
    clientId: crypto.randomUUID(),
    // 可选：认证 token
    token: getAuthToken(),
  }));
};
```

### 8.2 API 认证

```python
# bridge/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(
    creds: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """验证 Bearer Token"""
    token = creds.credentials
    
    # 验证逻辑
    if not is_valid_token(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    return extract_user_id(token)
```

### 8.3 CORS 配置

```python
# bridge/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",  # 开发
        "tauri://localhost",       # Tauri
        "https://console.tianli.com",  # 生产
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 9. 部署方案

### 9.1 开发环境

```bash
# 启动 WebSocket 桥接服务器
cd tianli_harness/bridge
python -m uvicorn main:app --reload --host localhost --port 8765

# 启动前端开发服务器
cd tianli_harness/web
npm run dev

# 启动 Tauri 桌面应用
npm run tauri dev
```

### 9.2 生产构建

```bash
# 构建前端
cd tianli_harness/web
npm run build

# 构建桌面应用
npm run tauri build

# 输出位置
# - macOS: src-tauri/target/release/bundle/dmg/
# - Windows: src-tauri/target/release/bundle/msi/
# - Linux: src-tauri/target/release/bundle/deb/
```

### 9.3 Docker 部署 (网页版)

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 10. 下一步计划

### Phase 1: 基础通信 (P0)
- [ ] 实现 WebSocket 桥接服务器
- [ ] 实现前端 WebSocket 客户端
- [ ] 实现基本日志推送
- [ ] 实现启动/停止控制

### Phase 2: 状态同步 (P0)
- [ ] 实现状态实时更新
- [ ] 实现统计面板
- [ ] 实现历史运行记录

### Phase 3: 高级功能 (P1)
- [ ] 实现配置管理界面
- [ ] 实现 Patch 查看器
- [ ] 实现架构图可视化

### Phase 4: 优化与发布 (P1)
- [ ] 性能优化 (虚拟滚动、批量推送)
- [ ] 移动端适配
- [ ] 桌面应用打包
- [ ] 文档完善

---

## 附录 A: 目录结构

```
tianli_harness/web/
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Dashboard/
│   │   │   ├── StatusCards.tsx
│   │   │   ├── ControlBar.tsx
│   │   │   └── StatsPanel.tsx
│   │   ├── LogViewer/
│   │   │   ├── LogViewer.tsx
│   │   │   ├── LogEntry.tsx
│   │   │   ├── LogToolbar.tsx
│   │   │   └── VirtualLogList.tsx
│   │   ├── Architecture/
│   │   │   ├── FlowDiagram.tsx
│   │   │   ├── StepBadge.tsx
│   │   │   └── Legend.tsx
│   │   ├── Config/
│   │   │   ├── ConfigPanel.tsx
│   │   │   ├── DNAConfig.tsx
│   │   │   ├── ThresholdConfig.tsx
│   │   │   └── GitHubConfig.tsx
│   │   └── History/
│   │       ├── RunHistoryPanel.tsx
│   │       ├── RunList.tsx
│   │       └── PatchViewer.tsx
│   ├── store/
│   │   ├── harnessStore.ts
│   │   └── configStore.ts
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useLogs.ts
│   │   └── usePlatform.ts
│   ├── utils/
│   │   ├── platform.ts
│   │   ├── formatters.ts
│   │   └── api.ts
│   ├── types/
│   │   ├── websocket.ts
│   │   ├── api.ts
│   │   └── index.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands.rs
│   │   └── tray.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
├── bridge/
│   ├── main.py
│   ├── websocket_server.py
│   ├── http_api.py
│   ├── auth.py
│   └── requirements.txt
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── ARCHITECTURE.md (本文档)
```

---

**文档结束**
