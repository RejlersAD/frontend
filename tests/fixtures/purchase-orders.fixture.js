// Synthetic purchase orders only. Every API route is intercepted before navigation.
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
export function purchaseOrders() {
  const base = {
    vendor: 21, vendor_name: 'Atlas Industrial Supplies', enterprise_project: 17,
    enterprise_project_code: '5900985', enterprise_project_name: 'Engineering upgrade',
    created_by: 7, created_by_name: 'Maya Hassan', buyer_reference_pm: 'Maya Hassan',
    po_date: '2026-09-01', expected_delivery: '2026-09-25', currency: 'AED', total_amount: '128000',
    tax_amount: '6400', payment_terms: 'Net 30 days', category: 'equipment',
    requisition: 'pr-fixture-17', pr_number: 'PR-TEST-017', confirmation_date: null,
    approval_log: [], approved_at: null, items: [],
  }
  const values = [
    { status: 'sent', title: 'Control valves and actuator package', approved_at: '2026-09-02T09:00:00Z' },
    { status: 'draft', title: 'Instrumentation inspection services', current_approval: 'Technical', approval_log: [{ stage: 'Technical', status: 'pending', level: 1, approver: 'Maya Hassan', user_id: 7 }], total_amount: '36000' },
    { status: 'draft', title: 'Cable installation materials', vendor: 22, vendor_name: 'Summit Cable Trading', total_amount: '42000', created_by: 8, buyer_reference_pm: 'Samir Ali', expected_delivery: null },
    { status: 'in_progress', title: 'Site safety equipment', total_amount: '18000', confirmation_date: '2026-09-03', expected_delivery: '2026-09-10' },
    { status: 'completed', title: 'Engineering workstation delivery', total_amount: '96000', confirmation_date: '2026-09-04', expected_delivery: '2026-09-10' },
    { status: 'acknowledged', title: 'Imported specialist instruments', currency: 'USD', total_amount: '22500', confirmation_date: '2026-09-05', enterprise_project: 18, enterprise_project_code: 'TEST-018', enterprise_project_name: 'Second project' },
    { status: 'draft', title: 'Unverified source record', currency: '', total_amount: null, po_date: null, created_at: null, vendor: null, vendor_name: '', expected_delivery: null, payment_terms: '' },
    { status: 'draft', title: 'Approved pump package ready to issue', approved_at: '2026-09-06T09:00:00Z', approved_by: 8, total_amount: '150000', can_send_to_vendor: true },
  ]
  return values.map((value, index) => ({ ...base, id: index + 101, po_number: `PO-TEST-${String(index + 1).padStart(3, '0')}`, created_at: `2026-09-${String(14 - index).padStart(2, '0')}T08:00:00Z`, ...value }))
}

export async function purchaseOrderHarness(page, options = {}) {
  const orders = purchaseOrders()
  const state = {
    props: { orders, loading: false, error: null, currentUserId: 7, requisitionCount: 12, pdfBusy: false },
    details: Object.fromEntries(orders.map(row => [row.id, { ...row, items: [{ id: `line-${row.id}`, description: `${row.title} delivery line`, quantity: '4', unit: 'EA', unit_price: '250', total: '1000' }] }])),
    requests: [], unknown: [], pageErrors: [], detailErrors: {}, deferred: {}, pending: {}, delivered: {}, listResponses: {}, documentContent: {},
  }
  options.prepare?.(state)
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-09-15T08:00:00Z'))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    state.requests.push({ path, method: request.method() })
    if (path === '/api/v1/__purchase-orders-fixture__/') return reply(route, state.props)
    if (options.integration && request.method() === 'GET') {
      if (state.documentContent[path]) return route.fulfill({ contentType: 'application/pdf', body: state.documentContent[path] })
      const planned = state.listResponses[path]?.shift()
      if (planned) {
        if (planned.wait) await planned.wait
        await reply(route, planned.body, planned.status || 200)
        planned.delivered = true
        return
      }
      if (path === '/api/v1/procurement/orders/') {
        const pageNumber = Number(new URL(request.url()).searchParams.get('page') || 1)
        return reply(route, { count: state.props.orders.length, next: pageNumber === 1 ? '/api/v1/procurement/orders/?page=2' : null, results: pageNumber === 1 ? state.props.orders.slice(0, 4) : state.props.orders.slice(4) })
      }
      if (path === '/api/v1/procurement/requisitions/') return reply(route, { count: 12, next: null, results: [] })
      if (path === '/api/v1/procurement/po-documents/') return reply(route, { count: 0, next: null, results: [] })
      if (path === '/api/v1/procurement/requisitions/get_approvers/') return reply(route, { users: [] })
      if (['/api/v1/procurement/vendors/', '/api/v1/procurement/projects/'].includes(path)) return reply(route, { count: 0, next: null, results: [] })
      if (path === '/api/v1/rbac/users/me/') return reply(route, { id: 7, username: 'test-buyer', first_name: 'Maya', last_name: 'Hassan', is_superuser: true, roles: [], modules: [] })
    }
    const match = path.match(/^\/api\/v1\/procurement\/orders\/(\d+)\/$/)
    if (match && request.method() === 'GET') {
      const id = match[1]
      if (state.deferred[id]) await new Promise(resolve => { state.pending[id] = resolve })
      if (state.detailErrors[id]) return reply(route, { detail: state.detailErrors[id] }, 400)
      await reply(route, state.details[id] || { detail: 'Synthetic order not found.' }, state.details[id] ? 200 : 404)
      state.delivered[id] = true
      return
    }
    state.unknown.push({ path, method: request.method() })
    return reply(route, { detail: 'Unexpected isolated test request.' }, 400)
  })
  const parameters = new URLSearchParams({ ...(options.shell ? { shell: 'true' } : {}), ...(options.integration ? { integration: 'true' } : {}), ...(options.route ? { route: options.route } : {}) })
  await page.goto(`/tests/fixtures/purchase-orders.html?${parameters}`)
  return state
}
