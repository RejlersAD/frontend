import { test, expect } from '@playwright/test'
import { orderFormHarness, orderFormId, orderFormNumber, orderFormRecommendation } from '../fixtures/purchase-order-form.fixture'

// The first full-App navigation includes the engineering modules on cold Vite starts.
test.setTimeout(240000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const selector = page => page.getByRole('combobox', { name: 'Final Management Sign-off approver', exact: true })
const workspace = page => page.locator('.purchase-order-form-workspace')
const savedWrites = state => state.acceptedWrites.filter(row => ['POST', 'PATCH'].includes(row.method))
const isolate = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]) }
const artifact = name => `${process.env.PO_APPROVAL_ARTIFACTS_DIR || 'test-results-po-approval/artifacts'}/${name}`
async function selectRecommendation(page) {
  await expect(page.getByRole('heading', { name: 'New purchase order', exact: true })).toBeVisible({ timeout: 90000 })
  await page.locator('#po-pr-search').fill('9001')
  await page.getByRole('option', { name: new RegExp(orderFormRecommendation.pr_number) }).click()
  await expect(workspace(page).getByLabel('PO Number', { exact: true })).toHaveValue(orderFormNumber)
  await workspace(page).getByRole('combobox', { name: 'Price basis', exact: true }).selectOption('exclusive')
}
const save = page => workspace(page).getByRole('button', { name: /^(Save draft|Save changes)$/ }).first().click()
const oldDraft = (overrides = {}) => ({
  id: orderFormId, po_number: orderFormNumber, status: 'draft', title: 'Native order needing approval routing',
  vendor: 21, vendor_name: 'Alfanar Engineering LLC', pr_reference: orderFormRecommendation.id,
  pr_number: orderFormRecommendation.pr_number, currency: 'AED', total_amount: '420000', tax_amount: '20000',
  payment_terms: 'Net 30', items: [], approval_log: [], attachments: [], ...overrides,
})
async function edit(page, record) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = record
    fixture.orders = [record]
  } })
  await page.getByRole('button', { name: `Actions for ${orderFormNumber}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Edit purchase order', exact: true })).toBeVisible()
  return state
}

test('linked PR retains an independent pending final PO signer and sends no PR chain or approval evidence', async ({ page }) => {
  const state = await orderFormHarness(page, { recommendation: { approval_workflow_config: [
    { level: 4, user_id: 44, user_name: 'Mohamad', role: 'VP Delivery', status: 'approved' },
  ] } })
  await selectRecommendation(page)
  await expect(selector(page)).toBeEnabled()
  await expect(selector(page)).toHaveValue('11')
  await expect(page.getByRole('region', { name: 'Current purchase order PDF preview', exact: true }).getByRole('img')).toBeVisible({ timeout: 30000 })
  await selector(page).scrollIntoViewIfNeeded()
  await expect(selector(page)).toBeInViewport()
  await expect(page.getByRole('tab', { name: 'Header, Buyer & Project', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.screenshot({ path: artifact('po-independent-final-signatory.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await selector(page).scrollIntoViewIfNeeded()
  await expect(selector(page)).toBeInViewport()
  expect((await selector(page).boundingBox()).width).toBeGreaterThanOrEqual(250)
  await expect(page.getByRole('tablist', { name: 'Purchase order sections', exact: true }).getByRole('tab')).toHaveCount(4)
  await page.screenshot({ path: artifact('po-independent-final-signatory-mobile.png') })
  await page.setViewportSize({ width: 1672, height: 941 })
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  const body = savedWrites(state)[0].body
  expect(body.status).toBe('draft')
  expect(body.approval_log).toHaveLength(1)
  expect(body.approval_log[0]).toMatchObject({ stage: 'Final Management Sign-off', user_id: 11, approver: 'Jarmo Suominen', status: 'Pending' })
  expect(body).not.toHaveProperty('approval_workflow_config')
  for (const field of ['approved_by_name', 'approved_at', 'approved_date', 'approval_signature']) expect(body).not.toHaveProperty(field)
  isolate(state)
})

const directoryApprover = (id, full_name, email) => ({ id, full_name, email, job_title: 'CEO', is_active: true })
for (const scenario of [
  { name: 'missing default identity', employees: [directoryApprover(12, 'Authorized PO Signatory', 'authorized@example.test')], selection: '12' },
  { name: 'ambiguous default identity', employees: [directoryApprover(11, 'Jarmo Suominen', 'jarmo@example.test'), directoryApprover(12, 'Jarmo Suominen', 'other-jarmo@example.test')], selection: '12' },
]) {
  test(`${scenario.name} requires an explicit employee selection before creating the PO`, async ({ page }) => {
    const state = await orderFormHarness(page, { handleRequest: async (route, fixture, url) => {
      if (url.pathname !== '/api/v1/procurement/requisitions/get_approvers/') return false
      expect(url.searchParams.get('role')).toBe('any_active')
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ users: scenario.employees }) })
      return true
    } })
    await selectRecommendation(page)
    await expect(selector(page)).toBeEnabled()
    await expect(selector(page)).toHaveValue('')
    await save(page)
    await expect(workspace(page)).toContainText('Select an active employee for: Final Management Sign-off')
    expect(savedWrites(state)).toEqual([])
    await selector(page).selectOption(scenario.selection)
    await save(page)
    await expect(page).toHaveURL(/\/procurement\/orders$/)
    expect(savedWrites(state)).toHaveLength(1)
    expect(String(savedWrites(state)[0].body.approval_log[0].user_id)).toBe(scenario.selection)
    expect(savedWrites(state)[0].body.approval_log[0].status).toBe('Pending')
    isolate(state)
  })
}

test('backend approver eligibility rejection preserves the selection and permits an explicit retry', async ({ page }) => {
  const message = 'Final Management Sign-off requires the configured business position with Purchase Order approval permission.'
  const state = await orderFormHarness(page, { prepare: fixture => { fixture.saveError = { approval_log: [message] } } })
  await selectRecommendation(page)
  await save(page)
  await expect(workspace(page)).toContainText(message)
  await expect(page).toHaveURL(/\/procurement\/orders\/new$/)
  await expect(selector(page)).toHaveValue('11')
  expect(savedWrites(state)).toEqual([])
  state.saveError = null
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  expect(savedWrites(state)[0].body.approval_log[0]).toMatchObject({ user_id: 11, status: 'Pending' })
  isolate(state)
})

test('new PO cannot save without an assigned directory approver', async ({ page }) => {
  const state = await orderFormHarness(page)
  await selectRecommendation(page)
  await selector(page).selectOption('')
  await save(page)
  await expect(workspace(page)).toContainText('Select an active employee for: Final Management Sign-off')
  expect(savedWrites(state)).toEqual([])
  await selector(page).selectOption('11')
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  isolate(state)
})

test('old native Draft with empty route can receive an explicitly selected PO signer', async ({ page }) => {
  const state = await edit(page, oldDraft())
  await expect(selector(page)).toBeEnabled()
  await expect(selector(page)).toHaveValue('')
  await selector(page).selectOption('11')
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  expect(savedWrites(state)[0].body.approval_log[0]).toMatchObject({ user_id: 11, status: 'Pending' })
  for (const field of ['approved_by_name', 'approved_at', 'approved_date', 'approval_signature', 'total_amount', 'status']) expect(savedWrites(state)[0].body).not.toHaveProperty(field)
  isolate(state)
})

test('existing PO assignments and source approval evidence stay unchanged during metadata edits', async ({ page }) => {
  const history = [
    { stage: 'VP Delivery', external: true, source: 'purchase_requisition', source_pr_id: orderFormRecommendation.id, approver: 'Mohamad', status: 'Approved' },
    { level: 0, stage: 'Final Management Sign-off', user_id: 11, approver: 'Jarmo Suominen', status: 'Pending' },
  ]
  const state = await edit(page, oldDraft({ approval_log: history }))
  await expect(selector(page)).toBeDisabled()
  await page.locator('[name="title"]').fill('Corrected native PO title')
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)[0].body).not.toHaveProperty('approval_log')
  expect(state.record.approval_log).toEqual(history)
  isolate(state)
})

test('signed source Draft with empty routing does not gain a new pending signer', async ({ page }) => {
  const state = await edit(page, oldDraft({ attachments: [{ type: 'signed_purchase_order_pdf', filename: 'Signed-original.pdf' }] }))
  await expect(selector(page)).toHaveCount(0)
  await page.locator('[name="title"]').fill('Corrected historical PO title')
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)[0].body).not.toHaveProperty('approval_log')
  expect(state.record.approval_log).toEqual([])
  isolate(state)
})

test('recorded PO approval remains untouched when correcting metadata on a draft-status legacy record', async ({ page }) => {
  const approval = {
    approved_by: 11, approved_by_name: 'Jarmo Suominen', approved_by_title: 'CEO',
    approved_date: '2026-09-01', approved_at: '2026-09-01T10:00:00Z', approval_signature: 'recorded-po-signature',
    approval_log: [{ level: 0, stage: 'Final Management Sign-off', user_id: 11, approver: 'Jarmo Suominen', status: 'Approved', approved_at: '2026-09-01T10:00:00Z' }],
  }
  const state = await edit(page, oldDraft(approval))
  await expect(selector(page)).toBeDisabled()
  await page.locator('[name="title"]').fill('Corrected signed PO title')
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  expect(savedWrites(state)[0].body).toEqual({ title: 'Corrected signed PO title' })
  for (const [field, value] of Object.entries(approval)) expect(state.record[field]).toEqual(value)
  isolate(state)
})
