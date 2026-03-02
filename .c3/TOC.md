# C3 Table of Contents

## System Context

- [System Overview](./README.md)

## Containers

| ID | Container | Description | README |
|----|-----------|-------------|--------|
| c3-1 | CLI | Command-line interface, configuration loading, validation | [README](./c3-1-cli/README.md) |
| c3-2 | Build | Bun-based build system with plugins for pages, previews, MDX | [README](./c3-2-build/README.md) |
| c3-3 | Theme | React frontend: layout, routing, MDX components, styling | [README](./c3-3-theme/README.md) |
| c3-4 | Previews | Preview catalog, type-specific viewers, render adapters | [README](./c3-4-previews/README.md) |
| c3-5 | JSX | JSX primitives for renderer-agnostic layouts | [README](./c3-5-jsx/README.md) |
| c3-6 | Primitives | Template-based layout primitives | [README](./c3-6-primitives/README.md) |
| c3-7 | Tokens | Design token system with shadcn defaults and user overrides | [README](./c3-7-tokens/README.md) |

## Components by Container

### c3-1: CLI

| ID | Component | Category | Description |
|----|-----------|----------|-------------|
| c3-101 | [cli-entry](./c3-1-cli/c3-101-cli-entry.md) | foundation | CLI argument parsing and command dispatch |
| c3-102 | [config-loader](./c3-1-cli/c3-102-config-loader.md) | foundation | Configuration loading and validation |
| c3-103 | [validator](./c3-1-cli/c3-103-validator.md) | foundation | Project structure validation |
| c3-104 | [typechecker](./c3-1-cli/c3-104-typechecker.md) | feature | Type checking integration |

### c3-2: Build

| ID | Component | Category | Description |
|----|-----------|----------|-------------|
| c3-202 | [pages-plugin](./c3-2-build/c3-202-pages-plugin.md) | feature | Page discovery and sidebar generation |
| c3-203 | [previews-plugin](./c3-2-build/c3-203-previews-plugin.md) | feature | Preview catalog discovery |
| c3-205 | [config-plugin](./c3-2-build/c3-205-config-plugin.md) | foundation | Runtime config injection |
| c3-206 | [mdx-plugin](./c3-2-build/c3-206-mdx-plugin.md) | foundation | MDX transformation pipeline |
| c3-207 | [preview-runtime](./c3-2-build/c3-207-preview-runtime.md) | feature | Preview build with Bun.build + Tailwind |
| c3-208 | [tokens-plugin](./c3-2-build/c3-208-tokens-plugin.md) | foundation | Design token delivery via virtual module + dev endpoint |
| c3-209 | [dev-server](./c3-2-build/c3-209-dev-server.md) | foundation | Dev server with SSE live reload |
| c3-210 | [build](./c3-2-build/c3-210-build.md) | foundation | Production static site generator |
| c3-211 | [preview-server](./c3-2-build/c3-211-preview-server.md) | foundation | Static file server for production builds |
| c3-212 | [aliases-plugin](./c3-2-build/c3-212-aliases-plugin.md) | foundation | Module resolution and React deduplication |

### c3-3: Theme

| ID | Component | Category | Description |
|----|-----------|----------|-------------|
| c3-301 | [entry](./c3-3-theme/c3-301-entry.md) | foundation | Theme entry point |
| c3-302 | [layout](./c3-3-theme/c3-302-layout.md) | foundation | Layout components |
| c3-303 | [mdx-provider](./c3-3-theme/c3-303-mdx-provider.md) | foundation | MDX provider setup |
| c3-304 | [toolbar](./c3-3-theme/c3-304-toolbar.md) | feature | Toolbar UI component |
| c3-305 | [sidebar](./c3-3-theme/c3-305-sidebar.md) | feature | Sidebar navigation |

### c3-4: Previews

| ID | Component | Category | Description |
|----|-----------|----------|-------------|
| c3-401 | [preview-router](./c3-4-previews/c3-401-preview-router.md) | foundation | Preview routing logic |
| c3-402 | [component-viewer](./c3-4-previews/c3-402-component-viewer.md) | feature | Component preview viewer |
| c3-403 | [screen-viewer](./c3-4-previews/c3-403-screen-viewer.md) | feature | Screen preview viewer |
| c3-404 | [flow-viewer](./c3-4-previews/c3-404-flow-viewer.md) | feature | Flow preview viewer |
| c3-406 | [render-adapter](./c3-4-previews/c3-406-render-adapter.md) | foundation | Renderer adaptation |

### c3-5: JSX

| ID | Component | Category | Description |
|----|-----------|----------|-------------|
| c3-501 | [vnode](./c3-5-jsx/c3-501-vnode.md) | foundation | VNode structure |
| c3-502 | [jsx-runtime](./c3-5-jsx/c3-502-jsx-runtime.md) | foundation | JSX runtime |
| c3-503 | [define-component](./c3-5-jsx/c3-503-define-component.md) | feature | Component definition |
| c3-504 | [html-adapter](./c3-5-jsx/c3-504-html-adapter.md) | foundation | HTML adapter |

### c3-6: Primitives

| ID | Component | Category | Description |
|----|-----------|----------|-------------|
| c3-601 | [types](./c3-6-primitives/c3-601-types.md) | foundation | Type definitions |
| c3-602 | [parser](./c3-6-primitives/c3-602-parser.md) | foundation | Template parser |
| c3-603 | [template-parser](./c3-6-primitives/c3-603-template-parser.md) | foundation | Template syntax parser |
| c3-604 | [template-renderer](./c3-6-primitives/c3-604-template-renderer.md) | foundation | Template renderer |

### c3-7: Tokens

| ID | Component | Category | Description |
|----|-----------|----------|-------------|
| c3-701 | [resolver](./c3-7-tokens/c3-701-resolver.md) | foundation | Token resolution with YAML parsing and deep merge |
| c3-702 | [defaults](./c3-7-tokens/c3-702-defaults.md) | foundation | Default shadcn design token values |
| c3-703 | [validation](./c3-7-tokens/c3-703-validation.md) | foundation | Token validation with fuzzy suggestions |

## References

| ID | Reference | Description |
|----|-----------|-------------|
| ref-1 | [config-schema](./refs/ref-config-schema.md) | Configuration structure and validation |
| ref-2 | [preview-types](./refs/ref-preview-types.md) | Type system for previews |
| ref-3 | [theming](./refs/ref-theming.md) | Theme and styling patterns |
| ref-4 | [virtual-modules](./refs/ref-virtual-modules.md) | Virtual module patterns |
| ref-5 | [capabilities](./refs/ref-capabilities.md) | Capability checklist and verification |

## Architecture Decision Records

| ID | ADR | Status | Date |
|----|-----|--------|------|
| ADR-000 | [C3 Adoption](./adr/adr-00000000-c3-adoption.md) | implemented | 2026-01-30 |
| ADR-001 | [E-commerce Demos](./adr/adr-20260126-ecommerce-demos.md) | deprecated | 2026-01-26 |
| ADR-002 | [Embedded Typecheck](./adr/adr-20260126-embedded-typecheck.md) | implemented | 2026-01-26 |
| ADR-003 | [Bun Migration](./adr/adr-20260227-bun-migration.md) | implemented | 2026-02-27 |
