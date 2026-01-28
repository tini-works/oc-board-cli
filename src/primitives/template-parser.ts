// src/primitives/template-parser.ts
// Parser for map-based template structures

import {
  isPrimitive,
  isRef,
  isContainerNode,
  type TemplateNode,
  type Template,
} from './types'
import { parsePrimitive, getPrimitiveType } from './parser'

// Valid container primitive types that can have children
const CONTAINER_TYPES = new Set(['$col', '$row', '$box'])

// Strict ref pattern: type/id format
const REF_PATTERN = /^(screens|components|flows|atlas)\/[a-z0-9-]+$/

export interface TemplateParseError {
  path: string
  message: string
}

export interface TemplateParseResult {
  valid: boolean
  errors: TemplateParseError[]
  warnings: TemplateParseError[]
}

/**
 * Validate a template structure
 */
export function validateTemplate(template: unknown): TemplateParseResult {
  const errors: TemplateParseError[] = []
  const warnings: TemplateParseError[] = []

  if (!template || typeof template !== 'object') {
    errors.push({
      path: '/template',
      message: 'Template must be an object',
    })
    return { valid: false, errors, warnings }
  }

  const templateObj = template as Record<string, unknown>

  if (!('root' in templateObj)) {
    errors.push({
      path: '/template',
      message: 'Template must have a root node',
    })
    return { valid: false, errors, warnings }
  }

  // Validate the root node recursively
  validateNode(templateObj.root, '/template/root', errors, warnings)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validate a single template node (recursive)
 */
function validateNode(
  node: unknown,
  path: string,
  errors: TemplateParseError[],
  warnings: TemplateParseError[]
): void {
  // String leaf node: primitive or ref
  if (typeof node === 'string') {
    validateLeafValue(node, path, errors, warnings)
    return
  }

  // Container node: { type: string, children: Record<string, node> }
  if (typeof node === 'object' && node !== null) {
    const nodeObj = node as Record<string, unknown>

    if (!('type' in nodeObj)) {
      errors.push({
        path,
        message: 'Container node must have a "type" field',
      })
      return
    }

    if (typeof nodeObj.type !== 'string') {
      errors.push({
        path: `${path}/type`,
        message: 'Node type must be a string',
      })
      return
    }

    // Validate the type is a valid primitive
    if (!isPrimitive(nodeObj.type)) {
      errors.push({
        path: `${path}/type`,
        message: `Node type must be a primitive (start with $): ${nodeObj.type}`,
      })
    } else {
      const parseResult = parsePrimitive(nodeObj.type)
      if (!parseResult.success) {
        errors.push({
          path: `${path}/type`,
          message: parseResult.error.message,
        })
      }
    }

    // Validate children if present
    if ('children' in nodeObj) {
      // First check if this primitive type can have children
      const primitiveType = getPrimitiveType(nodeObj.type)
      if (primitiveType && !CONTAINER_TYPES.has(primitiveType)) {
        errors.push({
          path: `${path}/children`,
          message: `Primitive ${primitiveType} cannot have children. Only $col, $row, $box support children.`,
        })
      }

      if (typeof nodeObj.children !== 'object' || nodeObj.children === null) {
        errors.push({
          path: `${path}/children`,
          message: 'Children must be an object',
        })
      } else {
        const children = nodeObj.children as Record<string, unknown>
        for (const [childId, childNode] of Object.entries(children)) {
          validateNode(childNode, `${path}/children/${childId}`, errors, warnings)
        }
      }
    }

    return
  }

  errors.push({
    path,
    message: `Invalid node type: expected string or object, got ${typeof node}`,
  })
}

/**
 * Validate a leaf value (primitive string or component ref)
 */
function validateLeafValue(
  value: string,
  path: string,
  errors: TemplateParseError[],
  warnings: TemplateParseError[]
): void {
  if (isPrimitive(value)) {
    // Validate primitive syntax
    const parseResult = parsePrimitive(value)
    if (!parseResult.success) {
      errors.push({
        path,
        message: parseResult.error.message,
      })
    }
  } else if (isRef(value)) {
    // Validate ref format
    if (!REF_PATTERN.test(value)) {
      errors.push({
        path,
        message: `Invalid ref format: ${value}. Expected format: type/id (e.g., components/button)`,
      })
    }
  } else {
    // Unknown format - could be a prop reference or literal
    // Warn if it doesn't look like either
    if (!value.match(/^[a-z][a-zA-Z0-9]*$/) && !value.startsWith('"') && !value.startsWith("'")) {
      warnings.push({
        path,
        message: `Ambiguous value: ${value}. Use $primitive, type/ref, or a valid prop name.`,
      })
    }
  }
}

/**
 * Validate slots structure
 */
export function validateSlots(
  slots: unknown,
  definedStates?: string[]
): TemplateParseResult {
  const errors: TemplateParseError[] = []
  const warnings: TemplateParseError[] = []

  if (!slots || typeof slots !== 'object') {
    errors.push({
      path: '/slots',
      message: 'Slots must be an object',
    })
    return { valid: false, errors, warnings }
  }

  const slotsObj = slots as Record<string, unknown>

  for (const [slotName, stateMapping] of Object.entries(slotsObj)) {
    if (typeof stateMapping !== 'object' || stateMapping === null) {
      errors.push({
        path: `/slots/${slotName}`,
        message: 'Slot state mapping must be an object',
      })
      continue
    }

    const mapping = stateMapping as Record<string, unknown>

    for (const [stateName, content] of Object.entries(mapping)) {
      // Validate state name exists if states are defined
      if (definedStates && definedStates.length > 0 && !definedStates.includes(stateName)) {
        errors.push({
          path: `/slots/${slotName}/${stateName}`,
          message: `Unknown state "${stateName}". Defined states: ${definedStates.join(', ')}`,
        })
      }

      // Validate content is a string ref or primitive
      if (typeof content !== 'string') {
        errors.push({
          path: `/slots/${slotName}/${stateName}`,
          message: 'Slot content must be a string (component ref)',
        })
      } else if (isPrimitive(content)) {
        // Valid primitive - check syntax
        const parseResult = parsePrimitive(content)
        if (!parseResult.success) {
          errors.push({
            path: `/slots/${slotName}/${stateName}`,
            message: parseResult.error.message,
          })
        }
      } else if (isRef(content)) {
        // Must match strict ref pattern
        if (!REF_PATTERN.test(content)) {
          errors.push({
            path: `/slots/${slotName}/${stateName}`,
            message: `Invalid ref format: ${content}. Expected type/id (e.g., components/button)`,
          })
        }
      } else {
        errors.push({
          path: `/slots/${slotName}/${stateName}`,
          message: `Invalid slot content: ${content}. Expected component ref or primitive.`,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Extract all component refs from a template
 */
export function extractRefs(template: unknown): string[] {
  const refs: string[] = []
  extractRefsFromNode(template, refs)
  return [...new Set(refs)] // Deduplicate
}

function extractRefsFromNode(node: unknown, refs: string[]): void {
  if (typeof node === 'string') {
    if (isRef(node)) {
      refs.push(node)
    }
    return
  }

  if (typeof node === 'object' && node !== null) {
    const nodeObj = node as Record<string, unknown>

    // Check root
    if ('root' in nodeObj) {
      extractRefsFromNode(nodeObj.root, refs)
    }

    // Check children
    if ('children' in nodeObj && typeof nodeObj.children === 'object' && nodeObj.children !== null) {
      const children = nodeObj.children as Record<string, unknown>
      for (const childNode of Object.values(children)) {
        extractRefsFromNode(childNode, refs)
      }
    }
  }
}

/**
 * Extract all slot names from a template
 */
export function extractSlotNames(template: unknown): string[] {
  const slots: string[] = []
  extractSlotsFromNode(template, slots)
  return [...new Set(slots)]
}

function extractSlotsFromNode(node: unknown, slots: string[]): void {
  if (typeof node === 'string') {
    if (isPrimitive(node)) {
      const primitiveType = getPrimitiveType(node)
      if (primitiveType === '$slot') {
        const parseResult = parsePrimitive(node)
        if (parseResult.success && parseResult.primitive.type === '$slot') {
          slots.push(parseResult.primitive.name)
        }
      }
    }
    return
  }

  if (typeof node === 'object' && node !== null) {
    const nodeObj = node as Record<string, unknown>

    // Check type
    if ('type' in nodeObj && typeof nodeObj.type === 'string' && isPrimitive(nodeObj.type)) {
      const primitiveType = getPrimitiveType(nodeObj.type)
      if (primitiveType === '$slot') {
        const parseResult = parsePrimitive(nodeObj.type)
        if (parseResult.success && parseResult.primitive.type === '$slot') {
          slots.push(parseResult.primitive.name)
        }
      }
    }

    // Check root
    if ('root' in nodeObj) {
      extractSlotsFromNode(nodeObj.root, slots)
    }

    // Check children
    if ('children' in nodeObj && typeof nodeObj.children === 'object' && nodeObj.children !== null) {
      const children = nodeObj.children as Record<string, unknown>
      for (const childNode of Object.values(children)) {
        extractSlotsFromNode(childNode, slots)
      }
    }
  }
}

/**
 * Flatten a template into a list of nodes with paths
 */
export function flattenTemplate(template: Template): Array<{ path: string; node: TemplateNode }> {
  const result: Array<{ path: string; node: TemplateNode }> = []
  flattenNode(template.root, '/root', result)
  return result
}

function flattenNode(
  node: TemplateNode,
  path: string,
  result: Array<{ path: string; node: TemplateNode }>
): void {
  result.push({ path, node })

  if (isContainerNode(node) && node.children) {
    for (const [childId, childNode] of Object.entries(node.children)) {
      flattenNode(childNode, `${path}/${childId}`, result)
    }
  }
}
