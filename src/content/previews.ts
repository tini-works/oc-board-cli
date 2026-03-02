// src/content/previews.ts
import fg from 'fast-glob'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import type { PreviewFile, PreviewConfig } from '../preview-runtime/types'
import type { PreviewUnit, PreviewType } from './preview-types'
import { parsePreviewConfig } from './config-parser'

// Type folder names and their corresponding PreviewType
const PREVIEW_TYPE_FOLDERS = ['components', 'screens', 'flows'] as const
const TYPE_MAP: Record<string, PreviewType> = {
  components: 'component',
  screens: 'screen',
  flows: 'flow',
}

/**
 * Scan all files in a preview directory for WASM bundling
 */
export async function scanPreviewFiles(previewDir: string): Promise<PreviewFile[]> {
  const files = await fg.glob('**/*.{tsx,ts,jsx,js,css,json}', {
    cwd: previewDir,
    ignore: ['node_modules/**', 'dist/**']
  })

  return files.map(file => {
    const content = readFileSync(path.join(previewDir, file), 'utf-8')
    const ext = path.extname(file).slice(1) as PreviewFile['type']

    return {
      path: file,
      content,
      type: ext,
    }
  })
}

/**
 * Detect the entry file for a preview (looks for App.tsx, index.tsx, etc.)
 */
export function detectEntry(files: PreviewFile[]): string {
  const priorities = ['App.tsx', 'App.jsx', 'index.tsx', 'index.jsx', 'main.tsx', 'main.jsx']

  for (const name of priorities) {
    const file = files.find(f => f.path === name)
    if (file) return file.path
  }

  // Fallback to first TSX/JSX file
  const jsxFile = files.find(f => f.type === 'tsx' || f.type === 'jsx')
  return jsxFile?.path || files[0]?.path || 'App.tsx'
}

/**
 * Build a PreviewConfig for WASM runtime
 * @param previewDir - Directory containing the preview files
 * @param entryOverride - Optional entry file override (for building alternate states)
 */
export async function buildPreviewConfig(previewDir: string, entryOverride?: string): Promise<PreviewConfig> {
  const files = await scanPreviewFiles(previewDir)
  const entry = entryOverride || detectEntry(files)

  return {
    files,
    entry,
    tailwind: true,
  }
}

/**
 * Scan previews with multi-type folder structure support
 * Supports: components/, screens/, flows/, atlas/
 */
export async function scanPreviewUnits(rootDir: string): Promise<PreviewUnit[]> {
  const previewsDir = path.join(rootDir, 'previews')

  if (!existsSync(previewsDir)) {
    return []
  }

  const units: PreviewUnit[] = []

  for (const typeFolder of PREVIEW_TYPE_FOLDERS) {
    const typeDir = path.join(previewsDir, typeFolder)
    if (!existsSync(typeDir)) continue

    const type = TYPE_MAP[typeFolder]

    // Get immediate subdirectories (each is a preview unit)
    const entries = await fg.glob('*/', {
      cwd: typeDir,
      onlyDirectories: true,
      deep: 1
    })

    for (const entry of entries) {
      const name = entry.replace(/\/$/, '')
      const unitDir = path.join(typeDir, name)

      // Detect files
      const files = await detectUnitFiles(unitDir, type)
      if (!files.index) continue // Skip if no index file

      // Check for config with both extensions
      const configPath = existsSync(path.join(unitDir, 'config.yaml'))
        ? path.join(unitDir, 'config.yaml')
        : path.join(unitDir, 'config.yml')
      const configResult = await parsePreviewConfig(configPath, {
        injectId: true,
        injectKind: true,
        folderName: name,
        previewType: type,
      })

      // Log validation warnings
      for (const warning of configResult.warnings) {
        console.warn(`[prev] Warning in ${typeFolder}/${name}: ${warning}`)
      }

      // Skip units with validation errors (e.g., ID mismatch)
      if (configResult.errors.length > 0) {
        for (const error of configResult.errors) {
          console.error(`[prev] Error in ${typeFolder}/${name}: ${error}`)
        }
        continue
      }

      units.push({
        type,
        name,
        path: unitDir,
        route: `/_preview/${typeFolder}/${name}`,
        config: configResult.data,
        files,
      })
    }
  }

  return units
}

/**
 * Detect files in a preview unit directory
 */
async function detectUnitFiles(
  unitDir: string,
  type: PreviewType
): Promise<PreviewUnit['files']> {
  const allFiles = await fg.glob('*', { cwd: unitDir })

  // Find index file based on type
  let index: string | undefined

  if (type === 'flow') {
    // Flow is defined by its config.yaml (no separate index file)
    index = allFiles.find(f => f === 'config.yaml' || f === 'config.yml')
  } else {
    // Component or Screen - look for TSX/JSX/TS/JS or HTML
    const priorities = [
      'index.tsx', 'index.jsx', 'index.ts', 'index.js',
      'App.tsx', 'App.jsx', 'index.html'
    ]
    index = priorities.find(p => allFiles.includes(p))
  }

  const result: PreviewUnit['files'] = {
    index: index || '',
  }

  // For screens: find state files (any .tsx/.jsx that isn't the index)
  if (type === 'screen' && index) {
    const stateFiles = allFiles.filter(f =>
      (f.endsWith('.tsx') || f.endsWith('.jsx')) &&
      f !== index
    ).sort()
    if (stateFiles.length > 0) {
      result.states = stateFiles
    }
  }

  // For components: find schema.ts
  if (type === 'component') {
    if (allFiles.includes('schema.ts')) {
      result.schema = 'schema.ts'
    }
  }

  // Find docs.mdx if present
  if (allFiles.includes('docs.mdx') || allFiles.includes('README.mdx')) {
    result.docs = allFiles.find(f => f.endsWith('.mdx'))
  }

  return result
}
