import { Sidebar } from '../../components/sidebar'
import { Button } from '../../components/button'
import { colors, project, team, tasks, tagColors } from '../../shared/data'

// Use first in-progress task for demo
const task = tasks.find(t => t.status === 'in-progress')!

export default function TaskDetailEditing() {
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
          <span style={{ color: colors.gray900, fontWeight: 500 }}>Edit Task</span>
        </div>

        <div style={{ padding: 32, maxWidth: 600 }}>
          {/* Edit Form */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: 12,
            border: `1px solid ${colors.gray200}`,
            padding: 24,
          }}>
            <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600, color: colors.gray900 }}>
              Edit Task
            </h2>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: colors.gray700 }}>
                  Title
                </label>
                <input
                  type="text"
                  defaultValue={task.title}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${colors.gray200}`,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: colors.gray700 }}>
                  Description
                </label>
                <textarea
                  defaultValue="This task involves finalizing all customer-facing launch messaging, including landing page copy, email announcements, and social media content."
                  rows={4}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${colors.gray200}`,
                    fontSize: 14,
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Assignee */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: colors.gray700 }}>
                  Assignee
                </label>
                <select
                  defaultValue={task.assignee}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${colors.gray200}`,
                    fontSize: 14,
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                >
                  {team.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: colors.gray700 }}>
                  Due Date
                </label>
                <input
                  type="text"
                  defaultValue={task.due}
                  placeholder="e.g., Feb 15"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${colors.gray200}`,
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Tag */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: colors.gray700 }}>
                  Tag
                </label>
                <select
                  defaultValue={task.tag}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: `1px solid ${colors.gray200}`,
                    fontSize: 14,
                    backgroundColor: 'white',
                    outline: 'none',
                  }}
                >
                  {Object.keys(tagColors).map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <Button variant="secondary">Cancel</Button>
                <Button variant="primary">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
