import React, { useState, useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import type { PageTree } from 'fumadocs-core/server'
import { config } from 'virtual:prev-config'
import { Toolbar } from './Toolbar'
import { TOCPanel } from './TOCPanel'
import { IconSprite } from './icons'
import { StatusDropdown } from './previews/StatusDropdown'
import { useApprovalStatus } from './hooks/useApprovalStatus'
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
