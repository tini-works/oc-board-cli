// src/renderers/types.ts
// Renderer adapter interface and related types for renderer-agnostic previews

import type { JSONSchema7 } from 'json-schema'

/**
 * Preview type discriminator
 */
export type PreviewKind = 'component' | 'screen' | 'flow' | 'atlas'

/**
 * Reference to another preview unit
 */
export type PreviewRef = string | {
  ref: string
  state?: string
  options?: Record<string, unknown>
}

/**
 * Base config shared by all preview types
 */
export interface BaseConfig {
  kind: PreviewKind
  id: string
  title: string
  description?: string
  tags?: string[]
  status?: 'draft' | 'stable' | 'deprecated'
  schemaVersion: '1.0' | '2.0'
}

/**
 * Template node - container or leaf
 */
export interface TemplateContainerNode {
  type: string // Primitive string like "$col(gap:lg)"
  children?: Record<string, TemplateNode>
}

export type TemplateNode = TemplateContainerNode | string

/**
 * Template root structure
 */
export interface Template {
  root: TemplateNode
}

/**
 * Slots mapping: slot name -> state name -> content ref
 */
export type Slots = Record<string, Record<string, string>>

/**
 * Component config - defines reusable UI components
 */
export interface ComponentConfig extends BaseConfig {
  kind: 'component'
  props?: Record<string, {
    type?: string
    required?: boolean
    default?: unknown
    values?: unknown[]
    enum?: unknown[]
  }>
  template?: Template
  slots?: Record<string, {
    description?: string
  }>
}

/**
 * Screen config - defines full-page views with states
 */
export interface ScreenConfig extends BaseConfig {
  kind: 'screen'
  states?: Record<string, {
    description?: string
  }>
  /** New: Renderer-agnostic template using primitives */
  template?: Template
  /** New: State-dependent slot content mapping */
  slots?: Slots
  /** Legacy: Layout definitions per renderer. Values can be arrays or objects per adapter schema. */
  layoutByRenderer?: Record<string, unknown>
}

/**
 * Flow step definition
 */
export interface FlowStep {
  id: string
  title: string
  screen: PreviewRef
}

/**
 * Flow transition definition
 */
export interface FlowTransition {
  from: string
  to: string
  trigger: string
}

/**
 * Flow config - defines multi-step user journeys
 */
export interface FlowConfig extends BaseConfig {
  kind: 'flow'
  steps: FlowStep[]
  transitions?: FlowTransition[]
}

/**
 * Atlas node definition
 */
export interface AtlasNode {
  id: string
  title: string
  ref?: PreviewRef
}

/**
 * Atlas relationship definition
 */
export interface AtlasRelationship {
  from: string
  to: string
  type: string
}

/**
 * Atlas config - defines information architecture
 */
export interface AtlasConfig extends BaseConfig {
  kind: 'atlas'
  nodes: AtlasNode[]
  relationships?: AtlasRelationship[]
}

/**
 * Union of all config types
 */
export type PreviewConfig = ComponentConfig | ScreenConfig | FlowConfig | AtlasConfig

/**
 * Output from rendering a preview
 */
export interface RenderOutput {
  /** Generated HTML content */
  html: string
  /** Optional CSS styles */
  css?: string
  /** Optional JS asset path (e.g., "login.js"), build system handles bundling */
  js?: string
}

/**
 * Dev server interface for HMR support
 */
export interface DevServer {
  start(): Promise<void>
  stop(): Promise<void>
  readonly port: number
}

/**
 * Renderer adapter interface - implementations for React, HTML, Solid, etc.
 *
 * The adapter interface is intentionally thin. Bundling, asset management,
 * and hydration are handled by the build system (Vite/esbuild), not the adapter.
 */
export interface RendererAdapter {
  /**
   * Adapter name - must match layoutByRenderer keys in configs
   * @example "react", "html", "solid"
   */
  readonly name: string

  /**
   * JSON Schema for validating this renderer's layout nodes
   * Used by the validator to check layoutByRenderer subtrees
   */
  readonly layoutSchema: JSONSchema7

  /**
   * Render an isolated component with props applied
   */
  renderComponent(config: ComponentConfig): RenderOutput

  /**
   * Render a full screen layout in the specified state
   */
  renderScreen(config: ScreenConfig, state?: string): RenderOutput

  /**
   * Render the current step's screen with navigation UI (prev/next)
   */
  renderFlow(config: FlowConfig, step?: string): RenderOutput

  /**
   * Render a graph visualization with node thumbnails
   */
  renderAtlas(config: AtlasConfig): RenderOutput

  /**
   * Whether this adapter supports Hot Module Replacement
   */
  supportsHMR(): boolean

  /**
   * Create a dev server for HMR support (optional)
   */
  createDevServer?(port: number): DevServer
}
