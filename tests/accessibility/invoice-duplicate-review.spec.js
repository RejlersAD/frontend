import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.use({ serviceWorkers: 'block' })
test.setTimeout(90000)
const makeGroup = (id = 688, version = 1, reviewVersion = 1) => ({
  invoice_id: id, record_count: 3, identical: false, review_key: `review-${id}-v${reviewVersion}`, group_token: `group-${id}-v${version}`, attachments_count: 2,
  records: Array.from({ length: 3 }, (_, index) => ({ record_key: `copy-${id}-${index + 1}-v${reviewVersion}`, record_token: `record-${id}-${index + 1}-v${version}`, invoice_number: `INV-${id}-${index + 1}`, company: 'Rejlers', account: 'Example Customer', rad_project_no: 'RAD-100', project_name: 'Engineering services', invoice_date: '2026-08-01', due_date: '2026-09-01', payment_status: index === 1 ? 'partial' : 'pending', currency: 'AED', invoice_amount: '1000.00', invoice_amount_aed: '1000.00', balance_to_be_received: index === 1 ? '750.00' : '1000.00', actual_payment_received: index === 1 ? '250.00' : '0.00', created_at: '2026-08-01T12:30:00Z', updated_at: '2026-09-22T08:00:00Z' })),
})
const modal = page => page.getByRole('dialog', { name: 'Review duplicate invoices', exact: true })
async function prepare(page, overrides = {}) {
  const state = { resolve: true, bulkResolve: true, bulkLimit: 50, bulkDeletes: [], bulkFailure: null, bulkResponse: null, groupIds: null, removedIds: new Set(), reviewVersions: {}, deletes: [], reads: [], registerReads: 0, detailReads: [], mutations: [], listedInvoice: false, keptRecord: null, detailFailure: { status: 409, body: { detail: 'Invoice ID 688 has multiple records. Review the duplicates before opening it.', code: 'invoice_identity_conflict' } }, version: 1, removed: false, deleteFailure: null, refreshFailure: false, paginated: false, unknown: [], errors: [], ...overrides }
  const group = id => makeGroup(id, state.version, state.reviewVersions[id] || 1)
  const ids = () => state.groupIds || (state.paginated ? [688, 900] : [688])
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'isolated-duplicate-review-fixture'))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (!['GET', 'HEAD'].includes(request.method())) state.mutations.push({ method: request.method(), path })
    if (path === '/api/v1/invoice-tracker/invoices/duplicates/bulk/' && request.method() === 'DELETE') {
      const body = request.postDataJSON(); state.bulkDeletes.push(body)
      if (state.bulkFailure?.abort) return route.abort('timedout')
      if (state.bulkFailure) {
        if (state.bulkFailure.status === 409) {
          state.version += 1
          for (const id of state.bulkFailure.body.stale_invoice_ids || []) state.reviewVersions[id] = (state.reviewVersions[id] || 1) + 1
        }
        return reply(state.bulkFailure.body, state.bulkFailure.status)
      }
      if (state.bulkResponse) return reply(state.bulkResponse)
      const results = body.selections.map(selection => {
        const id = Number(selection.group_token.match(/^group-(\d+)-v\d+$/)?.[1])
        const kept = group(id).records.find(record => record.record_token === selection.keep_token)
        state.removedIds.add(id)
        if (id === 688) state.keptRecord = kept
        return { invoice_id: id, removed_count: 2, kept_invoice_number: kept?.invoice_number, archive_id: `archive-${id}` }
      })
      state.removed = ids().every(id => state.removedIds.has(id))
      return reply({ resolved_count: results.length, removed_count: results.length * 2, results })
    }
    if (path === '/api/v1/invoice-tracker/invoices/duplicates/') {
      if (request.method() === 'DELETE') {
        const body = request.postDataJSON(); state.deletes.push(body)
        if (state.deleteFailure) { state.version += 1; return reply(state.deleteFailure.body, state.deleteFailure.status) }
        state.keptRecord = makeGroup(688, state.version).records.find(record => record.record_token === body.keep_token)
        state.removed = true
        return reply({ invoice_id: 688, removed_count: 2, kept_invoice_number: body.keep_token.includes('-2-') ? 'INV-688-2' : 'INV-688-1', archive_id: 'archive-1' })
      }
      state.reads.push(Object.fromEntries(url.searchParams))
      if (state.refreshFailure && state.removed) return reply({ detail: 'Duplicate review is temporarily unavailable.' }, 503)
      const pageNumber = Number(url.searchParams.get('page')), filterId = url.searchParams.get('invoice_id')
      const remainingIds = state.removed ? [] : ids().filter(id => !state.removedIds.has(id) && (!filterId || id === Number(filterId)))
      const legacyPages = state.paginated && !state.groupIds && !filterId
      const pageIds = legacyPages ? remainingIds.slice(pageNumber - 1, pageNumber) : remainingIds.slice((pageNumber - 1) * 20, pageNumber * 20)
      return reply({ schema_version: '1.0', pagination: { page: pageNumber, page_size: 20, total_groups: legacyPages && remainingIds.length ? 21 : remainingIds.length, has_next: legacyPages ? !state.removed && pageNumber === 1 : pageNumber * 20 < remainingIds.length }, capabilities: { resolve: state.resolve, bulk_resolve: state.resolve && state.bulkResolve }, limits: { bulk_groups: state.bulkLimit }, groups: pageIds.map(group) })
    }
    if (path === '/api/v1/invoice-tracker/invoices/688/' && request.method() === 'GET') {
      if (state.detailFailure && !state.removed) { state.detailReads.push(state.detailFailure.status); return reply(state.detailFailure.body, state.detailFailure.status) }
      state.detailReads.push(200)
      return reply({ id: 688, ...(state.keptRecord || makeGroup().records[0]), grand_total: '1000.00', attachments: [], attachments_count: 0, payment_terms: '30 days' })
    }
    if (path === '/api/v1/invoice-tracker/invoices/' || path === '/api/v1/invoice-tracker/invoices/collections-summary/') {
      state.registerReads += 1
      if (state.refreshFailure && state.removed) return reply({ detail: 'Register refresh temporarily unavailable.' }, 503)
      return reply(path.endsWith('/collections-summary/') ? { schema_version: '1.0', capabilities: {}, currencies: ['AED'], counts: {}, filter_options: {}, collection_health: {} } : state.listedInvoice ? { count: 1, results: [{ id: 688, ...(state.keptRecord || makeGroup().records[0]) }] } : { count: 0, results: [] })
    }
    state.unknown.push({ method: request.method(), path }); return reply({ detail: 'Unexpected isolated test request' }, 404)
  })
  return state
}
async function open(page, options = {}) {
  const state = await prepare(page, options)
  await page.goto('/tests/fixtures/invoice-duplicate-review.html', { waitUntil: 'domcontentloaded' })
  await page.locator('summary[aria-label="More invoice actions"]').click()
  await page.getByRole('button', { name: 'Review duplicates', exact: true }).click()
  await expect(modal(page).getByRole('radio')).toHaveCount(Math.min(state.groupIds?.length || 1, 20) * 3)
  return state
}
async function beginDelete(page, copy = 2) {
  await modal(page).getByRole('radio', { name: `Keep copy ${copy} of invoice ID 688` }).check()
  await modal(page).getByRole('button', { name: 'Delete 2 duplicates', exact: true }).click()
  await expect(modal(page).getByRole('group', { name: 'Confirm duplicate deletion' })).toBeVisible()
}
const clean = state => { expect(state.unknown).toEqual([]); expect(state.errors).toEqual([]) }

test('an explicit keeper and confirmation are required; success refreshes both views', async ({ page }, testInfo) => {
  const state = await open(page)
  await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
  await expect(modal(page).getByRole('button', { name: 'Delete 2 duplicates', exact: true })).toBeDisabled()
  await expect(modal(page).getByRole('cell', { name: 'Engineering services', exact: true })).toHaveCount(3)
  await expect(modal(page).getByRole('rowheader', { name: 'Outstanding balance', exact: true })).toBeVisible()
  await beginDelete(page)
  await expect(modal(page).getByRole('group', { name: 'Confirm duplicate deletion' })).toContainText('Keep copy 2: INV-688-2')
  await expect(modal(page).getByText('Attachments and history stay with invoice ID 688.', { exact: true })).toBeVisible()
  expect(state.deletes).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('duplicate-review-confirmation.png'), fullPage: false })
  const initialRegisterReads = state.registerReads
  await modal(page).getByRole('button', { name: 'Confirm delete 2 duplicates', exact: true }).click()
  await expect(modal(page).getByRole('status').filter({ hasText: '2 duplicate records deleted.' })).toContainText('2 duplicate records deleted. Kept INV-688-2 (ID 688).')
  await expect(modal(page).getByText('No duplicate invoice IDs were found.', { exact: true })).toBeVisible()
  expect(state.deletes).toEqual([{ group_token: 'group-688-v1', keep_token: 'record-688-2-v1' }])
  await expect.poll(() => state.registerReads).toBeGreaterThan(initialRegisterReads)
  expect(state.reads.length).toBe(2)
  expect(state.reads[0]).toEqual({ page: '1', page_size: '20' })
  clean(state)
})

test('review-only permission permits comparison and disables deletion', async ({ page }) => {
  const state = await open(page, { resolve: false })
  await expect(modal(page).getByText('You can review duplicates. Your access does not allow deleting extra copies.')).toBeVisible()
  for (const radio of await modal(page).getByRole('radio').all()) await expect(radio).toBeDisabled()
  await expect(modal(page).getByRole('button', { name: 'Delete 2 duplicates', exact: true })).toBeDisabled()
  await expect(modal(page).getByRole('button', { name: 'Review selected (0)', exact: true })).toBeDisabled()
  expect(state.bulkDeletes).toEqual([])
  expect(state.deletes).toEqual([]); clean(state)
})

test('a stale group clears the keeper and requires a fresh review before retrying', async ({ page }) => {
  const state = await open(page, { deleteFailure: { status: 409, body: { detail: 'The invoice records changed after this review.', code: 'duplicate_group_stale' } } })
  await beginDelete(page, 1)
  await modal(page).getByRole('button', { name: 'Confirm delete 2 duplicates', exact: true }).click()
  await expect(modal(page).getByRole('alert')).toContainText('Reload duplicates, review the current copies and choose again.')
  await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
  await expect(modal(page).getByRole('radio').first()).toBeDisabled()
  await expect(modal(page).getByRole('button', { name: 'Delete 2 duplicates', exact: true })).toBeDisabled()
  state.deleteFailure = null
  await modal(page).getByRole('button', { name: 'Reload duplicates', exact: true }).click()
  await expect(modal(page).getByRole('radio').first()).toBeEnabled()
  await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
  await beginDelete(page, 2)
  await modal(page).getByRole('button', { name: 'Confirm delete 2 duplicates', exact: true }).click()
  await expect(modal(page).getByRole('status').filter({ hasText: '2 duplicate records deleted.' })).toBeVisible()
  expect(state.deletes[1]).toEqual({ group_token: 'group-688-v2', keep_token: 'record-688-2-v2' })
  clean(state)
})

test('completed deletion stays successful when subsequent modal and workspace reads fail', async ({ page }) => {
  const state = await open(page, { refreshFailure: true })
  await beginDelete(page)
  await modal(page).getByRole('button', { name: 'Confirm delete 2 duplicates', exact: true }).click()
  await expect(modal(page).getByRole('status').filter({ hasText: '2 duplicate records deleted.' })).toBeVisible()
  await expect(modal(page).getByRole('alert')).toContainText('Duplicate review is temporarily unavailable.')
  await expect(page.getByText('Invoices could not be loaded', { exact: true })).toBeVisible()
  state.refreshFailure = false
  await modal(page).getByRole('button', { name: 'Reload duplicates', exact: true }).click()
  await expect(modal(page).getByText('No duplicate invoice IDs were found.', { exact: true })).toBeVisible()
  expect(state.deletes).toHaveLength(1); clean(state)
})

test('filters and pagination send an invoice ID without selecting unseen copies', async ({ page }) => {
  const state = await open(page, { paginated: true })
  await modal(page).getByRole('radio').first().check()
  await modal(page).getByRole('button', { name: 'Next duplicate page' }).click()
  await expect(modal(page).getByRole('heading', { name: 'Invoice ID 900', exact: true })).toBeVisible()
  await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
  expect(state.reads.at(-1).page).toBe('2')
  await modal(page).getByRole('textbox', { name: 'Duplicate invoice ID', exact: true }).fill('688')
  await modal(page).getByRole('button', { name: 'Find duplicates' }).click()
  await expect(modal(page).getByRole('heading', { name: 'Invoice ID 688', exact: true })).toBeVisible()
  expect(state.reads.at(-1)).toEqual({ invoice_id: '688', page: '1', page_size: '20' })
  await expect(modal(page).getByRole('radio', { name: 'Keep copy 1 of invoice ID 688' })).toBeChecked()
  await expect(modal(page).getByRole('button', { name: 'Next duplicate page' })).toBeDisabled()
  expect(state.deletes).toEqual([]); clean(state)
})

test('invoice conflict detail links to a duplicate review filtered by its ID', async ({ page }) => {
  const state = await prepare(page)
  await page.goto('/tests/fixtures/invoice-duplicate-review.html?detail=688', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('alert')).toContainText('Invoice ID 688 has multiple records. Review the duplicates before opening it.')
  const link = page.getByRole('link', { name: 'Review duplicates for invoice ID 688' })
  await expect(link).toHaveAttribute('href', '/finance/outgoing-invoices?review_duplicates=688')
  await link.click()
  await expect(modal(page).getByRole('radio')).toHaveCount(3)
  await expect(modal(page).getByRole('textbox', { name: 'Duplicate invoice ID', exact: true })).toHaveValue('688')
  expect(state.reads[0]).toEqual({ invoice_id: '688', page: '1', page_size: '20' })
  expect(state.deletes).toEqual([]); clean(state)
})

test('keyboard focus stays inside the dialog and returns to the actions menu', async ({ page }) => {
  const state = await open(page)
  const close = modal(page).getByRole('button', { name: 'Close', exact: true })
  await close.focus(); await page.keyboard.press('Tab')
  await expect(modal(page).getByRole('button', { name: 'Close duplicate review', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused()
  await beginDelete(page)
  await expect(modal(page).getByRole('group', { name: 'Confirm duplicate deletion' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(modal(page).getByRole('button', { name: 'Delete 2 duplicates', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(modal(page)).toHaveCount(0)
  await expect(page.locator('summary[aria-label="More invoice actions"]')).toBeFocused()
  expect(state.deletes).toEqual([]); clean(state)
})

test('a permission change during review removes the delete controls', async ({ page }) => {
  const state = await open(page, { deleteFailure: { status: 403, body: { detail: 'You no longer have permission to delete duplicate records.' } } })
  await beginDelete(page)
  await modal(page).getByRole('button', { name: 'Confirm delete 2 duplicates', exact: true }).click()
  await expect(modal(page).getByRole('alert')).toContainText('You no longer have permission')
  await expect(modal(page).getByRole('radio').first()).toBeDisabled()
  await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
  await expect(modal(page).getByRole('button', { name: 'Delete 2 duplicates', exact: true })).toBeDisabled()
  expect(state.deletes).toHaveLength(1); clean(state)
})

test('duplicate comparison stays within desktop and mobile viewports and is accessible', async ({ page }, testInfo) => {
  const state = await open(page)
  const desktop = await modal(page).boundingBox()
  expect(desktop.width).toBeGreaterThan(1000)
  expect(desktop.x).toBeGreaterThan(0)
  const scan = await new AxeBuilder({ page }).include('.oc-duplicates-dialog').analyze()
  expect(scan.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('duplicate-review-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await modal(page).boundingBox()
  expect(mobile.x).toBeGreaterThanOrEqual(0)
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(390)
  expect(await modal(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('duplicate-review-mobile.png') })
  expect(state.deletes).toEqual([]); clean(state)
})

test('collection review identity conflict opens duplicate review and reloads the retained invoice after cleanup', async ({ page }, testInfo) => {
  const state = await prepare(page, { listedInvoice: true })
  await page.setViewportSize({ width: 1672, height: 940 })
  await page.goto('/tests/fixtures/invoice-duplicate-review.html', { waitUntil: 'domcontentloaded' })
  const panel = page.getByRole('complementary', { name: 'Collection review', exact: true })
  await expect(panel.getByRole('alert')).toContainText('Invoice ID 688 has multiple records.')
  const action = panel.getByRole('button', { name: 'Review duplicates for invoice ID 688', exact: true })
  await expect(action).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Open invoice', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Review details', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: /Upload attachment|Recompute/ })).toHaveCount(0)
  expect(state.mutations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('collection-conflict-action.png') })
  await action.click()
  await expect(modal(page).getByRole('radio')).toHaveCount(3)
  await expect(modal(page).getByRole('textbox', { name: 'Duplicate invoice ID', exact: true })).toHaveValue('688')
  expect(state.reads[0]).toEqual({ invoice_id: '688', page: '1', page_size: '20' })
  await modal(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(action).toBeFocused()
  await action.click()
  await expect(modal(page).getByRole('radio')).toHaveCount(3)
  await beginDelete(page, 2)
  expect(state.mutations).toEqual([])
  await modal(page).getByRole('button', { name: 'Confirm delete 2 duplicates', exact: true }).click()
  await expect(modal(page).getByRole('status').filter({ hasText: '2 duplicate records deleted.' })).toContainText('Kept INV-688-2')
  await expect(modal(page).getByText('No duplicate invoice IDs match 688.', { exact: true })).toBeVisible()
  await modal(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'INV-688-2', exact: true })).toBeVisible()
  await expect(panel.getByRole('heading', { name: 'Invoice details', exact: true })).toBeVisible()
  await expect(panel.getByTestId('outgoing-review-outstanding')).toContainText('750.00')
  await expect(panel.getByRole('button', { name: 'Open invoice', exact: true })).toBeEnabled()
  await expect(panel.getByRole('alert')).toHaveCount(0)
  expect(state.detailReads[0]).toBe(409)
  expect(state.detailReads.at(-1)).toBe(200)
  expect(state.detailReads.length).toBeGreaterThan(1)
  expect(state.mutations).toEqual([{ method: 'DELETE', path: '/api/v1/invoice-tracker/invoices/duplicates/' }])
  expect(state.deletes).toEqual([{ group_token: 'group-688-v1', keep_token: 'record-688-2-v1' }])
  await page.screenshot({ path: testInfo.outputPath('collection-retained-invoice.png') })
  clean(state)
})

test('ordinary collection review failures retain Retry without offering duplicate cleanup', async ({ page }) => {
  const state = await prepare(page, { listedInvoice: true, detailFailure: { status: 500, body: { detail: 'The invoice service is temporarily unavailable.', code: 'invoice_identity_conflict' } } })
  await page.goto('/tests/fixtures/invoice-duplicate-review.html', { waitUntil: 'domcontentloaded' })
  const panel = page.getByRole('complementary', { name: 'Collection review', exact: true })
  await expect(panel.getByRole('alert')).toContainText('The invoice service is temporarily unavailable.')
  await expect(panel.getByRole('button', { name: 'Retry invoice details', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: /Review duplicates/ })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Open invoice', exact: true })).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Review details', exact: true })).toHaveCount(0)
  state.detailFailure = null
  await panel.getByRole('button', { name: 'Retry invoice details', exact: true }).click()
  await expect(panel.getByRole('heading', { name: 'Invoice details', exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Open invoice', exact: true })).toBeEnabled()
  expect(state.detailReads).toEqual([500, 200])
  expect(state.mutations).toEqual([])
  expect(state.reads).toEqual([])
  clean(state)
})

const basket = page => modal(page).getByRole('region', { name: 'Selected duplicate groups', exact: true })
const batchConfirmation = page => modal(page).getByRole('group', { name: 'Confirm selected duplicate cleanup', exact: true })
const keeper = (page, id, copy = 1) => modal(page).getByRole('radio', { name: `Keep copy ${copy} of invoice ID ${id}`, exact: true })
async function reviewBatch(page, count) {
  await basket(page).getByRole('button', { name: `Review selected (${count})`, exact: true }).click()
  await expect(batchConfirmation(page)).toBeVisible()
}
async function confirmBatch(page, extras) {
  await batchConfirmation(page).getByRole('button', { name: `Confirm delete ${extras} extra copies`, exact: true }).click()
}
const bulkChoice = (id, copy, version = 1) => ({ group_token: `group-${id}-v${version}`, keep_token: `record-${id}-${copy}-v${version}` })

test('bulk cleanup requires each explicit keeper and a complete accessible confirmation before atomic success', async ({ page }, testInfo) => {
  const state = await open(page, { groupIds: [688, 900] })
  await expect(basket(page).getByRole('button', { name: 'Review selected (0)', exact: true })).toBeDisabled()
  await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
  await keeper(page, 688, 2).check()
  await keeper(page, 900, 3).check()
  await expect(basket(page)).toContainText('2 invoice IDs selected across all pages')
  await reviewBatch(page, 2)
  await expect(batchConfirmation(page)).toContainText('INV-688-2')
  await expect(batchConfirmation(page)).toContainText('INV-900-3')
  await expect(batchConfirmation(page)).toContainText('AED')
  await expect(batchConfirmation(page)).toContainText('1,000.00')
  await expect(batchConfirmation(page).getByRole('button', { name: 'Remove invoice ID 900 from batch' })).toBeVisible()
  await expect(batchConfirmation(page)).toBeFocused()
  expect(state.mutations).toEqual([])
  const scan = await new AxeBuilder({ page }).include('.oc-duplicates-dialog').analyze()
  expect(scan.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('bulk-reviewed-confirmation.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await modal(page).boundingBox()
  expect(mobile.x).toBeGreaterThanOrEqual(0)
  expect(mobile.x + mobile.width).toBeLessThanOrEqual(390)
  expect(await modal(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('bulk-reviewed-confirmation-mobile.png') })
  await page.setViewportSize({ width: 1440, height: 900 })
  const before = { register: state.registerReads, review: state.reads.length }
  await confirmBatch(page, 4)
  await expect(modal(page).getByRole('status').filter({ hasText: '4 duplicate records deleted across 2 invoice IDs.' })).toBeVisible()
  await expect(modal(page).getByText('No duplicate invoice IDs were found.', { exact: true })).toBeVisible()
  expect(state.bulkDeletes).toEqual([{ selections: [bulkChoice(688, 2), bulkChoice(900, 3)] }])
  expect(state.deletes).toEqual([])
  await expect.poll(() => state.registerReads).toBeGreaterThan(before.register)
  expect(state.reads.length).toBe(before.review + 1)
  clean(state)
})

test('bulk review honors a lower server limit and the hard fifty-group maximum', async ({ page }) => {
  const state = await open(page, { groupIds: [688, 900, 901], bulkLimit: 2 })
  await keeper(page, 688).check(); await keeper(page, 900).check()
  await expect(basket(page)).toContainText('Up to 2 invoice IDs per batch')
  await expect(keeper(page, 901)).toBeDisabled()
  await expect(keeper(page, 688, 2)).toBeEnabled()
  await basket(page).getByRole('button', { name: 'Clear choices', exact: true }).click()
  await expect(keeper(page, 901)).toBeEnabled()
  state.bulkLimit = 100
  state.groupIds = Array.from({ length: 51 }, (_, index) => 1000 + index)
  await modal(page).getByRole('button', { name: 'Reload duplicates', exact: true }).click()
  await expect(keeper(page, 1000)).toBeVisible()
  await expect(basket(page)).toContainText('Up to 50 invoice IDs per batch')
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    for (let id = 1000 + pageIndex * 20; id < Math.min(1020 + pageIndex * 20, 1050); id += 1) await keeper(page, id).check()
    if (pageIndex < 2) {
      await modal(page).getByRole('button', { name: 'Next duplicate page', exact: true }).click()
      await expect(keeper(page, 1020 + pageIndex * 20)).toBeVisible()
    }
  }
  await expect(basket(page)).toContainText('50 invoice IDs selected across all pages')
  await expect(keeper(page, 1050)).toBeDisabled()
  await expect(basket(page).getByRole('button', { name: 'Review selected (50)', exact: true })).toBeEnabled()
  expect(state.mutations).toEqual([]); clean(state)
})

test('cross-page keepers persist and refreshed signed tokens bind to unchanged stable keys', async ({ page }) => {
  const state = await open(page, { paginated: true })
  await keeper(page, 688, 2).check()
  await modal(page).getByRole('button', { name: 'Next duplicate page', exact: true }).click()
  await keeper(page, 900).check()
  await expect(basket(page)).toContainText('2 invoice IDs selected across all pages')
  state.version = 2
  await modal(page).getByRole('button', { name: 'Previous duplicate page', exact: true }).click()
  await expect(keeper(page, 688, 2)).toBeChecked()
  await modal(page).getByRole('button', { name: 'Next duplicate page', exact: true }).click()
  await expect(keeper(page, 900)).toBeChecked()
  expect(state.mutations).toEqual([])
  await reviewBatch(page, 2); await confirmBatch(page, 4)
  await expect(modal(page).getByRole('status').filter({ hasText: '4 duplicate records deleted across 2 invoice IDs.' })).toBeVisible()
  expect(state.bulkDeletes).toEqual([{ selections: [bulkChoice(688, 2, 2), bulkChoice(900, 1, 2)] }])
  expect(state.deletes).toEqual([]); clean(state)
})

test('a changed review key invalidates only that group while preserving the other keeper', async ({ page }) => {
  const state = await open(page, { groupIds: [688, 900] })
  await keeper(page, 688, 2).check(); await keeper(page, 900, 3).check()
  state.version = 2; state.reviewVersions[688] = 2
  await modal(page).getByRole('button', { name: 'Reload duplicates', exact: true }).click()
  await expect(keeper(page, 688, 2)).not.toBeChecked()
  await expect(keeper(page, 900, 3)).toBeChecked()
  await expect(modal(page).getByRole('status').filter({ hasText: 'Invoice IDs 688 changed.' })).toBeVisible()
  await expect(basket(page)).toContainText(/1 invoice IDs? selected across all pages/)
  expect(state.mutations).toEqual([])
  await reviewBatch(page, 1); await confirmBatch(page, 2)
  await expect(modal(page).getByRole('status').filter({ hasText: '2 duplicate records deleted across 1 invoice ID' })).toBeVisible()
  expect(state.bulkDeletes).toEqual([{ selections: [bulkChoice(900, 3, 2)] }])
  clean(state)
})

test('bulk stale IDs clear only affected choices and require a deliberate fresh review before retrying', async ({ page }) => {
  const state = await open(page, { groupIds: [688, 900], bulkFailure: { status: 409, body: { detail: 'Invoice ID 688 changed after review.', stale_invoice_ids: [688] } } })
  await keeper(page, 688).check(); await keeper(page, 900, 2).check()
  await reviewBatch(page, 2); await confirmBatch(page, 4)
  await expect(modal(page).getByRole('alert')).toContainText('Invoice ID 688 changed after review.')
  await expect(batchConfirmation(page)).toHaveCount(0)
  await expect(keeper(page, 688)).not.toBeChecked()
  await expect(keeper(page, 900, 2)).toBeChecked()
  await expect(basket(page)).toContainText(/1 invoice IDs? selected across all pages/)
  expect(state.bulkDeletes).toHaveLength(1)
  expect(state.removed).toBe(false)
  await expect(modal(page).getByRole('status').filter({ hasText: 'duplicate records deleted' })).toHaveCount(0)
  state.bulkFailure = null
  await modal(page).getByRole('button', { name: 'Reload duplicates', exact: true }).click()
  await expect(keeper(page, 688, 3)).toBeEnabled()
  await expect(keeper(page, 900, 2)).toBeChecked()
  expect(state.bulkDeletes).toHaveLength(1)
  await keeper(page, 688, 3).check()
  await reviewBatch(page, 2); await confirmBatch(page, 4)
  await expect(modal(page).getByRole('status').filter({ hasText: '4 duplicate records deleted across 2 invoice IDs.' })).toBeVisible()
  expect(state.bulkDeletes[1]).toEqual({ selections: [bulkChoice(688, 3, 2), bulkChoice(900, 2, 2)] })
  clean(state)
})

test('bulk timeout and malformed success never claim deletion or automatically retry', async ({ page }) => {
  const state = await open(page, { groupIds: [688, 900], bulkFailure: { abort: true } })
  const initialRegisterReads = state.registerReads
  for (const outcome of ['timeout', 'malformed']) {
    await test.step(outcome, async () => {
      await keeper(page, 688).check(); await keeper(page, 900, 2).check()
      await reviewBatch(page, 2); await confirmBatch(page, 4)
      await expect(modal(page).getByRole('alert')).toBeVisible()
      await expect(batchConfirmation(page)).toHaveCount(0)
      await expect(modal(page).getByRole('status').filter({ hasText: 'duplicate records deleted' })).toHaveCount(0)
      await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
      expect(state.bulkDeletes).toHaveLength(outcome === 'timeout' ? 1 : 2)
      expect(state.registerReads).toBe(initialRegisterReads)
      if (outcome === 'timeout') {
        state.bulkFailure = null
        state.bulkResponse = { resolved_count: 2, removed_count: 4, results: [] }
        await modal(page).getByRole('button', { name: 'Reload duplicates', exact: true }).click()
        await expect(keeper(page, 688)).toBeEnabled()
        expect(state.bulkDeletes).toHaveLength(1)
      }
    })
  }
  expect(state.removed).toBe(false); expect(state.deletes).toEqual([]); clean(state)
})

test('bulk permission denial clears all choices and removes mutation capability', async ({ page }) => {
  const state = await open(page, { groupIds: [688, 900], bulkFailure: { status: 403, body: { detail: 'Delete permission was removed during this review.' } } })
  await keeper(page, 688).check(); await keeper(page, 900).check()
  await reviewBatch(page, 2); await confirmBatch(page, 4)
  await expect(modal(page).getByRole('alert')).toContainText('Delete permission was removed')
  await expect(modal(page).locator('input[type="radio"]:checked')).toHaveCount(0)
  for (const radio of await modal(page).getByRole('radio').all()) await expect(radio).toBeDisabled()
  await expect(basket(page).getByRole('button', { name: 'Review selected (0)', exact: true })).toBeDisabled()
  expect(state.bulkDeletes).toHaveLength(1)
  expect(state.removed).toBe(false); clean(state)
})
