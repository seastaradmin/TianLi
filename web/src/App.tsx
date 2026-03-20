// App.tsx
import { useState, useEffect, useCallback } from 'react'
import {
  Header,
  StatsBar,
  ControlPanel,
  LogViewer,
  FlowDiagram
} from './components'
import { useLogStore, useStatsStore } from './stores'
import { useSSE } from './hooks'
import type { LogEntry, Stats } from './types'

// SSE 服务端 URL（开发环境可配置）
const SSE_URL = import.meta.env.VITE_SSE_URL || 'http://localhost:1420/api/logs'

function App() {
  // 从 Zustand stores 获取状态和方法
  const logs = useLogStore(state => state.logs)
  const autoScroll = useLogStore(state => state.autoScroll)
  const setAutoScroll = useLogStore(state => state.setAutoScroll)
  const addLog = useLogStore(state => state.addLog)
  const clearLogs = useLogStore(state => state.clearLogs)
  
  const stats = useStatsStore(state => ({
    status: state.status,
    totalSteps: state.totalSteps,
    earlyExits: state.earlyExits,
    l1Passes: state.l1Passes,
    l2Checks: state.l2Checks
  }))
  const updateStats = useStatsStore(state => state.updateStats)
  const resetStats = useStatsStore(state => state.reset)
  const setStatus = useStatsStore(state => state.setStatus)
  const incrementStep = useStatsStore(state => state.incrementStep)
  const incrementEarlyExit = useStatsStore(state => state.incrementEarlyExit)
  const incrementL1Pass = useStatsStore(state => state.incrementL1Pass)
  const incrementL2Check = useStatsStore(state => state.incrementL2Check)

  // 本地状态用于模拟数据（实际使用时可移除）
  const [useMockData, setUseMockData] = useState(true)

  // SSE 连接 - 实时日志推送
  const handleLog = useCallback((log: LogEntry) => {
    addLog(log)
    // 根据日志内容更新统计
    if (log.module === 'EXECUTE') incrementStep()
    if (log.msg.includes('✅ 通过')) incrementL1Pass()
    if (log.module === 'TIANJIE-L2') incrementL2Check()
    if (log.msg.includes('天劫触发') || log.msg.includes('early exit')) incrementEarlyExit()
  }, [addLog, incrementStep, incrementL1Pass, incrementL2Check, incrementEarlyExit])

  const handleStats = useCallback((newStats: Stats) => {
    updateStats(newStats)
  }, [updateStats])

  // 使用 SSE 连接（实际后端可用时启用）
  // const { isConnected } = useSSE(SSE_URL, {
  //   onLog: handleLog,
  //   onStats: handleStats,
  //   enabled: !useMockData
  // })

  // 模拟日志流（演示用，实际使用时移除）
  useEffect(() => {
    if (!useMockData || stats.status !== 'running') return

    const mockLogs: Omit<LogEntry, 'time'>[] = [
      { id: Date.now() + 1, level: 'INFO', module: 'FETCH_DNA', msg: '🧬 Fetch DNA - 获取 Hero Prompt' },
      { id: Date.now() + 2, level: 'INFO', module: 'FETCH_DNA', msg: '✅ 获取成功 (42 字符)' },
      { id: Date.now() + 3, level: 'INFO', module: 'AGENT_REASON', msg: '🧠 Agent Reasoning - 第 1 轮推理' },
      { id: Date.now() + 4, level: 'DEBUG', module: 'TIANJIE-L1', msg: '检查：Write' },
      { id: Date.now() + 5, level: 'INFO', module: 'TIANJIE-L1', msg: '✅ 通过' },
      { id: Date.now() + 6, level: 'INFO', module: 'TIANJIE-L2', msg: '⊘ 跳过采样' },
      { id: Date.now() + 7, level: 'INFO', module: 'EXECUTE', msg: '⚡ 执行工具：Write' },
      { id: Date.now() + 8, level: 'INFO', module: 'OPENCLAW', msg: '✍️ 已写入：novel/chapter_1.md' },
    ]

    let delay = 0
    mockLogs.forEach((log) => {
      delay += 500
      setTimeout(() => {
        addLog({ ...log, time: new Date().toLocaleTimeString('zh-CN') })
      }, delay)
    })

    setTimeout(() => {
      setStatus('completed')
    }, delay + 500)
  }, [useMockData, stats.status, addLog, setStatus])

  // 控制函数
  const startRun = useCallback(() => {
    clearLogs()
    resetStats()
    setStatus('running')
  }, [clearLogs, resetStats, setStatus])

  const stopRun = useCallback(() => {
    setStatus('idle')
  }, [setStatus])

  const handleClear = useCallback(() => {
    clearLogs()
    resetStats()
  }, [clearLogs, resetStats])

  const handleExport = useCallback(() => {
    const logText = logs.map(log => 
      `[${log.time}] ${log.level} ${log.module}: ${log.msg}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tianli-logs-${new Date().toISOString().slice(0, 19)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [logs])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6 lg:p-8">
      {/* 头部 */}
      <Header />

      {/* 状态卡片 */}
      <StatsBar stats={stats} />

      {/* 操作栏 */}
      <ControlPanel
        status={stats.status}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onStart={startRun}
        onStop={stopRun}
        onClear={handleClear}
        onExport={handleExport}
      />

      {/* 日志窗口 */}
      <LogViewer status={stats.status} />

      {/* 架构流程图 */}
      <FlowDiagram />

      {/* 底部信息 */}
      <footer className="mt-6 text-center text-xs text-gray-500">
        TianLi Harness v1.0 · Built with Tauri + React + TailwindCSS · 
        <span className="ml-2">
          {useMockData ? '🧪 演示模式' : '📡 实时模式'}
        </span>
      </footer>

      {/* 演示模式切换（开发用，生产环境可移除） */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => setUseMockData(!useMockData)}
          className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs text-gray-400 transition border border-gray-700"
          title="切换演示/实时模式"
        >
          {useMockData ? '🧪 演示' : '📡 实时'}
        </button>
      </div>
    </div>
  )
}

export default App
