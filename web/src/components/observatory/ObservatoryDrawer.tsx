import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'

import {
  formatHeroCountLabel,
  formatRoundLabel,
  formatSkillCountLabel,
  formatStatusLabel,
  resolveDetailSummary,
  resolveDeliverySummary,
  resolveHeroDisplayName,
  resolveLogMessage,
  t,
} from '../../i18n'
import { MainMonitor } from './MainMonitor'
import type { DeliveryDetail, HeroState, Language, LogEntry, RunSummary, SkillDispatchState, Stats, TaskState, UiAnchor } from '../../types'
import { collectHeroSkillIds, countHeroSkills } from '../../utils/heroSkills'
import { buildRegionTelemetry } from '../../utils/regions'

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

function countTaskSkillDispatches(task: TaskState) {
  return new Set(
    (task.skillDispatches ?? [])
      .filter((skill) => skill.status === 'applied')
      .map((skill) => skill.skillId),
  ).size
}

function resolveTaskHeroes(task: TaskState, heroes: HeroState[]) {
  const orderedIds = [task.primaryHeroId, ...task.consultHeroIds, ...task.selectedHeroIds].filter(Boolean) as string[]
  return Array.from(new Set(orderedIds))
    .map((heroId) => heroes.find((hero) => hero.heroId === heroId) ?? null)
    .filter((hero): hero is HeroState => hero !== null)
}

function shortenText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 3)}...`
}

function formatTimestamp(value: unknown, language: Language) {
  if (typeof value !== 'string' || !value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function countDetailSkillDispatches(detail: DeliveryDetail) {
  return new Set(
    (detail.skillDispatches ?? [])
      .filter((skill) => skill.status === 'applied')
      .map((skill) => skill.skillId),
  ).size
}

function resolveTaskEarlyExitCount(task: TaskState) {
  return (task.deliveryDetails ?? []).filter((detail) => detail.status === 'early_exit' || Boolean(detail.evolutionPatch)).length
}

function resolveDetailHero(detail: DeliveryDetail, heroes: HeroState[]) {
  if (!detail.heroId) {
    return null
  }
  return heroes.find((hero) => hero.heroId === detail.heroId) ?? null
}

function buildGovernanceEvents(tasks: TaskState[]) {
  return tasks
    .flatMap((task) =>
      (task.deliveryDetails ?? [])
        .filter((detail) => detail.status === 'early_exit' || Boolean(detail.evolutionPatch))
        .map((detail) => ({
          taskId: task.taskId,
          taskTitle: task.title,
          taskUpdatedAt: task.updatedAt,
          detail,
        })),
    )
    .sort((left, right) => right.taskUpdatedAt.localeCompare(left.taskUpdatedAt))
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
  const taskFocus = useMemo(
    () =>
      focusTask ??
      (focusHero?.currentTaskId ? tasks.find((task) => task.taskId === focusHero.currentTaskId) ?? null : null) ??
      tasks[0] ??
      null,
    [focusHero, focusTask, tasks],
  )
  const taskFocusHeroes = useMemo(
    () => (taskFocus ? resolveTaskHeroes(taskFocus, heroes) : focusHero ? [focusHero] : []),
    [focusHero, heroes, taskFocus],
  )
  const taskFocusPrimaryHero = useMemo(
    () => (taskFocus?.primaryHeroId ? heroes.find((hero) => hero.heroId === taskFocus.primaryHeroId) ?? null : null),
    [heroes, taskFocus?.primaryHeroId],
  )
  const regionTelemetry = useMemo(() => buildRegionTelemetry(heroes, tasks), [heroes, tasks])
  const focusRegionIds = useMemo(
    () =>
      new Set(
        regionTelemetry
          .filter((region) => taskFocusHeroes.some((hero) => region.heroIds.includes(hero.heroId)))
          .map((region) => region.id),
      ),
    [regionTelemetry, taskFocusHeroes],
  )
  const governanceEvents = useMemo(() => buildGovernanceEvents(tasks), [tasks])
  const recoveringHeroes = useMemo(() => heroes.filter((hero) => hero.status === 'recovering'), [heroes])
  const taskFocusEarlyExitCount = taskFocus ? resolveTaskEarlyExitCount(taskFocus) : 0

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
              <div className="observatory-kicker">{t(language, 'project_backstage')}</div>
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

          <section className="observatory-delivery-board">
            <div className="observatory-section-heading">
              <div>
                <div className="observatory-card-kicker">{t(language, 'delivery_results')}</div>
                <h3 className="observatory-section-title">
                  {taskFocus ? taskFocus.title : t(language, 'delivery_result_empty')}
                </h3>
              </div>
              {taskFocus ? <span className="observatory-summary-chip">{formatStatusLabel(taskFocus.status, language)}</span> : null}
            </div>

            {taskFocus ? (
              <>
                <article className="observatory-delivery-summary">
                  <div className="observatory-delivery-summary-head">
                    <strong>{t(language, 'delivery_summary_title')}</strong>
                    <span>{formatRoundLabel(taskFocus.verdictRound + 1, language)}</span>
                  </div>
                  <p className="observatory-card-copy">
                    {resolveDeliverySummary(taskFocus, language) || taskFocus.reasoning || t(language, 'delivery_result_empty')}
                  </p>
                  <div className="observatory-delivery-summary-meta">
                    <span className="observatory-task-card-chip">
                      {formatHeroCountLabel(taskFocusHeroes.length || taskFocus.selectedHeroIds.length, language)}
                    </span>
                    <span className="observatory-task-card-chip">
                      {formatSkillCountLabel(countTaskSkillDispatches(taskFocus), language)}
                    </span>
                    {taskFocus.primaryHeroId ? (
                      <span className="observatory-task-card-chip">
                        {t(language, 'primary_hero', {
                          hero: taskFocusPrimaryHero
                            ? resolveHeroDisplayName(taskFocusPrimaryHero, language)
                            : taskFocus.primaryHeroId,
                        })}
                      </span>
                    ) : null}
                  </div>
                </article>

                <div className="observatory-delivery-grid">
                  {(taskFocus.deliveryDetails ?? []).length === 0 ? (
                    <div className="observatory-empty">{t(language, 'delivery_result_empty')}</div>
                  ) : (
                    taskFocus.deliveryDetails.map((detail, index) => {
                      const detailHero = resolveDetailHero(detail, heroes)
                      const detailName =
                        detailHero
                          ? resolveHeroDisplayName(detailHero, language)
                          : detail.displayNameZh && language === 'zh'
                            ? detail.displayNameZh
                            : detail.displayNameEn && language === 'en'
                              ? detail.displayNameEn
                              : detail.displayName || detail.heroId || `${t(language, 'hero')} ${index + 1}`
                      const skillDispatches = (detail.skillDispatches ?? []).filter((skill) => skill.status === 'applied')
                      const completedContribution = skillDispatches.find(
                        (skill) => skill.executionStatus === 'completed' && (skill.contribution || skill.summary),
                      )

                      return (
                        <article key={`${taskFocus.taskId}-${detail.heroId ?? index}`} className="observatory-delivery-card">
                          <div className="observatory-delivery-card-head">
                            <div>
                              <div className="observatory-card-kicker">{detail.role === 'consult' ? t(language, 'consult_lane') : t(language, 'primary_lane')}</div>
                              <strong>{detailName}</strong>
                            </div>
                            <span className="observatory-task-card-status">{formatStatusLabel(detail.status || 'completed', language)}</span>
                          </div>
                          <div className="observatory-delivery-card-meta">
                            <span className="observatory-task-card-chip">{formatSkillCountLabel(countDetailSkillDispatches(detail), language)}</span>
                            {typeof detail.steps === 'number' ? (
                              <span className="observatory-task-card-chip">{language === 'zh' ? `${detail.steps} 步执行` : `${detail.steps} steps`}</span>
                            ) : null}
                          </div>
                          <p className="observatory-delivery-card-copy">
                            {resolveDetailSummary(detail, language) || detail.error || t(language, 'delivery_result_empty')}
                          </p>
                          {skillDispatches.length > 0 ? (
                            <div className="observatory-delivery-skill-row">
                              {skillDispatches.slice(0, 4).map((skill) => (
                                <span key={`${detail.heroId}-${skill.skillId}`} className="observatory-task-card-chip">
                                  {skill.skillId}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {completedContribution ? (
                            <div className="observatory-delivery-note">
                              <div className="observatory-card-kicker">{t(language, 'skill_contribution')}</div>
                              <p>{shortenText(completedContribution.contribution || completedContribution.summary || '', 180)}</p>
                            </div>
                          ) : null}
                          {detail.evolutionPatch ? (
                            <div className="observatory-delivery-evolution">
                              <div className="observatory-card-kicker">{t(language, 'evolution_patch')}</div>
                              <pre>{detail.evolutionPatch}</pre>
                            </div>
                          ) : null}
                        </article>
                      )
                    })
                  )}
                </div>

                <div className="observatory-verdict-panel">
                  <div className="observatory-section-heading">
                    <div>
                      <div className="observatory-card-kicker">{t(language, 'verdict_history')}</div>
                      <h4 className="observatory-section-title">{taskFocus.title}</h4>
                    </div>
                  </div>
                  {(taskFocus.verdictHistory ?? []).length === 0 ? (
                    <div className="observatory-empty">{t(language, 'no_verdict_history')}</div>
                  ) : (
                    <div className="observatory-verdict-list">
                      {taskFocus.verdictHistory.map((record, index) => {
                        const verdict = typeof record.verdict === 'string' ? record.verdict : ''
                        const note = typeof record.note === 'string' ? record.note : ''
                        const round = typeof record.round === 'number' ? record.round + 1 : index + 1
                        const timestamp = formatTimestamp(record.timestamp, language)

                        return (
                          <article key={`${taskFocus.taskId}-verdict-${index}`} className="observatory-verdict-item">
                            <div className="observatory-verdict-item-head">
                              <strong>{verdict === 'approve' ? t(language, 'approve') : t(language, 'reject')}</strong>
                              <span>{formatRoundLabel(round, language)}</span>
                            </div>
                            <p>{note || t(language, 'latest_delivery_empty')}</p>
                            {timestamp ? <span className="observatory-verdict-time">{timestamp}</span> : null}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="observatory-empty">{t(language, 'delivery_result_empty')}</div>
            )}
          </section>

          <section className="observatory-region-feedback">
            <div className="observatory-section-heading">
              <div>
                <div className="observatory-card-kicker">{t(language, 'region_feedback')}</div>
                <h3 className="observatory-section-title">{t(language, 'region_feedback')}</h3>
              </div>
              <span className="observatory-summary-chip">{regionTelemetry.length}</span>
            </div>

            {regionTelemetry.length === 0 ? (
              <div className="observatory-empty">{t(language, 'region_feedback_empty')}</div>
            ) : (
              <div className="observatory-region-grid">
                {regionTelemetry.map((region) => {
                  const latestTask = region.latestTaskId ? tasks.find((task) => task.taskId === region.latestTaskId) ?? null : null
                  const targetNodeId = latestTask?.taskId ?? region.representativeHeroId
                  const isActive = focusRegionIds.has(region.id)

                  return (
                    <button
                      key={region.id}
                      type="button"
                      className={`observatory-region-card ${isActive ? 'observatory-region-card-active' : ''}`}
                      onClick={() => onSelectNode(targetNodeId)}
                    >
                      <div className="observatory-region-card-head">
                        <strong>{language === 'zh' ? region.labelZh : region.labelEn}</strong>
                        <span className="observatory-task-card-status">
                          {region.activeTaskCount > 0 ? formatStatusLabel(region.latestTaskStatus || 'running', language) : t(language, 'region_feedback_quiet')}
                        </span>
                      </div>
                      <div className="observatory-region-card-meta">
                        <span className="observatory-task-card-chip">{formatHeroCountLabel(region.totalHeroes, language)}</span>
                        <span className="observatory-task-card-chip">
                          {t(language, 'region_task_load', { tasks: region.activeTaskCount, heroes: region.busyHeroCount })}
                        </span>
                        {region.earlyExitCount > 0 ? (
                          <span className="observatory-task-card-chip">{language === 'zh' ? `${region.earlyExitCount} 次天劫` : `${region.earlyExitCount} early exits`}</span>
                        ) : null}
                      </div>
                      <div className="observatory-card-kicker">{t(language, 'latest_feedback')}</div>
                      <p className="observatory-region-card-copy">
                        {latestTask
                          ? shortenText(resolveDeliverySummary(latestTask, language) || latestTask.title || t(language, 'region_feedback_quiet'), 180)
                          : t(language, 'region_feedback_quiet')}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section className="observatory-governance-board">
            <div className="observatory-section-heading">
              <div>
                <div className="observatory-card-kicker">{t(language, 'governance_board')}</div>
                <h3 className="observatory-section-title">{t(language, 'governance_board')}</h3>
              </div>
              <span className="observatory-summary-chip">{stats.earlyExits}</span>
            </div>

            <div className="observatory-governance-kpis">
              <div className="observatory-stat">
                <span>{t(language, 'early_exit_count')}</span>
                <strong>{stats.earlyExits}</strong>
              </div>
              <div className="observatory-stat">
                <span>{t(language, 'recovering_heroes')}</span>
                <strong>{recoveringHeroes.length}</strong>
              </div>
              <div className="observatory-stat">
                <span>{t(language, 'focused_task_exits')}</span>
                <strong>{taskFocusEarlyExitCount}</strong>
              </div>
            </div>

            {governanceEvents.length === 0 ? (
              <div className="observatory-empty">{t(language, 'governance_clear')}</div>
            ) : (
              <div className="observatory-governance-grid">
                {governanceEvents.map((event, index) => {
                  const detailHero = resolveDetailHero(event.detail, heroes)
                  const heroLabel =
                    detailHero
                      ? resolveHeroDisplayName(detailHero, language)
                      : event.detail.displayNameZh && language === 'zh'
                        ? event.detail.displayNameZh
                        : event.detail.displayNameEn && language === 'en'
                          ? event.detail.displayNameEn
                          : event.detail.displayName || event.detail.heroId || `${t(language, 'hero')} ${index + 1}`

                  return (
                    <article key={`${event.taskId}-${event.detail.heroId ?? index}`} className="observatory-governance-card">
                      <div className="observatory-governance-card-head">
                        <strong>{heroLabel}</strong>
                        <span className="observatory-task-card-status">{formatStatusLabel(event.detail.status || 'early_exit', language)}</span>
                      </div>
                      <div className="observatory-governance-card-meta">{event.taskTitle}</div>
                      <p>{resolveDetailSummary(event.detail, language) || t(language, 'governance_clear')}</p>
                      {event.detail.evolutionPatch ? (
                        <div className="observatory-delivery-evolution">
                          <div className="observatory-card-kicker">{t(language, 'evolution_patch')}</div>
                          <pre>{event.detail.evolutionPatch}</pre>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="observatory-task-board">
            <div className="observatory-section-heading">
              <div>
                <div className="observatory-card-kicker">{t(language, 'task_board')}</div>
                <h3 className="observatory-section-title">
                  {taskFocus ? taskFocus.title : t(language, 'active_destinies')}
                </h3>
              </div>
              <span className="observatory-summary-chip">{tasks.length}</span>
            </div>
            <div className="observatory-task-board-grid">
              {tasks.map((task) => {
                const primaryHero = task.primaryHeroId ? heroes.find((hero) => hero.heroId === task.primaryHeroId) ?? null : null
                const selectedHeroes = resolveTaskHeroes(task, heroes)
                const skillCount = countTaskSkillDispatches(task)
                const earlyExitCount = resolveTaskEarlyExitCount(task)

                return (
                  <button
                    key={task.taskId}
                    type="button"
                    className={`observatory-task-card ${
                      selectedNodeId === task.taskId || taskFocus?.taskId === task.taskId ? 'observatory-task-card-active' : ''
                    }`}
                    onClick={() => onSelectNode(task.taskId)}
                  >
                    <div className="observatory-task-card-head">
                      <span className="observatory-task-card-status">{formatStatusLabel(task.status, language)}</span>
                      <span className="observatory-task-card-round">{formatRoundLabel(task.verdictRound + 1, language)}</span>
                    </div>
                    <strong className="observatory-task-card-title">{task.title}</strong>
                    <p className="observatory-task-card-copy">
                      {resolveDeliverySummary(task, language) || task.reasoning || t(language, 'latest_delivery_empty')}
                    </p>
                    <div className="observatory-task-card-meta">
                      {task.primaryHeroId
                        ? t(language, 'primary_hero', {
                            hero: primaryHero ? resolveHeroDisplayName(primaryHero, language) : task.primaryHeroId,
                          })
                        : t(language, 'routing_hero')}
                    </div>
                    <div className="observatory-task-card-chips">
                      <span className="observatory-task-card-chip">{formatHeroCountLabel(selectedHeroes.length, language)}</span>
                      <span className="observatory-task-card-chip">{formatSkillCountLabel(skillCount, language)}</span>
                      {earlyExitCount > 0 ? (
                        <span className="observatory-task-card-chip">{language === 'zh' ? `${earlyExitCount} 次天劫` : `${earlyExitCount} early exits`}</span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="observatory-task-lane">
            <div className="observatory-section-heading">
              <div>
                <div className="observatory-card-kicker">{t(language, 'task_related_heroes')}</div>
                <h3 className="observatory-section-title">
                  {taskFocus ? taskFocus.title : focusHero ? resolveHeroDisplayName(focusHero, language) : t(language, 'no_focus')}
                </h3>
              </div>
            </div>

            <div className="observatory-task-hero-grid">
              {taskFocusHeroes.length === 0 ? (
                <div className="observatory-empty">{t(language, 'no_focus_copy')}</div>
              ) : (
                taskFocusHeroes.map((hero) => {
                  const skillIds = collectHeroSkillIds(hero, tasks)
                  return (
                    <button
                      key={hero.heroId}
                      type="button"
                      className={`observatory-task-hero-card ${selectedNodeId === hero.heroId ? 'observatory-task-hero-card-active' : ''}`}
                      onClick={() => onSelectNode(hero.heroId)}
                    >
                      <div className="observatory-task-hero-head">
                        <strong>{resolveHeroDisplayName(hero, language)}</strong>
                        <span>{formatStatusLabel(hero.status, language)}</span>
                      </div>
                      <div className="observatory-task-hero-meta">
                        {hero.tags.slice(0, 3).join(' / ') || t(language, 'role_unlabeled')}
                      </div>
                      <div className="observatory-task-hero-skills">
                        <span className="observatory-task-card-chip">{formatSkillCountLabel(skillIds.length, language)}</span>
                        {skillIds.slice(0, 3).map((skillId) => (
                          <span key={skillId} className="observatory-task-card-chip">
                            {skillId}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="observatory-drawer-section observatory-drawer-section-static">
            <div className="observatory-section-heading">
              <div>
                <div className="observatory-card-kicker">{t(language, 'stats_and_flows')}</div>
                <h3 className="observatory-section-title">{formatStatusLabel(stats.status, language)}</h3>
              </div>
            </div>
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
          </section>

          <div className="observatory-drawer-accordions">
            <details className="observatory-drawer-section">
              <summary>
                <span>{t(language, 'hero_directory')}</span>
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
                      {hero.tags.slice(0, 3).join(' / ') || t(language, 'role_unlabeled')} ·{' '}
                      {formatSkillCountLabel(countHeroSkills(hero, tasks), language)}
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
