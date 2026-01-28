// src/jsx/vnode.ts
// Virtual Node representation - immutable tree structure
import { z } from 'zod'
import { PrimitiveType } from './schemas/primitives'

export interface VNodeType {
  id: string
  type: z.infer<typeof PrimitiveType>
  props: Record<string, unknown>
  children?: VNodeType[]
  componentName?: string
}

// VNode schema - recursive definition for runtime validation
export const VNode: z.ZodType<VNodeType> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: PrimitiveType,
    props: z.record(z.string(), z.unknown()),
    children: z.array(VNode).optional(),
    componentName: z.string().optional(),
  })
)

// ============================================================
// Render Context - isolated ID generation for concurrent safety
// ============================================================

/**
 * Render context for isolated ID generation.
 * Each render should use its own context to avoid ID conflicts
 * when multiple renders execute concurrently.
 */
export interface RenderContext {
  /** Generate unique ID for a node type */
  nextId: (type: string) => string
}

/**
 * Create a new render context with isolated ID counter.
 * Use this for each render to ensure concurrent safety.
 */
export function createRenderContext(): RenderContext {
  let counter = 0
  return {
    nextId: (type: string) => `${type}-${counter++}`,
  }
}

// Global context for backward compatibility
let globalContext = createRenderContext()

/**
 * Reset ID counter - call at start of each render.
 * @deprecated Use createRenderContext() for concurrent safety
 */
export function resetIdCounter(): void {
  globalContext = createRenderContext()
}

/**
 * Get the current global render context.
 * @internal
 */
export function getGlobalContext(): RenderContext {
  return globalContext
}

/**
 * Create an immutable VNode
 * @param type - Node type (col, row, text, etc.)
 * @param props - Node properties
 * @param children - Child nodes
 * @param context - Optional render context for ID generation (uses global if not provided)
 */
export function createVNode(
  type: VNodeType['type'],
  props: Record<string, unknown>,
  children?: VNodeType[],
  context?: RenderContext
): VNodeType {
  const ctx = context ?? globalContext
  const node: VNodeType = {
    id: ctx.nextId(type),
    type,
    props: Object.freeze({ ...props }),
    children: children ? Object.freeze([...children]) as VNodeType[] : undefined,
  }
  return Object.freeze(node) as VNodeType
}

/**
 * Create a component VNode (wraps rendered content)
 * @param componentName - Name of the component
 * @param props - Component properties
 * @param children - Child nodes
 * @param context - Optional render context for ID generation (uses global if not provided)
 */
export function createComponentVNode(
  componentName: string,
  props: Record<string, unknown>,
  children?: VNodeType[],
  context?: RenderContext
): VNodeType {
  const ctx = context ?? globalContext
  const node: VNodeType = {
    id: ctx.nextId('component'),
    type: 'component',
    props: Object.freeze({ ...props }),
    children: children ? Object.freeze([...children]) as VNodeType[] : undefined,
    componentName,
  }
  return Object.freeze(node) as VNodeType
}

/**
 * Normalize children to array, converting strings/numbers to Text nodes
 */
export function normalizeChildren(children: unknown): VNodeType[] {
  if (children === null || children === undefined) return []

  const items = Array.isArray(children) ? children.flat(Infinity) : [children]

  return items
    .filter((item) => item !== null && item !== undefined && item !== false && item !== true)
    .map((item) => {
      // Convert strings and numbers to Text nodes
      if (typeof item === 'string' || typeof item === 'number') {
        return createVNode('text', { content: String(item) })
      }
      return item as VNodeType
    })
}

/**
 * Check structural equality of two VNodes (ignores IDs)
 */
export function vnodeEquals(a: VNodeType, b: VNodeType): boolean {
  if (a.type !== b.type) return false
  if (a.componentName !== b.componentName) return false

  // Compare props (shallow)
  const aProps = Object.entries(a.props).filter(([k]) => k !== 'children')
  const bProps = Object.entries(b.props).filter(([k]) => k !== 'children')
  if (aProps.length !== bProps.length) return false
  for (const [key, value] of aProps) {
    if (b.props[key] !== value) return false
  }

  // Compare children recursively
  const aChildren = a.children || []
  const bChildren = b.children || []
  if (aChildren.length !== bChildren.length) return false
  for (let i = 0; i < aChildren.length; i++) {
    if (!vnodeEquals(aChildren[i], bChildren[i])) return false
  }

  return true
}
