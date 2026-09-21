import { test, expect } from '@playwright/test'
import { primaveraScheduleHarness } from '../fixtures/primavera-schedule.fixture.js'
import { closeScheduleMenu, scheduleMenu, timelineScale } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const DAY = 86400000
const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const grid = page => workspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const row = (page, id) => grid(page).locator(`[data-row-id="${id}"]`)
const dateReferences = [{ file_id: 904, filename: 'Approved execution schedule.csv', locator: { row: 12 }, excerpt: 'A-10, Design basis, 2026-09-23, 2026-10-02' }]
const explicitDates = (start, finish) => ({
  source_start_date: start, source_finish_date: finish,
  source_start_status: start ? 'extracted' : 'not_specified',
  source_finish_status: finish ? 'extracted' : 'not_specified',
  source_date_status: start && finish ? 'extracted' : start || finish ? 'partial' : 'not_specified',
  source_date_references: dateReferences,
})
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.writes).toEqual([])
}

async function sourceHarness(page, prepare) {
  await page.setViewportSize({ width: 1740, height: 900 })
  return primaveraScheduleHarness(page, { prepare(state) {
    for (const record of Object.values(state.records)) {
      const plan = record.simplePlan
      Object.assign(plan, { evidence_policy: 'document_driven', duration_policy: 'source_only', calculation_available: false })
      for (const task of plan.tasks) Object.assign(task, {
        duration_days: null, duration_source: 'missing_source', duration_calendar_verified: false,
        planned_start_date: null, planned_finish_date: null, due_date: null,
        total_float_days: null, is_critical: null, calculated: false,
        is_milestone: false, activity_type: 'task', ...explicitDates(null, null),
      })
      plan.project_summary = { duration_days: null, planned_start_date: null, planned_finish_date: null, total_float_days: null, complete: false }
      for (const node of plan.wbs_nodes) node.summary = { ...plan.project_summary }
      prepare?.(plan)
    }
  } })
}

test('explicit source dates remain visible with an unknown duration without inventing float or a calculation', async ({ page }) => {
  const state = await sourceHarness(page, plan => {
    Object.assign(plan.tasks[0], explicitDates('2026-09-23', '2026-10-02'), {
      // Legacy calculations must not override the approved source date pair.
      planned_start_date: '2026-09-21', planned_finish_date: '2026-09-25',
      total_float_days: 143, is_critical: true,
    })
  })
  const task = state.records[17].simplePlan.tasks[0]
  const activity = row(page, task.id)
  await expect(activity.locator('[data-column="duration"]')).toHaveText('Not Specified')
  await expect(activity.locator('[data-column="start"]')).toHaveText('23-Sept-26')
  await expect(activity.locator('[data-column="finish"]')).toHaveText('02-Oct-26')
  await expect(activity.locator('[data-column="float"]')).toHaveText('Not calculated')
  await expect(activity.locator('.p6-activity-bar')).toHaveCount(1)
  await expect(activity.locator('.p6-activity-bar')).toHaveAttribute('title', /Source dates/i)
  await expect(activity.locator('.p6-activity-bar')).not.toHaveClass(/is-critical/)
  await expect(grid(page).getByRole('region', { name: 'Schedule sequence legend', exact: true })).not.toContainText('Critical path')
  await expect(workspace(page).locator('.sc-footer [title="Critical path has not been calculated"]')).toHaveText('\u2014 critical')
  const filters = await scheduleMenu(page, 'Schedule filters')
  await expect(filters.getByRole('checkbox', { name: 'Critical only', exact: true })).toBeDisabled()
  await closeScheduleMenu(page, 'Schedule filters')
  await workspace(page).getByRole('button', { name: task.title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details', exact: true })
  await expect(details).toContainText('Source dates')
  await expect(details).toContainText('Approved execution schedule.csv')
  await expect(details).toContainText('Row 12')
  await expect(details).toContainText('Not calculated')
  clean(state)
})

test('missing timing distinguishes not calculated from not specified and never supplies a partial endpoint', async ({ page }) => {
  const state = await sourceHarness(page, plan => {
    Object.assign(plan.tasks[0], { duration_days: 8, duration_source: 'source_document' })
    Object.assign(plan.tasks[2], explicitDates('2026-09-23', null))
  })
  const [knownDuration, missing, partial] = state.records[17].simplePlan.tasks
  for (const column of ['start', 'finish']) {
    await expect(row(page, knownDuration.id).locator(`[data-column="${column}"]`)).toHaveText('Not calculated')
    await expect(row(page, missing.id).locator(`[data-column="${column}"]`)).toHaveText('Not Specified')
  }
  await expect(row(page, partial.id).locator('[data-column="start"]')).toHaveText('23-Sept-26')
  await expect(row(page, partial.id).locator('[data-column="finish"]')).toHaveText('Not Specified')
  for (const task of [knownDuration, missing, partial]) await expect(row(page, task.id).locator('.p6-activity-bar, .p6-milestone')).toHaveCount(0)
  clean(state)
})

test('ambiguous and invalid source dates do not become activity bars or milestones', async ({ page }) => {
  const state = await sourceHarness(page, plan => {
    Object.assign(plan.tasks[0], explicitDates(null, null), { source_date_status: 'ambiguous', source_start_status: 'ambiguous', source_finish_status: 'ambiguous' })
    Object.assign(plan.tasks[1], explicitDates('2026-10-02', '2026-09-23'), { source_date_status: 'invalid', source_start_status: 'invalid', source_finish_status: 'invalid' })
  })
  for (const task of state.records[17].simplePlan.tasks.slice(0, 2)) {
    await expect(row(page, task.id).locator('.p6-activity-bar, .p6-milestone')).toHaveCount(0)
    await expect(row(page, task.id).locator('[data-column="float"]')).toHaveText('Not calculated')
  }
  clean(state)
})

test('source package dates are retained when child timing is missing without calculating a package duration', async ({ page }) => {
  const state = await sourceHarness(page, plan => {
    const node = plan.wbs_nodes.find(item => item.id === 1111)
    Object.assign(node.summary, explicitDates('2026-09-23', '2026-10-02'))
  })
  const group = row(page, 1111)
  await expect(group.locator('[data-column="start"]')).toHaveText('23-Sept-26')
  await expect(group.locator('[data-column="finish"]')).toHaveText('02-Oct-26')
  await expect(group.locator('[data-column="duration"]')).toHaveText('\u2014')
  await expect(group.locator('[data-column="float"]')).toHaveText('Not calculated')
  await expect(group.locator('.p6-summary-bar')).toHaveCount(1)
  for (const task of state.records[17].simplePlan.tasks.slice(0, 2)) await expect(row(page, task.id).locator('.p6-activity-bar')).toHaveCount(0)
  clean(state)
})

test('source date bars and explicit relationship endpoints share the calendar scale through zoom and fit', async ({ page }) => {
  const state = await sourceHarness(page, plan => {
    const [first, second] = plan.tasks
    Object.assign(first, explicitDates('2026-09-23', '2026-10-02'))
    Object.assign(second, explicitDates('2026-10-05', '2026-10-09'), {
      depends_on: [first.id], dependency_details: [{ task_id: first.id, type: 'FS', lag_days: 0 }],
      dependency_rationales: { [first.id]: { source: 'source_document', relationship_type: 'FS', lag_days: 0, source_references: dateReferences } },
    })
  })
  const [first, second] = state.records[17].simplePlan.tasks
  async function aligned() {
    const measure = await grid(page).evaluate(element => {
      const scale = element.querySelector('.p6-timescale')
      const ticks = [...scale.querySelectorAll('.p6-tick')].slice(0, 2)
      const bars = [...element.querySelectorAll('[data-row-kind="task"] .p6-activity-bar')].map(bar => ({ id: bar.closest('[data-row-id]').dataset.rowId, left: parseFloat(bar.style.left), width: parseFloat(bar.style.width) }))
      const link = element.querySelector('.p6-dependency-link')
      return { start: scale.dataset.startDate, pixelsPerDay: (parseFloat(ticks[1].style.left) - parseFloat(ticks[0].style.left)) / 7,
        bars, sourceX: Number(link?.dataset.sourceX), targetX: Number(link?.dataset.targetX) }
    })
    expect(measure.bars).toHaveLength(2)
    for (const task of [first, second]) {
      const bar = measure.bars.find(item => item.id === task.id)
      const left = (Date.parse(task.source_start_date) - Date.parse(measure.start)) / DAY * measure.pixelsPerDay
      const width = ((Date.parse(task.source_finish_date) - Date.parse(task.source_start_date)) / DAY + 1) * measure.pixelsPerDay
      expect(Math.abs(bar.left - left)).toBeLessThan(1)
      expect(Math.abs(bar.width - Math.max(2, width))).toBeLessThan(1)
    }
    const from = measure.bars.find(item => item.id === first.id)
    const to = measure.bars.find(item => item.id === second.id)
    expect(Math.abs(measure.sourceX - (from.left + from.width))).toBeLessThan(1)
    expect(Math.abs(measure.targetX - to.left)).toBeLessThan(1)
  }
  for (const zoom of ['Week', 'Month']) {
    await timelineScale(page, zoom)
    await aligned()
  }
  await workspace(page).getByRole('button', { name: 'Fit timeline', exact: true }).click()
  await aligned()
  clean(state)
})

test('saved calculated schedules retain their calculated dates and float', async ({ page }) => {
  const state = await primaveraScheduleHarness(page)
  const task = state.records[17].simplePlan.tasks[0]
  const activity = row(page, task.id)
  await expect(activity.locator('[data-column="duration"]')).toHaveText('10 d')
  await expect(activity.locator('[data-column="start"]')).toHaveText('21-Sept-26')
  await expect(activity.locator('[data-column="finish"]')).toHaveText('02-Oct-26')
  await expect(activity.locator('[data-column="float"]')).toHaveText('0')
  await expect(activity.locator('.p6-activity-bar')).toHaveCount(1)
  await expect(activity.locator('.p6-activity-bar')).not.toHaveAttribute('title', /Source dates/i)
  clean(state)
})
