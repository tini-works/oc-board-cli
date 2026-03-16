// board.ts — server-side board state persistence + real-time channel
import path from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { uid, boardsDir, boardPath, readBoard, writeBoard, getOrCreateBoard } from '../board-utils'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  author: string
  text: string
  ts: string
}

export type ArtifactType = 'preview' | 'c3-doc' | 'flow' | 'screen' | 'a2ui' | 'ref'

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

export type BoardPhase =
  | 'created' | 'discussing' | 'summarizing' | 'generating' | 'iterating' | 'finalizing' | 'done'
  | 'pr' | 'merged' | 'handoff' | 'implemented'

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

// ── WebSocket Channel Registry ────────────────────────────────────────────────
// Per-board set of connected browser clients. Generic send interface so
// dev.ts can register real Bun ServerWebSocket instances here.

interface BoardClient {
  send(data: string): void
}

const boardChannels = new Map<string, Set<BoardClient>>()

export function broadcast(boardId: string, event: object) {
  const clients = boardChannels.get(boardId)
  if (!clients || clients.size === 0) return
  const data = JSON.stringify(event)
  for (const client of clients) {
    try { client.send(data) } catch { clients.delete(client) }
  }
}

// Called by dev.ts when a WebSocket connection opens for a board
export function registerBoardWsClient(
  rootDir: string,
  boardId: string,
  send: (data: string) => void,
): () => void {
  if (!boardChannels.has(boardId)) boardChannels.set(boardId, new Set())
  const client: BoardClient = { send }
  boardChannels.get(boardId)!.add(client)

  // Push current board state immediately on connect
  try {
    const board = getOrCreateBoard(rootDir, boardId)
    if (!existsSync(boardPath(rootDir, boardId))) writeBoard(rootDir, board)
    send(JSON.stringify({ type: 'board', board }))
  } catch { /* ignore */ }

  // Return cleanup
  return () => { boardChannels.get(boardId)?.delete(client) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// uid, boardsDir, boardPath, readBoard, writeBoard imported from ../board-utils

// ── OpenClaw AI integration ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are OpenClaw, an AI assistant embedded in a collaborative board inside prev-cli — a live documentation and design preview tool.

Your role is to help users think through ideas, plan features, write documentation, review designs, generate artifacts, and collaborate on creative or technical work.

Guidelines:
- Be concise, practical, and thoughtful
- Use markdown: **bold**, lists, \`code\` — it renders in the UI
- When users describe something to build, help them refine requirements
- Keep a warm, competent tone`

// Detect which agent should handle this message based on @mentions
function detectAgentId(text: string): string {
  if (/@sot-scribe/i.test(text)) return 'sot-scribe'
  if (/@sot-editor/i.test(text)) return 'sot-editor'
  return 'board'
}

// Build enriched context message for specialist agents (sot-scribe, sot-editor)
function buildAgentContext(board: Board, agentId: string): string {
  if (agentId === 'sot-scribe') {
    return JSON.stringify({
      board_id: board.id,
      sot: board.sot || null,
      phase: board.phase,
      chat: board.chat,
      artifacts: board.artifacts,
      threads: board.threads,
    })
  }
  return ''
}

async function generateAIResponse(rootDir: string, boardId: string, chatHistory: ChatMessage[], agentId = 'board') {
  const gatewayProto = process.env.OPENCLAW_GATEWAY_PROTO || 'http'
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || ''
  const gatewayHost = process.env.OPENCLAW_GATEWAY_HOST || 'host.docker.internal'
  const gatewayPort = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10)

  // Read full board state for specialist agents — they need sot, artifacts, threads
  const fullBoard = agentId !== 'board' ? readBoard(rootDir, boardId) : null

  // For specialist agents, prepend enriched board context as system message
  const contextMsg = fullBoard ? buildAgentContext(fullBoard, agentId) : null

  const messages = [
    ...(contextMsg ? [{ role: 'system', content: `Board context:\n${contextMsg}` }] : []),
    ...chatHistory.map(m => ({
      role: m.author === 'openclaw' ? 'assistant' : 'user',
      content: m.text,
    })),
  ]

  let response: Response
  try {
    response = await fetch(`${gatewayProto}://${gatewayHost}:${gatewayPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        'x-openclaw-agent-id': agentId,
      },
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODEL || `openclaw:${agentId}`,
        stream: true,
        messages: agentId === 'board'
          ? [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
          : messages,
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
  const board = getOrCreateBoard(rootDir, boardId)
  board.chat.push(aiMsg)
  writeBoard(rootDir, board)


  // Signal completion — clients can now treat accumulated tokens as the final message
  broadcast(boardId, { type: 'ai_done', msgId: aiMsgId, board })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export function createBoardHandler(rootDir: string, opts?: { onTaskEnqueued?: (boardId: string) => void }) {
  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)
    const pathname = url.pathname

    // ── GET /__prev/boards — list all boards ──────────────────────────────
    if (pathname === '/__prev/boards' && req.method === 'GET') {
      const dir = boardsDir(rootDir)
      try {
        mkdirSync(dir, { recursive: true })
        const files = readdirSync(dir)
        const boards = await Promise.all(
          files
            .filter((f: string) => f.endsWith('.json'))
            .map(async (f: string) => {
              try {
                const raw = readFileSync(path.join(dir, f), 'utf8')
                const b: Board = JSON.parse(raw)
                const lastMsg = b.chat.length > 0 ? b.chat[b.chat.length - 1] : null
                const title = b.chat.find(m => m.author === 'openclaw')?.text?.slice(0, 60) ?? null
                return {
                  id: b.id,
                  phase: b.phase,
                  created_at: b.created_at,
                  artifact_count: b.artifacts.length,
                  message_count: b.chat.length,
                  title,
                  last_message: lastMsg ? { author: lastMsg.author, text: lastMsg.text.slice(0, 80), ts: lastMsg.ts } : null,
                }
              } catch { return null }
            })
        )
        const sorted = boards
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return Response.json(sorted)
      } catch {
        return Response.json([])
      }
    }

    const boardMatch = pathname.match(/^\/__prev\/board\/([^/]+)(?:\/(.+))?$/)
    if (!boardMatch) return null

    const boardId = boardMatch[1]
    const subRoute = boardMatch[2]

    if (!/^[a-zA-Z0-9_-]+$/.test(boardId)) {
      return Response.json({ error: 'invalid board id' }, { status: 400 })
    }

    // ── GET /__prev/board/:id — return full board state ────────────────────
    if (!subRoute && req.method === 'GET') {
      const board = getOrCreateBoard(rootDir, boardId)
      if (!existsSync(boardPath(rootDir, boardId))) writeBoard(rootDir, board)
      return Response.json(board)
    }

    // ── PATCH /__prev/board/:id — partial update ───────────────────────────
    if (!subRoute && req.method === 'PATCH') {
      let body: Partial<Board>
      try { body = await req.json() as Partial<Board> } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      const board = getOrCreateBoard(rootDir, boardId)
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

      const board = getOrCreateBoard(rootDir, boardId)
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
        const agentId = detectAgentId(body.text)
        generateAIResponse(rootDir, boardId, board.chat, agentId).catch(console.error)
      }

      return Response.json({ ok: true, message })
    }

    // ── POST /__prev/board/:id/greeting — OpenClaw welcome message ─────────
    if (subRoute === 'greeting' && req.method === 'POST') {
      const board = getOrCreateBoard(rootDir, boardId)
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

      const board = getOrCreateBoard(rootDir, boardId)
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
      const board = getOrCreateBoard(rootDir, boardId)
      const task: GenerationTask = {
        id: uid(), board_id: boardId, type: body.type, status: 'pending',
        artifact_id: body.artifact_id, thread_id: body.thread_id,
        context: body.context, created_at: new Date().toISOString(), retries: 0,
      }
      board.queue.push(task)
      writeBoard(rootDir, board)
      opts?.onTaskEnqueued?.(boardId)
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
      const board = getOrCreateBoard(rootDir, boardId)
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
      const board = getOrCreateBoard(rootDir, boardId)
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
      opts?.onTaskEnqueued?.(boardId)
      return Response.json(board)
    }

    // ── PATCH /__prev/board/:id/artifact/:artifactId — update single artifact (F4 race fix)
    const artifactMatch = subRoute?.match(/^artifact\/([^/]+)$/)
    if (req.method === 'PATCH' && artifactMatch) {
      const artifactId = artifactMatch[1]
      let body: Partial<Artifact>
      try { body = await req.json() as Partial<Artifact> } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      const board = getOrCreateBoard(rootDir, boardId)
      const artifact = board.artifacts.find(a => a.id === artifactId)
      if (!artifact) return Response.json({ error: 'artifact not found' }, { status: 404 })
      if (body.x !== undefined) artifact.x = body.x
      if (body.y !== undefined) artifact.y = body.y
      if (body.w !== undefined) artifact.w = body.w
      if (body.h !== undefined) artifact.h = body.h
      if (body.title !== undefined) artifact.title = body.title
      writeBoard(rootDir, board)
      broadcast(boardId, { type: 'board_updated', board })
      return Response.json(board)
    }

    // ── DELETE /__prev/board/:id/artifact/:artifactId — remove single artifact
    if (req.method === 'DELETE' && artifactMatch) {
      const artifactId = artifactMatch[1]
      const board = getOrCreateBoard(rootDir, boardId)
      board.artifacts = board.artifacts.filter(a => a.id !== artifactId)
      writeBoard(rootDir, board)
      broadcast(boardId, { type: 'board_updated', board })
      return Response.json(board)
    }

    // ── GET /__prev/board/:id/queue-status ────────────────────────────────
    if (req.method === 'GET' && subRoute === 'queue-status') {
      const board = getOrCreateBoard(rootDir, boardId)
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
