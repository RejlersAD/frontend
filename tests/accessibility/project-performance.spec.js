import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.setTimeout(60000)

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
  const state = { records: structuredClone({ 17: recordFor(project), 18: recordFor(secondProject) }), requests: [], failures: new Set(options.failures || []), unknown: [] }
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date('2026-09-15T06:30:00Z'))
  await page.route(url => url.pathname === '/projects', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><title>Project Performance interaction test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/project-performance-harness.jsx"></script></body></html>',
  }))
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const id = url.searchParams.get('project') || url.searchParams.get('project_id') || '17'
    const record = state.records[id] || state.records[17]
    state.requests.push({ path, id, method: route.request().method() })
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

const region = (page, name) => page.getByRole('region', { name, exact: true })
const workAreas = page => page.getByRole('navigation', { name: 'Project work areas' })

async function loaded(page) {
  await expect(page.getByRole('heading', { name: 'Project Performance', exact: true })).toBeVisible()
  await expect(region(page, 'Performance indicators').getByRole('button')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
}

async function noHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth, viewport: window.innerWidth,
    overflowing: [...document.querySelectorAll('.project-performance-workspace *')].filter(element => {
      for (let parent = element.parentElement; parent && !['BODY', 'HTML'].includes(parent.tagName); parent = parent.parentElement) {
        if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(parent).overflowX)) return false
      }
      return element.getBoundingClientRect().right > window.innerWidth + 1
    }).map(element => ({
      tag: element.tagName, class: element.className?.baseVal ?? element.className, parent: element.parentElement.className, right: Math.round(element.getBoundingClientRect().right),
    })).slice(0, 12),
  }))
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1)
}

test('desktop overview presents recorded performance, financial facts, and accessible sections', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await harness(page, 'project=17&shell=true')
  await loaded(page)
  await page.screenshot({ path: '../artifacts/project-performance-desktop.png', animations: 'disabled' })
  await expect(page.getByText('Client: ADNOC Refining', { exact: true })).toBeVisible()
  const indicators = region(page, 'Performance indicators')
  await expect(indicators.getByRole('button', { name: /Physical progress/ })).toContainText('42%')
  await expect(indicators.getByRole('button', { name: /^Schedule/ })).toContainText('SPI 0.84')
  await expect(indicators.getByRole('button', { name: /^Cost/ })).toContainText('CPI 0.91')
  await expect(indicators.getByRole('button', { name: /^Forecast finish/ })).toContainText('Dec 28, 2026')
  await expect(page.getByRole('img', { name: 'Schedule progress history: 5 recorded periods. Latest planned 50%, actual 42%.' })).toBeVisible()
  await expect(region(page, 'Schedule performance')).toContainText('-8 pp')
  await expect(region(page, 'Schedule performance').getByTitle(/approved schedule snapshots/)).toBeVisible()
  const cost = region(page, 'Cost & forecast')
  await expect(cost.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Control budget$/ }) })).toContainText('10,000,000')
  await expect(cost.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Actual cost$/ }) })).toContainText('4,600,000')
  await expect(region(page, 'Milestone readiness')).toContainText('1 of 4 complete')
  await expect(region(page, 'Risks & changes')).toContainText('Risk register not connected')
  await expect(region(page, 'Recent project activity').getByRole('row', { name: /Purchase order approved/ })).toContainText('Cost ledger updated')
  await expect(page.getByRole('progressbar', { name: 'Project data completeness' })).toHaveAttribute('aria-valuenow', '80')
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/project-performance-desktop.png', animations: 'disabled' })
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  expect(state.unknown).toEqual([])
})

test('project selection updates the URL and Refresh reloads both full project details and performance data', async ({ page }) => {
  const state = await harness(page)
  await loaded(page)
  const selector = page.getByRole('combobox', { name: 'Active Project' })
  await selector.fill('5900738')
  await page.getByRole('option', { name: /5900738/ }).click()
  await expect(page).toHaveURL(/project=18/)
  await expect(selector).toHaveValue(/Grid Power Integration Project/)
  await expect(page.getByText('Client: Grid Operations', { exact: true })).toBeVisible()
  await loaded(page)
  const beforeRefresh = state.requests.length
  state.records[18].project.client_name = 'Updated Grid Client'
  state.records[18].project.progress = 63
  state.records[18].project.updated_at = '2026-09-15T06:35:00Z'
  state.records[18].snapshots.at(-1).progress_pct = '47.00'
  state.records[18].snapshots.at(-1).spi = '0.9400'
  state.records[18].kpis.spent = '4750000.00'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('Client: Updated Grid Client', { exact: true })).toBeVisible()
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('47%')
  await expect(page.getByRole('img', { name: 'Schedule progress history: 5 recorded periods. Latest planned 50%, actual 47%.' })).toBeVisible()
  await expect(region(page, 'Cost & forecast')).toContainText('4,750,000')
  const afterRefresh = state.requests.slice(beforeRefresh)
  expect(afterRefresh.some(item => item.path.endsWith('/projects/18/'))).toBe(true)
  for (const suffix of ['/analytics/cost-kpis/', '/analytics/commercial-dashboard/', '/projects/tasks/', '/projects/milestones/', '/change-events/', '/integrated-snapshots/']) {
    expect(afterRefresh.some(item => item.id === '18' && item.path.endsWith(suffix)), suffix).toBe(true)
  }
  expect(state.unknown).toEqual([])
})

test('work areas and More retain supported project actions', async ({ page }) => {
  const state = await harness(page)
  await loaded(page)
  await workAreas(page).getByRole('button', { name: 'Schedule', exact: true }).click()
  await expect(page).toHaveURL(/view=plan-baseline/)
  await expect(page.getByRole('heading', { name: 'Schedule Performance', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Management', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Planner', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Create linked planning workspace', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Cost & Commercial', exact: true }).click()
  await expect(page).toHaveURL(/view=commercial-dashboard/)
  await expect(page.getByRole('heading', { name: 'Cost & Commercial Performance', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Estimates', exact: true }).click()
  await expect(page).toHaveURL(/view=estimates/)
  await expect(page.getByRole('heading', { name: 'Project Estimates', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Management', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Estimate builder', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Documents', exact: true }).click()
  await expect(page).toHaveURL(/view=documents/)
  await expect(page.getByRole('heading', { name: 'Project Documents', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Document register', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Server files', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page).not.toHaveURL(/view=/)
  await page.locator('summary').filter({ hasText: 'More project actions' }).click()
  for (const name of ['Edit project details', 'Import from QHSE', 'New project', 'Portfolio Exceptions', 'Controls & Periods', 'Cost Detail', 'Delete project']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'AI Take-Off', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cost Detail', exact: true }).click()
  await expect(page).toHaveURL(/view=cost-dashboard/)
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Update progress', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Edit project/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1 } })
  await page.getByRole('button', { name: 'Export report', exact: true }).click()
  expect(await page.evaluate(() => window.__printed)).toBe(1)
  expect(state.unknown).toEqual([])
})

test('Milestones work area and change and quality dialogs expose recorded detail with honest provenance', async ({ page }) => {
  await harness(page)
  await loaded(page)
  await workAreas(page).getByRole('button', { name: 'Milestones', exact: true }).click()
  await expect(page).toHaveURL(/view=milestones/)
  await expect(page.getByRole('heading', { name: 'Milestone Control', exact: true })).toBeVisible()
  const milestoneRegister = region(page, 'Milestone register')
  await expect(milestoneRegister.getByRole('row').filter({ hasText: 'Design basis approved' })).toContainText(/Achieved|Complete/)
  await expect(milestoneRegister.getByRole('row').filter({ hasText: 'Vendor data approval' })).toContainText('Overdue')
  await expect(milestoneRegister.getByRole('row').filter({ hasText: 'IFC package release' })).toContainText(/Planned|Upcoming|Due soon|Not started/)
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await workAreas(page).getByRole('button', { name: 'Risks & Changes', exact: true }).click()
  await expect(page).toHaveURL(/view=risk/)
  await expect(page.getByRole('heading', { name: 'Risk & Change Control', exact: true })).toBeVisible()
  await expect(region(page, 'Change control').getByRole('row', { name: /Additional tie-in scope/ })).toContainText(/detected/i)
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Review data quality', exact: true }).click()
  const qualityDialog = page.getByRole('dialog', { name: 'Data quality review' })
  await expect(qualityDialog).toContainText('not a prediction confidence score')
  await expect(qualityDialog).toContainText('sealed reporting periods linked to approved schedule snapshots')
  await expect(qualityDialog.getByRole('button', { name: 'Review', exact: true })).toHaveCount(5)
  const scan = await new AxeBuilder({ page }).include('.pp-dialog').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
})

test('missing milestones and reporting periods never invent a curve or a reliable finish forecast', async ({ page }) => {
  await harness(page, 'project=17', { prepare: state => {
    state.records[17].snapshots = []
    state.records[17].milestones = []
    state.records[17].project.custom_fields = { data_date: '2026-09-15' }
    state.records[17].kpis.forecast = { eac: null, cpi: null, spi: null }
  } })
  await loaded(page)
  await expect(page.getByRole('img', { name: /Schedule progress history/ })).toHaveCount(0)
  await expect(region(page, 'Schedule performance')).toContainText('No recorded progress history')
  await expect(region(page, 'Schedule performance').getByTitle(/No sealed reporting periods are available/)).toBeVisible()
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('42%')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /^Forecast finish/ })).toContainText('Not reliable')
  await expect(region(page, 'Milestone readiness')).toContainText('No milestones recorded')
  await expect(region(page, 'Management actions')).toContainText('milestones')
  await expect(page.getByRole('progressbar', { name: 'Project data completeness' })).toHaveAttribute('aria-valuenow', '40')
})

test('failed services remain unavailable and Retry data restores recorded values', async ({ page }) => {
  const state = await harness(page, 'project=17', { failures: ['snapshots', 'kpis', 'commercial', 'milestones'] })
  await loaded(page)
  await expect(page.getByRole('alert')).toContainText('Some project data is unavailable')
  await expect(region(page, 'Schedule performance')).toContainText('Reporting history could not be loaded')
  await expect(region(page, 'Cost & forecast')).toContainText('Not available')
  await expect(region(page, 'Milestone readiness')).toContainText('Milestones unavailable')
  await expect(region(page, 'Recent project activity')).toContainText('Commercial activity is unavailable')
  await expect(page.getByRole('img', { name: /Schedule progress history/ })).toHaveCount(0)
  state.failures.clear()
  await page.getByRole('button', { name: 'Retry data', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /Schedule progress history: 5 recorded periods/ })).toBeVisible()
  await expect(region(page, 'Milestone readiness')).toContainText('1 of 4 complete')
  await expect(region(page, 'Cost & forecast')).toContainText('4,600,000')
})

test('mobile overview and dialogs fit the viewport and support keyboard project selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await harness(page, 'project=17&shell=true')
  await loaded(page)
  await page.screenshot({ path: '../artifacts/project-performance-mobile.png', animations: 'disabled' })
  await page.screenshot({ path: '../artifacts/project-performance-mobile-full.png', fullPage: true, animations: 'disabled' })
  await noHorizontalOverflow(page)
  const selector = page.getByRole('combobox', { name: 'Active Project' })
  await selector.fill('5900738')
  await selector.press('Enter')
  await expect(page).toHaveURL(/project=18/)
  await expect(page.getByText('Client: Grid Operations', { exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Milestones', exact: true }).click()
  await expect(page).toHaveURL(/view=milestones/)
  await expect(page.getByRole('heading', { name: 'Milestone Control', exact: true })).toBeVisible()
  await noHorizontalOverflow(page)
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('button', { name: 'Review data quality', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Data quality review' })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  expect(bounds.height).toBeLessThanOrEqual(844)
  await noHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  const activityScroller = region(page, 'Recent project activity').locator('.pp-table-wrap')
  await expect(activityScroller).toHaveAttribute('tabindex', '0')
  await activityScroller.focus()
  await activityScroller.press('ArrowRight')
  await expect.poll(() => activityScroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
})


const linkedRegister = items => ({
  project: { id: 81, enterprise_project: 17, created_at: '2026-01-01T00:00:00Z' },
  schedule: { id: 91, project: 81, status: 'active', created_at: '2026-01-01T00:00:00Z' },
  versions: [{ id: 101, schedule: 91, version: 3, status: 'draft' }, { id: 100, schedule: 91, version: 2, status: 'superseded' }],
  governance: { version: { id: 101, version: 3, status: 'draft' }, items: items.map(item => ({ version: 101, ...item })), members: [], audit_events: [], reviews: [], current_user_id: 7, can_manage: true },
})

test('sealed report keeps progress, plan, variance, indices and date together despite newer working data', async ({ page }) => {
  const state = await harness(page, 'project=17', { prepare: state => {
    const record = state.records[17]
    record.project.progress = 91
    record.project.custom_fields.data_date = '2026-10-01'
    record.project.updated_at = '2026-10-02T09:00:00Z'
    record.kpis.forecast = { spi: 1.99, cpi: 1.88, eac: 123, snapshot_date: '2026-10-02' }
  } })
  await loaded(page)
  const cards = region(page, 'Performance indicators')
  await expect(cards.getByRole('button', { name: /Physical progress/ })).toContainText('42%')
  await expect(cards.getByRole('button', { name: /^Schedule/ })).toContainText('SPI 0.84')
  await expect(cards.getByRole('button', { name: /^Cost/ })).toContainText('CPI 0.91')
  await expect(region(page, 'Schedule performance')).toContainText('-8 pp')
  await expect(page.locator('.pp-project-meta')).toContainText('Sep 15, 2026')
  await expect(page.locator('.pp-project-meta')).not.toContainText('Oct 1, 2026')
  await cards.getByRole('button', { name: /Physical progress/ }).click()
  const source = page.getByRole('dialog', { name: 'Reporting source', exact: true })
  await expect(source).toContainText('Current working progress91%')
  await expect(source).toContainText(state.records[17].snapshots.at(-1).id)
  await expect(source).toContainText('Reporting data dateSep 15, 2026')
  await expect(source.getByRole('button', { name: 'Open reporting periods' })).toBeVisible()
  const scan = await new AxeBuilder({ page }).include('.pp-dialog').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.keyboard.press('Escape')
  await expect(cards.getByRole('button', { name: /Physical progress/ })).toBeFocused()
  expect(state.unknown).toEqual([])
})

test('latest sealed revision preserves zero progress and null indices without backfilling earlier or working values', async ({ page }) => {
  await harness(page, 'project=17', { prepare: state => {
    const record = state.records[17]
    const old = structuredClone(record.snapshots.at(-1))
    record.snapshots.push({ ...old, id: 'reissued-zero', version: 2, progress_pct: '0.00', spi: null, cpi: null, estimate_at_completion: null, sealed_at: '2026-09-15T08:00:00Z' })
    record.project.progress = 99
  } })
  await loaded(page)
  const cards = region(page, 'Performance indicators')
  await expect(cards.getByRole('button', { name: /Physical progress/ })).toContainText('0%')
  await expect(cards.getByRole('button', { name: /^Schedule/ })).toContainText('Not available')
  await expect(cards.getByRole('button', { name: /^Cost/ })).toContainText('Not available')
  await expect(region(page, 'Schedule performance')).toContainText('-50 pp')
  await expect(region(page, 'Reporting source')).toContainText('Version 2')
  await expect(page.getByRole('img', { name: /Latest planned 50%, actual 0%/ })).toBeVisible()
})

test('no sealed report uses explicitly labelled working zero without treating updated_at as a measurement date', async ({ page }) => {
  await harness(page, 'project=17', { prepare: state => {
    const record = state.records[17]
    record.snapshots = []
    record.project.progress = 0
    record.project.custom_fields = {}
    record.project.updated_at = '2026-10-02T09:00:00Z'
    record.kpis.forecast = { spi: 1.11, cpi: 1.22, eac: 555, snapshot_date: '2026-10-02' }
  } })
  await loaded(page)
  await expect(region(page, 'Reporting source')).toContainText('Working project record')
  await expect(region(page, 'Reporting source')).toContainText('Data date not recorded')
  const cards = region(page, 'Performance indicators')
  await expect(cards.getByRole('button', { name: /Physical progress/ })).toContainText('0%')
  await expect(cards.getByRole('button', { name: /^Schedule/ })).toContainText('Not available')
  await expect(cards.getByRole('button', { name: /^Cost/ })).toContainText('Not available')
  await page.getByRole('button', { name: 'View reporting source', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('No sealed reporting periods exist')
  await expect(page.getByRole('dialog')).toContainText('Working data dateNot provided')
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Edit working project' })).toBeVisible()
})

test('unavailable reporting history does not disguise working progress as a governed report', async ({ page }) => {
  await harness(page, 'project=17', { failures: ['snapshots'] })
  await loaded(page)
  await expect(region(page, 'Reporting source')).toContainText('Reporting source unavailable')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('Not available')
  await expect(page.getByRole('alert')).toContainText('Reporting history')
})

test('administrative pilot setup suppresses unconfirmed status and working progress without hiding sealed facts', async ({ page }) => {
  const state = await harness(page, 'project=17', { prepare: state => {
    const record = state.records[17]
    record.snapshots = []
    record.project.status = 'planning'
    record.project.progress = 61
    record.project.custom_fields = { data_date: '2026-09-15', control_setup: { operational_status_confirmed: false, progress_confirmed: false } }
  } }); await loaded(page)
  await expect(page.locator('.pp-title-row')).toContainText('Status to confirm')
  await expect(page.locator('.pp-title-row')).not.toContainText('Planning')
  await expect(region(page, 'Reporting source')).toContainText('Progress to confirm')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('Not available')
  await page.getByRole('button', { name: 'View reporting source', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Administrative setup values are not reported as actual progress')
  await expect(page.getByRole('dialog')).toContainText('Current working progressNot confirmed')
  await expect(page.getByRole('dialog')).toContainText('Working data dateNot provided')
  await page.keyboard.press('Escape')
  state.records[17].snapshots = structuredClone(snapshots)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(region(page, 'Reporting source')).toContainText('Sealed reporting period')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('42%')
  await expect(page.locator('.pp-title-row')).toContainText('Status to confirm')
})

test('linked current risk register drives counts, readiness, health and the register drilldown', async ({ page }) => {
  const state = await harness(page, 'project=17', { prepare: state => {
    state.records[17].snapshots.at(-1).spi = '1.0'
    state.records[17].snapshots.at(-1).cpi = '1.0'
    state.records[17].milestones.forEach(row => { row.is_completed = true })
    state.records[17].changes = []
    state.linkedRegister = linkedRegister([
      { id: 701, item_type: 'risk', title: 'Vendor approval delay', priority: 'high', status: 'open', metadata: {} },
      { id: 702, item_type: 'risk', title: 'Closed design risk', priority: 'critical', status: 'closed', metadata: {} },
      { id: 703, item_type: 'change_request', title: 'Scope adjustment', priority: 'medium', status: 'in_review', metadata: {} },
      { id: 704, version: 100, item_type: 'risk', title: 'Previous version risk', priority: 'critical', status: 'open', metadata: {} },
    ])
  } })
  await loaded(page)
  await expect(region(page, 'Risks & changes')).toContainText('1 open risk')
  await expect(region(page, 'Risks & changes')).toContainText('1 high or critical')
  await expect(region(page, 'Risks & changes')).toContainText('Version 3')
  await expect(page.getByRole('button', { name: 'Risk register Connected', exact: true })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Project data completeness' })).toHaveAttribute('aria-valuenow', '100')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /^Overall health/ })).toContainText('Needs attention')
  await region(page, 'Risks & changes').getByRole('button', { name: 'Review register' }).click()
  await expect(page).toHaveURL(/view=risk/)
  await expect(page.getByRole('heading', { name: 'Risk & Change Control', exact: true })).toBeVisible()
  await expect(region(page, 'Risk & issue register')).toContainText('Vendor approval delay')
  expect(state.requests.filter(row => row.path.endsWith('/governance/')).every(row => row.path.includes('/101/'))).toBe(true)
  expect(state.unknown).toEqual([])
})

test('connected empty register means zero recorded risks, while failed register remains unavailable', async ({ page }) => {
  const state = await harness(page, 'project=17', { prepare: state => { state.linkedRegister = linkedRegister([]) } })
  await loaded(page)
  await expect(region(page, 'Risks & changes')).toContainText('0 open risks')
  await expect(page.getByRole('button', { name: 'Risk register Connected', exact: true })).toBeVisible()
  state.failures.add('governance')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(region(page, 'Risks & changes')).toContainText('Risk register unavailable')
  await expect(page.getByRole('button', { name: 'Risk register Unavailable', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Risk register')
})


test('legacy period cost basis suppresses CPI and EAC while preserving sealed progress', async ({ page }) => {
  await harness(page, 'project=17', { prepare: state => {
    state.records[17].snapshots.at(-1).actual_cost_basis = 'legacy_period'
  } })
  await loaded(page)
  const cards = region(page, 'Performance indicators')
  await expect(cards.getByRole('button', { name: /Physical progress/ })).toContainText('42%')
  await expect(cards.getByRole('button', { name: /^Schedule/ })).toContainText('SPI 0.84')
  await expect(cards.getByRole('button', { name: /^Cost/ })).toContainText('Not available')
  await expect(cards.getByRole('button', { name: /^Cost/ })).toContainText('Legacy period cost basis')
  await expect(region(page, 'Reporting source')).toContainText('CPI/EAC unavailable')
  await cards.getByRole('button', { name: /^Cost/ }).click()
  await expect(page.getByRole('dialog')).toContainText('historical record remains unchanged')
})


test('pending registered changes prevent an all-clear overview when sealed indices and other checks are healthy', async ({ page }) => {
  await harness(page, 'project=17', { prepare: state => {
    state.records[17].snapshots.at(-1).spi = '1.0'
    state.records[17].snapshots.at(-1).cpi = '1.0'
    state.records[17].milestones.forEach(row => { row.is_completed = true })
    state.records[17].changes = []
    state.linkedRegister = linkedRegister([{ id: 710, item_type: 'change_request', title: 'Scope decision pending', priority: 'medium', status: 'in_review', owner: actor, due_date: '2026-09-30', metadata: {} }])
  } })
  await loaded(page)
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /^Overall health/ })).toContainText('Needs review')
  await expect(region(page, 'Management actions')).toContainText('1 registered change awaiting decision')
  await expect(region(page, 'Risks & changes')).toContainText('Pending changes1')
})

test('portfolio exceptions distinguishes unconfirmed administrative values from confirmed and sealed zero progress', async ({ page }) => {
  const state = await harness(page, 'project=17&view=portfolio-exceptions', { prepare: state => {
    const row = (id, code, status, progress, extra = {}) => ({ project: { id, code, name: 'Synthetic portfolio project', status, progress_pct: progress, owner: { name: 'Assigned owner' }, ...extra }, overall_severity: 'clear', exception_count: 0, exceptions: [], latest_snapshot: null })
    state.portfolio = {
      generated_at: '2026-09-15T06:30:00Z', thresholds: { cpi_warning_below: 0.9, spi_warning_below: 0.9 }, summary: { total_projects: 4, accessible_project_count: 4, clear_projects: 4 },
      projects: [
        row(17, 'PILOT-ADMIN', 'planning', 0, { operational_status_confirmed: false, progress_confirmed: false }),
        row(18, 'PILOT-CONFIRMED', 'active', 0, { operational_status_confirmed: true, progress_confirmed: true }),
        row(19, 'PILOT-MISSING', 'active', null),
        { ...row(20, 'PILOT-SEALED', 'planning', 27, { operational_status_confirmed: false, progress_confirmed: true }), latest_snapshot: { data_date: '2026-09-14', version: 1, cpi: '1.0', spi: '0.9' } },
      ],
    }
  } })
  const table = region(page, 'Portfolio exceptions by project')
  const row = code => table.getByRole('row').filter({ hasText: code })
  await expect(row('PILOT-ADMIN')).toContainText('Status to confirm · —')
  await expect(row('PILOT-ADMIN')).not.toContainText('0% complete')
  await expect(row('PILOT-CONFIRMED')).toContainText('active · 0% complete')
  await expect(row('PILOT-MISSING')).toContainText('active · —')
  await expect(row('PILOT-SEALED')).toContainText('Status to confirm · 27% complete')
  await expect(row('PILOT-SEALED')).toContainText('Data date 2026-09-14')
  expect(state.requests.filter(row => row.method !== 'GET')).toEqual([])
  expect(state.unknown).toEqual([])
})
