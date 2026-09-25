import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })

const introduction = page => page.getByRole('textbox', { name: 'Buyer / Seller introduction', exact: true })
const preview = page => page.getByRole('complementary', { name: 'Live purchase order preview', exact: true })
const lastPdf = state => state.requests.filter(request => request.path.endsWith('/preview-document/') && request.body.format === 'pdf').at(-1)?.body.snapshot
const standard = name => `We, Rejlers International Engineering Solutions (Buyer), issue this purchase order to ${name} (Seller).`
const contacts = { technical: [{ name: 'Retained technical contact' }], purchase_summary: 'Retained commercial summary' }

async function editOrder(page) {
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'PO Description & Scope', exact: true }).click()
  await expect(preview(page).getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30000 })
}

async function openEditor(page, overrides = {}) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = {
      id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'draft',
      title: 'Order with an editable Buyer / Seller introduction', description: '<p>Saved engineering scope</p>',
      vendor: fixture.vendors[0].id, vendor_name: fixture.vendors[0].name,
      currency: 'AED', total_amount: '1050', net_amount: '1000', tax_amount: '50', vat_basis: 'exclusive', vat_percentage: 5,
      pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
      items: [{ description: 'Design', quantity: 1, unit_price: 1000 }], attachments: [], approval_log: [],
      contact_persons: structuredClone(contacts), ...overrides,
    }
    fixture.orders = [fixture.record]
  } })
  await editOrder(page)
  return state
}

function clean(state) {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

test('automatic introduction follows the selected seller without changing the saved contact metadata', async ({ page }) => {
  const state = await openEditor(page)
  await expect(page.getByRole('checkbox', { name: 'Show heading', exact: true })).toBeChecked()
  await expect(introduction(page)).toHaveValue(standard(state.vendors[0].name))
  expect(lastPdf(state).contact_persons).toEqual(contacts)
  await expect(page.getByRole('button', { name: 'Use standard introduction', exact: true })).toBeDisabled()
  await page.getByRole('tab', { name: 'Header, Buyer & Project', exact: true }).click()
  await page.getByRole('combobox', { name: 'Seller Information', exact: true }).selectOption(String(state.vendors[1].id))
  await page.getByRole('tab', { name: 'PO Description & Scope', exact: true }).click()
  await expect(introduction(page)).toHaveValue(standard(state.vendors[1].name))
  await expect.poll(() => lastPdf(state)?.vendor).toBe(String(state.vendors[1].id))
  expect(lastPdf(state).contact_persons).toEqual(contacts)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('scope heading selection reaches exports and survives save errors and reopening without changing the narrative', async ({ page }) => {
  const savedContacts = { ...contacts, order_introduction: 'Retained Buyer / Seller introduction' }
  const state = await openEditor(page, { contact_persons: savedContacts })
  const heading = page.getByRole('checkbox', { name: 'Show heading', exact: true })
  await expect(heading).toBeChecked()
  expect(lastPdf(state).contact_persons).toEqual(savedContacts)
  await heading.uncheck()
  await expect.poll(() => lastPdf(state)?.contact_persons?.show_scope_heading).toBe(false)
  expect(lastPdf(state).description).toBe('<p>Saved engineering scope</p>')
  await expect(introduction(page)).toHaveValue(savedContacts.order_introduction)
  await expect(page.getByRole('heading', { name: 'PO Description & Scope', exact: true })).toBeVisible()
  await expect(preview(page).getByRole('button', { name: 'Download Word', exact: true })).toBeEnabled()
  const pending = page.waitForEvent('download')
  await preview(page).getByRole('button', { name: 'Download Word', exact: true }).click()
  await pending
  const word = state.requests.filter(request => request.path.endsWith('/preview-document/') && request.body.format === 'word').at(-1).body.snapshot
  expect(word.contact_persons).toEqual({ ...savedContacts, show_scope_heading: false })
  expect(word.description).toBe('<p>Saved engineering scope</p>')
  state.saveError = { detail: 'Save could not be completed. Please retry.' }
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true }).getByRole('alert')).toContainText(state.saveError.detail)
  await expect(heading).not.toBeChecked()
  expect(state.acceptedWrites).toEqual([])
  state.saveError = null
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toEqual({ contact_persons: { ...savedContacts, show_scope_heading: false } })
  await editOrder(page)
  await expect(heading).not.toBeChecked()
  await expect(introduction(page)).toHaveValue(savedContacts.order_introduction)
  await heading.scrollIntoViewIfNeeded()
  await page.getByRole('heading', { name: 'PO Description & Scope', exact: true }).locator('..').locator('..').screenshot({ path: '../.codex-temp/po-scope-heading-20260924/frontend-heading-hidden.png' })
  await heading.check()
  await expect.poll(() => lastPdf(state)?.contact_persons?.show_scope_heading).toBe(true)
  expect(lastPdf(state).description).toBe('<p>Saved engineering scope</p>')
  expect(lastPdf(state).contact_persons).toEqual({ ...savedContacts, show_scope_heading: true })
  clean(state)
})

test('edited introduction reaches current PDF and Word then saves and reopens with other contact metadata intact', async ({ page }) => {
  const state = await openEditor(page)
  const custom = 'We, Rejlers International Engineering Solutions (Buyer), issue this purchase order under the agreed framework.\nThe Seller is the selected supplier; terms A & B apply.'
  await introduction(page).fill(custom)
  await expect.poll(() => lastPdf(state)?.contact_persons?.order_introduction).toBe(custom)
  await expect(preview(page).getByRole('button', { name: 'Download Word', exact: true })).toBeEnabled()
  const pending = page.waitForEvent('download')
  await preview(page).getByRole('button', { name: 'Download Word', exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe('Current-PO.docx')
  expect((await readFile(await download.path())).toString()).toBe(state.generatedWord)
  expect(state.requests.filter(request => request.path.endsWith('/preview-document/') && request.body.format === 'word').at(-1).body.snapshot.contact_persons).toEqual({ ...contacts, order_introduction: custom })
  expect(state.acceptedWrites).toEqual([])
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toEqual({ contact_persons: { ...contacts, order_introduction: custom } })
  await editOrder(page)
  await expect(introduction(page)).toHaveValue(custom)
  await introduction(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../.codex-temp/po-introduction-20260924/edited-introduction.png' })
  clean(state)
})

test('cleared introduction stays blank in current exports and after saving until explicitly reset', async ({ page }) => {
  const state = await openEditor(page, { contact_persons: { ...contacts, order_introduction: 'Previously customized introduction' } })
  await introduction(page).fill('')
  await expect.poll(() => lastPdf(state)?.contact_persons?.order_introduction).toBe('')
  await expect(introduction(page)).toBeEmpty()
  await expect(introduction(page)).not.toHaveAttribute('placeholder')
  await expect(introduction(page)).not.toHaveAttribute('aria-describedby')
  await expect(page.locator('#po-order-introduction-help')).toHaveCount(0)
  await expect(page.getByText('Appears above PO Description & Scope in the PDF and Word document. Leave blank to use the standard Buyer / Seller introduction.', { exact: true })).toHaveCount(0)
  await expect(preview(page).getByRole('button', { name: 'Download Word', exact: true })).toBeEnabled()
  const pending = page.waitForEvent('download')
  await preview(page).getByRole('button', { name: 'Download Word', exact: true }).click()
  await pending
  expect(state.requests.filter(request => request.path.endsWith('/preview-document/') && request.body.format === 'word').at(-1).body.snapshot.contact_persons).toEqual({ ...contacts, order_introduction: '' })
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toEqual({ contact_persons: { ...contacts, order_introduction: '' } })
  await editOrder(page)
  await expect(page.getByRole('checkbox', { name: 'Show introduction', exact: true })).not.toBeChecked()
  await expect(introduction(page)).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Show introduction', exact: true }).check()
  await expect(introduction(page)).toBeEmpty()
  await expect(introduction(page)).not.toHaveAttribute('placeholder')
  expect(lastPdf(state).contact_persons.order_introduction).toBe('')
  await introduction(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../.codex-temp/po-introduction-20260924/blank-introduction.png' })
  await page.getByRole('button', { name: 'Use standard introduction', exact: true }).click()
  await expect(introduction(page)).toHaveValue(standard(state.vendors[0].name))
  await expect.poll(() => lastPdf(state)?.contact_persons).toEqual({ ...contacts, show_order_introduction: true })
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(2)
  expect(state.acceptedWrites[1].body).toEqual({ contact_persons: { ...contacts, show_order_introduction: true } })
  await editOrder(page)
  await expect(introduction(page)).toHaveValue(standard(state.vendors[0].name))
  expect(lastPdf(state).contact_persons).toEqual({ ...contacts, show_order_introduction: true })
  clean(state)
})

test('save errors preserve the custom introduction for correction and retry', async ({ page }) => {
  const state = await openEditor(page)
  const custom = 'Customized Buyer / Seller wording retained after a failed save.'
  await introduction(page).fill(custom)
  state.saveError = { contact_persons: { order_introduction: ['This introduction requires correction.'] } }
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true }).getByRole('alert')).toContainText('This introduction requires correction.')
  await expect(introduction(page)).toHaveValue(custom)
  expect(state.acceptedWrites).toEqual([])
  state.saveError = null
  await introduction(page).fill(`${custom} Corrected.`)
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.record.contact_persons.order_introduction).toBe(`${custom} Corrected.`)
  clean(state)
})

test('approved commercial locks also protect custom introduction, reset and scope heading', async ({ page }) => {
  const custom = 'Approved Buyer / Seller wording'
  const state = await openEditor(page, { status: 'approved', commercial_edit_locked: true, contact_persons: { ...contacts, order_introduction: custom } })
  await expect(introduction(page)).toHaveValue(custom)
  await expect(introduction(page)).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Show heading', exact: true })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: 'Show introduction', exact: true })).toBeDisabled()
  await expect(page.getByRole('textbox', { name: 'PO Narrative', exact: true })).toHaveAttribute('contenteditable', 'false')
  await expect(page.getByRole('button', { name: 'Clear text', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Use standard introduction', exact: true })).toBeDisabled()
  expect(lastPdf(state).contact_persons.order_introduction).toBe(custom)
  expect(state.acceptedWrites).toEqual([])
  clean(state)
})

test('new orders default to a hidden introduction and 12pt narrative while retaining toggled wording after saving', async ({ page }) => {
  const state = await orderFormHarness(page)
  await page.locator('#po-pr-search').fill('9001')
  await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
  await page.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('none')
  await page.getByRole('tab', { name: 'PO Description & Scope', exact: true }).click()
  const toggle = page.getByRole('checkbox', { name: 'Show introduction', exact: true })
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  await expect(toggle).not.toBeChecked()
  await expect(introduction(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Use standard introduction', exact: true })).toHaveCount(0)
  await expect(editor).toHaveCSS('font-size', '16px')
  await expect(page.getByRole('combobox', { name: 'Font size', exact: true })).toHaveValue('3')
  await expect.poll(() => lastPdf(state)?.contact_persons?.show_order_introduction).toBe(false)
  await page.getByRole('heading', { name: 'PO Description & Scope', exact: true }).locator('..').locator('..').screenshot({ path: '../.codex-temp/po-narrative-20260924/intro-hidden-12pt.png' })
  await toggle.check()
  await expect(introduction(page)).toHaveValue(standard(state.vendors[0].name))
  const custom = 'Buyer and Seller introduction retained while hidden.'
  await introduction(page).fill(custom)
  await page.getByRole('heading', { name: 'PO Description & Scope', exact: true }).locator('..').locator('..').screenshot({ path: '../.codex-temp/po-narrative-20260924/intro-expanded-12pt.png' })
  await toggle.uncheck()
  await expect(introduction(page)).toHaveCount(0)
  await expect.poll(() => ({ visible: lastPdf(state)?.contact_persons?.show_order_introduction, wording: lastPdf(state)?.contact_persons?.order_introduction })).toEqual({ visible: false, wording: custom })
  const pending = page.waitForEvent('download')
  await preview(page).getByRole('button', { name: 'Download Word', exact: true }).click()
  await pending
  const word = state.requests.filter(request => request.path.endsWith('/preview-document/') && request.body.format === 'word').at(-1).body.snapshot
  expect(word.contact_persons).toMatchObject({ show_order_introduction: false, order_introduction: custom })
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.record.contact_persons).toMatchObject({ show_order_introduction: false, order_introduction: custom })
  await editOrder(page)
  await expect(toggle).not.toBeChecked()
  await expect(introduction(page)).toHaveCount(0)
  await toggle.check()
  await expect(introduction(page)).toHaveValue(custom)
  clean(state)
})

test('legacy blank introduction stays collapsed without metadata changes and explicit visibility survives failure and reopening', async ({ page }) => {
  const state = await openEditor(page, { contact_persons: { ...contacts, order_introduction: '' } })
  const toggle = page.getByRole('checkbox', { name: 'Show introduction', exact: true })
  await expect(toggle).not.toBeChecked()
  await expect(introduction(page)).toHaveCount(0)
  expect(lastPdf(state).contact_persons).toEqual({ ...contacts, order_introduction: '' })
  expect(state.acceptedWrites).toEqual([])
  await toggle.check()
  await expect(introduction(page)).toHaveValue('')
  const custom = 'Retained custom introduction.'
  await introduction(page).fill(custom)
  await toggle.uncheck()
  state.saveError = { detail: 'The change could not be saved. Please retry.' }
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true }).getByRole('alert')).toContainText(state.saveError.detail)
  await expect(toggle).not.toBeChecked()
  await toggle.check()
  await expect(introduction(page)).toHaveValue(custom)
  await toggle.uncheck()
  state.saveError = null
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites[0].body).toEqual({ contact_persons: { ...contacts, order_introduction: custom, show_order_introduction: false } })
  await editOrder(page)
  await expect(toggle).not.toBeChecked()
  await toggle.check()
  await expect(introduction(page)).toHaveValue(custom)
  await introduction(page).fill('')
  await expect(toggle).toBeChecked()
  await expect(introduction(page)).toHaveValue('')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites[1].body).toEqual({ contact_persons: { ...contacts, order_introduction: '', show_order_introduction: true } })
  await editOrder(page)
  await expect(toggle).toBeChecked()
  await expect(introduction(page)).toHaveValue('')
  clean(state)
})

for (const context of ['current draft', 'saved order']) {
  test(`Word attachment warnings remain visible after downloading the ${context}`, async ({ page }) => {
    const state = await openEditor(page)
    let warningCount = '2'
    const routePattern = context === 'current draft'
      ? '**/api/v1/procurement/orders/preview-document/'
      : `**/api/v1/procurement/orders/${orderFormId}/export-word/`
    await page.route(routePattern, async route => {
      if (context === 'current draft' && !route.request().postData().includes('\r\nword\r\n')) return route.fallback()
      return route.fulfill({
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: state.generatedWord,
        headers: { 'content-disposition': 'attachment; filename="Order-with-attachments.docx"', 'X-PO-Attachment-Warnings': warningCount },
      })
    })
    if (context === 'saved order') {
      await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
      await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
      await page.getByRole('menuitem', { name: 'Preview', exact: true }).click()
    }
    const control = context === 'current draft'
      ? preview(page).getByRole('button', { name: 'Download Word', exact: true })
      : page.getByRole('button', { name: 'Export Word document', exact: true })
    const pending = page.waitForEvent('download')
    await control.click()
    const downloaded = await pending
    expect(downloaded.suggestedFilename()).toBe('Order-with-attachments.docx')
    const warning = page.getByRole('alert').filter({ hasText: 'This download has 2 attachment warnings.' })
    await expect(warning).toContainText('Some attachment content could not be included.')
    await expect(warning).toContainText("Check the order's attachments before sharing the document.")
    await page.locator('.Toastify__toast--warning').getByRole('button', { name: 'close', exact: true }).click()
    await expect(warning).toHaveCount(0)
    warningCount = '0'
    const completeDownload = page.waitForEvent('download')
    await control.click()
    await completeDownload
    await expect(page.locator('.Toastify__toast--warning')).toHaveCount(0)
    expect(state.acceptedWrites).toEqual([])
    clean(state)
  })
}

for (const [name, custom, showHeading] of [['empty', ''], ['whitespace', ' \n\t '], ['unset', undefined], ['hidden heading', undefined, false]]) {
  test(`legacy document preview ${showHeading === false ? 'hides only the scope heading when requested' : name === 'unset' ? 'retains the default for unset text' : `omits the entire introduction paragraph for ${name} text`}`, async ({ page }) => {
    const requests = [], errors = []
    await page.addInitScript(value => { window.approvalFixture = value }, {
      actor: {}, pr: { id: 'synthetic-pr', pr_number: 'SYNTHETIC-PR', items: [], attachments: [] },
      po: { id: orderFormId, po_number: orderFormNumber, title: 'Company scope introduction case', description: '<p>Engineering scope remains visible</p>', vendor_name: 'Synthetic Seller', items: [], contact_persons: { ...(custom === undefined ? {} : { order_introduction: custom }), ...(showHeading === undefined ? {} : { show_scope_heading: showHeading }) } },
    })
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => { requests.push(route.request().url()); return route.fulfill({ status: 400, json: { detail: 'No API call is expected in this document fixture.' } }) })
    await page.goto('/tests/fixtures/procurement-approval.html?view=documents', { waitUntil: 'domcontentloaded' })
    const scopePage = page.locator('.po-template-page').nth(1)
    await expect(scopePage.getByText('Engineering scope remains visible', { exact: true })).toBeVisible()
    await expect(scopePage.getByText('PO Description & Scope', { exact: true })).toHaveCount(showHeading === false ? 0 : 1)
    const paragraph = scopePage.locator('p.mt-3.whitespace-pre-wrap')
    if (custom === undefined) await expect(paragraph).toHaveText(standard('Synthetic Seller'))
    else {
      await expect(paragraph).toHaveCount(0)
      await expect(scopePage).not.toContainText('(Buyer), issue this purchase order')
    }
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })
}
