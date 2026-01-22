import React, { useState } from 'react'
import type { PreviewUnit } from '../../vite/preview-types'

interface ScreenPreviewProps {
  unit: PreviewUnit
  initialState?: string
}

type Viewport = 'mobile' | 'tablet' | 'desktop'

const viewports: Record<Viewport, { width: number; label: string }> = {
  mobile: { width: 375, label: 'Mobile' },
  tablet: { width: 768, label: 'Tablet' },
  desktop: { width: 1280, label: 'Desktop' },
}

export function ScreenPreview({ unit, initialState }: ScreenPreviewProps) {
  const states = ['index', ...(unit.files.states || []).map(s => s.replace(/\.(tsx|jsx)$/, ''))]
  const [activeState, setActiveState] = useState(initialState || 'index')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [isFullscreen, setIsFullscreen] = useState(false)

  const iframeUrl = `/_preview-runtime?preview=screens/${unit.name}&state=${activeState}`

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'var(--fd-background)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--fd-border)',
          backgroundColor: 'var(--fd-muted)',
        }}>
          <span style={{
            fontWeight: 500,
            fontSize: '14px',
            color: 'var(--fd-foreground)',
          }}>
            {unit.name} / {activeState === 'index' ? 'default' : activeState}
          </span>
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--fd-foreground)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Close
          </button>
        </div>
        <iframe
          src={iframeUrl}
          style={{
            width: '100%',
            flex: 1,
            border: 'none',
          }}
          title={`Screen: ${unit.name}`}
        />
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--fd-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: 'var(--fd-background)',
    }}>
      {/* Header with state tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'var(--fd-muted)',
        borderBottom: '1px solid var(--fd-border)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--fd-foreground)',
          }}>
            {unit.config?.title || unit.name}
          </h2>

          {/* State tabs */}
          <div style={{
            display: 'flex',
            gap: '4px',
          }}>
            {states.map(state => (
              <button
                key={state}
                onClick={() => setActiveState(state)}
                style={{
                  padding: '4px 12px',
                  fontSize: '13px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: activeState === state ? 'var(--fd-primary)' : 'transparent',
                  color: activeState === state ? 'var(--fd-primary-foreground)' : 'var(--fd-muted-foreground)',
                  fontWeight: activeState === state ? 500 : 400,
                  transition: 'background-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (activeState !== state) {
                    e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'
                    e.currentTarget.style.color = 'var(--fd-foreground)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeState !== state) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = 'var(--fd-muted-foreground)'
                  }
                }}
              >
                {state === 'index' ? 'default' : state}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setIsFullscreen(true)}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            border: '1px solid var(--fd-border)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--fd-muted-foreground)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'
            e.currentTarget.style.color = 'var(--fd-foreground)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--fd-muted-foreground)'
          }}
          title="Fullscreen"
        >
          Fullscreen
        </button>
      </div>

      {/* Description if available */}
      {unit.config?.description && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--fd-border)',
          backgroundColor: 'var(--fd-background)',
        }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--fd-muted-foreground)',
          }}>
            {unit.config.description}
          </p>
        </div>
      )}

      {/* Preview with viewport */}
      <div style={{
        padding: '24px',
        backgroundColor: 'var(--fd-muted)',
        display: 'flex',
        justifyContent: 'center',
        overflow: 'auto',
        minHeight: '400px',
      }}>
        <div
          style={{
            width: viewports[viewport].width,
            maxWidth: '100%',
            backgroundColor: 'var(--fd-background)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            borderRadius: '4px',
            overflow: 'hidden',
            transition: 'width 0.3s ease',
          }}
        >
          <iframe
            src={iframeUrl}
            style={{
              width: '100%',
              height: '600px',
              border: 'none',
              display: 'block',
            }}
            title={`Screen: ${unit.name} - ${activeState}`}
          />
        </div>
      </div>

      {/* Viewport toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        padding: '12px',
        borderTop: '1px solid var(--fd-border)',
        backgroundColor: 'var(--fd-muted)',
      }}>
        {(Object.entries(viewports) as [Viewport, typeof viewports[Viewport]][]).map(([key, { width, label }]) => (
          <button
            key={key}
            onClick={() => setViewport(key)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: viewport === key ? 'var(--fd-primary)' : 'transparent',
              color: viewport === key ? 'var(--fd-primary-foreground)' : 'var(--fd-muted-foreground)',
              fontWeight: viewport === key ? 500 : 400,
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (viewport !== key) {
                e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'
                e.currentTarget.style.color = 'var(--fd-foreground)'
              }
            }}
            onMouseLeave={(e) => {
              if (viewport !== key) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'var(--fd-muted-foreground)'
              }
            }}
            title={`${label} (${width}px)`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tags */}
      {unit.config?.tags && unit.config.tags.length > 0 && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--fd-border)',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {unit.config.tags.map(tag => (
            <span
              key={tag}
              style={{
                padding: '2px 8px',
                fontSize: '12px',
                backgroundColor: 'var(--fd-secondary)',
                color: 'var(--fd-secondary-foreground)',
                borderRadius: '4px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
