// screen-render.ts — JSON render adapter screen preview
// Bundles json-render-adapter lib files on-the-fly with Bun.build() and serves
// a self-contained HTML page that renders a spec via ShellRenderer.
// Watches the adapter dir for changes and auto-rebuilds.
import path from 'path'
import { existsSync, readdirSync, readFileSync, symlinkSync, unlinkSync } from 'fs'

const cliRoot = path.resolve(import.meta.dirname, '../../..')

/** Cached bundle: { js, css, builtAt } */
let bundleCache: { js: string; css: string; builtAt: number } | null = null
let building = false

function isAdapterReady(dir: string): boolean {
  return existsSync(path.resolve(dir, 'lib/render/usage.tsx'))
}

/**
 * Ensure the json-render-adapter dir can resolve packages from the board's node_modules.
 */
function ensureNodeModulesLink(dir: string) {
  const target = path.resolve(cliRoot, 'node_modules')
  const link = path.join(dir, 'node_modules')
  if (existsSync(link)) return
  symlinkSync(target, link, 'dir')
}

async function buildBundle(dir: string): Promise<{ js: string; css: string }> {
  if (!isAdapterReady(dir)) {
    throw new Error(`json-render-adapter lib not found at ${dir}/lib/render/`)
  }

  ensureNodeModulesLink(dir)

  // Entry file — uses ShellRenderer to wrap spec in app chrome (sidebar, header, etc.)
  const entryCode = `
import { createRoot } from "react-dom/client";
import { ShellRenderer } from "${path.resolve(dir, 'lib/render/shell')}";

const spec = (window).__SPEC__;
const screenKey = (window).__SCREEN_KEY__;
createRoot(document.getElementById("root")).render(
  <ShellRenderer spec={spec} screenKey={screenKey} />
);
`
  const entryPath = path.join(cliRoot, '.json-render-entry.tsx')
  await Bun.write(entryPath, entryCode)

  try {
    // 1. Bundle JS
    const result = await Bun.build({
      entrypoints: [entryPath],
      format: 'esm',
      target: 'browser',
    })

    if (!result.success) {
      const errors = result.logs.map(l => String(l)).join('\n')
      console.error('[screen-render] Bundle errors:', errors)
      throw new Error(errors)
    }

    let js = ''
    let bundleCss = ''
    for (const output of result.outputs) {
      const text = await output.text()
      if (output.path.endsWith('.css')) {
        bundleCss += text
      } else {
        js += text
      }
    }

    // 2. Compile Tailwind CSS
    const themeCssPath = path.resolve(dir, 'styles/theme.css')
    const themeCssContent = readFileSync(themeCssPath, 'utf-8')
    const twInput = `@source "${path.resolve(dir, 'lib/render')}";\n${themeCssContent}`
    const twInputPath = path.join(cliRoot, '.json-render-tw-input.css')
    await Bun.write(twInputPath, twInput)

    let tailwindCss = ''
    try {
      const twCli = path.resolve(cliRoot, 'node_modules/.bin/tailwindcss')
      const proc = Bun.spawnSync([twCli, '-i', twInputPath, '--minify'], {
        stdout: 'pipe',
        stderr: 'pipe',
        cwd: dir,
      })
      if (proc.exitCode === 0) {
        tailwindCss = proc.stdout.toString()
      } else {
        console.error('[screen-render] Tailwind compile error:', proc.stderr.toString().slice(0, 500))
      }
    } finally {
      try { unlinkSync(twInputPath) } catch {}
    }

    const css = tailwindCss + '\n' + bundleCss
    return { js, css }
  } finally {
    try { unlinkSync(entryPath) } catch {}
  }
}

async function triggerBuild(dir: string) {
  if (building) return
  building = true
  try {
    const { js, css } = await buildBundle(dir)
    bundleCache = { js, css, builtAt: Date.now() }
    console.log('  ✓ json-render-adapter bundled')
  } catch (e: any) {
    // Not an error if dir doesn't exist yet — just waiting
    if (isAdapterReady(dir)) {
      console.error('  ✗ json-render-adapter bundle failed:', e.message)
    }
  } finally {
    building = false
  }
}

/**
 * @param dir - path to json-render-adapter/ output directory (contains lib/, specs/, styles/)
 */
export function createScreenRenderHandler(dir: string) {
  const specsDir = path.resolve(dir, 'specs')

  // Build at startup if ready
  if (isAdapterReady(dir)) {
    triggerBuild(dir)
  } else {
    console.log(`  ⏳ json-render-adapter not ready at ${dir}`)
  }

  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)
    const { pathname } = url

    // ── Screen render page: /__prev/screen-render?screen=login ──────────
    if (pathname === '/__prev/screen-render') {
      const screenKey = url.searchParams.get('screen')
      if (!screenKey) return new Response('Missing ?screen= param', { status: 400 })

      const specPath = path.resolve(specsDir, `${screenKey}.json`)
      if (!specPath.startsWith(specsDir) || !existsSync(specPath)) {
        return new Response(`Screen "${screenKey}" not found`, { status: 404 })
      }

      if (!bundleCache) {
        return new Response(`<html><body style="background:#1c1917;color:#f5f5f4;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh"><p>Bundling json-render-adapter... Refresh in a moment.</p></body></html>`, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      const specJson = readFileSync(specPath, 'utf-8')

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Screen: ${screenKey}</title>
  <link rel="stylesheet" href="/__prev/json-render/bundle.css" />
  <style>
    html, body, #root { height: 100%; width: 100%; margin: 0; }
    body { font-family: 'DM Sans', system-ui, sans-serif; background: var(--background); color: var(--foreground); }
    #root { display: flex; flex-direction: column; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>window.__SPEC__ = ${specJson}; window.__SCREEN_KEY__ = "${screenKey}";</script>
  <script type="module" src="/__prev/json-render/bundle.js"></script>
</body>
</html>`

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // ── Serve bundled JS ─────────────────────────────────────────────────
    if (pathname === '/__prev/json-render/bundle.js') {
      if (!bundleCache) return new Response('Bundle not ready', { status: 503 })
      return new Response(bundleCache.js, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' },
      })
    }

    // ── Serve bundled CSS ────────────────────────────────────────────────
    if (pathname === '/__prev/json-render/bundle.css') {
      if (!bundleCache) return new Response('Bundle not ready', { status: 503 })
      return new Response(bundleCache.css, {
        headers: { 'Content-Type': 'text/css', 'Cache-Control': 'no-cache' },
      })
    }

    // ── Invalidate bundle cache: /__prev/json-render/rebuild ─────────────
    if (pathname === '/__prev/json-render/rebuild' && req.method === 'POST') {
      bundleCache = null
      triggerBuild(dir)
      return Response.json({ ok: true, message: 'Rebuild triggered' })
    }

    // ── List available screens: /__prev/json-render/screens ─────────────
    if (pathname === '/__prev/json-render/screens' && req.method === 'GET') {
      const screens: { key: string; label: string; specFile: string }[] = []
      if (existsSync(specsDir)) {
        for (const file of readdirSync(specsDir)) {
          if (file.endsWith('.json')) {
            const key = file.replace('.json', '')
            const label = key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            screens.push({ key, label, specFile: file })
          }
        }
      }
      return Response.json(screens)
    }

    // ── Serve spec files: /__prev/json-render/specs/* ────────────────────
    if (pathname.startsWith('/__prev/json-render/specs/')) {
      const file = pathname.slice('/__prev/json-render/specs/'.length)
      if (!file || file.includes('..')) return new Response('Forbidden', { status: 403 })
      const filePath = path.resolve(specsDir, file)
      if (!filePath.startsWith(specsDir)) return new Response('Not found', { status: 404 })
      if (!existsSync(filePath)) return new Response('Not found', { status: 404 })
      return new Response(Bun.file(filePath), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return null
  }
}
