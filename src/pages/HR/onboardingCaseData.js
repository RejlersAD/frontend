export const CASE_STAGES = [
  { id: 'pre_hire', short: 'Pre-Hire', title: 'Pre-Hire Initiation', tasks: 'Pre-hire tasks', owner: 'HR', description: 'Complete required employment and employee-record setup.' },
  { id: 'it_provisioning', short: 'IT Provisioning', title: 'IT Provisioning', tasks: 'IT provisioning tasks', owner: 'HR / ICT', description: 'Prepare equipment, accounts, security and system access.' },
  { id: 'first_day', short: 'First Day', title: 'First Day Orientation', tasks: 'First day tasks', owner: 'HR / Manager', description: 'Welcome the employee and complete their first-day orientation.' },
  { id: 'final_validation', short: 'Final Validation', title: 'Final Checklist Validation', tasks: 'Final validation tasks', owner: 'HR', description: 'Review the completed records and confirm onboarding readiness.' },
]

export const CASE_STATUSES = { initiated: 'Initiated', documentation: 'Documentation', equipment: 'Equipment', access_provisioning: 'Access setup', training: 'Training', completed: 'Completed', cancelled: 'Cancelled' }

export function caseProgress(record) {
  const stages = CASE_STAGES.map(stage => {
    const items = (record?.checklist_items || []).filter(item => item.stage === stage.id)
    const done = items.filter(item => item.completed).length
    return { ...stage, items, done, complete: items.length > 0 && done === items.length }
  })
  const current = stages.findIndex(stage => !stage.complete)
  return {
    stages, currentIndex: current < 0 ? stages.length - 1 : current,
    percent: Math.round(stages.reduce((sum, stage) => sum + (stage.items.length ? stage.done / stage.items.length : 0), 0) / stages.length * 100),
    allComplete: stages.every(stage => stage.complete),
  }
}

export function caseActivity(record) {
  if (!record) return []
  const events = []
  if (record.created_at) events.push({ id: 'created', title: 'Case created', date: record.created_at, detail: record.created_by_name || '' })
  if (record.initiated_date) events.push({ id: 'initiated', title: 'Onboarding initiated', date: record.initiated_date, detail: record.created_by_name || '' })
  for (const item of record.checklist_items || []) {
    if (item.completed && item.completed_date) events.push({ id: `task-${item.id}`, title: item.task_name, date: item.completed_date, detail: `Completed${item.completed_by_name ? ` · ${item.completed_by_name}` : ''}` })
  }
  if (record.actual_completion_date) events.push({ id: 'completed', title: 'Onboarding completed', date: record.actual_completion_date, detail: caseProgress(record).allComplete ? 'All four checklist stages completed' : 'Workflow completion recorded' })
  return events.filter(event => parsedCaseDate(event.date)).sort((a, b) => parsedCaseDate(b.date) - parsedCaseDate(a.date))
}

export function validCaseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function parsedCaseDate(value) {
  if (!value || !validCaseDate(String(value).slice(0, 10))) return null
  const parsed = new Date(String(value).length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function caseDate(value, fallback = 'Not set') {
  const parsed = parsedCaseDate(value)
  return !parsed ? fallback : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

export function isPastCaseDate(value, today = new Date()) {
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return Boolean(parsedCaseDate(value) && String(value).slice(0, 10) < key)
}

export function caseError(error, fallback) {
  const body = error.response?.data
  if (typeof body?.detail === 'string') return body.detail
  if (typeof body?.error === 'string') return body.error
  if (body && typeof body === 'object') {
    const messages = Object.entries(body).filter(([, value]) => typeof value === 'string' || Array.isArray(value)).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`)
    if (messages.length) return messages.join(' ')
  }
  return fallback
}
