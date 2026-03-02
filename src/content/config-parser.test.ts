// src/content/config-parser.test.ts
import { test, expect, describe, beforeAll } from 'bun:test'
import { join } from 'path'
import { parsePreviewConfig, parseFlowConfig, parseFlowDefinition } from './config-parser'
import { useTempDirPerSuite, writeFiles } from '../../test/utils'

const getTempDir = useTempDirPerSuite('prev-config-parser-test-')

beforeAll(async () => {
  await writeFiles(getTempDir(), {
    'valid.yaml': 'tags: [core]\ncategory: inputs\nstatus: stable\ntitle: Button',
    'invalid.yaml': 'status: unknown',
    'flow.yaml': 'name: Onboarding\nsteps:\n  - screen: login\n  - screen: dashboard',
    // Flow configs with regions
    'flow-regions-simple.yaml': [
      'title: Signup Flow',
      'steps:',
      '  - id: step1',
      '    screen: signup',
      '    regions:',
      '      submit:',
      '        goto: step2',
      '  - id: step2',
      '    screen: dashboard',
      '    terminal: true',
    ].join('\n'),
    'flow-regions-outcomes.yaml': [
      'title: Decision Flow',
      'steps:',
      '  - id: step1',
      '    screen: pricing',
      '    regions:',
      '      upgrade-btn:',
      '        outcomes:',
      '          success:',
      '            goto: thanks',
      '            label: Payment accepted',
      '          failure:',
      '            goto: retry',
      '  - id: thanks',
      '    screen: upgrade-success',
      '    terminal: true',
      '  - id: retry',
      '    screen: pricing',
    ].join('\n'),
    'flow-terminal.yaml': [
      'title: Terminal Flow',
      'steps:',
      '  - id: final',
      '    screen: dashboard',
      '    terminal: true',
    ].join('\n'),
    'flow-invalid-region.yaml': [
      'title: Bad Regions',
      'steps:',
      '  - id: step1',
      '    screen: signup',
      '    regions:',
      '      "Invalid Name":',
      '        goto: step2',
    ].join('\n'),
    'flow-no-regions.yaml': [
      'title: Legacy Flow',
      'steps:',
      '  - id: step1',
      '    screen: signup',
      '  - id: step2',
      '    screen: dashboard',
    ].join('\n'),
  })
})

test('parsePreviewConfig parses valid config', async () => {
  const result = await parsePreviewConfig(join(getTempDir(), 'valid.yaml'))
  expect(result.errors).toHaveLength(0)
  expect(result.data?.tags).toEqual(['core'])
  expect(result.data?.status).toBe('stable')
})

test('parsePreviewConfig returns errors for invalid or missing files', async () => {
  const invalid = await parsePreviewConfig(join(getTempDir(), 'invalid.yaml'))
  expect(invalid.errors.length).toBeGreaterThan(0)

  const missing = await parsePreviewConfig(join(getTempDir(), 'nonexistent.yaml'))
  expect(missing.errors.length).toBeGreaterThan(0)
})

test('parseFlowDefinition parses flow config', async () => {
  const flow = await parseFlowDefinition(join(getTempDir(), 'flow.yaml'))
  expect(flow?.name).toBe('Onboarding')
  expect(flow?.steps).toHaveLength(2)
})

// --- Cycle 1.2: Zod schema for regions/outcomes ---

describe('parseFlowConfig with regions', () => {
  test('simple regions with goto', async () => {
    const result = await parseFlowConfig(join(getTempDir(), 'flow-regions-simple.yaml'))
    expect(result.errors).toHaveLength(0)
    expect(result.data).toBeTruthy()
    const steps = result.data!.steps!
    expect(steps[0].regions).toEqual({ submit: { goto: 'step2' } })
    expect(steps[1].terminal).toBe(true)
  })

  test('outcomes with goto and label', async () => {
    const result = await parseFlowConfig(join(getTempDir(), 'flow-regions-outcomes.yaml'))
    expect(result.errors).toHaveLength(0)
    const step = result.data!.steps![0]
    expect(step.regions!['upgrade-btn']).toEqual({
      outcomes: {
        success: { goto: 'thanks', label: 'Payment accepted' },
        failure: { goto: 'retry' },
      },
    })
  })

  test('terminal step without regions', async () => {
    const result = await parseFlowConfig(join(getTempDir(), 'flow-terminal.yaml'))
    expect(result.errors).toHaveLength(0)
    expect(result.data!.steps![0].terminal).toBe(true)
  })

  test('invalid region name (spaces/caps) rejects', async () => {
    const result = await parseFlowConfig(join(getTempDir(), 'flow-invalid-region.yaml'))
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('flow without regions is valid (backward compat)', async () => {
    const result = await parseFlowConfig(join(getTempDir(), 'flow-no-regions.yaml'))
    expect(result.errors).toHaveLength(0)
    expect(result.data!.steps![0].regions).toBeUndefined()
  })
})
