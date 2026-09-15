// Synthetic API-shaped records. Every backend request is intercepted before navigation.
export const recommendationId = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
export const recommendationNumber = number => `RAD-PRJ-PR-${String(number).padStart(4, '0')}_2026`
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const actor = { id: 7, username: 'test-manager', first_name: 'Maya', last_name: 'Hassan', full_name: 'Maya Hassan', is_superuser: true, roles: [], modules: [{ code: 'procurement_requisitions' }, { code: 'procurement_orders' }], module_actions: { procurement_requisitions: ['read', 'create', 'update', 'delete'], procurement_orders: ['read', 'create', 'update', 'delete'] } }
const stages = () => [
  { level: 1, stage: 'Level 1 - Approver 1', role: 'Project Manager', user_id: '7', user_name: 'Maya Hassan', status: 'pending' },
  { level: 2, stage: 'Level 2', role: 'Engineering Manager', user_id: '8', user_name: 'Samir Ali', status: 'pending' },
]

export function recommendationRecords() {
  const base = {
    issued_by: 7, issued_by_name: 'Maya Hassan', requested_by: 7, requester_name: 'Maya Hassan',
    issued_date: '2026-09-01', required_date: '2026-09-25', supplier_name: 'Atlas Industrial Supplies',
    vendor: 21, vendor_name: 'Atlas Industrial Supplies', vendor_details: { id: 21, name: 'Atlas Industrial Supplies', status: 'active' }, enterprise_project: 17,
    enterprise_project_code: '5900985', enterprise_project_name: 'Engineering upgrade', project_department: 'Engineering',
    description_reason: 'Required for the approved engineering design package.', purchase_recommendation: 'Recommend the technically compliant supplier package.',
    price_description: 'Engineering package supply', total_price: '128000', net_total_excl_vat: '128000', currency: 'AED',
    estimated_budget: '150000', price_remarks: 'Quoted rates exclude VAT.', price_remarks_data: { payment_terms: 'Net 30 days' },
    selected_vendors: [{ vendor_id: '21', vendor_name: 'Atlas Industrial Supplies', icv_value: '45', icv_validity: '2027-01-31' }],
    single_source_justification: '', requisition_type: 'project', priority: 'normal', approval_workflow_config: [],
    attachments: [], management_approval: false, management_approval_evidence: [], review_due_at: null,
    approved_at: null, approved_by: null, linked_po_id: null, po_number_reference: '', po_applicable: true, current_approval_step: 0, items: [],
  }
  const cases = [
    { status: 'in_review', product_service: 'Control valve engineering package', priority: 'high', review_due_at: '2026-09-14T12:00:00Z', approval_workflow_config: stages(), price_remarks_data: { payment_terms: 'Net 30 days', comparative_prices: [{ vendor: 'Atlas Industrial Supplies', price: 128000 }, { vendor: 'Summit Engineering', price: 135000 }] }, attachments: [{ filename: 'technical-scope.pdf', file_size: 4096, uploaded_at: '2026-09-12T08:00:00Z', s3_key: 'isolated/technical-scope.pdf' }] },
    { status: 'submitted', product_service: 'Instrumentation inspection services', total_price: '36000', net_total_excl_vat: '36000', review_due_at: '2026-09-17T12:00:00Z', approval_workflow_config: stages() },
    { status: 'draft', product_service: 'Cable installation materials', vendor: 22, vendor_name: 'Summit Cable Trading', supplier_name: 'Summit Cable Trading', vendor_details: { id: 22, name: 'Summit Cable Trading', status: 'active' }, issued_by: 8, requested_by: 8, issued_by_name: 'Samir Ali', requester_name: 'Samir Ali', required_date: null, total_price: '42000', approval_workflow_config: stages(), created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-01T08:00:00Z' },
    { status: 'approved', product_service: 'Approved pump procurement package', total_price: '98000', approved_at: '2026-09-10T09:00:00Z', approved_by: 8, approval_workflow_config: stages().map(stage => ({ ...stage, status: 'approved', approved_at: '2026-09-10T09:00:00Z', approved_by_id: stage.user_id })) },
    { status: 'rejected', product_service: 'Site safety equipment', total_price: '18000', rejection_reason: 'Confirm the revised scope before resubmission.', approval_workflow_config: stages().map((stage, index) => index === 0 ? { ...stage, status: 'rejected', rejected_at: '2026-09-11T08:00:00Z', rejection_reason: 'Confirm scope.' } : stage) },
    { status: 'converted', product_service: 'Specialist engineering instruments', currency: 'USD', total_price: '22500', linked_po_id: '101', po_number_reference: 'PO-TEST-001', enterprise_project: 18, enterprise_project_code: 'TEST-018', enterprise_project_name: 'Second project', approval_workflow_config: stages().map(stage => ({ ...stage, status: 'not_recorded' })) },
    { status: 'draft', product_service: 'Unverified imported recommendation', total_price: null, net_total_excl_vat: null, estimated_budget: null, currency: '', vendor: null, vendor_name: '', vendor_details: null, supplier_name: '', issued_date: null, created_at: null, required_date: null, selected_vendors: [], price_remarks_data: {} },
    { status: 'in_review', product_service: 'Review deadline not recorded', priority: 'urgent', total_price: '14000', review_due_at: null, required_date: '2026-08-01', approval_workflow_config: stages().map(stage => ({ ...stage, user_id: '8', user_name: 'Samir Ali' })), selected_vendors: [{ vendor_id: '21', vendor_name: 'Atlas Industrial Supplies' }, { vendor_id: '22', vendor_name: 'Summit Engineering' }], price_remarks_data: {} },
  ]
  return cases.map((value, index) => ({ ...base, id: recommendationId(index + 201), pr_number: recommendationNumber(index + 1), created_at: `2026-09-${String(14 - index).padStart(2, '0')}T08:00:00Z`, updated_at: '2026-09-14T09:00:00Z', ...value }))
}

export async function recommendationHarness(page, options = {}) {
  const requisitions = recommendationRecords()
  const state = {
    props: { requisitions, loading: false, error: null, currentUserId: 7, orderCount: 4, pdfBusyId: null, batchBusy: false, permissions: Object.fromEntries(requisitions.map((row, index) => [row.id, { modify: row.status === 'draft' && row.issued_by === 7, delete: true, convert: row.status === 'approved', approve: index < 2 }])) },
    details: Object.fromEntries(requisitions.map(row => [row.id, { ...row, items: [{ id: `line-${row.id}`, description: `${row.product_service} scope line`, quantity: '4', unit: 'EA', unit_price: '250', total: '1000' }] }])),
    orders: [{ id: '101', po_number: 'PO-TEST-001', status: 'draft', title: 'Converted specialist instruments', currency: 'USD', total_amount: '22500', items: [] }],
    requests: [], unknown: [], pageErrors: [], detailErrors: {}, deferred: {}, pending: {}, delivered: {}, listError: false,
  }
  options.prepare?.(state)
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-09-15T08:00:00Z'))
  if (options.realApp) {
    await page.addInitScript(user => {
      if (window.top !== window) return
      localStorage.setItem('radai_access_token', 'isolated-browser-fixture-token')
      localStorage.setItem('radai_user_data', JSON.stringify(user))
      localStorage.setItem('radai.sidebar.collapsed', 'false')
      localStorage.setItem('radai_theme', 'light')
    }, actor)
  }
  await page.route(options.realApp ? '**/api/**' : '**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    const body = method === 'GET' ? null : request.postData() ? request.postDataJSON() : null
    state.requests.push({ path, method, body })
    if (path === '/api/v1/__purchase-recommendations-fixture__/') return reply(route, state.props)
    if (options.realApp) {
      if (path === '/api/v1/health/') return reply(route, { status: 'ok' })
      if (path === '/api/v1/users/check-first-login/') return reply(route, { must_reset_password: false })
      if (path === '/api/v1/rbac/users/me/profile-completeness/') return reply(route, { is_complete: true, percentage: 100, missing_fields: [] })
      if (path.includes('check-password-expiry')) return reply(route, { is_expired: false, must_change_password: false, show_warning: false, days_until_expiry: 90 })
      if (path === '/api/v1/notifications/unread_count/') return reply(route, { unread_count: 0 })
      if (path === '/api/v1/notifications/push-config/') return reply(route, { enabled: false, available: false })
      if (path === '/api/v1/users/employees/my-profile-photo/') return route.fulfill({ status: 204, body: '' })
      if (path.endsWith('/pending-for-me/')) return reply(route, { count: 0, results: [] })
      // Shell telemetry is isolated too; it never reaches a real account.
      if (path.startsWith('/api/v1/ai-champion/') || path.startsWith('/api/v1/rbac/ai-champion/')) return reply(route, { success: true })
    }
    if (options.integration || options.realApp) {
      if (path === '/api/v1/procurement/requisitions/' && method === 'GET') {
        if (state.listError) return reply(route, { detail: 'Synthetic recommendation register unavailable.' }, 400)
        const pageNumber = Number(url.searchParams.get('page') || 1)
        const countOnly = url.searchParams.get('page_size') === '1'
        return reply(route, { count: state.props.requisitions.length, next: !countOnly && pageNumber === 1 ? '/api/v1/procurement/requisitions/?page=2' : null, results: countOnly ? state.props.requisitions.slice(0, 1) : pageNumber === 1 ? state.props.requisitions.slice(0, 4) : state.props.requisitions.slice(4) })
      }
      if (path === '/api/v1/procurement/requisitions/get_approvers/') return reply(route, { users: [actor, { id: 8, first_name: 'Samir', last_name: 'Ali', full_name: 'Samir Ali' }] })
      if (path === '/api/v1/procurement/orders/') return reply(route, { count: state.orders.length, next: null, results: state.orders })
      if (path === '/api/v1/procurement/po-documents/' && method === 'GET') return reply(route, { count: 0, next: null, results: [] })
      if (path === '/api/v1/rbac/users/me/') return reply(route, actor)
      if (path === '/api/v1/users/employees/my-signature/') return reply(route, { signature: '' })
      if (['/api/v1/procurement/vendors/', '/api/v1/procurement/projects/'].includes(path)) return reply(route, { count: 0, next: null, results: [] })
      const conversion = path.match(/\/requisitions\/([^/]+)\/convert_to_po\/$/)
      if (conversion && method === 'POST') {
        const record = state.props.requisitions.find(row => row.id === conversion[1])
        if (!record || record.status !== 'approved') return reply(route, { detail: 'Only approved recommendations can convert.' }, 400)
        Object.assign(record, { status: 'converted', linked_po_id: '102', po_number_reference: 'PO-TEST-002' })
        Object.assign(state.details[record.id], record)
        const order = { id: '102', po_number: 'PO-TEST-002', status: 'draft', title: record.product_service, currency: record.currency, total_amount: record.total_price, items: [] }
        state.orders.push(order)
        return reply(route, { purchase_order: order }, 201)
      }
      if (/\/requisitions\/[^/]+\/export_pdf\/$/.test(path)) return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="PR-TEST.pdf"' }, body: '%PDF-1.4\n% Synthetic isolated PDF\n%%EOF' })
      if (/\/orders\/(101|102)\/$/.test(path)) return reply(route, state.orders.find(order => path.endsWith(`/${order.id}/`)))
    }
    const match = path.match(/^\/api\/v1\/procurement\/requisitions\/([^/]+)\/$/)
    if (match && method === 'GET') {
      const id = match[1]
      if (state.deferred[id]) await new Promise(resolve => { state.pending[id] = resolve })
      if (state.detailErrors[id]) return reply(route, { detail: state.detailErrors[id] }, 400)
      await reply(route, state.details[id] || { detail: 'Synthetic recommendation not found.' }, state.details[id] ? 200 : 404)
      state.delivered[id] = true
      return
    }
    state.unknown.push({ path, method })
    return reply(route, { detail: 'Unexpected isolated test request.' }, 400)
  })
  const parameters = new URLSearchParams({ ...(options.shell ? { shell: 'true' } : {}), ...(options.integration ? { integration: 'true' } : {}) })
  await page.goto(options.realApp ? '/procurement/requisitions' : `/tests/fixtures/purchase-recommendations.html?${parameters}`, { waitUntil: 'domcontentloaded' })
  return state
}
