// src/content/previews.test.ts
import { test, expect, beforeAll } from 'bun:test'
import { scanPreviewUnits } from './previews'
import { useTempDirPerSuite, writeFiles } from '../../test/utils'

const getTempDir = useTempDirPerSuite('prev-previews-test-')

beforeAll(async () => {
  await writeFiles(getTempDir(), {
    'previews/components/button/index.tsx': 'export default () => null',
    'previews/components/button/schema.ts': 'export const schema = {}',
    'previews/components/button/config.yaml': 'title: Button\ntags: [core]\nstatus: stable',
    'previews/screens/login/index.tsx': 'export default () => null',
    'previews/screens/login/error.tsx': 'export default () => null',
    'previews/screens/login/config.yaml': 'title: Login\nstatus: stable',
    'previews/flows/onboarding/index.yaml': 'name: Onboarding\nsteps: []',
    'previews/flows/onboarding/config.yaml': 'title: Onboarding\nstatus: stable',
  })
})

test('returns empty for nonexistent directory', async () => {
  expect(await scanPreviewUnits('/tmp/nonexistent')).toEqual([])
})

test('scans all preview types with config and routes', async () => {
  const units = await scanPreviewUnits(getTempDir())
  expect(units).toHaveLength(3)

  // Component: type, schema, config, route
  const button = units.find(u => u.name === 'button')!
  expect(button.type).toBe('component')
  expect(button.files.schema).toBe('schema.ts')
  expect(button.config?.tags).toEqual(['core'])
  expect(button.route).toBe('/_preview/components/button')

  // Screen: type, states, route
  const login = units.find(u => u.name === 'login')!
  expect(login.type).toBe('screen')
  expect(login.files.states).toEqual(['error.tsx'])
  expect(login.route).toBe('/_preview/screens/login')

  // Flow: type detection
  expect(units.find(u => u.name === 'onboarding')?.type).toBe('flow')
})
