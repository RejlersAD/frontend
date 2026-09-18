import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { scheduleHarness } from '../fixtures/schedule-performance.fixture'

test.setTimeout(60000)

const region = (page, name) => page.getByRole('region', { name, exact: true })
const indicators = page => region(page, 'Schedule indicators')
const lookahead = page => region(page, 'Six-week look-ahead')
const workAreas = page => page.getByRole('navigation', { name: 'Project work areas' })

async function loaded(page) {
  await expect(page.getByRole('heading', { name: 'Schedule Performance', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Performance', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(indicators(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
}

async function selectMatching(select, pattern) {
  const option = select.getByRole('option').filter({ hasText: pattern }).first()
  const value = await option.evaluate(element => element.value)
  await select.selectOption(value)
}

async function noHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('.project-performance-workspace *')].filter(element => {
      for (let parent = element.parentElement; parent && !['BODY', 'HTML'].includes(parent.tagName); parent = parent.parentElement) {
        if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(parent).overflowX)) return false
      }
      return element.getBoundingClientRect().right > innerWidth + 1
    }).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right) })),
  }))
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1)
}

test('desktop Schedule shows six recorded indicators, baseline provenance, and management panels', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await scheduleHarness(page)
  await loaded(page)
  for (const label of ['Schedule health', 'Planned progress', 'Actual progress', 'Variance', 'SPI', 'Forecast finish']) {
    await expect(indicators(page).getByText(label, { exact: true })).toBeVisible()
  }
  await expect(indicators(page)).toContainText('42%')
  await expect(page.getByRole('combobox', { name: 'Baseline', exact: true })).toHaveValue('502')
  await expect(page.getByRole('combobox', { name: 'Compare', exact: true })).toHaveValue('91')
  for (const title of ['Baseline vs actual', 'Schedule exceptions', 'Six-week look-ahead', 'Milestone outlook', 'Critical and late activities', 'Recovery impact', 'Schedule data quality']) {
    await expect(region(page, title)).toBeVisible()
  }
  await expect(region(page, 'Baseline vs actual').locator('svg.recharts-surface')).toBeVisible()
  await expect(region(page, 'Recovery impact')).toContainText('8')
  await expect(region(page, 'Recovery impact')).toContainText(/target|reduction|compression/i)
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/schedule-performance-desktop.png', animations: 'disabled' })
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  expect(state.unknown).toEqual([])
})

test('baseline, comparison version, date window, and chart/table controls reflect the selected source', async ({ page }) => {
  const state = await scheduleHarness(page)
  await loaded(page)
  await page.getByRole('combobox', { name: 'Baseline', exact: true }).selectOption('501')
  await expect(page.getByRole('combobox', { name: 'Baseline', exact: true })).toHaveValue('501')
  await expect(page.getByText(/Rev 0.*original baseline/).first()).toBeAttached()
  await page.getByRole('combobox', { name: 'Compare', exact: true }).selectOption('90')
  await expect(page.getByRole('combobox', { name: 'Compare', exact: true })).toHaveValue('90')
  await expect.poll(() => state.requests.some(request => request.path.endsWith('/schedule-versions/90/controls/'))).toBe(true)
  const timeRange = page.getByRole('combobox', { name: 'Time range', exact: true })
  await selectMatching(timeRange, /Last 3 months/i)
  await expect(timeRange.getByRole('option', { selected: true })).toHaveText(/Last 3 months/i)
  await selectMatching(timeRange, /Next 6 weeks/i)
  await expect(timeRange.getByRole('option', { selected: true })).toHaveText(/Next 6 weeks/i)
  await selectMatching(timeRange, /Full project/i)
  const chartPanel = region(page, 'Baseline vs actual')
  await chartPanel.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(chartPanel.getByRole('table')).toBeVisible()
  await expect(chartPanel.getByRole('table')).toContainText(/Actual|Recorded/i)
  await chartPanel.getByRole('button', { name: 'Chart', exact: true }).click()
  await expect(chartPanel.locator('svg.recharts-surface')).toBeVisible()
  expect(state.unknown).toEqual([])
})

test('look-ahead filters constrain activities by discipline, owner, criticality, search, and status', async ({ page }) => {
  await scheduleHarness(page)
  await loaded(page)
  await expect(lookahead(page).getByText('Piping isometrics package', { exact: true })).toBeVisible()
  await expect(lookahead(page).getByText('Cable routing review', { exact: true })).toBeVisible()
  const discipline = lookahead(page).getByRole('combobox', { name: 'Discipline', exact: true })
  await selectMatching(discipline, /piping/i)
  await expect(lookahead(page).getByText('Piping isometrics package', { exact: true })).toBeVisible()
  await expect(lookahead(page).getByText('Cable routing review', { exact: true })).toHaveCount(0)
  await selectMatching(discipline, /^All/)
  const owner = lookahead(page).getByRole('combobox', { name: 'Owner', exact: true })
  await selectMatching(owner, /Electrical Lead|Omar Saleh/)
  await expect(lookahead(page).getByText('Cable routing review', { exact: true })).toBeVisible()
  await expect(lookahead(page).getByText('Piping isometrics package', { exact: true })).toHaveCount(0)
  await selectMatching(owner, /^All/)
  await lookahead(page).getByRole('checkbox', { name: 'Critical only', exact: true }).check()
  await expect(lookahead(page).getByText('Piping isometrics package', { exact: true })).toBeVisible()
  await expect(lookahead(page).getByText('Cable routing review', { exact: true })).toHaveCount(0)
  await lookahead(page).getByRole('checkbox', { name: 'Critical only', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search activities', exact: true }).fill('pump')
  await expect(lookahead(page).getByText('Long-lead pump procurement', { exact: true })).toBeVisible()
  await expect(lookahead(page).getByText('Cable routing review', { exact: true })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search activities', exact: true }).fill('')
  await selectMatching(page.getByRole('combobox', { name: 'Status', exact: true }), /^Blocked$/)
  await expect(lookahead(page).getByText('Long-lead pump procurement', { exact: true })).toBeVisible()
  await expect(lookahead(page).getByText('Cable routing review', { exact: true })).toHaveCount(0)
})

test('activity, exception, and quality dialogs show source details and return keyboard focus', async ({ page }) => {
  await scheduleHarness(page)
  await loaded(page)
  const activityRow = lookahead(page).getByRole('row').filter({ hasText: 'Piping isometrics package' })
  const openActivity = activityRow.getByRole('button', { name: 'Piping isometrics package', exact: true })
  await openActivity.click()
  const activityDialog = page.getByRole('dialog', { name: 'Activity details', exact: true })
  await expect(activityDialog).toBeVisible()
  await expect(activityDialog).toContainText('PIP-014')
  await expect(activityDialog).toContainText('Piping isometrics package')
  await page.keyboard.press('Escape')
  await expect(activityDialog).toHaveCount(0)
  await expect(openActivity).toBeFocused()
  const exceptions = region(page, 'Schedule exceptions').getByRole('button', { name: /View all/i })
  await exceptions.click()
  const exceptionDialog = page.getByRole('dialog', { name: 'Schedule exceptions', exact: true })
  await expect(exceptionDialog).toBeVisible()
  await expect(exceptionDialog).toContainText(/Vendor documentation hold|Piping isometrics package/)
  await page.keyboard.press('Escape')
  await expect(exceptions).toBeFocused()
  const qualityButton = page.getByRole('button', { name: 'Review schedule data', exact: true })
  await qualityButton.click()
  const qualityDialog = page.getByRole('dialog', { name: 'Schedule data quality', exact: true })
  await expect(qualityDialog).toBeVisible()
  await expect(qualityDialog).toContainText(/baseline/i)
  await expect(qualityDialog).toContainText(/recorded|reported|source/i)
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(qualityButton).toBeFocused()
})

test('CSV export contains normalized activity records and never changes server state', async ({ page }) => {
  const state = await scheduleHarness(page)
  await loaded(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export schedule', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.csv$/i)
  const contents = await readFile(await download.path(), 'utf8')
  expect(contents).toContain('PIP-014')
  expect(contents).toContain('Piping isometrics package')
  expect(contents).toContain('CON-008')
  expect(contents).toContain('Site tie-in installation')
  expect(contents).toMatch(/baseline/i)
  expect(contents).toMatch(/"5900913","(?:Version\s+)?3[^"]*","Rev 1/)
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
})

test('Refresh and project selection reload the schedule source and preserve the selected work area', async ({ page }) => {
  const state = await scheduleHarness(page)
  await loaded(page)
  const before = state.requests.length
  state.records[17].controls.progress_pct = '47.00'
  state.records[17].controls.snapshots.at(-1).progress_pct = '47.00'
  state.records[17].project.client_name = 'Updated Refining Client'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(indicators(page)).toContainText('47%')
  await expect(page.getByText('Client: Updated Refining Client', { exact: true })).toBeVisible()
  await expect.poll(() => state.requests.slice(before).some(request => request.path.endsWith('/schedule-versions/91/controls/'))).toBe(true)
  const selector = page.getByRole('combobox', { name: 'Active Project', exact: true })
  await selector.fill('5900738')
  await selector.press('Enter')
  await expect(page).toHaveURL(/project=18/)
  await expect(page).toHaveURL(/view=plan-baseline/)
  await expect(indicators(page)).toContainText('28%')
  await expect(page.getByRole('combobox', { name: 'Compare', exact: true })).toHaveValue('1091')
  await expect.poll(() => state.requests.some(request => request.path.endsWith('/schedule-versions/1091/controls/'))).toBe(true)
  expect(state.unknown).toEqual([])
})

test('Performance and Planning preserve the linked-planning workflow and update action', async ({ page }) => {
  await scheduleHarness(page, { prepare: state => { state.noLinked = true } })
  await loaded(page)
  await page.getByRole('button', { name: 'Planning', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Planning', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Project Planning', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Scope summary', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Performance', exact: true }).click()
  await expect(indicators(page)).toBeVisible()
  await page.getByRole('button', { name: 'Update schedule', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Planning', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('textbox', { name: 'Scope summary', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page).not.toHaveURL(/view=plan-baseline/)
  await expect(page.getByRole('heading', { name: 'Project Performance', exact: true })).toBeVisible()
})

test('no approved baseline and failed controls remain distinct from recorded zero progress', async ({ page }) => {
  const state = await scheduleHarness(page, { prepare: current => { current.records[17].baselines = [] } })
  await loaded(page)
  await expect(page.getByRole('combobox', { name: 'Baseline', exact: true }).getByRole('option', { selected: true })).toHaveText(/No approved baseline/)
  await expect(indicators(page)).toContainText('42%')
  await expect(region(page, 'Baseline vs actual')).toContainText(/baseline/i)
  state.failures.add('/controls/')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/Schedule progress|could not be loaded|unavailable/i)
  await expect(indicators(page)).not.toContainText('42%')
  await expect(indicators(page)).toContainText(/Not available|Unavailable/)
  state.failures.clear()
  state.records[17].controls.progress_pct = '0.00'
  state.records[17].controls.snapshots = []
  state.records[17].controls.activities.forEach(activity => { activity.physical_progress_pct = '0.00'; activity.actual_finish = null })
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(indicators(page)).toContainText('0%')
})

test('mobile Schedule, local scrollers, and native dialogs fit the viewport and pass accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await scheduleHarness(page)
  await loaded(page)
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/schedule-performance-mobile.png', animations: 'disabled' })
  await page.screenshot({ path: '../artifacts/schedule-performance-mobile-full.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Review schedule data', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Schedule data quality', exact: true })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  expect(bounds.height).toBeLessThanOrEqual(844)
  await noHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
})


test('same-date schedule observations select highest revision before timestamps and IDs', async ({ page }) => {
  const state = await scheduleHarness(page)
  await loaded(page)
  const record = structuredClone(state.records[17])
  record.controls.snapshots = [
    { id: 500, data_date: '2026-08-31', revision: 1, progress_pct: 10, created_at: '2026-09-20T00:00:00Z' },
    { id: 501, data_date: '2026-08-31', revision: 2, progress_pct: 32, created_at: '2026-09-01T00:00:00Z' },
    { id: 502, data_date: '2026-08-31', revision: 2, progress_pct: 33, created_at: '2026-09-01T00:00:00Z' },
  ]
  const observed = await page.evaluate(async record => {
    const { buildScheduleModel } = await import('/src/pages/Projects/useSchedulePerformance.js')
    const model = buildScheduleModel(record.project, {}, record)
    return model.chartPoints.filter(row => row.date === '2026-08-31')
  }, record)
  expect(observed).toHaveLength(1)
  expect(observed[0].actual).toBe(33)
  expect(record.controls.snapshots).toHaveLength(3)
})

function engineeringOnly(state) {
  const record = state.records[17]
  record.project.scope_type = 'detailed_engineering'
  record.controls.control_scope = { scope_type: 'detailed_engineering', ready: true, owned_activity_ids: [401, 402], dependency_activity_ids: [403, 404, 405, 406], blockers: [], source: 'activity_links' }
  record.controls.progress_pct = '70.00'
  record.controls.activities.forEach(row => {
    row.control_role = [401, 402].includes(row.id) ? 'owned' : 'dependency'
    if (row.control_role === 'dependency') row.budgeted_cost = '99000000.00'
  })
  // Baseline IDs differ across versions; external codes carry correspondence.
  record.baselines.forEach(baseline => baseline.snapshot.activities.forEach(row => { row.id += 10000; if (!['ENG-001', 'PIP-014'].includes(row.external_id)) row.duration_days = 1000 }))
  record.controls.snapshots = [
    { id: 2001, revision: 9, data_date: '2026-08-31', progress_pct: 99 },
    { id: 2002, revision: 1, data_date: '2026-08-31', progress_pct: 57, payload: { control_scope: structuredClone(record.controls.control_scope) } },
    { id: 2003, revision: 1, data_date: '2026-09-01', progress_pct: 88, payload: { control_scope: { ...record.controls.control_scope, owned_activity_ids: [401] } } },
    { id: 2004, revision: 1, data_date: '2026-09-02', progress_pct: 95, payload: { control_scope: { ...record.controls.control_scope, ready: false } } },
  ]
}

test('detailed engineering controls exclude dependency weights and finish dates while preserving the activity register', async ({ page }) => {
  const state = await scheduleHarness(page, { prepare: engineeringOnly })
  await loaded(page)
  const cards = indicators(page)
  await expect(cards.getByRole('article').filter({ hasText: 'Planned progress' })).toContainText('100%')
  await expect(cards.getByRole('article').filter({ hasText: 'Actual progress' })).toContainText('70%')
  await expect(cards.getByRole('article').filter({ hasText: 'Variance' })).toContainText('-30 pp')
  await expect(cards.getByRole('article').filter({ hasText: 'SPI' })).toContainText('0.78')
  await expect(cards.getByRole('article').filter({ hasText: 'Forecast finish' })).toContainText('29 Sept 2026')
  await expect(cards).toContainText('Engineering forecast')
  await lookahead(page).getByRole('button', { name: 'Long-lead pump procurement' }).click()
  await expect(page.getByRole('dialog', { name: 'Activity details' })).toContainText('External dependency')
  await page.keyboard.press('Escape')
  const observed = await page.evaluate(async record => {
    const { buildScheduleModel } = await import('/src/pages/Projects/useSchedulePerformance.js')
    const model = buildScheduleModel(record.project, {}, record)
    record.controls.progress_pct = '0.00'
    record.controls.activities.forEach(row => { row.physical_progress_pct = row.control_role === 'owned' ? '0.00' : '100.00'; row.actual_finish = null })
    const zero = buildScheduleModel(record.project, {}, record)
    return { points: model.chartPoints.filter(row => row.actual !== null), roles: model.activities.map(row => row.controlRole), comparable: model.progressComparable, zero: { actual: zero.actualProgress, spi: zero.spi, variance: zero.variance } }
  }, structuredClone(state.records[17]))
  expect(observed.comparable).toBe(true)
  expect(observed.roles).toEqual(['owned', 'owned', 'dependency', 'dependency', 'dependency', 'dependency'])
  expect(observed.points.map(row => [row.date, row.actual])).toEqual([['2026-08-31', 57], ['2026-09-15', 70]])
  expect(observed.zero).toEqual({ actual: 0, spi: 0, variance: -100 })
  expect(state.unknown).toEqual([])
})

test('missing or invalid engineering ownership suppresses stale aggregate numbers and history', async ({ page }) => {
  const state = await scheduleHarness(page, { prepare: engineeringOnly })
  await loaded(page)
  const observed = await page.evaluate(async record => {
    const { buildScheduleModel } = await import('/src/pages/Projects/useSchedulePerformance.js')
    return [null, { scope_type: 'detailed_engineering', ready: false, owned_activity_ids: [401] }, { scope_type: 'detailed_engineering', ready: true, owned_activity_ids: [] }, { scope_type: 'detailed_engineering', ready: true, owned_activity_ids: [9999] }, { scope_type: 'epc', ready: true, owned_activity_ids: [401, 402] }].map(scope => {
      record.controls.control_scope = scope
      const model = buildScheduleModel(record.project, {}, record)
      return { actual: model.actualProgress, planned: model.plannedProgress, variance: model.variance, spi: model.spi, forecast: model.forecastFinish, points: model.chartPoints, count: model.activities.length, ready: model.scopeReady }
    })
  }, structuredClone(state.records[17]))
  observed.forEach(row => expect(row).toEqual({ actual: null, planned: null, variance: null, spi: null, forecast: null, points: [], count: 6, ready: false }))
  state.records[17].controls.control_scope.ready = false
  state.records[17].controls.control_scope.blockers = ['Map engineering activities before reporting progress.']
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(cardsByLabel(page, 'Actual progress')).toContainText('Unavailable')
  await expect(page.getByText(/Controlled engineering scope is unavailable/).first()).toBeVisible()
})

const cardsByLabel = (page, label) => indicators(page).getByRole('article').filter({ hasText: label })

test('ambiguous or missing baseline ownership correspondence prevents engineering comparisons', async ({ page }) => {
  const state = await scheduleHarness(page, { prepare: engineeringOnly })
  await loaded(page)
  const observed = await page.evaluate(async record => {
    const { buildScheduleModel } = await import('/src/pages/Projects/useSchedulePerformance.js')
    const missing = structuredClone(record)
    missing.workspace.baselines[0].snapshot.activities = missing.workspace.baselines[0].snapshot.activities.filter(row => row.external_id !== 'PIP-014')
    const duplicate = structuredClone(record)
    duplicate.workspace.baselines[0].snapshot.activities.push({ ...duplicate.workspace.baselines[0].snapshot.activities[0], id: 99999 })
    return [missing, duplicate].map(data => {
      const model = buildScheduleModel(data.project, {}, data)
      return { actual: model.actualProgress, planned: model.plannedProgress, variance: model.variance, spi: model.spi, comparable: model.progressComparable }
    })
  }, structuredClone(state.records[17]))
  observed.forEach(row => expect(row).toEqual({ actual: 70, planned: null, variance: null, spi: null, comparable: false }))
})
