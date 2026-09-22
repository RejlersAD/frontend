import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })
test.setTimeout(90000)
const workbook = { name: 'Receivables.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('Synthetic upload content; the API parser is tested separately.') }
const published = { mode: 'workbook', rows_published: 4404, source: { snapshot_id: 7, file_name: workbook.name, row_count: 4404 }, activated: false, created: false, rows_created: 0, rows_updated: 0, rows_skipped: 0, errors: [], sheets_processed: 1, rows_seen: 4404 }
const summary = { schema_version: '1.0', capabilities: { import: true }, currencies: ['AED'], counts: {}, filter_options: {}, collection_health: {} }
const dashboard = {
  schema_version: '1.0', currency: 'AED', amount_basis: 'recorded_aed', as_of_date: '2026-09-22',
  sources: { receivables: { status: 'available', mode: 'workbook' }, payables: { status: 'restricted' } },
  kpis: Object.fromEntries(['unpaid', 'overdue', 'over30', 'over60', 'over90'].map(key => [key, { amount: '10.00', count: 1 }])),
  customers: [], filters: { currencies: ['AED'], companies: [] },
  workbook_summary: { status: 'unavailable', reason: 'Upload a receivables workbook to view its totals.' },
}

async function openImport(page, overrides = {}) {
  const state = { imports: [], reads: 0, unknown: [], errors: [], failure: null, refreshFailure: false, ...overrides }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'isolated-receivables-upload-fixture'))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/v1/invoice-tracker/invoices/import-excel/' && request.method() === 'POST') {
      const form = request.postDataBuffer().toString('utf8')
      const field = name => form.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r\\n]*)`))?.[1]
      state.imports.push({ mode: field('mode'), sheets: field('sheets'), hasFile: form.includes('filename="Receivables.xlsx"') })
      return state.failure ? reply(state.failure, 400) : reply(state.response || (field('mode') === 'operational' ? { mode: 'operational', rows_created: 2, rows_updated: 1, rows_skipped: 0, errors: [] } : published))
    }
    if (path === '/api/v1/invoice-tracker/invoices/' || path === '/api/v1/invoice-tracker/invoices/collections-summary/') {
      state.reads += 1
      if (state.refreshFailure && state.imports.length) return reply({ detail: 'Register refresh temporarily unavailable.' }, 503)
      return reply(path.endsWith('/collections-summary/') ? summary : { count: 0, results: [] })
    }
    if (path === '/api/v1/finance/dashboard/receivables/') return reply(dashboard)
    if (path === '/api/v1/finance/dashboard/customer-invoices/') return reply({ schema_version: '1.0', rows: [], source: { status: 'available', mode: 'workbook' }, pagination: { count: 0, page: 1, page_size: 8, total_pages: 1 }, totals: {}, currency: 'AED' })
    state.unknown.push({ method: request.method(), path })
    return reply({ detail: 'Unexpected isolated test request' }, 404)
  })
  await page.goto('/tests/fixtures/receivables-workbook-upload.html', { waitUntil: 'domcontentloaded' })
  await page.locator('summary[aria-label="More invoice actions"]').click()
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Import customer invoices' })).toBeVisible()
  return state
}
const dialog = page => page.getByRole('dialog', { name: 'Import customer invoices' })
const choose = page => dialog(page).locator('input[type="file"]').setInputFiles(workbook)
const clean = state => { expect(state.unknown).toEqual([]); expect(state.errors).toEqual([]) }

test('reporting is the default purpose, publishes all rows, and opens the receivables dashboard', async ({ page }) => {
  const state = await openImport(page)
  await expect(page.getByRole('radio', { name: /^Receivables reporting/ })).toBeChecked()
  await expect(page.getByLabel('Restrict to sheets')).toHaveCount(0)
  await expect(dialog(page).locator('input[type="file"]')).toHaveAttribute('accept', '.xlsx')
  await choose(page)
  await page.getByRole('button', { name: 'Publish workbook', exact: true }).click()
  await expect(dialog(page).getByRole('status')).toContainText('4,404 invoice rows published')
  await expect(dialog(page).getByText('Created', { exact: true })).toHaveCount(0)
  expect(state.imports).toEqual([{ mode: 'workbook', sheets: undefined, hasFile: true }])
  await page.getByRole('link', { name: 'View receivables', exact: true }).click()
  await expect(page).toHaveURL(/\/finance$/)
  await expect(page.getByRole('heading', { name: 'Accounts Receivable', exact: true })).toBeVisible()
  await expect(page.getByText('Upload a receivables workbook to view its totals.', { exact: true }).first()).toBeVisible()
  clean(state)
})

test('invoice register purpose explicitly sends legacy mode and selected sheets', async ({ page }) => {
  const state = await openImport(page)
  await page.getByRole('radio', { name: /^Invoice register/ }).check()
  await page.getByLabel('Restrict to sheets').fill(' ExternalInvoice,InternalInvoice2018 ')
  await choose(page)
  await page.getByRole('button', { name: 'Start import', exact: true }).click()
  await expect(dialog(page).getByRole('status')).toContainText('Import complete')
  await expect(dialog(page).getByText('Updated', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View receivables' })).toHaveCount(0)
  expect(state.imports).toEqual([{ mode: 'operational', sheets: 'ExternalInvoice,InternalInvoice2018', hasFile: true }])
  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await page.locator('summary[aria-label="More invoice actions"]').click()
  await page.getByRole('button', { name: 'Import Excel', exact: true }).click()
  await expect(page.getByRole('radio', { name: /^Receivables reporting/ })).toBeChecked()
  clean(state)
})

test('invalid files and backend validation errors do not announce publication or refresh the register', async ({ page }) => {
  const state = await openImport(page, { failure: { detail: 'The External Invoice sheet is missing. The previous report remains available.' } })
  await dialog(page).locator('input[type="file"]').setInputFiles({ ...workbook, name: 'Old-format.xls' })
  await expect(dialog(page).getByRole('alert')).toHaveText('Choose an Excel workbook (.xlsx).')
  await expect(page.getByRole('button', { name: 'Publish workbook', exact: true })).toBeDisabled()
  expect(state.imports).toEqual([])
  await choose(page)
  await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  const readsBefore = state.reads
  await page.getByRole('button', { name: 'Publish workbook', exact: true }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('The External Invoice sheet is missing.')
  await expect(dialog(page).getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'View receivables' })).toHaveCount(0)
  expect(state.reads).toBe(readsBefore)
  state.failure = null
  await choose(page)
  await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Publish workbook', exact: true }).click()
  await expect(dialog(page).getByRole('status')).toContainText('4,404 invoice rows published')
  clean(state)
})

test('successful publication remains successful when the subsequent register refresh fails', async ({ page }) => {
  const state = await openImport(page, { refreshFailure: true })
  await choose(page)
  await page.getByRole('button', { name: 'Publish workbook', exact: true }).click()
  await expect(page.getByText('Invoices could not be loaded', { exact: true })).toBeVisible()
  await expect(dialog(page).getByRole('status')).toContainText('4,404 invoice rows published')
  await expect(dialog(page).getByRole('alert')).toHaveCount(0)
  await page.getByRole('link', { name: 'View receivables', exact: true }).click()
  await expect(page).toHaveURL(/\/finance$/)
  await expect(page.getByRole('heading', { name: 'Accounts Receivable', exact: true })).toBeVisible()
  clean(state)
})

test('empty and legacy upload responses do not claim reporting publication', async ({ page }) => {
  const state = await openImport(page)
  const readsBefore = state.reads
  for (const response of [{ ...published, rows_published: 0 }, { rows_created: 4404, rows_updated: 0, errors: [] }]) {
    state.response = response
    await choose(page)
    await page.getByRole('button', { name: 'Publish workbook', exact: true }).click()
    await expect(dialog(page).getByRole('alert')).toContainText('The upload response did not confirm publication.')
    await expect(dialog(page).getByRole('status')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'View receivables' })).toHaveCount(0)
  }
  expect(state.reads).toBe(readsBefore)
  clean(state)
})
