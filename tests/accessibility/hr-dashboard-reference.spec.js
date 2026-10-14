import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { hrDashboardHarness, response, denied, workforce, daily } from '../fixtures/hr-dashboard-reference.fixture'

test.setTimeout(60000)
test.use({ serviceWorkers: 'block', viewport: { width: 1778, height: 885 }, timezoneId: 'Asia/Dubai' })
// Keep interception installed while delayed application timers are disposed.
test.afterEach(async ({ page }) => { await page.close() })
const title = page => page.getByRole('heading', { name: 'Workforce Intelligence', exact: true })
const refresh = page => page.getByRole('button', { name: 'Refresh', exact: true })
const card = (page, label) => page.getByRole('button', { name: new RegExp(label, 'i') }).filter({ hasNot: page.getByRole('button') }).first()
const assertIsolation = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(state.externalRequests.filter(request => /openai|amazonaws|wrench|railway/.test(request.url))).toEqual([])
}
async function ready(page, options) {
  const state = await hrDashboardHarness(page, options)
  await expect(title(page)).toBeVisible()
  await expect(refresh(page)).toBeEnabled()
  return state
}

test('desktop dashboard presents the requested hierarchy with source-backed values and intact navigation', async ({ page }, testInfo) => {
  const state = await ready(page)
  for (const heading of ['Workforce outlook', 'HR calendar', 'Attendance pattern', 'People movements', 'Workforce readiness by department', 'Decision queue']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  await expect(card(page, 'Active workforce')).toContainText('267')
  await expect(card(page, 'Available now')).toContainText('175')
  await expect(card(page, 'Attendance coverage')).toContainText('76%')
  await expect(card(page, 'Attendance coverage')).toContainText('202 of 267 active employees')
  await expect(page.getByText('Scheduled / attendance %: unavailable', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add employee', exact: true })).toBeVisible()
  await expect(page.getByText('4. Human Resources', { exact: true })).toBeVisible()
  await expect(page.getByText('4.0 Dashboard', { exact: true })).toBeVisible()
  await expect(page.getByText('September 2026', { exact: true })).toBeVisible()
  const firstCell = page.locator('.hr-wi-table-wrap tbody td').first()
  await expect(firstCell).toHaveCSS('color', 'rgb(34, 59, 135)')
  await expect(page.locator('.hr-wi-table-wrap th').first()).toHaveCSS('color', 'rgb(16, 37, 114)')
  expect(await firstCell.evaluate(element => getComputedStyle(element).fontFamily)).toContain('HR Workforce Roboto')
  await page.screenshot({ path: testInfo.outputPath('hr-dashboard-desktop-1778.png'), fullPage: true })
  await page.getByRole('heading', { name: 'Decision queue', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('hr-dashboard-desktop-lower-panels.png'), fullPage: true })
  assertIsolation(state)
})

test('narrow dashboard preserves readable content and contained table overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await ready(page)
  await expect(title(page)).toBeVisible()
  await expect(card(page, 'Active workforce')).toContainText('267')
  await expect(page.getByRole('button', { name: 'Next month', exact: true })).toBeEnabled()
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('hr-dashboard-mobile-390.png'), fullPage: true })
  await page.getByRole('heading', { name: 'HR calendar', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('hr-dashboard-mobile-calendar.png'), fullPage: true })
  await page.getByRole('heading', { name: 'Decision queue', exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('hr-dashboard-mobile-lower-panels.png'), fullPage: true })
  assertIsolation(state)
})

test('calendar navigation, manual refresh and auto-refresh remain working', async ({ page }) => {
  const state = await ready(page)
  await page.getByRole('button', { name: 'Next month', exact: true }).click()
  await expect(page.getByText('October 2026', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous month', exact: true }).click()
  await expect(page.getByText('September 2026', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Auto-refresh on', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Auto-refresh off', exact: true })).toBeVisible()
  const liveCount = state.counts.live
  await page.clock.fastForward(31000)
  expect(state.counts.live).toBe(liveCount)
  const workforceCount = state.counts.workforce
  await refresh(page).click()
  await expect.poll(() => state.counts.workforce).toBe(workforceCount + 1)
  await expect(refresh(page)).toBeEnabled()
  expect(state.counts.live).toBe(liveCount + 1)
  await expect(page.getByText('September 2026', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Auto-refresh off', exact: true }).click()
  await page.clock.fastForward(31000)
  await expect.poll(() => state.counts.live).toBe(liveCount + 2)
  assertIsolation(state)
})

test('existing active workforce drill-through preserves search and close behavior', async ({ page }) => {
  const state = await ready(page)
  await card(page, 'Active workforce').click()
  await expect(page.getByRole('heading', { name: 'Active Employees', exact: true })).toBeVisible()
  const search = page.getByPlaceholder(/Search by name, email, department/)
  await search.fill('Asha Patel')
  await expect(page.getByText('matching filter', { exact: false })).toContainText('1')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Active Employees', exact: true })).toHaveCount(0)
  await expect(title(page)).toBeVisible()
  assertIsolation(state)
})

test('chart ranges retain missing dates and the reminder has usable paging and dismissal', async ({ page }) => {
  const state = await ready(page)
  const periods = page.getByRole('group', { name: 'Attendance history period' })
  await expect(periods.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const chart = page.getByRole('region', { name: 'Attendance pattern', exact: true })
  await chart.getByText('View chart data', { exact: true }).click()
  await expect(chart.locator('tbody tr')).toHaveCount(7)
  await periods.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(chart.locator('tbody tr')).toHaveCount(1)
  await expect(chart.locator('tbody tr')).toContainText('202')
  await periods.getByRole('button', { name: '30 days', exact: true }).click()
  await expect(chart.locator('tbody tr')).toHaveCount(30)
  await expect(chart.locator('tbody tr').first()).toContainText('Unavailable')
  const notice = page.getByRole('complementary', { name: 'HR actions requiring review' })
  await expect(notice).toContainText('1 of 3')
  await page.getByRole('button', { name: 'Next HR action', exact: true }).click()
  await expect(notice).toContainText('2 of 3')
  await page.getByRole('button', { name: 'Previous HR action', exact: true }).click()
  await expect(notice).toContainText('1 of 3')
  await page.getByRole('button', { name: 'Dismiss HR reminder', exact: true }).click()
  await expect(notice).toHaveCount(0)
  assertIsolation(state)
})

test('export contains the loaded synthetic records without making a mutation request', async ({ page }) => {
  const state = await ready(page)
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloadEvent
  const contents = await readFile(await download.path(), 'utf8')
  expect(contents).toContain('Asha Patel')
  expect(contents).toContain('synthetic1@example.test')
  expect(contents).toContain('"Asha Patel","Project Management","09:15","7.5","Yes","Yes"')
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
  assertIsolation(state)
})

test('loading and workforce denial keep unavailable values explicit and recover on Retry', async ({ page }, testInfo) => {
  let releaseWorkforce
  const suspended = new Promise(resolve => { releaseWorkforce = resolve })
  const state = await hrDashboardHarness(page, { workforce: () => suspended })
  await expect(title(page)).toBeVisible()
  await expect(refresh(page)).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('hr-dashboard-loading.png'), fullPage: true })
  // The real App may mount this route again while its authenticated profile
  // settles. Both initial requests can be pending before either is denied.
  const initialWorkforceReads = state.counts.workforce
  expect(initialWorkforceReads).toBeGreaterThanOrEqual(1)
  releaseWorkforce(denied)
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
  await expect(card(page, 'Active workforce')).toContainText('Unavailable')
  await expect(refresh(page)).toBeEnabled()
  await page.clock.fastForward(10000)
  expect(state.counts.workforce).toBe(initialWorkforceReads)
  state.workforce = response({ count: workforce.length, results: workforce })
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect.poll(() => state.counts.workforce).toBe(initialWorkforceReads + 1)
  await expect(card(page, 'Active workforce')).toContainText('267')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0)
  assertIsolation(state)
})

test('missing attendance evidence never becomes an available count or reassuring chart', async ({ page }, testInfo) => {
  const unavailable = response({ detail: 'Synthetic attendance unavailable.' }, 403)
  const state = await ready(page, { live: unavailable, daily: unavailable, monthly: unavailable })
  await expect(card(page, 'Available now')).toContainText('Unavailable')
  await expect(card(page, 'Attendance coverage')).toContainText('Unavailable')
  await expect(page.getByText(/Attendance data is temporarily unavailable/i)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('hr-dashboard-unavailable.png'), fullPage: true })
  assertIsolation(state)
})

test('observed empty attendance preserves supported zeros while scheduled history stays unavailable', async ({ page }) => {
  const state = await ready(page, {
    live: response({ configured: true, summary: { currently_in: 0, total_seen_today: 0, late_today: 0 }, rows: [] }),
    daily: response({ ...daily, rows: [] }), monthly: response({ configured: true, rows: [] }),
  })
  await expect(card(page, 'Available now')).toContainText('0')
  await expect(card(page, 'Attendance coverage')).toContainText('0%')
  await expect(page.getByText('Scheduled / attendance %: unavailable', { exact: true })).toBeVisible()
  assertIsolation(state)
})

test('successful HTTP responses with an unconfigured attendance source stay unavailable', async ({ page }) => {
  const unconfigured = response({ configured: false, rows: [], summary: { currently_in: 0, total_seen_today: 0 } })
  const state = await ready(page, { live: unconfigured, daily: unconfigured, monthly: unconfigured })
  await expect(card(page, 'Available now')).toContainText('Unavailable')
  await expect(card(page, 'Attendance coverage')).toContainText('Unavailable')
  await expect(page.getByText('Daily history unavailable in the loaded records.', { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Some data unavailable' })).toBeVisible()
  assertIsolation(state)
})
