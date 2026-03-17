import { useState, useEffect, useRef, useCallback } from 'react'
import type { Board as BoardState, Artifact, ChatMessage } from '../server/routes/board'
import { BoardCanvas } from './BoardCanvas'
import { BoardChat } from './BoardChat'
import './Board.css'

function uid() { return Math.random().toString(36).slice(2, 10) }

// ── Shared WS hook — lazy connect (only when started=true) ───────────────────
function useBoardChannel(boardId: string, started: boolean) {
  const [board, setBoard] = useState<BoardState | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [wsVersion, setWsVersion] = useState(0)

  useEffect(() => {
    if (!started) return
    let dead = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/__prev/board/${boardId}/ws`)
      wsRef.current = ws
      setWsVersion(v => v + 1)

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string)
          if (event.type === 'board') setBoard(event.board)
          if (event.type === 'message') {
            setBoard(prev => {
              if (!prev) return event.board
              if (prev.chat.some((m: ChatMessage) => m.id === event.message.id)) return prev
              // Skip if an optimistic message with same author+text already exists
              if (prev.chat.some((m: ChatMessage) => m.author === event.message.author && m.text === event.message.text)) {
                // Replace the optimistic message id with the server id
                return {
                  ...prev,
                  chat: prev.chat.map((m: ChatMessage) =>
                    m.author === event.message.author && m.text === event.message.text ? event.message : m
                  ),
                  phase: event.board.phase,
                }
              }
              return { ...prev, chat: [...prev.chat, event.message], phase: event.board.phase }
            })
          }
          if (event.type === 'ai_done') setBoard(event.board)
          if (event.type === 'board_updated') setBoard(event.board)
        } catch { /* ignore */ }
      }

      ws.onclose = () => { if (!dead) reconnectTimer = setTimeout(connect, 1500) }
      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      dead = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [boardId, started])

  const addArtifact = async (artifact: Omit<Artifact, 'id'>) => {
    const newArtifact: Artifact = { ...artifact, id: uid() }
    const current = board
    if (!current) return
    const updated = [...current.artifacts, newArtifact]
    await fetch(`/__prev/board/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifacts: updated }),
    })
    setBoard(prev => prev ? { ...prev, artifacts: [...prev.artifacts, newArtifact] } : prev)
  }

  return { board, setBoard, addArtifact, ws: wsRef, wsVersion }
}

export function Board({ boardId }: { boardId: string }) {
  // Auto-resume if this board was already started (check via a quick fetch)
  const [started, setStarted] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Peek at the board file — if it has prior chat, auto-start
    fetch(`/__prev/board/${boardId}`)
      .then(r => r.json())
      .then((b: BoardState) => {
        if (b.chat && b.chat.length > 0) setStarted(true)
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [boardId])

  const { board, setBoard, addArtifact, ws, wsVersion } = useBoardChannel(boardId, started)

  // ── Resizable chat panel ──────────────────────────────────────────────────
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem('board-chat-width')
    return saved ? Math.min(Math.max(Number(saved), 240), 700) : 320
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = chatWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [chatWidth])

  useEffect(() => {
    let lastWidth = 0
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = startX.current - e.clientX
      lastWidth = Math.min(Math.max(startW.current + delta, 240), 700)
      setChatWidth(lastWidth)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (lastWidth) localStorage.setItem('board-chat-width', String(lastWidth))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div className="board-layout">
      <div className="board-canvas-panel">
        <BoardCanvas
          boardId={boardId}
          board={board}
          onAddArtifact={addArtifact}
          onBoardUpdate={setBoard}
        />
      </div>
      <div className="board-chat-resize-handle" onMouseDown={onDragStart} />
      <div className="board-chat-panel" style={{ width: chatWidth }}>
        <BoardChat
          boardId={boardId}
          board={board}
          setBoard={setBoard}
          ws={ws}
          wsVersion={wsVersion}
          started={started}
          checking={checking}
          onStart={() => setStarted(true)}
        />
      </div>
    </div>
  )
}
