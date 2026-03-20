// types/index.ts

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export type Status = 'idle' | 'running' | 'completed' | 'error'

export interface LogEntry {
  id: number
  time: string
  level: LogLevel
  module: string
  msg: string
}

export interface Stats {
  status: Status
  totalSteps: number
  earlyExits: number
  l1Passes: number
  l2Checks: number
}

export interface SSEMessage {
  type: 'log' | 'stats' | 'status'
  data: LogEntry | Stats | Status
}

export interface WSMessage {
  type: 'log' | 'stats' | 'status' | 'command'
  data: LogEntry | Stats | Status | { command: 'START' | 'STOP' }
}
