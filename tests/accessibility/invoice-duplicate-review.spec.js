import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.use({ serviceWorkers: 'block' })
test.setTimeout(90000)
const makeGroup = (id = 688, version = 1) => ({
  invoice_id: id, record_count: 3, identical: false, group_token: `group-${id}-v${version}`, attachments_count: 2,
  records: Array.from({ length: 3 }, (_, index) => ({ record_token: `record-${id}-${index + 1}-v${version}`, invoice_number: `INV-${id}-${index + 1}`, company: 'Rejlers', account: 'Example Customer', rad_project_no: 'RAD-100', project_name: 'Engineering services', invoice_date: '2026-08-01', due_date: '2026-09-01', payment_status: index === 1 ? 'partial' : 'pending', currency: 'AED', invoice_amount: '1000.00', invoice_amount_aed: '1000.00', balance_to_be_received: index === 1 ? '750.00' : '1000.00', actual_payment_received: index === 1 ? '250.00' : '0.00', created_at: '2026-08-01T12:30:00Z', updated_at: '2026-09-22T08:00:00Z' })),
})
const modal = page => page.getByRole('dialog', { name: 'Review duplicate invoices', exact: true })
async function prepare(page, overrides = {}) {
  const state = { resolve: true, deletes: [], reads: [], registerReads: 0, version: 1, removed: false, deleteFailure: null, refreshFailure: false, paginated: false, unknown: [], errors: [], ...overrides }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'isolated-duplicate-review-fixture'))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/v1/invoice-tracker/invoices/duplicates/') {
      if (request.method() === 'DELETE') {
        const body = request.postDataJSON(); state.deletes.push(body)
        if (state.deleteFailure) { state.version += 1; return reply(state.deleteFailure.body, state.deleteFailure.status) }
        state.removed = true
        return reply({ invoice_id: 688, removed_count: 2, kept_invoice_number: body.keep_token.includes('-2-') ? 'INV-688-2' : 'INV-688-1', archive_id: 'archive-1' })
      }
      state.reads.push(Object.fromEntries(url.searchParams))
      if (state.refreshFailure && state.removed) return reply({ detail: 'Duplicate review is temporarily unavailable.' }, 503)
      const pageNumber = Number(url.searchParams.get('page')), filtered = !!url.searchParams.get('invoice_id')
      return reply({ schema_version: '1.0', pagination: { page: pageNumber, page_size: 20, total_groups: state.removed ? 0 : state.paginated && !filtered ? 21 : 1, has_next: !state.removed && state.paginated && !filtered && pageNumber === 1 }, capabilities: { resolve: state.resolve }, groups: state.removed ? [] : [makeGroup(pageNumber === 2 ? 900 : 688, state.version)] })
    }
    if (path === '/api/v1/invoice-tracker/invoices/688/') return reply({ detail: 'Invoice ID 688 has multiple records. Review the duplicates before opening it.', code: 'invoice_identity_conflict' }, 409)
    if (path === '/api/v1/invoice-tracker/invoices/' || path === '/api/v1/invoice-tracker/invoices/collections-summary/') {
      state.registerReads += 1
      if (state.refreshFailure && state.removed) return reply({ detail: 'Register refresh temporarily unavailable.' }, 503)
      return reply(path.endsWith('/collections-summary/') ? { schema_version: '1.0', capabilities: {}, currencies: ['AED'], counts: {}, filter_options: {}, collection_health: {} } : { count: 0, results: [] })
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
  await expect(modal(page).getByRole('radio')).toHaveCount(3)
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

test('filters and pagination send an invoice ID and clear previous selections', async ({ page }) => {
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
