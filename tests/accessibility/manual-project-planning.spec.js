import { test, expect } from '@playwright/test'
import { planningInputsHarness, planningEmployees } from '../fixtures/planning-inputs.fixture'

test.setTimeout(60000)
const stage = page => page.getByRole('navigation', { name: 'Planning stages', exact: true }).getByRole('button', { name: /Work breakdown/ })

async function manualHarness(page, options = {}) {
  return planningInputsHarness(page, {
    prepare(state) {
      const record = state.records[17]
      record.project.custom_fields = { project_type: 'software', department: 'IT' }
      record.planningProject.planning_mode = options.document ? 'document' : 'manual'
      record.planningProject.phase = 'Phase 1'
      if (options.missing) state.missingPlanning.add(17)
      if (options.blankScope) record.planningProject.scope_summary = ''
      record.manualWorkBreakdown = {
        project_id: record.planningProject.id, planning_mode: 'manual', intelligence_run_id: null,
        preview_confirmed_at: `manual:${record.planningProject.id}`, revision: 0, tasks: [],
        disciplines: [{ code: 'general', name: 'General' }], source_documents: [],
        permissions: { can_assign: true },
      }
    },
    async handleRequest({ route, path, state, reply }) {
      if (options.schedule && path.endsWith('/enterprise-contract/')) {
        const record = state.records[17]
        await reply(route, { linked: true, in_sync: true, differences: [], lifecycle: 'draft', baseline_locked: false,
          latest_schedule_version: { id: record.versions[0].id, schedule_id: record.schedule.id, status: 'draft' },
        })
        return true
      }
      if (!path.endsWith('/manual-work-breakdown/')) return false
      const record = state.records[17]
      if (route.request().method() === 'PUT') {
        const data = route.request().postDataJSON()
        state.writes.push({ method: 'PUT', path, data })
        record.manualWorkBreakdown = {
          ...record.manualWorkBreakdown, ...data, revision: record.manualWorkBreakdown.revision + 1,
          tasks: data.tasks.map(task => ({ ...task, status: 'todo', progress_percent: 0,
            assignee: planningEmployees.find(employee => employee.user_id === task.assignee_id),
          })),
          ...(data.advance ? { schedule_id: record.schedule.id, schedule_version_id: record.versions[0].id } : {}),
        }
      }
      await reply(route, record.manualWorkBreakdown)
      return true
    },
  })
}

test('manual project saves scope without documents, assigns an employee in a custom workstream and opens the schedule', async ({ page }) => {
  const state = await manualHarness(page)
  await expect(page.getByRole('combobox', { name: 'Planning method', exact: true })).toHaveValue('manual')
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Scope summary', exact: true }).fill('Launch the tested RADAI modules.')
  await page.getByRole('button', { name: 'Save & continue to Work breakdown', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Work breakdown', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add workstream', exact: true }).click()
  const workstream = page.getByRole('dialog', { name: 'Add workstream', exact: true })
  await workstream.getByRole('textbox', { name: 'Workstream name', exact: true }).fill('Quality assurance')
  await workstream.getByRole('button', { name: 'Add workstream', exact: true }).click()
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const task = page.getByRole('dialog', { name: 'Add task', exact: true })
  await task.getByRole('textbox', { name: 'Task / deliverable', exact: true }).fill('Complete release regression')
  await task.getByRole('combobox', { name: 'Workstream', exact: true }).selectOption({ label: 'Quality assurance' })
  await task.getByRole('combobox', { name: 'Assigned to', exact: true }).fill('Maya')
  await task.getByRole('option', { name: /Maya Hassan/ }).click()
  await task.getByRole('spinbutton', { name: 'Planned effort (hours)', exact: true }).fill('16')
  await task.getByLabel('Planned start', { exact: true }).fill('2026-10-05')
  await task.getByLabel('Due date', { exact: true }).fill('2026-10-07')
  await task.getByRole('spinbutton', { name: 'Duration (working days)', exact: true }).fill('3')
  await task.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(task).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: 'Complete release regression' })).toContainText('Maya Hassan')
  const writes = state.writes.filter(write => write.path.endsWith('/manual-work-breakdown/'))
  expect(writes).toHaveLength(1)
  expect(writes[0].data.tasks[0]).toMatchObject({ assignee_id: 7, effort_hours: 16, duration_days: 3, planned_start_date: '2026-10-05', due_date: '2026-10-07' })
  expect(writes[0].data.disciplines).toContainEqual(expect.objectContaining({ name: 'Quality assurance' }))
  await page.reload()
  await expect(stage(page)).toBeEnabled()
  await stage(page).click()
  await expect(page.getByRole('row').filter({ hasText: 'Complete release regression' })).toContainText('Maya Hassan')
  await page.screenshot({ path: '../artifacts/project-planning-manual-work-breakdown.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Continue to schedule', exact: true }).click()
  await expect.poll(() => state.writes.some(write => write.data?.advance)).toBe(true)
  await expect(page.getByRole('heading', { name: 'Work breakdown', exact: true })).toHaveCount(0)
  expect(state.requests.filter(request => /\/(analyze|confirm-preview)\/$/.test(request.path))).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
})

test('non-engineering project can create its linked workspace and enter work breakdown without a file', async ({ page }) => {
  const state = await manualHarness(page, { missing: true })
  await expect(page.getByRole('combobox', { name: 'Planning method', exact: true })).toHaveValue('manual')
  await page.getByRole('textbox', { name: 'Scope summary', exact: true }).fill('Implement the department onboarding workflow.')
  await page.getByRole('textbox', { name: 'Phase', exact: true }).fill('Implementation')
  await page.getByRole('button', { name: 'Save & continue to Work breakdown', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Work breakdown', exact: true })).toBeVisible()
  expect(state.writes.find(write => write.method === 'POST').data).toMatchObject({ planning_mode: 'manual', enterprise_project: 17 })
  expect(state.records[17].files).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
})

test('manual entry requires scope and document mode still requires document intelligence confirmation', async ({ page }) => {
  const state = await manualHarness(page, { blankScope: true })
  await expect(stage(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Save & continue to Work breakdown', exact: true }).click()
  expect(state.writes).toEqual([])
  await expect(page.getByRole('textbox', { name: 'Scope summary', exact: true })).toBeFocused()
  await page.getByRole('combobox', { name: 'Planning method', exact: true }).selectOption('document')
  await expect(page.getByRole('button', { name: 'Save & continue to Work breakdown', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Run Document Intelligence', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Next: Document Intelligence Preview', exact: true })).toBeDisabled()
  await expect(stage(page)).toBeDisabled()
  expect(state.pageErrors).toEqual([])
})

test('an existing manual schedule remains available after refresh and review opens schedule assurance', async ({ page }) => {
  const state = await manualHarness(page, { schedule: true })
  const stages = page.getByRole('navigation', { name: 'Planning stages', exact: true })
  for (const label of ['Work breakdown', 'Schedule & resources', 'Review & approve', 'Publish baseline']) {
    await expect(stages.getByRole('button', { name: new RegExp(label) })).toBeEnabled()
  }
  await page.reload()
  await expect(stages.getByRole('button', { name: /Review & approve/ })).toBeEnabled()
  await stages.getByRole('button', { name: /Review & approve/ }).click()
  const areas = page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })
  await expect(areas.getByRole('button', { name: 'Schedule Assurance', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Exact calculated state review', exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
})
