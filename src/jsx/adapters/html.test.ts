// src/jsx/adapters/html.test.ts
import { test, expect, describe, beforeEach } from 'bun:test'
import { resetIdCounter } from '../vnode'
import { Col, Row, Box, Spacer, Slot, Text, Icon, Image } from '../jsx-runtime'
import { renderToHtml, setTokensConfig } from './html'
import { resolveTokens } from '../../tokens/resolver'

// Get default tokens once at module load for test stability
const defaultTokens = resolveTokens({})

beforeEach(() => {
  resetIdCounter()
  // Explicitly set default tokens for test isolation
  setTokensConfig(defaultTokens)
})

describe('renderToHtml', () => {
  test('primitives, escaping, slots, nesting', () => {
    expect(renderToHtml(Col({ gap: 'lg' }))).toContain('gap-6')
    expect(renderToHtml(Row({ align: 'between' }))).toContain('justify-between')
    expect(renderToHtml(Box({ bg: 'muted' }))).toContain('bg-muted')
    expect(renderToHtml(Spacer())).toContain('flex-1')
    expect(renderToHtml(Text({ children: '<script>', weight: 'bold' }))).toContain('&lt;script&gt;')
    expect(renderToHtml(Icon({ name: 'star', color: 'primary' }))).toContain('text-primary')
    expect(renderToHtml(Image({ src: '"><x>', fit: 'cover' }))).toContain('&quot;&gt;')

    const html = renderToHtml(Slot({ name: 'x' }), { state: 'on', slots: { x: { on: Text({ children: 'On' }) } } })
    expect(html).toContain('On')

    expect(renderToHtml(Col({ children: [Text({ children: 'Hi' })] }))).toContain('data-node-id=')
  })
})

describe('HTML adapter token mapping', () => {
  beforeEach(() => {
    setTokensConfig(defaultTokens)
  })

  test('Box maps bg token to Tailwind class', () => {
    const node = {
      type: 'box' as const,
      id: 'test-1',
      props: { bg: 'primary' },
      children: []
    }
    const html = renderToHtml(node)
    expect(html).toContain('bg-primary')
  })

  test('Box maps padding token to Tailwind class', () => {
    const node = {
      type: 'box' as const,
      id: 'test-2',
      props: { padding: 'lg' },
      children: []
    }
    const html = renderToHtml(node)
    expect(html).toContain('p-6')
  })

  test('Text maps color token to Tailwind class', () => {
    const node = {
      type: 'text' as const,
      id: 'test-3',
      props: { content: 'hi', color: 'muted-foreground' },
      children: []
    }
    const html = renderToHtml(node)
    expect(html).toContain('text-muted-foreground')
  })

  test('Text maps size token to Tailwind class', () => {
    const node = {
      type: 'text' as const,
      id: 'test-4',
      props: { content: 'hi', size: 'lg' },
      children: []
    }
    const html = renderToHtml(node)
    expect(html).toContain('text-lg')
  })

  test('Text maps weight token to Tailwind class', () => {
    const node = {
      type: 'text' as const,
      id: 'test-5',
      props: { content: 'hi', weight: 'bold' },
      children: []
    }
    const html = renderToHtml(node)
    expect(html).toContain('font-bold')
  })

  test('Row maps gap token to Tailwind class', () => {
    const node = {
      type: 'row' as const,
      id: 'test-6',
      props: { gap: 'md' },
      children: []
    }
    const html = renderToHtml(node)
    expect(html).toContain('gap-4')
  })

  test('Box maps radius token to Tailwind class', () => {
    const node = {
      type: 'box' as const,
      id: 'test-7',
      props: { radius: 'lg' },
      children: []
    }
    const html = renderToHtml(node)
    expect(html).toContain('rounded-lg')
  })

  test('throws error for missing background token', () => {
    const incompleteTokens = {
      ...defaultTokens,
      backgrounds: { ...defaultTokens.backgrounds }
    }
    delete (incompleteTokens.backgrounds as Record<string, unknown>)['primary']

    setTokensConfig(incompleteTokens as any)

    const node = {
      type: 'box' as const,
      id: 'test-missing-bg',
      props: { bg: 'primary' },
      children: []
    }

    expect(() => renderToHtml(node)).toThrow(/Missing background token: "primary"/)
  })

  test('throws error for missing spacing token', () => {
    const incompleteTokens = {
      ...defaultTokens,
      spacing: { ...defaultTokens.spacing }
    }
    delete (incompleteTokens.spacing as Record<string, unknown>)['lg']

    setTokensConfig(incompleteTokens as any)

    const node = {
      type: 'col' as const,
      id: 'test-missing-spacing',
      props: { gap: 'lg' },
      children: []
    }

    expect(() => renderToHtml(node)).toThrow(/Missing spacing token: "lg"/)
  })

  test('throws error for missing color token', () => {
    const incompleteTokens = {
      ...defaultTokens,
      colors: { ...defaultTokens.colors }
    }
    delete (incompleteTokens.colors as Record<string, unknown>)['primary']

    setTokensConfig(incompleteTokens as any)

    const node = {
      type: 'text' as const,
      id: 'test-missing-color',
      props: { content: 'hi', color: 'primary' },
      children: []
    }

    expect(() => renderToHtml(node)).toThrow(/Missing color token: "primary"/)
  })

  test('throws error for missing radius token', () => {
    const incompleteTokens = {
      ...defaultTokens,
      radius: { ...defaultTokens.radius }
    }
    delete (incompleteTokens.radius as Record<string, unknown>)['lg']

    setTokensConfig(incompleteTokens as any)

    const node = {
      type: 'box' as const,
      id: 'test-missing-radius',
      props: { radius: 'lg' },
      children: []
    }

    expect(() => renderToHtml(node)).toThrow(/Missing radius token: "lg"/)
  })
})
