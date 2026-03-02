# c3-203: Previews Plugin

## Purpose

Content scanner that discovers preview components and generates virtual modules for the preview catalog. Virtual modules are served via the Bun plugin in `src/server/plugins/virtual-modules.ts`. Production preview HTML files are built by [c3-210](./c3-210-build.md).

## Location

`src/server/plugins/virtual-modules.ts` (virtual module generation), `src/content/previews.ts` (preview scanning and config building)

## Responsibilities

- Scan `previews/` directory for components, screens, flows
- Parse config.yaml for each preview unit
- Generate virtual module with preview catalog
- Build standalone HTML files during production build
- Handle HMR for preview file changes

## Virtual Module

### `virtual:prev-previews`

```typescript
export const previewUnits: PreviewUnit[]  // Multi-type units
export const previews: Preview[]          // Legacy flat previews

// Helper functions
export function getByType(type: string): PreviewUnit[]
export function getByTags(tags: string[]): PreviewUnit[]
export function getByCategory(category: string): PreviewUnit[]
export function getByStatus(status: string): PreviewUnit[]
```

## Preview Types

| Type | Folder | Index File |
|------|--------|------------|
| component | `previews/components/` | `App.tsx`, `index.tsx` |
| screen | `previews/screens/` | `App.tsx`, `index.tsx` |
| flow | `previews/flows/` | `index.yaml` |

## Production Build

Handled by [c3-210-build](./c3-210-build.md):

1. Build shared vendor bundle (`_vendors/runtime.js`)
2. For each preview:
   - Load preview config
   - Build optimized HTML with Bun.build
   - Write to `dist/_preview/<type>s/<name>/index.html`

## Dependencies

- **Internal:** `preview-runtime/build-optimized.ts` for preview building
- **Internal:** `preview-runtime/vendors.ts` for vendor bundle
- **External:** `fast-glob` for file discovery

## Data Flow

```
previews/ directory
    ↓
scanPreviewUnits (for each type folder)
    ↓
Parse config.yaml + detect files
    ↓
Generate virtual module
    ↓
(Build mode) Compile standalone HTML
```

## Live Reload

In dev mode, file watcher triggers full rebuild and SSE reload when preview files change (see [c3-209](./c3-209-dev-server.md)).

## References

- `src/content/previews.ts` - Preview type definitions and discovery
- `src/content/previews.ts:scanPreviewUnits()` - Scans for preview units
- `src/content/previews.ts:buildPreviewConfig()` - Builds config for a preview directory
- `src/server/plugins/virtual-modules.ts` - Virtual module generation via Bun plugin API
- `src/preview-runtime/build-optimized.ts` - Optimized Bun.build integration

## Related Refs

- [ref-preview-types](../refs/ref-preview-types.md) - Preview type hierarchy and schemas
- [ref-virtual-modules](../refs/ref-virtual-modules.md) - Bun virtual module pattern

## Notes

- Supports both multi-type structure and legacy flat structure
- Vendor bundle shared across all previews for smaller output
- Preview depth determines relative vendor path
