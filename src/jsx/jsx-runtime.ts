// src/jsx/jsx-runtime.ts
// JSX runtime for Vite's automatic JSX transform
import {
  createVNode,
  normalizeChildren,
  type VNodeType,
} from './vnode'
import {
  ColProps,
  RowProps,
  BoxProps,
  SpacerProps,
  SlotProps,
  TextProps,
  IconProps,
  ImageProps,
} from './schemas/primitives'
import { validateProps } from './validation'

// Re-export validation utilities for consumers
export { setValidationMode, getValidationMode, type ValidationMode } from './validation'

// ============================================================
// Primitive Components
// ============================================================

export function Col(props: ColProps): VNodeType {
  validateProps(ColProps, props, 'Col')
  const { children, ...rest } = props
  return createVNode('col', rest, normalizeChildren(children))
}

export function Row(props: RowProps): VNodeType {
  validateProps(RowProps, props, 'Row')
  const { children, ...rest } = props
  return createVNode('row', rest, normalizeChildren(children))
}

export function Box(props: BoxProps): VNodeType {
  validateProps(BoxProps, props, 'Box')
  const { children, ...rest } = props
  return createVNode('box', rest, normalizeChildren(children))
}

export function Spacer(props: SpacerProps = {}): VNodeType {
  validateProps(SpacerProps, props, 'Spacer')
  return createVNode('spacer', props)
}

export function Slot(props: SlotProps): VNodeType {
  validateProps(SlotProps, props, 'Slot')
  return createVNode('slot', props)
}

export function Text(props: TextProps): VNodeType {
  validateProps(TextProps, props, 'Text')
  const { children, ...rest } = props
  return createVNode('text', { ...rest, content: children })
}

export function Icon(props: IconProps): VNodeType {
  validateProps(IconProps, props, 'Icon')
  return createVNode('icon', props)
}

export function Image(props: ImageProps): VNodeType {
  validateProps(ImageProps, props, 'Image')
  return createVNode('image', props)
}

// ============================================================
// JSX Runtime Functions
// ============================================================

type JSXElementType = ((props: Record<string, unknown>, state?: unknown) => VNodeType) & {
  statesSchema?: unknown // Set by defineComponent
}

/**
 * JSX factory function - called for each JSX element
 * Extracts `state` prop for components created with defineComponent
 */
export function jsx(type: JSXElementType, props: Record<string, unknown>): VNodeType {
  // Check if this is a defineComponent component (has statesSchema)
  if (type.statesSchema && 'state' in props) {
    const { state, ...restProps } = props
    return type(restProps, state)
  }
  return type(props)
}

/**
 * JSX factory for elements with static children
 */
export const jsxs = jsx

/**
 * JSX factory for development mode (with source info)
 */
export function jsxDEV(
  type: JSXElementType,
  props: Record<string, unknown>,
  _key?: string,
  _isStaticChildren?: boolean,
  _source?: { fileName: string; lineNumber: number; columnNumber: number },
  _self?: unknown
): VNodeType {
  return jsx(type, props)
}

// ============================================================
// Fragment support
// ============================================================

export function Fragment({ children }: { children?: unknown }): VNodeType[] {
  return normalizeChildren(children)
}
