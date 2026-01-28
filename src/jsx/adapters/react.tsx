// src/jsx/adapters/react.tsx
// React adapter - renders VNode tree to React elements
import React from 'react'
import type { VNodeType } from '../vnode'
import type {
  SpacingToken,
  AlignToken,
  BackgroundToken,
  RadiusToken,
  ColorToken,
  SizeToken,
  WeightToken,
  FitToken,
} from '../schemas/tokens'
// TokensConfig type - must match resolver.ts
// Duplicated here to avoid importing Node.js-only resolver in browser
export interface TokensConfig {
  colors: Record<string, string>
  backgrounds: Record<string, string>
  spacing: Record<string, string>
  typography: {
    sizes: Record<string, string>
    weights: Record<string, number>
  }
  radius: Record<string, string>
  shadows: Record<string, string>
}

// ============================================================
// Token resolution with caching
// ============================================================

// Cached tokens - must be set via setTokensConfig() before rendering
let cachedTokens: TokensConfig | null = null

// Get cached tokens - throws if not initialized
// In browser: setTokensConfig() must be called first
// In Node.js tests: setTokensConfig() with resolved tokens
function getTokens(): TokensConfig {
  if (!cachedTokens) {
    throw new Error(
      'Tokens not initialized. Call setTokensConfig(tokens) before rendering. ' +
      'In browser preview, this should be done automatically by the preview runtime.'
    )
  }
  return cachedTokens
}

// Allow setting custom tokens (for testing and runtime override)
export function setTokensConfig(tokens: TokensConfig | undefined): void {
  cachedTokens = tokens || null
}

// Helper functions to get token values - throw on missing tokens to surface config bugs early
function getSpacing(token: SpacingToken): string {
  const value = getTokens().spacing[token]
  if (value === undefined) {
    throw new Error(`Missing spacing token: "${token}". Check your tokens.yaml configuration.`)
  }
  return value
}

function getBackground(token: BackgroundToken): string {
  const value = getTokens().backgrounds[token]
  if (value === undefined) {
    throw new Error(`Missing background token: "${token}". Check your tokens.yaml configuration.`)
  }
  return value
}

function getRadius(token: RadiusToken): string {
  const value = getTokens().radius[token]
  if (value === undefined) {
    throw new Error(`Missing radius token: "${token}". Check your tokens.yaml configuration.`)
  }
  return value
}

function getColor(token: ColorToken): string {
  const value = getTokens().colors[token]
  if (value === undefined) {
    throw new Error(`Missing color token: "${token}". Check your tokens.yaml configuration.`)
  }
  return value
}

function getTypographySize(token: SizeToken): string {
  const value = getTokens().typography.sizes[token]
  if (value === undefined) {
    throw new Error(`Missing typography.sizes token: "${token}". Check your tokens.yaml configuration.`)
  }
  return value
}

function getTypographyWeight(token: WeightToken): number {
  const value = getTokens().typography.weights[token]
  if (value === undefined) {
    throw new Error(`Missing typography.weights token: "${token}". Check your tokens.yaml configuration.`)
  }
  return value
}

// ============================================================
// Non-token style mappings (CSS values, not design tokens)
// ============================================================

const ALIGN_VALUES: Record<AlignToken, React.CSSProperties> = {
  start: { alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  end: { alignItems: 'flex-end' },
  stretch: { alignItems: 'stretch' },
  between: { justifyContent: 'space-between' },
}

const ICON_SIZE_VALUES: Record<SizeToken, string> = {
  xs: '12px',
  sm: '16px',
  base: '20px',
  lg: '24px',
  xl: '28px',
  '2xl': '32px',
}

const FIT_VALUES: Record<FitToken, React.CSSProperties['objectFit']> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'fill',
}

// ============================================================
// Render context
// ============================================================

export interface ReactRenderContext {
  /** Current state for slot resolution */
  state?: string
  /** Slots mapping: slotName -> stateName -> VNode */
  slots?: Record<string, Record<string, VNodeType>>
  /** Callback to render component nodes */
  renderComponent?: (name: string, props: Record<string, unknown>, children?: React.ReactNode) => React.ReactNode
}

// ============================================================
// Main render function
// ============================================================

/**
 * Render a VNode tree to React elements
 */
export function toReact(node: VNodeType | VNodeType[], context: ReactRenderContext = {}): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map((n, i) => <React.Fragment key={n.id || i}>{renderNode(n, context)}</React.Fragment>)
  }
  return renderNode(node, context)
}

function renderNode(node: VNodeType, context: ReactRenderContext): React.ReactNode {
  switch (node.type) {
    case 'col':
      return renderCol(node, context)
    case 'row':
      return renderRow(node, context)
    case 'box':
      return renderBox(node, context)
    case 'spacer':
      return renderSpacer(node)
    case 'slot':
      return renderSlot(node, context)
    case 'text':
      return renderText(node)
    case 'icon':
      return renderIcon(node)
    case 'image':
      return renderImage(node)
    case 'component':
      return renderComponent(node, context)
    default:
      return null
  }
}

function renderChildren(children: VNodeType[] | undefined, context: ReactRenderContext): React.ReactNode {
  if (!children || children.length === 0) return null
  return children.map((child) => (
    <React.Fragment key={child.id}>{renderNode(child, context)}</React.Fragment>
  ))
}

// ============================================================
// Primitive renderers
// ============================================================

function renderCol(node: VNodeType, context: ReactRenderContext): React.ReactNode {
  const { gap, align, padding } = node.props as { gap?: SpacingToken; align?: AlignToken; padding?: SpacingToken }

  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    ...(gap && { gap: getSpacing(gap) }),
    ...(align && ALIGN_VALUES[align]),
    ...(padding && { padding: getSpacing(padding) }),
  }

  return (
    <div data-primitive="col" data-node-id={node.id} style={style}>
      {renderChildren(node.children, context)}
    </div>
  )
}

function renderRow(node: VNodeType, context: ReactRenderContext): React.ReactNode {
  const { gap, align, padding } = node.props as { gap?: SpacingToken; align?: AlignToken; padding?: SpacingToken }

  const style: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center', // Row defaults to center
    ...(gap && { gap: getSpacing(gap) }),
    ...(align && ALIGN_VALUES[align]),
    ...(padding && { padding: getSpacing(padding) }),
  }

  return (
    <div data-primitive="row" data-node-id={node.id} style={style}>
      {renderChildren(node.children, context)}
    </div>
  )
}

function renderBox(node: VNodeType, context: ReactRenderContext): React.ReactNode {
  const { padding, bg, radius } = node.props as { padding?: SpacingToken; bg?: BackgroundToken; radius?: RadiusToken }

  const style: React.CSSProperties = {
    ...(padding && { padding: getSpacing(padding) }),
    ...(bg && { background: getBackground(bg) }),
    ...(radius && { borderRadius: getRadius(radius) }),
  }

  return (
    <div data-primitive="box" data-node-id={node.id} style={style}>
      {renderChildren(node.children, context)}
    </div>
  )
}

function renderSpacer(node: VNodeType): React.ReactNode {
  const { size } = node.props as { size?: SpacingToken }

  const style: React.CSSProperties = size
    ? { width: getSpacing(size), height: getSpacing(size), flexShrink: 0 }
    : { flex: 1 }

  return <div data-primitive="spacer" data-node-id={node.id} style={style} />
}

function renderSlot(node: VNodeType, context: ReactRenderContext): React.ReactNode {
  const { name } = node.props as { name: string }
  const state = context.state || 'default'

  if (context.slots && context.slots[name]) {
    const stateMapping = context.slots[name]
    const content = stateMapping[state] || stateMapping.default

    if (content) {
      return renderNode(content, context)
    }
  }

  return <div data-primitive="slot" data-slot-name={name} data-node-id={node.id} />
}

function renderText(node: VNodeType): React.ReactNode {
  const { content, size, weight, color } = node.props as {
    content?: string
    size?: SizeToken
    weight?: WeightToken
    color?: ColorToken
  }

  const style: React.CSSProperties = {
    ...(size && { fontSize: getTypographySize(size) }),
    ...(weight && { fontWeight: getTypographyWeight(weight) }),
    ...(color && { color: getColor(color) }),
  }

  return (
    <span data-primitive="text" data-node-id={node.id} style={style}>
      {content || ''}
    </span>
  )
}

function renderIcon(node: VNodeType): React.ReactNode {
  const { name, size, color } = node.props as { name: string; size?: SizeToken; color?: ColorToken }

  const iconSize = size ? ICON_SIZE_VALUES[size] : ICON_SIZE_VALUES.base

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: iconSize,
    height: iconSize,
    ...(color && { color: getColor(color) }),
  }

  // Placeholder for icon - in real implementation, would use icon library
  return (
    <span data-primitive="icon" data-icon={name} data-node-id={node.id} style={style}>
      {/* Icon placeholder */}
    </span>
  )
}

function renderImage(node: VNodeType): React.ReactNode {
  const { src, alt, fit } = node.props as { src: string; alt?: string; fit?: FitToken }

  const style: React.CSSProperties = {
    maxWidth: '100%',
    ...(fit && { objectFit: FIT_VALUES[fit] }),
  }

  return (
    <img
      data-primitive="image"
      data-node-id={node.id}
      src={src}
      alt={alt || ''}
      style={style}
    />
  )
}

function renderComponent(node: VNodeType, context: ReactRenderContext): React.ReactNode {
  const componentName = node.componentName || 'Unknown'

  if (context.renderComponent) {
    return context.renderComponent(componentName, node.props, renderChildren(node.children, context))
  }

  return (
    <div data-component={componentName} data-node-id={node.id}>
      {renderChildren(node.children, context)}
    </div>
  )
}
