// sot.ts — SOT file listing and content serving
import path from 'path'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { jsonRenderConfig } from '../../config'

export interface SotFile {
  path: string       // relative to rootDir, e.g. "flows/login.md"
  title: string      // derived from frontmatter or filename
  type: 'flow' | 'screen' | 'doc' | 'ref' | 'a2ui' | 'json-screen'
  ext: 'md' | 'mdx' | 'jsonl' | 'json'
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
  return filename.replace(/\.(md|mdx|jsonl)$/, '').replace(/[-_]/g, ' ')
}

function extractA2UITitle(jsonl: string, filename: string): string {
  // Try to find a Text component with usageHint h1 or h2 in first surfaceUpdate
  try {
    const firstLine = jsonl.split('\n').find(l => l.trim().startsWith('{'))
    if (firstLine) {
      const msg = JSON.parse(firstLine)
      const comps: any[] = msg?.surfaceUpdate?.components ?? []
      for (const c of comps) {
        const hint = c?.component?.Text?.usageHint
        const txt = c?.component?.Text?.text?.literalString
        if ((hint === 'h1' || hint === 'h2') && txt) return txt.replace(/^[^\w]+ ?/, '').trim()
      }
    }
  } catch { /* fall through */ }
  return filename.replace(/\.jsonl$/, '').replace(/[-_]/g, ' ')
}

function inferType(relPath: string, ext: string): SotFile['type'] {
  if (ext === 'jsonl') return 'a2ui'
  const parts = relPath.split('/')
  const dir = parts[0]
  if (dir === 'flows') return 'flow'
  if (dir === 'screens' || dir === 'screens-a2ui' || dir === 'ui') return 'screen'
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
    } else if (/\.(md|mdx|jsonl)$/.test(entry) && !SKIP_FILES.has(entry)) {
      const rel = path.relative(rootDir, full)
      const ext = entry.endsWith('.jsonl') ? 'jsonl' : entry.endsWith('.mdx') ? 'mdx' : 'md'
      const baseType = inferType(rel, ext)

      try {
        const content = readFileSync(full, 'utf-8')
        if (ext === 'jsonl') {
          const title = extractA2UITitle(content, entry)
          results.push({ path: rel, title, type: 'a2ui', ext: 'jsonl' })
        } else if (ext === 'md') {
          let type = baseType
          if (hasMermaid(content)) type = 'flow'
          const title = extractTitle(content, entry)
          results.push({ path: rel, title, type, ext: 'md' })
        } else {
          const title = extractTitle(content, entry)
          results.push({ path: rel, title, type: baseType === 'doc' ? 'screen' : baseType, ext: 'mdx' })
        }
      } catch { /* skip unreadable files */ }
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

      // Append json-render screens if configured
      if (jsonRenderConfig.baseDir) {
        const specsDir = path.resolve(jsonRenderConfig.baseDir, 'json-render', 'specs')
        if (existsSync(specsDir)) {
          for (const file of readdirSync(specsDir)) {
            if (file.endsWith('.json')) {
              const key = file.replace('.json', '')
              const label = key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              files.push({
                path: `json-screen:${key}`,
                title: label,
                type: 'json-screen',
                ext: 'json',
              })
            }
          }
        }
      }

      const order: Record<string, number> = { 'json-screen': 0, a2ui: 1, flow: 2, screen: 3, ref: 4, doc: 5 }
      files.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.path.localeCompare(b.path))
      return Response.json(files)
    }

    // GET /__prev/sot/content?path=... — file content
    if (pathname === '/__prev/sot/content' && req.method === 'GET') {
      const relPath = url.searchParams.get('path') || ''
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
