# Layout Primitives Design

> Standardize layout primitives with design-token-aligned syntax for renderer-agnostic preview configs.

## Overview

**Goal:** Simple, composable layout primitives that separate structure from content. Layout describes *where* things go; components handle *what* renders.

**Principles:**
- Primitives are structural only (no content primitives)
- Token-based values (`gap: lg` not `gap: 24px`)
- Renderer-agnostic (same syntax works for React, HTML, etc.)
- Compact YAML-friendly syntax

## Syntax

### Primitives (`$` prefix)

```yaml
$col(gap:lg)      # Column layout
$row(gap:md)      # Row layout
$box(padding:md)  # Container with spacing
$spacer           # Flexible space
$spacer(xl)       # Fixed space
$slot(name)       # State-dependent content placeholder
```

The `$` prefix marks built-in primitives. No `/` in the name.

### Component References (path syntax)

```yaml
components/button     # Reference to component
screens/login         # Reference to screen
flows/checkout        # Reference to flow
```

Path syntax (`/`) distinguishes refs from primitives.

### Props

Inline with parentheses, colon-separated:

```yaml
$col(gap:lg align:center)
$box(padding:md bg:surface radius:sm)
```

Component props as nested YAML:

```yaml
- components/button:
    label: "Submit"
    variant: primary
```

## Design Tokens

Primitives use semantic token values:

| Token Type | Values |
|------------|--------|
| **Spacing** | `xs`, `sm`, `md`, `lg`, `xl`, `2xl` |
| **Align** | `start`, `center`, `end`, `stretch`, `between` |
| **Background** | `surface`, `muted`, `accent`, `transparent` |
| **Radius** | `none`, `sm`, `md`, `lg`, `full` |

Renderers map tokens to actual values.

## Primitive Reference

### `$col(props)`

Vertical stack layout.

| Prop | Values | Default |
|------|--------|---------|
| `gap` | spacing token | `none` |
| `align` | alignment token | `stretch` |
| `padding` | spacing token | `none` |

```yaml
- $col(gap:lg align:center):
    - components/header
    - components/content
    - components/footer
```

### `$row(props)`

Horizontal stack layout.

| Prop | Values | Default |
|------|--------|---------|
| `gap` | spacing token | `none` |
| `align` | alignment token | `center` |
| `padding` | spacing token | `none` |

```yaml
- $row(gap:md):
    - components/logo
    - $spacer
    - components/nav
```

### `$box(props)`

Generic container with spacing and styling.

| Prop | Values | Default |
|------|--------|---------|
| `padding` | spacing token | `none` |
| `bg` | background token | `transparent` |
| `radius` | radius token | `none` |

```yaml
- $box(padding:lg bg:surface radius:md):
    - components/card-content
```

### `$spacer` / `$spacer(size)`

Whitespace. Without size, fills available space (flex). With size, fixed.

```yaml
- $row:
    - components/logo
    - $spacer           # Pushes nav to the right
    - components/nav

- $col(gap:md):
    - components/form
    - $spacer(xl)       # Fixed large gap
    - components/footer
```

### `$slot(name)`

Placeholder for state-dependent content. Filled by `slots` mapping.

```yaml
template:
  root:
    type: $col
    children:
      header: components/header
      main: $slot(main)
      footer: components/footer

slots:
  main:
    default: components/home
    loading: components/spinner
```

### `$text(content props...)`

Text content. First positional arg is content (prop reference or quoted literal).

| Prop | Values | Default |
|------|--------|---------|
| `size` | `xs`, `sm`, `md`, `lg`, `xl` | `md` |
| `weight` | `normal`, `medium`, `bold` | `normal` |
| `color` | color token | `default` |

```yaml
title: $text(label size:lg weight:bold)
subtitle: $text("Welcome back" color:muted)
```

### `$icon(props)`

Icon reference.

| Prop | Values | Default |
|------|--------|---------|
| `name` | icon identifier (prop ref or string) | required |
| `size` | `xs`, `sm`, `md`, `lg`, `xl` | `md` |
| `color` | color token | `default` |

```yaml
check: $icon(name:icon size:sm color:success)
```

### `$image(props)`

Image element.

| Prop | Values | Default |
|------|--------|---------|
| `src` | image URL (prop ref or string) | required |
| `alt` | alt text | `""` |
| `fit` | `cover`, `contain`, `fill` | `cover` |

```yaml
avatar: $image(src:avatarUrl alt:"User avatar" fit:cover)
```

## Template Structure (Map-based)

Templates use maps instead of arrays - every element has an id (the key).

**Structure:**
- **Container nodes:** `{ type: $primitive(props), children: { ... } }`
- **Leaf nodes (shorthand):** `id: $primitive(props)` or `id: components/ref`

```yaml
template:
  root:
    type: $col(gap:lg)
    children:
      header:
        type: $row(gap:xs)
        children:
          logo: $icon(name:icon)
          title: $text(label)
      content: $slot(main)
      footer: components/footer
```

**Why maps over arrays:**
- Every element has an id (the key)
- Easy to reference: `root.header.logo`
- Extensible: can add `props:`, `visible:`, `order:` later
- JSON Schema friendly, matches json-render pattern

## Screen Config Structure

```yaml
kind: screen
id: login
title: Login Screen
schemaVersion: "2.0"

# State definitions (enum)
states:
  default: { description: "Ready to login" }
  logging-in: { description: "Submitting credentials" }
  error: { description: "Login failed" }
  authenticated: { description: "Success" }

# Static UI structure (map-based)
template:
  root:
    type: $col(gap:lg align:center)
    children:
      top-spacer: $spacer(xl)
      logo: components/logo
      form-container:
        type: $box(padding:lg bg:surface radius:md)
        children:
          form: $slot(form)
      links:
        type: $row(gap:sm)
        children:
          forgot: components/forgot-link
          signup: components/signup-link
      bottom-spacer: $spacer(xl)

# State-dependent content
slots:
  form:
    default: components/login-form
    logging-in: components/spinner
    error: components/login-form-error
    authenticated: components/success-message
```

## Component Config Structure

Components are fully declarative with props schema and template.

```yaml
kind: component
id: button

props:
  label: { type: string, required: true }
  variant: { type: enum, values: [primary, secondary], default: primary }
  icon: { type: string }
  disabled: { type: boolean, default: false }

template:
  root:
    type: $box(padding:sm bg:variant radius:sm)
    children:
      content:
        type: $row(gap:xs align:center)
        children:
          icon: $icon(name:icon)
          label: $text(label weight:medium)
```

**Prop references:** Bare words in template refer to props (e.g., `label`, `variant`, `icon`).

## Parsing Rules

1. **Starts with `$`** → Primitive
2. **Contains `/`** → Component/screen/flow reference
3. **Props in parentheses** → Parse as `key:value` pairs
4. **Has `type:` and `children:`** → Container node
5. **Direct value** → Leaf node (shorthand)

## Migration from layoutByRenderer

Old format:
```yaml
layoutByRenderer:
  react:
    - type: Stack
      gap: lg
      children:
        - type: ComponentRef
          ref: components/header
```

New format:
```yaml
template:
  root:
    type: $col(gap:lg)
    children:
      header: components/header
```

The `layoutByRenderer` field remains available for renderer-specific overrides when needed.

## Complete Example: Login Screen

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
          divider: $text("·" color:muted)
          signup: components/signup-link
      spacer-bottom: $spacer(xl)

slots:
  form:
    default: components/login-form
    logging-in: components/spinner
    error: components/login-form-error
```

## Complete Example: Button Component

```yaml
kind: component
id: button

props:
  label: { type: string, required: true }
  variant: { type: enum, values: [primary, secondary, ghost], default: primary }
  icon: { type: string }
  disabled: { type: boolean, default: false }

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

## Implementation Tasks

1. Update `src/schemas/layout-primitives.schema.json` with new primitive definitions
2. Add primitive parser to handle `$name(props)` syntax
3. Add template parser for map-based structure (type/children)
4. Update screen schema: `template` (map), `slots` (state→content)
5. Update component schema: `props` (schema), `template` (map)
6. Update validators for new syntax and prop references
7. Update React/HTML adapters to render primitives
8. Add content primitives: `$text`, `$icon`, `$image`
9. Add migration tool from `layoutByRenderer` to `template`

## Open Questions

- Should `$slot` support default content inline? e.g., `$slot(main default:components/fallback)`
- Should we support conditional primitives? e.g., `$if(state:error):`
- Token customization per-project?
- How to handle `order:` when YAML map order isn't sufficient?
