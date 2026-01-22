# JSON-Render Preview System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend prev-cli's preview system to support four content types (Components, Screens, Flows, Atlas) with type-specific preview shells, config.yaml metadata, and filtering.

**Architecture:** Refactor the existing flat `previews/` scanner to recognize top-level type folders (`components/`, `screens/`, `flows/`, `atlas/`). Each type gets its own preview shell component. Config.yaml provides tags/metadata for filtering.

**Tech Stack:** Vite, React, fast-glob, js-yaml, Zod (validation)

---

## Task 1: Define Type System and Interfaces

**Files:**
- Create: `src/vite/preview-types.ts`

**Step 1: Write the type definitions**

```typescript
// src/vite/preview-types.ts
import { z } from 'zod'

// Preview content types
export type PreviewType = 'component' | 'screen' | 'flow' | 'atlas'

// Config.yaml schema
export const configSchema = z.object({
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  status: z.enum(['draft', 'stable', 'deprecated']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  order: z.number().optional(),
})

export type PreviewConfig = z.infer<typeof configSchema>

// Extended preview unit with type awareness
export interface PreviewUnit {
  type: PreviewType
  name: string
  path: string
  route: string
  config: PreviewConfig | null
  files: {
    index: string           // Main entry file
    states?: string[]       // For screens: additional state files
    schema?: string         // For components: schema.ts
    docs?: string           // docs.mdx if present
  }
}

// Flow step definition (from index.yaml)
export interface FlowStep {
  screen: string
  state?: string
  note?: string
  trigger?: string
  highlight?: string[]
}

// Flow definition
export interface FlowDefinition {
  name: string
  description?: string
  steps: FlowStep[]
}

// Atlas area definition
export interface AtlasArea {
  title: string
  description?: string
  parent?: string
  children?: string[]
  access?: string
}

// Atlas definition (from index.yaml)
export interface AtlasDefinition {
  name: string
  description?: string
  hierarchy: {
    root: string
    areas: Record<string, AtlasArea>
  }
  routes?: Record<string, { area: string; screen: string; guard?: string }>
  navigation?: Record<string, Array<{ area?: string; icon?: string; action?: string }>>
  relationships?: Array<{ from: string; to: string; type: string }>
}
```

**Step 2: Commit**

```bash
git add src/vite/preview-types.ts
git commit -m "feat: add type definitions for multi-type preview system"
```

---

## Task 2: Add YAML Config Parser

**Files:**
- Create: `src/vite/config-parser.ts`
- Test: `src/vite/config-parser.test.ts`

**Step 1: Write the failing test**

```typescript
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
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

test('parsePreviewConfig parses valid config.yaml', async () => {
  const config = await parsePreviewConfig(join(testDir, 'valid-config.yaml'))

  expect(config).not.toBeNull()
  expect(config?.tags).toEqual(['core', 'interactive'])
  expect(config?.category).toBe('inputs')
  expect(config?.status).toBe('stable')
})

test('parsePreviewConfig returns null for invalid config', async () => {
  const config = await parsePreviewConfig(join(testDir, 'invalid-config.yaml'))
  expect(config).toBeNull()
})

test('parsePreviewConfig returns null for missing file', async () => {
  const config = await parsePreviewConfig(join(testDir, 'nonexistent.yaml'))
  expect(config).toBeNull()
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
```

**Step 2: Run test to verify it fails**

Run: `bun test src/vite/config-parser.test.ts`
Expected: FAIL with "Cannot find module './config-parser'"

**Step 3: Write minimal implementation**

```typescript
// src/vite/config-parser.ts
import { existsSync, readFileSync } from 'fs'
import yaml from 'js-yaml'
import { configSchema, type PreviewConfig, type FlowDefinition, type AtlasDefinition } from './preview-types'

/**
 * Parse a config.yaml file and validate against schema
 */
export async function parsePreviewConfig(filePath: string): Promise<PreviewConfig | null> {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = yaml.load(content)
    const result = configSchema.safeParse(parsed)

    if (result.success) {
      return result.data
    }

    console.warn(`Invalid config at ${filePath}:`, result.error.message)
    return null
  } catch (err) {
    console.warn(`Error parsing config at ${filePath}:`, err)
    return null
  }
}

/**
 * Parse a flow index.yaml file
 */
export async function parseFlowDefinition(filePath: string): Promise<FlowDefinition | null> {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = yaml.load(content) as FlowDefinition

    // Basic validation
    if (!parsed.name || !Array.isArray(parsed.steps)) {
      return null
    }

    return parsed
  } catch (err) {
    console.warn(`Error parsing flow at ${filePath}:`, err)
    return null
  }
}

/**
 * Parse an atlas index.yaml file
 */
export async function parseAtlasDefinition(filePath: string): Promise<AtlasDefinition | null> {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    const parsed = yaml.load(content) as AtlasDefinition

    // Basic validation
    if (!parsed.name || !parsed.hierarchy?.root || !parsed.hierarchy?.areas) {
      return null
    }

    return parsed
  } catch (err) {
    console.warn(`Error parsing atlas at ${filePath}:`, err)
    return null
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test src/vite/config-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/vite/config-parser.ts src/vite/config-parser.test.ts
git commit -m "feat: add YAML config parser with validation"
```

---

## Task 3: Refactor Scanner for Multi-Type Support

**Files:**
- Modify: `src/vite/previews.ts`
- Modify: `src/vite/previews.test.ts`

**Step 1: Write new failing tests**

Add to `src/vite/previews.test.ts`:

```typescript
// Add these tests after existing tests

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
  writeFileSync(join(multiTypeDir, 'previews/components/button/config.yaml'), 'tags: [core]\nstatus: stable')

  // Screen with states
  writeFileSync(join(multiTypeDir, 'previews/screens/login/index.tsx'), 'export default () => null')
  writeFileSync(join(multiTypeDir, 'previews/screens/login/error.tsx'), 'export default () => null')
  writeFileSync(join(multiTypeDir, 'previews/screens/login/loading.tsx'), 'export default () => null')

  // Flow
  writeFileSync(join(multiTypeDir, 'previews/flows/onboarding/index.yaml'), 'name: Onboarding\nsteps: []')

  // Atlas
  writeFileSync(join(multiTypeDir, 'previews/atlas/app/index.yaml'), 'name: App\nhierarchy:\n  root: home\n  areas:\n    home:\n      title: Home')
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
```

**Step 2: Run test to verify it fails**

Run: `bun test src/vite/previews.test.ts`
Expected: FAIL with "scanPreviewUnits is not defined"

**Step 3: Add new scanPreviewUnits function**

Add to `src/vite/previews.ts`:

```typescript
import type { PreviewUnit, PreviewType } from './preview-types'
import { parsePreviewConfig } from './config-parser'

const PREVIEW_TYPES: PreviewType[] = ['components', 'screens', 'flows', 'atlas'] as any
const TYPE_MAP: Record<string, PreviewType> = {
  components: 'component',
  screens: 'screen',
  flows: 'flow',
  atlas: 'atlas',
}

/**
 * Scan previews with multi-type folder structure support
 */
export async function scanPreviewUnits(rootDir: string): Promise<PreviewUnit[]> {
  const previewsDir = path.join(rootDir, 'previews')

  if (!existsSync(previewsDir)) {
    return []
  }

  const units: PreviewUnit[] = []

  for (const typeFolder of PREVIEW_TYPES) {
    const typeDir = path.join(previewsDir, typeFolder)
    if (!existsSync(typeDir)) continue

    const type = TYPE_MAP[typeFolder]

    // Get immediate subdirectories (each is a preview unit)
    const entries = await fg.glob('*/', {
      cwd: typeDir,
      onlyDirectories: true,
      deep: 1
    })

    for (const entry of entries) {
      const name = entry.replace(/\/$/, '')
      const unitDir = path.join(typeDir, name)

      // Detect files
      const files = await detectUnitFiles(unitDir, type)
      if (!files.index) continue // Skip if no index file

      // Parse config.yaml if present
      const configPath = path.join(unitDir, 'config.yaml')
      const config = await parsePreviewConfig(configPath)

      units.push({
        type,
        name,
        path: unitDir,
        route: `/_preview/${typeFolder}/${name}`,
        config,
        files,
      })
    }
  }

  return units
}

/**
 * Detect files in a preview unit directory
 */
async function detectUnitFiles(
  unitDir: string,
  type: PreviewType
): Promise<PreviewUnit['files']> {
  const allFiles = await fg.glob('*', { cwd: unitDir })

  // Find index file based on type
  let index: string | undefined

  if (type === 'flow' || type === 'atlas') {
    index = allFiles.find(f => f === 'index.yaml' || f === 'index.yml')
  } else {
    // Component or Screen - look for TSX/JSX
    const priorities = ['index.tsx', 'index.jsx', 'App.tsx', 'App.jsx', 'index.html']
    index = priorities.find(p => allFiles.includes(p))
  }

  const result: PreviewUnit['files'] = {
    index: index || '',
  }

  // For screens: find state files (any .tsx that isn't index)
  if (type === 'screen') {
    const stateFiles = allFiles.filter(f =>
      (f.endsWith('.tsx') || f.endsWith('.jsx')) &&
      !f.startsWith('index.')
    )
    if (stateFiles.length > 0) {
      result.states = stateFiles
    }
  }

  // For components: find schema.ts
  if (type === 'component') {
    if (allFiles.includes('schema.ts')) {
      result.schema = 'schema.ts'
    }
  }

  // Find docs.mdx if present
  if (allFiles.includes('docs.mdx') || allFiles.includes('README.mdx')) {
    result.docs = allFiles.find(f => f.endsWith('.mdx'))
  }

  return result
}

// Re-export for backwards compatibility
export { scanPreviews }
```

**Step 4: Run test to verify it passes**

Run: `bun test src/vite/previews.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/vite/previews.ts src/vite/previews.test.ts
git commit -m "feat: add multi-type preview scanner with config parsing"
```

---

## Task 4: Update Virtual Module for Filtering

**Files:**
- Modify: `src/vite/plugins/previews-plugin.ts`

**Step 1: Update the virtual module to expose filtering functions**

```typescript
// src/vite/plugins/previews-plugin.ts
import type { Plugin } from 'vite'
import { scanPreviews, scanPreviewUnits, buildPreviewConfig } from '../previews'
import { buildPreviewHtml } from '../../preview-runtime/build'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import path from 'path'

const VIRTUAL_MODULE_ID = 'virtual:prev-previews'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

export function previewsPlugin(rootDir: string): Plugin {
  let isBuild = false

  return {
    name: 'prev-previews',

    config(_, { command }) {
      isBuild = command === 'build'
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },

    async load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        // Use new multi-type scanner
        const units = await scanPreviewUnits(rootDir)

        // Also get legacy flat previews for backwards compatibility
        const legacyPreviews = await scanPreviews(rootDir)

        return `
// Multi-type preview units
export const previewUnits = ${JSON.stringify(units)};

// Legacy flat previews (backwards compatibility)
export const previews = ${JSON.stringify(legacyPreviews)};

// Filtering helpers
export function getByType(type) {
  return previewUnits.filter(u => u.type === type);
}

export function getByTags(tags) {
  return previewUnits.filter(u =>
    u.config?.tags?.some(t => tags.includes(t))
  );
}

export function getByCategory(category) {
  return previewUnits.filter(u => u.config?.category === category);
}

export function getByStatus(status) {
  return previewUnits.filter(u => u.config?.status === status);
}
`
      }
    },

    handleHotUpdate({ file, server }) {
      // Invalidate when preview files change
      if (file.includes('/previews/') &&
          /\.(html|tsx|ts|jsx|js|css|yaml|yml|mdx)$/.test(file)) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          return [mod]
        }
      }
    },

    // Build remains the same for now
    async closeBundle() {
      if (!isBuild) return
      // ... existing build logic ...
    }
  }
}
```

**Step 2: Update TypeScript declarations**

Add to `src/types/virtual.d.ts`:

```typescript
declare module 'virtual:prev-previews' {
  import type { PreviewUnit } from '../vite/preview-types'
  import type { Preview } from '../vite/previews'

  export const previewUnits: PreviewUnit[]
  export const previews: Preview[]

  export function getByType(type: string): PreviewUnit[]
  export function getByTags(tags: string[]): PreviewUnit[]
  export function getByCategory(category: string): PreviewUnit[]
  export function getByStatus(status: string): PreviewUnit[]
}
```

**Step 3: Commit**

```bash
git add src/vite/plugins/previews-plugin.ts src/types/virtual.d.ts
git commit -m "feat: update virtual module with filtering API"
```

---

## Task 5: Create Component Preview Shell

**Files:**
- Create: `src/theme/previews/ComponentPreview.tsx`

**Step 1: Write the component**

```typescript
// src/theme/previews/ComponentPreview.tsx
import React, { useState, useEffect } from 'react'
import type { PreviewUnit } from '../../vite/preview-types'

interface ComponentPreviewProps {
  unit: PreviewUnit
}

export function ComponentPreview({ unit }: ComponentPreviewProps) {
  const [props, setProps] = useState<Record<string, any>>({})
  const [schema, setSchema] = useState<any>(null)

  // Load schema if available
  useEffect(() => {
    if (unit.files.schema) {
      import(`/_preview/components/${unit.name}/${unit.files.schema}`)
        .then(mod => setSchema(mod.schema))
        .catch(() => {})
    }
  }, [unit])

  const iframeUrl = `/_preview-runtime?preview=components/${unit.name}`

  return (
    <div className="component-preview">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 border-b">
        <div>
          <h2 className="text-lg font-semibold">{unit.config?.title || unit.name}</h2>
          {unit.config?.description && (
            <p className="text-sm text-muted-foreground">{unit.config.description}</p>
          )}
        </div>
        {unit.config?.status && (
          <span className={`px-2 py-1 text-xs rounded ${
            unit.config.status === 'stable' ? 'bg-green-100 text-green-800' :
            unit.config.status === 'deprecated' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {unit.config.status}
          </span>
        )}
      </div>

      {/* Preview area */}
      <div className="p-6 flex items-center justify-center min-h-[200px] bg-white dark:bg-stone-900">
        <iframe
          src={iframeUrl}
          className="border-0 w-full h-full min-h-[200px]"
          title={`Preview: ${unit.name}`}
        />
      </div>

      {/* Props panel */}
      {schema && (
        <div className="p-4 border-t bg-stone-50 dark:bg-stone-800">
          <h3 className="text-sm font-medium mb-2">Props</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* TODO: Generate controls from schema */}
            <pre className="text-xs bg-stone-100 dark:bg-stone-700 p-2 rounded">
              {JSON.stringify(props, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Tags */}
      {unit.config?.tags && unit.config.tags.length > 0 && (
        <div className="p-3 border-t flex gap-2">
          {unit.config.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 text-xs bg-stone-200 dark:bg-stone-700 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/theme/previews/ComponentPreview.tsx
git commit -m "feat: add ComponentPreview shell with props panel"
```

---

## Task 6: Create Screen Preview Shell

**Files:**
- Create: `src/theme/previews/ScreenPreview.tsx`

**Step 1: Write the component**

```typescript
// src/theme/previews/ScreenPreview.tsx
import React, { useState } from 'react'
import type { PreviewUnit } from '../../vite/preview-types'

interface ScreenPreviewProps {
  unit: PreviewUnit
  initialState?: string
}

type Viewport = 'mobile' | 'tablet' | 'desktop'

const viewports: Record<Viewport, { width: number; label: string }> = {
  mobile: { width: 375, label: '📱' },
  tablet: { width: 768, label: '💻' },
  desktop: { width: 1280, label: '🖥' },
}

export function ScreenPreview({ unit, initialState }: ScreenPreviewProps) {
  const states = ['index', ...(unit.files.states || []).map(s => s.replace(/\.(tsx|jsx)$/, ''))]
  const [activeState, setActiveState] = useState(initialState || 'index')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const iframeUrl = `/_preview-runtime?preview=screens/${unit.name}&state=${activeState}`

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-stone-900">
        <div className="flex items-center justify-between p-2 border-b">
          <span className="font-medium">{unit.name} / {activeState}</span>
          <button
            onClick={() => setIsFullscreen(false)}
            className="p-2 hover:bg-stone-100 rounded"
          >
            ✕
          </button>
        </div>
        <iframe
          src={iframeUrl}
          className="w-full h-[calc(100vh-49px)] border-0"
          title={`Screen: ${unit.name}`}
        />
      </div>
    )
  }

  return (
    <div className="screen-preview">
      {/* Header with state tabs */}
      <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">{unit.config?.title || unit.name}</h2>

          {/* State tabs */}
          <div className="flex gap-1">
            {states.map(state => (
              <button
                key={state}
                onClick={() => setActiveState(state)}
                className={`px-3 py-1 text-sm rounded ${
                  activeState === state
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                    : 'hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {state === 'index' ? 'default' : state}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsFullscreen(true)}
          className="p-2 hover:bg-stone-200 dark:hover:bg-stone-700 rounded"
          title="Fullscreen"
        >
          ⛶
        </button>
      </div>

      {/* Preview with viewport */}
      <div className="p-6 bg-stone-100 dark:bg-stone-800 flex justify-center overflow-auto">
        <div
          style={{ width: viewports[viewport].width }}
          className="bg-white dark:bg-stone-900 shadow-lg transition-all duration-300"
        >
          <iframe
            src={iframeUrl}
            className="w-full h-[600px] border-0"
            title={`Screen: ${unit.name} - ${activeState}`}
          />
        </div>
      </div>

      {/* Viewport toggle */}
      <div className="flex justify-center gap-2 p-3 border-t bg-stone-50 dark:bg-stone-800">
        {(Object.entries(viewports) as [Viewport, typeof viewports[Viewport]][]).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setViewport(key)}
            className={`p-2 rounded ${
              viewport === key
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                : 'hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
            title={key}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/theme/previews/ScreenPreview.tsx
git commit -m "feat: add ScreenPreview shell with state tabs and viewport toggle"
```

---

## Task 7: Create Flow Preview Shell

**Files:**
- Create: `src/theme/previews/FlowPreview.tsx`

**Step 1: Write the component**

```typescript
// src/theme/previews/FlowPreview.tsx
import React, { useState, useEffect } from 'react'
import type { PreviewUnit, FlowDefinition } from '../../vite/preview-types'

interface FlowPreviewProps {
  unit: PreviewUnit
}

export function FlowPreview({ unit }: FlowPreviewProps) {
  const [flow, setFlow] = useState<FlowDefinition | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)

  // Load flow definition
  useEffect(() => {
    fetch(`/_preview-config/flows/${unit.name}`)
      .then(res => res.json())
      .then(data => {
        setFlow(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [unit.name])

  if (loading) {
    return <div className="p-8 text-center">Loading flow...</div>
  }

  if (!flow) {
    return <div className="p-8 text-center text-red-500">Failed to load flow definition</div>
  }

  const step = flow.steps[currentStep]
  const totalSteps = flow.steps.length

  // Build iframe URL for current step's screen
  const iframeUrl = step
    ? `/_preview-runtime?preview=screens/${step.screen}${step.state ? `&state=${step.state}` : ''}`
    : ''

  return (
    <div className="flow-preview">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 border-b">
        <div>
          <h2 className="text-lg font-semibold">{flow.name}</h2>
          {flow.description && (
            <p className="text-sm text-muted-foreground">{flow.description}</p>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      {/* Preview area */}
      <div className="bg-stone-100 dark:bg-stone-800 p-6">
        <div className="bg-white dark:bg-stone-900 shadow-lg max-w-4xl mx-auto">
          <iframe
            src={iframeUrl}
            className="w-full h-[500px] border-0"
            title={`Flow: ${flow.name} - Step ${currentStep + 1}`}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 border-t bg-stone-50 dark:bg-stone-800">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded disabled:opacity-50 hover:bg-stone-200 dark:hover:bg-stone-700"
          >
            ← Previous
          </button>

          {/* Step dots */}
          <div className="flex gap-2">
            {flow.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-3 h-3 rounded-full ${
                  i === currentStep
                    ? 'bg-stone-900 dark:bg-stone-100'
                    : 'bg-stone-300 dark:bg-stone-600'
                }`}
                title={`Step ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentStep(s => Math.min(totalSteps - 1, s + 1))}
            disabled={currentStep === totalSteps - 1}
            className="px-4 py-2 rounded disabled:opacity-50 hover:bg-stone-200 dark:hover:bg-stone-700"
          >
            Next →
          </button>
        </div>

        {/* Step info */}
        {step && (
          <div className="mt-4 p-3 bg-white dark:bg-stone-900 rounded max-w-4xl mx-auto">
            {step.note && (
              <p className="text-sm">
                <span className="mr-2">📝</span>
                {step.note}
              </p>
            )}
            {step.trigger && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="mr-2">🎯</span>
                Trigger: {step.trigger}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/theme/previews/FlowPreview.tsx
git commit -m "feat: add FlowPreview shell with step navigation"
```

---

## Task 8: Create Atlas Preview Shell

**Files:**
- Create: `src/theme/previews/AtlasPreview.tsx`

**Step 1: Write the component**

```typescript
// src/theme/previews/AtlasPreview.tsx
import React, { useState, useEffect } from 'react'
import type { PreviewUnit, AtlasDefinition } from '../../vite/preview-types'

interface AtlasPreviewProps {
  unit: PreviewUnit
}

type ViewMode = 'map' | 'tree' | 'navigate'

export function AtlasPreview({ unit }: AtlasPreviewProps) {
  const [atlas, setAtlas] = useState<AtlasDefinition | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load atlas definition
  useEffect(() => {
    fetch(`/_preview-config/atlas/${unit.name}`)
      .then(res => res.json())
      .then(data => {
        setAtlas(data)
        setSelectedArea(data.hierarchy?.root || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [unit.name])

  if (loading) {
    return <div className="p-8 text-center">Loading atlas...</div>
  }

  if (!atlas) {
    return <div className="p-8 text-center text-red-500">Failed to load atlas definition</div>
  }

  const areas = atlas.hierarchy.areas

  // Render tree view recursively
  const renderTree = (areaId: string, depth = 0): React.ReactNode => {
    const area = areas[areaId]
    if (!area) return null

    const isSelected = selectedArea === areaId
    const hasChildren = area.children && area.children.length > 0

    return (
      <div key={areaId} style={{ marginLeft: depth * 16 }}>
        <button
          onClick={() => setSelectedArea(areaId)}
          className={`flex items-center gap-2 w-full text-left p-2 rounded ${
            isSelected ? 'bg-stone-200 dark:bg-stone-700' : 'hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <span>{hasChildren ? '▼' : '▶'}</span>
          <span className="font-medium">{area.title}</span>
          {area.access && <span className="text-xs">🔒</span>}
        </button>
        {area.description && isSelected && (
          <p className="text-sm text-muted-foreground ml-8 mb-2">{area.description}</p>
        )}
        {hasChildren && area.children?.map(childId => renderTree(childId, depth + 1))}
      </div>
    )
  }

  return (
    <div className="atlas-preview">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800 border-b">
        <div>
          <h2 className="text-lg font-semibold">{atlas.name}</h2>
          {atlas.description && (
            <p className="text-sm text-muted-foreground">{atlas.description}</p>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1">
          {(['map', 'tree', 'navigate'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-sm rounded capitalize ${
                viewMode === mode
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on view mode */}
      <div className="p-4">
        {viewMode === 'tree' && (
          <div className="max-w-2xl">
            {renderTree(atlas.hierarchy.root)}
          </div>
        )}

        {viewMode === 'map' && (
          <div className="text-center text-muted-foreground p-8">
            <p>Map view coming soon</p>
            <p className="text-sm">Will render as D2/Mermaid diagram</p>
          </div>
        )}

        {viewMode === 'navigate' && selectedArea && (
          <div className="grid grid-cols-[200px_1fr] gap-4">
            {/* Navigation sidebar */}
            <div className="space-y-1">
              {Object.entries(areas).map(([id, area]) => (
                <button
                  key={id}
                  onClick={() => setSelectedArea(id)}
                  className={`w-full text-left p-2 rounded text-sm ${
                    selectedArea === id
                      ? 'bg-stone-200 dark:bg-stone-700'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {area.title}
                </button>
              ))}
            </div>

            {/* Screen preview */}
            <div className="bg-white dark:bg-stone-900 shadow rounded">
              <div className="p-3 border-b text-sm text-muted-foreground">
                📍 {areas[selectedArea]?.title}
              </div>
              <div className="p-4 text-center text-muted-foreground">
                <p>Screen preview will render here</p>
                <p className="text-sm">Connect to screens/{selectedArea}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Relationships (if any) */}
      {atlas.relationships && atlas.relationships.length > 0 && (
        <div className="p-4 border-t">
          <h3 className="text-sm font-medium mb-2">Relationships</h3>
          <div className="space-y-1 text-sm">
            {atlas.relationships.map((rel, i) => (
              <div key={i} className="text-muted-foreground">
                {areas[rel.from]?.title} → {areas[rel.to]?.title}: {rel.type}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/theme/previews/AtlasPreview.tsx
git commit -m "feat: add AtlasPreview shell with tree and navigate views"
```

---

## Task 9: Create Preview Router

**Files:**
- Create: `src/theme/previews/PreviewRouter.tsx`
- Create: `src/theme/previews/index.ts`

**Step 1: Write the router component**

```typescript
// src/theme/previews/PreviewRouter.tsx
import React from 'react'
import { useParams, useSearchParams } from '@tanstack/react-router'
import { previewUnits, getByType } from 'virtual:prev-previews'
import { ComponentPreview } from './ComponentPreview'
import { ScreenPreview } from './ScreenPreview'
import { FlowPreview } from './FlowPreview'
import { AtlasPreview } from './AtlasPreview'
import type { PreviewUnit } from '../../vite/preview-types'

interface PreviewRouterProps {
  type: string
  name: string
}

export function PreviewRouter({ type, name }: PreviewRouterProps) {
  const unit = previewUnits.find(u => u.type === type && u.name === name)

  if (!unit) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-2">Preview not found</h2>
        <p className="text-muted-foreground">
          No {type} named "{name}" found in previews/{type}s/{name}/
        </p>
      </div>
    )
  }

  switch (unit.type) {
    case 'component':
      return <ComponentPreview unit={unit} />
    case 'screen':
      return <ScreenPreview unit={unit} />
    case 'flow':
      return <FlowPreview unit={unit} />
    case 'atlas':
      return <AtlasPreview unit={unit} />
    default:
      return <div>Unknown preview type: {unit.type}</div>
  }
}

// Preview list component for browsing
export function PreviewList({ type }: { type?: string }) {
  const units = type ? getByType(type) : previewUnits

  const grouped = units.reduce((acc, unit) => {
    const key = unit.type
    if (!acc[key]) acc[key] = []
    acc[key].push(unit)
    return acc
  }, {} as Record<string, PreviewUnit[]>)

  return (
    <div className="p-6 space-y-8">
      {Object.entries(grouped).map(([type, units]) => (
        <div key={type}>
          <h2 className="text-xl font-semibold mb-4 capitalize">{type}s</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {units.map(unit => (
              <a
                key={unit.route}
                href={unit.route}
                className="block p-4 border rounded-lg hover:border-stone-400 transition-colors"
              >
                <h3 className="font-medium">{unit.config?.title || unit.name}</h3>
                {unit.config?.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {unit.config.description}
                  </p>
                )}
                {unit.config?.tags && (
                  <div className="flex gap-1 mt-2">
                    {unit.config.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2 py-0.5 text-xs bg-stone-100 dark:bg-stone-800 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Create index export**

```typescript
// src/theme/previews/index.ts
export { ComponentPreview } from './ComponentPreview'
export { ScreenPreview } from './ScreenPreview'
export { FlowPreview } from './FlowPreview'
export { AtlasPreview } from './AtlasPreview'
export { PreviewRouter, PreviewList } from './PreviewRouter'
```

**Step 3: Commit**

```bash
git add src/theme/previews/PreviewRouter.tsx src/theme/previews/index.ts
git commit -m "feat: add PreviewRouter for type-specific rendering"
```

---

## Task 10: Add Route Handling for Multi-Type Previews

**Files:**
- Modify: `src/vite/config.ts`

**Step 1: Update the preview server middleware**

In `src/vite/config.ts`, update the `prev-preview-server` plugin's `configureServer`:

```typescript
// Add to the existing configureServer handler, before the existing preview handling:

// Serve flow/atlas config as JSON
if (urlPath.startsWith('/_preview-config/')) {
  const [, typeAndName] = urlPath.match(/\/_preview-config\/(.+)/) || []
  if (typeAndName) {
    const [type, ...nameParts] = typeAndName.split('/')
    const name = nameParts.join('/')
    const configPath = path.join(rootDir, 'previews', `${type}s`, name, 'index.yaml')

    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8')
        const yaml = await import('js-yaml')
        const data = yaml.load(content)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(data))
        return
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: String(err) }))
        return
      }
    }
  }
}

// Handle multi-type preview routes: /_preview/components/button, etc.
if (urlPath.match(/^\/_preview\/(components|screens|flows|atlas)\/[^/]+\/?$/)) {
  const [, type, name] = urlPath.match(/^\/_preview\/(\w+)\/([^/]+)\/?$/) || []
  if (type && name) {
    // Serve the preview shell page which will load the right component
    const shellHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Preview: ${name}</title>
  <script type="module">
    import { PreviewRouter } from '@prev/theme/previews'
    import { createRoot } from 'react-dom/client'
    import React from 'react'

    createRoot(document.getElementById('root')).render(
      React.createElement(PreviewRouter, { type: '${type.replace(/s$/, '')}', name: '${name}' })
    )
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`

    const transformed = await server.transformIndexHtml(req.url!, shellHtml)
    res.setHeader('Content-Type', 'text/html')
    res.end(transformed)
    return
  }
}
```

**Step 2: Add js-yaml to imports at top of file**

```typescript
// At top of src/vite/config.ts, add dynamic import note:
// Note: js-yaml is imported dynamically in configureServer for YAML parsing
```

**Step 3: Commit**

```bash
git add src/vite/config.ts
git commit -m "feat: add route handling for multi-type previews"
```

---

## Summary

This plan implements:

1. **Type System** - Interfaces for PreviewUnit, FlowDefinition, AtlasDefinition
2. **Config Parser** - YAML parsing with Zod validation
3. **Multi-Type Scanner** - Detects components/, screens/, flows/, atlas/ folders
4. **Virtual Module** - Exposes previewUnits with filtering helpers
5. **Preview Shells** - React components for each type:
   - ComponentPreview (props panel)
   - ScreenPreview (state tabs, viewport toggle)
   - FlowPreview (step navigation)
   - AtlasPreview (tree/map/navigate views)
6. **Preview Router** - Routes to correct shell based on type
7. **Route Handling** - Server middleware for multi-type routes

**Total: 10 tasks, ~50 commits anticipated**

---

---

## Addendum: Fixes from Codex Review

The following issues were identified during code review and must be addressed:

### Fix 1: Type Mapping Bug (HIGH)

**Problem:** `type.replace(/s$/, '')` turns `atlas` into `atla`

**Solution:** Use explicit mapping instead of regex:

```typescript
// In src/vite/config.ts - Task 10
const TYPE_SINGULAR: Record<string, string> = {
  components: 'component',
  screens: 'screen',
  flows: 'flow',
  atlas: 'atlas',  // No change needed
}

// Replace: type.replace(/s$/, '')
// With: TYPE_SINGULAR[type] || type
```

### Fix 2: Config Path Bug (HIGH)

**Problem:** `${type}s` creates `flowss` and `atlass`

**Solution:** Use folder names directly without adding `s`:

```typescript
// In src/vite/config.ts - Task 10
// The URL already contains the plural form (flows, atlas)
// Don't append 's' again

// Replace:
const configPath = path.join(rootDir, 'previews', `${type}s`, name, 'index.yaml')

// With:
const configPath = path.join(rootDir, 'previews', type, name, 'index.yaml')
```

### Fix 3: Zero-Step Flow Handling (HIGH)

**Problem:** FlowPreview allows navigation on empty flows

**Solution:** Add guard for empty steps:

```typescript
// In src/theme/previews/FlowPreview.tsx - Task 7
// After loading, add:
if (!flow || flow.steps.length === 0) {
  return (
    <div className="p-8 text-center text-yellow-600">
      <h2 className="text-lg font-semibold mb-2">{flow?.name || 'Flow'}</h2>
      <p>This flow has no steps defined.</p>
    </div>
  )
}
```

### Fix 4: Index File Detection (MED)

**Problem:** Missing `index.ts` and `index.js` support

**Solution:** Expand priorities list:

```typescript
// In src/vite/previews.ts - Task 3
const priorities = [
  'index.tsx', 'index.jsx', 'index.ts', 'index.js',  // Add .ts and .js
  'App.tsx', 'App.jsx', 'index.html'
]

// For state detection, exclude the actual index file:
const stateFiles = allFiles.filter(f =>
  (f.endsWith('.tsx') || f.endsWith('.jsx')) &&
  f !== index  // Use actual index filename, not just 'index.*'
)
```

### Fix 5: Remove Unused Imports (MED)

**Problem:** Unused `useParams`/`useSearchParams` in PreviewRouter

**Solution:** Remove the imports since props are passed directly:

```typescript
// In src/theme/previews/PreviewRouter.tsx - Task 9
// Remove:
import { useParams, useSearchParams } from '@tanstack/react-router'
```

### Fix 6: Wire Config Parsers to Server (MED)

**Problem:** `parseFlowDefinition` and `parseAtlasDefinition` are unused

**Solution:** Use them in the config endpoint:

```typescript
// In src/vite/config.ts - Task 10
import { parseFlowDefinition, parseAtlasDefinition } from '../vite/config-parser'

// In the /_preview-config handler:
if (type === 'flows') {
  const flow = await parseFlowDefinition(configPath)
  if (flow) {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(flow))
    return
  }
} else if (type === 'atlas') {
  const atlas = await parseAtlasDefinition(configPath)
  if (atlas) {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(atlas))
    return
  }
}
```

### Fix 7: Support .yml Extension

**Problem:** Only `.yaml` is checked, not `.yml`

**Solution:** Check both extensions:

```typescript
// In src/vite/config-parser.ts and src/vite/previews.ts
// Replace: 'index.yaml'
// With: allFiles.find(f => f === 'index.yaml' || f === 'index.yml')

// For config:
const configPath = existsSync(path.join(unitDir, 'config.yaml'))
  ? path.join(unitDir, 'config.yaml')
  : path.join(unitDir, 'config.yml')
```

### Fix 8: Atlas Cycle Detection

**Problem:** Recursive tree render can loop forever

**Solution:** Track visited nodes:

```typescript
// In src/theme/previews/AtlasPreview.tsx - Task 8
const renderTree = (areaId: string, depth = 0, visited = new Set<string>()): React.ReactNode => {
  if (visited.has(areaId)) {
    return <div className="text-red-500 ml-4">⚠️ Cycle detected: {areaId}</div>
  }
  visited.add(areaId)

  // ... rest of render logic, pass visited to recursive calls
  {hasChildren && area.children?.map(childId => renderTree(childId, depth + 1, new Set(visited)))}
}
```

### Fix 9: Tags Schema - Allow String or Array

**Problem:** YAML allows `tags: core` (string) but schema requires array

**Solution:** Transform scalar to array:

```typescript
// In src/vite/preview-types.ts - Task 1
export const configSchema = z.object({
  tags: z.union([
    z.array(z.string()),
    z.string().transform(s => [s])  // Convert scalar to array
  ]).optional(),
  // ...
})
```

### Fix 10: Cross-Platform HMR Path Detection

**Problem:** `file.includes('/previews/')` fails on Windows

**Solution:** Use path-agnostic check:

```typescript
// In src/vite/plugins/previews-plugin.ts - Task 4
const previewsPath = path.sep + 'previews' + path.sep
if (file.includes(previewsPath) || file.includes('/previews/')) {
  // ...
}
```

---

## Additional Tests Needed

Add to Task 3 tests:

```typescript
test('scanPreviewUnits finds index.ts files', async () => {
  // Setup with index.ts instead of index.tsx
  writeFileSync(join(testDir, 'previews/components/ts-comp/index.ts'), 'export default () => null')

  const units = await scanPreviewUnits(testDir)
  const tsComp = units.find(u => u.name === 'ts-comp')
  expect(tsComp).toBeDefined()
})

test('legacy flat previews still work', async () => {
  // Create legacy preview (not in type folder)
  writeFileSync(join(testDir, 'previews/legacy-demo/index.html'), '<html></html>')

  const legacy = await scanPreviews(testDir)
  expect(legacy.find(p => p.name === 'legacy-demo')).toBeDefined()
})

test('empty flow has no steps to navigate', async () => {
  // Test UI behavior with 0 steps
})
```

---

## Open Items for Future

- [ ] Props playground auto-generation from Zod schemas
- [ ] D2/Mermaid rendering for Atlas map view
- [ ] Element highlighting in Flow steps
- [ ] Static build output for all preview types
- [ ] Tag-based filtering UI
