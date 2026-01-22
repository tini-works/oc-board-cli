import { $ } from 'bun'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'

// Resolve tailwindcss CLI - try multiple locations
function findTailwindBin(): string {
  // Try require.resolve to find the tailwindcss package
  try {
    const tailwindPkg = require.resolve('tailwindcss/package.json')
    const tailwindDir = dirname(tailwindPkg)
    const binPath = join(tailwindDir, 'lib/cli.js')
    if (existsSync(binPath)) return binPath
  } catch {}

  // Fallback: use bunx (slower but always works)
  return 'bunx tailwindcss@3'
}

const tailwindCmd = findTailwindBin()

export interface TailwindResult {
  success: boolean
  css: string
  error?: string
}

interface ContentFile {
  path: string
  content: string
}

export async function compileTailwind(files: ContentFile[]): Promise<TailwindResult> {
  const tempDir = mkdtempSync(join(tmpdir(), 'prev-tailwind-'))

  try {
    // Write content files (create parent dirs for nested paths)
    for (const file of files) {
      const filePath = join(tempDir, file.path)
      const parentDir = dirname(filePath)
      mkdirSync(parentDir, { recursive: true })
      writeFileSync(filePath, file.content)
    }

    // Create Tailwind config - use .cjs for compatibility
    const configContent = `
      module.exports = {
        content: [${JSON.stringify(tempDir + '/**/*.{tsx,jsx,ts,js,html}')}],
      }
    `
    const configPath = join(tempDir, 'tailwind.config.cjs')
    writeFileSync(configPath, configContent)

    // Create input CSS
    const inputCss = `
      @tailwind base;
      @tailwind components;
      @tailwind utilities;
    `
    const inputPath = join(tempDir, 'input.css')
    writeFileSync(inputPath, inputCss)

    const outputPath = join(tempDir, 'output.css')

    // Run Tailwind CLI
    if (tailwindCmd.startsWith('bunx')) {
      await $`bunx tailwindcss@3 -c ${configPath} -i ${inputPath} -o ${outputPath} --minify`.quiet()
    } else {
      await $`bun ${tailwindCmd} -c ${configPath} -i ${inputPath} -o ${outputPath} --minify`.quiet()
    }

    const css = readFileSync(outputPath, 'utf-8')

    return { success: true, css }
  } catch (err) {
    return {
      success: false,
      css: '',
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
