// src/vite/start.ts
import { createServer, build, preview } from 'vite'
import { createViteConfig, getDebugCollector } from './config'
import { getRandomPort } from '../utils/port'
import { exec } from 'child_process'
import { existsSync, rmSync, copyFileSync } from 'fs'
import path from 'path'

export interface DevOptions {
  port?: number
  include?: string[]
  debug?: boolean
}

export interface BuildOptions {
  include?: string[]
  base?: string
  debug?: boolean
}

function printWelcome(type: 'dev' | 'preview') {
  console.log()
  console.log('  ✨ prev')
  console.log()
  if (type === 'dev') {
    console.log('  Your docs are ready! Open in your browser:')
  } else {
    console.log('  Previewing your production build:')
  }
}

function printShortcuts() {
  console.log()
  console.log('  Shortcuts:')
  console.log('    o  →  open in browser')
  console.log('    c  →  clear cache')
  console.log('    h  →  show this help')
  console.log('    q  →  quit')
  console.log()
}

function printReady() {
  console.log()
  console.log('  Edit your .md/.mdx files and see changes instantly.')
  console.log('  Press h for shortcuts.')
  console.log()
}

function openBrowser(url: string) {
  const platform = process.platform
  const cmd = platform === 'darwin' ? 'open' :
              platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${cmd} ${url}`)
  console.log(`  ↗ Opened ${url}`)
}

function clearCache(rootDir: string) {
  const viteCacheDir = path.join(rootDir, '.vite')
  const nodeModulesVite = path.join(rootDir, 'node_modules', '.vite')

  let cleared = 0

  if (existsSync(viteCacheDir)) {
    rmSync(viteCacheDir, { recursive: true })
    cleared++
  }

  if (existsSync(nodeModulesVite)) {
    rmSync(nodeModulesVite, { recursive: true })
    cleared++
  }

  if (cleared === 0) {
    console.log('  No cache to clear')
  } else {
    console.log(`  ✓ Cleared Vite cache`)
  }
}

function setupKeyboardShortcuts(rootDir: string, url: string, quit: () => void): () => void {
  if (!process.stdin.isTTY) return () => {}

  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  const handler = (key: string) => {
    switch (key.toLowerCase()) {
      case 'o':
        openBrowser(url)
        break
      case 'c':
        clearCache(rootDir)
        break
      case 'h':
        printShortcuts()
        break
      case 'q':
      case '\u0003': // Ctrl+C
        quit()
        break
    }
  }

  process.stdin.on('data', handler)

  // Return cleanup function
  return () => {
    process.stdin.off('data', handler)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
    }
    process.stdin.pause()
  }
}

export async function startDev(rootDir: string, options: DevOptions = {}) {
  const port = options.port ?? await getRandomPort()

  const config = await createViteConfig({
    rootDir,
    mode: 'development',
    port,
    include: options.include,
    debug: options.debug
  })

  const server = await createServer(config)
  await server.listen()

  // Write debug report if enabled
  const debugCollector = getDebugCollector()
  if (debugCollector) {
    debugCollector.startPhase('serverReady')
    const reportPath = debugCollector.writeReport()
    console.log(`  📊 Debug trace written to: ${reportPath}`)
  }

  const actualPort = server.config.server.port || port
  const url = `http://localhost:${actualPort}/`

  printWelcome('dev')
  server.printUrls()
  printReady()

  // Track if we're already shutting down to prevent double-cleanup
  let isShuttingDown = false
  let cleanupStdin: () => void = () => {}

  const shutdown = async (signal?: string) => {
    if (isShuttingDown) return
    isShuttingDown = true

    if (signal) {
      console.log(`\n  Received ${signal}, shutting down...`)
    } else {
      console.log('\n  Shutting down...')
    }

    // Cleanup stdin immediately to restore terminal
    cleanupStdin()

    // Close server with timeout to prevent hanging
    const closePromise = server.close()
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('  Force closing (timeout)...')
        resolve()
      }, 3000) // 3 second timeout
    })

    await Promise.race([closePromise, timeoutPromise])
    process.exit(0)
  }

  // Setup keyboard shortcuts with cleanup
  cleanupStdin = setupKeyboardShortcuts(rootDir, url, () => shutdown())

  // Handle OS signals for graceful shutdown
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('\n  Uncaught exception:', err.message)
    shutdown('uncaughtException')
  })

  return server
}

export async function buildSite(rootDir: string, options: BuildOptions = {}) {
  console.log()
  console.log('  ✨ prev build')
  console.log()
  console.log('  Building your documentation site...')

  const config = await createViteConfig({
    rootDir,
    mode: 'production',
    include: options.include,
    base: options.base,
    debug: options.debug
  })

  await build(config)

  // Write debug report if enabled
  const debugCollector = getDebugCollector()
  if (debugCollector) {
    debugCollector.startPhase('buildComplete')
    const reportPath = debugCollector.writeReport()
    console.log(`  📊 Debug trace written to: ${reportPath}`)
  }

  // Create 404.html for SPA fallback (GitHub Pages, etc.)
  const distDir = path.join(rootDir, 'dist')
  const indexPath = path.join(distDir, 'index.html')
  const notFoundPath = path.join(distDir, '404.html')
  if (existsSync(indexPath)) {
    copyFileSync(indexPath, notFoundPath)
  }

  console.log()
  console.log('  Done! Your site is ready in ./dist')
  console.log('  You can deploy this folder anywhere.')
  console.log()
}

export async function previewSite(rootDir: string, options: DevOptions = {}) {
  const port = options.port ?? await getRandomPort()

  const config = await createViteConfig({
    rootDir,
    mode: 'production',
    port,
    include: options.include,
    debug: options.debug
  })

  const server = await preview(config)

  // Write debug report if enabled
  const debugCollector = getDebugCollector()
  if (debugCollector) {
    debugCollector.startPhase('previewReady')
    const reportPath = debugCollector.writeReport()
    console.log(`  📊 Debug trace written to: ${reportPath}`)
  }

  printWelcome('preview')
  server.printUrls()
  console.log()
  console.log('  Press Ctrl+C to stop.')
  console.log()

  return server
}
