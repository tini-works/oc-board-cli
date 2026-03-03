---
id: ref-preview-types
c3-version: 4
title: Preview Type Hierarchy
type: ref
goal: Define consistent preview type taxonomy
summary: Component, screen, flow, and atlas preview type definitions
via:
  - c3-203
  - c3-401
  - c3-402
  - c3-403
  - c3-404
files:
  - src/content/preview-types.ts
---

# ref-preview-types: Preview Type Hierarchy

## Goal

Establish a clear taxonomy for preview documentation that supports three distinct documentation needs: reusable components, screen states, and user flows, each with appropriate configuration schemas and rendering strategies.

## Choice

Three-type taxonomy: component (reusable units), screen (full-page states), flow (multi-step journeys).

## Why

Each documentation need has fundamentally different rendering and interaction requirements — components need prop panels, screens need state variants, flows need step navigation.

## Pattern

Previews are categorized into three distinct types, each with specific use cases and configuration schemas.

## Type Hierarchy

```
Preview
├── Component  (reusable UI units)
├── Screen     (full-page views)
└── Flow       (multi-step journeys)
```

## Type Details

### Component
**Purpose**: Document and test reusable UI components

| Field | Type | Description |
|-------|------|-------------|
| props | PropDef[] | Configurable properties |
| slots | SlotDef[] | Named content areas |
| templates | TemplateDef[] | Preset configurations |

**Entry File**: `App.tsx`, `index.tsx`

### Screen
**Purpose**: Document full-page views with multiple states

| Field | Type | Description |
|-------|------|-------------|
| states | Record<string, StateDef> | Named view states |

**Entry File**: `App.tsx`, `index.tsx` (default state)
**State Files**: `error.tsx`, `loading.tsx`, etc.

### Flow
**Purpose**: Document multi-step user journeys

| Field | Type | Description |
|-------|------|-------------|
| steps | StepDef[] | Ordered sequence |
| transitions | TransitionDef[] | Step connections |

**Entry File**: `index.yaml`

## Directory Structure

```
previews/
├── components/
│   └── button/
│       ├── config.yaml
│       ├── App.tsx
│       └── schema.ts
├── screens/
│   └── dashboard/
│       ├── config.yaml
│       ├── App.tsx
│       ├── error.tsx
│       └── loading.tsx
└── flows/
    └── checkout/
        └── index.yaml
```

## Type Detection

```typescript
const TYPE_MAP: Record<string, PreviewType> = {
  components: 'component',
  screens: 'screen',
  flows: 'flow',
}
```

## Used By

- [c3-203-previews-plugin](../c3-2-build/c3-203-previews-plugin.md)
- [c3-401-preview-router](../c3-4-previews/c3-401-preview-router.md)
- All type-specific viewers in c3-4-previews

## Notes

- Folder name determines type (singular form in code)
- Config.yaml optional for components/screens (defaults inferred)
- Config.yaml required for flows
