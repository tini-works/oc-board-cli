import React, { useState, useEffect } from 'react'
import type { PreviewUnit, AtlasDefinition } from '../../vite/preview-types'

interface AtlasNode {
  id: string
  title: string
  ref?: string
}

interface AtlasRelationship {
  from: string
  to: string
  type: string
}

interface AtlasConfig {
  title?: string
  description?: string
  nodes?: AtlasNode[]
  relationships?: AtlasRelationship[]
}

interface AtlasPreviewProps {
  unit: PreviewUnit
}

type ViewMode = 'tree' | 'map' | 'navigate'

// Transform new config format (nodes/relationships) to legacy hierarchy format
function transformToHierarchy(config: AtlasConfig): AtlasDefinition | null {
  if (!config.nodes || config.nodes.length === 0) return null

  // Build areas map from nodes
  const areas: Record<string, { title: string; children?: string[]; description?: string }> = {}
  for (const node of config.nodes) {
    areas[node.id] = { title: node.title, children: [] }
  }

  // Build parent-child relationships from 'contains' type relationships
  // or infer from relationship patterns
  const childrenMap: Record<string, string[]> = {}
  const hasParent = new Set<string>()

  if (config.relationships) {
    for (const rel of config.relationships) {
      if (rel.type === 'contains' || rel.type === 'parent') {
        if (!childrenMap[rel.from]) childrenMap[rel.from] = []
        childrenMap[rel.from].push(rel.to)
        hasParent.add(rel.to)
      }
    }
  }

  // Apply children to areas
  for (const [parentId, children] of Object.entries(childrenMap)) {
    if (areas[parentId]) {
      areas[parentId].children = children
    }
  }

  // Find root (node with no parent, or first node)
  const root = config.nodes.find(n => !hasParent.has(n.id))?.id || config.nodes[0]?.id || 'root'

  return {
    name: config.title || 'Atlas',
    description: config.description,
    hierarchy: { root, areas },
    relationships: config.relationships,
  }
}

export function AtlasPreview({ unit }: AtlasPreviewProps) {
  const [atlas, setAtlas] = useState<AtlasDefinition | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load atlas definition - use config for static builds, fetch for dev
  useEffect(() => {
    const config = unit.config as AtlasConfig | undefined

    // Try to use embedded config first (for static builds)
    if (config?.nodes && config.nodes.length > 0) {
      const transformed = transformToHierarchy(config)
      if (transformed) {
        setAtlas(transformed)
        setSelectedArea(transformed.hierarchy?.root || null)
        setLoading(false)
        return
      }
    }

    // Fall back to fetching for dev mode
    fetch(`/_preview-config/atlas/${unit.name}`)
      .then(res => res.json())
      .then(data => {
        setAtlas(data)
        setSelectedArea(data.hierarchy?.root || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [unit.name, unit.config])

  if (loading) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: 'var(--fd-muted-foreground)',
      }}>
        Loading atlas...
      </div>
    )
  }

  if (!atlas || !atlas.hierarchy) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: 'oklch(0.65 0.15 85)',
      }}>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: 600,
        }}>
          {unit.config?.title || unit.name}
        </h2>
        <p style={{ margin: 0 }}>
          {atlas ? 'This atlas has no hierarchy defined.' : 'Failed to load atlas definition.'}
        </p>
      </div>
    )
  }

  // Fix 8: Tree view with cycle detection
  const renderTree = (areaId: string, depth = 0, visited = new Set<string>()): React.ReactNode => {
    // Cycle detection
    if (visited.has(areaId)) {
      return (
        <div
          key={`cycle-${areaId}-${depth}`}
          style={{
            marginLeft: `${depth * 24}px`,
            padding: '8px 12px',
            color: 'oklch(0.65 0.20 25)',
            fontSize: '14px',
          }}
        >
          Cycle detected: {areaId}
        </div>
      )
    }
    visited.add(areaId)

    const area = atlas.hierarchy.areas[areaId]
    if (!area) {
      return (
        <div
          key={`missing-${areaId}-${depth}`}
          style={{
            marginLeft: `${depth * 24}px`,
            padding: '8px 12px',
            color: 'var(--fd-muted-foreground)',
            fontSize: '14px',
            fontStyle: 'italic',
          }}
        >
          Missing area: {areaId}
        </div>
      )
    }

    const hasChildren = area.children && area.children.length > 0
    const isSelected = selectedArea === areaId

    return (
      <div key={`${areaId}-${depth}`}>
        <button
          onClick={() => setSelectedArea(areaId)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            textAlign: 'left',
            marginLeft: `${depth * 24}px`,
            padding: '8px 12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: isSelected ? 'var(--fd-primary)' : 'transparent',
            color: isSelected ? 'var(--fd-primary-foreground)' : 'var(--fd-foreground)',
            fontSize: '14px',
            fontWeight: isSelected ? 500 : 400,
            transition: 'background-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          <span style={{
            width: '16px',
            textAlign: 'center',
            color: isSelected ? 'var(--fd-primary-foreground)' : 'var(--fd-muted-foreground)',
          }}>
            {hasChildren ? (depth === 0 ? '/' : '+') : '-'}
          </span>
          <span>{area.title}</span>
          {area.access && (
            <span style={{
              marginLeft: 'auto',
              padding: '2px 6px',
              fontSize: '11px',
              borderRadius: '3px',
              backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--fd-muted)',
              color: isSelected ? 'var(--fd-primary-foreground)' : 'var(--fd-muted-foreground)',
            }}>
              {area.access}
            </span>
          )}
        </button>
        {hasChildren && area.children?.map(childId =>
          renderTree(childId, depth + 1, new Set(visited))
        )}
      </div>
    )
  }

  // Navigate view: sidebar + screen preview
  const renderNavigateView = () => {
    const selectedAreaData = selectedArea ? atlas.hierarchy.areas[selectedArea] : null
    const routes = atlas.routes || {}
    const areaRoutes = Object.entries(routes).filter(([, r]) => r.area === selectedArea)

    return (
      <div style={{
        display: 'flex',
        gap: '24px',
        padding: '24px',
        backgroundColor: 'var(--fd-muted)',
        minHeight: '400px',
      }}>
        {/* Sidebar */}
        <div style={{
          width: '280px',
          flexShrink: 0,
          backgroundColor: 'var(--fd-background)',
          borderRadius: '8px',
          padding: '16px',
          overflow: 'auto',
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--fd-foreground)',
          }}>
            Areas
          </h3>
          {renderTree(atlas.hierarchy.root)}
        </div>

        {/* Screen preview area */}
        <div style={{
          flex: 1,
          backgroundColor: 'var(--fd-background)',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {selectedAreaData ? (
            <>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{
                  margin: '0 0 4px 0',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--fd-foreground)',
                }}>
                  {selectedAreaData.title}
                </h3>
                {selectedAreaData.description && (
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'var(--fd-muted-foreground)',
                  }}>
                    {selectedAreaData.description}
                  </p>
                )}
              </div>

              {/* Routes in this area */}
              {areaRoutes.length > 0 ? (
                <div>
                  <h4 style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--fd-foreground)',
                  }}>
                    Routes
                  </h4>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}>
                    {areaRoutes.map(([path, route]) => (
                      <div
                        key={path}
                        style={{
                          padding: '12px',
                          backgroundColor: 'var(--fd-muted)',
                          borderRadius: '4px',
                          fontSize: '14px',
                        }}
                      >
                        <div style={{
                          fontFamily: 'var(--fd-font-mono)',
                          color: 'var(--fd-foreground)',
                          marginBottom: '4px',
                        }}>
                          {path}
                        </div>
                        <div style={{
                          display: 'flex',
                          gap: '8px',
                          color: 'var(--fd-muted-foreground)',
                          fontSize: '13px',
                        }}>
                          <span>Screen: {route.screen}</span>
                          {route.guard && <span>Guard: {route.guard}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--fd-muted-foreground)',
                  fontSize: '14px',
                }}>
                  No routes defined for this area
                </div>
              )}
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fd-muted-foreground)',
              fontSize: '14px',
            }}>
              Select an area to view details
            </div>
          )}
        </div>
      </div>
    )
  }

  // Map view: placeholder for future D2/Mermaid diagram
  const renderMapView = () => {
    return (
      <div style={{
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--fd-muted)',
        minHeight: '400px',
      }}>
        <div style={{
          padding: '24px 32px',
          backgroundColor: 'var(--fd-background)',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          <h3 style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--fd-foreground)',
          }}>
            Map View
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: 'var(--fd-muted-foreground)',
          }}>
            D2/Mermaid diagram visualization coming soon
          </p>
        </div>
      </div>
    )
  }

  // Tree view: full hierarchy
  const renderTreeView = () => {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: 'var(--fd-muted)',
      }}>
        <div style={{
          backgroundColor: 'var(--fd-background)',
          borderRadius: '8px',
          padding: '16px',
        }}>
          {renderTree(atlas.hierarchy.root)}
        </div>
      </div>
    )
  }

  const viewModeButtons: { mode: ViewMode; label: string }[] = [
    { mode: 'tree', label: 'Tree' },
    { mode: 'map', label: 'Map' },
    { mode: 'navigate', label: 'Navigate' },
  ]

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
            {atlas.name}
          </h2>
          {atlas.description && (
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--fd-muted-foreground)',
            }}>
              {atlas.description}
            </p>
          )}
        </div>

        {/* View mode toggle */}
        <div style={{
          display: 'flex',
          gap: '4px',
        }}>
          {viewModeButtons.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: viewMode === mode ? 'var(--fd-primary)' : 'transparent',
                color: viewMode === mode ? 'var(--fd-primary-foreground)' : 'var(--fd-muted-foreground)',
                fontWeight: viewMode === mode ? 500 : 400,
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (viewMode !== mode) {
                  e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'
                  e.currentTarget.style.color = 'var(--fd-foreground)'
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== mode) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--fd-muted-foreground)'
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'tree' && renderTreeView()}
      {viewMode === 'map' && renderMapView()}
      {viewMode === 'navigate' && renderNavigateView()}

      {/* Relationships section */}
      {atlas.relationships && atlas.relationships.length > 0 && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--fd-border)',
          backgroundColor: 'var(--fd-muted)',
        }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--fd-foreground)',
          }}>
            Relationships
          </h3>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            {atlas.relationships.map((rel, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--fd-background)',
                  borderRadius: '4px',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: 'var(--fd-foreground)' }}>
                  {atlas.hierarchy.areas[rel.from]?.title || rel.from}
                </span>
                <span style={{
                  padding: '2px 6px',
                  backgroundColor: 'var(--fd-secondary)',
                  borderRadius: '3px',
                  color: 'var(--fd-secondary-foreground)',
                  fontSize: '11px',
                }}>
                  {rel.type}
                </span>
                <span style={{ color: 'var(--fd-foreground)' }}>
                  {atlas.hierarchy.areas[rel.to]?.title || rel.to}
                </span>
              </div>
            ))}
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
