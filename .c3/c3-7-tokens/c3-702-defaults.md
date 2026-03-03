---
id: c3-702
c3-version: 4
title: defaults
type: component
parent: c3-7
goal: Default shadcn design token values
summary: Baseline token definitions for colors, spacing, typography
files:
  - src/tokens/defaults.ts
  - src/tokens/defaults.yaml
---

# c3-702: Defaults

## Goal

Ships the baseline shadcn-compatible design token values used when no user override is present.

## Location

`src/tokens/defaults.ts`, `src/tokens/defaults.yaml`

## Category

`foundation`

## Responsibilities

- Export `DEFAULT_TOKENS` as a fully-populated `TokensConfig`
- Provide sensible shadcn-compatible light-mode defaults
- Serve as merge base for user overrides

## Token Categories

| Category | Description |
|----------|-------------|
| `colors` | Foreground, primary, secondary, muted, accent, destructive, border, ring |
| `backgrounds` | Background, card, popover, primary, secondary, muted, accent, destructive |
| `spacing` | xs, sm, md, lg, xl, 2xl, 3xl scale |
| `typography.sizes` | xs → 6xl font size scale |
| `typography.weights` | thin → black weight scale |
| `radius` | none, sm, md, lg, full values |
| `shadows` | none, sm, md, lg, xl elevation scale |

## API

```typescript
import { DEFAULT_TOKENS } from './defaults'
// DEFAULT_TOKENS: TokensConfig — fully populated, never partial
```

## Dependencies

- **Internal:** Consumed by [c3-701-resolver](./c3-701-resolver.md)

## References

- `src/tokens/defaults.ts` — `DEFAULT_TOKENS` constant
- `src/tokens/defaults.yaml` — YAML source (if separate from TS)
