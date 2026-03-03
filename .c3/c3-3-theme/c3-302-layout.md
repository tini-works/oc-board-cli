---
id: c3-302
c3-version: 4
title: layout
type: component
parent: c3-3
goal: Main layout wrapper with toolbar and theme
summary: Page layout with sidebar, content area, and theme controls
files:
  - src/theme/Layout.tsx
  - src/theme/styles.css
  - src/theme/types.ts
  - src/theme/storage.ts
  - src/theme/DevToolsContext.tsx
---

# c3-302: Layout

## Goal

Main layout wrapper that provides consistent page structure with floating toolbar, TOC panel, and theme/width controls.

## Location

`src/theme/Layout.tsx`

## Responsibilities

- Render floating toolbar with navigation controls
- Toggle between light/dark themes
- Toggle between constrained/full-width content
- Show/hide TOC (Table of Contents) panel
- Apply theme classes to document root

## Props

```typescript
interface LayoutProps {
  tree: PageTree.Root   // Navigation tree structure
  children: React.ReactNode
}
```

## State Management

| State | Initial Value | Purpose |
|-------|--------------|---------|
| `tocOpen` | `false` | TOC panel visibility |
| `isDark` | From config/system | Dark mode state |
| `isFullWidth` | From config | Content width mode |

## Theme Detection

```typescript
if (config.theme === 'dark') return true
if (config.theme === 'light') return false
return window.matchMedia('(prefers-color-scheme: dark)').matches
```

## Dependencies

- **Internal:** [c3-304-toolbar](./c3-304-toolbar.md) for floating controls
- **Internal:** [c3-305-sidebar](./c3-305-sidebar.md) (TOCPanel) for navigation
- **Internal:** `virtual:prev-config` for initial settings

## DOM Effects

- Adds/removes `dark` class on `<html>` for theming
- Adds/removes `full-width` class for content width

## Structure

```
prev-layout-floating
├── IconSprite (SVG icon definitions)
├── Toolbar (floating pill)
├── TOCPanel (conditional)
└── main.prev-main-floating
    └── children
```

## References

- `src/theme/Layout.tsx` - Main layout wrapper component with toolbar and state management
- `src/theme/Layout.css` - Layout styles and responsive breakpoints

## Related Refs

- [ref-theming](../refs/ref-theming.md) - CSS theming system

## Notes

- Preview detail pages get full viewport layout
- Toolbar is always visible (fixed position)
- TOC panel overlays content on mobile
