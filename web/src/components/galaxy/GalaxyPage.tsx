import { ConstellationView } from '../constellation/ConstellationView'
import { HoverHUD } from './HoverHUD'
import {
  formatHeroCountLabel,
  formatRoundLabel,
  formatSkillCountLabel,
  resolveDeliverySummary,
  resolveHeroDescription,
  formatStatusLabel,
  resolveHeroDisplayName,
  t,
} from '../../i18n'
import type { HeroState, FlowState, Language, TaskState, UiAnchor } from '../../types'
import { collectHeroSkillIds } from '../../utils/heroSkills'
import { partitionSessionTasks } from '../../utils/tasks'

interface GalaxyPageProps {
  heroes: HeroState[]
  tasks: TaskState[]
  flows: FlowState[]
  selectedNodeId: string | null
  hoverHudNodeId: string | null
  hoverHudAnchor: UiAnchor | null
  autoFocusTarget: { nodeId: string; token: number } | null
  isConnected: boolean
  isObservatoryOpen: boolean
  language: Language
  onToggleLanguage: () => void
  onSelectNode: (nodeId: string | null, anchor?: UiAnchor | null) => void
  onOpenObservatory: (origin?: UiAnchor | null) => void
}

function buildHoverModel(heroes: HeroState[], tasks: TaskState[], hoverHudNodeId: string | null, language: Language) {
  if (!hoverHudNodeId) {
    return null
  }

  const hero = heroes.find((item) => item.heroId === hoverHudNodeId)
  if (hero) {
    const currentTask = hero.currentTaskId ? tasks.find((task) => task.taskId === hero.currentTaskId) ?? null : null
    const skillIds = collectHeroSkillIds(hero, tasks)
    return {
      accentColor: hero.color,
      eyebrow: t(language, 'hero'),
      title: resolveHeroDisplayName(hero, language),
      subtitle: `${formatStatusLabel(hero.status, language)} · ${hero.tags.slice(0, 2).join(' / ') || t(language, 'role_unlabeled')}`,
      body: resolveHeroDescription(hero, language) || hero.tags.slice(0, 4).join(' · '),
      meta: currentTask ? t(language, 'current_destiny', { title: currentTask.title }) : t(language, 'no_destiny'),
      chips: [
        formatSkillCountLabel(skillIds.length, language),
        ...skillIds.slice(0, 2),
      ],
    }
  }

  const task = tasks.find((item) => item.taskId === hoverHudNodeId)
  if (!task) {
    return null
  }

  const primaryHero = task.primaryHeroId
    ? heroes.find((item) => item.heroId === task.primaryHeroId) ?? null
    : null
  const selectedHeroLabels = task.selectedHeroIds
    .map((heroId) => {
      const heroEntry = heroes.find((item) => item.heroId === heroId)
      return heroEntry ? resolveHeroDisplayName(heroEntry, language) : heroId
    })
    .slice(0, 2)

  const selectedCount = task.selectedHeroIds.length
  return {
    accentColor: '#f7df92',
    eyebrow: t(language, 'destiny_core'),
    title: task.title,
    subtitle: `${formatRoundLabel(task.verdictRound + 1, language)} · ${formatStatusLabel(task.status, language)}`,
    body: resolveDeliverySummary(task, language) || task.reasoning,
    meta: task.primaryHeroId
      ? `${t(language, 'primary_hero', { hero: primaryHero ? resolveHeroDisplayName(primaryHero, language) : task.primaryHeroId })}${task.consultHeroIds.length > 0 ? ` · ${t(language, 'consult_count', { count: task.consultHeroIds.length })}` : ''}`
      : t(language, 'routing_hero'),
    chips: [formatHeroCountLabel(selectedCount, language), ...selectedHeroLabels],
  }
}

function shortenText(value: string, maxLength = 140) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength - 3)}...`
}

function buildSessionSummary(task: TaskState, language: Language) {
  return shortenText(resolveDeliverySummary(task, language) || task.reasoning || task.title)
}

export function GalaxyPage({
  heroes,
  tasks,
  flows,
  selectedNodeId,
  hoverHudNodeId,
  hoverHudAnchor,
  autoFocusTarget,
  isConnected,
  isObservatoryOpen,
  language,
  onToggleLanguage,
  onSelectNode,
  onOpenObservatory,
}: GalaxyPageProps) {
  const hoverModel = buildHoverModel(heroes, tasks, hoverHudNodeId, language)
  const { activeTasks, archivedTasks } = partitionSessionTasks(tasks)
  const selectedTask = tasks.find((task) => task.taskId === selectedNodeId) ?? activeTasks[0] ?? archivedTasks[0] ?? null

  return (
    <main className="galaxy-page">
      <header className="galaxy-microbar">
        <div className="galaxy-micro-brand">
          <span className={`galaxy-micro-pulse ${isConnected ? 'galaxy-micro-pulse-live' : ''}`} />
          <span className="galaxy-micro-wordmark">TIANLI</span>
          {isConnected ? <span className="galaxy-micro-status">{t(language, 'live')}</span> : null}
        </div>

        <div className="galaxy-micro-actions">
          <button
            type="button"
            className="galaxy-language-toggle"
            aria-label={language === 'zh' ? t(language, 'switch_to_en') : t(language, 'switch_to_zh')}
            onClick={onToggleLanguage}
          >
            {t(language, 'language_toggle')}
          </button>

          <button
            type="button"
            className="galaxy-mobile-observatory"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect()
              onOpenObservatory({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
            }}
          >
            {t(language, 'project_backstage')}
          </button>
        </div>
      </header>

      <aside className="session-stage-rail" aria-label={t(language, 'session_front')}>
        <div className="session-stage-head">
          <div>
            <div className="observatory-card-kicker">{t(language, 'session_front')}</div>
            <strong className="session-stage-title">{selectedTask?.title || t(language, 'active_sessions')}</strong>
          </div>
          <button
            type="button"
            className="session-stage-backstage"
            onClick={() => onOpenObservatory(null)}
          >
            {t(language, 'project_backstage')}
          </button>
        </div>

        <section className="session-stage-section">
          <div className="session-stage-section-head">
            <span>{t(language, 'active_sessions')}</span>
            <span className="observatory-summary-chip">{activeTasks.length}</span>
          </div>
          {activeTasks.length === 0 ? (
            <div className="session-stage-empty">{t(language, 'session_stage_empty')}</div>
          ) : (
            <div className="session-stage-list">
              {activeTasks.map((task) => {
                const isSelected = selectedTask?.taskId === task.taskId
                const primaryHero = task.primaryHeroId ? heroes.find((hero) => hero.heroId === task.primaryHeroId) ?? null : null

                return (
                  <button
                    key={task.taskId}
                    type="button"
                    className={`session-stage-card ${isSelected ? 'session-stage-card-active' : ''}`}
                    onClick={() => onSelectNode(task.taskId, null)}
                  >
                    <div className="session-stage-card-head">
                      <strong>{task.title}</strong>
                      <span>{formatStatusLabel(task.status, language)}</span>
                    </div>
                    <p className="session-stage-card-copy">{buildSessionSummary(task, language)}</p>
                    <div className="session-stage-card-meta">
                      <span>{formatRoundLabel(task.verdictRound + 1, language)}</span>
                      <span>
                        {task.primaryHeroId
                          ? t(language, 'primary_hero', {
                              hero: primaryHero ? resolveHeroDisplayName(primaryHero, language) : task.primaryHeroId,
                            })
                          : t(language, 'routing_hero')}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="session-stage-section">
          <div className="session-stage-section-head">
            <span>{t(language, 'session_history')}</span>
            <span className="observatory-summary-chip">{archivedTasks.length}</span>
          </div>
          {archivedTasks.length === 0 ? (
            <div className="session-stage-empty">{t(language, 'session_archive_empty')}</div>
          ) : (
            <div className="session-stage-history">
              {archivedTasks.slice(0, 6).map((task) => (
                <button
                  key={task.taskId}
                  type="button"
                  className={`session-stage-history-item ${selectedTask?.taskId === task.taskId ? 'session-stage-history-item-active' : ''}`}
                  onClick={() => onSelectNode(task.taskId, null)}
                >
                  <div className="session-stage-history-head">
                    <strong>{task.title}</strong>
                    <span>{formatStatusLabel(task.status, language)}</span>
                  </div>
                  <p>{buildSessionSummary(task, language)}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </aside>

      <ConstellationView
        heroes={heroes}
        tasks={tasks}
        flows={flows}
        language={language}
        selectedNodeId={selectedNodeId}
        autoFocusTarget={autoFocusTarget}
        onSelectNode={onSelectNode}
      />

      {hoverModel && (
        <HoverHUD
          key={`${hoverHudNodeId}-${hoverHudAnchor?.x ?? 0}-${hoverHudAnchor?.y ?? 0}`}
          accentColor={hoverModel.accentColor}
          eyebrow={hoverModel.eyebrow}
          title={hoverModel.title}
          subtitle={hoverModel.subtitle}
          body={hoverModel.body}
          meta={hoverModel.meta}
          chips={hoverModel.chips}
          anchor={hoverHudAnchor}
          language={language}
        />
      )}

      <button
        id="observatory-edge-trigger"
        type="button"
        className={`observatory-hotzone ${isObservatoryOpen ? 'observatory-hotzone-active' : ''}`}
        aria-label={isObservatoryOpen ? t(language, 'observatory_open') : t(language, 'open_observatory')}
        aria-expanded={isObservatoryOpen}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          onOpenObservatory({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        }}
      >
        <span className="observatory-hotzone-glow" />
        <span className="observatory-hotzone-text">{t(language, 'backstage_short')}</span>
      </button>
    </main>
  )
}
