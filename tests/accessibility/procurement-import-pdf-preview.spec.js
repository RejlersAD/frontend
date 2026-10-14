import { test, expect } from '@playwright/test'
import { pairedImportHarness, syntheticApprovedPdf, syntheticPoPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'
import { mixedSizePoPdf } from '../fixtures/mixed-size-pdf.fixture'
import { orderFormHarness, orderFormId, orderFormNumber } from '../fixtures/purchase-order-form.fixture'

test.use({ serviceWorkers: 'block' })
test.setTimeout(150000)
const modal = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const source = page => modal(page).getByRole('region', { name: 'Source PDF preview', exact: true })
// Shell notification/approval-queue polling is independent of PDF interaction.
const documentApiRequests = state => state.requests.filter(({ path }) => path.startsWith('/api/v1/procurement/') && !path.endsWith('/pending-for-me/'))
async function open(page) {
  const state = await pairedImportHarness(page)
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await modal(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles(syntheticApprovedPdf)
  await modal(page).getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles(syntheticPoPdf)
  return state
}
async function pdfBytes(page, kind) {
  const viewer = source(page).getByRole('region', { name: `Approved ${kind} source PDF`, exact: true })
  await expect(viewer.getByRole('img', { name: `Approved ${kind} source PDF, page 1 of 1`, exact: true })).toBeVisible({ timeout: 30000 })
  const link = source(page).getByRole('link', { name: `Open ${kind} PDF in new tab`, exact: true })
  await expect(link).toHaveAttribute('href', /^blob:/)
  return page.evaluate(async url => (await fetch(url)).text(), await link.getAttribute('href'))
}

test('switching source tabs shows one full-height PDF without OCR, lookup or save requests', async ({ page }) => {
  await page.setViewportSize({ width: 1192, height: 907 })
  const state = await open(page)
  await expect(source(page).getByRole('tab', { name: 'PO PDF', exact: true })).toHaveAttribute('aria-selected', 'true')
  expect(await pdfBytes(page, 'PO')).toBe(syntheticPoPdf.buffer.toString())
  const calls = documentApiRequests(state).length
  await source(page).getByRole('tab', { name: 'PR PDF', exact: true }).click()
  expect(await pdfBytes(page, 'PR')).toBe(syntheticApprovedPdf.buffer.toString())
  await expect(source(page).locator('canvas')).toHaveCount(1)
  await expect(source(page).locator('iframe')).toHaveCount(0)
  await source(page).getByRole('tab', { name: 'PR PDF', exact: true }).press('ArrowRight')
  expect(await pdfBytes(page, 'PO')).toBe(syntheticPoPdf.buffer.toString())
  await expect(source(page).getByRole('tab', { name: 'PO PDF', exact: true })).toBeFocused()
  await expect(source(page).getByRole('link', { name: 'Open PO PDF in new tab' })).toHaveAttribute('href', /^blob:/)
  expect(documentApiRequests(state)).toHaveLength(calls)
  expect(state.pairPreviews).toEqual([])
  expect(state.pairWrites).toEqual([])
  const frame = await source(page).getByRole('region', { name: 'Approved PO source PDF', exact: true }).boundingBox()
  const action = await modal(page).getByRole('button', { name: 'Preview OCR', exact: true }).boundingBox()
  expect(frame.height).toBeGreaterThan(400)
  expect(frame.y + frame.height).toBeLessThanOrEqual(action.y)
  expect(action.y + action.height).toBeLessThan(907)
  await page.screenshot({ path: '../artifacts/unified-upload-preview-desktop.png' })
  await modal(page).getByRole('button', { name: 'Remove PO PDF', exact: true }).click()
  expect(await pdfBytes(page, 'PR')).toBe(syntheticApprovedPdf.buffer.toString())
  await expect(source(page).getByRole('tab')).toHaveCount(1)
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('mobile source viewer fits the dialog and document replacement selects the new source', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await open(page)
  await source(page).scrollIntoViewIfNeeded()
  expect(await pdfBytes(page, 'PO')).toBe(syntheticPoPdf.buffer.toString())
  const bounds = await modal(page).boundingBox()
  const frame = await source(page).getByRole('region', { name: 'Approved PO source PDF', exact: true }).boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  expect(frame.width).toBeGreaterThan(250)
  expect(frame.height).toBeGreaterThan(350)
  await expect(modal(page).getByRole('button', { name: 'Preview OCR', exact: true })).toBeVisible()
  await page.screenshot({ path: '../artifacts/unified-upload-preview-mobile.png' })
  await modal(page).getByLabel('Select signed or approved PR PDF', { exact: true }).setInputFiles({ ...syntheticApprovedPdf, name: 'replacement-pr.pdf' })
  await expect(source(page)).toContainText('replacement-pr.pdf')
  expect(await pdfBytes(page, 'PR')).toBe(syntheticApprovedPdf.buffer.toString())
  await expect(source(page).locator('canvas')).toHaveCount(1)
  expect(state.pairWrites).toEqual([])
  expect(state.pageErrors).toEqual([])
})

async function expectWidthFittedPage(viewer, title, pageNumber, host) {
  const canvas = viewer.getByRole('img', { name: `${title}, page ${pageNumber} of 160`, exact: true })
  await expect(canvas).toBeVisible({ timeout: 30000 })
  await expect.poll(async () => {
    const [container, region] = await Promise.all([host.boundingBox(), viewer.boundingBox()])
    return container && region ? Math.abs(container.width - region.width) : Infinity
  }, { message: 'The viewer must fill the actual document panel, not shrink to an intrinsic 300px width.' }).toBeLessThanOrEqual(2)
  await expect.poll(async () => {
    const area = await viewer.boundingBox()
    const bounds = await canvas.boundingBox()
    return area && bounds ? area.width - bounds.width : Infinity
  }, { message: 'The current page must fill the panel width, independently of oversized pages elsewhere.' }).toBeLessThan(50)
  await expect.poll(async () => canvas.evaluate(element => {
    const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data
    let ink = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 0 && pixels[index] < 120 && pixels[index + 1] < 120 && pixels[index + 2] < 120) ink += 1
    }
    return ink
  }), { message: 'The PDF canvas must contain the synthetic page text, not a blank placeholder.' }).toBeGreaterThan(30)
  const [bounds, area] = await Promise.all([canvas.boundingBox(), viewer.boundingBox()])
  expect(bounds.width).toBeGreaterThan(area.width * 0.8)
  expect(bounds.width).toBeLessThanOrEqual(area.width)
  await expect.poll(() => viewer.locator('canvas').count(), {
    message: 'A 160-page PDF must keep only a bounded viewport-sized canvas window.',
  }).toBeLessThanOrEqual(8)
  return canvas
}

const pageViewport = (viewer, title) => viewer.getByRole('region', { name: `${title} pages`, exact: true })

async function scrollToPage(viewer, title, number) {
  const viewport = pageViewport(viewer, title)
  await expect(viewport.locator(`[data-pdf-page="${number}"]`)).toBeAttached()
  await viewport.evaluate((element, page) => {
    const marker = element.querySelector(`[data-pdf-page="${page}"]`)
    element.scrollTo({ top: element.scrollTop + marker.getBoundingClientRect().top - element.getBoundingClientRect().top - 12 })
  }, number)
  // At the document end, native scroll clamping may leave the preceding page's
  // footer visible when the final page is shorter than the viewport.
  if (number < 160) await expect(viewer.getByLabel('PDF pages', { exact: true })).toHaveText(`Page ${number} of 160`)
}

async function wheelAcrossFirstPage(page, viewer, title) {
  const viewport = pageViewport(viewer, title)
  await viewport.hover()
  const distance = await viewport.evaluate(element => {
    const next = element.querySelector('[data-pdf-page="2"]')
    return next.getBoundingClientRect().top - element.getBoundingClientRect().top + 40
  })
  await page.mouse.wheel(0, distance)
  await expect(viewer.getByRole('img', { name: `${title}, page 2 of 160`, exact: true })).toBeInViewport({ ratio: .1 })
  await expect(viewer.getByLabel('PDF pages', { exact: true })).toHaveText('Page 2 of 160')
}

test('a 160-page upload scrolls continuously and fits normal and oversized pages independently through resize', async ({ page }) => {
  await page.setViewportSize({ width: 1192, height: 907 })
  const state = await open(page)
  await modal(page).getByLabel('Select signed or approved PO PDF', { exact: true }).setInputFiles(mixedSizePoPdf)
  const title = 'Approved PO source PDF'
  const viewer = source(page).getByRole('region', { name: title, exact: true })
  const host = source(page).getByRole('tabpanel', { name: 'PO PDF', exact: true })
  const fitPage = number => expectWidthFittedPage(viewer, title, number, host)
  await fitPage(1)
  await expect(pageViewport(viewer, title).locator('[data-pdf-page]')).toHaveCount(160)
  await expect(viewer.getByLabel('Page number', { exact: true })).toHaveCount(0)
  await expect(viewer.getByRole('button', { name: /^(Next|Previous) page$/ })).toHaveCount(0)
  const initialRequests = documentApiRequests(state).length
  await wheelAcrossFirstPage(page, viewer, title)
  await fitPage(2)
  await scrollToPage(viewer, title, 90)
  const drawing = await fitPage(90)
  const drawingBounds = await drawing.boundingBox()
  expect(drawingBounds.width / drawingBounds.height).toBeCloseTo(14400 / 10170, 1)
  await scrollToPage(viewer, title, 91)
  await fitPage(91)
  await scrollToPage(viewer, title, 90)
  await fitPage(90)
  await scrollToPage(viewer, title, 1)
  const regular = await fitPage(1)
  const beforeZoom = (await regular.boundingBox()).width
  for (let step = 0; step < 3; step += 1) await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => (await regular.boundingBox())?.width || 0).toBeCloseTo(beforeZoom * 1.75, 0)
  await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => (await regular.boundingBox())?.width || 0,
    { message: 'Continuous preview zoom must update the current page without replacing it with another page.' }).toBeCloseTo(beforeZoom * 2, 0)
  await viewer.getByRole('button', { name: 'Fit width', exact: true }).click()
  await fitPage(1)
  await page.screenshot({ path: '../artifacts/mixed-pdf-upload-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await viewer.scrollIntoViewIfNeeded()
  await fitPage(1)
  await scrollToPage(viewer, title, 90)
  await fitPage(90)
  await page.screenshot({ path: '../artifacts/mixed-pdf-upload-mobile.png' })
  expect(documentApiRequests(state)).toHaveLength(initialRequests)
  expect(state.pairPreviews).toEqual([])
  expect(state.pairWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('saved PO detail scrolls a mixed-size original without refetching or regenerating its PDF', async ({ page }) => {
  await page.setViewportSize({ width: 1512, height: 982 })
  const filename = mixedSizePoPdf.name
  const contentPath = `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/mixed-original/content/`
  const state = await orderFormHarness(page, {
    path: `/procurement/orders/${orderFormId}`,
    prepare: fixture => {
      fixture.record = {
        id: orderFormId, po_number: orderFormNumber, po_date: '2026-09-15', status: 'completed',
        title: 'Synthetic 160-page PO', vendor: 21, vendor_name: fixture.vendors[0].name,
        currency: 'AED', total_amount: '1000.00', tax_amount: '0.00', items: [], attachments: [], approval_log: [],
      }
      fixture.orders = [fixture.record]
      fixture.uploadedDocuments = [{ id: 'mixed-original', filename, content_url: contentPath }]
      fixture.uploadedContent[contentPath] = { body: mixedSizePoPdf.buffer }
    },
  })
  const canonical = page.getByRole('region', { name: `Purchase Order ${orderFormNumber} PDF preview`, exact: true })
  await expect(canonical.getByRole('img')).toBeVisible({ timeout: 30000 })
  const generatedCalls = state.requests.filter(({ path }) => path.endsWith('/export-pdf/')).length
  await page.getByRole('tablist', { name: 'Purchase order PDF source', exact: true }).getByRole('tab', { name: 'Original source', exact: true }).click()
  const title = `Uploaded PO PDF: ${filename}`
  const viewer = page.getByRole('region', { name: title, exact: true })
  const host = page.locator('.po-detail-pdf-preview [role="tabpanel"]:visible')
  const fitPage = number => expectWidthFittedPage(viewer, title, number, host)
  await fitPage(1)
  await expect(pageViewport(viewer, title).locator('[data-pdf-page]')).toHaveCount(160)
  await expect(viewer.getByLabel('Page number', { exact: true })).toHaveCount(0)
  await expect(viewer.getByRole('button', { name: /^(Next|Previous) page$/ })).toHaveCount(0)
  // The real App's development StrictMode replays source discovery on mount.
  // Navigation, zoom and resizing must not add any discovery/content requests.
  const initialSourceReads = state.requests.filter(({ path }) => path.includes('/uploaded-documents/')).length
  await wheelAcrossFirstPage(page, viewer, title)
  await fitPage(2)
  await scrollToPage(viewer, title, 90)
  await fitPage(90)
  await scrollToPage(viewer, title, 160)
  await fitPage(160)
  await scrollToPage(viewer, title, 1)
  await fitPage(1)
  await viewer.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '../artifacts/mixed-pdf-detail-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await viewer.scrollIntoViewIfNeeded()
  await fitPage(1)
  await scrollToPage(viewer, title, 90)
  await fitPage(90)
  await page.screenshot({ path: '../artifacts/mixed-pdf-detail-mobile.png' })
  const link = page.getByRole('link', { name: 'Open uploaded PO', exact: true })
  expect(await page.evaluate(async url => (await fetch(url)).text(), await link.getAttribute('href'))).toBe(mixedSizePoPdf.buffer.toString())
  expect(state.requests.filter(({ path }) => path === contentPath)).toHaveLength(1)
  expect(state.requests.filter(({ path }) => path.includes('/uploaded-documents/'))).toHaveLength(initialSourceReads)
  expect(state.requests.filter(({ path }) => path.endsWith('/export-pdf/'))).toHaveLength(generatedCalls)
  expect(state.acceptedWrites).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
