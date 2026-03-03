---
id: adr-20260126-embedded-typecheck
status: implemented
created: 2026-01-26
approved-files:
  - src/typecheck/index.ts
  - src/cli.ts
  - package.json
---

# ADR: Embedded TypeScript Type Checker

## Goal

Provide embedded TypeScript type checking for preview files without requiring user-side TypeScript configuration.

## Problem

Users writing preview files (TSX) have no type checking unless they manually install `@types/react` and configure a `tsconfig.json`. When prev-cli is installed globally or run via `bunx`, TypeScript types are not accessible to the user's project.

This creates friction:
- No IDE autocomplete for React types
- No CLI-based type validation
- Users must understand TypeScript configuration

## Decision

Add an embedded `typecheck` command that uses tsgo (native TypeScript compiler) bundled with prev-cli. The command resolves types and binaries relative to prev-cli's installation, not the user's project.

### Implementation

1. **New component:** `src/typecheck/index.ts`
   - `getTsgoPath()` - resolves tsgo binary via `import.meta.resolve()`
   - `getTypeRootsPath()` - resolves @types via `import.meta.resolve()`
   - `typecheck()` - runs tsgo with inline CLI flags (no config file)

2. **CLI integration:** Add `typecheck` case to `src/cli.ts`

3. **Dependencies:** Move to `dependencies` (not devDependencies):
   - `@typescript/native-preview` (provides tsgo binary)
   - `@types/react`
   - `@types/react-dom`

### Key Design

```typescript
// Resolves relative to prev-cli, works with bunx/global/local
const pkgJsonUrl = import.meta.resolve(`${platformPkg}/package.json`)
```

All tsgo options passed via CLI flags - no temporary config files:
```
tsgo --noEmit --strict --jsx react-jsx --typeRoots <path> --types react react-dom <files>
```

## Rationale

- **tsgo over tsc:** 10x faster, same output
- **Embedded types:** Works regardless of install method (bunx, global, local)
- **No temp files:** CLI flags are cleaner, parallel-safe
- **Similar to validator:** Follows c3-103 pattern for CLI validation commands

## Affected Layers

| Layer | Change |
|-------|--------|
| c3-1-cli | Add command, new component |
| c3-101-cli-entry | Add typecheck case |
| package.json | Move types to dependencies |

## New Component

| ID | Name | Description |
|----|------|-------------|
| c3-104 | typechecker | Embedded TypeScript type checking via tsgo |

## Verification

```bash
# After implementation:
bunx prev-cli typecheck      # Should work without local install
prev typecheck               # Should work with global install
bun run prev typecheck       # Should work with local install
```

## References

- [c3-103-validator](../c3-1-cli/c3-103-validator.md) - similar CLI validation pattern
