---
id: c3-701
c3-version: 4
title: resolver
type: component
parent: c3-7
goal: Token resolution with YAML parsing and deep merge
summary: Resolves user tokens against defaults with inheritance support
files:
  - src/tokens/resolver.ts
  - src/tokens/utils.ts
---

# c3-701: Resolver

## Goal

Token resolution pipeline: loads user YAML overrides and deep-merges them with default tokens to produce a final `TokensConfig`.

## Location

`src/tokens/resolver.ts`, `src/tokens/utils.ts`

## Category

`foundation`

## Responsibilities

- Define `TokensConfig` interface (canonical token shape)
- Define `PartialTokensConfig` for user overrides (all fields optional, supports null to reset)
- Load and parse user `tokens.yaml` via `js-yaml`
- Deep-merge user config over `DEFAULT_TOKENS`
- Export resolved config for consumers

## API

```typescript
interface TokensConfig {
  colors: Record<string, string>
  backgrounds: Record<string, string>
  spacing: Record<string, string>
  typography: {
    sizes: Record<string, string>
    weights: Record<string, number>
  }
  radius: Record<string, string>
  shadows: Record<string, string>
}

type PartialTokensConfig = {
  colors?: Record<string, string | null>
  backgrounds?: Record<string, string | null>
  spacing?: Record<string, string | null>
  typography?: {
    sizes?: Record<string, string | null>
    weights?: Record<string, number | null>
  }
  radius?: Record<string, string | null>
  shadows?: Record<string, string | null>
}

interface ResolveOptions {
  userTokensPath?: string  // Path to user's tokens.yaml
}

function resolveTokens(options?: ResolveOptions): TokensConfig

// utils.ts
function mergeTokenConfigs(base: TokensConfig, override: PartialTokensConfig): TokensConfig
```

## Resolution Algorithm

1. Start with `DEFAULT_TOKENS` (from c3-702)
2. If `userTokensPath` provided and exists, parse YAML → `PartialTokensConfig`
3. Deep-merge: override values replace defaults; `null` values remove entries
4. Return merged `TokensConfig`

## Dependencies

- **Internal:** [c3-702-defaults](./c3-702-defaults.md) for baseline tokens
- **External:** `js-yaml` for YAML parsing, `fs` for file reading

## References

- `src/tokens/resolver.ts` — `resolveTokens()`, `TokensConfig`, `PartialTokensConfig`
- `src/tokens/utils.ts` — `mergeTokenConfigs()`, `levenshtein()`
- `src/tokens/resolver.ts:TokensConfig` — canonical token structure

## Related Refs

- [ref-config-schema](../refs/ref-config-schema.md) — overall configuration patterns
