import { useCallback, useEffect, useRef, useState } from 'react'
import type { DispatchDecision, LogEntry, RunSummary, SkySnapshot, Stats, UseSSEOptions } from '../types'

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { onLog, onStats, onSkyState, onDispatchDecision, onDeliveryReady, enabled = true } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) {
      return
    }

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('open', () => {
      setIsConnected(true)
    })

    eventSource.addEventListener('log', (event) => {
      onLog?.(JSON.parse(event.data) as LogEntry)
    })

    eventSource.addEventListener('stats', (event) => {
      onStats?.(JSON.parse(event.data) as Stats)
    })

    eventSource.addEventListener('sky_state', (event) => {
      onSkyState?.(JSON.parse(event.data) as SkySnapshot)
    })

    eventSource.addEventListener('dispatch_decision', (event) => {
      onDispatchDecision?.(JSON.parse(event.data) as DispatchDecision)
    })

    eventSource.addEventListener('delivery_ready', (event) => {
      onDeliveryReady?.(JSON.parse(event.data) as RunSummary)
    })

    eventSource.addEventListener('run_summary', (event) => {
      onDeliveryReady?.(JSON.parse(event.data) as RunSummary)
    })

    eventSource.onerror = () => {
      setIsConnected(false)
    }
  }, [enabled, onDeliveryReady, onDispatchDecision, onLog, onSkyState, onStats, url])

  const disconnect = useCallback(() => {
    if (!eventSourceRef.current) {
      return
    }
    eventSourceRef.current.close()
    eventSourceRef.current = null
    setIsConnected(false)
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    connect,
    disconnect,
    isConnected,
  }
}
