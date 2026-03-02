// src/renderers/render.ts
// Preview rendering service - orchestrates adapter selection and rendering

import { initializeAdapters, getAdapter, listAdapters } from './registry'
import type { PreviewConfig, RenderOutput, RendererAdapter } from './types'

export interface RenderOptions {
  /** Specific renderer to use (defaults to first available in layoutByRenderer) */
  renderer?: string
  /** State for screen rendering */
  state?: string
  /** Step for flow rendering */
  step?: string
}

export interface RenderResult {
  success: boolean
  output?: RenderOutput
  error?: string
  renderer?: string
}

let initialized = false

/**
 * Ensure adapters are initialized
 */
export async function ensureAdaptersInitialized(): Promise<void> {
  if (!initialized) {
    await initializeAdapters()
    initialized = true
  }
}

/**
 * Select the appropriate renderer adapter for a config
 */
export function selectAdapter(
  config: PreviewConfig,
  preferredRenderer?: string
): RendererAdapter | null {
  // If a preferred renderer is specified, use it
  if (preferredRenderer) {
    return getAdapter(preferredRenderer) ?? null
  }

  // For screens, select based on layoutByRenderer
  if (config.kind === 'screen' && 'layoutByRenderer' in config && config.layoutByRenderer) {
    const availableRenderers = Object.keys(config.layoutByRenderer)

    // Try each renderer in order until we find a registered adapter
    for (const rendererKey of availableRenderers) {
      const adapter = getAdapter(rendererKey)
      if (adapter) {
        return adapter
      }
    }
  }

  // For other types, default to first available adapter
  const adapters = listAdapters()
  if (adapters.length > 0) {
    return getAdapter(adapters[0]) ?? null
  }

  return null
}

/**
 * Render a preview config using the appropriate adapter
 */
export async function renderPreview(
  config: PreviewConfig,
  options: RenderOptions = {}
): Promise<RenderResult> {
  await ensureAdaptersInitialized()

  const adapter = selectAdapter(config, options.renderer)

  if (!adapter) {
    return {
      success: false,
      error: `No adapter found for config. Available adapters: ${listAdapters().join(', ') || 'none'}`,
    }
  }

  try {
    let output: RenderOutput

    switch (config.kind) {
      case 'component':
        output = adapter.renderComponent(config)
        break

      case 'screen':
        output = adapter.renderScreen(config, options.state)
        break

      case 'flow':
        output = adapter.renderFlow(config, options.step)
        break

      default:
        return {
          success: false,
          error: `Unknown config kind: ${(config as { kind: string }).kind}`,
        }
    }

    return {
      success: true,
      output,
      renderer: adapter.name,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Render multiple previews with the same adapter
 */
export async function renderPreviews(
  configs: PreviewConfig[],
  options: RenderOptions = {}
): Promise<Map<string, RenderResult>> {
  await ensureAdaptersInitialized()

  const results = new Map<string, RenderResult>()

  for (const config of configs) {
    const result = await renderPreview(config, options)
    results.set(config.id, result)
  }

  return results
}

/**
 * Check if a specific renderer supports HMR
 */
export async function supportsHMR(rendererName?: string): Promise<boolean> {
  await ensureAdaptersInitialized()

  if (rendererName) {
    const adapter = getAdapter(rendererName)
    return adapter?.supportsHMR() ?? false
  }

  // Check if any adapter supports HMR
  for (const name of listAdapters()) {
    const adapter = getAdapter(name)
    if (adapter?.supportsHMR()) {
      return true
    }
  }

  return false
}
