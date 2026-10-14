import { viewableModuleCodes, resolveRouteModule } from '../../config/serviceAccess.config'

export const numberValue = (value, signed = false) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && (signed || number >= 0) ? number : null
}
export const metric = (value, signed = false) => {
  const number = numberValue(value, signed)
  return number === null ? '—' : number.toLocaleString('en-GB', { maximumFractionDigits: 1 })
}
export const safeRoute = value => {
  if (typeof value !== 'string' || !/^\/(?!\/)/.test(value) || [...value].some(char => char === '\\' || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null
  try {
    const url = new URL(value, 'https://radai.local')
    if (url.origin !== 'https://radai.local' || /^\/api(?:\/|$)/i.test(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return null }
}
export const displayDate = value => {
  if (!value) return 'Not recorded'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value)
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded'
}
export const humanize = value => String(value || 'Not recorded').replace(/[_-]+/g, ' ').replace(/^\w/, letter => letter.toUpperCase())
export function taskIsOverdue(dueDate, asOf, timeZone) {
  if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !asOf || !timeZone) return false
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(asOf))
    const fields = Object.fromEntries(parts.map(part => [part.type, part.value]))
    return dueDate < `${fields.year}-${fields.month}-${fields.day}`
  } catch { return false }
}
export const isReady = source => source?.status === 'ready'
const activityText = value => {
  if (typeof value !== 'string' || /(?:\b(?:GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)\s+(?:https?:\/\/|\/)|\/api(?:\/|\b))/i.test(value)) return ''
  return [...value].map(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char).join('').trim()
}
export function presentActivity(source) {
  if (!isReady(source)) return source
  // An older response contains request totals, which must not become work-action counts.
  if (source.basis !== 'recorded_user_actions') return { ...source, status: 'unavailable', rows: [], series: [], total_count: null,
    reason: 'Your recent actions could not be loaded. Refresh to try again.' }
  const rows = (source.rows || []).flatMap(row => {
    if (!row || row.id === undefined || row.id === null || row.type === 'api_request' || row.category === 'api') return []
    const title = activityText(row.title), sourceLabel = activityText(row.source_label)
    if (!title || !sourceLabel) return []
    const viewed = row.type === 'workspace_view' && row.basis === 'workspace_view' && row.status_label === 'Viewed' && row.success === true
    return [{ id: row.id, title, source_label: sourceLabel, description: activityText(row.description),
      timestamp: row.timestamp, success: row.success, status_label: viewed ? 'Viewed' : row.success === true ? 'Recorded' : row.success === false ? 'Failed' : 'Not reported', route: safeRoute(row.route) }]
  })
  return { ...source, rows }
}
export function readBundle(data) {
  if (data?.schema_version !== '1.0' || !data.period || !data.as_of) throw new Error('Your work summary is not available.')
  for (const name of ['tasks', 'leave', 'hours', 'calendar', 'activity']) {
    if (!['ready', 'error', 'unavailable'].includes(data[name]?.status)) throw new Error('Your work summary could not be verified.')
  }
  for (const name of ['tasks', 'calendar', 'activity']) {
    if (isReady(data[name]) && !Array.isArray(data[name].rows)) throw new Error('Your work summary is incomplete.')
  }
  return data
}
export function calendarSource(bundle, pending, error) {
  if (pending) return { state: 'loading', events: [] }
  if (error) return { state: 'error', events: [], message: 'Calendar could not be loaded.' }
  const source = bundle?.calendar
  if (!source) return { state: 'unavailable', events: [], message: 'Calendar is not available.' }
  const partial = source.sources?.some(item => item.status !== 'ready')
  return { state: source.status, events: (source.rows || []).map(row => ({ id: row.id, title: row.region ? `${row.title} · ${humanize(row.region)}` : row.title, region: row.region, date: row.start_date, end_date: row.end_date, kind: row.type === 'public_holiday' ? 'holiday' : row.type, href: safeRoute(row.route) })), truncated: source.truncated,
    message: partial ? 'Some calendar sources are unavailable. Showing available events.' : source.reason || '' }
}
const FEATURE_MODULES = { pfd_converter: 'pfd_to_pid', user_management: 'user_mgmt', sales_dashboard: 'sales', sales_crm: 'sales', sales_pipeline: 'sales', sales_ai_insights: 'sales', project_management: 'project_control' }
const CATEGORY_ORDER = ['engineering', 'document_management', 'project_control', 'procurement', 'human_resource', 'support']
export function availableWorkspaces(features, profile) {
  const codes = viewableModuleCodes(profile || {})
  const seen = new Set()
  const items = (features || []).flatMap(feature => {
    const route = safeRoute(feature.frontendRoute || feature.frontend_route)
    if (!route || !feature.id || feature.status && feature.status !== 'active') return []
    const url = new URL(route, 'https://radai.local')
    const required = resolveRouteModule(FEATURE_MODULES[feature.id] || feature.moduleCode || feature.id, url.pathname, url.search)
    if (!codes.includes(required) || seen.has(route)) return []
    seen.add(route)
    return [{ id: String(feature.id), title: feature.name, description: feature.description || 'Open workspace', route, category: feature.category || 'other', order: numberValue(feature.order) ?? 100 }]
  })
  items.push({ id: 'self-service', title: 'HR Self Service', description: 'Leave, time and personal information', route: '/profile', category: 'human_resource', order: -1 },
    { id: 'my-enquiries', title: 'Enquiries', description: 'Get help and track your requests', route: '/my-enquiries', category: 'support', order: -1 })
  return items.sort((a, b) => (CATEGORY_ORDER.indexOf(a.category) < 0 ? 99 : CATEGORY_ORDER.indexOf(a.category)) - (CATEGORY_ORDER.indexOf(b.category) < 0 ? 99 : CATEGORY_ORDER.indexOf(b.category)) || a.order - b.order)
}
export function defaultShortcuts(items) {
  const selected = []
  for (const category of CATEGORY_ORDER) {
    const item = items.find(row => row.category === category)
    if (item) selected.push(item.id)
  }
  return [...selected, ...items.map(item => item.id).filter(id => !selected.includes(id))].slice(0, 6)
}
export const DEFAULT_PREFERENCES = { calendar: true, notices: true, workspaces: true, activity: true, shortcuts: null }
export function loadPreferences(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key))
    return { ...Object.fromEntries(['calendar', 'notices', 'workspaces', 'activity'].map(name => [name, typeof saved?.[name] === 'boolean' ? saved[name] : true])), shortcuts: Array.isArray(saved?.shortcuts) ? [...new Set(saved.shortcuts.filter(id => typeof id === 'string'))].slice(0, 6) : null }
  } catch { return { ...DEFAULT_PREFERENCES } }
}
