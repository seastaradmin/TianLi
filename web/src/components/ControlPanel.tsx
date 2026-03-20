// components/ControlPanel.tsx
import React from 'react'

interface ControlPanelProps {
  status: 'idle' | 'running' | 'completed' | 'error'
  autoScroll: boolean
  onAutoScrollChange: (enabled: boolean) => void
  onStart: () => void
  onStop: () => void
  onClear: () => void
  onExport?: () => void
}

export function ControlPanel({
  status,
  autoScroll,
  onAutoScrollChange,
  onStart,
  onStop,
  onClear,
  onExport
}: ControlPanelProps) {
  const isRunning = status === 'running'

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={onStart}
        disabled={isRunning}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
      >
        <span>▶️</span>
        <span>启动</span>
      </button>
      
      <button
        onClick={onStop}
        disabled={!isRunning}
        className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
      >
        <span>⏹️</span>
        <span>停止</span>
      </button>
      
      <button
        onClick={onClear}
        className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
      >
        <span>🗑️</span>
        <span>清空</span>
      </button>

      {onExport && (
        <button
          onClick={onExport}
          disabled={status === 'idle'}
          className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          <span>📥</span>
          <span>导出</span>
        </button>
      )}

      <div className="flex items-center gap-2 ml-auto bg-gray-800 px-3 py-2 rounded-lg">
        <input
          type="checkbox"
          id="autoscroll"
          checked={autoScroll}
          onChange={e => onAutoScrollChange(e.target.checked)}
          className="rounded bg-gray-700 border-gray-600 cursor-pointer"
        />
        <label htmlFor="autoscroll" className="text-sm text-gray-400 cursor-pointer select-none">
          自动滚动
        </label>
      </div>
    </div>
  )
}
