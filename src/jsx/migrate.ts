// src/jsx/migrate.ts
// Migration tool: converts YAML config to JSX
import { load as parseYaml } from 'js-yaml'
import { parsePrimitive, isQuoted } from '../primitives/parser'
import type { TemplateNode, Slots } from '../primitives/types'

export interface MigrationResult {
  success: boolean
  jsx?: string
  errors: string[]
}

export interface YamlConfig {
  kind: string
  id: string
  title: string
  schemaVersion?: string
  states?: Record<string, { description?: string }>
  template?: { root: TemplateNode }
  slots?: Slots
  props?: Record<string, unknown>
}

/**
 * Migrate a YAML config file to JSX/TSX
 */
export function migrateYamlToJsx(yamlContent: string): MigrationResult {
  const errors: string[] = []

  let config: YamlConfig
  try {
    config = parseYaml(yamlContent) as YamlConfig
  } catch (e) {
    return { success: false, errors: [`YAML parse error: ${e}`] }
  }

  if (!config.template?.root) {
    return { success: false, errors: ['No template.root found in config'] }
  }

  const componentName = pascalCase(config.id || 'Component')
  const hasStates = config.states && Object.keys(config.states).length > 0
  const hasSlots = config.slots && Object.keys(config.slots).length > 0
  const hasProps = config.props && Object.keys(config.props).length > 0

  // Build imports
  const imports = new Set<string>()
  collectImports(config.template.root, imports)

  // Generate state type
  const stateNames = hasStates ? Object.keys(config.states!) : ['default']

  // Generate JSX tree
  const jsxTree = convertNodeToJsx(config.template.root, 2, errors)

  // Generate slots if present
  let slotsCode = ''
  if (hasSlots) {
    slotsCode = generateSlotsCode(config.slots!, imports, errors)
  }

  // Build the output
  const output = `// Generated from ${config.id || 'config'}.yaml
// ${config.title}
import { z } from 'zod'
import {
  ${Array.from(imports).sort().join(',\n  ')},
  defineComponent,
} from '@prev-cli/jsx'

${hasProps ? generatePropsSchema(config.props!) : `const PropsSchema = z.object({})`}

const StatesSchema = z.enum([${stateNames.map(s => `'${s}'`).join(', ')}])

${slotsCode}
export const ${componentName} = defineComponent({
  name: '${componentName}',
  props: PropsSchema,
  states: StatesSchema,
  defaultState: '${stateNames[0]}',
  render: ({ props, state }) => (
${jsxTree}
  ),
})

export default ${componentName}
`

  return {
    success: errors.length === 0,
    jsx: output,
    errors,
  }
}

/**
 * Convert a template node to JSX string
 */
function convertNodeToJsx(node: TemplateNode, indent: number, errors: string[]): string {
  const spaces = '  '.repeat(indent)

  // String node: primitive or literal
  if (typeof node === 'string') {
    return convertLeafToJsx(node, indent, errors)
  }

  // Container node with type and children
  if (typeof node === 'object' && node !== null && 'type' in node) {
    const { type, children } = node as { type: string; children?: Record<string, TemplateNode> }
    return convertContainerToJsx(type, children, indent, errors)
  }

  errors.push(`Unknown node type: ${JSON.stringify(node)}`)
  return `${spaces}{/* unknown node */}`
}

/**
 * Convert a leaf node (primitive string) to JSX
 */
function convertLeafToJsx(value: string, indent: number, errors: string[]): string {
  const spaces = '  '.repeat(indent)

  // Check if it's a primitive
  if (value.startsWith('$')) {
    const result = parsePrimitive(value)
    if (!result.success) {
      errors.push(`Invalid primitive: ${value} - ${result.error.message}`)
      return `${spaces}{/* invalid: ${value} */}`
    }

    const primitive = result.primitive
    switch (primitive.type) {
      case '$text':
        return convertTextPrimitive(primitive, indent)
      case '$icon':
        return convertIconPrimitive(primitive, indent)
      case '$image':
        return convertImagePrimitive(primitive, indent)
      case '$spacer':
        return convertSpacerPrimitive(primitive, indent)
      case '$slot':
        return convertSlotPrimitive(primitive, indent)
      case '$col':
        return `${spaces}<Col${propsToJsx(primitive)} />`
      case '$row':
        return `${spaces}<Row${propsToJsx(primitive)} />`
      case '$box':
        return `${spaces}<Box${propsToJsx(primitive)} />`
      default:
        return `${spaces}{/* ${value} */}`
    }
  }

  // Component reference
  if (value.includes('/')) {
    return `${spaces}{/* ref: ${value} */}`
  }

  // Literal text
  return `${spaces}<Text>${escapeJsx(value)}</Text>`
}

/**
 * Convert a container node to JSX
 */
function convertContainerToJsx(
  type: string,
  children: Record<string, TemplateNode> | undefined,
  indent: number,
  errors: string[]
): string {
  const spaces = '  '.repeat(indent)
  const result = parsePrimitive(type)

  if (!result.success) {
    errors.push(`Invalid primitive: ${type} - ${result.error.message}`)
    return `${spaces}{/* invalid: ${type} */}`
  }

  const primitive = result.primitive
  const componentName = getComponentName(primitive.type)
  const props = propsToJsx(primitive)

  if (!children || Object.keys(children).length === 0) {
    return `${spaces}<${componentName}${props} />`
  }

  const childrenJsx = Object.entries(children)
    .map(([, child]) => convertNodeToJsx(child, indent + 1, errors))
    .join('\n')

  return `${spaces}<${componentName}${props}>
${childrenJsx}
${spaces}</${componentName}>`
}

/**
 * Convert primitive type to component name
 */
function getComponentName(type: string): string {
  const map: Record<string, string> = {
    '$col': 'Col',
    '$row': 'Row',
    '$box': 'Box',
    '$spacer': 'Spacer',
    '$slot': 'Slot',
    '$text': 'Text',
    '$icon': 'Icon',
    '$image': 'Image',
  }
  return map[type] || 'Unknown'
}

/**
 * Convert primitive props to JSX attribute string
 */
function propsToJsx(primitive: object): string {
  const attrs: string[] = []

  for (const [key, value] of Object.entries(primitive)) {
    if (key === 'type') continue
    if (value === undefined) continue

    // Handle invalid identifiers with computed property syntax
    const propName = isValidIdentifier(key) ? key : `["${escapeJsxAttribute(key)}"]`

    if (typeof value === 'string') {
      attrs.push(`${propName}="${escapeJsxAttribute(value)}"`)
    } else {
      attrs.push(`${propName}={${JSON.stringify(value)}}`)
    }
  }

  return attrs.length > 0 ? ' ' + attrs.join(' ') : ''
}

/**
 * Convert text primitive to JSX
 */
function convertTextPrimitive(
  primitive: { content: string; size?: string; weight?: string; color?: string },
  indent: number
): string {
  const spaces = '  '.repeat(indent)
  const attrs: string[] = []

  if (primitive.size) attrs.push(`size="${escapeJsxAttribute(primitive.size)}"`)
  if (primitive.weight) attrs.push(`weight="${escapeJsxAttribute(primitive.weight)}"`)
  if (primitive.color) attrs.push(`color="${escapeJsxAttribute(primitive.color)}"`)

  const content = isQuoted(primitive.content)
    ? escapeJsx(primitive.content.slice(1, -1))
    : `{props.${primitive.content}}`

  const propsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : ''
  return `${spaces}<Text${propsStr}>${content}</Text>`
}

/**
 * Convert icon primitive to JSX
 */
function convertIconPrimitive(
  primitive: { name: string; size?: string; color?: string },
  indent: number
): string {
  const spaces = '  '.repeat(indent)
  const attrs: string[] = []

  const name = isQuoted(primitive.name)
    ? `"${escapeJsxAttribute(primitive.name.slice(1, -1))}"`
    : `{props.${primitive.name}}`
  attrs.push(`name=${name}`)

  if (primitive.size) attrs.push(`size="${escapeJsxAttribute(primitive.size)}"`)
  if (primitive.color) attrs.push(`color="${escapeJsxAttribute(primitive.color)}"`)

  return `${spaces}<Icon ${attrs.join(' ')} />`
}

/**
 * Convert image primitive to JSX
 */
function convertImagePrimitive(
  primitive: { src: string; alt?: string; fit?: string },
  indent: number
): string {
  const spaces = '  '.repeat(indent)
  const attrs: string[] = []

  const src = isQuoted(primitive.src)
    ? `"${escapeJsxAttribute(primitive.src.slice(1, -1))}"`
    : `{props.${primitive.src}}`
  attrs.push(`src=${src}`)

  if (primitive.alt) attrs.push(`alt="${escapeJsxAttribute(primitive.alt)}"`)
  if (primitive.fit) attrs.push(`fit="${escapeJsxAttribute(primitive.fit)}"`)

  return `${spaces}<Image ${attrs.join(' ')} />`
}

/**
 * Convert spacer primitive to JSX
 */
function convertSpacerPrimitive(
  primitive: { size?: string },
  indent: number
): string {
  const spaces = '  '.repeat(indent)
  if (primitive.size) {
    return `${spaces}<Spacer size="${escapeJsxAttribute(primitive.size)}" />`
  }
  return `${spaces}<Spacer />`
}

/**
 * Convert slot primitive to JSX
 */
function convertSlotPrimitive(
  primitive: { name: string },
  indent: number
): string {
  const spaces = '  '.repeat(indent)
  return `${spaces}<Slot name="${escapeJsxAttribute(primitive.name)}" />`
}

/**
 * Collect all component imports needed
 */
function collectImports(node: TemplateNode, imports: Set<string>): void {
  if (typeof node === 'string') {
    if (node.startsWith('$')) {
      const result = parsePrimitive(node)
      if (result.success) {
        imports.add(getComponentName(result.primitive.type))
      }
    }
    return
  }

  if (typeof node === 'object' && node !== null && 'type' in node) {
    const { type, children } = node as { type: string; children?: Record<string, TemplateNode> }

    const result = parsePrimitive(type)
    if (result.success) {
      imports.add(getComponentName(result.primitive.type))
    }

    if (children) {
      for (const child of Object.values(children)) {
        collectImports(child, imports)
      }
    }
  }
}

/**
 * Generate props schema from config
 */
function generatePropsSchema(props: Record<string, unknown>): string {
  const fields: string[] = []

  for (const [name, def] of Object.entries(props)) {
    const propDef = def as { type?: string; required?: boolean; default?: unknown }
    let zodType = 'z.string()'

    if (propDef.type === 'number') zodType = 'z.number()'
    else if (propDef.type === 'boolean') zodType = 'z.boolean()'

    if (!propDef.required) zodType += '.optional()'

    fields.push(`  ${name}: ${zodType},`)
  }

  return `const PropsSchema = z.object({
${fields.join('\n')}
})`
}

/**
 * Generate slots code
 */
function generateSlotsCode(
  slots: Slots,
  imports: Set<string>,
  errors: string[]
): string {
  const slotDefs: string[] = []

  for (const [slotName, states] of Object.entries(slots)) {
    const stateEntries: string[] = []

    for (const [stateName, content] of Object.entries(states)) {
      if (typeof content === 'string' && content.startsWith('$')) {
        const jsx = convertLeafToJsx(content, 0, errors).trim()
        stateEntries.push(`    ${stateName}: ${jsx},`)
        collectImports(content, imports)
      }
    }

    slotDefs.push(`  ${slotName}: {
${stateEntries.join('\n')}
  },`)
  }

  return `const slots = {
${slotDefs.join('\n')}
}

`
}

/**
 * Escape JSX special characters in text content
 */
function escapeJsx(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/{/g, '&#123;')
    .replace(/}/g, '&#125;')
}

/**
 * Escape special characters in JSX attribute values
 */
function escapeJsxAttribute(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

/**
 * Check if a string is a valid JavaScript identifier
 */
function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
}

/**
 * Convert string to PascalCase
 */
function pascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}
