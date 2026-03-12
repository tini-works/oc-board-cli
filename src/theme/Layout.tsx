import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import type { PageTree } from 'fumadocs-core/server'
import { config } from 'virtual:prev-config'
import { Toolbar } from './Toolbar'
import { TOCPanel } from './TOCPanel'
import { CRPanel } from './CRPanel'
import { IconSprite } from './icons'
import { StatusDropdown } from './previews/StatusDropdown'
import { useApprovalStatus } from './hooks/useApprovalStatus'
import { useCRContext } from './hooks/useCRContext'
import { crGroups } from 'virtual:prev-crs'
import './Toolbar.css'
import './TOCPanel.css'
import './CRPanel.css'

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

function NewBoardButton() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const handleNewBoard = async () => {
    if (creating) return
    setCreating(true)
    try {
      // Generate a short unique board ID
      const boardId = Math.random().toString(36).slice(2, 10)
      // Eagerly create the board on the server
      await fetch(`/__prev/board/${boardId}`)
      navigate({ to: `/board/${boardId}` })
    } catch {
      // Still navigate — board is created lazily on GET
      const boardId = Math.random().toString(36).slice(2, 10)
      navigate({ to: `/board/${boardId}` })
    } finally {
      setCreating(false)
    }
  }

  return (
    <button
      onClick={handleNewBoard}
      disabled={creating}
      className="new-board-btn"
      title="Create a new board"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {creating ? 'Creating…' : 'New Board'}
    </button>
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
  const location = useLocation()
  // ?embed=1 — strip all chrome (header, toolbar, sidebar) for iframe use
  const isEmbed = new URLSearchParams(location.search).has('embed')

  const [tocOpen, setTocOpen] = useState(false)
  const [crOpen, setCrOpen] = useState(false)

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
  const handleTocToggle = () => { setTocOpen(!tocOpen); setCrOpen(false) }
  const handleCRToggle = () => { setCrOpen(!crOpen); setTocOpen(false) }

  // Embed mode: just content, no chrome
  if (isEmbed) {
    return (
      <div className="prev-embed-content">
        {children}
      </div>
    )
  }

  return (
    <div className="prev-layout-floating">
      <IconSprite />
      <header className="prev-top-header">
        <div className="prev-top-header-right">
          <NewBoardButton />
        </div>
      </header>
      <Toolbar
        tree={tree}
        onThemeToggle={handleThemeToggle}
        onWidthToggle={handleWidthToggle}
        isDark={isDark}
        isFullWidth={isFullWidth}
        onTocToggle={handleTocToggle}
        tocOpen={tocOpen}
        onCRToggle={handleCRToggle}
        crOpen={crOpen}
        hasCRs={crGroups.length > 0}
      />
      <PageApprovalBadge />
      <CRContextBanner />
      {tocOpen && (
        <TOCPanel
          tree={tree}
          onClose={() => setTocOpen(false)}
        />
      )}
      {crOpen && (
        <CRPanel onClose={() => setCrOpen(false)} />
      )}
      <main className="prev-main-floating prev-main-with-header">
        {children}
      </main>
    </div>
  )
}
