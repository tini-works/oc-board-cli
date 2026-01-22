export default function Login() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '600', textAlign: 'center' }}>
          Welcome Back
        </h1>
        <p style={{ margin: '0 0 24px', color: '#6b7280', textAlign: 'center', fontSize: '14px' }}>
          Sign in to your account
        </p>

        <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              background: '#2563eb',
              color: 'white',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              marginTop: '8px'
            }}
          >
            Sign In
          </button>
        </form>

        <p style={{ margin: '24px 0 0', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
          Don't have an account? <a href="#" style={{ color: '#2563eb' }}>Sign up</a>
        </p>
      </div>
    </div>
  )
}
