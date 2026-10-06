import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Synthetic retained audit snapshots, including diagnostics that must stay out
// of the business-facing history. No real business records or services are used.
const recordId = 'opp-history-synthetic'
const technicalId = 'opaque-source-id-do-not-display'
const hash = 'a'.repeat(64)
const subject = 'Reminder for Tender - Tender_SYN38669 on OQ Tawreed Portal'
const scope = 'Once-off procurement of laboratory reagent in drums; supplier must review the source package.'
const evidence = 'Date: 2 Oct, 2026\nTime: 01:59 (Gulf Standard Time)'
const emailEvent = () => ({
  id: 'synthetic-email-event', event_type: 'opportunity_created_from_email',
  actor: 77, actor_name: 'Maya Reviewer', from_stage: '', to_stage: 'lead',
  occurred_at: '2026-09-29T05:15:00Z', reason: 'Created after email classification was reviewed.',
  data: {
    source_mailbox_connection_id: technicalId, source_mailbox_address: 'sales@example.test',
    source_message_id: technicalId, source_email_intake_id: technicalId,
    internet_message_id: technicalId, sender_email: 'tawreed@oq.example.test', received_at: '2026-09-29T05:10:00Z',
    mailbox_source_hash: hash, reviewed_payload_hash: hash, source_content_hash: hash,
    email_tender_identity: hash, source_hash_version: 2, reviewed_payload_hash_version: 3,
    reviewed_classification: { version: 1, code: 'tender_opportunity', label: 'Tender opportunity', confirmed_by: technicalId, confirmed_at: '2026-09-29T05:15:00Z' },
    reviewed_customer_resolution: { mode: 'created', client_id: technicalId, reviewed_name: 'OQ', created: true },
    reviewed_email_analysis: {
      detection_version: 2, title: subject, organization_name: 'OQ', customer_name: 'OQ',
      tender_reference: 'Tender_SYN38669', procurement_reference: 'SYN6000062192', pr_reference: 'SYN70059386',
      source_portal: 'OQ Tawreed Portal', due_date: '2026-10-02', deadline_time: '01:59', deadline_timezone: 'Gulf Standard Time', scope_summary: scope,
      classification: { code: 'tender_opportunity', evidence: [{ rule_id: 'ai_source_evidence_v1', source_id: technicalId, excerpt: subject }] },
      evidence: { due_date: evidence, scope_summary: scope, organization_name: 'Published by OQ' },
      field_sources: { due_date: [technicalId], scope_summary: [technicalId] },
      ai_review: {
        version: 1, status: 'validated', method: 'ai_evidence_v1', provider: 'synthetic-provider', model: 'synthetic-model',
        needs_review: true, purpose: 'reminder',
        proposal: { organization_name: 'OQ', tender_reference: 'Tender_SYN38669', procurement_reference: 'SYN6000062192', pr_reference: 'SYN70059386', source_portal: 'OQ Tawreed Portal', due_date: '2026-10-02', deadline_time: '01:59', deadline_timezone: 'Gulf Standard Time', deadline_at: '2026-10-02T01:59:00+04:00', scope_summary: scope },
        field_evidence: { due_date: { value: '2026-10-02', source_id: technicalId, excerpt: evidence } },
        conflicting_fields: [], rejected_fields: [], partial: false,
      },
    },
  },
})
const opportunity = (history = [emailEvent()]) => ({
  id: recordId, deal_code: 'OPP-SYN-2026-42', deal_name: 'Synthetic reviewed procurement opportunity',
  stage: 'lead', stage_display: 'Lead', probability: 10, estimated_value: '10000.00', currency: 'OMR',
  client_name: 'Current canonical client', owner_name: 'Maya Reviewer', scope_type: 'other', risk_level: 'low',
  submission_due_date: '2026-10-02', expected_close_date: '2026-11-30', next_action: 'Qualify reviewed source',
  next_action_date: '2026-09-30', priority: 'medium', stage_history: history,
})
const drawer = page => page.getByRole('dialog', { name: 'Opportunity record', exact: true })
const history = page => page.getByRole('region', { name: 'Action history', exact: true })
const value = (region, label) => region.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]')
async function prepare(page, options = {}) {
  const state = { record: opportunity(), requests: [], errors: [], keyWarnings: [], unexpected: [], ...options }
  page.on('pageerror', error => state.errors.push(error.message))
  page.on('console', message => {
    if (/same key|unique.*key.*prop/i.test(message.text())) state.keyWarnings.push(message.text())
  })
  await page.addInitScript(() => {
    localStorage.setItem('radai_access_token', 'opportunity-history-fixture')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 77, email: 'reviewer@example.test' }))
  })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      state.unexpected.push(`External request: ${url.origin}`)
      return route.abort()
    }
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    state.requests.push({ path: url.pathname, method: request.method() })
    if (options.allowQualification && request.method() === 'POST' && url.pathname === `/api/v1/sales/deals/${recordId}/submit-qualification/`) {
      state.record = { ...state.record, stage: 'qualified', stage_display: 'Qualified Lead' }
      return route.fulfill({ json: {
        success: true,
        opportunity: structuredClone(state.record),
        warnings: [{
          field: 'required_attachment',
          message: 'No attachment has been provided. You may continue with the submission.',
        }],
      } })
    }
    if (request.method() !== 'GET') {
      state.unexpected.push(`${request.method()} ${url.pathname}`)
      return route.fulfill({ status: 405, json: { detail: 'This fixture allows reads only.' } })
    }
    if (url.pathname === `/api/v1/sales/deals/${recordId}/`) return route.fulfill({ json: structuredClone(state.record) })
    if (url.pathname === `/api/v1/sales/deals/${recordId}/workspace/`) return route.fulfill({ json: { opportunity_id: recordId, status: 'not_configured', web_url: '', can_manage: false, can_upload: false, folders: [] } })
    if (url.pathname === '/api/v1/sales/deals/') return route.fulfill({ json: { count: 1, results: [state.record] } })
    if (/^\/api\/v1\/sales\/(clients|quotes|frameworks|forecasts|project-handovers)\/$/.test(url.pathname)) return route.fulfill({ json: { count: 0, results: [] } })
    state.unexpected.push(`${request.method()} ${url.pathname}`)
    return route.fulfill({ status: 404, json: { detail: 'Unexpected fixture request.' } })
  })
  await page.goto('/tests/fixtures/sales-opportunity-history.html')
  await expect(drawer(page).getByRole('heading', { name: 'OPP-SYN-2026-42', exact: true })).toBeVisible()
  await expect(drawer(page).getByText('Loading record...', { exact: true })).toHaveCount(0)
  return state
}
const clean = state => {
  expect(state.errors).toEqual([])
  expect(state.keyWarnings).toEqual([])
  expect(state.unexpected).toEqual([])
  expect(state.requests.every(request => request.method === 'GET')).toBe(true)
}
const noDiagnostics = async region => {
  for (const text of [technicalId, hash, 'reviewed_email_analysis', 'ai_evidence_v1', 'source_hash_version', 'synthetic-provider', 'synthetic-model', 'confirmed_by', 'field_sources']) await expect(region).not.toContainText(text)
  await expect(region.locator('pre, code')).toHaveCount(0)
}

test('opportunity desktop history presents readable retained email facts and collapsed evidence', async ({ page }, testInfo) => {
  const state = await prepare(page)
  const panel = history(page)
  await expect(panel.getByRole('heading', { name: 'Email details', exact: true })).toBeVisible()
  await expect(panel).toContainText('Opportunity created from incoming email')
  await expect(panel).toContainText('Maya Reviewer')
  await expect(panel).toContainText('Lead')
  for (const [label, text] of Object.entries({ Subject: subject, 'Email customer': 'OQ', 'Email type': 'Tender opportunity', Notice: 'Reminder', 'Tender reference': 'Tender_SYN38669', 'Procurement reference': 'SYN6000062192', 'PR reference': 'SYN70059386', Portal: 'OQ Tawreed Portal', 'Scope summary': scope, From: 'tawreed@oq.example.test', Mailbox: 'sales@example.test' })) await expect(value(panel, label)).toContainText(text)
  await expect(value(panel, 'Proposal deadline')).toContainText('01:59')
  await expect(value(panel, 'Client record')).toContainText(/created|Created/)
  const evidencePanel = panel.locator('details')
  await expect(evidencePanel).not.toHaveAttribute('open')
  await noDiagnostics(panel)
  await panel.scrollIntoViewIfNeeded()
  await panel.screenshot({ path: testInfo.outputPath('opportunity-history-desktop.png') })
  clean(state)
})

test('360px opportunity history wraps long scope and source evidence without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 })
  const event = emailEvent()
  const longWord = `Tender_${'SYNTHETIC'.repeat(30)}`
  event.data.reviewed_email_analysis.scope_summary = `${scope}\n${longWord}\n${scope.repeat(5)}`
  event.data.reviewed_email_analysis.evidence.scope_summary = `${scope}\n${longWord}\nEnd of retained evidence.`
  const state = await prepare(page, { record: opportunity([event]) })
  const panel = history(page)
  await panel.getByText('Source evidence', { exact: true }).click()
  await expect(panel).toContainText('End of retained evidence.')
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await drawer(page).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await panel.getByText('Source evidence', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('opportunity-history-mobile.png') })
  await drawer(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(drawer(page)).toHaveCount(0)
  clean(state)
})

test('source evidence is keyboard accessible and hostile source text stays literal', async ({ page }) => {
  const event = emailEvent()
  const hostile = '<img src="https://untrusted.example.test/beacon" onerror="window.historyInjected=true">'
  event.data.reviewed_email_analysis.title = hostile
  event.data.reviewed_email_analysis.evidence.scope_summary = hostile
  event.data.reviewed_email_analysis.evidence.customer_name = 'OQ named in the supplier signature.'
  const state = await prepare(page, { record: opportunity([event]) })
  const panel = history(page)
  const toggle = panel.getByText('Source evidence', { exact: true })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(panel.locator('details')).toHaveAttribute('open', '')
  await expect(panel).toContainText(hostile)
  await expect(panel.locator('blockquote').filter({ hasText: 'Published by OQ' })).toBeVisible()
  await expect(panel.locator('blockquote').filter({ hasText: 'OQ named in the supplier signature.' })).toBeVisible()
  await expect(panel.locator('img, script, iframe, style, a')).toHaveCount(0)
  expect(await page.evaluate(() => window.historyInjected)).toBeUndefined()
  await noDiagnostics(panel)
  const scan = await new AxeBuilder({ page }).include('[aria-label="Action history"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({ id: item.id, impact: item.impact }))).toEqual([])
  await page.keyboard.press('Enter')
  await expect(panel.locator('details')).not.toHaveAttribute('open')
  clean(state)
})

test('legacy minimal email history preserves known sender and time without inventing email facts', async ({ page }) => {
  const event = emailEvent()
  event.data = { source_email_intake_id: technicalId, source_message_id: technicalId, sender_email: 'legacy@example.test', received_at: '2026-09-28T06:00:00Z' }
  const state = await prepare(page, { record: opportunity([event]) })
  const panel = history(page)
  await expect(value(panel, 'From')).toHaveText('legacy@example.test')
  await expect(value(panel, 'Received')).toContainText('2026')
  for (const label of ['Subject', 'Email customer', 'Email type', 'Notice', 'Scope summary', 'Client record', 'Portal']) await expect(value(panel, label)).toHaveCount(0)
  await expect(panel).not.toContainText('Current canonical client')
  await expect(panel.getByText('Source evidence', { exact: true })).toHaveCount(0)
  await noDiagnostics(panel)
  clean(state)
})

test('malformed audit details and invalid timestamps stay readable without crashing or exposing nested data', async ({ page }) => {
  const event = emailEvent()
  event.actor_name = ''
  event.occurred_at = 'invalid-timestamp'
  event.data = { received_at: 'invalid-received-timestamp', reviewed_email_analysis: { due_date: '2026-02-30', scope_summary: [technicalId], evidence: { scope_summary: { diagnostic: hash } }, ai_review: { purpose: 'reminder' } }, reviewed_classification: null, reviewed_customer_resolution: hash }
  const state = await prepare(page, { record: opportunity([event, { ...event, id: 'synthetic-unknown-event', event_type: '__proto__', data: [technicalId] }]) })
  const panel = history(page)
  await expect(panel).toContainText('Time unavailable')
  await expect(panel).toContainText('System')
  await expect(value(panel, 'Proposal deadline')).toHaveText('Date unavailable')
  await expect(value(panel, 'Notice')).toHaveCount(0)
  await expect(panel).not.toContainText('invalid-timestamp')
  await expect(panel).not.toContainText('invalid-received-timestamp')
  await noDiagnostics(panel)
  clean(state)
})

test('ordinary lifecycle events retain human business fields, actors, reasons and stage transitions', async ({ page }) => {
  const events = [{
    id: 'synthetic-award-event', event_type: 'award_approved', actor_name: 'Commercial Reviewer',
    from_stage: 'award_pending', to_stage: 'awarded', occurred_at: '2026-09-29T07:00:00Z', reason: 'Commercial terms checked.',
    data: { award_reference: 'AWARD-SYN-42', award_value: '48000.75', currency: 'OMR', proposal_number: 'PROP-SYN-42', version: 3, internal_hash: hash, source_message_id: technicalId, raw_payload: { confidential: technicalId } },
  }, {
    id: 'synthetic-bid-event', event_type: 'bid_decision', actor_name: 'Bid Reviewer',
    from_stage: 'qualified', to_stage: 'proposal', occurred_at: '2026-09-28T07:00:00Z', reason: 'Proceed with the reviewed scope.',
    data: { decision: 'conditional_bid', projected_margin: '12.50', diagnostic: { source: technicalId } },
  }]
  const state = await prepare(page, { record: opportunity(events) })
  const panel = history(page)
  await expect(panel).toContainText('Award approved')
  await expect(panel).toContainText('Commercial Reviewer')
  await expect(panel).toContainText('Commercial terms checked.')
  await expect(panel).toContainText('Award Pending')
  await expect(value(panel, 'Award reference')).toContainText('AWARD-SYN-42')
  await expect(value(panel, 'Award value')).toContainText('48000.75')
  await expect(value(panel, 'Currency')).toContainText('OMR')
  await expect(value(panel, 'Proposal number')).toContainText('PROP-SYN-42')
  await expect(value(panel, 'Version')).toContainText('3')
  await expect(panel).toContainText('Bid decision recorded')
  await expect(value(panel, 'Decision')).toContainText(/conditional bid/i)
  await noDiagnostics(panel)
  clean(state)
})

test('empty opportunity history leaves the existing record and governed controls usable', async ({ page }) => {
  const state = await prepare(page, { record: opportunity([]) })
  await expect(history(page)).toHaveCount(0)
  await expect(drawer(page).getByRole('button', { name: 'Submit qualification', exact: true })).toBeEnabled()
  await expect(drawer(page).getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
  clean(state)
})

test('readable history preserves existing qualification, close, edit and cancel controls without implicit writes', async ({ page }) => {
  const state = await prepare(page)
  await drawer(page).getByRole('button', { name: 'Submit qualification', exact: true }).click()
  const qualification = page.getByRole('dialog', { name: 'Submit qualification', exact: true })
  await expect(qualification).toBeVisible()
  await qualification.getByRole('button', { name: 'Cancel', exact: true }).click()
  await drawer(page).getByRole('button', { name: 'Close opportunity', exact: true }).click()
  const close = page.getByRole('dialog', { name: 'Close opportunity', exact: true })
  await expect(close).toBeVisible()
  await close.getByRole('button', { name: 'Cancel', exact: true }).click()
  clean(state)
  await drawer(page).getByRole('button', { name: 'Edit', exact: true }).click()
  clean(state)
  await drawer(page).getByLabel('Opportunity name', { exact: true }).fill('Unsaved local edit')
  await drawer(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(drawer(page)).toContainText('Synthetic reviewed procurement opportunity')
  await expect(drawer(page)).not.toContainText('Unsaved local edit')
  await expect(history(page)).toBeVisible()
  clean(state)
})

test('qualification warning is non-blocking and the opportunity advances', async ({ page }) => {
  const state = await prepare(page, { allowQualification: true })
  await drawer(page).getByRole('button', { name: 'Submit qualification', exact: true }).click()
  const qualification = page.getByRole('dialog', { name: 'Submit qualification', exact: true })
  await qualification.getByRole('button', { name: 'Submit qualification', exact: true }).click()

  await expect(page.getByText('No attachment has been provided. You may continue with the submission.')).toBeVisible()
  await expect(drawer(page).getByRole('button', { name: 'Submit qualification', exact: true })).toHaveCount(0)
  expect(state.record.stage).toBe('qualified')
  expect(state.requests).toContainEqual({
    path: `/api/v1/sales/deals/${recordId}/submit-qualification/`,
    method: 'POST',
  })
  expect(state.errors).toEqual([])
  expect(state.keyWarnings).toEqual([])
  expect(state.unexpected).toEqual([])
})
