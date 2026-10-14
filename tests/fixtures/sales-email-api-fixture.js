import { expect } from '@playwright/test'

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
async function prepare(page, options = {}) {
  const state = {
    requests: [], errors: [], unexpected: [],
    connections: paginated([mailbox()]), connectionStatus: 200,
    messages: listing(), messageStatus: 200, details: detail(), detailStatus: 200,
    imported: paginated([]), clients: paginated([]), clientStatus: 200,
    allowConversion: false, conversionStatus: 201, allowedConversionPath: conversionPath('shared-1'),
    conversion: { opportunity: { id: 'created-opportunity', deal_name: 'Reviewed pump package' }, created: true },
    ...options,
  }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.addInitScript(({ collapsed }) => {
    if (window.location.pathname === '/login') return
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
    // Keep the real interceptor's logout navigation in this isolated fixture.
    // Authentication form rendering is outside the mailbox assertions.
    if (url.pathname === '/login') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Authentication required</title><main>Sign in required</main>' })
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    state.requests.push({ path: url.pathname, method: request.method(), query: url.search, authorization: request.headers().authorization, body: request.method() === 'POST' ? request.postDataJSON() : null })
    if (request.method() !== 'GET') {
      if (state.allowConversion && request.method() === 'POST' && url.pathname === state.allowedConversionPath) {
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
      response = state.importedHandler
        ? await state.importedHandler({ request, url })
        : { body: structuredClone(state.imported), hold: state.importedHold }
    } else if (/\/sales\/email-intakes\/[^/]+\/$/.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split('/').at(-2))
      const records = Array.isArray(state.imported) ? state.imported : state.imported.results
      const record = records?.find(item => item.id === id)
      response = state.importedDetailHandler
        ? await state.importedDetailHandler({ request, url })
        : record ? { body: structuredClone(record) } : { status: 404, body: { detail: 'Saved email not found.' } }
    } else if (url.pathname === '/api/v1/sales/deals/registration-options/') {
      response = state.registrationHandler ? await state.registrationHandler({ request, url }) : { body: { default_owner: 11, owners: [{ id: 11, name: 'Current reviewer' }, { id: 12, name: 'Assigned reviewer' }], opportunity_types: [{ value: 'tender', label: 'Tender' }, { value: 'rfq', label: 'RFQ' }, { value: 'eoi', label: 'EOI' }, { value: 'direct_enquiry', label: 'Direct enquiry' }, { value: 'other', label: 'Other' }] } }
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

export { connectionsPath, messagesPath, detailPath, conversionPath, mailbox, message, secondMessage, listing, paginated, detail, detected, canonicalClient, opportunityDetails, prepare, assertReadOnly, assertExplicitConversionOnly }
