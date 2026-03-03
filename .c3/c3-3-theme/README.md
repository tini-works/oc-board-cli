---
id: c3-3
c3-version: 4
title: theme
type: container
boundary: browser
parent: c3-0
goal: React frontend for documentation rendering
summary: Layout, routing, MDX components, and styling for the documentation site
---

# c3-3: Theme Container

## Goal

React-based frontend theme that renders the documentation site. Provides layout, navigation, MDX component mapping, and styling.

## Responsibilities

- Render documentation pages with consistent layout
- Provide sidebar navigation from page manifest
- Map MDX components to styled React components
- Handle dark/light theme switching
- Display floating toolbar with utilities

## Entry Point

`src/theme/entry.tsx` - React app entry with routing

## Key Directories

| Path | Purpose |
|------|---------|
| `src/theme/` | React components and styles |
| `src/ui/` | Built-in UI components (button, card) |

## Components

| ID | Component | Description |
|----|-----------|-------------|
| c3-301 | [entry](./c3-301-entry.md) | React entry point, router setup |
| c3-302 | [layout](./c3-302-layout.md) | Main layout wrapper with sidebar |
| c3-303 | [mdx-provider](./c3-303-mdx-provider.md) | MDX component mapping |
| c3-304 | [toolbar](./c3-304-toolbar.md) | Floating toolbar (TOC, theme toggle) |
| c3-305 | [sidebar](./c3-305-sidebar.md) | Navigation tree from page manifest |

## Dependencies

- **Internal:** [c3-2-build](../c3-2-build/) provides virtual modules
- **External:** React 19, TanStack Router, Tailwind CSS

## Styling

- Tailwind CSS for utility classes
- CSS variables for theming (dark/light)
- Content width modes: constrained (max-w-prose) / full

## Data Flow

```
Virtual Modules (pages, config)
      ↓
 React Router (route matching)
      ↓
 Layout Component (sidebar + content area)
      ↓
 MDX Page (with component mapping)
      ↓
 Rendered Documentation
```
