import { Sidebar } from '../../components/sidebar'
import { Avatar } from '../../components/avatar'
import { Tag } from '../../components/tag'
import { Badge } from '../../components/badge'
import { Button } from '../../components/button'
import { colors, project, team, tasks, tagColors, activity } from '../../shared/data'

// Use first in-progress task for demo
const task = tasks.find(t => t.status === 'in-progress')!
const assignee = team.find(m => m.id === task.assignee)!
const taskActivity = activity.filter(a => a.task === task.title)

export default function TaskDetail() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <Sidebar activeItem="project" />

      <main style={{ flex: 1, backgroundColor: colors.gray50 }}>
        {/* Breadcrumb */}
        <div style={{
          padding: '12px 32px',
          backgroundColor: 'white',
          borderBottom: `1px solid ${colors.gray200}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 14,
          color: colors.gray500,
        }}>
          <span style={{ cursor: 'pointer' }}>{project.name}</span>
          <span>/</span>
          <span style={{ color: colors.gray900, fontWeight: 500 }}>{task.title}</span>
        </div>

        <div style={{ padding: 32, maxWidth: 800 }}>
          {/* Task Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: colors.gray900 }}>
                {task.title}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tag color={tagColors[task.tag]}>{task.tag}</Tag>
              <Badge variant="warning">In Progress</Badge>
            </div>
          </div>

          {/* Details Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            border: `1px solid ${colors.gray200}`,
            padding: 24,
            marginBottom: 24,
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: colors.gray900 }}>
              Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16 }}>
              <span style={{ fontSize: 14, color: colors.gray500 }}>Assignee</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar initials={assignee.initials} color={assignee.color} size="sm" />
                <span style={{ fontSize: 14, color: colors.gray900 }}>{assignee.name}</span>
              </div>

              <span style={{ fontSize: 14, color: colors.gray500 }}>Due Date</span>
              <span style={{ fontSize: 14, color: colors.gray900 }}>{task.due}</span>

              <span style={{ fontSize: 14, color: colors.gray500 }}>Description</span>
              <p style={{ margin: 0, fontSize: 14, color: colors.gray700, lineHeight: 1.6 }}>
                This task involves finalizing all customer-facing launch messaging, including landing page copy, email announcements, and social media content. Ensure consistency with brand guidelines.
              </p>
            </div>
          </div>

          {/* Activity Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            border: `1px solid ${colors.gray200}`,
            padding: 24,
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: colors.gray900 }}>
              Activity
            </h2>

            {/* Comment Input */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              <Avatar initials="AC" color="#3b82f6" size="md" />
              <div style={{ flex: 1 }}>
                <textarea
                  placeholder="Add a comment..."
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${colors.gray200}`,
                    fontSize: 14,
                    resize: 'vertical',
                    minHeight: 80,
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <Button variant="primary" size="sm">Comment</Button>
                </div>
              </div>
            </div>

            {/* Activity Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activity.slice(0, 3).map(item => {
                const user = team.find(m => m.id === item.user)
                return (
                  <div key={item.id} style={{ display: 'flex', gap: 12 }}>
                    {user && <Avatar initials={user.initials} color={user.color} size="sm" />}
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, color: colors.gray900 }}>
                        <strong>{user?.name}</strong>{' '}
                        {item.type === 'comment' && 'commented'}
                        {item.type === 'status' && `moved to ${item.to}`}
                        {item.type === 'assignment' && `assigned to ${team.find(m => m.id === item.assignee)?.name}`}
                      </p>
                      {item.type === 'comment' && 'content' in item && (
                        <p style={{
                          margin: '8px 0 0',
                          padding: 12,
                          backgroundColor: colors.gray50,
                          borderRadius: 8,
                          fontSize: 14,
                          color: colors.gray700,
                        }}>
                          {item.content}
                        </p>
                      )}
                      <span style={{ fontSize: 12, color: colors.gray400 }}>{item.time}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
