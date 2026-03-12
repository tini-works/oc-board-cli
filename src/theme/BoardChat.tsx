import React, { useState, useRef, useEffect, useCallback } from 'react'
import { marked } from 'marked'
import type { Board, ChatMessage } from '../server/routes/board'
import { QueueStatus } from './QueueStatus'
import './BoardChat.css'

marked.use({ breaks: true, gfm: true })

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function MarkdownContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const html = marked.parse(text) as string
  return (
    <div
      className={`board-chat-markdown${streaming ? ' streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

interface StreamingMsg {
  msgId: string
  text: string
}

interface BoardChatProps {
  boardId: string
}

// BoardChat owns its own state — driven entirely by the SSE channel
export function BoardChat({ boardId }: BoardChatProps) {
  const [board, setBoard] = useState<Board | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // Tracks the in-progress AI response before it's committed to board.chat
  const [streaming, setStreaming] = useState<StreamingMsg | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const greetedRef = useRef(false)

  // ── Connect to the SSE channel ───────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource(`/__prev/board/${boardId}/stream`)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)

        if (event.type === 'board') {
          // Full board snapshot — initial connect or state sync
          setBoard(event.board)
        }

        if (event.type === 'message') {
          // A new committed message (user or openclaw greeting)
          setBoard(prev => {
            if (!prev) return event.board
            const already = prev.chat.some((m: ChatMessage) => m.id === event.message.id)
            if (already) return prev
            return { ...prev, chat: [...prev.chat, event.message], phase: event.board.phase }
          })
        }

        if (event.type === 'ai_start') {
          // OpenClaw started generating — show typing bubble
          setSending(true)
          setStreaming({ msgId: event.msgId, text: '' })
        }

        if (event.type === 'token') {
          // Append incoming token to the streaming bubble
          setStreaming(prev =>
            prev?.msgId === event.msgId
              ? { ...prev, text: prev.text + event.token }
              : prev
          )
        }

        if (event.type === 'ai_done') {
          // AI finished — collapse streaming bubble into real message
          setStreaming(null)
          setSending(false)
          setBoard(event.board)
        }

        if (event.type === 'error') {
          setStreaming(null)
          setSending(false)
        }
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      // EventSource auto-reconnects — nothing to do
    }

    return () => es.close()
  }, [boardId])

  // ── Greeting on first load ───────────────────────────────────────────────
  useEffect(() => {
    if (!board || greetedRef.current) return
    if (board.chat.length === 0) {
      greetedRef.current = true
      fetch(`/__prev/board/${boardId}/greeting`, { method: 'POST' }).catch(() => {})
    } else {
      greetedRef.current = true
    }
  }, [board, boardId])

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [board?.chat.length, streaming?.text])

  // ── Send user message ────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!text.trim() || sending) return
    const msg = text.trim()
    setText('')

    // Optimistic: add user message to local chat immediately
    const tempMsg: ChatMessage = { id: uid(), author: 'user', text: msg, ts: new Date().toISOString() }
    setBoard(prev => prev ? { ...prev, chat: [...prev.chat, tempMsg] } : prev)

    // Fire-and-forget — server saves + triggers AI async
    await fetch(`/__prev/board/${boardId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'user', text: msg }),
    }).catch(() => {})

    inputRef.current?.focus()
  }, [text, sending, boardId])

  const isDisabled = board?.phase === 'generating' || board?.phase === 'done'

  if (!board) {
    return (
      <div className="board-chat">
        <div className="board-chat-connecting">
          <div className="board-chat-typing-dots"><span /><span /><span /></div>
          <span>Connecting…</span>
        </div>
      </div>
    )
  }

  const summaryMsg = board.phase === 'summarizing'
    ? board.chat.findLast(m => m.author === 'openclaw')
    : null

  const handleConfirm = async () => {
    await fetch(`/__prev/board/${boardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'generating' }),
    })
    await fetch(`/__prev/board/${boardId}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'initial', context: { chat_history: board.chat } }),
    })
  }

  return (
    <div className="board-chat">
      {/* Header */}
      <div className="board-chat-header">
        <div className="board-chat-header-left">
          <span className="board-chat-avatar">🤖</span>
          <div>
            <span className="board-chat-title">OpenClaw</span>
            <span className="board-chat-status">
              {sending ? 'typing…' : 'online'}
            </span>
          </div>
        </div>
        <span className="board-chat-phase">{board.phase}</span>
      </div>

      {/* Messages */}
      <div className="board-chat-messages" ref={messagesRef}>
        {board.chat.map(msg => (
          <div
            key={msg.id}
            className="board-chat-msg"
            data-author={msg.author === 'openclaw' ? 'openclaw' : 'user'}
          >
            <div className="board-chat-msg-meta">
              <span className="board-chat-msg-author">
                {msg.author === 'openclaw' ? 'OpenClaw' : 'You'}
              </span>
              <span className="board-chat-msg-time">
                {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {msg.author === 'openclaw'
              ? <MarkdownContent text={msg.text} />
              : <div className="board-chat-user-text">{msg.text}</div>
            }
          </div>
        ))}

        {/* Live streaming bubble */}
        {streaming && (
          <div className="board-chat-msg" data-author="openclaw">
            <div className="board-chat-msg-meta">
              <span className="board-chat-msg-author">OpenClaw</span>
              <span className="board-chat-msg-time">now</span>
            </div>
            {streaming.text
              ? <MarkdownContent text={streaming.text} streaming />
              : <div className="board-chat-typing-dots"><span /><span /><span /></div>
            }
          </div>
        )}

        {summaryMsg && (
          <div className="board-summary-card">
            <h4>Here's what I'm about to build:</h4>
            <MarkdownContent text={summaryMsg.text} />
            <button className="board-confirm-btn" onClick={handleConfirm}>
              Confirm &amp; Generate
            </button>
          </div>
        )}
      </div>

      <QueueStatus boardId={boardId} />

      {/* Input */}
      <div className="board-chat-input">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={isDisabled ? 'Chat disabled during generation' : 'Message OpenClaw…'}
          disabled={!!isDisabled}
          autoFocus
        />
        <button
          className="board-chat-send-btn"
          onClick={sendMessage}
          disabled={!!isDisabled || !text.trim()}
        >
          {sending
            ? <span className="board-chat-send-spinner" />
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
          }
        </button>
      </div>
    </div>
  )
}
