import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import {
  prepare, message, listing, paginated, canonicalClient, opportunityDetails, assertReadOnly,
} from '../fixtures/sales-email-api-fixture.js'

// Synthetic source contracts only. The fixture blocks external requests and all writes.
const subject = 'Reminder for Tender - Tender Code Tender_38669 on OQ Tawreed Portal'
const packageDescription = 'Once Off Procurement - PR 70059386 - CHEM;N;PROPYL ALCHI;LAB RGNT,LQD,DRM'
const deadline = 'Date: 2 Oct, 2026\nTime: 01:59 (Gulf Standard Time)'
const body = `Dear Supplier,\n\nThis is to remind you that there are only two days to respond to Tender Code Tender_38669, published by OQ regarding 6000062192 - ${packageDescription}.\n\nPlease note that the deadline for submitting a submission concerning this tender on OQ Tawreed Portal has been set to:\n\n${deadline}\n\nTo avoid any delay in submission due to network or technical issues, please start the bid submission process if not started.`
const sourceId = 'oq-reminder-source'
const ids = [sourceId]
const evidenceState = (status, reason, sourceIds = ids) => ({ status, reason, source_ids: sourceIds })
const source = { id: sourceId, origin: 'message', is_selected: true, direction: 'incoming', thread_role: 'new_message', label: 'Selected OQ tender reminder', sender_email: 'tawreed@oq.com', sent_at: '2026-09-29T05:15:00Z', subject, excerpt: body }
const information = () => ({
  detection_version: 2, title: subject, customer_name: 'OQ', organization_name: 'OQ', customer_domain: 'oq.com',
  tender_reference: 'Tender_38669', procurement_reference: '6000062192', pr_reference: '70059386',
  scope_summary: packageDescription, source_portal: 'OQ Tawreed Portal',
  due_date: '2026-10-02', deadline_date: '2026-10-02', deadline_time: '01:59', deadline_timezone: 'Gulf Standard Time',
  submission_date: '', estimated_value: '', currency: '', expected_award_date: '', scope_type: '', warnings: [],
  evidence: { customer_name: 'published by OQ', tender_reference: 'Tender Code Tender_38669', procurement_reference: '6000062192', pr_reference: 'PR 70059386', scope_summary: packageDescription, source_portal: 'OQ Tawreed Portal', due_date: deadline, deadline_time: deadline, deadline_timezone: deadline },
  field_sources: Object.fromEntries(['customer_name', 'tender_reference', 'procurement_reference', 'pr_reference', 'scope_summary', 'source_portal', 'due_date', 'deadline_time', 'deadline_timezone'].map(key => [key, ids])),
  ai_review: { version: 1, status: 'validated', method: 'ai_evidence_v1', purpose: 'reminder' },
  classification: {
    version: 1, status: 'classified', code: 'tender_opportunity', needs_review: true,
    confidence: { level: 'medium', method: 'ai_evidence_v1', reason: 'The cited subject and body describe a tender reminder.', source_ids: ids },
    evidence: [{ source_id: sourceId, location: 'subject', excerpt: subject, rule_id: 'ai_source_evidence_v1' }], alternatives: [],
  },
  intelligence: {
    version: 1, customer_name: evidenceState('detected', 'OQ is explicitly named in the selected message.'),
    deadline_review: evidenceState('requires_verification', 'Verify the stated date and time with the portal before submission.'),
    opportunity_detection: { ...evidenceState('follow_up', 'The reminder follows an existing tender request.'), needs_review: true },
  },
  analysis: {
    version: 1, message_kind: 'follow_up', selected_source_id: sourceId,
    summary: 'OQ reminds suppliers to respond to Tender_38669 by the stated deadline.',
    sources: [source], key_points: [
      { label: 'Tender code', value: 'Tender_38669', source_ids: ids },
      { label: 'Procurement reference', value: '6000062192', source_ids: ids },
      { label: 'Deadline stated in email', value: '02 October 2026, 01:59 Gulf Standard Time', source_ids: ids },
    ],
    requested_actions: [{ text: 'Start the bid submission process if not started.', source_ids: ids }], suggested_actions: [],
    coverage: { status: 'selected_only', messages_reviewed: 1, segments_reviewed: 1, original_identified: false },
    limitations: ['Current portal status has not been verified.'],
  },
})
const oqMessage = () => message({ id: 'oq-reminder', subject, sender_name: 'OQ Tawreed Portal', sender_email: 'tawreed@oq.com', sent_at: source.sent_at, received_at: source.sent_at, direction: 'incoming', thread_role: 'new_message', is_read: true, has_attachments: false, body_preview: 'Dear Supplier, This is to remind you that there are only two days to respond.' })
const otherMessages = () => [
  message({ id: 'supplier-maintenance', subject: 'Supplier portal planned maintenance', sender_name: 'Supplier Management', sender_email: 'support@example.test', direction: 'incoming', thread_role: 'new_message', has_attachments: false }),
  message({ id: 'engineering-review', subject: 'Engineering review: revised project scope', sender_name: 'Project Team', sender_email: 'projects@example.test', direction: 'incoming', thread_role: 'reply', is_read: true }),
  message({ id: 'access-update', subject: 'Site access coordination', sender_name: 'Operations Team', sender_email: 'operations@example.test', direction: 'incoming', thread_role: 'new_message', has_attachments: false }),
]
const review = page => page.getByRole('complementary', { name: 'Email review', exact: true })
const preview = page => page.getByRole('region', { name: 'Email preview', exact: true })
const card = (page, name) => review(page).getByRole('region', { name, exact: true })
const fact = (scope, label) => scope.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }).locator('xpath=following-sibling::dd[1]')
const row = page => page.getByRole('button', { name: `Open email: ${subject}`, exact: true })
const create = scope => scope.getByRole('button', { name: 'Create opportunity', exact: true })
const confirm = scope => scope.getByRole('button', { name: 'Confirm classification', exact: true })
const form = page => page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
const disclosure = (page, name) => review(page).locator('.sales-email-review__disclosure > summary').filter({ hasText: name })
const sidebar = page => page.getByRole('complementary', { name: 'Application navigation', exact: true })
const sidebarHash = async page => createHash('sha256').update(await sidebar(page).evaluate(node => node.outerHTML)).digest('hex')
const detailRequests = state => state.requests.filter(request => request.path.endsWith('/message/'))
const positions = page => page.evaluate(() => Object.fromEntries([
  ['document', document.scrollingElement], ['main', document.querySelector('main.main-content')],
  ['list', document.querySelector('.sales-email-list-scroll')], ['reading', document.querySelector('.sales-email-reader-content')], ['review', document.querySelector('.sales-email-context__scroll')],
].map(([key, node]) => [key, node?.scrollTop || 0])))
const ready = async (page, overrides = {}) => {
  const state = await prepare(page, {
    shell: true, messages: listing([oqMessage(), ...otherMessages()]),
    clients: paginated([canonicalClient({ company_name: 'OQ', legal_name: 'OQ' })]),
    details: opportunityDetails({ ...oqMessage(), body_text: body, extracted_information: information() }), ...overrides,
  })
  await expect(review(page).getByRole('heading', { name: 'AI insights', exact: true })).toBeVisible()
  return state
}
const noHorizontalOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
const settledScroll = async pane => {
  let previous = -1, stableSamples = 0
  await expect.poll(async () => {
    const current = await pane.evaluate(node => node.scrollTop)
    stableSamples = current === previous ? stableSamples + 1 : 0
    previous = current
    return stableSamples
  }, { timeout: 5000, intervals: [50] }).toBeGreaterThanOrEqual(3)
}
const accessible = async page => {
  const result = await new AxeBuilder({ page }).include('.sales-email-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
}

for (const collapsed of [false, true]) {
  test(`reference desktop uses separated purple-accent cards and preserves the ${collapsed ? 'collapsed' : 'expanded'} sidebar`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1587, height: 991 })
    const state = await ready(page, { collapsed })
    await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
    expect(detailRequests(state)).toHaveLength(1)
    const hash = await sidebarHash(page)
    const navigationBounds = await sidebar(page).boundingBox()
    expect(navigationBounds.width).toBe(collapsed ? 72 : 250)
    const heading = await page.getByRole('heading', { name: 'Email Intake', exact: true }).boundingBox()
    expect(heading.height).toBeLessThanOrEqual(28)
    await expect(page.locator('.sales-email-page-header')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Email read status', exact: true }).getByRole('button', { name: /^All mail\b/ })).toHaveAttribute('aria-pressed', 'true')
    const list = await page.locator('.sales-email-list').boundingBox()
    const reader = await page.locator('.sales-email-preview-header').boundingBox()
    const context = await review(page).boundingBox()
    const grid = await page.locator('.sales-email-grid').boundingBox()
    expect(list.x - navigationBounds.width).toBeGreaterThanOrEqual(10)
    expect(list.x - navigationBounds.width).toBeLessThanOrEqual(22)
    expect(Math.abs(reader.y - list.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(context.y - list.y)).toBeLessThanOrEqual(1)
    expect(reader.x - list.x - list.width).toBeCloseTo(8, 0)
    expect(context.x - reader.x - reader.width).toBeCloseTo(8, 0)
    expect(list.width / grid.width).toBeGreaterThan(0.22)
    expect(list.width / grid.width).toBeLessThan(0.28)
    expect(reader.width / context.width).toBeGreaterThan(1.4)
    expect(reader.width / context.width).toBeLessThan(1.8)
    expect(grid.y).toBeGreaterThan(90)
    expect(grid.y).toBeLessThan(150)
    await expect(page.locator('.sales-email-list')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    const selected = await row(page).evaluate(node => getComputedStyle(node.closest('li')).backgroundColor)
    const selectedChannels = selected.match(/\d+/g).map(Number)
    expect(selectedChannels[2]).toBeGreaterThan(selectedChannels[0])
    expect(selectedChannels[2]).toBeGreaterThan(selectedChannels[1])
    await expect(fact(card(page, 'Email Summary'), 'Sender')).toHaveText('tawreed@oq.com')
    await expect(fact(card(page, 'Email Summary'), 'Received')).toContainText('09:15')
    await expect(fact(card(page, 'Email Summary'), 'Type')).toContainText('Reminder')
    await expect(fact(card(page, 'Opportunity Details Detected'), 'Tender status')).toHaveText('Not verified')
    await expect(fact(card(page, 'Opportunity Details Detected'), 'Submission time')).toHaveText('01:59 · Gulf Standard Time')
    await expect(confirm(review(page))).toBeInViewport()
    await expect(create(review(page))).toBeInViewport()
    await noHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`reference-${collapsed ? 'collapsed' : 'expanded'}-1587x991.png`) })
    await disclosure(page, 'Source evidence').click()
    await expect(review(page)).toContainText('Current portal status has not been verified.')
    expect(await sidebarHash(page)).toBe(hash)
    expect(await sidebar(page).boundingBox()).toEqual(navigationBounds)
    await accessible(page)
    assertReadOnly(state)
  })
}

test('short desktop keeps the list, reader and context independently scrollable with keyboard access', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const records = [oqMessage(), ...Array.from({ length: 24 }, (_, index) => message({ id: `engineering-${index}`, subject: `Engineering correspondence ${index + 1}`, direction: 'incoming', thread_role: 'new_message' }))]
  const longBody = `${body}\n\n${Array.from({ length: 55 }, (_, index) => `Section ${index + 1}: Review the technical requirements and documented procurement scope.`).join('\n\n')}`
  const state = await ready(page, { messages: listing(records, 'synthetic-next-page'), details: opportunityDetails({ ...oqMessage(), body_text: longBody, extracted_information: information() }) })
  const panes = [page.locator('.sales-email-list-scroll'), page.locator('.sales-email-reader-content'), page.locator('.sales-email-context__scroll')]
  const toolbar = await page.locator('.sales-email-toolbar').boundingBox()
  const readerHeader = await page.locator('.sales-email-preview-header').boundingBox()
  const reviewActions = await page.locator('.sales-email-review__actions').boundingBox()
  const paging = await page.getByRole('button', { name: 'Next page', exact: true }).boundingBox()
  for (const pane of panes) {
    const metrics = await pane.evaluate(node => ({ height: node.clientHeight, content: node.scrollHeight, overflow: getComputedStyle(node).overflowY }))
    expect(metrics.content).toBeGreaterThan(metrics.height)
    expect(metrics.height).toBeGreaterThan(60)
    expect(['auto', 'scroll']).toContain(metrics.overflow)
  }
  await panes[1].focus()
  await page.keyboard.press('PageDown')
  await expect.poll(async () => (await positions(page)).reading).toBeGreaterThan(0)
  await settledScroll(panes[1])
  const afterReading = await positions(page)
  expect(afterReading).toMatchObject({ document: 0, main: 0, list: 0, review: 0 })
  await panes[0].hover()
  await page.mouse.wheel(0, 350)
  await expect.poll(async () => (await positions(page)).list).toBeGreaterThan(0)
  await panes[2].focus()
  await page.keyboard.press('PageDown')
  await expect.poll(async () => (await positions(page)).review).toBeGreaterThan(0)
  expect(await positions(page)).toMatchObject({ document: 0, main: 0, reading: afterReading.reading })
  await expect(page.locator('.sales-email-page-header')).toBeVisible()
  expect(await page.locator('.sales-email-toolbar').boundingBox()).toEqual(toolbar)
  expect(await page.locator('.sales-email-preview-header').boundingBox()).toEqual(readerHeader)
  expect(await page.locator('.sales-email-review__actions').boundingBox()).toEqual(reviewActions)
  expect(await page.getByRole('button', { name: 'Next page', exact: true }).boundingBox()).toEqual(paging)
  await noHorizontalOverflow(page)
  for (const pane of panes) await pane.evaluate(node => { node.scrollTop = 0 })
  await page.screenshot({ path: testInfo.outputPath('reference-short-desktop-1366x768.png') })
  assertReadOnly(state)
})

test('mobile stacks the cards and keeps review, source disclosures and reader tabs keyboard accessible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await ready(page)
  await noHorizontalOverflow(page)
  const list = await page.locator('.sales-email-list').boundingBox()
  const reader = await page.locator('.sales-email-preview-header').boundingBox()
  const context = await review(page).boundingBox()
  expect(reader.y).toBeGreaterThanOrEqual(list.y + list.height)
  expect(context.y).toBeGreaterThan(reader.y + reader.height)
  await page.screenshot({ path: testInfo.outputPath('reference-mobile-390x844.png') })
  const next = page.getByRole('button', { name: `Next step: ${subject}`, exact: true })
  await next.focus()
  const main = page.locator('main.main-content')
  const mainBounds = await main.boundingBox()
  const header = page.getByRole('banner')
  const headerBounds = await header.boundingBox()
  const documentScroll = (await positions(page)).document
  await page.keyboard.press('Enter')
  await expect(review(page).getByRole('region', { name: 'Email review details', exact: true })).toBeFocused()
  await expect(card(page, 'Email Summary')).toBeInViewport()
  const contextHeading = await review(page).getByRole('heading', { name: 'AI insights', exact: true }).boundingBox()
  expect(contextHeading.y).toBeGreaterThanOrEqual(mainBounds.y - 1)
  expect(contextHeading.y).toBeLessThan(200)
  expect((await positions(page)).document).toBe(documentScroll)
  expect(await main.boundingBox()).toEqual(mainBounds)
  expect(await header.boundingBox()).toEqual(headerBounds)
  await page.screenshot({ path: testInfo.outputPath('reference-mobile-context-390x844.png') })
  const evidence = disclosure(page, 'Source evidence')
  await evidence.focus()
  await page.keyboard.press('Enter')
  await expect(evidence.locator('..')).toHaveAttribute('open', '')
  await expect(confirm(review(page))).toBeEnabled()
  const tabs = preview(page).getByRole('tablist', { name: 'Email reading view', exact: true })
  await tabs.getByRole('tab').first().focus()
  await page.keyboard.press('End')
  await expect(tabs.getByRole('tab', { name: 'Extracted details', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(tabs.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true')
  await accessible(page)
  await page.screenshot({ path: testInfo.outputPath('reference-mobile-reader-390x844.png') })
  assertReadOnly(state)
})

test('source-backed OQ cards preserve explicit classification and missing opportunity inputs', async ({ page }, testInfo) => {
  const state = await ready(page)
  const details = card(page, 'Opportunity Details Detected')
  for (const [label, value] of [['Tender code', 'Tender_38669'], ['Procurement reference', '6000062192'], ['PR reference', '70059386'], ['Package description', packageDescription], ['Source portal', 'OQ Tawreed Portal'], ['Due date', '2026-10-02 · Requires verification'], ['Opportunity', 'Existing request follow-up']]) {
    await expect(fact(details, label)).toHaveText(value)
  }
  await expect(create(review(page))).toBeDisabled()
  await confirm(review(page)).click()
  await expect(create(review(page))).toBeEnabled()
  await create(review(page)).click()
  const dialog = form(page)
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('2026-10-02')
  await expect(dialog.getByLabel('Client reference', { exact: true })).toHaveValue('Tender_38669')
  for (const label of ['Client', 'Estimated value', 'Currency', 'Expected award date', 'Scope type']) await expect(dialog.getByLabel(label, { exact: true })).toHaveValue('')
  await expect(create(dialog)).toBeDisabled()
  await dialog.getByLabel('Opportunity name', { exact: true }).fill('Human-reviewed OQ procurement')
  await dialog.getByLabel('Client', { exact: true }).selectOption('client-one')
  // Minimal VF registration allows absent commercial facts once the canonical
  // client and name are chosen. Reviewing the source still never auto-saves.
  await expect(create(dialog)).toBeEnabled()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Opportunity name', { exact: true })).toHaveValue('Human-reviewed OQ procurement')
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('reference-opportunity-review.png') })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  assertReadOnly(state)
})

test('agreement cards retain quoted action dates without filling tender or proposal fields', async ({ page }, testInfo) => {
  const agreementSubject = 'RE: Q-101752 Fw: Action Required: WO Agreement 4700030672'
  const request = 'Please return the signed agreement, power of attorney and trade license no later than Friday 25 September 2026, at 11:00 am (UAE time).'
  const currentId = 'agreement-reply', quotedId = 'quoted-agreement-request'
  const extracted = {
    detection_version: 2, title: agreementSubject, customer_name: 'ADNOC', due_date: '', deadline_date: '', tender_reference: '',
    agreement_reference: '4700030672', correspondence_reference: 'Q-101752', warnings: [],
    evidence: { customer_name: 'ADNOC', agreement_reference: 'WO Agreement 4700030672', correspondence_reference: 'RE: Q-101752' },
    field_sources: { customer_name: [quotedId], agreement_reference: [quotedId], correspondence_reference: [currentId] },
    action_deadlines: [{ kind: 'agreement_return', date: '2026-09-25', time: '11:00', timezone: 'UAE time', source_ids: [quotedId], evidence: request, status: 'requires_verification' }],
    classification: { version: 1, status: 'classified', code: 'general_communication', needs_review: true, evidence: [{ source_id: currentId, location: 'body', excerpt: 'This has been responded.' }] },
    intelligence: { version: 1, customer_name: evidenceState('detected', 'Customer named in quote.', [quotedId]), deadline_review: evidenceState('not_detected', 'No proposal deadline is stated.', [quotedId]), opportunity_detection: { ...evidenceState('follow_up', 'Agreement correspondence.', [quotedId]), needs_review: true } },
    analysis: { version: 1, selected_source_id: currentId, sources: [
      { id: currentId, origin: 'message', is_selected: true, thread_role: 'reply', direction: 'incoming', subject: agreementSubject, excerpt: 'This has been responded.' },
      { id: quotedId, origin: 'quoted', direction: 'incoming', subject: 'WO Agreement 4700030672', excerpt: request },
    ], requested_actions: [{ text: request, source_ids: [quotedId] }], key_points: [], suggested_actions: [], limitations: [], coverage: { status: 'selected_only', messages_reviewed: 1, segments_reviewed: 2, original_identified: false } },
  }
  const record = message({ subject: agreementSubject })
  const state = await ready(page, { messages: listing([record]), details: opportunityDetails({ ...record, body_text: `This has been responded.\n\n${request}`, extracted_information: extracted }) })
  const details = card(page, 'Opportunity Details Detected')
  await expect(fact(details, 'Action deadline')).toHaveText('2026-09-25 · 11:00 UAE time · Quoted · Requires verification')
  await expect(fact(details, 'WO agreement reference')).toHaveText('4700030672')
  await expect(fact(details, 'Correspondence reference')).toHaveText('Q-101752 · Requires review')
  for (const label of ['Tender code', 'Tender status', 'Due date', 'Submission time']) await expect(fact(details, label)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('reference-agreement-context.png') })
  await confirm(review(page)).click()
  await create(review(page)).click()
  await expect(form(page).getByLabel('Proposal deadline', { exact: true })).toHaveValue('')
  await expect(form(page).getByLabel('Client reference', { exact: true })).toHaveValue('')
  await form(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  assertReadOnly(state)
})

test('new summary cards suppress unsupported fields, invalid clock values and outgoing source evidence', async ({ page }) => {
  const extracted = information()
  extracted.field_sources.tender_reference = ['missing-source']
  extracted.evidence.procurement_reference = ''
  extracted.deadline_time = '25:99'
  extracted.analysis.sources.push({ ...source, id: 'outgoing-source', direction: 'outgoing' })
  extracted.field_sources.source_portal = ['outgoing-source']
  const state = await ready(page, { details: opportunityDetails({ ...oqMessage(), body_text: body, extracted_information: extracted }) })
  const details = card(page, 'Opportunity Details Detected')
  for (const label of ['Tender code', 'Tender status', 'Procurement reference', 'Submission time', 'Source portal']) await expect(fact(details, label)).toHaveCount(0)
  await expect(fact(details, 'PR reference')).toHaveText('70059386')
  await expect(fact(details, 'Due date')).toHaveText('2026-10-02 · Requires verification')
  await expect(create(review(page))).toBeDisabled()
  assertReadOnly(state)
})

test('denied source reload clears the grouped context and reader without changing the shell', async ({ page }, testInfo) => {
  const state = await ready(page)
  const hash = await sidebarHash(page)
  state.detailStatus = 403
  state.details = { detail: 'Mailbox access denied.' }
  await page.getByRole('button', { name: 'Refresh emails', exact: true }).click()
  await expect(review(page)).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText(/access|permission/i)
  await expect(preview(page)).not.toContainText('Tender_38669')
  await expect(page.getByRole('region', { name: 'Email Summary', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create opportunity', exact: true })).toHaveCount(0)
  expect(await sidebarHash(page)).toBe(hash)
  await noHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('reference-access-denied.png') })
  assertReadOnly(state)
})
