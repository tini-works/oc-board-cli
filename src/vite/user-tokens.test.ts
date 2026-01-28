import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

// Test helpers
const testDir = join(import.meta.dir, '.test-tokens')
const tokensPath = join(testDir, 'previews/tokens.yaml')

describe('User tokens detection', () => {
  beforeEach(() => {
    // Reset global
    ;(globalThis as any).__PREV_USER_TOKENS_PATH = undefined

    // Clean test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  test('sets global path when tokens.yaml exists', async () => {
    // Create test tokens file
    mkdirSync(join(testDir, 'previews'), { recursive: true })
    writeFileSync(tokensPath, 'colors:\n  primary: "#ff0000"')

    // Simulate plugin behavior
    const userTokensPath = tokensPath
    if (existsSync(userTokensPath)) {
      ;(globalThis as any).__PREV_USER_TOKENS_PATH = userTokensPath
    }

    expect((globalThis as any).__PREV_USER_TOKENS_PATH).toBe(tokensPath)
  })

  test('sets null when tokens.yaml does not exist', () => {
    mkdirSync(testDir, { recursive: true })
    // No tokens.yaml created

    const userTokensPath = tokensPath
    if (existsSync(userTokensPath)) {
      ;(globalThis as any).__PREV_USER_TOKENS_PATH = userTokensPath
    } else {
      ;(globalThis as any).__PREV_USER_TOKENS_PATH = null
    }

    expect((globalThis as any).__PREV_USER_TOKENS_PATH).toBeNull()
  })
})
