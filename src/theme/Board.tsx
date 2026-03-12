import React, { useState, useEffect } from 'react'
import type { Board as BoardState } from '../server/routes/board'
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
          <div style={{ padding: 16, color: 'var(--fd-muted-foreground)', fontSize: 13 }}>
            Canvas: {board.artifacts.length} artifacts (full canvas in Task 5)
          </div>
        )}
      </div>

      {/* Chat (right) — stub for now, replaced in Task 3 */}
      <div className="board-chat-panel">
        <BoardChatStub board={board} onRefresh={refresh} />
      </div>
    </div>
  )
}

// Temporary stub — will be replaced by BoardChat component in Task 3
function BoardChatStub({ board, onRefresh }: { board: BoardState; onRefresh: () => void }) {
  const [text, setText] = useState('')
  const isDisabled = board.phase === 'generating' || board.phase === 'done'

  const sendMessage = async () => {
    if (!text.trim() || isDisabled) return
    await fetch(`/__prev/board/${board.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'user', text: text.trim() }),
    })
    setText('')
    onRefresh()
  }

  return (
    <>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--fd-border)',
        fontWeight: 600,
        fontSize: 14,
      }}>
        Chat · {board.phase}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {board.chat.map(msg => (
          <div key={msg.id} style={{
            marginBottom: 8,
            padding: '8px 12px',
            background: msg.author === 'openclaw' ? 'var(--fd-accent)' : 'var(--fd-muted)',
            borderRadius: 8,
            fontSize: 13,
          }}>
            <strong style={{ fontSize: 11, opacity: 0.7 }}>{msg.author}</strong>
            <p style={{ margin: '2px 0 0' }}>{msg.text}</p>
          </div>
        ))}
      </div>
      <div style={{
        padding: 12,
        borderTop: '1px solid var(--fd-border)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={isDisabled ? 'Chat disabled' : 'Type a message...'}
          disabled={isDisabled}
          style={{
            flex: 1, padding: '8px 12px',
            border: '1px solid var(--fd-border)', borderRadius: 8,
            background: 'var(--fd-background)', color: 'var(--fd-foreground)',
            fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isDisabled || !text.trim()}
          style={{
            padding: '8px 16px', background: '#7c3aed', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled || !text.trim() ? 0.5 : 1,
          }}
        >Send</button>
      </div>
    </>
  )
}
