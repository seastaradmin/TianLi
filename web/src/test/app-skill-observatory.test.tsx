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
      deliveryDetails: [
        {
          heroId: 'builder/forge',
          displayName: 'Forge',
          role: 'primary',
          status: 'completed',
          steps: 1,
          summary: 'Forge 完成了首轮交付，并提交了首页大星系重构方案。',
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
          ],
        },
      ],
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
      verdictHistory: [
        {
          verdict: 'approve',
          note: '第一轮方向正确，继续推进。',
          round: 1,
          timestamp: new Date().toISOString(),
        },
      ],
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

  it('selects a session in galaxy view without opening the observatory backstage', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('把首页改成更纯粹的大星系舞台').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /把首页改成更纯粹的大星系舞台/ })[0])

    expect(useSkyStore.getState().selectedNodeId).toBe('task-1')
    expect(screen.queryByRole('dialog', { name: '观测后台' })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#galaxy')
  })

  it('opens the observatory backstage from the edge trigger and falls back to the latest judgment task', async () => {
    render(<App />)

    fireEvent.click(screen.getByLabelText('打开观测后台'))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: '观测后台' })).toBeInTheDocument()
    })

    const dialog = screen.getByRole('dialog', { name: '观测后台' })
    expect(within(dialog).getByText('观测后台')).toBeInTheDocument()
    expect(within(dialog).getAllByText('把首页改成更纯粹的大星系舞台').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('最终裁决')).toBeInTheDocument()
  })

  it('surfaces delivery results, region feedback, and governance state in the observatory', async () => {
    render(<App />)

    fireEvent.click(screen.getByLabelText('打开观测后台'))

    const dialog = await screen.findByRole('dialog', { name: '观测后台' })
    expect(within(dialog).getByText('交付结果')).toBeInTheDocument()
    expect(within(dialog).getByText('Forge 完成了首轮交付，并提交了首页大星系重构方案。')).toBeInTheDocument()
    expect(within(dialog).getAllByText('星域反馈').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('天理主星域')).toBeInTheDocument()
    expect(within(dialog).getAllByText('天劫与天演').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('本轮未触发天劫，暂无天演补丁。')).toBeInTheDocument()
  })

  it('keeps session focus when opening the backstage after selecting a session', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('把首页改成更纯粹的大星系舞台').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /把首页改成更纯粹的大星系舞台/ })[0])
    fireEvent.click(screen.getByLabelText('打开观测后台'))

    const dialog = await screen.findByRole('dialog', { name: '观测后台' })
    expect(within(dialog).getAllByText('把首页改成更纯粹的大星系舞台').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('Forge 完成了首轮交付，并提交了首页大星系重构方案。')).toBeInTheDocument()
    expect(within(dialog).getByText('最终裁决')).toBeInTheDocument()
  })

  it('closes the observatory backstage on Escape', async () => {
    render(<App />)

    fireEvent.click(screen.getByLabelText('打开观测后台'))
    await screen.findByRole('dialog', { name: '观测后台' })

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '观测后台' })).not.toBeInTheDocument()
    })
  })

  it('keeps a newly issued destiny focused after syncing the latest snapshot', async () => {
    const issuedTitle = '验证天命是否被立刻激发'
    const issuedSnapshot: SkySnapshot = {
      ...snapshot,
      status: 'running',
      stats: {
        ...snapshot.stats,
        status: 'running',
        activeTasks: 2,
      },
      heroGalaxy: snapshot.heroGalaxy.map((hero) => ({
        ...hero,
        status: 'running',
        currentTaskId: 'task-ignite',
        currentTaskIds: ['task-ignite'],
      })),
      activeTasks: [
        {
          ...snapshot.activeTasks[0],
          taskId: 'task-ignite',
          title: issuedTitle,
          status: 'routing',
          verdictRound: 0,
          reasoning: 'Forge is taking the ignition lane.',
          deliverySummary: '',
          completedAt: null,
        },
        ...snapshot.activeTasks,
      ],
      judgmentQueue: [],
      lightFlows: [
        {
          ...snapshot.lightFlows[0],
          id: 'flow-ignite',
          taskId: 'task-ignite',
          source: 'task-ignite',
          status: 'routing',
          phase: 'routing',
          round: 0,
        },
      ],
      latestRunSummary: null,
      logs: [],
    }

    let wasIssued = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/api/run/start') && init?.method === 'POST') {
          wasIssued = true
          return {
            ok: true,
            json: async () => ({
              status: 'started',
              taskId: 'task-ignite',
              selectedHeroIds: ['builder/forge'],
              primaryHeroId: 'builder/forge',
            }),
          }
        }

        if (url.endsWith('/api/status')) {
          return {
            ok: true,
            json: async () => (wasIssued ? issuedSnapshot : snapshot),
          }
        }

        return {
          ok: true,
          json: async () => snapshot,
        }
      }),
    )

    render(<App />)

    const input = await screen.findByLabelText('输入新的天命')
    fireEvent.change(input, { target: { value: issuedTitle } })
    fireEvent.click(screen.getByRole('button', { name: '下达天命' }))

    await waitFor(() => {
      expect(useSkyStore.getState().selectedNodeId).toBe('task-ignite')
    })

    const dialog = await screen.findByRole('dialog', { name: '观测后台' })
    expect(within(dialog).getAllByText(issuedTitle).length).toBeGreaterThan(0)
    expect(screen.getAllByText(`天命已激发：${issuedTitle}`).length).toBeGreaterThan(0)
  })

  it('toggles the interface language between Chinese and English', async () => {
    render(<App />)

    const toggle = await screen.findByRole('button', { name: 'Switch to English' })
    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: '切换为中文' })).toBeInTheDocument()
    expect(screen.getByLabelText('Open observatory backstage')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Issue a new destiny/)).toBeInTheDocument()
  })
})
