// hooks/useSSE.ts
import { useEffect, useRef, useCallback } from 'react'
import type { LogEntry, Stats, Status } from '../types'

interface UseSSEOptions {
  onLog?: (log: LogEntry) => void
  onStats?: (stats: Stats) => void
  onStatus?: (status: Status) => void
  enabled?: boolean
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const { onLog, onStats, onStatus, enabled = true } = options
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.addEventListener('log', (event) => {
        if (onLog) {
          const log: LogEntry = JSON.parse(event.data)
          onLog(log)
        }
      })

      eventSource.addEventListener('stats', (event) => {
        if (onStats) {
          const stats: Stats = JSON.parse(event.data)
          onStats(stats)
        }
      })

      eventSource.addEventListener('status', (event) => {
        if (onStatus) {
          const status: Status = JSON.parse(event.data)
          onStatus(status)
        }
      })

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        // SSE 会自动重连，这里可以添加重连逻辑或通知用户
      }

      console.log('SSE connected to:', url)
    } catch (error) {
      console.error('Failed to create EventSource:', error)
    }
  }, [url, onLog, onStats, onStatus, enabled])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      console.log('SSE disconnected')
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    connect,
    disconnect,
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN
  }
}
