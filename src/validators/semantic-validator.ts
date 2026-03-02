// src/validators/semantic-validator.ts
// Semantic validation for cross-file references and business rules

import type { PreviewConfig, FlowConfig, ScreenConfig, Template, Slots } from '../renderers/types'
import { listAdapters } from '../renderers/registry'
import { validateTemplate, validateSlots, extractRefs, extractSlotNames } from '../primitives'

export interface SemanticValidationResult {
  valid: boolean
  errors: SemanticValidationError[]
  warnings: SemanticValidationWarning[]
}

export interface SemanticValidationError {
  path: string
  message: string
  code: SemanticErrorCode
}

export interface SemanticValidationWarning {
  path: string
  message: string
  code: SemanticWarningCode
}

export type SemanticErrorCode =
  | 'DUPLICATE_ID'
  | 'INVALID_REF'
  | 'INVALID_STATE_REF'
  | 'INVALID_STEP_REF'
  | 'CIRCULAR_DEPENDENCY'
  | 'UNKNOWN_RENDERER'
  | 'INVALID_TEMPLATE'
  | 'INVALID_SLOT'
  | 'MISSING_SLOT_DEFINITION'

export type SemanticWarningCode =
  | 'DEPRECATED_STATUS'
  | 'MISSING_DESCRIPTION'

export interface ValidationContext {
  /** Root directory containing previews folder */
  rootDir: string
  /** Map of all known preview IDs by type */
  knownIds: {
    components: Set<string>
    screens: Set<string>
    flows: Set<string>
  }
  /** Map of screen states by screen ID */
  screenStates: Map<string, Set<string>>
}

/**
 * Parse a reference string to extract type and id
 */
function parseRef(ref: string | { ref: string }): { type: string; id: string } | null {
  const refStr = typeof ref === 'string' ? ref : ref.ref
  const match = refStr.match(/^(screens|components|flows)\/([a-z0-9-]+)$/)
  if (!match) return null
  return { type: match[1], id: match[2] }
}

/**
 * Get state from a reference object
 */
function getRefState(ref: string | { ref: string; state?: string }): string | undefined {
  if (typeof ref === 'string') return undefined
  return ref.state
}

/**
 * Detect cycles in a directed graph using DFS
 * Returns the first cycle found as an array of node IDs, or null if no cycle
 */
function detectCycle(
  edges: Array<{ from: string; to: string }>,
  nodeIds: Set<string>
): string[] | null {
  const adjacency = new Map<string, string[]>()

  // Build adjacency list
  for (const node of nodeIds) {
    adjacency.set(node, [])
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to)
  }

  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): string[] | null {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    for (const neighbor of adjacency.get(node) || []) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor)
        if (cycle) return cycle
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle - return the cycle path
        const cycleStart = path.indexOf(neighbor)
        return [...path.slice(cycleStart), neighbor]
      }
    }

    path.pop()
    recursionStack.delete(node)
    return null
  }

  for (const node of nodeIds) {
    if (!visited.has(node)) {
      const cycle = dfs(node)
      if (cycle) return cycle
    }
  }

  return null
}

/**
 * Validate a single reference against known IDs
 */
function validateRef(
  ref: string | { ref: string; state?: string },
  context: ValidationContext,
  path: string
): { errors: SemanticValidationError[]; warnings: SemanticValidationWarning[] } {
  const errors: SemanticValidationError[] = []
  const warnings: SemanticValidationWarning[] = []

  const parsed = parseRef(ref)
  if (!parsed) {
    errors.push({
      path,
      message: `Invalid reference format: ${JSON.stringify(ref)}`,
      code: 'INVALID_REF',
    })
    return { errors, warnings }
  }

  // Check if referenced ID exists
  const knownSet = context.knownIds[parsed.type as keyof typeof context.knownIds]
  if (!knownSet?.has(parsed.id)) {
    errors.push({
      path,
      message: `Reference "${parsed.type}/${parsed.id}" not found`,
      code: 'INVALID_REF',
    })
    return { errors, warnings }
  }

  // If referencing a screen with a state, validate the state exists
  if (parsed.type === 'screens') {
    const state = getRefState(ref)
    if (state) {
      const screenStates = context.screenStates.get(parsed.id)
      if (!screenStates) {
        // Screen has no states defined at all
        errors.push({
          path,
          message: `State "${state}" referenced but screen "${parsed.id}" has no states defined`,
          code: 'INVALID_STATE_REF',
        })
      } else if (!screenStates.has(state)) {
        errors.push({
          path,
          message: `State "${state}" not found in screen "${parsed.id}". Available states: ${Array.from(screenStates).join(', ') || 'none'}`,
          code: 'INVALID_STATE_REF',
        })
      }
    }
  }

  return { errors, warnings }
}

/**
 * Validate a flow config's semantic rules
 */
function validateFlow(
  config: FlowConfig,
  context: ValidationContext,
  configPath: string
): { errors: SemanticValidationError[]; warnings: SemanticValidationWarning[] } {
  const errors: SemanticValidationError[] = []
  const warnings: SemanticValidationWarning[] = []

  if (!config.steps || config.steps.length === 0) {
    return { errors, warnings }
  }

  // Build set of step IDs
  const stepIds = new Set(config.steps.map(s => s.id))

  // Validate each step's screen reference
  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i]
    const result = validateRef(step.screen, context, `${configPath}/steps/${i}/screen`)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  }

  // Validate transitions reference existing step IDs
  if (config.transitions) {
    for (let i = 0; i < config.transitions.length; i++) {
      const transition = config.transitions[i]

      if (!stepIds.has(transition.from)) {
        errors.push({
          path: `${configPath}/transitions/${i}/from`,
          message: `Transition "from" references unknown step "${transition.from}". Available steps: ${Array.from(stepIds).join(', ')}`,
          code: 'INVALID_STEP_REF',
        })
      }

      if (!stepIds.has(transition.to)) {
        errors.push({
          path: `${configPath}/transitions/${i}/to`,
          message: `Transition "to" references unknown step "${transition.to}". Available steps: ${Array.from(stepIds).join(', ')}`,
          code: 'INVALID_STEP_REF',
        })
      }
    }

    // Detect circular dependencies in transitions
    const cycle = detectCycle(config.transitions, stepIds)
    if (cycle) {
      errors.push({
        path: `${configPath}/transitions`,
        message: `Circular dependency detected in flow transitions: ${cycle.join(' → ')}`,
        code: 'CIRCULAR_DEPENDENCY',
      })
    }
  }

  return { errors, warnings }
}

/**
 * Validate a screen's template structure and references
 */
function validateScreenTemplate(
  template: Template,
  slots: Slots | undefined,
  states: string[] | undefined,
  context: ValidationContext,
  configPath: string
): { errors: SemanticValidationError[]; warnings: SemanticValidationWarning[] } {
  const errors: SemanticValidationError[] = []
  const warnings: SemanticValidationWarning[] = []

  // Validate template structure
  const templateResult = validateTemplate(template)
  for (const err of templateResult.errors) {
    errors.push({
      path: `${configPath}${err.path}`,
      message: err.message,
      code: 'INVALID_TEMPLATE',
    })
  }
  for (const warn of templateResult.warnings) {
    warnings.push({
      path: `${configPath}${warn.path}`,
      message: warn.message,
      code: 'MISSING_DESCRIPTION',
    })
  }

  // Validate component refs in template
  const refs = extractRefs(template)
  for (const ref of refs) {
    const parsed = parseRef(ref)
    if (parsed) {
      const knownSet = context.knownIds[parsed.type as keyof typeof context.knownIds]
      if (knownSet && !knownSet.has(parsed.id)) {
        errors.push({
          path: `${configPath}/template`,
          message: `Template references unknown ${parsed.type}/${parsed.id}`,
          code: 'INVALID_REF',
        })
      }
    }
  }

  // Extract slot names from template and validate slots mapping
  const slotNames = extractSlotNames(template)

  if (slots) {
    // Validate slots structure
    const slotsResult = validateSlots(slots, states)
    for (const err of slotsResult.errors) {
      errors.push({
        path: `${configPath}${err.path}`,
        message: err.message,
        code: 'INVALID_SLOT',
      })
    }

    // Check that all slot names in template have corresponding slots mapping
    for (const slotName of slotNames) {
      if (!slots[slotName]) {
        warnings.push({
          path: `${configPath}/slots`,
          message: `Template uses $slot(${slotName}) but no slots mapping defined for it`,
          code: 'MISSING_DESCRIPTION',
        })
      }
    }

    // Validate refs in slot content
    for (const [slotName, stateMapping] of Object.entries(slots)) {
      for (const [stateName, content] of Object.entries(stateMapping)) {
        // Content should be a ref or primitive
        if (!content.startsWith('$')) {
          const parsed = parseRef(content)
          if (parsed) {
            const knownSet = context.knownIds[parsed.type as keyof typeof context.knownIds]
            if (knownSet && !knownSet.has(parsed.id)) {
              errors.push({
                path: `${configPath}/slots/${slotName}/${stateName}`,
                message: `Slot content references unknown ${parsed.type}/${parsed.id}`,
                code: 'INVALID_REF',
              })
            }
          }
        }
      }
    }
  } else if (slotNames.length > 0) {
    // Template has slots but no slots mapping
    errors.push({
      path: `${configPath}/slots`,
      message: `Template uses slots (${slotNames.join(', ')}) but no slots mapping defined`,
      code: 'MISSING_SLOT_DEFINITION',
    })
  }

  return { errors, warnings }
}

/**
 * Validate layoutByRenderer keys against registered adapters
 */
function validateRendererKeys(
  layoutByRenderer: Record<string, unknown> | undefined,
  configPath: string
): { errors: SemanticValidationError[]; warnings: SemanticValidationWarning[] } {
  const errors: SemanticValidationError[] = []
  const warnings: SemanticValidationWarning[] = []

  if (!layoutByRenderer) {
    return { errors, warnings }
  }

  const registeredAdapters = new Set(listAdapters())

  for (const key of Object.keys(layoutByRenderer)) {
    if (!registeredAdapters.has(key)) {
      errors.push({
        path: `${configPath}/layoutByRenderer/${key}`,
        message: `Unknown renderer "${key}". Registered renderers: ${Array.from(registeredAdapters).join(', ') || 'none'}`,
        code: 'UNKNOWN_RENDERER',
      })
    }
  }

  return { errors, warnings }
}

/**
 * Extract ComponentRef references from a layout tree
 * ComponentRefs have type: "ComponentRef" and a ref field
 */
function extractComponentRefs(
  node: unknown,
  path: string,
  refs: Array<{ ref: string; path: string }>
): void {
  if (!node || typeof node !== 'object') return

  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      extractComponentRefs(item, `${path}/${index}`, refs)
    })
    return
  }

  const obj = node as Record<string, unknown>

  // Check if this is a ComponentRef
  if (obj.type === 'ComponentRef' && typeof obj.ref === 'string') {
    refs.push({ ref: obj.ref, path: `${path}/ref` })
  }

  // Recursively check children, props, etc.
  if (obj.children) {
    extractComponentRefs(obj.children, `${path}/children`, refs)
  }
  if (obj.props && typeof obj.props === 'object') {
    for (const [key, value] of Object.entries(obj.props)) {
      extractComponentRefs(value, `${path}/props/${key}`, refs)
    }
  }
}

/**
 * Validate ComponentRef targets in layoutByRenderer
 */
function validateLayoutComponentRefs(
  layoutByRenderer: Record<string, unknown> | undefined,
  context: ValidationContext,
  configPath: string
): { errors: SemanticValidationError[]; warnings: SemanticValidationWarning[] } {
  const errors: SemanticValidationError[] = []
  const warnings: SemanticValidationWarning[] = []

  if (!layoutByRenderer) {
    return { errors, warnings }
  }

  for (const [rendererKey, layout] of Object.entries(layoutByRenderer)) {
    const refs: Array<{ ref: string; path: string }> = []
    extractComponentRefs(layout, `${configPath}/layoutByRenderer/${rendererKey}`, refs)

    for (const { ref, path } of refs) {
      // ComponentRef.ref should be in format "components/<id>"
      const match = ref.match(/^components\/([a-z0-9-]+)$/)
      if (!match) {
        errors.push({
          path,
          message: `Invalid ComponentRef format: "${ref}". Expected "components/<id>"`,
          code: 'INVALID_REF',
        })
        continue
      }

      const componentId = match[1]
      if (!context.knownIds.components.has(componentId)) {
        errors.push({
          path,
          message: `ComponentRef references unknown component "${componentId}"`,
          code: 'INVALID_REF',
        })
      }
    }
  }

  return { errors, warnings }
}

/**
 * Validate a config against semantic rules
 */
export function validateSemantics(
  config: PreviewConfig,
  context: ValidationContext,
  configPath: string = ''
): SemanticValidationResult {
  const errors: SemanticValidationError[] = []
  const warnings: SemanticValidationWarning[] = []

  // Check for deprecated status
  if (config.status === 'deprecated') {
    warnings.push({
      path: `${configPath}/status`,
      message: `This ${config.kind} is marked as deprecated`,
      code: 'DEPRECATED_STATUS',
    })
  }

  // Check for missing description
  if (!config.description) {
    warnings.push({
      path: configPath,
      message: `Missing description for ${config.kind} "${config.id}"`,
      code: 'MISSING_DESCRIPTION',
    })
  }

  // Validate screens
  if (config.kind === 'screen') {
    const screenConfig = config as ScreenConfig

    // Validate template if present
    if (screenConfig.template) {
      const stateNames = screenConfig.states ? Object.keys(screenConfig.states) : undefined
      const templateResult = validateScreenTemplate(
        screenConfig.template,
        screenConfig.slots,
        stateNames,
        context,
        configPath
      )
      errors.push(...templateResult.errors)
      warnings.push(...templateResult.warnings)
    }

    // Validate layoutByRenderer if present (legacy)
    if (screenConfig.layoutByRenderer) {
      // Validate renderer keys
      const keysResult = validateRendererKeys(screenConfig.layoutByRenderer, configPath)
      errors.push(...keysResult.errors)
      warnings.push(...keysResult.warnings)

      // Validate ComponentRef targets in layouts
      const refsResult = validateLayoutComponentRefs(screenConfig.layoutByRenderer, context, configPath)
      errors.push(...refsResult.errors)
      warnings.push(...refsResult.warnings)
    }
  }

  // Flow-specific validation
  if (config.kind === 'flow') {
    const result = validateFlow(config as FlowConfig, context, configPath)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Create an empty validation context
 */
export function createValidationContext(rootDir: string): ValidationContext {
  return {
    rootDir,
    knownIds: {
      components: new Set(),
      screens: new Set(),
      flows: new Set(),
    },
    screenStates: new Map(),
  }
}

/**
 * Register a preview unit in the validation context
 */
export function registerPreviewUnit(
  context: ValidationContext,
  type: 'component' | 'screen' | 'flow',
  id: string,
  states?: string[]
): void {
  const typeKey = `${type}s` as keyof typeof context.knownIds
  context.knownIds[typeKey].add(id)

  if (type === 'screen' && states) {
    context.screenStates.set(id, new Set(states))
  }
}

/**
 * Check for duplicate IDs within a type
 */
export function checkDuplicateIds(
  ids: string[],
  type: string
): SemanticValidationError[] {
  const seen = new Set<string>()
  const duplicates: SemanticValidationError[] = []

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.push({
        path: `/${type}/${id}`,
        message: `Duplicate ${type} ID: "${id}"`,
        code: 'DUPLICATE_ID',
      })
    }
    seen.add(id)
  }

  return duplicates
}
