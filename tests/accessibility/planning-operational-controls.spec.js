import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { operationalHarness } from '../fixtures/operational-controls.fixture.js'
import { scheduleArea, scheduleVersion, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const controls = page => page.getByRole('region', { name: 'Operational controls', exact: true })
const open = async page => { await scheduleArea(page, 'controls'); await expect(controls(page).getByRole('heading', { name: 'Operational controls', exact: true })).toBeVisible() }
const view = (page, name) => controls(page).getByRole('tab', { name, exact: true }).click()
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]); expect(state.writes).toEqual([]) }

test('operational reporting loads lazily in Master Schedule and missing baseline never creates assumed progress', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) { current.controls = { ...current.controls, baseline: null, baselines: [], report: null, reports: [], activities: [], policies: [] } } })
  expect(state.operationalReads).toEqual([])
  await open(page)
  await expect(controls(page)).toContainText('An approved baseline is required')
  await expect(controls(page).getByRole('button', { name: 'New weekly report', exact: true })).toHaveCount(0)
  expect(state.operationalReads).toEqual([{ baseline_id: '11', report_id: null }])
  expect(state.operationalWrites).toEqual([]); clean(state)
})

test('a frozen approved baseline retains its verified source label in operational controls', async ({ page }) => {
  const state = await operationalHarness(page, { decorateSnapshot(plan) { return { ...plan, state: 'baselined', published_snapshot: true, source_verification: { status: 'verified', policy: 'approved_baseline', label: 'Frozen approved baseline' } } } })
  await open(page)
  await expect(scheduleWorkspace(page).getByLabel('Frozen approved baseline', { exact: true })).toBeVisible()
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Verify schedule sources', exact: true })).toHaveCount(0)
  expect(state.operationalWrites).toEqual([]); clean(state)
})

test('weekly entry preserves missing values, requires evidence, retains edits across Gantt navigation and saves exact revision', async ({ page }) => {
  const state = await operationalHarness(page, { activityCount: 28 })
  await open(page)
  const panel = controls(page)
  await expect(panel.getByLabel('physical progress pct ACT-001', { exact: true })).toHaveValue('')
  await panel.getByLabel('physical progress pct ACT-001', { exact: true }).fill('0')
  await expect(panel.getByRole('button', { name: 'Save weekly update', exact: true })).toBeDisabled()
  await panel.getByLabel('Evidence ACT-001', { exact: true }).fill('Inspection record 001: work not started.')
  await panel.getByRole('button', { name: 'Next weekly activities', exact: true }).click()
  await panel.getByLabel('remaining duration days ACT-026', { exact: true }).fill('3')
  await panel.getByLabel('Evidence ACT-026', { exact: true }).fill('Weekly discipline report section 6.')
  await scheduleArea(page, 'activities')
  await expect(scheduleWorkspace(page)).toBeVisible()
  await open(page)
  await expect(panel.getByLabel('remaining duration days ACT-026', { exact: true })).toHaveValue('3')
  await panel.getByRole('button', { name: 'Save weekly update', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Weekly update saved')
  expect(state.operationalWrites).toEqual([{ action: 'save_report', report_id: 31, revision: 3, observations: [{ activity_id: 101, actual_start: null, actual_finish: null, physical_progress_pct: 0, installed_quantity: null, remaining_duration_days: null, evidence: 'Inspection record 001: work not started.', notes: '' }, { activity_id: 126, actual_start: null, actual_finish: null, physical_progress_pct: null, installed_quantity: null, remaining_duration_days: 3, evidence: 'Weekly discipline report section 6.', notes: '' }], cost_coverage_confirmed: false, notes: '' }])
  clean(state)
})

test('an earning policy starts without methods, weights or budgets and saves only explicitly configured activities', async ({ page }) => {
  const state = await operationalHarness(page)
  await open(page); await view(page, 'Earning policy')
  await controls(page).getByRole('button', { name: 'New earning policy', exact: true }).click()
  const form = controls(page).getByRole('form', { name: 'New earning policy', exact: true })
  await expect(form.getByLabel('Earning method ACT-001', { exact: true })).toHaveValue('')
  await expect(form.getByLabel('Progress weight ACT-001', { exact: true })).toHaveValue('')
  await expect(form.getByLabel('Budget ACT-001', { exact: true })).toHaveValue('')
  await form.getByLabel('Earning policy name', { exact: true }).fill('Measured installed quantities')
  await form.getByLabel('Earning method ACT-001', { exact: true }).selectOption('quantity')
  await form.getByLabel('Planned quantity ACT-001', { exact: true }).fill('40')
  await form.getByLabel('Quantity unit ACT-001', { exact: true }).fill('drawings')
  await form.getByRole('button', { name: 'Save earning policy draft', exact: true }).click()
  await expect(controls(page).getByRole('status')).toContainText('Earning policy saved as a draft.')
  expect(state.operationalWrites).toEqual([{ action: 'create_policy', baseline_id: 11, name: 'Measured installed quantities', definition: { currency: null, activities: [{ activity_id: 101, method: 'quantity', weight: null, budget: null, planned_quantity: 40, quantity_unit: 'drawings', pv_method: 'not_specified', planned_value: [] }] } }])
  clean(state)
})

test('independent earning-policy approval requires the displayed revision and reason without creating a report', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) { Object.assign(current.controls.policies[0], { status: 'draft', revision: 6, created_by_id: 8, can_approve: true }) } })
  await open(page); await view(page, 'Earning policy')
  await expect(controls(page).getByRole('button', { name: 'Approve earning policy', exact: true })).toBeDisabled()
  await controls(page).getByLabel('Earning policy approval reason', { exact: true }).fill('Reviewed methods and approved quantities.')
  await controls(page).getByRole('button', { name: 'Approve earning policy', exact: true }).click()
  await expect(controls(page).getByRole('status')).toContainText('Earning policy approved.')
  expect(state.operationalWrites).toEqual([{ action: 'approve_policy', policy_id: 21, revision: 6, reason: 'Reviewed methods and approved quantities.' }])
  clean(state)
})

test('new weekly report uses an explicitly selected approved policy and existing period', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) { current.controls.reporting_periods[0].status = 'locked' } })
  await open(page)
  await controls(page).getByRole('button', { name: 'New weekly report', exact: true }).click()
  const form = controls(page).getByRole('form', { name: 'Create weekly report', exact: true })
  await expect(form.getByLabel('Weekly report earning policy', { exact: true })).toHaveValue('')
  await form.getByLabel('Weekly report earning policy', { exact: true }).selectOption('21')
  await expect(form.getByLabel('Weekly report existing period', { exact: true })).toContainText('locked')
  await form.getByLabel('Weekly report existing period', { exact: true }).selectOption('12')
  await form.getByRole('button', { name: 'Create weekly report draft', exact: true }).click()
  await expect(controls(page).getByRole('status')).toContainText('Weekly report draft created.')
  expect(state.operationalWrites).toEqual([{ action: 'create_report', baseline_id: 11, policy_id: '21', reporting_period_id: '12' }])
  clean(state)
})

test('incomplete reporting metrics remain explicit while submit and independent publish are separate decisions', async ({ page }) => {
  const state = await operationalHarness(page, { async onCommand({ state, route, reply }, body) {
    if (body.action === 'submit_report') { Object.assign(state.controls.report, { status: 'submitted', revision: 4, source_fingerprint: 'c'.repeat(64), permissions: { can_save: false, can_submit: false, can_publish: true, can_return: true } }); state.controls.reports = [structuredClone(state.controls.report)] }
    if (body.action === 'publish_report') { Object.assign(state.controls.report, { status: 'published', revision: 5, permissions: { can_correct: true } }); state.controls.reports = [structuredClone(state.controls.report)] }
    await reply(route, state.controls); return true
  } })
  await open(page); await view(page, 'Review & publish')
  await expect(controls(page)).toContainText('Not Specified')
  await expect(controls(page)).toContainText('Some activity progress is Not Specified.')
  await controls(page).getByLabel('Operational report decision reason', { exact: true }).fill('Review the reported coverage and open gaps.')
  await controls(page).getByRole('button', { name: 'Submit weekly report', exact: true }).click()
  await expect(controls(page).getByRole('status')).toContainText('Weekly report submitted for independent review.')
  expect(state.operationalWrites).toHaveLength(1)
  await controls(page).getByLabel('Operational report decision reason', { exact: true }).fill('Independent review confirms the reported gaps.')
  await controls(page).getByRole('button', { name: 'Publish operational period', exact: true }).click()
  await expect(controls(page).getByRole('status')).toContainText('Operational report published.')
  expect(state.operationalWrites).toEqual([{ action: 'submit_report', report_id: 31, revision: 3, source_fingerprint: 'a'.repeat(64), reason: 'Review the reported coverage and open gaps.' }, { action: 'publish_report', report_id: 31, revision: 4, source_fingerprint: 'c'.repeat(64), reason: 'Independent review confirms the reported gaps.' }])
  await expect(controls(page)).toContainText('It does not lock a finance period')
  await view(page, 'Weekly update')
  await expect(controls(page).getByLabel('physical progress pct ACT-001', { exact: true })).toBeDisabled()
  clean(state)
})

test('stale source rejection preserves review reason and never silently retries publication', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) { Object.assign(current.controls.report, { status: 'submitted', permissions: { can_publish: true } }) }, async onCommand({ route, reply }) { await reply(route, { detail: 'Approved actuals changed. Refresh and review the current sources.', code: 'operational_source_stale' }, 409); return true } })
  await open(page); await view(page, 'Review & publish')
  await controls(page).getByLabel('Operational report decision reason', { exact: true }).fill('Review accepted source totals.')
  await controls(page).getByRole('button', { name: 'Publish operational period', exact: true }).click()
  await expect(controls(page).getByRole('alert')).toContainText('Approved actuals changed')
  await expect(controls(page).getByLabel('Operational report decision reason', { exact: true })).toHaveValue('Review accepted source totals.')
  expect(state.operationalWrites).toHaveLength(1); clean(state)
})

test('cost-restricted readers see approved hour evidence without monetary fields or self-approval actions', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) { current.controls.permissions.can_view_costs = false; Object.assign(current.controls.policies[0], { status: 'draft', created_by_id: 7, can_approve: false }); current.controls.report.source_actuals.hours = [{ id: 8, source_type: 'approved_hour', source_reference: 'TS-081', work_date: '2026-09-21', hours: '6', control_account_id: 4, approved_by_id: 8, approved_at: '2026-09-21T09:00:00Z' }]; current.controls.report.source_actuals.total_hours = '6' } })
  await open(page); await view(page, 'Source actuals')
  await expect(controls(page)).toContainText('TS-081')
  await expect(controls(page).getByRole('region', { name: 'Posted cost records', exact: true })).toHaveCount(0)
  await view(page, 'Review & publish')
  await expect(controls(page).getByText('Actual cost · AED', { exact: true })).toHaveCount(0)
  await view(page, 'Earning policy')
  await expect(controls(page).getByRole('button', { name: 'Approve earning policy', exact: true })).toHaveCount(0)
  await controls(page).getByRole('button', { name: 'New earning policy', exact: true }).click()
  await expect(controls(page).getByLabel('Budget ACT-001', { exact: true })).toHaveCount(0)
  expect(state.operationalWrites).toEqual([]); clean(state)
})

test('published curves preserve missing observations and break at earning-policy changes', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) { current.controls.curves = [{ date: '2026-09-01', report_id: 1, revision: 2, policy_id: 21, progress_pct: '10', currency: 'AED' }, { date: '2026-09-08', report_id: 2, revision: 2, policy_id: 21, progress_pct: null, currency: 'AED' }, { date: '2026-09-15', report_id: 3, revision: 2, policy_id: 21, progress_pct: '20', currency: 'AED' }, { date: '2026-09-21', report_id: 4, revision: 2, policy_id: 22, progress_pct: '25', currency: 'AED' }] } })
  await open(page); await view(page, 'Trends & forecast')
  await expect(controls(page).locator('g[data-series="progress_pct"]')).toHaveCount(3)
  await controls(page).getByRole('button', { name: 'Data table', exact: true }).click()
  const table = controls(page).getByRole('region', { name: 'Published reporting values', exact: true })
  await expect(table.getByRole('row').filter({ hasText: '2026-09-08' })).toContainText('Not Specified')
  expect(state.operationalWrites).toEqual([]); clean(state)
})

test('historical schedule controls stay read only and keyboard tabs have accessible names', async ({ page }) => {
  const state = await operationalHarness(page, { history: true })
  await scheduleVersion(page, '90'); await open(page)
  await expect(controls(page)).toContainText('This schedule view is read only')
  await expect(controls(page).getByLabel('physical progress pct ACT-001', { exact: true })).toBeDisabled()
  await controls(page).getByRole('tab', { name: 'Weekly update', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(controls(page).getByRole('tab', { name: 'Source actuals', exact: true })).toBeFocused()
  expect((await new AxeBuilder({ page }).include('.planning-operational-controls').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  expect(state.operationalWrites).toEqual([]); clean(state)
})

test('remaining-work comparison shows the server overrun and missing activity reason without changing baseline dates', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) {
    current.controls.report.preview.forecast = { status: 'partial', method: 'retained_logic_whole_working_days', data_date: '2026-09-21', data_date_convention: 'end_of_day', contractual_finish: '2026-10-02', forecast_finish: null, finish_variance_calendar_days: null, limitations: ['One frozen working calendar is required.'], activities: [{ activity_id: 101, actual_start: '2026-09-14', forecast_start: '2026-09-14', forecast_finish: '2026-10-06', remaining_start: '2026-09-22', remaining_finish: '2026-10-06', total_float_days: -2, status: 'forecast' }, { activity_id: 102, status: 'unavailable', unavailable_reasons: ['remaining_duration_not_supported'] }] }
    current.controls.report.preview.activity_comparisons = [{ activity_id: 101, baseline_start: '2026-09-14', baseline_finish: '2026-10-02', actual_start: '2026-09-14', forecast_finish: '2026-10-06', finish_variance_calendar_days: 4, unavailable_reasons: [] }]
  } })
  const baseline = structuredClone(state.controls.baseline)
  await open(page); await view(page, 'Trends & forecast')
  const table = controls(page).getByRole('region', { name: 'Remaining-work activity forecast', exact: true })
  await expect(table).toContainText('Reviewed activity 1')
  await expect(table).toContainText('-2 d')
  await expect(table).toContainText('remaining duration not supported')
  await expect(controls(page).getByRole('region', { name: 'Baseline and reported activity dates', exact: true })).toContainText('4 calendar days')
  expect(state.controls.baseline).toEqual(baseline)
  expect(state.operationalWrites).toEqual([]); clean(state)
})

test('published corrections open a new draft and retain the original report in history', async ({ page }) => {
  const state = await operationalHarness(page, { prepare(current) { Object.assign(current.controls.report, { status: 'published', permissions: { can_correct: true }, observations: [{ activity_id: 101, physical_progress_pct: 30, actual_start: '2026-09-14', evidence: 'Approved weekly report 39.' }] }) }, async onCommand({ state, route, reply }, body) {
    expect(body.action).toBe('correction_report')
    const published = structuredClone(state.controls.report)
    state.controls.report = { ...structuredClone(published), id: 32, revision: 1, status: 'draft', supersedes_id: 31, permissions: { can_save: true, can_submit: true } }
    state.controls.reports = [structuredClone(state.controls.report), published]
    await reply(route, state.controls); return true
  } })
  await open(page); await view(page, 'Review & publish')
  await controls(page).getByLabel('Operational report decision reason', { exact: true }).fill('Correct the cited inspection reference.')
  await controls(page).getByRole('button', { name: 'Create correction draft', exact: true }).click()
  await expect(controls(page).getByLabel('Operational weekly report', { exact: true })).toHaveValue('32')
  await expect(controls(page).getByLabel('physical progress pct ACT-001', { exact: true })).toHaveValue('30')
  expect(state.controls.reports.find(row => row.id === 31).status).toBe('published')
  expect(state.operationalWrites).toEqual([{ action: 'correction_report', report_id: 31, reason: 'Correct the cited inspection reference.' }]); clean(state)
})
