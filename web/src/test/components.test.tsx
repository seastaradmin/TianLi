// src/test/components.test.tsx - 组件测试
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '../components/Header'
import { StatusCard } from '../components/StatusCard'
import { LogLine } from '../components/LogLine'
import type { LogEntry } from '../types'

describe('Header', () => {
  it('should render with default title', () => {
    render(<Header />)
    expect(screen.getByText('TianLi Console')).toBeInTheDocument()
    expect(screen.getByText('天理 Harness · 实时控制台')).toBeInTheDocument()
  })

  it('should render with custom title', () => {
    render(<Header title="Custom Title" subtitle="Custom Subtitle" />)
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom Subtitle')).toBeInTheDocument()
  })
})

describe('StatusCard', () => {
  it('should render basic card', () => {
    render(<StatusCard title="Test" value="123" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText('123')).toBeInTheDocument()
  })

  it('should render with icon', () => {
    render(<StatusCard title="Status" value="Running" icon="🔄" />)
    expect(screen.getByText('🔄')).toBeInTheDocument()
  })

  it('should apply color classes', () => {
    const { container } = render(<StatusCard title="Error" value="Failed" color="red" />)
    expect(container.firstChild).toHaveClass('bg-red-900/30')
  })
})

describe('LogLine', () => {
  const mockLog: LogEntry = {
    id: 1,
    time: '10:00:00',
    level: 'INFO',
    module: 'TEST_MODULE',
    msg: 'Test log message'
  }

  it('should render log entry', () => {
    render(<LogLine log={mockLog} />)
    expect(screen.getByText('10:00:00')).toBeInTheDocument()
    expect(screen.getByText('INFO')).toBeInTheDocument()
    expect(screen.getByText('TEST_MODULE')).toBeInTheDocument()
    expect(screen.getByText('Test log message')).toBeInTheDocument()
  })

  it('should render different levels with correct colors', () => {
    const { rerender } = render(<LogLine log={{ ...mockLog, level: 'ERROR' }} />)
    expect(screen.getByText('❌')).toBeInTheDocument()
    expect(screen.getByText('ERROR')).toBeInTheDocument()

    rerender(<LogLine log={{ ...mockLog, level: 'WARN' }} />)
    expect(screen.getByText('⚠️')).toBeInTheDocument()
    expect(screen.getByText('WARN')).toBeInTheDocument()
  })
})
