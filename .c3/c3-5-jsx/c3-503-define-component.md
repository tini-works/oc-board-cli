---
id: c3-503
c3-version: 4
title: define-component
type: component
parent: c3-5
goal: Component definition API with typed props
summary: defineComponent helper with validation and schema generation
files:
  - src/jsx/define-component.ts
  - src/jsx/validation.ts
---

# c3-503: Define Component

## Goal

API for defining reusable components with typed props, slots, and render functions.

## Location

`src/jsx/define-component.ts`

## Responsibilities

- Define components with props schema
- Support named slots for content injection
- Provide component context (props, slots, children)
- Enable stateless component definitions

## API

### defineComponent()

```typescript
function defineComponent<P>(
  options: ComponentDefinition<P>
): ComponentFunction<P>

interface ComponentDefinition<P> {
  name: string
  props?: ZodSchema<P>
  slots?: string[]
  render: (ctx: ComponentContext<P>) => VNode
}
```

### ComponentContext

```typescript
interface ComponentContext<P> {
  props: P                           // Validated props
  slots: Record<string, VNode[]>     // Named slot content
  children: VNode[]                  // Default slot
}
```

### defineStatelessComponent()

```typescript
// Shorthand for simple components
function defineStatelessComponent<P>(
  name: string,
  render: (props: P) => VNode
): ComponentFunction<P>
```

## Usage Example

```typescript
import { defineComponent } from './define-component'
import { Col, Text, Slot } from './jsx-runtime'
import { z } from 'zod'

const Card = defineComponent({
  name: 'Card',
  props: z.object({
    title: z.string(),
    variant: z.enum(['default', 'outlined']).optional(),
  }),
  slots: ['footer'],
  render: ({ props, slots, children }) => (
    Col({ padding: 16, border: props.variant === 'outlined' },
      Text({ weight: 'bold' }, props.title),
      ...children,
      slots.footer?.length ? Col({}, ...slots.footer) : null,
    )
  ),
})
```

## Dependencies

- **Internal:** [c3-501-vnode](./c3-501-vnode.md), [c3-502-jsx-runtime](./c3-502-jsx-runtime.md)
- **External:** `zod` for props validation

## References

- `src/jsx/define-component.ts` - Component definition API with typed props and slots

## Notes

- Props validated at render time
- Slots accessed by name from context
- Components are pure functions (no state)
- Can be composed with other components
