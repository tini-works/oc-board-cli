// src/utils/debug.ts
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'

export interface FileEvent {
  path: string
  event: 'resolve' | 'load' | 'transform'
  ms: number
  phase: string
  timestamp: number
}

export interface PhaseInfo {
  startMs: number
  endMs?: number
}

export interface DebugSummary {
  totalFiles: number
  byDirectory: Record<string, number>
  byEvent: Record<string, number>
  slowest: Array<{ path: string; totalMs: number }>
}

export interface DebugReport {
  timestamp: string
  totalStartupMs: number
  phases: Record<string, PhaseInfo>
  files: FileEvent[]
  summary: DebugSummary
}

export class DebugCollector {
  private startTime: number
  private files: FileEvent[] = []
  private phases: Record<string, PhaseInfo> = {}
  private currentPhase: string = 'init'
  private rootDir: string

  constructor(rootDir: string) {
    this.startTime = performance.now()
    this.rootDir = rootDir
    this.startPhase('init')
  }

  startPhase(name: string) {
    const now = performance.now()
    // End previous phase if exists
    if (this.phases[this.currentPhase] && !this.phases[this.currentPhase].endMs) {
      this.phases[this.currentPhase].endMs = Math.round(now - this.startTime)
    }
    this.currentPhase = name
    this.phases[name] = { startMs: Math.round(now - this.startTime) }
  }

  endPhase(name?: string) {
    const phaseName = name || this.currentPhase
    const now = performance.now()
    if (this.phases[phaseName]) {
      this.phases[phaseName].endMs = Math.round(now - this.startTime)
    }
  }

  trackFile(filePath: string, event: 'resolve' | 'load' | 'transform', startTime: number) {
    const now = performance.now()
    this.files.push({
      path: filePath,
      event,
      ms: Math.round(now - startTime),
      phase: this.currentPhase,
      timestamp: Math.round(startTime - this.startTime)
    })
  }

  private generateSummary(): DebugSummary {
    const byDirectory: Record<string, number> = {}
    const byEvent: Record<string, number> = { resolve: 0, load: 0, transform: 0 }
    const fileTimeAccum: Record<string, number> = {}

    for (const file of this.files) {
      // Count by event type
      byEvent[file.event] = (byEvent[file.event] || 0) + 1

      // Accumulate time per file
      fileTimeAccum[file.path] = (fileTimeAccum[file.path] || 0) + file.ms

      // Group by directory (first 3 path segments for readability)
      const relativePath = file.path.startsWith(this.rootDir)
        ? file.path.slice(this.rootDir.length)
        : file.path

      let dir: string
      if (relativePath.includes('node_modules')) {
        // For node_modules, show which node_modules
        const nmIndex = relativePath.indexOf('node_modules')
        const prefix = relativePath.slice(0, nmIndex + 'node_modules'.length)
        // Get the package name after node_modules
        const afterNm = relativePath.slice(nmIndex + 'node_modules/'.length)
        const pkgName = afterNm.split('/')[0].startsWith('@')
          ? afterNm.split('/').slice(0, 2).join('/')
          : afterNm.split('/')[0]
        dir = `${prefix}/${pkgName}`
      } else {
        // For other files, just use first directory
        const parts = relativePath.split('/').filter(Boolean)
        dir = parts.length > 1 ? `/${parts[0]}` : '/'
      }

      byDirectory[dir] = (byDirectory[dir] || 0) + 1
    }

    // Find slowest files
    const slowest = Object.entries(fileTimeAccum)
      .map(([path, totalMs]) => ({ path, totalMs }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 20)

    return {
      totalFiles: this.files.length,
      byDirectory,
      byEvent,
      slowest
    }
  }

  writeReport(): string {
    const now = performance.now()
    const totalStartupMs = Math.round(now - this.startTime)

    // End current phase
    this.endPhase()

    const report: DebugReport = {
      timestamp: new Date().toISOString(),
      totalStartupMs,
      phases: this.phases,
      files: this.files,
      summary: this.generateSummary()
    }

    // Create output directory
    const debugDir = path.join(this.rootDir, '.prev-debug')
    mkdirSync(debugDir, { recursive: true })

    // Generate filename with datetime
    const date = new Date()
    const filename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}.json`
    const filepath = path.join(debugDir, filename)

    writeFileSync(filepath, JSON.stringify(report, null, 2))

    return filepath
  }
}

// Singleton for the current debug session
let currentCollector: DebugCollector | null = null

export function createDebugCollector(rootDir: string): DebugCollector {
  currentCollector = new DebugCollector(rootDir)
  return currentCollector
}

export function getDebugCollector(): DebugCollector | null {
  return currentCollector
}
