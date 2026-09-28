import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const connectionsPath = '/api/v1/sales/mailbox-connections/'
const messagesPath = id => `${connectionsPath}${id}/messages/`
const detailPath = id => `${connectionsPath}${id}/message/`
const conversionPath = id => `${connectionsPath}${id}/convert-to-opportunity/`
const mailbox = (overrides = {}) => ({
  id: 'shared-1', auth_mode: 'application', name: 'Sales shared inbox',
  mailbox_address: 'sales@example.test', last_status: 'connected', enabled: false,
  last_health_check_at: '2026-09-28T08:15:00Z', ...overrides,
})
const message = (overrides = {}) => ({
  id: 'message-one/opaque+=', subject: 'Clarification on pump package',
  sender_name: 'Ava Khan', sender_email: 'ava@example.test',
  received_at: '2026-09-28T08:15:00Z', sent_at: '2026-09-28T08:14:00Z',
  body_preview: 'Please confirm the specification revision.',
  has_attachments: true, is_read: false, is_draft: false, importance: 'normal', ...overrides,
})
const secondMessage = () => message({ id: 'message-two', subject: 'Site access update', sender_name: 'Noah Ali', sender_email: 'noah@example.test', has_attachments: false, is_read: true })
const listing = (results = [message(), secondMessage()], nextCursor = null, address = 'sales@example.test') => ({ mailbox_address: address, results, next_cursor: nextCursor })
const paginated = (results, next = null) => ({ count: results.length, results, next })
const detail = (record = message(), overrides = {}) => ({
  ...record, body_text: 'Please confirm revision C for the pump package.\nRegards, Ava',
  to_recipients: [{ name: 'Sales team', email: 'sales@example.test' }],
  cc_recipients: [{ name: 'Project team', email: 'projects@example.test' }], ...overrides,
})
const detected = (overrides = {}) => ({
  title: 'Clarification on pump package', customer_name: 'Example Energy LLC',
  submission_date: '2026-10-12', due_date: '2026-10-15', request_type_code: 'RFT',
  tender_reference: 'RFT-2026-1015', estimated_value: '850000.50', currency: 'AED',
  expected_award_date: '2026-11-30', deadline_date: '2026-10-15',
  scope_type: 'feed', scope_summary: 'Pump package engineering and compliance review.',
  evidence: { customer_name: 'Customer: Example Energy LLC', submission_date: 'Submission date: 12 October 2026', due_date: 'Due date: 15 October 2026', request_type_code: 'Request for tender (RFT)' },
  warnings: [], ...overrides,
})
const canonicalClient = (overrides = {}) => ({ id: 'client-one', company_name: 'Example Energy LLC', legal_name: 'Example Energy LLC', email: 'sales@example-energy.test', website: 'https://example-energy.test', ...overrides })
const opportunityDetails = (overrides = {}) => detail(message(), {
  can_create_opportunity: true, source_token: 'synthetic-source-token-1',
  extracted_information: detected(), ...overrides,
})
const textNode = text => ({ type: 'text', text })
const element = (type, children = [], props = {}) => ({ type, children, ...props })
const richBody = () => [
  element('p', [textNode('Dear Sales team,')]),
  element('p', [textNode('Please review the '), element('strong', [textNode('revised pump package')]), textNode(' and confirm these items:')]),
  element('ul', [element('li', [textNode('Confirm the delivery schedule.')]), element('li', [textNode('Include the technical compliance statement.')])]),
  element('table', [
    element('caption', [textNode('Equipment schedule')]),
    element('thead', [element('tr', ['Item', 'Quantity', 'Required date'].map(value => element('th', [textNode(value)])))]),
    element('tbody', [
      element('tr', ['Pump assembly', '2 sets', '15 October 2026'].map(value => element('td', [textNode(value)]))),
      element('tr', [element('td', [textNode('Inspection required before delivery')], { col_span: 3 })]),
    ]),
  ]),
  element('p', [textNode('Reference: '), element('a', [textNode('Package specification')], { href: 'https://documents.example.test/specifications/pumps' })]),
  element('p', [textNode('Kind regards,'), element('br'), textNode('Ava Khan')]),
]
const region = page => page.getByRole('region', { name: 'Shared mailbox messages', exact: true })
const preview = page => page.getByRole('region', { name: 'Email preview', exact: true })
const refresh = page => region(page).getByRole('button', { name: 'Refresh emails', exact: true })
const row = (page, subject = message().subject) => region(page).getByRole('button').filter({ hasText: subject })
const opportunityDialog = page => page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
const navigateView = (page, view) => page.evaluate(value => window.setSalesMailboxMessageView(value), view)
const conversionRequests = state => state.requests.filter(request => request.path === conversionPath('shared-1') && request.method === 'POST')
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

async function prepare(page, options = {}) {
  const state = {
    requests: [], errors: [], unexpected: [],
    connections: paginated([mailbox()]), connectionStatus: 200,
    messages: listing(), messageStatus: 200, details: detail(), detailStatus: 200,
    imported: paginated([]), clients: paginated([]), clientStatus: 200,
    allowConversion: false, conversionStatus: 201,
    conversion: { opportunity: { id: 'created-opportunity', deal_name: 'Reviewed pump package' }, created: true },
    ...options,
  }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(({ collapsed }) => {
    localStorage.setItem('radai_access_token', 'mailbox-fixture-user-11')
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 900, user: { id: 11 }, email: 'first-admin@example.test' }))
    localStorage.setItem('radai.sidebar.collapsed', String(Boolean(collapsed)))
  }, { collapsed: options.collapsed })
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
      state.unexpected.push(`External request: ${url.origin}`)
      return route.abort()
    }
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    state.requests.push({ path: url.pathname, method: request.method(), query: url.search, authorization: request.headers().authorization, body: request.method() === 'POST' ? request.postDataJSON() : null })
    if (request.method() !== 'GET') {
      if (state.allowConversion && request.method() === 'POST' && url.pathname === conversionPath('shared-1')) {
        const response = state.conversionHandler
          ? await state.conversionHandler({ request, url })
          : { status: state.conversionStatus, body: structuredClone(state.conversion), hold: state.conversionHold }
        if (response.hold) await response.hold.promise
        return route.fulfill({ status: response.status ?? 201, json: response.body })
      }
      state.unexpected.push(`${request.method()} ${url.pathname}`)
      return route.fulfill({ status: 405, json: { detail: 'Only reads allowed in fixture.' } })
    }
    let response
    if (url.pathname === connectionsPath) {
      response = state.connectionHandler
        ? await state.connectionHandler({ request, url })
        : { body: structuredClone(state.connections), status: state.connectionStatus, hold: state.connectionHold }
    } else if (/\/mailbox-connections\/[^/]+\/messages\/$/.test(url.pathname)) {
      response = state.messageHandler
        ? await state.messageHandler({ request, url })
        : { body: structuredClone(state.messages), status: state.messageStatus, hold: state.messageHold }
    } else if (/\/mailbox-connections\/[^/]+\/message\/$/.test(url.pathname)) {
      response = state.detailHandler
        ? await state.detailHandler({ request, url })
        : { body: structuredClone(state.details), status: state.detailStatus, hold: state.detailHold }
    } else if (url.pathname === '/api/v1/sales/email-intakes/') {
      response = { body: structuredClone(state.imported) }
    } else if (url.pathname === '/api/v1/sales/clients/') {
      response = state.clientHandler
        ? await state.clientHandler({ request, url })
        : { body: structuredClone(state.clients), status: state.clientStatus, hold: state.clientHold }
    } else if (state.shell && url.pathname === '/api/v1/rbac/users/me/') {
      response = { body: { id: 900, user: { id: 11, email: 'first-admin@example.test' }, roles: [], modules: [{ code: 'sales' }, { code: 'sales_email_intake' }] } }
    } else if (state.shell && url.pathname === '/api/v1/users/employees/my-profile-photo/') {
      response = { status: 404, body: { detail: 'No profile photo.' } }
    } else if (state.shell && url.pathname === '/api/v1/notifications/unread_count/') {
      response = { body: { unread_count: 0 } }
    } else if (state.shell && url.pathname === '/api/v1/notifications/push-config/') {
      response = { body: { available: false, public_key: '' } }
    } else if (state.shell && ['/api/v1/procurement/requisitions/pending-for-me/', '/api/v1/procurement/orders/pending-for-me/'].includes(url.pathname)) {
      response = { body: paginated([]) }
    } else {
      state.unexpected.push(`${request.method()} ${url.pathname}`)
      response = { status: 404, body: { detail: 'Unexpected fixture request.' } }
    }
    if (response.hold) await response.hold.promise
    await route.fulfill({ status: response.status ?? 200, json: response.body })
  })
  const fixtureParameters = new URLSearchParams()
  if (options.shell) fixtureParameters.set('shell', 'true')
  if (options.view === 'imported') fixtureParameters.set('view', 'imported')
  await page.goto(`/tests/fixtures/sales-shared-mailbox-messages.html${fixtureParameters.size ? `?${fixtureParameters}` : ''}`)
  return state
}

function assertReadOnly(state) {
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
  expect(state.requests.every(request => request.method === 'GET')).toBe(true)
  expect(state.requests.filter(request => request.path === connectionsPath).every(request => !new URLSearchParams(request.query).has('mine'))).toBe(true)
}

function assertExplicitConversionOnly(state) {
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
  expect(state.requests.every(request => request.method === 'GET' || (request.method === 'POST' && request.path === conversionPath('shared-1')))).toBe(true)
}

async function openOpportunityForm(page) {
  await row(page).click()
  await preview(page).getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(opportunityDialog(page)).toBeVisible()
  return opportunityDialog(page)
}

async function reviewedForm(page) {
  const dialog = await openOpportunityForm(page)
  await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption('client-one')
  await dialog.getByLabel('Opportunity name', { exact: true }).fill('Reviewed pump package')
  await dialog.getByLabel('Estimated value', { exact: true }).fill('275000.25')
  await dialog.getByLabel('Expected award date', { exact: true }).fill('2026-12-15')
  await dialog.getByLabel('Proposal deadline', { exact: true }).fill('2026-10-20')
  return dialog
}

test('Email Intake opens actual shared mail by default and loads a plain-text preview only on selection', async ({ page }, testInfo) => {
  const state = await prepare(page)
  await expect(page.getByRole('navigation', { name: 'Email views' })).toHaveCount(0)
  await expect(region(page)).toContainText('All mail')
  await expect(row(page)).toBeVisible()
  await expect(row(page, 'Site access update')).toBeVisible()
  await expect(region(page)).toContainText('Ava Khan')
  expect(state.requests.filter(request => request.path.endsWith('/message/'))).toHaveLength(0)
  expect(state.requests.filter(request => request.path.includes('email-intakes'))).toHaveLength(0)
  await row(page).click()
  await expect(preview(page)).toContainText('Please confirm revision C for the pump package.')
  await expect(preview(page)).toContainText('ava@example.test')
  await expect(preview(page)).toContainText('sales@example.test')
  await expect(preview(page)).toContainText('projects@example.test')
  expect(new URLSearchParams(state.requests.find(request => request.path === detailPath('shared-1')).query).get('message_id')).toBe(message().id)
  await expect(region(page).getByRole('button', { name: /send|enable|import|mark.*read|convert/i })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('sales-shared-mailbox-messages-integrated.png'), fullPage: true })
  assertReadOnly(state)
})

test('next and previous preserve opaque cursors while refresh returns to newest mail', async ({ page }) => {
  const cursor = 'opaque-signed.cursor+/=value'
  const state = await prepare(page, { messageHandler: ({ url }) => ({ body: url.searchParams.get('cursor')
    ? listing([message({ id: 'older-message', subject: 'Older supplier update' })])
    : listing([message()], cursor) }),
  })
  const next = region(page).getByRole('button', { name: 'Next page', exact: true })
  const previous = region(page).getByRole('button', { name: 'Previous page', exact: true })
  await expect(row(page)).toBeVisible()
  await expect(previous).toBeDisabled()
  await next.click()
  await expect(row(page, 'Older supplier update')).toBeVisible()
  await expect(row(page)).toHaveCount(0)
  await expect(next).toBeDisabled()
  await previous.click()
  await expect(row(page)).toBeVisible()
  await next.click()
  await expect(row(page, 'Older supplier update')).toBeVisible()
  await refresh(page).click()
  await expect(row(page)).toBeVisible()
  await expect(previous).toBeDisabled()
  expect(state.requests.filter(request => request.path === messagesPath('shared-1')).map(request => new URLSearchParams(request.query).get('cursor'))).toEqual([null, cursor, null, cursor, null])
  assertReadOnly(state)
})

test('expired paging clears old mail and refresh recovers from the newest page', async ({ page }) => {
  const state = await prepare(page, { messageHandler: ({ url }) => url.searchParams.has('cursor')
    ? { status: 410, body: { detail: 'private-expired-cursor-value' } }
    : { body: listing([message()], 'expired-synthetic-cursor') },
  })
  await expect(row(page)).toBeVisible()
  await region(page).getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(region(page).getByRole('alert')).toHaveText('Mailbox page has expired. Refresh emails to continue.')
  await expect(row(page)).toHaveCount(0)
  await expect(region(page)).not.toContainText('private-expired-cursor-value')
  await refresh(page).click()
  await expect(row(page)).toBeVisible()
  await expect(region(page).getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled()
  expect(state.requests.filter(request => request.path === messagesPath('shared-1')).map(request => new URLSearchParams(request.query).get('cursor'))).toEqual([null, 'expired-synthetic-cursor', null])
  assertReadOnly(state)
})

test('malformed mail results are reported as a failure rather than an empty mailbox', async ({ page }) => {
  const state = await prepare(page, { messages: { mailbox_address: 'sales@example.test', results: 'private-invalid-payload', next_cursor: null } })
  await expect(region(page).getByRole('alert')).toHaveText('Mailbox emails could not be loaded. Try again.')
  await expect(region(page)).not.toContainText(/No emails in this mailbox|private-invalid-payload/)
  state.messages = listing()
  await refresh(page).click()
  await expect(row(page)).toBeVisible()
  assertReadOnly(state)
})

test('connection pagination filters delegated mailboxes and waits for complete authorized choices', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { connectionHandler: ({ url }) => url.searchParams.get('page') === '2'
    ? { body: paginated([mailbox({ id: 'shared-2', mailbox_address: 'projects@example.test' })]), hold }
    : { body: paginated([mailbox(), mailbox({ id: 'personal', auth_mode: 'delegated', mailbox_address: 'personal@example.test' })], `${connectionsPath}?page=2`) },
  })
  await expect(page.getByRole('status')).toContainText('Loading shared mailboxes')
  expect(state.requests.filter(request => request.path.endsWith('/messages/'))).toHaveLength(0)
  hold.resolve()
  const selector = page.getByRole('combobox', { name: 'Mailbox', exact: true })
  await expect(selector.getByRole('option')).toHaveCount(3)
  await selector.selectOption('shared-1')
  await expect(row(page)).toBeVisible()
  await expect(selector).not.toContainText('personal@example.test')
  assertReadOnly(state)
})

test('loading, an empty authorized mailbox, and missing connections have distinct states', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { messages: listing([]), messageHold: hold })
  await expect(region(page)).toContainText('Loading mailbox emails')
  await expect(region(page)).not.toContainText('No emails in this mailbox.')
  hold.resolve()
  await expect(region(page)).toContainText('No emails in this mailbox.')
  await expect(region(page).getByRole('alert')).toHaveCount(0)
  state.connections = paginated([])
  await page.reload()
  await expect(page.getByText('No shared mailbox is available to your account.', { exact: true })).toBeVisible()
  await expect(region(page)).toHaveCount(0)
  assertReadOnly(state)
})

for (const scenario of [
  { name: 'denied', status: 403, text: 'You do not have access to this mailbox.' },
  { name: 'provider failure', status: 502, text: 'Mailbox emails could not be loaded. Try again.' },
]) {
  test(`${scenario.name} displays a safe failure instead of empty mail or a raw provider payload`, async ({ page }) => {
    const state = await prepare(page, { messageStatus: scenario.status, messages: { detail: 'sensitive-provider-payload@example.test token=secret-fixture-value' } })
    await expect(region(page).getByRole('alert')).toContainText(scenario.text)
    await expect(region(page)).not.toContainText(/No emails in this mailbox|sensitive-provider-payload|secret-fixture-value/)
    state.messageStatus = 200
    state.messages = listing()
    await refresh(page).click()
    await expect(row(page)).toBeVisible()
    assertReadOnly(state)
  })
}

test('revoked mailbox access clears already displayed message and preview content', async ({ page }) => {
  const state = await prepare(page)
  await row(page).click()
  await expect(preview(page)).toContainText('Please confirm revision C')
  state.messageStatus = 403
  state.messages = { detail: 'private provider reason' }
  await refresh(page).click()
  await expect(region(page).getByRole('alert')).toContainText('You do not have access to this mailbox.')
  await expect(region(page)).not.toContainText(/Clarification on pump package|Ava Khan|Please confirm revision C|private provider reason/)
  assertReadOnly(state)
})

for (const denied of [
  { status: 403, text: 'You do not have access to this mailbox.' },
  { status: 404, text: 'This mailbox or email is no longer available. Refresh emails.' },
]) {
  test(`preview failure allows a safe retry while detail ${denied.status} clears all email content`, async ({ page }) => {
    const state = await prepare(page, { detailStatus: 502, details: { detail: 'private-email-provider-diagnostic' } })
    await row(page).click()
    await expect(preview(page).getByRole('alert')).toHaveText('Email could not be loaded. Try again.')
    await expect(row(page)).toBeVisible()
    await expect(preview(page)).not.toContainText('private-email-provider-diagnostic')
    state.detailStatus = 200
    state.details = detail()
    await preview(page).getByRole('button', { name: 'Retry email', exact: true }).click()
    await expect(preview(page)).toContainText('Please confirm revision C')
    state.detailStatus = denied.status
    state.details = { detail: 'private-access-denial' }
    await row(page, 'Site access update').click()
    await expect(region(page).getByRole('alert')).toHaveText(denied.text)
    await expect(region(page)).not.toContainText(/Clarification on pump package|Site access update|Please confirm revision C|private-access-denial/)
    assertReadOnly(state)
  })
}

test('a missing text body is a retryable preview failure and cannot display partial details as success', async ({ page }) => {
  const state = await prepare(page, { details: { ...message(), to_recipients: [], cc_recipients: [] } })
  await row(page).click()
  await expect(preview(page).getByRole('alert')).toHaveText('Email could not be loaded. Try again.')
  await expect(preview(page)).not.toContainText('This email has no text content.')
  state.details = detail()
  await preview(page).getByRole('button', { name: 'Retry email', exact: true }).click()
  await expect(preview(page)).toContainText('Please confirm revision C')
  assertReadOnly(state)
})

test('selecting another email ignores a late preview from the first email', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { detailHandler: ({ url }) => url.searchParams.get('message_id') === message().id
    ? { body: detail(message(), { body_text: 'Obsolete first preview' }), hold }
    : { body: detail(secondMessage(), { body_text: 'Current second preview' }) },
  })
  await row(page).click()
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/message/')).length).toBe(1)
  await row(page, 'Site access update').click()
  await expect(preview(page)).toContainText('Current second preview')
  const arrived = page.waitForResponse(response => new URL(response.url()).searchParams.get('message_id') === message().id)
  hold.resolve()
  await arrived
  await expect(preview(page)).toContainText('Current second preview')
  await expect(region(page)).not.toContainText('Obsolete first preview')
  assertReadOnly(state)
})

test('mailbox changes discard an old delayed preview and reset pagination', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, {
    connections: paginated([mailbox(), mailbox({ id: 'shared-2', name: 'Projects mailbox', mailbox_address: 'projects@example.test' })]),
    messageHandler: ({ url }) => ({ body: url.pathname === messagesPath('shared-1') ? listing() : listing([message({ id: 'project-message', subject: 'Project mailbox correspondence' })], null, 'projects@example.test') }),
    detailHold: hold,
  })
  await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-1')
  await row(page).click()
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/message/')).length).toBe(1)
  await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-2')
  await expect(row(page, 'Project mailbox correspondence')).toBeVisible()
  await expect(region(page)).not.toContainText('Clarification on pump package')
  const arrived = page.waitForResponse(response => new URL(response.url()).pathname === detailPath('shared-1'))
  hold.resolve()
  await arrived
  await expect(region(page)).not.toContainText('Please confirm revision C')
  await expect(region(page).getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled()
  assertReadOnly(state)
})

test('account changes and sign-out discard late mail without displaying the previous identity data', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, {
    messageHandler: ({ request }) => request.headers().authorization === 'Bearer mailbox-fixture-user-11'
      ? { body: listing(), hold }
      : { body: listing([message({ id: 'account-two-message', subject: 'Second account mail' })]) },
  })
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/messages/')).length).toBe(1)
  await page.evaluate(() => window.setSalesMailboxMessageActor({ id: 900, user: { id: 22 }, email: 'second-admin@example.test' }))
  await expect(row(page, 'Second account mail')).toBeVisible()
  const arrived = page.waitForResponse(response => response.request().headers().authorization === 'Bearer mailbox-fixture-user-11' && new URL(response.url()).pathname.endsWith('/messages/'))
  hold.resolve()
  await arrived
  await expect(region(page)).not.toContainText('Clarification on pump package')
  await page.evaluate(() => window.setSalesMailboxMessageActor(null))
  await expect(region(page)).toHaveCount(0)
  assertReadOnly(state)
})

test('hostile HTML in email fields stays literal text and cannot execute or fetch remote images', async ({ page }) => {
  const hostile = '<img src="https://untrusted.example.test/pixel" onerror="window.mailboxInjected=true"><script>window.mailboxInjected=true</script>'
  const record = message({ subject: '<b>Untrusted email subject</b>', body_preview: hostile })
  const state = await prepare(page, { messages: listing([record]), details: detail(record, { body_text: hostile }) })
  await row(page, record.subject).click()
  await expect(preview(page)).toContainText(hostile)
  await expect(region(page).locator('img, iframe, script')).toHaveCount(0)
  expect(await page.evaluate(() => window.mailboxInjected)).toBeUndefined()
  assertReadOnly(state)
})

test('Imported enquiries remains reachable as a separate existing review workflow', async ({ page }) => {
  const state = await prepare(page, { imported: paginated([{
    ...message({ id: 'intake-record', subject: 'Previously imported enquiry' }),
    status: 'received', extracted_data: {}, attachments: [], can_create_opportunity: true,
  }]) })
  await expect(row(page)).toBeVisible()
  await navigateView(page, 'imported')
  await expect(page.getByRole('navigation', { name: 'Email intake status' })).toBeVisible()
  await expect(region(page)).toHaveCount(0)
  await expect.poll(() => state.requests.filter(request => request.path === '/api/v1/sales/email-intakes/').length).toBe(1)
  await expect(page.getByRole('heading', { name: 'Previously imported enquiry', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start review', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create opportunity', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  await navigateView(page, 'shared')
  await expect(row(page)).toBeVisible()
  assertReadOnly(state)
})

test('keyboard selection and refresh work at narrow widths with accessible list and preview', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 })
  const record = message({ subject: 'Long project subject requiring readable wrapping on a narrow mobile screen', sender_email: 'very-long-external-contact-name@example.test' })
  const state = await prepare(page, { messages: listing([record]), details: detail(record) })
  await expect(row(page, record.subject)).toBeVisible()
  await row(page, record.subject).focus()
  await page.keyboard.press('Enter')
  await expect(preview(page)).toContainText('Please confirm revision C')
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }))
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width)
  const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('sales-shared-mailbox-messages-narrow.png'), fullPage: true })
  await refresh(page).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => state.requests.filter(request => request.path.endsWith('/messages/')).length).toBe(2)
  await expect(row(page, record.subject)).toBeVisible()
  assertReadOnly(state)
})

test('the compact mailbox layout removes redundant headings and gives the preview more horizontal space', async ({ page }) => {
  const state = await prepare(page)
  await row(page).click()
  await expect(preview(page)).toContainText('Please confirm revision C')
  const heading = await page.getByRole('heading', { name: 'Email Intake', exact: true }).boundingBox()
  const mailboxList = await page.getByRole('complementary', { name: 'Mailbox emails', exact: true }).boundingBox()
  const messagePreview = await preview(page).boundingBox()
  expect(heading.y).toBeLessThan(mailboxList.y)
  await expect(page.getByRole('navigation', { name: 'Email views' })).toHaveCount(0)
  await expect(region(page).getByRole('heading', { name: 'All mail', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Detected information', exact: true })).toHaveCount(0)
  await expect(page.getByText('Suggestions from the email. Review them before creating an opportunity.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('This page', { exact: true })).toHaveCount(0)
  const summary = page.getByRole('complementary', { name: 'Mailbox emails', exact: true }).getByRole('status')
  await expect(summary).toContainText('2 emails on this page')
  const summaryBounds = await summary.boundingBox()
  expect(summaryBounds.height).toBeLessThanOrEqual(1)
  expect(summaryBounds.width).toBeLessThanOrEqual(1)
  expect(Math.abs((await row(page).boundingBox()).y - mailboxList.y)).toBeLessThanOrEqual(1)
  expect(mailboxList.width).toBeGreaterThanOrEqual(260)
  expect(mailboxList.width).toBeLessThanOrEqual(320)
  expect(messagePreview.x).toBeGreaterThanOrEqual(mailboxList.x + mailboxList.width - 1)
  expect(Math.abs(messagePreview.y - mailboxList.y)).toBeLessThanOrEqual(2)
  assertReadOnly(state)
})

test('live read filters and search affect only the current page and keep actual counts', async ({ page }) => {
  const records = [message(), secondMessage(), message({ id: 'draft-message', subject: 'Draft commercial response', sender_name: 'Draft owner', is_draft: true, is_read: true })]
  const state = await prepare(page, { messages: listing(records, 'another-mail-page') })
  await expect(row(page)).toBeVisible()
  const filters = page.getByRole('navigation', { name: 'Email read status', exact: true })
  const unread = filters.getByRole('button', { name: /^Unread\b/ })
  const read = filters.getByRole('button', { name: /^Read\b/ })
  const drafts = filters.getByRole('button', { name: /^Drafts\b/ })
  const all = filters.getByRole('button', { name: /^All mail\b/ })
  await expect(all).toContainText('3')
  await expect(unread).toContainText('1')
  await expect(read).toContainText('2')
  await expect(drafts).toContainText('1')
  await unread.click()
  await expect(row(page)).toBeVisible()
  await expect(row(page, 'Site access update')).toHaveCount(0)
  await read.click()
  await expect(row(page)).toHaveCount(0)
  await expect(row(page, 'Site access update')).toBeVisible()
  await drafts.click()
  await expect(row(page, 'Draft commercial response')).toBeVisible()
  await expect(row(page, 'Site access update')).toHaveCount(0)
  await all.click()
  const search = page.getByRole('searchbox', { name: 'Search emails on this page', exact: true })
  await search.fill('Noah')
  await expect(row(page, 'Site access update')).toBeVisible()
  await expect(row(page)).toHaveCount(0)
  await search.fill('No matching synthetic sender')
  await expect(search).toHaveValue('No matching synthetic sender')
  await expect(region(page)).not.toContainText('No emails in this mailbox.')
  await expect(region(page).getByRole('button', { name: 'Next page', exact: true })).toBeEnabled()
  await search.fill('')
  await expect(row(page)).toBeVisible()
  expect(state.requests.filter(request => request.path.endsWith('/messages/'))).toHaveLength(1)
  assertReadOnly(state)
})

test('rich email paragraphs, lists, tables and links retain their readable structure', async ({ page }, testInfo) => {
  const state = await prepare(page, { details: detail(message(), { body_text: 'Original fallback text', body_content: richBody() }) })
  await row(page).click()
  const body = preview(page).locator('.sales-email-body')
  await expect(body.locator('p')).toHaveCount(4)
  await expect(body.locator('strong')).toHaveText('revised pump package')
  await expect(body.getByRole('listitem')).toHaveText(['Confirm the delivery schedule.', 'Include the technical compliance statement.'])
  await expect(body.getByRole('columnheader')).toHaveText(['Item', 'Quantity', 'Required date'])
  await expect(body.getByRole('table', { name: 'Equipment schedule', exact: true })).toBeVisible()
  await expect(body.getByRole('cell', { name: 'Inspection required before delivery', exact: true })).toHaveAttribute('colspan', '3')
  const link = body.getByRole('link', { name: 'Package specification', exact: true })
  await expect(link).toHaveAttribute('href', 'https://documents.example.test/specifications/pumps')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', /noopener/)
  await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer')
  await expect(body).not.toContainText('Original fallback text')
  const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('sales-email-rich-reference-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 1536, height: 960 })
  const bodyPanel = await preview(page).locator('.sales-email-body-panel').boundingBox()
  const sourcePanel = await preview(page).locator('.sales-email-source-panel').boundingBox()
  expect(bodyPanel.width).toBeGreaterThan(420)
  expect(sourcePanel.x).toBeGreaterThan(bodyPanel.x + bodyPanel.width)
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(width.document).toBeLessThanOrEqual(width.viewport)
  await page.screenshot({ path: testInfo.outputPath('sales-email-rich-reference-wide.png'), fullPage: true })
  assertReadOnly(state)
})

test('semantic email nodes cannot inject active elements, styling, attributes or unsafe links', async ({ page }) => {
  const hostile = '<img src="https://untrusted.example.test/image" onerror="window.mailboxInjected=true">'
  const content = [
    element('p', [textNode('Visible safe paragraph')], { style: { backgroundImage: 'url(https://untrusted.example.test/css)' }, className: 'injected-class', onClick: 'window.mailboxInjected=true', dangerouslySetInnerHTML: { __html: hostile } }),
    ...['script', 'iframe', 'img', 'style', 'svg', 'object', 'video', 'audio'].map(type => element(type, [textNode('window.mailboxInjected=true')], { src: 'https://untrusted.example.test/tracker' })),
    ...['javascript:window.mailboxInjected=true', 'data:text/html,unsafe', '//untrusted.example.test/path', 'https://user:password@untrusted.example.test/path', 'mailto:sales@example.test?subject=hello%0d%0aBcc:unsafe@example.test'].map(href => element('p', [element('a', [textNode('Unsafe link text')], { href })])),
    element('p', [element('a', [textNode('Safe website')], { href: 'https://documents.example.test/reference' })]),
    element('p', [element('a', [textNode('Email sales')], { href: 'mailto:sales@example.test' })]),
    element('p', [textNode(hostile)]),
  ]
  const state = await prepare(page, { details: detail(message(), { body_content: content }) })
  await row(page).click()
  const body = preview(page).locator('.sales-email-body')
  await expect(body.getByText('Visible safe paragraph', { exact: true })).toBeVisible()
  await body.getByText('Visible safe paragraph', { exact: true }).click()
  await expect(body.locator('script,img,iframe,style,svg,object,video,audio,[onclick],[onerror],.injected-class,[style]')).toHaveCount(0)
  await expect(body.getByRole('link')).toHaveCount(2)
  await expect(body).toContainText(hostile)
  await expect(body).not.toContainText('window.mailboxInjected=truewindow.mailboxInjected=true')
  expect(await page.evaluate(() => window.mailboxInjected)).toBeUndefined()
  assertReadOnly(state)
})

for (const scenario of ['malformed children', 'excessive nesting', 'excessive nodes']) {
  test(`${scenario} falls back to retained plain text without a partial rich preview`, async ({ page }) => {
    let invalid
    if (scenario === 'malformed children') invalid = [element('p', {})]
    else if (scenario === 'excessive nodes') invalid = Array.from({ length: 10001 }, () => textNode('Over-limit rich text'))
    else {
      let nested = textNode('Over-limit rich text')
      for (let index = 0; index < 45; index += 1) nested = element('div', [nested])
      invalid = [nested]
    }
    const state = await prepare(page, { details: detail(message(), {
      body_content: [element('p', [textNode('Partial rich preview must not appear')]), ...invalid],
      body_text: 'Retained plain text paragraph.\n\nSecond retained paragraph with https://documents.example.test/fallback.',
    }) })
    await row(page).click()
    const body = preview(page).locator('.sales-email-body')
    await expect(body.locator('p')).toHaveCount(2)
    await expect(body).toContainText('Retained plain text paragraph.')
    await expect(body).not.toContainText(/Partial rich preview|Over-limit rich text/)
    await expect(body.getByRole('link')).toHaveAttribute('href', 'https://documents.example.test/fallback')
    await expect(body.getByRole('table')).toHaveCount(0)
    assertReadOnly(state)
  })
}

test('a wide email table scrolls locally and remains keyboard accessible on a narrow screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 })
  const columns = ['Equipment', 'Model', 'Quantity', 'Delivery date', 'Inspection', 'Remarks']
  const content = [
    element('p', [textNode('Please review the equipment schedule below.')]),
    element('table', [
      element('tr', columns.map(value => element('th', [textNode(value)]))),
      element('tr', ['Pump package', 'P-100', '2', '15 October 2026', 'Witness required', 'Confirm compliance'].map(value => element('td', [textNode(value)]))),
    ]),
    element('p', [textNode('Kind regards, Ava')]),
  ]
  const state = await prepare(page, { details: detail(message(), { body_content: content }) })
  await row(page).click()
  const scroll = preview(page).getByRole('region', { name: 'Email table', exact: true })
  await expect(scroll.getByRole('columnheader')).toHaveCount(6)
  const sizes = await scroll.evaluate(node => ({
    tableWidth: node.scrollWidth, containerWidth: node.clientWidth,
    pageWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth,
    overflow: getComputedStyle(node).overflowX,
  }))
  expect(sizes.tableWidth).toBeGreaterThan(sizes.containerWidth)
  expect(sizes.pageWidth).toBeLessThanOrEqual(sizes.viewportWidth)
  expect(['auto', 'scroll']).toContain(sizes.overflow)
  await scroll.focus()
  await expect(scroll).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
  const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('sales-email-rich-reference-narrow.png'), fullPage: true })
  assertReadOnly(state)
})

test('imported email text keeps readable paragraphs and safe links without inventing lost tables', async ({ page }, testInfo) => {
  const state = await prepare(page, { imported: paginated([{
    ...message({ id: 'imported-readable', subject: 'Previously imported package enquiry' }),
    status: 'received', extracted_data: {}, attachments: [], can_create_opportunity: true,
    body_preview: 'Dear Sales team,\n\nPlease confirm the pump package.\nItem | Quantity | Delivery\nPump | 2 | October\n\nReference: https://documents.example.test/imported.\n\nKind regards, Ava',
  }]) })
  await expect(row(page)).toBeVisible()
  await navigateView(page, 'imported')
  const body = page.locator('.sales-email-body')
  await expect(body.locator('p')).toHaveCount(4)
  await expect(body).toContainText('Item | Quantity | Delivery')
  await expect(body.getByRole('table')).toHaveCount(0)
  await expect(body.getByRole('link')).toHaveAttribute('href', 'https://documents.example.test/imported')
  await expect(page.getByRole('button', { name: 'Start review', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create opportunity', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('sales-email-imported-reference-desktop.png'), fullPage: true })
  assertReadOnly(state)
})

test('live and imported detected fields keep source dates distinct and expose reviewable evidence', async ({ page }) => {
  const state = await prepare(page, {
    details: opportunityDetails(),
    imported: paginated([{ ...message({ id: 'detected-intake' }), status: 'received', extracted_information: detected(), can_create_opportunity: true }]),
  })
  await row(page).click()
  const checkDetection = async () => {
    const detectedRegion = page.getByRole('region', { name: 'Detected information', exact: true })
    const values = detectedRegion.locator('dl').first()
    await expect(values).toContainText('Title (Subject)')
    await expect(values).toContainText(message().subject)
    await expect(values).toContainText('Customer Name')
    await expect(values).toContainText('Example Energy LLC')
    await expect(values).toContainText('Submission Date')
    await expect(values).toContainText('2026-10-12')
    await expect(values).toContainText('Due Date')
    await expect(values).toContainText('2026-10-15')
    await expect(values).toContainText('Type of Request')
    await expect(values).toContainText('RFT')
    await detectedRegion.getByText('Source evidence', { exact: true }).click()
    await expect(detectedRegion).toContainText('Submission date: 12 October 2026')
    await expect(detectedRegion).toContainText('Due date: 15 October 2026')
  }
  await checkDetection()
  await navigateView(page, 'imported')
  await checkDetection()
  assertReadOnly(state)
})

test('missing and ambiguous detection remains unresolved without inventing customer or dates', async ({ page }) => {
  const state = await prepare(page, { details: opportunityDetails({ extracted_information: detected({
    customer_name: '', submission_date: '', due_date: '', request_type_code: '',
    evidence: { due_date: 'Due date: 03/04/2026' }, warnings: ['The due date is ambiguous and needs review.'],
  }) }) })
  await row(page).click()
  const information = page.getByRole('region', { name: 'Detected information', exact: true })
  await expect(information.locator('dl').first().getByText('Not detected', { exact: true })).toHaveCount(4)
  await information.getByText('Source evidence', { exact: true }).click()
  await expect(information).toContainText('The due date is ambiguous and needs review.')
  await expect(information).not.toContainText('Example Energy LLC')
  assertReadOnly(state)
})

for (const requestCode of ['EOI', 'EIO']) {
  test(`detected request code ${requestCode} is displayed literally without relabeling`, async ({ page }) => {
    const state = await prepare(page, { details: opportunityDetails({ extracted_information: detected({ request_type_code: requestCode }) }) })
    await row(page).click()
    const field = page.getByRole('region', { name: 'Detected information', exact: true }).locator('dl').first().locator('div').filter({ has: page.getByText('Type of Request', { exact: true }) })
    await expect(field.locator('dd')).toHaveText(requestCode)
    assertReadOnly(state)
  })
}

for (const capability of [undefined, false, 'true']) {
  test(`creation requires an explicit true server capability (${String(capability)})`, async ({ page }) => {
    const state = await prepare(page, { details: opportunityDetails({ can_create_opportunity: capability }) })
    await row(page).click()
    await expect(preview(page)).toContainText('Please confirm revision C')
    await expect(preview(page).getByRole('button', { name: 'Create opportunity', exact: true })).toHaveCount(0)
    expect(state.requests.filter(request => request.path === '/api/v1/sales/clients/')).toHaveLength(0)
    assertReadOnly(state)
  })
}

test('opening the review form loads all canonical clients and creates nothing until explicit confirmation', async ({ page }) => {
  const state = await prepare(page, {
    details: opportunityDetails(), allowConversion: true,
    clientHandler: ({ url }) => ({ body: url.searchParams.get('page') === '2'
      ? paginated([canonicalClient({ id: 'client-two', company_name: 'Example Energy Group' })])
      : paginated([canonicalClient()], '/api/v1/sales/clients/?page=2') }),
  })
  const dialog = await openOpportunityForm(page)
  const client = dialog.getByRole('combobox', { name: 'Client', exact: true })
  await expect(client.getByRole('option')).toHaveCount(3)
  await expect(client).toHaveValue('')
  await expect(client.getByRole('option', { name: /Add new client/ })).toHaveCount(0)
  await expect(dialog.getByLabel('Opportunity name', { exact: true })).toHaveValue(message().subject)
  await expect(dialog.getByLabel('Client reference', { exact: true })).toHaveValue('RFT-2026-1015')
  await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('850000.50')
  await expect(dialog.getByLabel('Expected award date', { exact: true })).toHaveValue('2026-11-30')
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('2026-10-15')
  await expect(dialog.getByLabel('Scope summary', { exact: true })).toHaveValue('Pump package engineering and compliance review.')
  await expect(dialog.getByRole('button', { name: 'Create opportunity', exact: true })).toBeDisabled()
  expect(conversionRequests(state)).toHaveLength(0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  assertReadOnly(state)
})

test('confirmed opportunity creation sends reviewed decimal and date fields with the scoped source token', async ({ page }, testInfo) => {
  const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]), allowConversion: true })
  const dialog = await reviewedForm(page)
  await dialog.getByLabel('Currency', { exact: true }).selectOption('USD')
  await dialog.getByLabel('Scope type', { exact: true }).selectOption('detailed_engineering')
  await dialog.getByLabel('Scope summary', { exact: true }).fill('Reviewed engineering package scope.')
  await page.screenshot({ path: testInfo.outputPath('sales-email-reviewed-opportunity-form.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(preview(page)).toContainText('Opportunity created.')
  await expect(preview(page).getByRole('link', { name: 'Open opportunity', exact: true })).toBeVisible()
  expect(conversionRequests(state)).toHaveLength(1)
  expect(conversionRequests(state)[0].body).toEqual({
    message_id: message().id, source_token: 'synthetic-source-token-1',
    deal_name: 'Reviewed pump package', client: 'client-one', client_reference: 'RFT-2026-1015',
    estimated_value: '275000.25', currency: 'USD', expected_close_date: '2026-12-15',
    submission_due_date: '2026-10-20', scope_type: 'detailed_engineering', description: 'Reviewed engineering package scope.',
  })
  assertExplicitConversionOnly(state)
})

test('an existing opportunity response is displayed as a repeat result rather than a new creation', async ({ page }) => {
  const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]), allowConversion: true,
    conversionStatus: 200, conversion: { opportunity: { id: 'existing-opportunity', deal_name: 'Reviewed pump package' }, created: false },
  })
  const dialog = await reviewedForm(page)
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(preview(page)).toContainText('This email already has an opportunity.')
  await expect(preview(page)).not.toContainText('Opportunity created.')
  await expect(preview(page).getByRole('link', { name: 'Open opportunity', exact: true })).toHaveAttribute('href', /existing-opportunity/)
  expect(conversionRequests(state)).toHaveLength(1)
  assertExplicitConversionOnly(state)
})

test('a missing source on creation clears unavailable mailbox content without claiming success', async ({ page }) => {
  const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]), allowConversion: true, conversionStatus: 404, conversion: { detail: 'The mailbox or email is unavailable.' } })
  const dialog = await reviewedForm(page)
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(region(page).getByRole('alert')).toContainText('This mailbox or email is no longer available.')
  await expect(region(page)).not.toContainText(/Clarification on pump package|Please confirm revision C|Opportunity created/)
  assertExplicitConversionOnly(state)
})

test('a changed retry payload reports an existing-conversion conflict without an ineffective source reload', async ({ page }) => {
  const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]), allowConversion: true, conversionStatus: 409, conversion: { code: 'email_already_converted', detail: 'This source has an existing opportunity.' } })
  const dialog = await reviewedForm(page)
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('An opportunity already exists for this email with different details.')
  await expect(dialog.locator('[name="deal_name"]')).toHaveValue('Reviewed pump package')
  await expect(dialog.getByRole('button', { name: 'Reload email details', exact: true })).toHaveCount(0)
  expect(conversionRequests(state)).toHaveLength(1)
  assertExplicitConversionOnly(state)
})

for (const scenario of [
  { status: 400, body: { estimated_value: ['Review the estimated value.'] } },
  { status: 403, body: { detail: 'You do not have permission to create this opportunity.' } },
  { status: 503, body: { detail: 'The opportunity service is unavailable.' } },
]) {
  test(`creation error ${scenario.status} preserves reviewed inputs for correction and retry`, async ({ page }) => {
    const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]), allowConversion: true, conversionStatus: scenario.status, conversion: scenario.body })
    const dialog = await reviewedForm(page)
    await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.locator('[name="deal_name"]')).toHaveValue('Reviewed pump package')
    await expect(dialog.locator('[name="estimated_value"]')).toHaveValue('275000.25')
    await expect(dialog.locator('[name="expected_close_date"]')).toHaveValue('2026-12-15')
    await expect(dialog.locator('[name="submission_due_date"]')).toHaveValue('2026-10-20')
    await expect(dialog.getByRole('combobox', { name: 'Client', exact: true })).toHaveValue('client-one')
    if (scenario.status === 400) await expect(dialog.locator('[name="estimated_value"]')).toHaveAttribute('aria-invalid', 'true')
    state.conversionStatus = 201
    state.conversion = { opportunity: { id: 'recovered-opportunity', deal_name: 'Reviewed pump package' }, created: true }
    await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(preview(page)).toContainText('Opportunity created.')
    expect(conversionRequests(state)).toHaveLength(2)
    expect(conversionRequests(state)[0].body).toEqual(conversionRequests(state)[1].body)
    assertExplicitConversionOnly(state)
  })
}

for (const status of [409, 410]) {
  test(`source ${status} requires explicit reload and review while preserving entered values`, async ({ page }) => {
    const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]), allowConversion: true, conversionStatus: status, conversion: { detail: 'Review the latest email before creating the opportunity.' } })
    const dialog = await reviewedForm(page)
    await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Create opportunity', exact: true })).toBeDisabled()
    state.details = opportunityDetails({ source_token: 'synthetic-source-token-2', body_text: 'Revised source: the delivery requirement changed.', extracted_information: detected({ due_date: '2026-10-22' }) })
    await dialog.getByRole('button', { name: 'Reload email details', exact: true }).click()
    await expect(dialog).toContainText('Email details reloaded. Review the updated email and your entries.')
    await expect(dialog.locator('[name="deal_name"]')).toHaveValue('Reviewed pump package')
    await expect(dialog.locator('[name="estimated_value"]')).toHaveValue('275000.25')
    await expect(dialog.locator('[name="submission_due_date"]')).toHaveValue('2026-10-20')
    await dialog.getByText('Review refreshed email', { exact: true }).click()
    await expect(dialog).toContainText('Revised source: the delivery requirement changed.')
    expect(conversionRequests(state)).toHaveLength(1)
    state.conversionStatus = 201
    state.conversion = { opportunity: { id: 'fresh-source-opportunity', deal_name: 'Reviewed pump package' }, created: true }
    await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(conversionRequests(state)).toHaveLength(2)
    expect(conversionRequests(state)[1].body.source_token).toBe('synthetic-source-token-2')
    expect(conversionRequests(state)[1].body.submission_due_date).toBe('2026-10-20')
    assertExplicitConversionOnly(state)
  })
}

test('missing clients and denied client options do not invent a customer or hide the source email', async ({ page }) => {
  const state = await prepare(page, { details: opportunityDetails(), allowConversion: true })
  let dialog = await openOpportunityForm(page)
  await expect(dialog).toContainText('No clients are available to your account.')
  await expect(dialog.getByRole('button', { name: 'Create opportunity', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(preview(page)).toContainText('Please confirm revision C')
  state.clientStatus = 403
  state.clients = { detail: 'Client access denied.' }
  await preview(page).getByRole('button', { name: 'Create opportunity', exact: true }).click()
  dialog = opportunityDialog(page)
  await expect(dialog).toContainText('You do not have access to client options.')
  await expect(dialog.getByRole('button', { name: 'Create opportunity', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('combobox', { name: 'Client', exact: true })).toBeDisabled()
  assertReadOnly(state)
})

test('unknown amount and award date require reviewer input and do not default to fabricated values', async ({ page }) => {
  const state = await prepare(page, { details: opportunityDetails({ extracted_information: detected({ estimated_value: '', expected_award_date: '', deadline_date: '', due_date: '', scope_summary: '' }) }), clients: paginated([canonicalClient()]), allowConversion: true })
  const dialog = await openOpportunityForm(page)
  await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption('client-one')
  await expect(dialog.getByLabel('Estimated value', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Expected award date', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Proposal deadline', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Scope summary', { exact: true })).toHaveValue('')
  await dialog.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  expect(conversionRequests(state)).toHaveLength(0)
  await expect(dialog).toBeVisible()
  assertReadOnly(state)
})

test('a pending creation prevents duplicate submission and an account switch ignores its late response', async ({ page }) => {
  const hold = deferred()
  const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]), allowConversion: true, conversionHold: hold })
  const dialog = await reviewedForm(page)
  const submit = dialog.getByRole('button', { name: 'Create opportunity', exact: true })
  await submit.click()
  await expect(dialog.getByRole('button', { name: 'Creating…', exact: true })).toBeDisabled()
  await dialog.locator('button[type="submit"]').evaluate(button => button.click())
  await expect.poll(() => conversionRequests(state).length).toBe(1)
  state.messages = listing([message({ id: 'another-user-email', subject: 'Another account correspondence' })])
  state.details = detail()
  await page.evaluate(() => window.setSalesMailboxMessageActor({ id: 900, user: { id: 22 }, email: 'second-admin@example.test' }))
  await expect(row(page, 'Another account correspondence')).toBeVisible()
  await expect(dialog).toHaveCount(0)
  const arrived = page.waitForResponse(response => new URL(response.url()).pathname === conversionPath('shared-1'))
  hold.resolve()
  await arrived
  await expect(region(page)).not.toContainText('Opportunity created.')
  await expect(region(page).getByRole('link', { name: 'Open opportunity', exact: true })).toHaveCount(0)
  expect(conversionRequests(state)).toHaveLength(1)
  assertExplicitConversionOnly(state)
})

test('the reviewed opportunity dialog keeps keyboard focus and readable controls on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 })
  const state = await prepare(page, { details: opportunityDetails(), clients: paginated([canonicalClient()]) })
  const dialog = await openOpportunityForm(page)
  await expect(dialog.getByRole('combobox', { name: 'Client', exact: true }).getByRole('option')).toHaveCount(2)
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  const sizes = await dialog.evaluate(node => ({ dialog: node.getBoundingClientRect().width, viewport: window.innerWidth, page: document.documentElement.scrollWidth }))
  expect(sizes.dialog).toBeLessThanOrEqual(sizes.viewport)
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport)
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('sales-email-reviewed-opportunity-mobile.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(preview(page).getByRole('button', { name: 'Create opportunity', exact: true })).toBeFocused()
  assertReadOnly(state)
})

const longMailbox = () => Array.from({ length: 30 }, (_, index) => message({
  id: `scroll-email-${index}`, subject: `Engineering correspondence ${String(index + 1).padStart(2, '0')}`,
}))
const longDetail = record => detail(record, {
  body_text: Array.from({ length: 70 }, (_, index) => `Section ${index + 1}: Review the equipment specification and confirm the documented delivery requirements.`).join('\n\n'),
  extracted_information: detected(), can_create_opportunity: true, source_token: 'synthetic-scroll-review-token',
  cc_recipients: Array.from({ length: 35 }, (_, index) => ({ name: `Engineering contact ${index + 1}`, email: `engineering-contact-${index + 1}@example.test` })),
})
const panePosition = page => page.evaluate(() => ({
  document: document.scrollingElement.scrollTop,
  main: document.querySelector('main.main-content')?.scrollTop ?? 0,
  list: document.querySelector('.sales-email-list-scroll')?.scrollTop ?? 0,
  reading: document.querySelector('.sales-email-reading-pane')?.scrollTop ?? 0,
  source: document.querySelector('.sales-email-source-panel')?.scrollTop ?? 0,
}))

for (const collapsed of [false, true]) {
  test(`the actual desktop shell keeps list, reading and wider source panes independently scrollable (${collapsed ? 'collapsed' : 'expanded'} sidebar)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: collapsed ? 1680 : 1536, height: 960 })
    const records = longMailbox()
    const state = await prepare(page, { shell: true, collapsed, messages: listing(records, 'next-scroll-page'), details: longDetail(records[0]) })
    await row(page, records[0].subject).click()
    const reading = preview(page).locator('.sales-email-reading-pane')
    const source = preview(page).locator('.sales-email-source-panel')
    const listPane = page.locator('.sales-email-list-scroll')
    await expect(reading).toContainText('Section 70:')
    const main = page.locator('main.main-content')
    const dimensions = await main.evaluate(node => ({
      height: node.clientHeight, content: node.scrollHeight,
      pageWidth: document.documentElement.scrollWidth, viewport: window.innerWidth,
      documentHeight: document.scrollingElement.scrollHeight, viewportHeight: window.innerHeight,
    }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.height + 1)
    expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewport)
    expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1)
    const sourceBounds = await source.boundingBox()
    expect(sourceBounds.width).toBeGreaterThanOrEqual(collapsed ? 359 : 339)
    expect(sourceBounds.width).toBeLessThanOrEqual(collapsed ? 361 : 341)
    for (const pane of [reading, source, listPane]) {
      const bounds = await pane.evaluate(node => ({ height: node.clientHeight, content: node.scrollHeight, overflow: getComputedStyle(node).overflowY }))
      expect(bounds.content).toBeGreaterThan(bounds.height)
      expect(['auto', 'scroll']).toContain(bounds.overflow)
    }
    const headerBefore = await page.locator('.sales-email-page-header').boundingBox()
    const toolbarBefore = await page.locator('.sales-email-toolbar').boundingBox()
    const subjectBefore = await preview(page).locator('.sales-email-preview-header').boundingBox()
    const pagingBefore = await region(page).getByRole('button', { name: 'Next page', exact: true }).boundingBox()
    await reading.hover()
    await page.mouse.wheel(0, 420)
    await expect.poll(async () => (await panePosition(page)).reading).toBeGreaterThan(0)
    const afterReading = await panePosition(page)
    expect(afterReading).toMatchObject({ document: 0, main: 0, list: 0, source: 0 })
    await listPane.hover()
    await page.mouse.wheel(0, 420)
    await expect.poll(async () => (await panePosition(page)).list).toBeGreaterThan(0)
    expect((await panePosition(page)).reading).toBe(afterReading.reading)
    await source.hover()
    await page.mouse.wheel(0, 420)
    await expect.poll(async () => (await panePosition(page)).source).toBeGreaterThan(0)
    expect(await panePosition(page)).toMatchObject({ document: 0, main: 0, reading: afterReading.reading })
    expect(await page.locator('.sales-email-page-header').boundingBox()).toEqual(headerBefore)
    expect(await page.locator('.sales-email-toolbar').boundingBox()).toEqual(toolbarBefore)
    expect(await preview(page).locator('.sales-email-preview-header').boundingBox()).toEqual(subjectBefore)
    expect(await region(page).getByRole('button', { name: 'Next page', exact: true }).boundingBox()).toEqual(pagingBefore)
    await reading.focus()
    await expect(reading).toBeFocused()
    const keyboardStart = (await panePosition(page)).reading
    await page.keyboard.press('PageDown')
    await expect.poll(async () => (await panePosition(page)).reading).toBeGreaterThan(keyboardStart)
    await reading.evaluate(node => { node.scrollTop = node.scrollHeight })
    await reading.hover()
    await page.mouse.wheel(0, 500)
    expect(await panePosition(page)).toMatchObject({ document: 0, main: 0 })
    const accessibility = await new AxeBuilder({ page }).include('.sales-email-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(accessibility.violations).toEqual([])
    await reading.evaluate(node => { node.scrollTop = 0 })
    await source.evaluate(node => { node.scrollTop = 0 })
    await listPane.evaluate(node => { node.scrollTop = 0 })
    await page.screenshot({ path: testInfo.outputPath(`sales-email-independent-panes-${collapsed ? 'collapsed' : 'expanded'}.png`) })
    assertReadOnly(state)
  })
}

test('an imported deep link preserves review actions inside the desktop shell without visible view tabs', async ({ page }, testInfo) => {
  const record = { ...message({ id: 'imported-scroll', subject: 'Imported engineering correspondence' }), status: 'received', attachments: [], can_create_opportunity: true, extracted_information: detected(), body_preview: longDetail(message()).body_text }
  const state = await prepare(page, { shell: true, view: 'imported', imported: paginated([record]), clients: paginated([canonicalClient()]) })
  await expect(page.getByRole('heading', { name: record.subject, exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Email views' })).toHaveCount(0)
  await expect(region(page)).toHaveCount(0)
  const main = page.locator('main.main-content')
  expect(await main.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(1)
  const reading = page.locator('.sales-email-reading-pane')
  const before = await page.getByRole('button', { name: 'Start review', exact: true }).boundingBox()
  await reading.hover()
  await page.mouse.wheel(0, 450)
  await expect.poll(() => reading.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  expect(await page.getByRole('button', { name: 'Start review', exact: true }).boundingBox()).toEqual(before)
  await page.getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(opportunityDialog(page)).toBeVisible()
  await expect(opportunityDialog(page).getByLabel('Opportunity name', { exact: true })).toHaveValue(message().subject)
  await page.keyboard.press('Escape')
  await expect(opportunityDialog(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('sales-email-imported-desktop-shell.png') })
  expect(state.requests.filter(request => request.path === connectionsPath)).toHaveLength(0)
  assertReadOnly(state)
})

test('the actual narrow shell keeps long email content and review actions reachable with normal vertical scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const record = message()
  const state = await prepare(page, { shell: true, messages: listing([record]), details: longDetail(record), clients: paginated([canonicalClient()]) })
  await row(page).click()
  await expect(preview(page)).toContainText('Section 70:')
  const main = page.locator('main.main-content')
  const dimensions = await main.evaluate(node => ({ height: node.clientHeight, content: node.scrollHeight, width: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(dimensions.content).toBeGreaterThan(dimensions.height)
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport)
  const bodyEnd = preview(page).locator('.sales-email-body p').last()
  await bodyEnd.scrollIntoViewIfNeeded()
  await expect(bodyEnd).toBeInViewport()
  expect(await main.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  const source = preview(page).locator('.sales-email-source-panel')
  await source.scrollIntoViewIfNeeded()
  await expect(source).toBeInViewport()
  await preview(page).getByRole('button', { name: 'Create opportunity', exact: true }).click()
  await expect(opportunityDialog(page)).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(opportunityDialog(page)).toHaveCount(0)
  await expect(preview(page).getByRole('button', { name: 'Create opportunity', exact: true })).toBeFocused()
  const accessibility = await new AxeBuilder({ page }).include('.sales-email-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('sales-email-responsive-shell-mobile.png') })
  assertReadOnly(state)
})

test('a short desktop shell keeps stacked email details and the opportunity dialog reachable without clipping', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  const state = await prepare(page, { shell: true, details: longDetail(message()), clients: paginated([canonicalClient()]) })
  await row(page).click()
  const detailPane = preview(page).locator('.sales-email-detail-grid')
  const reading = preview(page).locator('.sales-email-reading-pane')
  const source = preview(page).locator('.sales-email-source-panel')
  const readingBounds = await reading.boundingBox()
  const sourceBounds = await source.boundingBox()
  expect(sourceBounds.y).toBeGreaterThan(readingBounds.y + readingBounds.height)
  await detailPane.hover()
  await page.mouse.wheel(0, 500)
  await expect.poll(() => detailPane.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  expect(await panePosition(page)).toMatchObject({ document: 0, main: 0 })
  await preview(page).getByRole('button', { name: 'Create opportunity', exact: true }).click()
  const dialog = opportunityDialog(page)
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(768)
  await expect(dialog.getByRole('heading', { name: 'Create opportunity from email', exact: true })).toBeInViewport()
  await dialog.getByRole('combobox', { name: 'Client', exact: true }).selectOption('client-one')
  const submit = dialog.getByRole('button', { name: 'Create opportunity', exact: true })
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
  expect(await submit.evaluate(node => {
    const bounds = node.getBoundingClientRect()
    return node.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
  })).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('sales-email-short-desktop-opportunity-dialog.png') })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(preview(page).getByRole('button', { name: 'Create opportunity', exact: true })).toBeFocused()
  assertReadOnly(state)
})
