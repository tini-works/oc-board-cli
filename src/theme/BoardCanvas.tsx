import React from 'react'
import type { Board } from '../server/routes/board'
import { ArtifactCard } from './ArtifactCard'
import './BoardCanvas.css'

interface BoardCanvasProps {
  board: Board
  onRefresh: () => void
}

export function BoardCanvas({ board, onRefresh }: BoardCanvasProps) {
  if (board.artifacts.length === 0) {
    return (
      <div className="board-canvas-empty">
        <span style={{ fontSize: 48, opacity: 0.3 }}>&#9633;</span>
        <span>No artifacts yet</span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          Artifacts will appear here after generation.
        </span>
      </div>
    )
  }

  const handleDragEnd = async (artifactId: string, x: number, y: number) => {
    const updated = board.artifacts.map(a =>
      a.id === artifactId ? { ...a, x, y } : a
    )
    await fetch(`/__prev/board/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artifacts: updated }),
    })
    onRefresh()
  }

  const handleCreateThread = async (artifactId: string, xPct: number, yPct: number) => {
    const artifact = board.artifacts.find(a => a.id === artifactId)
    if (!artifact) return
    await fetch(`/__prev/board/${board.id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artifact_id: artifactId,
        x_pct: xPct,
        y_pct: yPct,
        artifact_type: artifact.type,
        artifact_source: artifact.source,
        comments: [{ author: 'user', text: '' }],
      }),
    })
    onRefresh()
  }

  return (
    <div className="board-canvas">
      <div className="board-canvas-grid">
        {board.artifacts.map(artifact => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            threads={board.threads.filter(t => t.artifact_id === artifact.id)}
            boardId={board.id}
            onDragEnd={handleDragEnd}
            onCreateThread={handleCreateThread}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  )
}
