import { expect } from '@playwright/test'
import { prepareProposalRegister, proposalRegisterId } from './sales-proposal-register-api'

const source = id => ({ technical_proposal_id: String(id), id: String(id), proposal_number: 'TP-BID-2026', title: 'Reviewed engineering solution',
  revision: id === 71 ? 2 : 3, status: 'draft', updated_at: '2026-10-01T06:30:00Z', planning_project_id: '21', planning_project_name: 'Opportunity bid preparation',
  schedule_id: '41', schedule_version_id: '51', schedule_version: 4, schedule_status: 'draft', generation_id: '61', generation_version: 2 })
const imported = { scope: 'Reviewed source scope and execution approach.', deliverables: ['Source design basis', 'Source deliverables register'], assumptions: ['Client provides survey'], exclusions: ['Construction'], disciplines: ['Process', 'Civil'], risks: [{ title: 'Survey delay', probability_percent: '25.00' }] }
const fields = ['scope', 'deliverables', 'assumptions', 'exclusions', 'disciplines', 'estimated_hours', 'risks']

export async function openPreparation(page, options = {}) {
  const register = await prepareProposalRegister(page, options.register || {})
  await expect(page.getByLabel('Selected proposal', { exact: true }).getByRole('tab', { name: 'Preparation', exact: true })).toBeVisible()
  const state = { register, connection: { id: 'connection-1', planning_project: { id: '21', name: 'Opportunity bid preparation' } }, history: [],
    mutations: [], requests: [], saved: new Map(), version: 1, sourceId: '71', canPrepare: true, canConnect: true, requiresDuration: false,
    prepareStatuses: [], connectionStatuses: [], previewStatuses: [], sourcePageSize: 10, workspacePageSize: 10, sourceState: 'current',
    getStatus: 200, holds: {}, previewHolds: {}, unknown: [], ...options }
  const bid = row => ({ opportunity: { id: row.deal, code: row.deal_code, name: row.deal_name, stage: 'proposal', bid_decision: 'bid', client: { id: row.client, name: row.client_name } },
    connection: state.connection, capabilities: { can_create: state.canConnect && !state.connection, can_attach: state.canConnect && !state.connection, reason: state.canConnect ? '' : 'The bid decision does not permit preparation.' },
    source_duration_months: state.requiresDuration ? null : '6.00', requires_duration: state.requiresDuration, expected_token: `bid-${state.version}` })
  const preparation = row => ({ quote: { id: row.id, number: row.quote_number, version: row.version, status: row.status, deal_id: row.deal },
    bid_preparation: bid(row), connection: state.connection, history: state.history.map(item => ({ ...item, source_state: state.sourceState })), capabilities: { can_prepare: state.canPrepare, reason: state.canPrepare ? '' : 'This proposal is approved and preparation is read-only.' } })
  const preview = (row, id) => ({ source: source(Number(id)), evidence: { basis: 'Exact technical revision with frozen source basis; financial values excluded.',
    technical: { sections: [{ key: 'scope', title: 'Scope', content: imported.scope, source: 'reviewed technical proposal', readiness: 'recorded' }] },
    schedule: { version_id: '51', version: 4 }, generation: { id: '61', version: 2 }, deliverables: imported.deliverables, effort: null,
    resources: [{ code: 'PROCESS-ROLE', name: 'Process engineer role', unit: 'hours' }], assignments: [{ activity: 'Design', planned_units: '40.00' }],
    risks: imported.risks, provenance: { basis: 'frozen schedule 4' } }, proposed_fields: imported,
    current_fields: Object.fromEntries(fields.map(field => [field, row[field]])), supported_fields: Object.keys(imported),
    warnings: ['Effort is not recorded. Existing estimated hours are preserved.'], expected_token: `preview-${state.version}-${id}` })
  await page.route('**/api/v1/sales/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (!/\/(bid-preparation|bid-preparation-candidates|preparation|preparation-sources|preparation-preview|prepare)\/$/.test(path)) return route.fallback()
    const row = state.register.rows.find(item => path.includes(`/quotes/${item.id}/`) || path.includes(`/deals/${item.deal}/`))
    if (!row) return route.fulfill({ status: 404, json: { detail: 'No scoped record.' } })
    const body = method === 'POST' ? request.postDataJSON() : null
    state.requests.push({ path, method, body, search: url.search })
    const endpoint = path.split('/').at(-2)
    if (state.holds[row.id]) await state.holds[row.id]
    if (endpoint === 'preparation') return route.fulfill({ status: state.getStatus, json: state.getStatus === 200 ? preparation(row) : { detail: 'Preparation access denied.' } })
    if (endpoint.endsWith('-candidates') || endpoint.endsWith('-sources')) {
      const isWorkspace = endpoint === 'bid-preparation-candidates', size = isWorkspace ? state.workspacePageSize : state.sourcePageSize
      const all = isWorkspace ? [{ id: '21', name: 'Opportunity bid preparation' }, { id: '22', name: 'Alternative eligible workspace' }] : [source(71), source(72)]
      const results = all.filter(item => JSON.stringify(item).toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()))
      const pageNumber = Number(url.searchParams.get('page') || 1)
      return route.fulfill({ json: { count: results.length, page: pageNumber, page_size: size, results: results.slice((pageNumber - 1) * size, pageNumber * size) } })
    }
    if (endpoint === 'preparation-preview') {
      if (state.previewHolds[body.technical_proposal_id]) await state.previewHolds[body.technical_proposal_id]
      const status = state.previewStatuses.shift() || 200
      return route.fulfill({ status, json: status === 200 ? preview(row, body.technical_proposal_id) : { detail: 'Source revision is no longer accessible.' } })
    }
    if (endpoint === 'bid-preparation' && method === 'GET') return route.fulfill({ json: bid(row) })
    const connecting = endpoint === 'bid-preparation'
    state.mutations.push({ endpoint, body })
    if (state.saved.has(body.request_id)) return route.fulfill({ json: { ...state.saved.get(body.request_id), replayed: true } })
    const status = (connecting ? state.connectionStatuses : state.prepareStatuses).shift() || 200
    if (typeof status === 'number' && status !== 200) return route.fulfill({ status, json: { detail: status === 409 ? 'The source or proposal changed. Refresh before applying.' : status === 403 ? 'Permission was revoked. Your draft is retained.' : 'Review reason could not be saved.' } })
    if (connecting) state.connection = { id: 'connection-1', planning_project: { id: body.planning_project_id || '21', name: 'Opportunity bid preparation' } }
    else {
      body.selected_fields.forEach(field => { row[field] = structuredClone(imported[field]) })
      state.history.unshift({ id: `capture-${state.history.length + 1}`, revision: state.history.length + 1, technical_proposal_id: body.technical_proposal_id,
        source: source(Number(body.technical_proposal_id)), selected_fields: body.selected_fields, reason: body.reason, created_at: '2026-10-01T06:45:00Z', source_state: 'current' })
    }
    state.version++
    const result = connecting ? { bid_preparation: bid(row), replayed: false } : { preparation: preparation(row), replayed: false }
    state.saved.set(body.request_id, result)
    if (status === 'committed-network-error') return route.abort('failed')
    return route.fulfill({ json: result })
  })
  await page.getByLabel('Selected proposal', { exact: true }).getByRole('tab', { name: 'Preparation', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Proposal preparation', exact: true })).toBeVisible()
  return state
}

export { proposalRegisterId }
