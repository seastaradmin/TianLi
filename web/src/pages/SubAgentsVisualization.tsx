import { Activity, CheckCircle2, Clock3, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { fetchActiveTasks, type ActiveTaskRecord } from '../utils/api'

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

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'N/A'
  }
  return new Date(value).toLocaleString('zh-CN')
}

function truncateText(value?: string, maxLength = 260) {
  if (!value) {
    return ''
  }
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength - 1)}…`
}

export default function SubAgentsVisualization() {
  const [tasks, setTasks] = useState<ActiveTaskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const response = await fetchActiveTasks(20)
        if (!alive) {
          return
        }
        setTasks(response.items)
        setExpandedTaskId((current) => current ?? response.items[0]?.task_id ?? null)
      } catch (error) {
        console.error('Failed to load active tasks', error)
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), 5000)

    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const summary = useMemo(
    () => ({
      runningTasks: tasks.filter((task) => ['running', 'routing', 'consulting', 'synthesizing'].includes(task.status)).length,
      pendingJudgment: tasks.filter((task) => task.status === 'judgment_pending').length,
      totalLanes: tasks.reduce((sum, task) => sum + task.sub_agents.length, 0),
      completed: tasks.filter((task) => ['accepted', 'completed'].includes(task.status)).length,
    }),
    [tasks],
  )

  return (
    <>
      <section className="console-kpi-grid">
        <div className="console-kpi">
          <div className="console-kpi-label">运行中的任务</div>
          <div className="console-kpi-value">{summary.runningTasks}</div>
          <div className="console-kpi-copy">正式运行态里的活跃 task</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">待裁决任务</div>
          <div className="console-kpi-value">{summary.pendingJudgment}</div>
          <div className="console-kpi-copy">交付已生成，等待人工判断</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">Sub-agent 轨道</div>
          <div className="console-kpi-value">{summary.totalLanes}</div>
          <div className="console-kpi-copy">主链路 + 协商链路总数</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">已完成任务</div>
          <div className="console-kpi-value">{summary.completed}</div>
          <div className="console-kpi-copy">本次进程内已接受或已完成</div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">任务并行视图</h3>
            <p className="console-card-copy">这里展示的都是当前运行态的真实 Hero 轨道，而不是演示用虚构 Sub-agent。</p>
          </div>
          <span className="console-badge">{tasks.length} tasks</span>
        </div>

        {loading ? (
          <div className="console-empty">
            <Activity className="h-10 w-10 animate-pulse" />
            <p>正在同步当前任务状态…</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="console-empty">
            <Users className="h-10 w-10" />
            <p>当前运行态没有任务。</p>
          </div>
        ) : (
          <div className="console-list">
            {tasks.map((task) => {
              const isExpanded = expandedTaskId === task.task_id || ['running', 'judgment_pending'].includes(task.status)
              return (
                <article className="console-list-item" data-testid="task-item" key={task.task_id}>
                  <button
                    className="console-stack"
                    type="button"
                    onClick={() => setExpandedTaskId((current) => (current === task.task_id ? null : task.task_id))}
                  >
                    <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                      <div className="console-stack" style={{ gap: '0.4rem' }}>
                        <strong>{task.title}</strong>
                        <div className="console-meta">
                          <span className="console-code">{task.task_id}</span>
                          <span>主星使 {task.primary_hero_id || 'N/A'}</span>
                          <span>开始于 {formatDateTime(task.started_at)}</span>
                        </div>
                      </div>
                      <span className="console-badge" data-tone={toneForStatus(task.status)}>
                        {task.status}
                      </span>
                    </div>
                    <div className="console-progress">
                      <span style={{ width: `${task.overall_progress}%` }} />
                    </div>
                    <div className="console-meta">
                      <span>总体进度 {task.overall_progress}%</span>
                      <span>轮次 {task.round + 1}</span>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="console-stack" style={{ marginTop: '1rem' }}>
                      {task.delivery_summary ? (
                        <p className="console-card-copy">{truncateText(task.delivery_summary, 300)}</p>
                      ) : null}
                      {task.sub_agents.map((lane) => (
                        <div className="console-list-item" key={lane.id}>
                          <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                            <div className="console-stack" style={{ gap: '0.35rem' }}>
                              <strong>{lane.name}</strong>
                              <div className="console-meta">
                                <span className="console-code">{lane.hero_id}</span>
                                <span>{lane.role}</span>
                                <span>{formatDateTime(lane.started_at)}</span>
                              </div>
                            </div>
                            <span className="console-badge" data-tone={toneForStatus(lane.status)}>
                              {lane.status}
                            </span>
                          </div>
                          <div className="console-progress" style={{ marginTop: '0.85rem' }}>
                            <span style={{ width: `${lane.progress}%` }} />
                          </div>
                          <div className="console-meta" style={{ marginTop: '0.5rem' }}>
                            <span>进度 {lane.progress}%</span>
                            {lane.completed_at ? <span>完成于 {formatDateTime(lane.completed_at)}</span> : null}
                          </div>
                          {lane.result ? <p className="console-card-copy">{truncateText(lane.result, 220)}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="console-grid console-grid-3">
        <div className="console-card">
          <div className="console-inline">
            <Activity className="h-4 w-4" />
            <strong>运行链路</strong>
          </div>
          <p className="console-card-copy">任务在 routing / running / synthesizing 之间切换时，这里会持续反映真实后端状态。</p>
        </div>
        <div className="console-card">
          <div className="console-inline">
            <Clock3 className="h-4 w-4" />
            <strong>轮次信息</strong>
          </div>
          <p className="console-card-copy">打回重分发会提升 round，便于追踪同一 task 的多轮协作。</p>
        </div>
        <div className="console-card">
          <div className="console-inline">
            <CheckCircle2 className="h-4 w-4" />
            <strong>结果摘要</strong>
          </div>
          <p className="console-card-copy">每条 Hero 轨道都显示自身结果摘要，而不是只给一个模糊的任务完成提示。</p>
        </div>
      </section>
    </>
  )
}
