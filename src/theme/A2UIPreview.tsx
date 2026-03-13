import React, { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type TokenEntry = {
  type: 'token'
  id: string
  value: string
  usage?: string
}

type ComponentEntry = {
  type: 'component'
  id: string
  props?: Record<string, string>
  states?: Record<string, Record<string, unknown>>
}

type ScreenLayout = {
  type?: string
  children?: string[]
}

type ScreenEntry = {
  type: 'screen'
  id: string
  route?: string
  c3?: string
  platform?: string
  title?: string
  status?: string
  layout?: ScreenLayout
  states?: Record<string, Record<string, unknown>>
  ac?: string[]
}

type FlowStep = {
  screen: string
  action: string
  next?: string
  condition?: string
  effect?: string
}

type FlowEdgeCase = {
  scenario: string
  behavior: string
}

type FlowEntry = {
  type: 'flow'
  id: string
  c3?: string
  trigger?: string
  steps?: FlowStep[]
  edge_cases?: FlowEdgeCase[]
}

type A2UIEntry = TokenEntry | ComponentEntry | ScreenEntry | FlowEntry

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseJSONL(text: string): A2UIEntry[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .flatMap(line => {
      try { return [JSON.parse(line) as A2UIEntry] }
      catch { return [] }
    })
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function TokenCard({ entry }: { entry: TokenEntry }) {
  const isColor = /^#|^oklch|^rgb|^hsl/.test(entry.value.trim())
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 14px',
      borderRadius: '8px',
      border: '1px solid var(--fd-border)',
      backgroundColor: 'var(--fd-card)',
    }}>
      {isColor && (
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '6px',
          backgroundColor: entry.value,
          border: '1px solid var(--fd-border)',
          flexShrink: 0,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <code style={{
            fontSize: '12px',
            fontFamily: 'var(--fd-font-mono)',
            color: 'oklch(0.55 0.18 250)',
            backgroundColor: 'oklch(0.94 0.04 250)',
            padding: '1px 6px',
            borderRadius: '4px',
          }}>
            {entry.id}
          </code>
          <span style={{
            fontSize: '12px',
            fontFamily: 'var(--fd-font-mono)',
            color: 'var(--fd-muted-foreground)',
          }}>
            {entry.value}
          </span>
        </div>
        {entry.usage && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--fd-muted-foreground)' }}>
            {entry.usage}
          </p>
        )}
      </div>
    </div>
  )
}

function ComponentCard({ entry }: { entry: ComponentEntry }) {
  return (
    <div style={{
      borderRadius: '10px',
      border: '1px solid var(--fd-border)',
      overflow: 'hidden',
      backgroundColor: 'var(--fd-card)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--fd-border)',
        backgroundColor: 'var(--fd-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '14px' }}>⬡</span>
        <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fd-foreground)' }}>
          {entry.id}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '10px',
          padding: '2px 6px',
          backgroundColor: 'oklch(0.92 0.06 250)',
          color: 'oklch(0.45 0.18 250)',
          borderRadius: '4px',
          fontWeight: 500,
        }}>
          component
        </span>
      </div>

      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Props */}
        {entry.props && Object.keys(entry.props).length > 0 && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: 'var(--fd-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Props</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <tbody>
                {Object.entries(entry.props).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid var(--fd-border)' }}>
                    <td style={{ padding: '5px 8px 5px 0', fontFamily: 'var(--fd-font-mono)', color: 'oklch(0.50 0.18 250)', fontWeight: 500 }}>{k}</td>
                    <td style={{ padding: '5px 0', fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-muted-foreground)' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* States */}
        {entry.states && Object.keys(entry.states).length > 0 && (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, color: 'var(--fd-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>States</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(entry.states).map(([state, behavior]) => (
                <div key={state} style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: state === 'default' ? 'var(--fd-muted)' : 'oklch(0.94 0.05 250)',
                  border: '1px solid var(--fd-border)',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--fd-foreground)',
                }}>
                  {state}
                  {Object.keys(behavior).length > 0 && (
                    <span style={{ color: 'var(--fd-muted-foreground)', fontWeight: 400, marginLeft: '4px' }}>
                      ({Object.entries(behavior).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatesBadges({ states }: { states: Record<string, Record<string, unknown>> }) {
  const stateColors: Record<string, string> = {
    idle: 'var(--fd-muted)',
    loading: 'oklch(0.94 0.06 85)',
    error: 'oklch(0.95 0.05 25)',
    success: 'oklch(0.94 0.07 145)',
    empty: 'oklch(0.94 0.04 250)',
    submitting: 'oklch(0.94 0.06 85)',
  }
  const textColors: Record<string, string> = {
    idle: 'var(--fd-muted-foreground)',
    loading: 'oklch(0.45 0.15 85)',
    error: 'oklch(0.45 0.15 25)',
    success: 'oklch(0.40 0.15 145)',
    empty: 'oklch(0.45 0.18 250)',
    submitting: 'oklch(0.45 0.15 85)',
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {Object.entries(states).map(([state, behavior]) => {
        const effects: string[] = []
        const b = behavior as Record<string, unknown>
        if (b.show) effects.push(`show ${(b.show as string[]).join(', ')}`)
        if (b.hide) effects.push(`hide ${(b.hide as string[]).join(', ')}`)
        if (b.disable) effects.push(`disable ${(b.disable as string[]).join(', ')}`)
        return (
          <div key={state} style={{
            padding: '4px 10px',
            borderRadius: '20px',
            backgroundColor: stateColors[state] || 'var(--fd-muted)',
            border: '1px solid var(--fd-border)',
            fontSize: '11px',
            fontWeight: 600,
            color: textColors[state] || 'var(--fd-muted-foreground)',
          }}>
            {state}
            {effects.length > 0 && (
              <span style={{ fontWeight: 400, marginLeft: '4px' }}>
                → {effects.join('; ')}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScreenCard({ entry }: { entry: ScreenEntry }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{
      borderRadius: '12px',
      border: '1px solid var(--fd-border)',
      overflow: 'hidden',
      backgroundColor: 'var(--fd-card)',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '12px 16px',
          borderBottom: expanded ? '1px solid var(--fd-border)' : 'none',
          backgroundColor: 'var(--fd-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: 'linear-gradient(135deg, oklch(0.55 0.15 250) 0%, oklch(0.45 0.18 280) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          flexShrink: 0,
        }}>▣</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fd-foreground)' }}>
              {entry.title || entry.id}
            </span>
            {entry.status === 'deprecated' && (
              <span style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: 'oklch(0.93 0.06 25)', color: 'oklch(0.45 0.15 25)', borderRadius: '4px' }}>deprecated</span>
            )}
            {entry.platform && entry.platform !== 'both' && (
              <span style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: 'var(--fd-muted)', border: '1px solid var(--fd-border)', color: 'var(--fd-muted-foreground)', borderRadius: '4px' }}>{entry.platform}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            {entry.route && (
              <code style={{ fontSize: '11px', fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-muted-foreground)' }}>
                {entry.route}
              </code>
            )}
            {entry.c3 && (
              <span style={{ fontSize: '10px', color: 'var(--fd-muted-foreground)' }}>· {entry.c3}</span>
            )}
          </div>
        </div>
        <span style={{ color: 'var(--fd-muted-foreground)', fontSize: '12px' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Layout */}
          {entry.layout?.children && entry.layout.children.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 600, color: 'var(--fd-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Layout · {entry.layout.type || 'stack'}
              </p>
              <div style={{
                borderRadius: '8px',
                border: '1px solid var(--fd-border)',
                overflow: 'hidden',
                fontFamily: 'var(--fd-font-mono)',
                fontSize: '12px',
              }}>
                {entry.layout.children.map((child, i) => (
                  <div key={i} style={{
                    padding: '6px 12px',
                    borderBottom: i < entry.layout!.children!.length - 1 ? '1px solid var(--fd-border)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: i % 2 === 0 ? 'var(--fd-card)' : 'var(--fd-muted)',
                  }}>
                    <span style={{ color: 'var(--fd-muted-foreground)', fontSize: '10px' }}>{i + 1}</span>
                    <span style={{ color: 'oklch(0.50 0.18 250)' }}>{child}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* States */}
          {entry.states && Object.keys(entry.states).length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 600, color: 'var(--fd-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>States</p>
              <StatesBadges states={entry.states} />
            </div>
          )}

          {/* AC */}
          {entry.ac && entry.ac.length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 600, color: 'var(--fd-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Acceptance Criteria
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {entry.ac.map((ac, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--fd-muted)',
                    border: '1px solid var(--fd-border)',
                    fontSize: '12px',
                    color: 'var(--fd-foreground)',
                  }}>
                    <span style={{ flexShrink: 0, width: '14px', height: '14px', borderRadius: '3px', border: '1.5px solid var(--fd-border)', backgroundColor: 'var(--fd-background)', marginTop: '1px' }} />
                    <span>{ac}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FlowCard({ entry }: { entry: FlowEntry }) {
  return (
    <div style={{
      borderRadius: '12px',
      border: '1px solid var(--fd-border)',
      overflow: 'hidden',
      backgroundColor: 'var(--fd-card)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--fd-border)',
        backgroundColor: 'var(--fd-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: 'linear-gradient(135deg, oklch(0.55 0.18 165) 0%, oklch(0.45 0.20 200) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '14px',
          flexShrink: 0,
        }}>⇢</div>
        <div>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fd-foreground)' }}>{entry.id}</span>
          {entry.c3 && (
            <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--fd-muted-foreground)' }}>· {entry.c3}</span>
          )}
          {entry.trigger && (
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--fd-muted-foreground)', fontStyle: 'italic' }}>
              {entry.trigger}
            </p>
          )}
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Steps */}
        {entry.steps && entry.steps.length > 0 && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 600, color: 'var(--fd-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Steps</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {entry.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--fd-primary)',
                      color: 'var(--fd-primary-foreground)',
                      fontSize: '11px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>{i + 1}</div>
                    {i < entry.steps!.length - 1 && (
                      <div style={{ width: '2px', flex: 1, minHeight: '16px', backgroundColor: 'var(--fd-border)', margin: '2px 0' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: i < entry.steps!.length - 1 ? '12px' : '0' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <code style={{ backgroundColor: 'oklch(0.94 0.04 250)', color: 'oklch(0.45 0.18 250)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--fd-font-mono)' }}>
                        {step.screen}
                      </code>
                      <span style={{ color: 'var(--fd-muted-foreground)' }}>→</span>
                      <span style={{ color: 'var(--fd-foreground)' }}>{step.action}</span>
                      {step.condition && (
                        <span style={{ fontSize: '11px', padding: '1px 6px', backgroundColor: 'oklch(0.94 0.06 85)', color: 'oklch(0.45 0.15 85)', borderRadius: '4px' }}>
                          if: {step.condition}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {step.next && (
                        <span style={{ fontSize: '11px', color: 'var(--fd-muted-foreground)' }}>
                          → <span style={{ color: 'oklch(0.50 0.18 145)', fontWeight: 500 }}>{step.next}</span>
                        </span>
                      )}
                      {step.effect && (
                        <span style={{ fontSize: '11px', color: 'var(--fd-muted-foreground)', fontStyle: 'italic' }}>
                          · {step.effect}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edge cases */}
        {entry.edge_cases && entry.edge_cases.length > 0 && (
          <div>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 600, color: 'var(--fd-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Edge Cases</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {entry.edge_cases.map((ec, i) => (
                <div key={i} style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'oklch(0.96 0.04 85)',
                  border: '1px solid oklch(0.88 0.06 85)',
                  fontSize: '12px',
                }}>
                  <span style={{ fontWeight: 600, color: 'oklch(0.40 0.12 85)' }}>{ec.scenario}</span>
                  <span style={{ color: 'var(--fd-muted-foreground)' }}> → {ec.behavior}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Grouped renderer ─────────────────────────────────────────────────────────

function GroupSection({ title, icon, color, children }: {
  title: string
  icon: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{icon}</span>
        <h3 style={{
          margin: 0,
          fontSize: '13px',
          fontWeight: 700,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {title}
        </h3>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--fd-border)' }} />
      </div>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface A2UIPreviewProps {
  /** Path to the JSONL file, relative to the SOT docs root (e.g. "ui/a2ui/auth.screens.jsonl") */
  src: string
  /** Optional title override */
  title?: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; entries: A2UIEntry[] }

export function A2UIPreview({ src, title }: A2UIPreviewProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    setState({ status: 'loading' })
    fetch(`/__prev/sot/content?path=${encodeURIComponent(src)}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.text()
      })
      .then(text => setState({ status: 'ok', entries: parseJSONL(text) }))
      .catch(err => setState({ status: 'error', message: err.message }))
  }, [src])

  if (state.status === 'loading') {
    return (
      <div style={{
        padding: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '12px',
        border: '1px solid var(--fd-border)',
        backgroundColor: 'var(--fd-muted)',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          border: '2px solid var(--fd-border)',
          borderTopColor: 'var(--fd-primary)',
          borderRadius: '50%',
          animation: 'a2ui-spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes a2ui-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div style={{
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid oklch(0.88 0.06 25)',
        backgroundColor: 'oklch(0.97 0.02 25)',
        fontSize: '13px',
        color: 'oklch(0.45 0.15 25)',
      }}>
        <strong>A2UIPreview:</strong> Could not load <code style={{ fontFamily: 'var(--fd-font-mono)' }}>{src}</code>
        <br />{state.message}
      </div>
    )
  }

  const tokens = state.entries.filter((e): e is TokenEntry => e.type === 'token')
  const components = state.entries.filter((e): e is ComponentEntry => e.type === 'component')
  const screens = state.entries.filter((e): e is ScreenEntry => e.type === 'screen')
  const flows = state.entries.filter((e): e is FlowEntry => e.type === 'flow')

  const displayTitle = title ?? src.split('/').pop()?.replace('.jsonl', '') ?? src

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '8px' }}>
      {/* File badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid var(--fd-border)',
        backgroundColor: 'var(--fd-muted)',
      }}>
        <span style={{ fontSize: '16px' }}>⬡</span>
        <div>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--fd-foreground)' }}>
            {displayTitle}
          </span>
          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--fd-muted-foreground)', fontFamily: 'var(--fd-font-mono)' }}>
            {src}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {tokens.length > 0 && <Pill label={`${tokens.length} tokens`} color="oklch(0.55 0.18 310)" />}
          {components.length > 0 && <Pill label={`${components.length} components`} color="oklch(0.55 0.18 250)" />}
          {screens.length > 0 && <Pill label={`${screens.length} screens`} color="oklch(0.45 0.18 280)" />}
          {flows.length > 0 && <Pill label={`${flows.length} flows`} color="oklch(0.45 0.18 165)" />}
        </div>
      </div>

      {tokens.length > 0 && (
        <GroupSection title="Design Tokens" icon="🎨" color="oklch(0.45 0.18 310)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
            {tokens.map(e => <TokenCard key={e.id} entry={e} />)}
          </div>
        </GroupSection>
      )}

      {components.length > 0 && (
        <GroupSection title="Components" icon="⬡" color="oklch(0.45 0.18 250)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
            {components.map(e => <ComponentCard key={e.id} entry={e} />)}
          </div>
        </GroupSection>
      )}

      {screens.length > 0 && (
        <GroupSection title="Screens" icon="▣" color="oklch(0.45 0.18 280)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {screens.map(e => <ScreenCard key={e.id} entry={e} />)}
          </div>
        </GroupSection>
      )}

      {flows.length > 0 && (
        <GroupSection title="Flows" icon="⇢" color="oklch(0.40 0.18 165)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {flows.map(e => <FlowCard key={e.id} entry={e} />)}
          </div>
        </GroupSection>
      )}

      {state.entries.length === 0 && (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          color: 'var(--fd-muted-foreground)',
          fontSize: '13px',
          borderRadius: '12px',
          border: '1px dashed var(--fd-border)',
        }}>
          No entries found in {src}
        </div>
      )}
    </div>
  )
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 500,
      backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
      color,
      border: `1px solid color-mix(in oklch, ${color} 25%, transparent)`,
    }}>
      {label}
    </span>
  )
}
