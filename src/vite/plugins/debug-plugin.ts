// src/vite/plugins/debug-plugin.ts
import type { Plugin } from 'vite'
import { DebugCollector } from '../../utils/debug'

export function debugPlugin(collector: DebugCollector): Plugin {
  return {
    name: 'prev-debug',
    enforce: 'pre',

    configResolved() {
      collector.startPhase('configResolved')
    },

    buildStart() {
      collector.startPhase('buildStart')
    },

    resolveId(id, importer) {
      const start = performance.now()
      collector.trackFile(id, 'resolve', start)
      // Log importer for dependency chain analysis
      if (importer) {
        collector.trackFile(`${id} <- ${importer}`, 'resolve', start)
      }
      return null
    },

    load(id) {
      const start = performance.now()
      collector.trackFile(id, 'load', start)
      return null
    },

    transform(_code, id) {
      const start = performance.now()
      collector.trackFile(id, 'transform', start)
      return null
    },

    configureServer(server) {
      collector.startPhase('configureServer')

      // Track when server is ready
      server.httpServer?.once('listening', () => {
        collector.startPhase('serverListening')
      })

      // Intercept middleware to track HTTP requests
      server.middlewares.use((req, _res, next) => {
        if (req.url && !req.url.startsWith('/@') && !req.url.includes('__')) {
          collector.trackFile(req.url, 'resolve', performance.now())
        }
        next()
      })
    },

    handleHotUpdate({ file }) {
      collector.trackFile(file, 'transform', performance.now())
    },

    buildEnd() {
      collector.endPhase('build')
    }
  }
}
