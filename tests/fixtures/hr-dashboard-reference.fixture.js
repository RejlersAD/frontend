// Synthetic local-only HR dashboard fixtures. No backend or provider is used.
export const response = (body, status = 200) => ({ body, status })
export const denied = response({ detail: 'Synthetic HR access denied.' }, 403)
export const departments = ['Project Management', 'PDDS', 'Piping, Layout, Mechanical', 'Civil and Structural Engineering', 'Management']
const names = ['Asha Patel', 'Noah Chen', 'Maya Hassan', 'Liam Davies', 'Sofia Andersson']
export const workforce = Array.from({ length: 267 }, (_, index) => ({
  id: `synthetic-employee-${index + 1}`, user_id: index + 9600,
  employee_code: `SYN-${index + 1}`, employee_number: `SYN-${index + 1}`,
  employee_name: names[index] || `Synthetic Employee ${index + 1}`,
  first_name: (names[index] || `Synthetic Employee ${index + 1}`).split(' ')[0],
  last_name: (names[index] || `Synthetic Employee ${index + 1}`).split(' ').slice(1).join(' '),
  email: `synthetic${index + 1}@example.test`, status: 'active', is_active: true,
  department: departments[index % departments.length], is_mfa_enabled: true,
  join_date: index < 5 ? `2026-09-${String(23 - index * 2).padStart(2, '0')}` : '2025-01-01',
  created_at: '2025-01-01T08:00:00Z',
}))
export const attendanceRows = workforce.slice(0, 202).map((employee, index) => ({
  ...employee, is_in: index < 175, punch_type: index < 175 ? 'IN' : 'OUT',
  first_in: index < 29 ? '09:15' : '08:30', first_in_time: index < 29 ? '09:15' : '08:30',
  punch_time: index < 29 ? '2026-09-24T09:15:00+04:00' : '2026-09-24T08:30:00+04:00',
  is_late: index < 29, is_full_day: true, hours_worked: 7.5, date: '2026-09-24',
}))
export const live = { configured: true, rows: attendanceRows, summary: { currently_in: 175, currently_out: 27, total_seen_today: 202, late_today: 29 }, date: '2026-09-24' }
export const daily = { configured: true, rows: attendanceRows, date: '2026-09-24' }
export const monthly = {
  configured: true,
  rows: workforce.map((employee, index) => ({
    ...employee, days_present: 18, late_arrivals: 1, full_days: 18, half_days: 0, total_hours: 144,
    days_detail: [18, 19, 20, 21, 22, 23, 24]
      .filter((day, dayIndex) => index < [170, 162, 164, 219, 211, 216, 202][dayIndex])
      .map(day => ({ date: `2026-09-${day}`, first_in: `2026-09-${day}T08:30:00+04:00`, hours: 8 })),
  })),
  year: 2026, month: 9,
}
const actor = {
  id: 9599, username: 'synthetic-hr-reviewer', first_name: 'Synthetic', last_name: 'Reviewer',
  full_name: 'Synthetic Reviewer', email: 'synthetic-hr@example.test', is_active: true,
  is_staff: true, is_superuser: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }],
  modules: [{ code: 'hr_management' }], module_actions: { hr_management: ['read', 'create', 'update', 'export'] },
}
const reply = (route, result) => route.fulfill({ status: result.status, contentType: 'application/json', body: JSON.stringify(result.body) })

export async function hrDashboardHarness(page, options = {}) {
  const state = {
    requests: [], unknown: [], externalRequests: [], pageErrors: [], counts: {},
    workforce: response({ count: workforce.length, results: workforce }),
    live: response(live), daily: response(daily), monthly: response(monthly),
    lifecycle: response([
      { request_id: 'synthetic-onboarding-1', request_type: 'Onboarding', employee_name: 'Synthetic New Joiner', user_id: 9700, effective_date: '2026-09-15', status: 'initiated' },
      { request_id: 'synthetic-offboarding-1', request_type: 'Offboarding', employee_name: 'Synthetic Leaver', user_id: 9701, effective_date: '2026-09-17', status: 'in_progress' },
    ]),
    reviews: response([]), leave: response({ count: 0, results: [] }),
    alerts: response({ count: 2, results: [{ id: 'synthetic-alert-1' }, { id: 'synthetic-alert-2' }] }),
    salary: response([]), slips: response({ count: 0, results: [] }),
    payrollSummary: response({}), overtime: response({ count: 0, results: [] }),
    ...options,
  }
  await page.clock.install({ time: new Date('2026-09-24T08:00:00Z') })
  await page.addInitScript(({ user }) => {
    localStorage.setItem('radai_access_token', 'isolated-hr-reference-token')
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'false')
    localStorage.setItem('radai_theme', 'light')
    // Block unrelated delayed telemetry transport, including route teardown.
    const telemetry = url => /\/rbac\/ai-champion\/track\//.test(String(url))
    const tracked = new WeakSet()
    const open = XMLHttpRequest.prototype.open
    const send = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (telemetry(url)) tracked.add(this)
      return open.call(this, method, url, ...rest)
    }
    XMLHttpRequest.prototype.send = function (...args) {
      if (tracked.has(this)) { queueMicrotask(() => this.dispatchEvent(new ProgressEvent('abort'))); return }
      return send.apply(this, args)
    }
    const fetch = window.fetch
    window.fetch = function (input, options) {
      if (telemetry(input?.url || input)) return Promise.resolve(new Response('{"success":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
      return fetch.call(this, input, options)
    }
  }, { user: actor })
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (!path.startsWith('/api/')) {
      const local = ['127.0.0.1', 'localhost'].includes(url.hostname)
      if (local && (request.isNavigationRequest() || ['script', 'stylesheet', 'image', 'font'].includes(request.resourceType()))) return route.continue()
      state.externalRequests.push({ url: url.href, method })
      return route.fulfill({ status: 204, body: '' })
    }
    const call = { path, method, query: Object.fromEntries(url.searchParams), body: request.postDataJSON() }
    state.requests.push(call)
    const keys = {
      '/api/v1/hr/employees/workforce-summary/': 'workforce',
      '/api/v1/timesheet/live/': 'live', '/api/v1/timesheet/daily/': 'daily', '/api/v1/timesheet/monthly/': 'monthly',
      '/api/v1/onboarding/onboarding/command-center-pending/': 'lifecycle', '/api/v1/hr/performance-reviews/': 'reviews',
      '/api/v1/payroll/leave-requests/': 'leave', '/api/v1/payroll/audit-alerts/': 'alerts',
      '/api/v1/payroll/salary-structures/pending/': 'salary', '/api/v1/finance/salary-slips/': 'slips',
      '/api/v1/payroll/dashboard-summary/': 'payrollSummary', '/api/v1/hr/overtime-requests/': 'overtime',
    }
    const key = keys[path]
    if (method === 'GET' && key) {
      state.counts[key] = (state.counts[key] || 0) + 1
      const result = typeof state[key] === 'function' ? await state[key](call, state.counts[key]) : state[key]
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
    return reply(route, response({ detail: 'Unexpected isolated HR request.' }, 400))
  })
  await page.goto('/hr', { waitUntil: 'domcontentloaded' })
  return state
}
