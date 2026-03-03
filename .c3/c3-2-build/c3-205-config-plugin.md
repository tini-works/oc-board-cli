---
id: c3-205
c3-version: 4
title: config-plugin
type: component
parent: c3-2
goal: Inject runtime configuration via virtual module
summary: Serves runtime config to the theme frontend
files:
  - src/server/routes/preview-config.ts
---

# c3-205: Config Plugin

## Goal

Injects runtime configuration into the client bundle via the `virtual:prev-config` virtual module, and provides a dev-mode route for config updates.

## Location

`src/server/plugins/virtual-modules.ts` (virtual module), `src/server/routes/preview-config.ts` (dev route handler)

## Responsibilities

- Create virtual module `virtual:prev-config` via Bun plugin onResolve/onLoad
- Inject user's `.prev.yaml` settings into client code
- Enable runtime access to theme, contentWidth, and other settings
- Serve preview config as JSON via `/_preview-config/*` route in dev mode

## Virtual Module

### `virtual:prev-config`

```typescript
export const config: {
  theme: 'light' | 'dark' | 'system'
  contentWidth: 'constrained' | 'full'
  // ... other config fields
}
```

## Dependencies

- **Internal:** [c3-102-config-loader](../c3-1-cli/c3-102-config-loader.md) provides PrevConfig

## Usage in Theme

```typescript
import { config } from 'virtual:prev-config'

// Access theme settings
if (config.theme === 'dark') {
  // Apply dark mode
}
```

## References

- `src/server/plugins/virtual-modules.ts` - Virtual module generation (case `virtual:prev-config`)
- `src/server/routes/preview-config.ts` - Dev route handler for preview configs

## Related Refs

- [ref-config-schema](../refs/ref-config-schema.md) - YAML configuration schema
- [ref-virtual-modules](../refs/ref-virtual-modules.md) - Bun virtual module pattern

## Notes

- Config is serialized as JSON in the virtual module
- Changes to config require dev server restart
