// src/vite/plugins/previews-plugin.ts
import type { Plugin } from 'vite'
import { scanPreviews, scanPreviewUnits, buildPreviewConfig } from '../previews'
import { buildPreviewHtml } from '../../preview-runtime/build'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import path from 'path'

const VIRTUAL_MODULE_ID = 'virtual:prev-previews'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

export function previewsPlugin(rootDir: string): Plugin {
  let isBuild = false

  return {
    name: 'prev-previews',

    config(_, { command }) {
      isBuild = command === 'build'
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        // Use new multi-type scanner
        const units = await scanPreviewUnits(rootDir)

        // Also get legacy flat previews for backwards compatibility
        const legacyPreviews = await scanPreviews(rootDir)

        return `
// Multi-type preview units
export const previewUnits = ${JSON.stringify(units)};

// Legacy flat previews (backwards compatibility)
export const previews = ${JSON.stringify(legacyPreviews)};

// Filtering helpers
export function getByType(type) {
  return previewUnits.filter(u => u.type === type);
}

export function getByTags(tags) {
  return previewUnits.filter(u =>
    u.config?.tags?.some(t => tags.includes(t))
  );
}

export function getByCategory(category) {
  return previewUnits.filter(u => u.config?.category === category);
}

export function getByStatus(status) {
  return previewUnits.filter(u => u.config?.status === status);
}
`
      }
    },

    handleHotUpdate({ file, server }) {
      // Invalidate when preview files change (HTML, TSX, CSS, YAML, MDX, etc.)
      // Use path-agnostic check for cross-platform compatibility (Fix 10)
      const previewsPath = path.sep + 'previews' + path.sep
      if ((file.includes(previewsPath) || file.includes('/previews/')) &&
          /\.(html|tsx|ts|jsx|js|css|yaml|yml|mdx)$/.test(file)) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          return [mod]
        }
      }
    },

    // Build standalone preview HTML files for production
    async closeBundle() {
      if (!isBuild) return

      const distDir = path.join(rootDir, 'dist')
      const targetDir = path.join(distDir, '_preview')
      const previewsDir = path.join(rootDir, 'previews')

      // Clean up old Vite-generated preview folder if exists
      const oldPreviewsDir = path.join(distDir, 'previews')
      if (existsSync(oldPreviewsDir)) {
        rmSync(oldPreviewsDir, { recursive: true })
      }

      // Remove old target if exists
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true })
      }

      // Scan and build each preview
      const previews = await scanPreviews(rootDir)

      if (previews.length === 0) return

      console.log(`\n  Building ${previews.length} preview(s)...`)

      for (const preview of previews) {
        const previewDir = path.join(previewsDir, preview.name)

        try {
          // Build preview config from files
          const config = await buildPreviewConfig(previewDir)

          // Build standalone HTML
          const result = await buildPreviewHtml(config)

          if (result.error) {
            console.error(`    ✗ ${preview.name}: ${result.error}`)
            continue
          }

          // Write to output directory
          const outputDir = path.join(targetDir, preview.name)
          mkdirSync(outputDir, { recursive: true })
          writeFileSync(path.join(outputDir, 'index.html'), result.html)

          console.log(`    ✓ ${preview.name}`)
        } catch (err) {
          console.error(`    ✗ ${preview.name}: ${err}`)
        }
      }
    }
  }
}
