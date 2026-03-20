// components/LogLine.tsx
import React, { memo } from 'react'
import type { LogEntry } from '../types'

interface LogLineProps {
  log: LogEntry
}

export const LogLine = memo(function LogLine({ log }: LogLineProps) {
  const colors: Record<string, string> = {
    INFO: 'text-blue-400 bg-blue-900/20 border-blue-800/30',
    WARN: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30',
    ERROR: 'text-red-400 bg-red-900/20 border-red-800/30',
    DEBUG: 'text-gray-400 bg-gray-800 border-gray-700/30',
  }

  const levelIcons: Record<string, string> = {
    INFO: 'ℹ️',
    WARN: '⚠️',
    ERROR: '❌',
    DEBUG: '🔍',
  }

  return (
    <div className="flex gap-2 mb-1 hover:bg-gray-900/50 p-1.5 rounded border border-transparent hover:border-gray-800 transition-all">
      <span className="text-gray-600 w-20 flex-shrink-0 font-mono text-xs">
        {log.time}
      </span>
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[log.level]} flex items-center gap-1`}
      >
        <span>{levelIcons[log.level]}</span>
        <span>{log.level}</span>
      </span>
      <span className="text-purple-400 w-28 flex-shrink-0 text-xs font-mono truncate" title={log.module}>
        {log.module}
      </span>
      <span className="text-gray-300 flex-1 break-all">{log.msg}</span>
    </div>
  )
})
