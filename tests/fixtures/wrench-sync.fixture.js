// Synthetic contracts for the actual App. Every API and external request is
// intercepted before navigation; no Wrench, S3, credential or business data is used.
export const wrenchToken = 'isolated-wrench-f04-fixture-token'
export const wrenchCapabilities = [
  { direction: 'wrench_to_radai', entity_type: 'document', description: 'Retrieve document metadata; no canonical RADAI records are imported.' },
  { direction: 'wrench_to_radai', entity_type: 'transmittal', description: 'Retrieve transmittal metadata; no canonical RADAI records are imported.' },
]
export const wrenchConfig = {
  configured: true,
  config: {
    id: 9401, base_url: 'https://synthetic-wrench.example.test/WebAPI', svc_url: '',
    server_id: 1, login_name: 'synthetic-operator', organization_name: 'Synthetic integration',
    connection_verified: true, is_active: true, workstation_name: 'RADAI',
  },
  sync_capabilities: wrenchCapabilities,
}
export const response = (body, status = 200) => ({ status, body })
export const failure = (status = 503, detail = 'Synthetic service temporarily unavailable.') => response({ detail }, status)
export const syncLog = (overrides = {}) => ({
  id: 9402, direction: 'wrench_to_radai', entity_type: 'document', status: 'success',
  records_requested: 2, records_synced: 2, records_failed: 0, error_message: '',
  started_at: '2026-09-24T08:00:00Z', completed_at: '2026-09-24T08:00:01Z',
  sync_details: { retrieval_validated: true, effect: 'metadata_retrieval' },
  ...overrides,
})
export const exportJob = (overrides = {}) => ({
  id: 9403, mode: 'batch', entity_type: 'transmittals', status: 'pending',
  s3_prefix: 'wrench/', records_exported: 0, files_written: 0,
  started_at: '2026-09-24T08:00:00Z', error_message: '', job_details: {}, ...overrides,
})
const actor = {
  id: 9400, username: 'synthetic-integration-operator', first_name: 'Synthetic', last_name: 'Operator',
  full_name: 'Synthetic Operator', email: 'wrench@example.test', is_active: true, is_superuser: false,
  roles: [{ code: 'admin', name: 'Administrator' }], modules: [{ code: 'wrench_integration' }],
  module_actions: { wrench_integration: ['read', 'create', 'update', 'export'] },
}
const reply = (route, result) => route.fulfill({
  status: result.status, contentType: 'application/json', body: JSON.stringify(result.body),
})

export async function wrenchHarness(page, options = {}) {
  const state = {
    requests: [], unknown: [], pageErrors: [], externalRequests: [], counts: {},
    config: response(wrenchConfig), logs: response([]), trigger: response(syncLog(), 201),
    jobs: response([]), start: response(exportJob(), 202), watchers: response([]),
    startWatcher: response(exportJob({ id: 9404, mode: 'realtime', job_details: { library_watcher: { order_no: 'SYNTHETIC-ORDER' } } }), 202),
    ...options,
  }
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('radai_access_token', token)
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'true')
    localStorage.setItem('radai_theme', 'light')
  }, { user: actor, token: wrenchToken })
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (!path.startsWith('/api/')) {
      const localAsset = ['127.0.0.1', 'localhost'].includes(url.hostname) && (
        (['/admin/wrench', '/login'].includes(path) && request.isNavigationRequest()) ||
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
      'GET /api/v1/wrench/config/': 'config', 'GET /api/v1/wrench/sync/': 'logs',
      'POST /api/v1/wrench/sync/trigger/': 'trigger', 'GET /api/v1/wrench/s3-sync/': 'jobs',
      'POST /api/v1/wrench/s3-sync/start/': 'start',
      'GET /api/v1/wrench/s3-sync/library-watch/status/': 'watchers',
      'POST /api/v1/wrench/s3-sync/library-watch/start/': 'startWatcher',
    }
    const key = keys[`${method} ${path}`]
    if (key) {
      state.counts[key] = (state.counts[key] || 0) + 1
      const candidate = state[key]
      const result = typeof candidate === 'function' ? await candidate(state.counts[key], call)
        : Array.isArray(candidate) ? candidate[Math.min(state.counts[key] - 1, candidate.length - 1)] : candidate
      return reply(route, result)
    }
    if (path === '/api/v1/health/') return reply(route, response({ status: 'ok' }))
    if (path === '/api/v1/users/check-first-login/') return reply(route, response({ must_reset_password: false }))
    if (path.includes('check-password-expiry')) return reply(route, response({ is_expired: false, must_change_password: false, show_warning: false, days_until_expiry: 90 }))
    if (path === '/api/v1/rbac/users/me/profile-completeness/') return reply(route, response({ is_complete: true, percentage: 100, missing_fields: [] }))
    if (path === '/api/v1/rbac/users/me/') return reply(route, response(actor))
    if (path === '/api/v1/users/employees/my-profile-photo/') return route.fulfill({ status: 204, body: '' })
    if (path === '/api/v1/notifications/unread_count/') return reply(route, response({ unread_count: 0 }))
    if (path === '/api/v1/notifications/push-config/') return reply(route, response({ enabled: false, available: false }))
    if (path.endsWith('/pending-for-me/')) return reply(route, response({ count: 0, results: [] }))
    if (path.startsWith('/api/v1/ai-champion/') || path.startsWith('/api/v1/rbac/ai-champion/')) return reply(route, response({ success: true }))
    state.unknown.push(call)
    return reply(route, failure(400, 'Unexpected isolated Wrench request.'))
  })
  await page.goto('/admin/wrench', { waitUntil: 'domcontentloaded' })
  return state
}
