---
id: c3-6
c3-version: 4
title: primitives
type: container
boundary: library
parent: c3-0
goal: Template-based layout primitives
summary: Type definitions, parsers, and renderers for layout primitives
---

# c3-6: Layout Primitives Container

## Goal

Template-based layout primitives for renderer-agnostic preview definitions. Parses `$col`, `$row`, etc. syntax into structured layouts.

## Status

**Work in Progress** - This container is under active development.

## Responsibilities

- Define primitive type system
- Parse primitive strings (`$col`, `$row`, etc.)
- Parse template layouts with nested primitives
- Render templates to concrete output
- Migrate legacy configs to primitive format

## Entry Point

`src/primitives/index.ts`

## Key Directories

| Path | Purpose |
|------|---------|
| `src/primitives/` | Core primitives implementation |

## Components

| ID | Component | Description |
|----|-----------|-------------|
| c3-601 | [types](./c3-601-types.md) | Primitive type definitions |
| c3-602 | [parser](./c3-602-parser.md) | Single primitive string parser |
| c3-603 | [template-parser](./c3-603-template-parser.md) | Full template layout parser |
| c3-604 | [template-renderer](./c3-604-template-renderer.md) | Render templates to output |

## Primitive Types

| Primitive | Syntax | Purpose |
|-----------|--------|---------|
| `$col` | `$col(gap=16)` | Vertical layout |
| `$row` | `$row(gap=8, align=center)` | Horizontal layout |
| `$box` | `$box(padding=24)` | Container with styling |
| `$spacer` | `$spacer(size=16)` | Fixed or flexible space |
| `$slot` | `$slot(name=header)` | Content placeholder |
| `$text` | `$text(size=lg)` | Text element |
| `$icon` | `$icon(name=check)` | Icon element |
| `$image` | `$image(src=url)` | Image element |

## Dependencies

- **Internal:** Used by [c3-5-jsx](../c3-5-jsx/) for template integration
- **External:** None

## Data Flow

```
Template string (YAML/config)
    ↓
Template parser (tokenize + parse)
    ↓
Primitive AST
    ↓
Template renderer
    ↓
Concrete output (VNode, HTML, etc.)
```
