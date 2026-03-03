---
id: c3-403
c3-version: 4
title: screen-viewer
type: component
parent: c3-4
goal: Screen state variants with viewport toggle
summary: Screen previews with state machine-driven variant management
files:
  - src/theme/previews/ScreenPreview.tsx
  - src/theme/previews/machines/screen-machine.ts
  - src/theme/previews/stores/screen-store.ts
  - src/theme/previews/ViewportControls.tsx
  - src/theme/previews/StatusBadge.tsx
  - src/theme/previews/StatusDropdown.tsx
---

# c3-403: Screen Viewer

## Goal

Renders screen previews with multiple states and viewport controls for testing full-page views.

## Location

`src/theme/previews/ScreenPreview.tsx`

## Responsibilities

- Render screen in iframe
- Display state tabs for different screen variants
- Provide viewport toggle (desktop/mobile)
- Show responsive view controls

## Props

```typescript
interface ScreenPreviewProps {
  unit: PreviewUnit  // Screen unit from preview scanner
}
```

## Preview Unit Structure

```typescript
{
  type: 'screen',
  name: string,
  path: string,
  route: string,
  config: {
    title?: string,
    description?: string,
    states?: Record<string, StateDefinition>,
  },
  files: {
    index: string,      // Default state entry
    states?: string[],  // Additional state files
    docs?: string,
  }
}
```

## State Definition

```typescript
interface StateDefinition {
  description?: string
  file?: string  // Override file for this state
}
```

## Features

- **State Tabs**: Switch between screen variants (default, error, loading)
- **Viewport Toggle**: Desktop/tablet/mobile views
- **DevTools Pill**: Bottom-right controls in iframe

## Dependencies

- **Internal:** [c3-401-preview-router](./c3-401-preview-router.md) dispatches here
- **Internal:** DevTools context for viewport state

## Data Flow

```
PreviewUnit
    ↓
Load state files (index.tsx + additional states)
    ↓
State tabs from config.states
    ↓
User clicks state tab
    ↓
Iframe loads different state file
```

## Viewport Modes

| Mode | Width | Description |
|------|-------|-------------|
| Desktop | 100% | Full width |
| Tablet | 768px | Tablet viewport |
| Mobile | 375px | Phone viewport |

## References

- `src/theme/previews/ScreenPreview.tsx` - Screen viewer (placeholder - currently uses generic Preview component)

## Related Refs

- [ref-preview-types](../refs/ref-preview-types.md) - Preview unit type definitions

## Notes

- States can be separate files or query params
- Viewport affects iframe container, not actual CSS breakpoints
- Useful for testing responsive designs
