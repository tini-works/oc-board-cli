import { join, dirname } from 'path'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

// Find CLI root for module resolution (React is our dependency)
function findCliRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i++) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === 'prev-cli') return dir
      } catch {}
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return dirname(dirname(fileURLToPath(import.meta.url)))
}

const cliRoot = findCliRoot()

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
      export { jsxDEV } from 'react/jsx-dev-runtime'
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

    // Write temp file in CLI root so React can be resolved from node_modules
    const tempDir = mkdtempSync(join(cliRoot, '.tmp-vendor-'))
    const entryPath = join(tempDir, 'entry.ts')

    try {
      writeFileSync(entryPath, entryCode)

      const result = await Bun.build({
        entrypoints: [entryPath],
        format: 'esm',
        target: 'browser',
        minify: true,
      })

      if (!result.success) {
        const errors = result.logs.filter(l => l.level === 'error').map(l => l.message).join('; ')
        return { success: false, code: '', error: errors || 'Build failed' }
      }

      const jsFile = result.outputs.find(f => f.path.endsWith('.js')) || result.outputs[0]
      if (!jsFile) {
        return { success: false, code: '', error: 'No output generated' }
      }

      return { success: true, code: await jsFile.text() }
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (err) {
    return {
      success: false,
      code: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Build @prev/jsx bundle for static preview builds
 * React is externalized, so temp dir location doesn't matter for resolution
 */
export async function buildJsxBundle(vendorPath: string): Promise<VendorBundleResult> {
  try {
    const minimalJsx = `
      import * as React from 'react'

      // Default token values for standalone preview rendering
      const defaultTokens = {
        background: {
          primary: '#3b82f6',
          secondary: '#f1f5f9',
          destructive: '#ef4444',
          muted: '#f1f5f9',
          accent: '#f1f5f9',
          transparent: 'transparent',
        },
        color: {
          'primary-foreground': '#ffffff',
          'secondary-foreground': '#0f172a',
          'destructive-foreground': '#ffffff',
          'muted-foreground': '#64748b',
          'accent-foreground': '#0f172a',
          foreground: '#0f172a',
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '12px',
          lg: '16px',
          xl: '24px',
        },
        radius: {
          none: '0',
          sm: '4px',
          md: '6px',
          lg: '8px',
          full: '9999px',
        },
        'typography.size': {
          xs: '12px',
          sm: '14px',
          base: '16px',
          lg: '18px',
          xl: '20px',
        },
        'typography.weight': {
          normal: '400',
          medium: '500',
          semibold: '600',
          bold: '700',
        },
      }

      // Token resolution
      let tokensConfig = null
      export function setTokensConfig(config) { tokensConfig = config }

      function resolveToken(category, token) {
        // Check custom config first, then defaults
        const config = tokensConfig || defaultTokens
        const cat = config[category]
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

    // React is externalized via plugin, so temp dir location doesn't matter
    const tempDir = mkdtempSync(join(tmpdir(), 'prev-jsx-'))
    const entryPath = join(tempDir, 'entry.ts')

    try {
      writeFileSync(entryPath, minimalJsx)

      const result = await Bun.build({
        entrypoints: [entryPath],
        format: 'esm',
        target: 'browser',
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

      if (!result.success) {
        const errors = result.logs.filter(l => l.level === 'error').map(l => l.message).join('; ')
        return { success: false, code: '', error: errors || 'Build failed' }
      }

      const jsFile = result.outputs.find(f => f.path.endsWith('.js')) || result.outputs[0]
      if (!jsFile) {
        return { success: false, code: '', error: 'No output generated' }
      }

      // Fix bare specifiers — Bun.build keeps original import paths for externals
      let code = await jsFile.text()
      code = code.replace(/from\s*["']react["']/g, `from"${vendorPath}"`)

      return { success: true, code }
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (err) {
    return {
      success: false,
      code: '',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
