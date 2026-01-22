import React, { useState, useEffect } from 'react'
import type { PreviewUnit, FlowDefinition } from '../../vite/preview-types'

interface FlowPreviewProps {
  unit: PreviewUnit
}

export function FlowPreview({ unit }: FlowPreviewProps) {
  const [flow, setFlow] = useState<FlowDefinition | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(true)

  // Load flow definition
  useEffect(() => {
    fetch(`/_preview-config/flows/${unit.name}`)
      .then(res => res.json())
      .then(data => {
        setFlow(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [unit.name])

  if (loading) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: 'var(--fd-muted-foreground)',
      }}>
        Loading flow...
      </div>
    )
  }

  // Fix 3: Zero-step flow handling
  if (!flow || flow.steps.length === 0) {
    return (
      <div style={{
        padding: '32px',
        textAlign: 'center',
        color: 'oklch(0.65 0.15 85)', // yellow-ish warning color
      }}>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '18px',
          fontWeight: 600,
        }}>
          {flow?.name || 'Flow'}
        </h2>
        <p style={{ margin: 0 }}>
          {flow ? 'This flow has no steps defined.' : 'Failed to load flow definition.'}
        </p>
      </div>
    )
  }

  const step = flow.steps[currentStep]
  const totalSteps = flow.steps.length

  // Build iframe URL for current step's screen
  const iframeUrl = step
    ? `/_preview-runtime?preview=screens/${step.screen}${step.state ? `&state=${step.state}` : ''}`
    : ''

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
            {flow.name}
          </h2>
          {flow.description && (
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--fd-muted-foreground)',
            }}>
              {flow.description}
            </p>
          )}
        </div>
        <span style={{
          fontSize: '14px',
          color: 'var(--fd-muted-foreground)',
        }}>
          Step {currentStep + 1} of {totalSteps}
        </span>
      </div>

      {/* Preview area */}
      <div style={{
        padding: '24px',
        backgroundColor: 'var(--fd-muted)',
        display: 'flex',
        justifyContent: 'center',
        overflow: 'auto',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '896px',
          backgroundColor: 'var(--fd-background)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <iframe
            src={iframeUrl}
            style={{
              width: '100%',
              height: '500px',
              border: 'none',
              display: 'block',
            }}
            title={`Flow: ${flow.name} - Step ${currentStep + 1}`}
          />
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--fd-border)',
        backgroundColor: 'var(--fd-muted)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '896px',
          margin: '0 auto',
        }}>
          {/* Previous button */}
          <button
            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              border: 'none',
              borderRadius: '4px',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: 'transparent',
              color: currentStep === 0 ? 'var(--fd-muted-foreground)' : 'var(--fd-foreground)',
              opacity: currentStep === 0 ? 0.5 : 1,
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (currentStep !== 0) {
                e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Previous
          </button>

          {/* Step dots */}
          <div style={{
            display: 'flex',
            gap: '8px',
          }}>
            {flow.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                style={{
                  width: '12px',
                  height: '12px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  backgroundColor: i === currentStep
                    ? 'var(--fd-foreground)'
                    : 'var(--fd-border)',
                  transition: 'background-color 0.15s',
                }}
                title={`Step ${i + 1}`}
              />
            ))}
          </div>

          {/* Next button */}
          <button
            onClick={() => setCurrentStep(s => Math.min(totalSteps - 1, s + 1))}
            disabled={currentStep === totalSteps - 1}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              border: 'none',
              borderRadius: '4px',
              cursor: currentStep === totalSteps - 1 ? 'not-allowed' : 'pointer',
              backgroundColor: 'transparent',
              color: currentStep === totalSteps - 1 ? 'var(--fd-muted-foreground)' : 'var(--fd-foreground)',
              opacity: currentStep === totalSteps - 1 ? 0.5 : 1,
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (currentStep !== totalSteps - 1) {
                e.currentTarget.style.backgroundColor = 'var(--fd-secondary)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Next
          </button>
        </div>

        {/* Step info */}
        {step && (step.note || step.trigger) && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'var(--fd-background)',
            borderRadius: '4px',
            maxWidth: '896px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {step.note && (
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: 'var(--fd-foreground)',
              }}>
                <span style={{ marginRight: '8px' }}>Note:</span>
                {step.note}
              </p>
            )}
            {step.trigger && (
              <p style={{
                margin: step.note ? '8px 0 0 0' : 0,
                fontSize: '14px',
                color: 'var(--fd-muted-foreground)',
              }}>
                <span style={{ marginRight: '8px' }}>Trigger:</span>
                {step.trigger}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
