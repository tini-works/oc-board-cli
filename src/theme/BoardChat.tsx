import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { marked } from 'marked'
import type { Board as BoardState, ChatMessage } from '../server/routes/board'
import { QueueStatus } from './QueueStatus'
import { highlightThink } from './ThinkHighlight'
import './ThinkHighlight.css'
import './BoardChat.css'

marked.use({ breaks: true, gfm: true })

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// P6 fix: memoize marked.parse() so it only re-runs when text changes
// Security note: dangerouslySetInnerHTML is used intentionally here for rendering
// trusted markdown from the AI assistant (OpenClaw). User messages use plain text
// rendering (see board-chat-user-text below). The AI content comes from our own
// OpenClaw gateway, not from arbitrary user input.
function MarkdownContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const html = useMemo(() => marked.parse(text) as string, [text])
  return (
    <div
      className={`board-chat-markdown${streaming ? ' streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function ThinkingBlock({ text, streaming }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <details className={`board-chat-thinking${streaming ? ' streaming' : ''}`} open={open || streaming}>
      <summary onClick={e => { e.preventDefault(); setOpen(!open) }}>
        {streaming ? 'Thinking\u2026' : 'Thinking'}
      </summary>
      <div className="board-chat-thinking-content">{text}</div>
    </details>
  )
}


interface StreamingMsg {
  msgId: string
  text: string
  thinking: string
}

interface BoardChatProps {
  boardId: string
  board: BoardState | null
  setBoard: React.Dispatch<React.SetStateAction<BoardState | null>>
  ws: React.RefObject<WebSocket | null>
  wsVersion: number
  started: boolean
  checking: boolean
  onStart: () => void
}

// BoardChat reads board state from Board.tsx via props; WS events for streaming only
export function BoardChat({ boardId, board, setBoard, ws, wsVersion, started, checking, onStart }: BoardChatProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState<StreamingMsg | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragMinH = useRef<number | null>(null)
  const greetedRef = useRef(false)

  // I8 fix: RAF-batched token accumulation
  const tokenBufRef = useRef('')
  const thinkingBufRef = useRef('')
  const streamRafRef = useRef<number | null>(null)
  const streamingMsgIdRef = useRef<string | null>(null)

  // ── Listen for streaming events on the shared WS ──────────────────────────
  useEffect(() => {
    const wsInstance = ws.current
    if (!wsInstance) return

    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string)
        if (event.type === 'ai_start') {
          setSending(true)
          tokenBufRef.current = ''
          thinkingBufRef.current = ''
          streamingMsgIdRef.current = event.msgId
          setStreaming({ msgId: event.msgId, text: '', thinking: '' })
        }
        if (event.type === 'thinking_token' && event.msgId === streamingMsgIdRef.current) {
          thinkingBufRef.current += event.token
          if (streamRafRef.current === null) {
            streamRafRef.current = requestAnimationFrame(() => {
              streamRafRef.current = null
              setStreaming(prev =>
                prev && prev.msgId === streamingMsgIdRef.current
                  ? { msgId: prev.msgId, text: tokenBufRef.current, thinking: thinkingBufRef.current }
                  : prev
              )
            })
          }
        }
        if (event.type === 'token' && event.msgId === streamingMsgIdRef.current) {
          // I8 fix: accumulate tokens in ref, flush via RAF
          tokenBufRef.current += event.token
          if (streamRafRef.current === null) {
            streamRafRef.current = requestAnimationFrame(() => {
              streamRafRef.current = null
              setStreaming(prev =>
                prev && prev.msgId === streamingMsgIdRef.current
                  ? { msgId: prev.msgId, text: tokenBufRef.current, thinking: thinkingBufRef.current }
                  : prev
              )
            })
          }
        }
        if (event.type === 'ai_done') {
          if (streamRafRef.current !== null) {
            cancelAnimationFrame(streamRafRef.current)
            streamRafRef.current = null
          }
          tokenBufRef.current = ''
          thinkingBufRef.current = ''
          streamingMsgIdRef.current = null
          setStreaming(null)
          setSending(false)
          setBoard(event.board)
        }
        if (event.type === 'error') {
          if (streamRafRef.current !== null) {
            cancelAnimationFrame(streamRafRef.current)
            streamRafRef.current = null
          }
          tokenBufRef.current = ''
          thinkingBufRef.current = ''
          streamingMsgIdRef.current = null
          setStreaming(null)
          setSending(false)
        }
      } catch { /* ignore */ }
    }

    wsInstance.addEventListener('message', handler)
    return () => {
      wsInstance.removeEventListener('message', handler)
      if (streamRafRef.current !== null) {
        cancelAnimationFrame(streamRafRef.current)
        streamRafRef.current = null
      }
    }
  }, [wsVersion, setBoard])

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

  // ── Auto-scroll — I9 fix: debounced to ~12fps max ─────────────────────────
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = setTimeout(() => {
      const el = messagesRef.current
      if (el) el.scrollTop = el.scrollHeight
    }, 80)
    return () => {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [board?.chat.length, streaming?.text])

  // ── Send user message ────────────────────────────────────────────────────
  const sendingRef = useRef(false)
  const sendMessage = useCallback(async () => {
    if (!text.trim() || sending || sendingRef.current) return
    sendingRef.current = true
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

    sendingRef.current = false
    inputRef.current?.focus()
  }, [text, sending, boardId])

  // Auto-scale textarea height on content change
  useEffect(() => {
    const ta = inputRef.current
    const wrap = wrapRef.current
    if (!ta || !wrap) return
    ta.style.height = '0'
    const contentH = ta.scrollHeight
    ta.style.height = ''
    const minH = dragMinH.current
    const h = minH && minH > contentH ? minH : contentH
    wrap.style.height = h + 'px'
  }, [text])

  // Drag-to-resize from top handle
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const wrap = wrapRef.current
    if (!wrap) return
    const startY = e.clientY
    const startH = wrap.offsetHeight
    const onMove = (ev: MouseEvent) => {
      const newH = Math.min(650, Math.max(36, startH + (startY - ev.clientY)))
      dragMinH.current = newH
      wrap.style.height = newH + 'px'
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const isDisabled = board?.phase === 'generating' || board?.phase === 'done'

  // ── Not yet started — show intro CTA ────────────────────────────────────
  if (!started) {
    return (
      <div className="board-chat board-chat-idle">
        <div className="board-chat-start-screen">
          <div className="board-chat-start-avatar">{'\ud83e\udd16'}</div>
          <h2 className="board-chat-start-title">OpenClaw</h2>
          <p className="board-chat-start-desc">
            Your AI collaborator. Start a session to think through your project, draft docs, design flows, or plan features.
          </p>
          <button
            className="board-chat-start-btn"
            onClick={onStart}
            disabled={checking}
          >
            {checking
              ? <><span className="board-chat-send-spinner" /> {'Checking\u2026'}</>
              : <>Start session <span className="board-chat-start-arrow">{'\u2192'}</span></>
            }
          </button>
          <span className="board-chat-start-hint">
            Powered by OpenClaw
          </span>
        </div>
      </div>
    )
  }

  // ── Started but WS not yet connected / board loading ──────────────────────
  if (!board) {
    return (
      <div className="board-chat">
        <div className="board-chat-connecting">
          <div className="board-chat-typing-dots"><span /><span /><span /></div>
          <span>{'Connecting\u2026'}</span>
        </div>
      </div>
    )
  }

  // Replace .findLast (ES2023) with reverse+find for broader compat
  const summaryMsg = board.phase === 'summarizing'
    ? [...board.chat].reverse().find((m: ChatMessage) => m.author === 'openclaw')
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
          <span className="board-chat-avatar">{'\ud83e\udd16'}</span>
          <div>
            <span className="board-chat-title">OpenClaw</span>
            <span className="board-chat-status">
              {sending ? 'typing\u2026' : 'online'}
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
              ? <>
                  {msg.thinking && <ThinkingBlock text={msg.thinking} />}
                  <MarkdownContent text={msg.text} />
                </>
              : <div className="board-chat-user-text">{highlightThink(msg.text)}</div>
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
            {streaming.thinking && <ThinkingBlock text={streaming.thinking} streaming />}
            {streaming.text
              ? <MarkdownContent text={streaming.text} streaming />
              : !streaming.thinking && <div className="board-chat-typing-dots"><span /><span /><span /></div>
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
        <div className="board-chat-input-wrap" ref={wrapRef}>
          <div className="board-chat-input-drag" onMouseDown={onDragStart} />
          <div className="board-chat-input-mirror" aria-hidden="true">
            {text ? highlightThink(text) : <span className="board-chat-input-placeholder">{isDisabled ? 'Chat disabled during generation' : 'Message OpenClaw\u2026'}</span>}
          </div>
          <textarea
            ref={inputRef}
            className="board-chat-input-real"
            value={text}
            rows={1}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder=""
            disabled={!!isDisabled}
            autoFocus
          />
        </div>
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
