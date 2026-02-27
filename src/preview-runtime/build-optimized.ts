import type { PreviewConfig } from './types'
import { compileTailwind } from './tailwind'
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, statSync } from 'fs'
import path from 'path'
import { tmpdir } from 'os'

function existsAsFile(p: string): boolean {
  try { return statSync(p).isFile() } catch { return false }
}

export interface OptimizedBuildOptions {
  vendorPath: string
  jsxPath?: string
  resolveDir?: string
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
    const resolveDir = options.resolveDir || '/'

    // Index files by their path for quick lookup
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

    // Write all virtual files to a temp directory for Bun.build
    const tempDir = mkdtempSync(path.join(tmpdir(), 'prev-optimized-'))
    const entryPath = path.join(tempDir, '__entry.tsx')

    try {
      writeFileSync(entryPath, entryCode)

      // Write virtual files to temp dir
      for (const [filePath, file] of Object.entries(virtualFs)) {
        const targetPath = path.join(tempDir, filePath)
        const dir = path.dirname(targetPath)
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(targetPath, file.contents)
      }

      const result = await Bun.build({
        entrypoints: [entryPath],
        format: 'esm',
        target: 'browser',
        minify: true,
        jsx: { runtime: 'automatic', importSource: 'react' },
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

              // Intercept CSS imports to collect them
              build.onLoad({ filter: /\.css$/ }, args => {
                // Read from temp dir or resolveDir
                let content: string
                const tempPath = args.path
                if (existsSync(tempPath)) {
                  content = readFileSync(tempPath, 'utf-8')
                } else {
                  const diskPath = path.resolve(resolveDir, path.relative(tempDir, tempPath))
                  if (existsSync(diskPath)) {
                    content = readFileSync(diskPath, 'utf-8')
                  } else {
                    return { contents: '', loader: 'js' }
                  }
                }
                userCssCollected.push(content)
                return { contents: '', loader: 'js' }
              })

              // Resolve relative imports that might need to fall back to resolveDir
              build.onResolve({ filter: /^\.\.?\// }, args => {
                const resolved = path.resolve(path.dirname(args.importer), args.path)
                // If it exists in temp dir as a file, let Bun handle it
                const tryExts = ['.tsx', '.ts', '.jsx', '.js', '.css']
                const tryIndex = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js']
                if (existsAsFile(resolved)) return undefined
                for (const ext of tryExts) {
                  if (existsAsFile(resolved + ext)) return undefined
                }
                for (const idx of tryIndex) {
                  if (existsAsFile(resolved + idx)) return undefined
                }
                // Fall back: resolve using original directory structure
                const importerRelative = path.relative(tempDir, args.importer)
                const originalDir = path.resolve(resolveDir, path.dirname(importerRelative))
                const diskPath = path.resolve(originalDir, args.path)
                if (existsAsFile(diskPath)) return { path: diskPath }
                for (const ext of tryExts) {
                  if (existsAsFile(diskPath + ext)) {
                    return { path: diskPath + ext }
                  }
                }
                for (const idx of tryIndex) {
                  if (existsAsFile(diskPath + idx)) {
                    return { path: diskPath + idx }
                  }
                }
                return undefined
              })
            },
          },
        ],
      })

      if (!result.success) {
        const errors = result.logs.filter(l => l.level === 'error').map(l => l.message).join('; ')
        return { success: false, html: '', css: '', error: errors || 'Build failed' }
      }

      const jsFile = result.outputs.find(f => f.path.endsWith('.js')) || result.outputs[0]
      let jsCode = jsFile ? await jsFile.text() : ''

      // Fix bare specifiers in output — Bun.build externalizes but keeps original specifiers
      const jsxPath = options.jsxPath || options.vendorPath.replace('runtime.js', 'jsx.js')
      jsCode = jsCode.replace(/from\s*["']react\/jsx(-dev)?-runtime["']/g, `from"${options.vendorPath}"`)
      jsCode = jsCode.replace(/from\s*["']react-dom\/client["']/g, `from"${options.vendorPath}"`)
      jsCode = jsCode.replace(/from\s*["']react-dom["']/g, `from"${options.vendorPath}"`)
      jsCode = jsCode.replace(/from\s*["']react["']/g, `from"${options.vendorPath}"`)
      jsCode = jsCode.replace(/from\s*["']@prev\/jsx["']/g, `from"${jsxPath}"`)
      jsCode = jsCode.replace(/from\s*["']@prev\/components\/[^"']*["']/g, `from"${jsxPath}"`)

      let css = ''
      if (config.tailwind) {
        const tailwindResult = await compileTailwind(
          config.files.map(f => ({ path: f.path, content: f.content }))
        )
        if (tailwindResult.success) css = tailwindResult.css
      }

      // Strip @import "tailwindcss" from user CSS when Tailwind is compiled
      let userCss = userCssCollected.join('\n')
      if (config.tailwind) {
        userCss = userCss.replace(/@import\s*["']tailwindcss["']\s*;?/g, '')
      }
      const allCss = css + '\n' + userCss

      // Canvas styling for showcase presentation
      const canvasStyles = `
        html, body {
          margin: 0;
          min-height: 100vh;
          overflow: hidden;
        }
        body {
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
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (err) {
    return { success: false, html: '', css: '', error: err instanceof Error ? err.message : String(err) }
  }
}
