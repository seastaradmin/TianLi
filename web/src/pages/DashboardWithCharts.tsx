import {
  Activity,
  CheckCheck,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  TimerReset,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { DeliverableArtifact, LogEntry } from '../types'
import {
  apiUrl,
  fetchActiveTasks,
  fetchChartData,
  fetchDeliverables,
  fetchHealth,
  fetchMetrics,
  fetchSessions,
  fetchStatusSnapshot,
  refreshSkills,
  startDestiny,
  submitVerdict,
  type ActiveTaskRecord,
  type ChartDataPoint,
  type HealthResponse,
  type MetricsResponse,
  type SessionResponse,
} from '../utils/api'

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'N/A'
  }
  return new Date(value).toLocaleString('zh-CN')
}

function formatDuration(seconds: number) {
  if (!seconds) {
    return '0s'
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m ${rest}s`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}

function toneForStatus(status: string) {
  if (['accepted', 'completed'].includes(status)) {
    return 'success'
  }
  if (['judgment_pending', 'synthesizing'].includes(status)) {
    return 'warning'
  }
  if (['failed', 'error', 'rejected'].includes(status)) {
    return 'danger'
  }
  if (['running', 'routing', 'consulting', 'issued', 'recovering'].includes(status)) {
    return 'info'
  }
  return 'neutral'
}

function formatStatus(status: string) {
  const map: Record<string, string> = {
    issued: '已下达',
    routing: '分发中',
    consulting: '协商中',
    running: '执行中',
    synthesizing: '汇总中',
    judgment_pending: '待裁决',
    accepted: '已接受',
    completed: '已完成',
    rejected: '已打回',
    failed: '失败',
    error: '错误',
    recovering: '恢复中',
    early_exit: '天劫退出',
  }
  return map[status] ?? status
}

export default function DashboardWithCharts() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [sessions, setSessions] = useState<SessionResponse[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [deliverables, setDeliverables] = useState<DeliverableArtifact[]>([])
  const [activeTasks, setActiveTasks] = useState<ActiveTaskRecord[]>([])
  const [requestVolumeData, setRequestVolumeData] = useState<ChartDataPoint[]>([])
  const [auditPassRateData, setAuditPassRateData] = useState<ChartDataPoint[]>([])
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([])
  const [taskInput, setTaskInput] = useState('')
  const [pinnedHeroInput, setPinnedHeroInput] = useState('')
  const [verdictNotes, setVerdictNotes] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('24h')
  const [loading, setLoading] = useState(true)
  const [submittingTask, setSubmittingTask] = useState(false)
  const [submittingVerdictFor, setSubmittingVerdictFor] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const pendingVerdicts = useMemo(
    () => activeTasks.filter((task) => task.status === 'judgment_pending'),
    [activeTasks],
  )

  const loadDashboard = async (mode: 'loading' | 'refresh' = 'loading') => {
    if (mode === 'loading') {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const [nextMetrics, nextSessions, nextHealth, nextDeliverables, nextTasks, requestSeries, passSeries, snapshot] =
        await Promise.all([
          fetchMetrics(selectedTimeRange),
          fetchSessions(8, selectedTimeRange),
          fetchHealth(),
          fetchDeliverables(6),
          fetchActiveTasks(12),
          fetchChartData('requests', selectedTimeRange),
          fetchChartData('pass-rates', selectedTimeRange),
          fetchStatusSnapshot(),
        ])

      setMetrics(nextMetrics)
      setSessions(nextSessions)
      setHealth(nextHealth)
      setDeliverables(nextDeliverables)
      setActiveTasks(nextTasks.items)
      setRequestVolumeData(requestSeries)
      setAuditPassRateData(passSeries)
      setRecentLogs(snapshot.logs.slice(-6).reverse())
    } catch (error) {
      console.error('Failed to load dashboard', error)
      setFeedback(`加载仪表盘失败：${String(error)}`)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [selectedTimeRange])

  const handleIssueDestiny = async () => {
    if (!taskInput.trim()) {
      setFeedback('请输入要下达的天命。')
      return
    }

    setSubmittingTask(true)
    try {
      const response = await startDestiny({
        task: taskInput.trim(),
        pinnedHeroIds: pinnedHeroInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        maxFanout: 3,
        dispatchMode: 'hybrid',
        collaborationMode: 'primary_consult',
      })

      setTaskInput('')
      setPinnedHeroInput('')
      setFeedback(`天命已下达：${response.taskId}`)
      await loadDashboard('refresh')
    } catch (error) {
      console.error('Failed to start destiny', error)
      setFeedback(`下达天命失败：${String(error)}`)
    } finally {
      setSubmittingTask(false)
    }
  }

  const handleVerdict = async (taskId: string, verdict: 'approve' | 'reject') => {
    setSubmittingVerdictFor(taskId)
    try {
      await submitVerdict({
        taskId,
        verdict,
        judgmentNote: verdictNotes[taskId] || '',
      })

      setFeedback(`已提交裁决：${taskId}`)
      setVerdictNotes((current) => ({ ...current, [taskId]: '' }))
      await loadDashboard('refresh')
    } catch (error) {
      console.error('Failed to submit verdict', error)
      setFeedback(`提交裁决失败：${String(error)}`)
    } finally {
      setSubmittingVerdictFor(null)
    }
  }

  const handleRefreshSkills = async () => {
    try {
      await refreshSkills()
      setFeedback('已刷新远程 Hero 与 skill 来源。')
      await loadDashboard('refresh')
    } catch (error) {
      console.error('Failed to refresh skills', error)
      setFeedback(`刷新 skill 来源失败：${String(error)}`)
    }
  }

  if (loading) {
    return (
      <div className="console-card console-empty">
        <RefreshCw className="h-10 w-10 animate-spin" />
        <div className="console-stack" style={{ alignItems: 'center' }}>
          <h3 className="console-card-title">正在加载正式控制台</h3>
          <p className="console-card-copy">真实指标、真实任务和真实交付物正在对齐当前运行态。</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="console-kpi-grid">
        <div className="console-kpi">
          <div className="console-kpi-label">会话总数</div>
          <div className="console-kpi-value">{metrics?.totalSessions ?? 0}</div>
          <div className="console-kpi-copy">按 task_id 聚合的正式会话视图</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">总请求轮次</div>
          <div className="console-kpi-value">{metrics?.totalRequests ?? 0}</div>
          <div className="console-kpi-copy">包含重分发与重新裁决轮次</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">L1 通过率</div>
          <div className="console-kpi-value">{formatPercent(metrics?.l1PassRate ?? 0)}</div>
          <div className="console-kpi-copy">对当前时间范围内的 task_results 聚合</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">待裁决任务</div>
          <div className="console-kpi-value">{pendingVerdicts.length}</div>
          <div className="console-kpi-copy">正式首页即可提交裁决</div>
        </div>
      </section>

      {feedback ? (
        <div className="console-card">
          <div className="console-inline">
            <Sparkles className="h-4 w-4" />
            <strong>控制台反馈</strong>
          </div>
          <p className="console-card-copy">{feedback}</p>
        </div>
      ) : null}

      <section className="console-grid console-grid-2">
        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">天命入口</h3>
              <p className="console-card-copy">正式控制台首页直接承担下达任务入口，不再依赖实验星图。</p>
            </div>
            <div className="console-form-actions">
              <button
                className="console-button console-button-ghost"
                type="button"
                onClick={() => void loadDashboard('refresh')}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                刷新总览
              </button>
              <button className="console-button console-button-ghost" type="button" onClick={handleRefreshSkills}>
                <TimerReset className="h-4 w-4" />
                刷新来源
              </button>
            </div>
          </div>

          <div className="console-form-grid">
            <div className="console-field">
              <label htmlFor="destiny-input">下达新的天命</label>
              <textarea
                id="destiny-input"
                className="console-textarea"
                placeholder="描述你要让 TianLi 执行的正式任务。"
                value={taskInput}
                onChange={(event) => setTaskInput(event.target.value)}
              />
            </div>

            <div className="console-field">
              <label htmlFor="destiny-pinned">固定星使（可选）</label>
              <input
                id="destiny-pinned"
                className="console-input console-code"
                placeholder="builder/forge, auditor/sentinel"
                value={pinnedHeroInput}
                onChange={(event) => setPinnedHeroInput(event.target.value)}
              />
              <span className="console-field-copy">多个 Hero 以英文逗号分隔。若留空，后端按真实分发规则自动选择。</span>
            </div>

            <div className="console-form-actions">
              <button
                className="console-button console-button-primary"
                type="button"
                onClick={handleIssueDestiny}
                disabled={submittingTask}
              >
                <Send className="h-4 w-4" />
                {submittingTask ? '下达中…' : '下达天命'}
              </button>
            </div>
          </div>
        </div>

        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">运行健康</h3>
              <p className="console-card-copy">当前进程、资源与审计引擎的即时状态。</p>
            </div>
            <span className="console-badge" data-tone={toneForStatus(health?.running ? 'running' : 'accepted')}>
              {health?.running ? '运行中' : '待命'}
            </span>
          </div>

          <div className="console-grid console-grid-3">
            <div className="console-list-item">
              <div className="console-inline">
                <Activity className="h-4 w-4" />
                <strong>执行器</strong>
              </div>
              <div className="console-chip-row" style={{ marginTop: '0.85rem' }}>
                {Object.entries(health?.executor.platforms ?? {}).map(([key, value]) => (
                  <span key={key} className="console-badge" data-tone={value ? 'success' : 'neutral'}>
                    {key} {value ? 'online' : 'offline'}
                  </span>
                ))}
              </div>
            </div>

            <div className="console-list-item">
              <div className="console-inline">
                <Shield className="h-4 w-4" />
                <strong>审计引擎</strong>
              </div>
              <p className="console-card-copy">
                活跃规则 {health?.audit.active_rules ?? 0} · L2 抽样 {(health?.audit.l2_sample_rate ?? 0) * 100}%
              </p>
              <div className="console-meta">
                <span>更新时间 {formatDateTime(health?.audit.last_update)}</span>
              </div>
            </div>

            <div className="console-list-item">
              <div className="console-inline">
                <CheckCheck className="h-4 w-4" />
                <strong>资源负载</strong>
              </div>
              <p className="console-card-copy">
                CPU {health?.resources.cpu_percent ?? 0}% · 内存 {health?.resources.memory_mb ?? 0} MB · 磁盘{' '}
                {health?.resources.disk_percent ?? 0}%
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">待裁决交付</h3>
            <p className="console-card-copy">交付一旦进入 judgment pending，这里就是正式审批入口。</p>
          </div>
        </div>

        {pendingVerdicts.length === 0 ? (
          <div className="console-empty">
            <CheckCheck className="h-10 w-10" />
            <p>当前没有待裁决任务。</p>
          </div>
        ) : (
          <div className="console-grid console-grid-2">
            {pendingVerdicts.map((task) => (
              <article className="console-list-item" key={task.task_id}>
                <div className="console-stack">
                  <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                    <strong>{task.title}</strong>
                    <span className="console-badge" data-tone={toneForStatus(task.status)}>
                      {formatStatus(task.status)}
                    </span>
                  </div>
                  <div className="console-meta">
                    <span className="console-code">{task.task_id}</span>
                    <span>轮次 {task.round + 1}</span>
                    <span>主星使 {task.primary_hero_id || 'N/A'}</span>
                  </div>
                  <p className="console-card-copy">
                    {task.delivery_summary ? truncateText(task.delivery_summary, 420) : '交付摘要尚未写入。'}
                  </p>
                  <div className="console-field">
                    <label htmlFor={`verdict-${task.task_id}`}>裁决说明</label>
                    <textarea
                      id={`verdict-${task.task_id}`}
                      className="console-textarea"
                      placeholder="补充通过或打回原因。"
                      value={verdictNotes[task.task_id] ?? ''}
                      onChange={(event) =>
                        setVerdictNotes((current) => ({ ...current, [task.task_id]: event.target.value }))
                      }
                    />
                  </div>
                  <div className="console-form-actions">
                    <button
                      className="console-button console-button-primary"
                      type="button"
                      onClick={() => void handleVerdict(task.task_id, 'approve')}
                      disabled={submittingVerdictFor === task.task_id}
                    >
                      通过交付
                    </button>
                    <button
                      className="console-button console-button-danger"
                      type="button"
                      onClick={() => void handleVerdict(task.task_id, 'reject')}
                      disabled={submittingVerdictFor === task.task_id}
                    >
                      打回重分发
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="console-grid console-grid-2">
        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">请求轮次趋势</h3>
              <p className="console-card-copy">按当前时间范围统计的会话请求量。</p>
            </div>
            <select
              aria-label="时间范围"
              className="console-select"
              style={{ width: 'auto', minWidth: '8rem' }}
              value={selectedTimeRange}
              onChange={(event) => setSelectedTimeRange(event.target.value as '24h' | '7d' | '30d')}
            >
              <option value="24h">24 小时</option>
              <option value="7d">7 天</option>
              <option value="30d">30 天</option>
            </select>
          </div>

          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={requestVolumeData}>
                <CartesianGrid stroke="rgba(129,160,194,0.16)" strokeDasharray="4 4" />
                <XAxis dataKey="label" stroke="#7b93ad" />
                <YAxis stroke="#7b93ad" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(8, 18, 30, 0.96)',
                    border: '1px solid rgba(129,160,194,0.18)',
                    borderRadius: '16px',
                    color: '#edf4ff',
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#58cfff" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">审计通过率</h3>
              <p className="console-card-copy">L1 与 L2 在同一时间轴下的实时对比。</p>
            </div>
          </div>

          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={auditPassRateData}>
                <CartesianGrid stroke="rgba(129,160,194,0.16)" strokeDasharray="4 4" />
                <XAxis dataKey="label" stroke="#7b93ad" />
                <YAxis stroke="#7b93ad" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(8, 18, 30, 0.96)',
                    border: '1px solid rgba(129,160,194,0.18)',
                    borderRadius: '16px',
                    color: '#edf4ff',
                  }}
                />
                <Bar dataKey="l1" fill="#89a8ff" radius={[8, 8, 0, 0]} />
                <Bar dataKey="l2" fill="#5dd99f" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="console-grid console-grid-3">
        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">最近交付物</h3>
              <p className="console-card-copy">真实文件扫描结果，按最近修改时间排序。</p>
            </div>
          </div>

          {deliverables.length === 0 ? (
            <div className="console-empty">
              <p>还没有检测到产物文件。</p>
            </div>
          ) : (
            <div className="console-list">
              {deliverables.map((item) => (
                <div className="console-list-item" key={item.id}>
                  <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                    <strong>{item.fileName}</strong>
                    <span className="console-badge">{item.fileType.toUpperCase()}</span>
                  </div>
                  <div className="console-meta">
                    <span>{formatFileSize(item.sizeBytes)}</span>
                    <span>{formatDateTime(item.modifiedAt)}</span>
                  </div>
                  <a className="console-link console-code" href={apiUrl(item.downloadUrl)}>
                    {item.relativePath}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">最近会话</h3>
              <p className="console-card-copy">按 task_id 聚合的正式会话摘要。</p>
            </div>
          </div>

          <div className="console-list">
            {sessions.map((session) => (
              <div className="console-list-item" key={session.session_id}>
                <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                  <strong>{session.title}</strong>
                  <span className="console-badge" data-tone={toneForStatus(session.status)}>
                    {formatStatus(session.status)}
                  </span>
                </div>
                <div className="console-meta">
                  <span className="console-code">{session.session_id}</span>
                  <span>{formatDuration(session.duration_seconds)}</span>
                  <span>L2 {(session.avg_l2_score ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">最新日志摘要</h3>
              <p className="console-card-copy">首页直接看到最近运行上下文，而不是空白舞台。</p>
            </div>
          </div>

          {recentLogs.length === 0 ? (
            <div className="console-empty">
              <p>当前没有日志。</p>
            </div>
          ) : (
            <div className="console-log-list">
              {recentLogs.map((log) => (
                <div className="console-log-entry" key={String(log.id)}>
                  <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                    <span className="console-badge" data-tone={toneForStatus(log.level.toLowerCase())}>
                      {log.level}
                    </span>
                    <span className="console-code">{log.time}</span>
                  </div>
                  <p className="console-card-copy">{log.msg}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
