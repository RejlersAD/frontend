// Synthetic browser contracts only. The actual App is mounted; all API and
// external requests are intercepted before navigation. These fixtures do not
// establish that the backend stores artifacts or enforces permissions.
export const miningProjectId = '00000000-0000-4000-8000-000000009101'
export const miningProjectName = 'Synthetic source-preservation project'
export const miningToken = 'isolated-data-mining-fixture-token'
export const miningCsv = 'tag,quantity\nSYNTHETIC-EQUIPMENT-A,2\n'
export const miningArtifact = `data-mining/${miningProjectId}/exports/synthetic-run.csv`

const actor = {
  id: 9101, username: 'synthetic-mining-engineer', first_name: 'Synthetic', last_name: 'Engineer',
  full_name: 'Synthetic Engineer', email: 'mining@example.test', is_active: true, is_superuser: false,
  roles: [], modules: [{ code: 'data_mining' }],
  module_actions: { data_mining: ['read', 'create', 'update', 'export'] },
}
const reply = (route, body, status = 200) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(body),
})
const failure = (status, code, error) => ({ status, body: { code, error } })

export function storedExportResult() {
  return {
    status: 'completed', artifact_available: true, master_file: miningArtifact,
    rows_processed: 1, execution_time: 0.25,
    preview: { columns: ['tag', 'quantity'], rows: [['SYNTHETIC-EQUIPMENT-A', 2]] },
  }
}

export async function dataMiningHarness(page, options = {}) {
  const prepared = options.prepared ?? false
  const document = {
    id: 9102, doc_number: 'SYNTHETIC-DOC-01', doc_title: 'Synthetic source register',
    doc_revision: 'A', transmittal_id: 'SYNTHETIC-WRENCH-01',
    extraction_status: prepared ? 'completed' : 'pending',
    extracted_data: prepared ? { columns: ['tag', 'quantity'], rows: [['SYNTHETIC-EQUIPMENT-A', 2]] } : null,
  }
  const project = {
    id: miningProjectId, name: miningProjectName, status: 'draft', total_documents: 1,
    wrench_project_number: 'SYNTHETIC-WRENCH-01', wrench_project_name: 'Synthetic Wrench project',
    master_file_format: 'csv', documents: [document],
    // The fixture starts with an existing saved pipeline. F02 (creating projects
    // and persisting UI pipeline edits) is deliberately not represented as fixed.
    pipeline: { id: 9103, name: 'Existing synthetic pipeline', steps: [
      { operation_type: 'select', step_name: 'Existing selected columns', sequence_order: 0, config: { columns: ['tag', 'quantity'] } },
    ] },
  }
  const state = {
    project, requests: [], unknown: [], pageErrors: [], externalRequests: [], downloads: [],
    extraction: options.extraction || failure(503, 'extraction_unavailable', 'Genuine extraction is unavailable. Source documents have not been changed.'),
    execution: options.execution || { status: 200, body: storedExportResult() },
    download: options.download || { status: 200, body: miningCsv, contentType: 'text/csv' },
  }
  await page.addInitScript(({ user, token }) => {
    localStorage.setItem('radai_access_token', token)
    localStorage.setItem('radai_user_data', JSON.stringify(user))
    localStorage.setItem('radai.sidebar.collapsed', 'true')
    localStorage.setItem('radai_theme', 'light')
  }, { user: actor, token: miningToken })
  page.on('pageerror', error => state.pageErrors.push(error.message))
  page.on('download', download => state.downloads.push(download.suggestedFilename()))
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (!path.startsWith('/api/')) {
      const localAsset = ['127.0.0.1', 'localhost'].includes(url.hostname) && (
        (path === '/data-mining' && request.isNavigationRequest()) ||
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
    if (path === '/api/v1/wrench/sync/projects/' && method === 'GET') return reply(route, {
      projects: [{ order_no: 'SYNTHETIC-WRENCH-01', order_description: 'Synthetic Wrench project' }], is_stale: false,
    })
    if (path === '/api/v1/wrench/sync/trans-documents/' && method === 'GET') return reply(route, {
      documents: [{ DOC_NO: document.doc_number, DOC_DESCRIPTION: document.doc_title, DOC_REVISION: document.doc_revision, ORDER_NO: document.transmittal_id }],
    })
    if (path === '/api/v1/data-mining/projects/' && method === 'GET') return reply(route, { count: 1, results: [project] })
    if (path === `/api/v1/data-mining/projects/${miningProjectId}/` && method === 'GET') return reply(route, project)
    if (path === `/api/v1/data-mining/projects/${miningProjectId}/extract_data/` && method === 'POST') {
      return reply(route, state.extraction.body, state.extraction.status)
    }
    if (path === `/api/v1/data-mining/projects/${miningProjectId}/execute_pipeline/` && method === 'POST') {
      return reply(route, state.execution.body, state.execution.status)
    }
    if (path === `/api/v1/data-mining/projects/${miningProjectId}/download_master/` && method === 'GET') {
      if (state.download.status !== 200) return reply(route, state.download.body, state.download.status)
      return route.fulfill({
        status: 200, contentType: state.download.contentType,
        headers: { 'content-disposition': 'attachment; filename="synthetic-run.csv"' }, body: state.download.body,
      })
    }
    state.unknown.push(call)
    return reply(route, { error: 'Unexpected isolated Data Mining request.' }, 400)
  })
  await page.goto('/data-mining', { waitUntil: 'domcontentloaded' })
  return state
}
