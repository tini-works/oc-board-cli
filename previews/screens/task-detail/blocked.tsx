import { Sidebar } from '../../components/sidebar'
import { Avatar } from '../../components/avatar'
import { Tag } from '../../components/tag'
import { Badge } from '../../components/badge'
import { Button } from '../../components/button'
import { colors, project, team, tasks, tagColors, activity } from '../../shared/data'

// Use blocked task for demo
const task = tasks.find(t => t.status === 'blocked')!
const assignee = team.find(m => m.id === task.assignee)!

export default function TaskDetailBlocked() {
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
          {/* Blocked Warning Banner */}
          <div style={{
            backgroundColor: '#fee2e2',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
            border: `1px solid #fecaca`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#991b1b' }}>
                  Task Blocked
                </h3>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#b91c1c' }}>
                  {'blockedBy' in task ? task.blockedBy : 'This task is blocked by a dependency.'}
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <Button variant="secondary" size="sm">View Blocker</Button>
                  <Button variant="danger" size="sm">Remove Blocker</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Task Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: colors.gray900 }}>
                {task.title}
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tag color={tagColors[task.tag]}>{task.tag}</Tag>
              <Badge variant="error">Blocked</Badge>
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
              <span style={{ fontSize: 14, color: colors.error }}>{task.due} (overdue)</span>

              <span style={{ fontSize: 14, color: colors.gray500 }}>Blocker</span>
              <span style={{ fontSize: 14, color: colors.error }}>
                {'blockedBy' in task ? task.blockedBy : 'Unknown'}
              </span>

              <span style={{ fontSize: 14, color: colors.gray500 }}>Description</span>
              <p style={{ margin: 0, fontSize: 14, color: colors.gray700, lineHeight: 1.6 }}>
                Implement feature flags to enable gradual rollout of new features. Currently blocked pending API review from the payments team.
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Blocked Activity */}
              <div style={{ display: 'flex', gap: 12 }}>
                <Avatar initials={assignee.initials} color={assignee.color} size="sm" />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, color: colors.gray900 }}>
                    <strong>{assignee.name}</strong> marked this task as blocked
                  </p>
                  <p style={{
                    margin: '8px 0 0',
                    padding: 12,
                    backgroundColor: '#fef2f2',
                    borderRadius: 8,
                    fontSize: 14,
                    color: '#991b1b',
                  }}>
                    Blocked by: {'blockedBy' in task ? task.blockedBy : 'Unknown'}
                  </p>
                  <span style={{ fontSize: 12, color: colors.gray400 }}>Yesterday at 2:15 PM</span>
                </div>
              </div>

              {(activity.filter(a => a.task === task.title) as typeof activity[number][]).slice(0, 2).map(item => {
                const user = team.find(m => m.id === item.user)
                return (
                  <div key={item.id} style={{ display: 'flex', gap: 12 }}>
                    {user && <Avatar initials={user.initials} color={user.color} size="sm" />}
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 14, color: colors.gray900 }}>
                        <strong>{user?.name}</strong>{' '}
                        {item.type === 'comment' && 'commented'}
                        {item.type === 'status' && `moved to ${'to' in item ? item.to : ''}`}
                        {item.type === 'assignment' && `assigned to ${team.find(m => m.id === ('assignee' in item ? item.assignee : ''))?.name}`}
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
