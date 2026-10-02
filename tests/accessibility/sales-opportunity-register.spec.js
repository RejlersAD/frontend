import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api'

const register = page => page.locator('.sor-table-scroll table')
const rail = page => page.getByRole('complementary', { name: 'Opportunity details', exact: true })
const vf = (page, index) => register(page).getByRole('button', { name: `Q-${102101 + index}`, exact: true })
const search = page => page.getByRole('textbox', { name: 'Search opportunities', exact: true })
const menu = (page, label) => page.locator('summary').filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })

test('search includes later API pages and all default includes closed records', async ({ page }) => {
  const state = await prepareRegister(page)
  await expect(vf(page, 0)).toBeVisible()
  await expect.poll(() => state.requests.filter(item => item.path.endsWith('/deals/') && item.method === 'GET').length).toBe(2)
  await expect(register(page)).toContainText('Closed historical package')
  await search(page).fill('Azure Gas Company')
  await expect(vf(page, 30)).toBeVisible()
  await expect(register(page)).toContainText('Offshore platform electrical upgrade')
  await expect(register(page).getByRole('row')).toHaveCount(2)
  expect(state.pageErrors).toEqual([])
})

test('selecting a row opens the persistent detail rail and full record remains available', async ({ page }) => {
  const state = await prepareRegister(page)
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  await expect(rail(page).getByRole('tab')).toHaveText(['Overview', 'Activity'])
  await expect(rail(page).getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'Opportunity document workspace', exact: true })).toHaveCount(0)
  expect(state.requests.some(item => item.path.endsWith('/workspace/'))).toBe(false)
  await rail(page).getByRole('tab', { name: 'Overview', exact: true }).press('ArrowRight')
  await expect(rail(page).getByRole('tab', { name: 'Activity', exact: true })).toBeFocused()
  await expect(rail(page).getByRole('tab', { name: 'Activity', exact: true })).toHaveAttribute('aria-selected', 'true')
  await rail(page).getByRole('tab', { name: 'Activity', exact: true }).press('Home')
  await expect(rail(page).getByRole('tab', { name: 'Overview', exact: true })).toBeFocused()
  await rail(page).getByLabel('More opportunity actions').click()
  await rail(page).getByRole('button', { name: 'Open full record', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Opportunity record', exact: true })).toBeVisible()
  expect(state.pageErrors).toEqual([])
})

test('latest row selection wins when an earlier detail response arrives late', async ({ page }) => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const state = await prepareRegister(page, { detailHolds: { 'opportunity-0': held } })
  await vf(page, 0).click()
  await expect.poll(() => state.requests.some(item => item.path.endsWith('/deals/opportunity-0/'))).toBe(true)
  await vf(page, 1).click()
  await expect(rail(page)).toContainText('Compressor replacement FEED')
  release()
  await expect(rail(page)).not.toContainText('Seawater intake engineering study')
  expect(state.pageErrors).toEqual([])
})

test('summary uses complete active rows and labels separate currencies and unknown values', async ({ page }) => {
  await prepareRegister(page)
  const summary = page.getByRole('region', { name: 'Opportunity summary', exact: true })
  await expect(summary.getByRole('button', { name: 'Open opportunities: 29', exact: true })).toBeVisible()
  await expect(summary.getByRole('button', { name: 'Submission due in 7 days: 3', exact: true })).toBeVisible()
  const pipeline = summary.getByRole('button', { name: /^Weighted pipeline:/ })
  await expect(pipeline).toContainText('AED 50K')
  await expect(pipeline).toContainText('USD 150K')
  await expect(pipeline).toContainText('27 missing value or currency')
  await search(page).fill('No such opportunity')
  await expect(register(page)).toContainText('No opportunities match this view')
  await expect(summary.getByRole('button', { name: 'Open opportunities: 29', exact: true })).toBeVisible()
})

test('status, decision, service, owner and deadline filters combine and can be cleared', async ({ page }) => {
  await prepareRegister(page)
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('qualified')
  await page.getByRole('combobox', { name: 'Go/No-Go', exact: true }).selectOption('bid')
  await page.getByRole('combobox', { name: 'Service line', exact: true }).selectOption('engineering_design')
  await page.getByRole('combobox', { name: 'Owner', exact: true }).selectOption('12')
  await page.getByRole('combobox', { name: 'Deadline', exact: true }).selectOption('week')
  await expect(vf(page, 1)).toBeVisible()
  await expect(register(page).getByRole('row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await search(page).fill('Closed historical package')
  await expect(vf(page, 3)).toBeVisible()
})

test('missing deadlines stay unknown and do not receive an overdue warning', async ({ page }) => {
  await prepareRegister(page, { records: [opportunity(0)] })
  const row = register(page).getByRole('row').filter({ hasText: 'Q-102101' })
  await expect(row).toContainText('Not provided')
  await expect(row).not.toContainText(/overdue|days remaining/i)
  await expect(page.getByRole('region', { name: 'Requires attention', exact: true })).toContainText('Requires attention (0)')
})

test('pagination, sorting, column visibility and density controls work', async ({ page }) => {
  await prepareRegister(page)
  await page.getByRole('combobox', { name: 'Rows per page', exact: true }).selectOption('10')
  await expect(register(page).getByRole('row')).toHaveCount(11)
  await expect(vf(page, 30)).toBeVisible()
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(vf(page, 30)).toHaveCount(0)
  await page.getByRole('button', { name: 'Previous page', exact: true }).click()
  await register(page).getByRole('button', { name: 'VF Code', exact: true }).click()
  await expect(vf(page, 0)).toBeVisible()
  await expect(register(page).getByRole('columnheader', { name: 'VF Code', exact: true })).toHaveAttribute('aria-sort', 'ascending')
  await menu(page, 'Columns').click()
  await page.getByRole('checkbox', { name: 'Service line', exact: true }).uncheck()
  await expect(register(page).getByRole('columnheader', { name: 'Service line', exact: true })).toHaveCount(0)
  await menu(page, 'Density').click()
  const before = await register(page).getByRole('row').nth(1).boundingBox()
  await page.getByRole('button', { name: 'Compact', exact: true }).click()
  const after = await register(page).getByRole('row').nth(1).boundingBox()
  expect(after.height).toBeLessThan(before.height)
})

test('export current view sends only filtered IDs and returns a CSV download', async ({ page }) => {
  const state = await prepareRegister(page)
  await search(page).fill('Compressor replacement FEED')
  await expect(vf(page, 1)).toBeVisible()
  await menu(page, 'Export').first().click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Export current view/ }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
  expect(state.exports).toEqual([{ ids: 'opportunity-1' }])
  await expect(page.locator('.sor-notice')).toContainText('Exported 1 opportunity')
})

test('export selected surfaces a failure and preserves selection for retry', async ({ page }) => {
  const state = await prepareRegister(page, { exportStatus: 403 })
  await register(page).getByRole('checkbox', { name: 'Select Q-102101', exact: true }).check()
  await register(page).getByRole('checkbox', { name: 'Select Q-102102', exact: true }).check()
  await menu(page, 'Export').first().click()
  await page.getByRole('button', { name: /^Export selected/ }).click()
  await expect(page.getByRole('alert')).toContainText('selected export is unavailable')
  await expect(register(page).getByRole('checkbox', { name: 'Select Q-102101', exact: true })).toBeChecked()
  state.exportStatus = 200
  await menu(page, 'Export').first().click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Export selected/ }).click()
  await downloaded
  expect(state.exports).toHaveLength(2)
  expect(state.exports[1]).toEqual(state.exports[0])
  expect(state.exports[1].ids.split(',').sort()).toEqual(['opportunity-0', 'opportunity-1'])
})

test('a failed later list page never becomes a complete metric or partial register', async ({ page }) => {
  const state = await prepareRegister(page, { listPageStatuses: { 2: 503 } })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(register(page)).toContainText('Opportunities could not be loaded')
  await expect(page.getByRole('button', { name: /^Open opportunities:/ })).not.toHaveAccessibleName('Open opportunities: 16')
  state.listPageStatuses = {}
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click()
  await expect(vf(page, 0)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open opportunities: 29', exact: true })).toBeVisible()
})

test('detail failure shows a retry and never displays another record as the selected detail', async ({ page }) => {
  const state = await prepareRegister(page, { detailStatuses: { 'opportunity-0': 503 } })
  await vf(page, 0).click()
  await expect(rail(page).getByRole('alert')).toBeVisible()
  await expect(rail(page)).not.toContainText('Offshore platform electrical upgrade')
  state.detailStatuses['opportunity-0'] = 200
  await rail(page).getByRole('button', { name: 'Retry details', exact: true }).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  expect(state.pageErrors).toEqual([])
})

test('registration action retains the reviewed VF dialog', async ({ page }) => {
  await prepareRegister(page)
  await page.getByRole('button', { name: 'New opportunity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Register opportunity (VF)', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Owner', { exact: true })).toHaveValue('11')
  await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('refresh reloads selected detail and removes a record no longer in the register', async ({ page }) => {
  const state = await prepareRegister(page)
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  state.records[0] = { ...state.records[0], deal_name: 'Updated intake engineering scope' }
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(rail(page)).toContainText('Updated intake engineering scope')
  await expect.poll(() => state.requests.filter(item => item.path.endsWith('/deals/opportunity-0/')).length).toBe(2)
  state.records = state.records.filter(item => item.id !== 'opportunity-0')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(vf(page, 0)).toHaveCount(0)
  await expect(rail(page)).not.toContainText('Updated intake engineering scope')
  expect(state.pageErrors).toEqual([])
})

test('full record detail failure blocks edits and recovers through its retry', async ({ page }) => {
  const state = await prepareRegister(page)
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  state.detailStatuses['opportunity-0'] = 503
  await rail(page).getByLabel('More opportunity actions').click()
  await rail(page).getByRole('button', { name: 'Open full record', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Opportunity record', exact: true })
  await expect(dialog).toContainText('Opportunity details could not be loaded.')
  await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Submit qualification', exact: true })).toHaveCount(0)
  state.detailStatuses['opportunity-0'] = 200
  await dialog.getByRole('button', { name: 'Retry record', exact: true }).click()
  await expect(dialog).toContainText('Seawater intake engineering study')
  await expect(dialog.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
  expect(state.pageErrors).toEqual([])
})

for (const status of [200, 503]) test(`a late ${status} save cannot replace or invalidate another opportunity edit`, async ({ page }) => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const state = await prepareRegister(page, {
    patchHolds: { 'opportunity-0': held }, patchStatuses: { 'opportunity-0': status },
  })
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  await rail(page).getByRole('button', { name: 'Edit details', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Opportunity record', exact: true })
  await dialog.getByLabel('Opportunity name', { exact: true }).fill('First opportunity pending save')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect.poll(() => state.requests.some(item => item.method === 'PATCH' && item.path.endsWith('/deals/opportunity-0/'))).toBe(true)
  await dialog.getByRole('button', { name: 'Close record', exact: true }).click()
  await vf(page, 1).click()
  await expect(rail(page)).toContainText('Compressor replacement FEED')
  await rail(page).getByRole('button', { name: 'Edit details', exact: true }).click()
  const input = dialog.getByLabel('Opportunity name', { exact: true })
  await input.fill('Retained second opportunity draft')
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  const completed = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/deals/opportunity-0/'))
  release()
  const response = await completed
  expect(response.status()).toBe(status)
  await response.finished()
  // Allow the completed request and the following React paint to settle before
  // asserting that neither the obsolete success nor error touched this draft.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(input).toHaveValue('Retained second opportunity draft')
  await expect(dialog).toContainText('Q-102102')
  await expect(dialog).not.toContainText('The previous opportunity save failed.')
  await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  expect(state.pageErrors).toEqual([])
})

for (const width of [390, 1024, 1366, 1920]) test(`register and selected details fit ${width}px without page overflow`, async ({ page }, testInfo) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width, height: 1000 })
  const state = await prepareRegister(page, { realShell: true })
  await vf(page, 0).click()
  await expect(rail(page)).toContainText('Seawater intake engineering study')
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1)
  await expect(rail(page).getByRole('tab')).toHaveText(['Overview', 'Activity'])
  await expect(rail(page).getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('navigation', { name: 'Primary navigation', exact: true })).toBeVisible()
  if (width > 1000) {
    const listBounds = await page.locator('.sor-main').boundingBox()
    const detailBounds = await rail(page).boundingBox()
    const listShare = listBounds.width / (listBounds.width + detailBounds.width)
    expect(listShare).toBeGreaterThan(width === 1024 ? 0.5 : 0.58)
    expect(listShare).toBeLessThan(0.62)
    expect(detailBounds.width).toBeGreaterThanOrEqual(320)
  }
  await expect(page.locator('.main-content .sor-table-scroll table')).toBeVisible()
  await expect(register(page)).toHaveAttribute('data-table-typography', 'preserve')
  await expect(register(page).getByRole('cell', { name: 'Q-102101', exact: true })).toHaveCSS('font-size', '13px')
  await expect(register(page).getByRole('columnheader', { name: 'VF Code', exact: true })).toHaveCSS('font-size', '12px')
  await page.screenshot({ path: testInfo.outputPath(`opportunity-register-${width}.png`), fullPage: true })
  if (width === 1920) {
    const scan = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await testInfo.attach('opportunity-register-accessibility', { body: JSON.stringify(scan.violations, null, 2), contentType: 'application/json' })
    expect(scan.violations).toEqual([])
  }
  expect(state.pageErrors).toEqual([])
})
