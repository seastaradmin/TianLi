export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export type Status =
  | 'idle'
  | 'issued'
  | 'routing'
  | 'consulting'
  | 'running'
  | 'synthesizing'
  | 'judgment_pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'early_exit'
  | 'failed'
  | 'recovering'
  | 'error'

export interface LogEntry {
  id: string | number
  time: string
  level: LogLevel
  module: string
  msg: string
  msgZh?: string
  msgEn?: string
  data?: Record<string, unknown>
}

export interface Stats {
  status: Status
  totalSteps: number
  earlyExits: number
  l1Passes: number
  l2Checks: number
  activeHeroes: number
  activeTasks: number
}

export interface HeroState {
  heroId: string
  displayName: string
  displayNameZh?: string
  displayNameEn?: string
  description: string
  descriptionZh?: string
  descriptionEn?: string
  tags: string[]
  tools: string[]
  linkedSkills: string[]
  color: string
  x: number
  y: number
  status: Status | 'idle'
  load: number
  queueDepth: number
  currentTaskId: string | null
  currentTaskIds: string[]
  source: string
}

export interface SkillDispatchState {
  taskId: string
  heroId: string
  role: 'primary' | 'consult'
  skillId: string
  status: string
  summary?: string
  guidance?: string
  sourcePath?: string
  matchScore?: number
  reason?: string
  executionStatus?: 'pending' | 'completed' | 'error' | 'skipped' | string
  contribution?: string
  latencyMs?: number
}

export interface DeliveryDetail {
  heroId?: string
  displayName?: string
  displayNameZh?: string
  displayNameEn?: string
  role?: 'primary' | 'consult'
  status?: Status | string
  steps?: number
  summary?: string
  summaryZh?: string
  summaryEn?: string
  evolutionPatch?: string
  error?: string
  skillDispatches?: SkillDispatchState[]
}

export interface TaskState {
  taskId: string
  title: string
  status: Status
  pinnedHeroIds: string[]
  selectedHeroIds: string[]
  primaryHeroId: string | null
  consultHeroIds: string[]
  candidateHeroIds: string[]
  maxFanout: number
  dispatchMode: string
  collaborationMode: string
  createdAt: string
  updatedAt: string
  reasoning: string
  verdictRound: number
  judgmentNote: string
  verdictStatus: 'approved' | 'rejected' | null
  deliverySummary: string
  deliverySummaryZh?: string
  deliverySummaryEn?: string
  deliveryDetails: DeliveryDetail[]
  skillDispatches: SkillDispatchState[]
  completedAt: string | null
  history: Array<Record<string, unknown>>
  verdictHistory: Array<Record<string, unknown>>
}

export interface FlowState {
  id: string
  taskId: string
  source: string
  target: string
  heroId: string
  status: Status | 'consulting'
  phase: string
  label: string
  role: 'primary' | 'consult'
  round: number
  animated: boolean
  createdAt: string
}

export interface DispatchTarget {
  hero_id: string
  score: number
  reason: string
}

export interface DispatchDecision {
  task_id: string
  strategy: string
  selected_hero_ids: string[]
  primary_hero_id: string | null
  consult_hero_ids: string[]
  coordination_mode: string
  candidate_scores: Record<string, number>
  selected_targets: DispatchTarget[]
  reasoning: string
  fallback_used: boolean
  model_used?: string | null
}

export interface RunSummary {
  taskId: string
  selectedHeroIds: string[]
  status: Status
  results: Array<Record<string, unknown>>
  completedAt: string
  deliverySummary?: string
  deliverySummaryZh?: string
  deliverySummaryEn?: string
}

export interface SkySnapshot {
  status: Status
  stats: Stats
  heroGalaxy: HeroState[]
  activeTasks: TaskState[]
  judgmentQueue: TaskState[]
  lightFlows: FlowState[]
  latestDispatchDecision: DispatchDecision | null
  latestRunSummary: RunSummary | null
  logs: LogEntry[]
}

export interface UseSSEOptions {
  onLog?: (log: LogEntry) => void
  onStats?: (stats: Stats) => void
  onSkyState?: (snapshot: SkySnapshot) => void
  onDispatchDecision?: (decision: DispatchDecision) => void
  onDeliveryReady?: (summary: RunSummary) => void
  enabled?: boolean
}

export type DrawerFocusMode = 'follow_selected_then_judgment_then_latest'
export type Language = 'zh' | 'en'

export interface UiAnchor {
  x: number
  y: number
}
