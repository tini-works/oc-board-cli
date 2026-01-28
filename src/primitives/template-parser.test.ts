// src/primitives/template-parser.test.ts
import { test, expect, describe } from 'bun:test'
import {
  validateTemplate,
  validateSlots,
  extractRefs,
  extractSlotNames,
} from './template-parser'

describe('validateTemplate', () => {
  test('validates simple template with string root', () => {
    const result = validateTemplate({
      root: 'components/header',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('validates template with primitive root', () => {
    const result = validateTemplate({
      root: '$col(gap:lg)',
    })
    expect(result.valid).toBe(true)
  })

  test('validates template with container and children', () => {
    const result = validateTemplate({
      root: {
        type: '$col(gap:lg)',
        children: {
          header: 'components/header',
          main: '$slot(main)',
          footer: 'components/footer',
        },
      },
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('validates nested containers', () => {
    const result = validateTemplate({
      root: {
        type: '$col',
        children: {
          card: {
            type: '$box(padding:lg)',
            children: {
              content: 'components/content',
            },
          },
        },
      },
    })
    expect(result.valid).toBe(true)
  })

  test('rejects template without root', () => {
    const result = validateTemplate({})
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('root')
  })

  test('rejects container without type', () => {
    const result = validateTemplate({
      root: {
        children: {
          header: 'components/header',
        },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('type')
  })

  test('rejects invalid primitive syntax', () => {
    const result = validateTemplate({
      root: '$col(gap:invalid)',
    })
    expect(result.valid).toBe(false)
  })

  test('rejects non-primitive type in container', () => {
    const result = validateTemplate({
      root: {
        type: 'NotAPrimitive',
        children: {},
      },
    })
    expect(result.valid).toBe(false)
  })

  test('rejects invalid ref format', () => {
    const result = validateTemplate({
      root: 'invalid/path/format',
    })
    expect(result.valid).toBe(false)
  })

  test('rejects non-layout primitive with children', () => {
    const result = validateTemplate({
      root: {
        type: '$text("hello")',
        children: {
          child: 'components/button',
        },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('cannot have children')
  })

  test('rejects $spacer with children', () => {
    const result = validateTemplate({
      root: {
        type: '$spacer',
        children: {
          child: 'components/button',
        },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('cannot have children')
  })

  test('rejects $image with children', () => {
    const result = validateTemplate({
      root: {
        type: '$image(src:url)',
        children: {
          child: 'components/button',
        },
      },
    })
    expect(result.valid).toBe(false)
  })
})

describe('validateSlots', () => {
  test('validates simple slots', () => {
    const result = validateSlots({
      main: {
        default: 'components/home',
        loading: 'components/spinner',
      },
    })
    expect(result.valid).toBe(true)
  })

  test('validates slots with defined states', () => {
    const result = validateSlots(
      {
        form: {
          default: 'components/login-form',
          error: 'components/error-form',
        },
      },
      ['default', 'error', 'success']
    )
    expect(result.valid).toBe(true)
  })

  test('rejects slots referencing undefined states', () => {
    const result = validateSlots(
      {
        form: {
          default: 'components/form',
          nonexistent: 'components/other',
        },
      },
      ['default', 'error']
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('nonexistent')
  })

  test('rejects non-string slot content', () => {
    const result = validateSlots({
      main: {
        default: { invalid: 'object' },
      },
    })
    expect(result.valid).toBe(false)
  })

  test('accepts primitive as slot content', () => {
    const result = validateSlots({
      main: {
        loading: '$text("Loading...")',
      },
    })
    expect(result.valid).toBe(true)
  })

  test('rejects URL as slot content', () => {
    const result = validateSlots({
      main: {
        default: 'https://example.com/image.jpg',
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('Invalid ref format')
  })

  test('rejects invalid ref pattern in slot', () => {
    const result = validateSlots({
      main: {
        default: 'random/path/with/many/parts',
      },
    })
    expect(result.valid).toBe(false)
  })
})

describe('extractRefs', () => {
  test('extracts refs from template', () => {
    const refs = extractRefs({
      root: {
        type: '$col',
        children: {
          header: 'components/header',
          main: 'screens/main',
          footer: 'components/footer',
        },
      },
    })
    expect(refs).toContain('components/header')
    expect(refs).toContain('screens/main')
    expect(refs).toContain('components/footer')
  })

  test('ignores primitives', () => {
    const refs = extractRefs({
      root: {
        type: '$col',
        children: {
          spacer: '$spacer(xl)',
          slot: '$slot(main)',
        },
      },
    })
    expect(refs).toHaveLength(0)
  })

  test('deduplicates refs', () => {
    const refs = extractRefs({
      root: {
        type: '$col',
        children: {
          header1: 'components/header',
          header2: 'components/header',
        },
      },
    })
    expect(refs).toHaveLength(1)
  })
})

describe('extractSlotNames', () => {
  test('extracts slot names from template', () => {
    const slots = extractSlotNames({
      root: {
        type: '$col',
        children: {
          header: 'components/header',
          main: '$slot(main)',
          sidebar: '$slot(sidebar)',
        },
      },
    })
    expect(slots).toContain('main')
    expect(slots).toContain('sidebar')
    expect(slots).toHaveLength(2)
  })

  test('extracts slot from container type', () => {
    const slots = extractSlotNames({
      root: {
        type: '$slot(content)',
      },
    })
    expect(slots).toContain('content')
  })

  test('deduplicates slot names', () => {
    const slots = extractSlotNames({
      root: {
        type: '$col',
        children: {
          slot1: '$slot(main)',
          slot2: '$slot(main)',
        },
      },
    })
    expect(slots).toHaveLength(1)
  })
})
