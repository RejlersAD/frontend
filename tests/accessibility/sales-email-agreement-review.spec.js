import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  prepare, message, listing, paginated, canonicalClient, opportunityDetails,
  assertReadOnly, assertExplicitConversionOnly,
} from '../fixtures/sales-email-api-fixture.js'

// Synthetic correspondence follows the reported wording; it never accesses a mailbox.
const subject = 'RE: Q-101752 Fw: Action Required: WO Agreement 4700030672 - Replacement of Transformers, HVLV Switchgear of Substation-7 and Outstation-10 in Das Island'
const request = 'Please return the signed agreement, power of attorney and trade license no later than Friday 25 September 2026, at 11:00 am (UAE time).'
const currentId = 'selected-reply', quotedId = 'quoted-agreement-request'
const stateWithEvidence = (status, reason, sourceId = quotedId) => ({ status, reason, source_ids: [sourceId] })
const actionDeadline = (overrides = {}) => ({ kind: 'agreement_return', date: '2026-09-25', time: '11:00', timezone: 'UAE time', source_ids: [quotedId], evidence: request, status: 'requires_verification', ...overrides })
const information = (overrides = {}) => ({
  detection_version: 2, title: subject, customer_name: 'ADNOC', organization_name: 'ADNOC',
  due_date: '', deadline_date: '', tender_reference: '', request_type_code: '',
  agreement_reference: '4700030672', correspondence_reference: 'Q-101752',
  action_deadlines: [actionDeadline()],
  estimated_value: '', currency: '', expected_award_date: '', scope_type: '',
  scope_summary: 'Replacement of Transformers, HVLV Switchgear of Substation-7 and Outstation-10 in Das Island',
  ai_review: { version: 1, status: 'validated' },
  evidence: { customer_name: 'Customer: ADNOC', agreement_reference: 'WO Agreement 4700030672', correspondence_reference: 'RE: Q-101752 Fw: Action Required' },
  field_sources: { customer_name: [quotedId], agreement_reference: [quotedId], correspondence_reference: [currentId] }, warnings: [],
  classification: { version: 1, status: 'classified', code: 'general_communication', needs_review: true,
    confidence: { level: 'medium', method: 'rule_evidence_v1', reason: 'The selected reply reports that a response was made.' },
    evidence: [{ source_id: currentId, location: 'body', excerpt: 'This has been responded.' }], alternatives: [] },
  intelligence: { version: 1,
    customer_name: stateWithEvidence('detected', 'ADNOC is named in the quoted request.'),
    deadline_review: stateWithEvidence('not_detected', 'No proposal deadline is established.'),
    opportunity_detection: { ...stateWithEvidence('follow_up', 'Agreement correspondence follows an existing request.'), needs_review: true },
  },
  analysis: { version: 1, message_kind: 'general_communication',
    summary: 'The selected reply reports a response. The quoted message requests agreement documents; their completion is not verified.',
    selected_source_id: currentId,
    sources: [
      { id: currentId, origin: 'message', is_selected: true, thread_role: 'reply', label: 'Selected reply', subject, excerpt: 'This has been responded.' },
      { id: quotedId, origin: 'quoted', label: 'Quoted agreement request', subject: 'Action Required: WO Agreement 4700030672', excerpt: request },
    ],
    key_points: [{ label: 'WO agreement reference', value: '4700030672', source_ids: [quotedId] }, { label: 'Document return deadline', value: '25 September 2026, 11:00 UAE time', source_ids: [quotedId] }],
    requested_actions: [{ text: request, source_ids: [quotedId] }], suggested_actions: [],
    coverage: { status: 'selected_only', messages_reviewed: 1, segments_reviewed: 2, original_identified: false }, limitations: [],
  }, ...overrides,
})
const detail = (extracted = information()) => opportunityDetails({ subject, body_text: `This has been responded.\n\n${request}`, extracted_information: extracted })
const review = page => page.getByRole('complementary', { name: 'Email review', exact: true })
const preview = page => page.getByRole('region', { name: 'Email preview', exact: true })
const facts = page => preview(page).getByRole('region', { name: 'Detected information', exact: true })
const field = (scope, name) => scope.locator(':scope > dl > div > dt, .sales-email-context__facts > div > dt').filter({ hasText: new RegExp(`^${name}$`) }).locator('xpath=following-sibling::dd[1]')
const form = page => page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
const confirm = scope => scope.getByRole('button', { name: 'Confirm classification', exact: true })
const create = scope => scope.getByRole('button', { name: 'Create opportunity', exact: true })
const client = canonicalClient({ company_name: 'ADNOC', legal_name: 'ADNOC' })
const ready = async (page, overrides = {}) => {
  const state = await prepare(page, { messages: listing([message({ subject })]), details: detail(), clients: paginated([client]), ...overrides })
  await page.getByRole('button', { name: `Open email: ${subject}`, exact: true }).click()
  await expect(review(page)).toBeVisible()
  return state
}
const extractedDetails = async page => {
  await preview(page).getByRole('tab', { name: 'Extracted details', exact: true }).click()
  return facts(page)
}

test('quoted agreement deadline and references appear in existing fields without changing the latest reply classification', async ({ page }, testInfo) => {
  const state = await ready(page)
  await expect(review(page).getByRole('combobox', { name: 'Suggested type', exact: true })).toHaveValue('general_communication')
  await expect(field(review(page), 'Action deadline')).toHaveText('2026-09-25 · 11:00 UAE time · Quoted · Requires verification')
  await expect(field(review(page), 'Opportunity')).toHaveText('Existing request follow-up')
  await expect(create(review(page))).toBeDisabled()
  await review(page).screenshot({ path: testInfo.outputPath('agreement-deadline-review.png') })
  const detected = await extractedDetails(page)
  await expect(field(detected, 'WO agreement reference')).toHaveText('4700030672')
  await expect(field(detected, 'Correspondence reference')).toHaveText('Q-101752 · Requires review')
  await expect(field(detected, 'Due Date')).toHaveText('Not detected')
  await expect(field(detected, 'Type of Request')).toHaveText('Not detected')
  const evidence = detected.locator(':scope > details')
  await evidence.locator(':scope > summary').click()
  await expect(evidence).toContainText(request)
  await expect(evidence).toContainText('WO Agreement 4700030672')
  await expect(evidence).toContainText('RE: Q-101752 Fw: Action Required')
  assertReadOnly(state)
})

test('saved agreement detail shows the same typed quoted deadline without a mailbox write', async ({ page }) => {
  const record = { ...message({ id: 'saved-agreement', subject }), status: 'received', attachments: [], source_token: 'saved-source', can_create_opportunity: true, extracted_information: information() }
  const state = await prepare(page, { view: 'imported', imported: paginated([record]) })
  await expect(field(review(page), 'Action deadline')).toContainText('2026-09-25 · 11:00 UAE time · Quoted')
  await expect(create(review(page))).toBeDisabled()
  assertReadOnly(state)
})

test('agreement action deadline never prefills proposal fields and source reload preserves manually reviewed input', async ({ page }) => {
  const state = await ready(page, { allowConversion: true, conversionStatus: 410, conversion: { detail: 'Email review has expired.' } })
  await confirm(review(page)).click()
  await create(review(page)).click()
  const dialog = form(page)
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Client reference', { exact: true })).toHaveValue('')
  await dialog.getByLabel('Client', { exact: true }).selectOption('client-one')
  await dialog.getByLabel('Estimated value', { exact: true }).fill('12345.67')
  await dialog.getByLabel('Currency', { exact: true }).selectOption('AED')
  await dialog.getByLabel('Expected award date', { exact: true }).fill('2026-12-01')
  await dialog.getByLabel('Scope type', { exact: true }).selectOption('other')
  await dialog.getByLabel('Client reference', { exact: true }).fill('Reviewed commercial reference')
  await dialog.getByLabel('Scope summary', { exact: true }).fill('My reviewed scope remains')
  await create(dialog).click()
  await expect(dialog.getByRole('alert')).toBeVisible()
  const writes = state.requests.filter(request => request.method === 'POST')
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toMatchObject({ submission_due_date: null, client_reference: 'Reviewed commercial reference' })
  await dialog.getByLabel('Proposal deadline', { exact: true }).fill('2026-12-10')
  state.details = { ...detail(information({ action_deadlines: [actionDeadline({ date: '2026-09-26' })] })), source_token: 'changed-agreement-source' }
  await dialog.getByRole('button', { name: 'Reload email details', exact: true }).click()
  await expect(confirm(dialog)).toBeEnabled()
  await expect(create(dialog)).toBeDisabled()
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('2026-12-10')
  await expect(dialog.getByLabel('Client reference', { exact: true })).toHaveValue('Reviewed commercial reference')
  await expect(dialog.getByLabel('Scope summary', { exact: true })).toHaveValue('My reviewed scope remains')
  await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('12345.67')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  assertExplicitConversionOnly(state)
})

test('a supported proposal deadline remains the compact due date when agreement context is also present', async ({ page }) => {
  const extracted = information({ due_date: '2026-10-02', deadline_date: '2026-10-02' })
  extracted.intelligence.deadline_review = stateWithEvidence('requires_verification', 'Verify the proposal deadline.', currentId)
  const state = await ready(page, { details: detail(extracted) })
  await expect(field(review(page), 'Due date')).toHaveText('2026-10-02 · Requires verification')
  await expect(field(review(page), 'Action deadline')).toHaveCount(0)
  await expect(field(await extractedDetails(page), 'Action deadline')).toContainText('2026-09-25')
  assertReadOnly(state)
})

for (const [name, update] of [
  ['invalid calendar date', { date: '2026-02-30' }],
  ['invalid clock', { time: '25:99' }],
  ['zone without clock', { time: '' }],
  ['missing quoted source', { source_ids: ['missing-source'] }],
  ['missing source evidence', { evidence: '' }],
  ['unsupported completion status', { status: 'completed' }],
]) {
  test(`agreement ${name} does not promote an unverified deadline value`, async ({ page }) => {
    const state = await ready(page, { details: detail(information({ action_deadlines: [actionDeadline(update)] })) })
    await expect(field(review(page), 'Action deadline')).toHaveText('Unavailable')
    await expect(field(await extractedDetails(page), 'Action deadline')).toHaveText('Unavailable')
    await expect(create(review(page))).toBeDisabled()
    assertReadOnly(state)
  })
}

test('competing quoted deadlines require review instead of selecting the first date', async ({ page }) => {
  const state = await ready(page, { details: detail(information({ action_deadlines: [actionDeadline(), actionDeadline({ date: '2026-09-26', evidence: 'Return the agreement by 26 September 2026, 11:00 UAE time.' })] })) })
  await expect(field(review(page), 'Action deadline')).toHaveText('Requires review')
  await expect(field(await extractedDetails(page), 'Action deadline')).toHaveText('Requires review')
  assertReadOnly(state)
})

for (const [name, changes] of [['outgoing source', { direction: 'outgoing' }], ['unsent draft', { thread_role: 'draft' }]]) {
  test(`agreement ${name} cannot establish an incoming action deadline or reference`, async ({ page }) => {
    const extracted = information()
    Object.assign(extracted.analysis.sources[1], changes)
    const state = await ready(page, { details: detail(extracted) })
    await expect(field(review(page), 'Action deadline')).toHaveText('Unavailable')
    await expect(field(await extractedDetails(page), 'WO agreement reference')).toHaveCount(0)
    assertReadOnly(state)
  })
}

test('repeated identical requests keep one deadline and duplicate source identities cannot establish a reference', async ({ page }) => {
  const extracted = information({ action_deadlines: [actionDeadline(), actionDeadline()] })
  extracted.field_sources.correspondence_reference = ['missing-source']
  const state = await ready(page, { details: detail(extracted) })
  await expect(field(review(page), 'Action deadline')).toContainText('2026-09-25')
  await expect(field(await extractedDetails(page), 'Correspondence reference')).toHaveCount(0)
  extracted.analysis.sources.push({ ...extracted.analysis.sources[1] })
  state.details = detail(extracted)
  await page.getByRole('region', { name: 'Shared mailbox messages', exact: true }).getByRole('button', { name: 'Refresh emails', exact: true }).click()
  await expect(field(review(page), 'Action deadline')).toHaveText('Unavailable')
  await expect(field(await extractedDetails(page), 'WO agreement reference')).toHaveCount(0)
  assertReadOnly(state)
})

test('typed action evidence stays literal and usable at a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 })
  const hostile = '<img src="https://untrusted.example.test/beacon" onerror="window.agreementInjected=true">'
  const extracted = information({ action_deadlines: [actionDeadline({ evidence: `${request}\n${hostile}` })] })
  const state = await ready(page, { details: detail(extracted) })
  const detected = await extractedDetails(page)
  const toggle = detected.locator(':scope > details > summary')
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(detected).toContainText(hostile)
  await expect(detected.locator('img, iframe, script')).toHaveCount(0)
  expect(await page.evaluate(() => window.agreementInjected)).toBeUndefined()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  const scan = await new AxeBuilder({ page }).include('section[aria-label="Detected information"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => item.id)).toEqual([])
  await detected.locator(':scope > dl').screenshot({ path: testInfo.outputPath('agreement-extracted-mobile.png') })
  assertReadOnly(state)
})
