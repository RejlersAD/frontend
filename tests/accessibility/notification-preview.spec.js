import { test, expect } from '@playwright/test'

const assigned = { level: 0, stage: 'Procurement Review', role: 'Procurement', user_id: 12, user_email: 'approver@example.test', user_name: 'Procurement Reviewer', status: 'pending' }
const records = () => ({
  po: {
    id: 'po-1', po_number: 'RAD-PRJ-PUR-0480_2026', pr_reference: 'pr-1', pr_number: 'RAD-PRJ-PR-0426_2026',
    title: 'Annual engineering software licence', description: '<p>Supply InfoMaker Standard Edition annual subscription.</p>',
    vendor_name: 'Engineering Software Supplier', vendor_address: 'Abu Dhabi, United Arab Emirates',
    currency: 'AED', subtotal: '85250.00', tax_amount: '4262.50', total_amount: '89512.50',
    project_name: 'AS BUILT RECOVERY & VIRTUAL TOUR PHASE 3', project_number: '5901205',
    status: 'draft', can_approve: false, current_approval: assigned, approval_log: [assigned],
    items: [{ description: 'InfoMaker Standard Edition annual subscription licence', quantity: 1, unit_price: '85250.00', uom: 'EA' }],
    attachments: [],
  },
  pr: {
    id: 'pr-1', pr_number: 'RAD-PRJ-PR-0426_2026', po_number_reference: 'RAD-PRJ-PUR-0480_2026',
    title: 'Annual engineering software recommendation', product_service: 'InfoMaker annual subscription',
    description_reason: '<p>Review the engineering software recommendation.</p>', status: 'submitted',
    can_approve: false, approval_workflow_config: [assigned], attachments: [], items: [],
  },
})

async function prepare(page, options = {}) {
  const state = { records: records(), requests: [], errors: [], releaseDecision: null, ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('radai_access_token', 'notification-preview-test-token')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 12, email: 'approver@example.test' }))
  })
  await page.route('**/api/v1/**', async route => {
    const method = route.request().method()
    const path = new URL(route.request().url()).pathname
    state.requests.push({ method, path })
    let response
    if (path.endsWith('/notifications/stats/')) response = { total_count: 0, unread_count: 0, read_count: 0, by_priority: {} }
    else if (path.endsWith('/notifications/')) response = { results: [] }
    else if (method === 'POST') {
      await new Promise(resolve => { state.releaseDecision = resolve })
      response = { ...state.records.po, can_approve: false }
    } else if (path.includes('/procurement/orders/')) response = state.records.po
    else if (path.includes('/procurement/requisitions/')) response = state.records.pr
    else response = {}
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) })
  })
  await page.goto('/tests/fixtures/notification-preview.html')
  return state
}

async function openPurchaseOrder(page) {
  await page.getByRole('button', { name: 'Open purchase order preview', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Purchase Order · RAD-PRJ-PUR-0480_2026' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.po-template-page').first()).toBeVisible()
  return dialog
}

test('desktop PO preview covers the sidebar and gives the document a wide single scroll canvas', async ({ page }) => {
  const state = await prepare(page)
  const dialog = await openPurchaseOrder(page)
  const box = await dialog.boundingBox()
  const paper = await dialog.locator('.po-template-page').first().boundingBox()
  expect(paper.width).toBeGreaterThan(box.width * 0.75)
  expect(Math.abs((paper.x - box.x) - (box.x + box.width - paper.x - paper.width))).toBeLessThan(18)
  const portal = await page.locator('.notification-record-preview-backdrop').evaluate(element => element.parentElement === document.body)
  expect(portal).toBe(true)
  const aboveSidebar = await page.evaluate(() => Boolean(document.elementFromPoint(120, 45)?.closest('[role="dialog"]')))
  expect(aboveSidebar).toBe(true)
  const header = dialog.locator('.notification-record-preview__header')
  const originalHeader = await header.boundingBox()
  const canvas = dialog.getByLabel('Document preview pages')
  await canvas.evaluate(element => { element.scrollTop = 650 })
  expect(await canvas.evaluate(element => element.scrollTop)).toBeGreaterThan(500)
  expect((await header.boundingBox()).y).toBe(originalHeader.y)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await canvas.evaluate(element => { element.scrollTop = 0 })
  await page.screenshot({ path: '../../artifacts/notification-order-preview-desktop.png' })
  expect(state.errors).toEqual([])
})

test('mobile PO preview fits the viewport without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await prepare(page)
  const dialog = await openPurchaseOrder(page)
  const box = await dialog.boundingBox()
  const paper = await dialog.locator('.po-template-page').first().boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(390)
  expect(paper.x).toBeGreaterThanOrEqual(box.x)
  expect(paper.x + paper.width).toBeLessThanOrEqual(box.x + box.width + 1)
  const dimensions = await dialog.getByLabel('Document preview pages').evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1)
  await page.screenshot({ path: '../../artifacts/notification-order-preview-mobile.png' })
  expect(state.errors).toEqual([])
})

test('preview traps keyboard focus and restores its opener after Escape', async ({ page }) => {
  await prepare(page)
  const dialog = await openPurchaseOrder(page)
  const close = dialog.getByRole('button', { name: 'Close preview' })
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open purchase order preview', exact: true })).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
})

test('server decision denial hides controls and recommendation opens its own endpoint', async ({ page }) => {
  const state = await prepare(page)
  const dialog = await openPurchaseOrder(page)
  await expect(dialog.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close preview' }).click()
  await page.getByRole('button', { name: 'Open purchase recommendation preview' }).click()
  const recommendation = page.getByRole('dialog', { name: 'Purchase Recommendation · RAD-PRJ-PR-0426_2026' })
  await expect(recommendation).toBeVisible()
  await expect(recommendation.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  expect(state.requests.some(request => request.path.endsWith('/procurement/orders/po-1/'))).toBe(true)
  expect(state.requests.some(request => request.path.endsWith('/procurement/requisitions/pr-1/'))).toBe(true)
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  expect(state.errors).toEqual([])
})

test('pending PO decision keeps the preview open and targets only the PO action', async ({ page }) => {
  const data = records()
  data.po.can_approve = true
  const state = await prepare(page, { records: data })
  const dialog = await openPurchaseOrder(page)
  await dialog.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Approving...' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Close preview' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect.poll(() => typeof state.releaseDecision).toBe('function')
  state.releaseDecision()
  await expect(dialog.getByText('Purchase Order approved successfully.')).toBeVisible()
  expect(state.requests.filter(request => request.method === 'POST')).toEqual([
    { method: 'POST', path: '/api/v1/procurement/orders/po-1/approve/' },
  ])
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(state.errors).toEqual([])
})
