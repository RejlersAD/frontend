import { test, expect } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { compactScheduleHarness } from '../fixtures/compact-schedule.fixture.js'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { workflowStageHarness } from '../fixtures/workflow-stage-tree.fixture.js'
import { scheduleAction, scheduleCritical, scheduleDiscipline, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(90000)
const grid = page => scheduleWorkspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const panel = page => page.getByRole('region', { name: 'Gantt PDF export', exact: true })
const normalized = value => String(value).replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s/g, '')
const clean = (state, writes = []) => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.writes).toEqual(writes)
}

function pdfOptions(options = {}) {
  return {
    ...options,
    prepare(state) {
      Object.assign(state, { pdfAllowed: true, pdfPermissionError: false, pdfPermissionReads: 0 })
      options.prepare?.(state)
    },
    async handleRequest(context) {
      const { path, state, route, reply } = context
      if (path.endsWith('/rbac/users/me/')) {
        state.pdfPermissionReads += 1
        if (state.pdfPermissionReads > 1 && state.pdfPermissionHold) await state.pdfPermissionHold
        await reply(route, state.pdfPermissionError ? { detail: 'Permission service unavailable.' } : {
          data: { is_superuser: true, module_actions: { planning_package: state.pdfAllowed ? ['read', 'export'] : ['read', 'admin'] } },
        }, state.pdfPermissionError ? 503 : 200)
        return true
      }
      if (path.endsWith('/export-capabilities/')) {
        await reply(route, { adapters: [], permissions: { can_export: true } })
        return true
      }
      return options.handleRequest?.(context)
    },
  }
}

async function openExport(page) {
  await scheduleAction(page, 'Export schedule')
  await expect(page.getByRole('dialog', { name: 'Export schedule', exact: true })).toBeVisible()
  await expect(panel(page)).toBeVisible()
  return panel(page)
}

async function inspectPdf(bytes) {
  const document = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  try {
    const pages = []
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      const operators = await page.getOperatorList()
      pages.push({
        text: content.items.map(item => item.str || '').join(' '),
        width: page.view[2] - page.view[0], height: page.view[3] - page.view[1],
        fills: operators.fnArray.flatMap((op, index) => op === OPS.setFillRGBColor ? [operators.argsArray[index][0]] : []),
        imageCount: operators.fnArray.filter(op => [OPS.paintImageXObject, OPS.paintInlineImageXObject].includes(op)).length,
        pathCount: operators.fnArray.filter(op => op === OPS.constructPath).length,
      })
    }
    return { pages, text: pages.map(page => page.text).join('\n') }
  } finally { await document.destroy() }
}

async function downloadPdf(page, testInfo, name) {
  const downloaded = page.waitForEvent('download')
  await panel(page).getByRole('button', { name: 'Export Gantt PDF', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toMatch(/-gantt-\d{4}-\d{2}-\d{2}\.pdf$/)
  const path = testInfo.outputPath(name)
  await download.saveAs(path)
  expect(await download.failure()).toBeNull()
  const bytes = await readFile(path)
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
  const pdf = await inspectPdf(bytes)
  await expect(panel(page).getByRole('status')).toContainText(`PDF prepared: ${download.suggestedFilename()}. ${pdf.pages.length} pages`)
  await testInfo.attach(name, { path, contentType: 'application/pdf' })
  return { ...pdf, bytes }
}

function hasColor(pages, expected) {
  const channels = hex => hex.replace('#', '').match(/../g).map(value => parseInt(value, 16))
  const target = channels(expected)
  return pages.flatMap(page => page.fills).some(value => typeof value === 'string' && channels(value).every((channel, index) => Math.abs(channel - target[index]) <= 2))
}

function expectColor(pages, expected) {
  expect(hasColor(pages, expected), `PDF vector fill ${expected}`).toBe(true)
}

test('full Gantt PDF includes collapsed and offscreen rows, dates, vector colors and all dependency types', async ({ page }, testInfo) => {
  const state = await compactScheduleHarness(page, pdfOptions())
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(44)
  await grid(page).locator('.p6-viewport').evaluate(element => { element.scrollTop = element.scrollHeight })
  await scheduleAction(page, 'Collapse all')
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(0)
  const view = await openExport(page)
  await expect(view.getByRole('radio', { name: 'Full schedule', exact: true })).toBeChecked()
  await expect(view.getByRole('combobox', { name: 'PDF paper size', exact: true })).toHaveValue('a3')
  const pdf = await downloadPdf(page, testInfo, 'full-schedule.pdf')
  await writeFile('artifacts/gantt-pdf-full-schedule.pdf', pdf.bytes)
  const plan = state.records[17].simplePlan
  for (const task of plan.tasks) expect(normalized(pdf.text), task.title).toContain(normalized(task.title))
  for (const node of plan.wbs_nodes) expect(normalized(pdf.text), node.name).toContain(normalized(node.name))
  expect(pdf.text).toContain('44 activities')
  expect(pdf.text).toContain('Full schedule')
  expect(pdf.text).toContain('Version 3')
  expect(pdf.text).toMatch(/21-Sept?-26/)
  expect(pdf.text).toContain('Dependency register - 4 relationships')
  for (const type of ['FS', 'SS', 'FF', 'SF']) expect(pdf.text).toContain(`| ${type} | Lag`)
  expect(pdf.text).toContain('| SS | Lag +2 working d')
  expect(pdf.pages.length).toBeGreaterThan(2)
  for (const [index, item] of pdf.pages.entries()) {
    expect(item.width).toBeCloseTo(1190.55, 0)
    expect(item.height).toBeCloseTo(841.89, 0)
    expect(item.text).toContain(`Page ${index + 1} of ${pdf.pages.length}`)
    expect(item.imageCount).toBe(0)
  }
  const tables = pdf.pages.filter(item => item.text.includes('Activity / WBS name'))
  expect(tables.length).toBeGreaterThan(1)
  expect(tables.every(item => item.pathCount > 20)).toBe(true)
  for (const color of ['#ef4444', '#2563eb', '#a16207', '#0f766e', '#7c3aed']) expectColor(tables, color)
  expect(state.pdfPermissionReads).toBe(2)
  clean(state)
})

test('filtered A4 PDF applies search, discipline and critical filters while retaining ancestors and outside predecessor context', async ({ page }, testInfo) => {
  const state = await compactScheduleHarness(page, pdfOptions({ prepare(state) {
    for (const record of Object.values(state.records)) record.simplePlan.tasks[4].is_critical = true
  } }))
  const target = state.records[17].simplePlan.tasks[4]
  await scheduleWorkspace(page).getByRole('textbox', { name: 'Search schedule activities', exact: true }).fill(target.activity_code)
  await scheduleDiscipline(page, 'electrical')
  await scheduleCritical(page, true)
  const view = await openExport(page)
  await view.getByRole('radio', { name: 'Current filters', exact: true }).check()
  await view.getByRole('combobox', { name: 'PDF paper size', exact: true }).selectOption('a4')
  const pdf = await downloadPdf(page, testInfo, 'filtered-a4.pdf')
  expect(normalized(pdf.text)).toContain(normalized(target.title))
  for (const task of state.records[17].simplePlan.tasks.filter(task => task.id !== target.id)) expect(normalized(pdf.text), task.title).not.toContain(normalized(task.title))
  for (const name of ['Electrical Engineering', 'Engineering', 'FEED', 'Amine Regeneration Upgrade']) expect(pdf.text).toContain(name)
  expect(pdf.text).toContain('1 activities')
  expect(pdf.text).toContain('Filtered schedule')
  expect(pdf.text).toContain(`Search: ${target.activity_code}`)
  expect(pdf.text).toContain('Critical activities only')
  expect(pdf.text).toContain('| SF | Lag 0 working d')
  expect(pdf.text).toContain('Predecessor outside export filters')
  expect(pdf.pages[0].width).toBeCloseTo(841.89, 0)
  expect(pdf.pages[0].height).toBeCloseTo(595.28, 0)
  clean(state)
})

test('read-only source-only PDF preserves missing dates and source units without calculating or publishing', async ({ page }, testInfo) => {
  const state = await masterScheduleHarness(page, pdfOptions({ prepare(state) {
    for (const record of Object.values(state.records)) {
      const plan = record.simplePlan
      Object.assign(plan, { state: 'baselined', version_id: 90, version_number: 2, duration_policy: 'source_only', evidence_policy: 'document_driven', calculation_available: false, project: { code: 'SOURCE-ONLY', name: 'Source evidence schedule' } })
      for (const task of plan.tasks) Object.assign(task, { duration_source: 'source_document', duration_calendar_verified: false, duration_days: null, original_duration_days: null, planned_start_date: '2099-01-01', planned_finish_date: '2099-01-02', is_critical: true, total_float_days: 0, depends_on: [] })
      Object.assign(plan.tasks[0], { duration_days: 2, original_duration_days: 2, duration_unit: 'weeks', source_start_date: '2026-09-23', source_start_status: 'extracted', source_finish_date: null, source_finish_status: 'missing' })
      Object.assign(plan.tasks[1], { source_start_date: null, source_start_status: 'missing', source_finish_date: null, source_finish_status: 'missing' })
      Object.assign(plan.tasks[1], { depends_on: [plan.tasks[0].id], dependency_details: [{ task_id: plan.tasks[0].id, type: 'SS', lag_days: 4, lag_unit: 'hours' }] })
    }
  } }))
  const before = structuredClone(state.records[17].simplePlan)
  await expect(grid(page).getByRole('button', { name: `Edit activity ${before.tasks[0].title}`, exact: true })).toBeDisabled()
  await openExport(page)
  const pdf = await downloadPdf(page, testInfo, 'source-only-read-only.pdf')
  expect(pdf.text).toContain('Baseline snapshot')
  expect(pdf.text).toContain('Version 2')
  expect(pdf.text).toMatch(/23-Sept?-26/)
  expect(pdf.text).toContain('(source)')
  expect(pdf.text).toContain('2 w')
  expect(pdf.text).toContain('Not Specified')
  expect(pdf.text).toContain('| SS | Lag +4 h')
  expect(pdf.text).not.toContain('01-Jan-99')
  expect(pdf.text).not.toContain('02-Jan-99')
  const tables = pdf.pages.filter(item => item.text.includes('Activity / WBS name'))
  expect(hasColor(tables, '#ef4444')).toBe(false)
  expect(state.records[17].simplePlan).toEqual(before)
  clean(state)
})

test('PDF requires the explicit export grant and retries failed permission checks without trusting admin or stale grants', async ({ page }) => {
  const downloads = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  const state = await compactScheduleHarness(page, pdfOptions({ prepare(state) { state.pdfAllowed = false } }))
  await openExport(page)
  await expect(panel(page).getByRole('status')).toHaveText('Your account does not have permission to export planning packages.')
  await expect(panel(page).getByRole('button', { name: 'Export Gantt PDF', exact: true })).toBeDisabled()
  state.pdfPermissionError = true
  await page.reload()
  await openExport(page)
  await expect(panel(page).getByRole('alert')).toContainText('Export permission could not be checked')
  state.pdfPermissionError = false
  state.pdfAllowed = true
  await panel(page).getByRole('button', { name: 'Retry permission check', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: 'Export Gantt PDF', exact: true })).toBeEnabled()
  state.pdfAllowed = false
  await panel(page).getByRole('button', { name: 'Export Gantt PDF', exact: true }).click()
  await expect(panel(page).getByRole('status')).toHaveText('Your account does not have permission to export planning packages.')
  await expect(panel(page).getByRole('button', { name: 'Export Gantt PDF', exact: true })).toBeDisabled()
  expect(downloads).toEqual([])
  expect(state.pdfPermissionReads).toBe(4)
  clean(state)
})

test('an empty filtered export reports a recoverable error and full-schedule retry ignores the empty viewport', async ({ page }, testInfo) => {
  const downloads = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  const state = await compactScheduleHarness(page, pdfOptions())
  await scheduleWorkspace(page).getByRole('textbox', { name: 'Search schedule activities', exact: true }).fill('No matching engineering activity 9999')
  const view = await openExport(page)
  await view.getByRole('radio', { name: 'Current filters', exact: true }).check()
  await view.getByRole('button', { name: 'Export Gantt PDF', exact: true }).click()
  await expect(view.getByRole('alert')).toHaveText('No schedule rows match this export. Clear the filters and try again.')
  await expect(view.getByRole('button', { name: 'Export Gantt PDF', exact: true })).toBeEnabled()
  await expect(view.getByRole('status')).toHaveCount(0)
  expect(downloads).toEqual([])
  await view.getByRole('radio', { name: 'Full schedule', exact: true }).check()
  const pdf = await downloadPdf(page, testInfo, 'recovered-full-schedule.pdf')
  expect(pdf.text).toContain('44 activities')
  await expect(view.getByRole('alert')).toHaveCount(0)
  expect(downloads).toHaveLength(1)
  clean(state)
})

test('1100-activity vector export paginates every workflow row and all 880 dependency relationships', async ({ page }, testInfo) => {
  test.setTimeout(180000)
  const state = await workflowStageHarness(page, pdfOptions({ largeDataset: true }))
  await expect(grid(page).locator('[data-row-kind="deliverable"]')).toHaveCount(220, { timeout: 30000 })
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(1100)
  const rowCount = await grid(page).locator('.p6-rows > [role="row"]').count()
  await scheduleAction(page, 'Collapse all')
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(0)
  const before = structuredClone(state.records[17].simplePlan)
  const result = await page.evaluate(async plan => {
    const { createGanttPdf } = await import('/src/utils/ganttPdf.js')
    let unsupportedError = ''
    try {
      await createGanttPdf({ plan: { ...plan, project: { ...plan.project, name: '\u0645\u0634\u0631\u0648\u0639' } }, tasks: plan.tasks, disciplines: plan.disciplines })
    } catch (error) { unsupportedError = error.message }
    const result = await createGanttPdf({ plan, tasks: plan.tasks, disciplines: plan.disciplines, scope: 'all', paper: 'a3', zoom: 'month', showLogic: true })
    const bytes = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(result.blob)
    })
    return { bytes, pageCount: result.pageCount, rowCount: result.rowCount, unsupportedError }
  }, before)
  expect(result.unsupportedError).toContain('PDF export currently supports Latin text')
  const bytes = Buffer.from(result.bytes, 'base64')
  const pdf = await inspectPdf(bytes)
  expect(result.rowCount).toBe(rowCount)
  expect(result.rowCount).toBeGreaterThan(1320)
  expect(result.pageCount).toBe(pdf.pages.length)
  expect(result.pageCount).toBeGreaterThan(30)
  const text = normalized(pdf.text)
  for (const task of before.tasks) expect(text, task.title).toContain(normalized(task.title))
  for (const parent of before.deliverables) expect(text, parent.title).toContain(normalized(parent.title))
  expect(pdf.text).toContain('1100 activities')
  expect(pdf.text).toContain('Dependency register - 880 relationships')
  expect(pdf.text).toContain('DOC-220-COMPANY_APPROVAL -> DOC-220-FINAL_ISSUE | FS | Lag 0 working d')
  for (const [index, item] of pdf.pages.entries()) {
    expect(item.text).toContain(`Page ${index + 1} of ${pdf.pages.length}`)
    expect(item.width).toBeGreaterThan(item.height)
    expect(item.imageCount).toBe(0)
  }
  expect(state.records[17].simplePlan).toEqual(before)
  const path = testInfo.outputPath('workflow-1100.pdf')
  await writeFile(path, bytes)
  await writeFile('artifacts/gantt-pdf-workflow-1100.pdf', bytes)
  await testInfo.attach('workflow-1100.pdf', { path, contentType: 'application/pdf' })
  clean(state)
})

test('horizontal PDF windows repeat readable rows and honor recorded baseline and hidden dependency settings', async ({ page }, testInfo) => {
  const state = await masterScheduleHarness(page, pdfOptions({ prepare(state) {
    for (const record of Object.values(state.records)) {
      const plan = record.simplePlan
      plan.project = { code: 'HORIZON', name: 'Long duration schedule' }
      Object.assign(plan.tasks[0], { duration_days: 30, planned_start_date: '2026-09-21', planned_finish_date: '2026-10-30', baseline_start_date: '2026-07-01', baseline_finish_date: '2026-07-10' })
      Object.assign(plan.tasks[1], { planned_start_date: '2026-11-02', planned_finish_date: '2026-11-03', baseline_start_date: '2026-01-09', baseline_finish_date: '2026-01-01' })
    }
  } }))
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(2)
  const before = structuredClone(state.records[17].simplePlan)
  const generated = await page.evaluate(async plan => {
    const { createGanttPdf } = await import('/src/utils/ganttPdf.js')
    const results = []
    for (const showBaseline of [true, false]) {
      const result = await createGanttPdf({ plan, tasks: plan.tasks, disciplines: plan.disciplines, paper: 'a4', zoom: 'day', showLogic: false, showBaseline })
      const bytes = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(result.blob)
      })
      results.push({ bytes, pageCount: result.pageCount, rowCount: result.rowCount })
    }
    return results
  }, before)
  const withBaseline = await inspectPdf(Buffer.from(generated[0].bytes, 'base64'))
  const withoutBaseline = await inspectPdf(Buffer.from(generated[1].bytes, 'base64'))
  expect(generated[0].rowCount).toBe(generated[1].rowCount)
  expect(generated[0].pageCount).toBeGreaterThan(generated[1].pageCount)
  const tables = withBaseline.pages.filter(item => item.text.includes('Activity / WBS name'))
  expect(tables.length).toBeGreaterThan(3)
  for (const task of before.tasks) for (const item of tables) expect(normalized(item.text)).toContain(normalized(task.title))
  expect(withBaseline.text).toMatch(/Time window 1\/[2-9]/)
  expect(withBaseline.text).toContain('29-Jun-26')
  expect(withBaseline.text).not.toContain('Jan 2026')
  expect(withoutBaseline.text).not.toContain('Jun 2026')
  expect(withoutBaseline.text).not.toContain('Jul 2026')
  expect(withBaseline.text).toContain('Gray bars show the recorded baseline dates')
  expectColor(tables, '#94a3b8')
  expect(hasColor(withoutBaseline.pages.filter(item => item.text.includes('Activity / WBS name')), '#94a3b8')).toBe(false)
  expect(withBaseline.text).toContain('Dependency links were hidden')
  expect(withBaseline.text).not.toContain('Dependency register -')
  expect(withBaseline.text).not.toContain(' -> ')
  expect(withBaseline.text).toContain('Draft')
  expect(state.records[17].simplePlan).toEqual(before)
  const path = testInfo.outputPath('horizontal-windows-baseline.pdf')
  await writeFile(path, Buffer.from(generated[0].bytes, 'base64'))
  await testInfo.attach('horizontal-windows-baseline.pdf', { path, contentType: 'application/pdf' })
  clean(state)
})

test('a pending PDF download survives the save notification dismissing without additional schedule writes', async ({ page }, testInfo) => {
  const state = await compactScheduleHarness(page, pdfOptions())
  await page.clock.install()
  await scheduleAction(page, 'Save draft')
  await expect(page.locator('.prv-toast').getByRole('status')).toContainText('saved')
  expect(state.writes).toHaveLength(1)
  const savedWrites = structuredClone(state.writes)
  const view = await openExport(page)
  await expect(view.getByRole('button', { name: 'Export Gantt PDF', exact: true })).toBeEnabled()
  let release
  state.pdfPermissionHold = new Promise(resolve => { release = resolve })
  const downloaded = page.waitForEvent('download')
  try {
    await view.getByRole('button', { name: 'Export Gantt PDF', exact: true }).click()
    await expect.poll(() => state.pdfPermissionReads).toBe(2)
    await expect(view).toHaveAttribute('aria-busy', 'true')
    await page.mouse.move(5, 5)
    await page.clock.fastForward(6501)
    await expect(page.locator('.prv-toast')).toHaveCount(0)
  } finally { release() }
  const download = await downloaded
  const path = testInfo.outputPath('after-notification-dismissal.pdf')
  await download.saveAs(path)
  const pdf = await inspectPdf(await readFile(path))
  expect(pdf.text).toContain('44 activities')
  await expect(view.getByRole('status')).toContainText('PDF prepared:')
  await expect(view).toHaveAttribute('aria-busy', 'false')
  await testInfo.attach('after-notification-dismissal.pdf', { path, contentType: 'application/pdf' })
  clean(state, savedWrites)
})
