// src/primitives/parser.ts
// Parser for $name(props) primitive syntax

import type {
  Primitive,
  PrimitiveType,
  ColPrimitive,
  RowPrimitive,
  BoxPrimitive,
  SpacerPrimitive,
  SlotPrimitive,
  TextPrimitive,
  IconPrimitive,
  ImagePrimitive,
  SpacingToken,
  AlignToken,
  BackgroundToken,
  RadiusToken,
  ColorToken,
  SizeToken,
  WeightToken,
  FitToken,
} from './types'

/**
 * Token validation sets (shadcn-compatible)
 */
const SPACING_TOKENS = new Set<SpacingToken>(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'])
const ALIGN_TOKENS = new Set<AlignToken>(['start', 'center', 'end', 'stretch', 'between'])
const BG_TOKENS = new Set<BackgroundToken>([
  'transparent', 'background', 'card', 'primary', 'secondary',
  'muted', 'accent', 'destructive', 'input'
])
const RADIUS_TOKENS = new Set<RadiusToken>(['none', 'sm', 'md', 'lg', 'xl', 'full'])
const COLOR_TOKENS = new Set<ColorToken>([
  'foreground', 'card-foreground',
  'primary', 'primary-foreground',
  'secondary', 'secondary-foreground',
  'muted', 'muted-foreground',
  'accent', 'accent-foreground',
  'destructive', 'destructive-foreground',
  'border', 'ring'
])
const SIZE_TOKENS = new Set<SizeToken>(['xs', 'sm', 'base', 'lg', 'xl', '2xl'])
const WEIGHT_TOKENS = new Set<WeightToken>(['normal', 'medium', 'semibold', 'bold'])
const FIT_TOKENS = new Set<FitToken>(['cover', 'contain', 'fill'])

const PRIMITIVE_NAMES = new Set<PrimitiveType>([
  '$col', '$row', '$box', '$spacer', '$slot',
  '$text', '$icon', '$image',
])

export interface ParseError {
  message: string
  position?: number
}

export interface ParseResultSuccess<T extends Primitive = Primitive> {
  success: true
  primitive: T
  raw: string
}

export interface ParseResultFailure {
  success: false
  error: ParseError
  raw: string
}

export type ParseResult<T extends Primitive = Primitive> = ParseResultSuccess<T> | ParseResultFailure

/**
 * Parse a primitive string like "$col(gap:lg align:center)"
 */
export function parsePrimitive(input: string): ParseResult {
  const raw = input.trim()

  if (!raw.startsWith('$')) {
    return {
      success: false,
      error: { message: 'Primitive must start with $' },
      raw,
    }
  }

  // Extract name and props
  const match = raw.match(/^(\$[a-z]+)(?:\(([^)]*)\))?$/)
  if (!match) {
    return {
      success: false,
      error: { message: `Invalid primitive syntax: ${raw}` },
      raw,
    }
  }

  const [, name, propsStr] = match
  if (!PRIMITIVE_NAMES.has(name as PrimitiveType)) {
    return {
      success: false,
      error: { message: `Unknown primitive: ${name}` },
      raw,
    }
  }

  const props = propsStr ? parseProps(propsStr) : {}

  // Build typed primitive based on name
  switch (name as PrimitiveType) {
    case '$col':
      return buildColPrimitive(props, raw)
    case '$row':
      return buildRowPrimitive(props, raw)
    case '$box':
      return buildBoxPrimitive(props, raw)
    case '$spacer':
      return buildSpacerPrimitive(props, raw)
    case '$slot':
      return buildSlotPrimitive(props, raw)
    case '$text':
      return buildTextPrimitive(props, raw)
    case '$icon':
      return buildIconPrimitive(props, raw)
    case '$image':
      return buildImagePrimitive(props, raw)
    default:
      return {
        success: false,
        error: { message: `Unhandled primitive: ${name}` },
        raw,
      }
  }
}

/**
 * Parse props string "gap:lg align:center" or "name size:sm"
 * Returns a map of key:value pairs
 * Positional args become $0, $1, etc.
 */
function parseProps(propsStr: string): Record<string, string> {
  const props: Record<string, string> = {}
  let positionalIndex = 0

  // Handle quoted strings and key:value pairs
  const tokens = tokenizeProps(propsStr)

  for (const token of tokens) {
    // Quoted tokens are always positional (even if they contain a colon)
    const startsWithQuote = token.startsWith('"') || token.startsWith("'")

    if (!startsWithQuote && token.includes(':')) {
      const colonIndex = token.indexOf(':')
      const key = token.slice(0, colonIndex)
      const value = token.slice(colonIndex + 1)
      props[key] = value
    } else {
      // Positional argument
      props[`$${positionalIndex}`] = token
      positionalIndex++
    }
  }

  return props
}

/**
 * Tokenize props string, respecting quoted values
 */
function tokenizeProps(propsStr: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false
  let quoteChar = ''

  for (let i = 0; i < propsStr.length; i++) {
    const char = propsStr[i]

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true
      quoteChar = char
      current += char
    } else if (inQuote && char === quoteChar) {
      inQuote = false
      current += char
      quoteChar = ''
    } else if (!inQuote && char === ' ') {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Remove quotes from a value if present
 */
function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

/**
 * Check if a value is quoted (literal) vs bare (prop reference)
 */
export function isQuoted(value: string): boolean {
  return (value.startsWith('"') && value.endsWith('"')) ||
         (value.startsWith("'") && value.endsWith("'"))
}

// Builder functions for each primitive type

function buildColPrimitive(props: Record<string, string>, raw: string): ParseResult {
  const primitive: ColPrimitive = { type: '$col' }

  if (props.gap) {
    if (!SPACING_TOKENS.has(props.gap as SpacingToken)) {
      return { success: false, error: { message: `Invalid gap token: ${props.gap}` }, raw }
    }
    primitive.gap = props.gap as SpacingToken
  }

  if (props.align) {
    if (!ALIGN_TOKENS.has(props.align as AlignToken)) {
      return { success: false, error: { message: `Invalid align token: ${props.align}` }, raw }
    }
    primitive.align = props.align as AlignToken
  }

  if (props.padding) {
    if (!SPACING_TOKENS.has(props.padding as SpacingToken)) {
      return { success: false, error: { message: `Invalid padding token: ${props.padding}` }, raw }
    }
    primitive.padding = props.padding as SpacingToken
  }

  return { success: true, primitive, raw }
}

function buildRowPrimitive(props: Record<string, string>, raw: string): ParseResult {
  const primitive: RowPrimitive = { type: '$row' }

  if (props.gap) {
    if (!SPACING_TOKENS.has(props.gap as SpacingToken)) {
      return { success: false, error: { message: `Invalid gap token: ${props.gap}` }, raw }
    }
    primitive.gap = props.gap as SpacingToken
  }

  if (props.align) {
    if (!ALIGN_TOKENS.has(props.align as AlignToken)) {
      return { success: false, error: { message: `Invalid align token: ${props.align}` }, raw }
    }
    primitive.align = props.align as AlignToken
  }

  if (props.padding) {
    if (!SPACING_TOKENS.has(props.padding as SpacingToken)) {
      return { success: false, error: { message: `Invalid padding token: ${props.padding}` }, raw }
    }
    primitive.padding = props.padding as SpacingToken
  }

  return { success: true, primitive, raw }
}

function buildBoxPrimitive(props: Record<string, string>, raw: string): ParseResult {
  const primitive: BoxPrimitive = { type: '$box' }

  if (props.padding) {
    if (!SPACING_TOKENS.has(props.padding as SpacingToken)) {
      return { success: false, error: { message: `Invalid padding token: ${props.padding}` }, raw }
    }
    primitive.padding = props.padding as SpacingToken
  }

  if (props.bg) {
    if (!BG_TOKENS.has(props.bg as BackgroundToken)) {
      return { success: false, error: { message: `Invalid bg token: ${props.bg}` }, raw }
    }
    primitive.bg = props.bg as BackgroundToken
  }

  if (props.radius) {
    if (!RADIUS_TOKENS.has(props.radius as RadiusToken)) {
      return { success: false, error: { message: `Invalid radius token: ${props.radius}` }, raw }
    }
    primitive.radius = props.radius as RadiusToken
  }

  return { success: true, primitive, raw }
}

function buildSpacerPrimitive(props: Record<string, string>, raw: string): ParseResult {
  const primitive: SpacerPrimitive = { type: '$spacer' }

  // Spacer can have a positional size arg: $spacer(xl) or $spacer(size:xl)
  const sizeValue = props['$0'] || props.size
  if (sizeValue) {
    if (!SPACING_TOKENS.has(sizeValue as SpacingToken)) {
      return { success: false, error: { message: `Invalid size token: ${sizeValue}` }, raw }
    }
    primitive.size = sizeValue as SpacingToken
  }

  return { success: true, primitive, raw }
}

function buildSlotPrimitive(props: Record<string, string>, raw: string): ParseResult {
  // Slot requires a name: $slot(main) or $slot(name:main)
  const nameValue = props['$0'] || props.name
  if (!nameValue) {
    return { success: false, error: { message: '$slot requires a name' }, raw }
  }

  const primitive: SlotPrimitive = {
    type: '$slot',
    name: unquote(nameValue),
  }

  return { success: true, primitive, raw }
}

function buildTextPrimitive(props: Record<string, string>, raw: string): ParseResult {
  // Text requires content as first positional arg: $text(label) or $text("Hello")
  const contentValue = props['$0'] || props.content
  if (!contentValue) {
    return { success: false, error: { message: '$text requires content' }, raw }
  }

  const primitive: TextPrimitive = {
    type: '$text',
    content: contentValue, // Keep as-is, renderer resolves prop refs
  }

  if (props.size) {
    if (!SIZE_TOKENS.has(props.size as SizeToken)) {
      return { success: false, error: { message: `Invalid size token: ${props.size}` }, raw }
    }
    primitive.size = props.size as SizeToken
  }

  if (props.weight) {
    if (!WEIGHT_TOKENS.has(props.weight as WeightToken)) {
      return { success: false, error: { message: `Invalid weight token: ${props.weight}` }, raw }
    }
    primitive.weight = props.weight as WeightToken
  }

  if (props.color) {
    if (!COLOR_TOKENS.has(props.color as ColorToken)) {
      return { success: false, error: { message: `Invalid color token: ${props.color}` }, raw }
    }
    primitive.color = props.color as ColorToken
  }

  return { success: true, primitive, raw }
}

function buildIconPrimitive(props: Record<string, string>, raw: string): ParseResult {
  // Icon requires name: $icon(name:check) or $icon(iconProp)
  const nameValue = props.name || props['$0']
  if (!nameValue) {
    return { success: false, error: { message: '$icon requires name' }, raw }
  }

  const primitive: IconPrimitive = {
    type: '$icon',
    name: nameValue, // Keep as-is, renderer resolves prop refs
  }

  if (props.size) {
    if (!SIZE_TOKENS.has(props.size as SizeToken)) {
      return { success: false, error: { message: `Invalid size token: ${props.size}` }, raw }
    }
    primitive.size = props.size as SizeToken
  }

  if (props.color) {
    if (!COLOR_TOKENS.has(props.color as ColorToken)) {
      return { success: false, error: { message: `Invalid color token: ${props.color}` }, raw }
    }
    primitive.color = props.color as ColorToken
  }

  return { success: true, primitive, raw }
}

function buildImagePrimitive(props: Record<string, string>, raw: string): ParseResult {
  // Image requires src: $image(src:url) or $image(srcProp)
  const srcValue = props.src || props['$0']
  if (!srcValue) {
    return { success: false, error: { message: '$image requires src' }, raw }
  }

  const primitive: ImagePrimitive = {
    type: '$image',
    src: srcValue, // Keep as-is, renderer resolves prop refs
  }

  if (props.alt) {
    primitive.alt = unquote(props.alt)
  }

  if (props.fit) {
    if (!FIT_TOKENS.has(props.fit as FitToken)) {
      return { success: false, error: { message: `Invalid fit token: ${props.fit}` }, raw }
    }
    primitive.fit = props.fit as FitToken
  }

  return { success: true, primitive, raw }
}

/**
 * Extract primitive type from a primitive string
 */
export function getPrimitiveType(input: string): PrimitiveType | null {
  const match = input.match(/^(\$[a-z]+)/)
  if (match && PRIMITIVE_NAMES.has(match[1] as PrimitiveType)) {
    return match[1] as PrimitiveType
  }
  return null
}

/**
 * Check if a string is a valid primitive syntax
 */
export function isValidPrimitiveSyntax(input: string): boolean {
  const result = parsePrimitive(input)
  return result.success
}
