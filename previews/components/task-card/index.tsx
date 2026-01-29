import { Avatar } from '../avatar'
import { Tag } from '../tag'
import { Badge } from '../badge'
import { team, tagColors, type Task } from '../../shared/data'

export interface TaskCardProps {
  task: Task
  variant?: 'default' | 'completed'
}

export function TaskCard({ task, variant = 'default' }: TaskCardProps) {
  const assignee = team.find(m => m.id === task.assignee)
  const isCompleted = variant === 'completed' || task.status === 'done'
  const isBlocked = task.status === 'blocked'

  return (
    <div style={{
      padding: 16,
      backgroundColor: 'white',
      borderRadius: 8,
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      opacity: isCompleted ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Title */}
        <span style={{
          fontSize: 14,
          fontWeight: 500,
          color: '#111827',
          textDecoration: isCompleted ? 'line-through' : 'none',
        }}>
          {task.title}
        </span>

        {/* Blocked warning */}
        {isBlocked && 'blockedBy' in task && (
          <div style={{
            padding: '6px 8px',
            backgroundColor: '#fef2f2',
            borderRadius: 4,
            fontSize: 12,
            color: '#991b1b',
          }}>
            Blocked: {task.blockedBy}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={tagColors[task.tag] || '#6b7280'}>{task.tag}</Tag>
            {isBlocked && <Badge variant="error">Blocked</Badge>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{task.due}</span>
            {assignee && (
              <Avatar initials={assignee.initials} color={assignee.color} size="sm" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Demo
import { tasks } from '../../shared/data'

export default function TaskCardDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
      <TaskCard task={tasks[0]} />
      <TaskCard task={tasks[1]} /> {/* blocked */}
      <TaskCard task={tasks[5]} variant="completed" />
    </div>
  )
}
