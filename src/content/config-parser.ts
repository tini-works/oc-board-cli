// src/content/config-parser.ts
import { existsSync, readFileSync } from 'fs'
import * as yaml from 'js-yaml'
import {
  configSchema,
  flowConfigSchema,
  type PreviewConfig,
  type PreviewType,
  type FlowDefinition,
  type FlowConfig,
} from './preview-types'

export interface ParseOptions {
  /** Inject id from folder name if not present */
  injectId?: boolean
  /** Inject kind from directory type if not present */
  injectKind?: boolean
  /** The preview type (for kind inference) */
  previewType?: PreviewType
  /** The folder name (for id inference) */
  folderName?: string
}

export interface ParseResult<T> {
  data: T | null
  errors: string[]
  warnings: string[]
}

/**
 * Parse a config.yaml or config.yml file and validate against schema
 */
export async function parsePreviewConfig(
  filePath: string,
  options: ParseOptions = {}
): Promise<ParseResult<PreviewConfig>> {
  const result: ParseResult<PreviewConfig> = {
    data: null,
    errors: [],
    warnings: [],
  }

  if (!existsSync(filePath)) {
    result.errors.push(`Config file not found: ${filePath}`)
    return result
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    let parsed = yaml.load(content) as Record<string, unknown>

    if (!parsed || typeof parsed !== 'object') {
      result.errors.push(`Invalid YAML in ${filePath}`)
      return result
    }

    // Inject id from folder name if missing
    if (options.injectId && options.folderName && !parsed.id) {
      parsed = { ...parsed, id: options.folderName }
    }

    // Inject kind from directory type if missing
    if (options.injectKind && options.previewType && !parsed.kind) {
      parsed = { ...parsed, kind: options.previewType }
      result.warnings.push(`Config missing 'kind' field, inferred as '${options.previewType}'`)
    }

    // Validate ID matches folder name if both present
    if (options.folderName && parsed.id && parsed.id !== options.folderName) {
      result.errors.push(
        `Config id "${parsed.id}" does not match folder name "${options.folderName}"`
      )
      return result
    }

    const parseResult = configSchema.safeParse(parsed)

    if (parseResult.success) {
      result.data = parseResult.data
    } else {
      result.errors.push(`Invalid config at ${filePath}: ${parseResult.error.message}`)
    }

    return result
  } catch (err) {
    result.errors.push(`Error parsing config at ${filePath}: ${err}`)
    return result
  }
}

/**
 * Parse a flow config from config.yaml (new format)
 * Falls back to legacy index.yaml format for backwards compatibility
 */
export async function parseFlowConfig(
  configPath: string,
  options: ParseOptions = {}
): Promise<ParseResult<FlowConfig>> {
  const result: ParseResult<FlowConfig> = {
    data: null,
    errors: [],
    warnings: [],
  }

  if (!existsSync(configPath)) {
    result.errors.push(`Config file not found: ${configPath}`)
    return result
  }

  try {
    const content = readFileSync(configPath, 'utf-8')
    let parsed = yaml.load(content) as Record<string, unknown>

    if (!parsed || typeof parsed !== 'object') {
      result.errors.push(`Invalid YAML in ${configPath}`)
      return result
    }

    // Inject id and kind if missing
    if (options.injectId && options.folderName && !parsed.id) {
      parsed = { ...parsed, id: options.folderName }
    }
    if (options.injectKind && !parsed.kind) {
      parsed = { ...parsed, kind: 'flow' }
      result.warnings.push(`Config missing 'kind' field, inferred as 'flow'`)
    }

    const parseResult = flowConfigSchema.safeParse(parsed)

    if (parseResult.success) {
      result.data = parseResult.data
    } else {
      result.errors.push(`Invalid flow config: ${parseResult.error.message}`)
    }

    return result
  } catch (err) {
    result.errors.push(`Error parsing flow config: ${err}`)
    return result
  }
}

// ============================================================================
// Legacy parsers for backwards compatibility with index.yaml format
// These will be deprecated in v2
// ============================================================================

/**
 * Parse a flow index.yaml file (legacy format)
 * @deprecated Use parseFlowConfig with config.yaml instead
 */
export async function parseFlowDefinition(filePath: string): Promise<FlowDefinition | null> {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = yaml.load(content) as FlowDefinition

    // Basic validation
    if (!parsed.name || !Array.isArray(parsed.steps)) {
      return null
    }

    return parsed
  } catch (err) {
    console.warn(`Error parsing flow at ${filePath}:`, err)
    return null
  }
}

