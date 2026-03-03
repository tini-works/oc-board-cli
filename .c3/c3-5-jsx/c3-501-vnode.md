---
id: c3-501
c3-version: 4
title: vnode
type: component
parent: c3-5
goal: Virtual node representation for renderer-agnostic layouts
summary: VNode type definition and creation utilities
files:
  - src/jsx/vnode.ts
---

# c3-501: VNode

## Goal

Virtual node representation for JSX primitives. Provides a lightweight, framework-agnostic tree structure.

## Location

`src/jsx/vnode.ts`

## Responsibilities

- Create virtual nodes with type, props, children
- Normalize children (flatten arrays, handle primitives)
- Compare VNodes for equality
- Generate unique IDs for nodes

## API

### createVNode()

```typescript
function createVNode(
  type: VNodeType,
  props: Record<string, unknown>,
  children: VNode[]
): VNode

type VNodeType =
  | 'col' | 'row' | 'box' | 'spacer'
  | 'slot' | 'text' | 'icon' | 'image'
  | 'fragment' | ComponentFunction
```

### VNode Interface

```typescript
interface VNode {
  id: string              // Unique identifier
  type: VNodeType         // Primitive type or component
  props: Record<string, unknown>
  children: VNode[]
}
```

### Utility Functions

```typescript
// Create component VNode
function createComponentVNode(
  component: ComponentFunction,
  props: Record<string, unknown>,
  children: VNode[]
): VNode

// Flatten and normalize children
function normalizeChildren(children: unknown[]): VNode[]

// Deep equality check
function vnodeEquals(a: VNode, b: VNode): boolean

// Reset ID counter (for testing)
function resetIdCounter(): void
```

## Dependencies

- **Internal:** None
- **External:** None

## References

- `src/jsx/vnode.ts` - VNode creation, normalization, and equality utilities

## Notes

- IDs are auto-generated using incrementing counter
- Children normalized to VNode array (primitives wrapped)
- Fragment nodes have no DOM representation
- Component functions receive props and return VNode
