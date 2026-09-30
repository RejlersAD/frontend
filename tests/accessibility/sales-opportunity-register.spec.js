import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const fixedTime = '2026-09-30T08:00:00Z'
const options = {
  default_owner: 11,
  owners: [{ id: 11, name: 'Aisha Noor' }, { id: 12, name: 'Omar Ali' }],
  opportunity_types: [
    { value: 'tender', label: 'Tender' }, { value: 'rfq', label: 'RFQ' },
    { value: 'eoi', label: 'EOI' }, { value: 'direct_enquiry', label: 'Direct enquiry' },
    { value: 'other', label: 'Other' },
  ],
}

function opportunity(index, changes = {}) {
  return {
    id: `opportunity-${index}`, deal_code: `Q-${102101 + index}`,
    deal_name: `Synthetic engineering package ${index + 1}`,
    client: 'client-one', client_name: 'Example Energy LLC',
    owner: 11, owner_name: 'Aisha Noor', created_by: 11, created_by_name: 'Aisha Noor',
    opportunity_type: 'tender', open_date: '2026-09-30',
    created_at: fixedTime, updated_at: fixedTime,
    stage: 'lead', stage_display: 'Open', probability: 10, bid_decision: 'pending',
    scope_type: 'feed', service_categories: ['engineering_design'],
    description: `Reviewed engineering scope for package ${index + 1}.`,
    client_reference: `ITT-${index + 1}`, currency: '',
    estimated_value: null, weighted_value: null, expected_close_date: null,
    submission_due_date: null, next_action: '', next_action_date: null,
    source_history: [], lifecycle_history: [], permitted_actions: [],
    ...changes,
  }
}

const sampleRows = () => [
  opportunity(0, { deal_name: 'Seawater intake engineering study', opportunity_type: 'eoi' }),
  opportunity(1, { deal_name: 'Compressor replacement FEED', stage: 'qualified', stage_display: 'Qualified Lead',
    owner: 12, owner_name: 'Omar Ali', bid_decision: 'bid', estimated_value: '200000.00',
    weighted_value: '50000.00', currency: 'AED', submission_due_date: '2026-10-02' }),
  opportunity(2, { deal_name: 'Substation design and control systems', stage: 'proposal', stage_display: 'Proposal & Estimate',
    scope_type: 'pmc', service_categories: ['project_management'], bid_decision: 'conditional_bid',
    estimated_value: '300000.00', weighted_value: '150000.00', currency: 'USD', submission_due_date: '2026-10-03' }),
  opportunity(3, { deal_name: 'Closed historical package', stage: 'lost', stage_display: 'Lost', bid_decision: 'no_bid' }),
  opportunity(4, { deal_name: 'No-bid historical package', stage: 'no_bid', stage_display: 'No Bid', bid_decision: 'no_bid' }),
  ...Array.from({ length: 25 }, (_, index) => opportunity(index + 5)),
  opportunity(30, { deal_name: 'Offshore platform electrical upgrade', client_name: 'Azure Gas Company',
    owner: 12, owner_name: 'Omar Ali', opportunity_type: 'rfq', scope_type: 'epcm',
    submission_due_date: '2026-10-05' }),
]

async function prepareRegister(page, configuration = {}) {
  const state = {
    records: sampleRows(), requests: [], exports: [], pageErrors: [],
    listStatus: 200, listPageStatuses: {}, exportStatus: 200, detailStatuses: {}, detailHolds: {},
    patchStatuses: {}, patchHolds: {},
    ...configuration,
  }
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.clock.setFixedTime(new Date(fixedTime))
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-register-user'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    const body = ['POST', 'PATCH'].includes(request.method()) ? request.postDataJSON() : null
    state.requests.push({ method: request.method(), path: url.pathname, search: url.search, body })
    if (url.pathname.endsWith('/deals/registration-options/')) return route.fulfill({ json: options })
    if (url.pathname.endsWith('/deals/export/') && request.method() === 'POST') {
      state.exports.push(body)
      if (state.exportStatus !== 200) return route.fulfill({ status: state.exportStatus, json: { detail: 'The selected export is unavailable.' } })
      return route.fulfill({ contentType: 'text/csv; charset=utf-8',
        headers: { 'content-disposition': 'attachment; filename="opportunities.csv"' },
        body: 'VF code,Title\r\nQ-102101,Synthetic exported registration\r\n' })
    }
    if (url.pathname.endsWith('/deals/') && request.method() === 'GET') {
      if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { detail: 'Opportunity source is temporarily unavailable.' } })
      const pageNumber = Number(url.searchParams.get('page') || 1)
      if (state.listPageStatuses[pageNumber]) return route.fulfill({ status: state.listPageStatuses[pageNumber], json: { detail: 'The complete register could not be loaded.' } })
      const boundary = Math.ceil(state.records.length / 2)
      const hasNext = pageNumber === 1 && state.records.length > 1
      return route.fulfill({ json: {
        count: state.records.length, next: hasNext ? `${url.origin}/api/v1/sales/deals/?page=2` : null,
        previous: pageNumber === 2 ? `${url.origin}/api/v1/sales/deals/?page=1` : null,
        results: pageNumber === 1 ? state.records.slice(0, boundary) : state.records.slice(boundary),
      } })
    }
    const detail = url.pathname.match(/\/deals\/(opportunity-\d+)\/$/)
    if (detail && request.method() === 'PATCH') {
      const identifier = detail[1]
      if (state.patchHolds[identifier]) await state.patchHolds[identifier]
      const status = state.patchStatuses[identifier] || 200
      const index = state.records.findIndex(item => item.id === identifier)
      if (status === 200) state.records[index] = { ...state.records[index], ...body }
      return route.fulfill({ status, json: status === 200 ? state.records[index] : { detail: 'The previous opportunity save failed.' } })
    }
    if (detail && request.method() === 'GET') {
      const identifier = detail[1]
      if (state.detailHolds[identifier]) await state.detailHolds[identifier]
      const status = state.detailStatuses[identifier] || 200
      const record = state.records.find(item => item.id === identifier)
      return route.fulfill({ status, json: status === 200 ? record : { detail: 'Opportunity details could not be loaded.' } })
    }
    if (url.pathname.endsWith('/clients/')) return route.fulfill({ json: {
      count: 1, next: null, previous: null, results: [{ id: 'client-one', company_name: 'Example Energy LLC' }],
    } })
    if (request.method() === 'GET') return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } })
    return route.fulfill({ status: 400, json: { detail: 'Unexpected synthetic test request.' } })
  })
  await page.goto('/tests/fixtures/sales-vf-registration.html')
  const pageSize = page.getByRole('combobox', { name: 'Rows per page', exact: true })
  await expect.poll(async () => state.pageErrors.length > 0 || await pageSize.count() > 0, { timeout: 40000 }).toBe(true)
  expect(state.pageErrors).toEqual([])
  await pageSize.selectOption('50')
  return state
}

const register = page => page.getByRole('table')
const rail = page => page.getByRole('complementary', { name: 'Opportunity details', exact: true })
const vf = (page, index) => register(page).getByRole('button', { name: `Q-${102101 + index}`, exact: true })
const search = page => page.getByRole('textbox', { name: 'Search opportunities', exact: true })
const menu = (page, label) => page.locator('summary').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })

test('search includes later API pages and open default excludes closed records', async ({ page }) => {
  const state = await prepareRegister(page)
  await expect(vf(page, 0)).toBeVisible()
  await expect.poll(() => state.requests.filter(item => item.path.endsWith('/deals/') && item.method === 'GET').length).toBe(2)
  await expect(register(page)).not.toContainText('Closed historical package')
  await search(page).fill('Azure Gas Company')
  await expect(vf(page, 30)).toBeVisible()
  await expect(register(page)).toContainText('Offshore platform electrical upgrade')
  await expect(register(page).getByRole('row')).toHaveCount(2)
  expect(state.pageErrors).toEqual([])
})

test('selecting a row opens the persistent detail rail and full record remains available', async ({ page }) => {
  const state = await prepareRegister(page)
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  await expect(rail(page).getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true')
  await rail(page).getByRole('tab', { name: 'Overview', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(rail(page).getByRole('tab', { name: 'Commercial', exact: true })).toBeFocused()
  await expect(rail(page).getByRole('tab', { name: 'Commercial', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(rail(page)).toContainText(/not (provided|recorded|set)|unknown/i)
  await rail(page).getByRole('tab', { name: 'Activity', exact: true }).click()
  await rail(page).getByRole('button', { name: 'Open full record', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Opportunity record', exact: true })).toBeVisible()
  expect(state.pageErrors).toEqual([])
})

test('latest row selection wins when an earlier detail response arrives late', async ({ page }) => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const state = await prepareRegister(page, { detailHolds: { 'opportunity-0': held } })
  await vf(page, 0).click()
  await expect.poll(() => state.requests.some(item => item.path.endsWith('/deals/opportunity-0/'))).toBe(true)
  await vf(page, 1).click()
  await expect(rail(page)).toContainText('Compressor replacement FEED')
  release()
  await expect(rail(page)).not.toContainText('Seawater intake engineering study')
  expect(state.pageErrors).toEqual([])
})

test('summary uses complete active rows and labels separate currencies and unknown values', async ({ page }) => {
  await prepareRegister(page)
  const summary = page.getByRole('region', { name: 'Opportunity summary', exact: true })
  await expect(summary.getByRole('button', { name: 'Open opportunities: 29', exact: true })).toBeVisible()
  await expect(summary.getByRole('button', { name: 'Submission due in 7 days: 3', exact: true })).toBeVisible()
  const pipeline = summary.getByRole('button', { name: /^Weighted pipeline:/ })
  await expect(pipeline).toContainText('AED 50K')
  await expect(pipeline).toContainText('USD 150K')
  await expect(pipeline).toContainText('27 missing value or currency')
  await search(page).fill('No such opportunity')
  await expect(register(page)).toContainText('No opportunities match this view')
  await expect(summary.getByRole('button', { name: 'Open opportunities: 29', exact: true })).toBeVisible()
})

test('status, decision, service, owner and deadline filters combine and can be cleared', async ({ page }) => {
  await prepareRegister(page)
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('qualified')
  await page.getByRole('combobox', { name: 'Go/No-Go', exact: true }).selectOption('bid')
  await page.getByRole('combobox', { name: 'Service line', exact: true }).selectOption('engineering_design')
  await page.getByRole('combobox', { name: 'Owner', exact: true }).selectOption('12')
  await page.getByRole('combobox', { name: 'Deadline', exact: true }).selectOption('week')
  await expect(vf(page, 1)).toBeVisible()
  await expect(register(page).getByRole('row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await search(page).fill('Closed historical package')
  await expect(vf(page, 3)).toBeVisible()
})

test('missing deadlines stay unknown and do not receive an overdue warning', async ({ page }) => {
  await prepareRegister(page, { records: [opportunity(0)] })
  const row = register(page).getByRole('row').filter({ hasText: 'Q-102101' })
  await expect(row).toContainText('Not provided')
  await expect(row).not.toContainText(/overdue|days remaining/i)
  await expect(page.getByRole('region', { name: 'Requires attention', exact: true })).toContainText('Requires attention (0)')
})

test('pagination, sorting, column visibility and density controls work', async ({ page }) => {
  await prepareRegister(page)
  await page.getByRole('combobox', { name: 'Rows per page', exact: true }).selectOption('10')
  await expect(register(page).getByRole('row')).toHaveCount(11)
  await expect(vf(page, 30)).toBeVisible()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(vf(page, 30)).toHaveCount(0)
  await page.getByRole('button', { name: 'Previous page', exact: true }).click()
  await register(page).getByRole('button', { name: 'VF Code', exact: true }).click()
  await expect(vf(page, 0)).toBeVisible()
  await expect(register(page).getByRole('columnheader', { name: 'VF Code', exact: true })).toHaveAttribute('aria-sort', 'ascending')
  await menu(page, 'Columns').click()
  await page.getByRole('checkbox', { name: 'Service line', exact: true }).uncheck()
  await expect(register(page).getByRole('columnheader', { name: 'Service line', exact: true })).toHaveCount(0)
  await menu(page, 'Density').click()
  const before = await register(page).getByRole('row').nth(1).boundingBox()
  await page.getByRole('button', { name: 'Compact', exact: true }).click()
  const after = await register(page).getByRole('row').nth(1).boundingBox()
  expect(after.height).toBeLessThan(before.height)
})

test('export current view sends only filtered IDs and returns a CSV download', async ({ page }) => {
  const state = await prepareRegister(page)
  await search(page).fill('Compressor replacement FEED')
  await expect(vf(page, 1)).toBeVisible()
  await menu(page, 'Export').first().click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Export current view/ }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
  expect(state.exports).toEqual([{ ids: 'opportunity-1' }])
  await expect(page.getByRole('status')).toContainText('Exported 1 opportunity')
})

test('export selected surfaces a failure and preserves selection for retry', async ({ page }) => {
  const state = await prepareRegister(page, { exportStatus: 403 })
  await register(page).getByRole('checkbox', { name: 'Select Q-102101', exact: true }).check()
  await register(page).getByRole('checkbox', { name: 'Select Q-102102', exact: true }).check()
  await menu(page, 'Export').first().click()
  await page.getByRole('button', { name: /^Export selected/ }).click()
  await expect(page.getByRole('alert')).toContainText('selected export is unavailable')
  await expect(register(page).getByRole('checkbox', { name: 'Select Q-102101', exact: true })).toBeChecked()
  state.exportStatus = 200
  await menu(page, 'Export').first().click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Export selected/ }).click()
  await downloaded
  expect(state.exports).toHaveLength(2)
  expect(state.exports[1]).toEqual(state.exports[0])
  expect(state.exports[1].ids.split(',').sort()).toEqual(['opportunity-0', 'opportunity-1'])
})

test('a failed later list page never becomes a complete metric or partial register', async ({ page }) => {
  const state = await prepareRegister(page, { listPageStatuses: { 2: 503 } })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(register(page)).toContainText('Opportunities could not be loaded')
  await expect(page.getByRole('button', { name: /^Open opportunities:/ })).not.toHaveAccessibleName('Open opportunities: 16')
  state.listPageStatuses = {}
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click()
  await expect(vf(page, 0)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open opportunities: 29', exact: true })).toBeVisible()
})

test('detail failure shows a retry and never displays another record as the selected detail', async ({ page }) => {
  const state = await prepareRegister(page, { detailStatuses: { 'opportunity-0': 503 } })
  await vf(page, 0).click()
  await expect(rail(page).getByRole('alert')).toBeVisible()
  await expect(rail(page)).not.toContainText('Offshore platform electrical upgrade')
  state.detailStatuses['opportunity-0'] = 200
  await rail(page).getByRole('button', { name: 'Retry details', exact: true }).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  expect(state.pageErrors).toEqual([])
})

test('registration action retains the reviewed VF dialog', async ({ page }) => {
  await prepareRegister(page)
  await page.getByRole('button', { name: 'New opportunity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Register opportunity (VF)', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Owner', { exact: true })).toHaveValue('11')
  await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('refresh reloads selected detail and removes a record no longer in the register', async ({ page }) => {
  const state = await prepareRegister(page)
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  state.records[0] = { ...state.records[0], deal_name: 'Updated intake engineering scope' }
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(rail(page)).toContainText('Updated intake engineering scope')
  await expect.poll(() => state.requests.filter(item => item.path.endsWith('/deals/opportunity-0/')).length).toBe(2)
  state.records = state.records.filter(item => item.id !== 'opportunity-0')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(vf(page, 0)).toHaveCount(0)
  await expect(rail(page)).not.toContainText('Updated intake engineering scope')
  expect(state.pageErrors).toEqual([])
})

test('full record detail failure blocks edits and recovers through its retry', async ({ page }) => {
  const state = await prepareRegister(page, { detailStatuses: { 'opportunity-0': 503 } })
  await register(page).getByRole('row').filter({ hasText: 'Q-102101' }).getByRole('button', { name: 'View', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Opportunity record', exact: true })
  await expect(dialog).toContainText('Opportunity details could not be loaded.')
  await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Submit qualification', exact: true })).toHaveCount(0)
  state.detailStatuses['opportunity-0'] = 200
  await dialog.getByRole('button', { name: 'Retry record', exact: true }).click()
  await expect(dialog).toContainText('Seawater intake engineering study')
  await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
  expect(state.pageErrors).toEqual([])
})

for (const status of [200, 503]) test(`a late ${status} save cannot replace or invalidate another opportunity edit`, async ({ page }) => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const state = await prepareRegister(page, {
    patchHolds: { 'opportunity-0': held }, patchStatuses: { 'opportunity-0': status },
  })
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  await rail(page).getByRole('button', { name: 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Opportunity record', exact: true })
  await dialog.getByLabel('Opportunity name', { exact: true }).fill('First opportunity pending save')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect.poll(() => state.requests.some(item => item.method === 'PATCH' && item.path.endsWith('/deals/opportunity-0/'))).toBe(true)
  await dialog.getByRole('button', { name: 'Close record', exact: true }).click()
  await vf(page, 1).click()
  await expect(rail(page)).toContainText('Compressor replacement FEED')
  await rail(page).getByRole('button', { name: 'Edit', exact: true }).click()
  const input = dialog.getByLabel('Opportunity name', { exact: true })
  await input.fill('Retained second opportunity draft')
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  const completed = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/deals/opportunity-0/'))
  release()
  const response = await completed
  expect(response.status()).toBe(status)
  await response.finished()
  // Allow the completed request and the following React paint to settle before
  // asserting that neither the obsolete success nor error touched this draft.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(input).toHaveValue('Retained second opportunity draft')
  await expect(dialog).toContainText('Q-102102')
  await expect(dialog).not.toContainText('The previous opportunity save failed.')
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  expect(state.pageErrors).toEqual([])
})

for (const width of [390, 1366, 1920]) test(`register and selected details fit ${width}px without page overflow`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 })
  const state = await prepareRegister(page)
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1)
  await expect(page.locator('.main-content').getByRole('table')).toBeVisible()
  await expect(register(page)).toHaveAttribute('data-table-typography', 'preserve')
  await expect(register(page).getByRole('cell', { name: 'Q-102101', exact: true })).toHaveCSS('font-size', '13px')
  await expect(register(page).getByRole('columnheader', { name: 'VF Code', exact: true })).toHaveCSS('font-size', '12px')
  await page.screenshot({ path: testInfo.outputPath(`opportunity-register-${width}.png`), fullPage: true })
  if (width === 1920) {
    const scan = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await testInfo.attach('opportunity-register-accessibility', { body: JSON.stringify(scan.violations, null, 2), contentType: 'application/json' })
    expect(scan.violations).toEqual([])
  }
  expect(state.pageErrors).toEqual([])
})
