// Production static site builder using Bun.build()
import path from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { virtualModulesPlugin } from './plugins/virtual-modules'
import { mdxPlugin } from './plugins/mdx'
import { aliasesPlugin } from './plugins/aliases'
import { scanPreviewUnits, buildPreviewConfig } from '../content/previews'
import { buildVendorBundle, buildJsxBundle } from '../preview-runtime/vendors'
import { buildOptimizedPreview } from '../preview-runtime/build-optimized'
import { loadConfig } from '../config'
import { verifyFlow } from '../content/flow-verifier'
import type { FlowConfig } from '../content/preview-types'

// Find CLI root
function findCliRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === 'prev-cli') return dir
      } catch {}
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)))
}

const cliRoot = findCliRoot()
const srcRoot = path.join(cliRoot, 'src')

export interface BuildOptions {
  rootDir: string
  include?: string[]
  base?: string
}

export async function buildProductionSite(options: BuildOptions) {
  const { rootDir, include, base = '/' } = options
  const config = loadConfig(rootDir)
  const distDir = path.join(rootDir, 'dist')

  // Build main entry with Bun.build — plugins passed explicitly
  const entryPath = path.join(srcRoot, 'theme/entry.tsx')
  const plugins = [
    virtualModulesPlugin({ rootDir, include, config }),
    mdxPlugin({ rootDir }),
    aliasesPlugin({ cliRoot }),
  ]

  const result = await Bun.build({
    entrypoints: [entryPath],
    outdir: distDir,
    format: 'esm',
    target: 'browser',
    minify: true,
    splitting: true,
    plugins,
    jsx: { runtime: 'automatic', importSource: 'react', development: false },
    naming: {
      entry: 'assets/[name]-[hash].[ext]',
      chunk: 'assets/[name]-[hash].[ext]',
      asset: 'assets/[name]-[hash].[ext]',
    },
    define: {
      'import.meta.env.DEV': 'false',
      'import.meta.env.BASE_URL': JSON.stringify(base),
      'process.env.NODE_ENV': '"production"',
    },
  })

  if (!result.success) {
    const errors = result.logs.filter(l => l.level === 'error').map(l => l.message)
    throw new Error(`Build failed:\n${errors.join('\n')}`)
  }

  // Find the entry JS and CSS outputs
  const entryOutput = result.outputs.find(o => o.kind === 'entry-point')
  const cssOutputs = result.outputs.filter(o => o.path.endsWith('.css'))

  // Generate the HTML wrapper
  const entryJsPath = entryOutput ? base + path.relative(distDir, entryOutput.path) : ''
  const cssLinks = cssOutputs.map(o => {
    const href = base + path.relative(distDir, o.path)
    return `  <link rel="stylesheet" href="${href}" />`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Documentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap" as="style" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
${cssLinks}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${entryJsPath}"></script>
</body>
</html>`

  writeFileSync(path.join(distDir, 'index.html'), html)

  // Copy index.html to 404.html for SPA fallback
  copyFileSync(path.join(distDir, 'index.html'), path.join(distDir, '404.html'))

  // Build preview HTML files
  await buildPreviewHtmlFiles(rootDir, distDir)
}

async function buildPreviewHtmlFiles(rootDir: string, distDir: string) {
  const units = await scanPreviewUnits(rootDir)
  if (units.length === 0) return

  const targetDir = path.join(distDir, '_preview')
  const vendorsDir = path.join(targetDir, '_vendors')
  const previewsDir = path.join(rootDir, 'previews')

  // Verify flow configs before building
  let hasFlowErrors = false
  for (const unit of units) {
    if (unit.type !== 'flow' || !unit.config) continue
    const result = verifyFlow(unit.config as FlowConfig, rootDir)
    for (const w of result.warnings) {
      console.warn(`  ⚠ flows/${unit.name}: ${w}`)
    }
    for (const e of result.errors) {
      console.error(`  ✗ flows/${unit.name}: ${e}`)
      hasFlowErrors = true
    }
  }
  if (hasFlowErrors) {
    throw new Error('Flow verification failed — fix errors above before building')
  }

  // Count total builds (skip config-only types)
  let totalBuilds = 0
  for (const unit of units) {
    if (unit.type === 'flow') continue
    totalBuilds++
    if (unit.files.states) totalBuilds += unit.files.states.length
  }

  console.log(`\n  Building ${totalBuilds} preview(s)...`)

  // Build shared vendor bundle
  console.log('    Building shared vendor bundle...')
  mkdirSync(vendorsDir, { recursive: true })

  const vendorResult = await buildVendorBundle()
  if (!vendorResult.success) {
    console.error(`    ✗ Vendor bundle: ${vendorResult.error}`)
    return
  }
  writeFileSync(path.join(vendorsDir, 'runtime.js'), vendorResult.code)
  console.log('    ✓ _vendors/runtime.js')

  // Build @prev/jsx bundle
  const jsxResult = await buildJsxBundle('../_vendors/runtime.js')
  if (!jsxResult.success) {
    console.error(`    ✗ JSX bundle: ${jsxResult.error}`)
    return
  }
  writeFileSync(path.join(vendorsDir, 'jsx.js'), jsxResult.code)
  console.log('    ✓ _vendors/jsx.js')

  // Build each preview unit (skip config-only types like flow)
  for (const unit of units) {
    if (unit.type === 'flow') continue
    const previewDir = path.join(previewsDir, unit.type + 's', unit.name)
    const previewPath = `${unit.type}s/${unit.name}`
    const depth = previewPath.split('/').length
    const vendorPath = '../'.repeat(depth) + '_vendors/runtime.js'

    // Build default state
    try {
      const config = await buildPreviewConfig(previewDir)
      const result = await buildOptimizedPreview(config, { vendorPath, resolveDir: previewDir })

      if (!result.success) {
        console.error(`    ✗ ${previewPath}: ${result.error}`)
      } else {
        const outputDir = path.join(targetDir, previewPath)
        mkdirSync(outputDir, { recursive: true })
        writeFileSync(path.join(outputDir, 'index.html'), result.html)
        console.log(`    ✓ ${previewPath}`)
      }
    } catch (err) {
      console.error(`    ✗ ${previewPath}: ${err}`)
    }

    // Build additional states for screens
    if (unit.type === 'screen' && unit.files.states) {
      for (const stateFile of unit.files.states) {
        const stateName = stateFile.replace(/\.(tsx|jsx)$/, '')
        const stateVendorPath = '../'.repeat(depth + 1) + '_vendors/runtime.js'

        try {
          const config = await buildPreviewConfig(previewDir, stateFile)
          const result = await buildOptimizedPreview(config, { vendorPath: stateVendorPath, resolveDir: previewDir })

          if (!result.success) {
            console.error(`    ✗ ${previewPath}/${stateName}: ${result.error}`)
          } else {
            const outputDir = path.join(targetDir, previewPath, stateName)
            mkdirSync(outputDir, { recursive: true })
            writeFileSync(path.join(outputDir, 'index.html'), result.html)
            console.log(`    ✓ ${previewPath}/${stateName}`)
          }
        } catch (err) {
          console.error(`    ✗ ${previewPath}/${stateName}: ${err}`)
        }
      }
    }
  }
}
