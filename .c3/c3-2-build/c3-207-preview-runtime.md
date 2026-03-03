---
id: c3-207
c3-version: 4
title: preview-runtime
type: component
parent: c3-2
goal: Build standalone preview HTML with Tailwind
summary: Optimized preview bundling with vendor caching and Tailwind integration
files:
  - src/preview-runtime/build-optimized.ts
  - src/preview-runtime/vendors.ts
  - src/preview-runtime/tailwind.ts
  - src/preview-runtime/types.ts
  - src/preview-runtime/region-bridge.ts
  - src/preview-runtime/build.ts
  - src/preview-runtime/template.html
  - src/preview-runtime/fast-template.html
---

# c3-207: Preview Runtime

## Goal

Builds standalone preview HTML files for production using Bun.build() and Tailwind CSS compilation.

## Location

`src/preview-runtime/build-optimized.ts`, `src/preview-runtime/vendors.ts`, `src/preview-runtime/tailwind.ts`, `src/preview-runtime/types.ts`

## Responsibilities

- Build shared vendor bundle (React, ReactDOM)
- Compile individual preview bundles with Bun.build()
- Process Tailwind CSS v4 for production
- Generate standalone HTML files

## API

### buildOptimizedPreview()

```typescript
async function buildOptimizedPreview(
  config: PreviewConfig,
  options: OptimizedBuildOptions
): Promise<OptimizedBuildResult>

interface OptimizedBuildOptions {
  vendorPath: string  // Relative path to vendor bundle
}

interface OptimizedBuildResult {
  success: boolean
  html: string
  css: string
  error?: string
}
```

### buildVendorBundle()

```typescript
async function buildVendorBundle(): Promise<{
  success: boolean
  code: string
  error?: string
}>
```

### compileTailwind()

```typescript
async function compileTailwind(
  files: Array<{ path: string; content: string }>
): Promise<{
  success: boolean
  css: string
  error?: string
}>
```

## Build Process

```
Preview files (tsx, css, etc.)
    ↓
Write files to temp directory
    ↓
Bundle with Bun.build (externalize React via vendor bundle)
    ↓
Compile Tailwind CSS
    ↓
Merge user CSS
    ↓
Generate HTML with inline scripts/styles
```

## Vendor Bundle

Single shared bundle containing:
- React
- ReactDOM
- createRoot

Loaded once, shared across all previews for smaller total size.

## Dependencies

- **Internal:** [c3-210-build](./c3-210-build.md) invokes during production build
- **External:** Bun.build for bundling, `tailwindcss` for CSS processing

## PreviewConfig Interface

```typescript
interface PreviewConfig {
  files: PreviewFile[]   // All files in preview directory
  entry: string          // Entry point (App.tsx, etc.)
  tailwind: boolean      // Enable Tailwind processing
}

interface PreviewFile {
  path: string
  content: string
  type: 'tsx' | 'ts' | 'jsx' | 'js' | 'css' | 'json'
}
```

## References

- `src/preview-runtime/build-optimized.ts` - Main preview building logic
- `src/preview-runtime/build-optimized.ts:buildOptimizedPreview()` - Builds standalone preview HTML
- `src/preview-runtime/vendors.ts` - Vendor bundle building
- `src/preview-runtime/vendors.ts:buildVendorBundle()` - Creates shared React/ReactDOM bundle
- `src/preview-runtime/tailwind.ts` - Tailwind CSS compilation
- `src/preview-runtime/tailwind.ts:compileTailwind()` - Compiles Tailwind v4 CSS
- `src/preview-runtime/types.ts` - Type definitions (PreviewConfig, PreviewFile, etc.)
- `src/preview-runtime/template.html` - HTML template for preview output

## Related Refs

- [ref-preview-types](../refs/ref-preview-types.md) - Preview type hierarchy and configuration interfaces

## Notes

- Tailwind v4 uses `@import "tailwindcss"` syntax
- CSS imports stripped when Tailwind compiled
- Minification enabled for production
- JSX automatic runtime used
