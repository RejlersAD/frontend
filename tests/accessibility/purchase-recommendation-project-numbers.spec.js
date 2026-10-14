import { test, expect } from '@playwright/test'
import { formProject, formRecordId, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const numbers = page => page.getByRole('textbox', { name: 'Project Number', exact: true })
const save = page => page.locator('.recommendation-form-workspace').getByRole('button', { name: 'Save', exact: true }).first()
const writes = state => state.requests.filter(({ method, path }) => ['POST', 'PATCH'].includes(method)
  && /^\/api\/v1\/procurement\/requisitions\/(?:[^/]+\/)?$/.test(path))
const latestWrite = state => writes(state).at(-1)
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.submissions).toEqual([])
}

// The native API returns this read-only projection after accepting project CSV.
// Keep the shared fixture untouched and inspect the actual submitted fields.
const projectResponse = state => {
  state.record.project_numbers = String(state.record.project || '').split(',').map(value => value.trim()).filter(Boolean)
}

async function open(page, options = {}) {
  const state = await recommendationFormHarness(page, { ...options, afterSave: projectResponse })
  await expect(page.getByRole('heading', {
    name: options.edit ? 'Edit purchase recommendation' : 'Create purchase recommendation', exact: true,
  })).toBeVisible({ timeout: 90000 })
  await expect(numbers(page)).toBeVisible()
  return state
}

async function reopen(page) {
  await page.goto(`/procurement/requisitions/${formRecordId}/edit`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible()
  await expect(numbers(page)).toBeVisible()
}

test('new and existing native PRs normalize project CSV and restore the saved numbers on reopen', async ({ page }, testInfo) => {
  const state = await open(page)
  await page.getByRole('textbox', { name: 'PR number', exact: true }).fill('RAD-PRJ-PR-9001_2026')
  await numbers(page).fill(' 005901, PRJ-02, 005901, prj-02 ')
  await numbers(page).press('Tab')
  await expect(numbers(page)).toHaveValue('005901, PRJ-02')
  await save(page).click()
  await expect.poll(() => state.record.project).toBe('005901, PRJ-02')
  await expect(page.locator('.prf-save-state')).toContainText('Draft saved')
  expect(writes(state).filter(({ method }) => method === 'POST')).toHaveLength(1)
  expect(latestWrite(state).body.project).toBe('005901, PRJ-02')
  expect(latestWrite(state).body).not.toHaveProperty('project_numbers')
  expect(state.record.project_details).toEqual([
    { type: 'project', project_number: '005901', value: '005901' },
    { type: 'project', project_number: 'PRJ-02', value: 'PRJ-02' },
  ])

  await reopen(page)
  await expect(numbers(page)).toHaveValue('005901, PRJ-02')
  await numbers(page).fill('005901, PRJ-03, PRJ-03')
  await numbers(page).press('Tab')
  await save(page).click()
  await expect.poll(() => state.record.project).toBe('005901, PRJ-03')
  expect(latestWrite(state).method).toBe('PATCH')
  expect(latestWrite(state).body).not.toHaveProperty('project_numbers')
  expect(state.record.project_details.map(project => project.project_number)).toEqual(['005901', 'PRJ-03'])
  expect(state.record.project_details.every(project => !project.project_id && !project.project_name)).toBe(true)
  await reopen(page)
  await expect(numbers(page)).toHaveValue('005901, PRJ-03')
  await page.screenshot({ path: testInfo.outputPath('native-project-numbers-reopened.png') })
  clean(state)
})

test('custom Add Project splits comma entries and retains the existing selected enterprise project', async ({ page }, testInfo) => {
  const state = await open(page, { edit: true })
  await expect(numbers(page)).toHaveValue(formProject.project_number)
  await page.getByRole('button', { name: 'Create project / department with name and number', exact: true }).click()
  await page.getByRole('textbox', { name: /^Project \/ Department Number/ }).fill('5900985, PRJ-02, PRJ-03, prj-02')
  await page.getByRole('textbox', { name: /^Project \/ Department Name/ }).fill('Engineering programme')
  await page.getByRole('button', { name: 'Add to recommendation', exact: true }).click()
  await expect(numbers(page)).toHaveValue('5900985, PRJ-02, PRJ-03')
  await expect(page.getByRole('textbox', { name: 'Edit selected project or department', exact: true })).toHaveValue(formProject.label)
  const customNumbers = page.getByRole('textbox', { name: 'Project or department number', exact: true })
  const customNames = page.getByRole('textbox', { name: 'Project or department name', exact: true })
  await expect(customNumbers).toHaveCount(2)
  await expect(customNumbers.nth(0)).toHaveValue('PRJ-02')
  await expect(customNumbers.nth(1)).toHaveValue('PRJ-03')
  await expect(customNames.nth(0)).toHaveValue('Engineering programme')
  await expect(customNames.nth(1)).toHaveValue('Engineering programme')
  await save(page).click()
  await expect.poll(() => state.record.project).toBe('5900985, PRJ-02, PRJ-03')
  expect(state.record.project_details).toHaveLength(3)
  expect(state.record.project_details[0]).toEqual(formProject)
  expect(state.record.project_details.slice(1)).toEqual(['PRJ-02', 'PRJ-03'].map(projectNumber => ({
    project_number: projectNumber, project_name: 'Engineering programme',
    value: `Engineering programme (${projectNumber})`, label: `${projectNumber} - Engineering programme`,
    type: 'project', source: 'custom',
  })))
  expect(latestWrite(state).body).not.toHaveProperty('project_numbers')
  await reopen(page)
  await expect(numbers(page)).toHaveValue('5900985, PRJ-02, PRJ-03')
  await expect(customNumbers).toHaveCount(2)
  await expect(customNames.nth(1)).toHaveValue('Engineering programme')
  await expect(page.getByRole('textbox', { name: 'Edit selected project or department', exact: true })).toHaveValue(formProject.label)
  await page.screenshot({ path: testInfo.outputPath('native-project-custom-csv.png') })
  clean(state)
})

test('a failed native PR save retains the CSV and selected references for a successful retry', async ({ page }) => {
  const state = await open(page, { edit: true, concurrency: true, prepare: fixture => {
    fixture.saveError = { project: ['Project references could not be saved.'] }
  } })
  const originalRecord = structuredClone(state.record)
  await numbers(page).fill('5900985, PRJ-RETRY, prj-retry')
  await save(page).click()
  const errorDialog = page.getByRole('dialog', { name: 'Notification', exact: true })
  await expect(errorDialog).toContainText('Project references could not be saved.')
  await errorDialog.getByRole('button', { name: 'OK', exact: true }).click()
  await expect(numbers(page)).toHaveValue('5900985, PRJ-RETRY')
  await expect(save(page)).toBeEnabled()
  expect(state.record).toEqual(originalRecord)
  const failedPayload = latestWrite(state).body
  expect(failedPayload.project).toBe('5900985, PRJ-RETRY')
  expect(failedPayload.expected_updated_at).toBe(originalRecord.updated_at)
  expect(failedPayload.project_details[0]).toEqual(formProject)
  expect(failedPayload).not.toHaveProperty('project_numbers')

  state.saveError = null
  await save(page).click()
  await expect.poll(() => state.record.project).toBe('5900985, PRJ-RETRY')
  await expect(page.locator('.prf-save-state')).toContainText('Draft saved')
  expect(latestWrite(state).body.project).toBe(failedPayload.project)
  expect(latestWrite(state).body.project_details).toEqual(failedPayload.project_details)
  expect(state.record.project_details[0]).toEqual(formProject)
  expect(state.record.updated_at).not.toBe(originalRecord.updated_at)
  await reopen(page)
  await expect(numbers(page)).toHaveValue('5900985, PRJ-RETRY')
  clean(state)
})
