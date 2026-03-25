import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSSE } from '../hooks/useSSE'
import type { SkySnapshot } from '../types'

type EventHandler = (event: MessageEvent<string>) => void

class MockEventSource {
  static instances: MockEventSource[] = []

  url: string
  listeners = new Map<string, EventHandler>()
  close = vi.fn()
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener as EventHandler)
  }

  emit(type: string, data: unknown) {
    const listener = this.listeners.get(type)
    listener?.({ data: JSON.stringify(data) } as MessageEvent<string>)
  }
}

function TestHarness({ onSkyState }: { onSkyState: (snapshot: SkySnapshot) => void }) {
  useSSE('/api/logs/stream', { enabled: true, onSkyState })
  return null
}

describe('useSSE', () => {
  afterEach(() => {
    MockEventSource.instances = []
    vi.unstubAllGlobals()
  })

  it('keeps a single EventSource connection while using the latest handlers', () => {
    vi.stubGlobal('EventSource', MockEventSource)

    const firstHandler = vi.fn()
    const nextHandler = vi.fn()
    const snapshot = {
      status: 'idle',
      stats: {
        status: 'idle',
        totalSteps: 0,
        earlyExits: 0,
        l1Passes: 0,
        l2Checks: 0,
        activeHeroes: 0,
        activeTasks: 0,
      },
      heroGalaxy: [],
      activeTasks: [],
      judgmentQueue: [],
      lightFlows: [],
      latestDispatchDecision: null,
      latestRunSummary: null,
      logs: [],
    } satisfies SkySnapshot

    const { rerender, unmount } = render(<TestHarness onSkyState={firstHandler} />)

    expect(MockEventSource.instances).toHaveLength(1)
    const source = MockEventSource.instances[0]

    rerender(<TestHarness onSkyState={nextHandler} />)

    expect(MockEventSource.instances).toHaveLength(1)
    expect(source.close).not.toHaveBeenCalled()

    source.emit('sky_state', snapshot)

    expect(firstHandler).not.toHaveBeenCalled()
    expect(nextHandler).toHaveBeenCalledWith(snapshot)

    unmount()

    expect(source.close).toHaveBeenCalledTimes(1)
  })
})
