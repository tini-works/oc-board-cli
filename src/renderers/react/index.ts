// src/renderers/react/index.ts
// React renderer adapter implementation

import type { JSONSchema7 } from 'json-schema'
import type {
  RendererAdapter,
  ComponentConfig,
  ScreenConfig,
  FlowConfig,
  RenderOutput,
} from '../types'
import layoutSchema from './layout.schema.json'
import { renderTemplate, generateTokenCSS } from '../../primitives'

/**
 * React renderer adapter
 * Renders React components to HTML with hydration support
 */
export const ReactAdapter: RendererAdapter = {
  name: 'react',

  layoutSchema: layoutSchema as JSONSchema7,

  renderComponent(config: ComponentConfig): RenderOutput {
    // TODO: Implement React component rendering
    // This will use React Server Components or renderToString
    return {
      html: `<div data-preview-component="${config.id}"><!-- React component: ${config.title} --></div>`,
      js: `${config.id}.js`,
    }
  },

  renderScreen(config: ScreenConfig, state?: string): RenderOutput {
    const currentState = state ?? 'default'

    // Use template if available (new format)
    if (config.template) {
      const html = renderTemplate(config.template, {
        state: currentState,
        slots: config.slots,
        renderRef: (ref) => `<div data-ref="${ref}"><!-- ${ref} --></div>`,
      })

      return {
        html: `<div data-preview-screen="${config.id}" data-state="${currentState}">${html}</div>`,
        css: generateTokenCSS(),
        js: `${config.id}.js`,
      }
    }

    // Fall back to legacy layoutByRenderer
    return {
      html: `<div data-preview-screen="${config.id}" data-state="${currentState}"><!-- React screen: ${config.title} (layout keys: ${Object.keys(config.layoutByRenderer || {}).join(', ')}) --></div>`,
      js: `${config.id}.js`,
    }
  },

  renderFlow(config: FlowConfig, step?: string): RenderOutput {
    // TODO: Implement React flow rendering
    // Render current step screen with navigation UI
    const currentStep = step ? config.steps?.find(s => s.id === step) : config.steps?.[0]
    return {
      html: `<div data-preview-flow="${config.id}" data-step="${currentStep?.id ?? 'unknown'}"><!-- React flow: ${config.title} --></div>`,
      js: `${config.id}.js`,
    }
  },

  supportsHMR(): boolean {
    return true
  },
}
