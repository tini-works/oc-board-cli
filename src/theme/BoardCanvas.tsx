import React, { useState, useEffect } from 'react'
import { marked } from 'marked'
import type { Board, Artifact } from '../server/routes/board'
import type { SotFile } from '../server/routes/sot'
import './BoardCanvas.css'

marked.use({ breaks: true, gfm: true })

const TYPE_ICON: Record<string, string> = {
  flow: '⇢',
  screen: '▣',
  doc: '📄',
  ref: '📎',
}
const TYPE_LABEL: Record<string, string> = {
  flow: 'Flow',
  screen: 'Screen',
  doc: 'Doc',
  ref: 'Ref',
}

// ── File browser sidebar ──────────────────────────────────────────────────────

function SotBrowser({ onAdd }: { onAdd: (file: SotFile) => void }) {
  const [files, setFiles] = useState<SotFile[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'flow' | 'screen' | 'doc' | 'ref'>('all')

  useEffect(() => {
    fetch('/__prev/sot/list').then(r => r.json()).then(setFiles).catch(() => {})
  }, [])

  const filtered = files.filter(f => {
    if (tab !== 'all' && f.type !== tab) return false
    if (search && !f.title.toLowerCase().includes(search.toLowerCase()) &&
        !f.path.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const types = ['all', 'flow', 'screen', 'doc', 'ref'] as const

  return (
    <div className="sot-browser">
      <div className="sot-browser-header">
        <span className="sot-browser-title">SOT Files</span>
        <span className="sot-browser-count">{files.length}</span>
      </div>
      <input
        className="sot-browser-search"
        placeholder="Search…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="sot-browser-tabs">
        {types.map(t => (
          <button
            key={t}
            className={`sot-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="sot-browser-list">
        {filtered.length === 0 && (
          <div className="sot-browser-empty">No files found</div>
        )}
        {filtered.map(f => (
          <div
            key={f.path}
            className="sot-file-row"
            onClick={() => onAdd(f)}
            title={`Add ${f.path} to board`}
          >
            <span className="sot-file-icon">{TYPE_ICON[f.type] ?? '📄'}</span>
            <div className="sot-file-info">
              <span className="sot-file-title">{f.title}</span>
              <span className="sot-file-path">{f.path}</span>
            </div>
            <span className="sot-file-add">+</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Individual artifact content renderers ─────────────────────────────────────

function DocRenderer({ src }: { src: string }) {
  const [html, setHtml] = useState('')
  useEffect(() => {
    fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
      .then(r => r.text())
      .then(text => {
        // Strip frontmatter
        const stripped = text.replace(/^---[\s\S]*?---\n?/, '')
        setHtml(marked.parse(stripped) as string)
      })
      .catch(() => setHtml('<p style="opacity:.5">Could not load file.</p>'))
  }, [src])
  return <div className="artifact-doc-content" dangerouslySetInnerHTML={{ __html: html }} />
}

function FlowRenderer({ src }: { src: string }) {
  const [html, setHtml] = useState('')
  const ref = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
      .then(r => r.text())
      .then(text => {
        const stripped = text.replace(/^---[\s\S]*?---\n?/, '')
        setHtml(marked.parse(stripped) as string)
      })
      .catch(() => setHtml('<p style="opacity:.5">Could not load file.</p>'))
  }, [src])

  // Re-run mermaid after HTML is set
  useEffect(() => {
    if (!html || !ref.current) return
    const win = window as any
    if (win.mermaid) {
      try {
        win.mermaid.run({ nodes: ref.current.querySelectorAll('.language-mermaid') })
      } catch { /* ignore */ }
    }
  }, [html])

  return <div className="artifact-flow-content" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}

function ScreenRenderer({ src }: { src: string }) {
  // MDX screens — try to load via the live preview system
  // The src is a relative path like "screens/login.mdx"
  // Map it to a preview URL if possible, otherwise show the raw content
  const previewName = src.replace(/\.(md|mdx)$/, '').replace(/\//g, '-')
  const [raw, setRaw] = useState('')
  const [useIframe, setUseIframe] = useState(true)

  useEffect(() => {
    // Check if preview exists
    fetch(`/_preview-runtime?src=${previewName}`)
      .then(r => { if (!r.ok) throw new Error('no preview') })
      .catch(() => {
        // Fall back to raw MDX rendered as markdown
        setUseIframe(false)
        fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
          .then(r => r.text())
          .then(text => {
            const stripped = text.replace(/^---[\s\S]*?---\n?/, '').replace(/^import .+$/gm, '').replace(/<[A-Z][^>]*>[\s\S]*?<\/[A-Z][^>]*>/g, '')
            setRaw(stripped)
          })
          .catch(() => setRaw('Could not load screen.'))
      })
  }, [src, previewName])

  if (useIframe) {
    return (
      <iframe
        className="artifact-card-iframe"
        src={`/_preview-runtime?src=${previewName}`}
        title={src}
        loading="lazy"
      />
    )
  }

  return (
    <div
      className="artifact-doc-content"
      dangerouslySetInnerHTML={{ __html: marked.parse(raw) as string }}
    />
  )
}

// ── Artifact card ─────────────────────────────────────────────────────────────

function ArtifactCard({
  artifact,
  boardId,
  onRemove,
}: {
  artifact: Artifact
  boardId: string
  onRemove: (id: string) => void
}) {
  const typeMap: Record<string, string> = { 'c3-doc': 'doc', flow: 'flow', screen: 'screen', preview: 'preview' }
  const displayType = typeMap[artifact.type] ?? artifact.type
  const title = artifact.title || artifact.source.split('/').pop()?.replace(/\.(md|mdx)$/, '') || artifact.id

  return (
    <div className="artifact-card">
      <div className="artifact-card-header">
        <span className="artifact-card-icon">{TYPE_ICON[displayType] ?? '📄'}</span>
        <span className="artifact-card-title" title={artifact.source}>{title}</span>
        <span className="artifact-card-type" data-type={artifact.type}>{TYPE_LABEL[displayType] ?? artifact.type}</span>
        <button className="artifact-card-remove" onClick={() => onRemove(artifact.id)} title="Remove from board">×</button>
      </div>
      <div className="artifact-card-content">
        {(artifact.type === 'c3-doc' || artifact.type === 'ref') && (
          <DocRenderer src={artifact.source} />
        )}
        {artifact.type === 'flow' && (
          <FlowRenderer src={artifact.source} />
        )}
        {artifact.type === 'screen' && (
          <ScreenRenderer src={artifact.source} />
        )}
        {artifact.type === 'preview' && (
          <iframe
            className="artifact-card-iframe"
            src={`/_preview-runtime?src=${artifact.source}`}
            title={title}
            loading="lazy"
          />
        )}
      </div>
    </div>
  )
}

// ── Canvas ────────────────────────────────────────────────────────────────────

interface BoardCanvasProps {
  boardId: string
  board: Board | null
  onAddArtifact: (artifact: Omit<Artifact, 'id'>) => void
  onBoardUpdate: (board: Board) => void
}

export function BoardCanvas({ boardId, board, onAddArtifact, onBoardUpdate }: BoardCanvasProps) {
  const handleAdd = (file: SotFile) => {
    const typeMap: Record<SotFile['type'], Artifact['type']> = {
      flow: 'flow',
      screen: 'screen' as any,
      doc: 'c3-doc',
      ref: 'c3-doc',
    }
    onAddArtifact({
      type: typeMap[file.type] ?? 'c3-doc',
      source: file.path,
      title: file.title,
      x: 0, y: 0, w: 400, h: 300,
    })
  }

  const handleRemove = async (artifactId: string) => {
    if (!board) return
    const updated = board.artifacts.filter(a => a.id !== artifactId)
    await fetch(`/__prev/board/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifacts: updated }),
    })
    onBoardUpdate({ ...board, artifacts: updated })
  }

  return (
    <div className="board-canvas-wrap">
      {/* Left: file browser */}
      <SotBrowser onAdd={handleAdd} />

      {/* Right: artifact cards */}
      <div className="board-canvas-main">
        {!board || board.artifacts.length === 0 ? (
          <div className="board-canvas-empty">
            <span style={{ fontSize: 40, opacity: 0.25 }}>◻</span>
            <span style={{ opacity: 0.5, fontSize: 13 }}>Pin files from the SOT browser on the left</span>
          </div>
        ) : (
          <div className="board-canvas-grid">
            {board.artifacts.map(a => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                boardId={boardId}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
