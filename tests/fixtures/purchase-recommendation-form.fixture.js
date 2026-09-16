// Synthetic records only. Every API request is intercepted before the actual
// App mounts; unknown requests fail locally and never touch the live database.
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

export const formRecordId = '00000000-0000-4000-8000-000000009001'
export const formActor = {
  id: 7, username: 'test-manager', first_name: 'Maya', last_name: 'Hassan', full_name: 'Maya Hassan',
  is_superuser: true, roles: [], modules: [{ code: 'procurement_requisitions' }, { code: 'procurement_orders' }],
  module_actions: { procurement_requisitions: ['read', 'create', 'update', 'delete'], procurement_orders: ['read', 'create', 'update', 'delete'] },
}
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
export const formVendors = [
  { id: 21, name: 'Alfanar Engineering LLC', vendor_code: 'ALF0012', status: 'active', is_active: true, icv_percentage: '45.00', icv_expiry_date: '2027-09-15', is_icv_certified: true, trade_license_number: 'SYNTHETIC-TL-001' },
  { id: 22, name: 'Petroserve Solutions', vendor_code: 'PET0098', status: 'active', is_active: true, icv_percentage: '32.00', icv_expiry_date: '2027-09-15', is_icv_certified: true },
  { id: 23, name: 'Desert Tech Services', vendor_code: 'DTS0045', status: 'active', is_active: true, icv_percentage: null, icv_expiry_date: null, is_icv_certified: false },
]
export const formProject = {
  project_id: 17, project_number: '5900985', project_name: 'EPC for PE4 & PE5 Revamp',
  value: 'EPC for PE4 & PE5 Revamp (5900985)', label: '5900985 - EPC for PE4 & PE5 Revamp', type: 'project', source: 'enterprise',
}
const employees = [
  formActor,
  { id: 8, full_name: 'Samir Ali', first_name: 'Samir', last_name: 'Ali', email: 'samir@example.test', job_title: 'Project Manager', is_active: true },
  { id: 9, full_name: 'Richa Hannah Thomas', first_name: 'Richa', last_name: 'Hannah Thomas', email: 'richa@example.test', job_title: 'Procurement Manager', is_active: true },
  { id: 10, full_name: 'Mohamad El-Ghawanmeh', first_name: 'Mohamad', last_name: 'El-Ghawanmeh', email: 'moghawanmeh@rejlers.ae', job_title: 'Vice President', job_title_match: true, is_active: true },
  { id: 11, full_name: 'Jarmo Suominen', first_name: 'Jarmo', last_name: 'Suominen', email: 'jarmo@example.test', job_title: 'CEO', is_active: true },
]
export function formReference(overrides = {}) {
  return {
    id: formRecordId, pr_number: 'RAD-PRJ-PR-9001_2026', status: 'draft', issued_by: 7, issued_by_name: 'Maya Hassan', issued_date: '2026-09-15',
    requisition_type: 'project', priority: 'normal', product_service: 'Value Engineering Services', project_department: formProject.value,
    project_details: [formProject], supplier_name: formVendors[0].name, supplier_business_id: 'SYNTHETIC-TL-001',
    vendor: 21, preferred_supplier_if_any: formVendors[0].name,
    selected_vendors: formVendors.map(({ id, ...vendor }) => ({ ...vendor, vendor_id: id })),
    vendor_selection_reason: 'Best overall value, proven experience with similar projects, and compliant commercial terms.',
    description_reason: 'Value engineering for the approved EPC design package.',
    price_description: 'Value Engineering Services - Package 1 & 2',
    purchase_recommendation: 'Recommend the technically compliant supplier after commercial evaluation.',
    single_source_justification: '', currency: 'AED', total_price: '400000.00', net_total_excl_vat: '400000.00',
    price_remarks: '', price_remarks_data: { vat_rate: 5, vat_amount: '20000.00', budget_in_aed: '1000000.00' },
    items: [{ description: 'Value Engineering Services - Package 1 & 2', quantity: '1', unit: 'Package', unit_price: '400000.00', budget: '1000000.00', vat_rate: '5', vat: '5', vendor_id: '21', total: '400000.00' }],
    po_number_reference: '', po_applicable: false, management_approval: false, management_approval_remarks: '', management_approval_evidence: [],
    approval_workflow_config: [
      { level: 0, role: 'Procurement', stage: 'Level 0 - Procurement', user_id: 9, user_name: 'Richa Hannah Thomas', status: 'pending', approval_label: 'L0- PRO' },
      { level: 1, business_position: 'project_manager', role: 'Project Manager', stage: 'Level 1 - Approver 1', user_id: 8, user_name: 'Samir Ali', status: 'pending', approval_label: 'L1- PM' },
      { level: 3, role: 'Manager of Projects', stage: 'Level 3', user_id: 7, user_name: 'Maya Hassan', status: 'pending', approval_label: 'L3 MoP' },
      { level: 4, role: 'Vice President', stage: 'Level 4', user_id: 10, user_name: 'Mohamad El-Ghawanmeh', status: 'pending', approval_label: 'L4 VOP/VP' },
      { level: 5, role: 'CEO', stage: 'Level 5', user_id: 11, user_name: 'Jarmo Suominen', status: 'pending', approval_label: 'CEO' },
    ],
    attachments: [], created_at: '2026-09-15T08:00:00Z', updated_at: '2026-09-15T08:00:00Z', ...overrides,
  }
}

function parseBody(request) {
  const raw = request.postData()
  if (!raw) return null
  if (!(request.headers()['content-type'] || '').includes('multipart/form-data')) {
    try { return JSON.parse(raw) } catch { return { raw } }
  }
  const fields = {}
  for (const part of raw.split(/--[\w-]+(?:\r\n|--)/)) {
    const name = part.match(/name="([^"]+)"/), content = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
    if (!name) continue
    const filename = part.match(/filename="([^"]+)"/)
    if (filename) { fields[name[1]] = { filename: filename[1] }; continue }
    try { fields[name[1]] = JSON.parse(content) } catch { fields[name[1]] = content }
  }
  return fields
}

export async function recommendationFormHarness(page, options = {}) {
  const state = {
    record: formReference(options.record), records: [], vendors: formVendors, requests: [], unknown: [], pageErrors: [], submissions: [],
    saveError: null, submitError: null, originalContent: {}, sourceApprovalError: null, saveSourceApproval: null,
  }
  if (options.edit) state.records.push(state.record)
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date('2026-09-15T08:00:00Z'))
  await page.addInitScript(user => {
    // Browser PDF frames do not expose the app's storage. Authenticate only
    // the top-level fixture, leaving embedded original documents untouched.
    if (window !== window.top) return
    localStorage.setItem('radai_access_token', 'isolated-form-fixture-token')
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'false')
    localStorage.setItem('radai_theme', 'light')
  }, formActor)
  page.on('pageerror', error => state.pageErrors.push(error.message))
  // PDF export clones the page and reloads background images. Serve the exact
  // repository image directly so Vite image latency cannot consume the workflow
  // timeout; the sidebar and exported document still use their real assets.
  await page.route('**/assets/images/sidebar-industrial-dusk.png', route => route.fulfill({
    path: fileURLToPath(new URL('../../public/assets/images/sidebar-industrial-dusk.png', import.meta.url)),
    contentType: 'image/png',
  }))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method(), body = parseBody(request)
    state.requests.push({ path, method, body })
    if (Object.hasOwn(state.originalContent, path) && method === 'GET') return route.fulfill({ contentType: 'application/pdf', ...state.originalContent[path] })
    if (path === '/api/v1/health/') return reply(route, { status: 'ok' })
    if (path === '/api/v1/users/check-first-login/') return reply(route, { must_reset_password: false })
    if (path === '/api/v1/rbac/users/me/profile-completeness/') return reply(route, { is_complete: true, percentage: 100, missing_fields: [] })
    if (path.includes('check-password-expiry')) return reply(route, { is_expired: false, must_change_password: false, show_warning: false, days_until_expiry: 90 })
    if (path === '/api/v1/notifications/unread_count/') return reply(route, { unread_count: 0 })
    if (path === '/api/v1/notifications/push-config/') return reply(route, { enabled: false, available: false })
    if (path === '/api/v1/users/employees/my-profile-photo/') return route.fulfill({ status: 204, body: '' })
    if (path.endsWith('/pending-for-me/')) return reply(route, { count: 0, results: [] })
    if (path.startsWith('/api/v1/ai-champion/') || path.startsWith('/api/v1/rbac/ai-champion/')) return reply(route, { success: true })
    if (path === '/api/v1/rbac/users/me/') return reply(route, formActor)
    if (path === '/api/v1/users/employees/my-signature/') return reply(route, { signature: '' })
    if (path === '/api/v1/procurement/orders/') return reply(route, { count: 0, next: null, results: [] })
    if (['/api/v1/procurement/vendors/', '/api/v1/procurement/projects/'].includes(path)) return reply(route, { count: 0, next: null, results: [] })
    if (path === '/api/v1/rbac/users/organization-catalog/') return reply(route, { source: {}, departments: [], organizational_roles: [{ code: 'project_manager', label: 'Project Manager' }, { code: 'hr_manager', label: 'HR Manager' }, { code: 'cfo', label: 'CFO' }] })
    if (path === '/api/v1/procurement/requisitions/get_approvers/') {
      const role = url.searchParams.get('role')
      return reply(route, { users: role === 'procurement_head' ? [employees[2]] : role === 'vp_operations' ? [employees[3]] : employees })
    }
    if (path === '/api/v1/procurement/requisitions/vendor-options/') {
      const query = (url.searchParams.get('q') || '').toLowerCase(), id = url.searchParams.get('id')
      return reply(route, { suggestions: state.vendors.filter(vendor => (!id || String(vendor.id) === id) && `${vendor.name} ${vendor.vendor_code}`.toLowerCase().includes(query)) })
    }
    if (path === '/api/v1/procurement/requisitions/get_projects_departments/') return reply(route, { suggestions: [formProject] })
    if (path === '/api/v1/procurement/requisitions/get_product_services/') return reply(route, { suggestions: ['Value Engineering Services'] })
    if (path === '/api/v1/procurement/requisitions/get_suppliers/') return reply(route, { suggestions: [] })
    if (path === '/api/v1/procurement/requisitions/get_po_numbers/') return reply(route, { suggestions: [] })
    if (path === '/api/v1/procurement/requisitions/check-pr-number/') return reply(route, { available: true, exists: false, message: 'PR number is available' })
    if (path === '/api/v1/procurement/requisitions/' && method === 'GET') return reply(route, { count: state.records.length, next: null, results: state.records })
    if (path === `/api/v1/procurement/requisitions/${formRecordId}/` && method === 'GET') return reply(route, state.record)
    if (path === `/api/v1/procurement/requisitions/${formRecordId}/source-approvals/` && method === 'POST') {
      if (state.sourceApprovalError === 'network') return route.abort('failed')
      if (state.sourceApprovalError) return reply(route, state.sourceApprovalError.body, state.sourceApprovalError.status || 400)
      const currentRow = state.record.price_remarks_data?.signed_document_verification?.source_approval_rows?.[body.row_index]
      if (!isDeepStrictEqual(body.expected_row, currentRow)) return reply(route, { detail: 'This approval record changed. Reload it before editing.' }, 409)
      if (!state.saveSourceApproval) return reply(route, { detail: 'No isolated source-approval response configured.' }, 400)
      const record = await state.saveSourceApproval(body, state.record)
      state.record = record
      state.records = [record]
      return reply(route, record)
    }
    if ((path === '/api/v1/procurement/requisitions/' && method === 'POST') || (path === `/api/v1/procurement/requisitions/${formRecordId}/` && method === 'PATCH')) {
      if (state.saveError) return reply(route, state.saveError, 400)
      // DRF's multipart nullable fields map a submitted blank value to null.
      for (const key of ['vendor', 'issued_date', 'total_price', 'net_total_excl_vat', 'estimated_budget', 'management_approval']) {
        if (body[key] === '') body[key] = null
      }
      const record = { ...(method === 'POST' ? {} : state.record), ...body, id: formRecordId, pr_number: body.pr_number || 'RAD-PRJ-PR-9001_2026', status: method === 'POST' ? 'draft' : state.record.status, issued_by: 7, issued_by_name: 'Maya Hassan', updated_at: '2026-09-15T08:00:00Z' }
      state.record = record
      state.records = [record]
      return reply(route, record, method === 'POST' ? 201 : 200)
    }
    if (path === `/api/v1/procurement/requisitions/${formRecordId}/submit/` && method === 'POST') {
      state.submissions.push(body)
      if (state.submitError) return reply(route, state.submitError, 400)
      state.record = { ...state.record, ...body, status: 'submitted' }
      state.records = [state.record]
      return reply(route, state.record)
    }
    state.unknown.push({ path, method })
    return reply(route, { detail: 'Unexpected isolated form test request.' }, 400)
  })
  await page.goto(options.edit ? `/procurement/requisitions/${formRecordId}/edit` : '/procurement/requisitions/new', { waitUntil: 'domcontentloaded' })
  return state
}
