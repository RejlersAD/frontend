import { expect } from '@playwright/test'
const fixedTime = '2026-09-30T08:00:00Z'
const options = {
  default_owner: 11,
  owners: [{ id: 11, name: 'Aisha Noor' }, { id: 12, name: 'Omar Ali' }],
  opportunity_types: [
    { value: 'tender', label: 'Tender' }, { value: 'rfq', label: 'RFQ' },
    { value: 'eoi', label: 'EOI' }, { value: 'direct_enquiry', label: 'Direct enquiry' },
    { value: 'other', label: 'Other' },
  ],
}
export function opportunity(index, changes = {}) {
  return {
    id: `opportunity-${index}`, deal_code: `Q-${102101 + index}`,
    deal_name: `Synthetic engineering package ${index + 1}`,
    client: 'client-one', client_name: 'Example Energy LLC',
    owner: 11, owner_name: 'Aisha Noor', created_by: 11, created_by_name: 'Aisha Noor',
    opportunity_type: 'tender', open_date: '2026-09-30',
    created_at: fixedTime, updated_at: fixedTime,
    stage: 'lead', stage_display: 'Open', probability: 10, bid_decision: 'pending',
    scope_type: 'feed', service_categories: ['engineering_design'],
    description: `Reviewed engineering scope for package ${index + 1}.`,
    client_reference: `ITT-${index + 1}`, currency: '',
    estimated_value: null, weighted_value: null, expected_close_date: null,
    submission_due_date: null, next_action: '', next_action_date: null,
    source_history: [], lifecycle_history: [], permitted_actions: [],
    ...changes,
  }
}

const sampleRows = () => [
  opportunity(0, { deal_name: 'Seawater intake engineering study', opportunity_type: 'eoi' }),
  opportunity(1, { deal_name: 'Compressor replacement FEED', stage: 'qualified', stage_display: 'Qualified Lead',
    owner: 12, owner_name: 'Omar Ali', bid_decision: 'bid', estimated_value: '200000.00',
    weighted_value: '50000.00', currency: 'AED', submission_due_date: '2026-10-02' }),
  opportunity(2, { deal_name: 'Substation design and control systems', stage: 'proposal', stage_display: 'Proposal & Estimate',
    scope_type: 'pmc', service_categories: ['project_management'], bid_decision: 'conditional_bid',
    estimated_value: '300000.00', weighted_value: '150000.00', currency: 'USD', submission_due_date: '2026-10-03' }),
  opportunity(3, { deal_name: 'Closed historical package', stage: 'lost', stage_display: 'Lost', bid_decision: 'no_bid' }),
  opportunity(4, { deal_name: 'No-bid historical package', stage: 'no_bid', stage_display: 'No Bid', bid_decision: 'no_bid' }),
  ...Array.from({ length: 25 }, (_, index) => opportunity(index + 5)),
  opportunity(30, { deal_name: 'Offshore platform electrical upgrade', client_name: 'Azure Gas Company',
    owner: 12, owner_name: 'Omar Ali', opportunity_type: 'rfq', scope_type: 'epcm',
    submission_due_date: '2026-10-05' }),
]

export async function prepareRegister(page, configuration = {}) {
  const state = {
    records: sampleRows(), requests: [], exports: [], pageErrors: [],
    listStatus: 200, listPageStatuses: {}, exportStatus: 200, detailStatuses: {}, detailHolds: {},
    patchStatuses: {}, patchHolds: {},
    ...configuration,
  }
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.clock.setFixedTime(new Date(fixedTime))
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-register-user'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort()
    if (!url.pathname.startsWith('/api/v1/')) return route.continue()
    const body = ['POST', 'PATCH'].includes(request.method()) && !request.headers()['content-type']?.includes('multipart') ? request.postDataJSON() : null
    state.requests.push({ method: request.method(), path: url.pathname, search: url.search, body })
    if (configuration.realShell && url.pathname.endsWith('/rbac/users/me/')) return route.fulfill({ json: {
      id: 11, user: { id: 11, first_name: 'Aisha', last_name: 'Noor', email: 'aisha@example.test', is_superuser: true },
      roles: [{ code: 'super_admin', name: 'Super Administrator' }], modules: [],
    } })
    if (configuration.realShell && url.pathname.endsWith('/my-profile-photo/')) return route.fulfill({ status: 204, body: '' })
    if (url.pathname.includes('/workspace/') && state.workspaceHandler) return state.workspaceHandler(route, state)
    if (url.pathname.endsWith('/workspace/')) return route.fulfill({ json: { opportunity_id: url.pathname.split('/deals/')[1].split('/')[0], status: 'not_configured', can_manage: false, can_upload: false, message: 'SharePoint connection needs administrator setup.', web_url: '', folders: [] } })
    if (url.pathname.endsWith('/deals/registration-options/')) return route.fulfill({ json: options })
    if (url.pathname.endsWith('/deals/export/') && request.method() === 'POST') {
      state.exports.push(body)
      if (state.exportStatus !== 200) return route.fulfill({ status: state.exportStatus, json: { detail: 'The selected export is unavailable.' } })
      return route.fulfill({ contentType: 'text/csv; charset=utf-8',
        headers: { 'content-disposition': 'attachment; filename="opportunities.csv"' },
        body: 'VF code,Title\r\nQ-102101,Synthetic exported registration\r\n' })
    }
    if (url.pathname.endsWith('/deals/') && request.method() === 'GET') {
      if (state.listStatus !== 200) return route.fulfill({ status: state.listStatus, json: { detail: 'Opportunity source is temporarily unavailable.' } })
      const pageNumber = Number(url.searchParams.get('page') || 1)
      if (state.listPageStatuses[pageNumber]) return route.fulfill({ status: state.listPageStatuses[pageNumber], json: { detail: 'The complete register could not be loaded.' } })
      const boundary = Math.ceil(state.records.length / 2)
      const hasNext = pageNumber === 1 && state.records.length > 1
      return route.fulfill({ json: {
        count: state.records.length, next: hasNext ? `${url.origin}/api/v1/sales/deals/?page=2` : null,
        previous: pageNumber === 2 ? `${url.origin}/api/v1/sales/deals/?page=1` : null,
        results: pageNumber === 1 ? state.records.slice(0, boundary) : state.records.slice(boundary),
      } })
    }
    const detail = url.pathname.match(/\/deals\/(opportunity-\d+)\/$/)
    if (detail && request.method() === 'PATCH') {
      const identifier = detail[1]
      if (state.patchHolds[identifier]) await state.patchHolds[identifier]
      const status = state.patchStatuses[identifier] || 200
      const index = state.records.findIndex(item => item.id === identifier)
      if (status === 200) state.records[index] = { ...state.records[index], ...body }
      return route.fulfill({ status, json: status === 200 ? state.records[index] : { detail: 'The previous opportunity save failed.' } })
    }
    if (detail && request.method() === 'GET') {
      const identifier = detail[1]
      if (state.detailHolds[identifier]) await state.detailHolds[identifier]
      const status = state.detailStatuses[identifier] || 200
      const record = state.records.find(item => item.id === identifier)
      return route.fulfill({ status, json: status === 200 ? record : { detail: 'Opportunity details could not be loaded.' } })
    }
    if (url.pathname.endsWith('/clients/')) return route.fulfill({ json: {
      count: 1, next: null, previous: null, results: [{ id: 'client-one', company_name: 'Example Energy LLC' }],
    } })
    if (request.method() === 'GET') return route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } })
    return route.fulfill({ status: 400, json: { detail: 'Unexpected synthetic test request.' } })
  })
  const fixturePage = configuration.realShell ? 'sales-workspace-shell' : 'sales-vf-registration'
  await page.goto(`/tests/fixtures/${fixturePage}.html${configuration.entry ? `?entry=${encodeURIComponent(configuration.entry)}` : ''}`, { waitUntil: 'domcontentloaded' })
  if (configuration.entry) { await expect(page.getByRole('button', { name: 'Back to register', exact: true })).toBeVisible({ timeout: configuration.realShell ? 60000 : 5000 }); return state }
  const pageSize = page.getByRole('combobox', { name: 'Rows per page', exact: true })
  await expect.poll(async () => state.pageErrors.length > 0 || await pageSize.count() > 0, { timeout: 40000 }).toBe(true)
  expect(state.pageErrors).toEqual([])
  await pageSize.selectOption('50')
  await page.getByRole('button', { name: 'Filters and table settings' }).click()
  await page.locator('summary').filter({ hasText: /^\s*More\s*$/ }).click()
  await page.getByRole('button', { name: 'Show register summary' }).click()
  return state
}
