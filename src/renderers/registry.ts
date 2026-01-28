// src/renderers/registry.ts
// Registry for managing renderer adapters

import type { JSONSchema7 } from 'json-schema'
import type { RendererAdapter } from './types'

/**
 * Global registry of renderer adapters
 */
const adapters = new Map<string, RendererAdapter>()

/**
 * Register a renderer adapter
 * @throws Error if adapter with same name already registered
 */
export function registerAdapter(adapter: RendererAdapter): void {
  if (adapters.has(adapter.name)) {
    throw new Error(`Renderer adapter "${adapter.name}" is already registered`)
  }
  adapters.set(adapter.name, adapter)
}

/**
 * Get a renderer adapter by name
 */
export function getAdapter(name: string): RendererAdapter | undefined {
  return adapters.get(name)
}

/**
 * List all registered adapter names
 */
export function listAdapters(): string[] {
  return Array.from(adapters.keys())
}

/**
 * List all registered adapters
 */
export function getAllAdapters(): RendererAdapter[] {
  return Array.from(adapters.values())
}

/**
 * Check if a renderer key matches a registered adapter
 */
export function isValidRendererKey(key: string): boolean {
  return adapters.has(key)
}

/**
 * Get the layout schema for a specific renderer
 */
export function getLayoutSchema(name: string): JSONSchema7 | undefined {
  return adapters.get(name)?.layoutSchema
}

/**
 * Clear all registered adapters (for testing)
 */
export function clearAdapters(): void {
  adapters.clear()
}

/**
 * Initialize default adapters
 * Called at startup to register built-in adapters
 */
export async function initializeAdapters(): Promise<void> {
  // Import and register default adapters
  // These are lazy-loaded to avoid circular dependencies
  try {
    const { ReactAdapter } = await import('./react/index')
    if (!adapters.has('react')) {
      registerAdapter(ReactAdapter)
    }
  } catch {
    // React adapter not available
  }

  try {
    const { HTMLAdapter } = await import('./html/index')
    if (!adapters.has('html')) {
      registerAdapter(HTMLAdapter)
    }
  } catch {
    // HTML adapter not available
  }
}

/**
 * Validate that all layoutByRenderer keys have registered adapters
 * @returns Array of unknown renderer keys
 */
export function validateRendererKeys(keys: string[]): string[] {
  return keys.filter(key => !adapters.has(key))
}
