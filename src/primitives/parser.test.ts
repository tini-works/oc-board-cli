// src/primitives/parser.test.ts
import { test, expect, describe } from 'bun:test'
import {
  parsePrimitive,
  getPrimitiveType,
  isValidPrimitiveSyntax,
  isQuoted,
} from './parser'

describe('parsePrimitive', () => {
  describe('layout primitives', () => {
    test('parses $col without props', () => {
      const result = parsePrimitive('$col')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$col')
      }
    })

    test('parses $col with gap', () => {
      const result = parsePrimitive('$col(gap:lg)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$col')
        expect(result.primitive).toHaveProperty('gap', 'lg')
      }
    })

    test('parses $col with multiple props', () => {
      const result = parsePrimitive('$col(gap:lg align:center padding:md)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$col')
        expect(result.primitive).toMatchObject({
          type: '$col',
          gap: 'lg',
          align: 'center',
          padding: 'md',
        })
      }
    })

    test('parses $row', () => {
      const result = parsePrimitive('$row(gap:sm)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$row')
        expect(result.primitive).toHaveProperty('gap', 'sm')
      }
    })

    test('parses $box with styling props', () => {
      const result = parsePrimitive('$box(padding:lg bg:background radius:md)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$box')
        expect(result.primitive).toMatchObject({
          padding: 'lg',
          bg: 'background',
          radius: 'md',
        })
      }
    })

    test('parses $spacer without size (flex)', () => {
      const result = parsePrimitive('$spacer')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$spacer')
        expect(result.primitive).not.toHaveProperty('size')
      }
    })

    test('parses $spacer with positional size', () => {
      const result = parsePrimitive('$spacer(xl)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$spacer')
        expect(result.primitive).toHaveProperty('size', 'xl')
      }
    })

    test('parses $slot with name', () => {
      const result = parsePrimitive('$slot(main)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$slot')
        expect(result.primitive).toHaveProperty('name', 'main')
      }
    })
  })

  describe('content primitives', () => {
    test('parses $text with prop reference', () => {
      const result = parsePrimitive('$text(label)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$text')
        expect(result.primitive).toHaveProperty('content', 'label')
      }
    })

    test('parses $text with quoted literal', () => {
      const result = parsePrimitive('$text("Hello World")')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$text')
        expect(result.primitive).toHaveProperty('content', '"Hello World"')
      }
    })

    test('parses $text with colon in quoted literal', () => {
      const result = parsePrimitive('$text("Hello: world")')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$text')
        expect(result.primitive).toHaveProperty('content', '"Hello: world"')
      }
    })

    test('parses $text with styling props', () => {
      const result = parsePrimitive('$text(label size:lg weight:bold color:primary)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$text')
        expect(result.primitive).toMatchObject({
          content: 'label',
          size: 'lg',
          weight: 'bold',
          color: 'primary',
        })
      }
    })

    test('parses $icon with name', () => {
      const result = parsePrimitive('$icon(name:check)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$icon')
        expect(result.primitive).toHaveProperty('name', 'check')
      }
    })

    test('parses $icon with positional name', () => {
      const result = parsePrimitive('$icon(iconProp)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$icon')
        expect(result.primitive).toHaveProperty('name', 'iconProp')
      }
    })

    test('parses $image with src', () => {
      const result = parsePrimitive('$image(src:avatarUrl)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$image')
        expect(result.primitive).toHaveProperty('src', 'avatarUrl')
      }
    })

    test('parses $image with all props', () => {
      const result = parsePrimitive('$image(src:url alt:"User" fit:cover)')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.primitive.type).toBe('$image')
        expect(result.primitive).toMatchObject({
          src: 'url',
          alt: 'User',
          fit: 'cover',
        })
      }
    })
  })

  describe('error cases', () => {
    test('rejects non-$ prefix', () => {
      const result = parsePrimitive('col')
      expect(result.success).toBe(false)
    })

    test('rejects unknown primitive', () => {
      const result = parsePrimitive('$unknown')
      expect(result.success).toBe(false)
    })

    test('rejects invalid token value', () => {
      const result = parsePrimitive('$col(gap:invalid)')
      expect(result.success).toBe(false)
    })

    test('rejects $slot without name', () => {
      const result = parsePrimitive('$slot')
      expect(result.success).toBe(false)
    })

    test('rejects $text without content', () => {
      const result = parsePrimitive('$text')
      expect(result.success).toBe(false)
    })

    test('rejects $icon without name', () => {
      const result = parsePrimitive('$icon')
      expect(result.success).toBe(false)
    })

    test('rejects $image without src', () => {
      const result = parsePrimitive('$image')
      expect(result.success).toBe(false)
    })
  })
})

describe('getPrimitiveType', () => {
  test('extracts type from simple primitive', () => {
    expect(getPrimitiveType('$col')).toBe('$col')
  })

  test('extracts type from primitive with props', () => {
    expect(getPrimitiveType('$row(gap:lg)')).toBe('$row')
  })

  test('returns null for non-primitive', () => {
    expect(getPrimitiveType('components/button')).toBe(null)
  })

  test('returns null for unknown primitive', () => {
    expect(getPrimitiveType('$unknown')).toBe(null)
  })
})

describe('isValidPrimitiveSyntax', () => {
  test('returns true for valid primitives', () => {
    expect(isValidPrimitiveSyntax('$col')).toBe(true)
    expect(isValidPrimitiveSyntax('$row(gap:lg)')).toBe(true)
    expect(isValidPrimitiveSyntax('$text(label)')).toBe(true)
  })

  test('returns false for invalid primitives', () => {
    expect(isValidPrimitiveSyntax('col')).toBe(false)
    expect(isValidPrimitiveSyntax('$unknown')).toBe(false)
    expect(isValidPrimitiveSyntax('$col(gap:invalid)')).toBe(false)
  })
})

describe('isQuoted', () => {
  test('returns true for double-quoted strings', () => {
    expect(isQuoted('"hello"')).toBe(true)
    expect(isQuoted('"Hello World"')).toBe(true)
  })

  test('returns true for single-quoted strings', () => {
    expect(isQuoted("'hello'")).toBe(true)
  })

  test('returns false for unquoted strings', () => {
    expect(isQuoted('hello')).toBe(false)
    expect(isQuoted('label')).toBe(false)
  })

  test('returns false for partially quoted strings', () => {
    expect(isQuoted('"hello')).toBe(false)
    expect(isQuoted('hello"')).toBe(false)
  })
})
