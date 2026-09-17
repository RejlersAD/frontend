// Synthetic records only. Every API request is intercepted before the real App
// mounts; unknown requests fail locally and never reach a production service.
import { fileURLToPath } from 'node:url'
import { formActor } from './purchase-recommendation-form.fixture.js'

export const reconciliationNow = '2026-09-17T08:00:00Z'
export const reconciliationProjects = [
  { id: '17', code: '5900985', name: 'PE4 Compression Upgrade', client_name: 'ADNOC Refining', status: 'active', currency: 'AED' },
  { id: '18', code: '5901142', name: 'SARB Produced Water Treatment', client_name: 'ADNOC Offshore', status: 'active', currency: 'AED' },
  { id: '19', code: '5900033', name: 'Grid Power Integration', client_name: 'Grid Operations', status: 'on_hold', currency: 'USD' },
]
const suggest = (index, match_strength, reasons) => ({ ...reconciliationProjects[index], match_strength, reasons })
const allocation = amount => ({ status: 'unallocated', approved_amount: 0, draft_amount: 0, source_amount: amount, remaining_amount: amount })
export const reconciliationRows = [
  { id: 'pr-001', record_type: 'purchase_requisition', identifier: 'PR-2026-1043', title: 'PE4 compression engineering study', reference: ['5900985 revision A'], reason: 'no_exact_match', amount: '150000.00', currency: 'AED', created_at: '2026-09-15T08:00:00Z', current_project: null, exception: null, allocation: allocation(150000), suggested_projects: [suggest(0, 'high', ['Project code appears in the legacy reference.']), suggest(1, 'low', ['Client name is shared with the source record.'])] },
  { id: 'po-001', record_type: 'purchase_order', identifier: 'PO-2026-0087', title: 'Produced water instrumentation package', reference: ['5901142', '5900985'], reason: 'multiple_projects', amount: '25000.00', currency: 'AED', created_at: '2026-09-16T07:00:00Z', current_project: null, exception: null, allocation: allocation(25000), suggested_projects: [suggest(1, 'medium', ['One of two project references matches this project code.'])] },
  { id: 'pr-002', record_type: 'purchase_requisition', identifier: 'PR-2026-1044', title: 'Shared software subscriptions', reference: 'INTERNAL / FINANCE', reason: 'no_exact_match', amount: '2750.00', currency: 'USD', created_at: '2026-09-14T07:00:00Z', current_project: null, exception: { id: 'exception-existing', reason: 'Awaiting department confirmation.', resolved_by: 'Maya Hassan', created_at: '2026-09-16T08:00:00Z' }, allocation: allocation(2750), suggested_projects: [] },
  { id: 'invoice-001', record_type: 'invoice', identifier: 'INV-2026-0331', title: 'Petroserve Solutions', reference: 'PO-2026-0032', reason: 'missing_po_match', amount: '15750.00', currency: 'AED', created_at: '2026-09-13T07:00:00Z', current_project: null, exception: null, allocation: null, invoice_match: { status: 'unmatched', allocated_amount: 0, remaining_amount: 15750, existing_pos: [], exception_codes: [] }, suggested_projects: [] },
  { id: 'master-001', record_type: 'procurement_project', identifier: 'LEGACY-PLANT', title: 'SARB water plant procurement', reference: 'SARB plant works', reason: 'no_exact_match', amount: null, currency: '', created_at: '2026-09-12T07:00:00Z', current_project: null, exception: null, allocation: null, suggested_projects: [suggest(1, 'medium', ['Project name appears in the source title.'])] },
]

export function reconciliationReport(rows = reconciliationRows) {
  const currencies = new Map()
  for (const row of rows) {
    if (row.amount == null || !row.currency) continue
    const aggregate = currencies.get(row.currency) || { currency: row.currency, amount: 0, record_count: 0 }
    aggregate.amount += Number(row.amount)
    aggregate.record_count += 1
    currencies.set(row.currency, aggregate)
  }
  return {
    generated_at: reconciliationNow,
    matching_rule: 'Exact project code only; manual review for uncertain references.',
    summary: {
      enterprise_projects: reconciliationProjects.length,
      unresolved_total: rows.length,
      suggested_record_count: rows.filter(row => row.suggested_projects.length).length,
      sample_count: rows.length,
      sample_complete: true,
      unresolved_amounts_by_currency: [...currencies.values()].map(row => ({ ...row, amount: row.amount.toFixed(2) })),
      ...Object.fromEntries([['procurement_projects', 'procurement_project'], ['purchase_requisitions', 'purchase_requisition'], ['purchase_orders', 'purchase_order'], ['invoices', 'invoice']].map(([key, type]) => [key, { total: rows.filter(row => row.record_type === type).length + 10, linked_before: 10, resolvable: 0, unresolved: rows.filter(row => row.record_type === type).length }])),
    },
    unresolved: structuredClone(rows),
    canonical_projects: structuredClone(reconciliationProjects),
    purchase_order_choices: [{ id: 'canonical-po-032', po_number: 'PO-2026-0032', title: 'Engineering support services', project_id: '17', project_code: '5900985', vendor_id: 'vendor-21', vendor_name: 'Petroserve Solutions', amount: 15750, currency: 'AED', has_accepted_receipt: true }],
    recent_resolutions: [{ id: 'audit-existing', record_type: 'purchase_order', record_id: 'po-earlier', enterprise_project_id: '17', enterprise_project_code: '5900985', resolution: 'manual', reason: 'Verified original project code against the signed order.', resolved_by: 'Maya Hassan', created_at: '2026-09-16T09:00:00Z' }],
  }
}

const reply = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const actor = { ...formActor, modules: [...formActor.modules, { code: 'procurement' }, { code: 'procurement_projects' }, { code: 'projects' }], module_actions: { ...formActor.module_actions, procurement: ['read', 'create', 'update'], project_control: ['read', 'create', 'update'], procurement_projects: ['read', 'create', 'update'], projects: ['read', 'update'] } }

export async function reconciliationHarness(page, options = {}) {
  const currentActor = { ...actor, ...(options.actor || {}) }
  const initialReport = reconciliationReport(options.rows ?? reconciliationRows)
  const state = { report: initialReport, requests: [], unknown: [], pageErrors: [], resolutions: [], exceptions: [], invoiceMatches: [], allocations: [], reportError: null, saveError: null, exceptionError: null, holdReport: false, releaseReport: null, sources: structuredClone(initialReport.unresolved), invoiceResult: { match_status: 'verified', exception_codes: [] } }
  options.prepare?.(state)
  let reportGate = Promise.resolve()
  if (state.holdReport) reportGate = new Promise(resolve => { state.releaseReport = () => { state.holdReport = false; resolve() } })
  const refreshSummary = () => { state.report.summary = reconciliationReport(state.report.unresolved).summary }
  const addAudit = (body, resolution, project) => state.report.recent_resolutions.unshift({ id: `audit-${state.requests.length}`, record_type: body.record_type, record_id: body.record_id, enterprise_project_id: project?.id || null, enterprise_project_code: project?.code || null, resolution, reason: body.reason, resolved_by: 'Maya Hassan', created_at: reconciliationNow })
  await page.clock.setFixedTime(new Date(reconciliationNow))
  await page.addInitScript(({ user, theme }) => {
    localStorage.setItem('radai_access_token', 'isolated-reconciliation-fixture-token')
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'false')
    localStorage.setItem('radai_theme', theme)
    const applyTheme = () => document.documentElement.classList.toggle('dark', theme === 'dark')
    if (document.documentElement) applyTheme()
    else document.addEventListener('DOMContentLoaded', applyTheme, { once: true })
  }, { user: currentActor, theme: options.theme || 'light' })
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.route('**/assets/images/sidebar-industrial-dusk.png', route => route.fulfill({ path: fileURLToPath(new URL('../../public/assets/images/sidebar-industrial-dusk.png', import.meta.url)), contentType: 'image/png' }))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    const body = request.postData() ? request.postDataJSON() : null
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
    if (path === '/api/v1/rbac/users/me/') return reply(route, currentActor)
    if (path === '/api/v1/users/employees/my-signature/') return reply(route, { signature: '' })
    if (path === '/api/v1/procurement/projects/relationship-report/' && method === 'GET') {
      await reportGate
      if (state.reportError) return reply(route, state.reportError.body || { detail: state.reportError.message }, state.reportError.status || 503)
      return reply(route, state.report)
    }
    if (path === '/api/v1/procurement/projects/resolve-relationship/' && method === 'POST') {
      state.resolutions.push(body)
      if (state.saveError) return reply(route, state.saveError.body, state.saveError.status || 409)
      const source = state.sources.find(row => row.record_type === body.record_type && row.id === body.record_id)
      const project = state.report.canonical_projects.find(row => String(row.id) === String(body.enterprise_project_id))
      source.current_project = structuredClone(project)
      state.report.unresolved = state.report.unresolved.filter(row => !(row.record_type === body.record_type && row.id === body.record_id))
      addAudit(body, 'manual', project)
      refreshSummary()
      return reply(route, { success: true, record_type: body.record_type, record_id: body.record_id, enterprise_project_id: project.id, propagated: 0 })
    }
    if (path === '/api/v1/procurement/projects/relationship-exception/' && method === 'POST') {
      state.exceptions.push(body)
      if (state.exceptionError) return reply(route, state.exceptionError.body, state.exceptionError.status || 400)
      const row = state.report.unresolved.find(item => item.record_type === body.record_type && item.id === body.record_id)
      row.exception = { id: `exception-${state.exceptions.length}`, reason: body.reason, resolved_by: 'Maya Hassan', created_at: reconciliationNow }
      addAudit(body, 'exception', null)
      return reply(route, { id: row.exception.id, record_type: body.record_type, record_id: body.record_id, record_identifier: row.identifier, exception: row.exception })
    }
    if (path === '/api/v1/procurement/projects/resolve-invoice-po/' && method === 'POST') {
      state.invoiceMatches.push(body)
      const row = state.report.unresolved.find(item => item.id === body.invoice_id)
      row.invoice_match = { ...row.invoice_match, status: state.invoiceResult.match_status, allocated_amount: Number(body.allocated_amount), remaining_amount: Number(row.amount) - Number(body.allocated_amount) }
      if (state.invoiceResult.match_status === 'verified') state.report.unresolved = state.report.unresolved.filter(item => item.id !== body.invoice_id)
      refreshSummary()
      return reply(route, { ...state.invoiceResult, allocation_id: 'invoice-allocation-1' })
    }
    if (path === '/api/v1/project-control/wbs-nodes/' && method === 'GET') return reply(route, state.wbsError || [{ id: 201, project: '17', code: '01', name: 'Engineering' }], state.wbsError ? 503 : 200)
    if (path === '/api/v1/project-control/budget-allocations/' && method === 'GET') return reply(route, state.budgetError || [{ id: 301, project: '17', wbs_node: 201, code: 'BUD-ENG', name: 'Engineering control budget', status: 'approved' }, { id: 302, project: '17', wbs_node: 201, code: 'BUD-DRAFT', name: 'Unapproved allowance', status: 'draft' }], state.budgetError ? 503 : 200)
    if (path === '/api/v1/project-control/cost-allocations/' && method === 'POST') {
      const draft = { ...body, id: 401, status: 'draft' }
      state.allocations.push(draft)
      const row = state.report.unresolved.find(item => item.record_type === body.source_type && item.id === body.source_id)
      row.allocation = { ...row.allocation, draft_amount: Number(body.amount), remaining_amount: Number(row.amount) - Number(body.amount), status: 'partially_allocated' }
      return reply(route, draft, 201)
    }
    state.unknown.push({ path, method })
    return reply(route, { detail: 'Unexpected isolated reconciliation fixture request.' }, 400)
  })
  await page.goto('/procurement/projects/reconciliation', { waitUntil: 'domcontentloaded' })
  return state
}
