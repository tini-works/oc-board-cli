---
id: ref-theming
c3-version: 4
title: CSS Theming with Variables
type: ref
goal: Enable seamless theme switching between light/dark/system
summary: CSS custom properties pattern for color scheme management
via:
  - c3-301
  - c3-302
  - c3-304
---

# ref-theming: CSS Theming with Variables

## Goal

Enable seamless switching between light, dark, and system-preferred color schemes while maintaining consistent visual hierarchy and accessibility across all documentation pages.

## Choice

CSS custom properties (variables) with a `dark` class toggle on the root element.

## Why

CSS variables enable runtime theme switching without JS re-renders, work with any framework, and cascade naturally through the component tree.

## Pattern

Theme switching uses CSS custom properties (variables) with a `dark` class on the root element.

## Color Variables

```css
:root {
  /* Background */
  --fd-background: #ffffff;
  --fd-foreground: #0f172a;

  /* Muted colors */
  --fd-muted: #f1f5f9;
  --fd-muted-foreground: #64748b;

  /* Border */
  --fd-border: #e2e8f0;

  /* Secondary */
  --fd-secondary: #f1f5f9;
  --fd-secondary-foreground: #0f172a;

  /* Accent */
  --fd-accent: #e0e7ff;
}

.dark {
  --fd-background: #0f172a;
  --fd-foreground: #f8fafc;
  --fd-muted: #1e293b;
  --fd-muted-foreground: #94a3b8;
  --fd-border: #334155;
  --fd-secondary: #1e293b;
  --fd-secondary-foreground: #f8fafc;
  --fd-accent: #312e81;
}
```

## Theme Detection

```typescript
// Priority: config > system preference
const isDark = (() => {
  if (config.theme === 'dark') return true
  if (config.theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
})()
```

## Theme Application

```typescript
useEffect(() => {
  document.documentElement.classList.toggle('dark', isDark)
}, [isDark])
```

## Content Width

```css
:root {
  --content-max-width: 65ch;  /* constrained */
}

.full-width {
  --content-max-width: 100%;
}
```

## Usage in Components

```typescript
// Use variables in inline styles
<div style={{ backgroundColor: 'var(--fd-background)' }}>

// Use in Tailwind classes (via CSS variables)
<div className="bg-[var(--fd-muted)]">
```

## Used By

- [c3-302-layout](../c3-3-theme/c3-302-layout.md)
- [c3-304-toolbar](../c3-3-theme/c3-304-toolbar.md)
- All theme components

## Notes

- `fd-` prefix from fumadocs naming convention
- Variables enable smooth transitions
- System preference respected when `theme: system`
- Dark class must be on `<html>` element
