// previews/shared/data.ts

// Brand
export const brand = {
  name: 'Workflow',
  tagline: 'Ship faster, together',
}

// Colors (for inline styles where primitives don't cover)
export const colors = {
  primary: '#4f46e5',
  primaryLight: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
}

// Team members
export const team = [
  { id: 'alex', name: 'Alex Chen', role: 'Project Manager', initials: 'AC', color: '#3b82f6', status: 'online' },
  { id: 'jordan', name: 'Jordan Lee', role: 'Designer', initials: 'JL', color: '#8b5cf6', status: 'online' },
  { id: 'sam', name: 'Sam Rivera', role: 'Engineer', initials: 'SR', color: '#10b981', status: 'away' },
  { id: 'taylor', name: 'Taylor Kim', role: 'QA', initials: 'TK', color: '#f59e0b', status: 'offline' },
] as const

export type TeamMember = typeof team[number]

// Project
export const project = {
  name: 'Product Launch Q1',
  goal: 'Ship v2 by March 31 with 3 pilot customers',
  status: 'at-risk' as const,
  risk: 'Vendor delay on payment integration',
  owner: 'Alex Chen',
  progress: 42,
  tags: ['Growth', 'Web', 'Mobile'],
  milestones: [
    { name: 'Alpha', date: 'Feb 10', status: 'complete' },
    { name: 'Beta', date: 'Mar 1', status: 'in-progress' },
    { name: 'Launch', date: 'Mar 31', status: 'upcoming' },
  ],
}

// Tasks
export const tasks = [
  { id: 't1', title: 'Finalize launch messaging', assignee: 'jordan', due: 'Feb 3', tag: 'Marketing', status: 'in-progress', column: 'doing' },
  { id: 't2', title: 'Implement feature flags', assignee: 'sam', due: 'Feb 12', tag: 'Backend', status: 'blocked', column: 'doing', blockedBy: 'API review pending' },
  { id: 't3', title: 'QA test plan for checkout', assignee: 'taylor', due: 'Feb 15', tag: 'QA', status: 'todo', column: 'todo' },
  { id: 't4', title: 'Set up analytics dashboards', assignee: 'alex', due: 'Feb 18', tag: 'Data', status: 'todo', column: 'todo' },
  { id: 't5', title: 'Design onboarding tooltips', assignee: 'jordan', due: 'Feb 20', tag: 'UX', status: 'in-progress', column: 'doing' },
  { id: 't6', title: 'API integration review', assignee: 'sam', due: 'Feb 6', tag: 'Backend', status: 'done', column: 'done' },
  { id: 't7', title: 'Competitor analysis', assignee: 'alex', due: 'Jan 28', tag: 'Research', status: 'done', column: 'done' },
] as const

export type Task = typeof tasks[number]

// Tag colors
export const tagColors: Record<string, string> = {
  Marketing: '#ec4899',
  Backend: '#3b82f6',
  QA: '#f59e0b',
  Data: '#10b981',
  UX: '#8b5cf6',
  Research: '#6b7280',
}

// Current user (for data-driven screens)
export const currentUserId = 'alex'
export const currentUser = team.find(m => m.id === currentUserId)!

// Pending invites (for team screen)
export const pendingInvites = [
  { email: 'casey@example.com', role: 'Designer', sentAt: '2 hours ago' },
  { email: 'morgan@example.com', role: 'Engineer', sentAt: 'Yesterday' },
] as const

// Trial info (for pricing screen)
export const trialInfo = {
  daysRemaining: 7,
  plan: 'Pro',
}

// Activity feed
export const activity = [
  { id: 'a1', type: 'comment', user: 'sam', task: 'Implement feature flags', content: 'API review scheduled with Payments team on Feb 6', time: '2 hours ago' },
  { id: 'a2', type: 'status', user: 'jordan', task: 'Finalize launch messaging', from: 'To Do', to: 'In Progress', time: '4 hours ago' },
  { id: 'a3', type: 'assignment', user: 'alex', task: 'QA test plan for checkout', assignee: 'taylor', time: 'Yesterday' },
  { id: 'a4', type: 'comment', user: 'jordan', task: 'Design onboarding tooltips', content: 'Updated Figma link for onboarding flow', time: 'Yesterday' },
] as const

// Empty state copy
export const emptyStates = {
  dashboard: { headline: 'No projects yet', body: 'Start with a template or create from scratch.', cta: 'Create Project' },
  board: { headline: 'No tasks yet', body: 'Move work forward by adding your first task.', cta: 'Add Task' },
  team: { headline: 'No team members', body: 'Teams ship faster together. Invite your crew.', cta: 'Invite Team' },
  filtered: { headline: 'No tasks match', body: 'Try adjusting your filters.', cta: 'Clear Filters' },
  activity: { headline: 'No activity yet', body: 'Project updates will show up here.', cta: 'Create a Task' },
}

// Pricing plans
export const plans = [
  { name: 'Free', price: 0, features: ['Up to 3 projects', '5 team members', 'Basic integrations'], cta: 'Current Plan' },
  { name: 'Pro', price: 12, features: ['Unlimited projects', 'Unlimited members', 'Advanced integrations', 'Priority support'], cta: 'Upgrade', popular: true },
  { name: 'Enterprise', price: 49, features: ['Everything in Pro', 'SSO & SAML', 'Audit logs', 'Dedicated support'], cta: 'Contact Sales' },
] as const

// Helper to get team member by ID
export function getMember(id: string): TeamMember | undefined {
  return team.find(m => m.id === id)
}
