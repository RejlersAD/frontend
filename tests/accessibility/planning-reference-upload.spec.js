import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture'

test.setTimeout(60000)

const upload = page => page.getByRole('button', { name: 'Upload', exact: true })
const scope = page => page.getByRole('textbox', { name: 'Scope summary', exact: true })
const start = page => page.getByLabel('Project start date', { exact: true })
const end = page => page.getByLabel('Project end date', { exact: true })
const workspaceWrites = state => state.writes.filter(write => /\/planning-intelligence\/projects\/(?:\d+\/)?$/.test(write.path))
const fileWrites = state => state.writes.filter(write => write.method === 'POST' && write.path.endsWith('/files/'))
const file = name => ({ name, mimeType: 'text/plain', buffer: Buffer.from('Approved project reference\n') })

async function chooseFiles(page, files = file('project-scope.txt')) {
  const chooser = page.waitForEvent('filechooser')
  await upload(page).click()
  await (await chooser).setFiles(files)
}

async function missingWorkspace(page, prepare) {
  const state = await planningInputsHarness(page, { prepare(current) {
    current.missingPlanning.add(17)
    prepare?.(current)
  } })
  await expect(upload(page)).toBeEnabled()
  return state
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.analysisProjects).toEqual([])
}

for (const dates of [{ name: 'blank', start: '', end: '' }, { name: 'invalid', start: '2026-12-20', end: '2026-01-05' }]) {
  test(`first reference upload creates the linked workspace with ${dates.name} dates and preserves unsaved inputs`, async ({ page }) => {
    const state = await missingWorkspace(page)
    await scope(page).fill('Unsaved scope must remain editable after the first upload.')
    await page.getByRole('textbox', { name: 'Phase', exact: true }).fill('Phase 1')
    await start(page).fill(dates.start)
    await end(page).fill(dates.end)
    await page.getByRole('combobox', { name: 'Document type', exact: true }).selectOption('mdr')
    await chooseFiles(page, [file('deliverables.txt'), file('delivery-notes.txt')])
    await expect(page.getByRole('row').filter({ hasText: 'delivery-notes.txt' })).toBeVisible()
    expect(workspaceWrites(state)).toEqual([{ method: 'POST', path: '/api/v1/planning-intelligence/projects/', data: {
      enterprise_project: 17, name: 'Residue Yield Improvement Project', client: 'ADNOC Refining', location: 'Abu Dhabi', planning_mode: 'document',
    } }])
    expect(fileWrites(state).map(write => write.data)).toEqual([
      { project: '71', category: 'mdr', filename: 'deliverables.txt' },
      { project: '71', category: 'mdr', filename: 'delivery-notes.txt' },
    ])
    await expect(scope(page)).toHaveValue('Unsaved scope must remain editable after the first upload.')
    await expect(page.getByRole('textbox', { name: 'Phase', exact: true })).toHaveValue('Phase 1')
    await expect(start(page)).toHaveValue(dates.start)
    await expect(end(page)).toHaveValue(dates.end)
    expect(state.records[17].planningProject.scope_summary).not.toBe('Unsaved scope must remain editable after the first upload.')
    clean(state)
  })
}

test('existing workspace upload keeps unsaved scope and dates without saving the project', async ({ page }) => {
  const state = await planningInputsHarness(page)
  await expect(upload(page)).toBeEnabled()
  const savedScope = state.records[17].planningProject.scope_summary
  await scope(page).fill('These changes are not ready to save.')
  await start(page).fill('')
  await chooseFiles(page)
  await expect(page.getByRole('row').filter({ hasText: 'project-scope.txt' })).toBeVisible()
  expect(workspaceWrites(state)).toEqual([])
  expect(fileWrites(state)).toHaveLength(1)
  expect(state.records[17].planningProject.scope_summary).toBe(savedScope)
  await expect(scope(page)).toHaveValue('These changes are not ready to save.')
  await expect(start(page)).toHaveValue('')
  clean(state)
})

test('manual planning can upload optional references before saving scope', async ({ page }) => {
  const state = await missingWorkspace(page, current => {
    current.records[17].project.custom_fields = { project_type: 'software', department: 'IT' }
  })
  const method = page.getByRole('combobox', { name: 'Planning method', exact: true })
  await expect(method).toHaveValue('manual')
  await scope(page).fill('Launch the tested application.')
  await chooseFiles(page, file('release-checklist.txt'))
  await expect(page.getByRole('row').filter({ hasText: 'release-checklist.txt' })).toBeVisible()
  expect(workspaceWrites(state)).toHaveLength(1)
  expect(workspaceWrites(state)[0].data.planning_mode).toBe('manual')
  await expect(method).toHaveValue('manual')
  await expect(scope(page)).toHaveValue('Launch the tested application.')
  await expect(page.getByRole('button', { name: 'Save & continue to Work breakdown', exact: true })).toBeVisible()
  clean(state)
})

test('workspace creation failure explains the server error and retry retains the selected project and inputs', async ({ page }) => {
  const state = await missingWorkspace(page)
  await scope(page).fill('Retain this scope after a denied upload.')
  state.saveError = { detail: 'You cannot create a planning workspace for this enterprise project.' }
  await chooseFiles(page)
  await expect(page.getByRole('alert').filter({ hasText: 'You cannot create a planning workspace for this enterprise project.' })).toBeVisible()
  expect(fileWrites(state)).toEqual([])
  expect(state.missingPlanning.has(17)).toBe(true)
  await expect(scope(page)).toHaveValue('Retain this scope after a denied upload.')
  await expect(upload(page)).toBeEnabled()
  state.saveError = null
  await chooseFiles(page)
  await expect(page.getByRole('row').filter({ hasText: 'project-scope.txt' })).toBeVisible()
  expect(workspaceWrites(state)).toHaveLength(2)
  expect(fileWrites(state)).toHaveLength(1)
  expect(state.missingPlanning.has(17)).toBe(false)
  await expect(scope(page)).toHaveValue('Retain this scope after a denied upload.')
  clean(state)
})

test('failed first file upload retries using the existing workspace without duplicate creation', async ({ page }) => {
  const state = await missingWorkspace(page)
  await scope(page).fill('Scope stays here until Save draft.')
  state.uploadError = { detail: 'You cannot upload documents to this planning workspace.' }
  await chooseFiles(page)
  await expect(page.getByRole('alert').filter({ hasText: 'You cannot upload documents to this planning workspace.' })).toBeVisible()
  expect(workspaceWrites(state)).toHaveLength(1)
  expect(fileWrites(state)).toHaveLength(1)
  expect(state.records[17].files).toEqual([])
  await expect(scope(page)).toHaveValue('Scope stays here until Save draft.')
  state.uploadError = null
  await chooseFiles(page)
  await expect(page.getByRole('row').filter({ hasText: 'project-scope.txt' })).toBeVisible()
  expect(workspaceWrites(state)).toHaveLength(1)
  expect(fileWrites(state)).toHaveLength(2)
  expect(fileWrites(state).every(write => write.data.project === '71')).toBe(true)
  await expect(scope(page)).toHaveValue('Scope stays here until Save draft.')
  clean(state)
})

test('cancelling reference file selection does not create a planning workspace', async ({ page }) => {
  const state = await missingWorkspace(page)
  await chooseFiles(page, [])
  await expect(upload(page)).toBeEnabled()
  expect(state.writes).toEqual([])
  expect(state.missingPlanning.has(17)).toBe(true)
  clean(state)
})

test('oversized reference selection is rejected before workspace creation or upload', async ({ page }) => {
  const state = await missingWorkspace(page)
  await page.getByLabel('Upload reference documents', { exact: true }).evaluate(element => {
    const selection = new DataTransfer()
    selection.items.add(new File([new Uint8Array(100 * 1024 * 1024 + 1)], 'too-large.pdf', { type: 'application/pdf' }))
    element.files = selection.files
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(page.getByRole('alert').filter({ hasText: 'too-large.pdf exceeds 100 MB' })).toBeVisible()
  expect(state.writes).toEqual([])
  expect(state.missingPlanning.has(17)).toBe(true)
  await expect(upload(page)).toBeEnabled()
  clean(state)
})
