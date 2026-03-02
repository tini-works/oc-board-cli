// src/validators/index.ts
// Validator orchestrator - combines schema and semantic validation

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import * as yaml from 'js-yaml'
import { initializeAdapters } from '../renderers/registry'
import {
  validateConfig,
  validateAllLayouts,
  clearSchemaCache,
  type SchemaValidationResult,
  type SchemaValidationError,
} from './schema-validator'
import {
  validateSemantics,
  createValidationContext,
  registerPreviewUnit,
  checkDuplicateIds,
  type SemanticValidationResult,
  type SemanticValidationError,
  type SemanticValidationWarning,
  type ValidationContext,
} from './semantic-validator'
import type { PreviewConfig } from '../renderers/types'

export interface ValidationOptions {
  /** Specific renderer to validate (validates all if not specified) */
  renderer?: string
  /** Only validate schema (skip semantic validation) */
  schemaOnly?: boolean
  /** Only validate semantic rules (skip schema validation) */
  semanticOnly?: boolean
}

export interface ValidationResult {
  valid: boolean
  summary: {
    components: { total: number; valid: number; invalid: number }
    screens: { total: number; valid: number; invalid: number }
    flows: { total: number; valid: number; invalid: number }
  }
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  file: string
  path: string
  message: string
  type: 'schema' | 'semantic'
}

export interface ValidationWarning {
  file: string
  path: string
  message: string
}

const PREVIEW_TYPES = ['components', 'screens', 'flows'] as const
type PreviewTypeDir = typeof PREVIEW_TYPES[number]

/**
 * Find the preview directory root
 */
function findPreviewRoot(startDir: string): string | null {
  let current = startDir

  while (current !== '/') {
    // Check for .previews/ directory
    const previewsDir = join(current, '.previews')
    if (existsSync(previewsDir)) {
      return previewsDir
    }

    // Check for previews/ directory
    const previewsDirAlt = join(current, 'previews')
    if (existsSync(previewsDirAlt)) {
      return previewsDirAlt
    }

    current = join(current, '..')
  }

  return null
}

/**
 * Scan a preview type directory and return all unit paths
 */
function scanPreviewType(
  previewRoot: string,
  type: PreviewTypeDir
): Array<{ id: string; path: string; configPath: string }> {
  const typeDir = join(previewRoot, type)
  if (!existsSync(typeDir)) {
    return []
  }

  const units: Array<{ id: string; path: string; configPath: string }> = []
  const entries = readdirSync(typeDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const unitPath = join(typeDir, entry.name)
    const configYaml = join(unitPath, 'config.yaml')
    const configYml = join(unitPath, 'config.yml')

    const configPath = existsSync(configYaml)
      ? configYaml
      : existsSync(configYml)
        ? configYml
        : null

    if (configPath) {
      units.push({
        id: entry.name,
        path: unitPath,
        configPath,
      })
    }
  }

  return units
}

/**
 * Load and parse a config file
 */
function loadConfig(configPath: string): Record<string, unknown> | null {
  try {
    const content = readFileSync(configPath, 'utf-8')
    const parsed = yaml.load(content)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

/**
 * Build the validation context by scanning all preview units
 */
function buildValidationContext(previewRoot: string): {
  context: ValidationContext
  units: Map<string, {
    type: PreviewTypeDir
    id: string
    folderId: string
    configPath: string
    config: Record<string, unknown>
    originalConfig: Record<string, unknown>
  }>
} {
  const context = createValidationContext(previewRoot)
  const units = new Map<string, {
    type: PreviewTypeDir
    id: string
    folderId: string
    configPath: string
    config: Record<string, unknown>
    originalConfig: Record<string, unknown>
  }>()

  for (const type of PREVIEW_TYPES) {
    const scanned = scanPreviewType(previewRoot, type)

    for (const unit of scanned) {
      const originalConfig = loadConfig(unit.configPath)
      if (!originalConfig) continue

      // Create working config with injected values for internal use
      // Keep original for validation (v2 should fail without kind)
      const config = { ...originalConfig }
      const singularType = type.replace(/s$/, '') as 'component' | 'screen' | 'flow'

      // Inject id and kind only in working config (not validated config)
      if (!config.id) config.id = unit.id
      if (!config.kind) config.kind = singularType

      units.set(`${type}/${unit.id}`, {
        type,
        id: config.id as string,
        folderId: unit.id,
        configPath: unit.configPath,
        config,
        originalConfig,
      })

      // Register in context for semantic validation
      // Extract screen states if available
      let states: string[] | undefined
      if (type === 'screens' && config.states && typeof config.states === 'object') {
        states = Object.keys(config.states)
      }

      registerPreviewUnit(context, singularType, unit.id, states)
    }
  }

  return { context, units }
}

/**
 * Validate all preview configs
 */
export async function validate(
  rootDir: string = process.cwd(),
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  // Initialize adapters for renderer validation
  await initializeAdapters()

  const previewRoot = findPreviewRoot(rootDir)
  if (!previewRoot) {
    return {
      valid: false,
      summary: {
        components: { total: 0, valid: 0, invalid: 0 },
        screens: { total: 0, valid: 0, invalid: 0 },
        flows: { total: 0, valid: 0, invalid: 0 },
      },
      errors: [{
        file: rootDir,
        path: '/',
        message: 'No preview directory found (.previews/ or previews/)',
        type: 'semantic',
      }],
      warnings: [],
    }
  }

  const { context, units } = buildValidationContext(previewRoot)

  const result: ValidationResult = {
    valid: true,
    summary: {
      components: { total: 0, valid: 0, invalid: 0 },
      screens: { total: 0, valid: 0, invalid: 0 },
      flows: { total: 0, valid: 0, invalid: 0 },
    },
    errors: [],
    warnings: [],
  }

  // Check for duplicate IDs within each type
  for (const type of PREVIEW_TYPES) {
    const typeUnits = Array.from(units.values()).filter(u => u.type === type)
    const ids = typeUnits.map(u => u.id)
    const duplicateErrors = checkDuplicateIds(ids, type)

    for (const err of duplicateErrors) {
      result.errors.push({
        file: previewRoot,
        path: err.path,
        message: err.message,
        type: 'semantic',
      })
    }
  }

  // Validate each unit
  for (const [, unit] of units) {
    const summaryKey = unit.type as keyof typeof result.summary
    result.summary[summaryKey].total++

    let unitValid = true

    // Schema validation - use originalConfig to ensure v2 fails without kind
    if (!options.semanticOnly) {
      const schemaResult = validateConfig(unit.originalConfig)
      if (!schemaResult.valid) {
        unitValid = false
        for (const err of schemaResult.errors) {
          result.errors.push({
            file: unit.configPath,
            path: err.path,
            message: err.message,
            type: 'schema',
          })
        }
      }

      // Warn for v1 configs missing kind (only if schema validation passed)
      const isV1 = unit.originalConfig.schemaVersion !== '2.0'
      if (isV1 && !unit.originalConfig.kind) {
        result.warnings.push({
          file: unit.configPath,
          path: '/kind',
          message: `Missing "kind" field. Inferred as "${unit.type.replace(/s$/, '')}" from directory.`,
        })
      }

      // Check id-folder mismatch
      if (unit.originalConfig.id && unit.originalConfig.id !== unit.folderId) {
        result.errors.push({
          file: unit.configPath,
          path: '/id',
          message: `Config id "${unit.originalConfig.id}" does not match folder name "${unit.folderId}"`,
          type: 'semantic',
        })
        unitValid = false
      }

      // Layout validation for screens
      if (unit.type === 'screens' && unit.config.layoutByRenderer) {
        const layoutResult = validateAllLayouts(
          unit.config.layoutByRenderer as Record<string, unknown>,
          options.renderer
        )
        if (!layoutResult.valid) {
          unitValid = false
          for (const err of layoutResult.errors) {
            // Check if this is a "missing renderer" warning (should not fail validation)
            if (err.keyword === 'missing-renderer-warning') {
              result.warnings.push({
                file: unit.configPath,
                path: err.path,
                message: err.message,
              })
            } else {
              result.errors.push({
                file: unit.configPath,
                path: err.path,
                message: err.message,
                type: 'schema',
              })
            }
          }
        }
      }
    }

    // Semantic validation
    if (!options.schemaOnly) {
      const semanticResult = validateSemantics(
        unit.config as unknown as PreviewConfig,
        context,
        unit.configPath
      )
      if (!semanticResult.valid) {
        unitValid = false
        for (const err of semanticResult.errors) {
          result.errors.push({
            file: unit.configPath,
            path: err.path,
            message: err.message,
            type: 'semantic',
          })
        }
      }

      for (const warn of semanticResult.warnings) {
        result.warnings.push({
          file: unit.configPath,
          path: warn.path,
          message: warn.message,
        })
      }
    }

    if (unitValid) {
      result.summary[summaryKey].valid++
    } else {
      result.summary[summaryKey].invalid++
    }
  }

  result.valid = result.errors.length === 0

  return result
}

/**
 * Format validation result for CLI output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = []

  // Summary
  for (const [type, counts] of Object.entries(result.summary)) {
    if (counts.total > 0) {
      const icon = counts.invalid > 0 ? '✗' : '✓'
      lines.push(`${icon} ${counts.valid}/${counts.total} ${type} validated`)
    }
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('')
    lines.push('Errors:')
    for (const err of result.errors) {
      lines.push(`  ${err.file}${err.path}: ${err.message}`)
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    for (const warn of result.warnings) {
      lines.push(`  ${warn.file}${warn.path}: ${warn.message}`)
    }
  }

  return lines.join('\n')
}

// Re-export types
export type {
  SchemaValidationResult,
  SchemaValidationError,
  SemanticValidationResult,
  SemanticValidationError,
  SemanticValidationWarning,
  ValidationContext,
}

// Re-export functions for direct use
export { validateConfig, validateAllLayouts, clearSchemaCache }
export { validateSemantics, createValidationContext, registerPreviewUnit, checkDuplicateIds }
