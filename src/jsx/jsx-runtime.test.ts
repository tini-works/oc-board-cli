// src/jsx/jsx-runtime.test.ts
import { test, expect, describe, beforeEach, afterEach, spyOn } from 'bun:test'
import { z } from 'zod'
import { createVNode, resetIdCounter, createRenderContext, normalizeChildren, vnodeEquals } from './vnode'
import { Col, Box, Slot, Text, Icon, Fragment, setValidationMode, getValidationMode } from './jsx-runtime'
import { validateProps, type ValidationMode } from './validation'
import { defineComponent, defineStatelessComponent } from './define-component'

let originalMode: ValidationMode

beforeEach(() => {
  resetIdCounter()
  originalMode = getValidationMode()
  setValidationMode('strict')
})

afterEach(() => {
  setValidationMode(originalMode)
})

describe('jsx-runtime', () => {
  test('vnode, primitives, components, validation', () => {
    // vnode internals
    const ctx1 = createRenderContext()
    const ctx2 = createRenderContext()
    ctx1.nextId('col')
    expect(ctx2.nextId('col')).toBe('col-0')
    expect(normalizeChildren(['hello'])[0].props.content).toBe('hello')
    const a = createVNode('col', { gap: 'lg' })
    resetIdCounter()
    expect(vnodeEquals(a, createVNode('col', { gap: 'lg' }))).toBe(true)

    // primitives
    expect(Col({ gap: 'lg' }).type).toBe('col')
    expect(Fragment({ children: [Text({ children: 'A' })] })).toHaveLength(1)
    expect(Col({ children: [Text({ children: 'X' })] }).children![0].props.content).toBe('X')
    expect(() => Col({ gap: 'invalid' as any })).toThrow()
    expect(() => Slot({} as any)).toThrow()
    expect(() => Icon({} as any)).toThrow()

    // defineComponent
    const Button = defineComponent({
      name: 'Button',
      props: z.object({ label: z.string() }),
      states: z.enum(['idle', 'loading']),
      defaultState: 'idle',
      render: ({ props, state }) => Box({ bg: state === 'loading' ? 'muted' : 'primary', children: [Text({ children: props.label })] }),
    })
    expect(Button({ label: 'Click' }).componentName).toBe('Button')
    expect(Button({ label: 'X' }, 'loading').children![0].props.bg).toBe('muted')
    expect(() => Button({ label: 123 } as any)).toThrow()
    expect(defineStatelessComponent({ name: 'L', props: z.object({ t: z.string() }), render: (p) => Text({ children: p.t }) })({ t: 'Hi' }).componentName).toBe('L')

    // validation modes
    setValidationMode('warn')
    const spy = spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => validateProps(z.object({ n: z.string() }), { n: 1 }, 'T')).not.toThrow()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    setValidationMode('off')
    expect(() => validateProps(z.object({ n: z.string() }), { n: 1 }, 'T')).not.toThrow()
  })
})
