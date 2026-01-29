// src/vite/previews.test.ts
import { test, expect, beforeAll, afterAll } from 'bun:test'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { scanPreviews } from './previews'

const testDir = '/tmp/prev-cli-test-previews'

beforeAll(() => {
  // Create test structure
  mkdirSync(join(testDir, 'previews/button'), { recursive: true })
  mkdirSync(join(testDir, 'previews/card/variants'), { recursive: true })
  writeFileSync(join(testDir, 'previews/button/index.html'), '<html></html>')
  writeFileSync(join(testDir, 'previews/card/index.html'), '<html></html>')
  writeFileSync(join(testDir, 'previews/card/variants/index.html'), '<html></html>')
  // This should NOT be picked up (no index.html)
  mkdirSync(join(testDir, 'previews/empty'), { recursive: true })
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

test('scanPreviews finds directories with index.html', async () => {
  const previews = await scanPreviews(testDir)

  expect(previews).toHaveLength(3)
  expect(previews.map(p => p.name).sort()).toEqual(['button', 'card', 'card/variants'])
})

test('scanPreviews returns correct routes', async () => {
  const previews = await scanPreviews(testDir)

  const button = previews.find(p => p.name === 'button')
  expect(button?.route).toBe('/_preview/button')

  const nested = previews.find(p => p.name === 'card/variants')
  expect(nested?.route).toBe('/_preview/card/variants')
})

test('scanPreviews returns empty array when no previews folder', async () => {
  const previews = await scanPreviews('/tmp/nonexistent-dir')
  expect(previews).toEqual([])
})

// ============================================================
// Tests for scanPreviewUnits (multi-type support)
// ============================================================
import { scanPreviewUnits } from './previews'

const multiTypeDir = '/tmp/prev-cli-test-multi-type'

beforeAll(() => {
  // Create multi-type structure
  mkdirSync(join(multiTypeDir, 'previews/components/button'), { recursive: true })
  mkdirSync(join(multiTypeDir, 'previews/screens/login'), { recursive: true })
  mkdirSync(join(multiTypeDir, 'previews/flows/onboarding'), { recursive: true })
  mkdirSync(join(multiTypeDir, 'previews/atlas/app'), { recursive: true })

  // Component with schema
  writeFileSync(join(multiTypeDir, 'previews/components/button/index.tsx'), 'export default () => null')
  writeFileSync(join(multiTypeDir, 'previews/components/button/schema.ts'), 'export const schema = {}')
  writeFileSync(join(multiTypeDir, 'previews/components/button/config.yaml'), 'title: Button\ntags: [core]\nstatus: stable')

  // Screen with states
  writeFileSync(join(multiTypeDir, 'previews/screens/login/index.tsx'), 'export default () => null')
  writeFileSync(join(multiTypeDir, 'previews/screens/login/error.tsx'), 'export default () => null')
  writeFileSync(join(multiTypeDir, 'previews/screens/login/loading.tsx'), 'export default () => null')
  writeFileSync(join(multiTypeDir, 'previews/screens/login/config.yaml'), 'title: Login Screen\nstatus: stable')

  // Flow
  writeFileSync(join(multiTypeDir, 'previews/flows/onboarding/index.yaml'), 'name: Onboarding\nsteps: []')
  writeFileSync(join(multiTypeDir, 'previews/flows/onboarding/config.yaml'), 'title: Onboarding Flow\nstatus: stable')

  // Atlas
  writeFileSync(join(multiTypeDir, 'previews/atlas/app/index.yaml'), 'name: App\nhierarchy:\n  root: home\n  areas:\n    home:\n      title: Home')
  writeFileSync(join(multiTypeDir, 'previews/atlas/app/config.yaml'), 'title: App Atlas\nstatus: stable')
})

afterAll(() => {
  rmSync(multiTypeDir, { recursive: true, force: true })
})

test('scanPreviewUnits detects content types from folder structure', async () => {
  const units = await scanPreviewUnits(multiTypeDir)

  expect(units).toHaveLength(4)

  const button = units.find(u => u.name === 'button')
  expect(button?.type).toBe('component')
  expect(button?.files.schema).toBe('schema.ts')

  const login = units.find(u => u.name === 'login')
  expect(login?.type).toBe('screen')
  expect(login?.files.states).toEqual(['error.tsx', 'loading.tsx'])

  const onboarding = units.find(u => u.name === 'onboarding')
  expect(onboarding?.type).toBe('flow')

  const app = units.find(u => u.name === 'app')
  expect(app?.type).toBe('atlas')
})

test('scanPreviewUnits parses config.yaml', async () => {
  const units = await scanPreviewUnits(multiTypeDir)

  const button = units.find(u => u.name === 'button')
  expect(button?.config?.tags).toEqual(['core'])
  expect(button?.config?.status).toBe('stable')
})

test('scanPreviewUnits generates correct routes per type', async () => {
  const units = await scanPreviewUnits(multiTypeDir)

  const button = units.find(u => u.name === 'button')
  expect(button?.route).toBe('/_preview/components/button')

  const login = units.find(u => u.name === 'login')
  expect(login?.route).toBe('/_preview/screens/login')
})
