# TianLi Console UI 增强计划

参考 Edict 的设计，为 TianLi Harness 创建完善的控制台界面。

## 功能规划

### Phase 1 - 核心功能 (当前)
- [x] 实时日志推送 (SSE)
- [x] 基础状态显示
- [ ] 完整 UI 组件库
- [ ] 任务控制面板
- [ ] 统计仪表盘

### Phase 2 - 高级功能
- [ ] 架构图可视化
- [ ] 任务历史/归档
- [ ] 配置管理
- [ ] 多任务并发

### Phase 3 - 生态扩展
- [ ] Skills 管理
- [ ] 模板库
- [ ] 数据持久化
- [ ] 移动端适配

## 技术选型

### 前端
- React 18 + TypeScript
- Vite (构建工具)
- Zustand (状态管理)
- TailwindCSS (样式)
- Recharts (图表)
- React Flow (架构图)

### 后端
- FastAPI + Uvicorn
- SSE (日志推送)
- WebSocket (实时控制)
- SQLite (数据持久化)

## 页面结构

```
/dashboard
  ├── 📊 总览 (Dashboard)
  │     ├── 实时状态卡片
  │     ├── 统计图表
  │     └── 最近活动
  ├── 📋 日志看板 (Log Viewer)
  │     ├── 实时日志流
  │     ├── 过滤/搜索
  │     └── 导出功能
  ├── 🏗️ 架构图 (Architecture)
  │     ├── 流程图可视化
  │     ├── 节点状态
  │     └── 点击查看详情
  ├── ⚙️ 配置 (Settings)
  │     ├── Harness 配置
  │     ├── LLM 配置
  │     └── 日志级别
  └── 📜 历史 (History)
        ├── 任务列表
        ├── 详情查看
        └── 统计报告
```

## 组件设计

### Dashboard 组件
- StatsCard: 状态卡片 (状态/步骤/L1/L2)
- ActivityChart: 活动图表 (24h 趋势)
- RecentLogs: 最近日志 (Top 10)
- QuickActions: 快速操作 (启动/停止)

### LogViewer 组件
- LogStream: 实时日志流
- LogFilter: 过滤/搜索
- LogExport: 导出功能

### Architecture 组件
- FlowDiagram: 流程图 (React Flow)
- NodeCard: 节点卡片
- StatusBadge: 状态徽章

## 颜色主题

```
主色：#3B82F6 (蓝色)
成功：#10B981 (绿色)
警告：#F59E0B (黄色)
错误：#EF4444 (红色)
背景：#1E293B (深蓝灰)
```

## 下一步

1. 完善前端 UI 组件
2. 添加架构图可视化
3. 实现配置管理
4. 添加数据持久化
