import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture'

test.setTimeout(60000)

async function open(page, readOnly = false, populated = false) {
  const resources = populated ? [
    ['CIVIL_ENGINEER', 'Civil Engineer'], ['COMPANY', 'Company'], ['DISCIPLINE_ENGINEER', 'Discipline Engineer'],
    ['DOCUMENT_CONTROL', 'Document Control'], ['ELECTRICAL_ENGINEER', 'Electrical Engineer'],
    ['INSTRUMENTATION_ENGINEER', 'Instrumentation Engineer'], ['LEAD_PIPING_ENGINEER', 'Lead Piping Engineer'],
    ['LEAD_PROCESS_ENGINEER', 'Lead Process Engineer'], ['MECHANICAL_ENGINEER', 'Mechanical Engineer'], ['PROJECT_MANAGER', 'Project Manager'],
  ].map(([code, name], index) => ({ id: index + 1, code, name, resource_type: 'labor', unit: 'hour', capacity_units_per_day: '8.00', productivity_rate: null, can_edit: true })) : []
  const assignments = populated ? [{ id: 11, resource: '1', activity: 501, planned_units: '8.00', planned_output_quantity: null, required_units: null }] : []
  const writes = []
  const state = await planningInputsHarness(page, {
    harnessPath: '/tests/fixtures/project-performance-harness.jsx',
    query: 'project=17&view=plan-baseline&scheduleTab=resources&shell=true',
    prepare(current) { current.records[17].workspace.can_edit = !readOnly },
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
  const panel = page.getByRole('region', { name: 'Resource planning', exact: true })
  if (!populated) await expect(panel.getByText('No resources recorded.', { exact: true })).toBeVisible()
  else await expect(panel.getByRole('button', { name: 'Edit CIVIL_ENGINEER', exact: true })).toBeVisible()
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


test('retained Resources tab has full-width separated columns and an accessible inline editor', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const { panel, writes, state } = await open(page, false, true)
  const table = panel.locator('.prp-resource-table')
  const bounds = await panel.boundingBox()
  expect((await table.boundingBox()).width).toBeGreaterThan(bounds.width - 12)
  const cells = await table.locator('tbody tr').first().locator('td').evaluateAll(items => items.map(cell => ({ x: cell.getBoundingClientRect().x, width: cell.getBoundingClientRect().width, padding: parseFloat(getComputedStyle(cell).paddingLeft) })))
  cells.forEach((cell, index) => {
    expect(cell.padding).toBeGreaterThanOrEqual(12)
    if (index) expect(cell.x).toBeGreaterThanOrEqual(cells[index - 1].x + cells[index - 1].width - 1)
  })
  await expect(panel.getByRole('button', { name: 'Delete CIVIL_ENGINEER', exact: true })).toBeDisabled()
  await expect(panel.getByRole('button', { name: 'Delete COMPANY', exact: true })).toBeEnabled()
  const edit = panel.getByRole('button', { name: 'Edit CIVIL_ENGINEER', exact: true })
  await edit.click()
  const form = panel.getByRole('form', { name: 'Resource details', exact: true })
  await expect(form.getByLabel('Resource code', { exact: true })).toBeFocused()
  expect((await form.boundingBox()).y).toBeLessThan((await table.boundingBox()).y)
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(edit).toBeFocused()
  expect(writes).toEqual([])
  expect(state.pageErrors).toEqual([])
  const scan = await new AxeBuilder({ page }).include('.planning-resource-plan').analyze()
  expect(scan.violations).toEqual([])
  await panel.screenshot({ path: '../artifacts/resources-tab-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const scroll = panel.getByRole('region', { name: 'Project resource catalog table', exact: true })
  expect(await scroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true)
  await panel.getByRole('button', { name: 'Add resource', exact: true }).click()
  const mobileForm = panel.getByRole('form', { name: 'Resource details', exact: true })
  const formBounds = await mobileForm.boundingBox()
  expect(formBounds.x).toBeGreaterThanOrEqual(0)
  expect(formBounds.x + formBounds.width).toBeLessThanOrEqual(391)
  await expect(mobileForm.getByLabel('Resource code', { exact: true })).toBeFocused()
  await panel.screenshot({ path: '../artifacts/resources-tab-mobile.png' })
})
