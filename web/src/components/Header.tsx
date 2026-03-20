// components/Header.tsx
import React from 'react'

interface HeaderProps {
  title?: string
  subtitle?: string
}

export function Header({ title = 'TianLi Console', subtitle = '天理 Harness · 实时控制台' }: HeaderProps) {
  return (
    <header className="mb-6">
      <div className="flex items-center gap-3">
        <div className="text-3xl">🌟</div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-400">{title}</h1>
          <p className="text-gray-400 text-sm">{subtitle}</p>
        </div>
      </div>
    </header>
  )
}
