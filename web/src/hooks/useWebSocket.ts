// hooks/useWebSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react'
import type { LogEntry, Stats, Status, WSMessage } from '../types'

interface UseWebSocketOptions {
  onLog?: (log: LogEntry) => void
  onStats?: (stats: Stats) => void
  onStatus?: (status: Status) => void
  enabled?: boolean
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const { onLog, onStats, onStatus, enabled = true } = options
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = 3000

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected to:', url)
        setIsConnected(true)
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          
          switch (message.type) {
            case 'log':
              if (onLog) onLog(message.data as LogEntry)
              break
            case 'stats':
              if (onStats) onStats(message.data as Stats)
              break
            case 'status':
              if (onStatus) onStatus(message.data as Status)
              break
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        
        // 自动重连
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          console.log(`Reconnecting... (${reconnectAttempts.current}/${maxReconnectAttempts})`)
          setTimeout(connect, reconnectDelay)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
    }
  }, [url, onLog, onStats, onStatus, enabled])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      setIsConnected(false)
      console.log('WebSocket disconnected by user')
    }
  }, [])

  const sendCommand = useCallback((command: 'START' | 'STOP') => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message: WSMessage = { type: 'command', data: { command } }
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, cannot send command:', command)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    connect,
    disconnect,
    sendCommand,
    isConnected
  }
}
