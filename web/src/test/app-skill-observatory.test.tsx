import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import App from '../App'
import { useLogStore, useSkyStore, useStatsStore } from '../stores'
import type { SkySnapshot } from '../types'

vi.mock('../hooks', () => ({
  useSSE: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: true,
  }),
}))


const snapshot: SkySnapshot = {
  status: 'judgment_pending',
  stats: {
    status: 'judgment_pending',
    totalSteps: 5,
    earlyExits: 0,
    l1Passes: 5,
    l2Checks: 2,
    activeHeroes: 2,
    activeTasks: 1,
  },
  heroGalaxy: [
    {
      heroId: 'builder/forge',
      displayName: 'Forge',
      description: 'Builds the core experience.',
      tags: ['frontend', 'implement'],
      tools: ['Read', 'Write'],
      linkedSkills: ['browser-devtools-cli', 'ui-design-review'],
      color: '#f59e0b',
      x: 0.28,
      y: 0.35,
      status: 'running',
      load: 0.85,
      queueDepth: 1,
      currentTaskId: 'task-1',
      currentTaskIds: ['task-1'],
      source: 'local',
    },
  ],
  activeTasks: [
    {
      taskId: 'task-1',
      title: '把首页改成更纯粹的大星系舞台',
      status: 'judgment_pending',
      pinnedHeroIds: [],
      selectedHeroIds: ['builder/forge'],
      primaryHeroId: 'builder/forge',
      consultHeroIds: [],
      candidateHeroIds: ['builder/forge'],
      maxFanout: 1,
      dispatchMode: 'hybrid',
      collaborationMode: 'primary_consult',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reasoning: 'Forge is the primary hero.',
      verdictRound: 1,
      judgmentNote: '',
      verdictStatus: null,
      deliverySummary: 'Forge 已提交首轮首页方案。',
      deliveryDetails: [],
      skillDispatches: [
        {
          taskId: 'task-1',
          heroId: 'builder/forge',
          role: 'primary',
          skillId: 'ui-design-review',
          status: 'applied',
          executionStatus: 'completed',
          contribution: '检查了 web/src/App.tsx。主要视觉问题：首页仍保留说明文案和状态行。',
          latencyMs: 14,
        },
        {
          taskId: 'task-1',
          heroId: 'builder/forge',
          role: 'primary',
          skillId: 'browser-devtools-cli',
          status: 'applied',
          executionStatus: 'completed',
          contribution: '已对 http://127.0.0.1:4174/ 执行轻量页面探测。标题：TianLi。',
          latencyMs: 38,
        },
      ],
      completedAt: new Date().toISOString(),
      history: [],
      verdictHistory: [],
    },
  ],
  judgmentQueue: [],
  lightFlows: [
    {
      id: 'flow-1',
      taskId: 'task-1',
      source: 'task-1',
      target: 'builder/forge',
      heroId: 'builder/forge',
      status: 'running',
      phase: 'running',
      label: 'Forge',
      role: 'primary',
      round: 1,
      animated: true,
      createdAt: new Date().toISOString(),
    },
  ],
  latestDispatchDecision: null,
  latestRunSummary: {
    taskId: 'task-1',
    selectedHeroIds: ['builder/forge'],
    status: 'judgment_pending',
    results: [],
    completedAt: new Date().toISOString(),
    deliverySummary: 'Forge 已提交首轮首页方案。',
  },
  logs: [],
}

describe('App galaxy and observatory drawer', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.restoreAllMocks()
    useSkyStore.getState().clear()
    useLogStore.getState().clearLogs()
    useStatsStore.getState().reset()
    window.localStorage.removeItem('tianli-language')
    window.history.replaceState(null, '', '#galaxy')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => snapshot,
      })),
    )
  })

  it('selects a hero in galaxy view without opening the observatory drawer', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Forge')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Forge'))

    expect(screen.getByLabelText('节点速览')).toBeInTheDocument()
    expect(screen.getByText(/当前天命：把首页改成更纯粹的大星系舞台/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '观测抽屉' })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#galaxy')
  })

  it('opens the observatory drawer from the edge trigger and falls back to the latest judgment task', async () => {
    render(<App />)

    fireEvent.click(screen.getByLabelText('打开观测抽屉'))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '观测抽屉' })).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog', { name: '观测抽屉' })
    expect(within(dialog).getByText('观测抽屉')).toBeInTheDocument()
    expect(within(dialog).getAllByText('把首页改成更纯粹的大星系舞台').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('最终裁决')).toBeInTheDocument()
  })

  it('keeps hero focus when opening the drawer after selecting a hero', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Forge')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Forge'))
    fireEvent.click(screen.getByLabelText('打开观测抽屉'))

    const dialog = await screen.findByRole('dialog', { name: '观测抽屉' })
    expect(within(dialog).getAllByText('Forge').length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText('Builds the core experience.').length).toBeGreaterThan(0)
    expect(within(dialog).queryByText('最终裁决')).not.toBeInTheDocument()
  })

  it('closes the observatory drawer on Escape', async () => {
    render(<App />)

    fireEvent.click(screen.getByLabelText('打开观测抽屉'))
    await screen.findByRole('dialog', { name: '观测抽屉' })

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '观测抽屉' })).not.toBeInTheDocument()
    })
  })

  it('toggles the interface language between Chinese and English', async () => {
    render(<App />)

    const toggle = await screen.findByRole('button', { name: 'Switch to English' })
    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: '切换为中文' })).toBeInTheDocument()
    expect(screen.getByLabelText('Open observatory drawer')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Issue a new destiny/)).toBeInTheDocument()
  })
})
