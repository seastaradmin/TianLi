# TianLi Design System

Generated: 2026-03-24T12:09:44.466258

## Overview

This design system was created using UI-UX-Pro-Max methodology for the TianLi Harness Dashboard.

## Brand Identity

- **Name:** TianLi Harness
- **Chinese:** 天理 Harness
- **Tagline:** Constitutional AI Agent Governance
- **Vibe:** Professional, Trustworthy, Intelligent, Modern

## Color Palette

### Primary (Indigo - Trust & Intelligence)
- Main: `#6366F1` (500)
- Hover: `#4F46E5` (600)

### Secondary (Purple - Wisdom & Governance)
- Main: `#8B5CF6` (500)
- Hover: `#7C3AED` (600)

### Semantic Colors
- Success: `#22C55E` (Green)
- Warning: `#F59E0B` (Amber)
- Error: `#EF4444` (Red)

## Typography

- **Sans:** Inter, system-ui
- **Mono:** JetBrains Mono

## Usage

### Tailwind CSS

```jsx
<div className="bg-primary-500 text-white p-4 rounded-lg shadow-md">
  Hello TianLi!
</div>
```

### CSS Variables

```css
.button {
  background-color: var(--color-primary-500);
  color: var(--color-text-inverse);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}
```

## Anti-Patterns (What to Avoid)

- ❌ Bright neon colors (except for specific alerts)
- ❌ Harsh animations (>500ms or jarring transitions)
- ❌ Pure black (#000000) backgrounds - use #0F172A instead
- ❌ AI purple/pink gradients (overused in AI products)
- ❌ Emojis as icons - use SVG icons (Heroicons/Lucide)
- ❌ Inconsistent spacing - stick to the scale
- ❌ Low contrast text - maintain 4.5:1 minimum
- ❌ Ignoring focus states for keyboard navigation

## Checklist

- ✅ No emojis as icons (use SVG: Heroicons/Lucide)
- ✅ cursor-pointer on all clickable elements
- ✅ Hover states with smooth transitions (150-300ms)
- ✅ Light mode: text contrast 4.5:1 minimum
- ✅ Focus states visible for keyboard navigation
- ✅ prefers-reduced-motion respected
- ✅ Responsive: 375px, 768px, 1024px, 1440px
- ✅ Loading states for async operations
- ✅ Error states with clear messaging
- ✅ Empty states with helpful guidance

## Files

- `design-system.json` - Complete design system JSON
- `tailwind.config.js` - Tailwind CSS configuration
- `design-tokens.css` - CSS custom properties
- `README.md` - This file
