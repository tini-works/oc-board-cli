declare module 'virtual:prev-pages' {
  export interface Page {
    route: string
    title: string
    file: string
    description?: string
    frontmatter?: Record<string, unknown>
  }

  export interface SidebarItem {
    title: string
    route?: string
    children?: SidebarItem[]
  }

  export const pages: Page[]
  export const sidebar: SidebarItem[]
}

declare module 'virtual:prev-page-modules' {
  import type { ComponentType } from 'react'
  export const pageModules: Record<string, { default: ComponentType }>
}

declare module 'virtual:prev-previews' {
  import type { PreviewUnit } from '../vite/preview-types'

  export interface Preview {
    name: string
    route: string
    htmlPath: string
  }

  // Multi-type preview units
  export const previewUnits: PreviewUnit[]

  // Legacy flat previews (backwards compatibility)
  export const previews: Preview[]

  // Filtering helpers
  export function getByType(type: string): PreviewUnit[]
  export function getByTags(tags: string[]): PreviewUnit[]
  export function getByCategory(category: string): PreviewUnit[]
  export function getByStatus(status: string): PreviewUnit[]
}

declare module 'virtual:prev-config' {
  import type { PrevConfig } from '../config'
  export const config: PrevConfig
}

declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const component: ComponentType
  export default component
}

declare module '*.md' {
  import type { ComponentType } from 'react'
  const component: ComponentType
  export default component
}

// Vite's import.meta.glob support
interface ImportMeta {
  glob<T = unknown>(
    pattern: string,
    options?: { eager?: boolean; import?: string }
  ): Record<string, T>
}
