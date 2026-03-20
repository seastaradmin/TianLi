// components/StatsBar.tsx
import React from 'react'
import { StatusCard } from './StatusCard'
import type { Stats } from '../types'

interface StatsBarProps {
  stats: Stats
}

const statusLabels: Record<string, string> = {
  idle: '⏸️ 空闲',
  running: '🔄 运行中',
  completed: '✅ 完成',
  error: '❌ 错误'
}

const statusColors: Record<string, string> = {
  idle: 'gray',
  running: 'blue',
  completed: 'green',
  error: 'red'
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <StatusCard
        title="状态"
        value={statusLabels[stats.status] || stats.status}
        color={statusColors[stats.status] as any}
        icon={stats.status === 'running' ? '🔄' : stats.status === 'completed' ? '✅' : stats.status === 'error' ? '❌' : '⏸️'}
      />
      <StatusCard
        title="总步数"
        value={stats.totalSteps.toString()}
        color="blue"
        icon="📊"
      />
      <StatusCard
        title="天劫触发"
        value={stats.earlyExits.toString()}
        color={stats.earlyExits > 0 ? 'red' : 'green'}
        icon={stats.earlyExits > 0 ? '⚠️' : '✅'}
      />
      <StatusCard
        title="L1 通过"
        value={stats.l1Passes.toString()}
        color="blue"
        icon="🛡️"
      />
      <StatusCard
        title="L2 检查"
        value={stats.l2Checks.toString()}
        color="purple"
        icon="🔍"
      />
    </div>
  )
}
