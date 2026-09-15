import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { purchaseOrderHarness } from '../fixtures/purchase-orders.fixture'

test.setTimeout(60000)
const register = page => page.getByRole('region', { name: 'Purchase order register', exact: true })
const details = page => page.getByRole('complementary', { name: 'Purchase order details' })
const row = (page, number) => register(page).getByRole('row').filter({ has: page.getByRole('button', { name: `Select ${number}`, exact: true }) })
const loaded = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible()
  await expect(details(page)).toHaveAttribute('aria-busy', 'false')
}
const actions = page => page.evaluate(() => window.purchaseOrderActions)
const noWrites = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]); expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]) }
const accessibility = async page => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.filter(value => ['critical', 'serious'].includes(value.impact))).toEqual([])
}
const reset = async page => {
  await page.getByRole('button', { name: 'Register options', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Reset filters', exact: true }).click()
}

test('desktop populated register selected detail and honest operational evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 })
  const state = await purchaseOrderHarness(page, { shell: true }); await loaded(page)
  await expect(register(page).getByRole('row')).toHaveCount(9)
  await expect(page.locator('.prw-kpis > button')).toHaveCount(8)
  await expect(details(page)).toContainText('Control valves and actuator package delivery line')
  await expect(details(page).getByRole('table')).toContainText('AED 1,000')
  await expect(row(page, 'PO-TEST-005').getByRole('cell').nth(7)).toHaveText('—')
  await expect(row(page, 'PO-TEST-005').getByRole('cell').nth(8)).toHaveText('Not available')
  const total = page.locator('.prw-kpis > button').filter({ hasText: 'Total order value' })
  await expect(total).toContainText('2 currencies')
  await expect(total).toHaveAttribute('title', /USD 22,500/)
  await accessibility(page)
  await page.screenshot({ path: '../artifacts/purchase-orders-desktop.png' })
  noWrites(state)
})

test('selection fetches only that order and receipt completion is not inferred from closed status', async ({ page }) => {
  const state = await purchaseOrderHarness(page); await loaded(page)
  await page.getByRole('button', { name: 'Select PO-TEST-005', exact: true }).click(); await loaded(page)
  await expect(details(page).getByRole('table')).toContainText(state.details[105].items[0].description)
  await expect(details(page).getByRole('list', { name: 'Purchase order lifecycle' }).getByRole('listitem').filter({ hasText: /^Received/ })).toContainText('Not recorded')
  await expect(details(page).getByRole('list', { name: 'Purchase order lifecycle' }).getByRole('listitem').filter({ hasText: /^Invoice matched/ })).toContainText('Not recorded')
  expect(state.requests.filter(request => request.path.includes('/procurement/orders/')).map(request => request.path)).toEqual(['/api/v1/procurement/orders/101/', '/api/v1/procurement/orders/105/'])
  noWrites(state)
})

test('search combined filters my actions and filtered export use the visible source records', async ({ page }) => {
  const state = await purchaseOrderHarness(page); await loaded(page)
  await page.getByRole('textbox', { name: 'Search purchase orders' }).fill('cable')
  await expect(register(page).getByRole('row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Export register', exact: true }).click()
  expect((await actions(page)).at(-1)).toMatchObject({ name: 'export', value: [{ id: 103 }] })
  await page.getByRole('switch', { name: 'My actions' }).check()
  await expect(page.getByRole('heading', { name: 'No matching purchase orders' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await page.getByRole('combobox', { name: 'Supplier', exact: true }).selectOption('Summit Cable Trading')
  await page.getByRole('combobox', { name: 'Buyer', exact: true }).selectOption('Samir Ali')
  await page.getByRole('combobox', { name: 'Delivery date', exact: true }).selectOption('undated')
  await expect(register(page).getByRole('row')).toHaveCount(2)
  await expect(register(page)).toContainText('PO-TEST-003')
  await reset(page)
  await page.getByRole('button', { name: 'Review acknowledgement queue', exact: true }).click()
  await expect(register(page).getByRole('row')).toHaveCount(2)
  await expect(register(page)).toContainText('PO-TEST-001')
  noWrites(state)
})

test('pagination and sorting reset safely when a filter reduces the result set', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { prepare: state => {
    for (let index = 9; index <= 32; index += 1) {
      const record = { ...state.props.orders[0], id: index + 100, po_number: `PO-TEST-${String(index).padStart(3, '0')}`, title: `Additional package ${index}`, created_at: '2026-08-01T08:00:00Z', status: 'draft' }
      state.props.orders.push(record); state.details[record.id] = record
    }
  } }); await loaded(page)
  await expect(register(page).getByRole('row')).toHaveCount(26)
  await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('10')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(register(page).getByRole('row')).toHaveCount(11)
  await page.getByRole('textbox', { name: 'Search purchase orders' }).fill('valves')
  await expect(register(page).getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page')
  await reset(page)
  await register(page).getByRole('button', { name: 'PO number', exact: true }).click()
  await expect(register(page).getByRole('columnheader').filter({ hasText: 'PO number' })).toHaveAttribute('aria-sort', 'ascending')
  noWrites(state)
})

test('header and row action callbacks preserve the selected source record and menu focus', async ({ page }) => {
  const state = await purchaseOrderHarness(page); await loaded(page)
  const trigger = page.getByRole('button', { name: 'More purchase order actions', exact: true })
  await trigger.click(); await trigger.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Import signed PDF', exact: true })).toBeFocused()
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
  await trigger.click(); await page.getByRole('menuitem', { name: 'Import Excel', exact: true }).click()
  await page.getByRole('button', { name: 'New purchase order', exact: true }).click()
  await row(page, 'PO-TEST-003').getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Actions for PO-TEST-003', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Delete order', exact: true }).click()
  await page.getByRole('button', { name: 'Actions for PO-TEST-003', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Download PDF', exact: true }).click()
  expect((await actions(page)).map(value => ({ name: value.name, id: value.value?.id }))).toEqual([
    { name: 'importExcel', id: undefined }, { name: 'create', id: undefined }, { name: 'edit', id: 103 }, { name: 'delete', id: 103 }, { name: 'pdf', id: 103 },
  ])
  noWrites(state)
})

test('acknowledgement issuing and detail navigation invoke the original workflows', async ({ page }) => {
  const state = await purchaseOrderHarness(page); await loaded(page)
  await details(page).getByRole('button', { name: 'Mark acknowledged', exact: true }).click()
  await page.getByRole('button', { name: 'Select PO-TEST-008', exact: true }).click(); await loaded(page)
  await details(page).getByRole('button', { name: 'Issue order', exact: true }).click()
  await details(page).getByRole('button', { name: 'View approval record', exact: true }).click()
  await details(page).getByRole('button', { name: 'Open receipts' }).click()
  await expect.poll(() => page.evaluate(() => window.purchaseOrderRoute)).toBe('/procurement/receipts')
  expect(await actions(page)).toMatchObject([{ name: 'acknowledge', value: { id: 101 } }, { name: 'issue', value: { id: 108 } }, { name: 'open', value: 108 }])
  noWrites(state)
})

test('late response cannot replace a newly selected order', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { prepare: state => { state.deferred[101] = true } })
  await expect(page.getByRole('button', { name: 'Select PO-TEST-002', exact: true })).toBeVisible()
  await expect.poll(() => Boolean(state.pending[101])).toBeTruthy()
  await page.getByRole('button', { name: 'Select PO-TEST-002', exact: true }).click(); await loaded(page)
  await expect(details(page)).toContainText('Instrumentation inspection services delivery line')
  state.pending[101](); delete state.deferred[101]
  await expect.poll(() => Boolean(state.delivered[101])).toBeTruthy()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(details(page)).not.toContainText('Control valves and actuator package delivery line')
  await expect(page.getByRole('button', { name: 'Select PO-TEST-002', exact: true })).toHaveAttribute('aria-pressed', 'true')
  noWrites(state)
})

test('detail failure and mismatched identity stay explicit and retry current selection', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { prepare: state => { state.detailErrors[101] = 'Order detail unavailable.' } }); await loaded(page)
  await expect(details(page).getByRole('alert')).toContainText('Order detail unavailable.')
  await expect(details(page).getByRole('button', { name: 'Mark acknowledged' })).toBeDisabled()
  delete state.detailErrors[101]
  state.details[101] = { ...state.details[101], id: 999 }
  await details(page).getByRole('button', { name: 'Retry details' }).click()
  await expect(details(page).getByRole('alert')).toContainText('do not match the selected record')
  state.details[101].id = 101
  await details(page).getByRole('button', { name: 'Retry details' }).click(); await loaded(page)
  await expect(details(page).getByRole('alert').filter({ hasText: 'do not match' })).toHaveCount(0)
  await expect(details(page)).toContainText('Control valves and actuator package delivery line')
  noWrites(state)
})

test('loading register failure and genuinely empty state remain distinct', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { prepare: state => { state.props = { ...state.props, orders: [], loading: true } } })
  await expect(page.getByRole('status')).toContainText('Loading purchase orders')
  await expect(page.getByRole('button', { name: 'Export register', exact: true })).toBeDisabled()
  await page.evaluate(() => window.setPurchaseOrderProps({ loading: false, error: 'Synthetic register unavailable.' }))
  await expect(page.getByRole('heading', { name: 'Register unavailable' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Synthetic register unavailable.')
  await expect(page.locator('.prw-kpi-value')).toHaveText(Array(8).fill('—'))
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.evaluate(() => window.setPurchaseOrderProps({ error: null }))
  await expect(page.getByRole('heading', { name: 'No purchase orders yet' })).toBeVisible()
  await expect(details(page)).toContainText('Select a purchase order')
  expect(await actions(page)).toEqual([{ name: 'refresh' }]); noWrites(state)
})

test('refreshing props clears removed selection and unknown source values remain unknown', async ({ page }) => {
  const state = await purchaseOrderHarness(page); await loaded(page)
  await page.getByRole('button', { name: 'Select PO-TEST-007', exact: true }).click(); await loaded(page)
  await expect(details(page)).toContainText('CurrencyNot recorded')
  await expect(row(page, 'PO-TEST-007').getByRole('cell').nth(4)).toHaveText('—')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.evaluate(orders => window.setPurchaseOrderProps({ orders }), state.props.orders.filter(value => value.id === 103))
  await loaded(page)
  await expect(details(page)).toContainText('Cable installation materials')
  await expect(details(page)).not.toContainText('Unverified source record')
  expect(await actions(page)).toEqual([{ name: 'refresh' }]); noWrites(state)
})

test('mobile filters detail and menus stay within the viewport and pass accessibility', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await purchaseOrderHarness(page); await loaded(page)
  await page.screenshot({ path: '../artifacts/purchase-orders-mobile.png' })
  await page.screenshot({ path: '../artifacts/purchase-orders-mobile-full.png', fullPage: true })
  await accessibility(page)
  await page.getByRole('button', { name: 'More purchase order actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Import Excel', exact: true })).toBeVisible()
  await accessibility(page)
  await page.keyboard.press('Escape')
  noWrites(state)
})

test('OrderManagement wrapper loads the new register and retains imports export refresh and recommendations', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { integration: true }); await loaded(page)
  await expect(register(page).getByRole('row')).toHaveCount(9)
  await expect(page.getByRole('navigation', { name: 'Procurement registers' })).toContainText('Purchase Recommendations12')
  await page.getByRole('button', { name: 'More purchase order actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import Excel', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import Purchase Orders', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'More purchase order actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import Signed Purchase Order PDF', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export register', exact: true }).click()
  await expect((await downloaded).suggestedFilename()).toMatch(/\.xlsx$/)
  const before = state.requests.filter(request => request.path === '/api/v1/procurement/orders/').length
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page)
  expect(state.requests.filter(request => request.path === '/api/v1/procurement/orders/')).toHaveLength(before + 2)
  await page.getByRole('link', { name: /^Purchase Recommendations/ }).click()
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible()
  noWrites(state)
})
