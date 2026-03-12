// sot.ts — SOT file listing and content serving
import path from 'path'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'

export interface SotFile {
  path: string       // relative to rootDir, e.g. "flows/login.md"
  title: string      // derived from frontmatter or filename
  type: 'flow' | 'screen' | 'doc' | 'ref'
  ext: 'md' | 'mdx'
}

const SKIP_DIRS = new Set(['.prev-boards', 'node_modules', '.git', 'previews'])
const SKIP_FILES = new Set(['index.md', 'index.mdx'])

function extractTitle(content: string, filename: string): string {
  const fm = content.match(/^---[\s\S]*?---/)
  if (fm) {
    const t = fm[0].match(/^title:\s*(.+)$/m)
    if (t) return t[1].trim().replace(/^['"]|['"]$/g, '')
  }
  const h1 = content.match(/^#\s+(.+)$/m)
  if (h1) return h1[1].trim()
  return filename.replace(/\.(md|mdx)$/, '').replace(/[-_]/g, ' ')
}

function inferType(relPath: string): SotFile['type'] {
  const parts = relPath.split('/')
  const dir = parts[0]
  if (dir === 'flows') return 'flow'
  if (dir === 'screens' || dir === 'ui') return 'screen'
  if (dir === 'refs') return 'ref'
  return 'doc'
}

function hasMermaid(content: string): boolean {
  return /```mermaid/.test(content)
}

function walk(dir: string, rootDir: string, results: SotFile[]) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, rootDir, results)
    } else if (/\.(md|mdx)$/.test(entry) && !SKIP_FILES.has(entry)) {
      const rel = path.relative(rootDir, full)
      const ext = entry.endsWith('.mdx') ? 'mdx' : 'md'
      let type = inferType(rel)
      // md files with mermaid blocks are flows even outside /flows
      if (ext === 'md') {
        try {
          const content = readFileSync(full, 'utf-8')
          if (hasMermaid(content)) type = 'flow'
          const title = extractTitle(content, entry)
          results.push({ path: rel, title, type, ext })
        } catch { /* skip */ }
      } else {
        try {
          const content = readFileSync(full, 'utf-8')
          const title = extractTitle(content, entry)
          results.push({ path: rel, title, type: type === 'doc' ? 'screen' : type, ext })
        } catch { /* skip */ }
      }
    }
  }
}

export function createSotHandler(rootDir: string) {
  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)
    const { pathname } = url

    // GET /__prev/sot/list — all SOT files
    if (pathname === '/__prev/sot/list' && req.method === 'GET') {
      const files: SotFile[] = []
      if (existsSync(rootDir)) walk(rootDir, rootDir, files)
      // Sort: flows first, then screens, refs, docs
      const order: Record<string, number> = { flow: 0, screen: 1, ref: 2, doc: 3 }
      files.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.path.localeCompare(b.path))
      return Response.json(files)
    }

    // GET /__prev/sot/content?path=... — file content
    if (pathname === '/__prev/sot/content' && req.method === 'GET') {
      const relPath = url.searchParams.get('path') || ''
      // Security: no path traversal
      const abs = path.resolve(rootDir, relPath)
      if (!abs.startsWith(path.resolve(rootDir))) {
        return Response.json({ error: 'invalid path' }, { status: 400 })
      }
      if (!existsSync(abs)) {
        return Response.json({ error: 'not found' }, { status: 404 })
      }
      const content = readFileSync(abs, 'utf-8')
      return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    return null
  }
}
