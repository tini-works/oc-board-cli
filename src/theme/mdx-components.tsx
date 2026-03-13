import React from 'react'
import { Link } from '@tanstack/react-router'
import { Preview } from './Preview'
import { A2UIPreview } from './A2UIPreview'
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
  const isDev = import.meta.env.DEV ?? false

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

// Responsive table wrapper for horizontal scrolling on mobile
function MdxTable({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    // Check if table overflows and add class for scroll indicator
    const checkOverflow = () => {
      const hasOverflow = wrapper.scrollWidth > wrapper.clientWidth
      wrapper.classList.toggle('has-scroll', hasOverflow && wrapper.scrollLeft < wrapper.scrollWidth - wrapper.clientWidth - 1)
    }

    checkOverflow()
    wrapper.addEventListener('scroll', checkOverflow)
    window.addEventListener('resize', checkOverflow)

    return () => {
      wrapper.removeEventListener('scroll', checkOverflow)
      window.removeEventListener('resize', checkOverflow)
    }
  }, [])

  return (
    <div ref={wrapperRef} className="table-wrapper">
      <table {...props}>{children}</table>
    </div>
  )
}

export const mdxComponents = {
  Preview,
  A2UIPreview,
  a: MdxLink,
  table: MdxTable,
}
