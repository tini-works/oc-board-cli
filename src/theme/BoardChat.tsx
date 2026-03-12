import React, { useState, useRef, useEffect } from 'react'
import type { Board } from '../server/routes/board'
import './BoardChat.css'

interface BoardChatProps {
  board: Board
  onRefresh: () => void
}

export function BoardChat({ board, onRefresh }: BoardChatProps) {
  const [text, setText] = useState('')
  const messagesRef = useRef<HTMLDivElement>(null)
  const isDisabled = board.phase === 'generating' || board.phase === 'done'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [board.chat.length])

  const sendMessage = async () => {
    if (!text.trim() || isDisabled) return
    const msg = text.trim()
    setText('')
    await fetch(`/__prev/board/${board.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'user', text: msg }),
    })
    onRefresh()
  }

  const handleConfirm = async () => {
    // Transition to generating + enqueue initial task
    await fetch(`/__prev/board/${board.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'generating' }),
    })
    await fetch(`/__prev/board/${board.id}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'initial',
        context: { chat_history: board.chat },
      }),
    })
    onRefresh()
  }

  // Show summary card during summarizing phase (last openclaw message)
  const summaryMsg = board.phase === 'summarizing'
    ? board.chat.findLast(m => m.author === 'openclaw')
    : null

  return (
    <div className="board-chat">
      <div className="board-chat-header">
        <span className="board-chat-title">Chat</span>
        <span className="board-chat-phase">{board.phase}</span>
      </div>

      <div className="board-chat-messages" ref={messagesRef}>
        {board.chat.map(msg => (
          <div
            key={msg.id}
            className="board-chat-msg"
            data-author={msg.author === 'openclaw' ? 'openclaw' : 'user'}
          >
            <div className="board-chat-msg-author">
              {msg.author}
              <span className="board-chat-msg-time">
                {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div>{msg.text}</div>
          </div>
        ))}

        {/* Summary card with Confirm gate */}
        {summaryMsg && (
          <div className="board-summary-card">
            <h4>Here's what I'm about to build:</h4>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{summaryMsg.text}</div>
            <button className="board-confirm-btn" onClick={handleConfirm}>
              Confirm &amp; Generate
            </button>
          </div>
        )}
      </div>

      <div className="board-chat-input">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={isDisabled ? 'Chat disabled during generation' : 'Type a message...'}
          disabled={isDisabled}
        />
        <button
          className="board-chat-send-btn"
          onClick={sendMessage}
          disabled={isDisabled || !text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  )
}
