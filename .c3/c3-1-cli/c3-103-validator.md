---
id: c3-103
c3-version: 4
title: validator
type: component
parent: c3-1
goal: Validate preview configurations
summary: Schema and semantic validation for preview configs
files:
  - src/validators/index.ts
  - src/validators/schema-validator.ts
  - src/validators/semantic-validator.ts
---

# c3-103: Validator

## Goal

Validates preview configurations against schema rules and semantic constraints. Powers the `prev validate` CLI command.

## Location

`src/validators/index.ts`, `src/validators/schema-validator.ts`, `src/validators/semantic-validator.ts`

## Responsibilities

- Orchestrate validation pipeline (schema + semantic)
- Scan preview directories for config files
- Validate against JSON schemas
- Check semantic rules (references, duplicates)
- Format validation output for CLI

## API

### validate()

```typescript
async function validate(
  rootDir: string,
  options?: ValidationOptions
): Promise<ValidationResult>

interface ValidationOptions {
  renderer?: string       // Specific renderer to validate
  schemaOnly?: boolean    // Skip semantic validation
  semanticOnly?: boolean  // Skip schema validation
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean
  summary: {
    components: { total: number; valid: number; invalid: number }
    screens: { total: number; valid: number; invalid: number }
    flows: { total: number; valid: number; invalid: number }
    atlas: { total: number; valid: number; invalid: number }
  }
  errors: ValidationError[]
  warnings: ValidationWarning[]
}
```

## Validation Layers

### 1. Schema Validation (`schema-validator.ts`)
- Validates config structure against JSON Schema
- Checks required fields (kind, id for v2)
- Validates renderer-specific layouts

### 2. Semantic Validation (`semantic-validator.ts`)
- Checks cross-references between previews
- Validates screen state references in flows
- Detects duplicate IDs
- Validates component references

## Dependencies

- **Internal:** [c3-406-render-adapter](../c3-4-previews/c3-406-render-adapter.md) for renderer schemas
- **External:** `ajv` for JSON Schema validation, `js-yaml` for config parsing

## Data Flow

```
Preview directory scan
    ↓
Load config.yaml files
    ↓
Build validation context (all units)
    ↓
Schema validation (per unit)
    ↓
Semantic validation (cross-references)
    ↓
Aggregate results
    ↓
Format for CLI output
```

## CLI Usage

```bash
prev validate              # Validate all preview configs
prev validate -r react     # Validate only react renderer
```

## References

- `src/validators/index.ts` - Validation orchestration
- `src/validators/schema-validator.ts` - JSON Schema validation
- `src/validators/schema-validator.ts:validateAgainstSchema()` - Schema validation function
- `src/validators/semantic-validator.ts` - Semantic validation
- `src/validators/semantic-validator.ts:validateSemantics()` - Cross-reference validation

## Notes

- v1 configs (missing kind) get warnings, not errors
- ID must match folder name
- Renderer-specific layouts validated against adapter schemas
