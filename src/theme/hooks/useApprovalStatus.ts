import { useState, useCallback, useEffect } from 'react'
import { storage } from '../storage'
import type { ApprovalStatus, StatusEntry, AuditLogEntry, UserIdentity } from '../types'

const DEFAULT_ENTRY: StatusEntry = {
  previewName: '',
  status: 'draft',
  updatedAt: '',
  updatedBy: '',
}

async function fetchServerStatus(page: string): Promise<ApprovalStatus | null> {
  try {
    const res = await fetch(`/__prev/approval?page=${encodeURIComponent(page)}`)
    if (!res.ok) return null
    const data = await res.json() as { entry: StatusEntry | null }
    return data.entry?.status ?? null
  } catch {
    return null
  }
}

async function postServerStatus(page: string, status: ApprovalStatus, updatedBy: string): Promise<void> {
  try {
    await fetch('/__prev/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, status, updatedBy }),
    })
  } catch {
    // Server unavailable — localStorage is still updated
  }
}

export function useApprovalStatus(previewName: string) {
  const [entry, setEntry] = useState<StatusEntry>(
    () => storage.get<StatusEntry>(`status:${previewName}`) ?? { ...DEFAULT_ENTRY, previewName }
  )

  // Sync from server on mount — server state is authoritative
  useEffect(() => {
    fetchServerStatus(previewName).then(serverStatus => {
      if (serverStatus && serverStatus !== entry.status) {
        const synced: StatusEntry = {
          ...entry,
          previewName,
          status: serverStatus,
        }
        storage.set(`status:${previewName}`, synced)
        setEntry(synced)
      }
    })
  }, [previewName])

  const changeStatus = useCallback((newStatus: ApprovalStatus) => {
    const user = storage.get<UserIdentity>('user')
    const updatedBy = user?.name || 'anonymous'
    const now = new Date().toISOString()

    // Record audit log
    const audit: AuditLogEntry = {
      previewName,
      from: entry.status,
      to: newStatus,
      changedBy: updatedBy,
      changedAt: now,
    }
    storage.set(`audit:${previewName}:${Date.now()}`, audit)

    // Update local state + localStorage immediately (optimistic)
    const updated: StatusEntry = {
      previewName,
      status: newStatus,
      updatedAt: now,
      updatedBy,
    }
    storage.set(`status:${previewName}`, updated)
    setEntry(updated)

    // Persist to server (async, fire-and-forget)
    postServerStatus(previewName, newStatus, updatedBy)
  }, [previewName, entry.status])

  const getAuditLog = useCallback((): AuditLogEntry[] => {
    return storage
      .list(`audit:${previewName}:`)
      .map(k => storage.get<AuditLogEntry>(k))
      .filter(Boolean) as AuditLogEntry[]
  }, [previewName])

  return { status: entry.status, changeStatus, entry, getAuditLog }
}
