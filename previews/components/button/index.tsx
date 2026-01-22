export default function Button() {
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      <button style={{
        padding: '10px 20px',
        background: '#2563eb',
        color: 'white',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '14px'
      }}>
        Primary
      </button>
      <button style={{
        padding: '10px 20px',
        background: 'transparent',
        color: '#2563eb',
        borderRadius: '6px',
        border: '1px solid #2563eb',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '14px'
      }}>
        Secondary
      </button>
      <button style={{
        padding: '10px 20px',
        background: '#dc2626',
        color: 'white',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '14px'
      }}>
        Danger
      </button>
    </div>
  )
}
