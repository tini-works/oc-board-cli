---
id: c3-5
c3-version: 4
title: jsx
type: container
boundary: library
parent: c3-0
goal: Renderer-agnostic JSX primitives for layout composition
summary: VNode representation, JSX runtime, component definitions, HTML adapter
---

# c3-5: JSX Primitives Container

## Goal

High-level JSX primitives system for defining renderer-agnostic component layouts. Provides VNode abstraction and HTML rendering.

## Status

**Work in Progress** - This container is under active development.

## Responsibilities

- Define JSX primitive components (Col, Row, Box, etc.)
- Create virtual node (VNode) representation
- Render VNodes to HTML
- Support component definitions with slots and props
- Migrate YAML configs to JSX

## Entry Point

`src/jsx/index.ts`

## Key Directories

| Path | Purpose |
|------|---------|
| `src/jsx/` | Core JSX primitives implementation |
| `src/jsx/schemas/` | Zod schemas for primitive validation |
| `src/jsx/adapters/` | Render adapters (HTML) |

## Components

| ID | Component | Description |
|----|-----------|-------------|
| c3-501 | [vnode](./c3-501-vnode.md) | Virtual node representation |
| c3-502 | [jsx-runtime](./c3-502-jsx-runtime.md) | Primitive components (Col, Row, Box, etc.) |
| c3-503 | [define-component](./c3-503-define-component.md) | Component definition API |
| c3-504 | [html-adapter](./c3-504-html-adapter.md) | VNode to HTML rendering |

## Primitive Components

| Primitive | Purpose |
|-----------|---------|
| `Col` | Vertical flex container |
| `Row` | Horizontal flex container |
| `Box` | Generic container with styling |
| `Spacer` | Flexible spacing element |
| `Slot` | Named content slot |
| `Text` | Text content with styling |
| `Icon` | Icon component |
| `Image` | Image with sizing |
| `Fragment` | Grouping without DOM element |

## Dependencies

- **Internal:** [c3-6-primitives](../c3-6-primitives/) for template parsing
- **External:** None (framework-agnostic)

## Data Flow

```
Component definition (defineComponent)
    ↓
JSX primitives (Col, Row, etc.)
    ↓
VNode tree
    ↓
Adapter (renderToHtml)
    ↓
HTML string
```
