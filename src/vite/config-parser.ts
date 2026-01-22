// src/vite/config-parser.ts
import { existsSync, readFileSync } from 'fs'
import * as yaml from 'js-yaml'
import { configSchema, type PreviewConfig, type FlowDefinition, type AtlasDefinition } from './preview-types'

/**
 * Parse a config.yaml or config.yml file and validate against schema
 */
export async function parsePreviewConfig(filePath: string): Promise<PreviewConfig | null> {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = yaml.load(content)
    const result = configSchema.safeParse(parsed)

    if (result.success) {
      return result.data
    }

    console.warn(`Invalid config at ${filePath}:`, result.error.message)
    return null
  } catch (err) {
    console.warn(`Error parsing config at ${filePath}:`, err)
    return null
  }
}

/**
 * Parse a flow index.yaml file
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

/**
 * Parse an atlas index.yaml file
 */
export async function parseAtlasDefinition(filePath: string): Promise<AtlasDefinition | null> {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = yaml.load(content) as AtlasDefinition

    // Basic validation
    if (!parsed.name || !parsed.hierarchy?.root || !parsed.hierarchy?.areas) {
      return null
    }

    return parsed
  } catch (err) {
    console.warn(`Error parsing atlas at ${filePath}:`, err)
    return null
  }
}
