import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import * as XLSX from 'xlsx'

const keys = ['pressure', 'temperature', 'gas_flow', 'gas_mw', 'gas_z', 'gas_viscosity',
  'oil_flow', 'oil_density', 'oil_viscosity', 'water_flow', 'water_density', 'water_viscosity']
const units = { pressure: 'barg', temperature: 'C', gas_flow: 'MMSCFD', gas_mw: 'kg/kmol', gas_z: '-', gas_viscosity: 'cP',
  oil_flow: 'm3/h', oil_density: 'kg/m3', oil_viscosity: 'cP', water_flow: 'm3/h', water_density: 'kg/m3', water_viscosity: 'cP' }
const schema = { version: 'separator-1.0', inputs: Object.fromEntries(keys.map((key) => [key, { label: key, unit: units[key] }])),
  criteria: { k: { label: 'Souders-Brown K', unit: 'm/s', default: .12 } }, nozzle_table: [{ nps: 18, id_mm: 438.2 }] }
const result = {
  version: 'separator-1.0', status: 'REVIEW', governing_case: 'Max Water', governing_case_id: 'comparison-water-a',
  diameter_m: 2.8, length_m: 11.2, effective_length_m: 8.96,
  qualification: 'Engineering aid only; case-adjustable NIL.',
  cases: [['liquid', 'Max Oil'], ['water', 'Max Water'], ['gas', 'Max Gas']].map(([kind, name]) => ({ id: `comparison-${kind}-a`, name, required_id: 2.44, control: 'Liquid retention',
    gas_utilization: .425, oil_retention: 8.17, water_retention: 5, nil_mm: 385.57,
    status: 'REVIEW', settling: { oil_re: 3.77 }, warnings: ['Settling outside stated Stokes range (Re >= 2)'] })),
  nozzles: { inlet: { required_mm: 397.4, selected_mm: 438.2, nps: 18, case_id: 'a', status: 'OK' } },
  levels_mm: { nll: 1680 }, preliminary: { status: 'PRELIMINARY - NOT CODE VERIFIED', warnings: ['Not ASME certification'], shell_mm: 26 },
}
const sizing = '**/api/v1/process-datasheet/datasheets/hmb-stream-consolidator/separator-sizing/**'
const snapshots = '**/api/v1/process-datasheet/datasheets/hmb-stream-consolidator/separator-snapshots/**'
const sourceDisplay = (value) => value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 4 })

async function confirmBasis(page) {
  await page.getByRole('button', { name: 'Review mapping', exact: true }).click()
  await page.getByRole('checkbox', { name: /I confirm/ }).check()
  await page.getByRole('button', { name: 'Done reviewing mapping' }).click()
}

test('Equipment Sizing preserves existing HMB tabs and has bounded internal scrolling', async ({ page }) => {
  test.setTimeout(180000)
  let schemaRequests = 0
  await page.route('**/api/v1/process-datasheet/datasheets/hmb-stream-consolidator/archive/**', (route) => route.fulfill({ json: { results: [] } }))
  await page.route(sizing, (route) => { schemaRequests += 1; return route.fulfill({ json: schema }) })
  await page.goto('/tests/fixtures/hmb-stream-table-consolidator.html')
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Property', 'Unit', '1032'], ['Temperature', 'F', 140], ['Pressure', 'psig', 290.07547546], ['Mass Flow', 'lb/hr', 1000],
  ]), 'Streams')
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'separator-feed.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) })
  await expect(page.getByRole('tab', { name: 'Equipment Sizing', exact: true })).toBeVisible()
  expect((await page.getByRole('tablist', { name: 'Consolidator views', exact: true }).getByRole('tab').allTextContents()).map((text) => text.trim()))
    .toEqual(['Review', 'Compare', 'Equipment Sizing', 'Saved'])
  expect(schemaRequests).toBe(0)
  await page.getByRole('tab', { name: 'Equipment Sizing', exact: true }).click()
  await expect(page.locator('.hmbc-save-action')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeVisible()
  await page.getByLabel('Feed stream').selectOption('1032')
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await page.setViewportSize({ width: 1424, height: 640 })
  const scroll = page.locator('.eq-process-scroll')
  expect(await scroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await scroll.hover(); await page.mouse.wheel(0, 500)
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toBeInViewport()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Run sizing', exact: true }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('tab', { name: 'Review', exact: true }).click()
  await expect(page.getByText('Review extracted values', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Compare', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Max Liquid' })).toBeVisible()
  await page.getByRole('tab', { name: 'Saved', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Saved project workbook', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Equipment Sizing', exact: true }).click()
  await expect(page.getByLabel('Equipment tag', { exact: true })).toHaveValue('V-1001')
})

test('truthful verification, failures, manual reset, stale results, tabs and XLSX work', async ({ page }) => {
  test.setTimeout(180000)
  let requests = 0
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  await page.route(sizing, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: schema })
    requests += 1
    expect(route.request().postDataJSON().cases[0].inputs.oil_flow).toBeCloseTo(200, 10)
    return route.fulfill(requests === 1 ? { status: 400, json: { error: 'Confirm project gas reference conditions.' } } : { json: result })
  })
  await page.goto('/tests/fixtures/separator-sizing.html')
  await page.getByLabel('Feed stream').selectOption('1032')
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await expect(page.getByText('Not run', { exact: true })).toHaveCount(3)
  const run = page.getByRole('button', { name: 'Run sizing', exact: true })
  await expect(run).toBeDisabled()
  await confirmBasis(page)
  await run.click()
  await expect(page.getByRole('alert')).toHaveText('Confirm project gas reference conditions.')
  await run.click()
  await expect(page.getByRole('heading', { name: 'Result: REVIEW' })).toBeVisible()
  await expect(page.getByText(/Settling outside stated Stokes range/).first()).toBeVisible()
  await expect(page.locator('.eq-verification').getByText('Review', { exact: true })).toHaveCount(1)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  const download = await downloadPromise
  const workbook = XLSX.read(await readFile(await download.path()), { type: 'buffer' })
  expect(workbook.SheetNames).toEqual(['Input', 'Design Criteria', 'Calculation', 'Data Sheet'])
  expect(workbook.Sheets['Data Sheet'].B7.v).toBe(2.8)
  await page.getByRole('tab', { name: 'Inputs', exact: true }).click()
  await page.getByLabel('Max Water oil_flow', { exact: true }).fill(String(210 / .028316846592))
  await expect(page.getByRole('status')).toContainText('require recalculation')
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Restore Max Water oil_flow', exact: true }).click()
  await expect(page.getByLabel('Max Water oil_flow', { exact: true })).toHaveValue(sourceDisplay(200 / .028316846592))
  await page.getByRole('button', { name: 'Open design criteria' }).click()
  await expect(page.getByRole('tab', { name: 'Design Criteria', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Design Criteria', exact: true }).press('End')
  await expect(page.getByRole('tab', { name: 'Datasheet', exact: true })).toBeFocused()
  await page.getByRole('tab', { name: 'Datasheet', exact: true }).press('Home')
  const accessibility = await new AxeBuilder({ page }).include('.equipment-sizing').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
})

test('saved revisions reopen in an empty HMB session without trusting historical results', async ({ page }) => {
  test.setTimeout(180000)
  const projectId = '11111111-1111-4111-8111-111111111111'
  const record = { id: '22222222-2222-4222-8222-222222222222', project_id: projectId,
    tag: 'V-1001', stream: '1032', service: 'Separator', created_at: '2026-11-05T00:00:00Z', calculator_version: 'separator-old' }
  let saved = null, attempts = 0, calculations = 0, legacy = false
  await page.addInitScript((id) => localStorage.setItem('hmbExtractorActiveProject', JSON.stringify({ project_id: id })), projectId)
  await page.route('**/api/v1/process-datasheet/datasheets/hmb-stream-consolidator/archive/**', (route) => route.fulfill({ json: { results: [] } }))
  await page.route(sizing, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: schema })
    calculations += 1
    expect(route.request().postDataJSON().cases.find((item) => item.name === 'Max Water').inputs.oil_flow).toBeCloseTo(210, 10)
    return route.fulfill({ json: result })
  })
  await page.route(snapshots, async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST') {
      attempts += 1
      const body = route.request().postDataJSON()
      expect(body.project_id).toBe(projectId)
      if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Snapshot was not saved.' } })
      saved = { format: 'radai.separator.snapshot', format_version: 1, calculator_version: 'separator-old',
        saved_at: record.created_at, basis: body.basis, schema: { ...schema, version: 'separator-old' }, result: { ...result, version: 'separator-old' } }
      return route.fulfill({ status: 201, json: { snapshot: record } })
    }
    expect(url.searchParams.get('project_id')).toBe(projectId)
    if (url.pathname.includes(record.id)) {
      const snapshot = JSON.parse(JSON.stringify(saved))
      if (legacy) snapshot.basis.sources.forEach((source) => { delete source.comparisonColumn })
      return route.fulfill({ json: { archive: record, snapshot, historical: true } })
    }
    return route.fulfill({ json: { results: saved ? [record] : [] } })
  })
  await page.goto('/tests/fixtures/separator-sizing.html')
  await page.getByLabel('Feed stream').selectOption('1032')
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await page.getByLabel('Max Water oil_flow', { exact: true }).fill(String(210 / .028316846592))
  await confirmBasis(page)
  await page.getByRole('button', { name: 'Run sizing', exact: true }).click()
  await page.getByRole('button', { name: 'Save revision', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('not saved')
  await page.getByRole('button', { name: 'Save revision', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Snapshot saved for V-1001.')
  await page.goto('/tests/fixtures/hmb-stream-table-consolidator.html')
  await page.getByRole('button', { name: 'Open Equipment Sizing', exact: true }).click()
  await page.getByRole('button', { name: /^Saved snapshots/ }).click()
  await page.getByRole('button', { name: 'Reopen V-1001', exact: true }).click()
  await page.getByRole('button', { name: 'Replace sizing inputs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Historical snapshot - confirmation and recalculation required' })).toBeVisible()
  await expect(page.getByLabel('Max Water oil_flow', { exact: true })).toHaveValue(sourceDisplay(210 / .028316846592))
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled()
  expect(calculations).toBe(1)
  await confirmBasis(page)
  await page.getByRole('button', { name: 'Run sizing', exact: true }).click()
  expect(calculations).toBe(2)
  legacy = true
  await page.getByRole('button', { name: /^Saved snapshots/ }).click()
  await page.getByRole('button', { name: 'Reopen V-1001', exact: true }).click()
  await page.getByRole('button', { name: 'Replace sizing inputs', exact: true }).click()
  await expect(page.getByText('Historical per-case snapshot', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Relink to Cross-case comparison', exact: true })).toBeDisabled()
  await confirmBasis(page)
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toBeDisabled()
  expect(calculations).toBe(2)
})

test('reference Inputs view matches pane geometry at 1424x768 and stays an isolated demo', async ({ page }, testInfo) => {
  test.setTimeout(180000)
  let apiRequests = 0
  page.on('request', (request) => { if (request.url().includes('/api/')) apiRequests += 1 })
  await page.setViewportSize({ width: 1424, height: 768 })
  await page.goto('/tests/fixtures/equipment-sizing-reference.html')
  await expect(page.getByRole('radio', { name: 'Max Water', exact: true })).toBeChecked()
  await expect(page.getByLabel('Max Water Operating temperature', { exact: true })).toHaveValue('65')
  await expect(page.getByText('All 3 cases pass', { exact: true })).toBeVisible()
  await expect(page.getByText('Example results', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toBeDisabled()
  const boxes = await page.locator('.eq-pane').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect(); return { x: rect.x, top: rect.top, bottom: rect.bottom, width: rect.width }
  }))
  expect(Math.max(...boxes.map((box) => box.top)) - Math.min(...boxes.map((box) => box.top))).toBeLessThan(1)
  expect(Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.bottom))).toBeLessThan(1)
  expect(boxes[1].x - boxes[0].x - boxes[0].width).toBeCloseTo(16, 0)
  const total = boxes.reduce((sum, box) => sum + box.width, 0)
  for (const [index, ratio] of [.21, .48, .31].entries()) expect(Math.abs(boxes[index].width / total - ratio)).toBeLessThan(.015)
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('equipment-sizing-reference-first.png'), fullPage: true })
  await page.getByRole('radio', { name: 'Max Oil', exact: true }).check()
  await expect(page.getByLabel('Max Oil Operating temperature', { exact: true })).toHaveValue('60')
  await page.getByRole('button', { name: 'Max Water', exact: true }).click()
  await expect(page.getByLabel('Max Water Standard gas flow', { exact: true })).toHaveValue('25')
  await page.screenshot({ path: testInfo.outputPath('equipment-sizing-reference-final.png'), fullPage: true })
  expect(apiRequests).toBe(0)
})

test('twelve imported cases resolve to three comparison columns without cramped selectors', async ({ page }) => {
  test.setTimeout(180000)
  await page.route(sizing, (route) => route.fulfill({ json: schema }))
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  await page.goto('/tests/fixtures/separator-sizing.html?cases=12')
  await page.getByLabel('Feed stream').selectOption('1032')
  await expect(page.getByRole('radio')).toHaveCount(3)
  await expect(page.getByRole('radio', { name: 'Max Water', exact: true })).toBeChecked()
  await page.getByRole('radio', { name: 'Max Gas', exact: true }).check()
  await expect(page.getByLabel('Max Gas oil_flow', { exact: true })).toBeVisible()
  expect(await page.locator('.eq-segments').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.getByLabel('Max Gas water_density', { exact: true }).fill('')
  await expect(page.locator('.eq-action-bar')).toContainText('Mapping incomplete')
  await page.getByRole('button', { name: 'Review mapping', exact: true }).click()
  await expect(page.getByText(/Missing required properties:/)).toBeVisible()
  await page.getByRole('button', { name: 'Close panel', exact: true }).press('Escape')
  await page.getByRole('button', { name: 'Open design criteria' }).click()
  await expect(page.getByRole('tab', { name: 'Design Criteria', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Inputs', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).include('.equipment-sizing').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
})

test('missing backend service is explained and calculation/deliverables stay disabled', async ({ page }) => {
  await page.route(sizing, (route) => route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' }))
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  await page.goto('/tests/fixtures/separator-sizing.html')
  await expect(page.getByRole('alert')).toContainText('endpoint is unavailable')
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save revision', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled()
  await expect(page.getByText('Not run', { exact: true })).toHaveCount(3)
})

test('incomplete successful responses cannot produce passed verification', async ({ page }) => {
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  await page.route(sizing, (route) => route.fulfill({ json: route.request().method() === 'GET' ? schema : { ...result, status: 'OK', cases: [] } }))
  await page.goto('/tests/fixtures/separator-sizing.html')
  await page.getByLabel('Feed stream').selectOption('1032')
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await confirmBasis(page)
  await page.getByRole('button', { name: 'Run sizing', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('No verification was accepted')
  await expect(page.getByText('Not run', { exact: true })).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeDisabled()
})

test('aligned numeric displays preserve full precision and tiny nonzero comparison values', async ({ page }, testInfo) => {
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  let submitted = null
  await page.route(sizing, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: schema })
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: result })
  })

  await page.setViewportSize({ width: 1370, height: 768 })
  await page.goto('/tests/fixtures/separator-sizing.html?precision=1')
  await page.getByLabel('Feed stream').selectOption('1032')
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await expect(page.getByRole('radio')).toHaveCount(3)
  const pressure = page.getByLabel('Max Water pressure', { exact: true })
  await expect(pressure).toHaveValue(sourceDisplay(6.205291562362 / .0689475729318))
  const oil = page.getByLabel('Max Water oil_flow', { exact: true })
  await expect(oil).toHaveValue(sourceDisplay(1.6874008884 / .028316846592))
  await oil.focus()
  expect(Number(await oil.inputValue())).toBeCloseTo(1.6874008884 / .028316846592, 10)
  await pressure.focus()
  await expect(oil).toHaveValue(sourceDisplay(1.6874008884 / .028316846592))
  expect(Number(await page.getByLabel('Max Water gas_flow', { exact: true }).inputValue())).toBeGreaterThan(0)
  await confirmBasis(page)
  await page.screenshot({ path: testInfo.outputPath('comparison-sizing-aligned.png'), fullPage: true })
  await page.getByRole('button', { name: 'Run sizing', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Result: REVIEW' })).toBeVisible()
  expect(submitted.cases).toHaveLength(3)
  for (const item of submitted.cases) {
    expect(item.inputs.pressure).toBeCloseTo(6.205291562362, 12)
    expect(item.inputs.oil_flow).toBeCloseTo(1.6874008884, 12)
    expect(item.inputs.gas_flow).toBe(4.145e-9)
  }
})

test('case editors use comparison units and submit only validated workbook-unit values', async ({ page }, testInfo) => {
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  let submitted = null
  await page.route(sizing, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: schema })
    submitted = route.request().postDataJSON()
    return route.fulfill({ json: result })
  })
  await page.goto('/tests/fixtures/separator-sizing.html')
  await page.getByLabel('Feed stream').selectOption('1032')
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await expect(page.getByLabel('Max Water temperature', { exact: true })).toHaveValue('140')
  await expect(page.getByLabel('Max Water oil_flow', { exact: true })).toHaveValue(sourceDisplay(200 / .028316846592))
  await expect(page.locator('.eq-unit').filter({ hasText: 'psig' })).toHaveCount(1)
  await expect(page.locator('.eq-unit').filter({ hasText: 'ft3/hr' })).toHaveCount(2)
  await page.getByLabel('Max Water temperature', { exact: true }).fill('212')
  await page.getByLabel('Max Water pressure', { exact: true }).fill('100')
  await expect(page.getByLabel('Max Water pressure', { exact: true })).toHaveValue('100')
  expect(await page.getByLabel('Max Water pressure', { exact: true }).evaluate((element) => element.closest('.eq-value').classList.contains('is-override'))).toBe(true)
  await page.getByLabel('Max Water oil_flow', { exact: true }).fill('1000')
  await page.getByLabel('Max Water oil_density', { exact: true }).fill('50')
  await page.getByRole('button', { name: 'Review mapping', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'How the Excel workbook maps to this workspace', exact: true })).toBeVisible()
  const pressure = page.locator('.eq-unit-table').first().getByRole('row').filter({ hasText: 'pressure' })
  await expect(pressure.getByRole('cell').nth(0)).toHaveText('psig')
  await expect(pressure.getByRole('cell').nth(1)).toHaveText('barg')
  await page.screenshot({ path: testInfo.outputPath('source-to-workbook-unit-mapping.png'), fullPage: true })
  await page.getByRole('checkbox', { name: /I confirm/ }).check()
  await page.getByRole('button', { name: 'Done reviewing mapping' }).click()
  await page.getByRole('button', { name: 'Run sizing', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Result: REVIEW' })).toBeVisible()
  const inputs = submitted.cases.find((item) => item.name === 'Max Water').inputs
  expect(inputs.temperature).toBeCloseTo(100, 10)
  expect(inputs.pressure).toBeCloseTo(6.89475729318, 10)
  expect(inputs.oil_flow).toBeCloseTo(28.316846592, 10)
  expect(inputs.oil_density).toBeCloseTo(800.923168698, 9)
})

test('complete mapping explains missing tag and confirmation before enabling sizing', async ({ page }) => {
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  await page.route(sizing, (route) => route.fulfill({ json: route.request().method() === 'GET' ? schema : result }))
  await page.goto('/tests/fixtures/separator-sizing.html')
  await page.getByLabel('Feed stream').selectOption('1032')
  const run = page.getByRole('button', { name: 'Run sizing', exact: true })
  await expect(run).toBeInViewport()
  await expect(run).toBeDisabled()
  await expect(page.locator('.eq-action-bar')).toContainText('Enter an equipment tag')
  await expect(page.locator('.eq-action-bar')).toContainText('confirm the engineering basis')
  await expect(page.getByText('Results appear after Run sizing succeeds.', { exact: false })).toBeVisible()
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await expect(page.locator('.eq-action-bar')).not.toContainText('Enter an equipment tag')
  await expect(run).toBeDisabled()
  await page.getByRole('button', { name: 'Review & confirm', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /I confirm/ })).toBeInViewport()
  await page.getByRole('checkbox', { name: /I confirm/ }).check()
  await page.getByRole('button', { name: 'Done reviewing mapping' }).click()
  await expect(run).toBeEnabled()
  await run.click()
  await expect(page.getByRole('heading', { name: 'Result: REVIEW' })).toBeVisible()
})

test('Datasheet includes document fields, all ten sections and exported metadata', async ({ page }) => {
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  await page.route(sizing, (route) => route.fulfill({ json: route.request().method() === 'GET' ? schema : result }))
  await page.goto('/tests/fixtures/separator-sizing.html')
  await page.getByLabel('Feed stream').selectOption('1032')
  await page.getByLabel('Equipment tag', { exact: true }).fill('V-1001')
  await confirmBasis(page)
  await page.getByRole('button', { name: 'Run sizing', exact: true }).click()
  await page.getByRole('tab', { name: 'Datasheet', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: 'Datasheet', exact: true })
  await panel.getByLabel('Project', { exact: true }).fill('Project A')
  await panel.getByLabel('Client', { exact: true }).fill('Client A')
  await panel.getByLabel('Document No.', { exact: true }).fill('DS-1001')
  await panel.getByLabel('Revision', { exact: true }).fill('B')
  await panel.getByLabel('Date', { exact: true }).fill('2026-11-05')
  await panel.getByLabel('Prepared / Checked', { exact: true }).fill('Engineer / Checker')
  await expect(panel.locator('.eq-datasheet-section')).toHaveCount(10)
  await expect(panel.getByRole('heading', { name: '1. GENERAL', exact: true })).toBeVisible()
  await expect(panel.getByText('Governing (design) case', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export Excel', exact: true })).toBeEnabled()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Excel', exact: true }).click()
  const download = await downloadPromise
  const workbook = XLSX.read(await readFile(await download.path()), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Data Sheet'], { header: 1 })
  expect(rows.some((row) => row[0] === 'Project' && row[1] === 'Project A')).toBe(true)
  expect(rows.some((row) => row[0] === 'Document No.' && row[1] === 'DS-1001')).toBe(true)
  expect(rows.some((row) => row[0] === '10. NOTES')).toBe(true)
})

test('automatic previews populate on open and refresh after edits without Run or confirmation', async ({ page }) => {
  let calls = 0
  await page.route(snapshots, (route) => route.fulfill({ json: { results: [] } }))
  await page.route(sizing, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: schema })
    calls += 1
    const body = route.request().postDataJSON()
    expect(body.basis_confirmed).toBe(false)
    expect(body.execution_mode).toBe('automatic_preview')
    return route.fulfill({ json: { ...result, execution_mode: 'automatic_preview' } })
  })
  await page.goto('/tests/fixtures/separator-sizing.html?automatic=1')
  await expect(page.getByLabel('Feed stream')).toHaveValue('1032')
  await expect(page.getByText('Automatic preview updated', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run sizing', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review & confirm', exact: true })).toHaveCount(0)
  expect(calls).toBe(1)
  await page.getByLabel('Max Water oil_flow', { exact: true }).fill('1000')
  await expect.poll(() => calls).toBe(2)
  await expect(page.getByText('Automatic preview updated', { exact: true })).toBeVisible()
  await page.getByLabel('Max Water gas_mw', { exact: true }).fill('')
  await expect(page.getByText('NA: waiting for required source data / valid units', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Max Water gas_mw', { exact: true })).toHaveAttribute('placeholder', 'NA')
  await page.waitForTimeout(500)
  expect(calls).toBe(2)
  await page.getByRole('button', { name: 'Rematch source stream' }).click()
  await expect.poll(() => calls).toBe(3)
})
