# Design Session Summary - 2026-01-23

> Memory dump for context compaction. Resume from here.

## What Was Done

### 1. Codex Review Fixes (All Complete)

Fixed 10 issues from Codex review of renderer-agnostic previews:

**HIGH:**
- `src/validators/index.ts` - v2 strict mode bypass fixed (validate originalConfig, warn on v1 missing kind)

**MEDIUM:**
- `src/validators/schema-validator.ts` - --renderer flag returns warning not error for missing key
- `src/validators/semantic-validator.ts` - State ref validation errors when target screen has no states
- `src/validators/index.ts` - Added id-folder name mismatch check
- `src/validators/semantic-validator.ts` - Added circular dependency detection (flows + atlas)
- `src/schemas/preview-v1.schema.json` - v1 screen requires layoutByRenderer with minProperties:1
- `src/renderers/types.ts` + `schema-validator.ts` - layoutByRenderer accepts objects (not just arrays)
- `src/validators/semantic-validator.ts` - Added ComponentRef.ref validation in layouts

**LOW:**
- `src/schemas/preview-v1.schema.json` - Tightened untyped schema (requires type-specific field)
- `src/cli.ts` - Updated help text for renderer-agnostic architecture

### 2. Layout Primitives Design (docs/plans/2026-01-23-layout-primitives-design.md)

**Design decisions made:**

1. **Primitives use `$` prefix** - distinguishes from refs
   - Layout: `$col`, `$row`, `$box`, `$spacer`, `$slot`
   - Content: `$text`, `$icon`, `$image`

2. **Refs use path syntax** - `components/button`, `screens/login`

3. **Token-based values** - `xs`, `sm`, `md`, `lg`, `xl` for spacing/sizing

4. **Map-based templates** (not arrays) - every element has an id (the key)
   ```yaml
   template:
     root:
       type: $col(gap:lg)
       children:
         header: components/header    # leaf shorthand
         card:
           type: $box(padding:md)     # container
           children:
             title: $text(label)
   ```

5. **Container vs leaf syntax:**
   - Container: `{ type: $primitive(props), children: { ... } }`
   - Leaf: `id: $primitive(props)` or `id: components/ref`

6. **Prop references** - bare words in templates = prop refs, quoted = literals
   ```yaml
   title: $text(label size:lg)      # label is prop
   arrow: $text("→")                # literal
   ```

7. **Screen structure:**
   - `states` - enum with descriptions
   - `template` - static UI tree (map-based)
   - `slots` - state-dependent content mapping

8. **Component structure:**
   - `props` - schema definition
   - `template` - declarative UI (same map-based syntax)

### 3. Naming Decisions

| Old | New | Reason |
|-----|-----|--------|
| `view` | `template` | Describes structure, not output |
| `regions` | `slots` | Industry standard term |
| `layoutByRenderer` | `template` | Renderer-agnostic now |

## Example Configs

### Screen

```yaml
kind: screen
id: login
title: Login Screen
schemaVersion: "2.0"

states:
  default: { description: "Ready to login" }
  logging-in: { description: "Submitting credentials" }
  error: { description: "Login failed" }

template:
  root:
    type: $col(gap:lg align:center)
    children:
      spacer-top: $spacer(xl)
      logo: components/logo
      card:
        type: $box(padding:lg bg:surface radius:md)
        children:
          form: $slot(form)
      links:
        type: $row(gap:sm)
        children:
          forgot: components/forgot-link
          signup: components/signup-link
      spacer-bottom: $spacer(xl)

slots:
  form:
    default: components/login-form
    logging-in: components/spinner
    error: components/login-form-error
```

### Component

```yaml
kind: component
id: button

props:
  label: { type: string, required: true }
  variant: { type: enum, values: [primary, secondary], default: primary }
  icon: { type: string }

template:
  root:
    type: $box(padding:sm bg:variant radius:sm)
    children:
      content:
        type: $row(gap:xs align:center)
        children:
          icon: $icon(name:icon size:sm)
          label: $text(label weight:medium)
```

## Primitive Reference

### Layout Primitives

| Primitive | Props | Description |
|-----------|-------|-------------|
| `$col(props)` | `gap`, `align`, `padding` | Vertical stack |
| `$row(props)` | `gap`, `align`, `padding` | Horizontal stack |
| `$box(props)` | `padding`, `bg`, `radius` | Container |
| `$spacer` / `$spacer(size)` | size token | Whitespace |
| `$slot(name)` | slot name | State-dependent placeholder |

### Content Primitives

| Primitive | Props | Description |
|-----------|-------|-------------|
| `$text(content props)` | `size`, `weight`, `color` | Text (first arg is content) |
| `$icon(props)` | `name`, `size`, `color` | Icon |
| `$image(props)` | `src`, `alt`, `fit` | Image |

### Design Tokens

| Type | Values |
|------|--------|
| Spacing | `xs`, `sm`, `md`, `lg`, `xl`, `2xl` |
| Align | `start`, `center`, `end`, `stretch`, `between` |
| Background | `surface`, `muted`, `accent`, `transparent` |
| Radius | `none`, `sm`, `md`, `lg`, `full` |
| Color | `default`, `muted`, `primary`, `success`, `error` |

## Not Yet Designed

- **Flows** - multi-step user journeys
- **Atlas** - information architecture / relationships
- **Conditional rendering** - `$if(state:error)`
- **Token customization** - per-project token values
- **Implementation** - actual code changes to support new syntax

## Files Changed

- `src/validators/index.ts` - validation fixes
- `src/validators/schema-validator.ts` - layout validation
- `src/validators/semantic-validator.ts` - semantic checks + cycle detection
- `src/schemas/preview-v1.schema.json` - schema fixes
- `src/renderers/types.ts` - type fixes
- `src/cli.ts` - help text update
- `docs/plans/2026-01-23-layout-primitives-design.md` - full design doc

## Git Commits

1. `docs: add layout primitives design`
2. `docs: update layout primitives with map-based templates`
