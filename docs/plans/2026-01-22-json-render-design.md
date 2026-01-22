# JSON-Render Inspired Preview System Design

> **Date:** 2026-01-22
> **Status:** Draft
> **Inspired by:** [json-render](https://github.com/vercel-labs/json-render) by Vercel Labs

---

## Overview

A preview system for organizing design documentation with four content types:
- **Components** - Atomic design system elements with prop variations
- **Screens** - Full-page compositions with multiple states
- **Flows** - User journey documentation with step-by-step navigation
- **Atlas** - The map of your app: hierarchy, content model, mental model, and routes

Key principles:
- **Human-first authoring** - Developers create content in familiar formats (TSX, YAML, MDX)
- **Folder convention** - Top-level folder determines content type
- **Progressive adoption** - Use only the types you need
- **Tag-based grouping** - Flexible cross-cutting organization via config.yaml

---

## Folder Structure

```
previews/
├── components/              # Type: Component
│   └── {name}/
│       ├── index.tsx        # Main render (required)
│       ├── config.yaml      # Metadata, tags (optional)
│       ├── schema.ts        # Props schema (optional)
│       └── docs.mdx         # Documentation (optional)
│
├── screens/                 # Type: Screen
│   └── {name}/
│       ├── index.tsx        # Default state (required)
│       ├── {state}.tsx      # Additional states (e.g., error.tsx)
│       ├── config.yaml
│       └── docs.mdx
│
├── flows/                   # Type: Flow
│   └── {name}/
│       ├── index.yaml       # Flow definition (required)
│       ├── config.yaml
│       └── docs.mdx
│
└── atlas/                   # Type: Atlas (App Map)
    └── {name}/
        ├── index.yaml       # Atlas definition (required)
        ├── config.yaml
        └── docs.mdx
```

---

## File Formats

### Component: `index.tsx`

```tsx
// components/button/index.tsx
import React from 'react'

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  label: string
  disabled?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  label,
  disabled = false
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

// Optional: Export props for playground
export const defaultProps: ButtonProps = {
  variant: 'primary',
  size: 'md',
  label: 'Click me'
}
```

### Component Schema (optional): `schema.ts`

```typescript
// components/button/schema.ts
import { z } from 'zod'

export const schema = z.object({
  variant: z.enum(['primary', 'secondary', 'ghost']).default('primary'),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
  label: z.string(),
  disabled: z.boolean().default(false),
})
```

### Screen: `index.tsx` + states

```tsx
// screens/login/index.tsx (default state)
export default function LoginScreen() {
  return (
    <div className="login-page">
      <Card>
        <h1>Sign In</h1>
        <Input placeholder="Email" />
        <Input type="password" placeholder="Password" />
        <Button label="Log In" />
      </Card>
    </div>
  )
}
```

```tsx
// screens/login/error.tsx (error state)
export default function LoginScreenError() {
  return (
    <div className="login-page">
      <Card>
        <h1>Sign In</h1>
        <Alert variant="error">Invalid credentials</Alert>
        <Input placeholder="Email" error />
        <Input type="password" placeholder="Password" />
        <Button label="Log In" />
      </Card>
    </div>
  )
}
```

```tsx
// screens/login/loading.tsx (loading state)
export default function LoginScreenLoading() {
  return (
    <div className="login-page">
      <Card>
        <h1>Sign In</h1>
        <Spinner />
      </Card>
    </div>
  )
}
```

### Flow: `index.yaml`

```yaml
# flows/onboarding/index.yaml
name: User Onboarding
description: New user first-time experience

steps:
  - screen: login
    state: default
    note: User arrives at login page

  - screen: login
    state: loading
    note: User submits credentials
    trigger: click "Log In"

  - screen: dashboard
    state: welcome
    note: First-time dashboard with welcome banner

  - screen: settings
    state: profile-incomplete
    note: Prompt to complete profile
    highlight: [profile-section]
```

### Atlas (App Map): `index.yaml`

The Atlas document describes the complete map of your application: hierarchy, content model, user mental model, and routes.

```yaml
# atlas/app/index.yaml
name: Main Application
description: Core user-facing application structure

# ═══════════════════════════════════════════════════════════════
# HIERARCHY - How areas relate to each other
# ═══════════════════════════════════════════════════════════════
hierarchy:
  root: home

  areas:
    home:
      title: Home
      description: Landing area, entry point for most users
      children: [dashboard, quick-actions]

    dashboard:
      title: Dashboard
      description: Primary workspace showing user's current state
      parent: home

    settings:
      title: Settings
      description: Configuration and preferences
      children: [profile, security, notifications]

    profile:
      title: Profile
      description: User identity and public information
      parent: settings

    security:
      title: Security
      description: Password, 2FA, sessions
      parent: settings

    admin:
      title: Admin Area
      description: Administrative functions (restricted)
      access: admin-only

# ═══════════════════════════════════════════════════════════════
# CONTENT MODEL - What data/content lives in each area
# ═══════════════════════════════════════════════════════════════
content:
  dashboard:
    primary: user-stats, recent-activity
    actions: [create-new, view-all]
    data-sources: [user-api, analytics-api]

  profile:
    primary: user-info, avatar
    actions: [edit-profile, change-avatar]
    data-sources: [user-api]

  settings:
    primary: preference-groups
    actions: [save, reset-defaults]

# ═══════════════════════════════════════════════════════════════
# USER MENTAL MODEL - How users think about the space
# ═══════════════════════════════════════════════════════════════
mental-model:
  entry-points:
    - area: home
      context: "Default landing after login"
    - area: dashboard
      context: "Direct link from notification emails"
    - area: settings/security
      context: "Password reset flow"

  landmarks:
    - area: dashboard
      role: "Home base - always return here"
    - area: settings
      role: "Configuration hub"

  wayfinding:
    - from: anywhere
      to: home
      via: "Logo click or Home nav item"
    - from: dashboard
      to: settings
      via: "User menu dropdown"

# ═══════════════════════════════════════════════════════════════
# ROUTING - Technical routes (for implementation)
# ═══════════════════════════════════════════════════════════════
routes:
  /:
    area: home
    screen: home

  /dashboard:
    area: dashboard
    screen: dashboard

  /settings:
    area: settings
    screen: settings-overview

  /settings/profile:
    area: profile
    screen: profile-editor

  /settings/security:
    area: security
    screen: security-settings

  /admin:
    area: admin
    screen: admin-dashboard
    guard: requireAdmin

# ═══════════════════════════════════════════════════════════════
# NAVIGATION - UI navigation structure
# ═══════════════════════════════════════════════════════════════
navigation:
  primary:
    - area: home
      icon: home
    - area: dashboard
      icon: grid
    - area: settings
      icon: cog

  user-menu:
    - area: profile
    - area: security
    - action: logout

# ═══════════════════════════════════════════════════════════════
# CROSS-REFERENCES - How areas relate semantically
# ═══════════════════════════════════════════════════════════════
relationships:
  - from: dashboard
    to: profile
    type: "displays summary of"

  - from: settings
    to: dashboard
    type: "changes affect"

  - from: security
    to: profile
    type: "protects"
```

### Config: `config.yaml`

```yaml
# Universal config format for any content type
tags: [core, interactive]
category: inputs
status: stable           # draft | stable | deprecated
title: "Button"          # Display name (defaults to folder name)
description: "Primary action button component"
order: 1                 # Sort order within category
```

---

## Route Generation

| Folder Path | Generated Route |
|-------------|-----------------|
| `components/button/` | `/_preview/components/button` |
| `screens/login/` | `/_preview/screens/login` |
| `flows/onboarding/` | `/_preview/flows/onboarding` |
| `atlas/app/` | `/_preview/atlas/app` |

### Query Parameters

| Route | Parameters | Example |
|-------|------------|---------|
| Component | `?variant=...&size=...` | `?variant=secondary&size=lg` |
| Screen | `?state=...&viewport=...` | `?state=error&viewport=mobile` |
| Flow | `?step=...` | `?step=2` |
| Atlas | `?view=map\|tree\|navigate` | `?view=tree` |

### Filtering API

```
/_preview/components?tags=core
/_preview/components?category=inputs
/_preview/screens?status=stable
/_preview/?type=component,screen&tags=form
```

---

## Preview Shells

Each content type renders in a specialized preview shell.

### Component Shell

```
┌──────────────────────────────────────────────────────────┐
│  Button                                    [Props Panel] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌────────────┐                        │
│                    │  Click me  │                        │
│                    └────────────┘                        │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  variant: [primary ▾]  size: [md ▾]  disabled: [ ]       │
└──────────────────────────────────────────────────────────┘
```

Features:
- Live props playground
- Auto-generated from schema.ts or TypeScript types
- Copy code snippet button

### Screen Shell

```
┌──────────────────────────────────────────────────────────┐
│  Login              [default] [error] [loading]          │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │              (Full screen render)                  │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│         [📱 Mobile]  [💻 Tablet]  [🖥 Desktop]           │
└──────────────────────────────────────────────────────────┘
```

Features:
- State switcher (tabs for each .tsx file)
- Viewport toggle
- Full-screen mode

### Flow Shell

```
┌──────────────────────────────────────────────────────────┐
│  Onboarding Flow                            Step 2 of 4  │
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │           (Current step screen render)             │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  ← Previous          [● ● ○ ○]              Next →       │
│                                                          │
│  📝 "User submits credentials"                           │
│  🎯 Trigger: click "Log In"                              │
└──────────────────────────────────────────────────────────┘
```

Features:
- Step navigation (prev/next, dots)
- Step notes and trigger display
- Element highlighting (optional)

### Atlas Shell

The Atlas preview has multiple view modes:

**Map View** (default) - Visual sitemap
```
┌──────────────────────────────────────────────────────────┐
│  Main Application             [Map] [Tree] [Navigate]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│                    ┌──────────┐                          │
│                    │   Home   │ ← entry point            │
│                    └────┬─────┘                          │
│                         │                                │
│           ┌─────────────┼─────────────┐                  │
│           ▼             ▼             ▼                  │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│     │Dashboard │  │ Settings │  │  Admin   │            │
│     └──────────┘  └────┬─────┘  └──────────┘            │
│                        │                                 │
│              ┌─────────┼─────────┐                       │
│              ▼         ▼         ▼                       │
│         ┌────────┐ ┌────────┐ ┌────────┐                │
│         │Profile │ │Security│ │ Notifs │                │
│         └────────┘ └────────┘ └────────┘                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Click area to see details • Drag to rearrange           │
└──────────────────────────────────────────────────────────┘
```

**Tree View** - Hierarchical list with metadata
```
┌──────────────────────────────────────────────────────────┐
│  Main Application             [Map] [Tree] [Navigate]   │
├──────────────────────────────────────────────────────────┤
│  ▼ Home (/)                                              │
│    │ Entry point for most users                          │
│    │ Content: landing, quick-actions                     │
│    │                                                     │
│    ├─▶ Dashboard (/dashboard)                            │
│    │   Primary workspace                                 │
│    │   Content: user-stats, recent-activity              │
│    │                                                     │
│    └─▶ Settings (/settings)                              │
│        │ Configuration hub                               │
│        │                                                 │
│        ├─▶ Profile (/settings/profile)                   │
│        ├─▶ Security (/settings/security)                 │
│        └─▶ Notifications (/settings/notifications)       │
│                                                          │
│  ▶ Admin (/admin) 🔒                                     │
│    Restricted: admin-only                                │
└──────────────────────────────────────────────────────────┘
```

**Navigate View** - Interactive prototype mode
```
┌──────────────────────────────────────────────────────────┐
│  Main Application             [Map] [Tree] [Navigate]   │
├──────────────────────────────────────────────────────────┤
│  ┌──────┬─────────────────────────────────────────────┐  │
│  │ 🏠   │                                             │  │
│  │ 📊   │         (Active screen render)              │  │
│  │ ⚙️   │                                             │  │
│  └──────┴─────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  📍 Settings > Profile                                   │
│  🧭 Wayfinding: User menu → Profile                      │
└──────────────────────────────────────────────────────────┘
```

Features:
- **Map view**: D2/Mermaid-rendered sitemap, click to drill down
- **Tree view**: Expandable hierarchy with content model
- **Navigate view**: Interactive prototype with routing
- **Relationship visualization**: Show cross-references
- **Entry point markers**: Highlight how users arrive
- **Access indicators**: Show restricted areas

---

## Discovery & Scanning

### Scanner Implementation

```typescript
// Pseudocode for preview scanner
interface PreviewUnit {
  type: 'component' | 'screen' | 'flow' | 'atlas'
  name: string
  path: string
  route: string
  config: ConfigYaml | null
  files: {
    index: string           // Main file
    states?: string[]       // For screens: additional state files
    schema?: string         // For components: schema.ts
    docs?: string           // docs.mdx
  }
}

async function scanPreviews(root: string): Promise<PreviewUnit[]> {
  const types = ['components', 'screens', 'flows', 'atlas']
  const units: PreviewUnit[] = []

  for (const type of types) {
    const typeDir = path.join(root, 'previews', type)
    if (!existsSync(typeDir)) continue

    const folders = await readdir(typeDir)
    for (const folder of folders) {
      const unitPath = path.join(typeDir, folder)
      const unit = await parseUnit(type, folder, unitPath)
      if (unit) units.push(unit)
    }
  }

  return units
}
```

### Virtual Module

```typescript
// virtual:prev-previews
export const previews = [
  { type: 'component', name: 'button', route: '/_preview/components/button', ... },
  { type: 'screen', name: 'login', route: '/_preview/screens/login', states: ['default', 'error', 'loading'], ... },
  ...
]

export function getByTags(tags: string[]): PreviewUnit[]
export function getByCategory(category: string): PreviewUnit[]
export function getByType(type: string): PreviewUnit[]
```

---

## json-render Compatibility

While this design is human-authoring first, it can integrate with json-render concepts:

### AI Generation Mode

When AI generates content, it produces JSON matching the catalog:

```typescript
// Catalog derived from discovered components
const catalog = createCatalog({
  Button: { props: buttonSchema, actions: ['onClick'] },
  Card: { props: cardSchema, children: ['Button', 'Text'] },
  // ... auto-generated from components/*/schema.ts
})

// AI prompt includes catalog
const prompt = generateCatalogPrompt(catalog)
// "Available components: Button (variant, size, label), Card (title, children)..."

// AI generates JSON
{
  "type": "Screen",
  "props": { "name": "Generated Dashboard" },
  "children": [
    { "type": "Card", "props": { "title": "Stats" }, "children": [...] }
  ]
}
```

### JSON to TSX Conversion

Generated JSON can be saved as TSX files in the folder structure:

```typescript
// Convert JSON to TSX and save
const tsx = jsonToTsx(generatedJson)
await writeFile('screens/generated-dashboard/index.tsx', tsx)
// Now discoverable by scanner
```

---

## Progressive Adoption

Users can start with any type they need:

| Starting Point | What to Create |
|----------------|----------------|
| "I want to document components" | Create `previews/components/` |
| "I want to show page mockups" | Create `previews/screens/` |
| "I want to document a user flow" | Create `previews/flows/` |
| "I want to map my app structure" | Create `previews/atlas/` |

No need to use all types. Each type works independently.

---

## Implementation Tasks

1. **Scanner** - Extend `src/vite/previews.ts` to scan all four types
2. **Config Parser** - Add YAML config parsing with schema validation
3. **Route Generator** - Generate routes per type
4. **Preview Shells** - Create React shells for each type:
   - `ComponentPreview.tsx`
   - `ScreenPreview.tsx`
   - `FlowPreview.tsx`
   - `RegionPreview.tsx`
5. **Virtual Module** - Expose discovered previews with filtering API
6. **Props Playground** - Auto-generate from schemas
7. **Flow Navigator** - Step-through UI with highlights

---

## Open Questions

1. **Nested atlas areas** - Should atlas support deeply nested area hierarchies?
2. **Cross-flow references** - Can flows reference other flows?
3. **Theme switching** - How to handle light/dark mode in previews?
4. **Hot reload** - What triggers re-scan during development?
5. **Build output** - Static export of previews for hosting?

---

## References

- [json-render](https://github.com/vercel-labs/json-render) - AI → JSON → UI framework
- [Storybook](https://storybook.js.org/) - Component documentation
- [Figma Prototypes](https://www.figma.com/prototyping/) - Flow-based prototyping
