// src/renderers/index.ts
// Renderer module - exports adapters, registry, and render service

// Registry
export {
  registerAdapter,
  getAdapter,
  listAdapters,
  getAllAdapters,
  isValidRendererKey,
  getLayoutSchema,
  clearAdapters,
  initializeAdapters,
  validateRendererKeys,
} from './registry'

// Render service
export {
  renderPreview,
  renderPreviews,
  selectAdapter,
  ensureAdaptersInitialized,
  supportsHMR,
  type RenderOptions,
  type RenderResult,
} from './render'

// Types
export type {
  RendererAdapter,
  RenderOutput,
  DevServer,
  PreviewKind,
  PreviewRef,
  BaseConfig,
  ComponentConfig,
  ScreenConfig,
  FlowConfig,
  AtlasConfig,
  PreviewConfig,
  FlowStep,
  FlowTransition,
  AtlasNode,
  AtlasRelationship,
} from './types'

// Adapters (lazy loaded via registry)
export { ReactAdapter } from './react'
export { HTMLAdapter } from './html'
