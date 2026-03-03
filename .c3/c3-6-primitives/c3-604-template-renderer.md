---
id: c3-604
c3-version: 4
title: template-renderer
type: component
parent: c3-6
goal: Render parsed templates to output
summary: Converts parsed template AST to renderable output
files:
  - src/primitives/template-renderer.ts
---

# c3-604: Template Renderer

## Goal

Renders parsed primitive templates to concrete output formats.

## Location

`src/primitives/template-renderer.ts`

## Responsibilities

- Render primitive trees to VNodes
- Resolve slots with provided content
- Apply default styling
- Support custom renderers

## API

### renderTemplate()

```typescript
function renderTemplate(
  primitives: Primitive[],
  context?: RenderContext
): RenderOutput

interface RenderContext {
  slots?: Record<string, Primitive[]>  // Slot content
  props?: Record<string, unknown>      // Dynamic props
  renderer?: 'vnode' | 'html'          // Output format
}

type RenderOutput = VNode[] | string
```

### Slot Resolution

```typescript
// Template defines slot
$slot(name=header)

// Context provides content
{
  slots: {
    header: [{ type: 'text', props: { content: 'My Header' } }]
  }
}
```

## Rendering Pipeline

```
Primitive tree
    ↓
Resolve slots (inject context.slots)
    ↓
Apply props (merge context.props)
    ↓
Convert to VNodes
    ↓
(Optional) Render to HTML
```

## Dependencies

- **Internal:** [c3-5-jsx](../c3-5-jsx/) for VNode output
- **Internal:** [c3-601-types](./c3-601-types.md) for Primitive type

## References

- `src/primitives/template-renderer.ts` - Renders parsed primitive templates to concrete output formats

## Example

```typescript
const primitives = [
  {
    type: 'col',
    props: { gap: 16 },
    children: [
      { type: 'slot', props: { name: 'header' } },
      { type: 'text', props: { content: 'Body' } },
    ],
  },
]

renderTemplate(primitives, {
  slots: {
    header: [{ type: 'text', props: { weight: 'bold', content: 'Title' } }],
  },
})
// Returns VNode tree with slot resolved
```

## Notes

- Unresolved slots render fallback or nothing
- Props can override primitive defaults
- HTML output useful for static generation
- VNode output for React/JSX integration
