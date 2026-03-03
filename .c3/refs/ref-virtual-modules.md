---
id: ref-virtual-modules
c3-version: 4
title: Bun Virtual Module Pattern
type: ref
goal: Generate runtime modules at build time without static imports
summary: Bun plugin pattern for onResolve/onLoad dynamic module generation
via:
  - c3-202
  - c3-203
  - c3-205
  - c3-208
files:
  - src/server/plugins/virtual-modules.ts
---

# ref-virtual-modules: Bun Virtual Module Pattern

## Goal

Generate runtime JavaScript modules at build time to inject dynamically discovered content (pages, previews, configuration) into the application without requiring static imports or build-time code generation.

## Choice

Bun plugin `onResolve`/`onLoad` API for virtual module generation.

## Why

Avoids code generation to disk, keeps the build pipeline pure, and leverages Bun's native plugin system for zero-overhead module injection.

## Pattern

Virtual modules are dynamically generated ES modules that don't exist on disk. They're resolved and loaded by Bun plugins using the `onResolve`/`onLoad` API at build time.

## Implementation

### 1. Resolve the Module (onResolve)

```typescript
build.onResolve({ filter: /^virtual:prev-/ }, (args) => ({
  path: args.path,
  namespace: 'prev-virtual',
}))
```

The `namespace` isolates virtual modules from the filesystem resolver.

### 2. Load Module Content (onLoad)

```typescript
build.onLoad({ filter: /.*/, namespace: 'prev-virtual' }, async (args) => {
  switch (args.path) {
    case 'virtual:prev-pages': {
      const pages = await scanPages(rootDir)
      return {
        contents: `export const pages = ${JSON.stringify(pages)};`,
        loader: 'js',
      }
    }
    // ... other virtual modules
  }
})
```

### 3. Import in Client Code

```typescript
import { pages } from 'virtual:prev-pages'
```

## Virtual Modules in prev-cli

| Module | Source | Exports |
|--------|--------|---------|
| `virtual:prev-pages` | virtual-modules plugin | `pages`, `sidebar` |
| `virtual:prev-page-modules` | virtual-modules plugin | `pageModules` |
| `virtual:prev-previews` | virtual-modules plugin | `previewUnits`, helpers |
| `virtual:prev-config` | virtual-modules plugin | `config` |
| `virtual:prev-tokens` | virtual-modules plugin | `tokens` |

## Live Reload

In dev mode, file changes trigger a full rebuild via Bun.build() followed by SSE-based page reload. There is no granular HMR -- the entire theme app is rebuilt on change.

```typescript
// Dev server watches for file changes
watch(previewsDir, { recursive: true }, (_, filename) => {
  scheduleRebuild() // Debounced Bun.build() + SSE notify
})
```

## Implementation Location

All virtual modules are defined in `src/server/plugins/virtual-modules.ts`.

## Used By

- [c3-202-pages-plugin](../c3-2-build/c3-202-pages-plugin.md)
- [c3-203-previews-plugin](../c3-2-build/c3-203-previews-plugin.md)
- [c3-205-config-plugin](../c3-2-build/c3-205-config-plugin.md)
- [c3-208-tokens-plugin](../c3-2-build/c3-208-tokens-plugin.md)

## Notes

- Bun.build() supports plugins passed explicitly; Bun.serve()'s HTML import bundler does not
- Content regenerated on rebuild when source files change
- JSON.stringify used for data serialization
