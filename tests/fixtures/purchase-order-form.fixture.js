// The actual App is used with every API request intercepted before navigation.
// Synthetic records never reach the live database, including number reservation.
import { formActor, formProject, formReference, formVendors } from './purchase-recommendation-form.fixture'
import { fileURLToPath } from 'node:url'
import { mixedSizePdf } from './mixed-size-pdf.fixture'

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
    actor: options.actor || formActor,
    recommendation: { ...orderFormRecommendation, ...options.recommendation },
    record: null, orders: [], pendingDocuments: [], documentRecords: {}, requests: [], unknown: [], pageErrors: [], reserveError: null,
    saveError: null, sendError: null, acceptedWrites: [],
    uploadedDocuments: [], uploadedDocumentsError: null, uploadedContent: {}, generatedPdf: mixedSizePdf(1),
    generatedWord: 'Synthetic editable Word document', previewError: null,
    poPdfPreviews: {}, poPdfPreviewDelivered: {}, approvalEmployees: [], approvalEmployeesError: null,
    poPdfImportResult: null, poPdfImportError: null,
    projects: [{ id: 17, project_number: formProject.project_number, project_name: formProject.project_name, source: 'procurement', status: 'active', client_name: 'ADNOC' }],
    vendors: formVendors.map(vendor => ({ ...vendor, email: 'supplier@example.test', contact_person: 'Synthetic Supplier Contact', phone: '+971500000000', address: 'Abu Dhabi, UAE', is_active: true })),
  }
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date('2026-09-15T08:00:00Z'))
  await page.addInitScript(user => {
    // Native PDF viewer frames do not expose the app's local storage.
    if (window !== window.top) return
    localStorage.setItem('radai_access_token', 'isolated-order-form-fixture-token')
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'false')
    localStorage.setItem('radai_theme', 'light')
  }, state.actor)
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.route('**/assets/images/sidebar-industrial-dusk.png', route => route.fulfill({
    path: fileURLToPath(new URL('../../public/assets/images/sidebar-industrial-dusk.png', import.meta.url)),
    contentType: 'image/png',
  }))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method(), body = parseBody(request)
    state.requests.push({ path, method, body, query: Object.fromEntries(url.searchParams) })
    if (options.handleRequest && await options.handleRequest(route, state, url)) return
    if (path === '/api/v1/health/') return reply(route, { status: 'ok' })
    if (path === '/api/v1/users/check-first-login/') return reply(route, { must_reset_password: false })
    if (path === '/api/v1/rbac/users/me/profile-completeness/') return reply(route, { is_complete: true, percentage: 100, missing_fields: [] })
    if (path.includes('check-password-expiry')) return reply(route, { is_expired: false, must_change_password: false, show_warning: false, days_until_expiry: 90 })
    if (path === '/api/v1/notifications/unread_count/') return reply(route, { unread_count: 0 })
    if (path === '/api/v1/notifications/push-config/') return reply(route, { enabled: false, available: false })
    if (path === '/api/v1/users/employees/my-profile-photo/') return route.fulfill({ status: 204, body: '' })
    if (path.endsWith('/pending-for-me/')) return reply(route, { count: 0, results: [] })
    if (path.startsWith('/api/v1/ai-champion/') || path.startsWith('/api/v1/rbac/ai-champion/')) return reply(route, { success: true })
    if (path === '/api/v1/rbac/users/me/') return reply(route, state.actor)
    if (path === '/api/v1/users/employees/my-signature/') return reply(route, { signature: '' })
    if (path === '/api/v1/procurement/requisitions/get_approvers/') return reply(route, { users: employees })
    if (path === '/api/v1/procurement/vendors/' && method === 'GET') return reply(route, { count: state.vendors.length, next: null, results: state.vendors })
    if (['/api/v1/procurement/projects/', '/api/v1/procurement/orders/available-projects/'].includes(path) && method === 'GET') return reply(route, { count: state.projects.length, next: null, results: state.projects })
    if (['/api/v1/procurement/requisitions/', '/api/v1/procurement/orders/available-requisitions/'].includes(path) && method === 'GET') return reply(route, { count: 1, next: null, results: [state.recommendation] })
    if (path === `/api/v1/procurement/requisitions/${state.recommendation.id}/` && method === 'GET') return reply(route, state.recommendation)
    if (path === '/api/v1/procurement/orders/reserve-number/' && method === 'POST') return reply(route, state.reserveError || { po_number: orderFormNumber }, state.reserveError ? 400 : 200)
    if (path === '/api/v1/procurement/orders/' && method === 'GET') return reply(route, { count: state.orders.length, next: null, results: state.orders })
    if (path === '/api/v1/procurement/orders/preview-document/' && method === 'POST') {
      if (state.previewError) return reply(route, state.previewError, 400)
      return route.fulfill({ status: 200, contentType: body.format === 'word' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf', body: body.format === 'word' ? state.generatedWord : state.generatedPdf, headers: { 'content-disposition': `inline; filename="Current-PO.${body.format === 'word' ? 'docx' : 'pdf'}"` } })
    }
    if (path === '/api/v1/procurement/po-documents/' && method === 'GET') return reply(route, { count: state.pendingDocuments.length, next: null, results: state.pendingDocuments })
    const reconciliationMatch = path.match(/^\/api\/v1\/procurement\/po-documents\/([^/]+)\/reconcile\/$/)
    if (reconciliationMatch && method === 'POST') {
      if (state.poReconcileError) return reply(route, state.poReconcileError, 409)
      const document = state.documentRecords[reconciliationMatch[1]]
      if (body.reviewed_fields) document.extracted_data = { ...document.extracted_data, ...body.reviewed_fields }
      const fields = document.extracted_data
      state.record = { ...fields, id: orderFormId, title: fields.summary, total_amount: fields.gross_amount || fields.total_amount, pr_reference: body.pr_id, pr_number: state.recommendation.pr_number, vendor: body.vendor_id, vendor_name: state.vendors.find(vendor => String(vendor.id) === String(body.vendor_id))?.name, status: 'draft', created_at: document.created_at, items: [] }
      state.orders = [state.record]
      document.confirmed_po = orderFormId
      const contentUrl = `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/${document.id}/content/`
      state.uploadedDocuments = [{ id: document.id, filename: document.original_filename, content_url: contentUrl }]
      state.uploadedContent[contentUrl] = state.uploadedContent[`/api/v1/procurement/po-documents/${document.id}/content/`]
      state.acceptedWrites.push({ path, method, body })
      return reply(route, { success: true, operation: 'created', purchase_order_id: orderFormId, confirmed_po: orderFormId, document_id: document.id, ...(fields.originating_pr_id ? { pr_id: fields.originating_pr_id, pr_number: state.recommendation.pr_number, po_link: { status: 'linked', po_id: orderFormId, po_number: fields.po_number, manual_link_required: false } } : {}) })
    }
    const pendingMatch = path.match(/^\/api\/v1\/procurement\/po-documents\/([^/]+)\/$/)
    if (pendingMatch && state.documentRecords[pendingMatch[1]]) {
      const key = pendingMatch[1]
      if (method === 'GET') return reply(route, state.documentRecords[key])
      if (method === 'PATCH') {
        state.documentRecords[key].extracted_data = { ...state.documentRecords[key].extracted_data, ...body }
        state.acceptedWrites.push({ path, method, body })
        return reply(route, state.documentRecords[key])
      }
      if (method === 'DELETE') {
        delete state.documentRecords[key]
        state.pendingDocuments = state.pendingDocuments.filter(document => document.id !== key)
        state.acceptedWrites.push({ path, method, body })
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (path === '/api/v1/procurement/po-documents/approval-employees/' && method === 'GET') {
      if (state.approvalEmployeesError) return reply(route, state.approvalEmployeesError, 503)
      const search = String(url.searchParams.get('search') || '').toLowerCase()
      const results = state.approvalEmployees.filter(employee => `${employee.name} ${employee.position} ${employee.employee_number}`.toLowerCase().includes(search))
      return reply(route, { count: results.length, results })
    }
    if (path === '/api/v1/procurement/po-documents/preview_signed_pdf/' && method === 'POST') {
      const filename = body?.file?.filename
      const preview = state.poPdfPreviews[filename] || { data: { approval_evidence: {} } }
      if (preview.wait) await preview.wait
      await reply(route, preview.error || { success: true, preview_only: true, mapping_issues: [], reconciliation_issues: [], ...preview.data,
        extracted_data: { po_number: orderFormNumber, vendor_name: 'Original supplier', summary: 'Original signed scope', currency: 'USD', total_amount: '6489', gross_amount: '6489', tax_amount: '0', po_date: '2026-07-01', seller_contact_person: 'Original Contact', seller_email: 'original@example.test', seller_phone: '+971500001111', seller_address: 'Abu Dhabi', seller_country: 'United Arab Emirates', vendor_license_no: 'ORIGINAL-LICENSE', ...(preview.data?.extracted_data || {}) },
      }, preview.error ? preview.status || 503 : 200)
      state.poPdfPreviewDelivered[filename] = true
      return
    }
    if (path === '/api/v1/procurement/po-documents/import_signed_pdf/' && method === 'POST') {
      if (state.poPdfImportError) return reply(route, state.poPdfImportError, state.poPdfImportErrorStatus || 400)
      state.acceptedWrites.push({ path, method, body })
      const saved = state.poPdfImportResult || { success: true, document_id: 'synthetic-signed-po-document', purchase_order_id: orderFormId, po_number: orderFormNumber, operation: 'created', pr_id: body.pr_id || null,
        ...(body.pr_id ? { po_link: { status: 'linked', po_id: orderFormId, po_number: orderFormNumber, manual_link_required: false } } : {}),
      }
      if (saved.purchase_order_id) {
        state.record = { ...body.reviewed_fields, id: saved.purchase_order_id, po_number: saved.po_number, status: 'draft', title: body.reviewed_fields?.summary, vendor_name: body.reviewed_fields?.vendor_name, currency: body.reviewed_fields?.currency, total_amount: body.reviewed_fields?.entered_amount || '6489', pr_reference: saved.pr_id, items: [] }
        state.orders = [state.record]
      }
      return reply(route, saved)
    }
    if (path === `/api/v1/procurement/orders/${orderFormId}/uploaded-documents/` && method === 'GET') {
      if (state.uploadedDocumentsDeferred) await state.uploadedDocumentsDeferred
      return reply(route, state.uploadedDocumentsError || { count: state.uploadedDocuments.length, results: state.uploadedDocuments }, state.uploadedDocumentsError ? 503 : 200)
    }
    if (state.uploadedContent[path] && method === 'GET') {
      const content = state.uploadedContent[path]
      state.requests[state.requests.length - 1].authorization = request.headers().authorization
      if (content.status) return reply(route, { detail: 'Synthetic inaccessible upload.' }, content.status)
      return route.fulfill({ status: 200, contentType: content.contentType || 'application/pdf', body: content.body })
    }
    if (path === `/api/v1/procurement/orders/${orderFormId}/export-pdf/` && method === 'GET' && state.generatedPdf) {
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: state.generatedPdf, headers: { 'content-disposition': 'inline; filename="Generated-PO.pdf"' } })
    }
    if (path === `/api/v1/procurement/orders/${orderFormId}/export-word/` && method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', body: state.generatedWord, headers: { 'content-disposition': 'attachment; filename="Generated-PO.docx"' } })
    }
    if (path === `/api/v1/procurement/orders/${orderFormId}/` && method === 'GET') return reply(route, state.record)
    if (path === `/api/v1/procurement/orders/${orderFormId}/` && method === 'DELETE') {
      if (state.deleteError) return reply(route, state.deleteError, 409)
      state.orders = []
      state.record = null
      state.uploadedDocuments = []
      state.acceptedWrites.push({ path, method, body })
      return route.fulfill({ status: 204, body: '' })
    }
    if ((path === '/api/v1/procurement/orders/' && method === 'POST') || (path === `/api/v1/procurement/orders/${orderFormId}/` && method === 'PATCH')) {
      const error = body?.status === 'sent' ? state.sendError || state.saveError : state.saveError
      if (error) return reply(route, error, 400)
      state.record = { ...state.record, ...body, id: orderFormId, created_by: formActor.id, created_by_name: formActor.full_name, vendor_name: body.vendor === undefined ? state.record?.vendor_name : state.vendors.find(vendor => String(vendor.id) === String(body.vendor))?.name, pr_number: (Object.hasOwn(body, 'pr_reference') ? body.pr_reference : state.record?.pr_reference) ? state.recommendation.pr_number : '', created_at: '2026-09-15T08:00:00Z', updated_at: '2026-09-15T08:00:00Z' }
      state.orders = [state.record]
      state.acceptedWrites.push({ path, method, body })
      return reply(route, state.record, method === 'POST' ? 201 : 200)
    }
    state.unknown.push({ path, method })
    return reply(route, { detail: 'Unexpected isolated purchase order form test request.' }, 400)
  })
  await page.goto(options.path || '/procurement/orders/new', { waitUntil: 'domcontentloaded' })
  return state
}
