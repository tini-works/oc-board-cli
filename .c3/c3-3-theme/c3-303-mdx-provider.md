---
id: c3-303
c3-version: 4
title: mdx-provider
type: component
parent: c3-3
goal: Custom component mapping for MDX content
summary: Provides React components for MDX rendering (headings, code blocks, etc.)
files:
  - src/theme/mdx-components.tsx
---

# c3-303: MDX Provider

## Goal

Provides custom React component mapping for MDX content, enabling enhanced rendering of links, tables, and embedded previews.

## Location

`src/theme/mdx-components.tsx`

## Responsibilities

- Map standard HTML elements to enhanced React components
- Validate internal links against known routes
- Handle external links with proper attributes
- Wrap tables for responsive scrolling
- Provide Preview component for embedding

## Component Mapping

```typescript
export const mdxComponents = {
  Preview,     // Embed component previews
  a: MdxLink,  // Smart link handling
  table: MdxTable,  // Responsive table wrapper
}
```

## MdxLink Component

### Features
- Detects internal vs external links
- Uses TanStack Router Link for internal navigation
- Opens external links in new tab
- Shows dead link warning in dev mode

### Link Classification

```typescript
// External: starts with http://, mailto:, tel:, #
// Internal: starts with / or has no protocol
function isInternalLink(href: string): boolean
```

### Dead Link Detection (Dev Only)

```typescript
const exists = routeExists(href)  // Check against virtual:prev-pages
if (isDev && !exists) {
  // Render with warning icon
}
```

## MdxTable Component

Wraps tables in scrollable container for mobile:

```typescript
<div className="table-wrapper has-scroll">
  <table>{children}</table>
</div>
```

## Dependencies

- **Internal:** `virtual:prev-pages` for route validation
- **Internal:** `./Preview` for preview embedding
- **External:** @tanstack/react-router Link

## References

- `src/theme/mdx-components.tsx` - MDX component mappings (MdxLink, MdxTable, Preview)
- `src/theme/mdx-provider.tsx` - MDX provider wrapper component

## Related Refs

- [ref-theming](../refs/ref-theming.md) - CSS theming system

## Notes

- Dead link warnings only appear in development
- External links get `target="_blank"` and `rel="noopener noreferrer"`
- Table scroll indicator shows when content overflows
