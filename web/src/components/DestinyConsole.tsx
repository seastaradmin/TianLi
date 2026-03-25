import { useEffect, useState } from 'react'

import { t } from '../i18n'
import type { Language } from '../types'

interface DestinyConsoleProps {
  language: Language
  taskInput: string
  pinnedHeroInput: string
  isSubmitting: boolean
  statusSummary?: {
    title: string
    subtitle: string
  } | null
  onTaskInputChange: (value: string) => void
  onPinnedHeroInputChange: (value: string) => void
  onIssueDestiny: () => void
  onRefreshSkills: () => void
}

export function DestinyConsole({
  language,
  taskInput,
  pinnedHeroInput,
  isSubmitting,
  statusSummary,
  onTaskInputChange,
  onPinnedHeroInputChange,
  onIssueDestiny,
  onRefreshSkills,
}: DestinyConsoleProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    if (isSubmitting) {
      setIsCollapsed(false)
    }
  }, [isSubmitting])

  if (isCollapsed) {
    return (
      <footer className="destiny-console destiny-console-home destiny-console-collapsed">
        <div className="destiny-console-collapsed-copy">
          <div className="destiny-console-kicker">{t(language, 'destiny_mode')}</div>
          <strong>{statusSummary?.title || t(language, 'destiny_console_collapsed')}</strong>
          <span>{statusSummary?.subtitle || t(language, 'expand_destiny_console')}</span>
        </div>
        <button
          type="button"
          className="destiny-console-ghost destiny-console-toggle"
          aria-label={t(language, 'expand_destiny_console')}
          onClick={() => setIsCollapsed(false)}
        >
          {t(language, 'expand_destiny_console')}
        </button>
      </footer>
    )
  }

  return (
    <footer className="destiny-console destiny-console-home">
      <div className="destiny-console-head">
        <div className="destiny-console-kicker">{t(language, 'destiny_mode')}</div>
        <button
          type="button"
          className="destiny-console-ghost destiny-console-toggle"
          aria-label={t(language, 'collapse_destiny_console')}
          onClick={() => setIsCollapsed(true)}
        >
          {t(language, 'collapse_destiny_console')}
        </button>
      </div>
      {statusSummary ? (
        <div className="destiny-console-summary" aria-live="polite">
          <strong>{t(language, 'destiny_ignited', { title: statusSummary.title })}</strong>
          <span>{statusSummary.subtitle}</span>
        </div>
      ) : null}
      <label className="sr-only" htmlFor="destiny-input">
        {t(language, 'destiny_input_label')}
      </label>
      <textarea
        id="destiny-input"
        className="destiny-console-input"
        rows={1}
        value={taskInput}
        onChange={(event) => onTaskInputChange(event.target.value)}
        aria-label={t(language, 'destiny_input_label')}
        name="destiny"
        spellCheck={false}
        placeholder={t(language, 'destiny_placeholder')}
      />
      <div className="destiny-console-row">
        <label className="sr-only" htmlFor="pinned-hero-input">
          {t(language, 'pinned_heroes_label')}
        </label>
        <input
          id="pinned-hero-input"
          className="destiny-console-mini"
          value={pinnedHeroInput}
          onChange={(event) => onPinnedHeroInputChange(event.target.value)}
          aria-label={t(language, 'pinned_heroes_label')}
          placeholder={t(language, 'pinned_heroes_placeholder')}
          name="pinnedHeroes"
          autoComplete="off"
        />
        <button type="button" className="destiny-console-button" onClick={onIssueDestiny} disabled={isSubmitting}>
          {isSubmitting ? t(language, 'issuing_destiny') : t(language, 'issue_destiny')}
        </button>
        <button type="button" className="destiny-console-ghost" onClick={onRefreshSkills}>
          {t(language, 'refresh_hero_sources')}
        </button>
      </div>
    </footer>
  )
}
