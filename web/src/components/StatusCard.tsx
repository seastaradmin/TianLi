// components/StatusCard.tsx
import React from 'react'

interface StatusCardProps {
  title: string
  value: string
  color?: 'gray' | 'blue' | 'green' | 'red' | 'purple'
  icon?: string
}

export function StatusCard({ title, value, color = 'gray', icon }: StatusCardProps) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-800 border-gray-700',
    blue: 'bg-blue-900/30 border-blue-700',
    green: 'bg-green-900/30 border-green-700',
    red: 'bg-red-900/30 border-red-700',
    purple: 'bg-purple-900/30 border-purple-700',
  }

  return (
    <div className={`${colors[color]} rounded-lg p-3 border border-gray-700 transition-all hover:border-gray-600`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-gray-400 text-xs">{title}</span>
      </div>
      <div className="text-lg font-bold mt-1 truncate" title={value}>
        {value}
      </div>
    </div>
  )
}
