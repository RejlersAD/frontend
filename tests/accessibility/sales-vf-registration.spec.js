import { test, expect } from '@playwright/test'
import { prepare, message, listing, paginated, canonicalClient, opportunityDetails, detected, conversionPath } from '../fixtures/sales-email-api-fixture.js'
const types = [{ value: 'tender', label: 'Tender' }, { value: 'rfq', label: 'RFQ' }, { value: 'eoi', label: 'EOI' }, { value: 'direct_enquiry', label: 'Direct enquiry' }, { value: 'other', label: 'Other' }]
const options = { default_owner: 11, owners: [{ id: 11, name: 'Current reviewer' }, { id: 12, name: 'Assigned reviewer' }], opportunity_types: types }
const record = { id: 'vf-one', deal_code: 'Q-102101', deal_name: 'Registered package', client: 'client-one', client_name: 'Example Energy LLC', owner_name: 'Current reviewer', created_by_name: 'Current reviewer', created_at: '2026-09-30T08:00:00Z', open_date: '2026-09-30', stage: 'lead', stage_display: 'Open', estimated_value: null, currency: '', expected_close_date: null, submission_due_date: null }
const form = page => page.getByRole('dialog', { name: 'Register opportunity (VF)', exact: true })
const classification = (code = 'tender_opportunity') => ({ version: 1, status: 'classified', code, needs_review: true, confidence: { level: 'medium', method: 'deterministic', reason: 'Explicit invitation in selected email.' }, evidence: [{ source_id: 'selected', location: 'subject', excerpt: 'Synthetic invitation' }] })
async function manual(page, config = {}) {
  const state = { requests: [], errors: [], records: [], fail: false, optionsStatus: 200, ...config }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-vf-user'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    state.requests.push({ method: request.method(), path: url.pathname, body: ['POST', 'PATCH'].includes(request.method()) ? request.postDataJSON() : null })
    if (url.pathname.endsWith('/deals/registration-options/')) return route.fulfill({ status: state.optionsStatus, json: options })
    if (url.pathname.endsWith('/deals/') && request.method() === 'POST') {
      if (state.hold) await state.hold
      if (state.fail) return route.fulfill({ status: 503, json: { detail: 'Temporary registration failure.' } })
      state.records = [{ ...record, ...request.postDataJSON() }]
      return route.fulfill({ status: 201, json: state.records[0] })
    }
    if (url.pathname.endsWith('/deals/vf-one/') && request.method() === 'PATCH') {
      state.records[0] = { ...state.records[0], ...request.postDataJSON() }
      return route.fulfill({ json: state.records[0] })
    }
    if (url.pathname.endsWith('/deals/vf-one/')) return route.fulfill({ json: state.records[0] || record })
    if (url.pathname.endsWith('/deals/vf-one/workspace/')) return route.fulfill({ json: { opportunity_id: 'vf-one', status: 'not_configured', folders: [], can_manage: false, can_upload: false, web_url: '' } })
    if (url.pathname.endsWith('/deals/')) return route.fulfill({ json: paginated(state.records) })
    if (url.pathname.endsWith('/clients/')) return route.fulfill({ json: paginated([canonicalClient()]) })
    return route.fulfill({ json: paginated([]) })
  })
  await page.goto(`/tests/fixtures/sales-vf-registration.html${config.overview ? '?overview=1' : ''}`)
  await page.getByRole('button', { name: 'New opportunity', exact: true }).click()
  await expect(form(page).getByLabel('Owner', { exact: true })).toHaveValue('11')
  return state
}
async function fillBasic(page) {
  await form(page).getByLabel('Opportunity type', { exact: true }).selectOption('tender')
  await form(page).getByLabel('Opportunity name', { exact: true }).fill('Registered package')
  await form(page).getByLabel('Client', { exact: true }).selectOption('client-one')
}
for (const overview of [false, true]) test(`minimal ${overview ? 'overview' : 'register'} registration creates without fabricated commercial facts`, async ({ page }, testInfo) => {
  const state = await manual(page, { overview })
  await fillBasic(page)
  await expect(form(page).getByLabel('Open date', { exact: true })).not.toHaveValue('')
  const colors = await form(page).getByRole('button', { name: 'Create opportunity', exact: true }).evaluate(node => ({ text: getComputedStyle(node).color, background: getComputedStyle(node).backgroundColor }))
  expect(colors.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(colors.background).not.toBe(colors.text)
  if (!overview) await form(page).screenshot({ path: testInfo.outputPath('vf-registration-form.png') })
  await form(page).getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Opportunity record', exact: true })).toBeVisible()
  const writes = state.requests.filter(item => item.method === 'POST')
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toMatchObject({ opportunity_type: 'tender', owner: '11', estimated_value: null, currency: '', expected_close_date: null, submission_due_date: null, scope_type: '' })
  expect(writes[0].body.registration_request_id).toMatch(/^[0-9a-f-]{36}$/)
  expect(writes[0].body.deal_code).toBeUndefined()
  expect(writes[0].body.created_by).toBeUndefined()
  expect(state.errors).toEqual([])
})
test('failed manual registration preserves values and retry identity while preventing a duplicate in-flight save', async ({ page }) => {
  const state = await manual(page, { fail: true })
  await fillBasic(page)
  const save = form(page).getByRole('button', { name: 'Create opportunity', exact: true })
  await save.click()
  await expect(form(page).getByRole('alert')).toContainText('Temporary registration failure')
  await expect(form(page).getByLabel('Opportunity name', { exact: true })).toHaveValue('Registered package')
  state.fail = false
  let release; state.hold = new Promise(resolve => { release = resolve })
  await save.click()
  await expect(form(page).getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled()
  release()
  await expect(form(page)).toHaveCount(0)
  const writes = state.requests.filter(item => item.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[1].body).toEqual(writes[0].body)
})
test('denied registration options block saving and retry keeps entered title', async ({ page }) => {
  const state = await manual(page)
  await form(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  state.optionsStatus = 403
  await page.getByRole('button', { name: 'New opportunity', exact: true }).click()
  await expect(form(page).getByRole('alert')).toContainText('do not have access')
  await form(page).getByLabel('Opportunity name', { exact: true }).fill('Retained registration')
  await expect(form(page).getByRole('button', { name: 'Create opportunity', exact: true })).toBeDisabled()
  state.optionsStatus = 200
  await form(page).getByRole('button', { name: 'Retry registration options', exact: true }).click()
  await expect(form(page).getByLabel('Owner', { exact: true })).toHaveValue('11')
  await expect(form(page).getByLabel('Opportunity name', { exact: true })).toHaveValue('Retained registration')
})
test('register shows VF and title, unknown value, and allows completing commercial details later', async ({ page }) => {
  const state = await manual(page, { records: [record] })
  await form(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: 'Q-102101' })
  await expect(row).toContainText('Registered package')
  await expect(row).toContainText('Not provided')
  await expect(row).toContainText('Open')
  await row.getByRole('button', { name: 'Q-102101', exact: true }).click()
  await page.getByLabel('More opportunity actions').click()
  await page.getByRole('button', { name: 'Open full record', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Opportunity record', exact: true })
  await drawer.getByRole('button', { name: 'Edit', exact: true }).click()
  await drawer.getByLabel('Estimated value', { exact: true }).fill('50000')
  await drawer.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('OMR')
  await drawer.getByLabel('Expected award date', { exact: true }).fill('2026-12-01')
  await drawer.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(drawer.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(state.requests.find(item => item.method === 'PATCH').body).toMatchObject({ estimated_value: '50000', currency: 'OMR', expected_close_date: '2026-12-01', next_action_date: null })
})
for (const mode of ['live', 'saved']) test(`${mode} minimal email registration preserves source review, Dubai open date and missing commercial values`, async ({ page }) => {
  const receivedAt = '2026-09-29T22:30:00Z'
  const details = opportunityDetails({ received_at: receivedAt, extracted_information: detected({ classification: classification(), estimated_value: null, currency: '', expected_award_date: '', scope_type: '', scope_summary: '', deadline_date: '', due_date: '' }) })
  const saved = { ...message(), ...details, id: 'saved-minimal', status: 'received', attachments: [] }
  const path = mode === 'saved' ? '/api/v1/sales/email-intakes/saved-minimal/convert-to-opportunity/' : conversionPath('shared-1')
  const state = await prepare(page, { messages: listing([message()]), clients: paginated([canonicalClient()]), details,
    ...(mode === 'saved' ? { view: 'imported', imported: paginated([saved]) } : {}),
    allowConversion: true, allowedConversionPath: path, conversion: { created: true, opportunity: { id: 'created' }, ...(mode === 'saved' ? { intake: { ...saved, status: 'converted' } } : {}) } })
  const review = page.getByRole('complementary', { name: 'Email review', exact: true })
  await review.getByRole('button', { name: 'Confirm classification', exact: true }).click()
  await review.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
  await dialog.getByLabel('Client', { exact: true }).selectOption('client-one')
  await expect(dialog.getByLabel('Open date', { exact: true })).toHaveValue('2026-09-30')
  await expect(dialog.getByLabel('Owner', { exact: true })).toHaveValue('11')
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const write = state.requests.find(item => item.method === 'POST')
  expect(write.body).toMatchObject({ open_date: '2026-09-30', owner: '11', source_token: 'synthetic-source-token-1', classification_confirmed: true, estimated_value: null, currency: '', expected_close_date: null, submission_due_date: null, scope_type: '' })
  expect(write.body.registration_request_id).toBeUndefined()
  expect(state.unexpected).toEqual([])
})

for (const reviewedCode of ['eoi', 'tender_opportunity']) test(`EOI due date does not become a proposal deadline with ${reviewedCode} classification`, async ({ page }) => {
  const subject = 'Expression of interest for the synthetic package'
  const details = opportunityDetails({ subject, extracted_information: detected({ title: subject, request_type_code: 'EOI', due_date: '2026-10-10', deadline_date: '2026-10-10', classification: classification(reviewedCode) }) })
  await prepare(page, { messages: listing([message({ subject })]), details, clients: paginated([canonicalClient()]) })
  const review = page.getByRole('complementary', { name: 'Email review', exact: true })
  await review.getByRole('button', { name: 'Confirm classification', exact: true }).click()
  await review.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
  await expect(dialog.getByLabel('Opportunity type', { exact: true })).toHaveValue(reviewedCode === 'eoi' ? 'eoi' : 'tender')
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('')
  await dialog.getByLabel('Proposal deadline', { exact: true }).fill('2026-10-12')
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('2026-10-12')
})

test('saved email owner rejection is actionable and keeps entered registration details for correction', async ({ page }) => {
  const saved = { ...opportunityDetails({ extracted_information: detected({ classification: classification() }) }), id: 'saved-owner', status: 'received', attachments: [] }
  const state = await prepare(page, { view: 'imported', imported: paginated([saved]), clients: paginated([canonicalClient()]), allowConversion: true,
    allowedConversionPath: '/api/v1/sales/email-intakes/saved-owner/convert-to-opportunity/', conversionStatus: 400, conversion: { owner: ['This owner is no longer active. Select another owner.'] } })
  const review = page.getByRole('complementary', { name: 'Email review', exact: true })
  await review.getByRole('button', { name: 'Confirm classification', exact: true }).click()
  await review.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
  await dialog.getByLabel('Client', { exact: true }).selectOption('client-one')
  await dialog.getByLabel('Opportunity name', { exact: true }).fill('Retained title after owner rejection')
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(dialog.getByLabel('Owner', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByRole('alert')).toContainText('owner is no longer active')
  await expect(dialog.getByLabel('Opportunity name', { exact: true })).toHaveValue('Retained title after owner rejection')
  state.conversionStatus = 201
  state.conversion = { intake: { ...saved, status: 'converted' }, opportunity: { id: 'created-owner-corrected' }, created: true }
  await dialog.getByLabel('Owner', { exact: true }).selectOption('12')
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(state.requests.filter(item => item.method === 'POST').at(-1).body).toMatchObject({ owner: '12', deal_name: 'Retained title after owner rejection' })
  expect(state.errors).toEqual([])
})
