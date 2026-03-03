---
id: c3-404
c3-version: 4
title: flow-viewer
type: component
parent: c3-4
goal: Step navigation for user journeys
summary: Flow previews with state machine navigation and diagram visualization
files:
  - src/theme/previews/FlowPreview.tsx
  - src/theme/previews/FlowDiagram.tsx
  - src/theme/previews/flow-diagram.ts
  - src/theme/previews/flow-navigation.ts
  - src/theme/previews/machines/flow-machine.ts
  - src/theme/previews/machines/derived.ts
  - src/theme/previews/stores/flow-store.ts
---

# c3-404: Flow Viewer

## Goal

Renders flow previews with step navigation for multi-step user journeys.

## Location

`src/theme/previews/FlowPreview.tsx`

## Responsibilities

- Display flow steps in sequence
- Navigate between steps (prev/next)
- Show step transitions and relationships
- Visualize flow progress

## Props

```typescript
interface FlowPreviewProps {
  unit: PreviewUnit  // Flow unit from preview scanner
}
```

## Preview Unit Structure

```typescript
{
  type: 'flow',
  name: string,
  path: string,
  route: string,
  config: {
    title?: string,
    description?: string,
    steps: StepDefinition[],
    transitions?: TransitionDefinition[],
  },
  files: {
    index: string,  // Flow YAML definition
  }
}
```

## Step Definition

```typescript
interface StepDefinition {
  id: string
  title: string
  description?: string
  screen?: string  // Reference to screen preview
  actions?: ActionDefinition[]
}
```

## Transition Definition

```typescript
interface TransitionDefinition {
  from: string     // Step ID
  to: string       // Step ID
  trigger: string  // Action that causes transition
  label?: string
}
```

## Features

- **Step Navigation**: Prev/Next buttons or progress bar
- **Step Content**: Renders referenced screen or custom content
- **Transition Visualization**: Arrows/lines showing flow
- **Progress Indicator**: Shows current position in flow

## Dependencies

- **Internal:** [c3-401-preview-router](./c3-401-preview-router.md) dispatches here
- **Internal:** [c3-403-screen-viewer](./c3-403-screen-viewer.md) for screen references

## Data Flow

```
PreviewUnit
    ↓
Parse index.yaml for steps/transitions
    ↓
Render current step
    ↓
User clicks Next
    ↓
Follow transition to next step
```

## References

- `src/theme/previews/FlowPreview.tsx` - Flow viewer (single file with step navigation, progress dots, iframe embedding)

## Related Refs

- [ref-preview-types](../refs/ref-preview-types.md) - Preview unit type definitions

## Notes

- Flows reference screens by ID
- Transitions can be conditional
- Useful for documenting user journeys like checkout, onboarding
