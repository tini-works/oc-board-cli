import { build } from 'esbuild'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

// Resolve from CLI's location, not user's project (React is our dependency)
const __dirname = dirname(fileURLToPath(import.meta.url))

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
