---
id: c3-603
c3-version: 4
title: template-parser
type: component
parent: c3-6
goal: Parse full template layouts
summary: Multi-line template layout parsing with grid support
files:
  - src/primitives/template-parser.ts
---

# c3-603: Template Parser

## Goal

Parses full template layouts with nested primitives from YAML-like structures.

## Location

`src/primitives/template-parser.ts`

## Responsibilities

- Parse template arrays into primitive trees
- Handle nested children
- Resolve primitive references
- Validate template structure

## API

### parseTemplate()

```typescript
function parseTemplate(template: TemplateNode[]): ParseResult

type TemplateNode = string | { [key: string]: TemplateNode[] }

interface ParseResult {
  success: boolean
  primitives?: Primitive[]
  errors?: string[]
}
```

## Template Format

```yaml
# Simple primitive
- $text(content="Hello")

# Primitive with children
- $col(gap=16):
    - $text(weight=bold, content="Title")
    - $text(content="Body")

# Nested layout
- $row(gap=8):
    - $col:
        - $text(content="Left")
    - $col:
        - $text(content="Right")
```

## Parsing Rules

1. String starting with `$` → parse as primitive
2. Object with `$key:` → primitive with children
3. Array → list of sibling primitives
4. Plain string → text primitive

## Dependencies

- **Internal:** [c3-602-parser](./c3-602-parser.md) for single primitives
- **Internal:** [c3-601-types](./c3-601-types.md) for types

## References

- `src/primitives/template-parser.ts` - Parses full template layouts with nested primitives from YAML-like structures

## Example

```typescript
parseTemplate([
  '$col(gap=16):',
  [
    '$text(weight=bold, content="Title")',
    '$spacer(size=8)',
    '$text(content="Body")',
  ],
])
// {
//   success: true,
//   primitives: [{
//     type: 'col',
//     props: { gap: 16 },
//     children: [
//       { type: 'text', props: { weight: 'bold', content: 'Title' } },
//       { type: 'spacer', props: { size: 8 } },
//       { type: 'text', props: { content: 'Body' } },
//     ]
//   }]
// }
```

## Notes

- Colon `:` after primitive indicates children follow
- Indentation determines nesting (in YAML source)
- Empty children allowed
