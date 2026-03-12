// src/server/routes/board.test.ts
import { test, expect, describe } from 'bun:test'
import { useTempDirPerTest } from '../../../test/utils'
import { createBoardHandler } from './board'
import type { Board } from './board'
import { existsSync, readFileSync } from 'fs'
import path from 'path'

const getTempDir = useTempDirPerTest('prev-board-test-')

function makeReq(url: string, method = 'GET', body?: unknown): Request {
  const opts: RequestInit = { method }
  if (body) {
    opts.body = JSON.stringify(body)
    opts.headers = { 'Content-Type': 'application/json' }
  }
  return new Request(`http://localhost${url}`, opts)
}

describe('board handler', () => {
  test('unmatched routes return null', async () => {
    const handler = createBoardHandler(getTempDir())
    expect(await handler(makeReq('/'))).toBeNull()
    expect(await handler(makeReq('/api/something'))).toBeNull()
    expect(await handler(makeReq('/__prev/approval'))).toBeNull()
  })

  test('GET /board/:id returns empty board on first access', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)
    const res = await handler(makeReq('/__prev/board/test-board-1'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)

    const board: Board = await res!.json()
    expect(board.id).toBe('test-board-1')
    expect(board.phase).toBe('created')
    expect(board.chat).toEqual([])
    expect(board.artifacts).toEqual([])
    expect(board.threads).toEqual([])
    expect(board.queue).toEqual([])
    expect(board.created_at).toBeTruthy()

    // Verify file was created
    const filePath = path.join(dir, '.prev-boards', 'test-board-1.json')
    expect(existsSync(filePath)).toBe(true)
  })

  test('GET /board/:id returns same board on subsequent access', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    const res1 = await handler(makeReq('/__prev/board/b1'))
    const board1: Board = await res1!.json()

    const res2 = await handler(makeReq('/__prev/board/b1'))
    const board2: Board = await res2!.json()

    expect(board1.id).toBe(board2.id)
    expect(board1.created_at).toBe(board2.created_at)
  })

  test('PATCH /board/:id updates phase', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    // Create board first
    await handler(makeReq('/__prev/board/b2'))

    // Patch phase
    const res = await handler(makeReq('/__prev/board/b2', 'PATCH', { phase: 'discussing' }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const updated: Board = await res!.json()
    expect(updated.phase).toBe('discussing')

    // Verify persisted
    const res2 = await handler(makeReq('/__prev/board/b2'))
    const board: Board = await res2!.json()
    expect(board.phase).toBe('discussing')
  })

  test('PATCH /board/:id updates multiple fields', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    await handler(makeReq('/__prev/board/b3'))

    const artifact = {
      id: 'a1', type: 'preview' as const, source: '/test.tsx', title: 'Test',
      x: 0, y: 0, w: 400, h: 300,
    }
    const res = await handler(makeReq('/__prev/board/b3', 'PATCH', {
      phase: 'generating',
      artifacts: [artifact],
      sot: 'some-sot',
      cr_id: 'cr-123',
    }))
    const updated: Board = await res!.json()
    expect(updated.phase).toBe('generating')
    expect(updated.artifacts).toHaveLength(1)
    expect(updated.artifacts[0].id).toBe('a1')
    expect(updated.sot).toBe('some-sot')
    expect(updated.cr_id).toBe('cr-123')
  })

  test('POST /board/:id/chat appends message', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    await handler(makeReq('/__prev/board/chat1'))

    const res = await handler(makeReq('/__prev/board/chat1/chat', 'POST', {
      author: 'alice',
      text: 'Hello world',
    }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const board: Board = await res!.json()
    expect(board.chat).toHaveLength(1)
    expect(board.chat[0].author).toBe('alice')
    expect(board.chat[0].text).toBe('Hello world')
    expect(board.chat[0].id).toBeTruthy()
    expect(board.chat[0].ts).toBeTruthy()
  })

  test('POST /board/:id/chat auto-transitions phase from created to discussing', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    await handler(makeReq('/__prev/board/chat2'))

    const res = await handler(makeReq('/__prev/board/chat2/chat', 'POST', {
      author: 'bob',
      text: 'First message',
    }))
    const board: Board = await res!.json()
    expect(board.phase).toBe('discussing')
  })

  test('POST /board/:id/chat does not change phase if already past created', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    await handler(makeReq('/__prev/board/chat3'))
    await handler(makeReq('/__prev/board/chat3', 'PATCH', { phase: 'generating' }))

    const res = await handler(makeReq('/__prev/board/chat3/chat', 'POST', {
      author: 'carol',
      text: 'Another message',
    }))
    const board: Board = await res!.json()
    expect(board.phase).toBe('generating')
  })

  test('POST /board/:id/threads adds thread', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    await handler(makeReq('/__prev/board/t1'))

    const res = await handler(makeReq('/__prev/board/t1/threads', 'POST', {
      artifact_id: 'a1',
      artifact_type: 'preview',
      artifact_source: '/test.tsx',
      x_pct: 50,
      y_pct: 30,
      comments: [{ author: 'alice', text: 'Fix this' }],
    }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const board: Board = await res!.json()
    expect(board.threads).toHaveLength(1)
    expect(board.threads[0].artifact_id).toBe('a1')
    expect(board.threads[0].x_pct).toBe(50)
    expect(board.threads[0].y_pct).toBe(30)
    expect(board.threads[0].status).toBe('open')
    expect(board.threads[0].update_requested).toBe(false)
    expect(board.threads[0].id).toBeTruthy()
    expect(board.threads[0].comments).toHaveLength(1)
    expect(board.threads[0].comments[0].author).toBe('alice')
    expect(board.threads[0].comments[0].id).toBeTruthy()
    expect(board.threads[0].comments[0].ts).toBeTruthy()
  })

  test('POST /board/:id/queue enqueues task', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)

    await handler(makeReq('/__prev/board/q1'))

    const res = await handler(makeReq('/__prev/board/q1/queue', 'POST', {
      type: 'initial',
      context: {
        chat_history: [{ id: 'c1', author: 'alice', text: 'Hello', ts: new Date().toISOString() }],
      },
    }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const board: Board = await res!.json()
    expect(board.queue).toHaveLength(1)
    expect(board.queue[0].board_id).toBe('q1')
    expect(board.queue[0].type).toBe('initial')
    expect(board.queue[0].status).toBe('pending')
    expect(board.queue[0].retries).toBe(0)
    expect(board.queue[0].id).toBeTruthy()
    expect(board.queue[0].created_at).toBeTruthy()
  })

  test('persistence across handler re-creation (simulated restart)', async () => {
    const dir = getTempDir()

    // Create handler, add data
    const handler1 = createBoardHandler(dir)
    await handler1(makeReq('/__prev/board/persist1'))
    await handler1(makeReq('/__prev/board/persist1/chat', 'POST', {
      author: 'dave',
      text: 'Persistent message',
    }))
    await handler1(makeReq('/__prev/board/persist1', 'PATCH', { phase: 'iterating' }))

    // Create new handler (simulates server restart)
    const handler2 = createBoardHandler(dir)
    const res = await handler2(makeReq('/__prev/board/persist1'))
    const board: Board = await res!.json()

    expect(board.phase).toBe('iterating')
    expect(board.chat).toHaveLength(1)
    expect(board.chat[0].author).toBe('dave')
    expect(board.chat[0].text).toBe('Persistent message')
  })

  test('PATCH with invalid JSON returns 400', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)
    await handler(makeReq('/__prev/board/bad1'))

    const res = await handler(new Request('http://localhost/__prev/board/bad1', {
      method: 'PATCH',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(400)
  })

  test('POST /chat with missing fields returns 400', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)
    await handler(makeReq('/__prev/board/bad2'))

    const res = await handler(makeReq('/__prev/board/bad2/chat', 'POST', { author: 'a' }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(400)
  })

  test('POST /threads with missing fields returns 400', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)
    await handler(makeReq('/__prev/board/bad3'))

    const res = await handler(makeReq('/__prev/board/bad3/threads', 'POST', { artifact_id: 'a1' }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(400)
  })

  test('POST /queue with missing fields returns 400', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)
    await handler(makeReq('/__prev/board/bad4'))

    const res = await handler(makeReq('/__prev/board/bad4/queue', 'POST', {}))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(400)
  })

  test('unsupported sub-route returns null', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)
    const res = await handler(makeReq('/__prev/board/b1/unknown', 'POST', {}))
    expect(res).toBeNull()
  })

  test('unsupported method on /board/:id returns null', async () => {
    const dir = getTempDir()
    const handler = createBoardHandler(dir)
    const res = await handler(makeReq('/__prev/board/b1', 'DELETE'))
    expect(res).toBeNull()
  })
})
