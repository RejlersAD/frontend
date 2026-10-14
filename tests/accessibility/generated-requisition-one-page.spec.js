import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { recommendationHarness, recommendationId, recommendationNumber } from '../fixtures/purchase-recommendations.fixture'
import { recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 1040 } })

const record = {
  attachments: [], linked_po_id: null, po_number_reference: '',
  product_service: 'Engineering procurement package for piping, equipment supports and structural interfaces',
  description_reason: 'Technical assessment and design verification of the new equipment package, including piping connections, structural interfaces, inspection records and construction deliverables. The purchase covers the approved scope and the supplier shall coordinate all discipline interfaces before issuing final drawings.',
  purchase_recommendation: 'Recommend the technically compliant supplier following review of the scope, delivery programme, warranty and commercial conditions. Final deliverables include the calculations, inspection plan and signed design review record.',
  price_remarks: 'Payment within 30 days of accepted deliverables. All required inspections and document reviews are included.',
  approved_at: '2026-09-18T10:35:47Z',
  items: [{ description: 'Engineering assessment, discipline coordination, inspection and approved final design package', total: '12000.00' }],
  approval_workflow_config: Array.from({ length: 11 }, (_, index) => ({
    level: index < 8 ? index === 0 ? 0 : 1 : index - 6,
    role: index === 10 ? 'Vice President' : `Discipline Approver ${index + 1}`,
    approval_label: index === 10 ? 'L4 VP' : `L${index === 0 ? 0 : 1}-${index + 1}`,
    stage: `Approval stage ${index + 1}`, user_id: index + 101,
    user_name: index === 10 ? 'Final Executive Approver' : `Technical Reviewer ${String(index + 1).padStart(2, '0')}`,
    approved_by_id: index + 101, status: 'approved', approved_at: '2026-09-18T10:35:47Z',
  })),
}

async function assertCompleteSinglePage(page, bytes, filename) {
  const result = await page.evaluate(async data => {
    const { loadPdfLibrary } = await import('/src/components/Common/pdfDocumentLibrary.js')
    const library = await loadPdfLibrary()
    const document = await library.getDocument({ data: new Uint8Array(data) }).promise
    const first = await document.getPage(1)
    const viewport = first.getViewport({ scale: 1.6 })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    await first.render({ canvasContext: context, viewport }).promise
    const operators = await first.getOperatorList()
    const images = []
    let transform
    operators.fnArray.forEach((operator, index) => {
      if (operator === library.OPS.transform) transform = operators.argsArray[index]
      if (operator === library.OPS.paintImageXObject) images.push({ transform, dimensions: operators.argsArray[index].slice(1) })
    })
    const png = canvas.toDataURL('image/png')
    const result = { pages: document.numPages, pageWidth: first.view[2], pageHeight: first.view[3], images, png }
    await document.destroy()
    return result
  }, Array.from(bytes))
  expect(result.pages).toBe(1)
  // The complete tall source image is drawn once, wholly inside the A4 media
  // box. This catches the previous negative offsets and sliced final rows.
  expect(result.images).toHaveLength(1)
  const { transform: [width, , , height, left, bottom], dimensions } = result.images[0]
  expect(dimensions[1]).toBeGreaterThan(dimensions[0])
  expect(left).toBeGreaterThanOrEqual(16)
  expect(bottom).toBeGreaterThanOrEqual(16)
  expect(left + width).toBeLessThanOrEqual(result.pageWidth - 16)
  expect(bottom + height).toBeLessThanOrEqual(result.pageHeight - 16)
  await mkdir('../artifacts/generated-requisition-one-page', { recursive: true })
  await writeFile(`../artifacts/generated-requisition-one-page/${filename}.pdf`, bytes)
  await writeFile(`../artifacts/generated-requisition-one-page/${filename}.png`, Buffer.from(result.png.split(',')[1], 'base64'))
}

test('approval preview includes eleven approvers and final timestamp on one generated A4 page', async ({ page }) => {
  test.setTimeout(180000)
  const state = await recommendationHarness(page, { realApp: true, prepare: state => {
    const changes = { ...record, status: 'approved' }
    Object.assign(state.props.requisitions[0], changes)
    Object.assign(state.details[recommendationId(201)], changes)
  } })
  await page.getByRole('button', { name: `Select ${recommendationNumber(1)}`, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Recommendation details' })
  await expect(details).toHaveAttribute('aria-busy', 'false')
  await details.getByRole('button', { name: 'View approval record', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Procurement document preview', exact: true })
  const frame = preview.locator('iframe')
  // This captures the complete form through html2canvas; a loaded CI worker
  // can take over a minute before the finished PDF blob becomes available.
  await expect(frame).toHaveAttribute('src', /^blob:/, { timeout: 120000 })
  const source = page.locator('[aria-hidden="true"] article').first()
  await expect(source.getByText('Final Executive Approver', { exact: true })).toHaveCount(1)
  await expect(source.getByText('Approved', { exact: true })).toHaveCount(11)
  await expect(source.getByText('Final Approval Timestamp', { exact: true })).toHaveCount(1)
  const bytes = await page.evaluate(async url => Array.from(new Uint8Array(await (await fetch(url.split('#')[0])).arrayBuffer())), await frame.getAttribute('src'))
  await assertCompleteSinglePage(page, Buffer.from(bytes), 'approval-eleven-approvers')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('live draft download also retains all approval rows without altering the on-screen form', async ({ page }) => {
  const state = await recommendationFormHarness(page, { edit: true, record })
  const preview = page.getByRole('complementary', { name: 'Live purchase recommendation preview', exact: true })
  await expect(preview.locator('article')).toBeVisible({ timeout: 60000 })
  await expect(preview.locator('.rpp-page-number')).toHaveText('Page 1 of 1')
  const sourceBefore = await preview.locator('article').innerText()
  expect(sourceBefore).toContain('Final Executive Approver')
  expect(sourceBefore).toContain('Final Approval Timestamp')
  const pending = page.waitForEvent('download')
  await preview.getByRole('button', { name: 'Download PDF', exact: true }).click()
  const download = await pending
  await assertCompleteSinglePage(page, await readFile(await download.path()), 'draft-eleven-approvers')
  expect(await preview.locator('article').innerText()).toBe(sourceBefore)
  expect(state.requests.filter(({ method, path }) => ['POST', 'PATCH'].includes(method) && /^\/api\/v1\/procurement\/requisitions\/(?:[^/]+\/)?$/.test(path))).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
