// Synthetic API records follow the existing serializers; they never seed RADAI.
const actor = { id: 7, email: 'manager@example.test', first_name: 'Maya', last_name: 'Hassan' }
const project = {
  id: 17, name: 'Residue Yield Improvement Project', code: '5900913', description: 'Engineering and procurement for the residue yield improvement project.',
  status: 'active', priority: 'high', progress: 42, start_date: '2026-01-05', end_date: '2026-12-20',
  owner: actor, owner_name: 'Maya Hassan', team_members_data: [{ id: 1, user: actor, role: 'project_manager', joined_at: '2026-01-05T08:00:00Z', is_active: true }],
  budget: '10000000.00', spent: '4600000.00', client_name: 'ADNOC Refining', location: 'Abu Dhabi',
  contract_value: '12500000.00', currency: 'AED', scope_type: 'epcm', tags: [],
  custom_fields: { data_date: '2026-09-15', forecast_finish: '2026-12-28' },
  tasks_summary: { total: 3, todo: 0, in_progress: 1, completed: 1, blocked: 1 },
  milestones_summary: { total: 4, completed: 1, pending: 3 },
  is_overdue: false, budget_utilization: 46, team_size: 6, created_at: '2026-01-05T08:00:00Z', updated_at: '2026-09-15T06:00:00Z',
}
const secondProject = { ...project, id: 18, code: '5900738', name: 'Grid Power Integration Project', progress: 28, client_name: 'Grid Operations', priority: 'medium' }
const dates = ['2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-15']
const snapshots = dates.map((date, index) => {
  const actual = [8, 17, 28, 35, 42][index]
  const planned = [10, 20, 30, 40, 50][index]
  const actualCost = [850000, 1800000, 3000000, 3800000, 4600000][index]
  const earned = actual * 100000
  const plannedValue = planned * 100000
  const cpi = earned / actualCost
  const forecast = 10000000 / cpi
  return {
    id: '10000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), project: 17,
    reporting_period: 101 + index, reconciliation_run: 'reconciliation-' + index, version: 1, data_date: date,
    currency: 'AED', budget_at_completion: '10000000.00', planned_value: plannedValue.toFixed(2),
    earned_value: earned.toFixed(2), actual_cost: actualCost.toFixed(2), commitments: '6800000.00',
    approved_hours: '25000.00', labor_actual_cost: '1600000.00', finance_actual_cost: '3000000.00',
    progress_pct: actual.toFixed(2), planned_progress_pct: planned.toFixed(2),
    cost_variance: (earned - actualCost).toFixed(2), schedule_variance: (earned - plannedValue).toFixed(2),
    cpi: cpi.toFixed(4), spi: (actual / planned).toFixed(4),
    estimate_at_completion: forecast.toFixed(2), estimate_to_complete: (forecast - actualCost).toFixed(2),
    variance_at_completion: (10000000 - forecast).toFixed(2),
    source_manifest: {
      reconciliation_id: 'reconciliation-' + index, reconciliation_checksum: 'b'.repeat(64),
      schedule_control_snapshot_id: 201 + index, schedule_source: 'approved_schedule_snapshot',
      control_accounts: [{ control_account_id: 1, code: 'CA-01', budget: '10000000.00', planned_progress_pct: planned.toFixed(2), actual_progress_pct: actual.toFixed(2) }],
    },
    calculation_payload: { formulas: { EV: 'BAC × progress %', CPI: 'EV ÷ AC', SPI: 'EV ÷ PV', EAC: 'BAC ÷ CPI' }, values: { BAC: '10000000.00', PV: plannedValue.toFixed(2), EV: earned.toFixed(2), AC: actualCost.toFixed(2) } },
    checksum: String(index + 1).repeat(64), sealed_by: 7, sealed_at: date + 'T06:00:00Z',
  }
})
const latest = snapshots.at(-1)
const kpis = {
  project_id: 17, project_code: project.code, project_name: project.name, currency: 'AED',
  budget: '10000000.00', spent: '4600000.00', committed: '6800000.00', remaining: '5400000.00',
  available_to_commit: '3200000.00', commitment_remaining: '2200000.00', ledger_entry_count: 42,
  calculation_source: 'immutable_integrated_snapshot', utilisation_pct: 46, progress_pct: 42,
  forecast: { eac: latest.estimate_at_completion, cpi: latest.cpi, spi: latest.spi, snapshot_date: latest.data_date, snapshot_id: latest.id, snapshot_version: 1 },
  estimate_counts: { total: 3, approved: 2, draft: 1 },
}
const commercial = {
  project: { id: '17', code: project.code, name: project.name }, currency: 'AED', contract_value: '12500000.00',
  budget: '10000000.00', committed: '6800000.00', actual: '4600000.00', remaining_budget: '5400000.00',
  outstanding_commitment: '2200000.00', paid: '3000000.00', unpaid_actual: '1600000.00', scheduled_payments: '400000.00', current_margin: '7900000.00',
  counts: { purchase_orders: 8, approved_purchase_orders: 6, receipts: 5, accepted_receipts: 4, verified_invoices: 7, payments: 5 },
  wbs: [{ code: '01', name: 'Engineering', budget: '10000000.00', committed: '6800000.00', actual: '4600000.00' }],
  recent_events: [
    { id: 'event-1', event_type: 'purchase_order_approved', event_type_display: 'Purchase order approved', source_type: 'purchase_order', source_reference: 'PO-5900913-041', amount: '280000.00', currency: 'AED', event_at: '2026-09-15T05:35:00Z', actor: 'Maya Hassan', ledger_rebuilt: true, processing_error: '' },
    { id: 'event-2', event_type: 'invoice_verified', event_type_display: 'Invoice verified', source_type: 'invoice', source_reference: 'INV-5900913-019', amount: '120000.00', currency: 'AED', event_at: '2026-09-14T12:00:00Z', actor: 'Finance reviewer', ledger_rebuilt: true, processing_error: '' },
  ],
  controls: { currency_exceptions: [], calculation_source: 'posted_cost_ledger', event_delivery: 'idempotent' },
}
const tasks = [
  { id: 1, title: 'Resolve valve package comments', description: 'Awaiting vendor response.', status: 'blocked', assigned_to: actor, due_date: '2026-09-12', priority: 'high', estimated_hours: '16.00', actual_hours: '8.00', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-14T08:00:00Z' },
  { id: 2, title: 'Issue piping isometrics', description: '', status: 'in_progress', assigned_to: actor, due_date: '2026-09-20', priority: 'medium', estimated_hours: '24.00', actual_hours: '12.00', created_at: '2026-09-05T08:00:00Z', updated_at: '2026-09-15T08:00:00Z' },
  { id: 3, title: 'Complete design review', description: '', status: 'completed', assigned_to: actor, due_date: '2026-09-10', priority: 'medium', estimated_hours: '8.00', actual_hours: '7.00', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-10T08:00:00Z' },
]
const milestones = [
  { id: 1, name: 'Design basis approved', description: 'Project design basis approval.', target_date: '2026-09-01', completed_date: '2026-08-30', is_completed: true, created_at: '2026-01-05T08:00:00Z', updated_at: '2026-08-30T08:00:00Z' },
  { id: 2, name: 'Vendor data approval', description: 'Resolve outstanding vendor comments.', target_date: '2026-09-12', completed_date: null, is_completed: false, created_at: '2026-01-05T08:00:00Z', updated_at: '2026-09-12T08:00:00Z' },
  { id: 3, name: 'IFC package release', description: 'Issue approved construction package.', target_date: '2026-09-22', completed_date: null, is_completed: false, created_at: '2026-01-05T08:00:00Z', updated_at: '2026-09-15T08:00:00Z' },
  { id: 4, name: 'Construction handover', description: '', target_date: '2026-10-15', completed_date: null, is_completed: false, created_at: '2026-01-05T08:00:00Z', updated_at: '2026-09-15T08:00:00Z' },
]
const changes = [
  { id: 1, project: 17, source_document: null, detected_at: '2026-09-14T08:00:00Z', summary: 'Additional tie-in scope', description: 'Review the revised tie-in scope and cost.', severity: 'high', delta_amount: '150000.00', delta_currency: 'AED', status: 'detected', ai_confidence: null, reviewed_by: null, created_at: '2026-09-14T08:00:00Z', updated_at: '2026-09-14T08:00:00Z' },
]
const flags = {
  phase_1_project_dashboard: true, phase_1_cost_dashboard: true, phase_1_estimate_variance: true,
  phase_1_finance_sync: true, phase_1_documents: true, phase_2_ai_takeoff: false,
  phase_2_wbs_alignment: false, phase_3_evm_forecast: false, phase_3_cashflow_curve: false,
  phase_4_risk_analytics: false, phase_4_change_detection: false,
}
const pageOf = results => ({ count: results.length, next: null, previous: null, results })
const fulfil = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
const compactProject = value => Object.fromEntries(['id', 'name', 'code', 'status', 'priority', 'progress', 'start_date', 'end_date', 'owner_name', 'team_size', 'is_overdue', 'created_at'].map(key => [key, value[key]]))
const recordFor = value => ({ project: value, kpis: { ...kpis, project_id: value.id, project_code: value.code, project_name: value.name }, commercial: { ...commercial, project: { id: String(value.id), code: value.code, name: value.name } }, snapshots: snapshots.map(snapshot => ({ ...snapshot, project: value.id })), tasks, milestones, changes: changes.map(change => ({ ...change, project: value.id })) })

async function harness(page, query = 'project=17', options = {}) {
  const state = { records: structuredClone({ 17: recordFor(project), 18: recordFor(secondProject) }), requests: [], failures: new Set(options.failures || []), unknown: [], pageErrors: [] }
  page.on('pageerror', error => state.pageErrors.push(error.message))
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date('2026-09-15T06:30:00Z'))
  await page.route(url => url.pathname === '/projects', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Project Performance interaction test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/project-performance-harness.jsx"></script></body></html>',
  }))
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const id = url.searchParams.get('project') || url.searchParams.get('project_id') || '17'
    const record = state.records[id] || state.records[17]
    state.requests.push({ path, id, method: route.request().method() })
    if (await options.handleRequest?.({ path, route, state, record, reply: fulfil })) return
    const agreementMatch = path.match(/\/agreement-workspaces\/projects\/(\d+)\/$/)
    if (agreementMatch && route.request().method() === 'GET') return fulfil(route, { enterprise_project_id: Number(agreementMatch[1]), planning_project_id: null, workspace: null, active_job: null, latest_job: null, files: [], permissions: { can_analyze: true, can_accept: false }, ai: { available: false, reason: 'Project AI is not configured.' } })
    if (path.endsWith('/project-control/phase-flags/')) return fulfil(route, { phase_flags: flags })
    if (path.endsWith('/planning-intelligence/projects/')) return fulfil(route, pageOf(state.linkedRegister ? [state.linkedRegister.project] : []))
    if (state.linkedRegister) {
      const linked = state.linkedRegister
      if (path.endsWith('/planning-intelligence/schedules/')) return fulfil(route, pageOf([linked.schedule]))
      if (path.endsWith('/planning-intelligence/schedule-versions/')) return fulfil(route, pageOf(linked.versions))
      if (path.endsWith('/governance/')) return fulfil(route, linked.governance, state.failures.has('governance') ? 503 : 200)
      if (path.endsWith('/workspace/')) return fulfil(route, { version: linked.versions[0], schedule: linked.schedule, activities: [], baselines: [], resources: [], assignments: [] })
      if (path.endsWith('/controls/')) return fulfil(route, { activities: [], snapshots: [], curve: [] })
    }
    if (path.endsWith('/analytics/estimate-variance/')) return fulfil(route, { message: 'At least two estimates are required to compute variance.' })
    if (path.endsWith('/analytics/portfolio-exceptions/')) return fulfil(route, state.portfolio || { projects: [], summary: {} })
    if (path.endsWith('/projects/')) return fulfil(route, pageOf(Object.values(state.records).map(item => compactProject(item.project))))
    const detail = path.match(/\/projects\/(\d+)\/$/)
    if (detail) {
      if (route.request().method() === 'PATCH') Object.assign(state.records[detail[1]].project, route.request().postDataJSON())
      return fulfil(route, state.records[detail[1]].project)
    }
    const resource = [
      ['/analytics/cost-kpis/', 'kpis'], ['/analytics/commercial-dashboard/', 'commercial'],
      ['/projects/tasks/', 'tasks'], ['/projects/milestones/', 'milestones'],
      ['/project-control/change-events/', 'changes'], ['/project-control/integrated-snapshots/', 'snapshots'],
    ].find(([suffix]) => path.endsWith(suffix))
    if (resource) {
      const key = resource[1]
      if (state.failures.has(key)) return fulfil(route, { detail: key + ' service is temporarily unavailable.' }, 503)
      return fulfil(route, ['tasks', 'milestones', 'changes', 'snapshots'].includes(key) ? pageOf(record[key]) : record[key])
    }
    if (['/documents/', '/estimates/', '/control-accounts/', '/reporting-periods/', '/approved-hours/', '/cost-ledger/', '/budget-allocations/', '/wbs-nodes/'].some(suffix => path.endsWith(suffix))) return fulfil(route, pageOf([]))
    state.unknown.push(path)
    return fulfil(route, { detail: 'Endpoint not configured in this test fixture.' }, 404)
  })
  await page.goto('/projects?' + query)
  return state
}


export { actor, project, secondProject, snapshots, harness }
