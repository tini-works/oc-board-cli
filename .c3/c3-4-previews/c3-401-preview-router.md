---
id: c3-401
c3-version: 4
title: preview-router
type: component
parent: c3-4
goal: Route dispatch by preview type
summary: Routes to component, screen, or flow viewer based on preview config
files:
  - src/theme/previews/PreviewRouter.tsx
  - src/theme/previews/index.ts
  - src/theme/Preview.tsx
---

# c3-401: Preview Router

## Goal

Routes preview requests to the appropriate type-specific viewer based on preview type (component, screen, flow).

## Location

`src/theme/previews/PreviewRouter.tsx`

## Responsibilities

- Look up preview unit by type and name
- Dispatch to correct viewer component
- Display not-found message for missing previews
- Provide preview list component for browsing

## Props

```typescript
interface PreviewRouterProps {
  type: string   // 'component' | 'screen' | 'flow'
  name: string   // Preview name (folder name)
}
```

## Type Dispatch

```typescript
switch (unit.type) {
  case 'component': return <ComponentPreview unit={unit} />
  case 'screen':    return <ScreenPreview unit={unit} />
  case 'flow':      return <FlowPreview unit={unit} />
}
```

## PreviewList Component

Groups previews by type and renders as clickable cards:

```typescript
<PreviewList />           // All previews
<PreviewList type="component" />  // Only components
```

### Card Display
- Title (from config or folder name)
- Description (from config)
- Tags (first 3, with overflow count)

## Dependencies

- **Internal:** `virtual:prev-previews` for unit lookup
- **Internal:** [c3-402-component-viewer](./c3-402-component-viewer.md)
- **Internal:** [c3-403-screen-viewer](./c3-403-screen-viewer.md)
- **Internal:** [c3-404-flow-viewer](./c3-404-flow-viewer.md)

## Data Flow

```
PreviewRouter(type, name)
    ↓
previewUnits.find(u => u.type === type && u.name === name)
    ↓
Switch on unit.type
    ↓
Type-specific viewer
```

## References

- `src/theme/previews/PreviewRouter.tsx` - Main router component that dispatches to type-specific viewers
- `src/theme/previews/PreviewList.tsx` - Preview listing with filtering and card display
- `src/theme/previews/ComponentPreview.tsx` - Component viewer integration
- `src/theme/previews/ScreenPreview.tsx` - Screen viewer integration
- `src/theme/previews/FlowPreview.tsx` - Flow viewer integration

## Related Refs

- [ref-preview-types](../refs/ref-preview-types.md) - Shared preview type definitions

## Notes

- Unit not found shows friendly error with expected path
- Unknown type shows generic error
- List view supports filtering by type
