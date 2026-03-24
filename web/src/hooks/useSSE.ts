import { useCallback, useEffect, useRef, useState } from 'react'
import type { DispatchDecision, LogEntry, RunSummary, SkySnapshot, Stats, UseSSEOptions } from '../types'

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { onLog, onStats, onSkyState, onDispatchDecision, onDeliveryReady, enabled = true } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const retryAttemptRef = useRef(0)
  const [isConnected, setIsConnected] = useState(false)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current === null) {
      return
    }

    window.clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
  }, [])

  const closeEventSource = useCallback(() => {
    if (!eventSourceRef.current) {
      return
    }

    eventSourceRef.current.close()
    eventSourceRef.current = null
  }, [])

  const scheduleReconnect = useCallback(
    (reason: string) => {
      clearReconnectTimer()
      if (!enabled) {
        return
      }

      retryAttemptRef.current += 1
      const attempt = retryAttemptRef.current
      const delay = Math.min(1000 * 2 ** Math.max(0, attempt - 1), 8000)
      console.warn(`[useSSE] ${reason}; reconnecting in ${delay}ms (attempt ${attempt})`, { url })

      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        closeEventSource()
        connect()
      }, delay)
    },
    [clearReconnectTimer, closeEventSource, enabled, url],
  )

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) {
      return
    }

    clearReconnectTimer()
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('open', () => {
      retryAttemptRef.current = 0
      setIsConnected(true)
      console.info('[useSSE] connected', { url })
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
      if (eventSourceRef.current !== eventSource) {
        return
      }

      setIsConnected(false)
      closeEventSource()
      scheduleReconnect('stream disconnected')
    }
  }, [
    clearReconnectTimer,
    closeEventSource,
    enabled,
    onDeliveryReady,
    onDispatchDecision,
    onLog,
    onSkyState,
    onStats,
    scheduleReconnect,
    url,
  ])

  const disconnect = useCallback(() => {
    clearReconnectTimer()
    retryAttemptRef.current = 0
    closeEventSource()
    setIsConnected(false)
  }, [clearReconnectTimer, closeEventSource])

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
