import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { readFile, writeFile } from 'node:fs/promises'
import { orderFormHarness, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

test.setTimeout(120000)
test.use({ serviceWorkers: 'block', viewport: { width: 1910, height: 945 } })
const workspace = page => page.locator('.purchase-order-form-workspace')
const tabs = page => page.getByRole('tablist', { name: 'Purchase order sections', exact: true })
const preview = page => page.locator('.pop-preview')
const saves = state => state.requests.filter(({ path, method }) => ['POST', 'PATCH'].includes(method) && /^\/api\/v1\/procurement\/orders\/(?:[\da-f-]+\/)?$/.test(path))
const verifyIsolation = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const open = async (page, options = {}) => {
  const state = await orderFormHarness(page, options)
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await expect(page.locator('#po-pr-search')).toBeEnabled()
  await expect(tabs(page).getByRole('tab')).toHaveCount(4)
  return state
}
const selectPR = async (page, vatBasis = 'exclusive') => {
  await page.locator('#po-pr-search').fill('9001')
  await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
  await expect(workspace(page)).toContainText('PR linked')
  await expect(preview(page)).toContainText(orderFormNumber)
  if (vatBasis) await workspace(page).getByRole('combobox', { name: 'Price basis', exact: true }).selectOption(vatBasis)
}
const gotoTab = (page, name) => tabs(page).getByRole('tab', { name, exact: true }).click()
const clickSave = page => workspace(page).getByRole('button', { name: /^Save draft$/i }).first().click()
const clickSend = async page => {
  await gotoTab(page, 'Attachments')
  await workspace(page).getByRole('button', { name: /^Send to vendor$/i }).first().click()
}

test('empty order requires an existing recommendation before changing sections or saving', async ({ page }) => {
  const state = await open(page)
  await expect(workspace(page)).toContainText('Select an existing PR to continue')
  for (const name of ['PO Description & Scope', 'Summary of Prices', 'Attachments']) await expect(tabs(page).getByRole('tab', { name, exact: true })).toBeDisabled()
  await expect(workspace(page).getByRole('button', { name: /^Save draft$/i }).first()).toBeDisabled()
  await expect(workspace(page).getByRole('button', { name: 'Review order', exact: true })).toBeDisabled()
  await expect(preview(page)).toContainText(/Purchase Order/i)
  await page.screenshot({ path: '../artifacts/purchase-order-form-empty-1910.png' })
  expect(saves(state)).toEqual([])
  expect(state.requests.filter(({ path }) => path.includes('/reserve-number/'))).toEqual([])
  await page.getByRole('combobox', { name: /^Existing PR Number/ }).fill('9001')
  await page.getByRole('combobox', { name: /^Existing PR Number/ }).press('ArrowDown')
  await page.getByRole('combobox', { name: /^Existing PR Number/ }).press('Enter')
  await expect(preview(page)).toContainText(orderFormNumber)
  expect(saves(state)).toEqual([])
  verifyIsolation(state)
})

test('selecting a recommendation prefills the order and spreadsheet edits update the live document', async ({ page }) => {
  const state = await open(page)
  await selectPR(page)
  await expect(workspace(page).locator('[name="title"]')).toHaveValue('Value Engineering Services')
  await expect(workspace(page).locator('[name="vendor"]')).toHaveValue('21')
  await expect(workspace(page).locator('[name="currency"]')).toHaveValue('AED')
  await expect(workspace(page).locator('[name="project_number"]')).toHaveValue('5900985')
  await expect(workspace(page).locator('[name="expected_delivery"]')).toHaveValue('2026-10-20')
  await expect(workspace(page).locator('[name="tax_amount"]')).toHaveValue('20000')
  await expect(preview(page)).toContainText('20,000.00')
  await expect(workspace(page).locator('[name="vat_percentage"]')).toHaveAttribute('readonly', '')
  await workspace(page).getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('none')
  await expect(workspace(page).locator('[name="tax_amount"]')).toHaveValue('0')
  await expect(workspace(page).locator('[name="total_amount"]')).toHaveValue('400000')
  await workspace(page).getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('exclusive')
  await expect(workspace(page).locator('[name="tax_amount"]')).toHaveValue('20000')
  await expect(preview(page)).toContainText('Alfanar Engineering LLC')
  await gotoTab(page, 'PO Description & Scope')
  await expect(workspace(page).locator('[contenteditable="true"]').first()).toContainText('Value engineering for the approved EPC design package.')
  await gotoTab(page, 'Summary of Prices')
  await workspace(page).locator('[data-cell="0-4"]').fill('2')
  await workspace(page).locator('[data-cell="0-6"]').fill('1250')
  await workspace(page).locator('[data-cell="0-6"]').press('Tab')
  await expect(preview(page)).toContainText('2,625.00')
  await gotoTab(page, 'Attachments')
  await expect(workspace(page)).toContainText('Select multiple attachments')
  await gotoTab(page, 'Header, Buyer & Project')
  await expect(workspace(page).locator('[name="title"]')).toHaveValue('Value Engineering Services')
  await expect(workspace(page).locator('[name="tax_amount"]')).toHaveValue('125')
  await expect(workspace(page).locator('[name="total_amount"]')).toHaveValue('2625')
  expect(state.requests.filter(({ path }) => path.includes('/reserve-number/'))).toHaveLength(1)
  expect(saves(state)).toEqual([])
  verifyIsolation(state)
})

test('saving creates exactly one draft and returns to the purchase order register', async ({ page }) => {
  const state = await open(page)
  await selectPR(page)
  await clickSave(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(saves(state)).toHaveLength(1)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.record).toMatchObject({ status: 'draft', po_number: orderFormNumber, pr_reference: orderFormRecommendation.id, title: 'Value Engineering Services', currency: 'AED' })
  expect(Number(state.record.vendor)).toBe(21)
  expect(Number(state.record.total_amount)).toBe(420000)
  expect(Number(state.record.tax_amount)).toBe(20000)
  expect(state.record.items[0]).toMatchObject({ quantity: 1, unit_price: 400000 })
  expect(state.record.approved_by_name).toBeUndefined()
  verifyIsolation(state)
})

test('send validates its summary and keeps server rejections visible without losing entered data', async ({ page }) => {
  const state = await open(page, { prepare: fixture => { fixture.sendError = { status: ['This purchase order must be approved before issue.'] } } })
  await selectPR(page)
  await workspace(page).locator('[name="summary"]').fill('')
  await clickSend(page)
  expect(saves(state)).toEqual([])
  await expect(workspace(page)).toContainText('Summary is required before sending to vendor')
  await workspace(page).locator('[name="summary"]').fill('Engineering services for the approved EPC design package.')
  await clickSend(page)
  await expect(workspace(page)).toContainText('This purchase order must be approved before issue.')
  await expect(page).toHaveURL(/\/procurement\/orders\/new$/)
  await gotoTab(page, 'Header, Buyer & Project')
  await expect(workspace(page).locator('[name="title"]')).toHaveValue('Value Engineering Services')
  expect(saves(state)).toHaveLength(1)
  expect(saves(state)[0].body.status).toBe('sent')
  expect(state.acceptedWrites).toEqual([])
  await clickSave(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.record.status).toBe('draft')
  verifyIsolation(state)
})

test('attachment save includes file metadata and one order creation request', async ({ page }) => {
  const state = await open(page)
  await selectPR(page)
  await gotoTab(page, 'Attachments')
  await page.locator('#po-attachment-multiple').setInputFiles({ name: 'scope-reference.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic order scope reference. Browser fixture only.') })
  await expect(workspace(page)).toContainText('scope-reference.txt')
  await clickSave(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(saves(state)).toHaveLength(1)
  expect(state.record.attachments_files).toEqual({ filename: 'scope-reference.txt' })
  expect(state.record.contact_persons.attachment_details).toHaveLength(1)
  verifyIsolation(state)
})

test('preview zoom, fit width and PDF export use the current unsaved document', async ({ page }) => {
  const state = await open(page)
  await selectPR(page)
  const scale = await preview(page).getByLabel('Preview zoom', { exact: true }).textContent()
  await preview(page).getByRole('button', { name: 'Zoom in preview', exact: true }).click()
  await expect(preview(page).getByLabel('Preview zoom', { exact: true })).not.toHaveText(scale)
  await preview(page).getByRole('button', { name: 'Fit width', exact: true }).click()
  await expect(preview(page).getByRole('button', { name: 'Fit width', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const documentPageCount = await preview(page).locator('.po-template-page').count()
  const pendingDownload = page.waitForEvent('download')
  await preview(page).getByRole('button', { name: 'Download PDF', exact: true }).click()
  const download = await pendingDownload
  await download.saveAs('../artifacts/purchase-order-form-preview.pdf')
  const contents = await readFile('../artifacts/purchase-order-form-preview.pdf')
  expect(contents.subarray(0, 5).toString()).toBe('%PDF-')
  expect(contents.length).toBeGreaterThan(1000)
  const exportedPages = (contents.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
  expect(exportedPages).toBeGreaterThanOrEqual(documentPageCount)
  await writeFile('../artifacts/purchase-order-form-preview-evidence.json', JSON.stringify({ documentPageCount, exportedPages, bytes: contents.length }, null, 2))
  expect(saves(state)).toEqual([])
  verifyIsolation(state)
})

test('four sections have accessible names, controls and readable contrast', async ({ page }) => {
  const state = await open(page)
  await selectPR(page)
  const audits = []
  for (const name of ['Header, Buyer & Project', 'PO Description & Scope', 'Summary of Prices', 'Attachments']) {
    await gotoTab(page, name)
    const result = await new AxeBuilder({ page }).include('.purchase-order-form-workspace').analyze()
    audits.push({ section: name, violations: result.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact)) })
  }
  await writeFile('../artifacts/purchase-order-form-accessibility.json', JSON.stringify(audits, null, 2))
  expect(audits.filter(({ violations }) => violations.length)).toEqual([])
  verifyIsolation(state)
})

test('desktop and mobile retain the sidebar and provide a usable editor with a full height preview', async ({ page }) => {
  const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/config/layout.config.js']
  const hashes = async () => Object.fromEntries(await Promise.all(protectedFiles.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])))
  const before = await hashes()
  const state = await open(page)
  await selectPR(page)
  const measurements = []
  for (const width of [1910, 1672, 1366, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 945 })
    await page.evaluate(() => document.fonts.ready)
    await page.locator('main.main-content').evaluate(element => { element.scrollTop = 0 })
    const result = await page.evaluate(() => {
      const box = selector => {
        const element = document.querySelector(selector)
        if (!element) return null
        const bounds = element.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }
      }
      return { width: innerWidth, html: box('html'), sidebar: box('#application-sidebar'), header: box('#application-content > header'), workspace: box('.purchase-order-form-workspace'), preview: box('.pop-preview'), actions: box('.pof-actionbar'), form: box('.pof-editor') }
    })
    measurements.push(result)
    expect(result.html.scrollWidth).toBeLessThanOrEqual(width)
    if (width >= 1100) {
      expect(result.sidebar.width).toBe(250)
      expect(result.preview.y, 'Preview should start beside the compact form header').toBeLessThan(110)
      expect(result.preview.height, 'Desktop preview should use the available workspace height').toBeGreaterThan(730)
    } else if (width < 768) await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toBeVisible()
    await page.screenshot({ path: `../artifacts/purchase-order-form-shell-${width}.png` })
  }
  await page.locator('main.main-content').evaluate(element => { element.scrollTop = document.querySelector('.pof-editor').scrollHeight - 400 })
  await page.locator('.pof-actionbar').getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(tabs(page).getByRole('tab', { name: 'PO Description & Scope', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => page.locator('main.main-content').evaluate(element => element.scrollTop)).toBeLessThan(10)
  await expect(workspace(page).locator('[contenteditable="true"]').first()).toBeVisible()
  await gotoTab(page, 'Summary of Prices')
  await expect(workspace(page).locator('[data-cell="0-4"]')).toBeVisible()
  await workspace(page).locator('[data-cell="0-4"]').fill('3')
  await expect(preview(page)).toContainText('1,260,000.00')
  await preview(page).getByRole('button', { name: 'Expand preview', exact: true }).click()
  await expect(preview(page).getByRole('button', { name: 'Exit expanded preview', exact: true })).toBeVisible()
  const expandedBounds = await preview(page).boundingBox()
  expect(expandedBounds.height).toBeGreaterThanOrEqual(800)
  expect(expandedBounds.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '../artifacts/purchase-order-form-preview-expanded-390.png' })
  await preview(page).getByRole('button', { name: 'Exit expanded preview', exact: true }).click()
  const mobileAudit = await new AxeBuilder({ page }).include('.purchase-order-form-workspace').analyze()
  await writeFile('../artifacts/purchase-order-form-evidence.json', JSON.stringify({ measurements, protectedFilesBefore: before, protectedFilesAfter: await hashes(), accessibility: mobileAudit.violations, requests: state.requests, unknown: state.unknown, pageErrors: state.pageErrors }, null, 2))
  expect(await hashes()).toEqual(before)
  expect(mobileAudit.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact))).toEqual([])
  verifyIsolation(state)
})

test('editing an order stays inside the application content when the sidebar collapses or the viewport changes', async ({ page }) => {
  const state = await open(page)
  await selectPR(page)
  await clickSave(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await expect(workspace(page).getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  const measurements = []
  const checkBounds = async (label, desktop) => {
    await expect.poll(async () => page.evaluate(includeHeight => {
      const bounds = selector => document.querySelector(selector).getBoundingClientRect()
      const content = bounds('#application-content > main')
      const form = bounds('.purchase-order-form-workspace')
      return Math.max(Math.abs(form.left - content.left), Math.abs(form.top - content.top), Math.abs(form.right - content.right), includeHeight ? Math.abs(form.bottom - content.bottom) : 0)
    }, desktop), { message: `${label}: edit page must stay within the shell, with vertical scrolling on smaller screens` }).toBeLessThan(2)
    const result = await page.evaluate(() => {
      const box = selector => {
        const { x, y, right, bottom, width, height } = document.querySelector(selector).getBoundingClientRect()
        return { x, y, right, bottom, width, height }
      }
      return { viewport: innerWidth, sidebar: box('#application-sidebar'), content: box('#application-content > main'), form: box('.purchase-order-form-workspace'), preview: box('.pop-preview'), actions: box('.pof-actionbar'), htmlWidth: document.documentElement.scrollWidth }
    })
    measurements.push({ label, ...result })
    expect(result.htmlWidth).toBeLessThanOrEqual(result.viewport)
    expect(result.preview.right).toBeLessThanOrEqual(result.content.right + 1)
    if (desktop) {
      expect(result.form.x).toBeGreaterThanOrEqual(result.sidebar.right - 1)
      expect(result.preview.height).toBeGreaterThan(result.content.height - 4)
      expect(result.actions.bottom).toBeLessThanOrEqual(result.content.bottom)
    }
    await expect(preview(page)).toContainText(orderFormNumber)
    await expect(workspace(page).locator('[name="title"]')).toHaveValue('Value Engineering Services')
  }
  await checkBounds('expanded desktop', true)
  await page.screenshot({ path: '../artifacts/purchase-order-edit-shell-desktop.png' })
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await expect.poll(() => page.locator('#application-sidebar').evaluate(element => element.getBoundingClientRect().width)).toBe(72)
  await checkBounds('collapsed desktop', true)
  await page.setViewportSize({ width: 1366, height: 900 })
  await checkBounds('collapsed smaller desktop', true)
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click()
  await expect.poll(() => page.locator('#application-sidebar').evaluate(element => element.getBoundingClientRect().width)).toBe(250)
  await checkBounds('expanded smaller desktop', true)
  await page.setViewportSize({ width: 1024, height: 900 })
  await checkBounds('tablet with sidebar', false)
  await page.setViewportSize({ width: 390, height: 844 })
  await checkBounds('mobile', false)
  await expect(page.getByRole('button', { name: 'Open sidebar', exact: true })).toBeVisible()
  await preview(page).getByRole('button', { name: 'Fit width', exact: true }).click()
  await expect(preview(page).getByRole('button', { name: 'Fit width', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: '../artifacts/purchase-order-edit-shell-mobile.png' })
  await workspace(page).getByRole('button', { name: 'Close purchase order', exact: true }).click()
  await expect(workspace(page)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  expect(saves(state)).toHaveLength(1)
  await writeFile('../artifacts/purchase-order-edit-shell-evidence.json', JSON.stringify(measurements, null, 2))
  verifyIsolation(state)
})


test('VAT treatment needs confirmation and distinguishes inclusive, exclusive and no-VAT prices without automatic saves', async ({ page }) => {
  const state = await open(page, { recommendation: { total_price: '100.00', net_total_excl_vat: '100.00', items: [{ description: 'Reviewed service', quantity: 1, unit_price: 100 }] } })
  await selectPR(page, null)
  await expect(workspace(page).getByRole('combobox', { name: 'Price basis', exact: true })).toHaveValue('unconfirmed')
  await expect(workspace(page).locator('[name="total_amount"]')).toHaveValue('100.00')
  await clickSave(page)
  await expect(workspace(page)).toContainText('Confirm whether these prices include VAT')
  expect(saves(state)).toEqual([])
  const choice = workspace(page).getByRole('combobox', { name: 'Price basis', exact: true })
  await choice.selectOption('inclusive')
  await expect(workspace(page).locator('[name="tax_amount"]')).toHaveValue('4.76')
  await expect(workspace(page).locator('[name="total_amount"]')).toHaveValue(/^100(?:\.0+)?$/)
  await expect(preview(page)).toContainText('95.24')
  await choice.selectOption('none')
  await expect(workspace(page).locator('[name="tax_amount"]')).toHaveValue('0')
  await expect(workspace(page).locator('[name="total_amount"]')).toHaveValue(/^100(?:\.0+)?$/)
  await choice.selectOption('exclusive')
  await expect(workspace(page).locator('[name="tax_amount"]')).toHaveValue('5')
  await expect(workspace(page).locator('[name="total_amount"]')).toHaveValue('105')
  expect(saves(state)).toEqual([])
  await clickSave(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(state.acceptedWrites).toHaveLength(1)
  expect(state.acceptedWrites[0].body).toMatchObject({ vat_basis: 'exclusive', entered_amount: 100, net_amount: 100, tax_amount: 5, total_amount: 105 })
  verifyIsolation(state)
})
