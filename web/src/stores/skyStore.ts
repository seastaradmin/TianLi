import { create } from 'zustand'
import type { DispatchDecision, DrawerFocusMode, FlowState, HeroState, RunSummary, SkySnapshot, TaskState, UiAnchor } from '../types'

interface SkyState {
  heroes: HeroState[]
  tasks: TaskState[]
  judgmentQueue: TaskState[]
  flows: FlowState[]
  dispatchDecision: DispatchDecision | null
  runSummary: RunSummary | null
  latestTaskId: string | null
  selectedNodeId: string | null
  hoverHudNodeId: string | null
  hoverHudAnchor: UiAnchor | null
  isObservatoryOpen: boolean
  drawerOrigin: UiAnchor | null
  drawerFocusMode: DrawerFocusMode
  hydrate: (snapshot: SkySnapshot) => void
  clear: () => void
  selectNode: (nodeId: string | null) => void
  setHoverHudNode: (nodeId: string | null, anchor?: UiAnchor | null) => void
  openObservatory: (origin?: UiAnchor | null) => void
  closeObservatory: () => void
}

const initialState = {
  heroes: [] as HeroState[],
  tasks: [] as TaskState[],
  judgmentQueue: [] as TaskState[],
  flows: [] as FlowState[],
  dispatchDecision: null as DispatchDecision | null,
  runSummary: null as RunSummary | null,
  latestTaskId: null as string | null,
  selectedNodeId: null as string | null,
  hoverHudNodeId: null as string | null,
  hoverHudAnchor: null as UiAnchor | null,
  isObservatoryOpen: false,
  drawerOrigin: null as UiAnchor | null,
  drawerFocusMode: 'follow_selected_then_judgment_then_latest' as DrawerFocusMode,
}

export const useSkyStore = create<SkyState>((set) => ({
  ...initialState,
  hydrate: (snapshot) =>
    set({
      heroes: snapshot.heroGalaxy,
      tasks: snapshot.activeTasks,
      judgmentQueue: snapshot.judgmentQueue,
      flows: snapshot.lightFlows,
      dispatchDecision: snapshot.latestDispatchDecision,
      runSummary: snapshot.latestRunSummary,
      latestTaskId: snapshot.activeTasks[0]?.taskId ?? null,
    }),
  clear: () => set({ ...initialState }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setHoverHudNode: (nodeId, anchor) =>
    set((state) => ({
      hoverHudNodeId: nodeId,
      hoverHudAnchor: anchor === undefined ? state.hoverHudAnchor : anchor,
    })),
  openObservatory: (origin) =>
    set((state) => ({
      isObservatoryOpen: true,
      drawerOrigin: origin === undefined ? state.hoverHudAnchor : origin,
    })),
  closeObservatory: () => set({ isObservatoryOpen: false }),
}))
