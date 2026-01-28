// src/primitives/template-renderer.test.ts
import { test, expect, describe } from 'bun:test'
import { renderTemplate, generateTokenCSS } from './template-renderer'
import type { Template, Slots } from './types'

describe('renderTemplate', () => {
  describe('layout primitives', () => {
    test('renders $col without props', () => {
      const template: Template = { root: '$col' }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$col"')
      expect(html).toContain('class="flex flex-col"')
    })

    test('renders $col with gap', () => {
      const template: Template = { root: '$col(gap:lg)' }
      const html = renderTemplate(template)
      expect(html).toContain('gap-6')
    })

    test('renders $col with align', () => {
      const template: Template = { root: '$col(align:center)' }
      const html = renderTemplate(template)
      expect(html).toContain('items-center')
    })

    test('renders $col with padding', () => {
      const template: Template = { root: '$col(padding:md)' }
      const html = renderTemplate(template)
      expect(html).toContain('p-4')
    })

    test('renders $col with align:between using justify-between', () => {
      const template: Template = { root: '$col(align:between)' }
      const html = renderTemplate(template)
      expect(html).toContain('justify-between')
    })

    test('renders $row without props', () => {
      const template: Template = { root: '$row' }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$row"')
      expect(html).toContain('flex flex-row')
    })

    test('renders $row with multiple props', () => {
      const template: Template = { root: '$row(gap:sm align:between)' }
      const html = renderTemplate(template)
      expect(html).toContain('gap-2')
      expect(html).toContain('justify-between')
    })

    test('renders $row with default align:center', () => {
      const template: Template = { root: '$row' }
      const html = renderTemplate(template)
      expect(html).toContain('items-center')
    })

    test('renders $box without props', () => {
      const template: Template = { root: '$box' }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$box"')
    })

    test('renders $box with padding', () => {
      const template: Template = { root: '$box(padding:lg)' }
      const html = renderTemplate(template)
      expect(html).toContain('p-6')
    })

    test('renders $box with bg', () => {
      const template: Template = { root: '$box(bg:background)' }
      const html = renderTemplate(template)
      expect(html).toContain('bg-background')
    })

    test('renders $box with radius', () => {
      const template: Template = { root: '$box(radius:md)' }
      const html = renderTemplate(template)
      expect(html).toContain('rounded-md')
    })
  })

  describe('$spacer', () => {
    test('renders flex spacer without size', () => {
      const template: Template = { root: '$spacer' }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$spacer"')
      expect(html).toContain('flex-1')
    })

    test('renders fixed spacer with size', () => {
      const template: Template = { root: '$spacer(xl)' }
      const html = renderTemplate(template)
      expect(html).toContain('w-8')
      expect(html).toContain('h-8')
      expect(html).toContain('shrink-0')
    })
  })

  describe('$slot', () => {
    test('renders empty slot placeholder', () => {
      const template: Template = { root: '$slot(main)' }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$slot"')
      expect(html).toContain('data-slot-name="main"')
      expect(html).toContain('<!-- slot: main -->')
    })

    test('resolves slot with default state', () => {
      const template: Template = { root: '$slot(content)' }
      const slots: Slots = {
        content: {
          default: 'components/home',
        },
      }
      const html = renderTemplate(template, { slots })
      expect(html).toContain('data-ref="components/home"')
    })

    test('resolves slot with specific state', () => {
      const template: Template = { root: '$slot(content)' }
      const slots: Slots = {
        content: {
          default: 'components/home',
          loading: 'components/spinner',
        },
      }
      const html = renderTemplate(template, { state: 'loading', slots })
      expect(html).toContain('data-ref="components/spinner"')
    })

    test('falls back to default state', () => {
      const template: Template = { root: '$slot(content)' }
      const slots: Slots = {
        content: {
          default: 'components/fallback',
        },
      }
      const html = renderTemplate(template, { state: 'unknown', slots })
      expect(html).toContain('data-ref="components/fallback"')
    })
  })

  describe('$text', () => {
    test('renders text with quoted literal', () => {
      const template: Template = { root: '$text("Hello World")' }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$text"')
      expect(html).toContain('Hello World')
      expect(html).not.toContain('"Hello World"')
    })

    test('renders text with prop reference', () => {
      const template: Template = { root: '$text(label)' }
      const html = renderTemplate(template, { props: { label: 'My Label' } })
      expect(html).toContain('My Label')
    })

    test('renders prop reference as literal if not found', () => {
      const template: Template = { root: '$text(label)' }
      const html = renderTemplate(template)
      expect(html).toContain('label')
    })

    test('renders text with size', () => {
      const template: Template = { root: '$text(label size:lg)' }
      const html = renderTemplate(template)
      expect(html).toContain('text-lg')
    })

    test('renders text with weight', () => {
      const template: Template = { root: '$text(label weight:bold)' }
      const html = renderTemplate(template)
      expect(html).toContain('font-bold')
    })

    test('renders text with color', () => {
      const template: Template = { root: '$text(label color:primary)' }
      const html = renderTemplate(template)
      expect(html).toContain('text-primary')
    })

    test('escapes HTML in text', () => {
      const template: Template = { root: '$text(htmlContent)' }
      const html = renderTemplate(template, { props: { htmlContent: '<b>test</b>' } })
      expect(html).toContain('&lt;b&gt;test&lt;/b&gt;')
      expect(html).not.toContain('<b>test</b>')
    })

    test('handles colon in quoted literal', () => {
      const template: Template = { root: '$text("Hello: world")' }
      const html = renderTemplate(template)
      expect(html).toContain('Hello: world')
    })
  })

  describe('$icon', () => {
    test('renders icon with name', () => {
      const template: Template = { root: '$icon(check)' }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$icon"')
      expect(html).toContain('data-icon="check"')
    })

    test('renders icon with size', () => {
      const template: Template = { root: '$icon(arrow size:lg)' }
      const html = renderTemplate(template)
      expect(html).toContain('w-6')
      expect(html).toContain('h-6')
    })

    test('renders icon with color', () => {
      const template: Template = { root: '$icon(warning color:destructive)' }
      const html = renderTemplate(template)
      expect(html).toContain('text-destructive')
    })

    test('resolves icon name from props', () => {
      const template: Template = { root: '$icon(iconProp)' }
      const html = renderTemplate(template, { props: { iconProp: 'star' } })
      expect(html).toContain('data-icon="star"')
    })

    test('handles quoted literal icon name', () => {
      const template: Template = { root: '$icon("check-circle")' }
      const html = renderTemplate(template)
      expect(html).toContain('data-icon="check-circle"')
      // Should not have escaped quotes from the literal
      expect(html).not.toContain('&quot;check-circle&quot;')
    })
  })

  describe('$image', () => {
    test('renders image with src', () => {
      const template: Template = { root: '$image(src:imageUrl)' }
      const html = renderTemplate(template, { props: { imageUrl: 'https://example.com/pic.jpg' } })
      expect(html).toContain('data-primitive="$image"')
      expect(html).toContain('src="https://example.com/pic.jpg"')
    })

    test('renders image with alt', () => {
      const template: Template = { root: '$image(src:url alt:"User Avatar")' }
      const html = renderTemplate(template)
      expect(html).toContain('alt="User Avatar"')
    })

    test('renders image with fit', () => {
      const template: Template = { root: '$image(src:url fit:cover)' }
      const html = renderTemplate(template)
      expect(html).toContain('object-cover')
    })

    test('escapes src in image', () => {
      const template: Template = { root: '$image(src:url)' }
      const html = renderTemplate(template, { props: { url: 'test"><script>' } })
      expect(html).toContain('&quot;&gt;&lt;script&gt;')
    })

    test('handles quoted literal src', () => {
      const template: Template = { root: '$image(src:"https://example.com/pic.jpg")' }
      const html = renderTemplate(template)
      expect(html).toContain('src="https://example.com/pic.jpg"')
    })
  })

  describe('container nodes', () => {
    test('renders container with children', () => {
      const template: Template = {
        root: {
          type: '$col(gap:lg)',
          children: {
            header: 'components/header',
            main: '$slot(main)',
            footer: 'components/footer',
          },
        },
      }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$col"')
      expect(html).toContain('data-ref="components/header"')
      expect(html).toContain('data-slot-name="main"')
      expect(html).toContain('data-ref="components/footer"')
    })

    test('renders nested containers', () => {
      const template: Template = {
        root: {
          type: '$col',
          children: {
            card: {
              type: '$box(padding:lg bg:background)',
              children: {
                content: '$text("Card content")',
              },
            },
          },
        },
      }
      const html = renderTemplate(template)
      expect(html).toContain('data-primitive="$col"')
      expect(html).toContain('data-primitive="$box"')
      expect(html).toContain('p-6')
      expect(html).toContain('Card content')
    })
  })

  describe('component refs', () => {
    test('renders default ref placeholder', () => {
      const template: Template = { root: 'components/button' }
      const html = renderTemplate(template)
      expect(html).toContain('data-ref="components/button"')
      expect(html).toContain('<!-- components/button -->')
    })

    test('uses custom renderRef callback', () => {
      const template: Template = { root: 'screens/login' }
      const html = renderTemplate(template, {
        renderRef: (ref) => `<custom-component ref="${ref}"></custom-component>`,
      })
      expect(html).toContain('<custom-component ref="screens/login"></custom-component>')
    })
  })

  describe('error handling', () => {
    test('handles invalid primitive', () => {
      const template: Template = { root: '$invalid' }
      const html = renderTemplate(template)
      expect(html).toContain('<!-- invalid primitive:')
    })

    test('handles invalid container type', () => {
      const template: Template = {
        root: {
          type: '$unknown',
          children: {},
        },
      }
      const html = renderTemplate(template)
      expect(html).toContain('<!-- invalid primitive:')
    })
  })
})

describe('generateTokenCSS', () => {
  test('generates shadcn-compatible CSS custom properties', () => {
    const css = generateTokenCSS()
    expect(css).toContain('@tailwind base')
    expect(css).toContain(':root {')
    expect(css).toContain('--background:')
    expect(css).toContain('--foreground:')
    expect(css).toContain('--primary:')
    expect(css).toContain('--muted:')
    expect(css).toContain('--muted-foreground:')
    expect(css).toContain('--destructive:')
    expect(css).toContain('--border:')
    expect(css).toContain('.dark {')
  })
})
