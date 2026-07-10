---
name: SiteScope v4 Design System
version: 4.0.0
description: A high-fidelity dark cosmos interface featuring glassmorphic panels, neon accents, and smooth transitions, designed for a modern web diagnostic portal.
tags: [web, dashboard, diagnostics, glassmorphism, dark-mode]

colors:
  background: "#06080f"
  surface: "rgba(255, 255, 255, 0.045)"
  surface-hover: "rgba(255, 255, 255, 0.075)"
  card-background: "rgba(12, 15, 28, 0.85)"
  border: "rgba(255, 255, 255, 0.08)"
  border-bright: "rgba(255, 255, 255, 0.16)"
  border-glow: "rgba(124, 58, 237, 0.4)"
  text: "#eef0f8"
  text-muted: "#8b92b8"
  text-dim: "#454b68"
  accents:
    violet: "#7c3aed"
    violet-light: "#a78bfa"
    violet-glow: "rgba(124, 58, 237, 0.3)"
    cyan: "#06b6d4"
    cyan-glow: "rgba(6, 182, 212, 0.25)"
    pink: "#ec4899"
    green: "#22c55e"
    red: "#ef4444"
    yellow: "#f59e0b"
    orange: "#f97316"

typography:
  font-body: "Inter, sans-serif"
  font-heading: "Space Grotesk, sans-serif"
  font-sizes:
    title: "clamp(2.4rem, 5.5vw, 4rem)"
    subtitle: "1.05rem"
    panel-title: "0.82rem"
    body: "0.92rem"
    label: "0.78rem"
    meta: "0.68rem"

spacing:
  radius-large: "18px"
  radius-medium: "10px"
  radius-small: "6px"

shadows:
  large: "0 24px 64px rgba(0,0,0,0.7)"
  card: "0 8px 32px rgba(0,0,0,0.5)"
  glow: "0 0 40px rgba(124, 58, 237, 0.2)"
---

# Design Specification

## Visual Aesthetic: Dark Cosmos & Glassmorphism
SiteScope v4 employs a futuristic, high-contrast dark theme referencing space and glowing energy grids. The design prioritizes visual luxury, depth, and clean contrast.

### Key Rules:
- **No Plain / Solid Backdrops:** Always use the deep space background `#06080f` backed by subtle floating orbs and thin grid lines.
- **Glassmorphism:** Elements (cards, headers, panels) must feel like semitransparent frosted glass. Use `backdrop-filter: blur(16px)` and a thin semi-transparent border (`rgba(255, 255, 255, 0.08)`) to define element boundaries.
- **Neon Accents:** Brand identity relies on transitions between Violet `#7c3aed` and Cyan `#06b6d4` gradients. Use glows (`box-shadow`) sparingly to denote interactive or status elements.

---

## Typography Guidelines
- **Body copy & values:** Use `Inter` for maximum readability of technical parameters, code tables, and data lists.
- **Logos, headers, and badges:** Use `Space Grotesk` with heavy weights (`700`, `800`) to create a futuristic, cybernetic visual signature.

---

## Component Specifications

### 1. Main Action Cards
- **Input Wrap:** Black transluscent background (`rgba(0,0,0,0.3)`) with internal border. On focus, apply the violet glow shadow and highlight the border.
- **Buttons:** Gradient background shifting from `#7c3aed` to `#5b21b6`, with subtle vertical translate hover animation (`translateY(-1px)`) and glow shadows.

### 2. Status & Metric Badges
- Statuses must always include an matching emoji/icon and semantic border colors:
  - **Reachable / Success:** Green background (`rgba(34,197,94,0.1)`) + green text (`#86efac`).
  - **Unreachable / Failure:** Red background (`rgba(239,68,68,0.1)`) + red text (`#fca5a5`).
  - **Warning:** Yellow background (`rgba(245,158,11,0.1)`) + yellow text (`#fde68a`).

### 3. Diagnostic Tabs (NEXUS Engine)
- Tabs reside within a compact container (`rgba(0,0,0,0.25)`) with `border-radius: 8px`.
- Active tab must use a subtle gradient background (`rgba(124,58,237,0.2)` to `rgba(6,182,212,0.1)`) and a glowing violet border.

---

## Behavior & Transitions
- All interactive components (tabs, buttons, cards, list items) must use `transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1)`.
- Use lazy loading skeleton animations (`shimmer-anim`) to avoid layout jumps while loading async diagnostic data.
