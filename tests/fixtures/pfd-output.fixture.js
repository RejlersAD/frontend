// Synthetic fixtures for the real App. All APIs and nonlocal requests are
// intercepted before navigation. No provider, production storage or records.
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'

export const pfdToken = 'isolated-pfd-f05-fixture-token'
export const documentId = '95000000-0000-4000-8000-000000000001'
export const originalId = '95000000-0000-4000-8000-000000000002'
export const regeneratedId = '95000000-0000-4000-8000-000000000003'
export const response = (body, status = 200) => ({ body, status })
export const failure = (status, detail) => response({ detail }, status)
export const originalBytes = Buffer.from('%PDF-1.4\nSynthetic reviewed artifact F05\n%%EOF\n')
export const regeneratedBytes = Buffer.from('%PDF-1.4\nSynthetic unreviewed artifact F05\n%%EOF\n')
export const originalHash = createHash('sha256').update(originalBytes).digest('hex')
export const regeneratedHash = createHash('sha256').update(regeneratedBytes).digest('hex')
export const pfdDocument = {
  id: documentId, document_title: 'Synthetic F05 source', document_number: 'SYNTHETIC-PFD-9501',
  revision: 'A', status: 'converted', project_name: 'Synthetic local verification',
  extracted_data: { equipment: [], process_description: 'Synthetic source content retained.' },
  created_at: '2026-09-24T08:00:00Z', updated_at: '2026-09-24T08:00:00Z',
}
export const conversion = (overrides = {}) => ({
  id: originalId, pfd_document: documentId, pfd_document_number: pfdDocument.document_number,
  pid_drawing_number: 'SYNTHETIC-PID-9501', pid_title: 'Synthetic reviewed P&ID', pid_revision: 'A',
  status: 'approved', reviewed_by: 9500, reviewed_by_name: 'Synthetic Reviewer',
  reviewed_at: '2026-09-24T08:01:00Z', review_notes: 'Synthetic original review evidence.',
  pid_file: 'https://synthetic-storage.example.test/approved-original.pdf',
  equipment_list: [], instrument_list: [], piping_details: [], safety_systems: [],
  design_parameters: {}, compliance_checks: {}, confidence_score: null,
  created_at: '2026-09-24T08:00:30Z', updated_at: '2026-09-24T08:01:00Z',
  artifact: { identity: originalId, sha256: originalHash, available: true, review_state: 'approved', source_conversion_id: null },
  allowed_actions: ['download', 'regenerate'],
  ...overrides,
})
export const newConversion = (overrides = {}) => conversion({
  id: regeneratedId, pid_title: 'Synthetic regenerated P&ID', status: 'completed',
  reviewed_by: null, reviewed_by_name: null, reviewed_at: null, review_notes: '',
  pid_file: 'https://synthetic-storage.example.test/unreviewed-new.pdf',
  created_at: '2026-09-24T08:03:00Z', updated_at: '2026-09-24T08:03:00Z',
  artifact: { identity: regeneratedId, sha256: regeneratedHash, available: true, review_state: 'unreviewed', source_conversion_id: originalId },
  ...overrides,
})
const actor = actions => ({
  id: 9500, username: 'synthetic-pfd-operator', first_name: 'Synthetic', last_name: 'Operator',
  full_name: 'Synthetic Operator', email: 'pfd@example.test', is_active: true, is_superuser: false,
  roles: [{ code: 'engineer', name: 'Engineer' }], modules: [{ code: 'pfd_to_pid' }],
  module_actions: { pfd_to_pid: actions },
})
const reply = (route, result) => route.fulfill({
  status: result.status, contentType: 'application/json', body: JSON.stringify(result.body),
})

export async function pfdHarness(page, options = {}) {
  const state = {
    requests: [], unknown: [], pageErrors: [], externalRequests: [], counts: {},
    document: response(pfdDocument), conversions: response({ count: 1, results: [conversion()] }),
    regenerate: response(newConversion(), 201), details: {}, actions: ['read', 'create', 'update', 'export'],
    downloads: {}, verify: response({ issues: [{ severity: 'observation', issue_observed: 'Synthetic original verification result.' }] }),
    ...options,
  }
  const user = actor(state.actions)
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('radai_access_token', token)
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'true')
    localStorage.setItem('radai_theme', 'light')
    // Activity telemetry is unrelated to F05 and may be scheduled during
    // Playwright's route teardown. Prevent its transport before App mounts.
    const isTelemetry = url => /\/rbac\/ai-champion\/track\//.test(String(url))
    const telemetryRequests = new WeakSet()
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (isTelemetry(url)) telemetryRequests.add(this)
      return originalOpen.call(this, method, url, ...rest)
    }
    XMLHttpRequest.prototype.send = function (...args) {
      if (telemetryRequests.has(this)) {
        queueMicrotask(() => this.dispatchEvent(new ProgressEvent('abort')))
        return
      }
      return originalSend.apply(this, args)
    }
    const originalFetch = window.fetch
    window.fetch = function (input, options) {
      if (isTelemetry(input?.url || input)) return Promise.resolve(new Response('{"success":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
      return originalFetch.call(this, input, options)
    }
  }, { user, token: pfdToken })
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (!path.startsWith('/api/')) {
      const localAsset = ['127.0.0.1', 'localhost'].includes(url.hostname) && (
        ((path.startsWith('/pfd/') || path === '/login') && request.isNavigationRequest()) ||
        ['/src/', '/node_modules/', '/@', '/assets/'].some(prefix => path.startsWith(prefix)) ||
        ['script', 'stylesheet', 'image', 'font'].includes(request.resourceType())
      )
      if (localAsset) return route.continue()
      state.externalRequests.push({ url: url.href, method })
      return route.fulfill({ status: 204, body: '' })
    }
    const call = { path, method, query: Object.fromEntries(url.searchParams), authorization: request.headers().authorization, body: request.postDataJSON() }
    state.requests.push(call)
    const keys = {
      [`GET /api/v1/pfd/documents/${documentId}/`]: 'document',
      'GET /api/v1/pfd/conversions/': 'conversions',
      [`POST /api/v1/pfd/conversions/${originalId}/regenerate/`]: 'regenerate',
      'POST /api/v1/pfd/conversions/verify-pid/': 'verify',
      'GET /api/v1/pfd/history/': 'overview',
      'GET /api/v1/pfd/history/conversions/': 'historyConversions',
    }
    const key = keys[`${method} ${path}`]
    if (key && state[key]) {
      state.counts[key] = (state.counts[key] || 0) + 1
      const candidate = state[key]
      const result = typeof candidate === 'function' ? await candidate(state.counts[key], call) : candidate
      return reply(route, result)
    }
    const download = path.match(/^\/api\/v1\/pfd\/conversions\/([^/]+)\/download_drawing\/$/)
      || path.match(/^\/api\/v1\/pfd\/history\/download\/pid\/([^/]+)\/$/)
    if (method === 'GET' && download) {
      state.counts.download = (state.counts.download || 0) + 1
      const result = state.downloads[download[1]]
      if (result) return reply(route, result)
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: download[1] === originalId ? originalBytes : regeneratedBytes })
    }
    const detail = path.match(/^\/api\/v1\/pfd\/conversions\/([^/]+)\/$/)
    if (method === 'GET' && detail) {
      state.counts.detail = (state.counts.detail || 0) + 1
      return reply(route, state.details[detail[1]] || response(detail[1] === originalId ? conversion() : newConversion()))
    }
    if (path === '/api/v1/health/') return reply(route, response({ status: 'ok' }))
    if (path === '/api/v1/users/check-first-login/') return reply(route, response({ must_reset_password: false }))
    if (path.includes('check-password-expiry')) return reply(route, response({ is_expired: false, must_change_password: false, show_warning: false, days_until_expiry: 90 }))
    if (path === '/api/v1/rbac/users/me/profile-completeness/') return reply(route, response({ is_complete: true, percentage: 100, missing_fields: [] }))
    if (path === '/api/v1/rbac/users/me/') return reply(route, response(user))
    if (path === '/api/v1/users/employees/my-profile-photo/') return route.fulfill({ status: 204, body: '' })
    if (path === '/api/v1/notifications/unread_count/') return reply(route, response({ unread_count: 0 }))
    if (path === '/api/v1/notifications/push-config/') return reply(route, response({ enabled: false, available: false }))
    if (path.endsWith('/pending-for-me/')) return reply(route, response({ count: 0, results: [] }))
    if (path.startsWith('/api/v1/ai-champion/') || path.startsWith('/api/v1/rbac/ai-champion/')) return reply(route, response({ success: true }))
    state.unknown.push(call)
    return reply(route, failure(400, 'Unexpected isolated PFD request.'))
  })
  await page.goto(options.route || `/pfd/convert/${documentId}`, { waitUntil: 'domcontentloaded' })
  return state
}
