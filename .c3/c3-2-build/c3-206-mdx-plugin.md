---
id: c3-206
c3-version: 4
title: mdx-plugin
type: component
parent: c3-2
goal: MDX transformation pipeline
summary: Compiles MDX to React components with remark/rehype plugins
files:
  - src/server/plugins/mdx.ts
---

# c3-206: MDX Plugin

## Goal

Bun plugin that compiles .md/.mdx files to React components using `@mdx-js/mdx`, enabling React components in documentation.

## Location

`src/server/plugins/mdx.ts`

## Responsibilities

- Transform `.md` and `.mdx` files to React components via `build.onLoad()`
- Apply remark plugins for GitHub-flavored markdown
- Apply rehype plugins for syntax highlighting
- Configure MDX provider for component mapping
- Skip files outside rootDir (e.g., node_modules)

## Configuration

```typescript
const compiled = await compile(source, {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [rehypeHighlight],
  providerImportSource: '@mdx-js/react',
  development: false,
  jsx: false, // Output JS, not JSX
})
```

## Plugins

### Remark Plugins
- **remark-gfm**: Tables, strikethrough, task lists, autolinks

### Rehype Plugins
- **rehype-highlight**: Code syntax highlighting

## Key Implementation Details

- Lazy-loads `@mdx-js/mdx`, `remark-gfm`, and `rehype-highlight` to avoid top-level import cost
- Forces `development: false` and `jsx: false` to output JS (avoids `_jsxDEV` errors)
- Returns compiled output with `loader: 'jsx'` for Bun.build

## Dependencies

- **External:** `@mdx-js/mdx` - MDX compiler
- **External:** `remark-gfm` - GitHub-flavored markdown
- **External:** `rehype-highlight` - Syntax highlighting

## MDX Provider

Component mapping defined in `src/theme/mdx-components.tsx`:

```typescript
export const mdxComponents = {
  h1: HeadingComponent,
  h2: HeadingComponent,
  code: CodeComponent,
  pre: PreComponent,
  Preview: PreviewComponent,
  // ...
}
```

## References

- `src/server/plugins/mdx.ts` - Bun plugin implementation
- `src/theme/mdx-components.tsx` - MDX component mapping (h1, h2, code, pre, Preview, etc.)
- `src/theme/components/Preview.tsx` - Preview component for embedding previews in MDX

## Notes

- Only processes files in project root, not node_modules
- MDX files can import React components directly
- Custom components can be used in markdown content
