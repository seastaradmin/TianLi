// components/LogViewer.tsx
import React, { useRef, useEffect } from 'react'
import { useLogStore } from '../stores/logStore'
import { LogLine } from './LogLine'
import type { LogEntry } from '../types'

interface LogViewerProps {
  status: 'idle' | 'running' | 'completed' | 'error'
  logEntries?: LogEntry[]  // 可选：外部传入日志（用于 SSE/WebSocket）
}

export function LogViewer({ status, logEntries }: LogViewerProps) {
  const logs = logEntries || useLogStore(state => 
    state.logs.filter(log => state.filter.includes(log.level))
  )
  const autoScroll = useLogStore(state => state.autoScroll)
  const logEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-6">
      <div className="bg-gray-900 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">📋 实时日志</span>
          {status === 'running' && (
            <span className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></span>
          )}
        </div>
        <span className="text-xs text-gray-500">{logs.length} 条</span>
      </div>
      
      <div 
        className="p-3 h-64 md:h-96 overflow-y-auto font-mono text-xs md:text-sm bg-gray-950"
        style={{ scrollBehavior: 'smooth' }}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 text-center py-12">
            <div className="text-5xl mb-4">📭</div>
            <div className="text-lg mb-2">暂无日志</div>
            <div className="text-sm">点击"启动"开始执行</div>
          </div>
        ) : (
          <>
            {logs.map((log, index) => (
              <LogLine key={`${log.id}-${index}`} log={log} />
            ))}
            <div ref={logEndRef} />
          </>
        )}
      </div>
    </div>
  )
}
