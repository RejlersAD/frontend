import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { estimateHarness, estimateWorkbook } from '../fixtures/estimate-control.fixture'

test.setTimeout(60000)
const region = (page, name) => page.getByRole('region', { name, exact: true })
const workAreas = page => page.getByRole('navigation', { name: 'Project work areas', exact: true })

async function loaded(page) {
  await expect(page.getByRole('heading', { name: 'Project Estimates', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Management', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
}

async function noHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: innerWidth, document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('.project-performance-workspace *')].filter(element => {
      for (let parent = element.parentElement; parent && !['BODY', 'HTML'].includes(parent.tagName); parent = parent.parentElement) {
        if (['hidden', 'auto', 'scroll', 'clip'].includes(getComputedStyle(parent).overflowX)) return false
      }
      return element.getBoundingClientRect().right > innerWidth + 1
    }).slice(0, 12).map(element => ({ tag: element.tagName, className: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right) })),
  }))
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function accessible(page, selector = '.project-performance-workspace') {
  const scan = await new AxeBuilder({ page }).include(selector).analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
}

async function selectMatching(select, pattern) {
  const option = select.getByRole('option').filter({ hasText: pattern }).first()
  await select.selectOption(await option.evaluate(element => element.value))
}

const version = page => page.getByRole('combobox', { name: 'Estimate version', exact: true })
const comparison = page => page.getByRole('combobox', { name: 'Compare with', exact: true })
const breakdown = page => region(page, 'Estimate breakdown')

async function newEstimateDialog(page, name) {
  const menu = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^New estimate$/ }) })
  await menu.locator('summary').click()
  await menu.getByRole('button', { name, exact: true }).click()
  const dialog = page.getByRole('dialog', { name, exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}
async function builder(page) {
  await page.getByRole('button', { name: 'Estimate builder', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Estimate builder', exact: true })).toHaveAttribute('aria-pressed', 'true')
}
async function editLine(page, description) {
  await page.getByRole('button', { name: `Edit ${description}`, exact: true }).click()
  return page.getByRole('dialog', { name: 'Edit cost item', exact: true })
}

test('desktop estimates show recorded versions, compatible comparison, cost classifications, and source notes', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await estimateHarness(page)
  await loaded(page)
  await expect(version(page)).toHaveValue('5105')
  await expect(comparison(page)).toHaveValue('5104')
  for (const title of ['Estimate composition', 'Estimate actions', 'Estimate breakdown', 'Selected package', 'Basis, assumptions & exclusions', 'Version & approval', 'Estimate data quality']) await expect(region(page, title)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Change vs v2/ })).toContainText(/450,000|450k/i)
  await expect(region(page, 'Basis, assumptions & exclusions')).toContainText('September engineering quantities')
  await expect(region(page, 'Version & approval')).toContainText('Draft')
  await expect(region(page, 'Estimate composition')).toContainText('Not modelled')
  expect(state.requests.some(request => request.path.endsWith('/estimates/') && request.query.page === '2')).toBe(true)
  expect(state.writes).toEqual([])
  expect(state.unknown).toEqual([])
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/estimate-control-desktop.png', animations: 'disabled' })
  await accessible(page)
})

test('version and comparison selection separate different kinds and currencies and show recorded trend', async ({ page }) => {
  const state = await estimateHarness(page, { prepare: current => {
    Object.assign(current.records[17].estimates.find(item => item.id === 5106), { kind: 'revised', kind_display: 'Revised', version: 4 })
  } })
  await loaded(page)
  const composition = region(page, 'Estimate composition')
  await comparison(page).selectOption('5101')
  await expect(composition).toContainText(/different kinds|same kind/i)
  await comparison(page).selectOption('5104')
  await expect(page.getByRole('button', { name: /^Change vs v2/ })).toContainText(/450,000|450k/i)
  await composition.getByRole('button', { name: 'Trend', exact: true }).click()
  await expect(composition).toContainText(/recorded.*version|draft.*change|not.*sealed/i)
  await comparison(page).selectOption('5106')
  await composition.getByRole('button', { name: 'Waterfall', exact: true }).click()
  await expect(composition).toContainText(/different.*currenc|currency conversion/i)
  await version(page).selectOption('5106')
  await expect(region(page, 'Version & approval')).toContainText('USD')
  await expect(breakdown(page)).not.toContainText('Civil construction works')
  expect(state.writes).toEqual([])
})

test('cost item filters, grouping, changed-only view, and package selection use persisted line differences', async ({ page }) => {
  await estimateHarness(page)
  await loaded(page)
  await page.getByRole('searchbox', { name: 'Search cost item', exact: true }).fill('Piping')
  await expect(breakdown(page)).toContainText('Piping')
  await expect(breakdown(page)).not.toContainText('Civil construction works')
  await page.getByRole('searchbox', { name: 'Search cost item', exact: true }).fill('')
  await selectMatching(page.getByRole('combobox', { name: 'Discipline', exact: true }), /^Civil$/)
  await expect(breakdown(page)).toContainText('Civil')
  await expect(breakdown(page)).not.toContainText('Piping materials package')
  await selectMatching(page.getByRole('combobox', { name: 'Discipline', exact: true }), /^All/)
  await page.getByRole('checkbox', { name: 'Show changed only', exact: true }).check()
  await expect(breakdown(page)).not.toContainText('Process engineering hours')
  await page.getByRole('checkbox', { name: 'Show changed only', exact: true }).uncheck()
  await page.getByRole('combobox', { name: 'Group by', exact: true }).selectOption('discipline')
  await expect(breakdown(page)).toContainText('Mechanical')
  await breakdown(page).getByRole('button', { name: /Mechanical/ }).first().click()
  await expect(region(page, 'Selected package')).toContainText('Mechanical')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await selectMatching(page.getByRole('combobox', { name: 'Status', exact: true }), /^Approved$/)
  await expect(version(page).getByRole('option', { name: /Supplier package in USD/ })).toHaveCount(0)
  await expect(version(page).locator('option:checked')).toContainText('September working estimate')
})

test('blank creation, draft header edits, and cost item create edit removal persist recalculated totals', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  let dialog = await newEstimateDialog(page, 'Blank estimate')
  await dialog.getByLabel('Estimate title', { exact: true }).fill('Mechanical budget draft')
  await dialog.getByRole('combobox', { name: 'Estimate kind', exact: true }).selectOption('estimate')
  await dialog.getByLabel('Currency', { exact: true }).fill('AED')
  await dialog.getByLabel('Snapshot date', { exact: true }).fill('2026-09-15')
  await dialog.getByRole('textbox', { name: 'Notes', exact: true }).fill('Basis: Vendor budget quotation. Assumption: standard working hours.')
  await dialog.getByRole('button', { name: 'Create estimate', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const created = state.records[17].estimates.find(item => item.title === 'Mechanical budget draft')
  expect(created).toMatchObject({ project: 17, version: 2, status: 'draft', total_amount: '0.00' })
  await builder(page)
  await page.getByRole('button', { name: 'Add cost item', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Add cost item', exact: true })
  await dialog.getByLabel('Quantity', { exact: true }).fill('2.5')
  await dialog.getByLabel('Unit rate', { exact: true }).fill('4.25')
  await expect(dialog).toContainText('AED 10.62')
  await expect(dialog.getByRole('checkbox', { name: 'Use explicit line total', exact: true })).not.toBeChecked()
  for (const [label, value] of [['WBS code', '02.03'], ['Description', 'Mechanical site review'], ['Discipline', 'Mechanical'], ['Category', 'Direct'], ['Unit', 'hr'], ['Quantity', '10'], ['Unit rate', '125']]) await dialog.getByLabel(label, { exact: true }).fill(value)
  await dialog.getByRole('button', { name: 'Add cost item', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(created.total_amount).toBe('1250.00')
  dialog = await editLine(page, 'Mechanical site review')
  await dialog.getByLabel('Quantity', { exact: true }).fill('12')
  await dialog.getByRole('button', { name: 'Save cost item', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(created.total_amount).toBe('1500.00')
  await page.getByRole('button', { name: 'Edit estimate', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Edit estimate', exact: true })
  await dialog.getByLabel('Estimate title', { exact: true }).fill('Mechanical budget review')
  await dialog.getByRole('button', { name: 'Save estimate', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(created.title).toBe('Mechanical budget review')
  dialog = await editLine(page, 'Mechanical site review')
  await dialog.getByRole('button', { name: 'Remove cost item', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Remove cost item', exact: true })
  await confirmation.getByRole('button', { name: 'Confirm removal', exact: true }).click()
  await expect(confirmation).toHaveCount(0)
  expect(created.line_items).toEqual([])
  expect(created.total_amount).toBe('0.00')
  expect(state.writes.some(write => write.method === 'DELETE' && write.path.includes('/estimate-line-items/'))).toBe(true)
})

test('copying an approved version creates a new draft without changing its source', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  await version(page).selectOption('5104')
  const original = structuredClone(state.records[17].estimates.find(item => item.id === 5104))
  const dialog = await newEstimateDialog(page, 'Copy version')
  await dialog.getByLabel('Version title', { exact: true }).fill('August scope review copy')
  await dialog.getByRole('button', { name: 'Copy version', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const copy = state.records[17].estimates.find(item => item.title === 'August scope review copy')
  expect(copy).toMatchObject({ project: 17, kind: 'revised', version: 4, status: 'draft', currency: 'AED', total_amount: '11700000.00', line_item_count: 6 })
  expect(copy.line_items.every(line => line.estimate === copy.id)).toBe(true)
  expect(state.records[17].estimates.find(item => item.id === 5104)).toEqual(original)
  expect(state.writes[0]).toMatchObject({ method: 'POST', path: '/api/v1/project-control/estimates/5104/copy-version/', body: { title: 'August scope review copy' } })
})

test('copying a legacy summary-only estimate preserves its recorded amount and cannot approve missing cost lines', async ({ page }) => {
  const state = await estimateHarness(page, { prepare: current => {
    Object.assign(current.records[17].estimates.find(item => item.id === 5104), { title: 'Legacy commercial summary', line_items: [], line_item_count: 0, notes: 'Recorded commercial total; detailed cost lines were not supplied.' })
  } })
  await loaded(page)
  await version(page).selectOption('5104')
  const source = structuredClone(state.records[17].estimates.find(item => item.id === 5104))
  const dialog = await newEstimateDialog(page, 'Copy version')
  await expect(dialog).toContainText('AED 11,700,000.00')
  await expect(dialog).toContainText('Its cost items do not reconcile to that amount')
  await dialog.getByLabel('Version title', { exact: true }).fill('Legacy summary review draft')
  await dialog.getByRole('button', { name: 'Copy version', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const copy = state.records[17].estimates.find(item => item.title === 'Legacy summary review draft')
  expect(copy).toMatchObject({ status: 'draft', currency: 'AED', total_amount: '11700000.00', line_item_count: 0, line_items: [] })
  await expect(version(page)).toHaveValue(String(copy.id))
  await expect(page.getByRole('button', { name: /^Total estimate/ })).toContainText('AED 11.7m')
  await expect(region(page, 'Estimate actions')).toContainText('Review estimate total reconciliation')
  await expect(region(page, 'Version & approval').getByRole('button', { name: 'Approve estimate', exact: true })).toBeDisabled()
  expect(state.records[17].estimates.find(item => item.id === 5104)).toEqual(source)
})

test('recorded line overrides survive descriptive edits and calculated edits use quantity times rate', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  await builder(page)
  let dialog = await editLine(page, 'Civil construction works')
  await expect(dialog.getByRole('checkbox', { name: 'Use explicit line total', exact: true })).toBeChecked()
  await expect(dialog.getByLabel('Explicit line total', { exact: true })).toHaveValue(/^2700000(?:\.00)?$/)
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Civil construction source amount')
  await dialog.getByRole('button', { name: 'Save cost item', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const estimate = state.records[17].estimates.find(item => item.id === 5105)
  expect(estimate.line_items.find(line => line.id === 51054).line_total).toBe('2700000.00')
  dialog = await editLine(page, 'Civil construction source amount')
  await dialog.getByRole('checkbox', { name: 'Use explicit line total', exact: true }).uncheck()
  await dialog.getByLabel('Quantity', { exact: true }).fill('21000')
  await dialog.getByRole('button', { name: 'Save cost item', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(estimate.line_items.find(line => line.id === 51054).line_total).toBe('2730000.00')
  expect(estimate.total_amount).toBe('12180000.00')
})

test('Excel import submits a real workbook and preserves source rows, selected currency, and explicit zero', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  const dialog = await newEstimateDialog(page, 'Import Excel')
  await dialog.getByLabel('Excel file', { exact: true }).setInputFiles(estimateWorkbook())
  await dialog.getByLabel('Estimate title', { exact: true }).fill('Imported package review')
  await dialog.getByRole('combobox', { name: 'Estimate kind', exact: true }).selectOption('estimate')
  await dialog.getByLabel('Currency', { exact: true }).fill('USD')
  await dialog.getByRole('button', { name: 'Import workbook', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const imported = state.records[17].estimates.find(item => item.title === 'Imported package review')
  expect(imported).toMatchObject({ source: 'excel', status: 'draft', currency: 'USD', total_amount: '1250.00', line_item_count: 2 })
  expect(imported.line_items[1]).toMatchObject({ description: 'Client supplied spare', line_total: '0.00' })
  expect(imported.source_document).toBeTruthy()
  expect(state.writes[0]).toMatchObject({ method: 'POST', path: '/api/v1/project-control/documents/import-boq/', body: { project: '17', currency: 'USD', kind: 'estimate', file: { filename: 'Estimate-browser-fixture.xlsx' } } })
  expect(state.writes[0].body.file.bytes).toBeGreaterThan(1000)
})

test('basis notes persist as plain text and failed saves preserve the draft for retry', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  await region(page, 'Basis, assumptions & exclusions').getByRole('button', { name: /Edit basis|Edit notes/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Estimate basis', exact: true })
  await dialog.getByRole('textbox', { name: 'Estimate basis notes', exact: true }).fill('Basis: Quantities from drawing revision C.\nAssumption: One shutdown window.\nExclusion: Client furnished equipment.')
  state.saveFailure = true
  await dialog.getByRole('button', { name: 'Save basis', exact: true }).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog.getByRole('textbox', { name: 'Estimate basis notes', exact: true })).toHaveValue(/drawing revision C/)
  state.saveFailure = false
  await dialog.getByRole('button', { name: 'Save basis', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.records[17].estimates.find(item => item.id === 5105).notes).toContain('One shutdown window.')
  expect(state.writes.at(-1)).toMatchObject({ method: 'PATCH', body: { notes: expect.stringContaining('drawing revision C') } })
})

test('approval requires explicit confirmation and locks the approved estimate and its lines', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  await region(page, 'Version & approval').getByRole('button', { name: /Approve estimate/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Approve estimate', exact: true })
  await expect(dialog).toContainText(/lock|cannot.*edit|read.only/i)
  expect(state.writes).toEqual([])
  await dialog.getByRole('button', { name: 'Approve estimate', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(region(page, 'Version & approval')).toContainText('Approved')
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0]).toMatchObject({ method: 'POST', path: '/api/v1/project-control/estimates/5105/approve/' })
  await builder(page)
  await expect(page.getByRole('button', { name: 'Add cost item', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Edit Process engineering hours', exact: true })).toBeDisabled()
  await expect(page.getByText(/Approved by Maya|Finance approval complete|Baseline automatically updated/i)).toHaveCount(0)
})

test('CSV export retains unfiltered selected line amounts and source currency', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  await page.getByRole('searchbox', { name: 'Search cost item', exact: true }).fill('Piping')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export estimate/i }).click()
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/\.csv$/i)
  const csv = await readFile(await download.path(), 'utf8')
  for (const value of ['5900913', 'September working estimate', 'AED', 'Piping materials package', 'Civil construction works', '2700000']) expect(csv).toContain(value)
  expect(csv).not.toContain('Supplier package in USD')
  expect(state.writes).toEqual([])
})

test('Refresh and project selection load the correct estimate project and keep the active work area', async ({ page }) => {
  const state = await estimateHarness(page)
  await loaded(page)
  state.records[17].estimates.find(item => item.id === 5105).title = 'Updated September review'
  state.records[17].project.client_name = 'Updated Refining Client'
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(version(page).locator('option:checked')).toContainText('Updated September review')
  await expect(page.getByText('Client: Updated Refining Client', { exact: true })).toBeVisible()
  const project = page.getByRole('combobox', { name: 'Active Project', exact: true })
  await project.fill('5900738')
  await project.press('Enter')
  await expect(page).toHaveURL(/project=18/)
  await expect(page).toHaveURL(/view=estimates/)
  await expect(version(page)).toHaveValue('6105')
  await expect(version(page).locator('option:checked')).toContainText('September working estimate')
  expect(state.requests.some(request => request.project === 18 && request.path.endsWith('/estimates/6105/'))).toBe(true)
  expect(state.unknown).toEqual([])
})

test('empty versions, unavailable detail, and unavailable register keep zero separate from missing data', async ({ page }) => {
  const state = await estimateHarness(page, { prepare: current => { current.records[17].estimates = [] } })
  await loaded(page)
  await expect(page.getByText(/No estimates recorded\. Create a blank estimate/)).toBeVisible()
  state.failures.add('/estimates/')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText(/unavailable|could not|failed/i)
  state.failures.clear()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(state.writes).toEqual([])
})

test('unavailable selected details and read-only capabilities do not expose editable lines', async ({ page }) => {
  const state = await estimateHarness(page, { prepare: current => { current.failures.add('/estimates/5105/') } })
  await loaded(page)
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(breakdown(page)).toContainText(/unavailable|not available/i)
  state.failures.clear()
  state.canWrite = false
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await builder(page)
  await expect(page.getByRole('button', { name: 'Add cost item', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Edit Civil construction works', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([])
})

test('mobile estimate management and cost-item dialogs fit, pass accessibility, and restore focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await estimateHarness(page)
  await loaded(page)
  await noHorizontalOverflow(page)
  await page.screenshot({ path: '../artifacts/estimate-control-mobile.png', animations: 'disabled' })
  await page.screenshot({ path: '../artifacts/estimate-control-mobile-full.png', fullPage: true, animations: 'disabled' })
  await accessible(page)
  await builder(page)
  const add = page.getByRole('button', { name: 'Add cost item', exact: true })
  await add.click()
  const dialog = page.getByRole('dialog', { name: 'Add cost item', exact: true })
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  expect(bounds.height).toBeLessThanOrEqual(844)
  await accessible(page, 'dialog')
  await page.keyboard.press('Escape')
  await expect(add).toBeFocused()
  await workAreas(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Project Performance', exact: true })).toBeVisible()
})
