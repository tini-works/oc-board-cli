// src/jsx/adapters/react.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { toReact, setTokensConfig } from './react'
import { resolveTokens } from '../../tokens/resolver'

// Get default tokens once at module load for test stability
const defaultTokens = resolveTokens({})

describe('React adapter token resolution', () => {
  beforeEach(() => {
    // Explicitly set default tokens for test isolation
    // This avoids relying on filesystem state during tests
    setTokensConfig(defaultTokens)
  })

  test('Box resolves bg token to background value', () => {
    const node = {
      type: 'box' as const,
      id: 'test-1',
      props: { bg: 'primary' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.background).toBe('#2563eb')
  })

  test('Box resolves padding token to spacing value', () => {
    const node = {
      type: 'box' as const,
      id: 'test-2',
      props: { padding: 'lg' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.padding).toBe('24px')
  })

  test('Text resolves color token', () => {
    const node = {
      type: 'text' as const,
      id: 'test-3',
      props: { content: 'hi', color: 'muted-foreground' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.color).toBe('#64748b')
  })

  test('Text resolves size token', () => {
    const node = {
      type: 'text' as const,
      id: 'test-4',
      props: { content: 'hi', size: 'lg' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.fontSize).toBe('18px')
  })

  test('Text resolves weight token', () => {
    const node = {
      type: 'text' as const,
      id: 'test-5',
      props: { content: 'hi', weight: 'bold' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.fontWeight).toBe(700)
  })

  test('Box resolves radius token', () => {
    const node = {
      type: 'box' as const,
      id: 'test-6',
      props: { radius: 'lg' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.borderRadius).toBe('8px')
  })

  test('Row resolves gap token', () => {
    const node = {
      type: 'row' as const,
      id: 'test-7',
      props: { gap: 'md' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.gap).toBe('16px')
  })

  test('uses custom tokens when set via setTokensConfig', () => {
    // Import TokensConfig type
    const customTokens = {
      colors: {
        foreground: '#000',
        'card-foreground': '#000',
        'popover-foreground': '#000',
        primary: '#ff0000',  // Custom red
        'primary-foreground': '#fff',
        secondary: '#64748b',
        'secondary-foreground': '#000',
        muted: '#94a3b8',
        'muted-foreground': '#64748b',
        accent: '#2563eb',
        'accent-foreground': '#fff',
        destructive: '#ef4444',
        'destructive-foreground': '#fff',
        border: '#e2e8f0',
        ring: '#2563eb',
      },
      backgrounds: {
        transparent: 'transparent',
        background: '#fff',
        card: '#fff',
        popover: '#fff',
        primary: '#ff0000',  // Custom red
        secondary: '#f1f5f9',
        muted: '#f1f5f9',
        accent: '#f1f5f9',
        destructive: '#ef4444',
        input: '#fff',
      },
      spacing: {
        none: '0',
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
      typography: {
        sizes: { xs: '12px', sm: '14px', base: '16px', lg: '18px', xl: '20px', '2xl': '24px' },
        weights: { normal: 400, medium: 500, semibold: 600, bold: 700 },
      },
      radius: { none: '0', sm: '4px', md: '6px', lg: '8px', xl: '12px', full: '9999px' },
      shadows: { none: 'none', sm: '0 1px 2px', md: '0 4px 6px', lg: '0 10px 15px', xl: '0 20px 25px' },
    }

    setTokensConfig(customTokens)

    const node = {
      type: 'box' as const,
      id: 'test-8',
      props: { bg: 'primary' },
      children: []
    }
    const element = toReact(node) as React.ReactElement
    expect(element.props.style.background).toBe('#ff0000')  // Custom red
  })

  test('throws error for missing token in custom config', () => {
    const incompleteTokens = {
      ...defaultTokens,
      spacing: { ...defaultTokens.spacing }
    }
    delete (incompleteTokens.spacing as Record<string, unknown>)['lg']  // Remove lg

    setTokensConfig(incompleteTokens as any)

    const node = {
      type: 'box' as const,
      id: 'test-missing',
      props: { padding: 'lg' },
      children: []
    }

    expect(() => toReact(node)).toThrow(/Missing spacing token: "lg"/)
  })
})
