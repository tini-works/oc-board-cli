import React from 'react'
import { BoardChat } from './BoardChat'
import './Board.css'

export function Board({ boardId }: { boardId: string }) {
  return (
    <div className="board-layout">
      {/* Canvas (left) — placeholder until artifacts exist */}
      <div className="board-canvas-panel">
        <div className="board-canvas-placeholder">
          <span className="board-canvas-placeholder-icon">&#9633;</span>
          <span>Waiting for your first request…</span>
          <span style={{ fontSize: 12, opacity: 0.5 }}>
            Chat with OpenClaw on the right to get started.
          </span>
        </div>
      </div>

      {/* Chat (right) — owns its own state via SSE channel */}
      <div className="board-chat-panel">
        <BoardChat boardId={boardId} />
      </div>
    </div>
  )
}
