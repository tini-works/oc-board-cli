import { build } from 'esbuild'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Resolve from CLI's location, not user's project (React is our dependency)
const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '..')

export interface VendorBundleResult {
  success: boolean
  code: string
  error?: string
}

export async function buildVendorBundle(): Promise<VendorBundleResult> {
  try {
    const entryCode = `
      import * as React from 'react'
      import * as ReactDOM from 'react-dom'
      import { createRoot } from 'react-dom/client'
      export { jsx, jsxs, Fragment } from 'react/jsx-runtime'
      export { React, ReactDOM, createRoot }
      // Re-export React hooks as named exports (preview code imports them directly)
      export {
        useState, useEffect, useCallback, useMemo, useRef,
        useContext, useReducer, useLayoutEffect, useInsertionEffect,
        useTransition, useDeferredValue, useId, useSyncExternalStore,
        useImperativeHandle, useDebugValue, memo, forwardRef,
        createContext, createRef, lazy, Suspense, startTransition,
        Children, cloneElement, isValidElement, createElement
      } from 'react'
      export default React
    `

    const result = await build({
      stdin: {
        contents: entryCode,
        loader: 'ts',
        resolveDir: __dirname, // Resolve React from CLI's node_modules
      },
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2020',
      minify: true,
    })

    // Select JS output file explicitly (in case sourcemaps are added later)
    const jsFile = result.outputFiles?.find(f => f.path.endsWith('.js')) || result.outputFiles?.[0]
    if (!jsFile) {
      return { success: false, code: '', error: 'No output generated' }
    }

    return { success: true, code: jsFile.text }
  } catch (err) {
    return {
      success: false,
      code: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// Import jsx modules at build time so they're bundled into the CLI
import * as jsxModule from '../jsx/index'

/**
 * Build @prev/jsx bundle for static preview builds
 * The jsx code is bundled into the CLI, we just need to create a runtime bundle
 */
export async function buildJsxBundle(vendorPath: string): Promise<VendorBundleResult> {
  try {
    // Get the export names from the jsx module
    const exportNames = Object.keys(jsxModule).filter(k => k !== 'default')

    // Create entry that re-exports from the bundled jsx module
    // We build this fresh to ensure React imports point to vendor bundle
    const jsxEntry = `
      import * as React from 'react'
      import { jsx, jsxs, Fragment } from 'react/jsx-runtime'

      // VNode and schemas
      ${jsxModule.VNode ? `export const VNode = ${jsxModule.VNode.toString()}` : ''}
      export const createVNode = ${jsxModule.createVNode.toString()}
      export const normalizeChildren = ${jsxModule.normalizeChildren.toString()}

      // Primitives re-export (these use the jsx runtime)
      export { Box, Text, Col, Row, Spacer, Slot, Icon, Image, Fragment } from './jsx-runtime-inline'

      // React adapter
      export { toReact, setTokensConfig } from './react-adapter-inline'
    `

    // For now, create a minimal bundle that works with the primitives
    // This is a simplified approach - full solution would pre-bundle during CLI build
    const minimalJsx = `
      import * as React from 'react'

      // Token resolution
      let tokensConfig = null
      export function setTokensConfig(config) { tokensConfig = config }

      function resolveToken(category, token) {
        if (!tokensConfig) return token
        const cat = tokensConfig[category]
        return cat?.[token] ?? token
      }

      // VNode type
      export class VNode {
        constructor(type, props, children) {
          this.type = type
          this.props = props || {}
          this.children = children || []
        }
      }

      // Primitives - return VNodes
      export function Box(props) { return new VNode('Box', props, props.children ? [props.children] : []) }
      export function Text(props) { return new VNode('Text', props, props.children ? [props.children] : []) }
      export function Col(props) { return new VNode('Col', props, props.children || []) }
      export function Row(props) { return new VNode('Row', props, props.children || []) }
      export function Spacer(props) { return new VNode('Spacer', props, []) }
      export function Slot(props) { return new VNode('Slot', props, []) }
      export function Icon(props) { return new VNode('Icon', props, []) }
      export function Image(props) { return new VNode('Image', props, []) }
      export const Fragment = React.Fragment

      // Convert VNode to React element
      export function toReact(vnode) {
        if (!vnode || typeof vnode !== 'object') return vnode
        if (!(vnode instanceof VNode)) return vnode

        const { type, props, children } = vnode
        const style = {}

        // Map props to styles
        if (props.bg) style.backgroundColor = resolveToken('background', props.bg)
        if (props.padding) style.padding = resolveToken('spacing', props.padding)
        if (props.radius) style.borderRadius = resolveToken('radius', props.radius)
        if (props.color) style.color = resolveToken('color', props.color)
        if (props.size) style.fontSize = resolveToken('typography.size', props.size)
        if (props.weight) style.fontWeight = resolveToken('typography.weight', props.weight)
        if (props.gap) style.gap = resolveToken('spacing', props.gap)

        // Layout types
        if (type === 'Col') { style.display = 'flex'; style.flexDirection = 'column' }
        if (type === 'Row') { style.display = 'flex'; style.flexDirection = 'row' }
        if (type === 'Spacer') { style.flex = 1 }

        const childElements = children.map(c => toReact(c))

        return React.createElement('div', { style }, ...childElements)
      }
    `

    const result = await build({
      stdin: {
        contents: minimalJsx,
        loader: 'ts',
        resolveDir: __dirname,
      },
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2020',
      minify: true,
      plugins: [
        {
          name: 'jsx-externals',
          setup(build) {
            build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, () => {
              return { path: vendorPath, external: true }
            })
          },
        },
      ],
    })

    const jsFile = result.outputFiles?.find(f => f.path.endsWith('.js')) || result.outputFiles?.[0]
    if (!jsFile) {
      return { success: false, code: '', error: 'No output generated' }
    }

    return { success: true, code: jsFile.text }
  } catch (err) {
    return {
      success: false,
      code: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
