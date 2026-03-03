---
id: c3-703
c3-version: 4
title: validation
type: component
parent: c3-7
goal: Token validation with fuzzy suggestions
summary: Validates token values and suggests corrections for typos
files:
  - src/tokens/validation.ts
---

# c3-703: Validation

## Goal

Validates that token references (e.g., in preview configs) are valid keys within the resolved token schema. Throws structured errors with Levenshtein-based "did you mean?" suggestions.

## Location

`src/tokens/validation.ts`

## Category

`foundation`

## Responsibilities

- Define `TokenCategory` type for valid category paths (including dot-notation like `typography.sizes`)
- Validate a token name against the resolved config for a given category
- Throw `ValidationError` with sorted suggestions when token is invalid
- Expose non-throwing `isValidToken()` for boolean checks

## API

```typescript
type TokenCategory =
  | 'colors' | 'backgrounds' | 'spacing'
  | 'typography.sizes' | 'typography.weights'
  | 'radius' | 'shadows'

class ValidationError extends Error {
  category: string
  invalidToken: string
  suggestions: string[]   // up to 3 closest matches
}

function validateToken(
  category: TokenCategory,
  tokenName: string,
  config?: TokensConfig  // defaults to resolveTokens()
): void  // throws ValidationError if invalid

function isValidToken(
  category: TokenCategory,
  tokenName: string,
  config?: TokensConfig
): boolean
```

## Suggestion Algorithm

Uses Levenshtein distance ≤ 3 against all valid token names in the category, returns up to 3 closest matches sorted by distance.

## Dependencies

- **Internal:** [c3-701-resolver](./c3-701-resolver.md) for `resolveTokens()` and `TokensConfig`
- **Internal:** `src/tokens/utils.ts:levenshtein()` for edit distance

## References

- `src/tokens/validation.ts` — `validateToken()`, `isValidToken()`, `ValidationError`
- `src/tokens/utils.ts:levenshtein()` — edit distance helper
