---
id: c3-104
c3-version: 4
title: typechecker
type: component
parent: c3-1
goal: Embedded TypeScript type checking via tsgo
summary: Type checks preview TSX files using native TypeScript compiler
files:
  - src/typecheck/index.ts
---

# c3-104: Typechecker

## Goal

Embedded TypeScript type checker for preview files. Uses tsgo (native TypeScript compiler) bundled with prev-cli, enabling type checking without requiring user-side package installation.

## Location

`src/typecheck/index.ts`

## Responsibilities

- Resolve tsgo binary from prev-cli's dependencies
- Resolve @types from prev-cli's dependencies
- Run type checking on preview TSX/TS files
- Format and report type errors

## API

### typecheck()

```typescript
async function typecheck(
  rootDir: string,
  options?: TypecheckOptions
): Promise<TypecheckResult>

interface TypecheckOptions {
  previewsDir?: string    // Default: rootDir/previews
  include?: string[]      // Default: ["**/*.{ts,tsx}"]
  strict?: boolean        // Default: true
  verbose?: boolean       // Show resolved paths
}

interface TypecheckResult {
  success: boolean
  fileCount: number
  errorCount: number
  output: string
}
```

### Key Functions

```typescript
// Resolves tsgo binary relative to prev-cli installation
function getTsgoPath(): string

// Resolves @types directory relative to prev-cli installation
function getTypeRootsPath(): string
```

## Design

### Embedded Resolution

Uses `import.meta.resolve()` to find packages relative to prev-cli's location, not the user's project:

```typescript
const pkgJsonUrl = import.meta.resolve(`${platformPkg}/package.json`)
```

This works regardless of how prev-cli is invoked:
- `bunx prev-cli typecheck` (cache)
- `prev typecheck` (global install)
- `bun run prev typecheck` (local install)

### No Config Files

All TypeScript options passed via CLI flags to tsgo:

```
tsgo --noEmit --strict --skipLibCheck --ignoreConfig \
     --jsx react-jsx --moduleResolution bundler \
     --typeRoots <embedded-path> \
     --types react react-dom \
     <files>
```

The `--ignoreConfig` flag ensures any tsconfig.json in the user's project is ignored.

## Dependencies

- **Internal:** None
- **External:** `@typescript/native-preview` (tsgo binary), `@types/react`, `@types/react-dom`

## Data Flow

```
previews/**/*.tsx
       ↓
  Glob scan files
       ↓
  Resolve tsgo path (import.meta.resolve)
       ↓
  Resolve typeRoots path (import.meta.resolve)
       ↓
  Spawn tsgo process with CLI flags
       ↓
  Collect stdout/stderr
       ↓
  Format result
```

## CLI Usage

```bash
prev typecheck              # Type check all previews
prev typecheck --verbose    # Show resolved paths
```

## References

- `src/typecheck/index.ts` - Type checking implementation
- `src/typecheck/index.ts:typecheck()` - Main typecheck function
- `src/typecheck/index.ts:getTsgoPath()` - tsgo binary resolution
- `src/typecheck/index.ts:getTypeRootsPath()` - @types resolution

## Notes

- tsgo is ~10x faster than JavaScript tsc
- No temporary files created
- Parallel-safe (no shared config)
- Works offline after first bunx download
