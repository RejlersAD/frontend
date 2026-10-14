import { test, expect } from '@playwright/test'
import { recommendationHarness, recommendationId as id, recommendationNumber as number } from '../fixtures/purchase-recommendations.fixture'

test.setTimeout(60000)
const details = page => page.getByRole('complementary', { name: 'Recommendation details' })
const loaded = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  await expect(details(page)).toHaveAttribute('aria-busy', 'false')
}
const select = async (page, index) => {
  await page.getByRole('button', { name: `Select ${number(index)}`, exact: true }).click()
  await loaded(page)
}
const update = (state, index, patch) => {
  Object.assign(state.props.requisitions[index - 1], patch)
  Object.assign(state.details[id(index + 200)], patch)
}
const source = (filename, fields = {}) => ({
  type: 'signed_purchase_requisition_pdf', filename,
  url: `/__original-pr-fixture__/${filename}`, ...fields,
})
const mockOriginals = async page => {
  const requests = []
  await page.route('**/__original-pr-fixture__/**', async route => {
    requests.push(new URL(route.request().url()).pathname)
    await route.fulfill({
      contentType: 'application/pdf',
      body: '%PDF-1.4\n% Isolated original source document\n%%EOF',
    })
  })
  return requests
}
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
}

test('approval history visibly identifies actual and imported signers and wraps long names', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 1040 })
  const longName = 'Recorded Decision Maker With A Long Full Employee Name For International Engineering Procurement Approval'
  const state = await recommendationHarness(page, { prepare: state => update(state, 1, {
    status: 'approved', approval_workflow_config: [
      { role: 'PM', user_id: '7', user_name: 'Assigned Reviewer', approved_by_name: longName, status: 'approved', approved_at: '2026-07-01T12:00:00Z' },
      { role: 'MoE', user_id: null, user_name: 'Original PDF Signer', source: 'signed_purchase_requisition_pdf', external: true, status: 'approved', approved_at: '2026-07-01T12:00:00Z' },
      { role: 'MoP', user_id: '12345', status: 'approved', approved_at: '2026-07-01T12:00:00Z' },
    ],
  }) })
  await loaded(page)
  const entries = details(page).locator('.prr-history-entry')
  await expect(entries).toHaveCount(3)
  await expect(entries.nth(0).locator('.prr-history-name')).toHaveText(longName)
  await expect(entries.nth(0)).not.toContainText('Assigned Reviewer')
  await expect(entries.nth(1).locator('.prr-history-name')).toHaveText('Original PDF Signer')
  await expect(entries.nth(2)).toContainText('Approver not recorded')
  await expect(entries.nth(2)).not.toContainText('12345')
  for (const width of [1672, 390]) {
    await page.setViewportSize({ width, height: 1040 })
    const name = entries.nth(0).locator('.prr-history-name')
    await name.scrollIntoViewIfNeeded()
    await expect(name).toBeVisible()
    const layout = await name.evaluate(element => ({
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      height: element.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    }))
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
    expect(layout.height).toBeGreaterThan(layout.lineHeight)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  }
  clean(state)
})

test('register title uses the selected PR number and keeps the original PDF link beside it across screen sizes', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 1040 })
  const fileRequests = await mockOriginals(page)
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    update(state, 1, { status: 'approved', attachments: [source('approved-original.pdf')] })
    update(state, 2, { status: 'draft', attachments: [source('draft-original.pdf')] })
    update(state, 6, { status: 'converted', attachments: [source('converted-original.pdf')] })
  } })
  await loaded(page)
  for (const [index, filename] of [[1, 'approved-original.pdf'], [2, 'draft-original.pdf'], [6, 'converted-original.pdf']]) {
    if (index !== 1) await select(page, index)
    const header = details(page).locator('.prw-panel-header')
    await expect(header.getByRole('heading', { name: number(index), exact: true })).toBeVisible()
    await expect(header.getByRole('link', { name: 'Open original PDF', exact: true })).toHaveAttribute('href', `/__original-pr-fixture__/${filename}`)
    await expect(header.getByRole('link', { name: 'Open original PDF', exact: true })).toHaveAttribute('title', filename)
    await expect(details(page).getByRole('region', { name: 'Original uploaded PR', exact: true })).toHaveCount(0)
    await expect(details(page).locator('iframe')).toHaveCount(0)
    await expect(details(page).getByRole('button', { name: /original preview|Preview original PR/ })).toHaveCount(0)
  }
  for (const width of [1672, 390]) {
    await page.setViewportSize({ width, height: 1040 })
    const header = details(page).locator('.prw-panel-header')
    await header.scrollIntoViewIfNeeded()
    const headerBounds = await header.boundingBox()
    for (const content of [header.getByRole('heading', { name: number(6), exact: true }), header.getByRole('link', { name: 'Open original PDF', exact: true })]) {
      await expect(content).toBeVisible()
      const bounds = await content.boundingBox()
      expect(bounds.x).toBeGreaterThanOrEqual(headerBounds.x)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(headerBounds.x + headerBounds.width)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(headerBounds.y + headerBounds.height)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await page.screenshot({ path: `../artifacts/original-document-preview/register-original-link-${width}.png` })
  }
  expect(fileRequests).toEqual([])
  expect(state.requests.filter(request => request.path.includes('/export_pdf/'))).toEqual([])
  clean(state)
})

test('register does not substitute a different public PDF when the current original has no link', async ({ page }) => {
  const fileRequests = await mockOriginals(page)
  const state = await recommendationHarness(page, { prepare: state => update(state, 1, {
    attachments: [
      { type: 'quotation', filename: 'supplier-quote.pdf', url: '/__original-pr-fixture__/supplier-quote.pdf' },
      source('first-original.pdf', { url: undefined, sha256: 'current-original' }),
      source('revised-original.pdf', { type: undefined, document_type: 'signed_purchase_requisition_pdf', url: undefined, s3_url: '/__original-pr-fixture__/revised-original.pdf' }),
      source('later-original.pdf'),
    ],
    price_remarks_data: { signed_document_verification: { document_sha256: 'current-original' } },
  }) })
  await loaded(page)
  const link = details(page).getByRole('link', { name: 'Open original PDF', exact: true })
  await expect(link).toHaveCount(0)
  await expect(details(page).getByRole('combobox', { name: 'Uploaded PR file', exact: true })).toHaveCount(0)
  await expect(details(page).locator('iframe')).toHaveCount(0)
  expect(fileRequests).toEqual([])
  expect(await page.evaluate(() => window.recommendationActions)).toEqual([])
  clean(state)
})

test('register omits the original PDF link when no original document or usable file URL exists', async ({ page }) => {
  const state = await recommendationHarness(page, { prepare: state => {
    update(state, 1, { attachments: [{ type: 'quotation', filename: 'supplier-quote.pdf', url: '/__original-pr-fixture__/supplier-quote.pdf' }] })
    update(state, 2, { attachments: [source('original-with-missing-link.pdf', { url: undefined })] })
  } })
  await loaded(page)
  await expect(details(page).getByRole('link', { name: 'Open original PDF', exact: true })).toHaveCount(0)
  await select(page, 2)
  await expect(details(page).getByRole('heading', { name: number(2), exact: true })).toBeVisible()
  await expect(details(page).getByRole('link', { name: 'Open original PDF', exact: true })).toHaveCount(0)
  await expect(details(page).locator('iframe')).toHaveCount(0)
  expect(await page.evaluate(() => window.recommendationActions)).toEqual([])
  clean(state)
})

test('approved and converted recommendations expose the PDF download action', async ({ page }) => {
  const state = await recommendationHarness(page)
  await loaded(page)
  for (const index of [4, 6]) {
    await page.getByRole('button', { name: `Actions for ${number(index)}`, exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Preview signed PDF', exact: true })).toHaveCount(0)
    await page.getByRole('menuitem', { name: 'Download PDF', exact: true }).click()
  }
  expect((await page.evaluate(() => window.recommendationActions)).map(action => [action.name, action.value.id])).toEqual([
    ['pdf', id(204)], ['pdf', id(206)],
  ])
  clean(state)
})

test('register PDF download refreshes the record and uses the original before generated output without a dialog', async ({ page }) => {
  const files = await mockOriginals(page)
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    state.details[id(204)].attachments = [source('fresh-original.pdf')]
  } })
  await loaded(page)
  const download = async () => {
    await page.getByRole('button', { name: `Actions for ${number(4)}`, exact: true }).click()
    const pending = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Download PDF', exact: true }).click()
    return pending
  }
  expect((await download()).suggestedFilename()).toBe('fresh-original.pdf')
  expect(files).toContain('/__original-pr-fixture__/fresh-original.pdf')
  expect(state.requests.filter(request => request.path === `/api/v1/procurement/requisitions/${id(204)}/`)).toHaveLength(1)
  expect(state.requests.filter(request => request.path.includes('/export_pdf/'))).toEqual([])
  await expect(page.getByRole('dialog')).toHaveCount(0)

  state.details[id(204)].attachments = []
  expect((await download()).suggestedFilename()).toBe('PR-TEST.pdf')
  expect(state.requests.filter(request => request.path === `/api/v1/procurement/requisitions/${id(204)}/`)).toHaveLength(2)
  expect(state.requests.filter(request => request.path.includes('/export_pdf/'))).toHaveLength(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  clean(state)
})

test('a late PDF source response cannot download the previous selection or open an overlay', async ({ page }) => {
  const files = await mockOriginals(page)
  const downloads = []
  page.on('download', file => downloads.push(file.suggestedFilename()))
  const state = await recommendationHarness(page, { integration: true, prepare: state => {
    state.details[id(204)].attachments = [source('fourth-original.pdf')]
    state.details[id(206)].attachments = [source('sixth-original.pdf')]
    state.deferred[id(204)] = true
  } })
  await loaded(page)
  const start = async index => {
    await page.getByRole('button', { name: `Actions for ${number(index)}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Download PDF', exact: true }).click()
  }
  await start(4)
  await expect.poll(() => Boolean(state.pending[id(204)])).toBeTruthy()
  await start(6)
  await expect.poll(() => downloads).toEqual(['sixth-original.pdf'])
  delete state.deferred[id(204)]
  state.pending[id(204)]()
  await expect.poll(() => Boolean(state.delivered[id(204)])).toBeTruthy()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(downloads).toEqual(['sixth-original.pdf'])
  expect(files).toEqual(['/__original-pr-fixture__/sixth-original.pdf'])
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.requests.filter(request => request.path.includes('/export_pdf/'))).toEqual([])
  clean(state)
})
