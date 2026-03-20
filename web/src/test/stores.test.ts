// src/test/stores.test.ts - Zustand Stores 测试
import { describe, it, expect } from 'vitest'
import { useLogStore } from '../stores/logStore'
import { useStatsStore } from '../stores/statsStore'
import type { LogEntry } from '../types'

describe('LogStore', () => {
  it('should add a log entry', () => {
    const log: LogEntry = {
      id: 1,
      time: '10:00:00',
      level: 'INFO',
      module: 'TEST',
      msg: 'Test message'
    }

    useLogStore.getState().clearLogs()
    useLogStore.getState().addLog(log)

    const logs = useLogStore.getState().logs
    expect(logs.length).toBe(1)
    expect(logs[0].msg).toBe('Test message')
  })

  it('should clear all logs', () => {
    useLogStore.getState().addLog({
      id: 2,
      time: '10:00:01',
      level: 'DEBUG',
      module: 'TEST',
      msg: 'Another message'
    })

    useLogStore.getState().clearLogs()
    expect(useLogStore.getState().logs.length).toBe(0)
  })

  it('should respect MAX_LOGS limit', () => {
    useLogStore.getState().clearLogs()
    
    // 添加 1001 条日志
    for (let i = 0; i < 1001; i++) {
      useLogStore.getState().addLog({
        id: i,
        time: '10:00:00',
        level: 'INFO',
        module: 'TEST',
        msg: `Log ${i}`
      })
    }

    expect(useLogStore.getState().logs.length).toBe(1000)
  })

  it('should toggle autoScroll', () => {
    const initialState = useLogStore.getState().autoScroll
    useLogStore.getState().setAutoScroll(!initialState)
    expect(useLogStore.getState().autoScroll).toBe(!initialState)
  })

  it('should set filter levels', () => {
    useLogStore.getState().setFilter(['INFO', 'ERROR'])
    expect(useLogStore.getState().filter).toEqual(['INFO', 'ERROR'])
  })
})

describe('StatsStore', () => {
  it('should initialize with default values', () => {
    useStatsStore.getState().reset()
    const state = useStatsStore.getState()
    
    expect(state.status).toBe('idle')
    expect(state.totalSteps).toBe(0)
    expect(state.earlyExits).toBe(0)
    expect(state.l1Passes).toBe(0)
    expect(state.l2Checks).toBe(0)
  })

  it('should update stats', () => {
    useStatsStore.getState().reset()
    useStatsStore.getState().updateStats({ status: 'running', totalSteps: 5 })

    const state = useStatsStore.getState()
    expect(state.status).toBe('running')
    expect(state.totalSteps).toBe(5)
  })

  it('should increment counters', () => {
    useStatsStore.getState().reset()
    
    useStatsStore.getState().incrementStep()
    useStatsStore.getState().incrementStep()
    useStatsStore.getState().incrementL1Pass()
    useStatsStore.getState().incrementL2Check()
    useStatsStore.getState().incrementEarlyExit()

    const state = useStatsStore.getState()
    expect(state.totalSteps).toBe(2)
    expect(state.l1Passes).toBe(1)
    expect(state.l2Checks).toBe(1)
    expect(state.earlyExits).toBe(1)
  })

  it('should reset to initial state', () => {
    useStatsStore.getState().updateStats({ 
      status: 'completed',
      totalSteps: 100,
      l1Passes: 50
    })

    useStatsStore.getState().reset()
    
    const state = useStatsStore.getState()
    expect(state.status).toBe('idle')
    expect(state.totalSteps).toBe(0)
  })
})
