---
id: c3-210
c3-version: 4
title: build
type: component
parent: c3-2
goal: Production static site generator
summary: Builds static HTML/JS/CSS output to dist/
files:
  - src/server/build.ts
---

# c3-210: Build

## Source
`src/server/build.ts`

## Goal
Production static site generator using Bun.build() for bundling and HTML generation.

## Responsibilities
- Bundle theme entry (`src/theme/entry.tsx`) with Bun.build() using explicit plugins
- Generate `index.html` with hashed asset references
- Copy `index.html` to `404.html` for SPA fallback on static hosts
- Build preview HTML files for all discovered preview units
- Build shared vendor bundle (`_vendors/runtime.js`) and JSX bundle (`_vendors/jsx.js`)
- Build individual preview bundles with `buildOptimizedPreview()`
- Handle screen state variants as separate builds

## Key Implementation Details
- Production build uses `minify: true`, `splitting: true` for code splitting
- Asset naming uses `[name]-[hash].[ext]` pattern for cache busting
- Preview builds write to `dist/_preview/<type>s/<name>/index.html`
- Vendor bundle shared across all previews; relative path calculated from preview depth
- Screen previews build each state file as a separate HTML output

## Dependencies
- Internal: [c3-202-pages-plugin](./c3-202-pages-plugin.md) via virtual-modules plugin
- Internal: [c3-203-previews-plugin](./c3-203-previews-plugin.md) for `scanPreviewUnits`, `buildPreviewConfig`
- Internal: [c3-207-preview-runtime](./c3-207-preview-runtime.md) for `buildOptimizedPreview`, `buildVendorBundle`
- Internal: [c3-212-aliases-plugin](./c3-212-aliases-plugin.md), mdx plugin
- External: Bun.build
