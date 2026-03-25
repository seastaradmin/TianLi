import { Activity, Orbit, Sparkles } from 'lucide-react'
import { type ComponentType, type ReactNode, useEffect, useState } from 'react'

import type { SkySnapshot } from '../../types'
import { apiUrl } from '../../utils/api'

export interface ConsoleNavItem {
  path: string
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

interface ConsoleShellProps {
  children: ReactNode
  currentPath: string
  navItems: ConsoleNavItem[]
  onNavigate: (path: string) => void
}

async function fetchSnapshot(): Promise<SkySnapshot> {
  const response = await fetch(apiUrl('/api/status'))
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json() as Promise<SkySnapshot>
}

function formatRuntimeStatus(snapshot: SkySnapshot | null) {
  if (!snapshot) {
    return { label: '同步中', tone: 'info' as const }
  }

  if (snapshot.status === 'judgment_pending') {
    return { label: '待裁决', tone: 'warning' as const }
  }

  if (snapshot.status === 'running' || snapshot.status === 'routing') {
    return { label: '实时运行中', tone: 'info' as const }
  }

  if (snapshot.status === 'error' || snapshot.status === 'failed') {
    return { label: '需要处理', tone: 'danger' as const }
  }

  return { label: '待命', tone: 'success' as const }
}

export function ConsoleShell({ children, currentPath, navItems, onNavigate }: ConsoleShellProps) {
  const [snapshot, setSnapshot] = useState<SkySnapshot | null>(null)

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const next = await fetchSnapshot()
        if (alive) {
          setSnapshot(next)
        }
      } catch (error) {
        console.warn('[ConsoleShell] failed to load snapshot', error)
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 12_000)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const currentNav = navItems.find((item) => item.path === currentPath) ?? navItems[0]
  const runtimeStatus = formatRuntimeStatus(snapshot)

  return (
    <div className="console-root">
      <a className="console-skip" href="#console-content">
        Skip to content
      </a>

      <div className="console-shell">
        <aside className="console-sidebar">
          <div className="console-brand">
            <div className="console-brand-kicker">
              <Orbit className="h-4 w-4" />
              <span>TianLi AI Console</span>
            </div>
            <h1 className="console-brand-title">天理 Harness 的正式运营控制台。</h1>
            <p className="console-brand-copy">
              真实任务、真实交付物、真实审计状态。星图仍然保留，但不再遮住真正的工作流。
            </p>
          </div>

          <nav className="console-nav" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  aria-current={item.path === currentPath ? 'page' : undefined}
                  className="console-nav-link"
                  type="button"
                  onClick={() => onNavigate(item.path)}
                >
                  <Icon className="h-5 w-5" />
                  <span>
                    <span className="console-nav-link-title">{item.label}</span>
                    <span className="console-nav-link-copy">{item.description}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="console-sidebar-card">
            <h2>运行脉搏</h2>
            <p>
              正式控制台和实验星图共用同一套实时后端，只是这里用 AI 控制台的方式把它清晰铺开。
            </p>
            <div className="console-chip-row" style={{ marginTop: '1rem' }}>
              <span className="console-pill" data-tone={runtimeStatus.tone}>
                <Activity className="h-4 w-4" />
                {runtimeStatus.label}
              </span>
              <span className="console-pill">
                任务 {snapshot?.stats.activeTasks ?? 0}
              </span>
              <span className="console-pill">
                Hero {snapshot?.stats.activeHeroes ?? 0}
              </span>
            </div>
          </div>

          <div className="console-sidebar-card">
            <h3>设计权威</h3>
            <p>
              页面遵循已安装的 <span className="console-code">ui-ux-pro-max</span> 与 <span className="console-code">design-system</span>：
              语义 token、明确层级、可见焦点、没有装饰性空舞台。
            </p>
          </div>
        </aside>

        <main className="console-main">
          <div className="console-topbar">
            <div className="console-topbar-group">
              <span className="console-pill" data-tone={runtimeStatus.tone}>
                <Sparkles className="h-4 w-4" />
                {runtimeStatus.label}
              </span>
              <span className="console-pill">
                待裁决 {snapshot?.judgmentQueue.length ?? 0}
              </span>
            </div>
            <div className="console-topbar-group">
              <span className="console-pill">
                API <span className="console-code">localhost:8000</span>
              </span>
              <span className="console-pill">
                UI <span className="console-code">localhost:1421</span>
              </span>
            </div>
          </div>

          <div className="console-content" id="console-content">
            <section className="console-page">
              <header className="console-page-header">
                <div>
                  <h2 className="console-page-title">{currentNav.label}</h2>
                  <p className="console-page-copy">{currentNav.description}</p>
                </div>
              </header>
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
