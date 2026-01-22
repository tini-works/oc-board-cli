export default function Dashboard() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f3f4f6',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <header style={{
        background: 'white',
        padding: '16px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: '14px' }}>Welcome, User</span>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }} />
        </div>
      </header>

      <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}>
          {[
            { label: 'Total Users', value: '2,543', change: '+12%' },
            { label: 'Revenue', value: '$45,231', change: '+8%' },
            { label: 'Active Sessions', value: '1,234', change: '+23%' },
            { label: 'Conversion', value: '3.2%', change: '+0.5%' }
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: '14px' }}>{stat.label}</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>{stat.value}</p>
              <span style={{ color: '#10b981', fontSize: '12px' }}>{stat.change}</span>
            </div>
          ))}
        </div>

        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>Recent Activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {['New user signed up', 'Order #1234 completed', 'Payment received'].map((item, i) => (
              <div key={i} style={{
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '6px',
                fontSize: '14px'
              }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
