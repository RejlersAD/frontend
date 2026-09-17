import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const title = 'Current purchase order PDF preview'
const pane = page => page.getByRole('complementary', { name: 'Live purchase order preview' })
const viewer = page => pane(page).getByRole('region', { name: title, exact: true })
const pdfButton = page => pane(page).getByRole('button', { name: 'Download PDF', exact: true })
const scrollView = page => viewer(page).locator('div[tabindex="0"]')
const clean = state => {
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
}

async function editOrder(page, number = orderFormNumber) {
  await page.getByRole('button', { name: `Actions for ${number}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await page.getByRole('tab', { name: 'PO Description & Scope', exact: true }).click()
  await expect(pdfButton(page)).toBeEnabled({ timeout: 30000 })
}

async function openEditor(page, secondOrder = false) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.generatedPdf = mixedSizePdf(8)
    fixture.record = {
      id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'draft',
      title: 'Formatting review', description: '<p>Review this narrative formatting</p>',
      vendor: 21, vendor_name: fixture.vendors[0].name, currency: 'AED',
      total_amount: '1050', net_amount: '1000', tax_amount: '50', vat_basis: 'exclusive', vat_percentage: 5,
      pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
      items: [{ description: 'Design', quantity: 1, unit_price: 1000 }], attachments: [], approval_log: [],
    }
    fixture.orders = [fixture.record]
    if (secondOrder) fixture.orders.push({ ...fixture.record, id: '00000000-0000-4000-8000-000000009099', po_number: 'RAD-PRJ-PUR-9099_SEP2026' })
  } })
  if (secondOrder) await page.route(`**/api/v1/procurement/orders/${state.orders[1].id}/`, route => route.fulfill({ json: state.orders[1] }))
  await editOrder(page)
  return state
}

async function setReadingPosition(page) {
  const pageInput = viewer(page).getByRole('spinbutton', { name: 'Page number' })
  await pageInput.fill('5')
  await pageInput.press('Enter')
  await expect(viewer(page).getByRole('img', { name: `${title}, page 5 of 8`, exact: true })).toBeVisible()
  const fitWidth = await viewer(page).getByRole('img').evaluate(element => element.getBoundingClientRect().width)
  await viewer(page).getByRole('button', { name: 'Zoom in', exact: true }).click()
  await viewer(page).getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(() => viewer(page).getByRole('img').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(fitWidth * 1.45)
  await scrollView(page).evaluate(element => element.scrollTo(60, 40))
  return { fitWidth, ...await geometry(page) }
}

async function geometry(page) {
  return scrollView(page).evaluate(element => ({ top: element.scrollTop, left: element.scrollLeft, width: element.querySelector('canvas').getBoundingClientRect().width }))
}

async function selectNarrative(page) {
  await page.getByRole('textbox', { name: 'PO Narrative', exact: true }).evaluate(element => {
    element.focus()
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
}

async function replaceNarrative(page, text) {
  await page.getByRole('textbox', { name: 'PO Narrative', exact: true }).evaluate((element, value) => {
    element.innerHTML = `<p>${value}</p>`
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
}

test('bold, underline and colour updates retain page, zoom, scroll and visible canvas until the replacement paints', async ({ page }) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    window.previewPdfUrls = { created: [], revoked: [] }
    URL.createObjectURL = blob => {
      const url = create(blob)
      if (blob.type === 'application/pdf') window.previewPdfUrls.created.push(url)
      return url
    }
    URL.revokeObjectURL = url => { window.previewPdfUrls.revoked.push(url); revoke(url) }
  })
  const state = await openEditor(page)
  const position = await setReadingPosition(page)
  const waiting = []
  const outputs = [mixedSizePdf(8), mixedSizePdf(9), mixedSizePdf(3)]
  await page.route('**/api/v1/procurement/orders/preview-document/', async route => {
    const index = waiting.length
    await new Promise(resolve => waiting.push({ release: resolve, body: route.request().postData() }))
    await route.fulfill({ contentType: 'application/pdf', body: outputs[index] })
  })
  for (let index = 0; index < 3; index += 1) {
    const previousUrl = await page.evaluate(() => window.previewPdfUrls.created.at(-1))
    await viewer(page).getByRole('img').evaluate(element => { element.dataset.retained = 'yes' })
    await selectNarrative(page)
    if (index < 2) await page.getByRole('button', { name: index === 0 ? 'B' : 'U', exact: true }).click()
    else await page.getByLabel('Font colour', { exact: true }).fill('#c81e1e')
    await expect(pdfButton(page)).toBeDisabled()
    await expect(pane(page).getByRole('button', { name: 'Download Word', exact: true })).toBeDisabled()
    await expect.poll(() => waiting.length).toBe(index + 1)
    await expect(viewer(page).getByRole('img')).toHaveAttribute('data-retained', 'yes')
    await expect(viewer(page).getByRole('spinbutton', { name: 'Page number' })).toHaveValue('5')
    expect(await geometry(page)).toEqual({ top: position.top, left: position.left, width: position.width })
    await expect(viewer(page).getByRole('status')).toContainText('Updating preview')
    expect(await page.evaluate(() => window.previewPdfUrls.revoked)).not.toContain(previousUrl)
    if (index === 0) await page.screenshot({ path: '../artifacts/po-preview-preserves-page-during-update.png' })
    if (index === 1) await viewer(page).getByRole('spinbutton', { name: 'Page number' }).focus()
    waiting[index].release()
    await expect(pdfButton(page)).toBeEnabled({ timeout: 30000 })
    await expect(viewer(page).getByRole('img')).not.toHaveAttribute('data-retained', 'yes')
    expect(await page.evaluate(() => window.previewPdfUrls.revoked)).toContain(previousUrl)
    await expect(viewer(page).getByRole('spinbutton', { name: 'Page number' })).toHaveValue(index === 2 ? '3' : '5')
    expect(await geometry(page)).toEqual({ top: position.top, left: position.left, width: position.width })
  }
  expect(waiting[0].body).toMatch(/<b>|<strong>|font-weight/)
  expect(waiting[1].body).toMatch(/<u>|underline/)
  expect(waiting[2].body).toMatch(/c81e1e|200, 30, 30/)
  const downloadEvent = page.waitForEvent('download')
  await pdfButton(page).click()
  expect(await readFile(await (await downloadEvent).path())).toEqual(outputs[2])
  expect(waiting).toHaveLength(3)
  clean(state)
})

test('late responses and failed updates keep the reading position and never expose stale exports', async ({ page }) => {
  const state = await openEditor(page)
  const position = await setReadingPosition(page)
  let releaseOlder
  let started = false
  let rejectCurrent = true
  const older = new Promise(resolve => { releaseOlder = resolve })
  const latest = mixedSizePdf(7)
  await page.route('**/api/v1/procurement/orders/preview-document/', async route => {
    if (route.request().postData().includes('Older held edit')) {
      started = true
      await older
      return route.fulfill({ contentType: 'application/pdf', body: mixedSizePdf(1) })
    }
    if (route.request().postData().includes('Current error') && rejectCurrent) return route.fulfill({ status: 400, json: { description: ['Review the table width.'] } })
    return route.fulfill({ contentType: 'application/pdf', body: latest })
  })
  await replaceNarrative(page, 'Older held edit')
  await expect.poll(() => started).toBe(true)
  await replaceNarrative(page, 'Newer current edit')
  await expect(pdfButton(page)).toBeEnabled({ timeout: 30000 })
  releaseOlder()
  await expect(viewer(page).getByRole('img')).toHaveAttribute('aria-label', `${title}, page 5 of 7`)
  await replaceNarrative(page, 'Current error')
  await expect(pane(page).getByRole('alert')).toContainText('Review the table width.')
  await expect(viewer(page).getByRole('img')).toBeVisible()
  await expect(viewer(page).getByRole('spinbutton', { name: 'Page number' })).toHaveValue('5')
  expect(await geometry(page)).toEqual({ top: position.top, left: position.left, width: position.width })
  await expect(pdfButton(page)).toBeDisabled()
  await expect(pane(page).getByRole('button', { name: 'Download Word', exact: true })).toBeDisabled()
  rejectCurrent = false
  await pane(page).getByRole('button', { name: 'Retry preview', exact: true }).click()
  await expect(pdfButton(page)).toBeEnabled({ timeout: 30000 })
  const downloadEvent = page.waitForEvent('download')
  await pdfButton(page).click()
  expect(await readFile(await (await downloadEvent).path())).toEqual(latest)
  expect(await geometry(page)).toEqual({ top: position.top, left: position.left, width: position.width })
  clean(state)
})

test('opening a different order starts at page one and fit width instead of carrying over another order view', async ({ page }) => {
  const state = await openEditor(page, true)
  const position = await setReadingPosition(page)
  await page.getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await editOrder(page, state.orders[1].po_number)
  await expect(viewer(page).getByRole('img')).toHaveAttribute('aria-label', `${title}, page 1 of 8`)
  await expect(viewer(page).getByRole('spinbutton', { name: 'Page number' })).toHaveValue('1')
  expect(await geometry(page)).toEqual({ top: 0, left: 0, width: position.fitWidth })
  clean(state)
})
