import { Download, Pause, Play, Search, Terminal, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useSSE } from '../hooks'
import type { LogEntry } from '../types'
import { apiUrl, fetchLogsHistory } from '../utils/api'

const LOG_STREAM_URL = apiUrl('/api/logs/stream')

function formatLogLine(log: LogEntry) {
  return `[${log.time}] [${log.level}] [${log.module}] ${log.msg}`
}

function levelTone(level: string) {
  if (level === 'ERROR') {
    return 'danger'
  }
  if (level === 'WARN') {
    return 'warning'
  }
  if (level === 'DEBUG') {
    return 'info'
  }
  return 'success'
}

export default function LiveLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filterLevel, setFilterLevel] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const pauseRef = useRef(false)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    pauseRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const next = await fetchLogsHistory(200)
        if (alive) {
          setLogs(next)
        }
      } catch (error) {
        console.error('Failed to load logs history', error)
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      alive = false
    }
  }, [])

  const { isConnected } = useSSE(LOG_STREAM_URL, {
    enabled: true,
    onLog: (log) => {
      if (pauseRef.current) {
        return
      }
      setLogs((current) => {
        if (current.some((item) => item.id === log.id)) {
          return current
        }
        return [...current.slice(-199), log]
      })
    },
  })

  useEffect(() => {
    if (!autoScroll || isPaused) {
      return
    }
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [autoScroll, isPaused, logs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel
      const haystack = `${log.msg} ${log.module} ${JSON.stringify(log.data || {})}`.toLowerCase()
      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase())
      return matchesLevel && matchesSearch
    })
  }, [filterLevel, logs, searchTerm])

  const exportLogs = () => {
    const blob = new Blob([filteredLogs.map(formatLogLine).join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tianli-live-logs-${new Date().toISOString().slice(0, 19)}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <section className="console-kpi-grid">
        <div className="console-kpi">
          <div className="console-kpi-label">历史日志</div>
          <div className="console-kpi-value">{logs.length}</div>
          <div className="console-kpi-copy">先读取历史，再叠加 SSE 增量</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">当前筛选</div>
          <div className="console-kpi-value">{filteredLogs.length}</div>
          <div className="console-kpi-copy">搜索与级别过滤后的结果</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">流状态</div>
          <div className="console-kpi-value">{isConnected ? 'Online' : 'Retrying'}</div>
          <div className="console-kpi-copy">SSE 连接稳定时持续接收增量</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">消费状态</div>
          <div className="console-kpi-value">{isPaused ? 'Paused' : 'Live'}</div>
          <div className="console-kpi-copy">暂停后仅停止追加，不会清空历史</div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">日志控制台</h3>
            <p className="console-card-copy">这里展示的是正式运行链路日志，不是本地页面 mock 示例。</p>
          </div>
          <div className="console-form-actions">
            <button className="console-button console-button-ghost" type="button" onClick={() => setIsPaused((current) => !current)}>
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isPaused ? '继续流' : '暂停流'}
            </button>
            <button className="console-button console-button-ghost" type="button" onClick={() => setLogs([])}>
              <Trash2 className="h-4 w-4" />
              清空视图
            </button>
            <button className="console-button console-button-primary" type="button" onClick={exportLogs}>
              <Download className="h-4 w-4" />
              导出日志
            </button>
          </div>
        </div>

        <div className="console-grid console-grid-2">
          <div className="console-field">
            <label htmlFor="log-search">搜索日志</label>
            <div className="console-inline">
              <Search className="h-4 w-4" />
              <input
                id="log-search"
                className="console-input"
                placeholder="搜索 message / module / payload"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
          <div className="console-field">
            <label htmlFor="log-level">级别过滤</label>
            <select
              id="log-level"
              className="console-select"
              value={filterLevel}
              onChange={(event) =>
                setFilterLevel(event.target.value as 'ALL' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG')
              }
            >
              <option value="ALL">全部级别</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="DEBUG">DEBUG</option>
            </select>
          </div>
        </div>

        <div className="console-inline" style={{ marginTop: '1rem' }}>
          <label className="console-pill">
            <input
              checked={autoScroll}
              onChange={(event) => setAutoScroll(event.target.checked)}
              type="checkbox"
            />
            自动滚动
          </label>
          <span className="console-badge" data-tone={isConnected ? 'success' : 'warning'}>
            {isConnected ? 'SSE connected' : 'SSE reconnecting'}
          </span>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">日志流</h3>
            <p className="console-card-copy">先载入历史，再按事件流追加。之前那种重复连 SSE 的风暴不会在这里出现。</p>
          </div>
          <span className="console-badge">{filteredLogs.length} entries</span>
        </div>

        {loading ? (
          <div className="console-empty">
            <Terminal className="h-10 w-10 animate-pulse" />
            <p>正在读取历史日志…</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="console-empty">
            <Terminal className="h-10 w-10" />
            <p>当前筛选条件下没有日志。</p>
          </div>
        ) : (
          <div className="console-log-list" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {filteredLogs.map((log) => (
              <article className="console-log-entry" key={String(log.id)} data-testid="log-entry">
                <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                  <div className="console-inline">
                    <span className="console-badge" data-tone={levelTone(log.level)}>
                      {log.level}
                    </span>
                    <span className="console-code">{log.time}</span>
                  </div>
                  <span className="console-pill">{log.module}</span>
                </div>
                <p className="console-card-copy">{log.msg}</p>
                {log.data && Object.keys(log.data).length > 0 ? (
                  <details>
                    <summary className="console-link">查看 payload</summary>
                    <pre className="console-code">{JSON.stringify(log.data, null, 2)}</pre>
                  </details>
                ) : null}
              </article>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </section>
    </>
  )
}
