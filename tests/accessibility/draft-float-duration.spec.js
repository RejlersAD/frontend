import { test, expect } from '@playwright/test'
import { draftFloatHarness } from '../fixtures/draft-float.fixture.js'
import { scheduleWorkspace, scheduleCritical } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const grid = page => scheduleWorkspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const row = (page, id) => grid(page).locator(`[data-row-id="draft-${id}"]`)
const duration = (page, id) => row(page, id).locator('[data-column="duration"]')
const float = (page, id) => row(page, id).locator('[data-column="float"]')
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]); expect(state.writes).toEqual([]) }

test('draft float preserves negative, zero, positive and unknown values while durations use d without asterisks', async ({ page }) => {
  await page.setViewportSize({ width: 1740, height: 950 })
  const state = await draftFloatHarness(page)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(5)
  const before = structuredClone(state.records[17].simplePlan)
  for (const [id, text] of [['negative', '31 d'], ['zero', '28 d'], ['positive', '4.25 d'], ['unknown', 'Not Specified'], ['milestone', '0 d']]) {
    await expect(duration(page, id)).toHaveText(text)
    await expect(duration(page, id)).toHaveAttribute('data-duration-kind', id === 'unknown' ? 'missing_source' : 'proposed')
  }
  await expect(duration(page, 'negative').getByRole('button')).toHaveAttribute('aria-description', 'Unverified template duration. Duration in working days.')
  await expect(grid(page).getByRole('region', { name: 'Schedule sequence legend', exact: true })).toContainText('Proposed durations')
  await expect(grid(page)).not.toContainText('*')
  const columns = grid(page).getByLabel('Scroll activity columns', { exact: true })
  await columns.evaluate(element => { element.scrollLeft = element.scrollWidth; element.dispatchEvent(new Event('scroll')) })
  const header = grid(page).getByRole('columnheader', { name: 'Total Float', exact: true })
  await expect(header).toHaveAttribute('title', /Draft total float.*current calendar, dependencies and project target.*Not verified/)
  for (const [id, text] of [['negative', '-3'], ['zero', '0'], ['positive', '23'], ['unknown', '—'], ['milestone', '0']]) {
    await expect(float(page, id)).toHaveText(text)
    await expect(float(page, id)).toHaveAttribute('data-calculation-basis', 'draft_cpm')
    const pane = await row(page, id).locator('.p6-left-clip').boundingBox()
    const cell = await float(page, id).boundingBox()
    expect(cell.x).toBeGreaterThanOrEqual(pane.x)
    expect(cell.x + cell.width).toBeLessThanOrEqual(pane.x + pane.width + 1)
  }
  await expect(float(page, 'unknown')).toHaveAttribute('title', 'Total float has not been calculated for this row.')
  await scheduleCritical(page, true)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(3)
  for (const id of ['negative', 'zero', 'milestone']) await expect(row(page, id)).toHaveCount(1)
  await expect(row(page, 'positive')).toHaveCount(0)
  await expect(row(page, 'unknown')).toHaveCount(0)
  await scheduleCritical(page, false)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(5)
  await page.screenshot({ path: '../artifacts/draft-float-durations.png', animations: 'disabled' })
  expect(state.records[17].simplePlan).toEqual(before)
  clean(state)
})

test('saved-version float is labelled separately without claiming verified source timing', async ({ page }) => {
  const state = await draftFloatHarness(page, 'saved_version_cpm')
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(5)
  await expect(grid(page).getByRole('columnheader', { name: 'Total Float', exact: true })).toHaveAttribute('title', /calculated saved schedule version.*does not verify the original source schedule/)
  await expect(float(page, 'negative')).toHaveAttribute('data-calculation-basis', 'saved_version_cpm')
  await expect(float(page, 'negative')).toHaveText('-3')
  clean(state)
})
