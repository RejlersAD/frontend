export const ENQUIRY_STATUSES = [
  ['', 'All statuses'], ['new', 'New'], ['assigned', 'Assigned'], ['in_progress', 'In progress'],
  ['waiting_user', 'Waiting for user'], ['responded', 'Responded'], ['escalated', 'Escalated'],
  ['pending_confirmation', 'Awaiting confirmation'], ['reopened', 'Reopened'],
  ['resolved', 'Resolved'], ['closed', 'Closed'], ['spam', 'Spam'],
]
export const ENQUIRY_PRIORITIES = [['', 'All priorities'], ['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']]
export const INITIAL_ENQUIRY_FILTERS = { search: '', status: '', urgency: '', department: '', owner: '', sla: '', queue: 'all' }
export const ENQUIRY_PAGE_SIZE = 7

export function metricNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}
export const metricText = value => metricNumber(value) === null ? '—' : Number(value).toLocaleString('en-GB', { maximumFractionDigits: 1 })
export const statusLabel = value => ENQUIRY_STATUSES.find(([code]) => code && code === value)?.[1] || 'Not recorded'
export const priorityLabel = value => ENQUIRY_PRIORITIES.find(([code]) => code && code === value)?.[1] || 'Not set'
export const dateTime = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded'

export function elapsedText(value, now = Date.now()) {
  const then = value ? Date.parse(value) : NaN
  if (!Number.isFinite(then) || then > now) return 'Age unknown'
  const hours = (now - then) / 3600000
  if (hours < 1) return '<1h'
  if (hours < 24) return `${Math.floor(hours)}h`
  const remaining = Math.floor(hours % 24)
  return `${Math.floor(hours / 24)}d${remaining ? ` ${remaining}h` : ''}`
}
export function enquiryAge(row, now = Date.now()) {
  if (row.is_overdue === true) {
    const elapsed = elapsedText(row.due_at, now)
    return elapsed === 'Age unknown' ? 'Overdue' : `${elapsed} overdue`
  }
  return elapsedText(row.created_at, now)
}
export function enquiryParams(filters, page = 1, pageSize = ENQUIRY_PAGE_SIZE) {
  return Object.fromEntries(Object.entries({
    page, page_size: pageSize, queue: filters.queue, search: filters.search.trim(),
    status: filters.status, urgency: filters.urgency, department: filters.department,
    assigned_to: filters.owner, sla: filters.sla,
  }).filter(([, value]) => value !== '' && value !== undefined && value !== null))
}
export function readEnquiryList(data) {
  if (!Array.isArray(data?.results) || metricNumber(data?.count) === null || !Number.isInteger(Number(data.count))
    || data.results.length > Number(data.count)
    || data.results.some(row => row?.id === null || row?.id === undefined || typeof row !== 'object')
    || new Set(data.results.map(row => String(row.id))).size !== data.results.length) throw new Error('The enquiry register returned an incomplete response. Please retry.')
  return { items: data.results, count: Number(data.count) }
}
export function enquiryMetrics(stats) {
  const responseCount = metricNumber(stats?.response_sample_count)
  const slaCount = metricNumber(stats?.first_response_sla_sample_count)
  const sla = metricNumber(stats?.first_response_sla_compliance)
  return {
    open: metricNumber(stats?.open_count), unassigned: metricNumber(stats?.active_unassigned),
    overdue: metricNumber(stats?.overdue), mine: metricNumber(stats?.assigned_to_me), total: metricNumber(stats?.total),
    median: responseCount > 0 ? metricNumber(stats?.median_response_hours) : null,
    responseCount, firstResponseSla: slaCount > 0 && sla !== null && sla <= 100 ? sla : null,
    slaCount, resolvedWeek: metricNumber(stats?.resolved_this_week),
  }
}
export function enquiriesCsv(items) {
  const escape = value => {
    const text = String(value ?? '')
    const safe = /^\s*[=+\-@\t\r]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }
  const rows = [['Reference', 'Request', 'Requester', 'Department', 'Owner', 'Priority', 'Status', 'Received', 'SLA deadline', 'Overdue']]
  for (const row of items) rows.push([row.reference, row.subject, row.name, row.department, row.assigned_to?.name || 'Unassigned', priorityLabel(row.urgency), statusLabel(row.status), row.created_at, row.due_at, typeof row.is_overdue === 'boolean' ? row.is_overdue ? 'Yes' : 'No' : 'Not recorded'])
  return '\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n')
}
