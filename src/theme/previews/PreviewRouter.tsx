import React from 'react'
import { previewUnits, getByType } from 'virtual:prev-previews'
import { ComponentPreview } from './ComponentPreview'
import { ScreenPreview } from './ScreenPreview'
import { FlowPreview } from './FlowPreview'
import type { PreviewUnit } from '../../content/preview-types'

interface PreviewRouterProps {
  type: string
  name: string
}

export function PreviewRouter({ type, name }: PreviewRouterProps) {
  const unit = previewUnits.find(u => u.type === type && u.name === name)

  if (!unit) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
      }}>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--fd-foreground)',
        }}>
          Preview not found
        </h2>
        <p style={{
          margin: 0,
          fontSize: '14px',
          color: 'var(--fd-muted-foreground)',
        }}>
          No {type} named "{name}" found in previews/{type}s/{name}/
        </p>
      </div>
    )
  }

  switch (unit.type) {
    case 'component':
      return <ComponentPreview unit={unit} />
    case 'screen':
      return <ScreenPreview unit={unit} />
    case 'flow':
      return <FlowPreview unit={unit} />
    default:
      return (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--fd-muted-foreground)',
        }}>
          Unknown preview type: {unit.type}
        </div>
      )
  }
}

// Preview list component for browsing
export function PreviewList({ type }: { type?: string }) {
  const units = type ? getByType(type) : previewUnits

  const grouped = units.reduce((acc, unit) => {
    const key = unit.type
    if (!acc[key]) acc[key] = []
    acc[key].push(unit)
    return acc
  }, {} as Record<string, PreviewUnit[]>)

  if (units.length === 0) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: 'var(--fd-muted-foreground)',
      }}>
        {type ? `No ${type} previews found` : 'No previews found'}
      </div>
    )
  }

  return (
    <div style={{
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
    }}>
      {Object.entries(grouped).map(([groupType, groupUnits]) => (
        <div key={groupType}>
          <h2 style={{
            margin: '0 0 16px 0',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--fd-foreground)',
            textTransform: 'capitalize',
          }}>
            {groupType}s
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {groupUnits.map(unit => (
              <a
                key={unit.route}
                href={unit.route}
                style={{
                  display: 'block',
                  padding: '16px',
                  border: '1px solid var(--fd-border)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--fd-background)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--fd-foreground)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--fd-border)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <h3 style={{
                  margin: '0 0 4px 0',
                  fontSize: '16px',
                  fontWeight: 500,
                  color: 'var(--fd-foreground)',
                }}>
                  {unit.config?.title || unit.name}
                </h3>
                {unit.config?.description && (
                  <p style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    color: 'var(--fd-muted-foreground)',
                    lineHeight: 1.5,
                  }}>
                    {unit.config.description}
                  </p>
                )}
                {unit.config?.tags && unit.config.tags.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    flexWrap: 'wrap',
                  }}>
                    {unit.config.tags.slice(0, 3).map(tag => (
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
                    {unit.config.tags.length > 3 && (
                      <span style={{
                        padding: '2px 8px',
                        fontSize: '12px',
                        color: 'var(--fd-muted-foreground)',
                      }}>
                        +{unit.config.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
