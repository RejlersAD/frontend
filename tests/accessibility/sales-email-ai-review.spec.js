import { test, expect } from '@playwright/test'
import {
  prepare, message, listing, paginated, canonicalClient, opportunityDetails,
  conversionPath, assertReadOnly, assertExplicitConversionOnly,
} from '../fixtures/sales-email-api-fixture.js'

const subject = 'Reminder for Tender - Tender Code Tender_38669 on OQ Tawreed Portal'
const body = 'This is to remind you to respond to Tender Code Tender_38669, published by OQ regarding 6000062192 - Once Off Procurement - PR 70059386 - CHEM;N;PROPYL ALCHI;LAB RGNT,LQD,DRM.\nThe deadline for submitting a submission has been set to:\nDate: 2 Oct, 2026\nTime: 01:59 (Gulf Standard Time)'
const sourceIds = ['selected-reminder']
const evidenceStatus = (reason, status = 'detected') => ({ status, reason, source_ids: sourceIds })
const aiConfidence = (reason, overrides = {}) => ({ level: 'medium', method: 'ai_evidence_v1', reason, source_ids: sourceIds, ...overrides })
const information = (overrides = {}) => ({
  detection_version: 2, title: subject, customer_name: 'OQ', organization_name: 'OQ',
  customer_domain: 'oq.com', submission_date: '', due_date: '2026-10-02',
  tender_reference: 'Tender_38669', estimated_value: '', currency: '', expected_award_date: '', scope_type: '',
  scope_summary: 'Once Off Procurement - PR 70059386 - CHEM;N;PROPYL ALCHI;LAB RGNT,LQD,DRM',
  evidence: { customer_name: 'published by OQ', due_date: 'Date: 2 Oct, 2026\nTime: 01:59 (Gulf Standard Time)' },
  field_sources: { customer_name: sourceIds, due_date: sourceIds }, warnings: [],
  ai_review: { version: 1, status: 'validated', method: 'ai_evidence_v1' },
  classification: {
    version: 1, status: 'classified', code: 'tender_opportunity', needs_review: true,
    confidence: aiConfidence('AI identifies a tender deadline reminder from the cited message.'),
    evidence: [{ source_id: sourceIds[0], location: 'subject', excerpt: subject }], alternatives: [],
  },
  intelligence: {
    version: 1, customer_name: evidenceStatus('The message explicitly names OQ.'),
    customer_domain: evidenceStatus('The sender domain is oq.com.'),
    submission_date: evidenceStatus('The original invitation is unavailable.', 'requires_verification'),
    deadline_review: evidenceStatus('Review the stated date and 01:59 Gulf Standard Time.', 'requires_verification'),
    opportunity_detection: { ...evidenceStatus('A reminder references the tender; review before creation.', 'follow_up'), needs_review: true },
    field_confidence: { customer_name: aiConfidence('The source explicitly names OQ.'), due_date: aiConfidence('The labelled deadline is supported by the quoted source.') },
    entities: [{ entity_type: 'organization', value: 'OQ', evidence: 'published by OQ', source_ids: sourceIds }],
  },
  analysis: {
    version: 1, message_kind: 'follow_up', summary: 'OQ reminds suppliers to submit Tender_38669 before the stated deadline.',
    key_points: [
      { label: 'Tender code', value: 'Tender_38669', source_ids: sourceIds },
      { label: 'Procurement reference', value: '6000062192', source_ids: sourceIds },
      { label: 'Deadline stated in email', value: '02 October 2026, 01:59 Gulf Standard Time', source_ids: sourceIds },
    ],
    sources: [{ id: sourceIds[0], label: 'Selected tender reminder', origin: 'message', subject, excerpt: body }],
    coverage: { status: 'selected_only', messages_reviewed: 1, segments_reviewed: 1, original_identified: false },
    requested_actions: [], suggested_actions: [], limitations: ['Current portal status has not been verified.'],
  }, ...overrides,
})
const client = canonicalClient({ company_name: 'OQ', legal_name: 'OQ' })
const review = page => page.getByRole('complementary', { name: 'Email review', exact: true })
const openMessageDetails = async page => {
  const options = page.locator('.sales-email-preview-header details.sales-email-message-options')
  await expect(options).toHaveCount(1)
  if (await options.getAttribute('open') === null) await options.locator(':scope > summary').click()
}

const dueDateCell = page => review(page).locator('.sales-email-review__facts > div').filter({ has: page.locator('dt').filter({ hasText: /^Due date$/ }) }).locator('dd')
const create = scope => scope.getByRole('button', { name: 'Create opportunity', exact: true })
const confirm = scope => scope.getByRole('button', { name: 'Confirm classification', exact: true })
const form = page => page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
const row = page => page.getByRole('button', { name: `Open email: ${subject}`, exact: true })
const ready = async (page, options = {}) => {
  const state = await prepare(page, {
    messages: listing([message({ subject })]), clients: paginated([client]),
    details: opportunityDetails({ subject, body_text: body, extracted_information: information() }), ...options,
  })
  await row(page).click()
  await expect(review(page)).toBeVisible()
  return state
}
const openForm = async page => {
  await expect(create(review(page))).toBeDisabled()
  await confirm(review(page)).click()
  await create(review(page)).click()
  await expect(form(page)).toBeVisible()
  return form(page)
}

test('AI tender reminder populates the existing panel and creates only after missing business fields are reviewed', async ({ page }, testInfo) => {
  const state = await ready(page, { allowConversion: true })
  await expect(review(page).getByRole('combobox', { name: 'Email type', exact: true })).toHaveValue('tender_opportunity')
  await expect(review(page)).toContainText('OQ')
  await expect(dueDateCell(page)).toHaveText('2026-10-02 · Requires verification')
  await expect(review(page)).toContainText('Existing request follow-up')
  await review(page).screenshot({ path: testInfo.outputPath('oq-deadline-review.png') })
  await review(page).getByText('Why this classification', { exact: true }).click()
  await expect(review(page)).toContainText('Confidence: Medium')
  await expect(review(page)).toContainText('AI identifies a tender deadline reminder')
  await review(page).locator('.sales-email-review__disclosure > summary').filter({ hasText: /^Source evidence$/ }).click()
  await expect(review(page)).toContainText('02 October 2026, 01:59 Gulf Standard Time')
  const preview = page.getByRole('region', { name: 'Email preview', exact: true })
  await preview.getByRole('tab', { name: 'Extracted details', exact: true }).click()
  const classification = preview.getByRole('region', { name: 'Email classification', exact: true })
  await expect(classification.getByText('Medium', { exact: true })).toBeVisible()
  await preview.getByText('Field confidence', { exact: true }).click()
  await expect(preview).toContainText('Confidence includes AI suggestions checked against cited evidence.')
  const dialog = await openForm(page)
  await expect(dialog.getByLabel('Client', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Client reference', { exact: true })).toHaveValue('Tender_38669')
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('2026-10-02')
  for (const label of ['Estimated value', 'Currency', 'Expected award date', 'Scope type']) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveValue('')
  }
  await dialog.getByLabel('Client', { exact: true }).selectOption('client-one')
  await create(dialog).click()
  expect(state.requests.filter(request => request.method === 'POST')).toHaveLength(0)
  await dialog.getByLabel('Estimated value', { exact: true }).fill('12500.50')
  await dialog.getByLabel('Currency', { exact: true }).selectOption('USD')
  await dialog.getByLabel('Expected award date', { exact: true }).fill('2026-11-02')
  await dialog.getByLabel('Scope type', { exact: true }).selectOption('other')
  await create(dialog).click()
  await expect(dialog).toHaveCount(0)
  const writes = state.requests.filter(request => request.method === 'POST')
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ path: conversionPath('shared-1'), body: {
    classification_code: 'tender_opportunity', classification_confirmed: true,
    source_token: 'synthetic-source-token-1', client: 'client-one', deal_name: subject,
    client_reference: 'Tender_38669', estimated_value: '12500.50', currency: 'USD',
    expected_close_date: '2026-11-02', submission_due_date: '2026-10-02', scope_type: 'other',
    description: information().scope_summary,
  } })
  assertExplicitConversionOnly(state)
})

for (const [name, value, status, references, label] of [
  ['missing date', '', 'requires_verification', sourceIds, 'Requires verification'],
  ['ambiguous date with a stale value', '2026-10-02', 'ambiguous', sourceIds, 'Requires review'],
  ['unknown source ID', '2026-10-02', 'requires_verification', ['missing-source'], 'Unavailable'],
  ['missing source evidence', '2026-10-02', 'requires_verification', [], 'Requires verification'],
  ['invalid calendar date', '2026-02-30', 'requires_verification', sourceIds, 'Requires verification'],
]) {
  test(`AI deadline ${name} remains unresolved in the existing review row`, async ({ page }) => {
    const extracted = information({ due_date: value })
    extracted.intelligence.deadline_review = { ...evidenceStatus('Verify the source deadline before use.', status), source_ids: references }
    const state = await ready(page, { details: opportunityDetails({ subject, extracted_information: extracted }) })
    await expect(dueDateCell(page)).toHaveText(label)
    if (value) await expect(dueDateCell(page)).not.toContainText(value)
    await expect(create(review(page))).toBeDisabled()
    await expect(confirm(review(page))).toBeEnabled()
    assertReadOnly(state)
  })
}

test('AI prefilled opportunity fields retain user changes and canonical client after conversion failure and retry', async ({ page }) => {
  const extracted = information({ estimated_value: '99000.25', currency: 'EUR', expected_award_date: '2026-11-30', scope_type: 'feed' })
  const state = await ready(page, {
    details: opportunityDetails({ subject, extracted_information: extracted }), allowConversion: true,
    conversionStatus: 409, conversion: { code: 'email_tender_already_exists', detail: 'An opportunity already uses this tender reference.' },
  })
  const dialog = await openForm(page)
  await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('99000.25')
  await expect(dialog.getByLabel('Currency', { exact: true })).toHaveValue('EUR')
  await expect(dialog.getByLabel('Expected award date', { exact: true })).toHaveValue('2026-11-30')
  await expect(dialog.getByLabel('Scope type', { exact: true })).toHaveValue('feed')
  await dialog.getByLabel('Client', { exact: true }).selectOption('client-one')
  await dialog.getByLabel('Opportunity name', { exact: true }).fill('Reviewed tender package')
  await dialog.getByLabel('Scope summary', { exact: true }).fill('Reviewer corrected scope')
  await dialog.getByLabel('Estimated value', { exact: true }).fill('100000.75')
  await create(dialog).click()
  await expect(dialog.getByRole('alert')).toContainText('Your entries have been kept')
  await expect(dialog.getByRole('button', { name: 'Reload email details', exact: true })).toHaveCount(0)
  await expect(create(dialog)).toBeEnabled()
  await expect(dialog.getByLabel('Opportunity name', { exact: true })).toHaveValue('Reviewed tender package')
  await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('100000.75')
  await expect(dialog.getByLabel('Scope summary', { exact: true })).toHaveValue('Reviewer corrected scope')
  await expect(dialog.getByLabel('Client', { exact: true })).toHaveValue('client-one')
  state.conversionStatus = 201
  state.conversion = { opportunity: { id: 'reviewed-ai-opportunity' }, created: true }
  await create(dialog).click()
  await expect(dialog).toHaveCount(0)
  const writes = state.requests.filter(request => request.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[1].body).toMatchObject({ deal_name: 'Reviewed tender package', estimated_value: '100000.75', description: 'Reviewer corrected scope', client: 'client-one' })
  assertExplicitConversionOnly(state)
})

test('unsupported AI confidence cannot become a displayed certainty or an automatic approval', async ({ page }) => {
  const extracted = information()
  extracted.classification.confidence = aiConfidence('99 percent guaranteed', { level: 0.99 })
  extracted.intelligence.field_confidence.customer_name = aiConfidence('Unsupported certainty', { method: 'unknown_confidence' })
  const state = await ready(page, { details: opportunityDetails({ subject, extracted_information: extracted }) })
  await review(page).getByText('Why this classification', { exact: true }).click()
  await expect(review(page)).toContainText('Confidence: Unavailable')
  await expect(review(page)).not.toContainText('99 percent guaranteed')
  const preview = page.getByRole('region', { name: 'Email preview', exact: true })
  await preview.getByRole('tab', { name: 'Extracted details', exact: true }).click()
  await preview.getByText('Field confidence', { exact: true }).click()
  await expect(preview).not.toContainText('Unsupported certainty')
  await expect(create(review(page))).toBeDisabled()
  assertReadOnly(state)
})

for (const conflict of ['stale', 'duplicate']) {
  test(`saved AI detail uses its reviewed token and preserves form entries after ${conflict} conflict`, async ({ page }) => {
    const record = {
      ...message({ id: `saved-ai-${conflict}`, subject }), status: 'received', attachments: [], can_create_opportunity: true,
      extracted_information: information({ classification: null }),
    }
    const detail = {
      ...record, source_token: 'saved-ai-reviewed-token-1',
      extracted_information: information({ estimated_value: '50000.25', currency: 'USD', scope_type: 'other', expected_award_date: '2026-12-01' }),
    }
    let releaseDetail
    const detailReady = new Promise(resolve => { releaseDetail = resolve })
    let detailReads = 0
    const savedPath = `/api/v1/sales/email-intakes/${record.id}/convert-to-opportunity/`
    const state = await prepare(page, {
      view: 'imported', imported: paginated([record]), clients: paginated([client]),
      importedDetailHandler: async () => {
        detailReads += 1
        if (detailReads === 1) await detailReady
        return { body: structuredClone(detail) }
      },
      allowConversion: true, allowedConversionPath: savedPath,
      conversionStatus: conflict === 'stale' ? 410 : 409,
      conversion: conflict === 'stale' ? { detail: 'Email review has expired.' } : { code: 'email_tender_already_exists', detail: 'An opportunity already exists for this tender.' },
    })
    await expect.poll(() => detailReads).toBe(1)
    await expect(confirm(review(page))).toBeDisabled()
    await openMessageDetails(page)
    await expect(page.getByRole('button', { name: 'Start review', exact: true })).toBeDisabled()
    releaseDetail()
    await expect(review(page).getByRole('combobox', { name: 'Email type', exact: true })).toHaveValue('tender_opportunity')
    await expect(dueDateCell(page)).toHaveText('2026-10-02 · Requires verification')
    const dialog = await openForm(page)
    await dialog.getByLabel('Client', { exact: true }).selectOption('client-one')
    await dialog.getByLabel('Opportunity name', { exact: true }).fill('Human reviewed saved tender')
    await dialog.getByLabel('Estimated value', { exact: true }).fill('51000.75')
    await dialog.getByLabel('Scope summary', { exact: true }).fill('Human reviewed scope remains')
    await create(dialog).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    const firstWrite = state.requests.find(request => request.method === 'POST')
    expect(firstWrite).toMatchObject({ path: savedPath, body: { source_token: 'saved-ai-reviewed-token-1', client: 'client-one', classification_confirmed: true } })
    if (conflict === 'stale') {
      await expect(create(dialog)).toBeDisabled()
      detail.source_token = 'saved-ai-reviewed-token-2'
      detail.extracted_information.title = 'Changed AI suggestion must not replace manual title'
      await dialog.getByRole('button', { name: 'Reload email details', exact: true }).click()
      await expect.poll(() => detailReads).toBe(2)
      await expect(confirm(dialog)).toBeEnabled()
      await expect(create(dialog)).toBeDisabled()
      await confirm(dialog).click()
    } else {
      await expect(dialog.getByRole('alert')).toContainText('An opportunity already exists for this tender.')
      await expect(dialog.getByRole('button', { name: 'Reload email details', exact: true })).toHaveCount(0)
      expect(detailReads).toBe(1)
    }
    await expect(create(dialog)).toBeEnabled()
    await expect(dialog.getByLabel('Opportunity name', { exact: true })).toHaveValue('Human reviewed saved tender')
    await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('51000.75')
    await expect(dialog.getByLabel('Scope summary', { exact: true })).toHaveValue('Human reviewed scope remains')
    await expect(dialog.getByLabel('Client', { exact: true })).toHaveValue('client-one')
    state.conversionStatus = 201
    state.conversion = { intake: { ...detail, status: 'converted' }, opportunity: { id: 'saved-ai-created' }, created: true }
    await create(dialog).click()
    await expect(dialog).toHaveCount(0)
    const writes = state.requests.filter(request => request.method === 'POST')
    expect(writes).toHaveLength(2)
    expect(writes[1].body).toMatchObject({
      source_token: detail.source_token, deal_name: 'Human reviewed saved tender', estimated_value: '51000.75',
      description: 'Human reviewed scope remains', client: 'client-one', classification_code: 'tender_opportunity', classification_confirmed: true,
    })
    expect(state.errors).toEqual([])
    expect(state.unexpected).toEqual([])
  })
}

test('denied saved detail clears cached AI suggestions and cannot create an opportunity', async ({ page }) => {
  const record = { ...message({ id: 'saved-ai-denied', subject }), status: 'received', can_create_opportunity: true, extracted_information: information(), attachments: [] }
  const state = await prepare(page, {
    view: 'imported', imported: paginated([record]),
    importedDetailHandler: () => ({ status: 403, body: { detail: 'No longer permitted.' } }),
  })
  await expect(page.getByText('You do not have access to this saved email.', { exact: true })).toBeVisible()
  await expect(review(page)).toHaveCount(0)
  await expect(form(page)).toHaveCount(0)
  await expect(page.getByText('Tender_38669', { exact: true })).toHaveCount(0)
  assertReadOnly(state)
})
