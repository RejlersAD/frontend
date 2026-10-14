import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block' })

const pendingId = 'scroll-test-signed-po'
function signedPdf() {
  const stream = 'BT /F1 12 Tf 40 760 Td (Synthetic signed purchase order for scrolling test) Tj ET'
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf)
}
const nativeOrder = () => ({
  id: orderFormId, po_number: orderFormNumber, po_date: '2026-07-01', status: 'sent',
  title: 'Independent detail panel scrolling', summary: 'Synthetic long order for scrolling checks',
  vendor: 21, vendor_name: 'Synthetic supplier', currency: 'USD', total_amount: '6489', tax_amount: '0',
  pr_reference: orderFormRecommendation.id, pr_number: orderFormRecommendation.pr_number,
  created_at: '2026-09-15T08:00:00Z', approved_at: '2026-07-03T08:00:00Z', payment_terms: 'Net 30',
  items: Array.from({ length: 30 }, (_, index) => ({ id: `scroll-line-${index}`, description: `Long purchase order line ${index + 1}`, quantity: 1, unit: 'EA', unit_price: 100, total: 100 })),
})

async function open(page, type) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    if (type === 'native') {
      fixture.record = nativeOrder()
      fixture.orders = [fixture.record]
      return
    }
    const document = {
      id: pendingId, original_filename: 'Signed-scroll-test.pdf', confirmed_po: null,
      created_at: '2026-09-15T08:00:00Z', extraction_status: 'completed',
      extracted_data: { po_number: orderFormNumber, summary: 'Signed purchase order awaiting reconciliation', vendor_name: 'Original supplier company', project_name: 'Engineering project', currency: 'USD', total_amount: '6489', tax_amount: '0', gross_amount: '6489', po_date: '2026-07-01', reconciliation_required: true },
    }
    fixture.pendingDocuments = [document]
    fixture.documentRecords[pendingId] = document
    fixture.uploadedContent[`/api/v1/procurement/po-documents/${pendingId}/content/`] = { body: signedPdf() }
  } })
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  const panel = page.getByRole('complementary', { name: type === 'native' ? 'Purchase order details' : 'Uploaded purchase order details', exact: true })
  await expect(panel).toContainText(orderFormNumber)
  if (type === 'native') await expect(panel).toHaveAttribute('aria-busy', 'false')
  else await expect(panel.locator('iframe')).toHaveAttribute('src', /^blob:/)
  return { state, panel, body: panel.locator('.prw-detail-body') }
}

const outsideState = body => body.evaluate(element => {
  const ancestors = []
  for (let node = element.parentElement; node; node = node.parentElement) {
    ancestors.push({ top: node.scrollTop, left: node.scrollLeft })
  }
  const register = document.querySelector('.purchase-orders-workspace .prw-main')
  const table = register.querySelector('.prw-table-scroll')
  const bounds = register.getBoundingClientRect()
  return { ancestors, windowX: window.scrollX, windowY: window.scrollY, register: { x: bounds.x, y: bounds.y }, table: { top: table.scrollTop, left: table.scrollLeft } }
})

async function wheelOnBody(page, body, amount) {
  const bounds = await body.boundingBox()
  // The padding belongs to the details scroller, outside the embedded native
  // PDF viewer and nested line-item table, which have their own scrolling.
  await page.mouse.move(bounds.x + 3, bounds.y + Math.min(70, bounds.height / 2))
  await page.mouse.wheel(0, amount)
  await page.waitForTimeout(180) // Let the compositor apply the wheel and any scroll chaining.
}

for (const viewport of [{ width: 1920, height: 960 }, { width: 1440, height: 900 }]) {
  for (const type of ['native', 'pending']) {
    test(`${type} PO details scroll independently at ${viewport.width}x${viewport.height}, including both boundaries`, async ({ page }) => {
      await page.setViewportSize(viewport)
      const { state, panel, body } = await open(page, type)
      await expect.poll(() => body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(50)
      await expect.poll(() => body.evaluate(element => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))).toBeTruthy()
      const before = await outsideState(body)
      const panelBounds = await panel.boundingBox()
      expect(Math.abs(panelBounds.y - before.register.y)).toBeLessThanOrEqual(1)
      expect(panelBounds.y).toBeGreaterThanOrEqual(0)
      expect(panelBounds.y + panelBounds.height).toBeLessThanOrEqual(viewport.height)
      await wheelOnBody(page, body, 260)
      await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
      expect(await outsideState(body)).toEqual(before)

      await body.evaluate(element => { element.scrollTop = element.scrollHeight })
      await wheelOnBody(page, body, 1600)
      expect(await outsideState(body)).toEqual(before)
      await body.evaluate(element => { element.scrollTop = 0 })
      await wheelOnBody(page, body, -1600)
      expect(await outsideState(body)).toEqual(before)

      if (type === 'pending') {
        await body.evaluate(element => { element.scrollTop = element.scrollHeight })
        const frameBounds = await panel.locator('iframe').boundingBox()
        const bodyBounds = await body.boundingBox()
        const top = Math.max(frameBounds.y, bodyBounds.y)
        const bottom = Math.min(frameBounds.y + frameBounds.height, bodyBounds.y + bodyBounds.height)
        expect(bottom - top).toBeGreaterThan(40)
        await page.mouse.move(frameBounds.x + frameBounds.width / 2, (top + bottom) / 2)
        await page.mouse.wheel(0, 100000)
        await page.waitForTimeout(180)
        expect(await outsideState(body)).toEqual(before)
        if (viewport.width === 1920) {
          await body.evaluate(element => { element.scrollTop = 200 })
          await page.screenshot({ path: '../artifacts/po-panel-scroll-pending-1920.png' })
        }
      }
      if (type === 'native' && viewport.width === 1920) {
        const originalHeight = await body.evaluate(element => element.clientHeight)
        await page.getByRole('button', { name: 'Filters', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Clear all filters', exact: true })).toBeVisible()
        await expect.poll(() => body.evaluate(element => element.clientHeight)).toBeLessThan(originalHeight)
        await page.setViewportSize({ width: 1440, height: 900 })
        await expect.poll(async () => { const bounds = await panel.boundingBox(); return bounds.y + bounds.height }).toBeLessThanOrEqual(900)
        const resizedState = await outsideState(body)
        await wheelOnBody(page, body, 260)
        await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
        expect(await outsideState(body)).toEqual(resizedState)
      }
      expect(state.requests.filter(request => request.path.startsWith('/api/v1/procurement/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method))).toHaveLength(0)
      expect(state.unknown).toEqual([])
      expect(state.pageErrors).toEqual([])
    })
  }
}

for (const viewport of [{ width: 390, height: 844, name: 'mobile' }, { width: 1440, height: 720, name: 'short desktop' }]) {
  for (const type of ['native', 'pending']) {
    test(`${type} PO details and footer actions remain reachable on ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const { state, panel, body } = await open(page, type)
      const dimensions = await body.evaluate(element => ({ bodyHeight: element.clientHeight, bodyContentHeight: element.scrollHeight, panelHeight: element.parentElement.clientHeight }))
      const dimensionPath = testInfo.outputPath('panel-dimensions.json')
      await writeFile(dimensionPath, JSON.stringify(dimensions))
      await testInfo.attach('panel-dimensions', { path: dimensionPath, contentType: 'application/json' })
      expect(dimensions.bodyHeight).toBeGreaterThanOrEqual(160)
      const action = panel.getByRole('button', { name: type === 'native' ? 'Edit order' : 'Edit', exact: true }).last()
      await action.scrollIntoViewIfNeeded()
      await expect(action).toBeInViewport()
      if (type === 'pending') {
        await panel.locator('iframe').scrollIntoViewIfNeeded()
        await expect(panel.locator('iframe')).toBeInViewport()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      expect(state.requests.filter(request => request.path.startsWith('/api/v1/procurement/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method))).toHaveLength(0)
      expect(state.unknown).toEqual([])
      expect(state.pageErrors).toEqual([])
    })
  }
}
