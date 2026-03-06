// approval.ts — server-side approval status persistence + webhook emission
import path from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { ApprovalStatus } from '../../theme/types'

export interface ApprovalEntry {
  page: string
  status: ApprovalStatus
  updatedAt: string
  updatedBy: string
}

export interface ApprovalStore {
  entries: Record<string, ApprovalEntry>
  lastUpdated: string
}

function getStorePath(rootDir: string): string {
  return path.join(rootDir, '.prev-approvals.json')
}

function readStore(rootDir: string): ApprovalStore {
  const storePath = getStorePath(rootDir)
  if (!existsSync(storePath)) return { entries: {}, lastUpdated: new Date().toISOString() }
  try {
    return JSON.parse(readFileSync(storePath, 'utf-8'))
  } catch {
    return { entries: {}, lastUpdated: new Date().toISOString() }
  }
}

function writeStore(rootDir: string, store: ApprovalStore): void {
  writeFileSync(getStorePath(rootDir), JSON.stringify(store, null, 2), 'utf-8')
}

async function emitWebhook(webhookUrl: string, entry: ApprovalEntry): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schema: 'prev-approval.v1',
        event: 'status_changed',
        page: entry.page,
        status: entry.status,
        updatedAt: entry.updatedAt,
        updatedBy: entry.updatedBy,
      }),
    })
  } catch (err) {
    console.warn(`[prev] webhook emit failed: ${err}`)
  }
}

export function createApprovalHandler(rootDir: string, webhookUrl?: string) {
  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)

    // GET /__prev/approval?page=<slug> — get single page status
    if (url.pathname === '/__prev/approval' && req.method === 'GET') {
      const page = url.searchParams.get('page')
      if (!page) return Response.json({ error: 'missing page param' }, { status: 400 })

      const store = readStore(rootDir)
      const entry = store.entries[page] ?? null
      return Response.json({ entry })
    }

    // GET /__prev/approval/all — get all statuses
    if (url.pathname === '/__prev/approval/all' && req.method === 'GET') {
      const store = readStore(rootDir)
      return Response.json(store)
    }

    // POST /__prev/approval — update status
    if (url.pathname === '/__prev/approval' && req.method === 'POST') {
      let body: { page: string; status: ApprovalStatus; updatedBy?: string }
      try {
        body = await req.json() as typeof body
      } catch {
        return Response.json({ error: 'invalid JSON' }, { status: 400 })
      }

      if (!body.page || !body.status) {
        return Response.json({ error: 'missing page or status' }, { status: 400 })
      }

      const store = readStore(rootDir)
      const entry: ApprovalEntry = {
        page: body.page,
        status: body.status,
        updatedAt: new Date().toISOString(),
        updatedBy: body.updatedBy || 'anonymous',
      }
      store.entries[body.page] = entry
      store.lastUpdated = entry.updatedAt
      writeStore(rootDir, store)

      // Emit webhook if configured — fire and forget
      if (webhookUrl) {
        emitWebhook(webhookUrl, entry)
      }

      return Response.json({ success: true, entry })
    }

    return null // not handled
  }
}
