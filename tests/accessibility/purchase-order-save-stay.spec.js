import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const scope = page => page.getByRole('tab', { name: 'PO Description & Scope', exact: true })
const narrative = page => page.getByRole('textbox', { name: 'PO Narrative', exact: true })
const save = page => page.getByRole('button', { name: /^Save (changes|draft)$/, exact: true }).first()
const close = page => page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const record = () => ({
  id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'draft',
  title: 'Saved engineering order', description: 'Original scope', scope_of_services: '',
  vendor: 21, vendor_name: 'Alfanar Engineering LLC', currency: 'AED', total_amount: '100.00',
  vat_basis: 'none', tax_amount: '0', vat_percentage: 0, payment_terms: 'Net 30',
  pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
  items: [{ description: 'Engineering services', quantity: 1, unit_price: 100 }],
  attachments: [], contact_persons: { show_order_introduction: false }, approval_log: [],
})
async function existing(page, options = {}) {
  const state = await orderFormHarness(page, {
    path: options.detail ? `/procurement/orders/${orderFormId}` : '/procurement/orders',
    prepare: state => { state.record = record(); options.prepare?.(state); state.orders = [state.record] },
    handleRequest: options.handleRequest,
  })
  if (options.detail) await page.getByRole('button', { name: 'Edit', exact: true }).click()
  else {
    await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  }
  await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  await scope(page).click()
  return state
}
async function saved(page, state, count) {
  await expect.poll(() => state.acceptedWrites.length).toBe(count)
  await expect(save(page)).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
}

test('save stays on the selected section and consecutive edits use the latest saved baseline', async ({ page }) => {
  const state = await existing(page)
  await narrative(page).fill('Updated scope')
  await save(page).click()
  await saved(page, state, 1)
  await expect(scope(page)).toHaveAttribute('aria-selected', 'true')
  await expect(narrative(page)).toHaveText('Updated scope')
  await narrative(page).fill('Original scope')
  await save(page).click()
  await saved(page, state, 2)
  expect(state.acceptedWrites[1]).toMatchObject({ method: 'PATCH', path: `/api/v1/procurement/orders/${orderFormId}/`, body: { description: 'Original scope' } })
  expect(state.acceptedWrites[1].body).not.toHaveProperty('approval_log')
  expect(state.acceptedWrites[1].body).not.toHaveProperty('total_amount')
  await page.screenshot({ path: '../.codex-temp/po-save-stay-20260924/saved-editor.png' })
  await close(page)
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  clean(state)
})

test('a new draft stays open and subsequent saves and refresh use the same PO', async ({ page }) => {
  const state = await orderFormHarness(page)
  await page.locator('#po-pr-search').fill('9001')
  await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
  await page.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('none')
  await scope(page).click()
  await narrative(page).fill('First saved scope')
  await save(page).click()
  await saved(page, state, 1)
  await expect(scope(page)).toHaveAttribute('aria-selected', 'true')
  await narrative(page).fill('Second saved scope')
  await save(page).click()
  await saved(page, state, 2)
  expect(state.acceptedWrites.map(row => row.method)).toEqual(['POST', 'PATCH'])
  expect(state.acceptedWrites[1].path).toBe(`/api/v1/procurement/orders/${orderFormId}/`)
  await narrative(page).fill('Unsaved scope after the second save')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(narrative(page)).toHaveText('Unsaved scope after the second save')
  await save(page).click()
  await saved(page, state, 3)
  expect(state.acceptedWrites.map(row => row.method)).toEqual(['POST', 'PATCH', 'PATCH'])
  expect(state.record.description).toBe('Unsaved scope after the second save')
  await close(page)
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  clean(state)
})

test('edits made during a save survive its response and browser refresh', async ({ page }) => {
  let release
  const wait = new Promise(resolve => { release = resolve })
  let hold = true, started = false
  const state = await existing(page, { handleRequest: async (route, _state, url) => {
    if (hold && route.request().method() === 'PATCH' && url.pathname.endsWith(`/${orderFormId}/`)) {
      started = true
      await wait
    }
    return false
  } })
  await narrative(page).fill('Scope being saved')
  await save(page).click()
  await expect.poll(() => started).toBe(true)
  await narrative(page).fill('Newer unsaved scope')
  hold = false
  release()
  await saved(page, state, 1)
  expect(state.record.description).toBe('Scope being saved')
  await expect(narrative(page)).toHaveText('Newer unsaved scope')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await expect(narrative(page)).toHaveText('Newer unsaved scope')
  await save(page).click()
  await saved(page, state, 2)
  expect(state.record.description).toBe('Newer unsaved scope')
  clean(state)
})

test('detail-page edits stay open, retain input on errors, and show saved data on explicit close', async ({ page }) => {
  const state = await existing(page, { detail: true })
  await narrative(page).fill('Retained correction')
  state.saveError = { detail: 'The record could not be saved. Retry.' }
  await save(page).click()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true }).getByRole('alert')).toContainText(state.saveError.detail)
  await expect(narrative(page)).toHaveText('Retained correction')
  expect(state.acceptedWrites).toHaveLength(0)
  state.saveError = null
  await save(page).click()
  await saved(page, state, 1)
  await expect(scope(page)).toHaveAttribute('aria-selected', 'true')
  await close(page)
  await expect(page.getByRole('heading', { name: orderFormNumber, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await scope(page).click()
  await expect(narrative(page)).toHaveText('Retained correction')
  clean(state)
})

test('a saved upload becomes an existing attachment and is not uploaded by the next save', async ({ page }) => {
  const state = await existing(page, { handleRequest: async (route, state, url) => {
    if (route.request().method() !== 'PATCH' || !url.pathname.endsWith(`/${orderFormId}/`)) return false
    const submitted = state.requests.at(-1)
    if (!submitted.body.attachments_files) return false
    const { attachments_files: upload, ...body } = submitted.body
    state.record = { ...state.record, ...body, attachments: [{ filename: upload.filename, s3_key: 'synthetic/scope.txt', title: 'Scope attachment', description: '' }] }
    state.orders = [state.record]
    state.acceptedWrites.push(submitted)
    await route.fulfill({ status: 200, json: state.record })
    return true
  } })
  await page.getByRole('tab', { name: 'Attachments', exact: true }).click()
  await page.locator('#po-attachment-multiple').setInputFiles({ name: 'scope.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment') })
  await page.getByRole('textbox', { name: 'Attachment 1 title', exact: true }).fill('Scope attachment')
  await save(page).click()
  await saved(page, state, 1)
  await expect(page.getByRole('textbox', { name: 'Attachment 1 title', exact: true })).toHaveValue('Scope attachment')
  await scope(page).click()
  await narrative(page).fill('Changed after uploading')
  await save(page).click()
  await saved(page, state, 2)
  expect(state.acceptedWrites[1].body).not.toHaveProperty('attachments_files')
  expect(state.record.attachments).toHaveLength(1)
  clean(state)
})

test('a canonical completed response keeps an already open detail editor visible with its commercial lock', async ({ page }) => {
  const state = await existing(page, { detail: true, handleRequest: async (route, state, url) => {
    if (route.request().method() === 'PATCH' && url.pathname.endsWith(`/${orderFormId}/`)) {
      state.record.status = 'completed'
      state.record.commercial_edit_locked = true
    }
    return false
  } })
  await narrative(page).fill('Saved scope before completion')
  await save(page).click()
  await saved(page, state, 1)
  await expect(scope(page)).toHaveAttribute('aria-selected', 'true')
  await expect(narrative(page)).toHaveText('Saved scope before completion')
  await expect(narrative(page)).toHaveAttribute('contenteditable', 'false')
  await close(page)
  await expect(page.getByRole('heading', { name: orderFormNumber, exact: true })).toBeVisible()
  clean(state)
})

test('only an explicit successful vendor send exits the editor', async ({ page }) => {
  const state = await existing(page, { prepare: state => { state.record.can_send_to_vendor = true; state.record.summary = 'Supplier order summary' } })
  await narrative(page).fill('Saved before sending')
  await save(page).click()
  await saved(page, state, 1)
  expect(state.acceptedWrites[0].body).not.toHaveProperty('status')
  await page.getByRole('tab', { name: 'Attachments', exact: true }).click()
  state.sendError = { detail: 'The send failed. Please retry.' }
  await page.getByRole('button', { name: 'Send to vendor', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true }).getByRole('alert')).toContainText(state.sendError.detail)
  expect(state.acceptedWrites).toHaveLength(1)
  state.sendError = null
  await page.getByRole('button', { name: 'Send to vendor', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(2)
  expect(state.acceptedWrites[1].body.status).toBe('sent')
  clean(state)
})
