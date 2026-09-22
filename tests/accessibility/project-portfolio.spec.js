import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { scheduleHarness } from '../fixtures/schedule-performance.fixture.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

const names = ['Alpha Field Development', 'Bravo Terminal Upgrade', 'Charlie Utilities Study',
  'Delta Offshore Facilities', 'Echo Process Package', 'Foxtrot Pipeline Design', 'Golf Substation Project',
  'Hotel Water Network', 'India Compressor Package', 'Juliet Control System', 'Kilo Civil Works', 'Lima Gas Treatment']
const statuses = ['active', 'planning', 'completed', 'on_hold', 'cancelled', 'active',
  'planning', 'active', 'completed', 'active', 'planning', 'active']
const healthKeys = ['on_track', 'needs_review', 'on_track', 'at_risk', 'unknown', 'on_track',
  'needs_review', 'on_track', 'on_track', 'needs_setup', 'needs_setup', 'on_track']
const region = page => page.getByRole('region', { name: 'Project portfolio', exact: true })
const table = page => region(page).getByRole('table', { name: 'Projects', exact: true })
const bodyRows = page => table(page).locator('tbody tr').filter({ has: page.getByRole('checkbox') })
const search = page => region(page).getByRole('searchbox', { name: 'Search projects', exact: true })
const card = (page, name) => region(page).getByRole('button', { name, exact: true })
const pageSize = page => region(page).getByRole('combobox', { name: 'Projects per page', exact: true })
const popover = async (page, label) => page.locator(`[id="${await region(page).getByRole('button', { name: label, exact: true }).getAttribute('aria-controls')}"]`)
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
}
const listOnly = state => {
  expect(state.requests.filter(request => ![
    '/api/v1/projects/', '/api/v1/project-control/phase-flags/',
  ].includes(request.path))).toEqual([])
}

async function portfolioHarness(page, { empty = false, failed = false, unknown = false, dark = false, updatedAtById = {} } = {}) {
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const state = await scheduleHarness(page, {
    query: 'shell=true',
    prepare(fixture) {
      const template = structuredClone(fixture.records[17])
      fixture.records = {}
      names.forEach((name, index) => {
        const id = index + 17, record = structuredClone(template)
        const missingOwner = [1, 10].includes(index)
        record.project = { ...record.project, id, name, code: `59010${String(index + 1).padStart(2, '0')}`,
          status: statuses[index], owner_id: missingOwner ? null : 7,
          owner: missingOwner ? null : record.project.owner, owner_name: missingOwner ? null : 'Maya Hassan',
          creator_name: index === 4 ? null : 'Omar Saleh',
          client_name: index === 0 ? 'ADNOC Refining' : 'Grid Operations',
          created_at: '2026-01-05T08:00:00Z', updated_at: updatedAtById[id] || `2026-09-${String(index + 1).padStart(2, '0')}T08:00:00Z`,
          portfolio: { baseline: [0, 2, 8].includes(index)
            ? { approved: true, id: 400 + index, start_date: '2026-01-05', finish_date: '2026-12-20' } : null,
          health: { key: healthKeys[index], label: ({ on_track: 'On track', needs_review: 'Needs review', at_risk: 'At risk', needs_setup: 'Needs setup', unknown: 'Unknown' })[healthKeys[index]], reason: 'Recorded project state.' },
          entity: index % 2 === 0 ? 'Abu Dhabi' : 'Dubai', missing_owner: missingOwner },
        }
        if (unknown) {
          delete record.project.portfolio
          record.project.owner = null; record.project.owner_id = null; record.project.owner_name = null
          record.project.creator_name = null
        }
        Object.assign(record.planningProject, { enterprise_project: id, name, client: record.project.client_name })
        fixture.records[id] = record
      })
      Object.assign(fixture, { portfolioEmpty: empty, portfolioFailed: failed })
    },
    async handleRequest({ path, route, state: fixture, reply }) {
      if (path !== '/api/v1/projects/') return false
      if (fixture.portfolioFailed) await reply(route, { detail: 'Portfolio source is unavailable.' }, 503)
      else {
        const results = fixture.portfolioEmpty ? [] : Object.values(fixture.records).map(record => record.project)
        await reply(route, { count: results.length, next: null, previous: null, results })
      }
      return true
    },
  })
  if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
  state.pageErrors = pageErrors
  await expect(region(page).getByRole('heading', { name: 'Project Portfolio', exact: true })).toBeVisible()
  if (!failed && !empty) await expect(bodyRows(page)).toHaveCount(10)
  return state
}

test('bare projects opens the compact portfolio and filters by name, code, client, status, and entity without workspace requests', async ({ page }) => {
  const state = await portfolioHarness(page)
  await expect(card(page, 'Total projects')).toContainText('12')
  await expect(page.locator('.pp-details-workspace')).toHaveCount(0)
  for (const query of ['Alpha Field', '5901001', 'ADNOC Refining']) {
    await search(page).fill(query)
    await expect(bodyRows(page)).toHaveCount(1)
    await expect(bodyRows(page).first()).toContainText(names[0])
  }
  await search(page).fill('no matching portfolio project')
  await expect(bodyRows(page)).toHaveCount(0)
  await expect(region(page)).toContainText(/no matching projects/i)
  await search(page).fill('')
  await region(page).getByRole('combobox', { name: 'Project status', exact: true }).selectOption({ label: 'In progress' })
  await expect(bodyRows(page)).toHaveCount(5)
  await region(page).getByRole('combobox', { name: 'Project entity', exact: true }).selectOption({ label: 'Dubai' })
  await expect(bodyRows(page)).toHaveCount(4)
  listOnly(state); clean(state)
})

test('summary cards filter approved baselines and missing owners using recorded compact fields', async ({ page }) => {
  const state = await portfolioHarness(page)
  await expect(card(page, 'Baseline approved')).toContainText('3')
  await expect(card(page, 'Missing owner')).toContainText('2')
  await card(page, 'Baseline approved').click()
  await expect(bodyRows(page)).toHaveCount(3)
  for (const name of [names[0], names[2], names[8]]) await expect(table(page)).toContainText(name)
  await card(page, 'Missing owner').click()
  await expect(bodyRows(page)).toHaveCount(2)
  for (const name of [names[1], names[10]]) await expect(table(page)).toContainText(name)
  await card(page, 'Total projects').click()
  await expect(bodyRows(page)).toHaveCount(10)
  await card(page, 'Needs review').click()
  await expect(bodyRows(page)).toHaveCount(3)
  await expect(table(page)).toContainText(names[1])
  await expect(table(page)).not.toContainText(names[0])
  listOnly(state); clean(state)
})

test('table sorting, pagination, columns, selection and CSV export work without changing project data', async ({ page }) => {
  const state = await portfolioHarness(page)
  const sort = region(page).getByRole('button', { name: 'Sort by Name', exact: true })
  await sort.click()
  const heading = sort.locator('xpath=ancestor::th')
  if (await heading.getAttribute('aria-sort') !== 'ascending') await sort.click()
  await expect(bodyRows(page).first()).toContainText(names[0])
  await region(page).getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(bodyRows(page)).toHaveCount(2)
  await expect(table(page)).toContainText(names[10])
  await expect(table(page)).toContainText(names[11])
  await expect(region(page).getByRole('button', { name: 'Next page', exact: true })).toBeDisabled()
  await region(page).getByRole('button', { name: 'Previous page', exact: true }).click()
  await pageSize(page).selectOption('25')
  await expect(bodyRows(page)).toHaveCount(12)
  await sort.click()
  await expect(bodyRows(page).first()).toContainText(names[11])
  await region(page).getByRole('button', { name: 'Columns', exact: true }).click()
  const updated = (await popover(page, 'Columns')).getByRole('checkbox', { name: 'Last Updated', exact: true })
  await updated.uncheck()
  await expect(region(page).getByRole('button', { name: 'Sort by Updated', exact: true })).toHaveCount(0)
  await updated.check()
  await region(page).getByRole('button', { name: 'Columns', exact: true }).click()
  await region(page).getByRole('checkbox', { name: `Select ${names[0]}`, exact: true }).check()
  const downloadPromise = page.waitForEvent('download')
  await region(page).getByRole('button', { name: 'Export selected', exact: true }).click()
  const selectedCsv = await readFile(await (await downloadPromise).path(), 'utf8')
  expect(selectedCsv).toContain(names[0])
  expect(selectedCsv).not.toContain(names[1])
  await region(page).getByRole('button', { name: 'Clear selection', exact: true }).click()
  await expect(region(page).getByRole('checkbox', { name: `Select ${names[0]}`, exact: true })).not.toBeChecked()
  const allDownload = page.waitForEvent('download')
  await region(page).getByRole('button', { name: 'Export projects', exact: true }).click()
  const allCsv = await readFile(await (await allDownload).path(), 'utf8')
  for (const name of names) expect(allCsv).toContain(name)
  listOnly(state); clean(state)
})

test('a project row opens its Overview and browser back returns to the portfolio', async ({ page }) => {
  const state = await portfolioHarness(page)
  await search(page).fill('Alpha')
  await region(page).getByRole('button', { name: `Open ${names[0]}`, exact: true }).click()
  await expect(page).toHaveURL(/project=17/)
  await expect(page.getByRole('heading', { name: names[0], exact: true })).toBeVisible()
  await expect(region(page)).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get('view')).not.toBe('plan-baseline')
  await page.goBack()
  await expect(region(page).getByRole('heading', { name: 'Project Portfolio', exact: true })).toBeVisible()
  expect(new URL(page.url()).searchParams.has('project')).toBe(false)
  await page.goto('/projects')
  await expect(region(page)).toBeVisible()
  await page.goto('/projects?view=project-dashboard')
  await expect(page.getByRole('heading', { name: names[0], exact: true })).toBeVisible()
  await expect(region(page)).toHaveCount(0)
  clean(state)
})

test('direct project navigation hydrates detailed fields after a delayed compact project list', async ({ page }) => {
  const pageErrors = [], completedRequests = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const state = await scheduleHarness(page, {
    query: 'project=17&view=project-dashboard&shell=true',
    async handleRequest({ path, route, state: fixture, reply }) {
      if (path === '/api/v1/projects/') {
        await new Promise(resolve => setTimeout(resolve, 300))
        const compact = Object.values(fixture.records).map(record => ({
          id: record.project.id, name: record.project.name, code: record.project.code,
          status: record.project.status, client_name: 'Compact list client',
        }))
        completedRequests.push('list')
        await reply(route, { count: compact.length, next: null, previous: null, results: compact })
        return true
      }
      if (path === '/api/v1/projects/17/') {
        completedRequests.push('detail')
        await reply(route, { ...fixture.records[17].project, client_name: 'Detailed Hydration Client' })
        return true
      }
      return false
    },
  })
  state.pageErrors = pageErrors
  await expect(page.getByRole('heading', { name: 'Residue Yield Improvement Project', exact: true })).toBeVisible()
  await expect(page.getByText('Client: Detailed Hydration Client', { exact: true })).toBeVisible()
  await expect(region(page)).toHaveCount(0)
  expect(completedRequests.indexOf('list')).toBeLessThan(completedRequests.indexOf('detail'))
  clean(state)
})

test('Last Updated sorting retains time order for projects updated on the same day', async ({ page }) => {
  const state = await portfolioHarness(page, { updatedAtById: {
    17: '2026-09-30T07:30:00Z', 18: '2026-09-30T19:30:00Z',
  } })
  await expect(bodyRows(page).nth(0)).toContainText(names[1])
  await expect(bodyRows(page).nth(1)).toContainText(names[0])
  await pageSize(page).selectOption('25')
  await region(page).getByRole('button', { name: 'Sort by Updated', exact: true }).click()
  await expect(bodyRows(page).nth(10)).toContainText(names[0])
  await expect(bodyRows(page).nth(11)).toContainText(names[1])
  listOnly(state); clean(state)
})

test('advanced health filters, health view, bulk selection and menu actions remain functional', async ({ page }) => {
  const state = await portfolioHarness(page)
  await region(page).getByRole('button', { name: 'Filters', exact: true }).click()
  const health = (await popover(page, 'Filters')).getByRole('combobox', { name: 'Project health', exact: true })
  await health.selectOption('at_risk')
  await health.press('Escape')
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(table(page)).toContainText(names[3])
  await region(page).getByRole('tab', { name: 'Portfolio health', exact: true }).click()
  await expect(region(page).getByRole('tabpanel', { name: 'Portfolio health', exact: true })).toContainText(names[3])
  await region(page).getByRole('tab', { name: 'Table', exact: true }).click()
  await region(page).getByRole('button', { name: 'Clear filters', exact: true }).click()
  const selectPage = region(page).getByRole('checkbox', { name: 'Select all projects on this page', exact: true })
  await selectPage.check()
  await expect(bodyRows(page).getByRole('checkbox', { checked: true })).toHaveCount(10)
  await pageSize(page).selectOption('25')
  await expect(selectPage).toHaveAttribute('aria-checked', 'mixed')
  await selectPage.check()
  await expect(bodyRows(page).getByRole('checkbox', { checked: true })).toHaveCount(12)
  await region(page).getByRole('button', { name: 'Clear selection', exact: true }).click()
  const before = state.requests.filter(request => request.path === '/api/v1/projects/').length
  await region(page).getByRole('button', { name: 'More portfolio actions', exact: true }).click()
  await (await popover(page, 'More portfolio actions')).getByRole('button', { name: 'Refresh projects', exact: true }).click()
  await expect.poll(() => state.requests.filter(request => request.path === '/api/v1/projects/').length).toBeGreaterThan(before)
  await expect(bodyRows(page)).toHaveCount(12)
  await region(page).getByRole('button', { name: `More actions for ${names[11]}`, exact: true }).click()
  const download = page.waitForEvent('download')
  await (await popover(page, `More actions for ${names[11]}`)).getByRole('button', { name: 'Export project', exact: true }).click()
  const csv = await readFile(await (await download).path(), 'utf8')
  expect(csv).toContain(names[11]); expect(csv).not.toContain(names[0])
  listOnly(state); clean(state)
})

test('Create project opens the existing accessible form and cancel does not submit', async ({ page }) => {
  const state = await portfolioHarness(page)
  await region(page).getByRole('button', { name: 'Create project', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: /create project/i })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Create with AI', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  listOnly(state); clean(state)
})

test('empty and unavailable portfolios distinguish recorded zero from unavailable counts', async ({ page }) => {
  const state = await portfolioHarness(page, { empty: true })
  await expect(card(page, 'Total projects')).toContainText('0')
  await expect(region(page)).toContainText(/no projects/i)
  listOnly(state); clean(state)
  state.portfolioFailed = true
  await page.reload()
  await expect(region(page).getByRole('alert')).toBeVisible()
  await expect(card(page, 'Total projects')).not.toContainText('0')
  await expect(bodyRows(page)).toHaveCount(0)
  state.portfolioFailed = false; state.portfolioEmpty = false
  await region(page).getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(card(page, 'Total projects')).toContainText('12')
  await expect(bodyRows(page)).toHaveCount(10)
  listOnly(state); clean(state)
})

test('missing baseline and health evidence remains unknown instead of approved or on track', async ({ page }) => {
  const state = await portfolioHarness(page, { unknown: true })
  await search(page).fill('Echo')
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(/unknown|not recorded|not available|not provided|—/i)
  await expect(bodyRows(page).first()).not.toContainText(/on track|approved/i)
  await expect(card(page, 'Baseline approved')).not.toContainText('12')
  listOnly(state); clean(state)
})

for (const viewport of [
  { name: 'desktop', width: 1672, height: 941, dark: false },
  { name: 'mobile', width: 390, height: 844, dark: false },
  { name: 'dark', width: 1672, height: 941, dark: true },
]) {
  test(`portfolio ${viewport.name} layout has no page overflow or blocking accessibility issues`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const state = await portfolioHarness(page, { dark: viewport.dark })
    await expect(search(page)).toBeVisible()
    if (viewport.dark) {
      await expect(page.locator('html')).toHaveClass(/\bdark\b/)
      const background = await region(page).evaluate(element => getComputedStyle(element).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number))
      expect(background.reduce((sum, channel) => sum + channel, 0) / 3).toBeLessThan(100)
    }
    const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(size.scroll).toBeLessThanOrEqual(size.width + 1)
    const axe = await new AxeBuilder({ page }).include('[aria-label="Project portfolio"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await mkdir('../artifacts/projects-portfolio', { recursive: true })
    await writeFile(`../artifacts/projects-portfolio/axe-${viewport.name}.json`, JSON.stringify(axe.violations, null, 2))
    await page.screenshot({ path: `../artifacts/projects-portfolio/${viewport.name}-${viewport.width}.png` })
    const blocking = axe.violations.filter(issue => ['critical', 'serious'].includes(issue.impact))
      .map(issue => ({ id: issue.id, impact: issue.impact, nodes: issue.nodes.slice(0, 12).map(node => ({ target: node.target, summary: node.failureSummary })) }))
    expect(blocking).toEqual([])
    listOnly(state); clean(state)
  })
}
