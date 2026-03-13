import path from 'path'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import type { Board, GenerationTask, ChatMessage } from './routes/board'

function boardsDir(rootDir: string): string {
  return path.join(rootDir, '.prev-boards')
}

function readBoard(rootDir: string, boardId: string): Board | null {
  const p = path.join(boardsDir(rootDir), `${boardId}.json`)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
}

function writeBoard(rootDir: string, board: Board): void {
  const p = path.join(boardsDir(rootDir), `${board.id}.json`)
  writeFileSync(p, JSON.stringify(board, null, 2), 'utf-8')
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Task → agent routing ──────────────────────────────────────────────────────

function agentIdForTask(task: GenerationTask): string {
  return task.type === 'update' ? 'sot-editor' : 'sot-scribe'
}

// Build the user message payload for each agent type
function buildTaskMessage(board: Board, task: GenerationTask): string {
  if (task.type === 'initial') {
    const chatSummary = board.chat
      .map(m => `[${m.author}]: ${m.text}`)
      .join('\n\n')
    const artifactList = board.artifacts
      .map(a => `- ${a.type}: ${a.source}${a.title ? ` (${a.title})` : ''}`)
      .join('\n') || '(none)'

    return [
      `BOARD_ID: ${board.id}`,
      `BOARD_SOT: ${board.sot || 'not configured'}`,
      `BOARD_PHASE: ${board.phase}`,
      `TASK_ID: ${task.id}`,
      ``,
      `CHAT_HISTORY:`,
      chatSummary,
      ``,
      `ARTIFACTS ON BOARD:`,
      artifactList,
    ].join('\n')
  }

  // type === 'update'
  const comments = (task.context.comments || [])
    .map(c => `[${c.author}]: ${c.text}`)
    .join('\n\n')

  const recentChat = board.chat
    .slice(-10)
    .map(m => `[${m.author}]: ${m.text}`)
    .join('\n\n')

  return [
    `BOARD_ID: ${board.id}`,
    `BOARD_SOT: ${board.sot || 'not configured'}`,
    `THREAD_ID: ${task.thread_id || ''}`,
    `ARTIFACT_SOURCE: ${task.context.artifact_source || ''}`,
    `ARTIFACT_TYPE: ${task.context.artifact_type || ''}`,
    `TASK_ID: ${task.id}`,
    ``,
    `COMMENTS:`,
    comments,
    ``,
    `RECENT_CHAT:`,
    recentChat,
  ].join('\n')
}

// ── Queue processor ───────────────────────────────────────────────────────────

export class BoardQueueProcessor {
  private rootDir: string
  private broadcast: (boardId: string, event: object) => void
  private timer: ReturnType<typeof setInterval> | null = null
  private gatewayHost: string
  private gatewayPort: number
  private gatewayToken: string

  constructor(
    rootDir: string,
    broadcast: (boardId: string, event: object) => void,
  ) {
    this.rootDir = rootDir
    this.broadcast = broadcast
    this.gatewayHost = process.env.OPENCLAW_GATEWAY_HOST || 'host.docker.internal'
    this.gatewayPort = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10)
    this.gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || ''
  }

  /** Reset any in_progress tasks back to pending (idempotent restart) */
  init(): void {
    const dir = boardsDir(this.rootDir)
    if (!existsSync(dir)) return
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      const boardId = file.replace('.json', '')
      const board = readBoard(this.rootDir, boardId)
      if (!board) continue
      let changed = false
      for (const task of board.queue) {
        if (task.status === 'in_progress') {
          task.status = 'pending'
          task.started_at = undefined
          changed = true
        }
      }
      if (changed) writeBoard(this.rootDir, board)
    }
  }

  /** Pick next pending task for a board (FIFO), mark it in_progress */
  pickNextTask(boardId: string): GenerationTask | null {
    const board = readBoard(this.rootDir, boardId)
    if (!board) return null
    if (board.queue.some(t => t.status === 'in_progress')) return null

    const pending = board.queue
      .filter(t => t.status === 'pending')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))

    if (pending.length === 0) return null

    const task = pending[0]
    task.status = 'in_progress'
    task.started_at = new Date().toISOString()
    writeBoard(this.rootDir, board)
    return { ...task, board_id: boardId }
  }

  /** Mark a task as done */
  completeTask(boardId: string, taskId: string): void {
    const board = readBoard(this.rootDir, boardId)
    if (!board) return
    const task = board.queue.find(t => t.id === taskId)
    if (!task) return
    task.status = 'done'
    task.completed_at = new Date().toISOString()

    const allInitialDone = board.queue
      .filter(t => t.type === 'initial')
      .every(t => t.status === 'done' || t.status === 'failed')
    if (allInitialDone && board.phase === 'generating') {
      board.phase = 'iterating'
    }

    // For update tasks: mark the corresponding thread as 'proposed'
    if (task.type === 'update' && task.thread_id) {
      const thread = board.threads.find(t => t.id === task.thread_id)
      if (thread) thread.status = 'proposed'
    }

    writeBoard(this.rootDir, board)
    this.broadcast(boardId, { type: 'board', board })
  }

  /** Mark a task as failed (with retry logic) */
  failTask(boardId: string, taskId: string): void {
    const board = readBoard(this.rootDir, boardId)
    if (!board) return
    const task = board.queue.find(t => t.id === taskId)
    if (!task) return

    task.retries = (task.retries || 0) + 1
    if (task.retries < 2) {
      task.status = 'pending'
      task.started_at = undefined
    } else {
      task.status = 'failed'
      task.completed_at = new Date().toISOString()
      board.chat.push({
        id: `msg-err-${task.id}`,
        author: 'openclaw',
        text: `⚠️ Task \`${task.id}\` failed after retry. Please try again or modify your request.`,
        ts: new Date().toISOString(),
      })
    }
    writeBoard(this.rootDir, board)
    this.broadcast(boardId, { type: 'board', board })
  }

  /** Get queue status for a board */
  getStatus(boardId: string): { pending: number; in_progress: number; done: number; failed: number } {
    const board = readBoard(this.rootDir, boardId)
    if (!board) return { pending: 0, in_progress: 0, done: 0, failed: 0 }
    return {
      pending: board.queue.filter(t => t.status === 'pending').length,
      in_progress: board.queue.filter(t => t.status === 'in_progress').length,
      done: board.queue.filter(t => t.status === 'done').length,
      failed: board.queue.filter(t => t.status === 'failed').length,
    }
  }

  /** Execute a task — calls the appropriate agent via OpenClaw gateway */
  async processTask(boardId: string, task: GenerationTask): Promise<void> {
    const board = readBoard(this.rootDir, boardId)
    if (!board) { this.failTask(boardId, task.id); return }

    const agentId = agentIdForTask(task)
    const userMessage = buildTaskMessage(board, task)

    // Announce task start in board chat
    const startMsg: ChatMessage = {
      id: uid(),
      author: 'openclaw',
      text: `🔄 **${agentId === 'sot-scribe' ? '@sot-scribe' : '@sot-editor'}** is working on task \`${task.id}\`...`,
      ts: new Date().toISOString(),
    }
    board.chat.push(startMsg)
    if (task.type === 'initial') board.phase = 'generating'
    writeBoard(this.rootDir, board)
    this.broadcast(boardId, { type: 'message', message: startMsg, board })

    let response: Response
    try {
      response = await fetch(
        `http://${this.gatewayHost}:${this.gatewayPort}/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.gatewayToken}`,
            'x-openclaw-agent-id': agentId,
          },
          body: JSON.stringify({
            model: `openclaw:${agentId}`,
            stream: true,
            messages: [{ role: 'user', content: userMessage }],
          }),
        },
      )
    } catch (err) {
      this.broadcast(boardId, { type: 'error', text: `Agent ${agentId} unreachable: ${err}` })
      this.failTask(boardId, task.id)
      return
    }

    if (!response.ok) {
      this.broadcast(boardId, { type: 'error', text: `Agent ${agentId} error: ${response.status}` })
      this.failTask(boardId, task.id)
      return
    }

    // Stream response tokens back to the board chat
    const aiMsgId = uid()
    this.broadcast(boardId, { type: 'ai_start', msgId: aiMsgId })

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
              this.broadcast(boardId, { type: 'token', msgId: aiMsgId, token })
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      this.failTask(boardId, task.id)
      return
    }

    // Save complete agent response to board chat
    const latestBoard = readBoard(this.rootDir, boardId)
    if (latestBoard) {
      latestBoard.chat.push({
        id: aiMsgId,
        author: 'openclaw',
        text: fullText,
        ts: new Date().toISOString(),
      })
      writeBoard(this.rootDir, latestBoard)
      this.broadcast(boardId, { type: 'ai_done', msgId: aiMsgId, board: latestBoard })
    }

    this.completeTask(boardId, task.id)
  }

  /** Start the polling loop */
  start(): void {
    this.init()
    this.timer = setInterval(() => {
      const dir = boardsDir(this.rootDir)
      if (!existsSync(dir)) return
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue
        const boardId = file.replace('.json', '')
        const task = this.pickNextTask(boardId)
        if (task) {
          // Fire-and-forget: processTask handles its own error/complete lifecycle
          this.processTask(boardId, task).catch(err => {
            console.error(`[board-queue] task ${task.id} failed:`, err)
            this.failTask(boardId, task.id)
          })
        }
      }
    }, 2000)
  }

  /** Stop the polling loop */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
