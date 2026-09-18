import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import AxeBuilder from '@axe-core/playwright'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture'

test.setTimeout(60000)

const input = (page, name) => name === 'Scope summary'
  ? page.getByRole('textbox', { name, exact: true })
  : name === 'Budgeted effort' ? page.getByRole('spinbutton', { name: /^Budgeted effort/ })
    : name === 'Document type' ? page.getByRole('combobox', { name, exact: true }) : page.getByLabel(name, { exact: true })
const review = page => page.getByRole('complementary', { name: 'AI input review', exact: true })
const save = page => page.getByRole('button', { name: 'Save draft', exact: true })
const writesToProject = state => state.writes.filter(row => /\/planning-intelligence\/projects\/(?:\d+\/)?$/.test(row.path))
const confirmPreview = page => page.getByRole('button', { name: /^Confirm & save.*Work breakdown$/ })
const previewNext = page => page.getByRole('button', { name: 'Next: Document Intelligence Preview', exact: true })
const previewHeading = page => page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })
const wbsStage = page => page.getByRole('navigation', { name: 'Planning stages', exact: true }).getByRole('button', { name: /Work breakdown/ })
const confirmationWrites = state => state.writes.filter(row => row.path.endsWith('/confirm-preview/'))
const noPlanBuilt = state => expect(state.requests.filter(row => row.method !== 'GET' && /\/(generate|build-workable-plan)\/$/.test(row.path))).toEqual([])
function resolveFixtureClarifications(state) {
  const record = state.records[17]
  record.conflicts = []
  record.facts.forEach(fact => { if (fact.status === 'conflicted') fact.status = fact.id === 918 ? 'confirmed' : 'rejected' })
  for (const run of record.runs) if (run.intelligence) {
    run.intelligence.open_conflicts = []
    run.intelligence.evidence_summary.conflict_count = 0
  }
}
const phaseInput = page => page.getByRole('combobox', { name: 'Phase', exact: true }).or(page.getByRole('textbox', { name: 'Phase', exact: true }))

async function setPhase(page, value) {
  const phase = phaseInput(page)
  if (await phase.evaluate(element => element.tagName === 'SELECT')) await phase.selectOption({ label: value })
  else await phase.fill(value)
  return phase.inputValue()
}

async function loaded(page) {
  await expect(page.getByRole('heading', { name: 'Project Planning', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Planning', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(input(page, 'Scope summary')).toBeVisible()
  await expect(save(page)).toBeEnabled()
  await expect(review(page)).toBeVisible()
  await expect(review(page)).not.toContainText('Loading extracted inputs')
}

async function selectProject(page, code, id) {
  const selector = page.getByRole('combobox', { name: 'Active Project', exact: true })
  await selector.fill(code)
  await selector.press('Enter')
  await expect(page).toHaveURL(new RegExp(`project=${id}(?:&|$)`))
  await loaded(page)
}

async function fitsViewport(page) {
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
    bounds: [...document.querySelectorAll('body *')].filter(element => !element.closest('.pp-tabs') && element.getBoundingClientRect().right > innerWidth + 1).slice(0, 20).map(element => ({ tag: element.tagName, className: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right), overflow: getComputedStyle(element).overflowX })),
    overflowing: [...document.querySelectorAll('.project-performance-workspace *')].filter(element => {
      for (let parent = element.parentElement; parent && !['BODY', 'HTML'].includes(parent.tagName); parent = parent.parentElement) {
        if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(parent).overflowX)) return false
      }
      return element.getBoundingClientRect().right > innerWidth + 1
    }).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right) })),
  }))
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1)
}

function clean(state) {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

test('populated planning displays the latest completed evidence with source references and real review counts', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 1050 })
  const state = await planningInputsHarness(page, { populated: true })
  await loaded(page)
  for (const label of ['Scope & inputs', 'Work breakdown', 'Schedule & resources', 'Review & approve', 'Publish baseline']) {
    await expect(page.getByRole('button', { name: new RegExp(label) }).first()).toBeVisible()
  }
  await expect(input(page, 'Scope summary')).toHaveValue(state.records[17].planningProject.scope_summary)
  await expect(page.getByRole('combobox', { name: 'Active Project', exact: true })).toHaveValue('5900913 — Residue Yield Improvement Project')
  await expect(input(page, 'Project code')).toHaveCount(0)
  await expect(input(page, 'Project name')).toHaveCount(0)
  await expect(page.locator('.pln-project-identity')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Project scope & inputs', exact: true })).toHaveCount(0)
  const inputCardOrder = await page.locator('.pln-main-column').evaluate(element => [...element.querySelectorAll(':scope > section')].map(section => section.getAttribute('aria-label') || document.getElementById(section.getAttribute('aria-labelledby'))?.textContent))
  expect(inputCardOrder).toEqual(['Planning method', 'Reference documents', 'Project scope'])
  await expect(page.getByText(/Drop files here or/)).toHaveCount(0)
  await expect(page.getByLabel('Calculated project duration', { exact: true })).toContainText('349 calendar days')
  await expect(page.getByLabel('Calculated project duration', { exact: true })).toHaveJSProperty('tagName', 'OUTPUT')
  await expect(review(page)).toContainText('Process design basis')
  await expect(review(page)).toContainText('Piping isometric drawings')
  await expect(review(page)).toContainText('5900913-scope-of-work.pdf')
  await expect(review(page)).toContainText('p. 4')
  await expect(review(page)).toContainText('Conflicting effective date values')
  await expect(review(page)).not.toContainText('Rejected foundation design')
  await expect(page.locator('.pln-metrics')).toContainText('1documents analyzed')
  await expect(page.locator('.pln-metrics')).toContainText('4requirements extracted')
  await expect(page.locator('.pln-metrics')).toContainText('1clarification open')
  const evidenceRequests = state.requests.filter(row => /intelligence-(facts|conflicts)/.test(row.path))
  expect(evidenceRequests.length).toBeGreaterThanOrEqual(2)
  expect(evidenceRequests.every(row => row.query.run === '901')).toBe(true)
  await fitsViewport(page)
  await page.screenshot({ path: '../artifacts/project-planning-populated-desktop.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
  await expect(dialog).toContainText('2026-01-05')
  await expect(dialog).toContainText('2026-01-12')
  await expect(dialog).toContainText('contract-clarification.pdf')
  await expect(dialog.getByRole('button', { name: 'Continue to work breakdown', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Review clarification', exact: true })).toBeFocused()
  expect(state.writes).toEqual([])
  clean(state)
})

test('Save draft persists scope, phase, exclusions, dates and effort while project switching keeps drafts isolated', async ({ page }) => {
  const state = await planningInputsHarness(page)
  await loaded(page)
  await expect(input(page, 'Project start date')).toBeEnabled()
  await input(page, 'Scope summary').fill('Detailed process and piping engineering with procurement support.')
  const phase = await setPhase(page, 'FEED')
  await input(page, 'Exclusions').fill('Construction supervision and civil foundations excluded.')
  await input(page, 'Project start date').fill('2026-02-02')
  await input(page, 'Project end date').fill('2026-12-14')
  await expect(page.getByLabel('Calculated project duration', { exact: true })).toContainText('315 calendar days')
  await input(page, 'Budgeted effort').fill('14825.5')
  await save(page).click()
  await expect.poll(() => writesToProject(state).length).toBe(1)
  expect(writesToProject(state)[0]).toEqual({ method: 'PATCH', path: '/api/v1/planning-intelligence/projects/71/', data: {
    planning_mode: 'document',
    scope_summary: 'Detailed process and piping engineering with procurement support.',
    exclusions: 'Construction supervision and civil foundations excluded.',
    phase, effective_date: '2026-02-02', planned_end_date: '2026-12-14', budgeted_effort_hours: '14825.5',
  } })
  await page.reload()
  await loaded(page)
  await expect(input(page, 'Scope summary')).toHaveValue('Detailed process and piping engineering with procurement support.')
  await expect(input(page, 'Project start date')).toHaveValue('2026-02-02')
  await expect(input(page, 'Project end date')).toHaveValue('2026-12-14')
  await expect(input(page, 'Budgeted effort')).toHaveValue('14825.5')
  await expect(phaseInput(page)).toHaveValue(phase)
  await input(page, 'Scope summary').fill('Unsaved first project change')
  await selectProject(page, '5900738', 18)
  await expect(input(page, 'Scope summary')).toHaveValue('Grid protection and electrical integration.')
  await expect(input(page, 'Exclusions')).toHaveValue('Civil works by others.')
  await expect(input(page, 'Budgeted effort')).toHaveValue('8000.00')
  await expect(page.getByRole('combobox', { name: 'Active Project', exact: true })).toHaveValue('5900738 — Grid Power Integration Project')
  await expect(phaseInput(page)).toHaveValue(state.records[18].planningProject.phase)
  await input(page, 'Scope summary').fill('Electrical design and grid integration only.')
  await save(page).click()
  await expect.poll(() => writesToProject(state).length).toBe(2)
  expect(writesToProject(state)[1].path).toBe('/api/v1/planning-intelligence/projects/1071/')
  expect(state.records[17].planningProject.scope_summary).toBe('Detailed process and piping engineering with procurement support.')
  await selectProject(page, '5900913', 17)
  await expect(input(page, 'Scope summary')).toHaveValue('Detailed process and piping engineering with procurement support.')
  await expect(phaseInput(page)).toHaveValue(phase)
  await expect(input(page, 'Project start date')).toBeEnabled()
  await input(page, 'Budgeted effort').fill('')
  await save(page).click()
  await expect.poll(() => writesToProject(state).length).toBe(3)
  expect(writesToProject(state)[2].data).toMatchObject({ effective_date: '2026-02-02', planned_end_date: '2026-12-14', budgeted_effort_hours: null })
  await page.reload()
  await loaded(page)
  await expect(input(page, 'Budgeted effort')).toHaveValue('')
  await expect(input(page, 'Project start date')).toHaveValue('2026-02-02')
  await expect(input(page, 'Project end date')).toHaveValue('2026-12-14')
  clean(state)
})

test('an empty project creates its planning workspace only on Save draft using the canonical enterprise project ID', async ({ page }) => {
  const state = await planningInputsHarness(page, { prepare: current => current.missingPlanning.add(17) })
  await loaded(page)
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled()
  await expect(page.getByText('No reference documents uploaded yet.', { exact: true })).toBeVisible()
  await expect(review(page)).toContainText('Awaiting documents')
  await expect(review(page)).not.toContainText('Inputs reviewed')
  await page.screenshot({ path: '../artifacts/project-planning-empty-desktop.png', fullPage: true, animations: 'disabled' })
  expect(state.writes).toEqual([])
  await input(page, 'Scope summary').fill('New planning scope for this enterprise project.')
  const phase = await setPhase(page, 'FEED')
  await input(page, 'Budgeted effort').fill('9500')
  await save(page).click()
  await expect.poll(() => writesToProject(state).length).toBe(1)
  expect(writesToProject(state)[0]).toMatchObject({ method: 'POST', path: '/api/v1/planning-intelligence/projects/', data: {
    enterprise_project: 17, name: 'Residue Yield Improvement Project', scope_summary: 'New planning scope for this enterprise project.', budgeted_effort_hours: '9500', phase,
  } })
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeEnabled()
  await page.reload()
  await loaded(page)
  await expect(input(page, 'Scope summary')).toHaveValue('New planning scope for this enterprise project.')
  expect(writesToProject(state)).toHaveLength(1)
  clean(state)
})

test('document type is preserved in multipart upload, parsing status polls, and removal is explicit', async ({ page }) => {
  const state = await planningInputsHarness(page)
  await loaded(page)
  await input(page, 'Document type').selectOption('mdr')
  const fileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await (await fileChooser).setFiles({ name: 'deliverables.csv', mimeType: 'text/csv', buffer: Buffer.from('Document,Discipline\nPiping isometric,Piping\n') })
  await expect.poll(() => state.writes.filter(row => row.method === 'POST' && row.path.endsWith('/files/')).length).toBe(1)
  expect(state.writes[0].data).toEqual({ project: '71', category: 'mdr', filename: 'deliverables.csv' })
  const documentRow = page.getByRole('row').filter({ hasText: 'deliverables.csv' })
  await expect(documentRow).toContainText('Master Deliverable Register (MDR)')
  await expect(documentRow).toContainText('Queued')
  await expect(page.getByRole('button', { name: 'Run Document Intelligence', exact: true })).toBeDisabled()
  const reads = state.fileListReads
  state.records[17].files[0].parse_status = 'done'
  await expect(documentRow).toContainText('Ready to analyze', { timeout: 10000 })
  expect(state.fileListReads).toBeGreaterThan(reads)
  await documentRow.getByLabel('Actions for deliverables.csv', { exact: true }).click()
  await documentRow.getByRole('button', { name: 'Remove document', exact: true }).click()
  await expect(documentRow).toHaveCount(0)
  expect(state.writes.filter(row => row.method === 'DELETE')).toEqual([{ method: 'DELETE', path: '/api/v1/planning-intelligence/files/851/' }])
  expect(state.records[18].files).toEqual([])
  clean(state)
})

test('required start and end dates block saving and document analysis until the range is valid', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true })
  await loaded(page)
  const start = input(page, 'Project start date'), end = input(page, 'Project end date')
  await expect(start).toHaveAttribute('required', '')
  await expect(end).toHaveAttribute('required', '')
  await expect(start).toBeEnabled()
  await start.fill('')
  await save(page).click()
  expect(await start.evaluate(element => element.validity.valueMissing)).toBe(true)
  expect(state.writes).toEqual([])
  const analyze = page.getByRole('button', { name: 'Run Document Intelligence', exact: true })
  if (await analyze.isEnabled()) await analyze.click()
  expect(state.writes).toEqual([])
  await start.fill('2028-02-28')
  await end.fill('')
  await save(page).click()
  expect(await end.evaluate(element => element.validity.valueMissing)).toBe(true)
  expect(state.writes).toEqual([])
  await end.fill('2028-02-27')
  await save(page).click()
  expect(state.writes).toEqual([])
  await end.fill('2028-03-01')
  await expect(page.getByLabel('Calculated project duration', { exact: true })).toContainText('2 calendar days')
  await save(page).click()
  await expect.poll(() => writesToProject(state).length).toBe(1)
  expect(writesToProject(state)[0].data).toMatchObject({ effective_date: '2028-02-28', planned_end_date: '2028-03-01' })
  expect(state.analysisProjects).toEqual([])
  clean(state)
})

test('Run Document Intelligence saves the latest phase and dates before starting and polling analysis', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true })
  await loaded(page)
  await expect(input(page, 'Project start date')).toBeEnabled()
  const phase = await setPhase(page, 'FEED')
  await input(page, 'Project start date').fill('2026-03-02')
  await input(page, 'Project end date').fill('2026-09-18')
  await input(page, 'Scope summary').fill('Revised FEED scope used by document intelligence.')
  const stage = page.getByRole('navigation', { name: 'Planning stages', exact: true }).getByRole('button', { name: /Work breakdown/ })
  const next = page.getByRole('button', { name: 'Next: Document Intelligence Preview', exact: true })
  await expect(stage).toBeEnabled()
  await expect(next).toBeEnabled()
  const analyze = page.getByRole('button', { name: 'Run Document Intelligence', exact: true })
  state.saveError = { detail: 'The planning draft is temporarily locked.' }
  await analyze.click()
  await expect(page.getByRole('alert').filter({ hasText: 'temporarily locked' })).toBeVisible()
  expect(state.analysisProjects).toEqual([])
  expect(state.writes.map(row => row.method)).toEqual(['PATCH'])
  await expect(input(page, 'Scope summary')).toHaveValue('Revised FEED scope used by document intelligence.')
  state.saveError = null
  await analyze.click()
  await expect.poll(() => state.analysisProjects.length).toBe(1)
  expect(state.writes.map(row => [row.method, row.path])).toEqual([
    ['PATCH', '/api/v1/planning-intelligence/projects/71/'],
    ['PATCH', '/api/v1/planning-intelligence/projects/71/'],
    ['POST', '/api/v1/planning-intelligence/projects/71/analyze/'],
  ])
  expect(state.analysisProjects[0]).toMatchObject({ phase, effective_date: '2026-03-02', planned_end_date: '2026-09-18', scope_summary: 'Revised FEED scope used by document intelligence.' })
  await expect.poll(() => state.jobReads).toBeGreaterThan(0)
  await expect(page.getByText('Document intelligence completed.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  await expect(input(page, 'Scope summary')).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Build Workable Project Plan', exact: true })).toHaveCount(0)
  await expect(confirmPreview(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Back to scope & inputs', exact: true }).click()
  await loaded(page)
  await expect(review(page)).toContainText('Process design basis')
  await setPhase(page, 'DEFINE')
  await stage.click()
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  await expect(confirmPreview(page)).toBeDisabled()
  expect(state.records[18].planningProject.scope_summary).toBe('Grid protection and electrical integration.')
  clean(state)
})

test('failed save retains user input and failed evidence shows unavailable status with a working retry', async ({ page }) => {
  const state = await planningInputsHarness(page, { prepare: current => current.failures.add('/intelligence-runs/') })
  await loaded(page)
  await expect(review(page)).toContainText('Review unavailable')
  await expect(review(page).getByRole('alert')).toContainText('Schedule service temporarily unavailable')
  await expect(review(page)).toContainText('Clarification status is unavailable.')
  await expect(page.getByRole('button', { name: 'Run Document Intelligence', exact: true })).toBeDisabled()
  state.saveError = { scope_summary: ['The planning draft is temporarily locked.'] }
  await input(page, 'Scope summary').fill('Keep this unsaved draft after an error.')
  await save(page).click()
  await expect(page.getByRole('alert').filter({ hasText: 'temporarily locked' })).toBeVisible()
  await expect(input(page, 'Scope summary')).toHaveValue('Keep this unsaved draft after an error.')
  expect(state.records[17].planningProject.scope_summary).toBe('Engineering for the residue yield improvement package.')
  state.saveError = null
  await save(page).click()
  await expect.poll(() => state.records[17].planningProject.scope_summary).toBe('Keep this unsaved draft after an error.')
  state.failures.clear()
  await review(page).getByRole('button', { name: 'Retry input review', exact: true }).click()
  await expect(review(page)).toContainText('Awaiting documents')
  await expect(review(page).getByRole('alert')).toHaveCount(0)
  state.failures.add('/enterprise-contract/')
  await page.reload()
  await loaded(page)
  await expect(page.getByRole('button', { name: 'Retry connection', exact: true })).toBeVisible()
  await input(page, 'Scope summary').fill('Keep this edit until project dates can be verified.')
  const beforeBlockedSave = state.writes.length
  await save(page).click()
  await expect(input(page, 'Scope summary')).toHaveValue('Keep this edit until project dates can be verified.')
  expect(state.writes).toHaveLength(beforeBlockedSave)
  state.failures.clear()
  await page.getByRole('button', { name: 'Retry connection', exact: true }).click()
  await expect(input(page, 'Project start date')).toBeEnabled()
  await save(page).click()
  await expect.poll(() => state.writes.length).toBe(beforeBlockedSave + 1)
  expect(state.writes.at(-1).data).toMatchObject({ scope_summary: 'Keep this edit until project dates can be verified.', effective_date: '2026-01-05', planned_end_date: '2026-12-20' })
  clean(state)
})

test('baseline locked dates stay unchanged when saving editable scope and effort', async ({ page }) => {
  const state = await planningInputsHarness(page, { handleRequest: async ({ path, record, route, reply }) => {
    if (!path.endsWith('/enterprise-contract/')) return false
    await reply(route, { project: record.planningProject, enterprise_project: record.project, linked: true, in_sync: true, differences: [], lifecycle: 'baselined', baseline_locked: true, baseline: record.baselines[0] })
    return true
  } })
  await loaded(page)
  await expect(input(page, 'Project start date')).toBeDisabled()
  await expect(input(page, 'Project end date')).toBeDisabled()
  await input(page, 'Scope summary').fill('A clarification that preserves baseline dates.')
  await input(page, 'Budgeted effort').fill('15000')
  await save(page).click()
  await expect.poll(() => writesToProject(state).length).toBe(1)
  expect(writesToProject(state)[0].data).not.toHaveProperty('effective_date')
  expect(writesToProject(state)[0].data).not.toHaveProperty('planned_end_date')
  expect(state.records[17].planningProject.effective_date).toBe('2026-01-05')
  expect(state.records[17].planningProject.planned_end_date).toBe('2026-12-20')
  clean(state)
})

test('late evidence from the previous selected project cannot populate another project', async ({ page }) => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  let delayed = false
  const state = await planningInputsHarness(page, { populated: true, handleRequest: async ({ url, path }) => {
    if (path.endsWith('/intelligence-facts/') && url.searchParams.get('run') === '901') {
      delayed = true
      await gate
    }
    return false
  } })
  await expect(input(page, 'Scope summary')).toBeVisible()
  await expect.poll(() => delayed).toBe(true)
  await selectProject(page, '5900738', 18)
  await expect(input(page, 'Scope summary')).toHaveValue('Grid protection and electrical integration.')
  release()
  await expect(review(page)).toContainText('Awaiting documents')
  await expect(review(page)).not.toContainText('Process design basis')
  await expect(review(page)).not.toContainText('Conflicting effective date values')
  expect(state.writes).toEqual([])
  clean(state)
})

test('input review saves confirmation, rejection and selected conflict evidence through the existing APIs', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true })
  await loaded(page)
  await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
  const process = dialog.getByRole('listitem').filter({ hasText: 'Process Engineering' })
  await process.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(process.getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled()
  const requirement = dialog.getByRole('listitem').filter({ hasText: 'Confirm shutdown access before tie-in work.' })
  await requirement.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(requirement.getByRole('button', { name: 'Reject', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Use this value', exact: true }).first().click()
  await expect(dialog.getByRole('button', { name: 'Use this value', exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([
    { method: 'POST', path: '/api/v1/planning-intelligence/intelligence-facts/911/review/', data: { status: 'confirmed' } },
    { method: 'POST', path: '/api/v1/planning-intelligence/intelligence-facts/915/review/', data: { status: 'rejected' } },
    { method: 'POST', path: '/api/v1/planning-intelligence/intelligence-conflicts/931/resolve/', data: { action: 'select_fact', selected_fact_id: 918 } },
  ])
  await expect(dialog.getByRole('button', { name: 'Continue to work breakdown', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('.pln-metrics')).toContainText('3requirements extracted')
  await expect(page.locator('.pln-metrics')).toContainText('0clarifications open')
  clean(state)
})

test('the existing schedule workspace preserves unsaved scope and header Save draft returns to persisted inputs', async ({ page }) => {
  const state = await planningInputsHarness(page)
  await loaded(page)
  await input(page, 'Scope summary').fill('Unsaved scope retained while reviewing the actual schedule.')
  await page.locator('summary').filter({ hasText: 'Planning tools & workspace details' }).click()
  await page.getByRole('button', { name: 'Open Planner Workspace', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activities & Gantt', exact: true })).toBeVisible()
  await expect(page.locator('#project-planning-inputs-form')).toHaveCount(1)
  await expect(input(page, 'Scope summary')).toBeHidden()
  expect(state.writes).toEqual([])
  await save(page).click()
  await expect(input(page, 'Scope summary')).toBeVisible()
  await expect(input(page, 'Scope summary')).toHaveValue('Unsaved scope retained while reviewing the actual schedule.')
  await expect.poll(() => writesToProject(state).length).toBe(1)
  expect(writesToProject(state)[0]).toMatchObject({ method: 'PATCH', path: '/api/v1/planning-intelligence/projects/71/', data: { scope_summary: 'Unsaved scope retained while reviewing the actual schedule.' } })
  await page.reload()
  await loaded(page)
  await expect(input(page, 'Scope summary')).toHaveValue('Unsaved scope retained while reviewing the actual schedule.')
  clean(state)
})

test('mobile planning and its evidence dialog fit the viewport with accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await planningInputsHarness(page, { populated: true })
  await loaded(page)
  await expect(phaseInput(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run Document Intelligence', exact: true })).toBeVisible()
  await fitsViewport(page)
  await page.screenshot({ path: '../artifacts/project-planning-populated-mobile.png', fullPage: true, animations: 'disabled' })
  const scan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  expect(bounds.height).toBeLessThanOrEqual(844)
  await fitsViewport(page)
  await page.screenshot({ path: '../artifacts/project-planning-mobile-review.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  clean(state)
})


test('the complete Document Intelligence Preview opens from review without confirmation and preserves unsaved scope on return', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true })
  await loaded(page)
  const unsavedScope = 'Unsaved scope retained while reading the full document intelligence preview.'
  await input(page, 'Scope summary').fill(unsavedScope)
  await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
  await expect(dialog.getByRole('button', { name: 'Continue to work breakdown', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Document Intelligence Preview', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const preview = page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })
  await expect(preview).toBeVisible()
  await expect(preview).toBeFocused()
  await expect(input(page, 'Scope summary')).toBeHidden()
  for (const section of ['Detected Project Name', 'Detected Effective Date', 'Detected Duration', 'RADAI Review', 'AI Scope Assessment']) {
    await expect(page.getByText(new RegExp(section + '$'))).toBeVisible()
  }
  for (const heading of ['Source Evidence', 'Disciplines', 'HSE Studies']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  await expect(page.getByText('Review process and piping deliverables before planning the tie-in sequence.', { exact: true })).toBeVisible()
  await expect(page.getByText('12 months', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Visualize/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^.*Edit$/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Build Workable Project Plan', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Generation Wizard/ })).toHaveCount(0)
  await expect(page.getByRole('checkbox', { name: /Process design basis/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Piping isometric drawings/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'HAZOP', exact: true })).toBeChecked()
  await page.getByRole('checkbox', { name: 'HAZID', exact: true }).check()
  await expect(page.getByRole('checkbox', { name: 'HAZID', exact: true })).toBeChecked()
  await expect(page.getByText('Project inputs or source documents have changed. Return to Scope & inputs and run Document Intelligence to refresh this preview.', { exact: true })).toBeVisible()
  await fitsViewport(page)
  await page.screenshot({ path: '../artifacts/project-planning-full-intelligence-preview.png', fullPage: true, animations: 'disabled' })
  await page.getByRole('button', { name: 'Back to scope & inputs', exact: true }).click()
  await loaded(page)
  await expect(input(page, 'Scope summary')).toHaveValue(unsavedScope)
  await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
  await page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true }).getByRole('button', { name: 'Document Intelligence Preview', exact: true }).click()
  await expect(preview).toBeVisible()
  await selectProject(page, '5900738', 18)
  await expect(preview).toHaveCount(0)
  await expect(review(page)).toContainText('Awaiting documents')
  await expect(page.getByText('Review process and piping deliverables before planning the tie-in sequence.', { exact: true })).toHaveCount(0)
  expect(state.writes).toEqual([])
  expect(state.requests.filter(row => row.path.endsWith('/workable-plan-status/')).every(row => row.method === 'GET')).toBe(true)
  clean(state)
})

test('a stale analysis remains available in full preview with its warning and without starting another analysis', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true, prepare: current => {
    const record = current.records[17]
    record.files.push({ ...record.files[0], id: 802, original_filename: 'updated-master-deliverables.xlsx', category: 'mdr' })
  } })
  await loaded(page)
  await expect(review(page)).toContainText('Analysis out of date')
  await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
  await expect(dialog).toContainText('Source documents have changed')
  await expect(dialog.getByRole('button', { name: 'Continue to work breakdown', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Document Intelligence Preview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  await expect(page.getByText('Project inputs or source documents have changed. Return to Scope & inputs and run Document Intelligence to refresh this preview.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Source Evidence', exact: true })).toBeVisible()
  await expect(confirmPreview(page)).toBeDisabled()
  await wbsStage(page).click()
  await expect(previewHeading(page)).toBeVisible()
  expect(state.analysisProjects).toEqual([])
  expect(state.writes).toEqual([])
  clean(state)
})

for (const viewport of [{ name: 'desktop', width: 1920, height: 935 }, { name: 'mobile', width: 390, height: 844 }, { name: 'short-height', width: 1280, height: 480 }]) {
  test(`the review dialog is centered in the ${viewport.name} viewport with a scrollable body and visible footer`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const state = await planningInputsHarness(page, { populated: true })
    await loaded(page)
    await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
    await expect(dialog).toBeVisible()
    const bounds = await dialog.boundingBox()
    expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2)
    expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(2)
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
    const body = dialog.locator('.pln-dialog-body')
    expect(await body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
    const footer = await dialog.locator('footer').boundingBox()
    expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height)
    await expect(dialog.getByRole('button', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
    await body.evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(dialog.getByRole('button', { name: 'Close input review', exact: true })).toBeVisible()
    await fitsViewport(page)
    await page.screenshot({ path: `../artifacts/project-planning-centered-review-${viewport.name}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Review clarification', exact: true })).toBeFocused()
    if (viewport.name === 'mobile') {
      await page.getByRole('button', { name: 'Review clarification', exact: true }).click()
      await dialog.getByRole('button', { name: 'Document Intelligence Preview', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
      await fitsViewport(page)
      await page.screenshot({ path: '../artifacts/project-planning-full-intelligence-mobile.png', fullPage: true, animations: 'disabled' })
      await page.getByRole('button', { name: 'Back to scope & inputs', exact: true }).click()
      await loaded(page)
    }
    expect(state.writes).toEqual([])
    clean(state)
  })
}


test('full preview selections are confirmed and saved before Work breakdown and restored after reload', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true, prepare: resolveFixtureClarifications })
  await loaded(page)
  await expect(page.getByRole('button', { name: 'Work breakdown', exact: true })).toHaveCount(0)
  await wbsStage(page).click()
  await expect(previewHeading(page)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build Workable Project Plan', exact: true })).toHaveCount(0)
  await expect(confirmPreview(page)).toBeEnabled()
  await page.getByRole('checkbox', { name: 'HAZID', exact: true }).check()
  await page.getByRole('checkbox', { name: /Piping isometric drawings/ }).uncheck()
  await page.screenshot({ path: '../artifacts/project-planning-confirm-preview-desktop.png', fullPage: true, animations: 'disabled' })
  await confirmPreview(page).click()
  await expect.poll(() => confirmationWrites(state).length).toBe(1)
  expect(confirmationWrites(state)[0]).toMatchObject({ method: 'POST', path: '/api/v1/planning-intelligence/intelligence-runs/901/confirm-preview/', data: {
    preview: { detected_project_name: 'Residue Yield Improvement Project', hse_studies: ['HAZOP', 'HAZID'], disciplines: { piping: { in_scope: true, excluded_deliverables: ['Piping isometric drawings'] } } },
  } })
  await expect(previewHeading(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Work breakdown', exact: true })).toBeVisible()
  const stored = state.records[17].runs.find(run => run.id === 901).preview_confirmation
  expect(stored).toMatchObject({ is_current: true, confirmed_by: 7 })
  await page.reload()
  await loaded(page)
  await previewNext(page).click()
  await expect(previewHeading(page)).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'HAZID', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Piping isometric drawings/ })).not.toBeChecked()
  const continueSaved = page.getByRole('button', { name: 'Continue to Work breakdown', exact: true })
  await expect(continueSaved).toBeEnabled()
  await page.getByRole('checkbox', { name: 'HAZID', exact: true }).uncheck()
  await expect(continueSaved).toHaveCount(0)
  await expect(confirmPreview(page)).toBeEnabled()
  await wbsStage(page).click()
  await expect(previewHeading(page)).toBeVisible()
  expect(confirmationWrites(state)).toHaveLength(1)
  await confirmPreview(page).click()
  await expect.poll(() => confirmationWrites(state).length).toBe(2)
  expect(confirmationWrites(state)[1].data.preview.hse_studies).toEqual(['HAZOP'])
  await expect(previewHeading(page)).toHaveCount(0)
  noPlanBuilt(state)
  clean(state)
})

test('failed preview confirmation retains edited selections and retries without leaving preview', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true, prepare: resolveFixtureClarifications })
  await loaded(page)
  await previewNext(page).click()
  await expect(previewHeading(page)).toBeVisible()
  await page.getByRole('checkbox', { name: 'HAZID', exact: true }).check()
  state.confirmError = { error: 'Preview could not be saved. Please retry.', code: 'intelligence_save_unavailable' }
  await confirmPreview(page).click()
  await expect.poll(() => confirmationWrites(state).length).toBe(1)
  await expect(page.getByText(/Preview could not be saved/)).toBeVisible()
  await expect(previewHeading(page)).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'HAZID', exact: true })).toBeChecked()
  await expect(page.getByRole('heading', { name: 'Build Workable Project Plan', exact: true })).toHaveCount(0)
  expect(state.records[17].runs.find(run => run.id === 901).preview_confirmation).toBeNull()
  state.confirmError = null
  await confirmPreview(page).click()
  await expect.poll(() => confirmationWrites(state).length).toBe(2)
  expect(confirmationWrites(state)[1].data.preview.hse_studies).toEqual(['HAZOP', 'HAZID'])
  await expect(previewHeading(page)).toHaveCount(0)
  noPlanBuilt(state)
  clean(state)
})

test('open clarifications block final confirmation until resolved through evidence review', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true })
  await loaded(page)
  await previewNext(page).click()
  await expect(previewHeading(page)).toBeVisible()
  await expect(confirmPreview(page)).toBeDisabled()
  await page.getByRole('button', { name: /Review clarification/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Use this value', exact: true }).first().click()
  await expect(dialog.getByRole('button', { name: 'Use this value', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Document Intelligence Preview', exact: true }).click()
  await expect(previewHeading(page)).toBeVisible()
  await expect(confirmPreview(page)).toBeEnabled()
  await confirmPreview(page).click()
  await expect.poll(() => confirmationWrites(state).length).toBe(1)
  await expect(previewHeading(page)).toHaveCount(0)
  noPlanBuilt(state)
  clean(state)
})

test('changed project scope requires fresh analysis and confirmation before Work breakdown', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true, prepare: resolveFixtureClarifications })
  await loaded(page)
  await previewNext(page).click()
  await confirmPreview(page).click()
  await expect(previewHeading(page)).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Planning stages', exact: true }).getByRole('button', { name: /Scope & inputs/ }).click()
  await loaded(page)
  await input(page, 'Scope summary').fill('Revised scope requires a new review before work breakdown.')
  await save(page).click()
  await expect.poll(() => writesToProject(state).length).toBe(1)
  expect(state.records[17].runs.find(run => run.id === 901).preview_confirmation.is_current).toBe(false)
  await wbsStage(page).click()
  await expect(previewHeading(page)).toBeVisible()
  await expect(confirmPreview(page)).toBeDisabled()
  expect(confirmationWrites(state)).toHaveLength(1)
  await page.getByRole('button', { name: 'Back to scope & inputs', exact: true }).click()
  await loaded(page)
  await page.getByRole('button', { name: 'Run Document Intelligence', exact: true }).click()
  await expect.poll(() => state.analysisProjects.length).toBe(1)
  await expect(previewHeading(page)).toBeVisible()
  await expect(confirmPreview(page)).toBeEnabled()
  await confirmPreview(page).click()
  await expect.poll(() => confirmationWrites(state).length).toBe(2)
  expect(confirmationWrites(state)[1].path).toBe('/api/v1/planning-intelligence/intelligence-runs/903/confirm-preview/')
  await expect(previewHeading(page)).toHaveCount(0)
  noPlanBuilt(state)
  clean(state)
})


test('queued reference documents keep final confirmation blocked while full preview remains readable', async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true, prepare: current => {
    resolveFixtureClarifications(current)
    current.records[17].files[0].parse_status = 'processing'
  } })
  await loaded(page)
  await expect(page.getByRole('button', { name: 'Run Document Intelligence', exact: true })).toBeDisabled()
  await previewNext(page).click()
  await expect(previewHeading(page)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Source Evidence', exact: true })).toBeVisible()
  await expect(confirmPreview(page)).toBeDisabled()
  await wbsStage(page).click()
  await expect(previewHeading(page)).toBeVisible()
  expect(state.writes).toEqual([])
  clean(state)
})


test('reconfirming a preview opens its work breakdown without building or reusing an older schedule', async ({ page }) => {
  const previousConfirmation = '2026-09-15T06:34:00Z'
  let statusReads = 0
  const state = await planningInputsHarness(page, {
    populated: true,
    prepare(current) {
      resolveFixtureClarifications(current)
      const run = current.records[17].runs.find(item => item.id === 901)
      run.preview_confirmation = {
        confirmed_at: previousConfirmation, confirmed_by: 7, is_current: true,
        preview: {
          detected_project_name: 'Residue Yield Improvement Project', detected_effective_date_text: '2026-01-05', detected_duration_months: 12,
          disciplines: {
            process: { in_scope: true, deliverables: ['Process design basis'], excluded_deliverables: [] },
            piping: { in_scope: true, deliverables: ['Piping isometric drawings'], excluded_deliverables: [] },
          },
          hse_studies: ['HAZOP'],
        },
      }
    },
    async handleRequest({ path, route, reply }) {
      if (!path.endsWith('/workable-plan-status/')) return false
      statusReads += 1
      await reply(route, {
        job: {
          id: 995, project: 71, job_type: 'workable_plan', status: 'succeeded', terminal: true, progress: 100,
          message: 'Earlier plan completed.', progress_log: [],
          result_data: {
            state: 'ready_for_approval', can_approve: true, preview_confirmation_at: previousConfirmation,
            document_intelligence_run_id: 901, decision_sheet: {},
            summary: { schedule_version_id: 91, activity_count: 6, relationship_count: 4 },
          },
        },
        baseline: null,
      })
      return true
    },
  })
  await loaded(page)
  await previewNext(page).click()
  await expect(page.getByRole('button', { name: 'Continue to Work breakdown', exact: true })).toBeEnabled()
  await page.getByRole('checkbox', { name: 'HAZID', exact: true }).check()
  await expect(confirmPreview(page)).toBeEnabled()
  await confirmPreview(page).click()
  await expect.poll(() => confirmationWrites(state).length).toBe(1)
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/work-breakdown/')).length).toBeGreaterThan(0)
  await expect(previewHeading(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toBeVisible()
  expect(statusReads).toBe(0)
  await expect(page.getByRole('heading', { name: 'Workable plan ready', exact: true })).toHaveCount(0)
  expect(state.records[17].runs.find(run => run.id === 901).preview_confirmation.confirmed_at).not.toBe(previousConfirmation)
  noPlanBuilt(state)
  clean(state)
})
