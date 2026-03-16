import { useState, useEffect } from 'react'

interface QueueStatusProps {
  boardId: string
}

// F6 fix: use the dedicated queue-status endpoint instead of fetching the full board
export function QueueStatus({ boardId }: QueueStatusProps) {
  const [status, setStatus] = useState({ pending: 0, in_progress: 0, done: 0, failed: 0 })

  useEffect(() => {
    const poll = () => {
      fetch(`/__prev/board/${boardId}/queue-status`)
        .then(r => r.json())
        .then(setStatus)
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
      {status.in_progress > 0 && <span>{'\u2699\ufe0f'} {status.in_progress} in progress</span>}
      {status.pending > 0 && <span>{'\u23f3'} {status.pending} pending</span>}
      {status.failed > 0 && <span style={{ color: '#ef4444' }}>{'\u274c'} {status.failed} failed</span>}
    </div>
  )
}
