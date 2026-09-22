import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { compactRelations, compactScheduleHarness, scheduleHeightBaseline } from '../fixtures/compact-schedule.fixture.js'
import { scheduleAction, scheduleMenu, closeScheduleMenu, scheduleVersion, scheduleWorkspace, timelineScale } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const grid = page => scheduleWorkspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const row = (page, id) => grid(page).locator(`[data-row-id="${id}"]`)
const links = page => grid(page).locator('.p6-dependency-link')
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknownWrites).toEqual([]); expect(state.unknown).toEqual([]) }

async function open(page, options = {}) {
  const state = await compactScheduleHarness(page, options)
  await expect(scheduleWorkspace(page).getByRole('heading', { name: 'Master Schedule', exact: true })).toBeVisible()
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  return state
}

async function measure(page) {
  return scheduleWorkspace(page).evaluate(element => {
    const rect = selector => { const box = element.querySelector(selector).getBoundingClientRect(); return { top: box.top, bottom: box.bottom, height: box.height } }
    const viewport = rect('.p6-viewport'), calendar = rect('.p6-heading'), footer = rect('.sc-footer')
    const rowHeight = element.querySelector('[data-row-kind="task"]').getBoundingClientRect().height
    return { viewport, calendar, footer, rowHeight, activities: Math.min(viewport.bottom, window.innerHeight, footer.top) - Math.max(calendar.bottom, 0), pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight, width: window.innerWidth, height: window.innerHeight }
  })
}

async function alignedArrows(page) {
  const errors = await links(page).evaluateAll(paths => paths.map(path => {
    const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM())
    const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM())
    const root = path.closest('.p6-viewport')
    const source = root.querySelector(`[data-row-id="${path.dataset.predecessorId}"] .p6-activity-bar`).getBoundingClientRect()
    const target = root.querySelector(`[data-row-id="${path.dataset.successorId}"] .p6-activity-bar`).getBoundingClientRect()
    const type = path.dataset.relationship
    return { type, sx: Math.abs(start.x - (type[0] === 'S' ? source.left : source.right)), sy: Math.abs(start.y - (source.top + source.height / 2)), tx: Math.abs(end.x - (type[1] === 'S' ? target.left : target.right)), ty: Math.abs(end.y - (target.top + target.height / 2)) }
  }))
  expect(errors.length).toBeGreaterThan(0)
  for (const error of errors) for (const axis of ['sx', 'sy', 'tx', 'ty']) expect(error[axis], `${error.type} ${axis}`).toBeLessThan(1.6)
}

for (const size of [{ width: 1900, height: 950 }, { width: 1440, height: 900 }]) {
  test(`compact desktop ${size.width} retains a useful schedule viewport below the shared project header`, async ({ page }, testInfo) => {
    await page.setViewportSize(size)
    const state = await open(page)
    await expect.poll(async () => (await measure(page)).footer.bottom).toBeLessThanOrEqual(size.height)
    const actual = await measure(page), baseline = scheduleHeightBaseline[`${size.width}x${size.height}`]
    // The shared project header is intentional. The grid should use the space
    // beneath its actual calendar header, allowing only its legend/scrollbar gap.
    const availableBody = Math.min(size.height, actual.footer.top) - actual.calendar.bottom
    expect(availableBody - actual.activities).toBeLessThanOrEqual(64)
    expect(actual.rowHeight).toBe(32)
    // Keep at least the former 25 x 16px body capacity while giving each row
    // the more readable 32px height used by the redesigned schedule.
    expect(actual.activities).toBeGreaterThanOrEqual(400)
    expect(actual.pageWidth).toBeLessThanOrEqual(size.width)
    expect(actual.pageHeight).toBeLessThanOrEqual(size.height)
    expect((await page.locator('.performance-test-shell').boundingBox()).x).toBe(198)
    await expect(page.getByRole('combobox', { name: 'Project section', exact: true })).toHaveCount(0)
    const projectAreas = page.getByRole('navigation', { name: 'Project work areas', exact: true })
    for (const name of ['Overview', 'Cost & Commercial', 'Milestones', 'Risks & Changes', 'Estimates', 'Documents']) await expect(projectAreas.getByRole('button', { name, exact: true })).toBeVisible()
    await expect(scheduleWorkspace(page).getByRole('button', { name: 'Fit timeline', exact: true })).toBeVisible()
    await expect(scheduleWorkspace(page).getByRole('combobox', { name: 'Schedule workspace area', exact: true }).locator('option')).toHaveCount(10)
    await expect(scheduleWorkspace(page).getByRole('combobox', { name: 'Schedule detail level', exact: true })).toBeVisible()
    await expect(scheduleWorkspace(page).getByRole('checkbox', { name: 'Critical only', exact: true })).toBeVisible()
    const filters = await scheduleMenu(page, 'Schedule filters')
    await expect(filters.getByRole('combobox', { name: 'Schedule discipline', exact: true })).toBeVisible()
    for (const name of ['Deliverables', 'All activities']) await expect(filters.getByRole('button', { name, exact: true })).toBeVisible()
    await closeScheduleMenu(page, 'Schedule filters')
    const actions = await scheduleMenu(page, 'Schedule actions')
    for (const name of ['Build schedule', 'Add activity', 'Save draft', 'New version', 'Validate', 'Project inputs', 'Expand all', 'Collapse all', 'Fit columns', 'Show dependency links']) await expect(actions.getByRole('button', { name, exact: true })).toBeVisible()
    await actions.getByRole('button', { name: 'Fit columns', exact: true }).focus()
    await page.keyboard.press('Escape')
    await expect(actions).not.toHaveAttribute('open')
    await expect(scheduleWorkspace(page).getByLabel('Schedule actions', { exact: true })).toBeFocused()
    await testInfo.attach('schedule-height-comparison.json', { body: JSON.stringify({ baseline, actual, bodyHeightIncreasePercent: 100 * (actual.activities / baseline.activities - 1) }, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: `../artifacts/compact-after-${size.width}x${size.height}.png`, animations: 'disabled' })
    clean(state)
    expect(state.writes).toEqual([])
  })
}

test('FS, SS, FF and SF arrows join real bar edges through zoom, scrolling, resize and WBS filtering', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await open(page)
  await expect(links(page)).toHaveCount(4)
  for (const relation of compactRelations) {
    const path = grid(page).locator(`.p6-dependency-link[data-predecessor-id="${relation.predecessor}"][data-successor-id="${relation.successor}"]`)
    await expect(path).toHaveAttribute('data-relationship', relation.type)
    await expect(path).toHaveAttribute('data-lag-days', String(relation.lag))
  }
  await alignedArrows(page)
  for (const scale of ['day', 'month', 'week']) { await timelineScale(page, scale); await alignedArrows(page) }
  await grid(page).locator('.p6-viewport').evaluate(element => { element.scrollTop = 112 })
  await alignedArrows(page)
  const horizontal = grid(page).getByLabel('Scroll Gantt timeline', { exact: true })
  await horizontal.evaluate(element => { element.scrollLeft = 100; element.dispatchEvent(new Event('scroll')) })
  await expect.poll(() => horizontal.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await alignedArrows(page)
  const splitter = grid(page).getByRole('separator', { name: 'Resize activity table and Gantt', exact: true })
  await splitter.focus(); await page.keyboard.press('ArrowLeft'); await alignedArrows(page)
  await grid(page).locator('.p6-viewport').evaluate(element => { element.scrollTop = 0 })
  const search = scheduleWorkspace(page).getByRole('textbox', { name: 'Search schedule activities', exact: true })
  await search.fill('FEED-ELE')
  await expect(links(page)).toHaveCount(1)
  await expect(links(page)).toHaveAttribute('data-relationship', 'SF')
  await alignedArrows(page)
  await search.clear()
  await row(page, 1111).getByRole('button', { name: 'Collapse RAD-210.1.1.1 Process Engineering', exact: true }).click()
  await expect(links(page)).toHaveCount(1)
  await alignedArrows(page)
  await row(page, 1110).getByRole('button', { name: 'Collapse RAD-210.1.1 FEED', exact: true }).click()
  await expect(links(page)).toHaveCount(0)
  clean(state)
})

test('phase legend uses supplied metadata and dependency keyboard actions retain evidence and employee history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await open(page)
  const displayOptions = await scheduleMenu(page, 'Schedule actions')
  await displayOptions.getByRole('checkbox', { name: 'Color bars by workflow stage', exact: true }).check()
  await closeScheduleMenu(page, 'Schedule actions')
  await scheduleWorkspace(page).getByLabel('Schedule legend', { exact: true }).click()
  for (const [id, phase] of [[1, 'basis'], [2, 'engineering'], [3, 'review'], [4, 'ifr'], [5, 'company_review'], [22, 'discipline:mechanical']]) {
    await expect(row(page, `activity-${id}`).locator('.p6-activity-bar')).toHaveAttribute('data-phase', phase)
    await expect(scheduleWorkspace(page).getByRole('region', { name: 'Schedule sequence legend', exact: true }).locator(`[data-phase="${phase}"]`)).toBeVisible()
  }
  await expect(row(page, 'activity-1').locator('.p6-activity-bar')).toHaveClass(/is-critical/)
  const colors = await Promise.all([1, 2, 3, 23].map(id => row(page, `activity-${id}`).locator('.p6-activity-bar').evaluate(element => getComputedStyle(element).backgroundColor)))
  expect(new Set(colors).size).toBe(4)
  expect(colors[0]).toBe('rgb(239, 68, 68)')
  expect(colors[3]).toBe('rgb(124, 58, 237)')
  expect(await row(page, 'activity-22').locator('.p6-activity-bar').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(colors[0])
  const ss = grid(page).getByRole('button', { name: /Start to start \(SS\); lag \+2 working days/ })
  await expect(ss).toHaveAccessibleName(/Planning inference.*Logic Review.pdf.*Page 3/)
  await expect(ss.locator('.p6-dependency-label')).toHaveText('SS +2d')
  const label = await ss.locator('.p6-dependency-label').boundingBox()
  const plot = await grid(page).locator('.p6-dependency-clip').boundingBox()
  expect(label.x).toBeGreaterThanOrEqual(plot.x)
  expect(label.x + label.width).toBeLessThanOrEqual(plot.x + plot.width)
  await ss.focus(); await page.keyboard.press('Enter')
  const logic = page.getByRole('dialog', { name: 'Activity logic', exact: true })
  await expect(logic).toContainText(state.records[17].simplePlan.tasks[2].title)
  await page.keyboard.press('Escape')
  await expect(logic).toHaveCount(0)
  await expect(ss).toBeFocused()
  const activity = grid(page).getByRole('button', { name: state.records[17].simplePlan.tasks[2].title, exact: true })
  await activity.click()
  const drawer = page.getByRole('complementary', { name: 'Activity details', exact: true })
  await expect(drawer).toContainText(state.records[17].simplePlan.tasks[2].title)
  await expect(drawer.getByRole('button', { name: 'View activity for Omar Saleh', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(activity).toBeFocused()
  const scan = await new AxeBuilder({ page }).include('.schedule-canvas').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  const filters = await scheduleMenu(page, 'Schedule filters')
  await filters.getByRole('checkbox', { name: 'Show dependency links', exact: true }).uncheck()
  await closeScheduleMenu(page, 'Schedule filters')
  await expect(links(page)).toHaveCount(0)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  const columns = await scheduleMenu(page, 'Schedule actions')
  const logicToggle = columns.getByRole('button', { name: 'Show dependency links', exact: true })
  await expect(logicToggle).toHaveAttribute('aria-pressed', 'false')
  await logicToggle.click()
  await expect(logicToggle).toHaveAttribute('aria-pressed', 'true')
  await closeScheduleMenu(page, 'Schedule actions')
  await expect(links(page)).toHaveCount(4)
  clean(state)
})

test('save uses a floating transient notification without moving the schedule and pauses dismissal on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await open(page)
  await page.clock.install()
  const before = await measure(page)
  await scheduleAction(page, 'Save draft')
  const toast = page.locator('.prv-toast')
  await expect(toast.getByRole('status')).toContainText('saved')
  expect((await measure(page)).viewport.top).toBe(before.viewport.top)
  await expect(page.locator('.wbd-success')).toHaveCount(0)
  await toast.hover()
  await page.clock.fastForward(8000)
  await expect(toast).toBeVisible()
  await page.mouse.move(5, 5)
  await page.clock.fastForward(6501)
  await expect(toast).toHaveCount(0)
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0].method).toBe('PUT')
  clean(state)
})

test('schedule warnings float above unchanged rows and stale inputs still prevent approval', async ({ page }) => {
  const state = await open(page, {
    prepare(current) {
      for (const record of Object.values(current.records)) {
        record.simplePlan.stale_inputs = true
        record.simplePlan.tasks[0].total_float_days = -2
        record.simplePlan.warnings = [{ code: 'negative_float', message: 'Negative float requires review.' }]
      }
    },
    decorateSnapshot(plan) {
      return { ...plan, blockers: [{ code: 'inputs_changed', message: 'Confirm the revised source inputs before approval.' }] }
    },
  })
  const oldBanner = 'Project inputs have changed. Return to inputs and rebuild the plan before submitting or publishing.'
  await expect(page.getByText(oldBanner, { exact: true })).toHaveCount(0)
  await expect(page.locator('.prv-stale')).toHaveCount(0)
  await expect(scheduleWorkspace(page)).not.toContainText('Negative float requires review.')
  const before = await measure(page)
  const review = scheduleWorkspace(page).getByRole('button', { name: /^Review \d+ issues$/ })
  await review.click()
  const warnings = page.getByRole('dialog', { name: 'Schedule warnings', exact: true })
  await expect(warnings).toContainText('Negative float requires review.')
  await expect(warnings).toContainText('Confirm the revised source inputs before approval.')
  expect(await warnings.evaluate(element => getComputedStyle(element).position)).toBe('fixed')
  expect((await measure(page)).viewport.top).toBe(before.viewport.top)
  await page.keyboard.press('Escape')
  await expect(warnings).toHaveCount(0)
  await expect(review).toBeFocused()
  await scheduleWorkspace(page).getByRole('button', { name: 'Review & approve', exact: true }).click()
  const approval = page.getByRole('dialog', { name: 'Review & publish baseline', exact: true })
  await expect(approval.getByRole('button', { name: 'Submit for approval', exact: true })).toBeDisabled()
  await approval.getByRole('button', { name: 'Close Review & publish baseline', exact: true }).click()
  await page.locator('.pd-schedule-header').getByRole('button', { name: /^Resolve/ }).click()
  await expect(warnings).toBeVisible()
  await warnings.getByRole('button', { name: 'Review inputs', exact: true }).click()
  await expect(warnings).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Documents & project inputs', exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
  clean(state)
})

test('baseline overlay uses only valid explicit dates and preserves the working schedule', async ({ page }) => {
  const state = await open(page, { prepare(current) {
    for (const record of Object.values(current.records)) {
      Object.assign(record.simplePlan.tasks[0], { baseline_start_date: '2026-08-03', baseline_finish_date: '2027-02-01' })
      Object.assign(record.simplePlan.tasks[1], { baseline_start_date: 'invalid', baseline_finish_date: '2026-10-02' })
      Object.assign(record.simplePlan.tasks[2], { baseline_start_date: '2026-10-02', baseline_finish_date: '2026-09-21' })
      Object.assign(record.simplePlan.tasks[3], { baseline_start_date: '2026-09-21' })
      Object.assign(record.simplePlan.tasks[4], { baseline_start_date: '2026-02-30', baseline_finish_date: '2026-10-02' })
    }
  } })
  const workingDates = await grid(page).locator('[data-row-kind="task"] [data-column="start"], [data-row-kind="task"] [data-column="finish"]').allTextContents()
  const baseline = scheduleWorkspace(page).getByRole('checkbox', { name: 'Baseline', exact: true })
  await expect(grid(page).locator('.p6-baseline-bar')).toHaveCount(0)
  await baseline.check()
  await expect(grid(page).locator('.p6-baseline-bar')).toHaveCount(1)
  const overlay = row(page, 'activity-1').locator('.p6-baseline-bar')
  await expect(overlay).toHaveAttribute('data-baseline-start-date', '2026-08-03')
  await expect(overlay).toHaveAttribute('data-baseline-finish-date', '2027-02-01')
  const scale = grid(page).locator('.p6-timescale')
  expect(await scale.getAttribute('data-start-date')).toBe('2026-08-03')
  expect(await scale.getAttribute('data-horizon-finish-date')).toBe('2027-02-01')
  expect(await grid(page).locator('[data-row-kind="task"] [data-column="start"], [data-row-kind="task"] [data-column="finish"]').allTextContents()).toEqual(workingDates)
  await baseline.uncheck()
  await expect(grid(page).locator('.p6-baseline-bar')).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})

test('shared project shell contains the schedule across historical view and mobile menu wrapping', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1900, height: 950 })
  const state = await open(page, { realShell: true, history: true })
  const footer = page.locator('.app-footer')
  // The shared project shell intentionally hides the global application footer.
  await expect(footer).toBeHidden()
  const checkFit = async () => {
    try {
      await expect.poll(async () => {
        const main = await page.locator('.main-content').boundingBox()
        return (await measure(page)).footer.bottom - (main.y + main.height)
      }).toBeLessThanOrEqual(1)
    } catch (error) {
      const geometry = await page.evaluate(() => ({ viewportHeight: innerHeight, visualViewport: visualViewport ? { height: visualViewport.height, offsetTop: visualViewport.offsetTop } : null,
        elements: ['.main-content', '.project-performance-workspace', '.pd-header', '.pp-body', '.schedule-canvas', '.sc-body', '.p6-viewport', '.p6-scrollbars', '.p6-legend', '.sc-footer'].map(selector => {
          const element = document.querySelector(selector), style = getComputedStyle(element)
          return { selector, rect: element.getBoundingClientRect().toJSON(), clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, height: style.height, minHeight: style.minHeight, padding: style.padding, overflowY: style.overflowY, gridHeight: style.getPropertyValue('--p6-viewport-height') }
        }),
      }))
      await testInfo.attach('overflow-geometry.json', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' })
      throw error
    }
    expect(await page.locator('.main-content').evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await checkFit()
  await scheduleVersion(page, '90')
  await expect(scheduleWorkspace(page)).toContainText('You are viewing a saved schedule version.')
  await checkFit()
  await scheduleVersion(page, 'current')
  await expect(scheduleWorkspace(page)).not.toContainText('You are viewing a saved schedule version.')
  await checkFit()
  await testInfo.attach('real-shell-geometry.json', { body: JSON.stringify({ schedule: await measure(page), appFooter: await footer.boundingBox() }, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: '../artifacts/compact-real-shell-desktop.png', animations: 'disabled' })
  await page.locator('.project-performance-workspace').screenshot({ path: '../artifacts/reference-schedule-final.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await checkFit()
  await expect(scheduleWorkspace(page).getByRole('combobox', { name: 'Schedule workspace area', exact: true })).toBeVisible()
  const summary = scheduleWorkspace(page).getByLabel('Schedule filters', { exact: true })
  await summary.focus(); await page.keyboard.press('Enter')
  const content = summary.locator('..').locator('.sc-menu-content')
  await expect(content).toBeVisible()
  const box = await content.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(391)
  await page.keyboard.press('Escape')
  await expect(content).toBeHidden()
  await expect(summary).toBeFocused()
  const results = await new AxeBuilder({ page }).include('.schedule-canvas').analyze()
  expect(results.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/compact-real-shell-mobile.png', animations: 'disabled' })
  clean(state)
})
