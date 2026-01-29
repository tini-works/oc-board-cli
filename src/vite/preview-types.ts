// src/vite/preview-types.ts
import { z } from 'zod'

// Preview content types (kind discriminator)
export type PreviewType = 'component' | 'screen' | 'flow' | 'atlas'

// Reference format - string shorthand or object with state/options
// Accepts both full paths (screens/login) and short names (login)
const refSchema = z.union([
  z.string().regex(/^([a-z0-9-]+|(screens|components|flows|atlas)\/[a-z0-9-]+)$/),
  z.object({
    ref: z.string().regex(/^([a-z0-9-]+|(screens|components|flows|atlas)\/[a-z0-9-]+)$/),
    state: z.string().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
])

// Base config schema shared by all types
const baseConfigSchema = z.object({
  kind: z.enum(['component', 'screen', 'flow', 'atlas']).optional(),
  id: z.string().regex(/^[a-z0-9-]+$/).optional(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.union([
    z.array(z.string()),
    z.string().transform(s => [s])
  ]).optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'stable', 'deprecated']).optional(),
  schemaVersion: z.enum(['1.0', '2.0']).optional(),
  order: z.number().optional(),
})

// Component-specific schema
export const componentConfigSchema = baseConfigSchema.extend({
  kind: z.literal('component').optional(),
  props: z.record(z.string(), z.object({
    type: z.string().optional(),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.unknown()).optional(),
  })).optional(),
  slots: z.record(z.string(), z.object({
    description: z.string().optional(),
  })).optional(),
})

// Screen-specific schema
export const screenConfigSchema = baseConfigSchema.extend({
  kind: z.literal('screen').optional(),
  states: z.record(z.string(), z.object({
    description: z.string().optional(),
  })).optional(),
  layoutByRenderer: z.record(z.string(), z.array(z.unknown())).optional(),
})

// Flow step schema - flexible to match various config formats
const flowStepSchema = z.object({
  id: z.string().optional(),  // Optional - can be auto-generated
  title: z.string().optional(),
  description: z.string().optional(),
  screen: refSchema,
  state: z.string().optional(),
  note: z.string().optional(),
  trigger: z.string().optional(),
  highlight: z.array(z.string()).optional(),
})

// Flow transition schema
const flowTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.string(),
})

// Flow-specific schema
export const flowConfigSchema = baseConfigSchema.extend({
  kind: z.literal('flow').optional(),
  steps: z.array(flowStepSchema).optional(),
  transitions: z.array(flowTransitionSchema).optional(),
})

// Atlas node schema
const atlasNodeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  ref: refSchema.optional(),
})

// Atlas relationship schema
const atlasRelationshipSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string(),
})

// Atlas-specific schema
export const atlasConfigSchema = baseConfigSchema.extend({
  kind: z.literal('atlas').optional(),
  nodes: z.array(atlasNodeSchema).optional(),
  relationships: z.array(atlasRelationshipSchema).optional(),
})

// Union of all config schemas (for v1 transitional validation)
export const configSchema = z.union([
  componentConfigSchema,
  screenConfigSchema,
  flowConfigSchema,
  atlasConfigSchema,
  baseConfigSchema, // fallback for untyped configs
])

export type PreviewConfig = z.infer<typeof configSchema>
export type ComponentConfig = z.infer<typeof componentConfigSchema>
export type ScreenConfig = z.infer<typeof screenConfigSchema>
export type FlowConfig = z.infer<typeof flowConfigSchema>
export type AtlasConfig = z.infer<typeof atlasConfigSchema>

// Extended preview unit with type awareness
export interface PreviewUnit {
  type: PreviewType
  name: string
  path: string
  route: string
  config: PreviewConfig | null
  files: {
    index: string           // Main entry file
    states?: string[]       // For screens: additional state files
    schema?: string         // For components: schema.ts
    docs?: string           // docs.mdx if present
  }
}

// Legacy FlowStep for backwards compatibility with existing index.yaml format
export interface FlowStep {
  screen: string
  state?: string
  note?: string
  trigger?: string
  highlight?: string[]
}

// Legacy FlowDefinition for backwards compatibility
export interface FlowDefinition {
  name: string
  description?: string
  steps: FlowStep[]
}

// Atlas area definition (legacy format)
export interface AtlasArea {
  title: string
  description?: string
  parent?: string
  children?: string[]
  access?: string
}

// Atlas definition (legacy format from index.yaml)
export interface AtlasDefinition {
  name: string
  description?: string
  hierarchy: {
    root: string
    areas: Record<string, AtlasArea>
  }
  routes?: Record<string, { area: string; screen: string; guard?: string }>
  navigation?: Record<string, Array<{ area?: string; icon?: string; action?: string }>>
  relationships?: Array<{ from: string; to: string; type: string }>
}
