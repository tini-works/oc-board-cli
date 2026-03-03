---
id: c3-602
c3-version: 4
title: parser
type: component
parent: c3-6
goal: Parse single primitive strings
summary: Parses shorthand primitive notation into structured types
files:
  - src/primitives/parser.ts
---

# c3-602: Parser

## Goal

Parses single primitive strings into structured objects.

## Location

`src/primitives/parser.ts`

## Responsibilities

- Parse `$type(prop=value)` syntax
- Extract type and properties
- Validate property values
- Handle nested parentheses

## API

### parsePrimitive()

```typescript
function parsePrimitive(input: string): ParseResult

interface ParseResult {
  success: boolean
  primitive?: Primitive
  error?: string
}
```

## Syntax

```
$type                    → { type: 'type', props: {} }
$type(prop=value)        → { type: 'type', props: { prop: value } }
$type(a=1, b=2)          → { type: 'type', props: { a: 1, b: 2 } }
$type(str="hello")       → { type: 'type', props: { str: 'hello' } }
```

## Examples

```typescript
parsePrimitive('$col')
// { success: true, primitive: { type: 'col', props: {} } }

parsePrimitive('$row(gap=16, align=center)')
// { success: true, primitive: { type: 'row', props: { gap: 16, align: 'center' } } }

parsePrimitive('$text(size=lg, weight=bold)')
// { success: true, primitive: { type: 'text', props: { size: 'lg', weight: 'bold' } } }
```

## Value Types

| Pattern | Parsed As |
|---------|----------|
| `123` | Number |
| `"text"` | String |
| `'text'` | String |
| `true` / `false` | Boolean |
| `word` | String (unquoted) |

## Dependencies

- **Internal:** [c3-601-types](./c3-601-types.md) for Primitive type

## References

- `src/primitives/parser.ts` - Parses single primitive strings into structured objects

## Notes

- Leading `$` is required
- Whitespace around `=` is allowed
- Commas separate multiple props
- Quotes optional for simple strings
