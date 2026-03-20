// stores/statsStore.ts
import { create } from 'zustand'
import type { Stats, Status } from '../types'

interface StatsState extends Stats {
  updateStats: (stats: Partial<StatsState>) => void
  reset: () => void
  setStatus: (status: Status) => void
  incrementStep: () => void
  incrementEarlyExit: () => void
  incrementL1Pass: () => void
  incrementL2Check: () => void
}

const initialState: Stats = {
  status: 'idle',
  totalSteps: 0,
  earlyExits: 0,
  l1Passes: 0,
  l2Checks: 0
}

export const useStatsStore = create<StatsState>((set) => ({
  ...initialState,
  
  updateStats: (stats) => set((state) => ({ ...state, ...stats })),
  
  reset: () => set({ ...initialState }),
  
  setStatus: (status) => set({ status }),
  
  incrementStep: () => set((state) => ({ totalSteps: state.totalSteps + 1 })),
  
  incrementEarlyExit: () => set((state) => ({ earlyExits: state.earlyExits + 1 })),
  
  incrementL1Pass: () => set((state) => ({ l1Passes: state.l1Passes + 1 })),
  
  incrementL2Check: () => set((state) => ({ l2Checks: state.l2Checks + 1 }))
}))
