import { test, expect } from '@playwright/test'
import { primaveraTimelineHarness, primaveraTitles } from '../fixtures/primavera-schedule.fixture.js'
import { timelineScale } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const DAY = 86400000
const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const grid = page => workspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const firstTask = page => grid(page).locator('[data-row-id="activity-1"]')
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.writes).toEqual([])
}
async function open(page, options) {
  await page.setViewportSize({ width: 1740, height: 900 })
  const state = await primaveraTimelineHarness(page, options)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  return state
}
function tickDate(value) {
  const [day, month, year] = value.split('-')
  const index = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'].indexOf(month)
  return Date.UTC(2000 + Number(year), index, Number(day))
}
async function geometry(page) {
  return grid(page).evaluate(element => {
    const scale = element.querySelector('.p6-timescale')
    const scaleBox = scale.getBoundingClientRect()
    const pane = scale.parentElement.getBoundingClientRect()
    const bars = [...element.querySelectorAll('[data-row-kind="task"] .p6-activity-bar')]
    const dimensions = item => { const box = item.getBoundingClientRect(); return { x: box.x, width: box.width, end: box.right, title: item.title, text: item.textContent } }
    return {
      scale: { x: scaleBox.x, width: scaleBox.width, end: scaleBox.right },
      pane: { x: pane.x, width: pane.width, end: pane.right },
      years: [...scale.querySelectorAll('.p6-year')].map(dimensions),
      months: [...scale.querySelectorAll('.p6-month')].map(dimensions),
      ticks: [...scale.querySelectorAll('.p6-tick')].map(dimensions),
      bars: bars.map(dimensions),
      tracks: [...element.querySelectorAll('.p6-timeline-row')].map(dimensions),
    }
  })
}
async function completeCalendar(page) {
  const measure = await geometry(page)
  expect(measure.scale.width).toBeGreaterThanOrEqual(measure.pane.width - 1)
  for (const tier of ['years', 'months', 'ticks']) {
    expect(measure[tier].length, tier).toBeGreaterThan(0)
    expect(Math.abs(measure[tier][0].x - measure.scale.x), tier).toBeLessThan(1)
    expect(Math.abs(measure[tier].at(-1).end - measure.scale.end), tier).toBeLessThan(1)
    for (let index = 1; index < measure[tier].length; index += 1) expect(Math.abs(measure[tier][index].x - measure[tier][index - 1].end), tier).toBeLessThan(1)
  }
  for (const track of measure.tracks) {
    expect(Math.abs(track.x - measure.scale.x)).toBeLessThan(1)
    expect(Math.abs(track.width - measure.scale.width)).toBeLessThan(1)
  }
  return measure
}
async function alignedDates(page, start, finish) {
  const measure = await completeCalendar(page)
  expect(measure.ticks.length).toBeGreaterThan(1)
  const origin = tickDate(measure.ticks[0].title)
  const tickDays = (tickDate(measure.ticks[1].title) - origin) / DAY
  const pixelsPerDay = (measure.ticks[1].x - measure.ticks[0].x) / tickDays
  const expectedStart = measure.ticks[0].x + (Date.parse(`${start}T00:00:00Z`) - origin) / DAY * pixelsPerDay
  const expectedWidth = ((Date.parse(`${finish}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY + 1) * pixelsPerDay
  for (const bar of measure.bars) {
    expect(Math.abs(bar.x - expectedStart)).toBeLessThan(1)
    expect(Math.abs(bar.width - Math.max(2, expectedWidth))).toBeLessThan(1)
  }
  return { ...measure, origin, pixelsPerDay }
}

test('short identical January activities have a full-width calendar through zoom and resize', async ({ page }) => {
  const state = await open(page)
  const originalDates = state.records[17].simplePlan.tasks.map(task => [task.planned_start_date, task.planned_finish_date])
  for (const zoom of ['Week', 'Month', 'Day']) {
    await timelineScale(page, zoom)
    await alignedDates(page, '2026-01-06', '2026-01-12')
  }
  const divider = grid(page).getByRole('separator', { name: 'Resize activity table and Gantt', exact: true })
  await divider.focus()
  await page.keyboard.press('Home')
  await timelineScale(page, 'week')
  await alignedDates(page, '2026-01-06', '2026-01-12')
  await page.setViewportSize({ width: 1400, height: 900 })
  await alignedDates(page, '2026-01-06', '2026-01-12')
  await expect(firstTask(page).locator('[data-column="start"]')).toHaveText('06-Jan-26')
  await expect(firstTask(page).locator('[data-column="finish"]')).toHaveText('12-Jan-26')
  expect(state.records[17].simplePlan.tasks.map(task => [task.planned_start_date, task.planned_finish_date])).toEqual(originalDates)
  clean(state)
})

test('Fit timeline includes the recorded project finish without stretching short task dates', async ({ page }) => {
  const state = await open(page, { projectFinish: '2026-09-04' })
  await expect(grid(page).locator('.p6-month').filter({ hasText: /^September$/ })).toHaveCount(1)
  await workspace(page).getByRole('button', { name: 'Fit timeline', exact: true }).click()
  const measure = await alignedDates(page, '2026-01-06', '2026-01-12')
  const projectFinishX = measure.ticks[0].x + ((Date.parse('2026-09-04T00:00:00Z') - measure.origin) / DAY + 1) * measure.pixelsPerDay
  expect(projectFinishX).toBeLessThanOrEqual(measure.pane.end + 1)
  expect(projectFinishX).toBeGreaterThan(measure.pane.x + measure.pane.width * .85)
  expect(measure.bars[0].width).toBeLessThan(measure.pane.width * .05)
  const scroll = grid(page).getByLabel('Scroll Gantt timeline', { exact: true })
  expect(await scroll.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await expect(firstTask(page).locator('[data-column="duration"]')).toHaveText('5 d')
  await expect(firstTask(page).locator('[data-column="finish"]')).toHaveText('12-Jan-26')
  await grid(page).getByRole('button', { name: primaveraTitles.overlap, exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Activity details', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close activity details', exact: true }).click()
  await page.screenshot({ path: '../artifacts/primavera-timeline-full-project.png', animations: 'disabled' })
  clean(state)
})

test('month and year boundaries share the same date coordinates as activity bars when scrolled', async ({ page }) => {
  const state = await open(page, { taskStart: '2026-01-30', taskFinish: '2026-02-05', projectStart: '2025-12-29', projectFinish: '2026-02-16' })
  for (const zoom of ['Week', 'Month', 'Day']) {
    await timelineScale(page, zoom)
    const measure = await alignedDates(page, '2026-01-30', '2026-02-05')
    const january = measure.months.find(month => month.text === 'January')
    const february = measure.months.find(month => month.text === 'February')
    const newYear = measure.years.find(year => year.text === '2026')
    expect(Math.abs(january.x - newYear.x)).toBeLessThan(1)
    expect(Math.abs((february.x - january.x) - 31 * measure.pixelsPerDay)).toBeLessThan(1)
    expect(Math.abs((february.x - measure.bars[0].x) - 2 * measure.pixelsPerDay)).toBeLessThan(1)
  }
  const before = await alignedDates(page, '2026-01-30', '2026-02-05')
  const scroll = grid(page).getByLabel('Scroll Gantt timeline', { exact: true })
  await scroll.evaluate(element => { element.scrollLeft = 240; element.dispatchEvent(new Event('scroll')) })
  const offset = await scroll.evaluate(element => element.scrollLeft)
  expect(offset).toBe(240)
  const after = await alignedDates(page, '2026-01-30', '2026-02-05')
  expect(Math.abs(before.scale.x - after.scale.x - offset)).toBeLessThan(1)
  expect(Math.abs(before.bars[0].x - after.bars[0].x - offset)).toBeLessThan(1)
  await workspace(page).getByRole('button', { name: 'Fit timeline', exact: true }).click()
  expect(await scroll.evaluate(element => element.scrollLeft)).toBe(0)
  await alignedDates(page, '2026-01-30', '2026-02-05')
  clean(state)
})
