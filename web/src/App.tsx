import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  id: number
  time: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  module: string
  msg: string
}

interface Stats {
  status: 'idle' | 'running' | 'completed' | 'error'
  totalSteps: number
  earlyExits: number
  l1Passes: number
  l2Checks: number
}

function App() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<Stats>({
    status: 'idle',
    totalSteps: 0,
    earlyExits: 0,
    l1Passes: 0,
    l2Checks: 0
  })
  const [autoScroll, setAutoScroll] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  // 模拟日志流
  useEffect(() => {
    if (stats.status !== 'running') return

    const mockLogs: LogEntry[] = [
      { id: 1, time: new Date().toLocaleTimeString(), level: 'INFO', module: 'FETCH_DNA', msg: '🧬 Fetch DNA - 获取 Hero Prompt' },
      { id: 2, time: new Date().toLocaleTimeString(), level: 'INFO', module: 'FETCH_DNA', msg: '✅ 获取成功 (42 字符)' },
      { id: 3, time: new Date().toLocaleTimeString(), level: 'INFO', module: 'AGENT_REASON', msg: '🧠 Agent Reasoning - 第 1 轮推理' },
      { id: 4, time: new Date().toLocaleTimeString(), level: 'DEBUG', module: 'TIANJIE-L1', msg: '检查：Write' },
      { id: 5, time: new Date().toLocaleTimeString(), level: 'INFO', module: 'TIANJIE-L1', msg: '✅ 通过' },
      { id: 6, time: new Date().toLocaleTimeString(), level: 'INFO', module: 'TIANJIE-L2', msg: '⊘ 跳过采样' },
      { id: 7, time: new Date().toLocaleTimeString(), level: 'INFO', module: 'EXECUTE', msg: '⚡ 执行工具：Write' },
      { id: 8, time: new Date().toLocaleTimeString(), level: 'INFO', module: 'OPENCLAW', msg: '✍️ 已写入：novel/chapter_1.md' },
    ]

    let delay = 0
    mockLogs.forEach((log, i) => {
      delay += 300
      setTimeout(() => {
        setLogs(prev => [...prev, log])
        setStats(prev => ({
          ...prev,
          totalSteps: prev.totalSteps + (log.module === 'EXECUTE' ? 1 : 0),
          l1Passes: prev.l1Passes + (log.msg.includes('✅ 通过') ? 1 : 0),
          l2Checks: prev.l2Checks + (log.module === 'TIANJIE-L2' ? 1 : 0)
        }))
      }, delay)
    })

    setTimeout(() => {
      setStats(prev => ({ ...prev, status: 'completed' }))
    }, delay + 500)
  }, [stats.status])

  const startRun = () => {
    setLogs([])
    setStats({ status: 'running', totalSteps: 0, earlyExits: 0, l1Passes: 0, l2Checks: 0 })
  }

  const stopRun = () => {
    setStats(prev => ({ ...prev, status: 'idle' }))
  }

  const clearLogs = () => {
    setLogs([])
    setStats(prev => ({ ...prev, status: 'idle' }))
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6 lg:p-8">
      {/* 头部 */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🌟</div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-400">TianLi Console</h1>
            <p className="text-gray-400 text-sm">天理 Harness · 实时控制台</p>
          </div>
        </div>
      </header>

      {/* 状态卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatusCard 
          title="状态" 
          value={
            stats.status === 'idle' ? '⏸️ 空闲' :
            stats.status === 'running' ? '🔄 运行中' :
            stats.status === 'completed' ? '✅ 完成' : '❌ 错误'
          }
          color={stats.status === 'running' ? 'blue' : stats.status === 'completed' ? 'green' : 'gray'}
        />
        <StatusCard title="总步数" value={stats.totalSteps.toString()} />
        <StatusCard title="天劫触发" value={stats.earlyExits.toString()} color={stats.earlyExits > 0 ? 'red' : 'green'} />
        <StatusCard title="L1 通过" value={stats.l1Passes.toString()} color="blue" />
        <StatusCard title="L2 检查" value={stats.l2Checks.toString()} color="purple" />
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={startRun}
          disabled={stats.status === 'running'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          ▶️ 启动
        </button>
        <button
          onClick={stopRun}
          disabled={stats.status !== 'running'}
          className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          ⏹️ 停止
        </button>
        <button
          onClick={clearLogs}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          🗑️ 清空
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            id="autoscroll"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="rounded bg-gray-700 border-gray-600"
          />
          <label htmlFor="autoscroll" className="text-sm text-gray-400">自动滚动</label>
        </div>
      </div>

      {/* 日志窗口 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-6">
        <div className="bg-gray-900 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">📋 实时日志</span>
            {stats.status === 'running' && <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></span>}
          </div>
          <span className="text-xs text-gray-500">{logs.length} 条</span>
        </div>
        <div className="p-3 h-64 md:h-96 overflow-y-auto font-mono text-xs md:text-sm bg-gray-950">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              <div className="text-4xl mb-2">📭</div>
              暂无日志 · 点击"启动"开始
            </div>
          ) : (
            logs.map(log => (
              <LogLine key={log.id} log={log} />
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 架构流程图 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <span>🏗️</span> 架构流程
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
          <StepBadge num={1} label="Fetch DNA" desc="获取 Hero Prompt" />
          <Arrow />
          <StepBadge num={2} label="Agent Reason" desc="LLM 推理" />
          <Arrow />
          <StepBadge num={3} label="TianJie Audit" desc="天劫审查" highlight />
          <Arrow />
          <StepBadge num={4} label="Execute" desc="执行工具" />
        </div>
        <div className="mt-3 text-xs text-gray-500">
          <span className="inline-block mr-4">L1: 禁止词 / 空参数 / 重复检测</span>
          <span className="inline-block">L2: 深度语义检查（30% 采样）</span>
        </div>
      </div>

      {/* 底部信息 */}
      <footer className="mt-6 text-center text-xs text-gray-500">
        TianLi Harness v1.0 · Built with Tauri + React + TailwindCSS
      </footer>
    </div>
  )
}

// 子组件
function StatusCard({ title, value, color = 'gray' }: { title: string, value: string, color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-800',
    blue: 'bg-blue-900/30 border-blue-700',
    green: 'bg-green-900/30 border-green-700',
    red: 'bg-red-900/30 border-red-700',
    purple: 'bg-purple-900/30 border-purple-700',
  }
  
  return (
    <div className={`${colors[color] || colors.gray} rounded-lg p-3 border border-gray-700`}>
      <div className="text-gray-400 text-xs">{title}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  )
}

function LogLine({ log }: { log: LogEntry }) {
  const colors: Record<string, string> = {
    INFO: 'text-blue-400 bg-blue-900/20',
    WARN: 'text-yellow-400 bg-yellow-900/20',
    ERROR: 'text-red-400 bg-red-900/20',
    DEBUG: 'text-gray-400 bg-gray-800',
  }
  
  return (
    <div className="flex gap-2 mb-1 hover:bg-gray-900/50 p-1 rounded">
      <span className="text-gray-600 w-16 flex-shrink-0">{log.time}</span>
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colors[log.level]}`}>
        {log.level}
      </span>
      <span className="text-purple-400 w-24 flex-shrink-0 text-xs">{log.module}</span>
      <span className="text-gray-300">{log.msg}</span>
    </div>
  )
}

function StepBadge({ num, label, desc, highlight = false }: { num: number, label: string, desc: string, highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${highlight ? 'bg-blue-900/30 border border-blue-700' : 'bg-gray-900'}`}>
      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">{num}</span>
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-gray-500 text-xs">{desc}</div>
      </div>
    </div>
  )
}

function Arrow() {
  return <span className="text-gray-600">→</span>
}

export default App
