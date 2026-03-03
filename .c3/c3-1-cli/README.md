---
id: c3-1
c3-version: 4
title: cli
type: container
boundary: process
parent: c3-0
goal: Command-line interface for prev-cli
summary: Handles command dispatch, configuration loading, and orchestrates build/dev workflows
---

# c3-1: CLI Container

## Goal

Command-line interface for prev-cli. Handles command dispatch, configuration loading, and orchestrates the build/dev workflows.

## Responsibilities

- Parse CLI arguments and dispatch to appropriate handlers
- Load and validate `.prev.yaml` configuration
- Orchestrate dev server, build, preview, and utility commands
- Manage cache and cleanup operations

## Entry Point

`src/cli.ts` - Main CLI entry (binary: `prev`)

## Commands

| Command | Description |
|---------|-------------|
| `dev` | Start development server with live reload |
| `build` | Generate static site to ./dist/ |
| `preview` | Serve production build locally |
| `validate` | Validate preview configurations |
| `migrate` | Convert v1 configs to v2 format |
| `clean` | Clear cache directory |
| `config` | Show current configuration |
| `create` | Scaffold new preview |
| `typecheck` | Type check preview TSX files |

## Components

| ID | Component | Description |
|----|-----------|-------------|
| c3-101 | [cli-entry](./c3-101-cli-entry.md) | CLI entry point, argument parsing, command dispatch |
| c3-102 | [config-loader](./c3-102-config-loader.md) | Configuration loading and validation |
| c3-103 | [validator](./c3-103-validator.md) | Preview config validation (schema + semantic) |
| c3-104 | [typechecker](./c3-104-typechecker.md) | Embedded TypeScript type checking via tsgo |

## Dependencies

- **Internal:** [c3-2-build](../c3-2-build/) for build system (dev/build/preview)
- **External:** None (file system only)

## Data Flow

```
CLI args → Command Router → Config Loader → Build/Dev Handler → Output
```
