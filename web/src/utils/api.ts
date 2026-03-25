import type { DeliverableArtifact, LogEntry, SkySnapshot } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!API_BASE_URL) {
    return normalizedPath
  }

  const shouldTrimApiPrefix =
    API_BASE_URL.endsWith('/api') && (normalizedPath === '/api' || normalizedPath.startsWith('/api/'))

  return `${API_BASE_URL}${shouldTrimApiPrefix ? normalizedPath.slice(4) || '' : normalizedPath}`
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export interface MetricsResponse {
  totalSessions: number
  totalRequests: number
  l1PassRate: number
  l2PassRate: number
  earlyExitRate: number
  avgLatencyMs: number
  totalViolations: number
  evolutionPatches: number
  timeRange: '24h' | '7d' | '30d'
}

export interface SessionResponse {
  session_id: string
  task_id: string
  title: string
  start_time: string
  end_time: string | null
  duration_seconds: number
  total_requests: number
  successful_completions: number
  early_exits: number
  l1_pass_rate: number
  l2_pass_rate: number
  avg_l2_score: number
  tool_calls: {
    total: number
    by_tool: Record<string, number>
  }
  status: string
  evolution_patches: number
  primary_hero_id?: string | null
  selected_hero_ids?: string[]
  updated_at?: string
  pending_verdict?: boolean
}

export interface HealthResponse {
  executor: {
    status: 'healthy' | 'warning' | 'error'
    platforms: Record<string, boolean>
  }
  resources: {
    status: 'healthy' | 'warning' | 'error'
    cpu_percent: number
    memory_mb: number
    disk_percent: number
  }
  audit: {
    status: 'healthy' | 'warning' | 'error'
    active_rules: number
    l2_sample_rate: number
    last_update: string
  }
  running: boolean
}

export interface ChartDataPoint {
  timestamp: string
  label?: string
  value?: number
  l1?: number
  l2?: number
}

export interface ConversationMessage {
  id: string
  task_id: string
  round: number
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  hero_id?: string | null
  status?: string | null
}

export interface ConversationRecord {
  task_id: string
  session_id: string
  title: string
  started_at: string
  last_message_at: string
  hero_id?: string | null
  status?: string | null
  message_count: number
  messages: ConversationMessage[]
}

export interface SkillInventoryItem {
  skill_id: string
  name: string
  description: string
  installed: boolean
  available: boolean
  source: string
  hero_ids: string[]
  hero_names: string[]
  hero_count: number
}

export interface SkillsResponse {
  items: SkillInventoryItem[]
  summary: {
    total: number
    installed: number
    linked: number
    missing: number
  }
}

export interface ActiveTaskLane {
  id: string
  hero_id: string
  name: string
  role: string
  status: string
  progress: number
  started_at?: string | null
  completed_at?: string | null
  result?: string
  skill_dispatches?: Array<Record<string, unknown>>
}

export interface ActiveTaskRecord {
  task_id: string
  title: string
  status: string
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  overall_progress: number
  started_at: string
  updated_at: string
  completed_at?: string | null
  primary_hero_id?: string | null
  selected_hero_ids: string[]
  round: number
  delivery_summary: string
  judgment_note: string
  sub_agents: ActiveTaskLane[]
}

export interface ActiveTasksResponse {
  items: ActiveTaskRecord[]
  summary: {
    running: number
    judgment_pending: number
    completed: number
  }
}

export interface StartTaskResponse {
  status: string
  taskId: string
  selectedHeroIds: string[]
  primaryHeroId: string | null
}

export async function fetchMetrics(timeRange: '24h' | '7d' | '30d' = '24h') {
  return fetchJson<MetricsResponse>(`/api/metrics?range=${timeRange}`)
}

export async function fetchSessions(limit = 10, timeRange?: '24h' | '7d' | '30d') {
  const query = new URLSearchParams({ limit: String(limit) })
  if (timeRange) {
    query.set('range', timeRange)
  }
  return fetchJson<SessionResponse[]>(`/api/sessions?${query.toString()}`)
}

export async function fetchHealth() {
  return fetchJson<HealthResponse>('/api/health')
}

export async function fetchChartData(metric: string, timeRange: '24h' | '7d' | '30d' = '24h') {
  return fetchJson<ChartDataPoint[]>(`/api/charts/${metric}?range=${timeRange}`)
}

export async function fetchDeliverables(limit = 50) {
  const response = await fetchJson<{ items: DeliverableArtifact[] }>(`/api/deliverables?limit=${limit}`)
  return response.items
}

export async function fetchLogsHistory(limit = 200) {
  return fetchJson<LogEntry[]>(`/api/logs/history?limit=${limit}`)
}

export async function fetchConversations(limit = 50) {
  const response = await fetchJson<{ items: ConversationRecord[] }>(`/api/conversations?limit=${limit}`)
  return response.items
}

export async function fetchSkills() {
  return fetchJson<SkillsResponse>('/api/skills')
}

export async function refreshSkills() {
  return fetchJson<Record<string, unknown>>('/api/skills/refresh', { method: 'POST' })
}

export async function fetchActiveTasks(limit = 20) {
  return fetchJson<ActiveTasksResponse>(`/api/tasks/active?limit=${limit}`)
}

export async function fetchStatusSnapshot() {
  return fetchJson<SkySnapshot>('/api/status')
}

export async function startDestiny(payload: {
  task: string
  pinnedHeroIds: string[]
  maxFanout?: number
  dispatchMode?: string
  collaborationMode?: string
}) {
  return fetchJson<StartTaskResponse>('/api/run/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function submitVerdict(payload: { taskId: string; verdict: 'approve' | 'reject'; judgmentNote: string }) {
  return fetchJson<Record<string, unknown>>('/api/run/verdict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
