import { Boxes, Link2, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { fetchSkills, refreshSkills, type SkillInventoryItem } from '../utils/api'

export default function SkillManager() {
  const [skills, setSkills] = useState<SkillInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'installed' | 'missing'>('all')
  const [refreshing, setRefreshing] = useState(false)

  const loadSkills = async () => {
    const response = await fetchSkills()
    setSkills(response.items)
  }

  useEffect(() => {
    let alive = true

    const load = async () => {
      try {
        const response = await fetchSkills()
        if (alive) {
          setSkills(response.items)
        }
      } catch (error) {
        console.error('Failed to load skills', error)
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

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesMode =
        filterMode === 'all' ||
        (filterMode === 'installed' && skill.installed) ||
        (filterMode === 'missing' && !skill.installed)
      const haystack = `${skill.skill_id} ${skill.name} ${skill.description} ${skill.hero_names.join(' ')}`.toLowerCase()
      const matchesSearch = !searchTerm || haystack.includes(searchTerm.toLowerCase())
      return matchesMode && matchesSearch
    })
  }, [filterMode, searchTerm, skills])

  const stats = useMemo(
    () => ({
      total: skills.length,
      installed: skills.filter((skill) => skill.installed).length,
      missing: skills.filter((skill) => !skill.installed).length,
      linked: skills.filter((skill) => skill.hero_count > 0).length,
    }),
    [skills],
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshSkills()
      await loadSkills()
    } catch (error) {
      console.error('Failed to refresh skills', error)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <section className="console-kpi-grid">
        <div className="console-kpi">
          <div className="console-kpi-label">总技能数</div>
          <div className="console-kpi-value">{stats.total}</div>
          <div className="console-kpi-copy">本地 skill 根目录 + Hero 关联合集</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">已安装</div>
          <div className="console-kpi-value">{stats.installed}</div>
          <div className="console-kpi-copy">可被本地 SKILL.md 真实解析</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">缺失引用</div>
          <div className="console-kpi-value">{stats.missing}</div>
          <div className="console-kpi-copy">Hero 链接了 skill，但本地未解析到</div>
        </div>
        <div className="console-kpi">
          <div className="console-kpi-label">Hero 关联</div>
          <div className="console-kpi-value">{stats.linked}</div>
          <div className="console-kpi-copy">至少被一个 Hero 关联的 skill</div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">技能目录</h3>
            <p className="console-card-copy">第一阶段只做真实读取与刷新，不提供假安装成功按钮。</p>
          </div>
          <button
            className="console-button console-button-primary"
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新来源
          </button>
        </div>

        <div className="console-grid console-grid-2">
          <div className="console-field">
            <label htmlFor="skill-search">搜索 skill</label>
            <input
              id="skill-search"
              className="console-input"
              placeholder="搜索 skill 名称、描述或 Hero"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="console-field">
            <label htmlFor="skill-filter">状态过滤</label>
            <select
              id="skill-filter"
              className="console-select"
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value as 'all' | 'installed' | 'missing')}
            >
              <option value="all">全部</option>
              <option value="installed">已安装</option>
              <option value="missing">缺失引用</option>
            </select>
          </div>
        </div>
      </section>

      <section className="console-card">
        <div className="console-card-header">
          <div>
            <h3 className="console-card-title">真实 skill 列表</h3>
            <p className="console-card-copy">这里显示的不是商店演示数据，而是本地解析结果与 Hero 的实际链接关系。</p>
          </div>
          <span className="console-badge">{filteredSkills.length} results</span>
        </div>

        {loading ? (
          <div className="console-empty">
            <Boxes className="h-10 w-10 animate-pulse" />
            <p>正在读取 skill 根目录…</p>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="console-empty">
            <Boxes className="h-10 w-10" />
            <p>当前没有符合条件的 skill。</p>
          </div>
        ) : (
          <div className="console-list">
            {filteredSkills.map((skill) => (
              <article className="console-list-item" data-testid="skill-item" key={skill.skill_id}>
                <div className="console-inline" style={{ justifyContent: 'space-between' }}>
                  <div className="console-stack" style={{ gap: '0.35rem' }}>
                    <strong>{skill.name}</strong>
                    <div className="console-meta">
                      <span className="console-code">{skill.skill_id}</span>
                      <span className="console-badge" data-tone={skill.installed ? 'success' : 'warning'}>
                        {skill.installed ? '已安装' : '缺失引用'}
                      </span>
                    </div>
                  </div>
                  <span className="console-badge">{skill.hero_count} Heroes</span>
                </div>

                <p className="console-card-copy">{skill.description}</p>
                <div className="console-meta">
                  <span className="console-code">{skill.source}</span>
                </div>

                <div className="console-chip-row" style={{ marginTop: '0.85rem' }}>
                  {skill.hero_names.length > 0 ? (
                    skill.hero_names.map((heroName) => (
                      <span className="console-pill" key={`${skill.skill_id}-${heroName}`}>
                        <Link2 className="h-4 w-4" />
                        {heroName}
                      </span>
                    ))
                  ) : (
                    <span className="console-pill">
                      <Sparkles className="h-4 w-4" />
                      当前没有 Hero 关联
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
