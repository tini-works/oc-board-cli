// Dev server using Bun.build() + Bun.serve()
// Bun.serve()'s HTML import bundler doesn't respect Bun.plugin() registrations,
// so we pre-build entry.tsx with Bun.build() (which supports explicit plugins)
// and serve the result from the fetch handler with SSE live reload.
import path from 'path'
import { existsSync, readFileSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { virtualModulesPlugin } from './plugins/virtual-modules'
import { mdxPlugin } from './plugins/mdx'
import { aliasesPlugin } from './plugins/aliases'
import { createPreviewBundleHandler } from './routes/preview-bundle'
import { createPreviewConfigHandler } from './routes/preview-config'
import { createJsxBundleHandler } from './routes/jsx-bundle'
import { createComponentBundleHandler } from './routes/component-bundle'
import { createTokensHandler } from './routes/tokens'
import { handleOgImageRequest } from './routes/og-image'
import { createApprovalHandler } from './routes/approval'
import { createBoardHandler } from './routes/board'
import { loadConfig, updateOrder } from '../config'
import type { PrevConfig } from '../config'

// Find CLI root by locating package.json
function findCliRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === 'prev-cli') return dir
      } catch {}
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)))
}

const cliRoot = findCliRoot()
const srcRoot = path.join(cliRoot, 'src')

export interface DevServerOptions {
  rootDir: string
  port: number
  include?: string[]
  config?: PrevConfig
}

// Build the theme app with Bun.build() — plugins are passed explicitly
async function buildThemeApp(rootDir: string, include?: string[], config?: PrevConfig) {
  const entryPath = path.join(srcRoot, 'theme/entry.tsx')
  const plugins = [
    virtualModulesPlugin({ rootDir, include, config }),
    mdxPlugin({ rootDir }),
    aliasesPlugin({ cliRoot }),
  ]

  const result = await Bun.build({
    entrypoints: [entryPath],
    // No outdir = in-memory build
    format: 'esm',
    target: 'browser',
    plugins,
    jsx: { runtime: 'automatic', importSource: 'react' },
    define: {
      'import.meta.env.DEV': 'true',
      'import.meta.env.BASE_URL': '"/"',
      'process.env.NODE_ENV': '"development"',
    },
  })

  if (!result.success) {
    const errors = result.logs.filter(l => l.level === 'error').map(l => l.message)
    return { js: '', css: '', success: false, errors }
  }

  const jsOutput = result.outputs.find(o => o.path.endsWith('.js'))
  const cssOutput = result.outputs.find(o => o.path.endsWith('.css'))

  return {
    js: jsOutput ? await jsOutput.text() : '',
    css: cssOutput ? await cssOutput.text() : '',
    success: true,
    errors: [] as string[],
  }
}

// HTML shell served for all page routes
const HTML_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Documentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap" as="style" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
  <link rel="stylesheet" href="/__prev/app.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/__prev/app.js"></script>
  <script>
    if (typeof EventSource !== 'undefined') {
      var es = new EventSource('/__prev/events');
      es.onmessage = function() { location.reload(); };
    }
  </script>
</body>
</html>`

export async function startDevServer(options: DevServerOptions) {
  const { rootDir, port, include } = options
  const config = options.config || loadConfig(rootDir)

  // Build theme app with explicit plugins
  console.log('  Building theme...')
  let appBundle = await buildThemeApp(rootDir, include, config)
  if (!appBundle.success) {
    console.error('  Build errors:', appBundle.errors.join('\n'))
  } else {
    console.log('  ✓ Theme built')
  }

  // SSE live reload controllers
  const sseControllers = new Set<ReadableStreamDefaultController>()
  const encoder = new TextEncoder()

  function notifyReload() {
    const msg = encoder.encode('data: reload\n\n')
    for (const ctrl of sseControllers) {
      try { ctrl.enqueue(msg) } catch { sseControllers.delete(ctrl) }
    }
  }

  // Create route handlers
  const previewBundleHandler = createPreviewBundleHandler(rootDir)
  const previewConfigHandler = createPreviewConfigHandler(rootDir)
  const jsxBundleHandler = createJsxBundleHandler(cliRoot)
  const componentBundleHandler = createComponentBundleHandler(rootDir)
  const tokensHandler = createTokensHandler(rootDir)
  const approvalHandler = createApprovalHandler(rootDir, config?.approval?.webhookUrl)
  const boardHandler = createBoardHandler(rootDir)
  const previewRuntimePath = path.join(srcRoot, 'preview-runtime/fast-template.html')

  const server = Bun.serve({
    port,

    async fetch(req) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // SSE live reload endpoint
      if (pathname === '/__prev/events') {
        let ctrl: ReadableStreamDefaultController
        const stream = new ReadableStream({
          start(controller) {
            ctrl = controller
            sseControllers.add(controller)
          },
          cancel() {
            sseControllers.delete(ctrl)
          },
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        })
      }

      // Built app JS bundle
      if (pathname === '/__prev/app.js') {
        return new Response(appBundle.js, {
          headers: { 'Content-Type': 'application/javascript' },
        })
      }

      // Built app CSS
      if (pathname === '/__prev/app.css') {
        return new Response(appBundle.css, {
          headers: { 'Content-Type': 'text/css' },
        })
      }

      // API: Config updates (drag-and-drop reordering)
      if (pathname === '/__prev/config' && req.method === 'POST') {
        try {
          const body = await req.json() as { path: string; order: string[] }
          updateOrder(rootDir, body.path, body.order)
          return Response.json({ success: true })
        } catch (e) {
          return Response.json({ error: String(e) }, { status: 400 })
        }
      }

      // Approval status endpoint
      const approvalResponse = await approvalHandler(req)
      if (approvalResponse) return approvalResponse

      // Board state endpoint
      const boardResponse = await boardHandler(req)
      if (boardResponse) return boardResponse

      // Preview bundle endpoint
      const bundleResponse = await previewBundleHandler(req)
      if (bundleResponse) return bundleResponse

      // Preview config endpoint
      const configResponse = await previewConfigHandler(req)
      if (configResponse) return configResponse

      // JSX bundle endpoint
      const jsxResponse = await jsxBundleHandler(req)
      if (jsxResponse) return jsxResponse

      // Component bundle endpoint
      const componentResponse = await componentBundleHandler(req)
      if (componentResponse) return componentResponse

      // Tokens endpoint
      const tokensResponse = await tokensHandler(req)
      if (tokensResponse) return tokensResponse

      // OG image endpoint
      const ogResponse = handleOgImageRequest(req, [])
      if (ogResponse) return ogResponse

      // Region bridge script for flow interactivity
      if (pathname === '/_prev/region-bridge.js') {
        const { REGION_BRIDGE_SCRIPT } = await import('../preview-runtime/region-bridge')
        return new Response(REGION_BRIDGE_SCRIPT, {
          headers: { 'Content-Type': 'application/javascript' },
        })
      }

      // Preview runtime template
      if (pathname === '/_preview-runtime') {
        if (existsSync(previewRuntimePath)) {
          const html = readFileSync(previewRuntimePath, 'utf-8')
          return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
          })
        }
      }

      // Serve static files from previews dir (for preview assets)
      if (pathname.startsWith('/_preview/')) {
        const relativePath = pathname.slice('/_preview/'.length)
        const previewsDir = path.join(rootDir, 'previews')
        const filePath = path.resolve(previewsDir, relativePath)

        // Security: prevent path traversal; only serve regular files (not directories)
        if (filePath.startsWith(previewsDir) && existsSync(filePath) && statSync(filePath).isFile()) {
          return new Response(Bun.file(filePath))
        }
      }

      // SPA fallback: serve HTML shell for all non-file, non-API routes
      if (!pathname.includes('.') &&
          !pathname.startsWith('/@') &&
          !pathname.startsWith('/__') &&
          !pathname.startsWith('/_preview') &&
          !pathname.startsWith('/_prev')) {
        // Inject OG meta tags for preview routes (deep links)
        if (pathname.startsWith('/previews/') && pathname !== '/previews') {
          const previewPath = pathname.slice('/previews/'.length)
          const searchParams = new URL(req.url).searchParams
          const ogState = searchParams.get('state')
          const ogStep = searchParams.get('step')
          const ogTitle = previewPath.split('/').pop() || 'Preview'
          const ogParams = [
            ogState ? `state=${ogState}` : '',
            ogStep ? `step=${ogStep}` : '',
          ].filter(Boolean).join('&')
          const ogImageUrl = `/_og/${previewPath}${ogParams ? `?${ogParams}` : ''}`

          const ogHtml = HTML_SHELL.replace(
            '<title>Documentation</title>',
            `<title>${ogTitle} - Preview</title>
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogState ? `State: ${ogState}` : ogStep ? `Step: ${ogStep}` : 'Preview'}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />`
          )
          return new Response(ogHtml, {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response(HTML_SHELL, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return new Response('Not Found', { status: 404 })
    },
  })

  // File watcher for live reload
  const { watch } = await import('fs')
  const watchers: ReturnType<typeof watch>[] = []
  let rebuildTimer: Timer | null = null

  async function rebuild() {
    appBundle = await buildThemeApp(rootDir, include, config)
    if (appBundle.success) {
      notifyReload()
    }
  }

  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(rebuild, 150)
  }

  // Watch previews directory for changes
  const previewsDir = path.join(rootDir, 'previews')
  if (existsSync(previewsDir)) {
    watchers.push(watch(previewsDir, { recursive: true }, (_, filename) => {
      if (filename && /\.(tsx|ts|jsx|js|css|yaml|yml|mdx|md|html)$/.test(filename)) {
        scheduleRebuild()
      }
    }))
  }

  return {
    server,
    port: server.port,
    url: `http://localhost:${server.port}/`,
    stop: () => {
      if (rebuildTimer) clearTimeout(rebuildTimer)
      watchers.forEach(w => w.close())
      server.stop()
    },
  }
}
