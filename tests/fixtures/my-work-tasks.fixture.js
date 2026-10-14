import { fixedNow, pageOf } from './schedule-performance.fixture'
import { planningEmployees } from './planning-inputs.fixture'

export const assignedTask = (overrides = {}) => ({
  id: 2201, title: 'Prepare process design basis', task_type: 'task',
  project: { id: 17, code: '5900913', name: 'Residue Yield Improvement Project' },
  description: 'Prepare the engineering design basis and coordinate process interfaces.',
  acceptance_criteria: 'Document all process assumptions and obtain an independent review.',
  assigned_to: planningEmployees[0], reviewer: null, role: 'assignee',
  status: 'todo', progress_percent: 0, due_date: '2026-09-15', priority: 'high',
  allowed_statuses: ['todo', 'in_progress', 'blocked', 'completed'], can_update_progress: true,
  updated_at: fixedNow, ...overrides,
})

export async function myWorkTasksHarness(page, options = {}) {
  const state = { tasks: [assignedTask()], requests: [], writes: [], unknown: [], pageErrors: [], saveFailure: null, detailFailure: null, bundleReads: 0 }
  options.prepare?.(state)
  await page.clock.setFixedTime(new Date(fixedNow))
  await page.route(url => url.pathname === '/dashboard', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>My Work task regression</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="my-work-test"></div><script type="module" src="/tests/fixtures/my-work-tasks-harness.jsx"></script></body></html>' }))
  page.on('pageerror', error => state.pageErrors.push(error.message))
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method()
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    state.requests.push({ path, method })
    if (path.endsWith('/dashboard/work-hub/')) {
      state.bundleReads += 1
      const rows = state.tasks.filter(task => task.status !== 'completed').map(task => ({ id: task.id, title: task.title, project_id: task.project.id, project_code: task.project.code, project_name: task.project.name, task_type: task.task_type, status: task.status, due_date: task.due_date, priority: task.priority, route: null }))
      return reply({ schema_version: '1.0', as_of: fixedNow, period: { year: 2026, month: 9, timezone: 'Asia/Dubai' },
        tasks: { status: 'ready', rows, route: null, counts: { open: rows.length, due_today: rows.length, due: rows.length, overdue: 0 }, total_rows: rows.length, returned_rows: rows.length, truncated: false },
        leave: { status: 'ready', balance: 18, year: 2026 }, hours: { status: 'ready', value: 80 },
        calendar: { status: 'ready', rows: [], sources: [], truncated: false },
        activity: { status: 'ready', basis: 'recorded_user_actions', rows: [], series: [], total_count: 0 },
      })
    }
    const match = path.match(/\/dashboard\/work-hub\/tasks\/(\d+)\/$/)
    if (match) {
      const task = state.tasks.find(row => String(row.id) === match[1])
      if (method === 'GET') {
        if (state.detailFailure) return reply(state.detailFailure.body, state.detailFailure.status)
        return reply(task || { detail: 'Not found.' }, task ? 200 : 404)
      }
      if (method === 'PATCH') {
        const data = route.request().postDataJSON()
        state.writes.push({ path, method, data })
        if (state.saveFailure) return reply(state.saveFailure.body, state.saveFailure.status)
        if (data.expected_updated_at !== task.updated_at) return reply({ error: 'This task changed.' }, 409)
        if (data.status && !task.allowed_statuses.includes(data.status)) return reply({ status: ['This transition is not allowed.'] }, 400)
        if (data.progress_percent !== undefined && !task.can_update_progress) return reply({ progress_percent: ['Only the assigned employee can update progress.'] }, 403)
        Object.assign(task, data, { updated_at: new Date(Date.parse(fixedNow) + state.writes.length * 1000).toISOString() })
        delete task.expected_updated_at
        if (task.status === 'completed') { task.progress_percent = 100; task.allowed_statuses = []; task.can_update_progress = false }
        return reply(task)
      }
    }
    if (path.endsWith('/features/')) return reply({ features: [] })
    if (path.endsWith('/pending-for-me/')) return reply(pageOf([]))
    if (path.endsWith('/notifications/')) return reply(pageOf([]))
    state.unknown.push(path)
    return reply({ detail: 'Endpoint not configured in My Work task fixture.' }, 404)
  })
  await page.goto('/dashboard')
  return state
}
