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
import { createBoardHandler, registerBoardWsClient } from './routes/board'
import { createSotHandler } from './routes/sot'
import { BoardQueueProcessor } from './board-queue'
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

// ── A2UI renderer page ────────────────────────────────────────────────────────
// Serves a themed HTML page that loads the a2ui bundle, applies the docliq
// design token theme, fetches a .jsonl file from the SOT, and renders it.
//
// Theme strategy:
//  • CSS custom properties on <openclaw-a2ui-host> → palette vars (--p-*, --n-*, etc.)
//    These cascade into Lit shadow roots.
//  • host.themeProvider.setValue(docliqTheme) → injects class names + additionalStyles
//    into every component via Lit Context.
//
// Palette mapping (design tokens → Material3-style shades 0–100):
//  p  = teal   (brand primary)
//  s  = slate  (secondary)
//  t  = coral  (tertiary / accent)
//  n  = charcoal (neutral)
//  nv = slate  (neutral variant)
//  e  = coral  (error)
function buildA2UIRenderer(src: string, _rootDir: string): string {
  const encodedSrc = JSON.stringify(src)
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>A2UI Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap" rel="stylesheet"/>
  <style>
    /* ── Page shell ──────────────────────────────────────────── */
    :root { color-scheme: dark; }
    html, body {
      height: 100%; margin: 0;
      background: #0F1719;          /* charcoal-800 */
      font-family: "DM Sans", system-ui, sans-serif;
    }

    /* ── Host element – palette + font vars cascade into shadow DOM ── */
    openclaw-a2ui-host {
      display: block;
      height: 100%;
      position: fixed;
      inset: 0;
      overflow-y: auto;
      padding: 24px 20px 40px;
      box-sizing: border-box;

      /* Layout insets */
      --openclaw-a2ui-inset-top: 0px;
      --openclaw-a2ui-inset-right: 0px;
      --openclaw-a2ui-inset-bottom: 0px;
      --openclaw-a2ui-inset-left: 0px;

      /* Font */
      --font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-family-mono: "JetBrains Mono", monospace;

      /* Color scheme (enables light-dark() in structural styles) */
      --color-scheme: dark;

      /* ── Primary palette: teal ─────────────────────────────── */
      --p-0:   #000000; --p-5:   #053B43; --p-10:  #085560;
      --p-15:  #096670; --p-20:  #0B6F7C; --p-25:  #0D7A88;
      --p-30:  #0F8A99; --p-35:  #119FAA; --p-40:  #13A3B5;
      --p-50:  #40B3C3; --p-60:  #6EC6D0; --p-70:  #9DD9E0;
      --p-80:  #C5E9ED; --p-90:  #E8F6F8; --p-95:  #F3FBFC;
      --p-98:  #F8FDFE; --p-99:  #FBFEFF; --p-100: #FFFFFF;

      /* ── Neutral palette: charcoal ────────────────────────── */
      --n-0:   #0A1012; --n-5:   #0F1719; --n-10:  #131D21;
      --n-15:  #161F23; --n-20:  #182428; --n-25:  #1A2629;
      --n-30:  #1C2A30; --n-35:  #2D4149; --n-40:  #4E5D64;
      --n-50:  #748188; --n-60:  #9DA6AA; --n-70:  #C5CACC;
      --n-80:  #E8EAEB; --n-90:  #F4F5F5; --n-95:  #F9FAFA;
      --n-98:  #FDFEFE; --n-99:  #FEFEFE; --n-100: #FFFFFF;

      /* ── Neutral-variant palette: slate ───────────────────── */
      --nv-0:  #0A1012; --nv-5:  #161E22; --nv-10: #1F292D;
      --nv-15: #263137; --nv-20: #2E3D43; --nv-25: #374951;
      --nv-30: #3E5159; --nv-35: #445A62; --nv-40: #4E666F;
      --nv-50: #5E7A86; --nv-60: #7C939D; --nv-70: #9AABB3;
      --nv-80: #B8C3C9; --nv-90: #D5DBDF; --nv-95: #EEF1F3;
      --nv-98: #F8F9FA; --nv-99: #FBFCFC; --nv-100: #FFFFFF;

      /* ── Secondary palette: slate ─────────────────────────── */
      --s-0:  #0A1012; --s-10: #1F292D; --s-20: #2E3D43;
      --s-30: #3E5159; --s-40: #4E666F; --s-50: #5E7A86;
      --s-60: #7C939D; --s-70: #9AABB3; --s-80: #B8C3C9;
      --s-90: #D5DBDF; --s-95: #EEF1F3; --s-98: #F8F9FA;
      --s-99: #FBFCFC; --s-100: #FFFFFF;

      /* ── Tertiary palette: coral ──────────────────────────── */
      --t-0:  #000000; --t-10: #772D21; --t-20: #A03D2D;
      --t-30: #C9503A; --t-40: #E06A4F; --t-50: #E88A73;
      --t-60: #EC9488; --t-70: #F0AD9E; --t-80: #F5C7BC;
      --t-90: #FAE0D9; --t-95: #FDF3F0; --t-98: #FEF9F8;
      --t-99: #FFF9F8; --t-100: #FFFFFF;

      /* ── Error palette: coral ─────────────────────────────── */
      --e-0:  #000000; --e-10: #772D21; --e-20: #A03D2D;
      --e-30: #C9503A; --e-40: #E06A4F; --e-50: #E88A73;
      --e-60: #EC9488; --e-70: #F0AD9E; --e-80: #F5C7BC;
      --e-90: #FAE0D9; --e-95: #FDF3F0; --e-98: #FEF9F8;
      --e-99: #FFF9F8; --e-100: #FFFFFF;
    }

    #loading {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      font: 13px "DM Sans", system-ui; color: rgba(255,255,255,0.35); pointer-events: none; z-index: 10;
    }
    #err {
      position: fixed; bottom: 12px; left: 12px; right: 12px;
      background: rgba(224,106,79,0.15); border: 1px solid rgba(224,106,79,0.4);
      color: #F0AD9E; padding: 10px 14px; border-radius: 10px;
      font: 12px "JetBrains Mono", monospace; display: none; z-index: 20;
    }
  </style>
</head>
<body>
  <div id="loading">Rendering…</div>
  <div id="err"></div>
  <openclaw-a2ui-host></openclaw-a2ui-host>
  <script src="/__prev/a2ui-bundle.js"></script>
  <script>
    // ── Docliq design token theme ────────────────────────────────────────────
    // Applies our token palette to A2UI's structural CSS class system.
    //
    // Class naming reference (structural styles inside the bundle):
    //  color-bgc-{key}   → background-color: light-dark(var(--{key-light}), var(--{key-dark}))
    //  color-c-{key}     → color: light-dark(...)
    //  color-bc-{key}    → border-color: light-dark(...)
    //  border-br-{n}     → border-radius: n*4px
    //  border-bw-{n}     → border-width: npx
    //  border-bs-s       → border-style: solid
    //  typography-f-s    → font-family: var(--font-family)
    //  typography-f-c    → font-family: var(--font-family-mono)
    //  typography-sz-*   → font-size + line-height (Material scale)
    //  typography-w-{n}  → font-weight: n
    //
    // In dark mode, light-dark(var(--x-N), var(--x-inverse)) uses inverse shade (100-N).
    // So color-bgc-n90 dark mode → --n-10 = #131D21 (dark card surface) ✓
    //    color-c-n10  dark mode  → --n-90 = #F4F5F5 (light text) ✓
    //    color-bgc-p40 dark mode → --p-60 = #6EC6D0 (teal button) ✓

    const docliqTheme = {
      components: {
        // ── Typography ───────────────────────────────────────────────────────
        Text: {
          // Applied to every Text element
          all: { 'typography-f-s': true, 'color-c-n10': true },
          // Per-hint class overrides (no font-size here — see additionalStyles)
          h1: { 'typography-w-700': true },
          h2: { 'typography-w-600': true },
          h3: { 'typography-w-600': true },
          h4: { 'typography-w-500': true },
          h5: { 'typography-w-500': true },
          body: { 'typography-w-400': true },
          caption: { 'typography-w-400': true, 'color-c-n40': true },
        },

        // ── Interactive components ───────────────────────────────────────────
        // All buttons get primary teal styling; dark mode: bg=p-60 (#6EC6D0), text=p-0 (#000)
        Button: {
          'color-bgc-p40': true,  // dark: var(--p-60) = teal-300
          'color-c-p100': true,   // dark: var(--p-0)  = black (legible on teal)
          'border-br-3': true,    // radius: 12px
          'typography-f-s': true,
          'typography-w-500': true,
        },

        // ── Layout cards ─────────────────────────────────────────────────────
        // dark: bg = --n-10 = #131D21 (charcoal-700), radius 16px
        Card: {
          'color-bgc-n90': true,
          'border-br-4': true,
        },

        // ── Form elements ────────────────────────────────────────────────────
        TextField: {
          container: {},
          element: { 'color-bgc-nv90': true, 'border-br-2': true, 'typography-f-s': true },
          label: { 'typography-f-s': true, 'color-c-n40': true },
        },
        CheckBox: {
          container: {},
          element: { 'color-bc-p40': true, 'border-bw-2': true, 'border-bs-s': true, 'border-br-1': true },
          label: { 'typography-f-s': true },
        },
        Slider: {
          container: {},
          element: { 'color-bc-p40': true },
          // Slider always renders a <span> with the raw number value; make it subtle
          label: { 'typography-sz-ls': true, 'color-c-n40': true },
        },
        MultipleChoice: {
          container: {},
          element: {
            'color-bgc-nv90': true,
            'color-bc-p40': true, 'border-bw-2': true, 'border-bs-s': true, 'border-br-2': true,
          },
          label: { 'typography-f-s': true },
        },
        DateTimeInput: {
          container: {},
          element: { 'color-bgc-nv90': true, 'border-br-2': true, 'typography-f-s': true },
          label: { 'typography-f-s': true, 'color-c-n40': true },
        },

        // ── Tabs ─────────────────────────────────────────────────────────────
        Tabs: {
          container: { 'color-bgc-n90': true, 'border-br-3': true },
          element: {},
          controls: {
            all: { 'typography-f-s': true, 'typography-w-400': true, 'color-c-n40': true },
            // dark: active tab text = --p-60 = teal-300
            selected: { 'typography-w-600': true, 'color-c-p40': true },
          },
        },

        // ── Misc ─────────────────────────────────────────────────────────────
        // dark: divider = --n-70 = #C5CACC → inverse --n-30 = #1C2A30
        Divider: { 'color-bgc-n70': true },
        Modal: {
          backdrop: { 'color-bbgc-n10_50': true },
          element: { 'color-bgc-n90': true, 'border-br-5': true },
        },
        List: {},
        Row: {},
        Column: {},
        AudioPlayer: {},
        Video: {},
        Icon: {},
        Image: {
          all: {}, icon: {}, avatar: { 'border-br-50pc': true },
          smallFeature: { 'border-br-3': true },
          mediumFeature: { 'border-br-4': true },
          largeFeature: { 'border-br-4': true },
          header: {},
        },
      },

      // ── HTML element classes (used in markdown rendering) ─────────────────
      elements: {
        a: { 'color-c-p40': true, 'typography-f-s': true },
        audio: {},
        body: { 'typography-f-s': true },
        button: { 'typography-f-s': true },
        h1: { 'typography-w-700': true, 'color-c-n10': true },
        h2: { 'typography-w-600': true, 'color-c-n10': true },
        h3: { 'typography-w-600': true, 'color-c-n10': true },
        h4: { 'typography-w-500': true, 'color-c-n10': true },
        h5: { 'typography-w-500': true, 'color-c-n10': true },
        iframe: {},
        input: { 'typography-f-s': true },
        p: { 'color-c-n10': true },
        pre: { 'typography-f-c': true },
        textarea: { 'typography-f-s': true },
        video: {},
      },

      // ── Markdown element classes ──────────────────────────────────────────
      markdown: {
        p:      ['typography-f-s', 'typography-w-400', 'color-c-n10'],
        h1:     ['typography-f-s', 'typography-w-700', 'color-c-n10'],
        h2:     ['typography-f-s', 'typography-w-600', 'color-c-n10'],
        h3:     ['typography-f-s', 'typography-w-600', 'color-c-n10'],
        h4:     ['typography-f-s', 'typography-w-500', 'color-c-n10'],
        h5:     ['typography-f-s', 'typography-w-500', 'color-c-n10'],
        ul:     [],
        ol:     [],
        li:     ['typography-f-s', 'color-c-n10'],
        a:      ['color-c-p40'],
        strong: ['typography-w-700'],
        em:     [],
      },

      // ── Inline styles (CSSStyleDeclaration format) ───────────────────────
      additionalStyles: {
        // Per-hint typography from design tokens
        Text: {
          h1:      { fontSize: '1.75rem', lineHeight: '1.35',  letterSpacing: '-0.02em' },
          h2:      { fontSize: '1.5rem',  lineHeight: '1.35',  letterSpacing: '-0.02em' },
          h3:      { fontSize: '1.25rem', lineHeight: '1.375', letterSpacing: '-0.01em' },
          h4:      { fontSize: '1.125rem',lineHeight: '1.5',   letterSpacing: '-0.01em' },
          h5:      { fontSize: '1rem',    lineHeight: '1.5',   letterSpacing: '0' },
          body:    { fontSize: '1rem',    lineHeight: '1.5',   letterSpacing: '0' },
          caption: { fontSize: '0.75rem', lineHeight: '1.4',   letterSpacing: '0.02em' },
        },
        // Button: NO width:100% — let the <button> size to its content.
        // The host has flex:1 from the parent, but the visible element auto-sizes.
        Button: {
          padding: '10px 18px',
          letterSpacing: '-0.01em',
          transition: 'opacity 150ms ease',
        },
        // Card: padding only — no flex overrides (Card source uses ::slotted height:100%)
        Card: {
          padding: '16px 20px',
        },
        // Row: critical — source has NO gap, children pack without spacing
        Row: {
          gap: '8px',
        },
        // Column: critical — source has NO gap, items stack without breathing room
        Column: {
          gap: '10px',
        },
      },
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    const src = ${encodedSrc}
    const loadingEl = document.getElementById('loading')
    const errEl = document.getElementById('err')

    function showErr(msg) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg }
      if (loadingEl) loadingEl.style.display = 'none'
    }

    async function boot() {
      await customElements.whenDefined('openclaw-a2ui-host')
      if (!src) { showErr('No src= provided'); return }

      // Apply docliq theme via the ContextProvider
      const host = document.querySelector('openclaw-a2ui-host')
      if (host && host.themeProvider) {
        host.themeProvider.setValue(docliqTheme)
      }

      // Fetch JSONL from SOT
      const res = await fetch('/__prev/sot/content?path=' + encodeURIComponent(src))
      if (!res.ok) { showErr('Failed to load ' + src + ' (' + res.status + ')'); return }
      const text = await res.text()

      // Parse JSONL
      const messages = text
        .split('\\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(l => { try { return JSON.parse(l) } catch { return null } })
        .filter(Boolean)

      if (messages.length === 0) { showErr('No valid JSONL messages in: ' + src); return }

      const api = globalThis.openclawA2UI
      if (!api) { showErr('openclawA2UI global not available'); return }
      api.reset()
      api.applyMessages(messages)

      if (loadingEl) loadingEl.style.display = 'none'
    }

    boot().catch(e => showErr(String(e)))
  </script>
</body>
</html>`
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
  const sotHandler = createSotHandler(rootDir)
  const queueProcessor = new BoardQueueProcessor(rootDir)
  queueProcessor.start()
  const previewRuntimePath = path.join(srcRoot, 'preview-runtime/fast-template.html')

  const server = Bun.serve({
    port,

    websocket: {
      open(ws: import('bun').ServerWebSocket<{ boardId: string; cleanup: () => void }>) {
        const { boardId } = ws.data
        const cleanup = registerBoardWsClient(rootDir, boardId, (data) => {
          try { ws.send(data) } catch { /* closed */ }
        })
        ws.data.cleanup = cleanup
      },
      message(_ws: import('bun').ServerWebSocket<{ boardId: string; cleanup: () => void }>, _msg: string | Buffer) {
        // clients are receive-only; ignore inbound WS messages
      },
      close(ws: import('bun').ServerWebSocket<{ boardId: string; cleanup: () => void }>) {
        ws.data.cleanup?.()
      },
    },

    async fetch(req, server) {
      const url = new URL(req.url)
      const pathname = url.pathname

      // WebSocket upgrade for board channel /__prev/board/:id/ws
      const wsMatch = pathname.match(/^\/__prev\/board\/([a-zA-Z0-9_-]+)\/ws$/)
      if (wsMatch) {
        const boardId = wsMatch[1]
        const upgraded = server.upgrade(req, { data: { boardId, cleanup: () => {} } })
        if (upgraded) return undefined as unknown as Response
        return new Response('WebSocket upgrade failed', { status: 426 })
      }

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

      // SOT file listing + content
      const sotResponse = await sotHandler(req)
      if (sotResponse) return sotResponse

      // A2UI bundle served from OpenClaw
      if (pathname === '/__prev/a2ui-bundle.js') {
        const bundlePath = path.join(srcRoot, 'theme/a2ui.bundle.js')
        try {
          const js = readFileSync(bundlePath)
          return new Response(js, { headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'public,max-age=3600' } })
        } catch { return new Response('// bundle not found', { status: 404, headers: { 'Content-Type': 'application/javascript' } }) }
      }

      // A2UI renderer page — loads JSONL from SOT and renders via a2ui bundle
      if (pathname === '/__prev/a2ui-render') {
        const src = url.searchParams.get('src') ?? ''
        const a2uiHtml = buildA2UIRenderer(src, rootDir)
        return new Response(a2uiHtml, { headers: { 'Content-Type': 'text/html' } })
      }

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
      queueProcessor.stop()
      server.stop()
    },
  }
}
