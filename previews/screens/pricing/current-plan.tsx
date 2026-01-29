// previews/screens/pricing/current-plan.tsx
import { Button } from '../../components/button'
import { Badge } from '../../components/badge'
import { colors, plans } from '../../shared/data'

export default function PricingCurrentPlan() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.gray50,
      fontFamily: 'system-ui, sans-serif',
      padding: '64px 32px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 36, fontWeight: 700, color: colors.gray900 }}>
            Manage your plan
          </h1>
          <p style={{ margin: 0, fontSize: 18, color: colors.gray500 }}>
            You're currently on the <strong>Pro</strong> plan
          </p>
        </div>

        {/* Plans */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {plans.map((plan) => {
            const isCurrent = plan.name === 'Pro'
            return (
              <div
                key={plan.name}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  border: isCurrent ? `2px solid ${colors.success}` : `1px solid ${colors.gray200}`,
                  padding: 32,
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  opacity: plan.name === 'Free' ? 0.6 : 1,
                }}
              >
                {isCurrent && (
                  <div style={{
                    position: 'absolute',
                    top: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}>
                    <Badge variant="success">Current Plan</Badge>
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

                <Button variant={isCurrent ? 'ghost' : plan.name === 'Enterprise' ? 'secondary' : 'ghost'}>
                  {isCurrent ? 'Current Plan' : plan.name === 'Enterprise' ? 'Contact Sales' : 'Downgrade'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
