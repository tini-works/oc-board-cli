// src/primitives/migrate.test.ts
import { test, expect, describe } from 'bun:test'
import { migrateLayout, migrateScreenConfig } from './migrate'

describe('migrateLayout', () => {
  describe('ComponentRef', () => {
    test('migrates ComponentRef to string ref', () => {
      const result = migrateLayout({
        type: 'ComponentRef',
        ref: 'components/button',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('components/button')
    })

    test('warns about ComponentRef with props', () => {
      const result = migrateLayout({
        type: 'ComponentRef',
        ref: 'components/button',
        props: { disabled: true },
      })
      expect(result.success).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('props')
    })
  })

  describe('Slot', () => {
    test('migrates Slot to $slot primitive', () => {
      const result = migrateLayout({
        type: 'Slot',
        name: 'main',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$slot(main)')
    })

    test('extracts slot default content', () => {
      const result = migrateLayout({
        type: 'Slot',
        name: 'content',
        default: [
          {
            type: 'ComponentRef',
            ref: 'components/placeholder',
          },
        ],
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$slot(content)')
      expect(result.slots?.content?.default).toBe('components/placeholder')
    })
  })

  describe('Stack/VStack', () => {
    test('migrates Stack to $col', () => {
      const result = migrateLayout({
        type: 'Stack',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$col')
    })

    test('migrates VStack to $col', () => {
      const result = migrateLayout({
        type: 'VStack',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$col')
    })

    test('migrates Stack with gap', () => {
      const result = migrateLayout({
        type: 'Stack',
        gap: 'lg',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$col(gap:lg)')
    })

    test('migrates Stack with CSS gap value', () => {
      const result = migrateLayout({
        type: 'Stack',
        gap: '16px',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$col(gap:md)')
    })

    test('migrates Stack with children', () => {
      const result = migrateLayout({
        type: 'Stack',
        children: [
          { type: 'ComponentRef', ref: 'components/header' },
          { type: 'ComponentRef', ref: 'components/footer' },
        ],
      })
      expect(result.success).toBe(true)
      const root = result.template?.root
      expect(typeof root).toBe('object')
      if (typeof root === 'object' && root !== null && 'children' in root) {
        expect(Object.keys(root.children || {})).toHaveLength(2)
      }
    })
  })

  describe('HStack', () => {
    test('migrates HStack to $row', () => {
      const result = migrateLayout({
        type: 'HStack',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$row')
    })

    test('migrates HStack with gap and align', () => {
      const result = migrateLayout({
        type: 'HStack',
        gap: 'sm',
        align: 'center',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toContain('$row')
      expect(result.template?.root).toContain('gap:sm')
      expect(result.template?.root).toContain('align:center')
    })
  })

  describe('Box/Container', () => {
    test('migrates Box to $box', () => {
      const result = migrateLayout({
        type: 'Box',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$box')
    })

    test('migrates Container to $box', () => {
      const result = migrateLayout({
        type: 'Container',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$box')
    })

    test('migrates Box with padding', () => {
      const result = migrateLayout({
        type: 'Box',
        padding: 'lg',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$box(padding:lg)')
    })

    test('migrates Box with bg', () => {
      const result = migrateLayout({
        type: 'Box',
        bg: 'surface',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$box(bg:surface)')
    })

    test('migrates Box with radius', () => {
      const result = migrateLayout({
        type: 'Box',
        radius: 'md',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$box(radius:md)')
    })
  })

  describe('Spacer', () => {
    test('migrates Spacer without size', () => {
      const result = migrateLayout({
        type: 'Spacer',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$spacer')
    })

    test('migrates Spacer with token size', () => {
      const result = migrateLayout({
        type: 'Spacer',
        size: 'xl',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$spacer(xl)')
    })
  })

  describe('Text', () => {
    test('migrates Text with content', () => {
      const result = migrateLayout({
        type: 'Text',
        content: 'label',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$text(label)')
    })

    test('migrates Text with literal children', () => {
      const result = migrateLayout({
        type: 'Text',
        children: 'Hello World',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toBe('$text("Hello World")')
    })

    test('migrates Text with size and weight', () => {
      const result = migrateLayout({
        type: 'Text',
        content: 'title',
        size: 'lg',
        weight: 'bold',
      })
      expect(result.success).toBe(true)
      expect(result.template?.root).toContain('$text')
      expect(result.template?.root).toContain('size:lg')
      expect(result.template?.root).toContain('weight:bold')
    })
  })

  describe('multiple root nodes', () => {
    test('wraps multiple nodes in $col', () => {
      const result = migrateLayout([
        { type: 'ComponentRef', ref: 'components/header' },
        { type: 'ComponentRef', ref: 'components/footer' },
      ])
      expect(result.success).toBe(true)
      const root = result.template?.root
      expect(typeof root).toBe('object')
      if (typeof root === 'object' && root !== null && 'type' in root) {
        expect(root.type).toBe('$col')
      }
    })
  })

  describe('complex nested layout', () => {
    test('migrates complex layout', () => {
      const result = migrateLayout({
        type: 'Stack',
        gap: 'lg',
        children: [
          { type: 'ComponentRef', ref: 'components/header' },
          {
            type: 'HStack',
            gap: 'md',
            children: [
              { type: 'ComponentRef', ref: 'components/sidebar' },
              {
                type: 'Box',
                padding: 'lg',
                children: [{ type: 'Slot', name: 'main' }],
              },
            ],
          },
          { type: 'ComponentRef', ref: 'components/footer' },
        ],
      })
      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    test('rejects null layout', () => {
      const result = migrateLayout(null)
      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('must be an object')
    })

    test('rejects non-object layout', () => {
      const result = migrateLayout('invalid')
      expect(result.success).toBe(false)
    })

    test('warns about unknown node types', () => {
      const result = migrateLayout({
        type: 'CustomComponent',
      })
      expect(result.success).toBe(true) // Still succeeds with warning
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('Unknown node type')
    })
  })
})

describe('migrateScreenConfig', () => {
  test('migrates react layout by default', () => {
    const result = migrateScreenConfig({
      react: {
        type: 'ComponentRef',
        ref: 'components/home',
      },
      html: {
        type: 'ComponentRef',
        ref: 'components/home-html',
      },
    })
    expect(result.success).toBe(true)
    expect(result.template?.root).toBe('components/home')
  })

  test('falls back to first renderer if no react', () => {
    const result = migrateScreenConfig({
      svelte: {
        type: 'ComponentRef',
        ref: 'components/home-svelte',
      },
    })
    expect(result.success).toBe(true)
    expect(result.template?.root).toBe('components/home-svelte')
  })
})
