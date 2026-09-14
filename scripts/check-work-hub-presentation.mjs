import test from 'node:test'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Bundle only the real pure helper and its static access catalogue; no app, API or DOM.
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/workhub/workHubPresentation.js', import.meta.url))],
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const helpers = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const { numberValue, metric, safeRoute, readBundle, calendarSource, availableWorkspaces, defaultShortcuts, loadPreferences, taskIsOverdue, presentActivity } = helpers

const sourceBundle = () => ({
  schema_version: '1.0', as_of: '2026-09-17T00:30:00+04:00',
  period: { year: 2026, month: 9, timezone: 'Asia/Dubai' },
  tasks: { status: 'ready', counts: { open: 0, due: 0, due_today: 0, overdue: 0 }, rows: [] },
  leave: { status: 'unavailable', balance: null },
  hours: { status: 'ready', value: 0 },
  calendar: { status: 'ready', rows: [], sources: [{ id: 'own_leave', status: 'ready' }, { id: 'public_holidays', status: 'ready' }] },
  activity: { status: 'ready', total_count: 0, rows: [], series: [] },
})
const profileWith = grants => ({ modules: Object.keys(grants).map(code => ({ code })), module_actions: grants })
const feature = (id, route, category = 'engineering') => ({ id, name: id, frontend_route: route, status: 'active', category })

test('legacy request history cannot be displayed as user work or counted as actions', () => {
  const source = { status: 'ready', total_count: 500, rows: [{ id: 1, type: 'api_request', category: 'api', description: 'GET /api/v1/rbac/users/me/' }], series: [{ date: '2026-09-14', count: 500 }] }
  const activity = presentActivity(source)
  assert.equal(activity.status, 'unavailable')
  assert.equal(activity.total_count, null)
  assert.deepEqual(activity.rows, [])
  assert.deepEqual(activity.series, [])
  assert.equal(source.total_count, 500)
})

test('recent actions use explicit titles and workspace names without exposing request text', () => {
  const base = { id: 1, type: 'document_uploaded', category: 'data_management', title: 'Document uploaded', source_label: 'Documents', description: 'Recorded document upload.', timestamp: '2026-09-14T08:00:00Z', success: true }
  const activity = presentActivity({ status: 'ready', basis: 'recorded_user_actions', rows: [
    base,
    { ...base, id: 2, type: 'api_request', title: 'Load profile', description: 'GET /api/v1/rbac/users/me/' },
    { ...base, id: 3, category: 'api' },
    { ...base, id: 4, title: 'POST /api/v1/rbac/ai-champion/track/activity/' },
    { ...base, id: 5, source_label: '/api/v1/documents/' },
    { ...base, id: 6, title: undefined, description: 'Never infer a completed action from request text' },
    { ...base, id: 7, description: 'GET /api/v1/users/employees/my-profile-photo/' },
  ] })
  assert.deepEqual(activity.rows.map(row => row.id), [1, 7])
  assert.equal(activity.rows[0].title, 'Document uploaded')
  assert.equal(activity.rows[0].source_label, 'Documents')
  assert.equal(activity.rows[1].description, '')
  assert.doesNotMatch(JSON.stringify(activity.rows), /\/api\//)
})

test('recent action details preserve recorded failure and accept only frontend destinations', () => {
  const row = { id: 1, title: 'Document upload unsuccessful', source_label: 'Documents', success: false, description: 'Please check the document workspace.', metadata: { private: 'excluded' } }
  const activity = presentActivity({ status: 'ready', basis: 'recorded_user_actions', rows: [
    { ...row, route: '/api/v1/documents/1/' }, { ...row, id: 2, route: 'https://other.example/document' },
    { ...row, id: 3, route: '/projects?project=42' },
  ] })
  assert.equal(activity.rows[0].success, false)
  assert.equal(activity.rows[0].route, null)
  assert.equal(activity.rows[1].route, null)
  assert.equal(activity.rows[2].route, '/projects?project=42')
  assert.equal('metadata' in activity.rows[0], false)
})

test('recorded workspace visits remain visible and say Viewed without implying task completion', () => {
  const source = { status: 'ready', basis: 'recorded_user_actions', coverage: 'work_actions_and_workspace_views',
    total_count: 2, series: [{ date: '2026-09-14', count: 2 }], rows: [
      { id: 'view:1', type: 'workspace_view', basis: 'workspace_view', category: 'workspace_navigation',
        title: 'Viewed Project Control', source_label: 'Project Control', status_label: 'Viewed', success: true,
        description: 'Workspace visit recorded.', timestamp: '2026-09-14T08:00:00Z', route: '/projects' },
      { id: 'view:2', type: 'workspace_view', basis: 'workspace_view', category: 'workspace_navigation',
        title: 'Viewed Procurement', source_label: 'Procurement', status_label: 'Viewed', success: true,
        description: 'Workspace visit recorded.', timestamp: '2026-09-14T07:00:00Z', route: null },
    ] }
  const activity = presentActivity(source)
  assert.equal(activity.rows.length, 2)
  assert.equal(activity.rows[0].status_label, 'Viewed')
  assert.equal(activity.rows[0].route, '/projects')
  assert.equal(activity.rows[1].status_label, 'Viewed')
  assert.equal(activity.rows[1].route, null)
  assert.equal(activity.total_count, 2)
  assert.equal(activity.series[0].count, 2)
  const failed = presentActivity({ ...source, rows: [{ ...source.rows[0], success: false }] })
  assert.equal(failed.rows[0].status_label, 'Failed')
})

test('empty recorded action history remains measured zero, and source failures stay distinct', () => {
  const empty = { status: 'ready', basis: 'recorded_user_actions', rows: [], total_count: 0, series: [] }
  assert.deepEqual(presentActivity(empty), empty)
  for (const status of ['error', 'unavailable']) {
    const source = { status, rows: [], total_count: null }
    assert.equal(presentActivity(source), source)
  }
  assert.equal(presentActivity(undefined), undefined)
})

test('unknown and malformed personal measurements never become observed zero', () => {
  for (const value of [null, undefined, '', ' ', false, true, [], [0], {}, NaN, Infinity, 'unknown']) {
    assert.equal(numberValue(value), null)
    assert.equal(numberValue(value, true), null)
    assert.notEqual(metric(value), '0')
  }
  for (const value of [0, '0', '0.0']) assert.equal(numberValue(value), 0)
  assert.equal(metric(0), '0')
})

test('recorded negative leave balances remain signed while negative hours and counts are unknown', () => {
  assert.equal(numberValue('-2.5', true), -2.5)
  assert.equal(metric(-2.5, true), '-2.5')
  assert.equal(numberValue(-2.5), null)
  assert.equal(numberValue(' 7.5 '), 7.5)
})

test('task overdue uses the service calendar day at 00:30 Dubai, before UTC midnight', () => {
  const asOf = '2026-09-16T20:30:00Z' // 17 September, 00:30 in Asia/Dubai.
  assert.equal(taskIsOverdue('2026-09-16', asOf, 'Asia/Dubai'), true)
  assert.equal(taskIsOverdue('2026-09-17', asOf, 'Asia/Dubai'), false)
  assert.equal(taskIsOverdue('2026-09-18', asOf, 'Asia/Dubai'), false)
  assert.equal(taskIsOverdue('2026-09-16', asOf, 'UTC'), false)
})

test('task deadline highlighting follows the report snapshot and changes only at service midnight', () => {
  assert.equal(taskIsOverdue('2026-09-16', '2026-09-16T19:59:59Z', 'Asia/Dubai'), false)
  assert.equal(taskIsOverdue('2026-09-16', '2026-09-16T20:00:00Z', 'Asia/Dubai'), true)
  assert.equal(taskIsOverdue('2024-02-29', '2024-02-29T23:00:00+04:00', 'Asia/Dubai'), false)
  assert.equal(taskIsOverdue('2024-02-29', '2024-03-01T00:00:00+04:00', 'Asia/Dubai'), true)
})

test('missing deadline, invalid snapshot or unrecognized service timezone cannot claim overdue', () => {
  const asOf = '2026-09-16T20:30:00Z'
  for (const dueDate of [null, undefined, '', 'not a date', '16/09/2026', '2026-09-16T12:00:00Z']) {
    assert.equal(taskIsOverdue(dueDate, asOf, 'Asia/Dubai'), false)
  }
  for (const invalidAsOf of [null, undefined, '', 'not a date']) {
    assert.equal(taskIsOverdue('2026-09-16', invalidAsOf, 'Asia/Dubai'), false)
  }
  assert.equal(taskIsOverdue('2026-09-16', asOf, undefined), false)
  assert.equal(taskIsOverdue('2026-09-16', asOf, 'Invalid/Timezone'), false)
})

test('source validation preserves successful empty data and independent unavailable or failed sections', () => {
  const bundle = sourceBundle()
  bundle.activity = { status: 'error', reason: 'Source failed.', rows: [] }
  assert.equal(readBundle(bundle), bundle)
  assert.equal(bundle.tasks.counts.open, 0)
  assert.equal(bundle.hours.value, 0)
  assert.equal(bundle.leave.balance, null)
  assert.equal(bundle.activity.status, 'error')
})

test('malformed bundles cannot silently claim a ready empty source', () => {
  for (const broken of [null, {}, { ...sourceBundle(), schema_version: '2.0' },
    { ...sourceBundle(), tasks: { status: 'ready' } },
    { ...sourceBundle(), calendar: { status: 'available', rows: [] } },
    { ...sourceBundle(), activity: { status: 'ready', rows: {} } }]) assert.throws(() => readBundle(broken))
})

test('calendar loading and errors replace stale events and do not claim observed zero', () => {
  const bundle = sourceBundle()
  bundle.calendar.rows = [{ id: 'holiday:1', type: 'public_holiday', title: 'Published holiday', start_date: '2026-09-17' }]
  assert.deepEqual(calendarSource(bundle, true, ''), { state: 'loading', events: [] })
  assert.equal(calendarSource(bundle, false, 'Network error').state, 'error')
  assert.deepEqual(calendarSource(bundle, false, 'Network error').events, [])
  assert.equal(calendarSource(null, false, '').state, 'unavailable')
  assert.equal(calendarSource(sourceBundle(), false, '').state, 'ready')
  assert.deepEqual(calendarSource(sourceBundle(), false, '').events, [])
})

test('published holiday type and recorded region survive the calendar adapter without claiming personal applicability', () => {
  const bundle = sourceBundle()
  bundle.calendar.rows = [{ id: 'holiday:7', type: 'public_holiday', title: 'Published holiday', region: 'finland',
    start_date: '2026-09-17', end_date: '2026-09-17', route: '/profile?tab=schedule' }]
  const [event] = calendarSource(bundle, false, '').events
  assert.equal(event.kind, 'holiday')
  assert.equal(event.region, 'finland')
  assert.match(event.title, /Published holiday.*Finland/)
  assert.equal(event.date, '2026-09-17')
  assert.equal(event.end_date, '2026-09-17')
  assert.equal(event.href, '/profile?tab=schedule')
})

test('available own leave remains visible with explicit coverage when the holiday source fails', () => {
  const bundle = sourceBundle()
  bundle.calendar.sources[1].status = 'error'
  bundle.calendar.truncated = true
  bundle.calendar.rows = [{ id: 'leave:own', type: 'leave', title: 'Your approved leave',
    start_date: '2026-09-18', end_date: '2026-09-20', route: '/profile?tab=leave' }]
  const calendar = calendarSource(bundle, false, '')
  assert.equal(calendar.state, 'ready')
  assert.equal(calendar.events.length, 1)
  assert.equal(calendar.events[0].kind, 'leave')
  assert.equal(calendar.events[0].end_date, '2026-09-20')
  assert.match(calendar.message, /Some calendar sources are unavailable/)
  assert.equal(calendar.truncated, true)
})

test('source navigation refuses external, protocol-relative, control-character and API destinations', () => {
  for (const route of [null, '', 'https://other.example/path', '//other.example/path', '/\\other.example',
    '/profile\n', '/api/v1/users/', '/API/users', '/projects/../api/users', 'javascript:alert(1)']) assert.equal(safeRoute(route), null)
  assert.equal(safeRoute('/projects?project=42&view=plan-baseline#record'), '/projects?project=42&view=plan-baseline#record')
  assert.equal(safeRoute('/profile?tab=leave'), '/profile?tab=leave')
})

test('workspace shortcuts require effective read grants, even for an administrator or a listed module', () => {
  const features = [feature('pid_analysis', '/pid'), feature('project_management', '/projects')]
  const denied = { ...profileWith({ pid_analysis: [], project_control: ['create'] }), is_admin: true }
  assert.deepEqual(availableWorkspaces(features, denied).map(item => item.id), ['self-service', 'my-enquiries'])
  const allowed = availableWorkspaces(features, profileWith({ pid_analysis: ['read'] })).map(item => item.id)
  assert.equal(allowed.includes('pid_analysis'), true)
  assert.equal(allowed.includes('project_management'), false)
})

test('business subservices and planning views cannot inherit broad module navigation grants', () => {
  const features = [feature('sales_crm', '/sales/opportunities'), feature('project_management', '/projects?view=plan-baseline')]
  const broad = profileWith({ sales: ['read'], project_control: ['read'] })
  assert.deepEqual(availableWorkspaces(features, broad).map(item => item.id), ['self-service', 'my-enquiries'])
  const precise = profileWith({ sales_opportunities: ['read'], planning_package: ['read'] })
  assert.deepEqual(new Set(availableWorkspaces(features, precise).map(item => item.id)), new Set(['sales_crm', 'project_management', 'self-service', 'my-enquiries']))
})

test('workspace suggestions remove inactive and duplicate destinations and retain only six defaults', () => {
  const features = Array.from({ length: 8 }, (_, index) => feature(`module_${index}`, `/workspace-${index}`))
  features.push({ ...features[0], id: 'duplicate' }, { ...feature('inactive', '/inactive'), status: 'inactive' })
  const grants = Object.fromEntries(features.map(item => [item.id, ['read']]))
  const workspaces = availableWorkspaces(features, profileWith(grants))
  assert.equal(workspaces.filter(item => item.route === '/workspace-0').length, 1)
  assert.equal(workspaces.some(item => item.id === 'inactive'), false)
  const defaults = defaultShortcuts(workspaces)
  assert.equal(defaults.length, 6)
  assert.equal(new Set(defaults).size, 6)
  assert.equal(defaults.every(id => workspaces.some(item => item.id === id)), true)
})

test('local preferences reject malformed state without persisting employee data', () => {
  const original = globalThis.localStorage
  try {
    globalThis.localStorage = { getItem: () => '{invalid' }
    assert.equal(loadPreferences('test').calendar, true)
    globalThis.localStorage = { getItem: () => JSON.stringify({ calendar: false, notices: 'false', activity: true,
      shortcuts: ['pid_analysis', 'pid_analysis', null, 42, 'self-service'], employee: 'not retained' }) }
    const value = loadPreferences('test')
    assert.equal(value.calendar, false)
    assert.equal(value.notices, true)
    assert.deepEqual(value.shortcuts, ['pid_analysis', 'self-service'])
    assert.equal('employee' in value, false)
  } finally {
    if (original === undefined) delete globalThis.localStorage
    else globalThis.localStorage = original
  }
})
