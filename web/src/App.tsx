import {
  Boxes,
  FileStack,
  History,
  LayoutDashboard,
  Orbit,
  ScrollText,
  Workflow,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import './console.css'
import { ConsoleShell, type ConsoleNavItem } from './components/console/ConsoleShell'
import { StarryHomePage } from './components/starry/StarryHomePage'
import ConversationHistory from './pages/ConversationHistory'
import DashboardWithCharts from './pages/DashboardWithCharts'
import Deliverables from './pages/Deliverables'
import GalaxyLabPage from './pages/GalaxyLabPage'
import LiveLogs from './pages/LiveLogs'
import SkillManager from './pages/SkillManager'
import SubAgentsVisualization from './pages/SubAgentsVisualization'

const NAV_ITEMS: ConsoleNavItem[] = [
  {
    path: '/',
    label: '星空',
    description: '沉浸式星空界面，与 Hero 互动完成任务。',
    icon: Orbit,
  },
  {
    path: '/dashboard',
    label: '仪表盘',
    description: '任务入口、待裁决区、运行概览和关键趋势。',
    icon: LayoutDashboard,
  },
  {
    path: '/deliverables',
    label: '交付结果',
    description: '查看真实产物、文件类型、体积与下载入口。',
    icon: FileStack,
  },
  {
    path: '/live-logs',
    label: '实时日志',
    description: '历史日志 + SSE 增量流，不再依赖 mock 数据。',
    icon: ScrollText,
  },
  {
    path: '/conversation-history',
    label: '对话历史',
    description: '按 task_id 聚合关键消息，支持跨重启查看。',
    icon: History,
  },
  {
    path: '/skill-manager',
    label: '技能管理',
    description: '真实列出本地 skills、来源和 Hero 关联关系。',
    icon: Boxes,
  },
  {
    path: '/sub-agents',
    label: 'Sub-agents',
    description: '展示当前任务、Hero 轮次、状态和进度。',
    icon: Workflow,
  },
  {
    path: '/galaxy',
    label: '实验星图',
    description: '保留原星图和观测后台，降级为实验入口。',
    icon: Orbit,
  },
]

function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/'
  }
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function renderRoute(pathname: string) {
  switch (pathname) {
    case '/':
      return <StarryHomePage />
    case '/dashboard':
      return <DashboardWithCharts />
    case '/deliverables':
      return <Deliverables />
    case '/live-logs':
      return <LiveLogs />
    case '/conversation-history':
      return <ConversationHistory />
    case '/skill-manager':
      return <SkillManager />
    case '/sub-agents':
      return <SubAgentsVisualization />
    case '/galaxy':
      return <GalaxyLabPage />
    default:
      return null
  }
}

export default function App() {
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? '/' : normalizePath(window.location.pathname),
  )

  useEffect(() => {
    const handlePopState = () => setPathname(normalizePath(window.location.pathname))
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const current = NAV_ITEMS.find((item) => item.path === pathname)
    document.title = current ? `${current.label} | TianLi Console` : 'TianLi Console'
  }, [pathname])

  const navigate = (nextPath: string) => {
    const normalized = normalizePath(nextPath)
    if (normalized === pathname) {
      return
    }
    window.history.pushState({}, '', normalized)
    setPathname(normalized)
  }

  const route = renderRoute(pathname)
  if (!route) {
    return (
      <ConsoleShell currentPath="/" navItems={NAV_ITEMS} onNavigate={navigate}>
        <div className="console-card console-empty">
          <h3 className="console-card-title">这个页面不存在。</h3>
          <p className="console-card-copy">
            Formal console routes are mounted under the configured cockpit pages. Use the navigation to return to a live surface.
          </p>
          <button className="console-button console-button-primary" onClick={() => navigate('/')}>
            返回仪表盘
          </button>
        </div>
      </ConsoleShell>
    )
  }

  if (pathname === '/galaxy') {
    return route
  }

  return (
    <ConsoleShell currentPath={pathname} navItems={NAV_ITEMS} onNavigate={navigate}>
      {route}
    </ConsoleShell>
  )
}
