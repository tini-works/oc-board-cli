import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { marked } from 'marked'
import type { Board, Artifact, CommentThread } from '../server/routes/board'
import type { SotFile } from '../server/routes/sot'
import './BoardCanvas.css'

marked.use({ breaks: true, gfm: true })

// Simple markdown renderer for AI responses (trusted content from OpenClaw gateway)
function MarkdownContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const html = useMemo(() => marked.parse(text) as string, [text])
  return (
    <div
      className={`artifact-ai-markdown${streaming ? ' streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const TYPE_ICON: Record<string, string> = { flow: '\u21e2', screen: '\u25a3', doc: '\ud83d\udcc4', ref: '\ud83d\udcce', preview: '\u2b21', a2ui: '\u2726' }
const TYPE_LABEL: Record<string, string> = { flow: 'Flow', screen: 'Screen', doc: 'Doc', ref: 'Ref', preview: 'Preview', a2ui: 'A2UI' }

const CARD_W = 380
const GRID_COLS = 3
const GRID_ROW_GAP = 40   // vertical gap between rows (content height is variable)
const GRID_COL_GAP = 24
const ZOOM_MIN = 0.2
const ZOOM_MAX = 3
const BOARD_W = 3000
const BOARD_H = 3000

// ── Auto-placement grid ───────────────────────────────────────────────────────
// F3 fix: accepts cursors array as param instead of module-level state
function autoPosition(index: number, cursors: number[]) {
  const col = index % GRID_COLS
  if (!cursors[col]) cursors[col] = 24
  const x = col * (CARD_W + GRID_COL_GAP) + 24
  const y = cursors[col]
  cursors[col] = (cursors[col] ?? 24) + 400 + GRID_ROW_GAP
  return { x, y }
}

// Calculate center position for the first artifact placement, clamped to board bounds
function centerStartPosition(viewportW: number, viewportH: number, numArtifacts: number): { x: number; y: number } {
  const totalWidth = GRID_COLS * CARD_W + (GRID_COLS - 1) * GRID_COL_GAP
  const offsetX = Math.max(24, (viewportW - totalWidth) / 2)
  const offsetY = Math.max(24, (viewportH - 400) / 2)
  return { x: offsetX, y: offsetY }
}

// ── Mermaid / D2 — bake SVGs into HTML string before setting state ────────────
// This avoids post-render DOM mutation which React can clobber on re-render.
// Note: Content is from server-side SOT files (trusted), not user input.

let mermaidInitialized = false

async function injectMermaidSvgs(html: string): Promise<string> {
  const tmp = document.createElement('div')
  tmp.innerHTML = html

  const codeBlocks = tmp.querySelectorAll<HTMLElement>('code.language-mermaid')
  if (codeBlocks.length === 0) return html

  const mermaid = (await import('mermaid')).default
  if (!mermaidInitialized) {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })
    mermaidInitialized = true
  }

  for (const block of codeBlocks) {
    const pre = block.parentElement as HTMLElement
    if (!pre) continue
    const code = block.textContent || ''
    try {
      const id = 'art-m-' + Math.random().toString(36).slice(2)
      const { svg } = await mermaid.render(id, code)
      const wrap = document.createElement('div')
      wrap.className = 'artifact-mermaid'
      wrap.innerHTML = svg
      pre.replaceWith(wrap)
    } catch (e) {
      console.warn('Mermaid render error:', e)
    }
  }

  return tmp.innerHTML
}

async function injectD2Svgs(html: string): Promise<string> {
  const tmp = document.createElement('div')
  tmp.innerHTML = html

  const codeBlocks = tmp.querySelectorAll<HTMLElement>('code.language-d2')
  if (codeBlocks.length === 0) return html

  let d2Instance: any = null
  try {
    const { D2 } = await import('@terrastruct/d2')
    d2Instance = new D2()
  } catch { return html }

  for (const block of codeBlocks) {
    const pre = block.parentElement as HTMLElement
    if (!pre) continue
    const code = block.textContent || ''
    try {
      const result = await d2Instance.compile(code)
      const svg = await d2Instance.render(result.diagram, result.renderOptions)
      const wrap = document.createElement('div')
      wrap.className = 'artifact-mermaid'
      wrap.innerHTML = svg
      pre.replaceWith(wrap)
    } catch (e) {
      console.warn('D2 render error:', e)
    }
  }

  return tmp.innerHTML
}

async function injectDiagramSvgs(rawHtml: string): Promise<string> {
  let html = rawHtml
  html = await injectMermaidSvgs(html)
  html = await injectD2Svgs(html)
  return html
}

// ── Content renderers ─────────────────────────────────────────────────────────
// Note: dangerouslySetInnerHTML is used intentionally here — content comes from
// server-side SOT markdown files (trusted internal content), not user input.

// F8 fix: add cancellation flag to prevent stale async updates
// R1 fix: add refreshKey prop to force re-fetch when artifact source file changes
function DocRenderer({ src, refreshKey }: { src: string; refreshKey?: number }) {
  const [html, setHtml] = useState('')
  useEffect(() => {
    let cancelled = false
    fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
      .then(r => r.text())
      .then(async t => {
        const raw = marked.parse(t.replace(/^---[\s\S]*?---\n?/, '')) as string
        const final = await injectDiagramSvgs(raw)
        if (!cancelled) setHtml(final)
      })
      .catch(() => { if (!cancelled) setHtml('<p style="opacity:.4">Could not load.</p>') })
    return () => { cancelled = true }
  }, [src, refreshKey])
  return <div className="artifact-body artifact-doc" dangerouslySetInnerHTML={{ __html: html }} />
}

function FlowRenderer({ src, refreshKey }: { src: string; refreshKey?: number }) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
      .then(r => r.text())
      .then(async t => {
        const raw = marked.parse(t.replace(/^---[\s\S]*?---\n?/, '')) as string
        const final = await injectDiagramSvgs(raw)
        if (!cancelled) setHtml(final)
      })
      .catch(() => { if (!cancelled) setHtml('<p style="opacity:.4">Could not load.</p>') })
    return () => { cancelled = true }
  }, [src, refreshKey])

  return <div className="artifact-body artifact-doc" dangerouslySetInnerHTML={{ __html: html }} />
}

// ── Screen renderer — iframe fills card height when explicitly sized ───────────
function ScreenRenderer({ src, fillHeight }: { src: string; fillHeight: boolean }) {
  const docUrl = '/' + src.replace(/\.(md|mdx)$/, '') + '?embed'
  return (
    <iframe
      className={`artifact-iframe${fillHeight ? ' artifact-iframe--fill' : ''}`}
      src={docUrl}
      title={src}
      loading="lazy"
    />
  )
}

// ── A2UI renderer — embeds the a2ui bundle and plays a .jsonl file ────────────
function A2UIRenderer({ src, fillHeight }: { src: string; fillHeight: boolean }) {
  const rendererUrl = `/__prev/a2ui-render?src=${encodeURIComponent(src)}`
  return (
    <iframe
      className={`artifact-iframe artifact-iframe-a2ui${fillHeight ? ' artifact-iframe--fill' : ''}`}
      src={rendererUrl}
      title={src}
      loading="lazy"
      allow="same-origin"
    />
  )
}

const CARD_MIN_W = 240
const CARD_MIN_H = 80

// ── Comments popup — portal overlay ───────────────────────────────────────────
function ArtifactCommentsPopup({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [popupHeight, setPopupHeight] = useState<number | null>(null)
  const resizingRef = useRef<{ startY: number; startH: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const pendingHRef = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setPopupHeight(null)
      requestAnimationFrame(() => { setVisible(true); setAnimating(true) })
    } else {
      setAnimating(false)
    }
  }, [open])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const dy = e.clientY - resizingRef.current.startY
      const newH = Math.max(250, resizingRef.current.startH + dy)
      pendingHRef.current = newH
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          if (pendingHRef.current !== null) {
            setPopupHeight(pendingHRef.current)
            pendingHRef.current = null
          }
        })
      }
    }
    const onUp = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      resizingRef.current = null
      pendingHRef.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const popupEl = (e.currentTarget as HTMLElement).parentElement as HTMLElement
    const startH = popupEl?.getBoundingClientRect().height ?? 450
    resizingRef.current = { startY: e.clientY, startH }
    document.body.style.cursor = 'ns-resize'
  }

  const handleTransitionEnd = () => {
    if (!animating && visible && !open) setVisible(false)
    if (!animating) setAnimating(true)
  }

  if (!open && !visible) return null

  return createPortal(
    <div className={`artifact-comments-popup-backdrop${visible ? ' visible' : ''}`} onClick={onClose}>
      <div
        className="artifact-comments-popup"
        style={popupHeight !== null ? { height: popupHeight } : undefined}
        onClick={e => e.stopPropagation()}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="artifact-comments-popup-header">
          <span className="artifact-comments-popup-title">{'\ud83d\udcac'} Comments</span>
          <button className="artifact-comments-popup-close" onClick={onClose} title="Close">{'\u00d7'}</button>
        </div>
        {children}
        <div
          className="artifact-comments-popup-resize"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      </div>
    </div>,
    document.body
  )
}

// ── Artifact card (draggable + resizable) — P5 fix: wrapped in React.memo ────

interface ArtifactCardProps {
  artifact: Artifact
  position: { x: number; y: number }
  zoom: number
  localSize: { w: number; h: number } | null
  onDragStart: (id: string, e: React.MouseEvent) => void
  onResizeStart: (id: string, e: React.MouseEvent) => void
  onRemove: (id: string) => void
  boardId: string
  threads: CommentThread[]
  onRefresh: () => void
  ws: React.RefObject<WebSocket | null>
  wsVersion: number
  globalRefreshKey: number
}

const ArtifactCard = React.memo(function ArtifactCard({
  artifact, position, zoom, localSize, onDragStart, onResizeStart, onRemove,
  boardId, threads, onRefresh, ws, wsVersion, globalRefreshKey,
}: ArtifactCardProps) {
  const typeMap: Record<string, string> = { 'c3-doc': 'doc', flow: 'flow', screen: 'screen', preview: 'preview', ref: 'ref' }
  const displayType = typeMap[artifact.type] ?? artifact.type
  const title = artifact.title || artifact.source.split('/').pop()?.replace(/\.(md|mdx)$/, '') || artifact.id

  const w = localSize?.w ?? (artifact.w > 0 ? artifact.w : CARD_W)
  const h = localSize?.h ?? (artifact.h > 0 ? artifact.h : 600)

  // Comments state
  const [openComments, setOpenComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [pendingUserText, setPendingUserText] = useState('')
  const handleGenerateRef = useRef<() => Promise<void>>(async () => {})

  const allComments = threads.flatMap(t => t.comments)
  const commentCount = allComments.length

  const handleCommentKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerateRef.current()
    }
  }, [])

  const commentListRef = useRef<HTMLDivElement>(null)

  // Auto-scroll comment list on new comments
  useEffect(() => {
    if (openComments && commentListRef.current) {
      commentListRef.current.scrollTop = commentListRef.current.scrollHeight
    }
  }, [openComments, commentCount])

  // ── Per-artifact AI agent ────────────────────────────────────────────────
  const [aiStatus, setAiStatus] = useState<'idle' | 'thinking' | 'streaming'>('idle')
  const [aiResponse, setAiResponse] = useState('')
  const aiMsgIdRef = useRef<string | null>(null)
  const tokenBufRef = useRef('')
  const aiRafRef = useRef<number | null>(null)

  // Listen for artifact-scoped AI events on the shared WebSocket
  useEffect(() => {
    const wsInstance = ws.current
    if (!wsInstance) return

    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string)
        if (event.artifactId !== artifact.id) return

        if (event.type === 'artifact_ai_start') {
          setAiStatus('streaming')
          setAiResponse('')
          tokenBufRef.current = ''
          aiMsgIdRef.current = event.msgId
        }
        if (event.type === 'artifact_token' && event.msgId === aiMsgIdRef.current) {
          tokenBufRef.current += event.token
          if (aiRafRef.current === null) {
            aiRafRef.current = requestAnimationFrame(() => {
              aiRafRef.current = null
              setAiResponse(tokenBufRef.current)
            })
          }
        }
        if (event.type === 'artifact_ai_done') {
          if (aiRafRef.current !== null) {
            cancelAnimationFrame(aiRafRef.current)
            aiRafRef.current = null
          }
          tokenBufRef.current = ''
          aiMsgIdRef.current = null
          setAiStatus('idle')
          setAiResponse('')
          setPendingUserText('')
          onRefresh()
          // R2: signal that artifact source file may have changed, triggering re-fetch
          // Small delay to allow the agent to finish writing the file before we re-fetch
          setTimeout(() => {
            fetch(`/__prev/board/${boardId}/artifact/${artifact.id}/refresh`, { method: 'POST' }).catch(() => {})
          }, 500)
        }
        if (event.type === 'artifact_ai_error') {
          if (aiRafRef.current !== null) {
            cancelAnimationFrame(aiRafRef.current)
            aiRafRef.current = null
          }
          tokenBufRef.current = ''
          aiMsgIdRef.current = null
          setAiStatus('idle')
          setAiResponse('')
          setPendingUserText('')
        }
      } catch { /* ignore */ }
    }

    wsInstance.addEventListener('message', handler)
    return () => {
      wsInstance.removeEventListener('message', handler)
      if (aiRafRef.current !== null) {
        cancelAnimationFrame(aiRafRef.current)
        aiRafRef.current = null
      }
    }
  }, [wsVersion, artifact.id, onRefresh])

  // Auto-scroll on AI streaming updates
  useEffect(() => {
    if (openComments && commentListRef.current && aiStatus !== 'idle') {
      commentListRef.current.scrollTop = commentListRef.current.scrollHeight
    }
  }, [openComments, aiStatus, aiResponse])

  const handleGenerate = useCallback(async () => {
    const text = commentText.trim()
    if (!text || aiStatus !== 'idle') return
    setAiStatus('thinking')
    setPendingUserText(text)
    setCommentText('')
    try {
      await fetch(`/__prev/board/${boardId}/artifact/${artifact.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
    } catch {
      setAiStatus('idle')
      setPendingUserText('')
    }
  }, [commentText, aiStatus, boardId, artifact.id])

  handleGenerateRef.current = handleGenerate

  return (
    <div
      className="artifact-card"
      data-artifact-id={artifact.id}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: w,
        ...(h ? { height: h, overflow: 'hidden' } : {}),
      }}
    >
      {/* Header — drag handle */}
      <div
        className="artifact-card-header"
        onMouseDown={e => { e.preventDefault(); onDragStart(artifact.id, e) }}
      >
        <span className="artifact-card-drag">{'\u2807'}</span>
        <span className="artifact-card-icon">{TYPE_ICON[displayType] ?? '\ud83d\udcc4'}</span>
        <span className="artifact-card-title" title={artifact.source}>{title}</span>
        <span className="artifact-card-type" data-type={artifact.type}>
          {TYPE_LABEL[displayType] ?? artifact.type}
        </span>
        <button
          className={`artifact-card-comment-btn${openComments ? ' active' : ''}`}
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setOpenComments(v => !v) }}
          title="Comments"
        >
          {'\ud83d\udcac'}
          {commentCount > 0 && <span className="artifact-card-comment-btn-count">{commentCount}</span>}
        </button>
        <button
          className="artifact-card-remove"
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onRemove(artifact.id)}
          title="Remove"
        >{'\u00d7'}</button>
      </div>

      {/* Comments popup — portal overlay */}
      <ArtifactCommentsPopup open={openComments} onClose={() => setOpenComments(false)}>
        <div className="artifact-card-comments-list" ref={commentListRef}>
          {allComments.length === 0 && !pendingUserText && aiStatus === 'idle' && (
            <div className="artifact-card-comments-empty">No comments yet</div>
          )}
          {allComments.map(c => (
            <div key={c.id} className={`artifact-card-comment-msg${c.author === 'ai' ? ' artifact-card-comment-ai' : ''}`}>
              <span className="artifact-card-comment-author">{c.author}</span>
              <span className="artifact-card-comment-text">
                {c.author === 'ai' ? <MarkdownContent text={c.text} /> : c.text}
              </span>
              <span className="artifact-card-comment-ts">
                {new Date(c.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {pendingUserText && (
            <div className="artifact-card-comment-msg">
              <span className="artifact-card-comment-author">user</span>
              <span className="artifact-card-comment-text">{pendingUserText}</span>
            </div>
          )}
          {aiStatus !== 'idle' && (
            <>
              {!aiResponse && (
                <div className="artifact-ai-status-bar">
                  <div className="artifact-ai-status-dots">
                    <span /><span /><span />
                  </div>
                  <span className="artifact-ai-status-label">
                    {aiStatus === 'thinking' ? 'AI is thinking...' : 'AI is responding...'}
                  </span>
                </div>
              )}
              <div className="artifact-card-comment-msg artifact-card-comment-ai">
                <span className="artifact-card-comment-author">AI</span>
                <span className="artifact-card-comment-text">
                  {aiResponse
                    ? <MarkdownContent text={aiResponse} streaming />
                    : <div className="artifact-ai-typing">
                        <span /><span /><span />
                      </div>
                }
                </span>
              </div>
            </>
          )}
        </div>
        <div className="artifact-card-comment-input">
          <input
            type="text"
            placeholder="Ask about this artifact..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={handleCommentKeyDown}
            disabled={aiStatus !== 'idle'}
            onMouseDown={e => e.stopPropagation()}
          />
          <button
            className="artifact-ai-generate-btn"
            onClick={e => { e.stopPropagation(); handleGenerate() }}
            disabled={!commentText.trim() || aiStatus !== 'idle'}
            title="Send & generate AI response"
            onMouseDown={e => e.stopPropagation()}
          >
            {aiStatus === 'thinking' ? '...' : '\u2728'}
          </button>
        </div>
      </ArtifactCommentsPopup>

      {/* Content */}
      <div
        className="artifact-card-content"
        style={{
          pointerEvents: zoom > 0.5 ? 'auto' : 'none',
        }}
      >
        {(artifact.type === 'c3-doc' || artifact.type === 'ref') && <DocRenderer src={artifact.source} refreshKey={globalRefreshKey} />}
        {artifact.type === 'flow' && <FlowRenderer src={artifact.source} refreshKey={globalRefreshKey} />}
        {artifact.type === 'screen' && <ScreenRenderer src={artifact.source} fillHeight={!!h} />}
        {artifact.type === 'a2ui' && <A2UIRenderer src={artifact.source} fillHeight={!!h} />}
        {artifact.type === 'preview' && (
          <iframe
            className={`artifact-iframe${h ? ' artifact-iframe--fill' : ''}`}
            src={`/_preview-runtime?src=${artifact.source}`}
            title={title}
            loading="lazy"
          />
        )}
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        className="artifact-resize-handle"
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onResizeStart(artifact.id, e) }}
        title="Drag to resize"
      />
    </div>
  )
})

// ── SOT Browser sidebar — P4 fix: module-level cache ──────────────────────────

let sotCache: { files: SotFile[]; ts: number } | null = null
const SOT_CACHE_TTL = 30_000

function SotBrowser({ onAdd, collapsed, onToggle }: {
  onAdd: (f: SotFile) => void
  collapsed: boolean
  onToggle: () => void
}) {
  const [files, setFiles] = useState<SotFile[]>(sotCache?.files ?? [])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'flow' | 'screen' | 'doc' | 'ref' | 'a2ui'>('all')

  useEffect(() => {
    if (sotCache && Date.now() - sotCache.ts < SOT_CACHE_TTL) {
      setFiles(sotCache.files)
      return
    }
    fetch('/__prev/sot/list')
      .then(r => r.json())
      .then((data: SotFile[]) => {
        sotCache = { files: data, ts: Date.now() }
        setFiles(data)
      })
      .catch(() => {})
  }, [])

  const filtered = files.filter(f =>
    (tab === 'all' || f.type === tab) &&
    (!search || f.title.toLowerCase().includes(search.toLowerCase()) || f.path.toLowerCase().includes(search.toLowerCase()))
  )

  if (collapsed) {
    return (
      <div className="sot-browser sot-collapsed" onClick={onToggle} title="Open SOT browser">
        <span className="sot-collapsed-label">{'\u25c0'} SOT</span>
        <span className="sot-browser-count">{files.length}</span>
      </div>
    )
  }

  return (
    <div className="sot-browser">
      <div className="sot-browser-header">
        <span className="sot-browser-title">SOT Files</span>
        <span className="sot-browser-count">{files.length}</span>
        <button className="sot-collapse-btn" onClick={onToggle} title="Collapse">{'\u25c0'}</button>
      </div>

      <input className="sot-browser-search" placeholder={'Search\u2026'} value={search} onChange={e => setSearch(e.target.value)} />

      <div className="sot-browser-tabs">
        {(['all', 'a2ui', 'flow', 'screen', 'doc', 'ref'] as const).map(t => (
          <button key={t} className={`sot-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="sot-browser-list">
        {filtered.length === 0 && <div className="sot-empty">No files</div>}
        {filtered.map(f => (
          <div key={f.path} className="sot-file-row" onClick={() => onAdd(f)} title={f.path}>
            <span className="sot-file-icon">{TYPE_ICON[f.type] ?? '\ud83d\udcc4'}</span>
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
      <button className="zoom-btn" onClick={() => onZoom(-0.15)} title="Zoom out">{'\u2212'}</button>
      <div className="zoom-divider" />
      <button className="zoom-btn zoom-fit" onClick={onFit} title="Fit all">{'\u22a1'}</button>
    </div>
  )
}

// ── Main Canvas ───────────────────────────────────────────────────────────────

interface BoardCanvasProps {
  boardId: string
  board: Board | null
  onAddArtifact: (a: Omit<Artifact, 'id'>) => void
  onBoardUpdate: React.Dispatch<React.SetStateAction<Board | null>>
  ws: React.RefObject<WebSocket | null>
  wsVersion: number
}

export function BoardCanvas({ boardId, board, onAddArtifact, onBoardUpdate, ws, wsVersion }: BoardCanvasProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [browserCollapsed, setBrowserCollapsed] = useState(false)
  // R1 fix: global refresh key — bumped when AI updates artifact source file, triggers re-fetch in DocRenderer/FlowRenderer
  const [globalRefreshKey, setGlobalRefreshKey] = useState(0)

  // Refresh board from server (used after adding comments)
  const refreshBoard = useCallback(async () => {
    const res = await fetch(`/__prev/board/${boardId}`)
    if (res.ok) {
      const fresh = await res.json()
      onBoardUpdate(() => fresh)
    }
  }, [boardId, onBoardUpdate])

  // Drag state
  const dragging = useRef<{
    artifactId: string
    startMouse: { x: number; y: number }
    startPos: { x: number; y: number }
    current: { x: number; y: number }
  } | null>(null)

  // Resize state
  const resizing = useRef<{
    artifactId: string
    startMouse: { x: number; y: number }
    startSize: { w: number; h: number }
    current: { w: number; h: number }
  } | null>(null)

  // Pan state
  const panning = useRef<{ startMouse: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null)

  // R1 fix: listen for artifact_content_updated WebSocket event to refresh rendered content
  // R2 fix: use wsVersion dep so listener re-attaches on reconnect
  useEffect(() => {
    const wsInstance = ws.current
    if (!wsInstance) return
    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string)
        if (event.type === 'artifact_content_updated') {
          setGlobalRefreshKey(k => k + 1)
        }
      } catch { /* ignore */ }
    }
    wsInstance.addEventListener('message', handler)
    return () => { wsInstance.removeEventListener('message', handler) }
  }, [wsVersion])

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [localSizes, setLocalSizes] = useState<Record<string, { w: number; h: number }>>({})
  // Tracks actual rendered card sizes (updated by ResizeObserver)
  const cardSizes = useRef<Record<string, { w: number; h: number }>>({})

  // F3 fix: instance-scoped colCursors instead of module-level
  const colCursorsRef = useRef<number[]>([])

  // Refs for latest values (avoids stale closures in event handlers)
  const boardRef = useRef(board)
  boardRef.current = board
  const localPositionsRef = useRef(localPositions)
  localPositionsRef.current = localPositions
  // F3 fix: pan ref to avoid stale closure in handleCanvasMouseDown
  const panRef = useRef(pan)
  panRef.current = pan
  // I1 fix: RAF ref for batching mouse moves
  const rafRef = useRef<number | null>(null)
  // I1 fix: pending pan value during RAF batching
  const pendingPan = useRef<{ x: number; y: number } | null>(null)

  // F3 fix: reset placement cursors when board changes
  useEffect(() => {
    colCursorsRef.current = []
  }, [boardId])

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      // Don't intercept scroll events inside artifact cards or comments popup
      if ((e.target as HTMLElement).closest('.artifact-card, .artifact-comments-popup')) return

      const isPinchOrCtrlZoom = e.ctrlKey || e.metaKey
      const isTrackpad = e.deltaMode === 0

      // Trackpad 2-finger swipe (no ctrl/meta) → PAN (inverted: Figma behavior)
      if (isTrackpad && !isPinchOrCtrlZoom) {
        e.preventDefault()
        setPan(p => ({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        }))
        return
      }

      // Mouse wheel scroll (deltaMode === 1) or ctrl+scroll/pinch-to-zoom → ZOOM
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Pinch-to-zoom uses finer increments from trackpad
      const magnitude = isTrackpad && isPinchOrCtrlZoom ? Math.abs(e.deltaY) * 0.005 : 0.12
      const delta = e.deltaY < 0 ? magnitude : -magnitude
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

  // ── Mouse move / up (global) — I1 fix: RAF-batched state updates ────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Resize artifact — update ref immediately, batch state via RAF
      if (resizing.current) {
        const dx = (e.clientX - resizing.current.startMouse.x) / zoom
        const dy = (e.clientY - resizing.current.startMouse.y) / zoom
        const newW = Math.max(CARD_MIN_W, resizing.current.startSize.w + dx)
        const newH = Math.max(CARD_MIN_H, resizing.current.startSize.h + dy)
        resizing.current.current = { w: newW, h: newH }
        scheduleRaf()
        return
      }

      // Drag artifact — update ref immediately, batch state via RAF
      if (dragging.current) {
        const dx = (e.clientX - dragging.current.startMouse.x) / zoom
        const dy = (e.clientY - dragging.current.startMouse.y) / zoom
        const newX = dragging.current.startPos.x + dx
        const newY = dragging.current.startPos.y + dy
        dragging.current.current = { x: newX, y: newY }
        scheduleRaf()
        return
      }

      // Pan canvas
      if (panning.current) {
        const dx = e.clientX - panning.current.startMouse.x
        const dy = e.clientY - panning.current.startMouse.y
        pendingPan.current = {
          x: panning.current.startPan.x + dx,
          y: panning.current.startPan.y + dy,
        }
        scheduleRaf()
      }
    }

    function scheduleRaf() {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          if (dragging.current) {
            setLocalPositions(prev => ({
              ...prev,
              [dragging.current!.artifactId]: dragging.current!.current,
            }))
          }
          if (resizing.current) {
            setLocalSizes(prev => ({
              ...prev,
              [resizing.current!.artifactId]: resizing.current!.current,
            }))
          }
          if (pendingPan.current) {
            setPan(pendingPan.current)
            pendingPan.current = null
          }
        })
      }
    }

    const onUp = async () => {
      // Cancel any pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      // Save artifact size on resize end — F4 fix: per-artifact PATCH
      if (resizing.current) {
        const { artifactId, current } = resizing.current
        resizing.current = null

        // F7 fix: clear local size override so WS updates are not shadowed
        setLocalSizes(prev => { const next = { ...prev }; delete next[artifactId]; return next })

        await fetch(`/__prev/board/${boardId}/artifact/${artifactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ w: Math.round(current.w), h: Math.round(current.h) }),
        })
        // F5 fix: functional updater to avoid overwriting concurrent WS updates
        onBoardUpdate(prev => {
          if (!prev) return prev
          return { ...prev, artifacts: prev.artifacts.map(a =>
            a.id === artifactId ? { ...a, w: Math.round(current.w), h: Math.round(current.h) } : a
          )}
        })
      }
      resizing.current = null

      // Save artifact position on drag end — F4 fix: per-artifact PATCH
      if (dragging.current) {
        const { artifactId, current } = dragging.current
        dragging.current = null

        // Clear local position override after persist
        setLocalPositions(prev => { const next = { ...prev }; delete next[artifactId]; return next })

        await fetch(`/__prev/board/${boardId}/artifact/${artifactId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: Math.round(current.x), y: Math.round(current.y) }),
        })
        // F5 fix: functional updater
        onBoardUpdate(prev => {
          if (!prev) return prev
          return { ...prev, artifacts: prev.artifacts.map(a =>
            a.id === artifactId ? { ...a, x: Math.round(current.x), y: Math.round(current.y) } : a
          )}
        })
      }
      dragging.current = null

      // Flush pending pan
      if (pendingPan.current) {
        setPan(pendingPan.current)
        pendingPan.current = null
      }
      panning.current = null
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // F10 fix: reset cursor on cleanup (unmount during drag)
      document.body.style.cursor = ''
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [zoom, boardId, onBoardUpdate])

  // F4 fix: read from localPositionsRef to get latest position (not stale board)
  // F11 fix: guard against concurrent drag+resize
  const handleDragStart = useCallback((artifactId: string, e: React.MouseEvent) => {
    if (resizing.current) return
    const artifact = boardRef.current?.artifacts.find(a => a.id === artifactId)
    if (!artifact) return
    document.body.style.cursor = 'grabbing'
    const pos = localPositionsRef.current[artifactId] ?? { x: artifact.x, y: artifact.y }
    dragging.current = {
      artifactId,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: pos,
      current: pos,
    }
  }, [])

  // F11 fix: guard against concurrent drag+resize
  const handleResizeStart = useCallback((artifactId: string, e: React.MouseEvent) => {
    if (dragging.current) return
    const artifact = boardRef.current?.artifacts.find(a => a.id === artifactId)
    if (!artifact) return
    document.body.style.cursor = 'nwse-resize'
    const renderedSize = cardSizes.current[artifactId]
    const startW = renderedSize?.w ?? (artifact.w > 0 ? artifact.w : CARD_W)
    const startH = renderedSize?.h ?? (artifact.h > 0 ? artifact.h : CARD_MIN_H)
    resizing.current = {
      artifactId,
      startMouse: { x: e.clientX, y: e.clientY },
      startSize: { w: startW, h: startH },
      current: { w: startW, h: startH },
    }
  }, [])

  // F3 fix: use panRef to avoid stale closure
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Pan on canvas background click (not on cards)
    if ((e.target as HTMLElement).closest('.artifact-card')) return
    panning.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      startPan: { ...panRef.current },
    }
    document.body.style.cursor = 'grab'
  }, [])

  // P5 fix: stable callback for React.memo
  const handleRemove = useCallback(async (artifactId: string) => {
    // F4 fix: per-artifact DELETE
    await fetch(`/__prev/board/${boardId}/artifact/${artifactId}`, { method: 'DELETE' })
    // F5 fix: functional updater
    onBoardUpdate(prev => prev ? { ...prev, artifacts: prev.artifacts.filter(a => a.id !== artifactId) } : prev)
    setLocalPositions(p => { const next = { ...p }; delete next[artifactId]; return next })
    // F9 fix: also clear localSizes and cardSizes for removed artifact
    setLocalSizes(s => { const next = { ...s }; delete next[artifactId]; return next })
    delete cardSizes.current[artifactId]
  }, [boardId, onBoardUpdate])

  const handleAddFile = (file: SotFile) => {
    const index = board?.artifacts.length ?? 0
    // Center first artifact, grid-position subsequent ones
    const pos = index === 0
      ? centerStartPosition(window.innerWidth, window.innerHeight, 0)
      : autoPosition(index, colCursorsRef.current)
    const typeMap: Record<string, Artifact['type']> = {
      flow: 'flow', screen: 'screen', doc: 'c3-doc', ref: 'c3-doc', a2ui: 'a2ui',
    }
    // A2UI screens get a taller default h so they show content immediately
    const defaultH = file.type === 'a2ui' ? 520 : 0
    onAddArtifact({ type: typeMap[file.type] ?? 'c3-doc', source: file.path, title: file.title, ...pos, w: CARD_W, h: defaultH })
  }

  // ── ResizeObserver — track actual rendered card heights ───────────────────
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement
        const id = el.dataset.artifactId
        if (id) {
          cardSizes.current[id] = {
            w: entry.contentRect.width,
            h: entry.contentRect.height,
          }
        }
      }
    })
    // Observe existing cards
    stage.querySelectorAll<HTMLElement>('[data-artifact-id]').forEach(el => ro.observe(el))
    // Watch for new cards
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes.forEach(n => {
          if (n instanceof HTMLElement && n.dataset.artifactId) ro.observe(n)
        })
      }
    })
    mo.observe(stage, { childList: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [])

  const handleFit = () => {
    if (!board?.artifacts.length || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const a of board.artifacts) {
      const pos = localPositions[a.id] ?? { x: a.x, y: a.y }
      const size = cardSizes.current[a.id] ?? { w: CARD_W, h: 400 }
      minX = Math.min(minX, pos.x)
      minY = Math.min(minY, pos.y)
      maxX = Math.max(maxX, pos.x + size.w)
      maxY = Math.max(maxY, pos.y + size.h)
    }
    const contentW = maxX - minX
    const contentH = maxY - minY
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(
      (rect.width - 80) / contentW,
      (rect.height - 80) / contentH,
    ) * 0.9))
    setZoom(newZoom)
    setPan({
      x: (rect.width - contentW * newZoom) / 2 - minX * newZoom,
      y: (rect.height - contentH * newZoom) / 2 - minY * newZoom,
    })
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
          ref={stageRef}
          className="board-canvas-stage"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
        >
          {/* Grid dots background */}

          {artifacts.length === 0 && (
            <div className="canvas-empty-hint" style={{ position: 'absolute', left: 120, top: 80, pointerEvents: 'none' }}>
              <span style={{ fontSize: 32, opacity: 0.15 }}>{'\u25fb'}</span>
              <span style={{ opacity: 0.3, fontSize: 13 }}>Click a file in the SOT browser to pin it here</span>
            </div>
          )}
          {artifacts.map(artifact => {
            const pos = getPos(artifact)
            return (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                position={pos}
                zoom={zoom}
                localSize={localSizes[artifact.id] ?? null}
                onDragStart={handleDragStart}
                onResizeStart={handleResizeStart}
                onRemove={handleRemove}
                boardId={boardId}
                threads={(board?.threads ?? []).filter(t => t.artifact_id === artifact.id)}
                onRefresh={refreshBoard}
                ws={ws}
                wsVersion={wsVersion}
                globalRefreshKey={globalRefreshKey}
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
