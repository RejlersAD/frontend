// Synthetic responses follow existing serializers and are intercepted in the browser only.
export const commercialNow = '2026-09-15T06:30:00Z'
const actor = { id: 7, email: 'manager@example.test', first_name: 'Maya', last_name: 'Hassan' }
const project = {
  id: 17, name: 'Residue Yield Improvement Project', code: '5900913', client_name: 'ADNOC Refining',
  description: 'Engineering and procurement commercial control.', status: 'active', priority: 'high', progress: 42,
  start_date: '2026-01-05', end_date: '2026-12-20', owner: actor, owner_name: 'Maya Hassan',
  team_members_data: [{ id: 1, user: actor, role: 'project_manager', is_active: true }], team_size: 6,
  budget: '10000000.00', spent: '4600000.00', contract_value: '12500000.00', currency: 'AED',
  scope_type: 'epcm', location: 'Abu Dhabi', is_overdue: false, tags: [],
  tasks_summary: { total: 0 }, milestones_summary: { total: 0, completed: 0 },
  custom_fields: { data_date: '2026-09-15' }, created_at: '2026-01-05T08:00:00Z', updated_at: commercialNow,
}
const dates = ['2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31', '2026-09-15']

function recordFor(value) {
  const offset = value.id === 17 ? 0 : 1000
  const periods = dates.map((date, index) => ({
    id: 101 + index + offset, project: value.id, sequence: index + 1, name: ['April close', 'May close', 'June close', 'July close', 'August close', 'September update'][index],
    start_date: date.slice(0, 8) + '01', end_date: date, data_date: date, status: 'locked', status_display: 'Locked', is_entry_allowed: false,
    notes: '', created_by: 7, created_by_name: 'Maya Hassan', submitted_by: 7, submitted_by_name: 'Maya Hassan', submitted_at: date + 'T05:00:00Z',
    locked_by: 7, locked_by_name: 'Maya Hassan', locked_at: date + 'T06:00:00Z', reopened_by: null, reopened_by_name: '', reopened_at: null, reopen_reason: '',
    created_at: date + 'T04:00:00Z', updated_at: date + 'T06:00:00Z',
  }))
  const snapshots = dates.map((date, index) => {
    const cost = [400000, 850000, 1800000, 3000000, 3800000, 4600000][index]
    const earned = [350000, 800000, 1700000, 2800000, 3500000, 4200000][index]
    const planned = [500000, 1000000, 2000000, 3000000, 4000000, 5000000][index]
    const eac = 10000000 / (earned / cost)
    return {
      id: '20000000-0000-4000-8000-' + String(1 + index + offset).padStart(12, '0'), project: value.id, reporting_period: periods[index].id,
      reconciliation_run: 'reconciliation-' + (index + offset), version: 1, data_date: date, currency: 'AED', budget_at_completion: '10000000.00',
      planned_value: planned.toFixed(2), earned_value: earned.toFixed(2), actual_cost: cost.toFixed(2), commitments: (index < 4 ? 4800000 : 6800000).toFixed(2),
      approved_hours: '25000.00', labor_actual_cost: '1600000.00', finance_actual_cost: (cost * .65).toFixed(2),
      progress_pct: (earned / 100000).toFixed(2), planned_progress_pct: (planned / 100000).toFixed(2),
      cost_variance: (earned - cost).toFixed(2), schedule_variance: (earned - planned).toFixed(2), cpi: (earned / cost).toFixed(4), spi: (earned / planned).toFixed(4),
      estimate_at_completion: eac.toFixed(2), estimate_to_complete: (eac - cost).toFixed(2), variance_at_completion: (10000000 - eac).toFixed(2),
      source_manifest: { reconciliation_id: 'reconciliation-' + (index + offset), reconciliation_checksum: 'b'.repeat(64), schedule_control_snapshot_id: 201 + index, schedule_source: 'approved_schedule_snapshot', control_accounts: [{ control_account_id: 1, code: 'CA-01', budget: '10000000.00', actual_progress_pct: (earned / 100000).toFixed(2) }] },
      calculation_payload: { formulas: { CPI: 'EV / AC', EAC: 'BAC / CPI' } }, checksum: String(index + 1).repeat(64), sealed_by: 7, sealed_at: date + 'T06:00:00Z',
    }
  })
  const wbs = [
    { code: '01', name: 'Engineering', budget: '3500000.00', committed: '1900000.00', actual: '1600000.00' },
    { code: '02', name: 'Procurement', budget: '5500000.00', committed: '4900000.00', actual: '2900000.00' },
    { code: '03', name: 'Construction', budget: '1000000.00', committed: '0.00', actual: '100000.00' },
  ]
  const ledgerBase = [
    { id: 801, entry_type: 'commitment', amount: '280000.00', source_type: 'purchase_order', source_reference: 'PO-5900913-041', wbs_code: '02', wbs_name: 'Procurement', entry_date: '2026-09-15' },
    { id: 802, entry_type: 'actual', amount: '120000.00', source_type: 'invoice_allocation', source_reference: 'INV-5900913-019', wbs_code: '02', wbs_name: 'Procurement', entry_date: '2026-09-14' },
    { id: 803, entry_type: 'actual', amount: '45000.00', source_type: 'approved_hour', source_reference: 'HOURS-ENG-SEP', wbs_code: '01', wbs_name: 'Engineering', entry_date: '2026-09-12' },
    { id: 804, entry_type: 'budget', amount: '3500000.00', source_type: 'budget_allocation', source_reference: 'BUD-ENG-2026', wbs_code: '01', wbs_name: 'Engineering', entry_date: '2026-01-05' },
    { id: 805, entry_type: 'budget', amount: '5500000.00', source_type: 'budget_allocation', source_reference: 'BUD-PRO-2026', wbs_code: '02', wbs_name: 'Procurement', entry_date: '2026-01-05' },
    { id: 806, entry_type: 'budget', amount: '1000000.00', source_type: 'budget_allocation', source_reference: 'BUD-CON-2026', wbs_code: '03', wbs_name: 'Construction', entry_date: '2026-01-05' },
    { id: 807, entry_type: 'commitment', amount: '4620000.00', source_type: 'purchase_order', source_reference: 'PO-5900913-028', wbs_code: '02', wbs_name: 'Procurement', entry_date: '2026-08-10' },
    { id: 808, entry_type: 'commitment', amount: '1900000.00', source_type: 'purchase_order', source_reference: 'PO-5900913-013', wbs_code: '01', wbs_name: 'Engineering', entry_date: '2026-04-10' },
    { id: 809, entry_type: 'actual', amount: '2780000.00', source_type: 'invoice_allocation', source_reference: 'INV-5900913-015', wbs_code: '02', wbs_name: 'Procurement', entry_date: '2026-08-20' },
    { id: 810, entry_type: 'actual', amount: '1555000.00', source_type: 'approved_hour', source_reference: 'HOURS-ENG-AUG', wbs_code: '01', wbs_name: 'Engineering', entry_date: '2026-08-31' },
    { id: 811, entry_type: 'actual', amount: '100000.00', source_type: 'invoice_allocation', source_reference: 'INV-5900913-007', wbs_code: '03', wbs_name: 'Construction', entry_date: '2026-07-20' },
  ]
  const ledger = ledgerBase.map(row => ({
    project: value.id, project_code: value.code, wbs_node: 200 + Number(row.wbs_code), budget_allocation: null, cost_allocation: null,
    entry_key: value.code + ':' + row.id, control_account: 1, reporting_period: periods.find(period => row.entry_date >= period.start_date && row.entry_date <= period.end_date)?.id || null, currency: 'AED', source_id: String(row.id),
    status: 'posted', metadata: {}, created_at: row.entry_date + 'T06:00:00Z', updated_at: commercialNow, ...row, id: row.id + offset,
  }))
  const events = [
    { id: 'event-po-' + value.id, event_type: 'purchase_order_approved', event_type_display: 'Purchase order approved', source_type: 'purchase_order', source_reference: 'PO-5900913-041', amount: '280000.00', currency: 'AED', event_at: '2026-09-15T05:35:00Z', actor: 'Maya Hassan', ledger_rebuilt: true, processing_error: '' },
    { id: 'event-invoice-' + value.id, event_type: 'invoice_verified', event_type_display: 'Invoice verified', source_type: 'invoice', source_reference: 'INV-5900913-019', amount: '120000.00', currency: 'AED', event_at: '2026-09-14T12:00:00Z', actor: 'Finance reviewer', ledger_rebuilt: true, processing_error: '' },
    { id: 'event-budget-' + value.id, event_type: 'budget_approved', event_type_display: 'Budget approved', source_type: 'budget_allocation', source_reference: 'BUD-ENG-2026', amount: '3500000.00', currency: 'AED', event_at: '2026-09-12T08:00:00Z', actor: 'Maya Hassan', ledger_rebuilt: true, processing_error: '' },
  ]
  const commercial = {
    project: { id: String(value.id), code: value.code, name: value.name }, currency: 'AED', contract_value: value.contract_value,
    budget: '10000000.00', committed: '6800000.00', actual: '4600000.00', remaining_budget: '5400000.00', outstanding_commitment: '2200000.00',
    paid: '3000000.00', unpaid_actual: '1600000.00', scheduled_payments: '400000.00', current_margin: '7900000.00',
    counts: { purchase_orders: 8, approved_purchase_orders: 6, receipts: 5, accepted_receipts: 4, verified_invoices: 7, payments: 5 },
    wbs, recent_events: events, controls: { currency_exceptions: [], calculation_source: 'posted_cost_ledger', event_delivery: 'idempotent' },
  }
  const last = snapshots.at(-1)
  const kpis = { project_id: value.id, project_code: value.code, project_name: value.name, currency: 'AED', budget: commercial.budget, spent: commercial.actual, committed: commercial.committed, remaining: commercial.remaining_budget, available_to_commit: '3200000.00', commitment_remaining: commercial.outstanding_commitment, ledger_entry_count: 42, calculation_source: 'immutable_integrated_snapshot', utilisation_pct: 46, progress_pct: 42, forecast: { eac: last.estimate_at_completion, cpi: last.cpi, spi: last.spi, snapshot_date: last.data_date, snapshot_id: last.id, snapshot_version: 1 }, estimate_counts: { total: 0, approved: 0, draft: 0 } }
  const budgets = wbs.map((row, index) => ({ id: 901 + index + offset, project: value.id, wbs_node: 201 + index, wbs_code: row.code, wbs_name: row.name, code: ['BUD-ENG-2026', 'BUD-PRO-2026', 'BUD-CON-2026'][index], name: row.name + ' control budget', category: 'direct', amount: row.budget, currency: 'AED', status: 'approved', approved_by_name: 'Maya Hassan', approved_at: '2026-01-05T10:00:00Z' }))
  budgets.push({ ...budgets[0], id: 904 + offset, code: 'BUD-ENG-CHANGE', name: 'Engineering scope allowance', amount: '75000.00', status: 'draft', approved_by_name: null, approved_at: null })
  return { project: value, commercial, periods, snapshots, ledger, kpis, tasks: [], milestones: [], changes: [], wbsNodes: wbs.map((row, index) => ({ id: 201 + index, project: value.id, code: row.code, name: row.name, level: 0, sort_order: index })), budgets }
}

const pageOf = results => ({ count: results.length, next: null, previous: null, results })
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const flags = { phase_1_project_dashboard: true, phase_1_cost_dashboard: true, phase_1_estimate_variance: true, phase_1_documents: true, phase_1_finance_sync: true, phase_2_ai_takeoff: false, phase_3_evm_forecast: false, phase_4_risk_analytics: false }

export function newCommercialState() {
  return { records: structuredClone({ 17: recordFor(project), 18: recordFor({ ...project, id: 18, code: '5900738', name: 'Grid Power Integration Project', client_name: 'Grid Operations', contract_value: '8500000.00' }) }), requests: [], unknown: [], failures: new Set() }
}

export async function commercialHarness(page, options = {}) {
  const state = newCommercialState()
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date(commercialNow))
  await page.route(url => url.pathname === '/projects', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Commercial Performance interaction test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/project-performance-harness.jsx"></script></body></html>',
  }))
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const id = url.searchParams.get('project') || url.searchParams.get('project_id') || '17'
    const record = state.records[id] || state.records[17]
    state.requests.push({ path, query: Object.fromEntries(url.searchParams), method: route.request().method(), project: record.project.id })
    if (path.endsWith('/project-control/phase-flags/')) return reply(route, { phase_flags: flags })
    if (path.endsWith('/planning-intelligence/projects/')) return reply(route, pageOf([]))
    if (path.endsWith('/projects/')) return reply(route, pageOf(Object.values(state.records).map(row => row.project)))
    const projectMatch = path.match(/\/projects\/(\d+)\/$/)
    if (projectMatch) return reply(route, state.records[projectMatch[1]].project)
    const resource = [
      ['/analytics/commercial-dashboard/', 'commercial'], ['/analytics/cost-kpis/', 'kpis'],
      ['/reporting-periods/', 'periods'], ['/integrated-snapshots/', 'snapshots'], ['/cost-ledger/', 'ledger'],
      ['/projects/tasks/', 'tasks'], ['/projects/milestones/', 'milestones'], ['/change-events/', 'changes'],
      ['/wbs-nodes/', 'wbsNodes'], ['/budget-allocations/', 'budgets'],
    ].find(([suffix]) => path.endsWith(suffix))
    if (resource) {
      const key = resource[1]
      if (state.failures.has(key)) return reply(route, { detail: key + ' service is temporarily unavailable.' }, 503)
      return reply(route, ['commercial', 'kpis'].includes(key) ? record[key] : pageOf(record[key]))
    }
    if (['/control-accounts/', '/approved-hours/', '/documents/', '/estimates/'].some(suffix => path.endsWith(suffix))) return reply(route, pageOf([]))
    state.unknown.push(path)
    return reply(route, { detail: 'Endpoint not configured in Commercial browser fixture.' }, 404)
  })
  await page.goto('/projects?' + (options.query || 'project=17&view=commercial-dashboard&shell=true'))
  return state
}
