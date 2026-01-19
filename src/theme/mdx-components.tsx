import React from 'react'
import { Link } from '@tanstack/react-router'
import { Preview } from './Preview'
import { pages } from 'virtual:prev-pages'

// Get valid routes from pages
const validRoutes = new Set(pages.map((p: { route: string }) => p.route))

// Also add /previews routes
validRoutes.add('/previews')

// Check if a path is an internal link
function isInternalLink(href: string): boolean {
  if (!href) return false
  // External links start with http://, https://, mailto:, tel:, etc.
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return false
  // Relative or absolute internal paths
  return href.startsWith('/') || !href.includes(':')
}

// Check if an internal route exists
function routeExists(href: string): boolean {
  if (!href) return true
  // Remove hash and query string
  const path = href.split(/[?#]/)[0]
  // Check exact match or if it's a valid preview route
  if (validRoutes.has(path)) return true
  // Check if it starts with /previews/ (dynamic preview routes)
  if (path.startsWith('/previews/')) return true
  return false
}

// Custom link component that validates internal links and uses router
function MdxLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isInternal = isInternalLink(href || '')
  const isDev = import.meta.env?.DEV ?? false

  // For internal links, use TanStack Router's Link
  if (isInternal && href) {
    const exists = routeExists(href)

    // In dev mode, show warning for dead links
    if (isDev && !exists) {
      return (
        <span
          className="dead-link"
          title={`Dead link: "${href}" does not match any known route`}
          {...props}
        >
          {children}
          <span className="dead-link-icon" aria-label="Dead link">⚠️</span>
        </span>
      )
    }

    return (
      <Link to={href} {...props}>
        {children}
      </Link>
    )
  }

  // External links open in new tab
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  )
}

export const mdxComponents = {
  Preview,
  a: MdxLink,
}
