---
id: c3-212
c3-version: 4
title: aliases-plugin
type: component
parent: c3-2
goal: Module resolution and React deduplication
summary: Bun plugin for path aliases and React singleton enforcement
files:
  - src/server/plugins/aliases.ts
---

# c3-212: Aliases Plugin

## Source
`src/server/plugins/aliases.ts`

## Goal
Bun plugin for module resolution that ensures React deduplication and consistent package resolution from the CLI's own `node_modules`.

## Responsibilities
- Resolve `@prev/ui` and `@prev/theme` aliases to CLI's `src/` directories
- Pin React, ReactDOM, and other key packages to a single instance from CLI's `node_modules`
- Handle hoisted dependencies (bunx, npm, pnpm) by traversing up directory tree
- Use `require.resolve()` for accurate entry file resolution (not directory paths)

## Key Implementation Details
- Resolves packages via `build.onResolve()` with regex filters matching package name + subpath imports
- Handles both exact package imports and subpath imports (e.g., `react-dom/client`)
- Traverses up from `cliRoot` to find `node_modules` containing React (handles hoisted deps)
- Falls back to default resolution on `require.resolve()` failure

## Aliased Packages
- `react`, `react-dom` -- React deduplication (critical for hooks)
- `@tanstack/react-router` -- Router consistency
- `@mdx-js/react` -- MDX provider
- `mermaid`, `dayjs`, `@terrastruct/d2` -- Diagram/utility libraries
- `use-sync-external-store` -- React concurrent mode

## Dependencies
- External: Bun plugin API (`BunPlugin`)
