import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const section = page => page.getByRole('region', { name: 'Activity source evidence', exact: true })
const table = page => section(page).getByRole('table', { name: 'Activity source evidence', exact: true })
const title = index => `Process deliverable ${String(index).padStart(4, '0')}`
const source = (index, extra = {}) => ({
  file_id: 801, filename: 'Original schedule.pdf', locator: { page: Math.ceil(index / 25), row: index },
  excerpt: `Printed activity ${index}: duration 8 calendar days.`, ...extra,
})
const fixture = (count = 1000) => ({
  tasks: Array.from({ length: count }, (_, index) => ({
    id: `activity-${index + 1}`, activity_id: index + 4001, activity_code: `PROC-${String(index + 1).padStart(4, '0')}`,
    title: title(index + 1), duration_days: 8, duration_unit: 'calendar_days', duration_source: 'source_document',
    source_references: [source(index + 1)], duration_evidence: { source_references: [source(index + 1)] },
  })),
  review: { rows: [] }, sourceDocuments: [{ id: 801, name: 'Original schedule.pdf' }],
})

async function mount(page, data = fixture(), viewport) {
  if (viewport) await page.setViewportSize(viewport)
  const state = { errors: [], requests: [] }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(value => { window.__sourceEvidenceFixture = value }, data)
  await page.route('**/api/**', async route => { state.requests.push(route.request().url()); await route.abort() })
  await page.route(url => url.pathname === '/evidence-table-test', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Source evidence component test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="evidence-test"></div><script type="module" src="/tests/fixtures/planning-source-evidence-harness.jsx"></script></body></html>',
  }))
  await page.goto('/evidence-table-test')
  await expect(section(page)).toBeVisible()
  return state
}
const clean = state => { expect(state.errors).toEqual([]); expect(state.requests).toEqual([]) }

test('one thousand activities render 25 compact rows with bounded height and every page remains reachable', async ({ page }) => {
  const state = await mount(page)
  await expect(table(page).getByRole('columnheader')).toHaveText(['Deliverable', 'Source reference', 'Duration evidence'])
  await expect(table(page).getByRole('row')).toHaveCount(26)
  await expect(section(page)).toContainText('1-25 of 1,000')
  await expect(section(page).getByRole('button', { name: 'Previous evidence page', exact: true })).toBeDisabled()
  await expect(section(page).getByRole('button', { name: `Show evidence for ${title(1)}`, exact: true })).toBeVisible()
  expect((await section(page).boundingBox()).height).toBeLessThan(550)
  const scroll = await section(page).getByRole('region', { name: 'Source evidence rows' }).evaluate(element => ({ height: element.clientHeight, scrollHeight: element.scrollHeight }))
  expect(scroll.height).toBeLessThanOrEqual(400)
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.height)

  await section(page).getByRole('combobox', { name: 'Evidence rows per page' }).selectOption('50')
  await expect(table(page).getByRole('row')).toHaveCount(51)
  for (let pageIndex = 1; pageIndex < 20; pageIndex += 1) await section(page).getByRole('button', { name: 'Next evidence page', exact: true }).click()
  await expect(section(page)).toContainText('951-1000 of 1,000')
  await expect(section(page).getByRole('button', { name: `Show evidence for ${title(1000)}`, exact: true })).toHaveCount(1)
  await expect(section(page).getByRole('button', { name: 'Next evidence page', exact: true })).toBeDisabled()
  await section(page).getByRole('button', { name: 'Previous evidence page', exact: true }).click()
  await expect(section(page)).toContainText('901-950 of 1,000')
  await section(page).getByRole('combobox', { name: 'Evidence rows per page' }).selectOption('10')
  await expect(table(page).getByRole('row')).toHaveCount(11)
  await expect(section(page)).toContainText('1-10 of 1,000')
  clean(state)
})

test('search covers off-page source excerpts and resets pagination with truthful empty counts', async ({ page }) => {
  const data = fixture()
  data.tasks[876].source_references[0].excerpt = 'Signed acceptance clause: preserve EVIDENCE-NEEDLE-877 verbatim.'
  const state = await mount(page, data)
  await section(page).getByRole('button', { name: 'Next evidence page', exact: true }).click()
  await section(page).getByRole('searchbox', { name: 'Search source evidence' }).fill('evidence-needle-877')
  await expect(table(page).getByRole('row')).toHaveCount(2)
  await expect(section(page)).toContainText('1-1 of 1 (1,000 total)')
  await section(page).getByRole('button', { name: `Show evidence for ${title(877)}` }).click()
  await expect(section(page).getByRole('region', { name: `Evidence for ${title(877)}`, exact: true })).toContainText('Signed acceptance clause: preserve EVIDENCE-NEEDLE-877 verbatim.')
  await section(page).getByRole('searchbox', { name: 'Search source evidence' }).fill('No such document evidence')
  await expect(table(page)).toContainText('No evidence matches your search.')
  await expect(section(page)).toContainText('0 activities (1,000 total)')
  await expect(section(page).getByRole('button', { name: 'Next evidence page', exact: true })).toBeDisabled()
  await section(page).getByRole('button', { name: 'Clear source evidence search' }).click()
  await expect(table(page).getByRole('row')).toHaveCount(26)
  await expect(section(page)).toContainText('1-25 of 1,000')
  clean(state)
})

test('collapsed rows retain multiple original source excerpts and duration caveats on keyboard expansion', async ({ page }) => {
  const data = fixture(2)
  data.tasks[0].source_references.push(source(12, { filename: 'Signed scope.pdf', excerpt: 'Review acceptance remains subject to the signed scope.\nNo assumption replaces this text.' }))
  data.tasks[0].duration_calendar_verified = false
  data.tasks[0].duration_review_reason = 'Printed duration retained; the source calendar is unavailable.'
  data.tasks[0].duration_evidence.source_references = [source(42, { filename: 'MDR.xlsx', locator: { sheet: 'Activities', row: 42 }, excerpt: 'Original duration: 8 calendar days, as approved.' })]
  data.tasks[1].duration_days = null
  data.tasks[1].duration_source = 'source_requirement'
  data.tasks[1].duration_evidence = { values: { required_review_days: 10 }, source_references: [source(9, { excerpt: 'Client review is required within 10 days.' })] }
  const state = await mount(page, data)
  await expect(section(page).getByRole('region', { name: `Evidence for ${title(1)}`, exact: true })).toHaveCount(0)
  const toggle = section(page).getByRole('button', { name: `Show evidence for ${title(1)}`, exact: true })
  await toggle.focus()
  await page.keyboard.press('Enter')
  const details = section(page).getByRole('region', { name: `Evidence for ${title(1)}`, exact: true })
  await expect(details).toContainText('Review acceptance remains subject to the signed scope.')
  await expect(details).toContainText('No assumption replaces this text.')
  await expect(details).toContainText('Original duration: 8 calendar days, as approved.')
  await expect(details).toContainText('MDR.xlsx · Activities · Row 42')
  await expect(details).toContainText('Source calendar has not been verified.')
  await expect(details).toContainText('Printed duration retained; the source calendar is unavailable.')
  await expect(section(page).getByRole('button', { name: `Hide evidence for ${title(1)}`, exact: true })).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Enter')
  await expect(details).toHaveCount(0)
  await section(page).getByRole('button', { name: `Show evidence for ${title(2)}`, exact: true }).click()
  const requirement = section(page).getByRole('region', { name: `Evidence for ${title(2)}`, exact: true })
  await expect(requirement).toContainText('Required review period: 10 days. Activity duration remains unconfirmed.')
  await expect(requirement).toContainText('Client review is required within 10 days.')
  await expect(table(page).getByRole('row').filter({ has: page.getByRole('button', { name: `Hide evidence for ${title(2)}` }) })).not.toContainText('10 d')
  clean(state)
})

test('an empty source collection shows an explicit empty state and cannot paginate', async ({ page }) => {
  const state = await mount(page, fixture(0))
  await expect(table(page)).toContainText('No document source references.')
  await expect(section(page)).toContainText('0 activities')
  await expect(section(page).getByRole('button', { name: 'Previous evidence page' })).toBeDisabled()
  await expect(section(page).getByRole('button', { name: 'Next evidence page' })).toBeDisabled()
  clean(state)
})

test('duration-only citations retain the printed activity code and missing source durations never display stale values', async ({ page }) => {
  const data = fixture(2)
  data.review = null
  data.tasks[0].source_references = []
  data.tasks[0].duration_evidence.source_references = [source(16, { filename: undefined, excerpt: 'Original duration retained from source row 16.' })]
  data.tasks[1].duration_source = 'missing_source'
  data.tasks[1].duration_days = 99
  const state = await mount(page, data)
  const durationOnly = table(page).getByRole('row').filter({ has: page.getByRole('button', { name: `Show evidence for ${title(1)}`, exact: true }) })
  await expect(durationOnly).toContainText('PROC-0001')
  await expect(durationOnly).not.toContainText('4001')
  await expect(durationOnly).toContainText('Original schedule.pdf')
  await durationOnly.getByRole('button').click()
  await expect(section(page).getByRole('region', { name: `Evidence for ${title(1)}`, exact: true })).toContainText('Original duration retained from source row 16.')
  const missing = table(page).getByRole('row').filter({ has: page.getByRole('button', { name: `Show evidence for ${title(2)}`, exact: true }) })
  await expect(missing).toContainText('Not Specified')
  await expect(missing).not.toContainText('99')
  clean(state)
})

for (const display of [
  { name: 'desktop', viewport: { width: 1672, height: 941 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
  { name: 'dark', viewport: { width: 1672, height: 941 }, dark: true },
]) test(`compact evidence remains accessible and contained on ${display.name}`, async ({ page }) => {
  const state = await mount(page, { ...fixture(), dark: display.dark }, display.viewport)
  await section(page).getByRole('button', { name: `Show evidence for ${title(1)}`, exact: true }).click()
  await expect(section(page).getByRole('region', { name: `Evidence for ${title(1)}`, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const violations = (await new AxeBuilder({ page }).include('.planning-source-evidence').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))
  expect(violations).toEqual([])
  await page.screenshot({ path: `../artifacts/planning-source-evidence-${display.name}.png`, fullPage: true })
  clean(state)
})
