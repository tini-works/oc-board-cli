import path from 'path'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import type { Board, GenerationTask } from './routes/board'

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

export class BoardQueueProcessor {
  private rootDir: string
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(rootDir: string) {
    this.rootDir = rootDir
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
    return task
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
    writeBoard(this.rootDir, board)
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
        text: `Task ${task.id} failed after retry. Please try again or modify your request.`,
        ts: new Date().toISOString(),
      })
    }
    writeBoard(this.rootDir, board)
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

  /** Start the polling loop */
  start(): void {
    this.init()
    this.timer = setInterval(() => {
      const dir = boardsDir(this.rootDir)
      if (!existsSync(dir)) return
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue
        const boardId = file.replace('.json', '')
        this.pickNextTask(boardId)
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
