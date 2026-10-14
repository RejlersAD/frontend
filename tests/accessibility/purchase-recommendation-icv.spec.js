import { test, expect } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { formRecordId, formVendors, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1659, height: 952 } })
const artifactDirectory = '../artifacts/pr-icv-preview-20260923'
const vendors = () => formVendors.map(vendor => ({ ...vendor, icv_percentage: vendor.id === 21 ? '0.00' : vendor.id === 22 ? '65.00' : null }))
const shortlist = records => records.map(({ id, ...vendor }) => ({ ...vendor, vendor_id: id }))
const pricing = page => page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Supplier & pricing/ }).click()
const preferred = page => page.getByRole('combobox', { name: /^Preferred supplier/ })
const supplierCard = page => page.locator('.prf-sp-selected-supplier')
const preview = page => page.getByRole('complementary', { name: 'Live purchase recommendation preview', exact: true })
const previewIcv = page => preview(page).getByText('ICV:', { exact: true }).locator('..')
const clean = state => {
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.submissions).toEqual([])
}
async function open(page, record = {}) {
  const masterVendors = vendors()
  const state = await recommendationFormHarness(page, { edit: true,
    record: { selected_vendors: shortlist(masterVendors), ...record },
    prepare: fixture => { fixture.vendors = masterVendors },
  })
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible({ timeout: 90000 })
  await pricing(page)
  return state
}
async function expectIcv(page, percentage) {
  await expect(supplierCard(page)).toContainText(percentage === null ? 'ICV not recorded' : `ICV ${percentage}% available`)
  await expect(previewIcv(page)).toHaveText(percentage === null ? /ICV:\s*—/ : new RegExp(`ICV:\\s*${percentage}%$`))
}

test('the second selected vendor supplies live ICV and the downloaded PDF render source, while switching never retains stale ICV', async ({ page }) => {
  const state = await open(page, { price_remarks_data: { icv: '88%' } })
  await preferred(page).selectOption('22')
  await expectIcv(page, 65)
  await expect(preview(page)).toContainText('Petroserve Solutions')
  await mkdir(artifactDirectory, { recursive: true })
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${artifactDirectory}/second-vendor-65.png` })

  // The export is a raster PDF. Observe the exact offscreen DOM clone used by
  // html2canvas, then verify that the real download is a nonempty PDF.
  await page.evaluate(() => {
    window.__icvPdfRenderSources = []
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && node.style?.left === '-10000px' && node.querySelector('.rpp-document')) {
          window.__icvPdfRenderSources.push(node.textContent)
        }
      }
    })
    observer.observe(document.body, { childList: true })
  })
  const downloaded = page.waitForEvent('download')
  await preview(page).getByRole('button', { name: 'Download PDF', exact: true }).click()
  const download = await downloaded
  const pdfPath = `${artifactDirectory}/selected-vendor-65.pdf`
  await download.saveAs(pdfPath)
  const pdf = await readFile(pdfPath)
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdf.length).toBeGreaterThan(1000)
  expect(await page.evaluate(() => window.__icvPdfRenderSources)).toEqual(expect.arrayContaining([expect.stringMatching(/ICV:\s*65%/)]))

  await preferred(page).selectOption('21')
  await expectIcv(page, 0)
  await preferred(page).selectOption('23')
  await expectIcv(page, null)
  await preferred(page).selectOption('22')
  await expectIcv(page, 65)
  await preferred(page).selectOption('')
  await expect(previewIcv(page)).toHaveText(/ICV:\s*—/)
  await expect(supplierCard(page)).not.toContainText('65%')
  clean(state)
})

test('saving and reopening keeps the preferred second vendor and its ICV in the card and live preview', async ({ page }) => {
  const state = await open(page)
  await preferred(page).selectOption('22')
  await expectIcv(page, 65)
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await expect.poll(() => Number(state.record.vendor)).toBe(22)
  expect(Number(state.record.selected_vendors[0].vendor_id)).toBe(21)
  expect(state.record.status).toBe('draft')
  await page.goto(`/procurement/requisitions/${formRecordId}/edit`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible({ timeout: 90000 })
  await pricing(page)
  await expect(preferred(page)).toHaveValue('22')
  await expectIcv(page, 65)
  clean(state)
})

test('an old shortlist without ICV uses the matching vendor master instead of the first shortlist vendor', async ({ page }) => {
  const state = await open(page, {
    vendor: 22, supplier_name: 'Petroserve Solutions', preferred_supplier_if_any: 'Petroserve Solutions',
    selected_vendors: vendors().map(vendor => ({ vendor_id: vendor.id, name: vendor.name, vendor_code: vendor.vendor_code })),
  })
  await expect(preferred(page)).toHaveValue('22')
  await expectIcv(page, 65)
  clean(state)
})

test('saving a missing vendor ICV updates the selected supplier and live preview together', async ({ page }) => {
  const state = await open(page)
  const icvRequests = []
  await page.route('**/api/v1/procurement/requisitions/vendor-icv/', async route => {
    const body = route.request().postDataJSON()
    icvRequests.push(body)
    const vendor = { ...state.vendors.find(candidate => String(candidate.id) === String(body.vendor_id)), icv_percentage: Number(body.icv_percentage).toFixed(2), icv_expiry_date: body.icv_expiry_date, is_icv_certified: true }
    state.vendors = state.vendors.map(candidate => candidate.id === vendor.id ? vendor : candidate)
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(vendor) })
  })
  await preferred(page).selectOption('23')
  await expectIcv(page, null)
  await page.getByRole('spinbutton', { name: 'ICV percentage', exact: true }).fill('65')
  await page.getByLabel('Certificate expiry (optional)', { exact: true }).fill('2027-09-15')
  await page.getByRole('button', { name: 'Save ICV', exact: true }).click()
  await expect.poll(() => icvRequests.length).toBe(1)
  expect(Number(icvRequests[0].vendor_id)).toBe(23)
  expect(icvRequests[0].icv_percentage).toBe(65)
  await expectIcv(page, 65)
  await expect(page.getByRole('button', { name: 'Save ICV', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save', exact: true }).first().click()
  await expect.poll(() => state.record.selected_vendors.find(vendor => Number(vendor.vendor_id) === 23)?.icv_percentage).toBe('65.00')
  clean(state)
})
