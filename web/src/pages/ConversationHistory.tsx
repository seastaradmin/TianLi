import { Bot, Download, MessageSquare, Search, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { fetchConversations, type ConversationRecord } from '../utils/api'

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'N/A'
  }
  return new Date(value).toLocaleString('zh-CN')
}

function toneForStatus(status?: string | null) {
  if (!status) {
    return 'neutral'
  }
  if (['accepted', 'completed'].includes(status)) {
    return 'success'
  }
  if (['judgment_pending', 'synthesizing'].includes(status)) {
    return 'warning'
  }
  if (['failed', 'error', 'rejected'].includes(status)) {
    return 'danger'
  }
  if (['issued', 'routing', 'running', 'consulting', 'recovering'].includes(status)) {
    return 'info'
  }
  return 'neutral'
}

function exportConversation(conversation: ConversationRecord) {
  const content = conversation.messages
    .map((message) => `[${formatDateTime(message.timestamp)}] ${message.role === 'user' ? '用户' : '助手'}: ${message.content}`)
    .join('\n\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `conversation-${conversation.task_id}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ConversationHistory() {
  const [conversations, setConversations] = useState<ConversationRecord[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const next = await fetchConversations(80)
        if (!alive) {
          return
        }
        setConversations(next)
        setSelectedConversationId(next[0]?.task_id ?? null)
      } catch (error) {
        console.error('Failed to load conversations', error)
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

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const matchesStatus = filterStatus === 'all' || conversation.status === filterStatus
      const haystack = `${conversation.task_id} ${conversation.title} ${conversation.messages
        .map((message) => message.content)
        .join(' ')}`.toLowerCase()
      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [conversations, filterStatus, searchTerm])

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.task_id === selectedConversationId) ??
    filteredConversations[0] ??
    null

  return (
    <>
      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">历史筛选</h3>
            <p className="console-card-copy">这里展示的是持久化后的任务关键消息，支持服务重启后继续查看。</p>
          </div>
        </div>

        <div className="console-grid console-grid-2">
          <div className="console-field">
            <label htmlFor="conversation-search">搜索对话</label>
            <div className="console-inline">
              <Search className="h-4 w-4" />
              <input
                id="conversation-search"
                className="console-input"
                placeholder="搜索 task_id 或消息内容"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="console-field">
            <label htmlFor="conversation-filter">状态过滤</label>
            <select
              id="conversation-filter"
              className="console-select"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
            >
              <option value="all">全部状态</option>
              <option value="accepted">已接受</option>
              <option value="judgment_pending">待裁决</option>
              <option value="running">运行中</option>
              <option value="rejected">已打回</option>
              <option value="failed">失败</option>
            </select>
          </div>
        </div>
      </section>

      <section className="console-split">
        <div className="console-card">
          <div className="console-card-header">
            <div>
              <h3 className="console-card-title">会话列表</h3>
              <p className="console-card-copy">按最近消息时间排序的 task 会话。</p>
            </div>
            <span className="console-badge">{filteredConversations.length} conversations</span>
          </div>

          {loading ? (
            <div className="console-empty">
              <MessageSquare className="h-10 w-10 animate-pulse" />
              <p>正在读取持久化对话…</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="console-empty">
              <MessageSquare className="h-10 w-10" />
              <p>没有匹配的对话。</p>
            </div>
          ) : (
            <div className="console-list">
              {filteredConversations.map((conversation) => (
                <button
                  className={`console-list-item ${
                    selectedConversation?.task_id === conversation.task_id ? 'console-list-item-active' : ''
                  }`}
                  data-testid="conversation-item"
                  key={conversation.task_id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.task_id)}
                >
                  <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                    <strong>{conversation.title}</strong>
                    <span className="console-badge" data-tone={toneForStatus(conversation.status)}>
                      {conversation.status || 'unknown'}
                    </span>
                  </div>
                  <div className="console-meta" style={{ marginTop: '0.5rem' }}>
                    <span className="console-code">{conversation.task_id}</span>
                    <span>{conversation.message_count} 条消息</span>
                    <span>{formatDateTime(conversation.last_message_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="console-card">
          {selectedConversation ? (
            <>
              <div className="console-card-header">
                <div>
                  <h3 className="console-card-title">{selectedConversation.title}</h3>
                  <p className="console-card-copy">
                    任务 {selectedConversation.task_id} · 开始于 {formatDateTime(selectedConversation.started_at)} · 最新状态{' '}
                    <span className="console-code">{selectedConversation.status || 'unknown'}</span>
                  </p>
                </div>
                <button
                  className="console-button console-button-primary"
                  type="button"
                  onClick={() => exportConversation(selectedConversation)}
                >
                  <Download className="h-4 w-4" />
                  导出对话
                </button>
              </div>

              <div className="console-message-stream">
                {selectedConversation.messages.map((message) => (
                  <article
                    className={`console-message ${
                      message.role === 'user' ? 'console-message-user' : 'console-message-assistant'
                    }`}
                    key={message.id}
                  >
                    <div className="console-inline" style={{ justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <span className="console-inline">
                        {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        <strong>{message.role === 'user' ? '用户' : '助手'}</strong>
                      </span>
                      <span className="console-code">{formatDateTime(message.timestamp)}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                    <div className="console-meta" style={{ marginTop: '0.75rem' }}>
                      <span>轮次 {message.round + 1}</span>
                      {message.hero_id ? <span>Hero {message.hero_id}</span> : null}
                      {message.status ? (
                        <span className="console-badge" data-tone={toneForStatus(message.status)}>
                          {message.status}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="console-empty">
              <MessageSquare className="h-10 w-10" />
              <p>从左侧选择一个会话查看详情。</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
