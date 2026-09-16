// Queue adapters retain the server's scope and never infer decision permission
// from a request's age, an amount, or the user's displayed role.
export const QUEUE_LABELS = {
  leave: 'Leave', payroll: 'Payroll', procurement: 'Procurement',
  purchase_order: 'Purchase orders', invoice: 'Invoices', profile_document: 'ID verification',
}

export const UNCONNECTED_QUEUES = {
  payroll: { path: '/hr/payroll', label: 'Open payroll', reason: 'Payroll approval routing is not connected to this queue. Review payroll in its workspace.' },
  invoice: { path: '/finance/incoming-invoices', label: 'Open invoices', reason: 'Invoice approvals use individual approval links. Review invoices in their workspace.' },
}

const first = (...values) => values.find(value => value !== null && value !== undefined && value !== '')
const text = value => typeof value === 'object' ? first(value?.name, value?.label, value?.full_name, 'Not recorded') : String(value ?? 'Not recorded')
export const humanize = value => String(value ?? '').replace(/[_-]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
export const timestamp = value => {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
export const formatDate = value => timestamp(value) === null ? 'Not recorded' : new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
export function formatAge(hours) {
  if (hours === null) return 'Age unknown'
  if (hours < 1) return '<1h'
  if (hours < 72) return `${Math.floor(hours)}h`
  return `${Math.floor(hours / 24)}d`
}

export function approvalDetails(item, now = Date.now()) {
  const type = item._approvalType
  const submittedAt = first(item.submitted_at, item.created_at, item.requested_at, item.date_submitted)
  const created = timestamp(submittedAt)
  const ageHours = created !== null && created <= now ? (now - created) / 3600000 : null
  const rawPriority = String(item.priority ?? '').toLowerCase()
  const code = ({ critical: 'urgent', urgent: 'urgent', high: 'high', medium: 'normal', normal: 'normal', low: 'low' })[rawPriority] || 'unknown'
  const priority = { code, label: rawPriority === 'medium' ? 'Medium' : ({ urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low', unknown: 'Not set' })[code] }
  const rawAmount = type === 'procurement'
    ? first(item.total_price, item.estimated_budget, item.total_estimated_cost)
    : type === 'purchase_order' ? first(item.total_amount, item.amount) : null
  const amount = rawAmount !== null && rawAmount !== undefined && String(rawAmount).trim() !== '' && Number.isFinite(Number(rawAmount)) ? Number(rawAmount) : null
  const currency = typeof item.currency === 'string' ? item.currency.trim().toUpperCase() || null : null
  const amountText = amount === null ? '—' : `${currency || 'Currency not recorded'} ${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  // These are approval deadlines, not delivery dates, leave dates or ID expiry.
  const dueAt = type === 'procurement' ? item.review_due_at : null
  const dueTime = timestamp(dueAt)
  const isToday = dueTime !== null && new Date(dueTime).toDateString() === new Date(now).toDateString()
  let stage = first(item.approval_stage, item.workflow_stage, item[item._approvalConfig?.statusField], item.status)
  if (type === 'leave') stage = item.review_stage === 'hr_review' || item.status === 'RM_APPROVED' ? 'HR review' : item.status === 'PENDING' ? 'Manager review' : stage
  if (type === 'profile_document') stage = 'Pending verification'
  const requester = text(first(item.requester_name, item.requested_by_name, item.employee_name, item.issued_by_name, item.created_by_name, item.pr_requester_name, item.user_name, item.user_email))
  return {
    reference: text(first(item.pr_number, item.requisition_number, item.po_number, item.order_number, item.request_number, item.document_number, `${QUEUE_LABELS[type] || 'Request'} #${item.id}`)),
    title: text(first(item.title, item.description, item.purpose, item.reason, item.document_name, item.leave_type_detail?.name, item.document_type_label, item.document_type, item.leave_type)),
    requester, requesterKey: requester,
    department: text(first(item.department_name, item.employee_department, item.department, item.project_department, item.employee_details?.department)),
    submittedAt, ageHours, ageLabel: formatAge(ageHours), ageBasis: item.submitted_at ? 'Since submission' : 'Record age',
    amount, currency, amountText, priority, stageLabel: humanize(stage || 'Pending review'),
    dueAt, dueTime, overdue: dueTime !== null && dueTime < now, dueToday: isToday,
  }
}

export function normalizeApproval(raw, config, now = Date.now()) {
  const item = { ...raw, _approvalType: config.id, _approvalLabel: QUEUE_LABELS[config.id] || config.label, _approvalConfig: config }
  Object.entries(config.fieldMapping || {}).forEach(([key, mapping]) => { item[key] = typeof mapping === 'function' ? mapping(raw) : raw[mapping] })
  // An explicit zero is valid and must not fall through to an estimated budget.
  if (config.id === 'procurement') item.total_estimated_cost = first(raw.total_price, raw.estimated_budget)
  item._queueKey = `${config.id}:${raw.approval_queue_id ?? raw.id}`
  item._canDecide = config.id === 'leave' ? raw.can_review === true
    : config.id === 'purchase_order' ? raw.can_approve === true
      : config.id === 'procurement' ? raw.can_approve === true
        : config.id === 'profile_document' && raw.can_review === true
  item._details = approvalDetails(item, now)
  return item
}

export function sortApprovals(items) {
  const order = { urgent: 0, high: 1, normal: 2, low: 3, unknown: 4 }
  return [...items].sort((a, b) => order[a._details.priority.code] - order[b._details.priority.code]
    || Number(b._details.overdue) - Number(a._details.overdue)
    || (b._details.ageHours ?? -1) - (a._details.ageHours ?? -1))
}

export function filterApprovals(items, filters) {
  const query = filters.search.trim().toLowerCase()
  return items.filter(item => {
    const d = item._details
    if (filters.tab === 'mine' && !item._canDecide) return false
    if (!['mine', 'all'].includes(filters.tab) && item._approvalType !== filters.tab) return false
    if (filters.queue !== 'all' && item._approvalType !== filters.queue) return false
    if (filters.priority !== 'all' && d.priority.code !== filters.priority) return false
    if (filters.requester !== 'all' && d.requesterKey !== filters.requester) return false
    if (filters.age === '24h' && (d.ageHours === null || d.ageHours >= 24)) return false
    if (filters.age === '1-3d' && (d.ageHours === null || d.ageHours < 24 || d.ageHours >= 72)) return false
    if (filters.age === '3d' && (d.ageHours === null || d.ageHours < 72)) return false
    if (filters.age === 'unknown' && d.ageHours !== null) return false
    if (filters.amount === 'none' && d.amount !== null) return false
    if (filters.amount === 'recorded' && d.amount === null) return false
    if (filters.amount.includes(':')) {
      const [currency, range] = filters.amount.split(':')
      if (d.currency !== currency || d.amount === null || (range === 'high' ? d.amount < 100000 : d.amount >= 100000)) return false
    }
    return !query || [d.reference, d.title, d.requester, d.department, item._approvalLabel, d.stageLabel].join(' ').toLowerCase().includes(query)
  })
}

export function approvalsCsv(items) {
  const safe = value => {
    const raw = String(value ?? '')
    const escaped = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
    return `"${escaped.replace(/"/g, '""')}"`
  }
  const rows = [['Reference', 'Description', 'Queue', 'Priority', 'Requester', 'Department', 'Amount', 'Currency', 'Stage', 'Approval deadline', 'Recorded date', 'Record age (hours)', 'Queue entry']]
  items.forEach(item => {
    const d = item._details
    rows.push([d.reference, d.title, item._approvalLabel, d.priority.label, d.requester, d.department, d.amount, d.currency, d.stageLabel, d.dueAt, d.submittedAt, d.ageHours === null ? '' : Math.floor(d.ageHours), item._queueKey])
  })
  return '\uFEFF' + rows.map(row => row.map(safe).join(',')).join('\r\n')
}
