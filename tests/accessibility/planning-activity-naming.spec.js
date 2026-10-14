import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)

const activityNames = ['Review document order of precedence', 'Design new UPS if existing capacity is inadequate']
const sourceStatements = [
  'In the event of a conflict, the document order of precedence shall apply.',
  'If the existing UPS cannot supply the additional load, the contractor shall design a new UPS.',
]
const sourceContext = 'The document precedence rules apply only where requirements conflict. The client interpretation is final.'
const activityIds = ['FEED-REQ-0010', 'FEED-REQ-0020']
const grid = page => scheduleWorkspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const taskRows = page => grid(page).locator('[data-row-kind="task"]')
const inspector = page => page.getByRole('complementary', { name: 'Activity details', exact: true })

async function harness(page) {
  return masterScheduleHarness(page, { prepare(state) {
    for (const record of Object.values(state.records)) {
      Object.assign(record.simplePlan, {
        method: 'programmatic_requirements', duration_policy: 'planning_assumptions',
        disciplines: [{ code: 'requirements', name: 'Requirement statements' }],
        wbs_nodes: [{ id: 'requirements-wbs', code: '1.0', name: 'Requirement statements', parent_id: null, discipline: 'requirements' }],
      })
      record.simplePlan.tasks = record.simplePlan.tasks.map((task, index) => ({
        ...task, id: `requirement-${101 + index}`, requirement_id: 101 + index,
        planning_activity_id: activityIds[index], activity_code: activityIds[index],
        title: activityNames[index], activity_name_original: activityNames[index],
        activity_name_basis: 'reviewed_source_action', source_title: sourceStatements[index],
        requirement_value: sourceStatements[index], acceptance_criteria: sourceStatements[index],
        task_type: 'task', document_number: '', document_revision: '',
        discipline: 'requirements', wbs_node_id: 'requirements-wbs', wbs_code: '1.0',
        depends_on: [], duration_source: 'proposed', needs_review: true,
        source_references: [{ file_id: 801, filename: 'Example scope.pdf', locator: { page: 12 + index }, excerpt: index ? sourceStatements[index] : sourceContext }],
      }))
    }
  } })
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.writes).toEqual([])
}

test('business activity IDs and concise names remain separate from WBS and preserve the original requirement', async ({ page }) => {
  const state = await harness(page)
  await expect(taskRows(page).locator('[data-column="activity-code"]')).toHaveText(activityIds)
  await expect(taskRows(page).locator('.sc-task-name')).toHaveText(activityNames)
  const wbs = grid(page).locator('[data-row-kind="wbs"][data-row-id="requirements-wbs"]')
  await expect(wbs.locator('[data-column="activity-code"]')).toHaveText('1.0')
  await expect(wbs).toContainText('Requirement statements')

  const search = scheduleWorkspace(page).getByRole('textbox', { name: 'Search schedule activities', exact: true })
  await search.fill(activityIds[0])
  await expect(taskRows(page)).toHaveCount(1)
  await expect(taskRows(page).locator('.sc-task-name')).toHaveText(activityNames[0])
  await taskRows(page).getByRole('button', { name: activityNames[0], exact: true }).click()
  await expect(inspector(page)).toContainText(activityIds[0])
  await expect(inspector(page).locator('dt').filter({ hasText: /^WBS$/ }).locator('..')).toContainText('Requirement statements')
  const original = inspector(page).getByText('Original requirement', { exact: true })
  await original.focus()
  await page.keyboard.press('Enter')
  const source = original.locator('..')
  await expect(source.getByText(sourceStatements[0], { exact: true })).toBeVisible()
  await expect(source.getByText(sourceContext, { exact: true })).toBeVisible()
  await expect(source).toContainText('Example scope.pdf')
  await expect(source).toContainText('Page 12')
  clean(state)
})

test('activity IDs stay with their activities after server reordering and reload', async ({ page }) => {
  const state = await harness(page)
  await expect(taskRows(page).locator('[data-column="activity-code"]')).toHaveText(activityIds)
  const before = structuredClone(state.records[17].simplePlan.tasks)
  state.records[17].simplePlan.tasks.reverse()
  await page.reload()
  await expect(taskRows(page).locator('[data-column="activity-code"]')).toHaveText([...activityIds].reverse())
  for (const task of before) {
    const row = grid(page).locator(`[data-row-kind="task"][data-row-id="${task.id}"]`)
    await expect(row.locator('[data-column="activity-code"]')).toHaveText(task.planning_activity_id)
    await expect(row.locator('.sc-task-name')).toHaveText(task.title)
    await expect(row).toHaveAttribute('data-wbs-node-id', task.wbs_node_id)
  }
  const search = scheduleWorkspace(page).getByRole('textbox', { name: 'Search schedule activities', exact: true })
  await search.fill(activityIds[1])
  await expect(taskRows(page)).toHaveCount(1)
  await expect(taskRows(page).locator('.sc-task-name')).toHaveText(activityNames[1])
  expect(state.records[17].simplePlan.tasks).toEqual([...before].reverse())
  clean(state)
})

test('activity ID column fits the business ID and retains user resizing while filtering', async ({ page }) => {
  const state = await harness(page)
  const resize = grid(page).getByRole('separator', { name: 'Resize Activity ID column', exact: true })
  await expect(resize).toHaveAttribute('aria-valuenow', '160')
  const code = taskRows(page).first().locator('[data-column="activity-code"] > span').last()
  await expect(code).toHaveText(activityIds[0])
  const fits = await code.evaluate(element => element.scrollWidth <= element.clientWidth)
  expect(fits).toBe(true)
  await resize.focus()
  await page.keyboard.press('ArrowRight')
  await expect(resize).toHaveAttribute('aria-valuenow', '170')
  await scheduleWorkspace(page).getByRole('textbox', { name: 'Search schedule activities', exact: true }).fill(activityIds[1])
  await expect(taskRows(page)).toHaveCount(1)
  await expect(resize).toHaveAttribute('aria-valuenow', '170')
  clean(state)
})
