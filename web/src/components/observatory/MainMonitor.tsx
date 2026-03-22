import {
  formatRoleLabel,
  formatRoundLabel,
  formatStatusLabel,
  resolveDeliverySummary,
  resolveHeroDescription,
  resolveHeroDisplayName,
  resolveLogMessage,
  t,
} from '../../i18n'
import type { HeroState, Language, LogEntry, SkillDispatchState, TaskState } from '../../types'

type SkillTraceState = SkillDispatchState & { taskTitle?: string }

interface MainMonitorProps {
  language: Language
  focusKind: 'hero' | 'task'
  focusTask: TaskState | null
  focusHero: HeroState | null
  consultHeroes: HeroState[]
  skillDispatches: SkillTraceState[]
  logs: LogEntry[]
  judgmentInput: string
  isSubmitting: boolean
  onJudgmentInputChange: (value: string) => void
  onVerdict: (verdict: 'approve' | 'reject') => void
}

interface TimelineEntry {
  id: string
  lane: 'primary' | 'consult' | 'law' | 'trace'
  title: string
  body: string
  meta: string
}

function renderHeroSummary(hero: HeroState, language: Language) {
  const description = resolveHeroDescription(hero, language)
  if (description) {
    return description
  }
  if (hero.tags.length > 0) {
    return hero.tags.slice(0, 4).join(' · ')
  }
  return t(language, 'role_unlabeled')
}

function renderTaskSummary(task: TaskState, language: Language) {
  return resolveDeliverySummary(task, language) || task.reasoning || t(language, 'latest_delivery_empty')
}

function shortenText(value: string, maxLength = 200) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 3)}...`
}

function buildTimeline(
  language: Language,
  focusKind: 'hero' | 'task',
  focusTask: TaskState | null,
  focusHero: HeroState | null,
  skillDispatches: SkillTraceState[],
  logs: LogEntry[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  if (focusKind === 'hero' && focusHero) {
    entries.push({
      id: `hero-${focusHero.heroId}`,
      lane: 'primary',
      title: resolveHeroDisplayName(focusHero, language),
      body: shortenText(renderHeroSummary(focusHero, language)),
      meta: `${formatStatusLabel(focusHero.status, language)} · ${focusHero.tags.slice(0, 2).join(' / ') || t(language, 'role_unlabeled')}`,
    })
  } else if (focusTask) {
    entries.push({
      id: `dispatch-${focusTask.taskId}`,
      lane: 'law',
      title: t(language, 'dispatch'),
      body: shortenText(renderTaskSummary(focusTask, language)),
      meta: `${formatRoundLabel(focusTask.verdictRound + 1, language)} · ${formatStatusLabel(focusTask.status, language)}`,
    })
  } else if (focusHero) {
    entries.push({
      id: `hero-${focusHero.heroId}`,
      lane: 'primary',
      title: resolveHeroDisplayName(focusHero, language),
      body: shortenText(renderHeroSummary(focusHero, language)),
      meta: `${formatStatusLabel(focusHero.status, language)} · ${focusHero.tags.slice(0, 2).join(' / ') || t(language, 'role_unlabeled')}`,
    })
  }

  for (const skill of skillDispatches.slice(0, 6)) {
    entries.push({
      id: `${skill.taskId}-${skill.heroId}-${skill.skillId}-${skill.role}`,
      lane: skill.role === 'primary' ? 'primary' : 'consult',
      title: skill.skillId,
      body: shortenText(skill.contribution || skill.summary || skill.reason || t(language, 'latest_delivery_empty')),
      meta: `${formatRoleLabel(skill.role, language)} · ${skill.taskTitle || focusTask?.title || (focusHero ? resolveHeroDisplayName(focusHero, language) : '') || t(language, 'unlabeled_focus')}${skill.latencyMs ? ` · ${skill.latencyMs}ms` : ''}`,
    })
  }

  for (const log of logs.slice(0, 4)) {
    entries.push({
      id: `log-${String(log.id)}`,
      lane: 'trace',
      title: `${log.level} · ${log.module}`,
      body: shortenText(resolveLogMessage(log, language), 160),
      meta: log.time,
    })
  }

  if (focusTask?.status === 'judgment_pending') {
    entries.push({
      id: `judgment-${focusTask.taskId}`,
      lane: 'law',
      title: t(language, 'waiting_verdict'),
      body: t(language, 'waiting_verdict_copy'),
      meta: focusTask.primaryHeroId
        ? t(language, 'primary_hero', { hero: focusHero ? resolveHeroDisplayName(focusHero, language) : focusTask.primaryHeroId })
        : t(language, 'hero_pending'),
    })
  }

  return entries
}

export function MainMonitor({
  language,
  focusKind,
  focusTask,
  focusHero,
  consultHeroes,
  skillDispatches,
  logs,
  judgmentInput,
  isSubmitting,
  onJudgmentInputChange,
  onVerdict,
}: MainMonitorProps) {
  const timeline = buildTimeline(language, focusKind, focusTask, focusHero, skillDispatches, logs)
  const skillTags = Array.from(
    new Set([
      ...(focusHero?.linkedSkills ?? []),
      ...skillDispatches.filter((skill) => skill.status === 'applied').map((skill) => skill.skillId),
    ]),
  ).slice(0, 6)
  const isJudgmentPending = focusKind === 'task' && focusTask?.status === 'judgment_pending'
  const localizedHeroName = focusHero ? resolveHeroDisplayName(focusHero, language) : ''
  const title =
    focusKind === 'hero'
      ? localizedHeroName || focusTask?.title || t(language, 'no_focus')
      : focusTask?.title || localizedHeroName || t(language, 'no_focus')
  const summary =
    focusKind === 'hero'
      ? focusHero
        ? renderHeroSummary(focusHero, language)
        : focusTask
          ? renderTaskSummary(focusTask, language)
          : t(language, 'no_focus_copy')
      : focusTask
        ? renderTaskSummary(focusTask, language)
        : focusHero
          ? renderHeroSummary(focusHero, language)
          : t(language, 'no_focus_copy')

  return (
    <section className="main-monitor">
      <div className="main-monitor-header">
        <div>
          <div className="main-monitor-kicker">{t(language, 'main_monitor')}</div>
          <h2 className="main-monitor-title">{title || t(language, 'no_focus')}</h2>
          <p className="main-monitor-copy">{summary}</p>
        </div>

        {(focusTask || focusHero) && (
          <div className="main-monitor-status">
            {focusTask && <span className="main-monitor-badge">{formatRoundLabel(focusTask.verdictRound + 1, language)}</span>}
            {focusTask?.primaryHeroId && (
              <span className="main-monitor-badge">
                {t(language, 'primary_hero', { hero: focusHero ? resolveHeroDisplayName(focusHero, language) : focusTask.primaryHeroId })}
              </span>
            )}
            {consultHeroes.map((hero) => (
              <span key={hero.heroId} className="main-monitor-badge">
                {t(language, 'consult_hero', { hero: resolveHeroDisplayName(hero, language) })}
              </span>
            ))}
            {!focusTask && focusHero && <span className="main-monitor-badge">{formatStatusLabel(focusHero.status, language)}</span>}
          </div>
        )}
      </div>

      {skillTags.length > 0 && (
        <div className="main-monitor-skills">
          {skillTags.map((skill) => (
            <span key={skill} className="main-monitor-skill">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="main-monitor-body">
        {timeline.length === 0 ? (
          <div className="main-monitor-empty">{t(language, 'no_focus_copy')}</div>
        ) : (
          timeline.map((entry) => (
            <article key={entry.id} className={`main-monitor-entry main-monitor-entry-${entry.lane}`}>
              <div className="main-monitor-entry-meta">{entry.meta}</div>
              <strong className="main-monitor-entry-title">{entry.title}</strong>
              <p className="main-monitor-entry-copy">{entry.body}</p>
            </article>
          ))
        )}
      </div>

      {isJudgmentPending && focusTask && (
        <div className="main-monitor-verdict">
          <div className="main-monitor-verdict-title">{t(language, 'final_verdict')}</div>
          <textarea
            className="main-monitor-verdict-input"
            rows={3}
            value={judgmentInput}
            onChange={(event) => onJudgmentInputChange(event.target.value)}
            aria-label={t(language, 'judgment_input_label')}
            placeholder={t(language, 'judgment_placeholder')}
          />
          <div className="main-monitor-verdict-actions">
            <button
              type="button"
              className="destiny-console-button destiny-console-button-secondary"
              onClick={() => onVerdict('reject')}
              disabled={isSubmitting}
            >
              {t(language, 'reject')}
            </button>
            <button
              type="button"
              className="destiny-console-button destiny-console-button-approve"
              onClick={() => onVerdict('approve')}
              disabled={isSubmitting}
            >
              {t(language, 'approve')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
