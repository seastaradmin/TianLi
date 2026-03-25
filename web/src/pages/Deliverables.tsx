import { Download, Eye, FileStack, Filter, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { DeliverableArtifact } from '../types'
import { apiUrl, fetchDeliverables } from '../utils/api'

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function previewable(type: string) {
  return ['md', 'txt', 'json', 'html', 'pdf'].includes(type)
}

export default function Deliverables() {
  const [deliverables, setDeliverables] = useState<DeliverableArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState('all')

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const next = await fetchDeliverables(100)
        if (alive) {
          setDeliverables(next)
        }
      } catch (error) {
        console.error('Failed to fetch deliverables', error)
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

  const fileTypes = useMemo(
    () => ['all', ...Array.from(new Set(deliverables.map((item) => item.fileType))).sort()],
    [deliverables],
  )

  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((item) => {
      const matchesFileType = fileTypeFilter === 'all' || item.fileType === fileTypeFilter
      const target = `${item.fileName} ${item.relativePath} ${item.rootName}`.toLowerCase()
      const matchesSearch = !searchTerm || target.includes(searchTerm.toLowerCase())
      return matchesFileType && matchesSearch
    })
  }, [deliverables, fileTypeFilter, searchTerm])

  const totalSize = deliverables.reduce((sum, item) => sum + item.sizeBytes, 0)
  const todayCount = deliverables.filter((item) => {
    const itemDate = new Date(item.modifiedAt).toDateString()
    return itemDate === new Date().toDateString()
  }).length

  return (
    <>
      <section className="console-kpi-grid">
        <div className="console-kpi">
          <div className="console-kpi-label">总交付物</div>
          <div className="console-kpi-value">{deliverables.length}</div>
          <div className="console-kpi-copy">来自真实输出目录扫描</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">文件类型数</div>
          <div className="console-kpi-value">{fileTypes.length - 1}</div>
          <div className="console-kpi-copy">按扩展名聚合显示</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">总大小</div>
          <div className="console-kpi-value">{formatFileSize(totalSize)}</div>
          <div className="console-kpi-copy">仅统计扫描到的真实文件</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">今日新增</div>
          <div className="console-kpi-value">{todayCount}</div>
          <div className="console-kpi-copy">以最近修改时间为准</div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">交付物筛选</h3>
            <p className="console-card-copy">预览只对浏览器可直接打开的文件启用，其余仅提供真实下载。</p>
          </div>
        </div>

        <div className="console-grid console-grid-2">
          <div className="console-field">
            <label htmlFor="deliverable-search">搜索文件名 / 路径</label>
            <div className="console-inline">
              <Search className="h-4 w-4" />
              <input
                id="deliverable-search"
                className="console-input"
                placeholder="例如 tianli_presentation 或 generated_ppts"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>

          <div className="console-field">
            <label htmlFor="deliverable-filter">文件类型</label>
            <div className="console-inline">
              <Filter className="h-4 w-4" />
              <select
                id="deliverable-filter"
                className="console-select"
                value={fileTypeFilter}
                onChange={(event) => setFileTypeFilter(event.target.value)}
              >
                {fileTypes.map((fileType) => (
                  <option key={fileType} value={fileType}>
                    {fileType === 'all' ? '全部类型' : fileType.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">真实产物文件</h3>
            <p className="console-card-copy">当前页面不再展示 mock 产物，所有条目都来自后端目录扫描。</p>
          </div>
          <span className="console-badge">{filteredDeliverables.length} items</span>
        </div>

        {loading ? (
          <div className="console-empty">
            <FileStack className="h-10 w-10 animate-pulse" />
            <p>正在扫描产物目录…</p>
          </div>
        ) : filteredDeliverables.length === 0 ? (
          <div className="console-empty">
            <FileStack className="h-10 w-10" />
            <p>当前筛选条件下没有文件。</p>
          </div>
        ) : (
          <div className="console-list">
            {filteredDeliverables.map((item) => (
              <article className="console-list-item" key={item.id} data-testid="deliverable-item">
                <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                  <div className="console-stack" style={{ gap: '0.35rem' }}>
                    <strong>{item.fileName}</strong>
                    <div className="console-meta">
                      <span>{item.rootName}</span>
                      <span>{item.fileType.toUpperCase()}</span>
                      <span>{formatFileSize(item.sizeBytes)}</span>
                      <span>{new Date(item.modifiedAt).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                  <span className="console-badge">{item.fileType.toUpperCase()}</span>
                </div>

                <p className="console-card-copy console-code">{item.relativePath}</p>

                <div className="console-form-actions">
                  {previewable(item.fileType) ? (
                    <a
                      className="console-button console-button-ghost"
                      href={apiUrl(item.downloadUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye className="h-4 w-4" />
                      预览
                    </a>
                  ) : (
                    <button className="console-button console-button-ghost" type="button" disabled>
                      <Eye className="h-4 w-4" />
                      不支持预览
                    </button>
                  )}
                  <a className="console-button console-button-primary" href={apiUrl(item.downloadUrl)}>
                    <Download className="h-4 w-4" />
                    下载文件
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
