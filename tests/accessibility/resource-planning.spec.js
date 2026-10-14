import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture'
import { scheduleArea } from '../fixtures/schedule-controls'

test.setTimeout(60000)

async function open(page, readOnly = false) {
  const resources = [], assignments = [], writes = []
  const state = await masterScheduleHarness(page, {
    decorateSnapshot: plan => ({ ...plan, version_id: 91, ...(readOnly ? { viewing_history: true } : {}) }),
    async handleRequest({ route, path, reply }) {
      const method = route.request().method()
      if (path.endsWith('/resources/plan/')) {
        await reply(route, { project_id: 71, version_id: 91, basis: readOnly ? 'approved_baseline' : 'current_catalog', resources, assignments,
          activities: [{ id: 501, external_id: 'C-100', name: 'Concrete foundations' }],
          permissions: { can_manage_resources: !readOnly, can_allocate: !readOnly } })
        return true
      }
      if (path.endsWith('/resources/') && method === 'POST') {
        const payload = route.request().postDataJSON()
        writes.push(payload)
        const row = { id: resources.length + 1, ...payload, can_edit: true }
        resources.push(row); await reply(route, row, 201); return true
      }
      if (path.endsWith('/assignments/') && method === 'POST') {
        const payload = route.request().postDataJSON()
        writes.push(payload)
        const row = { ...payload, id: 11, activity: Number(payload.activity), resource: Number(payload.resource), required_units: '4.00' }
        assignments.push(row); await reply(route, row, 201); return true
      }
      return false
    },
  })
  await scheduleArea(page, 'resources')
  const panel = page.getByRole('region', { name: 'Resource planning', exact: true })
  await expect(panel.getByText('No resources recorded.', { exact: true })).toBeVisible()
  return { panel, writes, state }
}

test('Resource catalog supports all types and productivity allocations with explicit units', async ({ page }) => {
  const { panel, writes, state } = await open(page)
  for (const [kind, code, rate] of [['labor', 'CREW', '2.5'], ['equipment', 'CRANE', ''], ['material', 'CONCRETE', '']]) {
    await panel.getByRole('button', { name: 'Add resource', exact: true }).click()
    const form = panel.getByRole('form', { name: 'Resource details' })
    await form.getByLabel('Resource code', { exact: true }).fill(code)
    await form.getByLabel('Resource name', { exact: true }).fill(code)
    await form.getByLabel('Resource type', { exact: true }).selectOption(kind)
    await form.getByLabel('Resource unit', { exact: true }).fill(kind === 'material' ? 'm3' : 'hour')
    await form.getByLabel('Daily capacity', { exact: true }).fill('8')
    if (rate) { await form.getByLabel('Productivity rate', { exact: true }).fill(rate); await form.getByLabel('Output unit', { exact: true }).fill('m3') }
    await form.getByRole('button', { name: 'Save resource', exact: true }).click()
    await expect(panel.getByRole('button', { name: `Edit ${code}`, exact: true })).toBeVisible()
  }
  expect(writes[1].productivity_rate).toBeNull()
  await panel.getByRole('button', { name: 'Allocate resource', exact: true }).click()
  const form = panel.getByRole('form', { name: 'Resource allocation' })
  await form.getByLabel('Allocation activity', { exact: true }).selectOption('501')
  await form.getByLabel('Allocation resource', { exact: true }).selectOption('1')
  await form.getByLabel('Planned resource units', { exact: true }).fill('5')
  await form.getByLabel('Planned output quantity', { exact: true }).fill('10')
  await form.getByRole('button', { name: 'Save allocation', exact: true }).click()
  await expect(panel.getByText('4.00 hour', { exact: true })).toBeVisible()
  expect(writes.at(-1)).toEqual({ activity: '501', resource: '1', planned_units: '5', planned_output_quantity: '10' })
  expect(writes.every(row => !('unit_cost' in row) && !('budgeted_cost' in row) && !('duration_days' in row))).toBeTruthy()
  expect(state.pageErrors).toEqual([])
  expect((await new AxeBuilder({ page }).include('.planning-resource-plan').analyze()).violations).toEqual([])
})

test('Baseline resource plan is read only and does not offer allocations', async ({ page }) => {
  const { panel, writes } = await open(page, true)
  await expect(panel.getByText('Resource inputs frozen in the approved baseline.')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Add resource', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Allocate resource', exact: true })).toHaveCount(0)
  expect(writes).toEqual([])
})
