---
id: c3-301
c3-version: 4
title: entry
type: component
parent: c3-3
goal: React app entry point and routing
summary: Mounts React app with router, MDX provider, and theme setup
files:
  - src/theme/entry.tsx
  - src/theme/index.ts
  - src/theme/index.html
---

# c3-301: Entry

## Goal

React application entry point that bootstraps the documentation site with routing, MDX provider, and layout components.

## Location

`src/theme/entry.tsx`

## Responsibilities

- Create TanStack Router with page routes
- Set up MDX provider with component mapping
- Configure preview routes (catalog and detail views)
- Handle SPA routing with base path support
- Render DevTools provider for preview development

## Key Components

### Router Configuration

```typescript
const router = createRouter({
  routeTree,
  basepath,  // Support subpath deployments
  defaultNotFoundComponent: NotFoundPage,
})
```

### Route Tree

- `/` - Index page (or redirect to first page)
- `/previews` - Preview catalog
- `/previews/$` - Individual preview (splat route)
- `/{page.route}` - Dynamic page routes from scanning

### Virtual Module Imports

```typescript
import { pages, sidebar } from 'virtual:prev-pages'
import { pageModules } from 'virtual:prev-page-modules'
import { previews } from 'virtual:prev-previews'
```

## Dependencies

- **Internal:** [c3-302-layout](./c3-302-layout.md) for page layout
- **Internal:** [c3-303-mdx-provider](./c3-303-mdx-provider.md) for component mapping
- **External:** TanStack Router, React, @mdx-js/react

## Data Flow

```
Virtual modules (pages, previews)
    ↓
Convert sidebar to PageTree format
    ↓
Create route tree
    ↓
RouterProvider
    ↓
Layout + Page content
```

## References

- `src/theme/entry.tsx` - React application entry point with routing setup
- `src/theme/index.ts` - Main theme exports and barrel file

## Related Refs

- [ref-theming](../refs/ref-theming.md) - CSS theming system

## Notes

- Supports GitHub Pages with BASE_URL
- Preview catalog shows all discoverable previews
- Not found routes redirect to first available page
