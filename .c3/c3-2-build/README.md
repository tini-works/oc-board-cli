---
id: c3-2
c3-version: 4
title: build
type: container
boundary: process
parent: c3-0
goal: Bun-based build system with plugin architecture
summary: Dev server, production builder, and plugin pipeline for pages, previews, MDX
---

# c3-2: Build Container

## Goal

Bun-based build system that compiles markdown/MDX files into a static documentation site. Provides plugins for page discovery, preview scanning, and MDX transformation, plus dev/preview servers.

## Responsibilities

- Configure Bun.build() for documentation site generation
- Scan and parse markdown/MDX files for page metadata
- Discover and catalog preview configurations
- Generate virtual modules via Bun plugin API (onResolve/onLoad)
- Handle MDX transformation with syntax highlighting
- Serve dev server with SSE-based live reload
- Build production static site
- Preview production builds via static file server

## Entry Point

`src/server/start.ts` - Server command dispatcher

## Key Directories

| Path | Purpose |
|------|---------|
| `src/content/` | Content scanning (pages, previews, config parsing) |
| `src/server/` | Dev server, build, preview server |
| `src/server/plugins/` | Bun plugin implementations |
| `src/server/routes/` | Route handlers for dev server |

## Components

| ID | Component | Description |
|----|-----------|-------------|
| c3-202 | [pages-plugin](./c3-202-pages-plugin.md) | Page discovery and sidebar generation |
| c3-203 | [previews-plugin](./c3-203-previews-plugin.md) | Preview catalog discovery |
| c3-205 | [config-plugin](./c3-205-config-plugin.md) | Runtime config injection |
| c3-206 | [mdx-plugin](./c3-206-mdx-plugin.md) | MDX transformation pipeline |
| c3-207 | [preview-runtime](./c3-207-preview-runtime.md) | Preview build with Bun.build + Tailwind |
| c3-208 | [tokens-plugin](./c3-208-tokens-plugin.md) | Design token delivery via virtual module + dev endpoint |
| c3-209 | [dev-server](./c3-209-dev-server.md) | Development server with live reload |
| c3-210 | [build](./c3-210-build.md) | Production static site generator |
| c3-211 | [preview-server](./c3-211-preview-server.md) | Static file server for production builds |
| c3-212 | [aliases-plugin](./c3-212-aliases-plugin.md) | Module resolution and React deduplication |

## Virtual Modules

| Module | Purpose |
|--------|---------|
| `virtual:prev-pages` | Generated page manifest |
| `virtual:prev-page-modules` | MDX component imports |
| `virtual:prev-previews` | Preview catalog |
| `virtual:prev-config` | Runtime configuration |
| `virtual:prev-tokens` | Resolved design tokens |

## Dependencies

- **Internal:** [c3-1-cli](../c3-1-cli/) provides configuration
- **External:** Bun.build, Bun.serve, @mdx-js/mdx, fast-glob

## Data Flow

```
.md/.mdx files
      |
 Page Scanner (frontmatter extraction)
      |
 Virtual Modules (Bun plugin onResolve/onLoad)
      |
 Bun.build() Bundle
      |
 Static Output (./dist/)
```
