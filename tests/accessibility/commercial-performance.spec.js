import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { commercialHarness } from '../fixtures/commercial-performance.fixture'

test.setTimeout(60000)

const region = (page, name) => page.getByRole('region', { name, exact: true })
const indicators = page => region(page, 'Commercial indicators')
const indicator = (page, name) => indicators(page).getByRole('article').filter({ has: page.getByText(name, { exact: true }) })
const workAreas = page => page.getByRole('navigation', { name: 'Project work areas', exact: true })

async function loaded(page) {
  await expect(page.getByRole('heading', { name: 'Cost & Commercial Performance', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Management', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(indicators(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
}

async function selectMatching(select, pattern) {
  const option = select.getByRole('option').filter({ hasText: pattern }).first()
  await select.selectOption(await option.evaluate(element => element.value))
}

async function noHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('.project-performance-workspace *')].filter(element => {
      for (let parent = element.parentElement; parent && !['BODY', 'HTML'].includes(parent.tagName); parent = parent.parentElement) {
        if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(parent).overflowX)) return false
      }
      return element.getBoundingClientRect().right > innerWidth + 1
    }).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right) })),
  }))
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function noSeriousAccessibilityViolations(page) {
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
}

test('desktop commercial view shows recorded financial facts, source provenance, and accessible panels', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await commercialHarness(page)
  await loaded(page)
  for (const label of ['Contract value', 'Control budget', 'PO commitments', 'Verified actual', 'Supplier paid', 'Approved & unpaid']) {
    await expect(indicators(page).getByText(label, { exact: true })).toBeVisible()
  }
  await expect(indicator(page, 'Contract value')).toContainText(/12\.5\s*M|12,500,000/)
  await expect(indicator(page, 'Verified actual')).toContainText(/4\.6\s*M|4,600,000/)
  for (const title of ['Cost performance', 'Commercial exceptions', 'WBS commercial position', 'Payment position', 'Recent cost postings', 'Commercial audit trail', 'Commercial data quality']) {
    await expect(region(page, title)).toBeVisible()
  }
  await expect(region(page, 'Cost performance').locator('svg.recharts-surface')).toBeVisible()
  await expect(region(page, 'WBS commercial position')).toContainText('Engineering')
  await expect(region(page, 'Payment position')).toContainText(/invoice|payment|paid/i)
  await expect(region(page, 'Payment position')).toContainText('AED 400,000')
  for (const [label, count] of [['Approved POs', '6'], ['Accepted receipts', '4'], ['Verified invoices', '7'], ['Payment events', '5']]) {
    await expect(region(page, 'Payment position').getByText(label, { exact: true }).locator('..').getByRole('strong')).toHaveText(count)
  }
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/commercial-performance-desktop.png', animations: 'disabled' })
  await noSeriousAccessibilityViolations(page)
  expect(state.unknown).toEqual([])
})

test('reporting periods and chart windows filter history while live financial totals stay current', async ({ page }) => {
  const state = await commercialHarness(page)
  await loaded(page)
  const period = page.getByRole('combobox', { name: 'Reporting period', exact: true })
  await expect(period.getByRole('option', { selected: true })).toHaveText(/All periods/i)
  await selectMatching(period, /August close/i)
  await expect(period.getByRole('option', { selected: true })).toHaveText(/August close/i)
  const cost = region(page, 'Cost performance')
  await cost.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(cost.getByRole('table')).toContainText(/31 Aug|Aug 31/)
  await expect(cost.getByRole('table')).not.toContainText(/15 Sept?|Sep 15/)
  await expect(indicator(page, 'Verified actual')).toContainText(/4\.6\s*M|4,600,000/)
  await expect(page.getByText(/current.*posted|live.*current|current.*totals/i).first()).toBeVisible()
  await selectMatching(period, /All periods/i)
  const range = page.getByRole('combobox', { name: 'Time range', exact: true })
  await selectMatching(range, /Last 3 months/i)
  await expect(cost.getByRole('table')).not.toContainText(/30 Apr|Apr 30/)
  await selectMatching(range, /Last 6 months/i)
  await expect(cost.getByRole('table')).toContainText(/30 Apr|Apr 30/)
  await selectMatching(range, /Full history/i)
  await cost.getByRole('button', { name: 'Chart', exact: true }).click()
  await expect(cost.locator('svg.recharts-surface')).toBeVisible()
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
})

test('commercial search and source filters narrow WBS, postings, and audit records', async ({ page }) => {
  await commercialHarness(page)
  await loaded(page)
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const search = page.getByRole('searchbox', { name: 'Search commercial records', exact: true })
  const source = page.getByRole('combobox', { name: 'Source', exact: true })
  await search.fill('Engineering')
  await expect(region(page, 'WBS commercial position')).toContainText('Engineering')
  await expect(region(page, 'WBS commercial position')).not.toContainText('Procurement')
  await search.fill('')
  await selectMatching(source, /^Finance$/i)
  await expect(region(page, 'Recent cost postings')).toContainText('INV-5900913-019')
  await expect(region(page, 'Recent cost postings')).not.toContainText('PO-5900913-041')
  await expect(region(page, 'Recent cost postings')).not.toContainText('HOURS-ENG-SEP')
  await expect(region(page, 'Commercial audit trail')).toContainText('INV-5900913-019')
  await expect(region(page, 'Commercial audit trail')).not.toContainText('PO-5900913-041')
  await selectMatching(source, /^Procurement$/i)
  await expect(region(page, 'Recent cost postings')).toContainText('PO-5900913-041')
  await expect(region(page, 'Recent cost postings')).not.toContainText('INV-5900913-019')
  await selectMatching(source, /^Project control$/i)
  await expect(region(page, 'Recent cost postings')).toContainText('HOURS-ENG-SEP')
  await selectMatching(source, /^All/i)
  await search.fill('PO-5900913-041')
  await expect(region(page, 'Recent cost postings')).toContainText('PO-5900913-041')
  await expect(region(page, 'Recent cost postings')).not.toContainText('INV-5900913-019')
})

test('WBS, posting, audit, exceptions, and quality dialogs expose detail and restore focus', async ({ page }) => {
  await commercialHarness(page)
  await loaded(page)
  const wbs = region(page, 'WBS commercial position').getByRole('button', { name: /01.*Engineering/ })
  await wbs.click()
  let dialog = page.getByRole('dialog', { name: 'WBS commercial detail', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Engineering')
  await page.keyboard.press('Escape')
  await expect(wbs).toBeFocused()
  const posting = region(page, 'Recent cost postings').getByRole('row').filter({ hasText: 'PO-5900913-041' }).getByRole('button', { name: 'Open', exact: true })
  await posting.click()
  dialog = page.getByRole('dialog', { name: 'Cost posting details', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('PO-5900913-041')
  await expect(dialog).toContainText(/posted/i)
  await page.keyboard.press('Escape')
  await expect(posting).toBeFocused()
  const audit = region(page, 'Commercial audit trail').getByRole('button', { name: /Purchase order approved/ })
  await audit.click()
  dialog = page.getByRole('dialog', { name: 'Commercial audit trail', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('PO-5900913-041')
  await page.keyboard.press('Escape')
  await expect(audit).toBeFocused()
  const exceptions = region(page, 'Commercial exceptions').getByRole('button', { name: /View all/i })
  await exceptions.click()
  await expect(page.getByRole('dialog', { name: 'Commercial exceptions', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(exceptions).toBeFocused()
  const quality = page.getByRole('button', { name: 'Review commercial data', exact: true })
  await quality.click()
  dialog = page.getByRole('dialog', { name: 'Commercial data quality', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(/currency|ledger|snapshot/i)
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await expect(quality).toBeFocused()
  const budgets = region(page, 'Cost performance').getByRole('button', { name: 'Review budgets', exact: true })
  await budgets.click()
  dialog = page.getByRole('dialog', { name: 'Budget allocations', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('BUD-ENG-CHANGE')
  await expect(dialog).toContainText('Draft')
  await expect(dialog).toContainText('Maya Hassan')
  await page.keyboard.press('Escape')
  await expect(budgets).toBeFocused()
})

test('commercial CSV exports all current records with currency despite view filters and performs no writes', async ({ page }) => {
  const state = await commercialHarness(page)
  await loaded(page)
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search commercial records', exact: true }).fill('PO-5900913-041')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export commercial', exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/\.csv$/i)
  const contents = await readFile(await download.path(), 'utf8')
  expect(contents).toContain('5900913')
  expect(contents).toContain('AED')
  expect(contents).toContain('PO-5900913-041')
  expect(contents).toContain('BUD-ENG-2026')
  expect(contents).toContain('INV-5900913-007')
  expect(contents).toContain('Engineering')
  expect(contents).toMatch(/12500000|12,500,000/)
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
})

test('Refresh and project selection reload commercial sources while preserving the active work area', async ({ page }) => {
  const state = await commercialHarness(page)
  await loaded(page)
  const before = state.requests.length
  state.records[17].commercial.actual = '4900000.00'
  state.records[17].project.client_name = 'Updated Refining Client'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(indicator(page, 'Verified actual')).toContainText(/4\.9\s*M|4,900,000/)
  await expect(page.getByText('Client: Updated Refining Client', { exact: true })).toBeVisible()
  await expect.poll(() => state.requests.slice(before).some(request => request.path.endsWith('/cost-ledger/'))).toBe(true)
  const selector = page.getByRole('combobox', { name: 'Active Project', exact: true })
  await selector.fill('5900738')
  await selector.press('Enter')
  await expect(page).toHaveURL(/project=18/)
  await expect(page).toHaveURL(/view=commercial-dashboard/)
  await expect(indicator(page, 'Contract value')).toContainText(/8\.5\s*M|8,500,000/)
  await expect.poll(() => state.requests.some(request => request.path.endsWith('/cost-ledger/') && request.project === 18)).toBe(true)
  expect(state.unknown).toEqual([])
})

test('Management and Controls retain existing WBS budgeting and Finance sync entry points without mutating data', async ({ page }) => {
  const state = await commercialHarness(page)
  await loaded(page)
  await page.getByRole('button', { name: 'Controls', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Controls', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'WBS Cost Control', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sync from Finance', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'WBS Budget', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Management', exact: true }).click()
  await loaded(page)
  await page.getByRole('button', { name: 'Update commercial', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'WBS Cost Control', exact: true })).toBeVisible()
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Project Performance', exact: true })).toBeVisible()
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(state.unknown).toEqual([])
})

test('unavailable commercial and sealed history services remain distinct from recorded zero and empty history', async ({ page }) => {
  const state = await commercialHarness(page)
  await loaded(page)
  state.failures.add('commercial')
  state.failures.add('snapshots')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(indicator(page, 'Verified actual')).toContainText(/Unavailable|Not available/i)
  await expect(region(page, 'Cost performance')).toContainText(/unavailable|could not be loaded/i)
  state.failures.clear()
  for (const key of ['contract_value', 'budget', 'committed', 'actual', 'paid', 'unpaid_actual', 'remaining_budget', 'outstanding_commitment', 'current_margin']) state.records[17].commercial[key] = '0.00'
  state.records[17].commercial.wbs = []
  state.records[17].commercial.recent_events = []
  state.records[17].ledger = []
  state.records[17].snapshots = []
  state.records[17].budgets = []
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(indicator(page, 'Verified actual')).toContainText(/0/)
  await expect(indicator(page, 'Verified actual')).not.toContainText(/Unavailable|Not available/i)
  await expect(region(page, 'Cost performance')).toContainText(/No.*snapshot|No.*history|No.*record/i)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('foreign currency postings remain explicit and are excluded from project-currency WBS totals', async ({ page }) => {
  const state = await commercialHarness(page, { prepare: current => {
    current.records[17].ledger.unshift({ ...current.records[17].ledger[1], id: 899, entry_key: 'foreign-invoice', amount: '999999.00', currency: 'USD', source_reference: 'INV-USD-REVIEW', entry_date: '2026-09-15' })
  } })
  await loaded(page)
  const wbs = region(page, 'WBS commercial position').getByRole('row').filter({ hasText: 'Procurement' })
  await expect(wbs).toContainText(/2\.9\s*M|2,900,000/)
  await expect(wbs).not.toContainText(/3,899,999/)
  await expect(region(page, 'Recent cost postings')).toContainText('INV-USD-REVIEW')
  await expect(region(page, 'Recent cost postings')).toContainText('USD')
  await expect(region(page, 'Commercial data quality')).toContainText(/review|exception|mixed/i)
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export commercial', exact: true }).click()
  const contents = await readFile(await (await pending).path(), 'utf8')
  expect(contents).toContain('INV-USD-REVIEW')
  expect(contents).toContain('USD')
  state.records[17].commercial.currency = 'USD'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(indicator(page, 'Verified actual')).toContainText('USD')
  await expect(region(page, 'Payment position')).toContainText('USD 3,000,000')
  await expect(region(page, 'WBS commercial position')).toContainText('AED 2,900,000')
  const foreignSummaryDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export commercial', exact: true }).click()
  const foreignSummaryContents = await readFile(await (await foreignSummaryDownload).path(), 'utf8')
  expect(foreignSummaryContents).toContain('"Current summary","5900913","USD"')
  expect(foreignSummaryContents).toContain('"WBS position","5900913","AED"')
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
})

test('mobile commercial view and native dialogs fit the viewport and support accessible local scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await commercialHarness(page)
  await loaded(page)
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/commercial-performance-mobile.png', animations: 'disabled' })
  await page.screenshot({ path: '../artifacts/commercial-performance-mobile-full.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Review commercial data', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Commercial data quality', exact: true })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  expect(bounds.height).toBeLessThanOrEqual(844)
  await noHorizontalOverflow(page)
  await page.keyboard.press('Escape')
  await noSeriousAccessibilityViolations(page)
})


test('legacy period costs remain identifiable without presenting invalid cumulative cost performance', async ({ page }) => {
  const state = await commercialHarness(page, { prepare: state => {
    state.records[17].snapshots.at(-1).actual_cost_basis = 'legacy_period'
  } })
  await loaded(page)
  const chart = region(page, 'Cost performance')
  await expect(chart).toContainText('Legacy period cost basis')
  await expect(chart.locator('dl').getByText('0.91', { exact: true })).toHaveCount(0)
  await chart.getByRole('button', { name: 'Table', exact: true }).click()
  await expect(chart).toContainText('Legacy period amount')
  expect(state.unknown).toEqual([])
})
