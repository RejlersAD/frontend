import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { recommendationPdfImportHarness } from '../fixtures/purchase-recommendation-pdf-import.fixture'
import { orderFormHarness } from '../fixtures/purchase-order-form.fixture'
import { syntheticApprovedPdf, syntheticPoPdf } from '../fixtures/purchase-recommendation-paired-import.fixture'

test.setTimeout(150000)
test.use({ serviceWorkers: 'block' })

const dialog = page => page.getByRole('dialog', { name: 'Upload PR, PO and Vendor', exact: true })
const source = page => dialog(page).getByRole('region', { name: 'Source PDF preview', exact: true })
const handle = (page, side) => dialog(page).getByRole('separator', { name: `Resize upload window from ${side}`, exact: true })
const sidebar = page => page.locator('#application-sidebar')
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }

async function openUpload(page, kind = 'PR', collapsed = false) {
  const state = kind === 'PR'
    ? await recommendationPdfImportHarness(page)
    : await orderFormHarness(page, { path: '/procurement/orders' })
  const heading = kind === 'PR' ? 'Purchase Recommendations' : 'Purchase Orders'
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({ timeout: 100000 })
  if (kind === 'PR') await expect(page.getByRole('complementary', { name: 'Recommendation details' })).toHaveAttribute('aria-busy', 'false')
  if (collapsed) {
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
    await expect(sidebar(page)).toHaveCSS('width', '72px')
  }
  const sidebarBefore = await sidebar(page).evaluate(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return { x: rect.x, width: rect.width, backgroundColor: style.backgroundColor, fontFamily: style.fontFamily }
  })
  const more = kind === 'PR' ? 'More recommendation actions' : 'More purchase order actions'
  await page.getByRole('button', { name: more, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(dialog(page)).toBeFocused()
  return { state, sidebarBefore }
}

async function selectSource(page, kind = 'PR') {
  const input = dialog(page).getByLabel(`Select signed or approved ${kind} PDF`, { exact: true })
  await input.setInputFiles(kind === 'PR' ? syntheticApprovedPdf : syntheticPoPdf)
  await expect(source(page).getByRole('img', { name: `Approved ${kind} source PDF, page 1 of 1`, exact: true })).toBeVisible({ timeout: 30000 })
  return input
}

async function extract(page, kind = 'PR') {
  await dialog(page).getByRole('button', { name: 'Preview OCR', exact: true }).click()
  await expect(dialog(page).getByLabel(kind === 'PR' ? 'Product / Service' : 'PO Description', { exact: true })).toBeVisible()
}

async function expectCentered(page) {
  await expect.poll(async () => {
    const bounds = await dialog(page).boundingBox()
    const main = await page.locator('#application-content > main.main-content').boundingBox()
    const viewport = page.viewportSize()
    const left = Math.max(0, main.x)
    const right = Math.min(viewport.width, main.x + main.width)
    const top = Math.max(0, main.y)
    const bottom = Math.min(viewport.height, main.y + main.height)
    return Math.max(Math.abs(bounds.x + bounds.width / 2 - (left + right) / 2), Math.abs(bounds.y + bounds.height / 2 - (top + bottom) / 2))
  }).toBeLessThanOrEqual(2)
  const bounds = await dialog(page).boundingBox()
  const main = await page.locator('#application-content > main.main-content').boundingBox()
  const viewport = page.viewportSize()
  expect(bounds.x).toBeGreaterThanOrEqual(Math.max(0, main.x))
  expect(bounds.y).toBeGreaterThanOrEqual(Math.max(0, main.y))
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(Math.min(viewport.width, main.x + main.width) + 1)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(Math.min(viewport.height, main.y + main.height) + 1)
  expect(await dialog(page).locator('.procurement-import-review__surface').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  for (const edge of await dialog(page).getByRole('separator').all()) {
    const edgeBox = await edge.boundingBox()
    expect(edgeBox.x).toBeGreaterThanOrEqual(Math.max(0, main.x))
    expect(edgeBox.x + edgeBox.width).toBeLessThanOrEqual(Math.min(viewport.width, main.x + main.width) + 1)
  }
  return bounds
}

async function dragEdge(page, side, delta) {
  const bounds = await handle(page, side).boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + delta, bounds.y + bounds.height / 2, { steps: 8 })
  await page.mouse.up()
}

async function expectSidebarUnchanged(page, before) {
  const after = await sidebar(page).evaluate(element => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return { x: rect.x, width: rect.width, backgroundColor: style.backgroundColor, fontFamily: style.fontFamily }
  })
  expect(after).toEqual(before)
}

test('PR upload remains centered beside the sidebar while both mouse edges resize without losing source or review edits', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const { state, sidebarBefore } = await openUpload(page)
  await expectCentered(page)
  await page.screenshot({ path: testInfo.outputPath('pr-upload-centered-chooser.png') })
  const file = await selectSource(page)
  const original = await expectCentered(page)
  await dragEdge(page, 'left', 80)
  const narrowed = await expectCentered(page)
  expect(narrowed.width).toBeLessThan(original.width - 100)
  expect(await file.evaluate(element => element.files[0]?.name)).toBe(syntheticApprovedPdf.name)
  await dragEdge(page, 'right', 60)
  expect((await expectCentered(page)).width).toBeGreaterThan(narrowed.width + 80)
  await extract(page)
  const scope = dialog(page).getByLabel('Product / Service', { exact: true })
  await scope.fill('Reviewed PR scope retained through window resizing')
  const scrollbarHit = await dialog(page).locator('.procurement-import-review__form').evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.right - 2, bounds.top + bounds.height / 2)
    return { belongsToForm: element.contains(hit), resizeHandle: Boolean(hit?.closest('[role="separator"]')) }
  })
  expect(scrollbarHit).toEqual({ belongsToForm: true, resizeHandle: false })
  const link = source(page).getByRole('link', { name: 'Open PR PDF in new tab', exact: true })
  const sourceUrl = await link.getAttribute('href')
  await dragEdge(page, 'right', 1000)
  await expectCentered(page)
  await expect(scope).toHaveValue('Reviewed PR scope retained through window resizing')
  await expect(link).toHaveAttribute('href', sourceUrl)
  await expect(dialog(page).getByRole('button', { name: 'Upload PR', exact: true })).toBeInViewport()
  await expectSidebarUnchanged(page, sidebarBefore)
  expect(state.previewRequests).toHaveLength(1)
  expect(state.saveRequests).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('pr-upload-resized-desktop.png') })
  clean(state)
})

test('PO upload supports keyboard resizing and clamps both edges inside main content with the sidebar collapsed', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { state, sidebarBefore } = await openUpload(page, 'PO', true)
  await selectSource(page, 'PO')
  await extract(page, 'PO')
  const description = dialog(page).getByLabel('PO Description', { exact: true })
  await description.fill('Reviewed PO scope retained through keyboard resizing')
  const link = source(page).getByRole('link', { name: 'Open PO PDF in new tab', exact: true })
  const sourceUrl = await link.getAttribute('href')
  const right = handle(page, 'right')
  await right.focus()
  await right.press('Home')
  const minimum = await expectCentered(page)
  await expect(right).toBeFocused()
  await right.press('ArrowLeft')
  expect((await expectCentered(page)).width).toBeCloseTo(minimum.width, 0)
  await right.press('ArrowRight')
  expect((await expectCentered(page)).width).toBeCloseTo(minimum.width + 32, 0)
  await right.press('Shift+ArrowRight')
  expect((await expectCentered(page)).width).toBeCloseTo(minimum.width + 96, 0)
  await right.press('End')
  const maximum = await expectCentered(page)
  await right.press('ArrowRight')
  expect((await expectCentered(page)).width).toBeCloseTo(maximum.width, 0)
  const left = handle(page, 'left')
  await left.focus()
  await left.press('ArrowRight')
  expect((await expectCentered(page)).width).toBeCloseTo(maximum.width - 32, 0)
  await left.press('ArrowLeft')
  expect((await expectCentered(page)).width).toBeCloseTo(maximum.width, 0)
  await expect(description).toHaveValue('Reviewed PO scope retained through keyboard resizing')
  await expect(link).toHaveAttribute('href', sourceUrl)
  await expect(dialog(page).getByRole('button', { name: 'Save PO', exact: true })).toBeInViewport()
  await expectSidebarUnchanged(page, sidebarBefore)
  expect(state.acceptedWrites).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('po-upload-keyboard-resized.png') })
  const scan = await new AxeBuilder({ page }).include('.procurement-import-review').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(scan.violations).toEqual([])
  clean(state)
})

test('a resized PR review adapts between desktop and mobile without overflow or discarded input', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const { state } = await openUpload(page)
  await selectSource(page)
  await extract(page)
  const scope = dialog(page).getByLabel('Product / Service', { exact: true })
  await scope.fill('Source review retained across viewport sizes')
  const link = source(page).getByRole('link', { name: 'Open PR PDF in new tab', exact: true })
  const sourceUrl = await link.getAttribute('href')
  await handle(page, 'right').focus()
  await handle(page, 'right').press('End')
  await page.setViewportSize({ width: 390, height: 844 })
  await expectCentered(page)
  await expect(handle(page, 'left')).toHaveCount(0)
  await expect(handle(page, 'right')).toHaveCount(0)
  await expect(dialog(page)).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await dialog(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
  await scope.scrollIntoViewIfNeeded()
  await expect(scope).toHaveValue('Source review retained across viewport sizes')
  await expect(dialog(page).getByRole('button', { name: 'Upload PR', exact: true })).toBeInViewport()
  await expect(link).toHaveAttribute('href', sourceUrl)
  await page.screenshot({ path: testInfo.outputPath('pr-upload-mobile-after-resize.png') })
  await page.setViewportSize({ width: 1280, height: 900 })
  await expectCentered(page)
  await expect(handle(page, 'right')).toBeVisible()
  await handle(page, 'right').press('Home')
  await expectCentered(page)
  await expect(scope).toHaveValue('Source review retained across viewport sizes')
  await expect(link).toHaveAttribute('href', sourceUrl)
  expect(state.previewRequests).toHaveLength(1)
  expect(state.saveRequests).toEqual([])
  clean(state)
})

test('a pending PR save keeps the resized dialog open when its main-content backdrop is clicked', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const { state } = await openUpload(page)
  await selectSource(page)
  await extract(page)
  const scope = dialog(page).getByLabel('Product / Service', { exact: true })
  await scope.fill('Reviewed PR scope retained while saving')
  await handle(page, 'left').press('Home')
  state.deferSave = true
  await dialog(page).getByRole('button', { name: 'Upload PR', exact: true }).click()
  await expect.poll(() => Boolean(state.savePending)).toBe(true)
  try {
    const focusBeforeBackdrop = await page.evaluate(() => ({ tag: document.activeElement.tagName, label: document.activeElement.getAttribute('aria-label') }))
    const main = await page.locator('#application-content > main.main-content').boundingBox()
    await page.mouse.click(main.x + 3, main.y + 20)
    await expect(dialog(page)).toBeVisible()
    await expect(scope).toHaveValue('Reviewed PR scope retained while saving')
    expect(await dialog(page).evaluate(element => element.contains(document.activeElement)), `Focus before backdrop: ${JSON.stringify(focusBeforeBackdrop)}`).toBe(true)
  } finally {
    state.savePending?.()
  }
  await expect(dialog(page)).toContainText('created from the reviewed PDF')
  expect(state.saveRequests).toHaveLength(1)
  clean(state)
})
