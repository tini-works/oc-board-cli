// src/vite/config-parser.test.ts
import { test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { parsePreviewConfig, parseFlowDefinition, parseAtlasDefinition } from './config-parser'

const testDir = '/tmp/prev-cli-test-config-parser'

beforeAll(() => {
  mkdirSync(testDir, { recursive: true })

  // Valid config.yaml
  writeFileSync(join(testDir, 'valid-config.yaml'), `
tags: [core, interactive]
category: inputs
status: stable
title: "Button"
description: "Primary button component"
order: 1
`)

  // Invalid config.yaml (wrong status)
  writeFileSync(join(testDir, 'invalid-config.yaml'), `
status: unknown
`)

  // Flow definition
  writeFileSync(join(testDir, 'flow.yaml'), `
name: Onboarding
description: User onboarding flow
steps:
  - screen: login
    state: default
    note: User arrives at login
  - screen: dashboard
    note: After login
`)

  // Atlas definition
  writeFileSync(join(testDir, 'atlas.yaml'), `
name: Main App
hierarchy:
  root: home
  areas:
    home:
      title: Home
      children: [dashboard]
    dashboard:
      title: Dashboard
      parent: home
`)

  // Valid config.yml (alternate extension)
  writeFileSync(join(testDir, 'valid-config.yml'), `
title: "Alternate Test"
tags: [alternate]
category: forms
status: draft
`)
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

test('parsePreviewConfig parses valid config.yaml', async () => {
  const result = await parsePreviewConfig(join(testDir, 'valid-config.yaml'))

  expect(result.data).not.toBeNull()
  expect(result.errors).toHaveLength(0)
  expect(result.data?.tags).toEqual(['core', 'interactive'])
  expect(result.data?.category).toBe('inputs')
  expect(result.data?.status).toBe('stable')
})

test('parsePreviewConfig parses valid config.yml (alternate extension)', async () => {
  const result = await parsePreviewConfig(join(testDir, 'valid-config.yml'))

  expect(result.data).not.toBeNull()
  expect(result.errors).toHaveLength(0)
  expect(result.data?.tags).toEqual(['alternate'])
  expect(result.data?.category).toBe('forms')
  expect(result.data?.status).toBe('draft')
})

test('parsePreviewConfig returns errors for invalid config', async () => {
  const result = await parsePreviewConfig(join(testDir, 'invalid-config.yaml'))
  expect(result.data).toBeNull()
  expect(result.errors.length).toBeGreaterThan(0)
})

test('parsePreviewConfig returns errors for missing file', async () => {
  const result = await parsePreviewConfig(join(testDir, 'nonexistent.yaml'))
  expect(result.data).toBeNull()
  expect(result.errors.length).toBeGreaterThan(0)
})

test('parseFlowDefinition parses flow.yaml', async () => {
  const flow = await parseFlowDefinition(join(testDir, 'flow.yaml'))

  expect(flow).not.toBeNull()
  expect(flow?.name).toBe('Onboarding')
  expect(flow?.steps).toHaveLength(2)
  expect(flow?.steps[0].screen).toBe('login')
})

test('parseAtlasDefinition parses atlas.yaml', async () => {
  const atlas = await parseAtlasDefinition(join(testDir, 'atlas.yaml'))

  expect(atlas).not.toBeNull()
  expect(atlas?.name).toBe('Main App')
  expect(atlas?.hierarchy.root).toBe('home')
  expect(atlas?.hierarchy.areas.home.title).toBe('Home')
})
