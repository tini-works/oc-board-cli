// src/jsx/adapters/html.ts
// HTML adapter - renders VNode tree to HTML with Tailwind classes
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
import { resolveTokens, type TokensConfig } from '../../tokens/resolver'

// ============================================================
// Token resolution with caching for validation
// ============================================================

// Cached tokens - resolved once and reused
let cachedTokens: TokensConfig | null = null

// NOTE: getTokens() is called multiple times throughout the rendering process.
// This is acceptable because:
// - The first call caches the tokens in cachedTokens
// - Subsequent calls just check `if (!cachedTokens)` which is O(1)
// - For a CLI preview tool, this micro-optimization is not worth the complexity
//   of threading tokens through every function
function getTokens(): TokensConfig {
  if (!cachedTokens) {
    cachedTokens = resolveTokens({})
  }
  return cachedTokens
}

// Allow setting custom tokens (for testing and runtime override)
export function setTokensConfig(tokens: TokensConfig | undefined): void {
  cachedTokens = tokens || null
}

// Validation helpers - check token exists, then let Tailwind handle the actual value
function validateSpacing(token: SpacingToken): void {
  if (getTokens().spacing[token] === undefined) {
    throw new Error(`Missing spacing token: "${token}". Check your tokens.yaml configuration.`)
  }
}

function validateBackground(token: BackgroundToken): void {
  if (getTokens().backgrounds[token] === undefined) {
    throw new Error(`Missing background token: "${token}". Check your tokens.yaml configuration.`)
  }
}

function validateRadius(token: RadiusToken): void {
  if (getTokens().radius[token] === undefined) {
    throw new Error(`Missing radius token: "${token}". Check your tokens.yaml configuration.`)
  }
}

function validateColor(token: ColorToken): void {
  if (getTokens().colors[token] === undefined) {
    throw new Error(`Missing color token: "${token}". Check your tokens.yaml configuration.`)
  }
}

function validateTypographySize(token: SizeToken): void {
  if (getTokens().typography.sizes[token] === undefined) {
    throw new Error(`Missing typography.sizes token: "${token}". Check your tokens.yaml configuration.`)
  }
}

function validateTypographyWeight(token: WeightToken): void {
  if (getTokens().typography.weights[token] === undefined) {
    throw new Error(`Missing typography.weights token: "${token}". Check your tokens.yaml configuration.`)
  }
}

// ============================================================
// Token to Tailwind class mappings (shadcn-compatible)
// ============================================================

const SPACING_GAP: Record<SpacingToken, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
  '2xl': 'gap-12',
}

const SPACING_PADDING: Record<SpacingToken, string> = {
  none: 'p-0',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
  '2xl': 'p-12',
}

const SPACING_SIZE: Record<SpacingToken, string> = {
  none: 'w-0 h-0',
  xs: 'w-1 h-1',
  sm: 'w-2 h-2',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
  '2xl': 'w-12 h-12',
}

const ALIGN_ITEMS: Record<AlignToken, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  between: 'justify-between',
}

const BG_CLASS: Record<BackgroundToken, string> = {
  transparent: 'bg-transparent',
  background: 'bg-background',
  card: 'bg-card',
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  muted: 'bg-muted',
  accent: 'bg-accent',
  destructive: 'bg-destructive',
  input: 'bg-input',
}

const RADIUS_CLASS: Record<RadiusToken, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
}

const COLOR_CLASS: Record<ColorToken, string> = {
  foreground: 'text-foreground',
  'card-foreground': 'text-card-foreground',
  primary: 'text-primary',
  'primary-foreground': 'text-primary-foreground',
  secondary: 'text-secondary',
  'secondary-foreground': 'text-secondary-foreground',
  muted: 'text-muted',
  'muted-foreground': 'text-muted-foreground',
  accent: 'text-accent',
  'accent-foreground': 'text-accent-foreground',
  destructive: 'text-destructive',
  'destructive-foreground': 'text-destructive-foreground',
  border: 'text-border',
  ring: 'text-ring',
}

const SIZE_CLASS: Record<SizeToken, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
}

const ICON_SIZE_CLASS: Record<SizeToken, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  base: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-7 h-7',
  '2xl': 'w-8 h-8',
}

const WEIGHT_CLASS: Record<WeightToken, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

const FIT_CLASS: Record<FitToken, string> = {
  cover: 'object-cover',
  contain: 'object-contain',
  fill: 'object-fill',
}

// ============================================================
// Render context
// ============================================================

export interface RenderContext {
  /** Current state for slot resolution */
  state?: string
  /** Slots mapping: slotName -> stateName -> VNode */
  slots?: Record<string, Record<string, VNodeType>>
  /** Callback to render component nodes */
  renderComponent?: (name: string, props: Record<string, unknown>, children?: VNodeType[]) => string
}

// ============================================================
// Main render function
// ============================================================

/**
 * Render a VNode tree to HTML
 */
export function renderToHtml(node: VNodeType, context: RenderContext = {}): string {
  return renderNode(node, context)
}

function renderNode(node: VNodeType, context: RenderContext): string {
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
      return `<!-- unknown type: ${node.type} -->`
  }
}

function renderChildren(children: VNodeType[] | undefined, context: RenderContext): string {
  if (!children || children.length === 0) return ''
  return children.map(child => renderNode(child, context)).join('\n')
}

// ============================================================
// Primitive renderers
// ============================================================

function renderCol(node: VNodeType, context: RenderContext): string {
  const classes: string[] = ['flex', 'flex-col']
  const { gap, align, padding } = node.props as { gap?: SpacingToken; align?: AlignToken; padding?: SpacingToken }

  if (gap) {
    validateSpacing(gap)
    classes.push(SPACING_GAP[gap])
  }
  if (align) classes.push(ALIGN_ITEMS[align])
  if (padding) {
    validateSpacing(padding)
    classes.push(SPACING_PADDING[padding])
  }

  const childrenHtml = renderChildren(node.children, context)
  return `<div data-primitive="col" data-node-id="${node.id}" class="${classes.join(' ')}">${childrenHtml}</div>`
}

function renderRow(node: VNodeType, context: RenderContext): string {
  const classes: string[] = ['flex', 'flex-row']
  const { gap, align, padding } = node.props as { gap?: SpacingToken; align?: AlignToken; padding?: SpacingToken }

  if (gap) {
    validateSpacing(gap)
    classes.push(SPACING_GAP[gap])
  }
  // Row defaults to items-center
  classes.push(align ? ALIGN_ITEMS[align] : 'items-center')
  if (padding) {
    validateSpacing(padding)
    classes.push(SPACING_PADDING[padding])
  }

  const childrenHtml = renderChildren(node.children, context)
  return `<div data-primitive="row" data-node-id="${node.id}" class="${classes.join(' ')}">${childrenHtml}</div>`
}

function renderBox(node: VNodeType, context: RenderContext): string {
  const classes: string[] = []
  const { padding, bg, radius } = node.props as { padding?: SpacingToken; bg?: BackgroundToken; radius?: RadiusToken }

  if (padding) {
    validateSpacing(padding)
    classes.push(SPACING_PADDING[padding])
  }
  if (bg) {
    validateBackground(bg)
    classes.push(BG_CLASS[bg])
  }
  if (radius) {
    validateRadius(radius)
    classes.push(RADIUS_CLASS[radius])
  }

  const childrenHtml = renderChildren(node.children, context)
  return `<div data-primitive="box" data-node-id="${node.id}" class="${classes.join(' ')}">${childrenHtml}</div>`
}

function renderSpacer(node: VNodeType): string {
  const { size } = node.props as { size?: SpacingToken }

  if (size) {
    validateSpacing(size)
    return `<div data-primitive="spacer" data-node-id="${node.id}" class="${SPACING_SIZE[size]} shrink-0"></div>`
  }
  return `<div data-primitive="spacer" data-node-id="${node.id}" class="flex-1"></div>`
}

function renderSlot(node: VNodeType, context: RenderContext): string {
  const { name } = node.props as { name: string }
  const state = context.state || 'default'

  if (context.slots && context.slots[name]) {
    const stateMapping = context.slots[name]
    const content = stateMapping[state] || stateMapping.default

    if (content) {
      return renderNode(content, context)
    }
  }

  return `<div data-primitive="slot" data-slot-name="${name}" data-node-id="${node.id}"><!-- slot: ${name} --></div>`
}

function renderText(node: VNodeType): string {
  const classes: string[] = []
  const { content, size, weight, color } = node.props as {
    content?: string
    size?: SizeToken
    weight?: WeightToken
    color?: ColorToken
  }

  if (size) {
    validateTypographySize(size)
    classes.push(SIZE_CLASS[size])
  }
  if (weight) {
    validateTypographyWeight(weight)
    classes.push(WEIGHT_CLASS[weight])
  }
  if (color) {
    validateColor(color)
    classes.push(COLOR_CLASS[color])
  }

  return `<span data-primitive="text" data-node-id="${node.id}" class="${classes.join(' ')}">${escapeHtml(content || '')}</span>`
}

function renderIcon(node: VNodeType): string {
  const classes: string[] = ['inline-flex', 'items-center', 'justify-center']
  const { name, size, color } = node.props as { name: string; size?: SizeToken; color?: ColorToken }

  if (size) {
    validateTypographySize(size)
    classes.push(ICON_SIZE_CLASS[size])
  }
  if (color) {
    validateColor(color)
    classes.push(COLOR_CLASS[color])
  }

  return `<span data-primitive="icon" data-icon="${escapeHtml(name)}" data-node-id="${node.id}" class="${classes.join(' ')}"><!-- icon: ${escapeHtml(name)} --></span>`
}

function renderImage(node: VNodeType): string {
  const classes: string[] = ['max-w-full']
  const { src, alt, fit } = node.props as { src: string; alt?: string; fit?: FitToken }

  if (fit) classes.push(FIT_CLASS[fit])

  return `<img data-primitive="image" data-node-id="${node.id}" src="${escapeHtml(src)}" alt="${escapeHtml(alt || '')}" class="${classes.join(' ')}" />`
}

function renderComponent(node: VNodeType, context: RenderContext): string {
  const componentName = node.componentName || 'Unknown'

  if (context.renderComponent) {
    return context.renderComponent(componentName, node.props, node.children)
  }

  // Default: render children wrapped in component marker
  const childrenHtml = renderChildren(node.children, context)
  return `<div data-component="${componentName}" data-node-id="${node.id}">${childrenHtml}</div>`
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
