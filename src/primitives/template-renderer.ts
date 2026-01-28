// src/primitives/template-renderer.ts
// Renders templates to HTML using design tokens

import {
  isPrimitive,
  isRef,
  isContainerNode,
  type TemplateNode,
  type Template,
  type Slots,
  type SpacingToken,
  type AlignToken,
  type BackgroundToken,
  type RadiusToken,
  type ColorToken,
  type SizeToken,
  type WeightToken,
  type FitToken,
} from './types'
import { parsePrimitive } from './parser'

/**
 * Design token to Tailwind class mappings
 * Using shadcn/ui-compatible naming conventions
 */

// Spacing token to Tailwind scale
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

// For spacer fixed sizes (width/height)
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

// Background tokens - shadcn-compatible
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

// Text color tokens - shadcn-compatible
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

// Icon sizes use width/height
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

export interface RenderContext {
  /** Current state for slot resolution */
  state?: string
  /** Slots mapping for state-dependent content */
  slots?: Slots
  /** Props for component rendering */
  props?: Record<string, unknown>
  /** Callback to render component refs */
  renderRef?: (ref: string) => string
}

/**
 * Render a template to HTML
 */
export function renderTemplate(template: Template, context: RenderContext = {}): string {
  return renderNode(template.root, 'root', context)
}

/**
 * Render a single template node to HTML
 */
function renderNode(node: TemplateNode, nodeId: string, context: RenderContext): string {
  // String node: primitive or ref
  if (typeof node === 'string') {
    return renderLeaf(node, nodeId, context)
  }

  // Container node: has type and possibly children
  if (isContainerNode(node)) {
    return renderContainer(node, nodeId, context)
  }

  return `<!-- unknown node type -->`
}

/**
 * Render a leaf node (primitive string or component ref)
 */
function renderLeaf(value: string, nodeId: string, context: RenderContext): string {
  if (isPrimitive(value)) {
    return renderPrimitive(value, nodeId, context)
  }

  if (isRef(value)) {
    // Delegate to ref renderer if provided
    if (context.renderRef) {
      return context.renderRef(value)
    }
    // Default: placeholder
    return `<div data-ref="${value}" data-node-id="${nodeId}"><!-- ${value} --></div>`
  }

  // Treat as literal text
  return escapeHtml(value)
}

/**
 * Render a container node with children
 */
function renderContainer(
  node: { type: string; children?: Record<string, TemplateNode> },
  nodeId: string,
  context: RenderContext
): string {
  const parseResult = parsePrimitive(node.type)
  if (!parseResult.success) {
    return `<!-- invalid primitive: ${node.type} -->`
  }

  const primitive = parseResult.primitive
  let childrenHtml = ''

  if (node.children) {
    childrenHtml = Object.entries(node.children)
      .map(([childId, childNode]) => renderNode(childNode, childId, context))
      .join('\n')
  }

  switch (primitive.type) {
    case '$col':
      return renderCol(primitive, nodeId, childrenHtml)
    case '$row':
      return renderRow(primitive, nodeId, childrenHtml)
    case '$box':
      return renderBox(primitive, nodeId, childrenHtml)
    default:
      return `<div data-primitive="${primitive.type}" data-node-id="${nodeId}">${childrenHtml}</div>`
  }
}

/**
 * Render a primitive string (without children)
 */
function renderPrimitive(value: string, nodeId: string, context: RenderContext): string {
  const parseResult = parsePrimitive(value)
  if (!parseResult.success) {
    return `<!-- invalid primitive: ${value} -->`
  }

  const primitive = parseResult.primitive

  switch (primitive.type) {
    case '$col':
      return renderCol(primitive, nodeId, '')
    case '$row':
      return renderRow(primitive, nodeId, '')
    case '$box':
      return renderBox(primitive, nodeId, '')
    case '$spacer':
      return renderSpacer(primitive, nodeId)
    case '$slot':
      return renderSlot(primitive, nodeId, context)
    case '$text':
      return renderText(primitive, nodeId, context)
    case '$icon':
      return renderIcon(primitive, nodeId, context)
    case '$image':
      return renderImage(primitive, nodeId, context)
    default:
      // Exhaustive check - should never reach here
      return `<!-- unknown primitive: ${value} -->`
  }
}

// Primitive renderers

function renderCol(
  primitive: { gap?: SpacingToken; align?: AlignToken; padding?: SpacingToken },
  nodeId: string,
  children: string
): string {
  const classes: string[] = ['flex', 'flex-col']
  if (primitive.gap) classes.push(SPACING_GAP[primitive.gap])
  if (primitive.align) classes.push(ALIGN_ITEMS[primitive.align])
  if (primitive.padding) classes.push(SPACING_PADDING[primitive.padding])

  return `<div data-primitive="$col" data-node-id="${nodeId}" class="${classes.join(' ')}">${children}</div>`
}

function renderRow(
  primitive: { gap?: SpacingToken; align?: AlignToken; padding?: SpacingToken },
  nodeId: string,
  children: string
): string {
  const classes: string[] = ['flex', 'flex-row']
  if (primitive.gap) classes.push(SPACING_GAP[primitive.gap])
  // $row defaults to items-center per spec
  if (primitive.align) {
    classes.push(ALIGN_ITEMS[primitive.align])
  } else {
    classes.push('items-center')
  }
  if (primitive.padding) classes.push(SPACING_PADDING[primitive.padding])

  return `<div data-primitive="$row" data-node-id="${nodeId}" class="${classes.join(' ')}">${children}</div>`
}

function renderBox(
  primitive: { padding?: SpacingToken; bg?: BackgroundToken; radius?: RadiusToken },
  nodeId: string,
  children: string
): string {
  const classes: string[] = []
  if (primitive.padding) classes.push(SPACING_PADDING[primitive.padding])
  if (primitive.bg) classes.push(BG_CLASS[primitive.bg])
  if (primitive.radius) classes.push(RADIUS_CLASS[primitive.radius])

  return `<div data-primitive="$box" data-node-id="${nodeId}" class="${classes.join(' ')}">${children}</div>`
}

function renderSpacer(
  primitive: { size?: SpacingToken },
  nodeId: string
): string {
  if (primitive.size) {
    // Fixed size spacer
    return `<div data-primitive="$spacer" data-node-id="${nodeId}" class="${SPACING_SIZE[primitive.size]} shrink-0"></div>`
  }
  // Flex spacer
  return `<div data-primitive="$spacer" data-node-id="${nodeId}" class="flex-1"></div>`
}

function renderSlot(
  primitive: { name: string },
  nodeId: string,
  context: RenderContext
): string {
  const slotName = primitive.name
  const state = context.state || 'default'

  // Look up slot content
  if (context.slots && context.slots[slotName]) {
    const stateMapping = context.slots[slotName]
    const content = stateMapping[state] || stateMapping.default

    if (content) {
      // Render the content (ref or primitive)
      return renderLeaf(content, `${nodeId}-content`, context)
    }
  }

  // No slot content found
  return `<div data-primitive="$slot" data-slot-name="${slotName}" data-node-id="${nodeId}"><!-- slot: ${slotName} --></div>`
}

function renderText(
  primitive: { content: string; size?: SizeToken; weight?: WeightToken; color?: ColorToken },
  nodeId: string,
  context: RenderContext
): string {
  const classes: string[] = []
  if (primitive.size) classes.push(SIZE_CLASS[primitive.size])
  if (primitive.weight) classes.push(WEIGHT_CLASS[primitive.weight])
  if (primitive.color) classes.push(COLOR_CLASS[primitive.color])

  // Resolve content (prop reference or literal)
  let content = primitive.content
  if (content.startsWith('"') || content.startsWith("'")) {
    // Quoted literal - strip quotes
    content = content.slice(1, -1)
  } else if (context.props && content in context.props) {
    // Prop reference
    content = String(context.props[content] ?? '')
  }

  return `<span data-primitive="$text" data-node-id="${nodeId}" class="${classes.join(' ')}">${escapeHtml(content)}</span>`
}

function renderIcon(
  primitive: { name: string; size?: SizeToken; color?: ColorToken },
  nodeId: string,
  context: RenderContext
): string {
  const classes: string[] = ['inline-flex', 'items-center', 'justify-center']
  if (primitive.size) classes.push(ICON_SIZE_CLASS[primitive.size])
  if (primitive.color) classes.push(COLOR_CLASS[primitive.color])

  // Resolve icon name
  let iconName = primitive.name
  if (iconName.startsWith('"') || iconName.startsWith("'")) {
    // Quoted literal - strip quotes
    iconName = iconName.slice(1, -1)
  } else if (context.props && iconName in context.props) {
    // Prop reference
    iconName = String(context.props[iconName] ?? '')
  }

  return `<span data-primitive="$icon" data-icon="${escapeHtml(iconName)}" data-node-id="${nodeId}" class="${classes.join(' ')}"><!-- icon: ${escapeHtml(iconName)} --></span>`
}

function renderImage(
  primitive: { src: string; alt?: string; fit?: FitToken },
  nodeId: string,
  context: RenderContext
): string {
  const classes: string[] = ['max-w-full']
  if (primitive.fit) classes.push(FIT_CLASS[primitive.fit])

  // Resolve src
  let src = primitive.src
  if (src.startsWith('"') || src.startsWith("'")) {
    // Quoted literal - strip quotes
    src = src.slice(1, -1)
  } else if (context.props && src in context.props) {
    // Prop reference
    src = String(context.props[src] ?? '')
  }

  const alt = primitive.alt ?? ''

  return `<img data-primitive="$image" data-node-id="${nodeId}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="${classes.join(' ')}" />`
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Generate CSS custom properties for design tokens (shadcn-compatible)
 */
export function generateTokenCSS(): string {
  return `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;

    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;

    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;

    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;

    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;

    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;

    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;

    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;

    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;

    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;

    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;

    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;

    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;

    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;

    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}
`.trim()
}
