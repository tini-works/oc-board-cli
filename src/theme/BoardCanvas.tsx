import React, { useState, useEffect, useRef, useCallback } from 'react'
import { marked } from 'marked'
import type { Board, Artifact } from '../server/routes/board'
import type { SotFile } from '../server/routes/sot'
import './BoardCanvas.css'

marked.use({ breaks: true, gfm: true })

const TYPE_ICON: Record<string, string> = { flow: '⇢', screen: '▣', doc: '📄', ref: '📎', preview: '⬡' }
const TYPE_LABEL: Record<string, string> = { flow: 'Flow', screen: 'Screen', doc: 'Doc', ref: 'Ref', preview: 'Preview' }

const CARD_W = 380
const CARD_H = 340
const GRID_COLS = 3
const ZOOM_MIN = 0.2
const ZOOM_MAX = 3

// ── Auto-placement grid ───────────────────────────────────────────────────────

function autoPosition(index: number) {
  const col = index % GRID_COLS
  const row = Math.floor(index / GRID_COLS)
  return { x: col * (CARD_W + 24) + 24, y: row * (CARD_H + 24) + 24 }
}

// ── Content renderers ─────────────────────────────────────────────────────────

function DocRenderer({ src }: { src: string }) {
  const [html, setHtml] = useState('')
  useEffect(() => {
    fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
      .then(r => r.text())
      .then(t => setHtml(marked.parse(t.replace(/^---[\s\S]*?---\n?/, '')) as string))
      .catch(() => setHtml('<p style="opacity:.4">Could not load.</p>'))
  }, [src])
  return <div className="artifact-body artifact-doc" dangerouslySetInnerHTML={{ __html: html }} />
}

function FlowRenderer({ src }: { src: string }) {
  const [html, setHtml] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
      .then(r => r.text())
      .then(t => setHtml(marked.parse(t.replace(/^---[\s\S]*?---\n?/, '')) as string))
      .catch(() => setHtml('<p style="opacity:.4">Could not load.</p>'))
  }, [src])
  useEffect(() => {
    if (!html || !ref.current) return
    const win = window as any
    if (win.mermaid) {
      try { win.mermaid.run({ nodes: ref.current.querySelectorAll('.language-mermaid') }) } catch { /**/ }
    }
  }, [html])
  return <div className="artifact-body artifact-doc" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}

function ScreenRenderer({ src }: { src: string }) {
  const previewName = src.replace(/\.(md|mdx)$/, '').replace(/\//g, '-')
  const [fallback, setFallback] = useState(false)
  const [raw, setRaw] = useState('')
  useEffect(() => {
    fetch(`/_preview-runtime?src=${previewName}`)
      .then(r => { if (!r.ok) throw new Error() })
      .catch(() => {
        setFallback(true)
        fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
          .then(r => r.text())
          .then(t => setRaw(t.replace(/^---[\s\S]*?---\n?/, '').replace(/^import .+$/gm, '')))
          .catch(() => setRaw(''))
      })
  }, [src, previewName])
  if (fallback) return <div className="artifact-body artifact-doc" dangerouslySetInnerHTML={{ __html: marked.parse(raw) as string }} />
  return <iframe className="artifact-iframe" src={`/_preview-runtime?src=${previewName}`} title={src} loading="lazy" />
}

// ── Artifact card (draggable) ─────────────────────────────────────────────────

interface ArtifactCardProps {
  artifact: Artifact
  zoom: number
  onDragStart: (id: string, e: React.MouseEvent) => void
  onRemove: (id: string) => void
}

function ArtifactCard({ artifact, zoom, onDragStart, onRemove }: ArtifactCardProps) {
  const typeMap: Record<string, string> = { 'c3-doc': 'doc', flow: 'flow', screen: 'screen', preview: 'preview', ref: 'ref' }
  const displayType = typeMap[artifact.type] ?? artifact.type
  const title = artifact.title || artifact.source.split('/').pop()?.replace(/\.(md|mdx)$/, '') || artifact.id

  return (
    <div
      className="artifact-card"
      style={{
        position: 'absolute',
        left: artifact.x,
        top: artifact.y,
        width: CARD_W,
      }}
    >
      {/* Header — drag handle */}
      <div
        className="artifact-card-header"
        onMouseDown={e => { e.preventDefault(); onDragStart(artifact.id, e) }}
      >
        <span className="artifact-card-drag">⠿</span>
        <span className="artifact-card-icon">{TYPE_ICON[displayType] ?? '📄'}</span>
        <span className="artifact-card-title" title={artifact.source}>{title}</span>
        <span className="artifact-card-type" data-type={artifact.type}>
          {TYPE_LABEL[displayType] ?? artifact.type}
        </span>
        <button
          className="artifact-card-remove"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onRemove(artifact.id)}
          title="Remove"
        >×</button>
      </div>

      {/* Content — pointer-events passthrough to allow scrolling */}
      <div className="artifact-card-content" style={{ pointerEvents: zoom > 0.5 ? 'auto' : 'none' }}>
        {(artifact.type === 'c3-doc' || artifact.type === 'ref') && <DocRenderer src={artifact.source} />}
        {artifact.type === 'flow' && <FlowRenderer src={artifact.source} />}
        {(artifact.type as any) === 'screen' && <ScreenRenderer src={artifact.source} />}
        {artifact.type === 'preview' && (
          <iframe className="artifact-iframe" src={`/_preview-runtime?src=${artifact.source}`} title={title} loading="lazy" />
        )}
      </div>
    </div>
  )
}

// ── SOT Browser sidebar ───────────────────────────────────────────────────────

function SotBrowser({ onAdd, collapsed, onToggle }: {
  onAdd: (f: SotFile) => void
  collapsed: boolean
  onToggle: () => void
}) {
  const [files, setFiles] = useState<SotFile[]>([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'flow' | 'screen' | 'doc' | 'ref'>('all')

  useEffect(() => {
    fetch('/__prev/sot/list').then(r => r.json()).then(setFiles).catch(() => {})
  }, [])

  const filtered = files.filter(f =>
    (tab === 'all' || f.type === tab) &&
    (!search || f.title.toLowerCase().includes(search.toLowerCase()) || f.path.toLowerCase().includes(search.toLowerCase()))
  )

  if (collapsed) {
    return (
      <div className="sot-browser sot-collapsed" onClick={onToggle} title="Open SOT browser">
        <span className="sot-collapsed-label">◀ SOT</span>
        <span className="sot-browser-count">{files.length}</span>
      </div>
    )
  }

  return (
    <div className="sot-browser">
      <div className="sot-browser-header">
        <span className="sot-browser-title">SOT Files</span>
        <span className="sot-browser-count">{files.length}</span>
        <button className="sot-collapse-btn" onClick={onToggle} title="Collapse">◀</button>
      </div>

      <input className="sot-browser-search" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />

      <div className="sot-browser-tabs">
        {(['all', 'flow', 'screen', 'doc', 'ref'] as const).map(t => (
          <button key={t} className={`sot-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="sot-browser-list">
        {filtered.length === 0 && <div className="sot-empty">No files</div>}
        {filtered.map(f => (
          <div key={f.path} className="sot-file-row" onClick={() => onAdd(f)} title={f.path}>
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

// ── Zoom controls ─────────────────────────────────────────────────────────────

function ZoomControls({ zoom, onZoom, onFit, onReset }: {
  zoom: number
  onZoom: (delta: number) => void
  onFit: () => void
  onReset: () => void
}) {
  return (
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={() => onZoom(0.15)} title="Zoom in">+</button>
      <button className="zoom-label" onClick={onReset} title="Reset zoom">
        {Math.round(zoom * 100)}%
      </button>
      <button className="zoom-btn" onClick={() => onZoom(-0.15)} title="Zoom out">−</button>
      <div className="zoom-divider" />
      <button className="zoom-btn zoom-fit" onClick={onFit} title="Fit all">⊡</button>
    </div>
  )
}

// ── Main Canvas ───────────────────────────────────────────────────────────────

interface BoardCanvasProps {
  boardId: string
  board: Board | null
  onAddArtifact: (a: Omit<Artifact, 'id'>) => void
  onBoardUpdate: (b: Board) => void
}

export function BoardCanvas({ boardId, board, onAddArtifact, onBoardUpdate }: BoardCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [browserCollapsed, setBrowserCollapsed] = useState(false)

  // Drag state
  const dragging = useRef<{
    artifactId: string
    startMouse: { x: number; y: number }
    startPos: { x: number; y: number }
    current: { x: number; y: number }
  } | null>(null)

  // Pan state
  const panning = useRef<{ startMouse: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({})

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const delta = e.deltaY < 0 ? 0.12 : -0.12
      setZoom(prev => {
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta))
        // Zoom toward cursor: adjust pan so the point under cursor stays fixed
        const scale = next / prev
        setPan(p => ({
          x: mouseX - scale * (mouseX - p.x),
          y: mouseY - scale * (mouseY - p.y),
        }))
        return next
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Mouse move / up (global) ──────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Drag artifact
      if (dragging.current) {
        const dx = (e.clientX - dragging.current.startMouse.x) / zoom
        const dy = (e.clientY - dragging.current.startMouse.y) / zoom
        const newX = Math.max(0, dragging.current.startPos.x + dx)
        const newY = Math.max(0, dragging.current.startPos.y + dy)
        dragging.current.current = { x: newX, y: newY }
        setLocalPositions(prev => ({
          ...prev,
          [dragging.current!.artifactId]: { x: newX, y: newY },
        }))
        return
      }

      // Pan canvas
      if (panning.current) {
        const dx = e.clientX - panning.current.startMouse.x
        const dy = e.clientY - panning.current.startMouse.y
        setPan({
          x: panning.current.startPan.x + dx,
          y: panning.current.startPan.y + dy,
        })
      }
    }

    const onUp = async () => {
      // Save artifact position on drag end
      if (dragging.current && board) {
        const { artifactId, current } = dragging.current
        const updated = board.artifacts.map(a =>
          a.id === artifactId ? { ...a, x: Math.round(current.x), y: Math.round(current.y) } : a
        )
        dragging.current = null
        await fetch(`/__prev/board/${boardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artifacts: updated }),
        })
        onBoardUpdate({ ...board, artifacts: updated })
      }
      dragging.current = null
      panning.current = null
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [zoom, board, boardId, onBoardUpdate])

  const handleDragStart = useCallback((artifactId: string, e: React.MouseEvent) => {
    const artifact = board?.artifacts.find(a => a.id === artifactId)
    if (!artifact) return
    document.body.style.cursor = 'grabbing'
    dragging.current = {
      artifactId,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { x: artifact.x, y: artifact.y },
      current: { x: artifact.x, y: artifact.y },
    }
  }, [board])

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Pan on canvas background click (not on cards)
    if ((e.target as HTMLElement).closest('.artifact-card')) return
    panning.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      startPan: { ...pan },
    }
    document.body.style.cursor = 'grab'
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
    setLocalPositions(p => { const next = { ...p }; delete next[artifactId]; return next })
  }

  const handleAddFile = (file: SotFile) => {
    const index = board?.artifacts.length ?? 0
    const pos = autoPosition(index)
    const typeMap: Record<SotFile['type'], Artifact['type']> = {
      flow: 'flow', screen: 'screen' as any, doc: 'c3-doc', ref: 'c3-doc',
    }
    onAddArtifact({ type: typeMap[file.type] ?? 'c3-doc', source: file.path, title: file.title, ...pos, w: CARD_W, h: CARD_H })
  }

  const handleFit = () => {
    if (!board?.artifacts.length || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const xs = board.artifacts.map(a => a.x)
    const ys = board.artifacts.map(a => a.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs) + CARD_W
    const maxY = Math.max(...ys) + CARD_H
    const contentW = maxX - minX
    const contentH = maxY - minY
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(
      (rect.width - 80) / contentW,
      (rect.height - 80) / contentH,
    ) * 0.9))
    setZoom(newZoom)
    setPan({ x: (rect.width - contentW * newZoom) / 2 - minX * newZoom, y: (rect.height - contentH * newZoom) / 2 - minY * newZoom })
  }

  // Merge server positions with optimistic local positions during drag
  const getPos = (a: Artifact) => localPositions[a.id] ?? { x: a.x, y: a.y }

  const artifacts = board?.artifacts ?? []

  return (
    <div className="board-canvas-wrap">
      <SotBrowser onAdd={handleAddFile} collapsed={browserCollapsed} onToggle={() => setBrowserCollapsed(v => !v)} />

      {/* Infinite canvas */}
      <div className="board-canvas-viewport" ref={containerRef} onMouseDown={handleCanvasMouseDown}>

        {/* Dot-grid background */}
        <svg className="canvas-grid-bg" width="100%" height="100%">
          <defs>
            <pattern id="dots" x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)} width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
              <circle cx={zoom} cy={zoom} r={Math.max(0.5, zoom * 0.6)} fill="var(--fd-border)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Stage: zoom + pan via CSS transform */}
        <div
          className="board-canvas-stage"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {artifacts.length === 0 && (
            <div className="canvas-empty-hint" style={{ position: 'absolute', left: 120, top: 80, pointerEvents: 'none' }}>
              <span style={{ fontSize: 32, opacity: 0.15 }}>◻</span>
              <span style={{ opacity: 0.3, fontSize: 13 }}>Click a file in the SOT browser to pin it here</span>
            </div>
          )}
          {artifacts.map(artifact => {
            const pos = getPos(artifact)
            const withPos = { ...artifact, x: pos.x, y: pos.y }
            return (
              <ArtifactCard
                key={artifact.id}
                artifact={withPos}
                zoom={zoom}
                onDragStart={handleDragStart}
                onRemove={handleRemove}
              />
            )
          })}
        </div>

        {/* Zoom controls — fixed overlay */}
        <ZoomControls
          zoom={zoom}
          onZoom={delta => setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z + delta)))}
          onFit={handleFit}
          onReset={() => { setZoom(1); setPan({ x: 40, y: 40 }) }}
        />
      </div>
    </div>
  )
}
