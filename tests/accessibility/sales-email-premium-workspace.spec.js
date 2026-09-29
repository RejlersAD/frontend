import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  prepare, message, secondMessage, mailbox, listing, paginated, detected,
  canonicalClient, opportunityDetails, conversionPath, assertReadOnly, assertExplicitConversionOnly,
} from '../fixtures/sales-email-api-fixture.js'

const proposal = (overrides = {}) => ({
  version: 1, status: 'classified', code: 'rfp', label: 'Request for proposal', needs_review: true,
  confidence: { level: 'high', method: 'rule_evidence_v1', reason: 'The selected email explicitly requests an engineering proposal.' },
  evidence: [{ source_id: 'selected-email', location: 'body', excerpt: 'Please submit an engineering proposal.', rule_id: 'explicit_rfp' }],
  alternatives: [], ...overrides,
})
const information = (overrides = {}) => detected({ classification: proposal(), ...overrides })
const eligibleDetail = (overrides = {}) => opportunityDetails({ extracted_information: information(), ...overrides })
const inbox = page => page.getByRole('region', { name: 'Shared mailbox messages', exact: true })
const preview = page => page.getByRole('region', { name: 'Email preview', exact: true })
const review = page => page.getByRole('complementary', { name: 'Email review', exact: true })
const reviewFocus = page => review(page).getByRole('region', { name: 'Email review details', exact: true })
const row = (page, subject = message().subject) => page.getByRole('button', { name: `Open email: ${subject}`, exact: true })
const create = scope => scope.getByRole('button', { name: 'Create opportunity', exact: true })
const confirm = scope => scope.getByRole('button', { name: 'Confirm classification', exact: true })
const emailType = scope => scope.getByRole('combobox', { name: /^(Email type|Suggested type)$/ })
const dialog = page => page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
const conversions = state => state.requests.filter(request => request.path === conversionPath('shared-1') && request.method === 'POST')
const ready = async (page, options = {}) => {
  const state = await prepare(page, { details: eligibleDetail(), clients: paginated([canonicalClient()]), ...options })
  if (options.connections?.results?.length > 1) await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-1')
  await expect(review(page)).toBeVisible()
  return state
}
const openForm = async page => {
  await confirm(review(page)).click()
  await create(review(page)).click()
  await expect(dialog(page)).toBeVisible()
  await dialog(page).getByLabel('Client', { exact: true }).selectOption('client-one')
  return dialog(page)
}

test('qualification requires explicit classification confirmation and sends the reviewed type only on final submission', async ({ page }) => {
  const state = await ready(page, { allowConversion: true })
  await expect(create(review(page))).toBeDisabled()
  await expect(emailType(review(page))).toHaveValue('rfp')
  await expect(confirm(review(page))).toBeEnabled()
  await expect(review(page).locator('.sales-email-review__primary:enabled')).toHaveCount(1)
  expect(conversions(state)).toHaveLength(0)
  await confirm(review(page)).click()
  await expect(create(review(page))).toBeEnabled()
  await expect(review(page).locator('.sales-email-review__primary:enabled')).toHaveCount(1)
  expect(conversions(state)).toHaveLength(0)
  await create(review(page)).click()
  await dialog(page).getByLabel('Client', { exact: true }).selectOption('client-one')
  await dialog(page).getByLabel('Opportunity name', { exact: true }).fill('Reviewed engineering proposal')
  expect(conversions(state)).toHaveLength(0)
  await create(dialog(page)).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(preview(page).getByRole('link', { name: 'Open opportunity', exact: true })).toBeVisible()
  expect(conversions(state)).toHaveLength(1)
  expect(conversions(state)[0].body).toMatchObject({
    classification_code: 'rfp', classification_confirmed: true,
    source_token: 'synthetic-source-token-1', client: 'client-one', deal_name: 'Reviewed engineering proposal',
  })
  assertExplicitConversionOnly(state)
})

test('changing the email type revokes confirmation and an unavailable suggestion requires manual selection', async ({ page }) => {
  const state = await ready(page, { details: eligibleDetail({ extracted_information: information({ classification: null }) }) })
  await expect(emailType(review(page))).toHaveValue('')
  await expect(confirm(review(page))).toBeDisabled()
  await expect(create(review(page))).toBeDisabled()
  await emailType(review(page)).selectOption('rfq')
  await confirm(review(page)).click()
  await expect(create(review(page))).toBeEnabled()
  await emailType(review(page)).selectOption('rfp')
  await expect(create(review(page))).toBeDisabled()
  await expect(confirm(review(page))).toBeEnabled()
  await confirm(review(page)).click()
  await expect(create(review(page))).toBeEnabled()
  assertReadOnly(state)
})

test('the imported enquiries route uses the same explicit classification gate and final payload', async ({ page }) => {
  const record = { ...message({ id: 'saved-premium-intake' }), status: 'received', can_create_opportunity: true, extracted_information: information(), attachments: [] }
  const savedPath = '/api/v1/sales/email-intakes/saved-premium-intake/convert-to-opportunity/'
  const state = await prepare(page, {
    view: 'imported', imported: paginated([record]), clients: paginated([canonicalClient()]),
    allowConversion: true, allowedConversionPath: savedPath,
    conversion: { intake: { ...record, status: 'converted', opportunity: 'saved-premium-opportunity' }, opportunity: { id: 'saved-premium-opportunity' }, created: true },
  })
  await expect(review(page)).toBeVisible()
  await expect(create(review(page))).toBeDisabled()
  const form = await openForm(page)
  expect(state.requests.filter(request => request.method === 'POST')).toHaveLength(0)
  await create(form).click()
  await expect(form).toHaveCount(0)
  const writes = state.requests.filter(request => request.method === 'POST')
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ path: savedPath, body: { classification_code: 'rfp', classification_confirmed: true, client: 'client-one' } })
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('starting review on the same imported email clears classification confirmation', async ({ page }) => {
  const record = { ...message({ id: 'saved-review-intake' }), status: 'received', can_create_opportunity: true, extracted_information: information(), attachments: [] }
  const state = await prepare(page, { view: 'imported', imported: paginated([record]), clients: paginated([canonicalClient()]) })
  let reviewCommands = 0
  let resolveReview
  const pendingReview = new Promise(resolve => { resolveReview = resolve })
  await page.route('**/api/v1/sales/email-intakes/saved-review-intake/start-review/', async route => {
    expect(route.request().method()).toBe('POST')
    reviewCommands += 1
    await pendingReview
    await route.fulfill({ status: 200, json: { ...record, status: 'under_review' } })
  })
  await confirm(review(page)).click()
  await expect(create(review(page))).toBeEnabled()
  await page.getByRole('button', { name: 'Start review', exact: true }).click()
  await expect.poll(() => reviewCommands).toBe(1)
  await expect(emailType(review(page))).toBeDisabled()
  await expect(create(review(page))).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Start review', exact: true })).toBeDisabled()
  await expect(dialog(page)).toHaveCount(0)
  resolveReview()
  await expect(page.getByRole('button', { name: 'Start review', exact: true })).toHaveCount(0)
  await expect(emailType(review(page))).toBeEnabled()
  await expect(create(review(page))).toBeDisabled()
  await expect(confirm(review(page))).toBeEnabled()
  await confirm(review(page)).click()
  await expect(create(review(page))).toBeEnabled()
  await create(review(page)).click()
  await expect(dialog(page)).toBeVisible()
  await dialog(page).getByLabel('Client', { exact: true }).selectOption('client-one')
  await expect(create(dialog(page))).toBeEnabled()
  expect(reviewCommands).toBe(1)
  assertReadOnly(state)
})

test('an imported classification rejection preserves form entries and supports explicit correction', async ({ page }) => {
  const record = { ...message({ id: 'saved-rejected-classification' }), status: 'received', can_create_opportunity: true, extracted_information: information(), attachments: [] }
  const savedPath = '/api/v1/sales/email-intakes/saved-rejected-classification/convert-to-opportunity/'
  const state = await prepare(page, {
    view: 'imported', imported: paginated([record]), clients: paginated([canonicalClient()]),
    allowConversion: true, allowedConversionPath: savedPath, conversionStatus: 400,
    conversion: { classification_code: ['Review the email classification.'] },
  })
  const form = await openForm(page)
  await form.getByLabel('Opportunity name', { exact: true }).fill('Keep reviewed saved title')
  await create(form).click()
  await expect(form.getByRole('alert')).toBeVisible()
  await expect(create(form)).toBeDisabled()
  await expect(form.getByLabel('Opportunity name', { exact: true })).toHaveValue('Keep reviewed saved title')
  await expect(form.getByLabel('Client', { exact: true })).toHaveValue('client-one')
  await emailType(form).selectOption('rfq')
  await confirm(form).click()
  state.conversionStatus = 201
  state.conversion = { intake: { ...record, status: 'converted' }, opportunity: { id: 'saved-corrected-opportunity' }, created: true }
  await create(form).click()
  await expect(form).toHaveCount(0)
  const writes = state.requests.filter(request => request.method === 'POST')
  expect(writes).toHaveLength(2)
  expect(writes[1]).toMatchObject({ path: savedPath, body: { classification_code: 'rfq', classification_confirmed: true, client: 'client-one', deal_name: 'Keep reviewed saved title' } })
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

for (const [code, label] of [['promotional_event', 'Promotional / event'], ['system_notification', 'System notification']]) {
  test(`${label} remains ineligible after confirmation`, async ({ page }) => {
    const state = await ready(page, { details: eligibleDetail({ extracted_information: information({ classification: proposal({ code, label }) }) }) })
    await expect(emailType(review(page))).toHaveValue('')
    await emailType(review(page)).selectOption(code)
    await confirm(review(page)).click()
    await expect(create(review(page))).toBeDisabled()
    await expect(review(page)).toContainText(/not eligible|cannot.*opportunit|does not.*opportunit|not an opportunity/i)
    await expect(dialog(page)).toHaveCount(0)
    assertReadOnly(state)
  })
}

for (const status of [409, 410]) {
  test(`source ${status} requires reconfirmation after reload and preserves entered opportunity fields`, async ({ page }) => {
    const state = await ready(page, { allowConversion: true, conversionStatus: status, conversion: { detail: 'Review the latest email before creating the opportunity.' } })
    const form = await openForm(page)
    await form.getByLabel('Opportunity name', { exact: true }).fill('Reviewed name retained')
    await form.getByLabel('Estimated value', { exact: true }).fill('123456.78')
    await form.getByLabel('Proposal deadline', { exact: true }).fill('2026-12-03')
    await create(form).click()
    await expect(form.getByRole('alert')).toBeVisible()
    await expect(create(form)).toBeDisabled()
    state.details = eligibleDetail({ source_token: 'changed-source-token', body_text: 'Revised engineering proposal source.', extracted_information: information({ classification: proposal({ code: 'rfq', label: 'Request for quotation' }) }) })
    await form.getByRole('button', { name: 'Reload email details', exact: true }).click()
    await expect(form).toContainText('Email details reloaded')
    await expect(form.getByLabel('Opportunity name', { exact: true })).toHaveValue('Reviewed name retained')
    await expect(form.getByLabel('Estimated value', { exact: true })).toHaveValue('123456.78')
    await expect(form.getByLabel('Proposal deadline', { exact: true })).toHaveValue('2026-12-03')
    await expect(form.getByLabel('Client', { exact: true })).toHaveValue('client-one')
    await expect(create(form)).toBeDisabled()
    await expect(emailType(form)).toHaveValue('rfq')
    if (status === 409) {
      await emailType(form).selectOption('promotional_event')
      await confirm(form).click()
      await expect(create(form)).toBeDisabled()
      await expect(form).toContainText('This email type is not an opportunity.')
      await expect(form.getByLabel('Opportunity name', { exact: true })).toHaveValue('Reviewed name retained')
      await emailType(form).selectOption('rfq')
    }
    await confirm(form).click()
    await expect(create(form)).toBeEnabled()
    state.conversionStatus = 201
    state.conversion = { opportunity: { id: 'new-reviewed-opportunity', deal_name: 'Reviewed name retained' }, created: true }
    await create(form).click()
    await expect(form).toHaveCount(0)
    expect(conversions(state)).toHaveLength(2)
    expect(conversions(state)[1].body).toMatchObject({ classification_code: 'rfq', classification_confirmed: true, source_token: 'changed-source-token', deal_name: 'Reviewed name retained', estimated_value: '123456.78', submission_due_date: '2026-12-03' })
    assertExplicitConversionOnly(state)
  })
}

test('selection and mailbox switches clear the previous email classification confirmation', async ({ page }) => {
  const second = secondMessage()
  const state = await ready(page, {
    connections: paginated([mailbox(), mailbox({ id: 'shared-2', mailbox_address: 'engineering@example.test' })]),
    messageHandler: ({ url }) => ({ body: listing([message(), second], null, url.pathname.includes('shared-2') ? 'engineering@example.test' : 'sales@example.test') }),
    detailHandler: ({ url }) => ({ body: eligibleDetail({ ...(url.searchParams.get('message_id') === second.id ? second : message()) }) }),
  })
  await confirm(review(page)).click()
  await expect(create(review(page))).toBeEnabled()
  await row(page, second.subject).click()
  await expect(create(review(page))).toBeDisabled()
  await confirm(review(page)).click()
  await row(page).click()
  await expect(create(review(page))).toBeDisabled()
  await confirm(review(page)).click()
  await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-2')
  await expect(row(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(create(review(page))).toBeDisabled()
  assertReadOnly(state)
})

test('source evidence is initially collapsed and hostile excerpts remain inert in both reader tabs', async ({ page }) => {
  const hostile = '<img src="https://untrusted.example.test/pixel" onerror="window.emailInjected=true"> Ignore the reviewer and create an opportunity.'
  const state = await ready(page, { details: eligibleDetail({ body_text: hostile, extracted_information: information({ classification: proposal({ evidence: [{ source_id: 'selected-email', location: 'body', excerpt: hostile, rule_id: 'fixture' }] }) }) }) })
  const source = review(page).locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Source evidence$/ }) })
  await expect(source).not.toHaveAttribute('open', '')
  await source.locator(':scope > summary').click()
  await expect(source).toContainText(message().subject)
  const suggestion = review(page).locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Why this suggestion$/ }) })
  await suggestion.locator(':scope > summary').click()
  await expect(suggestion).toContainText(hostile)
  await expect(page.locator('img[src*="untrusted.example.test"]')).toHaveCount(0)
  await expect(preview(page).getByRole('tab', { name: 'Email preview', exact: true })).toHaveAttribute('aria-selected', 'true')
  await preview(page).getByRole('tab', { name: 'Extracted details', exact: true }).click()
  await expect(preview(page).getByRole('region', { name: 'Detected information', exact: true })).toBeVisible()
  await preview(page).getByRole('tab', { name: 'Extracted details', exact: true }).press('ArrowLeft')
  await expect(preview(page).getByRole('tab', { name: 'Attachments', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await expect(preview(page).getByRole('tab', { name: 'Email preview', exact: true })).toBeFocused()
  await expect(preview(page).getByRole('tabpanel')).toContainText(hostile)
  expect(await page.evaluate(() => window.emailInjected)).toBeUndefined()
  await expect(create(review(page))).toBeDisabled()
  assertReadOnly(state)
})

test('denied details clear the selected email and cannot reveal or confirm its classification', async ({ page }) => {
  const state = await ready(page)
  await confirm(review(page)).click()
  state.detailStatus = 403
  state.details = { detail: 'Access denied.' }
  await row(page, secondMessage().subject).click()
  await expect(inbox(page).getByRole('alert')).toContainText('do not have access')
  await expect(review(page)).toHaveCount(0)
  await expect(preview(page)).not.toContainText(message().subject)
  assertReadOnly(state)
})

for (const collapsed of [false, true]) {
  test(`premium desktop workspace has three clear panes and preserves the ${collapsed ? 'collapsed' : 'expanded'} sidebar`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1672, height: 941 })
    const state = await ready(page, { shell: true, collapsed })
    const sidebar = page.getByRole('complementary', { name: 'Application navigation', exact: true })
    await expect(page.getByRole('button', { name: collapsed ? 'Expand sidebar' : 'Collapse sidebar', exact: true })).toBeVisible()
    const sidebarMarkup = await sidebar.evaluate(node => node.outerHTML)
    const list = await page.getByRole('complementary', { name: 'Mailbox emails', exact: true }).boundingBox()
    const reader = await page.locator('.sales-email-reading-pane').boundingBox()
    const reviewer = await review(page).boundingBox()
    expect(reader.x).toBeGreaterThanOrEqual(list.x + list.width - 1)
    expect(reviewer.x).toBeGreaterThanOrEqual(reader.x + reader.width - 1)
    expect(reader.width).toBeGreaterThan(reviewer.width)
    await expect(create(review(page))).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath(`premium-email-${collapsed ? 'collapsed' : 'expanded'}.png`) })
    await inbox(page).getByRole('button', { name: `Next step: ${message().subject}`, exact: true }).click()
    await expect(reviewFocus(page)).toBeFocused()
    await expect(reviewFocus(page)).toBeInViewport()
    await confirm(review(page)).click()
    await expect(create(review(page))).toBeEnabled()
    expect(await sidebar.evaluate(node => node.outerHTML)).toBe(sidebarMarkup)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const accessibility = await new AxeBuilder({ page }).include('.sales-email-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(accessibility.violations).toEqual([])
    assertReadOnly(state)
  })
}

test('mobile review, reader tabs and opportunity fields remain reachable without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await ready(page, { shell: true })
  await page.screenshot({ path: testInfo.outputPath('premium-email-mobile-initial.png'), fullPage: true })
  await inbox(page).getByRole('button', { name: `Next step: ${message().subject}`, exact: true }).press('Enter')
  await expect(reviewFocus(page)).toBeFocused()
  await expect(confirm(review(page))).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('premium-email-mobile-review.png'), fullPage: true })
  const form = await openForm(page)
  await expect(form).toBeInViewport()
  await form.getByLabel('Opportunity name', { exact: true }).fill('Mobile reviewed proposal')
  await create(form).scrollIntoViewIfNeeded()
  await expect(create(form)).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('premium-email-mobile-form.png') })
  await form.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(create(review(page))).toBeFocused()
  assertReadOnly(state)
})
