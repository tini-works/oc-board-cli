import React, { useState, useEffect } from 'react'
import type { Board } from '../server/routes/board'

interface QueueStatusProps {
  boardId: string
}

export function QueueStatus({ boardId }: QueueStatusProps) {
  const [status, setStatus] = useState({ pending: 0, in_progress: 0, done: 0, failed: 0 })

  useEffect(() => {
    const poll = () => {
      fetch(`/__prev/board/${boardId}`)
        .then(r => r.json())
        .then((board: Board) => {  // flat response
          const q = board.queue
          setStatus({
            pending: q.filter(t => t.status === 'pending').length,
            in_progress: q.filter(t => t.status === 'in_progress').length,
            done: q.filter(t => t.status === 'done').length,
            failed: q.filter(t => t.status === 'failed').length,
          })
        })
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [boardId])

  const total = status.pending + status.in_progress
  if (total === 0 && status.failed === 0) return null

  return (
    <div style={{
      padding: '6px 12px',
      borderTop: '1px solid var(--fd-border)',
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--fd-muted-foreground)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--fd-muted)',
    }}>
      {status.in_progress > 0 && <span>⚙️ {status.in_progress} in progress</span>}
      {status.pending > 0 && <span>⏳ {status.pending} pending</span>}
      {status.failed > 0 && <span style={{ color: '#ef4444' }}>❌ {status.failed} failed</span>}
    </div>
  )
}
