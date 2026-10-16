import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { generationEvidenceHarness, savedEvidenceGeneration } from '../fixtures/generation-evidence-workspace.fixture.js'
import { expectRetainedScheduleVersion } from '../fixtures/retained-schedule-controls.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

const sourceTable = page => page.getByRole('table', { name: 'Activity source evidence', exact: true })
const evidenceRegion = page => page.getByRole('region', { name: 'Activity source evidence', exact: true })
const outerMode = (page, name) => page.getByRole('navigation', { name: 'Schedule workspace', exact: true }).getByRole('button', { name, exact: true })
const documentStep = (page, name) => page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true })
  .getByRole('button', { name: new RegExp(`^\\d+\\. ${name}(?:\\s|$)`) })
const materializeWrites = state => state.writes.filter(row => row.path.endsWith('/materialize/'))

function clean(state, { readOnly = true } = {}) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unexpectedWrites).toEqual([])
  if (readOnly) expect(state.requests.filter(row => !['GET', 'OPTIONS'].includes(row.method))).toEqual([])
}

test('Master Schedule opens all saved source activities, gaps and reloads without materializing a schedule', async ({ page }) => {
  const state = await generationEvidenceHarness(page)
  await expect(outerMode(page, 'Master Schedule')).toHaveAttribute('aria-pressed', 'true')
  await expect(sourceTable(page)).toBeVisible()
  await expect(evidenceRegion(page)).toContainText('78 activities')
  await expect(sourceTable(page).locator('tbody > tr')).toHaveCount(25)
  await expect(sourceTable(page)).toContainText('Saved source activity 025')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const desktopScan = await new AxeBuilder({ page }).include('.generation-evidence-workspace').analyze()
  expect(desktopScan.violations.filter(issue => ['serious', 'critical'].includes(issue.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/generation-evidence-workspace-desktop.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('combobox', { name: 'Evidence rows per page', exact: true }).selectOption('50')
  await page.getByRole('button', { name: 'Next evidence page', exact: true }).click()
  await expect(sourceTable(page).locator('tbody > tr')).toHaveCount(28)
  await expect(sourceTable(page)).toContainText('Saved source activity 078')
  await page.getByRole('button', { name: 'Show evidence for Saved source activity 078', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Evidence for Saved source activity 078', exact: true })).toContainText('Literal register entry 78.')
  await page.getByText('Validation and missing information (2)', { exact: true }).click()
  await expect(page.getByText('Source durations are Not Specified.', { exact: true })).toBeVisible()
  await expect(page.getByText('Two register titles require source boundary review.', { exact: true })).toBeVisible()
  await page.getByText('Register rows awaiting review (2)', { exact: true }).click()
  await expect(page.getByText('Uncertain register title A', { exact: true })).toBeVisible()
  await expect(sourceTable(page)).not.toContainText('Uncertain register title')
  await expect(page.getByRole('button', { name: 'Save activities', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Upgrade Generation v3', exact: true })).toHaveCount(0)
  await page.reload()
  await expect(sourceTable(page)).toBeVisible()
  await expect(evidenceRegion(page)).toContainText('78 activities')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const mobileScan = await new AxeBuilder({ page }).include('.generation-evidence-workspace').analyze()
  expect(mobileScan.violations.filter(issue => ['serious', 'critical'].includes(issue.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/generation-evidence-workspace-mobile.png', fullPage: true, animations: 'disabled' })
  expect(state.requests.filter(row => row.path.endsWith('/generations/1701/') && row.method === 'GET').length).toBeGreaterThanOrEqual(2)
  clean(state)
})

test('a saved activity without source references remains visible with unspecified evidence', async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) {
    current.records[17].generations[0].activities[0].source_references = []
  } })
  await expect(sourceTable(page)).toBeVisible()
  await expect(sourceTable(page)).toContainText('Saved source activity 001')
  await expect(evidenceRegion(page)).toContainText('78 activities')
  const row = sourceTable(page).getByRole('row').filter({ hasText: 'Saved source activity 001' })
  await expect(row).toContainText('Not Specified')
  clean(state)
})

test('saved draft routes to current source review without starting analysis or generation', async ({ page }) => {
  const state = await generationEvidenceHarness(page)
  await expect(sourceTable(page)).toBeVisible()
  await page.getByRole('button', { name: 'Review source evidence', exact: true }).click()
  await expect(outerMode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  clean(state)
})

test('editing the saved draft opens its exact generation even when a newer generation exists', async ({ page }) => {
  const state = await generationEvidenceHarness(page)
  await expect(sourceTable(page)).toBeVisible()
  state.records[17].generations.unshift(savedEvidenceGeneration(state.records[17], { id: 1709, version: 9, count: 1, prefix: 'Unrelated newest source' }))
  await page.getByRole('button', { name: 'Edit draft activities', exact: true }).click()
  await expect(outerMode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: /Activities.*v3.*78 total/ })).toBeVisible()
  await page.getByRole('button', { name: /Edit$/, exact: false }).click()
  await expect(page.locator('input[value="Saved source activity 001"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeVisible()
  await expect(page.getByText('Unrelated newest source 001', { exact: true })).toHaveCount(0)
  clean(state)
})

test('work breakdown action returns to the retained WBS workflow', async ({ page }) => {
  const state = await generationEvidenceHarness(page)
  await expect(sourceTable(page)).toBeVisible()
  await page.getByRole('button', { name: 'Review work breakdown', exact: true }).click()
  await expect(outerMode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(documentStep(page, 'WBS Builder')).toHaveAttribute('aria-current', 'step')
  clean(state)
})

test('a failed draft edit preserves input and saving a blank duration keeps null in an exact new revision', async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) { current.editError = 'Draft revision could not be saved.' } })
  await expect(sourceTable(page)).toBeVisible()
  await page.getByRole('button', { name: 'Edit draft activities', exact: true }).click()
  await page.getByRole('button', { name: /Edit$/, exact: false }).click()
  const name = page.getByRole('textbox', { name: 'Activity source-1701-1 name', exact: true })
  const duration = page.getByRole('spinbutton', { name: 'Activity source-1701-1 duration', exact: true })
  await expect(duration).toHaveValue('')
  await duration.fill('10')
  await duration.fill('')
  await name.fill('Reviewed source activity 001')
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByText('Draft revision could not be saved.', { exact: true })).toBeVisible()
  await expect(name).toHaveValue('Reviewed source activity 001')
  await expect(duration).toHaveValue('')
  state.editError = null
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Activities.*v4.*78 total/ })).toBeVisible()
  const edits = state.writes.filter(row => row.path.endsWith('/generations/1701/edit/'))
  expect(edits).toHaveLength(2)
  expect(edits[1].data.activities[0].original_duration_days).toBeNull()
  expect(state.records[17].generations.find(row => row.id === 1701).activities[0].name).toBe('Saved source activity 001')
  state.records[17].generations.unshift(savedEvidenceGeneration(state.records[17], { id: 1709, version: 9, count: 1, prefix: 'Unrelated newest source' }))
  await page.getByRole('button', { name: 'Open draft workspace', exact: true }).click()
  await expect(sourceTable(page)).toContainText('Reviewed source activity 001')
  await expect(page.getByRole('heading', { name: 'Draft review · Generation v4', exact: true })).toBeVisible()
  await expect(sourceTable(page)).not.toContainText('Unrelated newest source')
  expect(materializeWrites(state)).toEqual([])
  clean(state, { readOnly: false })
})

test('review-required materialization keeps the saved activities and never claims successful upgrade', async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) {
    current.records[17].generations[0].intelligence.schedule_engine.ready_for_calculation = true
  } })
  await expect(sourceTable(page)).toBeVisible()
  await page.getByRole('button', { name: 'Upgrade Generation v3', exact: true }).click()
  await expect(sourceTable(page)).toBeVisible()
  await expect(evidenceRegion(page)).toContainText('78 activities')
  await expect(page.getByText('This generation still needs evidence review. Its saved activities remain available below; no calculated schedule was created.', { exact: true })).toBeVisible()
  await expect(page.getByText(/upgraded to the relational planner workspace|created schedule version/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Schedule settings', exact: true })).toHaveCount(0)
  expect(materializeWrites(state)).toEqual([{ path: '/api/v1/planning-intelligence/generations/1701/materialize/', method: 'POST', generationId: 1701 }])
  clean(state, { readOnly: false })
})

test('a validated legacy upgrade opens the exact returned version rather than a newer version', async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) {
    current.materializeMode = 'success'
    current.records[17].generations[0].intelligence.schedule_engine.ready_for_calculation = true
  } })
  await expect(sourceTable(page)).toBeVisible()
  await page.getByRole('button', { name: 'Upgrade Generation v3', exact: true }).click()
  await expectRetainedScheduleVersion(page, 90)
  await expect(sourceTable(page)).toHaveCount(0)
  expect(materializeWrites(state)).toHaveLength(1)
  clean(state, { readOnly: false })
})

for (const status of [403, 503]) test(`a ${status} generation read exposes an error and retry instead of an empty or successful workspace`, async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) {
    current.generationErrors[1701] = { status, message: status === 403 ? 'You cannot access this saved generation.' : 'The saved generation is temporarily unavailable.' }
  } })
  await expect(page.getByRole('alert')).toContainText(/cannot access|temporarily unavailable/i)
  await expect(sourceTable(page)).toHaveCount(0)
  delete state.generationErrors[1701]
  await page.getByRole('button', { name: /Retry (?:draft|workspace)/ }).click()
  await expect(sourceTable(page)).toBeVisible()
  clean(state)
})

test('a failed generation list is retryable and cannot claim the project has no saved schedule', async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) {
    current.generationListError = 'Saved generation history is temporarily unavailable.'
  } })
  await expect(page.getByRole('alert')).toContainText('Saved generation history is temporarily unavailable.')
  await expect(page.getByRole('heading', { name: 'No schedule has been generated yet', exact: true })).toHaveCount(0)
  await expect(sourceTable(page)).toHaveCount(0)
  state.generationListError = null
  await page.getByRole('button', { name: 'Retry workspace', exact: true }).click()
  await expect(sourceTable(page)).toBeVisible()
  clean(state)
})

test('a delayed generation from a previous project cannot replace the selected project evidence', async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) { current.heldGenerations.add(1701) } })
  await expect.poll(() => state.generationReleases.length).toBeGreaterThan(0)
  const header = page.locator('header.pd-header')
  await header.locator('summary[aria-label="More project actions"]').click()
  await header.getByRole('combobox', { name: 'Active Project', exact: true }).fill('Grid Power')
  await page.getByRole('option', { name: /Grid Power Integration Project/ }).click()
  await expect(sourceTable(page)).toContainText('Grid source activity 001')
  state.heldGenerations.clear()
  state.generationReleases.splice(0).forEach(release => release())
  await expect(evidenceRegion(page)).toContainText('3 activities')
  await expect(sourceTable(page)).not.toContainText('Saved source activity')
  clean(state)
})

test('an out-of-project generation response is rejected without exposing its activities', async ({ page }) => {
  const state = await generationEvidenceHarness(page, { prepare(current) { current.foreignGeneration = true } })
  await expect(page.getByRole('alert')).toContainText(/project|scope|generation/i)
  await expect(sourceTable(page)).toHaveCount(0)
  await expect(page.getByText('Saved source activity 001', { exact: true })).toHaveCount(0)
  clean(state)
})

for (const existingMaster of [false, true]) test(`the wizard opens its exact saved evidence generation with ${existingMaster ? 'an older canonical master' : 'no calculated schedule'}`, async ({ page }) => {
  const state = await generationEvidenceHarness(page, { query: 'project=17&view=plan-baseline&scheduleMode=documents&shell=true',
    prepare(current) {
      current.addNewerGenerationAfterGenerate = true
      current.records[17].hasSchedule = existingMaster
      current.records[17].masterVersionId = existingMaster ? 90 : null
    },
  })
  await documentStep(page, 'Schedule Generator').click()
  await page.getByRole('button', { name: /New generation/ }).click()
  const wizard = page.getByRole('dialog', { name: 'Schedule generation wizard', exact: true })
  for (let step = 0; step < 3; step++) await wizard.getByRole('button', { name: 'Continue →', exact: true }).click()
  await wizard.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(wizard.getByRole('heading', { name: 'Document evidence ready for review', exact: true })).toBeVisible()
  await expect(wizard.getByRole('button', { name: 'Review source evidence', exact: true })).toBeVisible()
  if (existingMaster) state.heldResolver = true
  await wizard.getByRole('button', { name: 'Open draft workspace', exact: true }).click()
  if (existingMaster) {
    await expect.poll(() => state.resolverReleases.length).toBeGreaterThan(0)
    await expect(page.getByText('Loading Master Schedule…', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export schedule', exact: true })).toBeDisabled()
    await expect(page.locator('header.pd-header .pd-report-date')).toContainText('Not set')
    state.heldResolver = false
    state.resolverReleases.splice(0).forEach(release => release())
  }
  await expect(outerMode(page, 'Master Schedule')).toHaveAttribute('aria-pressed', 'true')
  await expect(sourceTable(page)).toContainText('Exact generated evidence 001')
  await expect(evidenceRegion(page)).toContainText('3 activities')
  await expect(sourceTable(page)).not.toContainText('Different newer generation')
  await expect(page.getByRole('button', { name: 'Export schedule', exact: true })).toBeDisabled()
  await expect(page.locator('header.pd-header .pd-report-date')).toContainText('Not set')
  expect(state.requests.some(row => row.path.endsWith('/generations/1702/'))).toBe(true)
  expect(materializeWrites(state)).toEqual([])
  clean(state, { readOnly: false })
})
