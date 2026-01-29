// src/vite/plugins/previews-plugin.ts
import type { Plugin } from 'vite'
import { scanPreviews, scanPreviewUnits, buildPreviewConfig } from '../previews'
import { buildVendorBundle, buildJsxBundle } from '../../preview-runtime/vendors'
import { buildOptimizedPreview } from '../../preview-runtime/build-optimized'
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
      const vendorsDir = path.join(targetDir, '_vendors')
      const previewsDir = path.join(rootDir, 'previews')

      // Clean up old directories
      const oldPreviewsDir = path.join(distDir, 'previews')
      if (existsSync(oldPreviewsDir)) {
        rmSync(oldPreviewsDir, { recursive: true })
      }
      if (existsSync(targetDir)) {
        rmSync(targetDir, { recursive: true })
      }

      // Scan previews
      const previews = await scanPreviews(rootDir)
      if (previews.length === 0) return

      console.log(`\n  Building ${previews.length} preview(s)...`)

      // Step 1: Build shared vendor bundle
      console.log('    Building shared vendor bundle...')
      mkdirSync(vendorsDir, { recursive: true })

      const vendorResult = await buildVendorBundle()
      if (!vendorResult.success) {
        console.error(`    ✗ Vendor bundle: ${vendorResult.error}`)
        return
      }
      writeFileSync(path.join(vendorsDir, 'runtime.js'), vendorResult.code)
      console.log('    ✓ _vendors/runtime.js')

      // Step 1b: Build @prev/jsx bundle
      const jsxResult = await buildJsxBundle('../_vendors/runtime.js')
      if (!jsxResult.success) {
        console.error(`    ✗ JSX bundle: ${jsxResult.error}`)
        return
      }
      writeFileSync(path.join(vendorsDir, 'jsx.js'), jsxResult.code)
      console.log('    ✓ _vendors/jsx.js')

      // Step 2: Build each preview with optimized builder
      for (const preview of previews) {
        const previewDir = path.join(previewsDir, preview.name)

        try {
          const config = await buildPreviewConfig(previewDir)

          // Calculate relative path from preview to vendors
          // e.g., components/button -> ../../_vendors/runtime.js
          const depth = preview.name.split('/').length
          const vendorPath = '../'.repeat(depth) + '_vendors/runtime.js'

          const result = await buildOptimizedPreview(config, { vendorPath })

          if (!result.success) {
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
