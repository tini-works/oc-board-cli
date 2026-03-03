---
id: c3-402
c3-version: 4
title: component-viewer
type: component
parent: c3-4
goal: Interactive component preview with props panel
summary: Renders individual components with variant selection
files:
  - src/theme/previews/ComponentPreview.tsx
  - src/theme/previews/TokenPlayground.tsx
  - src/theme/previews/TokensPage.tsx
---

# c3-402: Component Viewer

## Goal

Renders component previews with interactive props panel for testing different configurations.

## Location

`src/theme/previews/ComponentPreview.tsx`

## Responsibilities

- Render component in iframe
- Display props panel for configuration
- Handle prop value changes
- Show component documentation

## Props

```typescript
interface ComponentPreviewProps {
  unit: PreviewUnit  // Component unit from preview scanner
}
```

## Preview Unit Structure

```typescript
{
  type: 'component',
  name: string,
  path: string,
  route: string,
  config: {
    title?: string,
    description?: string,
    tags?: string[],
    props?: PropDefinition[],
    slots?: SlotDefinition[],
    templates?: TemplateDefinition[],
  },
  files: {
    index: string,    // Entry file (App.tsx)
    schema?: string,  // Props schema (schema.ts)
    docs?: string,    // Documentation (docs.mdx)
  }
}
```

## Features

- **Props Panel**: Dynamic form based on prop definitions
- **Slots**: Named content areas
- **Templates**: Predefined prop combinations
- **State**: Local state management for prop values

## Dependencies

- **Internal:** [c3-401-preview-router](./c3-401-preview-router.md) dispatches here
- **Internal:** Preview iframe rendering

## Data Flow

```
PreviewUnit
    ↓
Load entry file in iframe
    ↓
Props panel from config.props
    ↓
User changes props
    ↓
PostMessage to iframe
    ↓
Component re-renders
```

## References

- `src/theme/previews/ComponentPreview.tsx` - Component viewer (placeholder - currently uses generic Preview component)

## Related Refs

- [ref-preview-types](../refs/ref-preview-types.md) - Preview unit type definitions

## Notes

- Schema.ts defines prop types and defaults
- Templates allow quick switching between configurations
- Docs.mdx renders alongside preview
