---
id: c3-208
c3-version: 4
title: tokens-plugin
type: component
parent: c3-2
goal: Deliver design tokens via virtual module and dev endpoint
summary: Token injection into build pipeline and dev server
files:
  - src/server/routes/tokens.ts
---

# c3-208: Tokens Plugin

## Goal

Delivers resolved design tokens to the preview runtime -- as a virtual module for builds and as an HTTP endpoint for dev mode.

## Location

`src/server/plugins/virtual-modules.ts` (virtual module), `src/server/routes/tokens.ts` (dev endpoint)

## Category

`foundation`

## Responsibilities

- Expose `virtual:prev-tokens` via Bun plugin onResolve/onLoad -- inline JS export of resolved `TokensConfig`
- Serve `/_prev/tokens.json` dev-server endpoint with `no-cache` headers
- Lazy-resolve tokens on first request (cached for subsequent calls)

## API

### Virtual Module Export

```typescript
// import { tokens } from 'virtual:prev-tokens'
export const tokens: TokensConfig
```

### Dev Endpoint

```
GET /_prev/tokens.json -> TokensConfig (JSON)
```

## Dependencies

- **Internal:** [c3-701-resolver](../c3-7-tokens/c3-701-resolver.md) for `resolveTokens()`
- **Internal:** Registered in virtual-modules plugin and dev server routes
- **External:** Bun plugin API, Bun.serve

## References

- `src/server/plugins/virtual-modules.ts` -- virtual module case `virtual:prev-tokens`
- `src/server/routes/tokens.ts` -- dev endpoint implementation
- `src/tokens/resolver.ts:resolveTokens()` -- token resolution

## Related Refs

- [ref-virtual-modules](../refs/ref-virtual-modules.md) -- virtual module pattern
