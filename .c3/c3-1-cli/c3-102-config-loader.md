---
id: c3-102
c3-version: 4
title: config-loader
type: component
parent: c3-1
goal: Load and validate .prev.yaml configuration
summary: Configuration loading, schema validation, and defaults
files:
  - src/config/loader.ts
  - src/config/schema.ts
  - src/config/index.ts
---

# c3-102: Config Loader

## Goal

Loads, validates, and saves prev-cli configuration from `.prev.yaml` files.

## Location

`src/config/loader.ts`, `src/config/schema.ts`

## Responsibilities

- Find configuration file in project root
- Parse YAML configuration
- Validate against schema with defaults
- Save updated configuration (for drag-and-drop ordering)

## API

### Functions

```typescript
// Find .prev.yaml or .prev.yml in directory
function findConfigFile(rootDir: string): string | null

// Load config with defaults for missing values
function loadConfig(rootDir: string): PrevConfig

// Save config back to file
function saveConfig(rootDir: string, config: PrevConfig): void

// Update page order for a directory
function updateOrder(rootDir: string, pathKey: string, order: string[]): void
```

### PrevConfig Schema

```typescript
interface PrevConfig {
  theme: 'light' | 'dark' | 'system'    // Default: 'system'
  contentWidth: 'constrained' | 'full'  // Default: 'constrained'
  port?: number                          // Optional, random if not set
  include: string[]                      // Dot directories to include
  hidden: string[]                       // Glob patterns for hidden pages
  order: Record<string, string[]>        // Custom page ordering per path
}
```

## Dependencies

- **External:** `js-yaml` for YAML parsing
- **External:** `fs` for file operations

## Data Flow

```
.prev.yaml
    ↓
readFileSync + yaml.load
    ↓
validateConfig (apply defaults)
    ↓
PrevConfig object
```

## Configuration Example

```yaml
theme: system
contentWidth: constrained
port: 3000
include:
  - ".c3"
hidden:
  - "internal/**"
order:
  "/":
    - "getting-started.md"
    - "guides/"
```

## References

- `src/config/loader.ts` - Configuration loading and saving
- `src/config/loader.ts:findConfigFile()` - Config file discovery
- `src/config/loader.ts:loadConfig()` - Config loading with defaults
- `src/config/schema.ts` - PrevConfig interface definition

## Related Refs

- [ref-config-schema](../refs/ref-config-schema.md) - YAML configuration schema and defaults

## Notes

- Returns `defaultConfig` if no config file found
- Validation warnings logged but don't block loading
- Order updates are persisted for drag-and-drop reordering
