import React, { useState, useEffect } from 'react'
import type { Board as BoardState } from '../server/routes/board'
import { BoardCanvas } from './BoardCanvas'
import { BoardChat } from './BoardChat'
import './Board.css'

function useBoard(boardId: string) {
  const [board, setBoard] = useState<BoardState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/__prev/board/${boardId}`)
      .then(r => r.json())
      .then((data: BoardState) => setBoard(data))
      .catch(() => setBoard(null))
      .finally(() => setLoading(false))
  }, [boardId])

  const refresh = () => {
    fetch(`/__prev/board/${boardId}`)
      .then(r => r.json())
      .then((data: BoardState) => setBoard(data))
      .catch(() => {})
  }

  return { board, loading, refresh, setBoard }
}

export function Board({ boardId }: { boardId: string }) {
  const { board, loading, refresh, setBoard } = useBoard(boardId)

  if (loading) return <div className="board-loading">Loading board...</div>
  if (!board) return <div className="board-loading">Board not found</div>

  const isDiscussing = board.phase === 'created' || board.phase === 'discussing' || board.phase === 'summarizing'

  return (
    <div className="board-layout" data-phase={board.phase}>
      {/* Canvas (left) */}
      <div className="board-canvas-panel">
        {isDiscussing ? (
          <div className="board-canvas-placeholder">
            <span className="board-canvas-placeholder-icon">&#9633;</span>
            <span>Waiting for your first request...</span>
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              Start a discussion in the chat panel, then confirm to generate artifacts.
            </span>
          </div>
        ) : (
          <BoardCanvas board={board} onRefresh={refresh} />
        )}
      </div>

      {/* Chat (right) */}
      <div className="board-chat-panel">
        <BoardChat board={board} onRefresh={refresh} />
      </div>
    </div>
  )
}
