import React, { useState, useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import type { PageTree } from 'fumadocs-core/server'
import { config } from 'virtual:prev-config'
import { Toolbar } from './Toolbar'
import { TOCPanel } from './TOCPanel'
import { IconSprite } from './icons'
import { StatusDropdown } from './previews/StatusDropdown'
import { useApprovalStatus } from './hooks/useApprovalStatus'
import { useCRContext } from './hooks/useCRContext'
import './Toolbar.css'
import './TOCPanel.css'

interface LayoutProps {
  tree: PageTree.Root
  children: React.ReactNode
}

function PageApprovalBadge() {
  const location = useLocation()
  // Use the current URL path as the page identifier
  const pageId = `page:${location.pathname}`
  const { status, changeStatus, getAuditLog } = useApprovalStatus(pageId)

  // Only show if approval is enabled (default: true) and not on preview routes
  const isPreviewRoute = location.pathname.startsWith('/previews')
  const approvalEnabled = config.approval?.enabled !== false

  if (isPreviewRoute || !approvalEnabled) return null

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 40,
    }}>
      <StatusDropdown
        previewName={pageId}
        status={status}
        onStatusChange={changeStatus}
        getAuditLog={getAuditLog}
      />
    </div>
  )
}

function CRContextBanner() {
  const ctx = useCRContext()
  if (!ctx) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
      color: '#fff',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '13px',
      fontFamily: 'monospace',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.2)',
    }}>
      <span style={{ fontWeight: 700 }}>🔀 CR Preview</span>
      <span style={{ opacity: 0.8 }}>|</span>
      <span><strong>{ctx.cr_id}</strong> · {ctx.slug}</span>
      <span style={{ opacity: 0.8 }}>|</span>
      <span>branch: <code style={{ background: 'rgba(255,255,255,0.15)', padding: '1px 4px', borderRadius: 3 }}>{ctx.branch}</code></span>
      {ctx.pr_url && (
        <>
          <span style={{ opacity: 0.8 }}>|</span>
          <a
            href={ctx.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#fff', textDecoration: 'underline', fontWeight: 600 }}
          >
            PR #{ctx.pr_number} →
          </a>
        </>
      )}
      {ctx.user && (
        <>
          <span style={{ opacity: 0.8 }}>|</span>
          <span>by {ctx.user}</span>
        </>
      )}
      <span style={{ marginLeft: 'auto', opacity: 0.6, fontSize: '11px' }}>
        This is a draft preview. Review + approve on GitHub PR.
      </span>
    </div>
  )
}

export function Layout({ tree, children }: LayoutProps) {
  const [tocOpen, setTocOpen] = useState(false)

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false
    if (config.theme === 'dark') return true
    if (config.theme === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [isFullWidth, setIsFullWidth] = useState(() => {
    return config.contentWidth === 'full'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  useEffect(() => {
    document.documentElement.classList.toggle('full-width', isFullWidth)
  }, [isFullWidth])

  const handleThemeToggle = () => setIsDark(!isDark)
  const handleWidthToggle = () => setIsFullWidth(!isFullWidth)
  const handleTocToggle = () => setTocOpen(!tocOpen)

  return (
    <div className="prev-layout-floating">
      <IconSprite />
      <Toolbar
        tree={tree}
        onThemeToggle={handleThemeToggle}
        onWidthToggle={handleWidthToggle}
        isDark={isDark}
        isFullWidth={isFullWidth}
        onTocToggle={handleTocToggle}
        tocOpen={tocOpen}
      />
      <PageApprovalBadge />
      <CRContextBanner />
      {tocOpen && (
        <TOCPanel
          tree={tree}
          onClose={() => setTocOpen(false)}
        />
      )}
      <main className="prev-main-floating">
        {children}
      </main>
    </div>
  )
}
