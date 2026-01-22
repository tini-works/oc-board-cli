export default function Card() {
  return (
    <div style={{
      padding: '24px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      maxWidth: '320px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        width: '100%',
        height: '160px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '8px',
        marginBottom: '16px'
      }} />
      <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600' }}>
        Card Title
      </h3>
      <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
        This is a sample card component with an image placeholder and description text.
      </p>
      <button style={{
        padding: '8px 16px',
        background: '#2563eb',
        color: 'white',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
      }}>
        Learn More
      </button>
    </div>
  )
}
