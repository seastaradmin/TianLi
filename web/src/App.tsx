import { useEffect, useMemo, useState } from 'react'

import { DestinyConsole } from './components/DestinyConsole'
import { GalaxyPage } from './components/galaxy/GalaxyPage'
import { ObservatoryDrawer } from './components/observatory/ObservatoryDrawer'
import { useSSE } from './hooks'
import { t } from './i18n'
import type { Language, UiAnchor } from './types'
import { useLogStore, useSkyStore, useStatsStore } from './stores'
import type { HeroState, SkySnapshot, SkillDispatchState, TaskState } from './types'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:1420'
const SSE_URL = `${API_BASE}/api/logs`
const LANGUAGE_STORAGE_KEY = 'tianli-language'

type SkillTraceState = SkillDispatchState & { taskTitle?: string }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

function resolveHeroTask(tasks: TaskState[], heroId: string, currentTaskId?: string | null) {
  if (currentTaskId) {
    const directTask = tasks.find((task) => task.taskId === currentTaskId)
    if (directTask) {
      return directTask
    }
  }
  return tasks.find((task) => task.selectedHeroIds.includes(heroId)) ?? null
}

function collectHeroSkillDispatches(tasks: TaskState[], heroId: string, preferredTaskId?: string | null): SkillTraceState[] {
  return tasks
    .flatMap((task) =>
      (task.skillDispatches ?? [])
        .filter((skill) => skill.heroId === heroId && skill.status === 'applied')
        .map((skill) => ({ ...skill, taskTitle: task.title, taskId: task.taskId })),
    )
    .sort((left, right) => {
      const leftPreferred = preferredTaskId && left.taskId === preferredTaskId ? 1 : 0
      const rightPreferred = preferredTaskId && right.taskId === preferredTaskId ? 1 : 0
      if (leftPreferred !== rightPreferred) {
        return rightPreferred - leftPreferred
      }
      const leftCompleted = left.executionStatus === 'completed' ? 1 : 0
      const rightCompleted = right.executionStatus === 'completed' ? 1 : 0
      return rightCompleted - leftCompleted
    })
}

function App() {
  const logs = useLogStore((state) => state.logs)
  const addLog = useLogStore((state) => state.addLog)
  const addLogs = useLogStore((state) => state.addLogs)
  const clearLogs = useLogStore((state) => state.clearLogs)

  const stats = useStatsStore((state) => ({
    status: state.status,
    totalSteps: state.totalSteps,
    earlyExits: state.earlyExits,
    l1Passes: state.l1Passes,
    l2Checks: state.l2Checks,
    activeHeroes: state.activeHeroes,
    activeTasks: state.activeTasks,
  }))
  const hydrateStats = useStatsStore((state) => state.hydrate)

  const heroes = useSkyStore((state) => state.heroes)
  const tasks = useSkyStore((state) => state.tasks)
  const judgmentQueue = useSkyStore((state) => state.judgmentQueue)
  const flows = useSkyStore((state) => state.flows)
  const runSummary = useSkyStore((state) => state.runSummary)
  const selectedNodeId = useSkyStore((state) => state.selectedNodeId)
  const hoverHudNodeId = useSkyStore((state) => state.hoverHudNodeId)
  const hoverHudAnchor = useSkyStore((state) => state.hoverHudAnchor)
  const isObservatoryOpen = useSkyStore((state) => state.isObservatoryOpen)
  const drawerOrigin = useSkyStore((state) => state.drawerOrigin)
  const hydrateSky = useSkyStore((state) => state.hydrate)
  const selectNode = useSkyStore((state) => state.selectNode)
  const setHoverHudNode = useSkyStore((state) => state.setHoverHudNode)
  const openObservatory = useSkyStore((state) => state.openObservatory)
  const closeObservatory = useSkyStore((state) => state.closeObservatory)

  const [taskInput, setTaskInput] = useState('')
  const [pinnedHeroInput, setPinnedHeroInput] = useState('')
  const [judgmentInput, setJudgmentInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') {
      return 'zh'
    }
    const persisted = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return persisted === 'en' ? 'en' : 'zh'
  })

  const { isConnected } = useSSE(SSE_URL, {
    enabled: true,
    onLog: addLog,
    onStats: hydrateStats,
    onSkyState: (snapshot) => {
      hydrateSky(snapshot)
      hydrateStats(snapshot.stats)
    },
  })

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const snapshot = await fetchJson<SkySnapshot>(`${API_BASE}/api/status`)
        hydrateSky(snapshot)
        hydrateStats(snapshot.stats)
        clearLogs()
        addLogs(snapshot.logs)
      } catch (error) {
        addLog({
          id: `boot-${Date.now()}`,
          time: new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US'),
          level: 'WARN',
          module: 'UI',
          msg: t(language, 'load_snapshot_failed', { error: String(error) }),
          msgZh: t('zh', 'load_snapshot_failed', { error: String(error) }),
          msgEn: t('en', 'load_snapshot_failed', { error: String(error) }),
        })
      }
    }

    void loadSnapshot()
  }, [addLog, addLogs, clearLogs, hydrateSky, hydrateStats])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    if (!selectedNodeId) {
      return
    }

    const nodeStillExists =
      heroes.some((hero) => hero.heroId === selectedNodeId) || tasks.some((task) => task.taskId === selectedNodeId)

    if (!nodeStillExists) {
      selectNode(null)
      setHoverHudNode(null, null)
    }
  }, [heroes, selectedNodeId, selectNode, setHoverHudNode, tasks])

  useEffect(() => {
    if (!hoverHudNodeId) {
      return
    }

    const nodeStillExists =
      heroes.some((hero) => hero.heroId === hoverHudNodeId) || tasks.some((task) => task.taskId === hoverHudNodeId)

    if (!nodeStillExists) {
      setHoverHudNode(null, null)
    }
  }, [heroes, hoverHudNodeId, setHoverHudNode, tasks])

  const selectedHero = heroes.find((hero) => hero.heroId === selectedNodeId) ?? null
  const selectedTask = tasks.find((task) => task.taskId === selectedNodeId) ?? null
  const fallbackJudgmentTask = judgmentQueue[0] ?? tasks.find((task) => task.status === 'judgment_pending') ?? null
  const selectedHeroTask = selectedHero ? resolveHeroTask(tasks, selectedHero.heroId, selectedHero.currentTaskId) : null
  const latestTask = tasks[0] ?? null
  const focusTask = selectedTask ?? selectedHeroTask ?? fallbackJudgmentTask ?? latestTask
  const focusHero =
    selectedHero ??
    (focusTask?.primaryHeroId ? heroes.find((hero) => hero.heroId === focusTask.primaryHeroId) ?? null : heroes[0] ?? null)
  const focusKind: 'hero' | 'task' = selectedHero ? 'hero' : focusTask ? 'task' : focusHero ? 'hero' : 'task'
  const consultHeroes = useMemo(
    () =>
      (focusTask?.consultHeroIds ?? [])
        .map((heroId) => heroes.find((hero) => hero.heroId === heroId) ?? null)
        .filter((hero): hero is HeroState => hero !== null),
    [focusTask, heroes],
  )
  const focusSkillDispatches: SkillTraceState[] = selectedHero
    ? collectHeroSkillDispatches(tasks, selectedHero.heroId, selectedHeroTask?.taskId)
    : (focusTask?.skillDispatches ?? [])
        .filter((skill) => skill.status === 'applied')
        .map((skill) => ({ ...skill, taskTitle: focusTask?.title }))
  const recentLogs = useMemo(() => logs.slice(-10).reverse(), [logs])
  const activeJudgmentTarget = focusTask?.status === 'judgment_pending' ? focusTask : fallbackJudgmentTask

  const handleIssueDestiny = async () => {
    const content = taskInput.trim()
    if (!content) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetchJson<{ taskId: string }>(`${API_BASE}/api/run/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: content,
          pinnedHeroIds: pinnedHeroInput
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          maxFanout: 3,
          dispatchMode: 'hybrid',
          collaborationMode: 'primary_consult',
        }),
      })

      selectNode(response.taskId)
      setHoverHudNode(response.taskId, hoverHudAnchor)
      setTaskInput('')
      setJudgmentInput('')
    } catch (error) {
      addLog({
        id: `start-${Date.now()}`,
        time: new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US'),
        level: 'ERROR',
        module: 'UI',
        msg: t(language, 'issue_destiny_failed', { error: String(error) }),
        msgZh: t('zh', 'issue_destiny_failed', { error: String(error) }),
        msgEn: t('en', 'issue_destiny_failed', { error: String(error) }),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerdict = async (verdict: 'approve' | 'reject') => {
    if (!activeJudgmentTarget) {
      return
    }

    setIsSubmitting(true)
    try {
      await fetchJson(`${API_BASE}/api/run/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: activeJudgmentTarget.taskId,
          verdict,
          judgmentNote: judgmentInput,
        }),
      })
      setJudgmentInput('')
      selectNode(activeJudgmentTarget.taskId)
      setHoverHudNode(activeJudgmentTarget.taskId, hoverHudAnchor)
    } catch (error) {
      addLog({
        id: `verdict-${Date.now()}`,
        time: new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US'),
        level: 'ERROR',
        module: 'UI',
        msg: t(language, 'verdict_submit_failed', { error: String(error) }),
        msgZh: t('zh', 'verdict_submit_failed', { error: String(error) }),
        msgEn: t('en', 'verdict_submit_failed', { error: String(error) }),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRefreshSkills = async () => {
    try {
      await fetchJson(`${API_BASE}/api/skills/refresh`, { method: 'POST' })
      addLog({
        id: `refresh-${Date.now()}`,
        time: new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US'),
        level: 'INFO',
        module: 'UI',
        msg: t(language, 'refresh_sources_success'),
        msgZh: t('zh', 'refresh_sources_success'),
        msgEn: t('en', 'refresh_sources_success'),
      })
    } catch (error) {
      addLog({
        id: `refresh-${Date.now()}`,
        time: new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US'),
        level: 'WARN',
        module: 'UI',
        msg: t(language, 'refresh_sources_failed', { error: String(error) }),
        msgZh: t('zh', 'refresh_sources_failed', { error: String(error) }),
        msgEn: t('en', 'refresh_sources_failed', { error: String(error) }),
      })
    }
  }

  const handleGalaxySelect = (nodeId: string | null, anchor?: UiAnchor | null) => {
    selectNode(nodeId)
    setHoverHudNode(nodeId, anchor ?? null)
  }

  const handleDrawerSelect = (nodeId: string | null) => {
    selectNode(nodeId)
    setHoverHudNode(nodeId, undefined)
  }

  const handleOpenObservatory = (origin?: UiAnchor | null) => {
    openObservatory(hoverHudAnchor ?? origin ?? null)
  }

  const handleToggleLanguage = () => {
    setLanguage((current) => (current === 'zh' ? 'en' : 'zh'))
  }

  return (
    <div className={`app-shell ${isObservatoryOpen ? 'app-shell-drawer-open' : ''}`}>
      <div className="app-orb app-orb-a" />
      <div className="app-orb app-orb-b" />
      <div className="app-grid" />

      <GalaxyPage
        heroes={heroes}
        tasks={tasks}
        flows={flows}
        selectedNodeId={selectedNodeId}
        hoverHudNodeId={hoverHudNodeId}
        hoverHudAnchor={hoverHudAnchor}
        isConnected={isConnected}
        isObservatoryOpen={isObservatoryOpen}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onSelectNode={handleGalaxySelect}
        onOpenObservatory={handleOpenObservatory}
      />

      <ObservatoryDrawer
        isOpen={isObservatoryOpen}
        selectedNodeId={selectedNodeId}
        drawerOrigin={drawerOrigin}
        language={language}
        focusKind={focusKind}
        focusTask={focusTask}
        focusHero={focusHero}
        consultHeroes={consultHeroes}
        skillDispatches={focusSkillDispatches}
        logs={recentLogs}
        stats={stats}
        heroes={heroes}
        tasks={tasks}
        runSummary={runSummary}
        judgmentInput={judgmentInput}
        isSubmitting={isSubmitting}
        onToggleLanguage={handleToggleLanguage}
        onClose={closeObservatory}
        onSelectNode={handleDrawerSelect}
        onJudgmentInputChange={setJudgmentInput}
        onVerdict={handleVerdict}
      />

      <DestinyConsole
        language={language}
        taskInput={taskInput}
        pinnedHeroInput={pinnedHeroInput}
        isSubmitting={isSubmitting}
        onTaskInputChange={setTaskInput}
        onPinnedHeroInputChange={setPinnedHeroInput}
        onIssueDestiny={handleIssueDestiny}
        onRefreshSkills={handleRefreshSkills}
      />
    </div>
  )
}

export default App
