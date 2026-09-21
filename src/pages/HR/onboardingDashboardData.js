const ACTIVE_STATUSES = new Set(['initiated', 'documentation', 'equipment', 'access_provisioning', 'training'])

const ENTITY_LABELS = { RAD: 'Rejlers Abu Dhabi', RIN: 'Rejlers India' }

const READINESS_CATEGORIES = [
  { id: 'employee', label: 'Employee data' },
  { id: 'documents', label: 'Documents' },
  { id: 'access', label: 'IT access' },
  { id: 'equipment', label: 'Equipment' },
]

const OWNERS = [
  { id: 'hr', label: 'HR', initials: 'HR', tone: 'blue' },
  { id: 'it', label: 'IT', initials: 'IT', tone: 'amber' },
  { id: 'managers', label: 'HR / Manager', initials: 'HM', tone: 'green' },
  { id: 'workplace', label: 'Workplace', initials: 'WP', tone: 'green' },
]

const dateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')

const dateAfter = (date, days) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return dateKey(result)
}

const newestRecordFirst = (a, b) => {
  const created = record => Date.parse(record.created_at) || Date.parse(record.initiated_date) || 0
  return created(b) - created(a) || String(a.employee_name || '').localeCompare(String(b.employee_name || ''))
}

export const formatOnboardingDate = (value) => {
  if (!value) return 'Not set'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export const getOnboardingInitials = (name = '') => {
  const words = String(name).trim().split(/\s+/).filter(Boolean)
  return words.length ? `${words[0][0]}${words.length > 1 ? words[words.length - 1][0] : ''}`.toUpperCase() : '?'
}

export const getOnboardingFilterOptions = (records = []) => ({
  entities: [...new Set(records.map(record => record.branch).filter(Boolean))]
    .sort().map(value => ({ value, label: ENTITY_LABELS[value] || value })),
  departments: [...new Set(records.map(record => record.department).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b)).map(value => ({ value, label: value })),
})

// The list serializers are paginated and do not include nested checklists.
// Fetch both collections once, keeping subsequent page requests on the same API endpoint.
const loadCollection = async (apiClient, endpoint, signal) => {
  const records = []
  const visited = new Set()
  const collectionUrl = new URL(endpoint, 'https://onboarding.local')
  let url = endpoint
  while (url) {
    if (visited.has(url)) throw new Error('Onboarding pagination returned a repeated page.')
    visited.add(url)
    const response = await apiClient.get(url, { signal })
    const data = response.data
    if (Array.isArray(data)) return records.concat(data)
    if (!Array.isArray(data?.results)) throw new Error('Unable to read onboarding records.')
    records.push(...data.results)
    if (data.next) {
      const nextPage = new URL(data.next, 'https://onboarding.local')
      // Every page keeps the original collection scope, even when the server's
      // pagination link omits it or points to an absolute URL.
      collectionUrl.searchParams.forEach((value, key) => nextPage.searchParams.set(key, value))
      url = `${collectionUrl.pathname}${nextPage.search}`
    } else url = null
  }
  return records
}

export const loadOnboardingDashboardRecords = async (apiClient, { signal } = {}) => {
  const [records, checklist] = await Promise.all([
    loadCollection(apiClient, '/onboarding/onboarding/', signal),
    loadCollection(apiClient, '/onboarding/checklist/?workflow=onboarding', signal),
  ])
  const checklistByRecord = new Map()
  for (const item of checklist) {
    if (!item.onboarding_record) continue
    const key = String(item.onboarding_record)
    if (!checklistByRecord.has(key)) checklistByRecord.set(key, [])
    checklistByRecord.get(key).push(item)
  }
  return records.map(record => ({ ...record, checklist_items: checklistByRecord.get(String(record.id)) || [] }))
}

// Ownership is the workflow team's responsibility; the API has no per-task assignee.
const ownerForTask = (task) => {
  if (task.stage === 'it_provisioning') return OWNERS[1]
  if (task.stage === 'first_day') return OWNERS[2]
  if (['pre_hire', 'final_validation'].includes(task.stage)) return OWNERS[0]
  return { id: 'unassigned', label: 'Unassigned', initials: '?', tone: 'slate' }
}

// Categories describe completion of recorded checklist work, never inferred completion
// from workflow status, the number of uploaded documents, or equipment record counts.
const categoriesForTask = (task) => {
  const title = task.task_name || ''
  const categories = []
  if (/employee (?:master )?profile|master data|joining date|hiring request|onboarding owner|employee data/i.test(title)) categories.push('employee')
  if (/documents?|identity|offer|employment contract/i.test(title)) categories.push('documents')
  if (/account|email|microsoft|directory|domain|vpn|mfa|security policies|system access|application.*access|shared-drive access|required access|RBAC/i.test(title)) categories.push('access')
  if (/laptop|workstation|equipment|hardware|headset|device/i.test(title)) categories.push('equipment')
  return categories
}

const actionLabelForTask = (task) => {
  const categories = categoriesForTask(task)
  if (categories.includes('equipment')) return 'Assign equipment'
  if (categories.includes('access')) return /account|email|directory/i.test(task.task_name || '') ? 'Create accounts' : 'Review access'
  if (categories.includes('documents')) return 'Review documents'
  if (/buddy/i.test(task.task_name || '')) return 'Assign buddy'
  if (/induction|orientation|schedule/i.test(task.task_name || '')) return 'Review schedule'
  return 'Review task'
}

const recordReadiness = (record) => {
  const tasks = record.checklist_items || []
  const categories = Object.fromEntries(READINESS_CATEGORIES.map(category => [category.id, []]))
  tasks.forEach(task => categoriesForTask(task).forEach(category => categories[category].push(task)))
  const allCategoriesTracked = Object.values(categories).every(items => items.length > 0)
  const ready = allCategoriesTracked && Object.values(categories).every(items => items.every(item => item.completed)) && tasks.filter(task => task.priority === 'critical').every(task => task.completed)
  const completed = tasks.filter(task => task.completed).length
  const progress = tasks.length ? completed / tasks.length : null
  return { categories, ready, progress, allCategoriesTracked }
}

export const buildOnboardingDashboard = (records = [], filters = {}, now = new Date()) => {
  const { entity = 'all', department = 'all', dateRange = '30' } = filters
  const today = dateKey(now)
  const days = Number(String(dateRange).replace(/\D/g, ''))
  const horizon = dateRange === 'all' || !days ? null : dateAfter(now, days)
  // Active work is independent of the upcoming date range: a newly created case
  // remains active even when its joining date is past, far ahead, or not set.
  const activeRecords = records.filter(record => ACTIVE_STATUSES.has(record.status)
    && (!entity || entity === 'all' || record.branch === entity)
    && (!department || department === 'all' || record.department === department))
    .sort(newestRecordFirst)
  const futureActiveRecords = activeRecords.filter(record => record.joining_date && record.joining_date >= today)

  const readinessByRecord = new Map(activeRecords.map(record => [record.id, recordReadiness(record)]))
  const actions = activeRecords.flatMap(record => (record.checklist_items || [])
    .filter(task => !task.completed)
    .map(task => {
      const owner = ownerForTask(task)
      const dueDate = task.due_date || null
      return {
        id: `${record.id}-${task.id}`,
        record,
        title: task.task_name,
        stage: task.stage,
        owner: owner.label,
        ownerId: owner.id,
        ownerInitials: owner.initials,
        dueDate,
        severity: dueDate && dueDate < today ? 'overdue' : dueDate && dueDate <= dateAfter(now, 7) ? 'soon' : 'pending',
        actionLabel: actionLabelForTask(task),
        focusItChecklist: task.stage === 'it_provisioning',
        categories: categoriesForTask(task),
      }
    }))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.record.employee_name.localeCompare(b.record.employee_name))

  const joiners = futureActiveRecords.filter(record => !horizon || record.joining_date <= horizon)
    .sort((a, b) => a.joining_date.localeCompare(b.joining_date) || a.employee_name.localeCompare(b.employee_name))
    .map(record => {
      const { ready, progress, allCategoriesTracked } = readinessByRecord.get(record.id)
      if (ready) return { record, readiness: 'Day-one ready', tone: 'green' }
      if (progress === null) return { record, readiness: 'Not tracked', tone: 'slate' }
      if (allCategoriesTracked && progress >= 0.8) return { record, readiness: 'Mostly ready', tone: 'green' }
      if (progress > 0) return { record, readiness: 'In progress', tone: 'amber' }
      return { record, readiness: 'Not started', tone: 'slate' }
    })

  const readiness = READINESS_CATEGORIES.map(category => {
    const items = [...readinessByRecord.values()].flatMap(record => record.categories[category.id])
    return { ...category, percent: items.length ? Math.round(items.filter(item => item.completed).length / items.length * 100) : null }
  })
  const trackedRecords = [...readinessByRecord.values()].filter(record => Object.values(record.categories).some(items => items.length))

  return {
    activeCount: activeRecords.length,
    pastActiveCount: activeRecords.filter(record => record.joining_date && record.joining_date < today).length,
    undatedActiveCount: activeRecords.filter(record => !record.joining_date).length,
    futureActiveCount: futureActiveRecords.length,
    upcomingOutsideRangeCount: horizon ? futureActiveRecords.filter(record => record.joining_date > horizon).length : 0,
    overdueCount: actions.filter(action => action.severity === 'overdue').length,
    joiningSoonCount: futureActiveRecords.filter(record => record.joining_date <= dateAfter(now, 7)).length,
    dayOneReadyPercent: trackedRecords.length ? Math.round([...readinessByRecord.values()].filter(record => record.ready).length / activeRecords.length * 100) : null,
    actions,
    joiners,
    readiness,
    workload: [...OWNERS, ...(actions.some(action => action.ownerId === 'unassigned') ? [{ id: 'unassigned', label: 'Unassigned', initials: '?', tone: 'slate' }] : [])].map(owner => ({
      ...owner,
      open: owner.id === 'workplace' ? null : actions.filter(action => action.ownerId === owner.id).length,
      overdue: owner.id === 'workplace' ? null : actions.filter(action => action.ownerId === owner.id && action.severity === 'overdue').length,
    })),
    setupNeededCount: new Set(actions.filter(action => action.categories.some(category => category === 'access' || category === 'equipment')).map(action => action.record.id)).size,
    activeRecords,
  }
}
