// The actual App is used with every API request intercepted before navigation.
// Synthetic records never reach the live database, including number reservation.
import { formActor, formProject, formReference, formVendors } from './purchase-recommendation-form.fixture'

export const orderFormId = '00000000-0000-4000-8000-000000009002'
export const orderFormNumber = 'RAD-PRJ-PUR-9002_SEP2026'
export const orderFormRecommendation = formReference({
  status: 'approved', status_display: 'Approved', category: 'engineering_services',
  required_date: '2026-10-20', total_price: '400000.00', net_total_excl_vat: '400000.00',
  vendor_name: formVendors[0].name,
})
const employees = [
  formActor,
  { id: 9, full_name: 'Richa Hannah Thomas', first_name: 'Richa', last_name: 'Hannah Thomas', email: 'richa@example.test', job_title: 'Procurement Manager', is_active: true },
  { id: 11, full_name: 'Jarmo Suominen', first_name: 'Jarmo', last_name: 'Suominen', email: 'jarmo@example.test', job_title: 'CEO', is_active: true },
]
const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
function parseBody(request) {
  const raw = request.postData()
  if (!raw) return null
  if (!(request.headers()['content-type'] || '').includes('multipart/form-data')) {
    try { return JSON.parse(raw) } catch { return { raw } }
  }
  const fields = {}
  for (const part of raw.split(/--[\w-]+(?:\r\n|--)/)) {
    const name = part.match(/name="([^"]+)"/)
    if (!name) continue
    const content = part.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
    const filename = part.match(/filename="([^"]+)"/)
    if (filename) { fields[name[1]] = { filename: filename[1] }; continue }
    try { fields[name[1]] = JSON.parse(content) } catch { fields[name[1]] = content }
  }
  return fields
}

export async function orderFormHarness(page, options = {}) {
  const state = {
    recommendation: { ...orderFormRecommendation, ...options.recommendation },
    record: null, orders: [], requests: [], unknown: [], pageErrors: [], reserveError: null,
    saveError: null, sendError: null, acceptedWrites: [],
    projects: [{ id: 17, project_number: formProject.project_number, project_name: formProject.project_name, source: 'procurement', status: 'active', client_name: 'ADNOC' }],
    vendors: formVendors.map(vendor => ({ ...vendor, email: 'supplier@example.test', contact_person: 'Synthetic Supplier Contact', phone: '+971500000000', address: 'Abu Dhabi, UAE', is_active: true })),
  }
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date('2026-09-15T08:00:00Z'))
  await page.addInitScript(user => {
    localStorage.setItem('radai_access_token', 'isolated-order-form-fixture-token')
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'false')
    localStorage.setItem('radai_theme', 'light')
  }, formActor)
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method(), body = parseBody(request)
    state.requests.push({ path, method, body })
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
    if (path === '/api/v1/procurement/requisitions/get_approvers/') return reply(route, { users: employees })
    if (path === '/api/v1/procurement/vendors/' && method === 'GET') return reply(route, { count: state.vendors.length, next: null, results: state.vendors })
    if (['/api/v1/procurement/projects/', '/api/v1/procurement/orders/available-projects/'].includes(path) && method === 'GET') return reply(route, { count: state.projects.length, next: null, results: state.projects })
    if (['/api/v1/procurement/requisitions/', '/api/v1/procurement/orders/available-requisitions/'].includes(path) && method === 'GET') return reply(route, { count: 1, next: null, results: [state.recommendation] })
    if (path === `/api/v1/procurement/requisitions/${state.recommendation.id}/` && method === 'GET') return reply(route, state.recommendation)
    if (path === '/api/v1/procurement/orders/reserve-number/' && method === 'POST') return reply(route, state.reserveError || { po_number: orderFormNumber }, state.reserveError ? 400 : 200)
    if (path === '/api/v1/procurement/orders/' && method === 'GET') return reply(route, { count: state.orders.length, next: null, results: state.orders })
    if (path === '/api/v1/procurement/po-documents/' && method === 'GET') return reply(route, { count: 0, next: null, results: [] })
    if (path === `/api/v1/procurement/orders/${orderFormId}/` && method === 'GET') return reply(route, state.record)
    if ((path === '/api/v1/procurement/orders/' && method === 'POST') || (path === `/api/v1/procurement/orders/${orderFormId}/` && method === 'PATCH')) {
      const error = body?.status === 'sent' ? state.sendError || state.saveError : state.saveError
      if (error) return reply(route, error, 400)
      state.record = { ...state.record, ...body, id: orderFormId, created_by: formActor.id, created_by_name: formActor.full_name, vendor_name: state.vendors.find(vendor => String(vendor.id) === String(body.vendor))?.name, pr_number: state.recommendation.pr_number, created_at: '2026-09-15T08:00:00Z', updated_at: '2026-09-15T08:00:00Z' }
      state.orders = [state.record]
      state.acceptedWrites.push({ path, method, body })
      return reply(route, state.record, method === 'POST' ? 201 : 200)
    }
    state.unknown.push({ path, method })
    return reply(route, { detail: 'Unexpected isolated purchase order form test request.' }, 400)
  })
  await page.goto('/procurement/orders/new', { waitUntil: 'domcontentloaded' })
  return state
}
