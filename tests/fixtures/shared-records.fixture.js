import { harness } from './project-details-overview.fixture.js'

const sources = [{ key: 'project_client', label: 'Project clients' }, { key: 'approved_hours', label: 'Approved hours' }]
const clients = [{ id: 'client-a', code: 'CL-01', label: 'Acme Engineering' }, { id: 'client-b', code: 'CL-02', label: 'Acme Energy' }]
const employees = [{ id: 'employee-a', code: 'E100', label: 'Alex Employee' }]
const rows = [
  { source_type: 'project_client', id: '17', reference: 'PR-17', label: 'Process study', source_values: { client_name: 'Acme' }, links: { client: null }, target_kinds: ['client'], state: 'needs_review', can_link: true, expected_token: 'token-17', warning: 'Multiple client records match the source reference.' },
  { source_type: 'approved_hours', id: '18', reference: 'TIME-18', label: 'Engineering hours', source_values: { employee_code: 'E100', employee_name: 'Alex' }, links: { employee: null }, target_kinds: ['employee'], state: 'unlinked', can_link: true, expected_token: 'token-18' },
  { source_type: 'project_client', id: '19', reference: 'PR-19', label: 'Linked project', source_values: { client_name: 'Acme Energy' }, links: { client: clients[1] }, target_kinds: ['client'], state: 'linked', can_link: false, expected_token: 'token-19' },
  { source_type: 'project_client', id: '20', reference: 'PR-20', label: 'Second study', source_values: { client_name: 'Acme' }, links: { client: null }, target_kinds: ['client'], state: 'unlinked', can_link: true, expected_token: 'token-20' },
]

export async function sharedRecordsHarness(page, options = {}) {
  const state = { rows: structuredClone(options.rows ?? rows), commands: [], replies: new Map(), saveFailures: [...(options.saveFailures || [])], queueFailure: options.queueFailure || 0, candidateFailure: 0, candidates: structuredClone(clients), reads: [], creates: [], hourCreates: [], hourFailure: 0, lookups: [], delayDetail: null }
  const result = await harness(page, options.query || 'view=shared-records', {
    async handleRequest({ path, route, reply, state: projectState }) {
      const url = new URL(route.request().url()), method = route.request().method()
      if (path === '/api/v1/projects/shared-record-targets/') { state.lookups.push(Object.fromEntries(url.searchParams)); await reply(route, { results: url.searchParams.get('kind') === 'employee' ? employees : clients, has_more: false }); return true }
      if (options.hoursFlow && path === '/api/v1/project-control/control-accounts/') { await reply(route, { results: [{ id: 'account-1', code: 'CA-01', name: 'Engineering', status: 'active', currency: 'AED', approved_budget: '1000.00' }] }); return true }
      if (options.hoursFlow && path === '/api/v1/project-control/reporting-periods/') { await reply(route, { results: [{ id: 'period-1', name: 'October', status: 'open', is_entry_allowed: true, sequence: 1, start_date: '2026-10-01', end_date: '2026-10-31', data_date: '2026-10-01' }] }); return true }
      if (options.hoursFlow && path === '/api/v1/project-control/approved-hours/' && method === 'POST') {
        const body = route.request().postDataJSON(); state.hourCreates.push(body)
        await reply(route, state.hourFailure ? { detail: 'Review the source reference.' } : { id: 100, ...body }, state.hourFailure || 201); return true
      }
      if (path === '/api/v1/projects/' && method === 'POST') {
        const body = route.request().postDataJSON(); state.creates.push(body)
        projectState.records[99] = structuredClone(projectState.records[17])
        projectState.records[99].project = { ...projectState.records[99].project, id: 99, ...body }
        await reply(route, { id: 99, ...body }); return true
      }
      if (path === '/api/v1/projects/shared-records/') {
        if (state.queueFailure) { await reply(route, { detail: 'Shared records access is denied.' }, state.queueFailure); return true }
        const term = url.searchParams.get('search')?.toLowerCase() || '', type = url.searchParams.get('source_type'), status = url.searchParams.get('status'), page = Number(url.searchParams.get('page') || 1)
        const filtered = state.rows.filter(row => (!type || row.source_type === type) && (status === 'all' || (status === 'linked' ? row.state === 'linked' : ['unlinked', 'needs_review'].includes(row.state))) && `${row.reference} ${row.label}`.toLowerCase().includes(term))
        const size = options.pageSize || 10
        await reply(route, { sources, count: filtered.length, page, page_size: size, results: filtered.slice((page - 1) * size, page * size) }); return true
      }
      const match = path.match(/^\/api\/v1\/projects\/shared-records\/([^/]+)\/([^/]+)\/(candidates\/|link\/)?$/)
      if (!match) return false
      const row = state.rows.find(row => row.source_type === match[1] && row.id === match[2])
      if (!row) { await reply(route, { detail: 'Record unavailable.' }, 404); return true }
      if (match[3] === 'candidates/') {
        if (state.candidateFailure) { await reply(route, { detail: 'Candidate search is unavailable.' }, state.candidateFailure); return true }
        const values = url.searchParams.get('kind') === 'employee' ? employees : state.candidates
        const search = url.searchParams.get('search')?.toLowerCase() || ''
        await reply(route, { results: values.filter(value => `${value.code} ${value.label}`.toLowerCase().includes(search)), has_more: Boolean(options.hasMore && !search) }); return true
      }
      if (match[3] === 'link/') {
        const body = route.request().postDataJSON(); state.commands.push(body)
        const failure = state.saveFailures.shift()
        if (failure && failure !== 'network') {
          if (failure === 409) row.expected_token = 'refreshed-token'
          await reply(route, { detail: failure === 409 ? 'The source changed. Refresh before saving.' : failure === 403 ? 'Connection update access is denied.' : 'The selected client is not valid.' }, failure); return true
        }
        if (state.replies.has(body.request_id)) { await reply(route, { record: state.replies.get(body.request_id), replayed: true }); return true }
        for (const [key, id] of Object.entries(body.targets)) {
          const kind = key.replace('_id', '')
          row.links[kind] = [...clients, ...employees].find(item => item.id === id)
        }
        row.state = 'linked'; row.expected_token = 'saved-token'; row.warning = ''
        if (row.source_type === 'project_client') row.can_link = false
        state.replies.set(body.request_id, structuredClone(row))
        if (failure === 'network') { await route.abort('failed'); return true }
        await reply(route, { record: row, replayed: false }); return true
      }
      state.reads.push(row.id)
      if (state.delayDetail === row.id) await new Promise(resolve => setTimeout(resolve, 400))
      await reply(route, row); return true
    },
  })
  return Object.assign(state, { app: result })
}
