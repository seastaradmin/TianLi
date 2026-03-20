import { useState, useEffect } from 'react'

// 模拟日志数据
const mockLogs = [
  { time: '10:12:04', level: 'INFO', msg: '[STEP-1] 🧬 Fetch DNA - 获取 Hero Prompt' },
  { time: '10:12:04', level: 'INFO', msg: '[STEP-2] 🧠 Agent Reasoning - 创作第 1 章' },
  { time: '10:12:04', level: 'INFO', msg: '[TIANJIE-L1] ✅ 通过' },
  { time: '10:12:04', level: 'INFO', msg: '[STEP-4] ⚡ Execute Tool - 写入文件' },
  { time: '10:12:04', level: 'INFO', msg: '[OPENCLAW] ✍️ 已写入：novel/chapter_1.md' },
]

function App() {
  const [logs, setLogs] = useState(mockLogs)
  const [status, setStatus] = useState<'idle' | 'running' | 'completed'>('idle')

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* 头部 */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-400">
          🌟 TianLi Console
        </h1>
        <p className="text-gray-400 text-sm mt-1">天理 Harness 控制台</p>
      </header>

      {/* 状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">状态</div>
          <div className="text-xl font-bold mt-1">
            {status === 'idle' && '⏸️ 空闲'}
            {status === 'running' && '🔄 运行中'}
            {status === 'completed' && '✅ 完成'}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">总步数</div>
          <div className="text-xl font-bold mt-1">{logs.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">天劫触发</div>
          <div className="text-xl font-bold mt-1">0</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setStatus('running')}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
        >
          ▶️ 启动
        </button>
        <button
          onClick={() => setStatus('idle')}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium"
        >
          ⏹️ 停止
        </button>
        <button
          onClick={() => setLogs([])}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium"
        >
          🗑️ 清空
        </button>
      </div>

      {/* 日志窗口 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="bg-gray-900 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
          <span className="text-sm font-medium">📋 实时日志</span>
          <span className="text-xs text-gray-500">{logs.length} 条</span>
        </div>
        <div className="p-4 h-96 overflow-y-auto font-mono text-xs md:text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">暂无日志</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <span className="text-gray-500">{log.time}</span>
                <span className={`
                  px-1 rounded text-xs
                  ${log.level === 'INFO' ? 'text-blue-400' : ''}
                  ${log.level === 'WARN' ? 'text-yellow-400' : ''}
                  ${log.level === 'ERROR' ? 'text-red-400' : ''}
                `}>{log.level}</span>
                <span className="text-gray-300">{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 架构说明 */}
      <div className="mt-6 bg-gray-800 rounded-lg p-4">
        <h2 className="font-bold mb-2">🏗️ 架构流程</h2>
        <div className="text-xs md:text-sm text-gray-400 space-y-1">
          <div>1️⃣ Fetch DNA → 2️⃣ Agent Reason → 3️⃣ TianJie Audit → 4️⃣ Execute</div>
          <div className="text-gray-500">L1 粗过滤（禁止词/空参数/重复） + L2 深度检查（30% 采样）</div>
        </div>
      </div>
    </div>
  )
}

export default App
