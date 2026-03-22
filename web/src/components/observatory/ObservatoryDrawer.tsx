import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'

import {
  formatSkillCountLabel,
  formatStatusLabel,
  resolveDeliverySummary,
  resolveHeroDisplayName,
  resolveLogMessage,
  t,
} from '../../i18n'
import { MainMonitor } from './MainMonitor'
import type { HeroState, Language, LogEntry, RunSummary, SkillDispatchState, Stats, TaskState, UiAnchor } from '../../types'

type SkillTraceState = SkillDispatchState & { taskTitle?: string }

interface ObservatoryDrawerProps {
  isOpen: boolean
  selectedNodeId: string | null
  drawerOrigin: UiAnchor | null
  language: Language
  focusKind: 'hero' | 'task'
  focusTask: TaskState | null
  focusHero: HeroState | null
  consultHeroes: HeroState[]
  skillDispatches: SkillTraceState[]
  logs: LogEntry[]
  stats: Stats
  heroes: HeroState[]
  tasks: TaskState[]
  runSummary: RunSummary | null
  judgmentInput: string
  isSubmitting: boolean
  onToggleLanguage: () => void
  onClose: () => void
  onSelectNode: (nodeId: string | null) => void
  onJudgmentInputChange: (value: string) => void
  onVerdict: (verdict: 'approve' | 'reject') => void
}

function findFocusableElements(container: HTMLElement) {
  const selectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[href]',
    '[tabindex]:not([tabindex="-1"])',
  ]
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(','))).filter(
    (element) => !element.hasAttribute('hidden') && element.tabIndex !== -1,
  )
}

function formatSkillCount(task: TaskState[], heroId: string, language: Language) {
  const skillIds = new Set<string>()
  for (const item of task) {
    for (const skill of item.skillDispatches ?? []) {
      if (skill.heroId === heroId && skill.status === 'applied') {
        skillIds.add(skill.skillId)
      }
    }
  }
  return formatSkillCountLabel(skillIds.size, language)
}

function buildDrawerMotion(origin: UiAnchor | null) {
  if (typeof window === 'undefined' || !origin) {
    return {
      panelStyle: {
        '--drawer-origin-y': '50vh',
      } as CSSProperties,
      beamStyle: {
        left: '54vw',
        top: '50vh',
        width: '46vw',
      } as CSSProperties,
      nodeStyle: {
        left: '54vw',
        top: '50vh',
      } as CSSProperties,
    }
  }

  const safeX = Math.max(16, Math.min(window.innerWidth - 32, origin.x))
  const safeY = Math.max(32, Math.min(window.innerHeight - 32, origin.y))
  return {
    panelStyle: {
      '--drawer-origin-y': `${safeY}px`,
    } as CSSProperties,
    beamStyle: {
      left: `${safeX}px`,
      top: `${safeY - 56}px`,
      width: `${Math.max(120, window.innerWidth - safeX)}px`,
    } as CSSProperties,
    nodeStyle: {
      left: `${safeX}px`,
      top: `${safeY}px`,
    } as CSSProperties,
  }
}

export function ObservatoryDrawer({
  isOpen,
  selectedNodeId,
  drawerOrigin,
  language,
  focusKind,
  focusTask,
  focusHero,
  consultHeroes,
  skillDispatches,
  logs,
  stats,
  heroes,
  tasks,
  runSummary,
  judgmentInput,
  isSubmitting,
  onToggleLanguage,
  onClose,
  onSelectNode,
  onJudgmentInputChange,
  onVerdict,
}: ObservatoryDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const compactLogs = useMemo(() => logs.slice(-8).reverse(), [logs])
  const motion = buildDrawerMotion(drawerOrigin)
  const localHeroes = useMemo(() => heroes.filter((hero) => hero.source === 'local').length, [heroes])
  const remoteHeroes = heroes.length - localHeroes

  useEffect(() => {
    if (!isOpen || !drawerRef.current) {
      return
    }

    const drawer = drawerRef.current
    const focusables = findFocusableElements(drawer)
    ;(focusables[0] ?? drawer).focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        requestAnimationFrame(() => {
          document.getElementById('observatory-edge-trigger')?.focus()
        })
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const currentFocusables = findFocusableElements(drawer)
      if (currentFocusables.length === 0) {
        event.preventDefault()
        drawer.focus()
        return
      }

      const first = currentFocusables[0]
      const last = currentFocusables[currentFocusables.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey && activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <>
      <button type="button" className="observatory-backdrop" aria-label={t(language, 'close_observatory')} onClick={onClose} />
      <div className="observatory-drawer-beam" aria-hidden="true" style={motion.beamStyle}>
        <span className="observatory-drawer-beam-core" />
      </div>
      <div className="observatory-drawer-origin" aria-hidden="true" style={motion.nodeStyle} />
      <aside className="observatory-drawer" role="dialog" aria-modal="true" aria-label={t(language, 'observatory_title')}>
        <div className="observatory-drawer-panel" ref={drawerRef} tabIndex={-1} style={motion.panelStyle}>
          <div className="observatory-drawer-topbar">
            <div>
              <div className="observatory-kicker">{t(language, 'observe')}</div>
              <h2 className="observatory-drawer-title">{t(language, 'observatory_title')}</h2>
            </div>
            <div className="observatory-drawer-actions">
              <button
                type="button"
                className="galaxy-language-toggle"
                aria-label={language === 'zh' ? t(language, 'switch_to_en') : t(language, 'switch_to_zh')}
                onClick={onToggleLanguage}
              >
                {t(language, 'language_toggle')}
              </button>
              <button type="button" className="observatory-drawer-close" onClick={onClose}>
                {t(language, 'return_galaxy')}
              </button>
            </div>
          </div>

          <MainMonitor
            language={language}
            focusKind={focusKind}
            focusTask={focusTask}
            focusHero={focusHero}
            consultHeroes={consultHeroes}
            skillDispatches={skillDispatches}
            logs={compactLogs.slice(0, 3)}
            judgmentInput={judgmentInput}
            isSubmitting={isSubmitting}
            onJudgmentInputChange={onJudgmentInputChange}
            onVerdict={onVerdict}
          />

          <div className="observatory-drawer-accordions">
            <details className="observatory-drawer-section">
              <summary>
                <span>{t(language, 'hero_roster')}</span>
                <span className="observatory-summary-chip">{heroes.length}</span>
              </summary>
              <div className="observatory-roster-meta">
                {t(language, 'hero_roster_summary', {
                  total: heroes.length,
                  local: localHeroes,
                  remote: remoteHeroes,
                })}
              </div>
              <div className="observatory-list">
                {heroes.map((hero) => (
                  <button
                    key={hero.heroId}
                    type="button"
                    className={`observatory-list-item ${selectedNodeId === hero.heroId ? 'observatory-list-item-active' : ''}`}
                    onClick={() => onSelectNode(hero.heroId)}
                  >
                    <strong>{resolveHeroDisplayName(hero, language)}</strong>
                    <span>
                      {formatStatusLabel(hero.status, language)} · {hero.source === 'local' ? t(language, 'local_cluster') : t(language, 'remote_cluster')} ·{' '}
                      {hero.tags.slice(0, 3).join(' / ') || t(language, 'role_unlabeled')} · {formatSkillCount(tasks, hero.heroId, language)}
                    </span>
                  </button>
                ))}
              </div>
            </details>

            <details className="observatory-drawer-section">
              <summary>{t(language, 'stats_and_flows')}</summary>
              <div className="observatory-drawer-stats">
                <div className="observatory-stat">
                  <span>{t(language, 'sky_status')}</span>
                  <strong>{formatStatusLabel(stats.status, language)}</strong>
                </div>
                <div className="observatory-stat">
                  <span>{t(language, 'active_destinies')}</span>
                  <strong>{stats.activeTasks}</strong>
                </div>
                <div className="observatory-stat">
                  <span>{t(language, 'active_heroes')}</span>
                  <strong>{stats.activeHeroes}</strong>
                </div>
                <div className="observatory-stat">
                  <span>{t(language, 'early_exit_count')}</span>
                  <strong>{stats.earlyExits}</strong>
                </div>
              </div>

              <div className="observatory-list">
                {tasks.map((task) => (
                  <button
                    key={task.taskId}
                    type="button"
                    className={`observatory-list-item ${selectedNodeId === task.taskId ? 'observatory-list-item-active' : ''}`}
                    onClick={() => onSelectNode(task.taskId)}
                  >
                    <strong>{task.title}</strong>
                    <span>
                      {formatStatusLabel(task.status, language)} ·{' '}
                      {task.selectedHeroIds.length > 0
                        ? task.selectedHeroIds
                            .map((heroId) => {
                              const hero = heroes.find((item) => item.heroId === heroId)
                              return hero ? resolveHeroDisplayName(hero, language) : heroId
                            })
                            .join(' / ')
                        : t(language, 'routing_hero')}
                    </span>
                  </button>
                ))}
              </div>
            </details>

            <details className="observatory-drawer-section">
              <summary>{t(language, 'trace_history')}</summary>
              <div className="observatory-drawer-history">
                <p className="observatory-card-copy">{(runSummary ? resolveDeliverySummary(runSummary, language) : '') || t(language, 'latest_delivery_empty')}</p>
                <div className="observatory-log-list">
                  {compactLogs.length === 0 ? (
                    <div className="observatory-empty">{t(language, 'no_logs')}</div>
                  ) : (
                    compactLogs.map((log) => (
                      <div key={log.id} className="observatory-log-item">
                        <span className={`observatory-log-level observatory-log-level-${log.level.toLowerCase()}`}>{log.level}</span>
                        <div>
                          <div className="observatory-log-msg">{resolveLogMessage(log, language)}</div>
                          <div className="observatory-log-meta">
                            {log.time} · {log.module}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </details>
          </div>
        </div>
      </aside>
    </>
  )
}
