// src/jsx/define-component.ts
// API for defining custom components with typed props and states
import { z } from 'zod'
import { createComponentVNode, type VNodeType } from './vnode'
import { validateProps } from './validation'

/**
 * Render context passed to component render function
 */
export interface ComponentContext<TProps, TState> {
  props: TProps
  state: TState
}

/**
 * Component definition options
 */
export interface ComponentDefinition<
  TProps extends z.ZodType,
  TStates extends z.ZodType,
> {
  /** Component name (used in VNode tree) */
  name: string
  /** Zod schema for props */
  props: TProps
  /** Zod schema for states */
  states: TStates
  /** Default state value */
  defaultState: z.infer<TStates>
  /** Render function that returns a VNode tree */
  render: (ctx: ComponentContext<z.infer<TProps>, z.infer<TStates>>) => VNodeType
}

/**
 * Component function type returned by defineComponent
 */
export type ComponentFunction<TProps, TState> = {
  (props: TProps, state?: TState): VNodeType
  componentName: string
  propsSchema: z.ZodType<TProps>
  statesSchema: z.ZodType<TState>
  defaultState: TState
}

/**
 * Define a reusable component with typed props and states
 *
 * @example
 * ```tsx
 * const Button = defineComponent({
 *   name: 'Button',
 *   props: z.object({
 *     label: z.string(),
 *     variant: z.enum(['primary', 'secondary']).optional(),
 *   }),
 *   states: z.enum(['idle', 'loading', 'disabled']),
 *   defaultState: 'idle',
 *   render: ({ props, state }) => (
 *     <Box bg={state === 'loading' ? 'muted' : 'primary'} padding="md" radius="md">
 *       <Text>{props.label}</Text>
 *     </Box>
 *   ),
 * })
 *
 * // Usage
 * <Button label="Click me" />
 * <Button label="Processing..." state="loading" />
 * ```
 */
export function defineComponent<
  TProps extends z.ZodType,
  TStates extends z.ZodType,
>(
  definition: ComponentDefinition<TProps, TStates>
): ComponentFunction<z.infer<TProps>, z.infer<TStates>> {
  const { name, props: propsSchema, states: statesSchema, defaultState, render } = definition

  // Validate default state at definition time
  statesSchema.parse(defaultState)

  const Component = function (
    props: z.infer<TProps>,
    state?: z.infer<TStates>
  ): VNodeType {
    // Validate props based on current validation mode
    validateProps(propsSchema, props, name)

    // Use provided state or default
    const resolvedState = state !== undefined ? state : defaultState

    // Validate state if provided
    if (state !== undefined) {
      validateProps(statesSchema, state, `${name}[state]`)
    }

    // Render the component
    const rendered = render({ props, state: resolvedState })

    // Wrap in component VNode
    return createComponentVNode(name, props as Record<string, unknown>, [rendered])
  }

  // Attach metadata
  Component.componentName = name
  Component.propsSchema = propsSchema
  Component.statesSchema = statesSchema
  Component.defaultState = defaultState

  return Component as ComponentFunction<z.infer<TProps>, z.infer<TStates>>
}

/**
 * Helper to create a simple component without states
 */
export function defineStatelessComponent<TProps extends z.ZodType>(definition: {
  name: string
  props: TProps
  render: (props: z.infer<TProps>) => VNodeType
}): (props: z.infer<TProps>) => VNodeType {
  const NoState = z.literal('default')

  return defineComponent({
    name: definition.name,
    props: definition.props,
    states: NoState,
    defaultState: 'default',
    render: ({ props }) => definition.render(props),
  })
}
