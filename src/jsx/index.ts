// src/jsx/index.ts
// Main entry point for JSX primitives

// Schemas
export * from './schemas'

// VNode
export {
  createVNode,
  createComponentVNode,
  normalizeChildren,
  vnodeEquals,
  resetIdCounter,
  VNode,
  type VNodeType,
} from './vnode'

// JSX runtime (for direct use)
export {
  Col,
  Row,
  Box,
  Spacer,
  Slot,
  Text,
  Icon,
  Image,
  Fragment,
} from './jsx-runtime'

// defineComponent API
export {
  defineComponent,
  defineStatelessComponent,
  type ComponentContext,
  type ComponentDefinition,
  type ComponentFunction,
} from './define-component'

// HTML adapter
export { renderToHtml, type RenderContext } from './adapters/html'

// React adapter
export { toReact, setTokensConfig, type ReactRenderContext, type TokensConfig } from './adapters/react'

// Migration tool
export { migrateYamlToJsx, type MigrationResult, type YamlConfig } from './migrate'
