// screen-render.ts — JSON render v2 screen preview
// Serves the pre-built Next.js static export from json-render-v2-app/out/.
// The v2 app supports ?screen=X for standalone screen rendering (no explorer sidebar).
import path from 'path'
import { existsSync, readdirSync, statSync } from 'fs'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.txt': 'text/plain',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/**
 * @param jsonRenderBaseDir - parent dir containing json-render-ui/, json-render/
 * @param v2AppDir - optional direct path to json-render-v2-app/ (overrides baseDir/json-render-v2-app)
 */
export function createScreenRenderHandler(jsonRenderBaseDir: string, v2AppDir?: string) {
  const resolvedV2AppDir = v2AppDir || path.resolve(jsonRenderBaseDir, 'json-render-v2-app')
  const v2OutDir = path.resolve(resolvedV2AppDir, 'out')
  const specsDir = path.resolve(jsonRenderBaseDir, 'json-render', 'specs')

  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)
    const { pathname } = url

    // ── Screen render page: /__prev/screen-render?screen=login ──────────
    // Serves the v2 app's index.html — the ?screen param is read client-side
    if (pathname === '/__prev/screen-render') {
      const indexPath = path.join(v2OutDir, 'index.html')
      if (!existsSync(indexPath)) {
        return new Response('v2 app not built. Run: cd json-render-v2-app && npm run build', { status: 404 })
      }
      return new Response(Bun.file(indexPath), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // ── v2 static assets: /_next/static/*, favicon.ico, etc. ────────────
    // The v2 app's HTML references /_next/static/... assets
    if (pathname.startsWith('/_next/')) {
      const filePath = path.resolve(v2OutDir, pathname.slice(1))
      if (!filePath.startsWith(v2OutDir)) return null
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = path.extname(filePath)
        return new Response(Bun.file(filePath), {
          headers: {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'public,max-age=31536000,immutable',
          },
        })
      }
      return null
    }

    // ── JSON render spec files: /json-render/* ──────────────────────────
    // The v2 app fetches /json-render/specs/login.json and /json-render/catalog.json
    if (pathname.startsWith('/json-render/')) {
      const relPath = pathname.slice('/json-render/'.length)
      if (!relPath || relPath.includes('..')) return null
      // Try from v2 out dir first (public/ files), then from SOT json-render/
      const fromOut = path.resolve(v2OutDir, 'json-render', relPath)
      const fromSot = path.resolve(jsonRenderBaseDir, 'json-render', relPath)
      const filePath = existsSync(fromOut) ? fromOut : existsSync(fromSot) ? fromSot : null
      if (!filePath) return null
      const ext = path.extname(filePath)
      return new Response(Bun.file(filePath), {
        headers: { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' },
      })
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

    // ── Legacy: serve old json-render-ui static files (keep for compat) ─
    if (pathname.startsWith('/__prev/json-render-ui/')) {
      const uiDir = path.resolve(jsonRenderBaseDir, 'json-render-ui')
      const file = pathname.slice('/__prev/json-render-ui/'.length)
      if (!file || file.includes('..')) return new Response('Forbidden', { status: 403 })
      const filePath = path.resolve(uiDir, file)
      if (!filePath.startsWith(uiDir)) return new Response('Forbidden', { status: 403 })
      if (!existsSync(filePath)) return new Response('Not found', { status: 404 })
      const ext = path.extname(filePath)
      return new Response(Bun.file(filePath), {
        headers: { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' },
      })
    }

    // ── Legacy: serve spec files at __prev path ─────────────────────────
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
