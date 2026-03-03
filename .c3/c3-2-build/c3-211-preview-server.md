---
id: c3-211
c3-version: 4
title: preview-server
type: component
parent: c3-2
goal: Serve production builds locally
summary: Static file server for testing production output
files:
  - src/server/preview.ts
---

# c3-211: Preview Server

## Source
`src/server/preview.ts`

## Goal
Static file server for previewing production builds locally, serving from the `./dist` directory.

## Responsibilities
- Serve static files from `dist/` directory using Bun.serve()
- Handle directory index resolution (`/path/` -> `/path/index.html`)
- SPA fallback: serve `index.html` for non-file routes
- Validate `dist/` exists before starting (error if not built)

## Key Implementation Details
- Uses `Bun.file()` for zero-copy file serving
- Strips trailing slashes for consistent routing
- Path traversal protection: checks `filePath.startsWith(distDir)`
- Distinguishes files from directories using `statSync().isFile()`
- Lightweight: no build, no plugins, just static file serving

## Dependencies
- External: Bun.serve
