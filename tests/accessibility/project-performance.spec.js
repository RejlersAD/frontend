import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { actor, harness, snapshots } from '../fixtures/project-details-overview.fixture.js'

test.setTimeout(60000)

const region = (page, name) => page.getByRole('region', { name, exact: true })
const workAreas = page => page.getByRole('navigation', { name: 'Project work areas' })

async function loaded(page) {
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  await expect(region(page, 'Performance indicators').getByRole('button')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Update progress', exact: true })).toBeEnabled()
}


async function menuAction(page, name) {
  await page.locator('summary[aria-label="More project actions"]').click()
  await page.locator('.pd-menu').getByRole('button', { name, exact: true }).click()
}
async function scheduleSummary(page) {
  await region(page, 'Progress performance').getByRole('tab', { name: 'Schedule', exact: true }).click()
  return region(page, 'Progress performance')
}
async function progressChart(page) {
  await region(page, 'Progress performance').getByRole('tab', { name: 'Progress', exact: true }).click()
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
  await expect(page.getByRole('img', { name: 'Progress history: 5 recorded periods. Latest planned 50%, actual 42%.' })).toBeVisible()
  await expect(region(page, 'Progress performance').getByTitle(/approved schedule snapshots/)).toBeVisible()
  await expect(await scheduleSummary(page)).toContainText('-8 percentage points')
  await expect(region(page, 'Progress performance')).toContainText('Dec 28, 2026')
  await progressChart(page)
  const cost = region(page, 'Cost position')
  await expect(cost.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Control budget$/ }) }).locator('dd')).toHaveAttribute('title', /10,000,000/)
  await expect(cost.locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Actual cost$/ }) }).locator('dd')).toHaveAttribute('title', /4,600,000/)
  await expect(indicators.getByRole('button', { name: 'Milestones', exact: true })).toContainText(/1\s*(?:\/|of)\s*4/)
  await expect(region(page, 'Risk & change exposure')).toContainText('Risk register not connected')
  await expect(region(page, 'Recent activity')).toContainText('Purchase order approved')
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/project-performance-desktop.png', animations: 'disabled' })
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  expect(state.unknown).toEqual([])
})

test('project selection updates the URL and Refresh reloads both full project details and performance data', async ({ page }) => {
  const state = await harness(page)
  await loaded(page)
  await page.locator('summary[aria-label="More project actions"]').click()
  const selector = page.getByRole('combobox', { name: 'Active Project', includeHidden: true })
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
  await menuAction(page, 'Refresh project')
  await expect(page.getByText('Client: Updated Grid Client', { exact: true })).toBeVisible()
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('47%')
  await expect(page.getByRole('img', { name: 'Progress history: 5 recorded periods. Latest planned 50%, actual 47%.' })).toBeVisible()
  await expect(region(page, 'Cost position').locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Actual cost$/ }) }).locator('dd')).toHaveAttribute('title', /4,750,000/)
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
  await expect(workAreas(page).getByRole('button', { name: 'Schedule', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Cost & Commercial', exact: true }).click()
  await expect(page).toHaveURL(/view=commercial-dashboard/)
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Estimates', exact: true }).click()
  await expect(page).toHaveURL(/view=estimates/)
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Management', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Estimate builder', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Documents', exact: true }).click()
  await expect(page).toHaveURL(/view=documents/)
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Document register', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Server files', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page).not.toHaveURL(/view=/)
  await page.locator('summary[aria-label="More project actions"]').click()
  await expect(page.getByRole('button', { name: 'Plan & Baseline', exact: true })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  expect(await page.evaluate(() => window.__printed)).toBe(1)
  expect(state.unknown).toEqual([])
})

test('Milestones work area and change and quality dialogs expose recorded detail with honest provenance', async ({ page }) => {
  await harness(page)
  await loaded(page)
  await workAreas(page).getByRole('button', { name: 'Milestones', exact: true }).click()
  await expect(page).toHaveURL(/view=milestones/)
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  const milestoneRegister = region(page, 'Milestone register')
  await expect(milestoneRegister.getByRole('row').filter({ hasText: 'Design basis approved' })).toContainText(/Achieved|Complete/)
  await expect(milestoneRegister.getByRole('row').filter({ hasText: 'Vendor data approval' })).toContainText('Overdue')
  await expect(milestoneRegister.getByRole('row').filter({ hasText: 'IFC package release' })).toContainText(/Planned|Upcoming|Due soon|Not started/)
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await workAreas(page).getByRole('button', { name: 'Risks & Changes', exact: true }).click()
  await expect(page).toHaveURL(/view=risk/)
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  await expect(region(page, 'Change control').getByRole('row', { name: /Additional tie-in scope/ })).toContainText(/detected/i)
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await menuAction(page, 'Data quality')
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
  await expect(page.getByRole('img', { name: /Progress history/ })).toHaveCount(0)
  await expect(region(page, 'Progress performance')).toContainText('No sealed progress history is recorded')
  await expect(region(page, 'Progress performance').getByTitle(/No sealed reporting periods are available/)).toBeVisible()
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('42%')
  await expect(await scheduleSummary(page)).toContainText('A reliable finish forecast cannot be confirmed')
  await expect(region(page, 'Upcoming milestones')).toContainText('No milestones recorded')
  await expect(region(page, 'Priority actions')).toContainText('milestones')
  await menuAction(page, 'Data quality')
  await expect(page.getByRole('dialog', { name: 'Data quality review' })).toContainText('Schedule dataMissing')
})

test('failed services remain unavailable and Retry data restores recorded values', async ({ page }) => {
  const state = await harness(page, 'project=17', { failures: ['snapshots', 'kpis', 'commercial', 'milestones'] })
  await loaded(page)
  await expect(page.getByRole('alert')).toContainText('unavailable')
  await expect(region(page, 'Progress performance')).toContainText('Progress history unavailable')
  await expect(region(page, 'Cost position')).toContainText('Not available')
  await expect(region(page, 'Upcoming milestones')).toContainText('Milestones unavailable')
  await expect(region(page, 'Recent activity')).toContainText(/unavailable|available sources/i)
  await expect(page.getByRole('img', { name: /Progress history/ })).toHaveCount(0)
  state.failures.clear()
  await page.getByRole('button', { name: 'Retry data', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /Progress history: 5 recorded periods/ })).toBeVisible()
  await expect(region(page, 'Performance indicators').getByRole('button', { name: 'Milestones', exact: true })).toContainText(/1\s*(?:\/|of)\s*4/)
  await expect(region(page, 'Cost position').locator('dl > div').filter({ has: page.locator('dt', { hasText: /^Actual cost$/ }) }).locator('dd')).toHaveAttribute('title', /4,600,000/)
})

test('mobile overview and dialogs fit the viewport and support keyboard project selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await harness(page, 'project=17&shell=true')
  await loaded(page)
  await page.screenshot({ path: '../artifacts/project-performance-mobile.png', animations: 'disabled' })
  await page.screenshot({ path: '../artifacts/project-performance-mobile-full.png', fullPage: true, animations: 'disabled' })
  await noHorizontalOverflow(page)
  await page.locator('summary[aria-label="More project actions"]').click()
  const selector = page.getByRole('combobox', { name: 'Active Project', includeHidden: true })
  await selector.fill('5900738')
  await selector.press('Enter')
  await expect(page).toHaveURL(/project=18/)
  await expect(page.getByText('Client: Grid Operations', { exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Milestones', exact: true }).click()
  await expect(page).toHaveURL(/view=milestones/)
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  await noHorizontalOverflow(page)
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await menuAction(page, 'Data quality')
  const dialog = page.getByRole('dialog', { name: 'Data quality review' })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  expect(bounds.height).toBeLessThanOrEqual(844)
  await noHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  await workAreas(page).getByRole('button', { name: 'Activity & Audit', exact: true }).click()
  const activityScroller = page.getByRole('dialog', { name: 'Project activity', exact: true }).locator('.pp-table-wrap')
  await expect(activityScroller).toHaveAttribute('tabindex', '0')
  await activityScroller.focus()
  await activityScroller.press('ArrowRight')
  await expect.poll(() => activityScroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
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
  await expect(await scheduleSummary(page)).toContainText('-8 percentage points')
  await expect(page.locator('.pd-project-facts')).toContainText('Sep 15, 2026')
  await expect(page.locator('.pd-project-facts')).not.toContainText('Oct 1, 2026')
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
  await expect(await scheduleSummary(page)).toContainText('-50 percentage points')
  await progressChart(page)
  await expect(region(page, 'Progress performance')).toContainText('v2')
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
  await expect(region(page, 'Performance indicators').getByRole('button', { name: 'Physical progress', exact: true })).toContainText('Working project record')
  await expect(region(page, 'Progress performance')).toContainText('Data date not recorded')
  const cards = region(page, 'Performance indicators')
  await expect(cards.getByRole('button', { name: /Physical progress/ })).toContainText('0%')
  await expect(cards.getByRole('button', { name: /^Schedule/ })).toContainText('Not available')
  await expect(cards.getByRole('button', { name: /^Cost/ })).toContainText('Not available')
  await menuAction(page, 'Reporting source')
  await expect(page.getByRole('dialog')).toContainText('No sealed reporting periods exist')
  await expect(page.getByRole('dialog')).toContainText('Working data dateNot provided')
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Edit working project' })).toBeVisible()
})

test('unavailable reporting history does not disguise working progress as a governed report', async ({ page }) => {
  await harness(page, 'project=17', { failures: ['snapshots'] })
  await loaded(page)
  await expect(region(page, 'Performance indicators').getByRole('button', { name: 'Physical progress', exact: true })).toContainText('Reporting source unavailable')
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
  await expect(page.locator('.pd-status')).toContainText('Status to confirm')
  await expect(page.locator('.pd-status')).not.toContainText('Planning')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: 'Physical progress', exact: true })).toContainText('Progress to confirm')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('Not available')
  await menuAction(page, 'Reporting source')
  await expect(page.getByRole('dialog')).toContainText('Administrative setup values are not reported as actual progress')
  await expect(page.getByRole('dialog')).toContainText('Current working progressNot confirmed')
  await expect(page.getByRole('dialog')).toContainText('Working data dateNot provided')
  await page.keyboard.press('Escape')
  state.records[17].snapshots = structuredClone(snapshots)
  await menuAction(page, 'Refresh project')
  await expect(region(page, 'Progress performance')).toContainText('Sealed reporting period')
  await expect(region(page, 'Performance indicators').getByRole('button', { name: /Physical progress/ })).toContainText('42%')
  await expect(page.locator('.pd-status')).toContainText('Status to confirm')
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
  await expect(region(page, 'Risk & change exposure')).toContainText('Open risks1')
  await expect(region(page, 'Priority actions')).toContainText('1 high or critical')
  await menuAction(page, 'Data quality')
  await expect(page.getByRole('dialog', { name: 'Data quality review' })).toContainText('Risk registerConnected')
  await page.keyboard.press('Escape')
  await expect(page.locator('.pd-health')).toContainText('Needs attention')
  await region(page, 'Risk & change exposure').getByRole('button', { name: 'View risk register' }).click()
  await expect(page).toHaveURL(/view=risk/)
  await expect(page.getByRole('heading', { name: /Residue Yield Improvement Project|Grid Power Integration Project/, exact: true })).toBeVisible()
  await expect(region(page, 'Risk & issue register')).toContainText('Vendor approval delay')
  expect(state.requests.filter(row => row.path.endsWith('/governance/')).every(row => row.path.includes('/101/'))).toBe(true)
  expect(state.unknown).toEqual([])
})

test('connected empty register means zero recorded risks, while failed register remains unavailable', async ({ page }) => {
  const state = await harness(page, 'project=17', { prepare: state => { state.linkedRegister = linkedRegister([]) } })
  await loaded(page)
  await expect(region(page, 'Risk & change exposure')).toContainText('Open risks0')
  await menuAction(page, 'Data quality')
  await expect(page.getByRole('dialog', { name: 'Data quality review' })).toContainText('Risk registerConnected')
  await page.keyboard.press('Escape')
  state.failures.add('governance')
  await menuAction(page, 'Refresh project')
  await expect(region(page, 'Risk & change exposure')).toContainText('Risk register unavailable')
  await expect(region(page, 'Risk & change exposure')).toContainText('Open risksNot available')
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
  await expect(region(page, 'Cost position').locator('dl > div').filter({ has: page.locator('dt', { hasText: /^EAC$|Estimate at completion/ }) })).toContainText(/Not available|—/)
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
  await expect(page.locator('.pd-health')).toContainText('Needs review')
  await expect(region(page, 'Priority actions')).toContainText('1 registered change awaiting decision')
  await expect(region(page, 'Risk & change exposure')).toContainText('Pending changes1')
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
