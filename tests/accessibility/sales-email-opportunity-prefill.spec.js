import { test, expect } from '@playwright/test'
import { prepare, message, listing, paginated, canonicalClient, opportunityDetails, conversionPath, assertReadOnly } from '../fixtures/sales-email-api-fixture.js'

// Synthetic complete invitation: the real reminder omits these commercial facts.
const subject = 'Invitation: OQ engineering package SYN-2026-42'
const sourceId = 'selected-invitation'
const body = 'Customer: OQ. Reference: SYN-2026-42. Estimated value: OMR 850000.50. Expected award date: 30 November 2026. Proposal deadline: 2 October 2026. Scope: FEED engineering for the synthetic pump package.'
const client = canonicalClient({ company_name: 'OQ', legal_name: 'OQ' })
const other = canonicalClient({ id: 'client-two', company_name: 'Reviewed client', legal_name: 'Reviewed client' })
const candidate = (record = client) => ({ id: record.id, company_name: record.company_name, client_code: `CLI-${record.id}`, matched_fields: ['company_name'], status: 'active', verification_status: 'verified', new_proposals_permitted: true })
const information = (status = 'matched', name = 'OQ') => ({
  detection_version: 2, title: subject, customer_name: name, organization_name: name,
  tender_reference: 'SYN-2026-42', estimated_value: '850000.50', currency: 'OMR',
  expected_award_date: '2026-11-30', due_date: '2026-10-02', scope_type: 'feed',
  scope_summary: 'FEED engineering for the synthetic pump package.',
  ai_review: { version: 1, status: 'validated', method: 'ai_evidence_v1' },
  evidence: { customer_name: `Customer: ${name}`, currency: 'OMR 850000.50' },
  field_sources: { customer_name: [sourceId], currency: [sourceId] },
  classification: {
    version: 1, status: 'classified', code: 'tender_opportunity', needs_review: true,
    confidence: { level: 'medium', method: 'ai_evidence_v1', reason: 'The message explicitly invites a tender response.', source_ids: [sourceId] },
    evidence: [{ source_id: sourceId, location: 'subject', excerpt: subject }], alternatives: [],
  },
  customer_match: {
    version: 1, status, method: 'exact_name_v1', detected_name: name, needs_review: true,
    evidence: { excerpt: `Customer: ${name}`, source_ids: [sourceId] },
    candidates: status === 'matched' ? [candidate()] : [], has_more: false,
  },
  analysis: {
    version: 1, message_kind: 'original', summary: 'Review the synthetic engineering invitation.',
    key_points: [], requested_actions: [], suggested_actions: [], limitations: [],
    sources: [{ id: sourceId, label: 'Selected invitation', origin: 'message', subject, excerpt: body.replace('Customer: OQ', `Customer: ${name}`) }],
    coverage: { status: 'selected_only', messages_reviewed: 1, segments_reviewed: 1, original_identified: true },
  },
})
const review = page => page.getByRole('complementary', { name: 'Email review', exact: true })
const form = page => page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
const create = scope => scope.getByRole('button', { name: 'Create opportunity', exact: true })
const confirm = scope => scope.getByRole('button', { name: 'Confirm classification', exact: true })
const field = (dialog, name) => dialog.getByLabel(name, { exact: true })
const writes = state => state.requests.filter(request => request.method === 'POST')
const setup = async (page, mode, options = {}) => {
  const details = opportunityDetails({ subject, body_text: body, can_create_client: true, extracted_information: information(), ...options.details })
  const saved = { ...message({ id: 'saved-prefill', subject }), ...details, id: 'saved-prefill', status: 'received', attachments: [] }
  const allowedConversionPath = mode === 'saved' ? '/api/v1/sales/email-intakes/saved-prefill/convert-to-opportunity/' : conversionPath('shared-1')
  const state = await prepare(page, {
    messages: listing([message({ subject })]), clients: paginated([client, other]), details,
    ...(mode === 'saved' ? { view: 'imported', imported: paginated([saved]), conversion: { intake: { ...saved, status: 'converted' }, opportunity: { id: 'saved-prefill-created' }, created: true } } : {}),
    ...options, allowedConversionPath,
  })
  if (mode === 'live') await page.getByRole('button', { name: `Open email: ${subject}`, exact: true }).click()
  await expect(confirm(review(page))).toBeEnabled()
  await expect(create(review(page))).toBeDisabled()
  await confirm(review(page)).click()
  await create(review(page)).click()
  await expect(form(page)).toBeVisible()
  return { state, dialog: form(page), saved, path: allowedConversionPath }
}
const assertFields = async dialog => {
  for (const [label, value] of Object.entries({
    'Client reference': 'SYN-2026-42', 'Estimated value': '850000.50', Currency: 'OMR',
    'Expected award date': '2026-11-30', 'Proposal deadline': '2026-10-02', 'Scope type': 'feed',
    'Scope summary': 'FEED engineering for the synthetic pump package.',
  })) await expect(field(dialog, label)).toHaveValue(value)
}
const assertWrites = (state, path) => {
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
  expect(state.requests.every(request => request.method === 'GET' || (request.method === 'POST' && request.path === path))).toBe(true)
}
const refreshDetails = (state, mode, changes) => {
  if (mode === 'saved') Object.assign(state.imported.results[0], changes)
  else Object.assign(state.details, changes)
}
const succeed = (state, mode, id) => {
  state.conversionStatus = 201
  state.conversion = { opportunity: { id }, created: true, ...(mode === 'saved' ? { intake: { ...state.imported.results[0], status: 'converted' } } : {}) }
}

for (const mode of ['live', 'saved']) {
  for (const status of ['matched', 'no_match']) {
    test(`${mode} complete email prefills every opportunity field and submits ${status === 'matched' ? 'the canonical client' : 'the sourced new client'} only on save`, async ({ page }, testInfo) => {
      const { state, dialog, path } = await setup(page, mode, {
        details: opportunityDetails({ subject, can_create_client: true, extracted_information: information(status) }), allowConversion: true,
      })
      await expect(field(dialog, 'Client')).toHaveValue(status === 'matched' ? 'client-one' : '__new__')
      await assertFields(dialog)
      assertReadOnly(state)
      if (mode === 'live' && status === 'no_match') await dialog.screenshot({ path: testInfo.outputPath('email-prefill-new-client.png') })
      await create(dialog).click()
      await expect(dialog).toHaveCount(0)
      expect(writes(state)).toHaveLength(1)
      expect(writes(state)[0]).toMatchObject({ path, body: {
        ...(status === 'matched' ? { client: 'client-one' } : { new_client: { company_name: 'OQ' } }),
        source_token: 'synthetic-source-token-1', classification_code: 'tender_opportunity', classification_confirmed: true,
        client_reference: 'SYN-2026-42', estimated_value: '850000.50', currency: 'OMR',
        expected_close_date: '2026-11-30', submission_due_date: '2026-10-02', scope_type: 'feed',
        description: 'FEED engineering for the synthetic pump package.',
      } })
      expect(writes(state)[0].body[status === 'matched' ? 'new_client' : 'client']).toBeUndefined()
      if (status === 'no_match') expect(writes(state)[0].body.new_client).toEqual({ company_name: 'OQ' })
      assertWrites(state, path)
    })
  }

  test(`${mode} client prefill waits for the whole authorized directory and preserves edits while loading`, async ({ page }) => {
    let release
    const pending = new Promise(resolve => { release = resolve })
    let secondPage = false
    const { state, dialog } = await setup(page, mode, { clientHandler: async ({ url }) => {
      if (url.searchParams.get('page') === '1') return { body: paginated([other], '/api/v1/sales/clients/?page=2') }
      secondPage = true
      await pending
      return { body: paginated([client]) }
    } })
    await expect.poll(() => secondPage).toBe(true)
    await expect(field(dialog, 'Client')).toBeDisabled()
    await expect(field(dialog, 'Client')).toHaveValue('')
    await expect(field(dialog, 'Client').getByRole('option', { name: 'Reviewed client', exact: true })).toHaveCount(0)
    await field(dialog, 'Opportunity name').fill('Manual title while clients load')
    release()
    await expect(field(dialog, 'Client')).toHaveValue('client-one')
    await expect(field(dialog, 'Opportunity name')).toHaveValue('Manual title while clients load')
    assertReadOnly(state)
  })

  for (const failure of [400, 403, 409]) {
    test(`${mode} new-client ${failure} preserves all edits and allows canonical client correction without source reload`, async ({ page }) => {
      const { state, dialog, path } = await setup(page, mode, {
        details: opportunityDetails({ subject, can_create_client: true, extracted_information: information('no_match') }),
        allowConversion: true, conversionStatus: failure,
        conversion: failure === 409 ? { code: 'email_customer_conflict', detail: 'The customer cannot be resolved safely. Select an accessible client and try again.' }
          : failure === 400 ? { client: 'Use the source-backed detected company name for a new client.' }
            : { detail: 'You do not have permission to create a client.' },
      })
      await expect(field(dialog, 'Client')).toHaveValue('__new__')
      await field(dialog, 'Opportunity name').fill('Reviewed title retained')
      await field(dialog, 'Scope summary').fill('Reviewed summary retained')
      await field(dialog, 'Estimated value').fill('91000.75')
      await create(dialog).click()
      await expect(dialog.getByRole('alert')).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Reload email details', exact: true })).toHaveCount(0)
      for (const [label, value] of Object.entries({ Client: '__new__', 'Opportunity name': 'Reviewed title retained', 'Scope summary': 'Reviewed summary retained', 'Estimated value': '91000.75', Currency: 'OMR' })) await expect(field(dialog, label)).toHaveValue(value)
      if (failure === 409) await expect(dialog.getByRole('alert')).toContainText('The customer cannot be resolved safely.')
      if (failure === 400) await expect(dialog).toContainText('Use the source-backed detected company name for a new client.')
      await field(dialog, 'Client').selectOption('client-two')
      succeed(state, mode, 'corrected-prefill')
      await create(dialog).click()
      await expect(dialog).toHaveCount(0)
      expect(writes(state)).toHaveLength(2)
      expect(writes(state)[1].body).toMatchObject({ client: 'client-two', estimated_value: '91000.75', currency: 'OMR', description: 'Reviewed summary retained', deal_name: 'Reviewed title retained' })
      expect(writes(state)[1].body.new_client).toBeUndefined()
      assertWrites(state, path)
    })
  }

  for (const nextCurrency of ['', 'SAR']) {
    test(`${mode} source reload to ${nextCurrency || 'missing currency'} retains OMR and requires explicit choice of a changed customer`, async ({ page }) => {
      const { state, dialog, path } = await setup(page, mode, {
        details: opportunityDetails({ subject, can_create_client: true, extracted_information: information('no_match') }),
        allowConversion: true, conversionStatus: 410, conversion: { detail: 'Email review has expired.' },
      })
      await expect(field(dialog, 'Client')).toHaveValue('__new__')
      await field(dialog, 'Opportunity name').fill('Preserve my reviewed title')
      await create(dialog).click()
      const updated = information('no_match', 'New source customer')
      updated.currency = nextCurrency
      updated.evidence.currency = nextCurrency ? 'SAR 850000.50' : ''
      refreshDetails(state, mode, { source_token: 'refreshed-prefill-token', body_text: updated.analysis.sources[0].excerpt, extracted_information: updated })
      await dialog.getByRole('button', { name: 'Reload email details', exact: true }).click()
      await expect(confirm(dialog)).toBeEnabled()
      await expect(field(dialog, 'Currency')).toHaveValue('OMR')
      await expect(field(dialog, 'Opportunity name')).toHaveValue('Preserve my reviewed title')
      await expect(field(dialog, 'Client')).toHaveValue('')
      await expect(field(dialog, 'Client').getByRole('option', { name: 'Add new client: New source customer', exact: true })).toBeAttached()
      await confirm(dialog).click()
      await expect(create(dialog)).toBeDisabled()
      await field(dialog, 'Client').selectOption('__new__')
      succeed(state, mode, 'refreshed-prefill')
      await create(dialog).click()
      await expect(dialog).toHaveCount(0)
      expect(writes(state)[1].body).toMatchObject({ source_token: 'refreshed-prefill-token', currency: 'OMR', new_client: { company_name: 'New source customer' }, deal_name: 'Preserve my reviewed title' })
      assertWrites(state, path)
    })
  }

  test(`${mode} revoked client-create capability on reload removes the new-client choice without losing other fields`, async ({ page }) => {
    const { state, dialog } = await setup(page, mode, {
      details: opportunityDetails({ subject, can_create_client: true, extracted_information: information('no_match') }),
      allowConversion: true, conversionStatus: 410, conversion: { detail: 'Email review has expired.' },
    })
    await expect(field(dialog, 'Client')).toHaveValue('__new__')
    await field(dialog, 'Scope summary').fill('Keep reviewed scope')
    await create(dialog).click()
    refreshDetails(state, mode, { source_token: 'revoked-client-create-token', can_create_client: false })
    await dialog.getByRole('button', { name: 'Reload email details', exact: true }).click()
    await expect(confirm(dialog)).toBeEnabled()
    await expect(field(dialog, 'Client')).toHaveValue('')
    await expect(field(dialog, 'Client').getByRole('option', { name: /Add new client:/ })).toHaveCount(0)
    await expect(field(dialog, 'Scope summary')).toHaveValue('Keep reviewed scope')
    await expect(field(dialog, 'Currency')).toHaveValue('OMR')
    await confirm(dialog).click()
    await expect(create(dialog)).toBeDisabled()
    await field(dialog, 'Client').selectOption('client-two')
    await expect(create(dialog)).toBeEnabled()
    expect(writes(state)).toHaveLength(1)
    expect(state.errors).toEqual([])
    expect(state.unexpected).toEqual([])
  })
}

for (const reason of ['ambiguous', 'create denied', 'unknown evidence', 'domain-only name', 'missing canonical record', 'client read denied']) {
  test(`client prefill leaves ${reason} unresolved`, async ({ page }) => {
    const extracted = information(reason === 'create denied' || reason === 'domain-only name' ? 'no_match' : 'matched')
    if (reason === 'ambiguous') Object.assign(extracted.customer_match, { status: 'ambiguous', candidates: [candidate(), candidate(other)] })
    if (reason === 'unknown evidence') extracted.customer_match.evidence.source_ids = ['unknown-source']
    if (reason === 'domain-only name') extracted.organization_name = ''
    const { state, dialog } = await setup(page, 'live', {
      details: opportunityDetails({ subject, can_create_client: reason !== 'create denied', extracted_information: extracted }),
      ...(reason === 'missing canonical record' ? { clients: paginated([other]) } : {}),
      ...(reason === 'client read denied' ? { clientStatus: 403, clients: { detail: 'Denied.' } } : {}),
    })
    await expect(dialog.getByRole('status')).toHaveCount(0)
    await expect(field(dialog, 'Client')).toHaveValue('')
    await expect(create(dialog)).toBeDisabled()
    await expect(field(dialog, 'Client').getByRole('option', { name: /Add new client:/ })).toHaveCount(0)
    assertReadOnly(state)
  })
}

test('manual canonical client and explicit blank choice survive source reloads', async ({ page }) => {
  const { state, dialog } = await setup(page, 'live', { allowConversion: true, conversionStatus: 410, conversion: { detail: 'Email review has expired.' } })
  await expect(field(dialog, 'Client')).toHaveValue('client-one')
  await field(dialog, 'Client').selectOption('client-two')
  await create(dialog).click()
  refreshDetails(state, 'live', { source_token: 'manual-choice-refresh-1' })
  await dialog.getByRole('button', { name: 'Reload email details', exact: true }).click()
  await expect(confirm(dialog)).toBeEnabled()
  await expect(field(dialog, 'Client')).toHaveValue('client-two')
  await confirm(dialog).click()
  await create(dialog).click()
  await field(dialog, 'Client').selectOption('')
  refreshDetails(state, 'live', { source_token: 'manual-choice-refresh-2' })
  await dialog.getByRole('button', { name: 'Reload email details', exact: true }).click()
  await expect(confirm(dialog)).toBeEnabled()
  await expect(field(dialog, 'Client')).toHaveValue('')
  await expect(create(dialog)).toBeDisabled()
  expect(writes(state)).toHaveLength(2)
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('reopening saved opportunity waits for fresh client access before prefilling', async ({ page }) => {
  const { state, dialog } = await setup(page, 'saved')
  await expect(field(dialog, 'Client')).toHaveValue('client-one')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  let release
  const pending = new Promise(resolve => { release = resolve })
  state.clientHandler = async () => {
    await pending
    return { body: paginated([other]) }
  }
  await create(review(page)).click()
  await expect(field(form(page), 'Client')).toBeDisabled()
  await expect(field(form(page), 'Client')).toHaveValue('')
  await field(form(page), 'Opportunity name').fill('New review retained')
  release()
  await expect(field(form(page), 'Client')).toBeEnabled()
  await expect(field(form(page), 'Client')).toHaveValue('')
  await expect(field(form(page), 'Opportunity name')).toHaveValue('New review retained')
  await expect(create(form(page))).toBeDisabled()
  assertReadOnly(state)
})

for (const reason of ['unknown source', 'invalid currency code']) {
  test(`an additional currency with ${reason} remains unresolved`, async ({ page }) => {
    const extracted = information()
    if (reason === 'unknown source') extracted.field_sources.currency = ['unknown-source']
    else extracted.currency = 'OMR1'
    const { state, dialog } = await setup(page, 'live', { details: opportunityDetails({ subject, extracted_information: extracted }) })
    await expect(field(dialog, 'Currency')).toHaveValue('')
    await expect(field(dialog, 'Currency').getByRole('option', { name: extracted.currency, exact: true })).toHaveCount(0)
    assertReadOnly(state)
  })
}
