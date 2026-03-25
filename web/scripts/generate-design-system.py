#!/usr/bin/env python3
"""
Generate design system for TianLi Dashboard using UI-UX-Pro-Max principles.
Based on https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
"""

import json
from pathlib import Path
from datetime import datetime

# Design System for TianLi Harness Dashboard
# Generated with UI-UX-Pro-Max methodology

DESIGN_SYSTEM = {
    "project": "TianLi Harness Dashboard",
    "version": "1.0.0",
    "generated_at": datetime.now().isoformat(),
    
    # ==================== Brand Identity ====================
    "brand": {
        "name": "TianLi Harness",
        "chinese_name": "天理 Harness",
        "tagline": "Constitutional AI Agent Governance",
        "vibe": "Professional, Trustworthy, Intelligent, Modern"
    },
    
    # ==================== Color Palette ====================
    # Inspired by governance/audit theme - blues for trust, purples for wisdom
    "colors": {
        "primary": {
            "50": "#EEF2FF",
            "100": "#E0E7FF",
            "200": "#C7D2FE",
            "300": "#A5B4FC",
            "400": "#818CF8",
            "500": "#6366F1",  # Primary brand color - Indigo
            "600": "#4F46E5",
            "700": "#4338CA",
            "800": "#3730A3",
            "900": "#312E81",
        },
        "secondary": {
            "50": "#F5F3FF",
            "100": "#EDE9FE",
            "200": "#DDD6FE",
            "300": "#C4B5FD",
            "400": "#A78BFA",
            "500": "#8B5CF6",  # Secondary - Purple for wisdom
            "600": "#7C3AED",
            "700": "#6D28D9",
            "800": "#5B21B6",
            "900": "#4C1D95",
        },
        "accent": {
            "50": "#FEF2F2",
            "100": "#FEE2E2",
            "200": "#FECACA",
            "300": "#FCA5A5",
            "400": "#F87171",
            "500": "#EF4444",  # Red for alerts/violations
            "600": "#DC2626",
            "700": "#B91C1C",
            "800": "#991B1B",
            "900": "#7F1D1D",
        },
        "success": {
            "50": "#F0FDF4",
            "100": "#DCFCE7",
            "200": "#BBF7D0",
            "300": "#86EFAC",
            "400": "#4ADE80",
            "500": "#22C55E",  # Green for pass/success
            "600": "#16A34A",
            "700": "#15803D",
            "800": "#166534",
            "900": "#14532D",
        },
        "warning": {
            "50": "#FFFBEB",
            "100": "#FEF3C7",
            "200": "#FDE68A",
            "300": "#FCD34D",
            "400": "#FBBF24",
            "500": "#F59E0B",  # Amber for warnings
            "600": "#D97706",
            "700": "#B45309",
            "800": "#92400E",
            "900": "#78350F",
        },
        "neutral": {
            "50": "#F8FAFC",
            "100": "#F1F5F9",
            "200": "#E2E8F0",
            "300": "#CBD5E1",
            "400": "#94A3B8",
            "500": "#64748B",
            "600": "#475569",
            "700": "#334155",
            "800": "#1E293B",
            "900": "#0F172A",
        },
        "semantic": {
            "background": "#F8FAFC",
            "surface": "#FFFFFF",
            "surface_elevated": "#FFFFFF",
            "border": "#E2E8F0",
            "border_strong": "#CBD5E1",
            "text_primary": "#0F172A",
            "text_secondary": "#475569",
            "text_muted": "#94A3B8",
            "text_inverse": "#FFFFFF",
        }
    },
    
    # ==================== Typography ====================
    "typography": {
        "font_family": {
            "sans": "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            "mono": "JetBrains Mono, 'Fira Code', Consolas, Monaco, monospace",
        },
        "scale": {
            "xs": "0.75rem",     # 12px
            "sm": "0.875rem",    # 14px
            "base": "1rem",      # 16px
            "lg": "1.125rem",    # 18px
            "xl": "1.25rem",     # 20px
            "2xl": "1.5rem",     # 24px
            "3xl": "1.875rem",   # 30px
            "4xl": "2.25rem",    # 36px
            "5xl": "3rem",       # 48px
        },
        "weights": {
            "normal": "400",
            "medium": "500",
            "semibold": "600",
            "bold": "700",
        },
        "line_heights": {
            "tight": "1.25",
            "normal": "1.5",
            "relaxed": "1.75",
        }
    },
    
    # ==================== Spacing ====================
    "spacing": {
        "scale": {
            "0": "0",
            "1": "0.25rem",    # 4px
            "2": "0.5rem",     # 8px
            "3": "0.75rem",    # 12px
            "4": "1rem",       # 16px
            "5": "1.25rem",    # 20px
            "6": "1.5rem",     # 24px
            "8": "2rem",       # 32px
            "10": "2.5rem",    # 40px
            "12": "3rem",      # 48px
            "16": "4rem",      # 64px
            "20": "5rem",      # 80px
            "24": "6rem",      # 96px
        }
    },
    
    # ==================== Shadows ====================
    "shadows": {
        "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "base": "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
        "xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        "inner": "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
    },
    
    # ==================== Border Radius ====================
    "radius": {
        "none": "0",
        "sm": "0.25rem",
        "base": "0.375rem",
        "md": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.5rem",
        "full": "9999px",
    },
    
    # ==================== Transitions ====================
    "transitions": {
        "duration": {
            "fast": "150ms",
            "normal": "200ms",
            "slow": "300ms",
        },
        "timing": {
            "ease": "cubic-bezier(0.4, 0, 0.2, 1)",
            "ease_in": "cubic-bezier(0.4, 0, 1, 1)",
            "ease_out": "cubic-bezier(0, 0, 0.2, 1)",
            "ease_in_out": "cubic-bezier(0.4, 0, 0.2, 1)",
        }
    },
    
    # ==================== Layout ====================
    "layout": {
        "sidebar_width": "280px",
        "sidebar_collapsed_width": "80px",
        "header_height": "64px",
        "max_content_width": "1440px",
        "container_padding": "24px",
        "grid_gap": "24px",
    },
    
    # ==================== Component Tokens ====================
    "components": {
        "card": {
            "background": "#FFFFFF",
            "border": "#E2E8F0",
            "border_radius": "0.75rem",
            "shadow": "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
            "padding": "1.5rem",
        },
        "button": {
            "primary_bg": "#6366F1",
            "primary_bg_hover": "#4F46E5",
            "primary_text": "#FFFFFF",
            "secondary_bg": "#F1F5F9",
            "secondary_bg_hover": "#E2E8F0",
            "secondary_text": "#334155",
            "border_radius": "0.5rem",
            "padding_x": "1rem",
            "padding_y": "0.625rem",
        },
        "input": {
            "background": "#FFFFFF",
            "border": "#CBD5E1",
            "border_focus": "#6366F1",
            "border_radius": "0.5rem",
            "padding": "0.625rem 0.875rem",
        },
        "badge": {
            "success_bg": "#DCFCE7",
            "success_text": "#166534",
            "warning_bg": "#FEF3C7",
            "warning_text": "#92400E",
            "error_bg": "#FEE2E2",
            "error_text": "#991B1B",
            "info_bg": "#E0E7FF",
            "info_text": "#3730A3",
        },
    },
    
    # ==================== Data Visualization ====================
    "charts": {
        "colors": [
            "#6366F1",  # Primary
            "#8B5CF6",  # Secondary
            "#22C55E",  # Success
            "#F59E0B",  # Warning
            "#EF4444",  # Error
            "#06B6D4",  # Cyan
            "#EC4899",  # Pink
            "#84CC16",  # Lime
        ],
        "grid_color": "#E2E8F0",
        "axis_color": "#64748B",
        "tooltip_bg": "#1E293B",
        "tooltip_text": "#FFFFFF",
    },
    
    # ==================== Accessibility ====================
    "accessibility": {
        "min_contrast_ratio": "4.5:1",  # WCAG AA
        "focus_ring": {
            "color": "#6366F1",
            "width": "2px",
            "offset": "2px",
        },
        "reduced_motion": True,
    },
    
    # ==================== Anti-Patterns (What to Avoid) ====================
    "avoid": [
        "❌ Bright neon colors (except for specific alerts)",
        "❌ Harsh animations (>500ms or jarring transitions)",
        "❌ Pure black (#000000) backgrounds - use #0F172A instead",
        "❌ AI purple/pink gradients (overused in AI products)",
        "❌ Emojis as icons - use SVG icons (Heroicons/Lucide)",
        "❌ Inconsistent spacing - stick to the scale",
        "❌ Low contrast text - maintain 4.5:1 minimum",
        "❌ Ignoring focus states for keyboard navigation",
    ],
    
    # ==================== Pre-Delivery Checklist ====================
    "checklist": [
        "✅ No emojis as icons (use SVG: Heroicons/Lucide)",
        "✅ cursor-pointer on all clickable elements",
        "✅ Hover states with smooth transitions (150-300ms)",
        "✅ Light mode: text contrast 4.5:1 minimum",
        "✅ Focus states visible for keyboard navigation",
        "✅ prefers-reduced-motion respected",
        "✅ Responsive: 375px, 768px, 1024px, 1440px",
        "✅ Loading states for async operations",
        "✅ Error states with clear messaging",
        "✅ Empty states with helpful guidance",
    ]
}


def generate_tailwind_config():
    """Generate Tailwind CSS config from design system."""
    config = """/** @type {import('tailwindcss').Config} */
export default {{
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {{
    extend: {{
      colors: {{
        primary: {{
          50: '{DESIGN_SYSTEM["colors"]["primary"]["50"]}',
          100: '{DESIGN_SYSTEM["colors"]["primary"]["100"]}',
          200: '{DESIGN_SYSTEM["colors"]["primary"]["200"]}',
          300: '{DESIGN_SYSTEM["colors"]["primary"]["300"]}',
          400: '{DESIGN_SYSTEM["colors"]["primary"]["400"]}',
          500: '{DESIGN_SYSTEM["colors"]["primary"]["500"]}',
          600: '{DESIGN_SYSTEM["colors"]["primary"]["600"]}',
          700: '{DESIGN_SYSTEM["colors"]["primary"]["700"]}',
          800: '{DESIGN_SYSTEM["colors"]["primary"]["800"]}',
          900: '{DESIGN_SYSTEM["colors"]["primary"]["900"]}',
        }},
        secondary: {{
          50: '{DESIGN_SYSTEM["colors"]["secondary"]["50"]}',
          100: '{DESIGN_SYSTEM["colors"]["secondary"]["100"]}',
          200: '{DESIGN_SYSTEM["colors"]["secondary"]["200"]}',
          300: '{DESIGN_SYSTEM["colors"]["secondary"]["300"]}',
          400: '{DESIGN_SYSTEM["colors"]["secondary"]["400"]}',
          500: '{DESIGN_SYSTEM["colors"]["secondary"]["500"]}',
          600: '{DESIGN_SYSTEM["colors"]["secondary"]["600"]}',
          700: '{DESIGN_SYSTEM["colors"]["secondary"]["700"]}',
          800: '{DESIGN_SYSTEM["colors"]["secondary"]["800"]}',
          900: '{DESIGN_SYSTEM["colors"]["secondary"]["900"]}',
        }},
        success: {{
          50: '{DESIGN_SYSTEM["colors"]["success"]["50"]}',
          100: '{DESIGN_SYSTEM["colors"]["success"]["100"]}',
          200: '{DESIGN_SYSTEM["colors"]["success"]["200"]}',
          300: '{DESIGN_SYSTEM["colors"]["success"]["300"]}',
          400: '{DESIGN_SYSTEM["colors"]["success"]["400"]}',
          500: '{DESIGN_SYSTEM["colors"]["success"]["500"]}',
          600: '{DESIGN_SYSTEM["colors"]["success"]["600"]}',
          700: '{DESIGN_SYSTEM["colors"]["success"]["700"]}',
          800: '{DESIGN_SYSTEM["colors"]["success"]["800"]}',
          900: '{DESIGN_SYSTEM["colors"]["success"]["900"]}',
        }},
        warning: {{
          50: '{DESIGN_SYSTEM["colors"]["warning"]["50"]}',
          100: '{DESIGN_SYSTEM["colors"]["warning"]["100"]}',
          200: '{DESIGN_SYSTEM["colors"]["warning"]["200"]}',
          300: '{DESIGN_SYSTEM["colors"]["warning"]["300"]}',
          400: '{DESIGN_SYSTEM["colors"]["warning"]["400"]}',
          500: '{DESIGN_SYSTEM["colors"]["warning"]["500"]}',
          600: '{DESIGN_SYSTEM["colors"]["warning"]["600"]}',
          700: '{DESIGN_SYSTEM["colors"]["warning"]["700"]}',
          800: '{DESIGN_SYSTEM["colors"]["warning"]["800"]}',
          900: '{DESIGN_SYSTEM["colors"]["warning"]["900"]}',
        }},
      }},
      fontFamily: {{
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }},
      fontSize: {{
        xs: '{DESIGN_SYSTEM["typography"]["scale"]["xs"]}',
        sm: '{DESIGN_SYSTEM["typography"]["scale"]["sm"]}',
        base: '{DESIGN_SYSTEM["typography"]["scale"]["base"]}',
        lg: '{DESIGN_SYSTEM["typography"]["scale"]["lg"]}',
        xl: '{DESIGN_SYSTEM["typography"]["scale"]["xl"]}',
        '2xl': '{DESIGN_SYSTEM["typography"]["scale"]["2xl"]}',
        '3xl': '{DESIGN_SYSTEM["typography"]["scale"]["3xl"]}',
        '4xl': '{DESIGN_SYSTEM["typography"]["scale"]["4xl"]}',
        '5xl': '{DESIGN_SYSTEM["typography"]["scale"]["5xl"]}',
      }},
      spacing: {{
        ...{DESIGN_SYSTEM["spacing"]["scale"]},
      }},
      boxShadow: {{
        sm: '{DESIGN_SYSTEM["shadows"]["sm"]}',
        DEFAULT: '{DESIGN_SYSTEM["shadows"]["base"]}',
        md: '{DESIGN_SYSTEM["shadows"]["md"]}',
        lg: '{DESIGN_SYSTEM["shadows"]["lg"]}',
        xl: '{DESIGN_SYSTEM["shadows"]["xl"]}',
        '2xl': '{DESIGN_SYSTEM["shadows"]["2xl"]}',
        inner: '{DESIGN_SYSTEM["shadows"]["inner"]}',
      }},
      borderRadius: {{
        none: '{DESIGN_SYSTEM["radius"]["none"]}',
        sm: '{DESIGN_SYSTEM["radius"]["sm"]}',
        DEFAULT: '{DESIGN_SYSTEM["radius"]["base"]}',
        md: '{DESIGN_SYSTEM["radius"]["md"]}',
        lg: '{DESIGN_SYSTEM["radius"]["lg"]}',
        xl: '{DESIGN_SYSTEM["radius"]["xl"]}',
        '2xl': '{DESIGN_SYSTEM["radius"]["2xl"]}',
        full: '{DESIGN_SYSTEM["radius"]["full"]}',
      }},
      transitionDuration: {{
        fast: '{DESIGN_SYSTEM["transitions"]["duration"]["fast"]}',
        DEFAULT: '{DESIGN_SYSTEM["transitions"]["duration"]["normal"]}',
        slow: '{DESIGN_SYSTEM["transitions"]["duration"]["slow"]}',
      }},
    }},
  }},
  plugins: [],
}}
"""
    return config


def generate_css_variables():
    """Generate CSS custom properties from design system."""
    lines = [
        ":root {",
        "  /* Primary Colors */",
    ]
    
    for shade, value in DESIGN_SYSTEM["colors"]["primary"].items():
        lines.append(f"  --color-primary-{shade}: {value};")
    
    lines.append("")
    lines.append("  /* Secondary Colors */")
    for shade, value in DESIGN_SYSTEM["colors"]["secondary"].items():
        lines.append(f"  --color-secondary-{shade}: {value};")
    
    lines.append("")
    lines.append("  /* Semantic Colors */")
    for name, value in DESIGN_SYSTEM["colors"]["semantic"].items():
        lines.append(f"  --color-{name}: {value};")
    
    lines.append("")
    lines.append("  /* Typography */")
    for name, value in DESIGN_SYSTEM["typography"]["font_family"].items():
        lines.append(f"  --font-{name}: {value};")
    
    lines.append("")
    lines.append("  /* Spacing */")
    for name, value in DESIGN_SYSTEM["spacing"]["scale"].items():
        lines.append(f"  --spacing-{name}: {value};")
    
    lines.append("")
    lines.append("  /* Shadows */")
    for name, value in DESIGN_SYSTEM["shadows"].items():
        lines.append(f"  --shadow-{name}: {value};")
    
    lines.append("")
    lines.append("  /* Border Radius */")
    for name, value in DESIGN_SYSTEM["radius"].items():
        lines.append(f"  --radius-{name}: {value};")
    
    lines.append("}")
    
    return "\n".join(lines)


def save_design_system():
    """Save design system to files."""
    output_dir = Path(__file__).parent.parent / "design-system"
    output_dir.mkdir(exist_ok=True)
    
    # Save JSON
    json_path = output_dir / "design-system.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(DESIGN_SYSTEM, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved: {json_path}")
    
    # Save Tailwind config
    tailwind_path = output_dir / "tailwind.config.js"
    with open(tailwind_path, "w", encoding="utf-8") as f:
        f.write(generate_tailwind_config())
    print(f"✅ Saved: {tailwind_path}")
    
    # Save CSS variables
    css_path = output_dir / "design-tokens.css"
    with open(css_path, "w", encoding="utf-8") as f:
        f.write(generate_css_variables())
    print(f"✅ Saved: {css_path}")
    
    # Save README
    readme_path = output_dir / "README.md"
    readme_content = f"""# TianLi Design System

Generated: {DESIGN_SYSTEM["generated_at"]}

## Overview

This design system was created using UI-UX-Pro-Max methodology for the TianLi Harness Dashboard.

## Brand Identity

- **Name:** {DESIGN_SYSTEM["brand"]["name"]}
- **Chinese:** {DESIGN_SYSTEM["brand"]["chinese_name"]}
- **Tagline:** {DESIGN_SYSTEM["brand"]["tagline"]}
- **Vibe:** {DESIGN_SYSTEM["brand"]["vibe"]}

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
.button {{
  background-color: var(--color-primary-500);
  color: var(--color-text-inverse);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}}
```

## Anti-Patterns (What to Avoid)

{chr(10).join(f"- {item}" for item in DESIGN_SYSTEM["avoid"])}

## Checklist

{chr(10).join(f"- {item}" for item in DESIGN_SYSTEM["checklist"])}

## Files

- `design-system.json` - Complete design system JSON
- `tailwind.config.js` - Tailwind CSS configuration
- `design-tokens.css` - CSS custom properties
- `README.md` - This file
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)
    print(f"✅ Saved: {readme_path}")
    
    print(f"\n🎨 Design system generated in {output_dir}")
    return output_dir


if __name__ == "__main__":
    save_design_system()
