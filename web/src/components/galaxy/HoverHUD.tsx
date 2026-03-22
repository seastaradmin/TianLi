import type { CSSProperties, ReactNode } from 'react'
import { t } from '../../i18n'
import type { UiAnchor } from '../../types'
import type { Language } from '../../types'

interface HoverHudProps {
  accentColor?: string
  eyebrow: string
  title: string
  subtitle: string
  body?: string
  meta?: string
  chips?: string[]
  trailing?: ReactNode
  anchor?: UiAnchor | null
  language?: Language
}

function buildHudPosition(anchor: UiAnchor | null | undefined) {
  if (typeof window === 'undefined' || !anchor) {
    return {
      left: 16,
      top: 84,
      originOffsetX: 28,
      originOffsetY: 18,
    }
  }

  const maxWidth = 320
  const padding = 18
  const preferRight = anchor.x < window.innerWidth * 0.58
  const left = preferRight
    ? Math.min(anchor.x + 28, window.innerWidth - maxWidth - padding)
    : Math.max(padding, anchor.x - maxWidth - 28)
  const top = Math.min(Math.max(80, anchor.y - 54), window.innerHeight - 180)

  return {
    left,
    top,
    originOffsetX: Math.max(18, Math.min(maxWidth - 18, anchor.x - left)),
    originOffsetY: Math.max(16, Math.min(128, anchor.y - top)),
  }
}

export function HoverHUD({
  accentColor = '#74e0ff',
  eyebrow,
  title,
  subtitle,
  body,
  meta,
  chips = [],
  trailing,
  anchor,
  language = 'zh',
}: HoverHudProps) {
  const position = buildHudPosition(anchor)

  return (
    <aside
      className="hover-hud"
      aria-label={t(language, 'hover_hud')}
      style={
        {
          left: `${position.left}px`,
          top: `${position.top}px`,
          '--hover-origin-x': `${position.originOffsetX}px`,
          '--hover-origin-y': `${position.originOffsetY}px`,
          '--hover-accent': accentColor,
        } as CSSProperties
      }
    >
      <div className="hover-hud-accent" style={{ background: accentColor }} />
      <div className="hover-hud-content">
        <div className="hover-hud-eyebrow">{eyebrow}</div>
        <div className="hover-hud-title-row">
          <strong className="hover-hud-title">{title}</strong>
          {trailing}
        </div>
        <p className="hover-hud-subtitle">{subtitle}</p>
        {body && <p className="hover-hud-body">{body}</p>}
        {meta && <div className="hover-hud-meta">{meta}</div>}
        {chips.length > 0 && (
          <div className="hover-hud-chips">
            {chips.map((chip) => (
              <span key={chip} className="hover-hud-chip">
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
