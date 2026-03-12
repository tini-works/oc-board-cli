import React, { useState, useEffect, useRef } from 'react'
import type { Board as BoardState, Artifact, ChatMessage } from '../server/routes/board'
import type { SotFile } from '../server/routes/sot'
import { BoardCanvas } from './BoardCanvas'
import { BoardChat } from './BoardChat'
import './Board.css'

function uid() { return Math.random().toString(36).slice(2, 10) }

// ── Shared WS hook — both canvas and chat read from this ──────────────────────
function useBoardChannel(boardId: string) {
  const [board, setBoard] = useState<BoardState | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let dead = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${location.host}/__prev/board/${boardId}/ws`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string)
          if (event.type === 'board') setBoard(event.board)
          if (event.type === 'message') {
            setBoard(prev => {
              if (!prev) return event.board
              if (prev.chat.some((m: ChatMessage) => m.id === event.message.id)) return prev
              return { ...prev, chat: [...prev.chat, event.message], phase: event.board.phase }
            })
          }
          if (event.type === 'ai_start' || event.type === 'token' || event.type === 'ai_done' || event.type === 'error') {
            // Forwarded to BoardChat via the same ws reference
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
  }, [boardId])

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
    setBoard(prev => prev ? { ...prev, artifacts: updated } : prev)
  }

  return { board, setBoard, addArtifact, ws: wsRef }
}

export function Board({ boardId }: { boardId: string }) {
  const { board, setBoard, addArtifact, ws } = useBoardChannel(boardId)

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
      <div className="board-chat-panel">
        <BoardChat boardId={boardId} board={board} setBoard={setBoard} ws={ws} />
      </div>
    </div>
  )
}
