const ACTIVE_STATUSES = new Set(['initiated', 'access_revocation', 'equipment_return', 'exit_interview', 'final_settlement'])
const REQUIRED_STAGES = ['exit_initiation', 'access_revocation', 'asset_return', 'exit_clearance', 'final_settlement']

const READINESS_CATEGORIES = [
  { id: 'documents', label: 'HR documents' },
  { id: 'access', label: 'IT access' },
  { id: 'equipment', label: 'Company assets' },
  { id: 'finance', label: 'Finance & payroll' },
]

// These are responsible workflow teams, not individual task assignees.
const OWNERS = [
  { id: 'hr', label: 'HR', initials: 'HR', tone: 'blue' },
  { id: 'it', label: 'IT', initials: 'IT', tone: 'amber' },
  { id: 'managers', label: 'Line managers', initials: 'LM', tone: 'green' },
  { id: 'finance', label: 'HR / Finance', initials: 'HF', tone: 'green' },
]
const ASSET_OWNER = { id: 'it_hr', label: 'IT / HR', initials: 'IH', tone: 'amber' }
const UNKNOWN_OWNER = { id: 'unassigned', label: 'Unassigned', initials: '?', tone: 'slate' }

const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
const dateAfter = (date, days) => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return dateKey(result)
}

const newestRecordFirst = (a, b) => {
  const created = record => Date.parse(record.created_at) || Date.parse(record.initiated_date) || 0
  return created(b) - created(a) || String(a.employee_name || '').localeCompare(String(b.employee_name || ''))
}

const loadCollection = async (apiClient, endpoint, signal) => {
  const records = []
  const visited = new Set()
  let url = endpoint
  while (url) {
    if (visited.has(url)) throw new Error('Offboarding pagination returned a repeated page.')
    visited.add(url)
    const { data } = await apiClient.get(url, { signal })
    if (Array.isArray(data)) return records.concat(data)
    if (!Array.isArray(data?.results)) throw new Error('Unable to read offboarding records.')
    records.push(...data.results)
    // Keep pagination on the requested API endpoint, even when next is absolute.
    url = data.next ? `${endpoint}${new URL(data.next, 'https://offboarding.local').search}` : null
  }
  return records
}

export const loadOffboardingDashboardRecords = async (apiClient, { signal } = {}) => {
  const [records, checklist] = await Promise.all([
    loadCollection(apiClient, '/onboarding/offboarding/', signal),
    loadCollection(apiClient, '/onboarding/checklist/', signal),
  ])
  const checklistByRecord = new Map()
  for (const item of checklist) {
    if (item.offboarding_record == null) continue
    const key = String(item.offboarding_record)
    if (!checklistByRecord.has(key)) checklistByRecord.set(key, [])
    checklistByRecord.get(key).push(item)
  }
  return records.map(record => ({ ...record, checklist_items: checklistByRecord.get(String(record.id)) || [] }))
}

const ownerForTask = task => {
  if (task.stage === 'access_revocation') return OWNERS[1]
  if (task.stage === 'asset_return') return ASSET_OWNER
  if (task.stage === 'final_settlement') return OWNERS[3]
  if (['exit_initiation', 'exit_clearance'].includes(task.stage)) return OWNERS[0]
  return UNKNOWN_OWNER
}

const categoriesForTask = task => {
  if (task.stage === 'access_revocation') return ['access']
  if (task.stage === 'asset_return') return ['equipment']
  if (['exit_initiation', 'exit_clearance'].includes(task.stage)) return ['documents']
  if (task.stage === 'final_settlement') {
    return /(?:service|employment) documents?|final HR review/i.test(task.task_name || '') ? ['documents'] : ['finance']
  }
  // Legacy/custom checklist items can still provide category evidence by title.
  const categories = []
  const title = task.task_name || ''
  if (/documents?|resignation|termination|exit interview|handover|confidentiality/i.test(title)) categories.push('documents')
  if (/account|email|directory|VPN|MFA|revoke.*access|revocation|permissions/i.test(title)) categories.push('access')
  if (/laptop|desktop|monitor|equipment|assets?|hardware|phone|access card|keys|badge/i.test(title)) categories.push('equipment')
  if (/payroll|settlement|timesheet|attendance|benefits|insurance/i.test(title)) categories.push('finance')
  return categories
}

const actionLabelForTask = task => {
  const categories = categoriesForTask(task)
  if (categories.includes('access')) return 'Revoke access'
  if (categories.includes('equipment')) return 'Mark as recovered'
  if (/timesheet|attendance/i.test(task.task_name || '')) return 'Review timesheet'
  if (categories.includes('finance')) return 'Review settlement'
  if (/handover|knowledge/i.test(task.task_name || '')) return 'View details'
  if (categories.includes('documents')) return 'Review documents'
  return 'View details'
}

const recordReadiness = record => {
  const tasks = record.checklist_items || []
  const categories = Object.fromEntries(READINESS_CATEGORIES.map(category => [category.id, []]))
  tasks.forEach(task => categoriesForTask(task).forEach(category => categories[category].push(task)))
  const allCategoriesTracked = Object.values(categories).every(items => items.length > 0)
  const allStagesTracked = REQUIRED_STAGES.every(stage => tasks.some(task => task.stage === stage))
  const approvalsClear = ['approved', 'not_required'].includes(record.project_manager_approval_status)
    && (!Array.isArray(record.exit_approvals) || record.exit_approvals.every(approval => approval.status === 'approved'))
  const ready = allCategoriesTracked && allStagesTracked && tasks.every(task => task.completed) && approvalsClear
  const progress = tasks.length ? tasks.filter(task => task.completed).length / tasks.length : null
  return { categories, ready, progress, allCategoriesTracked }
}

// Use the same normalized shape as the onboarding dashboard while keeping the API's
// native last_working_day on each record for departure dates and filtering.
export const buildOffboardingDashboard = (records = [], filters = {}, now = new Date()) => {
  const { entity = 'all', department = 'all', dateRange = '30' } = filters
  const today = dateKey(now)
  const soon = dateAfter(now, 7)
  const days = Number(String(dateRange).replace(/\D/g, ''))
  const horizon = dateRange === 'all' || !days ? null : dateAfter(now, days)
  const filteredRecords = records.filter(record => (!entity || entity === 'all' || record.branch === entity)
    && (!department || department === 'all' || record.department === department))
  // The upcoming range must not hide active exits or their outstanding work.
  const activeRecords = filteredRecords.filter(record => ACTIVE_STATUSES.has(record.status)).sort(newestRecordFirst)
  const futureActiveRecords = activeRecords.filter(record => record.last_working_day && record.last_working_day >= today)
  // Completion closes the workflow automatically; retain cleared employees until
  // their departure so readiness does not reset to zero as work is finished.
  const completedRecords = filteredRecords.filter(record => record.status === 'completed'
    && (!horizon || (record.last_working_day && record.last_working_day >= today && record.last_working_day <= horizon)))
  const departureRecords = [...activeRecords, ...completedRecords]

  const readinessByRecord = new Map(departureRecords.map(record => [record.id, recordReadiness(record)]))
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
        severity: dueDate && dueDate < today ? 'overdue' : dueDate && dueDate <= soon ? 'soon' : 'pending',
        actionLabel: actionLabelForTask(task),
        categories: categoriesForTask(task),
      }
    }))
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.record.employee_name.localeCompare(b.record.employee_name))

  const joiners = departureRecords.filter(record => record.last_working_day && record.last_working_day >= today
    && (!horizon || record.last_working_day <= horizon))
    .sort((a, b) => a.last_working_day.localeCompare(b.last_working_day) || a.employee_name.localeCompare(b.employee_name))
    .map(record => {
      const { ready, progress, allCategoriesTracked } = readinessByRecord.get(record.id)
      if (ready) return { record, readiness: 'Clearance complete', tone: 'green' }
      if (progress === null) return { record, readiness: 'Not tracked', tone: 'slate' }
      if (allCategoriesTracked && progress >= 0.8) return { record, readiness: 'Mostly ready', tone: 'green' }
      if (progress > 0) return { record, readiness: 'In progress', tone: 'amber' }
      return { record, readiness: 'Not started', tone: 'slate' }
    })

  const readiness = READINESS_CATEGORIES.map(category => {
    const items = [...readinessByRecord.values()].flatMap(record => record.categories[category.id])
    return { ...category, percent: items.length ? Math.round(items.filter(item => item.completed).length / items.length * 100) : null }
  })
  const hasTrackedReadiness = [...readinessByRecord.values()].some(record => Object.values(record.categories).some(items => items.length))
  const owners = [...OWNERS]
  if (actions.some(action => action.ownerId === ASSET_OWNER.id)) owners.push(ASSET_OWNER)
  if (actions.some(action => action.ownerId === UNKNOWN_OWNER.id)) owners.push(UNKNOWN_OWNER)

  return {
    activeCount: activeRecords.length,
    pastActiveCount: activeRecords.filter(record => record.last_working_day && record.last_working_day < today).length,
    undatedActiveCount: activeRecords.filter(record => !record.last_working_day).length,
    futureActiveCount: futureActiveRecords.length,
    upcomingOutsideRangeCount: horizon ? futureActiveRecords.filter(record => record.last_working_day > horizon).length : 0,
    overdueCount: actions.filter(action => action.severity === 'overdue').length,
    joiningSoonCount: joiners.filter(({ record }) => record.last_working_day <= soon).length,
    dayOneReadyPercent: hasTrackedReadiness ? Math.round([...readinessByRecord.values()].filter(record => record.ready).length / departureRecords.length * 100) : null,
    actions,
    joiners,
    readiness,
    workload: owners.map(owner => ({
      ...owner,
      open: owner.id === 'managers' ? null : actions.filter(action => action.ownerId === owner.id).length,
      overdue: owner.id === 'managers' ? null : actions.filter(action => action.ownerId === owner.id && action.severity === 'overdue').length,
    })),
    setupNeededCount: new Set(actions.filter(action => action.categories.includes('access')).map(action => action.record.id)).size,
    activeRecords,
  }
}
