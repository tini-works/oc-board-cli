import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'
import path from 'path'
import { BoardQueueProcessor } from './board-queue'
import type { Board } from './routes/board'

const TEST_ROOT = path.join(import.meta.dir, '__test-queue__')
const BOARDS_DIR = path.join(TEST_ROOT, '.prev-boards')

function writeTestBoard(id: string, overrides: Partial<Board> = {}): Board {
  const board: Board = {
    id,
    phase: 'generating',
    created_at: new Date().toISOString(),
    chat: [],
    artifacts: [],
    threads: [],
    queue: [],
    ...overrides,
  }
  if (!existsSync(BOARDS_DIR)) mkdirSync(BOARDS_DIR, { recursive: true })
  writeFileSync(path.join(BOARDS_DIR, `${id}.json`), JSON.stringify(board, null, 2))
  return board
}

function readTestBoard(id: string): Board {
  return JSON.parse(readFileSync(path.join(BOARDS_DIR, `${id}.json`), 'utf-8'))
}

beforeEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true })
  mkdirSync(BOARDS_DIR, { recursive: true })
})

afterEach(() => {
  if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true })
})

describe('BoardQueueProcessor', () => {
  test('resets in_progress tasks to pending on init', () => {
    writeTestBoard('q1', {
      queue: [{
        id: 'task-1', board_id: 'q1', type: 'initial', status: 'in_progress',
        context: {}, created_at: new Date().toISOString(), retries: 0,
      }],
    })
    const proc = new BoardQueueProcessor(TEST_ROOT)
    proc.init()
    const board = readTestBoard('q1')
    expect(board.queue[0].status).toBe('pending')
  })

  test('only processes one task at a time', () => {
    writeTestBoard('q2', {
      queue: [
        { id: 't1', board_id: 'q2', type: 'initial', status: 'pending', context: {}, created_at: '2026-01-01T00:00:00Z', retries: 0 },
        { id: 't2', board_id: 'q2', type: 'initial', status: 'pending', context: {}, created_at: '2026-01-01T00:01:00Z', retries: 0 },
      ],
    })
    const proc = new BoardQueueProcessor(TEST_ROOT)
    const next = proc.pickNextTask('q2')
    expect(next?.id).toBe('t1')
    const board = readTestBoard('q2')
    expect(board.queue[0].status).toBe('in_progress')
    expect(board.queue[1].status).toBe('pending')
  })

  test('FIFO ordering by created_at', () => {
    writeTestBoard('q3', {
      queue: [
        { id: 'late', board_id: 'q3', type: 'update', status: 'pending', context: {}, created_at: '2026-01-02T00:00:00Z', retries: 0 },
        { id: 'early', board_id: 'q3', type: 'initial', status: 'pending', context: {}, created_at: '2026-01-01T00:00:00Z', retries: 0 },
      ],
    })
    const proc = new BoardQueueProcessor(TEST_ROOT)
    const next = proc.pickNextTask('q3')
    expect(next?.id).toBe('early')
  })

  test('completeTask marks done and transitions to iterating', () => {
    writeTestBoard('q4', {
      phase: 'generating',
      queue: [{
        id: 'task-x', board_id: 'q4', type: 'initial', status: 'in_progress',
        context: {}, created_at: new Date().toISOString(), retries: 0,
      }],
    })
    const proc = new BoardQueueProcessor(TEST_ROOT)
    proc.completeTask('q4', 'task-x')
    const board = readTestBoard('q4')
    expect(board.queue[0].status).toBe('done')
    expect(board.phase).toBe('iterating')
  })

  test('failTask retries once then marks failed with chat notification', () => {
    writeTestBoard('q5', {
      queue: [{
        id: 'task-f', board_id: 'q5', type: 'initial', status: 'in_progress',
        context: {}, created_at: new Date().toISOString(), retries: 0,
      }],
    })
    const proc = new BoardQueueProcessor(TEST_ROOT)

    // First failure: retry
    proc.failTask('q5', 'task-f')
    let board = readTestBoard('q5')
    expect(board.queue[0].status).toBe('pending')
    expect(board.queue[0].retries).toBe(1)

    // Second failure: mark failed + chat notification
    board.queue[0].status = 'in_progress'
    writeFileSync(path.join(BOARDS_DIR, 'q5.json'), JSON.stringify(board, null, 2))
    proc.failTask('q5', 'task-f')
    board = readTestBoard('q5')
    expect(board.queue[0].status).toBe('failed')
    expect(board.chat.length).toBeGreaterThan(0)
    expect(board.chat[board.chat.length - 1].author).toBe('openclaw')
  })

  test('getStatus returns correct counts', () => {
    writeTestBoard('q6', {
      queue: [
        { id: 't1', board_id: 'q6', type: 'initial', status: 'pending', context: {}, created_at: '', retries: 0 },
        { id: 't2', board_id: 'q6', type: 'initial', status: 'in_progress', context: {}, created_at: '', retries: 0 },
        { id: 't3', board_id: 'q6', type: 'initial', status: 'done', context: {}, created_at: '', retries: 0 },
        { id: 't4', board_id: 'q6', type: 'update', status: 'failed', context: {}, created_at: '', retries: 2 },
      ],
    })
    const proc = new BoardQueueProcessor(TEST_ROOT)
    const status = proc.getStatus('q6')
    expect(status.pending).toBe(1)
    expect(status.in_progress).toBe(1)
    expect(status.done).toBe(1)
    expect(status.failed).toBe(1)
  })
})
