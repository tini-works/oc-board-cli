---
id: c3-101
c3-version: 4
title: cli-entry
type: component
parent: c3-1
goal: Main entry point for prev-cli application
summary: Parses CLI arguments and dispatches to command handlers
files:
  - src/cli.ts
---

# c3-101: CLI Entry

## Goal

Main entry point for the prev-cli application. Parses command-line arguments, loads configuration, and dispatches to appropriate command handlers.

## Location

`src/cli.ts`

## Responsibilities

- Parse CLI arguments using Node's `util.parseArgs`
- Determine command (dev, build, preview, validate, migrate, clean, config, create)
- Resolve working directory from --cwd flag or positional arguments
- Load configuration and merge with CLI flags
- Dispatch to command handlers
- Print help and version information

## API

### Commands

| Command | Handler | Description |
|---------|---------|-------------|
| `dev` | `startDev()` | Start development server with HMR |
| `build` | `buildSite()` | Generate static site |
| `preview` | `previewSite()` | Preview production build |
| `validate` | `validate()` | Validate preview configs |
| `migrate` | `migrateConfigs()` | Upgrade v1 configs to v2 |
| `clean` | `cleanCache()` | Remove old caches |
| `config` | `handleConfig()` | Manage configuration |
| `create` | `createPreview()` | Scaffold new preview |
| `typecheck` | `typecheck()` | Type check preview files |

### CLI Flags

```typescript
{
  port: { type: 'string', short: 'p' },    // Dev server port
  days: { type: 'string', short: 'd' },    // Cache age threshold
  cwd: { type: 'string', short: 'c' },     // Working directory
  base: { type: 'string', short: 'b' },    // Base path for deployment
  renderer: { type: 'string', short: 'r' }, // Target renderer for validation
  debug: { type: 'boolean' },               // Enable debug tracing
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' }
}
```

## Dependencies

- **Internal:** [c3-102-config-loader](./c3-102-config-loader.md) for configuration
- **Internal:** [c3-2-build](../c3-2-build/) for `startDev`, `buildSite`, `previewSite` (via `src/server/start.ts`)
- **External:** `util.parseArgs`, `fs`, `path`

## Data Flow

```
process.argv
    ↓
parseArgs (extract flags/positionals)
    ↓
Resolve rootDir (--cwd > positional > cwd)
    ↓
loadConfig(rootDir)
    ↓
Command dispatch (switch statement)
    ↓
Exit with code 0/1
```

## References

- `src/cli.ts` - CLI entry point with command dispatch
- `src/cli.ts:parseArgs()` - Argument parsing using util.parseArgs
- `src/cli.ts:COMMANDS` - Command handler registry

## Notes

- Port priority: -p flag > config.port
- Supports both `.prev.yaml` and `.prev.yml`
- Version read from package.json traversing up directories
