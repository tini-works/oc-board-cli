// src/primitives/migrate.ts
// Migration tool to convert layoutByRenderer to template format

import type { Template, TemplateNode, Slots } from './types'

/**
 * Legacy layout node types from layoutByRenderer
 */
interface LegacyLayoutNode {
  type: string
  ref?: string
  name?: string
  props?: Record<string, unknown>
  children?: LegacyLayoutNode[]
  gap?: string
  align?: string
  padding?: string
  direction?: string
  default?: LegacyLayoutNode[]
  [key: string]: unknown
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean
  template?: Template
  slots?: Slots
  errors: string[]
  warnings: string[]
}

/**
 * Migrate a layoutByRenderer tree to template format
 *
 * Converts:
 * - Stack/HStack/VStack to $col/$row
 * - Box/Container to $box
 * - ComponentRef to component refs
 * - Slot to $slot
 */
export function migrateLayout(
  layout: unknown,
  _rendererName: string = 'react'
): MigrationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const slots: Slots = {}

  if (!layout || typeof layout !== 'object') {
    return {
      success: false,
      errors: ['Layout must be an object or array'],
      warnings: [],
    }
  }

  try {
    // Handle array at root level
    const layoutNodes = Array.isArray(layout) ? layout : [layout]

    // If single node, use it directly as root
    // If multiple nodes, wrap in $col
    let root: TemplateNode

    if (layoutNodes.length === 1) {
      root = migrateSingleNode(layoutNodes[0] as LegacyLayoutNode, 'root', slots, errors, warnings)
    } else {
      // Multiple root nodes - wrap in $col
      const children: Record<string, TemplateNode> = {}
      layoutNodes.forEach((node, index) => {
        const nodeId = `child-${index}`
        children[nodeId] = migrateSingleNode(node as LegacyLayoutNode, nodeId, slots, errors, warnings)
      })

      root = {
        type: '$col',
        children,
      }
    }

    const template: Template = { root }

    return {
      success: errors.length === 0,
      template,
      slots: Object.keys(slots).length > 0 ? slots : undefined,
      errors,
      warnings,
    }
  } catch (err) {
    return {
      success: false,
      errors: [`Migration failed: ${err instanceof Error ? err.message : String(err)}`],
      warnings,
    }
  }
}

/**
 * Migrate a single layout node
 */
function migrateSingleNode(
  node: LegacyLayoutNode,
  nodeId: string,
  slots: Slots,
  errors: string[],
  warnings: string[]
): TemplateNode {
  if (!node || typeof node !== 'object') {
    errors.push(`Invalid node at ${nodeId}`)
    return `<!-- invalid: ${nodeId} -->`
  }

  const nodeType = node.type

  // ComponentRef -> component ref string
  if (nodeType === 'ComponentRef' && node.ref) {
    if (node.props && Object.keys(node.props).length > 0) {
      warnings.push(`ComponentRef at ${nodeId} has props that cannot be migrated to template format`)
    }
    return node.ref
  }

  // Slot -> $slot
  if (nodeType === 'Slot' && node.name) {
    // Track slot defaults for migration
    if (node.default && Array.isArray(node.default) && node.default.length > 0) {
      // Convert default content to slot mapping
      const defaultContent = migrateSingleNode(node.default[0], `${nodeId}-default`, slots, errors, warnings)
      if (typeof defaultContent === 'string') {
        if (!slots[node.name]) {
          slots[node.name] = {}
        }
        slots[node.name].default = defaultContent
      } else {
        warnings.push(`Slot "${node.name}" default content is complex; manual migration required`)
      }
    }
    return `$slot(${node.name})`
  }

  // Stack/VStack -> $col
  if (nodeType === 'Stack' || nodeType === 'VStack') {
    const props = buildLayoutProps(node, false)
    const primitive = props ? `$col(${props})` : '$col'

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      const children: Record<string, TemplateNode> = {}
      node.children.forEach((child, index) => {
        const childId = `${nodeId}-${index}`
        children[childId] = migrateSingleNode(child, childId, slots, errors, warnings)
      })
      return { type: primitive, children }
    }

    return primitive
  }

  // HStack -> $row
  if (nodeType === 'HStack') {
    const props = buildLayoutProps(node, true)
    const primitive = props ? `$row(${props})` : '$row'

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      const children: Record<string, TemplateNode> = {}
      node.children.forEach((child, index) => {
        const childId = `${nodeId}-${index}`
        children[childId] = migrateSingleNode(child, childId, slots, errors, warnings)
      })
      return { type: primitive, children }
    }

    return primitive
  }

  // Box/Container -> $box
  if (nodeType === 'Box' || nodeType === 'Container') {
    const props = buildBoxProps(node)
    const primitive = props ? `$box(${props})` : '$box'

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      const children: Record<string, TemplateNode> = {}
      node.children.forEach((child, index) => {
        const childId = `${nodeId}-${index}`
        children[childId] = migrateSingleNode(child, childId, slots, errors, warnings)
      })
      return { type: primitive, children }
    }

    return primitive
  }

  // Spacer -> $spacer
  if (nodeType === 'Spacer') {
    if (node.size) {
      const tokenSize = mapToToken(node.size as string, 'spacing')
      return tokenSize ? `$spacer(${tokenSize})` : '$spacer'
    }
    return '$spacer'
  }

  // Text -> $text
  if (nodeType === 'Text') {
    const props: string[] = []
    if (node.content) {
      props.push(String(node.content))
    } else if (node.children && typeof node.children === 'string') {
      props.push(`"${node.children}"`)
    }
    if (node.size) {
      const tokenSize = mapToToken(node.size as string, 'size')
      if (tokenSize) props.push(`size:${tokenSize}`)
    }
    if (node.weight) {
      const tokenWeight = mapToToken(node.weight as string, 'weight')
      if (tokenWeight) props.push(`weight:${tokenWeight}`)
    }
    return props.length > 0 ? `$text(${props.join(' ')})` : '$text(content)'
  }

  // Unknown type - warn and convert to comment
  warnings.push(`Unknown node type "${nodeType}" at ${nodeId}; manual migration required`)
  return `<!-- unknown: ${nodeType} -->`
}

/**
 * Build layout props string for $col/$row
 */
function buildLayoutProps(node: LegacyLayoutNode, _isRow: boolean): string {
  const props: string[] = []

  if (node.gap) {
    const tokenGap = mapToToken(node.gap, 'spacing')
    if (tokenGap) props.push(`gap:${tokenGap}`)
  }

  if (node.align) {
    const tokenAlign = mapToToken(node.align, 'align')
    if (tokenAlign) props.push(`align:${tokenAlign}`)
  }

  if (node.padding) {
    const tokenPadding = mapToToken(node.padding, 'spacing')
    if (tokenPadding) props.push(`padding:${tokenPadding}`)
  }

  return props.join(' ')
}

/**
 * Build box props string for $box
 */
function buildBoxProps(node: LegacyLayoutNode): string {
  const props: string[] = []

  if (node.padding) {
    const tokenPadding = mapToToken(node.padding as string, 'spacing')
    if (tokenPadding) props.push(`padding:${tokenPadding}`)
  }

  if (node.bg || node.background) {
    const bg = (node.bg || node.background) as string
    const tokenBg = mapToToken(bg, 'background')
    if (tokenBg) props.push(`bg:${tokenBg}`)
  }

  if (node.radius || node.borderRadius) {
    const radius = (node.radius || node.borderRadius) as string
    const tokenRadius = mapToToken(radius, 'radius')
    if (tokenRadius) props.push(`radius:${tokenRadius}`)
  }

  return props.join(' ')
}

/**
 * Map CSS values to design tokens
 */
function mapToToken(
  value: string | number,
  type: 'spacing' | 'align' | 'background' | 'radius' | 'size' | 'weight'
): string | null {
  const str = String(value).toLowerCase().trim()

  // Already a token name
  const tokenNames: Record<string, string[]> = {
    spacing: ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
    align: ['start', 'center', 'end', 'stretch', 'between'],
    background: ['transparent', 'surface', 'muted', 'accent'],
    radius: ['none', 'sm', 'md', 'lg', 'full'],
    size: ['xs', 'sm', 'md', 'lg', 'xl'],
    weight: ['normal', 'medium', 'bold'],
  }

  if (tokenNames[type]?.includes(str)) {
    return str
  }

  // Map common CSS values to tokens
  const spacingMap: Record<string, string> = {
    '0': 'none',
    '0px': 'none',
    '4px': 'xs',
    '0.25rem': 'xs',
    '8px': 'sm',
    '0.5rem': 'sm',
    '16px': 'md',
    '1rem': 'md',
    '24px': 'lg',
    '1.5rem': 'lg',
    '32px': 'xl',
    '2rem': 'xl',
    '48px': '2xl',
    '3rem': '2xl',
  }

  const alignMap: Record<string, string> = {
    'flex-start': 'start',
    'flex-end': 'end',
    'space-between': 'between',
  }

  const radiusMap: Record<string, string> = {
    '0': 'none',
    '4px': 'sm',
    '0.25rem': 'sm',
    '8px': 'md',
    '0.5rem': 'md',
    '16px': 'lg',
    '1rem': 'lg',
    '9999px': 'full',
    '50%': 'full',
  }

  if (type === 'spacing' && spacingMap[str]) {
    return spacingMap[str]
  }

  if (type === 'align' && alignMap[str]) {
    return alignMap[str]
  }

  if (type === 'radius' && radiusMap[str]) {
    return radiusMap[str]
  }

  // Can't map - return null
  return null
}

/**
 * Migrate all layouts from a screen config
 */
export function migrateScreenConfig(
  layoutByRenderer: Record<string, unknown>
): MigrationResult {
  // Prefer 'react' layout, fall back to first available
  const rendererName = 'react' in layoutByRenderer ? 'react' : Object.keys(layoutByRenderer)[0]
  const layout = layoutByRenderer[rendererName]

  return migrateLayout(layout, rendererName)
}
