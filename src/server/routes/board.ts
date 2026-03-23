// board.ts — server-side board state persistence + real-time channel
import path from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { uid, boardsDir, boardPath, readBoard, writeBoard, getOrCreateBoard } from '../board-utils'
import { gatewayConfig } from '../../config'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  author: string
  text: string
  ts: string
  thinking?: string
}

export type ArtifactType = 'preview' | 'c3-doc' | 'flow' | 'screen' | 'a2ui' | 'ref' | 'json-screen'

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

function buildSystemPrompt(rootDir: string) {
  return `You are OpenClaw, an AI assistant embedded in a collaborative board inside prev-cli — a live documentation and design preview tool.

Your role is to help users think through ideas, plan features, write documentation, review designs, generate artifacts, and collaborate on creative or technical work.

Project workspace: ${rootDir}
The project's .c3/ and .opencode/ directories are located at ${rootDir}/.c3/ and ${rootDir}/.opencode/ respectively. When referencing these directories, always use the full paths.

Guidelines:
- Be concise, practical, and thoughtful
- Use markdown: **bold**, lists, \`code\` — it renders in the UI
- When users describe something to build, help them refine requirements
- Keep a warm, competent tone`
}

function buildArtifactSystemPrompt(sotRepoPath?: string | null) {
  const sotSection = sotRepoPath
    ? `

SOT Repo: The artifact source files live in the SOT repository at: ${sotRepoPath}
- You can READ files there for context, but do NOT write/modify files directly.
- When the user asks for changes, describe what you would change and why. The user will then click "Generate Proposal" to see a diff before any changes are applied.`
    : `

NOTE: No SOT repository is configured. You can discuss the artifact but cannot modify its source file.`

  return `You are an AI assistant helping a user discuss and iterate on a specific artifact on a collaborative board inside prev-cli.

You have filesystem access — use your tools to read files and execute commands as needed.
${sotSection}

Key paths in the workspace:
- .c3/ — C3 architecture docs
- .opencode/skill/ — agent skill files
- src/ — source code

Guidelines:
- Be concise — this is a small inline panel, not a full chat
- Use markdown sparingly: **bold**, \`code\`
- When suggesting changes, clearly describe WHAT would change and WHY
- Suggest improvements or point out issues when relevant`
}

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

async function generateAIResponse(rootDir: string, boardId: string, chatHistory: ChatMessage[], agentId = 'board', useThinking = false) {
  const { proto: gatewayProto, host: gatewayHost, port: gatewayPort, token: gatewayToken } = gatewayConfig

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
        model: gatewayConfig.model || `openclaw:${agentId}`,
        stream: true,
        ...(useThinking && gatewayConfig.maxThinkingTokens ? {
          thinking: { type: 'enabled', budget_tokens: gatewayConfig.maxThinkingTokens },
        } : {}),
        messages: agentId === 'board'
          ? [{ role: 'system', content: buildSystemPrompt(rootDir) }, ...messages]
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
  let thinkingText = ''
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
        const delta = parsed.choices?.[0]?.delta
        const thinking: string = delta?.reasoning ?? delta?.reasoning_content ?? ''
        if (thinking) {
          thinkingText += thinking
          broadcast(boardId, { type: 'thinking_token', msgId: aiMsgId, token: thinking })
        }
        const token: string = delta?.content ?? ''
        if (token) {
          fullText += token
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
    ...(thinkingText ? { thinking: thinkingText } : {}),
  }
  const board = getOrCreateBoard(rootDir, boardId)
  board.chat.push(aiMsg)
  writeBoard(rootDir, board)


  // Signal completion — clients can now treat accumulated tokens as the final message
  broadcast(boardId, { type: 'ai_done', msgId: aiMsgId, board })
}

// Per-artifact AI response — uses Gateway sessions for persistent per-artifact conversations
// Each artifact gets its own session key so the agent has real filesystem tools and
// maintains conversation history across interactions.
async function generateArtifactResponse(
  rootDir: string,
  boardId: string,
  artifactId: string,
  userText: string,
) {
  const board = readBoard(rootDir, boardId)
  if (!board) {
    broadcast(boardId, { type: 'artifact_ai_error', artifactId, text: 'Board not found' })
    return
  }

  const artifact = board.artifacts.find(a => a.id === artifactId)
  if (!artifact) {
    broadcast(boardId, { type: 'artifact_ai_error', artifactId, text: 'Artifact not found' })
    return
  }

  // Gather prior threads for saving comments later
  const artifactThreads = board.threads.filter(t => t.artifact_id === artifactId)

  const gatewayProto = process.env.OPENCLAW_GATEWAY_PROTO || 'http'
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || ''
  const gatewayHost = process.env.OPENCLAW_GATEWAY_HOST || 'host.docker.internal'
  const gatewayPort = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10)

  // Per-artifact session key — stable across calls so the Gateway maintains conversation history
  const sessionKey = `board:${boardId}:artifact:${artifactId}`

  // Build messages: system prompt with artifact context + the user's new message
  // Gateway session handles prior conversation history, so we only send the new turn
  const sotRepoPath = board.sot || process.env.SOT_REPO_PATH || null
  const sotInfo = sotRepoPath ? `\n- SOT Repo: ${sotRepoPath}` : ''

  const artifactContext = `This is an artifact on a collaborative board.\n- Artifact: ${artifact.title || artifact.source}\n- Type: ${artifact.type}\n- Source: ${artifact.source}\n- Artifact-ID: ${artifactId}\n- Board-ID: ${boardId}${sotInfo}`

  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: buildArtifactSystemPrompt(sotRepoPath) + '\n\n' + artifactContext },
    { role: 'user', content: userText },
  ]

  const agentId = process.env.OPENCLAW_AGENT_ID || 'sot-artifact-editor'

  let response: Response
  try {
    response = await fetch(`${gatewayProto}://${gatewayHost}:${gatewayPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        'x-openclaw-agent-id': agentId,
        'x-openclaw-session-key': sessionKey,
      },
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODEL || `openclaw:${agentId}`,
        stream: true,
        messages,
      }),
    })
  } catch (err) {
    broadcast(boardId, { type: 'artifact_ai_error', artifactId, text: String(err) })
    return
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    console.error(`[artifact-ai] Gateway error ${response.status}: ${errBody.slice(0, 500)}`)
    broadcast(boardId, { type: 'artifact_ai_error', artifactId, text: `Gateway error ${response.status}` })
    return
  }

  const aiMsgId = uid()
  broadcast(boardId, { type: 'artifact_ai_start', msgId: aiMsgId, artifactId })

  const reader = response.body!.getReader()
  const dec = new TextDecoder()
  let fullText = ''
  let buf = ''

  try {
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
            broadcast(boardId, { type: 'artifact_token', msgId: aiMsgId, artifactId, token })
          }
        } catch { /* ignore parse errors */ }
      }
    }
  } catch (err) {
    broadcast(boardId, { type: 'artifact_ai_error', artifactId, text: String(err) })
    return
  }

  // Agent has real filesystem tools — it executed file changes directly.
  // Broadcast artifact refresh if the source file may have changed.
  if (fullText.length > 0) {
    broadcast(boardId, { type: 'artifact_content_updated', artifactId, source: artifact.source })
  }

  // Save user question + AI response as comments on the artifact's thread
  const latestBoard = readBoard(rootDir, boardId)
  if (latestBoard) {
    if (artifactThreads.length === 0) {
      const typeMap: Record<string, ArtifactType> = { 'c3-doc': 'c3-doc', flow: 'flow', screen: 'screen', preview: 'preview', ref: 'c3-doc', a2ui: 'a2ui' }
      const thread: CommentThread = {
        id: uid(),
        artifact_id: artifactId,
        artifact_type: typeMap[artifact.type] ?? artifact.type,
        artifact_source: artifact.source,
        x_pct: 0,
        y_pct: 0,
        comments: [
          { id: uid(), author: 'user', text: userText, ts: new Date().toISOString() },
          { id: aiMsgId, author: 'ai', text: fullText, ts: new Date().toISOString() },
        ],
        update_requested: false,
        status: 'open',
      }
      latestBoard.threads.push(thread)
    } else {
      const thread = latestBoard.threads.find(t => t.id === artifactThreads[0].id)
      if (thread) {
        thread.comments.push(
          { id: uid(), author: 'user', text: userText, ts: new Date().toISOString() },
          { id: aiMsgId, author: 'ai', text: fullText, ts: new Date().toISOString() },
        )
      }
    }
    writeBoard(rootDir, latestBoard)
    broadcast(boardId, { type: 'artifact_ai_done', msgId: aiMsgId, artifactId, board: latestBoard })
  }
}

// ── Proposal generation (confirm-before-apply) ────────────────────────────────

function simpleDiff(before: string, after: string): { type: 'equal' | 'add' | 'remove'; content: string }[] {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const result: { type: 'equal' | 'add' | 'remove'; content: string }[] = []

  const maxLen = Math.max(beforeLines.length, afterLines.length)
  if (maxLen > 2000) {
    if (before === after) return [{ type: 'equal', content: before }]
    return [{ type: 'remove', content: before }, { type: 'add', content: after }]
  }

  let bi = 0, ai = 0
  while (bi < beforeLines.length || ai < afterLines.length) {
    if (bi < beforeLines.length && ai < afterLines.length && beforeLines[bi] === afterLines[ai]) {
      result.push({ type: 'equal', content: beforeLines[bi] }); bi++; ai++
    } else if (bi < beforeLines.length && (ai >= afterLines.length || !afterLines.slice(ai).includes(beforeLines[bi]))) {
      result.push({ type: 'remove', content: beforeLines[bi] }); bi++
    } else if (ai < afterLines.length && (bi >= beforeLines.length || !beforeLines.slice(bi).includes(afterLines[ai]))) {
      result.push({ type: 'add', content: afterLines[ai] }); ai++
    } else {
      result.push({ type: 'remove', content: beforeLines[bi] }); bi++
    }
  }
  return result
}

async function generateProposal(
  rootDir: string, boardId: string, artifactId: string,
): Promise<{ before: string; after: string; source: string; diff: { type: string; content: string }[] } | null> {
  const board = readBoard(rootDir, boardId)
  if (!board) return null
  const artifact = board.artifacts.find(a => a.id === artifactId)
  if (!artifact) return null

  const sotRepoPath = board.sot || process.env.SOT_REPO_PATH || null
  if (!sotRepoPath) return null

  const sourceFullPath = path.resolve(sotRepoPath, artifact.source)
  if (!existsSync(sourceFullPath)) return null
  const before = readFileSync(sourceFullPath, 'utf-8')

  const gatewayProto = process.env.OPENCLAW_GATEWAY_PROTO || 'http'
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || ''
  const gatewayHost = process.env.OPENCLAW_GATEWAY_HOST || 'host.docker.internal'
  const gatewayPort = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10)
  const agentId = process.env.OPENCLAW_AGENT_ID || 'sot-artifact-editor'
  const sessionKey = `board:${boardId}:artifact:${artifactId}`

  const proposalPrompt = `Based on the changes you proposed in our conversation, output the COMPLETE updated content of the file \`${artifact.source}\`.

Output ONLY the file content — no explanations, no markdown fences, no preamble. Start from the very first line of the file.`

  let response: Response
  try {
    response = await fetch(`${gatewayProto}://${gatewayHost}:${gatewayPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
        'x-openclaw-agent-id': agentId,
        'x-openclaw-session-key': sessionKey,
      },
      body: JSON.stringify({
        model: process.env.OPENCLAW_MODEL || `openclaw:${agentId}`,
        stream: false,
        messages: [
          { role: 'system', content: buildArtifactSystemPrompt(sotRepoPath) },
          { role: 'user', content: proposalPrompt },
        ],
      }),
    })
  } catch { return null }
  if (!response.ok) return null

  const data = await response.json() as any
  let after = data.choices?.[0]?.message?.content || ''
  after = after.replace(/^```(?:\w+)?\s*\n?/, '').replace(/\n?```\s*$/, '').replace(/^\n+/, '').replace(/\n+$/, '')

  const diff = simpleDiff(before, after)
  broadcast(boardId, { type: 'artifact_proposal', artifactId, source: artifact.source, before, after, diff })
  return { before, after, source: artifact.source, diff }
}

async function applyProposal(rootDir: string, boardId: string, artifactId: string, after: string): Promise<boolean> {
  const board = readBoard(rootDir, boardId)
  if (!board) return false
  const artifact = board.artifacts.find(a => a.id === artifactId)
  if (!artifact) return false
  const sotRepoPath = board.sot || process.env.SOT_REPO_PATH || null
  if (!sotRepoPath) return false

  const sourceFullPath = path.resolve(sotRepoPath, artifact.source)
  if (!existsSync(sourceFullPath)) return false

  try {
    writeFileSync(sourceFullPath, after, 'utf-8')
    broadcast(boardId, { type: 'artifact_content_updated', artifactId, source: artifact.source })
    broadcast(boardId, { type: 'artifact_proposal_applied', artifactId })
    return true
  } catch { return false }
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
        const useThinking = /\bthink\b/i.test(body.text)
        generateAIResponse(rootDir, boardId, board.chat, agentId, useThinking).catch(console.error)
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

    // ── POST /__prev/board/:id/artifact/:artifactId/ask — per-artifact AI response
    const artifactAskMatch = subRoute?.match(/^artifact\/([^/]+)\/ask$/)
    if (req.method === 'POST' && artifactAskMatch) {
      const artifactId = artifactAskMatch[1]
      let body: { text?: string }
      try { body = await req.json() as typeof body } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      if (!body.text) {
        return Response.json({ error: 'missing text' }, { status: 400 })
      }
      // Fire-and-forget: AI response streams via WebSocket
      generateArtifactResponse(rootDir, boardId, artifactId, body.text).catch(console.error)
      return Response.json({ ok: true })
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

    // ── POST /__prev/board/:id/artifact/:artifactId/refresh — signal artifact content changed (R1 fix)
    // When the AI agent edits the source file of an artifact, it calls this endpoint
    // to broadcast artifact_content_updated so the frontend re-fetches and re-renders.
    const refreshMatch = subRoute?.match(/^artifact\/([^/]+)\/refresh$/)
    if (req.method === 'POST' && refreshMatch) {
      const artifactId = refreshMatch[1]
      const board = readBoard(rootDir, boardId)
      if (!board) return Response.json({ error: 'board not found' }, { status: 404 })
      const artifact = board.artifacts.find(a => a.id === artifactId)
      if (!artifact) return Response.json({ error: 'artifact not found' }, { status: 404 })
      broadcast(boardId, { type: 'artifact_content_updated', artifactId, source: artifact.source })
      return Response.json({ ok: true })
    }

    // ── POST /__prev/board/:id/artifact/:artifactId/generate-proposal ──
    const proposalMatch = subRoute?.match(/^artifact\/([^/]+)\/generate-proposal$/)
    if (req.method === 'POST' && proposalMatch) {
      const artifactId = proposalMatch[1]
      const board = readBoard(rootDir, boardId)
      if (!board) return Response.json({ error: 'board not found' }, { status: 404 })
      const artifact = board.artifacts.find(a => a.id === artifactId)
      if (!artifact) return Response.json({ error: 'artifact not found' }, { status: 404 })

      const sotRepoPath = board.sot || process.env.SOT_REPO_PATH || null
      if (!sotRepoPath) {
        return Response.json({ error: 'SOT repo not configured', sotConfigured: false }, { status: 400 })
      }

      const result = await generateProposal(rootDir, boardId, artifactId)
      if (!result) return Response.json({ error: 'Failed to generate proposal' }, { status: 500 })
      return Response.json({ ok: true, ...result })
    }

    // ── POST /__prev/board/:id/artifact/:artifactId/apply-proposal ──
    const applyMatch = subRoute?.match(/^artifact\/([^/]+)\/apply-proposal$/)
    if (req.method === 'POST' && applyMatch) {
      const artifactId = applyMatch[1]
      let body: { after?: string }
      try { body = await req.json() as typeof body } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }
      if (!body.after) return Response.json({ error: 'missing after content' }, { status: 400 })

      const success = await applyProposal(rootDir, boardId, artifactId, body.after)
      if (!success) return Response.json({ error: 'Failed to apply proposal' }, { status: 500 })
      return Response.json({ ok: true })
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
