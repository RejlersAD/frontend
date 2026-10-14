import { test, expect } from '@playwright/test'
import { safetyHarness, qualityProject, safetyProjectsPath, safetyToken } from '../fixtures/qhse-safety.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const qualityLabels = ['Open corrective actions', 'Closed corrective actions', 'Open observations', 'Closed observations']
const card = (page, label) => page.getByRole('group', { name: label, exact: true }).first()
const projectCalls = state => state.requests.filter(call => call.path === safetyProjectsPath)

async function loaded(page) {
  await expect(page.getByRole('heading', { name: 'Occupational Health & Safety', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible()
}

async function assertUnavailableSafety(page) {
  for (const label of ['Incident Rate', 'Open Incidents', 'Days Without Incident']) {
    await expect(card(page, label).getByText('Unavailable', { exact: true })).toBeVisible()
  }
  const main = page.getByRole('main')
  await expect(main).not.toContainText('Live data from PostgreSQL Database')
  await expect(main.getByText('Safety Score', { exact: true }).first().locator('..')).toContainText('Unavailable')
  await expect(main.getByText('Unavailable', { exact: true }).first()).toBeVisible()
  await expect(main.locator('.recharts-surface, circle[stroke-dashoffset]')).toHaveCount(0)
  await expect(main.getByText(/^(Excellent|Good|Fair|Poor|Critical|Safe|Low Risk)$/)).toHaveCount(0)
  await expect(main.getByText(/No (high-risk projects identified|projects require investigation)/)).toHaveCount(0)
  await expect(main).not.toContainText(/\d+(?:\.\d+)?%|\d+\s+near misses|\d+\s+days incident-free|\d+\s+incidents\b/i)
}

async function assertUnavailableLabelsFit(page) {
  const splitLabels = await page.getByRole('main').getByText('Unavailable', { exact: true }).evaluateAll(elements => elements
    .map(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return { text: element.textContent, lines: range.getClientRects().length }
    }).filter(label => label.lines > 1))
  expect(splitLabels, 'Unavailable should remain readable without splitting the word across lines').toEqual([])
}

function assertIsolatedReads(state, originalProjects) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(projectCalls(state).length).toBeGreaterThan(0)
  for (const request of projectCalls(state)) {
    expect(request.method).toBe('GET')
    expect(request.body).toBeNull()
    expect(request.authorization).toBe(`Bearer ${safetyToken}`)
  }
  expect(state.requests.filter(call => call.path.includes('/qhse/') && call.method !== 'GET')).toEqual([])
  expect(state.projects).toEqual(originalProjects)
}

test('quality-only records retain correctly labeled counts and cannot become safety evidence in any view', async ({ page }, testInfo) => {
  const projects = [
    qualityProject(),
    qualityProject({ id: 9303, projectNo: 'SYNTHETIC-QHSE-02', carsOpen: '3', carsClosed: '6', obsOpen: '7', obsClosed: '8' }),
  ]
  const state = await safetyHarness(page, { projects })
  await loaded(page)
  await expect(page.getByRole('heading', { name: 'Recorded quality counts', exact: true })).toBeVisible()
  for (const [index, value] of [5, 10, 12, 14].entries()) {
    await expect(card(page, qualityLabels[index]).getByText(String(value), { exact: true })).toBeVisible()
  }
  await assertUnavailableSafety(page)
  for (const title of ['Monthly Safety Trend', 'Safety Compliance Checklist']) {
    await expect(page.getByRole('region', { name: title, exact: true }).getByText('Unavailable', { exact: true })).toBeVisible()
  }
  await page.screenshot({ path: testInfo.outputPath('overview-desktop.png'), fullPage: true })
  await page.getByRole('region', { name: 'Recorded quality counts', exact: true }).screenshot({ path: testInfo.outputPath('quality-counts-desktop.png') })
  await page.getByRole('region', { name: 'Monthly Safety Trend', exact: true }).screenshot({ path: testInfo.outputPath('monthly-trend-unavailable.png') })
  for (const [tab, heading] of [
    ['Incidents', 'Incident Trend Analysis'],
    ['Risk Assessment', 'Risk Mitigation Checklist'],
    ['Performance', 'Safety KPI Distribution'],
  ]) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: heading, exact: true }).getByText('Unavailable', { exact: true })).toBeVisible()
    await assertUnavailableSafety(page)
  }
  await expect(page.getByRole('heading', { name: 'Safety Score Trend', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Safety Score Trend', exact: true }).getByText('Unavailable', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('performance-desktop.png'), fullPage: true })
  await page.getByRole('region', { name: 'Safety KPI Distribution', exact: true }).screenshot({ path: testInfo.outputPath('kpi-distribution-unavailable.png') })
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(card(page, 'Open corrective actions').getByText('5', { exact: true })).toBeVisible()
  assertIsolatedReads(state, projects)
})

test('explicit zero quality counts remain zero without implying zero incidents or a perfect score', async ({ page }) => {
  const projects = [qualityProject({ carsOpen: 0, carsClosed: '0', obsOpen: 0, obsClosed: '0' })]
  const state = await safetyHarness(page, { projects })
  await loaded(page)
  for (const label of qualityLabels) {
    await expect(card(page, label).getByText('0', { exact: true })).toBeVisible()
    await expect(card(page, label).getByText('Unavailable', { exact: true })).toHaveCount(0)
  }
  await assertUnavailableSafety(page)
  await page.getByRole('button', { name: 'Performance', exact: true }).click()
  await assertUnavailableSafety(page)
  assertIsolatedReads(state, projects)
})

test('missing quality counters survive the fetch hook as unavailable', async ({ page }) => {
  const project = qualityProject()
  for (const field of ['carsOpen', 'carsClosed', 'obsOpen', 'obsClosed']) delete project[field]
  const projects = [project]
  const state = await safetyHarness(page, { projects })
  await loaded(page)
  for (const label of qualityLabels) {
    await expect(card(page, label).getByText('Unavailable', { exact: true })).toBeVisible()
    await expect(card(page, label).getByText('0', { exact: true })).toHaveCount(0)
  }
  await assertUnavailableSafety(page)
  assertIsolatedReads(state, projects)
})

test('partial and invalid quality coverage withholds affected totals while preserving complete zeros', async ({ page }) => {
  const projects = [
    qualityProject({ carsOpen: 5, carsClosed: 0, obsOpen: 9, obsClosed: '0' }),
    qualityProject({ id: 9304, carsOpen: undefined, carsClosed: 0, obsOpen: -1, obsClosed: 0 }),
  ]
  const state = await safetyHarness(page, { projects })
  await loaded(page)
  for (const label of ['Open corrective actions', 'Open observations']) {
    await expect(card(page, label).getByText('Unavailable', { exact: true })).toBeVisible()
    await expect(card(page, label)).toContainText(/1\s*(?:of|\/)\s*2/)
  }
  for (const label of ['Closed corrective actions', 'Closed observations']) {
    await expect(card(page, label).getByText('0', { exact: true })).toBeVisible()
  }
  await assertUnavailableSafety(page)
  assertIsolatedReads(state, projects)
})

test('an empty project response explains unavailability instead of claiming a safe portfolio', async ({ page }) => {
  const state = await safetyHarness(page, { projects: [] })
  await expect(page.getByRole('heading', { name: 'Occupational Health & Safety', exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByText('Unavailable', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('main')).toContainText(/no .*records|no .*projects|no .*data/i)
  await expect(page.getByRole('main')).not.toContainText('Live data from PostgreSQL Database')
  await expect(page.getByRole('main')).not.toContainText(/100%|0%|\d+\s+near misses|\d+\s+days incident-free|\d+\s+incidents\b|adding projects/i)
  await expect(page.getByRole('main').locator('.recharts-surface, circle[stroke-dashoffset]')).toHaveCount(0)
  assertIsolatedReads(state, [])
})

test('fetch failure stays an error until explicit retry supplies quality records', async ({ page }) => {
  const projects = [qualityProject()]
  const state = await safetyHarness(page, {
    projects, response: { status: 500, body: { detail: 'Synthetic quality source unavailable.' } },
  })
  await expect(page.getByRole('heading', { name: 'Failed to Load Data', exact: true })).toBeVisible()
  await expect(page.getByText('Error: Server error: Synthetic quality source unavailable.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recorded quality counts', exact: true })).toHaveCount(0)
  await expect(page.getByRole('main')).not.toContainText('Live data from PostgreSQL Database')
  await expect(page.getByRole('main').getByText(/^(Excellent|100%|0%)$/)).toHaveCount(0)
  state.response = null
  await page.getByRole('button', { name: 'Try Again', exact: true }).click()
  await loaded(page)
  await expect(card(page, 'Open corrective actions').getByText('2', { exact: true })).toBeVisible()
  await assertUnavailableSafety(page)
  expect(projectCalls(state).length).toBeGreaterThanOrEqual(2)
  assertIsolatedReads(state, projects)
})

test('loading does not flash fabricated measures before the source arrives', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const projects = [qualityProject()]
  const state = await safetyHarness(page, { projects, beforeProjectsResponse: () => pending })
  await expect(page.getByText('Loading occupational health and safety data...', { exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Incident Rate', exact: true })).toHaveCount(0)
  await expect(page.getByRole('main')).not.toContainText('Live data from PostgreSQL Database')
  release()
  await loaded(page)
  await assertUnavailableSafety(page)
  assertIsolatedReads(state, projects)
})

test('unavailable metrics and their explanations remain readable on a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const projects = [qualityProject({ carsOpen: 0, carsClosed: 0, obsOpen: 0, obsClosed: 0 })]
  const state = await safetyHarness(page, { projects })
  await loaded(page)
  await assertUnavailableSafety(page)
  await card(page, 'Incident Rate').scrollIntoViewIfNeeded()
  await card(page, 'Incident Rate').screenshot({ path: testInfo.outputPath('unavailable-card-mobile.png') })
  await page.getByRole('button', { name: 'Performance', exact: true }).click()
  await assertUnavailableSafety(page)
  await assertUnavailableLabelsFit(page)
  await page.screenshot({ path: testInfo.outputPath('performance-mobile.png'), fullPage: true })
  await page.getByRole('main').locator('div.relative.overflow-hidden.rounded-2xl').screenshot({ path: testInfo.outputPath('performance-summary-mobile.png') })
  assertIsolatedReads(state, projects)
})

test('unavailable card content fits at 1100px with the sidebar expanded', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 900 })
  const projects = [qualityProject()]
  const state = await safetyHarness(page, { projects, sidebarCollapsed: false })
  await loaded(page)
  await assertUnavailableSafety(page)
  for (const label of ['Incident Rate', 'Open Incidents', 'Days Without Incident']) {
    const overflow = await card(page, label).locator('p').evaluateAll(elements => elements
      .filter(element => element.scrollWidth > element.clientWidth + 1)
      .map(element => ({ text: element.textContent, width: element.clientWidth, contentWidth: element.scrollWidth })))
    expect(overflow, `${label} text must fit its card`).toEqual([])
  }
  const score = page.getByRole('main').getByText('Safety Score', { exact: true }).first().locator('..')
  const scoreOverflow = await score.evaluate(element => element.scrollWidth > element.clientWidth + 1)
  expect(scoreOverflow, 'The unavailable score must fit its card').toBe(false)
  await page.screenshot({ path: testInfo.outputPath('overview-1100-expanded-sidebar.png'), fullPage: true })
  await page.getByRole('button', { name: 'Performance', exact: true }).click()
  await assertUnavailableSafety(page)
  await assertUnavailableLabelsFit(page)
  await page.screenshot({ path: testInfo.outputPath('performance-1100-expanded-sidebar.png'), fullPage: true })
  await page.getByRole('main').locator('div.relative.overflow-hidden.rounded-2xl').screenshot({ path: testInfo.outputPath('performance-summary-1100.png') })
  assertIsolatedReads(state, projects)
})
