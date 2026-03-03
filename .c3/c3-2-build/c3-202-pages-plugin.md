---
id: c3-202
c3-version: 4
title: pages-plugin
type: component
parent: c3-2
goal: Discover markdown/MDX pages and generate sidebar
summary: File system page discovery and virtual module generation
files:
  - src/content/pages.ts
---

# c3-202: Pages Plugin

## Goal

Content scanner that discovers markdown/MDX files, parses frontmatter, and provides page data for virtual module generation. Virtual modules are served via the Bun plugin in `src/server/plugins/virtual-modules.ts`.

## Location

`src/server/plugins/virtual-modules.ts` (virtual module generation), `src/content/pages.ts` (page scanning and sidebar building)

## Responsibilities

- Scan project for .md/.mdx files
- Parse YAML frontmatter for metadata
- Extract titles from headings or filenames
- Build sidebar tree structure
- Generate virtual modules for runtime
- Handle HMR for markdown file changes

## Virtual Modules

### `virtual:prev-pages`

```typescript
export const pages: Page[]      // All discovered pages
export const sidebar: SidebarItem[]  // Navigation tree
```

### `virtual:prev-page-modules`

```typescript
export const pageModules: Record<string, { default: React.ComponentType }>
```

## API

### Page Interface

```typescript
interface Page {
  route: string          // URL path (e.g., '/guides/intro')
  title: string          // Page title
  file: string           // Relative file path
  description?: string   // From frontmatter
  frontmatter?: Record<string, unknown>
  hidden?: boolean       // Hidden from sidebar
}
```

### SidebarItem Interface

```typescript
interface SidebarItem {
  title: string
  route?: string         // Leaf nodes have routes
  children?: SidebarItem[]  // Folders have children
}
```

## File Scanning

### Included Patterns
- `**/*.{md,mdx}`
- Explicit patterns for included dot directories

### Ignored Patterns
- `node_modules/**`, `dist/**`, `.git/**`
- `apps/**`, `packages/**`, `src/**` (monorepo dirs)
- `CLAUDE.md`, `CHANGELOG.md`, etc. (meta files)

## Dependencies

- **External:** `fast-glob` for file discovery
- **External:** `picomatch` for hidden pattern matching

## Data Flow

```
File system scan
    ↓
Filter by include/ignore patterns
    ↓
Read each file + parse frontmatter
    ↓
Extract title (frontmatter > h1 > filename)
    ↓
Build page list + sidebar tree
    ↓
Virtual module code generation
```

## Live Reload

In dev mode, file watcher triggers full rebuild and SSE reload when `.md`/`.mdx` files change (see [c3-209](./c3-209-dev-server.md)).

## References

- `src/content/pages.ts` - Page scanning and sidebar tree building functions
- `src/content/pages.ts:scanPages()` - Scans project for .md/.mdx files
- `src/content/pages.ts:buildSidebarTree()` - Builds sidebar tree structure from pages
- `src/server/plugins/virtual-modules.ts` - Virtual module generation via Bun plugin API

## Related Refs

- [ref-virtual-modules](../refs/ref-virtual-modules.md) - Bun virtual module pattern for runtime code generation

## Notes

- Index files (index.md, README.md) map to directory routes
- Route strips content root directories (docs/, content/)
- Page priority: index > README for route conflicts
