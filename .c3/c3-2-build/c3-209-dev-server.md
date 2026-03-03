---
id: c3-209
c3-version: 4
title: dev-server
type: component
parent: c3-2
goal: Development server with live reload
summary: Bun-based dev server with SSE live reload and plugin pipeline
files:
  - src/server/dev.ts
  - src/server/start.ts
---

# c3-209: Dev Server

## Source
`src/server/dev.ts`

## Goal
Development server using Bun.serve() with Bun.build() for on-demand bundling and SSE-based live reload.

## Responsibilities
- Build theme app with Bun.build() using explicit plugins (virtual-modules, mdx, aliases)
- Serve built JS/CSS bundles from memory (no disk output)
- Provide SSE endpoint (`/__prev/events`) for live reload
- Route preview bundle, config, tokens, JSX, and component bundle requests to dedicated handlers
- Serve preview runtime template and static preview assets
- SPA fallback for all non-file routes
- Watch `previews/` directory and rebuild on file changes (debounced 150ms)

## Key Implementation Details
- Bun.serve()'s HTML import bundler does not respect Bun.plugin() registrations, so `entry.tsx` is pre-built with Bun.build() which supports explicit plugins
- In-memory build: no `outdir` specified, outputs held in memory and served via fetch handler
- SSE controllers tracked in a Set; each connected client receives `data: reload\n\n` on rebuild
- File watcher uses `fs.watch` with recursive option on `previews/` directory
- Config update endpoint (`POST /__prev/config`) supports drag-and-drop reordering

## Dependencies
- Internal: [c3-212-aliases-plugin](./c3-212-aliases-plugin.md), virtual-modules plugin, mdx plugin
- Internal: Route handlers from `src/server/routes/` (preview-bundle, preview-config, jsx-bundle, component-bundle, tokens)
- Internal: [c3-102-config-loader](../c3-1-cli/c3-102-config-loader.md) for loadConfig
- External: Bun.build, Bun.serve
