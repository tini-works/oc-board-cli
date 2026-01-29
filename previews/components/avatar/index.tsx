export type AvatarSize = 'sm' | 'md' | 'lg'
export type AvatarStatus = 'online' | 'away' | 'offline'

export interface AvatarProps {
  initials: string
  color: string
  size?: AvatarSize
  status?: AvatarStatus
}

const sizes = {
  sm: { box: 24, fontSize: 10, statusSize: 8 },
  md: { box: 32, fontSize: 12, statusSize: 10 },
  lg: { box: 40, fontSize: 14, statusSize: 12 },
}

const statusColors: Record<AvatarStatus, string> = {
  online: '#10b981',
  away: '#f59e0b',
  offline: '#9ca3af',
}

export function Avatar({ initials, color, size = 'md', status }: AvatarProps) {
  const s = sizes[size]
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div style={{
        width: s.box,
        height: s.box,
        borderRadius: '50%',
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: s.fontSize,
        fontWeight: 600,
      }}>
        {initials}
      </div>
      {status && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: s.statusSize,
          height: s.statusSize,
          borderRadius: '50%',
          backgroundColor: statusColors[status],
          border: '2px solid white',
        }} />
      )}
    </div>
  )
}

// Demo
export default function AvatarDemo() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <Avatar initials="AC" color="#3b82f6" size="sm" />
      <Avatar initials="JL" color="#8b5cf6" size="md" />
      <Avatar initials="SR" color="#10b981" size="lg" />
      <div style={{ width: '100%', height: 1 }} />
      <Avatar initials="AC" color="#3b82f6" status="online" />
      <Avatar initials="JL" color="#8b5cf6" status="away" />
      <Avatar initials="SR" color="#10b981" status="offline" />
    </div>
  )
}
