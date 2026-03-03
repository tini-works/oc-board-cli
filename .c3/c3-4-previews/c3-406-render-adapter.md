---
id: c3-406
c3-version: 4
title: render-adapter
type: component
parent: c3-4
goal: Pluggable rendering backends for previews
summary: Registry-based renderer selection (React, HTML) with adapter pattern
files:
  - src/renderers/registry.ts
  - src/renderers/render.ts
  - src/renderers/types.ts
  - src/renderers/index.ts
  - src/renderers/react/index.ts
  - src/renderers/html/index.ts
---

# c3-406: Render Adapter

## Goal

Pluggable rendering backend that enables preview components to be rendered with different technologies (React, HTML). Defines the adapter interface, manages a global registry, and selects the appropriate adapter per config.

## Location

`src/renderers/types.ts`, `src/renderers/registry.ts`, `src/renderers/render.ts`, `src/renderers/react/`, `src/renderers/html/`

## Category

`foundation`

## Responsibilities

- Define `RendererAdapter` interface and output types
- Register adapters globally (`registerAdapter`)
- Select renderer based on config `layoutByRenderer` keys or explicit preference
- Lazy-load built-in React and HTML adapters at startup

## Adapter Interface

```typescript
interface RendererAdapter {
  readonly name: string           // Must match layoutByRenderer keys (e.g. "react", "html")
  readonly layoutSchema: JSONSchema7  // JSON Schema for validating renderer-specific layout nodes

  renderComponent(config: ComponentConfig): RenderOutput
  renderScreen(config: ScreenConfig, state?: string): RenderOutput
  renderFlow(config: FlowConfig, step?: string): RenderOutput
  renderAtlas(config: AtlasConfig): RenderOutput

  supportsHMR(): boolean
  createDevServer?(port: number): DevServer  // optional
}

interface RenderOutput {
  html: string
  css?: string
  js?: string  // optional asset path
}
```

## Registry API

```typescript
function registerAdapter(adapter: RendererAdapter): void  // throws if duplicate
function getAdapter(name: string): RendererAdapter | undefined
function listAdapters(): string[]
function getAllAdapters(): RendererAdapter[]
function initializeAdapters(): Promise<void>  // registers React + HTML built-ins
function validateRendererKeys(keys: string[]): string[]  // returns unknown renderer names
```

## Render API

```typescript
interface RenderOptions {
  renderer?: string  // override; defaults to first key in layoutByRenderer
  state?: string     // for screen rendering
  step?: string      // for flow rendering
}

async function renderPreview(config: PreviewConfig, options?: RenderOptions): Promise<RenderResult>
```

## Available Renderers

| Renderer | Output | Use Case |
|----------|--------|----------|
| `react` | React elements | Interactive previews with HMR |
| `html` | Static HTML string | Documentation, SSR, static export |

## Dependencies

- **Internal:** Preview types (`ComponentConfig`, `ScreenConfig`, `FlowConfig`, `AtlasConfig`) from [ref-preview-types](../refs/ref-preview-types.md)
- **Internal:** Used by [c3-402](./c3-402-component-viewer.md) through [c3-405](./c3-405-atlas-viewer.md) for rendering
- **External:** React (react adapter), DOM APIs (html adapter), `json-schema` for `JSONSchema7`

## Data Flow

```
PreviewConfig (with layoutByRenderer or template/slots)
    ↓
selectAdapter() — match renderer name to registry
    ↓
adapter.renderComponent/Screen/Flow/Atlas(config)
    ↓
RenderOutput { html, css?, js? }
```

## Notes

- Adapters are lazy-loaded via dynamic `import()` in `initializeAdapters()`
- `layoutSchema` per adapter enables the validator (c3-103) to check renderer-specific layout subtrees
- Adapters are stateless; all context passed via config arguments

## References

- `src/renderers/types.ts` — `RendererAdapter`, `RenderOutput`, `DevServer`, all config types
- `src/renderers/registry.ts` — `registerAdapter()`, `getAdapter()`, `initializeAdapters()`
- `src/renderers/render.ts` — `renderPreview()`, `selectAdapter()`, `ensureAdaptersInitialized()`
- `src/renderers/react/index.ts` — `ReactAdapter` implementation
- `src/renderers/html/index.ts` — `HTMLAdapter` implementation

## Related Refs

- [ref-preview-types](../refs/ref-preview-types.md) — `ComponentConfig`, `ScreenConfig`, `FlowConfig`, `AtlasConfig`
