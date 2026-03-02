# c3-4: Previews Container

## Purpose

Interactive preview system for showcasing UI components, screens, user flows, and information architecture. Provides type-specific viewers and render adapters.

## Responsibilities

- Display preview catalog with filtering and search
- Render type-specific viewers (component, screen, flow)
- Support multiple render adapters (React, HTML)
- Handle preview state management and navigation
- Compile preview bundles with Tailwind CSS

## Entry Point

`src/theme/previews/PreviewRouter.tsx` - Route-based type dispatch

## Key Directories

| Path | Purpose |
|------|---------|
| `src/theme/previews/` | Type-specific preview viewers |
| `src/renderers/` | Render adapter implementations |
| `src/preview-runtime/` | Preview compilation and bundling |

## Preview Types

| Type | Purpose | Config Fields |
|------|---------|---------------|
| Component | Reusable UI units | props, slots, templates |
| Screen | Full-page views | states (multiple variants) |
| Flow | Multi-step journeys | steps, transitions |

## Components

| ID | Component | Description |
|----|-----------|-------------|
| c3-401 | [preview-router](./c3-401-preview-router.md) | Route dispatch by preview type |
| c3-402 | [component-viewer](./c3-402-component-viewer.md) | Component preview with props panel |
| c3-403 | [screen-viewer](./c3-403-screen-viewer.md) | Screen states with viewport toggle |
| c3-404 | [flow-viewer](./c3-404-flow-viewer.md) | Step navigation and transitions |
| c3-406 | [render-adapter](./c3-406-render-adapter.md) | Pluggable rendering backends |

## Preview Discovery

Previews live in `previews/` directory:
```
previews/
├── components/
│   └── button/
│       ├── config.yaml
│       └── App.tsx
├── screens/
│   └── dashboard/
│       ├── config.yaml
│       └── App.tsx
└── flows/
    └── checkout/
        └── config.yaml
```

## Dependencies

- **Internal:** [c3-2-build](../c3-2-build/) for preview scanning, [c3-3-theme](../c3-3-theme/) for UI
- **External:** esbuild, Tailwind CSS v4 compiler

## Data Flow

```
previews/ directory
      ↓
 Preview Scanner (config.yaml parsing)
      ↓
 Virtual Module (preview catalog)
      ↓
 Preview Router (type dispatch)
      ↓
 Type Viewer (component/screen/flow)
      ↓
 Render Adapter (React/HTML)
      ↓
 Rendered Preview
```
