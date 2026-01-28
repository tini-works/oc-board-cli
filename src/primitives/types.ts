// src/primitives/types.ts
// Type definitions for layout and content primitives

/**
 * Design token types for consistent spacing, sizing, and styling
 * Using shadcn/ui-compatible naming conventions
 */
export type SpacingToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type AlignToken = 'start' | 'center' | 'end' | 'stretch' | 'between'

// Background tokens - shadcn-compatible
export type BackgroundToken =
  | 'transparent'
  | 'background'
  | 'card'
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'destructive'
  | 'input'

export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

// Color tokens - shadcn-compatible (foreground colors for text)
export type ColorToken =
  | 'foreground'
  | 'card-foreground'
  | 'primary'
  | 'primary-foreground'
  | 'secondary'
  | 'secondary-foreground'
  | 'muted'
  | 'muted-foreground'
  | 'accent'
  | 'accent-foreground'
  | 'destructive'
  | 'destructive-foreground'
  | 'border'
  | 'ring'

// Typography size tokens
export type SizeToken = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl'

export type WeightToken = 'normal' | 'medium' | 'semibold' | 'bold'
export type FitToken = 'cover' | 'contain' | 'fill'

/**
 * All primitive type names
 */
export type PrimitiveType =
  | '$col'
  | '$row'
  | '$box'
  | '$spacer'
  | '$slot'
  | '$text'
  | '$icon'
  | '$image'

/**
 * Layout primitive: $col - Vertical stack
 */
export interface ColPrimitive {
  type: '$col'
  gap?: SpacingToken
  align?: AlignToken
  padding?: SpacingToken
}

/**
 * Layout primitive: $row - Horizontal stack
 */
export interface RowPrimitive {
  type: '$row'
  gap?: SpacingToken
  align?: AlignToken
  padding?: SpacingToken
}

/**
 * Layout primitive: $box - Container with styling
 */
export interface BoxPrimitive {
  type: '$box'
  padding?: SpacingToken
  bg?: BackgroundToken
  radius?: RadiusToken
}

/**
 * Layout primitive: $spacer - Whitespace
 */
export interface SpacerPrimitive {
  type: '$spacer'
  size?: SpacingToken // If absent, flex grow
}

/**
 * Layout primitive: $slot - State-dependent placeholder
 */
export interface SlotPrimitive {
  type: '$slot'
  name: string
}

/**
 * Content primitive: $text - Text content
 */
export interface TextPrimitive {
  type: '$text'
  content: string // Prop reference or quoted literal
  size?: SizeToken
  weight?: WeightToken
  color?: ColorToken
}

/**
 * Content primitive: $icon - Icon
 */
export interface IconPrimitive {
  type: '$icon'
  name: string // Prop reference or string
  size?: SizeToken
  color?: ColorToken
}

/**
 * Content primitive: $image - Image
 */
export interface ImagePrimitive {
  type: '$image'
  src: string // Prop reference or URL
  alt?: string
  fit?: FitToken
}

/**
 * Union of all primitives
 */
export type Primitive =
  | ColPrimitive
  | RowPrimitive
  | BoxPrimitive
  | SpacerPrimitive
  | SlotPrimitive
  | TextPrimitive
  | IconPrimitive
  | ImagePrimitive

/**
 * Parsed primitive with original string
 */
export interface ParsedPrimitive<T extends Primitive = Primitive> {
  primitive: T
  raw: string
}

/**
 * Template node - container or leaf
 */
export interface TemplateContainerNode {
  type: string // Primitive string like "$col(gap:lg)"
  children?: Record<string, TemplateNode>
}

export interface TemplateLeafNode {
  value: string // Primitive or ref like "$text(label)" or "components/button"
}

export type TemplateNode = TemplateContainerNode | string

/**
 * Template root structure
 */
export interface Template {
  root: TemplateNode
}

/**
 * Slots mapping: state name -> content ref
 */
export type Slots = Record<string, Record<string, string>>

/**
 * Screen v2 config with template and slots
 */
export interface ScreenV2Config {
  kind: 'screen'
  id: string
  title: string
  schemaVersion: '2.0'
  states?: Record<string, { description?: string }>
  template: Template
  slots?: Slots
  // Legacy field for backwards compatibility
  layoutByRenderer?: Record<string, unknown>
}

/**
 * Component v2 config with props and template
 */
export interface ComponentV2Config {
  kind: 'component'
  id: string
  title: string
  schemaVersion: '2.0'
  props?: Record<string, {
    type?: string
    required?: boolean
    default?: unknown
    values?: unknown[]
  }>
  template?: Template
}

/**
 * Check if a string is a primitive (starts with $)
 */
export function isPrimitive(value: string): boolean {
  return value.startsWith('$')
}

/**
 * Check if a string is a component/screen/flow ref (contains /)
 */
export function isRef(value: string): boolean {
  return value.includes('/') && !value.startsWith('$')
}

/**
 * Check if a template node is a container (has type and children)
 */
export function isContainerNode(node: unknown): node is TemplateContainerNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    typeof (node as Record<string, unknown>).type === 'string'
  )
}

/**
 * Check if a template node is a leaf (string value)
 */
export function isLeafNode(node: unknown): node is string {
  return typeof node === 'string'
}
