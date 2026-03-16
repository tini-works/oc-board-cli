// board-utils.ts — shared board I/O utilities
// Single source of truth for uid, board file paths, read/write operations
import path from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { Board } from './routes/board'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function boardsDir(rootDir: string): string {
  return path.join(rootDir, '.prev-boards')
}

export function boardPath(rootDir: string, boardId: string): string {
  return path.join(boardsDir(rootDir), `${boardId}.json`)
}

export function ensureBoardsDir(rootDir: string): void {
  const dir = boardsDir(rootDir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function readBoard(rootDir: string, boardId: string): Board | null {
  const p = boardPath(rootDir, boardId)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

export function writeBoard(rootDir: string, board: Board): void {
  ensureBoardsDir(rootDir)
  writeFileSync(boardPath(rootDir, board.id), JSON.stringify(board, null, 2), 'utf-8')
}

/** Get existing board or create a new empty one */
export function getOrCreateBoard(rootDir: string, boardId: string): Board {
  const existing = readBoard(rootDir, boardId)
  if (existing) return existing
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
