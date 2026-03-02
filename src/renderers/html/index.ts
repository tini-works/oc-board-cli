// src/renderers/html/index.ts
// HTML renderer adapter implementation

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
 * HTML renderer adapter
 * Renders static HTML without JavaScript hydration
 */
export const HTMLAdapter: RendererAdapter = {
  name: 'html',

  layoutSchema: layoutSchema as JSONSchema7,

  renderComponent(config: ComponentConfig): RenderOutput {
    // TODO: Implement HTML component rendering
    // Pure HTML output, no JS needed
    return {
      html: `<div data-preview-component="${config.id}"><!-- HTML component: ${config.title} --></div>`,
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
      }
    }

    // Fall back to legacy layoutByRenderer
    return {
      html: `<div data-preview-screen="${config.id}" data-state="${currentState}"><!-- HTML screen: ${config.title} (layout keys: ${Object.keys(config.layoutByRenderer || {}).join(', ')}) --></div>`,
    }
  },

  renderFlow(config: FlowConfig, step?: string): RenderOutput {
    // TODO: Implement HTML flow rendering
    // Render current step with static navigation
    const currentStep = step ? config.steps?.find(s => s.id === step) : config.steps?.[0]
    return {
      html: `<div data-preview-flow="${config.id}" data-step="${currentStep?.id ?? 'unknown'}"><!-- HTML flow: ${config.title} --></div>`,
    }
  },

  supportsHMR(): boolean {
    return false
  },
}
