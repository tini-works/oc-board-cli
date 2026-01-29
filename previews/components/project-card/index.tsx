import { Progress } from '../progress'
import { Avatar } from '../avatar'
import { Badge } from '../badge'
import { team } from '../../shared/data'

export interface ProjectCardProps {
  name: string
  progress: number
  status: 'on-track' | 'at-risk' | 'complete'
  memberIds: string[]
  active?: boolean
}

const statusConfig = {
  'on-track': { label: 'On Track', variant: 'success' as const },
  'at-risk': { label: 'At Risk', variant: 'warning' as const },
  'complete': { label: 'Complete', variant: 'default' as const },
}

export function ProjectCard({ name, progress, status, memberIds, active = false }: ProjectCardProps) {
  const members = memberIds.map(id => team.find(m => m.id === id)).filter(Boolean)
  const config = statusConfig[status]

  return (
    <div style={{
      padding: 20,
      backgroundColor: 'white',
      borderRadius: 12,
      border: active ? '2px solid #4f46e5' : '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{name}</span>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
        <Progress value={progress} showLabel />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', marginLeft: -4 }}>
            {members.slice(0, 4).map((m, i) => (
              <div key={m!.id} style={{ marginLeft: i > 0 ? -8 : 0, position: 'relative', zIndex: 4 - i }}>
                <Avatar initials={m!.initials} color={m!.color} size="sm" />
              </div>
            ))}
            {members.length > 4 && (
              <div style={{
                marginLeft: -8,
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 500,
                color: '#6b7280',
              }}>
                +{members.length - 4}
              </div>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function ProjectCardDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 360 }}>
      <ProjectCard name="Product Launch Q1" progress={42} status="at-risk" memberIds={['alex', 'jordan', 'sam', 'taylor']} active />
      <ProjectCard name="Website Redesign" progress={78} status="on-track" memberIds={['jordan', 'sam']} />
      <ProjectCard name="Q4 Metrics Review" progress={100} status="complete" memberIds={['alex']} />
    </div>
  )
}
