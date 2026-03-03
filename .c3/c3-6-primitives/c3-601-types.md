---
id: c3-601
c3-version: 4
title: types
type: component
parent: c3-6
goal: Primitive type definitions
summary: Type system for layout primitives (Row, Col, Stack, etc.)
files:
  - src/primitives/types.ts
  - src/primitives/index.ts
---

# c3-601: Types

## Goal

Type definitions for layout primitives and their properties.

## Location

`src/primitives/types.ts`

## Responsibilities

- Define primitive type enum
- Define property types for each primitive
- Provide type guards for runtime checking

## Types

### PrimitiveType

```typescript
type PrimitiveType =
  | 'col' | 'row' | 'box' | 'spacer'
  | 'slot' | 'text' | 'icon' | 'image'
```

### Primitive

```typescript
interface Primitive {
  type: PrimitiveType
  props: PrimitiveProps
  children?: Primitive[]
}
```

### Layout Props

```typescript
interface LayoutProps {
  gap?: number | string
  padding?: number | string
  margin?: number | string
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  wrap?: boolean
}
```

### Content Props

```typescript
interface TextProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  weight?: 'normal' | 'medium' | 'bold'
  color?: string
  align?: 'left' | 'center' | 'right'
}

interface IconProps {
  name: string
  size?: number | string
  color?: string
}

interface ImageProps {
  src: string
  alt?: string
  width?: number | string
  height?: number | string
  fit?: 'cover' | 'contain' | 'fill'
}
```

### Slot Props

```typescript
interface SlotProps {
  name: string
  fallback?: Primitive[]
}
```

## Dependencies

- **Internal:** None
- **External:** None

## References

- `src/primitives/types.ts` - Type definitions for layout primitives and their properties

## Notes

- Props use CSS-like naming conventions
- Numeric values default to pixels
- String values can include units
- Slot names must be unique within template
