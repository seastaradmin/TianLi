import React from 'react'
import { StatusCard } from './StatusCard'
import type { Stats } from '../types'

interface StatsBarProps {
  stats: Stats
}

const statusLabels: Record<string, string> = {
  idle: '空闲',
  routing: '分发中',
  running: '运行中',
  completed: '完成',
  early_exit: '天劫触发',
  error: '错误',
}

const statusColors: Record<string, string> = {
  idle: 'gray',
  routing: 'blue',
  running: 'blue',
  completed: 'green',
  early_exit: 'red',
  error: 'red',
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
      <StatusCard title="主状态" value={statusLabels[stats.status] || stats.status} color={statusColors[stats.status] as any} icon="🌌" />
      <StatusCard title="总步数" value={stats.totalSteps.toString()} color="blue" icon="🧭" />
      <StatusCard title="活跃 Hero" value={stats.activeHeroes.toString()} color={stats.activeHeroes > 0 ? 'green' : 'gray'} icon="✨" />
      <StatusCard title="活跃任务" value={stats.activeTasks.toString()} color={stats.activeTasks > 0 ? 'blue' : 'gray'} icon="🛰️" />
      <StatusCard title="天劫触发" value={stats.earlyExits.toString()} color={stats.earlyExits > 0 ? 'red' : 'green'} icon="⚠️" />
      <StatusCard title="L2 审查" value={stats.l2Checks.toString()} color="purple" icon="🔭" />
    </div>
  )
}
