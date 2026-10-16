import { test, expect } from '@playwright/test'
import { purchaseOrderHarness } from '../fixtures/purchase-orders.fixture'

test('dashboard order links apply local status filters on load and client navigation', async ({ page }) => {
  const state = await purchaseOrderHarness(page, { route: '/procurement/orders?status=draft' })
  const status = page.getByRole('combobox', { name: 'Status', exact: true })
  const register = page.getByRole('region', { name: 'Purchase order register', exact: true })
  const orderRows = register.locator('tbody > tr')
  const allOrders = page.locator('.prw-kpis > button').filter({ hasText: 'All orders' })
  await expect(status).toHaveValue('draft')
  await expect(orderRows).toHaveCount(3)
  await expect(register).toContainText('PO-TEST-003')
  await expect(register).not.toContainText('PO-TEST-002')
  await expect(allOrders.locator('.prw-kpi-value')).toHaveText('8')

  await page.getByRole('textbox', { name: 'Search purchase orders' }).fill('no matching record')
  await page.evaluate(() => window.navigatePurchaseOrders('/procurement/orders?status=sent'))
  await expect(status).toHaveValue('issued')
  await expect(page.getByRole('textbox', { name: 'Search purchase orders' })).toHaveValue('')
  await expect(orderRows).toHaveCount(4)
  for (const number of ['001', '004', '005', '006']) await expect(register).toContainText(`PO-TEST-${number}`)

  for (const legacyStatus of ['acknowledged', 'in_progress', 'partially_received', 'in_delivery', 'completed']) {
    await status.selectOption('all')
    await expect(orderRows).toHaveCount(8)
    await page.evaluate(value => window.navigatePurchaseOrders(`/procurement/orders?status=${value}`), legacyStatus)
    await expect(status).toHaveValue('issued')
    await expect(orderRows).toHaveCount(4)
    await expect(orderRows.locator('.pow-status-label')).toHaveText(Array(4).fill('Issued'))
    await expect(allOrders.locator('.prw-kpi-value')).toHaveText('8')
  }

  await page.evaluate(() => window.navigatePurchaseOrders('/procurement/orders?status=invalid'))
  await expect(status).toHaveValue('all')
  await expect(orderRows).toHaveCount(8)
  await page.evaluate(() => window.navigatePurchaseOrders('/procurement/orders'))
  await expect(status).toHaveValue('all')
  await expect(orderRows).toHaveCount(8)
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.requests.every(request => request.method === 'GET')).toBeTruthy()
})
