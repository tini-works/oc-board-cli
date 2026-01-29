import { build } from 'esbuild'
import type { PreviewConfig } from './types'
import { compileTailwind } from './tailwind'

export interface OptimizedBuildOptions {
  vendorPath: string
  jsxPath?: string
}

export interface OptimizedBuildResult {
  success: boolean
  html: string
  css: string
  error?: string
}

export async function buildOptimizedPreview(
  config: PreviewConfig,
  options: OptimizedBuildOptions
): Promise<OptimizedBuildResult> {
  try {
    const virtualFs: Record<string, { contents: string; loader: string }> = {}
    for (const file of config.files) {
      const ext = file.path.split('.').pop()?.toLowerCase()
      const loader = ext === 'css' ? 'css' : ext === 'json' ? 'json' : ext || 'tsx'
      virtualFs[file.path] = { contents: file.content, loader }
    }

    const entryFile = config.files.find(f => f.path === config.entry)
    if (!entryFile) {
      return { success: false, html: '', css: '', error: `Entry file not found: ${config.entry}` }
    }

    const hasDefaultExport = /export\s+default/.test(entryFile.content)
    const userCssCollected: string[] = []

    const entryCode = hasDefaultExport
      ? `
      import React, { createRoot } from '${options.vendorPath}'
      import App from './${config.entry}'
      const root = createRoot(document.getElementById('root'))
      root.render(React.createElement(App))
    `
      : `import './${config.entry}'`

    const result = await build({
      stdin: { contents: entryCode, loader: 'tsx', resolveDir: '/' },
      bundle: true,
      write: false,
      format: 'esm',
      jsx: 'automatic',
      jsxImportSource: 'react',
      target: 'es2020',
      minify: true,
      plugins: [
        {
          name: 'optimized-preview',
          setup(build) {
            // External: vendor runtime
            build.onResolve(
              { filter: new RegExp(options.vendorPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) },
              args => {
                return { path: args.path, external: true }
              }
            )

            // External: React (map to vendor bundle)
            build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, () => {
              return { path: options.vendorPath, external: true }
            })

            // External: @prev/jsx (map to jsx bundle)
            build.onResolve({ filter: /^@prev\/jsx$/ }, () => {
              const jsxPath = options.jsxPath || options.vendorPath.replace('runtime.js', 'jsx.js')
              return { path: jsxPath, external: true }
            })

            // External: @prev/components/* (not supported in static builds yet)
            build.onResolve({ filter: /^@prev\/components\// }, args => {
              console.warn(`    Warning: @prev/components imports not supported in static builds: ${args.path}`)
              return { path: args.path, external: true }
            })

            // Resolve relative imports
            build.onResolve({ filter: /^\./ }, args => {
              let resolved = args.path.replace(/^\.\//, '')
              if (!resolved.includes('.')) {
                for (const ext of ['.tsx', '.ts', '.jsx', '.js', '.css']) {
                  if (virtualFs[resolved + ext]) {
                    resolved = resolved + ext
                    break
                  }
                }
              }
              return { path: resolved, namespace: 'virtual' }
            })

            // Load from virtual FS
            build.onLoad({ filter: /.*/, namespace: 'virtual' }, args => {
              const file = virtualFs[args.path]
              if (file) {
                if (file.loader === 'css') {
                  userCssCollected.push(file.contents)
                  return { contents: '', loader: 'js' }
                }
                return { contents: file.contents, loader: file.loader as any }
              }
              return { contents: '', loader: 'empty' }
            })
          },
        },
      ],
    })

    const jsFile = result.outputFiles?.find(f => f.path.endsWith('.js')) || result.outputFiles?.[0]
    const jsCode = jsFile?.text || ''

    let css = ''
    if (config.tailwind) {
      const tailwindResult = await compileTailwind(
        config.files.map(f => ({ path: f.path, content: f.content }))
      )
      if (tailwindResult.success) css = tailwindResult.css
    }

    // Strip @import "tailwindcss" from user CSS when Tailwind is compiled
    // (the import is Tailwind v4 dev syntax, not valid for static HTML)
    let userCss = userCssCollected.join('\n')
    if (config.tailwind) {
      userCss = userCss.replace(/@import\s*["']tailwindcss["']\s*;?/g, '')
    }
    const allCss = css + '\n' + userCss

    const jsxPath = options.jsxPath || options.vendorPath.replace('runtime.js', 'jsx.js')

    // Canvas styling for showcase presentation
    const canvasStyles = `
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #fafafa;
        background-image:
          radial-gradient(circle at center, #e5e5e5 1px, transparent 1px);
        background-size: 16px 16px;
        padding: 24px;
        box-sizing: border-box;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background-color: #171717;
          background-image:
            radial-gradient(circle at center, #262626 1px, transparent 1px);
        }
      }
      #root {
        background: white;
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
        max-width: 100%;
      }
      @media (prefers-color-scheme: dark) {
        #root {
          background: #1c1c1c;
          box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.06);
        }
      }
    `

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>${allCss}</style>
  <style>${canvasStyles}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${options.vendorPath}"></script>
  <script type="module" src="${jsxPath}"></script>
  <script type="module">${jsCode}</script>
</body>
</html>`

    return { success: true, html, css: allCss }
  } catch (err) {
    return { success: false, html: '', css: '', error: err instanceof Error ? err.message : String(err) }
  }
}
