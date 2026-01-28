// src/jsx/migrate.test.ts
import { test, expect, describe } from 'bun:test'
import { migrateYamlToJsx } from './migrate'

describe('migrateYamlToJsx', () => {
  test('migrates all primitives, states, slots, props, and handles errors', () => {
    const componentYaml = `
kind: component
id: card-layout
title: Card Layout
template:
  root:
    type: $col(gap:md padding:lg)
    children:
      row:
        type: $row(gap:sm)
        children:
          icon: $icon("star" size:lg)
          title: $text("Title & <tags>" size:xl)
      spacer: $spacer(xl)
      image: $image(src:"img.png" fit:cover)
      footer: $box(bg:muted)
`
    const result = migrateYamlToJsx(componentYaml)
    expect(result.success).toBe(true)
    expect(result.jsx).toContain('<Col gap="md"')
    expect(result.jsx).toContain('<Row gap="sm"')
    expect(result.jsx).toContain('<Icon name="star"')
    expect(result.jsx).toContain('&amp;')
    expect(result.jsx).toContain('&lt;')
    expect(result.jsx).toContain('<Spacer size="xl"')
    expect(result.jsx).toContain('<Image src="img.png"')

    const screenYaml = `
kind: screen
id: test
title: Test
states:
  on: {}
  off: {}
template:
  root:
    type: $col
    children:
      slot: $slot(actions)
slots:
  actions:
    on: $text("On")
    off: $text("Off")
`
    const screenResult = migrateYamlToJsx(screenYaml)
    expect(screenResult.success).toBe(true)
    expect(screenResult.jsx).toContain("z.enum(['on', 'off'])")
    expect(screenResult.jsx).toContain('<Slot name="actions"')
    expect(screenResult.jsx).toContain('const slots = {')

    const propsYaml = `
kind: component
id: x
title: X
props:
  label:
    type: string
    required: true
template:
  root: $text(label)
`
    expect(migrateYamlToJsx(propsYaml).jsx).toContain('{props.label}')
    expect(migrateYamlToJsx('invalid: [yaml').success).toBe(false)
    expect(migrateYamlToJsx('kind: x\nid: x\ntitle: X').errors).toContain('No template.root found in config')
  })
})
