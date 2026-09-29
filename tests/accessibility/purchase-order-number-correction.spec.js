import { test, expect } from '@playwright/test'
import { orderFormHarness, orderFormId } from '../fixtures/purchase-order-form.fixture'
import { formActor } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const oldNumber = 'RAD-PRJ-PUR-9002_2026'
const correctedNumber = 'RAD-PRJ-PUR-9002_JUL2026'
const originalTimestamp = '2026-09-15T08:00:00Z'
const correctionPath = `/api/v1/procurement/orders/${orderFormId}/correct-number/`
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function open(page, options = {}) {
  const state = await orderFormHarness(page, {
    path: options.entry === 'register' ? '/procurement/orders' : `/procurement/orders/${orderFormId}`,
    actor: options.actor || { ...formActor, is_superuser: false, module_actions: { procurement_orders: ['read', 'update'] } },
    prepare: fixture => {
      fixture.record = {
        id: orderFormId, po_number: oldNumber, updated_at: originalTimestamp,
        status: options.status || 'completed', title: 'Synthetic saved purchase order',
        vendor: 21, vendor_name: fixture.vendors[0].name, currency: 'AED',
        total_amount: '1050.00', net_amount: '1000.00', tax_amount: '50.00',
        commercial_edit_locked: true, items: [], attachments: [],
        approval_log: [{ level: 1, stage: 'Management', status: 'approved' }],
      }
      fixture.orders = [fixture.record]
      options.prepare?.(fixture)
    },
    handleRequest: async (route, fixture, url) => {
      if (url.pathname !== correctionPath) return false
      if (fixture.correctionWait) await fixture.correctionWait
      if (fixture.correctionError) {
        await reply(route, fixture.correctionError.body, fixture.correctionError.status)
        return true
      }
      if (fixture.correctionResponse) {
        await reply(route, fixture.correctionResponse)
        return true
      }
      const body = route.request().postDataJSON()
      fixture.record = { ...fixture.record, po_number: body.po_number, updated_at: '2026-09-15T08:01:00Z' }
      fixture.orders = [fixture.record]
      fixture.acceptedWrites.push({ path: url.pathname, method: route.request().method(), body })
      await reply(route, fixture.record)
      return true
    },
  })
  if (options.entry === 'register') await expect(page.getByRole('button', { name: `Select ${oldNumber}`, exact: true })).toBeVisible({ timeout: 90000 })
  else await expect(page.getByRole('heading', { name: oldNumber, exact: true })).toBeVisible({ timeout: 90000 })
  return state
}

const lockReason = 'Approved commercial details are locked. Create a revised purchase order for commercial changes.'

async function openExistingEdit(page, options = {}) {
  const state = await open(page, { ...options, prepare: fixture => {
    Object.assign(fixture.record, { commercial_edit_lock_reason: lockReason, payment_terms: '', vendor: null,
      approval_log: [{ level: 1, status: 'approved', source: 'signed_po_pdf', signature_verified: true }] })
    const contentUrl = `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/original/content/`
    fixture.uploadedDocuments = [{ id: 'original', filename: 'Original-PO.pdf', content_url: contentUrl }]
    fixture.uploadedContent[contentUrl] = { body: fixture.generatedPdf }
    options.prepare?.(fixture)
  } })
  if (options.entry === 'register') {
    await page.getByRole('button', { name: `Actions for ${oldNumber}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  } else await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editor = page.locator('.purchase-order-form-workspace')
  await expect(editor.getByRole('textbox', { name: 'PO number', exact: true })).toBeFocused()
  await expect(editor.getByText(lockReason, { exact: true })).toHaveCount(0)
  await expect(editor.getByRole('textbox', { name: 'Payment Terms', exact: true })).not.toBeEditable()
  await expect(editor.getByRole('link', { name: 'Download uploaded PO', exact: true })).toBeVisible()
  expect(state.requests.filter(request => request.method === 'POST' && request.path.startsWith('/api/v1/procurement/'))).toEqual([])
  return { state, editor }
}

for (const entry of ['detail', 'register']) {
  for (const status of ['sent', 'completed']) {
    test(`normal ${entry} Edit corrects an uploaded ${status} PO without commercial validation`, async ({ page }) => {
      const { state, editor } = await openExistingEdit(page, { entry, status })
      const originalApproval = structuredClone(state.record.approval_log)
      await editor.getByRole('textbox', { name: 'PO number', exact: true }).fill(correctedNumber)
      await editor.getByRole('button', { name: 'Save changes', exact: true }).last().click()
      await expect.poll(() => state.acceptedWrites.length).toBe(1)
      await expect(editor.getByRole('textbox', { name: 'PO number', exact: true })).toHaveValue(correctedNumber)
      expect(state.acceptedWrites).toEqual([{ path: correctionPath, method: 'POST', body: {
        po_number: correctedNumber, expected_updated_at: originalTimestamp,
      } }])
      expect(state.record.status).toBe(status)
      expect(state.record.approval_log).toEqual(originalApproval)
      await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
      if (entry === 'register') await expect(page.getByRole('button', { name: `Select ${correctedNumber}`, exact: true })).toBeVisible()
      else await expect(page.getByRole('heading', { name: correctedNumber, exact: true })).toBeVisible()
      await page.reload()
      if (entry === 'register') await expect(page.getByRole('button', { name: `Select ${correctedNumber}`, exact: true })).toBeVisible()
      else await expect(page.getByRole('heading', { name: correctedNumber, exact: true })).toBeVisible()
      clean(state)
    })
  }
}

test('normal Edit keeps the number after a conflict and reuses the returned timestamp for the next save', async ({ page }) => {
  const { state, editor } = await openExistingEdit(page, { prepare: fixture => {
    fixture.correctionError = { status: 409, body: { po_number: ['This Purchase Order number is already in use.'] } }
  } })
  const input = editor.getByRole('textbox', { name: 'PO number', exact: true })
  await input.fill(correctedNumber)
  await editor.getByRole('button', { name: 'Save changes', exact: true }).last().click()
  await expect(editor.getByRole('alert')).toHaveText('This Purchase Order number is already in use.')
  await expect(input).toHaveValue(correctedNumber)
  state.correctionError = null
  await editor.getByRole('button', { name: 'Save changes', exact: true }).last().click()
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  const secondNumber = 'RAD-PRJ-PUR-9002_AUG2026'
  await input.fill(secondNumber)
  await editor.getByRole('button', { name: 'Save changes', exact: true }).last().click()
  await expect.poll(() => state.acceptedWrites.length).toBe(2)
  expect(state.acceptedWrites[1].body).toEqual({ po_number: secondNumber, expected_updated_at: '2026-09-15T08:01:00Z' })
  await expect(input).toHaveValue(secondNumber)
  clean(state)
})

test('normal Edit cancels without writes and cannot close while saving', async ({ page }) => {
  let finish
  const { state, editor } = await openExistingEdit(page, { prepare: fixture => {
    fixture.correctionWait = new Promise(resolve => { finish = resolve })
  } })
  await editor.getByRole('textbox', { name: 'PO number', exact: true }).fill(correctedNumber)
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.acceptedWrites).toEqual([])
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(editor.getByRole('textbox', { name: 'PO number', exact: true })).toHaveValue(oldNumber)
  await editor.getByRole('textbox', { name: 'PO number', exact: true }).fill(correctedNumber)
  await editor.getByRole('button', { name: 'Save changes', exact: true }).last().click()
  await expect(editor.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await expect(editor.getByRole('button', { name: 'Saving…', exact: true }).last()).toBeDisabled()
  finish()
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  await expect(editor.getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled()
  clean(state)
})

async function edit(page) {
  await page.getByRole('button', { name: 'Edit PO number', exact: true }).click()
  const form = page.getByRole('form', { name: 'Edit PO number', exact: true })
  await expect(form.getByRole('textbox', { name: 'PO number', exact: true })).toBeFocused()
  await form.getByRole('textbox', { name: 'PO number', exact: true }).fill(correctedNumber)
  return form
}

for (const status of ['completed', 'sent', 'draft']) {
  test(`corrects a ${status} PO number and retains the saved value after reload`, async ({ page }) => {
    const state = await open(page, { status })
    const approvalLog = structuredClone(state.record.approval_log)
    const previewsBefore = state.requests.filter(request => request.path.endsWith('/export-pdf/')).length
    const form = await edit(page)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('heading', { name: correctedNumber, exact: true })).toBeVisible()
    await expect(form).toHaveCount(0)
    expect(state.acceptedWrites).toEqual([{ path: correctionPath, method: 'POST', body: {
      po_number: correctedNumber, expected_updated_at: originalTimestamp,
    } }])
    expect(state.record.status).toBe(status)
    expect(state.record.approval_log).toEqual(approvalLog)
    await expect.poll(() => state.requests.filter(request => request.path.endsWith('/export-pdf/')).length).toBeGreaterThan(previewsBefore)
    await page.reload()
    await expect(page.getByRole('heading', { name: correctedNumber, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Edit PO number', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'PO number', exact: true })).toHaveValue(correctedNumber)
    clean(state)
  })
}

for (const [name, status, body, message] of [
  ['duplicate', 409, { po_number: ['This Purchase Order number is already in use.'] }, 'This Purchase Order number is already in use.'],
  ['stale', 409, { error: 'This purchase order changed. Refresh before saving its number.' }, 'This purchase order changed. Refresh before saving its number.'],
  ['denied', 403, { detail: 'You do not have permission to correct this PO number.' }, 'You do not have permission to correct this PO number.'],
  ['validation', 400, { po_number: ['Enter a valid RAD purchase order number.'] }, 'Enter a valid RAD purchase order number.'],
  ['server', 500, {}, 'The PO number could not be saved. Try again.'],
]) {
  test(`keeps the typed number after a ${name} failure`, async ({ page }) => {
    const state = await open(page, { prepare: fixture => { fixture.correctionError = { status, body } } })
    const form = await edit(page)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toHaveText(message)
    await expect(form.getByRole('textbox', { name: 'PO number', exact: true })).toHaveValue(correctedNumber)
    await expect(form.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    expect(state.record.po_number).toBe(oldNumber)
    expect(state.acceptedWrites).toEqual([])
    expect(state.requests.filter(request => request.path === correctionPath)).toHaveLength(1)
    clean(state)
  })
}

test('validates an empty number and cancels without saving', async ({ page }) => {
  const state = await open(page)
  const form = await edit(page)
  await form.getByRole('textbox', { name: 'PO number', exact: true }).fill(' ')
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(form.getByRole('alert')).toHaveText('Enter a PO number.')
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(form).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit PO number', exact: true })).toBeFocused()
  expect(state.requests.filter(request => request.path === correctionPath)).toEqual([])
  expect(state.record.po_number).toBe(oldNumber)
  clean(state)
})

test('prevents repeat saves while the correction is pending', async ({ page }) => {
  let finish
  const state = await open(page, { prepare: fixture => { fixture.correctionWait = new Promise(resolve => { finish = resolve }) } })
  const form = await edit(page)
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(form.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  await expect(form.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await expect(form.getByRole('textbox', { name: 'PO number', exact: true })).toBeDisabled()
  finish()
  await expect(page.getByRole('heading', { name: correctedNumber, exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  clean(state)
})

test('read-only users have no number correction action', async ({ page }) => {
  const state = await open(page, { actor: {
    ...formActor, is_superuser: false,
    module_actions: { procurement_orders: ['read'] },
  } })
  await expect(page.getByRole('button', { name: 'Edit PO number', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

for (const [name, overrides] of [
  ['different record', { id: 'another-order', po_number: correctedNumber }],
  ['unsaved number', { po_number: oldNumber }],
]) {
  test(`keeps the correction draft if the response acknowledges a ${name}`, async ({ page }) => {
    const state = await open(page, { prepare: fixture => {
      fixture.correctionResponse = { ...fixture.record, ...overrides }
    } })
    const form = await edit(page)
    await form.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(form.getByRole('alert')).toHaveText('The saved PO number could not be confirmed. Refresh and check it.')
    await expect(form.getByRole('textbox', { name: 'PO number', exact: true })).toHaveValue(correctedNumber)
    await expect(page.getByRole('heading', { name: oldNumber, exact: true })).toBeVisible()
    expect(state.acceptedWrites).toEqual([])
    clean(state)
  })
}
