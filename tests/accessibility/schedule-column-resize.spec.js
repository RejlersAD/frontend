import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { wideTimelineHarness } from '../fixtures/wide-timeline.fixture.js'
import { scheduleWorkspace, scheduleMenu, closeScheduleMenu } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const columns = [
  { label: 'Activity ID', key: 'activity-code', initial: 104, min: 50, max: 480 },
  { label: 'Activity Name', key: 'activity-name', initial: 184, min: 120, max: 1200 },
  { label: 'Stage', key: 'stage', initial: 76, min: 46, max: 320 },
  { label: 'Duration', key: 'duration', initial: 54, min: 42, max: 240 },
  { label: 'Start', key: 'start', initial: 84, min: 66, max: 240 },
  { label: 'Finish', key: 'finish', initial: 84, min: 66, max: 240 },
  { label: 'Total Float', key: 'float', initial: 54, min: 44, max: 240 },
  { label: 'Logic', key: 'logic', initial: 36, min: 30, max: 240 },
  { label: 'Responsible', key: 'responsible', initial: 104, min: 72, max: 480 },
]
const grid = page => scheduleWorkspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const handle = (page, column) => grid(page).getByRole('separator', { name: `Resize ${column.label} column`, exact: true })
async function showAllColumns(page) {
  const menu = await scheduleMenu(page, 'Schedule columns')
  await menu.getByRole('checkbox', { name: 'Stage', exact: true }).check()
  await menu.getByRole('checkbox', { name: 'Responsible', exact: true }).check()
  await closeScheduleMenu(page, 'Schedule columns')
}
async function widths(page) {
  return grid(page).locator('.p6-heading .p6-table-row > [role="columnheader"]').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width))
}
async function revealHandle(page, column) {
  const edge = await grid(page).getByRole('columnheader', { name: column.label, exact: true }).evaluate(element => element.offsetLeft + element.offsetWidth)
  await grid(page).getByLabel('Scroll activity columns', { exact: true }).evaluate((element, right) => {
    element.scrollLeft = Math.max(0, right - element.clientWidth)
    element.dispatchEvent(new Event('scroll'))
  }, edge)
}
async function unchangedExcept(page, before, index, expected) {
  const after = await widths(page)
  expect(after[index + 1]).toBe(expected)
  for (let sibling = 0; sibling < after.length; sibling += 1) if (sibling !== index + 1) expect(after[sibling]).toBe(before[sibling])
}
async function aligned(page, column) {
  const heading = await grid(page).getByRole('columnheader', { name: column.label, exact: true }).boundingBox()
  for (const id of ['activity-1', 'activity-2', 'activity-3']) {
    const cell = await grid(page).locator(`[data-row-id="${id}"] [data-column="${column.key}"]`).boundingBox()
    expect(cell.width).toBe(heading.width)
    expect(cell.x).toBeCloseTo(heading.x, 1)
  }
}
function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.writes).toEqual([])
}

test('all activity columns resize independently by keyboard, respect bounds and reset only the chosen column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await wideTimelineHarness(page)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  expect(await widths(page)).toEqual([30, 104, 184, 54, 84, 84, 54, 36])
  await showAllColumns(page)
  expect(await widths(page)).toEqual([30, ...columns.map(column => column.initial)])
  const tableBefore = await grid(page).locator('.p6-heading .p6-left-clip').boundingBox()
  for (const [index, column] of columns.entries()) {
    const before = await widths(page)
    const resize = handle(page, column)
    await resize.focus()
    await page.keyboard.press('ArrowRight')
    await expect(resize).toHaveAttribute('aria-valuenow', String(column.initial + 10))
    await unchangedExcept(page, before, index, column.initial + 10)
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowLeft')
    await expect(resize).toHaveAttribute('aria-valuenow', String(column.min))
    await unchangedExcept(page, before, index, column.min)
    await page.keyboard.press('End')
    await page.keyboard.press('ArrowRight')
    await expect(resize).toHaveAttribute('aria-valuenow', String(column.max))
    await unchangedExcept(page, before, index, column.max)
    await revealHandle(page, column)
    await resize.dblclick()
    await expect(resize).toHaveAttribute('aria-valuenow', String(column.initial))
    expect(await widths(page)).toEqual(before)
    await aligned(page, column)
  }
  expect((await grid(page).locator('.p6-heading .p6-left-clip').boundingBox()).width).toBe(tableBefore.width)
  await handle(page, columns[1]).focus()
  await page.keyboard.press('ArrowRight')
  const options = await scheduleMenu(page, 'Schedule actions')
  await options.getByRole('button', { name: 'Fit columns', exact: true }).click()
  await closeScheduleMenu(page, 'Schedule actions')
  const fitted = await widths(page)
  const fittedPane = await grid(page).locator('.p6-heading .p6-left-clip').boundingBox()
  expect(fitted.reduce((total, width) => total + width, 0)).toBeLessThanOrEqual(fittedPane.width)
  for (const [index, column] of columns.entries()) {
    expect(fitted[index + 1]).toBeGreaterThanOrEqual(column.min)
    expect(fitted[index + 1]).toBeLessThanOrEqual(column.max)
    await aligned(page, column)
  }
  const menu = await scheduleMenu(page, 'Schedule columns')
  await menu.getByRole('checkbox', { name: 'Activity ID', exact: true }).uncheck()
  await closeScheduleMenu(page, 'Schedule columns')
  const root = grid(page).locator('[data-row-id="1000"]')
  await root.getByRole('button', { name: 'Collapse RAD-210 Amine Regeneration Upgrade', exact: true }).click()
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(0)
  await root.getByRole('button', { name: 'Expand RAD-210 Amine Regeneration Upgrade', exact: true }).click()
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  clean(state)
})

test('pointer resizing keeps other columns fixed and aligns headers with rows after horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await wideTimelineHarness(page)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  await showAllColumns(page)
  for (const [index, column] of columns.entries()) {
    const before = await widths(page)
    await revealHandle(page, column)
    const resize = handle(page, column)
    const box = await resize.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 4 })
    await page.mouse.up()
    await expect(resize).toHaveAttribute('aria-valuenow', String(column.initial + 20))
    await unchangedExcept(page, before, index, column.initial + 20)
    await aligned(page, column)
  }
  const scroll = grid(page).getByLabel('Scroll activity columns', { exact: true })
  await scroll.evaluate(element => { element.scrollLeft = element.scrollWidth; element.dispatchEvent(new Event('scroll')) })
  for (const column of columns) await aligned(page, column)
  const scan = await new AxeBuilder({ page }).include('.primavera-gantt').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  clean(state)
})

test('clicking a partly clipped duration opens its editor without losing the click during focus scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const state = await wideTimelineHarness(page)
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  await showAllColumns(page)
  const nameResize = handle(page, columns[1])
  await nameResize.focus()
  await page.keyboard.press('Shift+ArrowRight')
  for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowRight')
  await expect(nameResize).toHaveAttribute('aria-valuenow', '264')
  const title = state.records[17].simplePlan.tasks[0].title
  await grid(page).getByRole('button', { name: `Edit duration for ${title}`, exact: true }).click()
  const editor = page.getByRole('spinbutton', { name: `Duration for ${title}`, exact: true })
  await expect(editor).toBeVisible()
  await expect(editor).toHaveValue('5')
  await editor.fill('-1')
  await editor.press('Enter')
  await expect(editor).toHaveAttribute('aria-invalid', 'true')
  const menu = await scheduleMenu(page, 'Schedule columns')
  await expect(menu.getByRole('checkbox', { name: 'Duration', exact: true })).toBeDisabled()
  await closeScheduleMenu(page, 'Schedule columns')
  await expect(editor).toHaveCount(0)
  await expect(grid(page).getByRole('button', { name: `Edit duration for ${title}`, exact: true })).toHaveText('5 d')
  clean(state)
})
