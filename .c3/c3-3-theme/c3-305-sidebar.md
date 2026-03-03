---
id: c3-305
c3-version: 4
title: sidebar
type: component
parent: c3-3
goal: Table of Contents navigation panel
summary: Navigation tree from page manifest with active state tracking
files:
  - src/theme/TOCPanel.tsx
  - src/theme/TOCPanel.css
---

# c3-305: Sidebar (TOC Panel)

## Goal

Table of Contents panel that displays the navigation tree with support for drag-and-drop reordering.

## Location

`src/theme/TOCPanel.tsx`, `src/theme/TOCPanel.css`

## Responsibilities

- Render navigation tree from page manifest
- Highlight current page
- Support collapsible folders
- Enable drag-and-drop page reordering
- Persist order changes to config

## Props

```typescript
interface TOCPanelProps {
  tree: PageTree.Root
  onClose: () => void
}
```

## Tree Structure

```typescript
// Page item
{ type: 'page', name: string, url: string }

// Folder item
{ type: 'folder', name: string, children: Item[] }
```

## Drag-and-Drop

When items are reordered:
1. Capture new order array
2. POST to `/__prev/config` endpoint
3. Server updates `.prev.yaml`
4. Order persists across sessions

## Dependencies

- **Internal:** [c3-302-layout](./c3-302-layout.md) for visibility control
- **Internal:** `virtual:prev-pages` provides tree data

## Styling

- Overlay on mobile (full screen)
- Dropdown on desktop (positioned near toolbar)
- Indentation for nested items
- Active state highlighting

## References

- `src/theme/TOCPanel.tsx` - Table of Contents panel with navigation tree
- `src/theme/TOCPanel.css` - TOC panel styling and drag-drop visual states
- `src/theme/sidebar.tsx` - Sidebar container and navigation components

## Related Refs

- [ref-theming](../refs/ref-theming.md) - CSS theming system

## Notes

- Supports keyboard navigation
- Closes on outside click
- Folders expand/collapse on click
- Order saved per directory path
