# ref-config-schema: YAML Configuration Schema

## Goal

Provide a consistent, validated configuration format for prev-cli projects that supports both global settings (`.prev.yaml`) and preview-specific configurations, with sensible defaults and clear schema definitions.

## Pattern

Configuration uses YAML files with optional keys and sensible defaults. Validation applies defaults for missing values.

## .prev.yaml Schema

```yaml
# Theme: light | dark | system
theme: system

# Content width: constrained | full
contentWidth: constrained

# Dev server port (optional, random if not set)
port: 3000

# Include dot-prefixed directories
include:
  - ".c3"
  - ".github"

# Glob patterns for hidden pages
hidden:
  - "internal/**"
  - "wip-*.md"

# Custom page ordering per path
order:
  "/":
    - "getting-started.md"
    - "guides/"
```

## Default Values

```typescript
const defaultConfig: PrevConfig = {
  theme: 'system',
  contentWidth: 'constrained',
  include: [],
  hidden: [],
  order: {},
}
```

## Preview Config Schema (v2)

```yaml
kind: screen           # Required: component | screen | flow
id: login             # Required: unique identifier
schemaVersion: "2.0"  # Required: schema version
title: Login Screen   # Optional: display title
description: "..."    # Optional: description
tags: [auth, login]   # Optional: filtering tags

# Type-specific fields
states:               # For screens
  default: { description: "Initial" }
  error: { description: "Error state" }

steps:                # For flows
  - id: start
    title: "Begin"
```

## Validation

```typescript
function validateConfig(raw: unknown): PrevConfig {
  // Apply defaults for missing fields
  return {
    theme: raw?.theme ?? 'system',
    contentWidth: raw?.contentWidth ?? 'constrained',
    include: raw?.include ?? [],
    hidden: raw?.hidden ?? [],
    order: raw?.order ?? {},
  }
}
```

## Used By

- [c3-102-config-loader](../c3-1-cli/c3-102-config-loader.md)
- [c3-203-previews-plugin](../c3-2-build/c3-203-previews-plugin.md)
- [c3-205-config-plugin](../c3-2-build/c3-205-config-plugin.md)

## Notes

- Both `.prev.yaml` and `.prev.yml` supported
- Invalid config logs warning, uses defaults
- Preview configs support v1 (transitional) and v2 (strict)
