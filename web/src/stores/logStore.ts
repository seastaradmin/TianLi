// stores/logStore.ts
import { create } from 'zustand'
import type { LogEntry, LogLevel } from '../types'

const MAX_LOGS = 1000

interface LogState {
  logs: LogEntry[]
  autoScroll: boolean
  filter: LogLevel[]
  addLog: (log: LogEntry) => void
  addLogs: (logs: LogEntry[]) => void
  clearLogs: () => void
  setAutoScroll: (enabled: boolean) => void
  setFilter: (levels: LogLevel[]) => void
}

export const useLogStore = create<LogState>((set, get) => ({
  logs: [],
  autoScroll: true,
  filter: ['INFO', 'WARN', 'ERROR', 'DEBUG'],
  
  addLog: (log) => {
    set((state) => {
      const newLogs = [...state.logs, log]
      // 保持日志数量在限制内
      if (newLogs.length > MAX_LOGS) {
        newLogs.shift()
      }
      return { logs: newLogs }
    })
  },
  
  addLogs: (logs) => {
    set((state) => {
      const newLogs = [...state.logs, ...logs]
      if (newLogs.length > MAX_LOGS) {
        newLogs.splice(0, newLogs.length - MAX_LOGS)
      }
      return { logs: newLogs }
    })
  },
  
  clearLogs: () => set({ logs: [] }),
  
  setAutoScroll: (enabled) => set({ autoScroll: enabled }),
  
  setFilter: (levels) => set({ filter: levels }),
  
  // 辅助方法：获取过滤后的日志
  getFilteredLogs: () => {
    const { logs, filter } = get()
    return logs.filter(log => filter.includes(log.level))
  }
}))
