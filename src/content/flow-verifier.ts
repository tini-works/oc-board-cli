// Flow verification — region extraction + structural checks
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { FlowConfig } from './preview-types'

export interface VerifyResult {
  errors: string[]
  warnings: string[]
}

/**
 * Extract data-region names from TSX/JSX source code.
 * Uses Bun.Transpiler to normalize JSX → JS, then regex to find region attributes.
 */
export function extractRegions(source: string): string[] {
  const transpiler = new Bun.Transpiler({ loader: 'tsx' })
  const output = transpiler.transformSync(source)

  const regions = new Set<string>()
  const re = /"data-region":\s*"([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(output)) !== null) {
    regions.add(match[1])
  }
  return [...regions]
}

/**
 * Verify a flow config structurally:
 * - Screen dirs exist
 * - State files exist
 * - Referenced regions exist in screen source
 * - Goto targets reference valid step IDs
 * - No duplicate step IDs
 * - Warn on dead-end steps (no regions, not terminal)
 * - Warn on orphan steps (unreachable from step[0])
 */
export function verifyFlow(config: FlowConfig, rootDir: string): VerifyResult {
  const errors: string[] = []
  const warnings: string[] = []
  const steps = config.steps ?? []

  if (steps.length === 0) return { errors, warnings }

  // Check duplicate step IDs
  const stepIds = new Set<string>()
  for (const step of steps) {
    const id = step.id ?? ''
    if (id && stepIds.has(id)) {
      errors.push(`Duplicate step ID: "${id}"`)
    }
    stepIds.add(id)
  }

  // Collect all goto targets for reachability analysis
  const gotoTargets = new Map<string, Set<string>>() // stepId → set of reachable stepIds

  for (const step of steps) {
    const id = step.id ?? ''
    const screenName = typeof step.screen === 'string' ? step.screen : step.screen.ref
    const screenDir = path.join(rootDir, 'previews', 'screens', screenName)

    // Check screen directory exists
    if (!existsSync(screenDir)) {
      errors.push(`Screen directory not found: screens/${screenName} (step "${id}")`)
      continue
    }

    // Check state file exists
    if (step.state) {
      const stateFile = path.join(screenDir, `${step.state}.tsx`)
      const stateFileJsx = path.join(screenDir, `${step.state}.jsx`)
      if (!existsSync(stateFile) && !existsSync(stateFileJsx)) {
        errors.push(`State file not found: screens/${screenName}/${step.state}.tsx (step "${id}")`)
      }
    }

    // Check regions
    if (step.regions) {
      // Read screen source to extract available regions
      // Use state file if step has a state, otherwise use index
      const baseName = step.state || 'index'
      const tsxFile = path.join(screenDir, `${baseName}.tsx`)
      const jsxFile = path.join(screenDir, `${baseName}.jsx`)
      const sourceFile = existsSync(tsxFile) ? tsxFile : jsxFile
      let screenRegions: string[] = []

      if (existsSync(sourceFile)) {
        const source = readFileSync(sourceFile, 'utf-8')
        screenRegions = extractRegions(source)
      }

      const targets = new Set<string>()

      for (const [regionName, regionDef] of Object.entries(step.regions)) {
        // Check region exists in screen source
        if (!screenRegions.includes(regionName)) {
          errors.push(`Region "${regionName}" not found in screens/${screenName}/${baseName}.tsx (step "${id}")`)
        }

        // Collect goto targets
        if ('goto' in regionDef) {
          if (!stepIds.has(regionDef.goto)) {
            errors.push(`Region "${regionName}" in step "${id}" targets nonexistent step "${regionDef.goto}"`)
          }
          targets.add(regionDef.goto)
        } else if ('outcomes' in regionDef) {
          for (const [, outcome] of Object.entries(regionDef.outcomes)) {
            if (!stepIds.has(outcome.goto)) {
              errors.push(`Outcome in region "${regionName}" of step "${id}" targets nonexistent step "${outcome.goto}"`)
            }
            targets.add(outcome.goto)
          }
        }
      }

      gotoTargets.set(id, targets)
    }

    // Dead-end check: has no regions and not terminal (skip first step — it's the entry)
    if (!step.regions && !step.terminal && step !== steps[0]) {
      // Only warn if this step is reachable (we'll check after BFS, but simpler to warn always)
      warnings.push(`Step "${id}" is a dead-end (no regions and not terminal)`)
    }
  }

  // BFS from step[0] for orphan detection
  const firstId = steps[0]?.id ?? ''
  const reachable = new Set<string>([firstId])
  const queue = [firstId]

  while (queue.length > 0) {
    const current = queue.shift()!
    const targets = gotoTargets.get(current)
    if (targets) {
      for (const target of targets) {
        if (!reachable.has(target)) {
          reachable.add(target)
          queue.push(target)
        }
      }
    }
  }

  // Also consider transitions for reachability
  if (config.transitions) {
    for (const t of config.transitions) {
      if (reachable.has(t.from) && !reachable.has(t.to)) {
        reachable.add(t.to)
        // Re-run BFS from newly reachable node
        const q2 = [t.to]
        while (q2.length > 0) {
          const c = q2.shift()!
          const tgts = gotoTargets.get(c)
          if (tgts) {
            for (const tgt of tgts) {
              if (!reachable.has(tgt)) {
                reachable.add(tgt)
                q2.push(tgt)
              }
            }
          }
        }
      }
    }
  }

  for (const step of steps) {
    const id = step.id ?? ''
    if (id && !reachable.has(id) && step !== steps[0]) {
      warnings.push(`Step "${id}" is unreachable (orphan)`)
    }
  }

  return { errors, warnings }
}
