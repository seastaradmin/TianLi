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

interface GalaxyPageProps {
  heroes: HeroState[]
  tasks: TaskState[]
  flows: FlowState[]
  selectedNodeId: string | null
  hoverHudNodeId: string | null
  hoverHudAnchor: UiAnchor | null
  isConnected: boolean
  isObservatoryOpen: boolean
  language: Language
  onToggleLanguage: () => void
  onSelectNode: (nodeId: string | null, anchor?: UiAnchor | null) => void
  onOpenObservatory: (origin?: UiAnchor | null) => void
}

function uniqueSkillCountForHero(tasks: TaskState[], heroId: string) {
  const skillIds = new Set<string>()
  for (const task of tasks) {
    for (const skill of task.skillDispatches ?? []) {
      if (skill.heroId === heroId && skill.status === 'applied') {
        skillIds.add(skill.skillId)
      }
    }
  }
  return skillIds.size
}

function buildHoverModel(heroes: HeroState[], tasks: TaskState[], hoverHudNodeId: string | null, language: Language) {
  if (!hoverHudNodeId) {
    return null
  }

  const hero = heroes.find((item) => item.heroId === hoverHudNodeId)
  if (hero) {
    const currentTask = hero.currentTaskId ? tasks.find((task) => task.taskId === hero.currentTaskId) ?? null : null
    const skillCount = uniqueSkillCountForHero(tasks, hero.heroId)
    return {
      accentColor: hero.color,
      eyebrow: t(language, 'hero'),
      title: resolveHeroDisplayName(hero, language),
      subtitle: `${formatStatusLabel(hero.status, language)} · ${hero.tags.slice(0, 2).join(' / ') || t(language, 'role_unlabeled')}`,
      body: resolveHeroDescription(hero, language) || hero.tags.slice(0, 4).join(' · '),
      meta: currentTask ? t(language, 'current_destiny', { title: currentTask.title }) : t(language, 'no_destiny'),
      chips: [
        formatSkillCountLabel(skillCount, language),
        ...hero.linkedSkills.slice(0, 2),
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

export function GalaxyPage({
  heroes,
  tasks,
  flows,
  selectedNodeId,
  hoverHudNodeId,
  hoverHudAnchor,
  isConnected,
  isObservatoryOpen,
  language,
  onToggleLanguage,
  onSelectNode,
  onOpenObservatory,
}: GalaxyPageProps) {
  const hoverModel = buildHoverModel(heroes, tasks, hoverHudNodeId, language)

  return (
    <main className="galaxy-page">
      <header className="galaxy-microbar">
        <div className="galaxy-micro-brand">
          <span className={`galaxy-micro-pulse ${isConnected ? 'galaxy-micro-pulse-live' : ''}`} />
          <span className="galaxy-micro-wordmark">TIANLI</span>
          <span className="galaxy-micro-status">{isConnected ? t(language, 'live') : t(language, 'offline')}</span>
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
            {t(language, 'observe')}
          </button>
        </div>
      </header>

      <ConstellationView
        heroes={heroes}
        tasks={tasks}
        flows={flows}
        language={language}
        selectedNodeId={selectedNodeId}
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
        <span className="observatory-hotzone-text">{t(language, 'observe')}</span>
      </button>
    </main>
  )
}
