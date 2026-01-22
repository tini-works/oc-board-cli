import React, { useState, useEffect } from 'react'
import type { PreviewUnit } from '../../vite/preview-types'

interface ComponentPreviewProps {
  unit: PreviewUnit
}

export function ComponentPreview({ unit }: ComponentPreviewProps) {
  const [props, setProps] = useState<Record<string, unknown>>({})
  const [schema, setSchema] = useState<unknown>(null)

  // Load schema if available
  useEffect(() => {
    if (unit.files.schema) {
      import(`/_preview/components/${unit.name}/${unit.files.schema}`)
        .then(mod => setSchema(mod.schema))
        .catch(() => {})
    }
  }, [unit])

  const iframeUrl = `/_preview-runtime?preview=components/${unit.name}`

  // Status badge colors
  const getStatusStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'stable':
        return { backgroundColor: 'oklch(0.85 0.15 145)', color: 'oklch(0.30 0.10 145)' }
      case 'deprecated':
        return { backgroundColor: 'oklch(0.85 0.15 25)', color: 'oklch(0.35 0.15 25)' }
      default: // draft
        return { backgroundColor: 'oklch(0.85 0.15 85)', color: 'oklch(0.35 0.10 85)' }
    }
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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'var(--fd-muted)',
        borderBottom: '1px solid var(--fd-border)',
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--fd-foreground)',
          }}>
            {unit.config?.title || unit.name}
          </h2>
          {unit.config?.description && (
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--fd-muted-foreground)',
            }}>
              {unit.config.description}
            </p>
          )}
        </div>
        {unit.config?.status && (
          <span style={{
            padding: '4px 8px',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: '4px',
            ...getStatusStyle(unit.config.status),
          }}>
            {unit.config.status}
          </span>
        )}
      </div>

      {/* Preview area */}
      <div style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        backgroundColor: 'var(--fd-background)',
        backgroundImage: 'linear-gradient(45deg, var(--fd-border) 25%, transparent 25%), linear-gradient(-45deg, var(--fd-border) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--fd-border) 75%), linear-gradient(-45deg, transparent 75%, var(--fd-border) 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          minHeight: '200px',
          backgroundColor: 'var(--fd-background)',
        }}>
          <iframe
            src={iframeUrl}
            style={{
              border: 'none',
              width: '100%',
              height: '100%',
              minHeight: '200px',
            }}
            title={`Preview: ${unit.name}`}
          />
        </div>
      </div>

      {/* Props panel */}
      {schema && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--fd-border)',
          backgroundColor: 'var(--fd-muted)',
        }}>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--fd-foreground)',
          }}>
            Props
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
            fontSize: '14px',
          }}>
            {/* TODO: Generate controls from schema */}
            <pre style={{
              margin: 0,
              padding: '8px',
              fontSize: '12px',
              backgroundColor: 'var(--fd-card)',
              borderRadius: '4px',
              fontFamily: 'var(--fd-font-mono)',
              overflow: 'auto',
            }}>
              {JSON.stringify(props, null, 2)}
            </pre>
          </div>
        </div>
      )}

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
