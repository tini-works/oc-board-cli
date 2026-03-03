---
id: c3-7
c3-version: 4
title: tokens
type: container
boundary: library
parent: c3-0
goal: Design token system with shadcn defaults
summary: Token resolution, defaults, validation with user override support
---

# c3-7: Tokens Container

## Goal

Design token system for prev-cli previews. Provides a shadcn-compatible token schema that users can override via `previews/tokens.yaml`, with validation and runtime delivery to the browser.

## Responsibilities

- Define canonical token schema (colors, backgrounds, spacing, typography, radius, shadows)
- Resolve user overrides via deep merge with defaults
- Validate token references with Levenshtein-based "did you mean?" suggestions
- Serve resolved tokens at build time (`virtual:prev-tokens`) and dev time (`/_prev/tokens.json`)

## Entry Point

`src/tokens/resolver.ts` — `resolveTokens()` is the primary API

## User Configuration

`previews/tokens.yaml` at project root overrides defaults:

```yaml
colors:
  primary: "#7c3aed"
backgrounds:
  background: "#0f0f0f"
```

## Components

| ID | Component | Description |
|----|-----------|-------------|
| c3-701 | [resolver](./c3-701-resolver.md) | Token resolution with YAML parsing and deep merge |
| c3-702 | [defaults](./c3-702-defaults.md) | Default shadcn design token values |
| c3-703 | [validation](./c3-703-validation.md) | Token validation with fuzzy suggestions |

## Dependencies

- **Internal:** [c3-2-build](../c3-2-build/) consumes via `tokens-plugin` (c3-208)
- **Internal:** [c3-4-previews](../c3-4-previews/) renders using token values at runtime
- **External:** `js-yaml` for parsing user token files

## Data Flow

```
previews/tokens.yaml (user)
    ↓
resolveTokens() — deep merge with DEFAULT_TOKENS
    ↓
Build: virtual:prev-tokens (inline JS export)
Dev:   /_prev/tokens.json (HTTP endpoint)
    ↓
Preview runtime applies CSS variables
```
