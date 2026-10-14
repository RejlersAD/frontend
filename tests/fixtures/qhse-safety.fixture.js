// Synthetic browser contracts only. The actual App and QHSE route are mounted;
// every API and external request is intercepted before navigation. These
// fixtures do not establish production permissions or safety-source coverage.
export const safetyRoute = '/qhse/general/health-safety'
export const safetyProjectsPath = '/api/v1/qhse/areas/health-safety/projects/'
export const safetyToken = 'isolated-qhse-safety-fixture-token'

const actor = {
  id: 9301, username: 'synthetic-quality-reader', first_name: 'Synthetic', last_name: 'Reader',
  full_name: 'Synthetic Reader', email: 'quality@example.test', is_active: true, is_superuser: false,
  roles: [], modules: [{ code: 'qhse_health_safety' }],
  module_actions: { qhse_health_safety: ['read'] },
}
const reply = (route, body, status = 200) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(body),
})

export function qualityProject(overrides = {}) {
  return {
    id: 9302, projectNo: 'SYNTHETIC-QHSE-01', projectTitle: 'Synthetic quality project',
    projectManager: 'Synthetic Manager', projectStartingDate: '2025-01-01',
    projectClosingDate: '2026-12-31', carsOpen: 2, carsClosed: 4, obsOpen: 5, obsClosed: 6,
    // These are quality effort and project progress, never injury/exposure evidence.
    manHourForQuality: 200000, manhoursUsed: 160000,
    projectKPIsAchievedPercent: '100%', projectCompletionPercent: '100%',
    delayInAuditsNoDays: 0, ...overrides,
  }
}

export async function safetyHarness(page, options = {}) {
  const state = {
    projects: structuredClone(options.projects ?? [qualityProject()]),
    response: options.response ?? null, requests: [], unknown: [], pageErrors: [], externalRequests: [],
  }
  await page.addInitScript(({ user, token, sidebarCollapsed }) => {
    localStorage.setItem('radai_access_token', token)
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', String(sidebarCollapsed))
    localStorage.setItem('radai_theme', 'light')
  }, { user: actor, token: safetyToken, sidebarCollapsed: options.sidebarCollapsed ?? true })
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (!path.startsWith('/api/')) {
      const localAsset = ['127.0.0.1', 'localhost'].includes(url.hostname) && (
        (path === safetyRoute && request.isNavigationRequest()) ||
        ['/src/', '/node_modules/', '/@', '/assets/'].some(prefix => path.startsWith(prefix)) ||
        ['script', 'stylesheet', 'image', 'font'].includes(request.resourceType())
      )
      if (localAsset) return route.continue()
      state.externalRequests.push({ url: url.href, method })
      return route.fulfill({ status: 204, body: '' })
    }
    const call = { path, method, query: Object.fromEntries(url.searchParams), authorization: request.headers().authorization, body: request.postData() }
    state.requests.push(call)
    if (path === '/api/v1/health/') return reply(route, { status: 'ok' })
    if (path === '/api/v1/users/check-first-login/') return reply(route, { must_reset_password: false })
    if (path.includes('check-password-expiry')) return reply(route, { is_expired: false, must_change_password: false, show_warning: false, days_until_expiry: 90 })
    if (path === '/api/v1/rbac/users/me/profile-completeness/') return reply(route, { is_complete: true, percentage: 100, missing_fields: [] })
    if (path === '/api/v1/rbac/users/me/') return reply(route, actor)
    if (path === '/api/v1/users/employees/my-profile-photo/') return route.fulfill({ status: 204, body: '' })
    if (path === '/api/v1/notifications/unread_count/') return reply(route, { unread_count: 0 })
    if (path === '/api/v1/notifications/push-config/') return reply(route, { enabled: false, available: false })
    if (path.endsWith('/pending-for-me/')) return reply(route, { count: 0, results: [] })
    if (path.startsWith('/api/v1/ai-champion/') || path.startsWith('/api/v1/rbac/ai-champion/')) return reply(route, { success: true })
    if (path === safetyProjectsPath && method === 'GET') {
      if (options.beforeProjectsResponse) await options.beforeProjectsResponse()
      if (state.response) return reply(route, state.response.body, state.response.status)
      return reply(route, { count: state.projects.length, next: null, previous: null, results: state.projects })
    }
    state.unknown.push(call)
    return reply(route, { detail: 'Unexpected isolated QHSE safety request.' }, 400)
  })
  await page.goto(safetyRoute, { waitUntil: 'domcontentloaded' })
  return state
}
