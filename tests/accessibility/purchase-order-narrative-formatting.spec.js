import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block' })
const html = `<h3>Commercial conditions</h3><p id="format-target">Current narrative text</p>
<p>Supplier:&nbsp;&nbsp;&nbsp;&nbsp;Example Engineering LLC</p>
<p><a href="mailto:supplier@example.test">supplier@example.test</a></p>
<table style="width:80%;border-collapse:collapse"><tbody><tr style="height:48pt">
<th style="width:30%">Discipline</th><td style="padding:3pt 9pt 6pt 2pt;vertical-align:middle"><span style="font-family:'Times New Roman';font-size:14pt;font-weight:700;color:#c00000;text-decoration:underline">Authored amount</span></td>
</tr></tbody></table>`

async function editOrder(page) {
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await page.getByRole('tab', { name: 'PO Description & Scope', exact: true }).click()
}

async function openEditor(page, overrides = {}) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare(fixture) {
    fixture.record = { id: orderFormId, po_number: orderFormNumber, status: 'draft',
      vendor: fixture.vendors[0].id, vendor_name: fixture.vendors[0].name,
      pr_reference: fixture.recommendation.id, pr_number: fixture.recommendation.pr_number,
      title: 'Narrative formatting', description: html, total_amount: '100.00',
      currency: 'USD', items: [], attachments: [], contact_persons: {}, ...overrides }
    fixture.orders = [fixture.record]
  } })
  await editOrder(page)
  return state
}

async function selectText(editor, selector) {
  await editor.locator(selector).evaluate(element => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
}

test('authored narrative typography and table metrics are independent of application table styles', async ({ page }) => {
  const state = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await expect(editor).toHaveCSS('font-size', '16px')
  await expect(page.getByRole('combobox', { name: 'Font size', exact: true })).toHaveValue('3')
  await expect(editor).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(editor).toHaveCSS('line-height', '20.8px')
  await expect(editor.locator('h3')).toHaveCSS('font-size', '21.3333px')
  await expect(editor.locator('h3')).toHaveCSS('font-weight', '700')
  await expect(editor.locator('a')).toHaveCSS('color', 'rgb(29, 78, 216)')
  await expect(editor.locator('a')).toHaveCSS('text-decoration-line', 'underline')
  const amount = editor.locator('td span')
  await expect(amount).toHaveCSS('font-size', '18.6667px')
  await expect(amount).toHaveCSS('font-weight', '700')
  await expect(amount).toHaveCSS('color', 'rgb(192, 0, 0)')
  await expect(amount).toHaveCSS('text-decoration-line', 'underline')
  await expect(editor.locator('td')).toHaveCSS('padding-top', '4px')
  await expect(editor.locator('td')).toHaveCSS('padding-right', '12px')
  await expect(editor.locator('td')).toHaveCSS('vertical-align', 'middle')
  await expect(editor.locator('tr')).toHaveCSS('height', '64px')
  const widths = await editor.evaluate(element => ({
    table: element.querySelector('table').getBoundingClientRect().width,
    content: element.clientWidth - parseFloat(getComputedStyle(element).paddingLeft) - parseFloat(getComputedStyle(element).paddingRight),
  }))
  expect(widths.table / widths.content).toBeCloseTo(.8, 1)
  expect(await editor.evaluate(element => getComputedStyle(element).maxWidth)).toBe('none')
  expect(await editor.evaluate(element => element.scrollHeight <= element.clientHeight || getComputedStyle(element).overflowY === 'auto')).toBe(true)
  await expect(page.getByText('Microsoft-style formatting', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('toolbar', { name: 'Narrative formatting', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('real bold underline colour and font-size commands retain their formatting in the current export snapshot', async ({ page }) => {
  const state = await openEditor(page)
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  await selectText(editor, '#format-target')
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  await page.getByRole('button', { name: 'Underline', exact: true }).click()
  await page.getByLabel('Font colour', { exact: true }).fill('#c00000')
  await page.getByRole('combobox', { name: 'Font size', exact: true }).selectOption('4')
  const computed = await editor.locator('#format-target').evaluate(element => {
    const leaf = [...element.querySelectorAll('*')].at(-1) || element
    const style = getComputedStyle(leaf)
    return { color: style.color, weight: style.fontWeight, size: style.fontSize,
      underlined: [element, ...element.querySelectorAll('*')].some(node => getComputedStyle(node).textDecorationLine.includes('underline')) }
  })
  expect(computed).toEqual({ color: 'rgb(192, 0, 0)', weight: '700', size: '18px', underlined: true })
  const currentHtml = await editor.innerHTML()
  await expect.poll(() => state.requests.filter(row => row.path.endsWith('/preview-document/') && row.body?.format === 'pdf').at(-1)?.body.snapshot.description).toBe(currentHtml)
  await writeFile('../.codex-temp/po-narrative-20260924/formatted-narrative.html', currentHtml)
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('unchanged narrative focus preserves legacy scope when another field is saved', async ({ page }) => {
  const state = await openEditor(page, { scope_of_services: 'Retained legacy scope', contact_persons: { order_introduction: 'Original introduction' } })
  await page.getByRole('textbox', { name: 'PO Narrative', exact: true }).focus()
  await page.getByRole('textbox', { name: 'Buyer / Seller introduction', exact: true }).fill('Edited introduction')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toEqual({ contact_persons: { order_introduction: 'Edited introduction' } })
  expect(state.record.scope_of_services).toBe('Retained legacy scope')
  expect(state.record.description).toBe(html)
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('cleared narrative and introduction remain empty in exports, failed saves and reopening', async ({ page }) => {
  const state = await openEditor(page, { scope_of_services: 'Previous legacy scope', contact_persons: { order_introduction: 'Previous introduction', show_scope_heading: false } })
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  const lastSnapshot = format => state.requests.filter(row => row.path.endsWith('/preview-document/') && row.body?.format === format).at(-1)?.body.snapshot
  await page.getByRole('textbox', { name: 'Buyer / Seller introduction', exact: true }).fill('')
  await page.getByRole('button', { name: 'Clear text', exact: true }).click()
  await expect.poll(() => lastSnapshot('pdf')?.description).toBe('')
  expect(lastSnapshot('pdf').scope_of_services).toBe('')
  expect(lastSnapshot('pdf').contact_persons).toEqual({ order_introduction: '', show_scope_heading: false })
  state.saveError = { detail: 'The save did not finish. Please retry.' }
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true }).getByRole('alert')).toContainText(state.saveError.detail)
  await expect(editor).toHaveText('')
  await expect(page.getByRole('textbox', { name: 'Buyer / Seller introduction', exact: true })).toHaveValue('')
  expect(state.acceptedWrites).toEqual([])
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Word', exact: true }).click()
  await download
  expect(lastSnapshot('word').description).toBe('')
  expect(lastSnapshot('word').scope_of_services).toBe('')
  expect(lastSnapshot('word').contact_persons).toEqual({ order_introduction: '', show_scope_heading: false })
  state.saveError = null
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toEqual({ description: '', scope_of_services: '', contact_persons: { order_introduction: '', show_scope_heading: false } })
  await editOrder(page)
  await expect(editor).toHaveText('')
  await expect(page.getByRole('checkbox', { name: 'Show heading', exact: true })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Show introduction', exact: true })).not.toBeChecked()
  await expect(page.getByRole('textbox', { name: 'Buyer / Seller introduction', exact: true })).toHaveCount(0)
  await page.getByRole('heading', { name: 'PO Description & Scope', exact: true }).locator('..').locator('..').screenshot({ path: '../.codex-temp/po-narrative-20260924/compact-empty-editor.png' })
  await editor.pressSequentially('Updated engineering scope')
  await expect.poll(() => lastSnapshot('pdf')?.description).toBe('Updated engineering scope')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('recovered new-order draft autosave persists explicit narrative clearing to the existing order', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') })
  const record = {
    id: orderFormId, po_number: orderFormNumber, status: 'draft', title: 'Recovered new-order draft',
    description: 'Saved server narrative', scope_of_services: 'Saved legacy scope',
    vendor: 21, vendor_name: 'Alfanar Engineering LLC', pr_reference: orderFormRecommendation.id,
    pr_number: orderFormRecommendation.pr_number, category: 'engineering_services', total_amount: '100.00',
    currency: 'AED', payment_terms: 'Net 30', vat_basis: 'none', vat_rate: 0, tax_amount: '0.00',
    items: [{ item_no: 1, description: 'Engineering services', quantity: 1, uom: 'LOT', unit_price: 100, discount: 0, total_price: 100 }],
    attachments: [], contact_persons: { order_introduction: '', show_scope_heading: false },
    approval_log: [{ level: 0, stage: 'Final Management Sign-off', user_id: '11', approver: 'Jarmo Suominen', status: 'Pending' }],
  }
  await page.addInitScript(({ record, recommendation }) => {
    sessionStorage.setItem('radai:po-draft:v1:7:new::', JSON.stringify({ version: 1, sequence: 1, snapshot: { formData: { ...record, description: 'Narrative waiting for autosave' }, draftId: record.id, selectedRequisition: recommendation, currentSection: 2, pricingEdited: false, pricingConfirmed: false, attachmentSlots: [] } }))
  }, { record, recommendation: orderFormRecommendation })
  const state = await orderFormHarness(page, { prepare: fixture => { fixture.record = structuredClone(record); fixture.orders = [fixture.record] } })
  await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  await expect(editor).toHaveText('Narrative waiting for autosave')
  await page.clock.fastForward(31000)
  await expect.poll(() => state.acceptedWrites.length).toBe(1)
  expect(state.record.description).toBe('Narrative waiting for autosave')
  await page.getByRole('button', { name: 'Clear text', exact: true }).click()
  await expect(editor).toHaveText('')
  await page.clock.fastForward(31000)
  await expect.poll(() => state.acceptedWrites.length).toBe(2)
  expect(state.acceptedWrites[1]).toMatchObject({ method: 'PATCH', body: { description: '', scope_of_services: '' } })
  expect(state.record.description).toBe('')
  expect(state.record.scope_of_services).toBe('')
  await page.getByRole('tab', { name: 'Header, Buyer & Project', exact: true }).click()
  await page.getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('none')
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled()
  await expect(page.getByRole('form', { name: 'Purchase order form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(state.acceptedWrites).toHaveLength(3)
  expect(state.acceptedWrites[2].method).toBe('PATCH')
  expect(state.record.description).toBe('')
  expect(state.record.scope_of_services).toBe('')
  await editOrder(page)
  await expect(editor).toHaveText('')
  await expect(page.getByRole('checkbox', { name: 'Show heading', exact: true })).not.toBeChecked()
  expect(state.acceptedWrites.every(write => write.method === 'PATCH')).toBe(true)
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('compact narrative editor retains rich content, publishes paste and empty changes immediately, and can undo clearing', async ({ page }) => {
  const errors = [], requests = []
  const image = '<img alt="Saved diagram" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=">'
  await page.addInitScript(value => { window.approvalFixture = value }, { po: { description: html + image } })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => { requests.push(route.request().url()); return route.fulfill({ status: 400, json: {} }) })
  await page.goto('/tests/fixtures/procurement-approval.html?view=narrative', { waitUntil: 'domcontentloaded' })
  const editor = page.getByRole('textbox', { name: 'PO Narrative', exact: true })
  await expect(editor.locator('table')).toBeVisible()
  await expect(editor).toHaveCSS('font-size', '16px')
  await expect(page.getByRole('combobox', { name: 'Font size', exact: true })).toHaveValue('3')
  await expect(editor.locator('img')).toHaveAttribute('alt', 'Saved diagram')
  await editor.focus()
  await page.getByRole('button', { name: 'Bold', exact: true }).focus()
  expect(await page.evaluate(() => window.narrativeChanges || [])).toEqual([])
  await selectText(editor, '#format-target')
  await page.getByRole('button', { name: 'Bold', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(editor.locator('#format-target b')).toHaveText('Current narrative text')
  await expect(editor.locator('td span')).toHaveAttribute('style', /font-size:\s*14pt/)
  await page.getByRole('button', { name: 'Clear text', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.narrativeChanges?.at(-1))).toBe('')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editor.locator('table')).toBeVisible()
  await expect(editor.locator('img')).toHaveAttribute('alt', 'Saved diagram')
  await editor.focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await expect.poll(() => page.evaluate(() => window.narrativeChanges?.at(-1))).toBe('')
  await editor.pressSequentially('Fresh narrative. ')
  await expect.poll(() => page.evaluate(() => window.narrativeChanges?.at(-1))).toContain('Fresh narrative.')
  await editor.evaluate(element => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', '<p><strong>Pasted scope</strong></p><table><tbody><tr><td style="color:#c00000">Retained cell</td></tr></tbody></table><script>window.untrustedPasteRan = true</script><svg><a xlink:href="javascript:window.untrustedPasteRan=true">Unsafe link</a></svg>')
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  })
  await expect(editor.locator('strong')).toHaveText('Pasted scope')
  await expect(editor.locator('td')).toHaveText('Retained cell')
  expect(await page.evaluate(() => window.untrustedPasteRan)).toBeUndefined()
  await expect(editor.locator('script, svg, [xlink\\:href]')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.narrativeChanges?.at(-1))).toContain('Pasted scope')
  await page.getByRole('button', { name: 'Insert table', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Table rows', exact: true }).fill('2')
  await page.getByRole('dialog', { name: 'Insert table', exact: true }).getByRole('button', { name: 'Insert table', exact: true }).click()
  await expect(editor.locator('table')).toHaveCount(2)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('toolbar', { name: 'Narrative formatting', exact: true }).screenshot({ path: '../.codex-temp/po-narrative-20260924/compact-toolbar-narrow.png' })
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

for (const scenario of [
  { name: 'explicit blanks', description: '', contacts: { order_introduction: '', show_scope_heading: false }, pages: 2 },
  { name: 'empty rich placeholders and a standalone break', description: '<p><br>&nbsp;\u200B\u200C\u200D\uFEFF</p><table></table><div data-po-page-break="true">Page Break</div>', contacts: { order_introduction: '', show_scope_heading: true }, pages: 2 },
  { name: 'the legacy default introduction', description: '', contacts: {}, pages: 3 },
  { name: 'a table grid with empty cells', description: '<table><tbody><tr><td>&nbsp;</td></tr></tbody></table>', contacts: { order_introduction: '', show_scope_heading: false }, pages: 3 },
  { name: 'a hidden retained introduction', description: '', contacts: { order_introduction: 'Retained hidden introduction', show_order_introduction: false }, pages: 2 },
  { name: 'an explicitly shown introduction', description: '', contacts: { order_introduction: 'Shown introduction', show_order_introduction: true }, pages: 3 },
  { name: '12pt default with authored font sizes retained', description: '<p>Default body <span style="font-size:9pt">Authored small text</span></p>', contacts: { show_order_introduction: false }, pages: 3 },
]) {
  test(`legacy scope preview handles ${scenario.name} without title-as-body fallback`, async ({ page }) => {
    const requests = [], errors = []
    await page.addInitScript(value => { window.approvalFixture = value }, { actor: {}, pr: { items: [], attachments: [] }, po: { id: orderFormId, po_number: orderFormNumber, title: 'Cover summary remains', description: scenario.description, contact_persons: scenario.contacts, items: [] } })
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => { requests.push(route.request().url()); return route.fulfill({ status: 400, json: {} }) })
    await page.goto('/tests/fixtures/procurement-approval.html?view=documents', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.po-template-page')).toHaveCount(scenario.pages)
    if (scenario.pages === 2) await expect(page.locator('.po-template-page').getByText('PO Description & Scope', { exact: true })).toHaveCount(0)
    else await expect(page.locator('.po-template-page').nth(1).locator('.po-rich-narrative')).not.toContainText('Cover summary remains')
    if (scenario.description.includes('Authored small text')) {
      await expect(page.locator('.po-rich-narrative')).toHaveCSS('font-size', '16px')
      await expect(page.getByText('Authored small text', { exact: true })).toHaveCSS('font-size', '12px')
    }
    expect(requests).toEqual([])
    expect(errors).toEqual([])
  })
}
