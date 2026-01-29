// previews/screens/pricing/trial.tsx
import { Button } from '../../components/button'
import { Badge } from '../../components/badge'
import { colors, plans } from '../../shared/data'

export default function PricingTrial() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.gray50,
      fontFamily: 'system-ui, sans-serif',
      padding: '64px 32px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Trial banner */}
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: 12,
          padding: 20,
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⏰</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#92400e' }}>
                Your Pro trial ends in 7 days
              </div>
              <div style={{ fontSize: 14, color: '#a16207' }}>
                Upgrade now to keep all your Pro features
              </div>
            </div>
          </div>
          <Button variant="primary">Upgrade Now</Button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 700, color: colors.gray900 }}>
            Choose your plan
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: colors.gray500 }}>
            Upgrade before your trial ends to continue without interruption
          </p>
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                backgroundColor: 'white',
                borderRadius: 16,
                border: plan.popular ? `2px solid ${colors.primary}` : `1px solid ${colors.gray200}`,
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {plan.popular && (
                <div style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}>
                  <Badge variant="success">Recommended</Badge>
                </div>
              )}

              <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600, color: colors.gray900 }}>
                {plan.name}
              </h2>

              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 48, fontWeight: 700, color: colors.gray900 }}>
                  ${plan.price}
                </span>
                {plan.price > 0 && (
                  <span style={{ fontSize: 16, color: colors.gray500 }}>/user/month</span>
                )}
              </div>

              <ul style={{ margin: '0 0 24px', padding: 0, listStyle: 'none', flex: 1 }}>
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 12,
                      fontSize: 14,
                      color: colors.gray700,
                    }}
                  >
                    <span style={{ color: colors.success }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button variant={plan.popular ? 'primary' : 'secondary'}>
                {plan.name === 'Free' ? 'Downgrade' : plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
