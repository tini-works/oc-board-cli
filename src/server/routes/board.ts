// board.ts — server-side board state persistence + real-time channel
import path from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  author: string
  text: string
  ts: string
}

export type ArtifactType = 'preview' | 'c3-doc' | 'flow'

export interface Artifact {
  id: string
  type: ArtifactType
  source: string
  title?: string
  x: number
  y: number
  w: number
  h: number
}

export type ThreadStatus = 'open' | 'update_requested' | 'proposed' | 'confirmed' | 'dismissed'

export interface CommentThread {
  id: string
  artifact_id: string
  artifact_type: ArtifactType
  artifact_source: string
  x_pct: number
  y_pct: number
  comments: { id: string; author: string; text: string; ts: string }[]
  update_requested: boolean
  task_id?: string
  status: ThreadStatus
}

export type BoardPhase = 'created' | 'discussing' | 'summarizing' | 'generating' | 'iterating' | 'finalizing' | 'done'

export type TaskType = 'initial' | 'update'
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'failed'

export interface GenerationTask {
  id: string
  board_id: string
  type: TaskType
  status: TaskStatus
  artifact_id?: string
  thread_id?: string
  context: {
    chat_history?: ChatMessage[]
    comments?: { id: string; author: string; text: string; ts: string }[]
    artifact_source?: string
    artifact_type?: ArtifactType
  }
  created_at: string
  started_at?: string
  completed_at?: string
  retries: number
}

export interface Board {
  id: string
  sot?: string
  cr_id?: string | null
  phase: BoardPhase
  created_at: string
  chat: ChatMessage[]
  artifacts: Artifact[]
  threads: CommentThread[]
  queue: GenerationTask[]
}

// ── SSE Channel Registry ──────────────────────────────────────────────────────
// Per-board set of connected browser clients. This is the "channel" —
// tokens and board events are pushed here as they happen.

type SSEController = ReadableStreamDefaultController<Uint8Array>

const boardChannels = new Map<string, Set<SSEController>>()
const encoder = new TextEncoder()

function channelFor(boardId: string): Set<SSEController> {
  if (!boardChannels.has(boardId)) boardChannels.set(boardId, new Set())
  return boardChannels.get(boardId)!
}

function broadcast(boardId: string, event: object) {
  const clients = boardChannels.get(boardId)
  if (!clients || clients.size === 0) return
  const chunk = encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
  for (const ctrl of clients) {
    try { ctrl.enqueue(chunk) } catch { clients.delete(ctrl) }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function boardsDir(rootDir: string): string {
  return path.join(rootDir, '.prev-boards')
}

function boardPath(rootDir: string, boardId: string): string {
  return path.join(boardsDir(rootDir), `${boardId}.json`)
}

function ensureBoardsDir(rootDir: string): void {
  const dir = boardsDir(rootDir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readBoard(rootDir: string, boardId: string): Board {
  const p = boardPath(rootDir, boardId)
  if (!existsSync(p)) {
    return {
      id: boardId,
      phase: 'created',
      created_at: new Date().toISOString(),
      chat: [],
      artifacts: [],
      threads: [],
      queue: [],
    }
  }
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return {
      id: boardId,
      phase: 'created',
      created_at: new Date().toISOString(),
      chat: [],
      artifacts: [],
      threads: [],
      queue: [],
    }
  }
}

function writeBoard(rootDir: string, board: Board): void {
  ensureBoardsDir(rootDir)
  writeFileSync(boardPath(rootDir, board.id), JSON.stringify(board, null, 2), 'utf-8')
}

// ── OpenClaw AI integration ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are OpenClaw, an AI assistant embedded in a collaborative board inside prev-cli — a live documentation and design preview tool.

Your role is to help users think through ideas, plan features, write documentation, review designs, generate artifacts, and collaborate on creative or technical work.

Guidelines:
- Be concise, practical, and thoughtful
- Use markdown: **bold**, lists, \`code\` — it renders in the UI
- When users describe something to build, help them refine requirements
- Keep a warm, competent tone`

async function generateAIResponse(rootDir: string, boardId: string, chatHistory: ChatMessage[]) {
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || ''
  const gatewayHost = 'host.docker.internal'
  const gatewayPort = 18789

  const messages = chatHistory.map(m => ({
    role: m.author === 'openclaw' ? 'assistant' : 'user',
    content: m.text,
  }))

  let response: Response
  try {
    response = await fetch(`http://${gatewayHost}:${gatewayPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: 'openclaw:main',
        stream: true,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    })
  } catch (err) {
    broadcast(boardId, { type: 'error', text: String(err) })
    return
  }

  if (!response.ok) {
    broadcast(boardId, { type: 'error', text: `Gateway error ${response.status}` })
    return
  }

  // Signal start of AI response to all connected clients
  const aiMsgId = uid()
  broadcast(boardId, { type: 'ai_start', msgId: aiMsgId })

  const reader = response.body!.getReader()
  const dec = new TextDecoder()
  let fullText = ''
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const token: string = parsed.choices?.[0]?.delta?.content ?? ''
        if (token) {
          fullText += token
          // Broadcast each token to all connected clients
          broadcast(boardId, { type: 'token', msgId: aiMsgId, token })
        }
      } catch { /* ignore */ }
    }
  }

  // Save complete AI message to board
  const aiMsg: ChatMessage = {
    id: aiMsgId,
    author: 'openclaw',
    text: fullText,
    ts: new Date().toISOString(),
  }
  const board = readBoard(rootDir, boardId)
  board.chat.push(aiMsg)
  writeBoard(rootDir, board)

  // Signal completion — clients can now treat accumulated tokens as the final message
  broadcast(boardId, { type: 'ai_done', msgId: aiMsgId, board })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export function createBoardHandler(rootDir: string) {
  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)
    const pathname = url.pathname

    const boardMatch = pathname.match(/^\/__prev\/board\/([^/]+)(?:\/(.+))?$/)
    if (!boardMatch) return null

    const boardId = boardMatch[1]
    const subRoute = boardMatch[2]

    if (!/^[a-zA-Z0-9_-]+$/.test(boardId)) {
      return Response.json({ error: 'invalid board id' }, { status: 400 })
    }

    // ── GET /__prev/board/:id/stream — persistent SSE channel ─────────────
    // This is the live channel. The browser connects once and gets all
    // board events pushed: messages, AI tokens, state changes.
    if (subRoute === 'stream' && req.method === 'GET') {
      let ctrl: SSEController
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          ctrl = controller
          channelFor(boardId).add(controller)

          // Send current board state immediately on connect
          const board = readBoard(rootDir, boardId)
          const chunk = encoder.encode(`data: ${JSON.stringify({ type: 'board', board })}\n\n`)
          try { controller.enqueue(chunk) } catch { /* closed */ }
        },
        cancel() {
          channelFor(boardId).delete(ctrl)
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // ── GET /__prev/board/:id — return full board state ────────────────────
    if (!subRoute && req.method === 'GET') {
      const board = readBoard(rootDir, boardId)
      if (!existsSync(boardPath(rootDir, boardId))) writeBoard(rootDir, board)
      return Response.json(board)
    }

    // ── PATCH /__prev/board/:id — partial update ───────────────────────────
    if (!subRoute && req.method === 'PATCH') {
      let body: Partial<Board>
      try { body = await req.json() as Partial<Board> } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      const board = readBoard(rootDir, boardId)
      if (body.phase !== undefined) board.phase = body.phase
      if (body.artifacts !== undefined) board.artifacts = body.artifacts
      if (body.sot !== undefined) board.sot = body.sot
      if (body.cr_id !== undefined) board.cr_id = body.cr_id
      writeBoard(rootDir, board)
      broadcast(boardId, { type: 'board', board })
      return Response.json(board)
    }

    // ── POST /__prev/board/:id/chat — user sends a message ────────────────
    // Fire-and-forget: saves message, returns immediately, AI responds async
    if (subRoute === 'chat' && req.method === 'POST') {
      let body: { author?: string; text?: string }
      try { body = await req.json() as typeof body } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      if (!body.author || !body.text) {
        return Response.json({ error: 'missing author or text' }, { status: 400 })
      }

      const board = readBoard(rootDir, boardId)
      const message: ChatMessage = {
        id: uid(),
        author: body.author,
        text: body.text,
        ts: new Date().toISOString(),
      }
      board.chat.push(message)
      if (board.phase === 'created') board.phase = 'discussing'
      writeBoard(rootDir, board)

      // Push user message to all connected clients immediately
      broadcast(boardId, { type: 'message', message, board })

      // Trigger AI response asynchronously — don't await, return immediately
      if (body.author === 'user') {
        generateAIResponse(rootDir, boardId, board.chat).catch(console.error)
      }

      return Response.json({ ok: true, message })
    }

    // ── POST /__prev/board/:id/greeting — OpenClaw welcome message ─────────
    if (subRoute === 'greeting' && req.method === 'POST') {
      const board = readBoard(rootDir, boardId)
      if (board.chat.length > 0) return Response.json(board)

      const greetingText = `Hey! I'm OpenClaw 👋 — your AI collaborator on this board.\n\nTell me what you're working on and I'll help you think it through, draft docs, design screens, or plan flows. What are we building today?`
      const aiMsg: ChatMessage = {
        id: uid(),
        author: 'openclaw',
        text: greetingText,
        ts: new Date().toISOString(),
      }
      board.chat.push(aiMsg)
      writeBoard(rootDir, board)

      broadcast(boardId, { type: 'message', message: aiMsg, board })
      return Response.json(board)
    }

    // ── POST /__prev/board/:id/threads — add comment thread ────────────────
    if (subRoute === 'threads' && req.method === 'POST') {
      let body: {
        artifact_id?: string
        artifact_type?: ArtifactType
        artifact_source?: string
        x_pct?: number
        y_pct?: number
        comments?: { author: string; text: string }[]
      }
      try { body = await req.json() as typeof body } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }

      if (!body.artifact_id || !body.artifact_type || !body.artifact_source ||
          body.x_pct === undefined || body.y_pct === undefined || !body.comments?.length) {
        return Response.json({ error: 'missing required thread fields' }, { status: 400 })
      }

      const board = readBoard(rootDir, boardId)
      const thread: CommentThread = {
        id: uid(),
        artifact_id: body.artifact_id,
        artifact_type: body.artifact_type,
        artifact_source: body.artifact_source,
        x_pct: body.x_pct,
        y_pct: body.y_pct,
        comments: body.comments.map(c => ({
          id: uid(), author: c.author, text: c.text, ts: new Date().toISOString(),
        })),
        update_requested: false,
        status: 'open',
      }
      board.threads.push(thread)
      writeBoard(rootDir, board)
      return Response.json(board)
    }

    // ── POST /__prev/board/:id/queue ───────────────────────────────────────
    if (subRoute === 'queue' && req.method === 'POST') {
      let body: {
        type?: TaskType
        artifact_id?: string
        thread_id?: string
        context?: GenerationTask['context']
      }
      try { body = await req.json() as typeof body } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      if (!body.type || !body.context) {
        return Response.json({ error: 'missing type or context' }, { status: 400 })
      }
      const board = readBoard(rootDir, boardId)
      const task: GenerationTask = {
        id: uid(), board_id: boardId, type: body.type, status: 'pending',
        artifact_id: body.artifact_id, thread_id: body.thread_id,
        context: body.context, created_at: new Date().toISOString(), retries: 0,
      }
      board.queue.push(task)
      writeBoard(rootDir, board)
      return Response.json(board)
    }

    // ── POST /__prev/board/:id/threads/:threadId/comments ─────────────────
    const threadCommentMatch = subRoute?.match(/^threads\/([^/]+)\/comments$/)
    if (req.method === 'POST' && threadCommentMatch) {
      const threadId = threadCommentMatch[1]
      let body: { author: string; text: string }
      try { body = await req.json() as typeof body } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      const board = readBoard(rootDir, boardId)
      const thread = board.threads.find(t => t.id === threadId)
      if (!thread) return Response.json({ error: 'thread not found' }, { status: 404 })
      thread.comments.push({ id: uid(), author: body.author, text: body.text, ts: new Date().toISOString() })
      writeBoard(rootDir, board)
      return Response.json(board)
    }

    // ── POST /__prev/board/:id/threads/:threadId/request-update ───────────
    const requestUpdateMatch = subRoute?.match(/^threads\/([^/]+)\/request-update$/)
    if (req.method === 'POST' && requestUpdateMatch) {
      const threadId = requestUpdateMatch[1]
      const board = readBoard(rootDir, boardId)
      const thread = board.threads.find(t => t.id === threadId)
      if (!thread) return Response.json({ error: 'thread not found' }, { status: 404 })
      thread.status = 'update_requested'
      thread.update_requested = true
      const task: GenerationTask = {
        id: uid(), board_id: boardId, type: 'update', status: 'pending',
        artifact_id: thread.artifact_id, thread_id: threadId,
        context: { comments: thread.comments, artifact_source: thread.artifact_source, artifact_type: thread.artifact_type },
        created_at: new Date().toISOString(), retries: 0,
      }
      thread.task_id = task.id
      board.queue.push(task)
      writeBoard(rootDir, board)
      return Response.json(board)
    }

    // ── GET /__prev/board/:id/queue-status ────────────────────────────────
    if (req.method === 'GET' && subRoute === 'queue-status') {
      const board = readBoard(rootDir, boardId)
      const q = board.queue
      return Response.json({
        pending: q.filter(t => t.status === 'pending').length,
        in_progress: q.filter(t => t.status === 'in_progress').length,
        done: q.filter(t => t.status === 'done').length,
        failed: q.filter(t => t.status === 'failed').length,
      })
    }

    return null
  }
}
