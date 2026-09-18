// Synthetic records follow the existing project and planning serializers.
// Browser interception keeps these fixtures out of the application database.
export const fixedNow = '2026-09-15T06:30:00Z'
export const scheduleActor = { id: 7, email: 'manager@example.test', first_name: 'Maya', last_name: 'Hassan' }

const coreProject = {
  id: 17, code: '5900913', name: 'Residue Yield Improvement Project', client_name: 'ADNOC Refining',
  status: 'active', priority: 'high', progress: 42, start_date: '2026-01-05', end_date: '2026-12-20',
  owner: scheduleActor, owner_name: 'Maya Hassan', currency: 'AED', contract_value: '12500000.00',
  scope_type: 'epcm', location: 'Abu Dhabi', description: 'Engineering and procurement schedule.',
  team_members_data: [{ id: 1, user: scheduleActor, role: 'project_manager', is_active: true }],
  team_size: 6, is_overdue: false, custom_fields: { data_date: '2026-09-15', forecast_finish: '2026-12-28' },
  tasks_summary: { total: 0 }, milestones_summary: { total: 1, completed: 0 },
  created_at: '2026-01-05T08:00:00Z', updated_at: '2026-09-15T06:00:00Z',
}

const activity = (id, externalId, name, discipline, role, start, finish, extra = {}) => ({
  id, version: 91, wbs_node: discipline === 'procurement' ? 202 : 201, calendar: 301,
  external_id: externalId, name, activity_type: 'task', is_milestone: false,
  discipline, responsible_role: role, duration_days: 20, constraint_type: 'none', constraint_date: null,
  planned_start: start, planned_finish: finish, early_start: start, early_finish: finish,
  late_start: start, late_finish: finish, total_float_days: '12.00', free_float_days: '5.00',
  is_critical: false, sort_order: id, metadata: {}, created_at: '2026-01-05T08:00:00Z', updated_at: fixedNow,
  ...extra,
})

const currentActivities = [
  activity(401, 'ENG-001', 'Process design basis', 'process', 'Process Lead', '2026-05-01', '2026-08-20'),
  activity(402, 'PIP-014', 'Piping isometrics package', 'piping', 'Piping Lead', '2026-08-25', '2026-09-29', { duration_days: 40, is_critical: true, total_float_days: '-5.00', free_float_days: '0.00' }),
  activity(403, 'ELE-007', 'Cable routing review', 'electrical', 'Electrical Lead', '2026-09-20', '2026-10-09', { duration_days: 14 }),
  activity(404, 'PRO-021', 'Long-lead pump procurement', 'procurement', 'Procurement Lead', '2026-09-03', '2026-10-16', { duration_days: 21, is_critical: true, total_float_days: '0.00', metadata: { status: 'blocked', constraints: 'Vendor documents pending' } }),
  activity(405, 'CON-008', 'Site tie-in installation', 'construction', 'Construction Lead', '2026-11-01', '2026-12-28', { duration_days: 14, is_critical: true, total_float_days: '0.00' }),
  activity(406, 'MS-IFC', 'IFC package release', 'piping', 'Project Manager', '2026-09-22', '2026-09-22', { activity_type: 'finish_milestone', is_milestone: true, duration_days: 0, is_critical: true, total_float_days: '0.00' }),
]

const baselineActivities = currentActivities.map(row => ({
  ...row, version: 90,
  planned_finish: ({ 402: '2026-09-12', 404: '2026-10-09', 405: '2026-12-20' })[row.id] || row.planned_finish,
  early_finish: ({ 402: '2026-09-12', 404: '2026-10-09', 405: '2026-12-20' })[row.id] || row.early_finish,
}))

const reports = {
  401: { physical_progress_pct: '100.00', planned_progress_pct: '100.00', actual_start: '2026-05-01', actual_finish: '2026-08-19', forecast_finish: '2026-08-19' },
  402: { physical_progress_pct: '55.00', planned_progress_pct: '100.00', actual_start: '2026-08-26', actual_finish: null, forecast_finish: '2026-09-29' },
  403: { physical_progress_pct: '0.00', planned_progress_pct: '0.00', actual_start: null, actual_finish: null, forecast_finish: '2026-10-09' },
  404: { physical_progress_pct: '20.00', planned_progress_pct: '30.00', actual_start: '2026-09-03', actual_finish: null, forecast_finish: '2026-10-16', notes: 'Blocked: vendor documents pending' },
  405: { physical_progress_pct: '0.00', planned_progress_pct: '0.00', actual_start: null, actual_finish: null, forecast_finish: '2026-12-28' },
  406: { physical_progress_pct: '0.00', planned_progress_pct: '0.00', actual_start: null, actual_finish: null, forecast_finish: '2026-09-22' },
}

const dates = ['2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-15']
const curve = dates.map((date, index) => ({
  date, planned_progress_pct: String([10, 20, 30, 40, 50][index]), progress_pct: String([8, 17, 28, 35, 42][index]),
  planned_value: String([100, 200, 300, 400, 500][index] * 10000), earned_value: String([80, 170, 280, 350, 420][index] * 10000), actual_cost: String([85, 180, 300, 380, 460][index] * 10000),
}))

function makeRecord(project) {
  const offset = project.id === 17 ? 0 : 1000
  const planningId = 71 + offset
  const scheduleId = 81 + offset
  const versionId = 91 + offset
  const planningProject = {
    id: planningId, enterprise_project: project.id, name: project.name, client: project.client_name,
    location: 'Abu Dhabi', phase: 'detailed_design', effective_date: project.start_date,
    planned_end_date: project.end_date, duration_months: '11.50', duration_days: 349,
    calendar_overrides: {}, review_cycle_overrides: {}, created_by: 7, file_count: 0,
    latest_generation_version: null, ai_enabled: false, ai_provider: null, ai_model: null, ai_key_configured: false,
    created_at: project.created_at, updated_at: fixedNow,
  }
  const schedule = { id: scheduleId, project: planningId, name: 'Integrated project schedule', code: project.code + '-SCH', status: 'active', planned_start: project.start_date, data_date: '2026-09-15', default_calendar: 301, created_by: 7, version_count: 3, created_at: project.created_at, updated_at: fixedNow }
  const versions = [
    { id: versionId, version: 3, status: 'draft', calculated_finish: '2026-12-28', change_summary: 'September progress update' },
    { id: versionId - 1, version: 2, status: 'baselined', calculated_finish: '2026-12-20', change_summary: 'Approved Rev 1 baseline' },
    { id: versionId - 2, version: 1, status: 'superseded', calculated_finish: '2026-12-15', change_summary: 'Original Rev 0 baseline' },
  ].map(row => ({ schedule: scheduleId, parent_version: null, source_generation: null, calculated_at: fixedNow, created_by: 7, activity_count: 6, relationship_count: 4, created_at: project.created_at, updated_at: fixedNow, ...row }))
  const activities = currentActivities.map(row => ({ ...row, version: versionId }))
  const baselines = [
    { id: 502 + offset, schedule: scheduleId, source_version: versionId - 1, name: 'Rev 1 — approved baseline', approved_at: '2026-08-31T10:00:00Z', approved_by: 7, snapshot: { version: { ...versions[1] }, activities: baselineActivities.map(row => ({ ...row, version: versionId - 1 })) } },
    { id: 501 + offset, schedule: scheduleId, source_version: versionId - 2, name: 'Rev 0 — original baseline', approved_at: '2026-06-01T10:00:00Z', approved_by: 7, snapshot: { version: { ...versions[2] }, activities: baselineActivities.map(row => ({ ...row, version: versionId - 2, planned_finish: row.id === 405 ? '2026-12-15' : row.planned_finish })) } },
  ].map(row => ({ is_deleted: false, deleted_at: null, created_at: row.approved_at, updated_at: row.approved_at, ...row }))
  const controls = {
    data_date: '2026-09-15', bac: '10000000.00', planned_value: '5000000.00', earned_value: '4200000.00', actual_cost: '4600000.00',
    schedule_variance: '-800000.00', cost_variance: '-400000.00', spi: '0.8400', cpi: '0.9130', eac: '10952380.95', etc: '6352380.95', vac: '-952380.95',
    budgeted_hours: '50000.00', earned_hours: '21000.00', actual_hours: '25000.00', progress_pct: project.id === 17 ? '42.00' : '28.00', planned_progress_pct: '50.00', forecast_finish: '2026-12-28',
    activities: activities.map(row => ({ id: row.id, external_id: row.external_id, name: row.name, wbs_code: row.wbs_node === 202 ? '02' : '01', planned_start: row.planned_start, planned_finish: row.planned_finish, is_critical: row.is_critical, budgeted_cost: '1000000.00', budgeted_hours: '5000.00', actual_cost: '500000.00', actual_hours: '2500.00', remaining_duration_days: 10, notes: '', last_reported_date: '2026-09-15', ...reports[row.id] })),
    curve: structuredClone(curve), snapshots: curve.map((point, index) => ({ id: 1001 + index, data_date: point.date, progress_pct: point.progress_pct })), snapshot_count: 5, wbs_breakdown: [],
  }
  const workspace = {
    project: planningProject, schedule, version: versions[0], activities, baselines,
    calendar: { id: 301, project: planningId, name: 'Office calendar', working_weekdays: [0, 1, 2, 3, 4], hours_per_day: '8.00', timezone: 'Asia/Dubai', is_default: true, exceptions: [] },
    wbs: [{ id: 201, version: versionId, parent: null, code: '01', name: 'Engineering', discipline: 'engineering', level: 1, sort_order: 1 }, { id: 202, version: versionId, parent: null, code: '02', name: 'Procurement', discipline: 'procurement', level: 1, sort_order: 2 }],
    relationships: [{ id: 601, version: versionId, predecessor: 401, successor: 402, relationship_type: 'FS', lag_days: 0 }, { id: 602, version: versionId, predecessor: 402, successor: 406, relationship_type: 'FS', lag_days: 0 }, { id: 603, version: versionId, predecessor: 404, successor: 405, relationship_type: 'FS', lag_days: 0 }, { id: 604, version: versionId, predecessor: 406, successor: 405, relationship_type: 'FS', lag_days: 0 }],
    resources: [{ id: 701, project: planningId, name: 'Maya Hassan', code: 'MAYA', resource_type: 'labor' }, { id: 702, project: planningId, name: 'Omar Saleh', code: 'OMAR', resource_type: 'labor' }],
    assignments: [{ id: 801, activity: 402, resource: 701 }, { id: 802, activity: 403, resource: 702 }, { id: 803, activity: 404, resource: 701 }, { id: 804, activity: 406, resource: 701 }],
    deliverable_summaries: [], calculation_runs: [], intelligence: null, scheduling_configuration: null,
    generation_validation: [], schedule_assurance: { status: 'approved', calculated_state_at: fixedNow, network_validation: { valid: true }, blockers: [], warnings: [], contract_scenarios: { available: true, scenarios: [{ code: 'restore_baseline', label: 'Restore approved finish', forecast_finish: '2026-12-20', required_reduction_working_days: 8, feasibility: 'Requires review', note: 'Compression target from the recorded schedule assurance review.' }] } }, dependency_assumptions: [], can_edit: true, can_control: true, can_approve_field_updates: true,
  }
  const governance = { items: [{ id: 1101, version: versionId, activity: 404, item_type: 'issue', title: 'Vendor documentation hold', description: 'Vendor approval blocks pump procurement.', status: 'open', priority: 'high', due_date: '2026-09-18', owner: { id: 7, name: 'Maya Hassan' }, schedule_impact_days: 7 }], comments: [], reviews: [], approvals: [], can_edit: true }
  return { project, planningProject, schedule, versions, workspace, baselines, controls, governance, tasks: [], milestones: [{ id: 906, name: 'IFC package release', description: '', target_date: '2026-09-22', completed_date: null, is_completed: false }], changes: [], snapshots: [] }
}

export const newScheduleState = () => ({
  records: structuredClone({
    17: makeRecord(coreProject),
    18: makeRecord({ ...coreProject, id: 18, code: '5900738', name: 'Grid Power Integration Project', client_name: 'Grid Operations', progress: 28 }),
  }),
  requests: [], unknown: [], failures: new Set(), noLinked: false,
})

const flags = { phase_1_project_dashboard: true, phase_1_cost_dashboard: true, phase_1_estimate_variance: true, phase_1_documents: true, phase_2_ai_takeoff: false, phase_3_evm_forecast: false, phase_4_risk_analytics: false }
export const pageOf = results => ({ count: results.length, next: null, previous: null, results })
const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

export async function scheduleHarness(page, options = {}) {
  const state = newScheduleState()
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date(fixedNow))
  await page.route(url => url.pathname === '/projects', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Schedule Performance interaction test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/project-performance-harness.jsx"></script></body></html>',
  }))
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const projectId = url.searchParams.get('enterprise_project') || url.searchParams.get('project')
    const scheduleId = url.searchParams.get('schedule')
    let record = Object.values(state.records).find(row => String(row.schedule.id) === scheduleId) || state.records[projectId] || Object.values(state.records).find(row => String(row.planningProject.id) === projectId) || state.records[17]
    const versionMatch = path.match(/\/schedule-versions\/(\d+)\//)
    if (versionMatch) record = Object.values(state.records).find(row => row.versions.some(version => String(version.id) === versionMatch[1])) || record
    state.requests.push({ path, query: Object.fromEntries(url.searchParams), method: route.request().method(), project: record.project.id })
    const failed = [...state.failures].find(resource => path.includes(resource))
    if (failed) return reply(route, { detail: 'Schedule service temporarily unavailable: ' + failed }, 503)
    if (await options.handleRequest?.({ route, url, path, record, state, reply })) return
    if (path.endsWith('/project-control/phase-flags/')) return reply(route, { phase_flags: flags })
    if (path.endsWith('/planning-intelligence/projects/')) return reply(route, pageOf(state.noLinked ? [] : [record.planningProject]))
    if (path.endsWith('/planning-intelligence/schedules/')) return reply(route, pageOf([record.schedule]))
    if (path.endsWith('/planning-intelligence/schedule-versions/')) return reply(route, pageOf(record.versions))
    if (path.endsWith('/planning-intelligence/baselines/')) return reply(route, pageOf(record.baselines))
    if (versionMatch && path.endsWith('/workspace/')) {
      const version = record.versions.find(row => String(row.id) === versionMatch[1])
      return reply(route, { ...record.workspace, version, baselines: record.baselines })
    }
    if (versionMatch && path.endsWith('/controls/')) return reply(route, record.controls)
    if (versionMatch && path.endsWith('/governance/')) return reply(route, record.governance)
    if (versionMatch && /\/schedule-versions\/\d+\/$/.test(path)) return reply(route, record.versions.find(row => String(row.id) === versionMatch[1]))
    if (path.endsWith('/projects/')) return reply(route, pageOf(Object.values(state.records).map(row => row.project)))
    const projectMatch = path.match(/\/projects\/(\d+)\/$/)
    if (projectMatch) return reply(route, state.records[projectMatch[1]]?.project || record.planningProject)
    if (path.endsWith('/analytics/cost-kpis/')) return reply(route, { currency: 'AED', budget: '10000000.00', spent: '4600000.00', committed: '6800000.00', remaining: '5400000.00', ledger_entry_count: 42, forecast: { spi: '.84', cpi: '.91', snapshot_date: '2026-09-15' } })
    if (path.endsWith('/analytics/commercial-dashboard/')) return reply(route, { currency: 'AED', actual: '4600000.00', committed: '6800000.00', recent_events: [] })
    const support = [['/projects/tasks/', 'tasks'], ['/projects/milestones/', 'milestones'], ['/change-events/', 'changes'], ['/integrated-snapshots/', 'snapshots']].find(([suffix]) => path.endsWith(suffix))
    if (support) return reply(route, pageOf(record[support[1]]))
    if (['/files/', '/generations/', '/jobs/', '/intelligence-runs/', '/intelligence-facts/', '/intelligence-conflicts/', '/control-accounts/', '/reporting-periods/', '/approved-hours/', '/cost-ledger/', '/budget-allocations/', '/wbs-nodes/'].some(suffix => path.endsWith(suffix))) return reply(route, pageOf([]))
    if (path.endsWith('/ai-settings/')) return reply(route, { enabled: false, key_configured: false, model: null })
    if (path.endsWith('/enterprise-contract/')) return reply(route, { project: record.planningProject, enterprise_project: record.project, differences: [], lifecycle: 'baselined', baseline_locked: true, baseline: record.baselines[0] || null })
    state.unknown.push(path)
    return reply(route, { detail: 'Endpoint not configured in Schedule browser fixture.' }, 404)
  })
  await page.goto('/projects?' + (options.query || 'project=17&view=plan-baseline&shell=true'))
  return state
}
