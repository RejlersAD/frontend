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
async function edit(page, record, prepare = () => {}) {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare: fixture => {
    fixture.record = record
    fixture.orders = [record]
    prepare(fixture)
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
  await expect(selector(page).locator('option')).toHaveCount(2)
  await expect(selector(page)).toContainText('CEO, Rejlers Abu Dhabi / Senior VP, Middle East Region')
  await expect(page.locator('#buyer-reference-options-1 option[value="Richa Hannah Thomas"]')).toHaveCount(1)
  expect(state.requests.filter(request => request.path.endsWith('/get_approvers/')).map(request => request.query.role).sort()).toEqual(['any_active', 'po_final_signoff'])
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
      if (url.searchParams.get('role') !== 'po_final_signoff') return false
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ users: scenario.employees }) })
      return true
    } })
    await selectRecommendation(page)
    await expect(selector(page)).toBeEnabled()
    await expect(selector(page)).toHaveValue('')
    await save(page)
    await expect(workspace(page)).toContainText('Select an authorized signatory for: Final Management Sign-off')
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
  await expect(workspace(page).getByText('Required fields complete', { exact: true })).toHaveCount(0)
  expect(savedWrites(state)).toEqual([])
  state.saveError = null
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  expect(savedWrites(state)[0].body.approval_log[0]).toMatchObject({ user_id: 11, status: 'Pending' })
  isolate(state)
})

test('loading eligible signatories blocks assignment and retains form input', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  try {
    const state = await orderFormHarness(page, { handleRequest: async (route, _fixture, url) => {
      if (!url.pathname.endsWith('/get_approvers/') || url.searchParams.get('role') !== 'po_final_signoff') return false
      await pending
      await route.fulfill({ json: { users: [directoryApprover(11, 'Jarmo Suominen', 'jarmo@example.test')] } })
      return true
    } })
    await selectRecommendation(page)
    await page.locator('[name="title"]').fill('Keep this scope while signatories load')
    await expect(selector(page)).toBeDisabled()
    await save(page)
    await expect(page.locator('#po-signatory-status')).toContainText('Checking authorized PO signatories')
    expect(savedWrites(state)).toEqual([])
    release()
    await expect(selector(page)).toHaveValue('11')
    await expect(selector(page)).toBeEnabled()
    await expect(page.locator('[name="title"]')).toHaveValue('Keep this scope while signatories load')
    await save(page)
    await expect(page).toHaveURL(/\/procurement\/orders$/)
    expect(savedWrites(state)).toHaveLength(1)
    isolate(state)
  } finally { release() }
})

for (const status of [403, 503]) {
  test(`signatory list ${status} failure retains input and recovers on refresh`, async ({ page }) => {
    const state = await orderFormHarness(page, { prepare: fixture => {
      fixture.finalSignatoriesError = { detail: 'Synthetic signatory directory failure.' }
      fixture.finalSignatoriesErrorStatus = status
    } })
    await selectRecommendation(page)
    await page.locator('[name="title"]').fill('Scope retained after directory failure')
    await expect(selector(page)).toBeDisabled()
    await save(page)
    await expect(page.locator('#po-signatory-status')).toContainText(status === 403
      ? 'You do not have access to load authorized PO signatories.'
      : 'Authorized PO signatories could not be loaded. Please retry.')
    expect(savedWrites(state)).toEqual([])
    await expect(page.locator('#buyer-reference-options-1 option[value="Richa Hannah Thomas"]')).toHaveCount(1)
    state.finalSignatoriesError = null
    await workspace(page).getByRole('button', { name: 'Refresh signatories', exact: true }).click()
    await expect(selector(page)).toHaveValue('11')
    await expect(selector(page)).toBeEnabled()
    await expect(page.locator('[name="title"]')).toHaveValue('Scope retained after directory failure')
    await save(page)
    await expect(page).toHaveURL(/\/procurement\/orders$/)
    expect(savedWrites(state)).toHaveLength(1)
    isolate(state)
  })
}

test('empty eligible list does not fall back to the active employee directory', async ({ page }) => {
  const state = await orderFormHarness(page, { prepare: fixture => { fixture.finalSignatories = [] } })
  await selectRecommendation(page)
  await expect(selector(page)).toBeDisabled()
  await expect(selector(page)).toHaveValue('')
  await expect(selector(page).locator('option')).toHaveCount(1)
  await expect(page.locator('#po-signatory-status')).toContainText('No eligible final signatory is available.')
  await save(page)
  expect(savedWrites(state)).toEqual([])
  await expect(page.locator('#buyer-reference-options-1 option[value="Richa Hannah Thomas"]')).toHaveCount(1)
  isolate(state)
})

test('recovered signer who loses eligibility stays visible and cannot be saved until revalidated', async ({ page }) => {
  const state = await orderFormHarness(page)
  await selectRecommendation(page)
  await expect(selector(page)).toHaveValue('11')
  await page.locator('[name="title"]').fill('Recovered signatory scope')
  await workspace(page).getByRole('textbox', { name: 'Final Management Sign-off routing comments', exact: true }).fill('Retain this routing note')
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/preview-document/')).at(-1)?.body?.snapshot?.approval_log?.[0]?.comments).toBe('Retain this routing note')
  const original = state.finalSignatories
  state.finalSignatories = [directoryApprover(12, 'Authorized PO Signatory', 'authorized@example.test')]
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(selector(page)).toBeEnabled({ timeout: 90000 })
  await expect(selector(page)).toHaveValue('11')
  await expect(selector(page).locator('option[value="11"]')).toBeDisabled()
  await expect(page.locator('#po-signatory-status')).toContainText('The selected final signatory is no longer eligible.')
  await expect(page.locator('[name="title"]')).toHaveValue('Recovered signatory scope')
  await save(page)
  expect(savedWrites(state)).toEqual([])
  state.finalSignatories = original
  await workspace(page).getByRole('button', { name: 'Refresh signatories', exact: true }).click()
  await expect(selector(page).locator('option[value="11"]')).toBeEnabled()
  await expect(page.locator('#po-signatory-status')).toBeEmpty()
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  expect(savedWrites(state)[0].body.approval_log[0]).toMatchObject({ user_id: 11, comments: 'Retain this routing note', status: 'Pending' })
  isolate(state)
})

test('new PO cannot save without an assigned directory approver', async ({ page }) => {
  const state = await orderFormHarness(page)
  await selectRecommendation(page)
  await selector(page).selectOption('')
  await save(page)
  await expect(workspace(page)).toContainText('Select an authorized signatory for: Final Management Sign-off')
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

test('metadata edits preserve a recorded signer absent from current eligible and employee lists', async ({ page }) => {
  const history = [{ level: 0, stage: 'Final Management Sign-off', user_id: 99, approver: 'Recorded Former Signer', status: 'Pending' }]
  const state = await edit(page, oldDraft({ approval_log: history }), fixture => { fixture.finalSignatories = [] })
  await expect(selector(page)).toBeDisabled()
  await expect(selector(page)).toHaveValue('99')
  await expect(selector(page)).toContainText('Recorded Former Signer')
  await page.locator('[name="title"]').fill('Metadata correction preserving the recorded route')
  await save(page)
  await expect(page).toHaveURL(/\/procurement\/orders$/)
  expect(savedWrites(state)).toHaveLength(1)
  expect(savedWrites(state)[0].body).toEqual({ title: 'Metadata correction preserving the recorded route' })
  expect(state.record.approval_log).toEqual(history)
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
