import { fixedNow, scheduleHarness } from './schedule-performance.fixture'

export const riskActors = [
  { id: 7, email: 'manager@example.test', first_name: 'Maya', last_name: 'Hassan', name: 'Maya Hassan', role: 'project_manager' },
  { id: 8, email: 'engineer@example.test', first_name: 'Omar', last_name: 'Saleh', name: 'Omar Saleh', role: 'engineer' },
]

const assessment = (probability, impact, residualProbability, residualImpact, gross, residual, currency = 'AED', extra = {}) => ({
  category: 'Schedule', cause: 'Recorded project condition.', event: 'Recorded risk event.', effect: 'Potential effect on the project plan.',
  response_strategy: 'reduce', inherent_probability: probability, inherent_impact: impact, residual_probability: residualProbability, residual_impact: residualImpact,
  inherent_cost_exposure: gross, residual_cost_exposure: residual, currency, cost_impact_assessed: true, schedule_impact_assessed: true, ...extra,
})

export function prepareRiskChanges(state) {
  for (const record of Object.values(state.records)) {
    const offset = record.project.id === 17 ? 0 : 1000
    record.project.team_members_data = riskActors.map((user, index) => ({ id: index + 1, user, role: user.role, is_active: true }))
    const item = (id, type, title, extra = {}) => ({
      id: id + offset, version: record.versions[0].id, activity: 404, item_type: type, title, description: 'Recorded governance item for the project schedule.',
      status: 'open', priority: 'high', due_date: '2026-09-18', schedule_impact_days: '0.00', cost_impact: '0.00',
      owner: riskActors[0], raised_by: riskActors[0], resolution: '', closed_at: null, metadata: {}, comments: [],
      is_overdue: false, created_at: '2026-09-01T06:00:00Z', updated_at: fixedNow, ...extra,
    })
    record.governance = {
      version: record.versions[0], current_user_id: 7, can_manage: true, members: riskActors,
      items: [
        item(2101, 'risk', 'Long-lead pump delivery', { priority: 'critical', description: 'Vendor delivery may miss the recorded tie-in window.', schedule_impact_days: '14.00', cost_impact: '450000.00', metadata: { risk_control: assessment(4, 5, 2, 4, '450000.00', '180000.00') } }),
        item(2102, 'risk', 'Design interface rework', { activity: 402, owner: riskActors[1], due_date: '2026-09-12', is_overdue: true, cost_impact: '200000.00', schedule_impact_days: '7.00', metadata: { risk_control: assessment(3, 4, 2, 2, '200000.00', '50000.00', 'AED', { category: 'Engineering' }) } }),
        item(2103, 'risk', 'Access permit uncertainty', { activity: 405, owner: null, due_date: '2026-09-25', priority: 'medium', metadata: { risk_control: { category: 'Permits', cost_impact_assessed: false, schedule_impact_assessed: false } } }),
        item(2104, 'risk', 'Freight escalation', { due_date: '2026-10-01', priority: 'medium', cost_impact: '100000.00', metadata: { risk_control: assessment(2, 3, 1, 3, '100000.00', '60000.00', 'USD', { category: 'Commercial', schedule_impact_assessed: false }) } }),
        item(2105, 'risk', 'Survey data gap', { activity: 401, status: 'closed', priority: 'low', due_date: '2026-08-31', closed_at: '2026-08-31T06:00:00Z', resolution: 'Survey data accepted.', metadata: { risk_control: assessment(1, 2, 1, 1, '40000.00', '0.00', 'AED', { category: 'Engineering' }) } }),
        item(2201, 'issue', 'Vendor documentation hold', { status: 'in_review', due_date: '2026-09-12', is_overdue: true, schedule_impact_days: '7.00', cost_impact: '120000.00', metadata: { risk_control: { category: 'Procurement', currency: 'AED', cost_impact_assessed: true, schedule_impact_assessed: true } } }),
        item(2202, 'issue', 'Cable routing conflict', { activity: 403, owner: riskActors[1], priority: 'medium', due_date: '2026-09-20', metadata: { risk_control: { category: 'Engineering', currency: 'AED', cost_impact_assessed: true, schedule_impact_assessed: true } } }),
        item(2301, 'change_request', 'Additional tie-in scope', { activity: 405, status: 'in_review', due_date: '2026-09-20', cost_impact: '150000.00', schedule_impact_days: '5.00', metadata: { risk_control: { category: 'Scope', currency: 'AED', cost_impact_assessed: true, schedule_impact_assessed: true } } }),
        item(2302, 'change_request', 'Revised material specification', { activity: 402, owner: riskActors[1], priority: 'medium', due_date: '2026-10-02', metadata: { risk_control: { category: 'Scope', currency: 'AED', cost_impact_assessed: false, schedule_impact_assessed: false } } }),
        item(2401, 'action', 'Confirm vendor recovery plan', { due_date: '2026-09-14', is_overdue: true }),
        item(2402, 'decision', 'Approve tie-in window', { activity: 405, due_date: '2026-09-21', priority: 'medium' }),
      ],
      reviews: [],
      audit_events: [{ id: 3301 + offset, project: record.planningProject.id, actor: 7, action: 'governance.item_created', entity_type: 'GovernanceItem', entity_id: String(2101 + offset), before: {}, after: { title: 'Long-lead pump delivery', type: 'risk', version_id: record.versions[0].id }, created_at: '2026-09-01T06:00:00Z' }],
      summary: { open_items: 10, critical_items: 1, pending_reviews: 0, unresolved_comments: 1 },
    }
    record.governance.items[0].comments.push({ id: 3401 + offset, item: 2101 + offset, review: null, parent: null, body: 'Vendor recovery plan requested at the coordination meeting.', author: riskActors[0], mentioned_user_ids: [], is_resolved: false, resolved_by: null, resolved_at: null, created_at: '2026-09-10T06:00:00Z', updated_at: '2026-09-10T06:00:00Z' })
    record.changes = [
      { id: 3101 + offset, project: record.project.id, source_document: null, detected_at: '2026-09-14T06:00:00Z', summary: 'Additional insulation quantities', description: 'Recorded scope delta awaiting project review.', severity: 'high', delta_amount: '85000.00', delta_currency: 'AED', status: 'detected', ai_confidence: null, reviewed_by: null, created_at: '2026-09-14T06:00:00Z', updated_at: fixedNow },
      { id: 3102 + offset, project: record.project.id, source_document: null, detected_at: '2026-09-11T06:00:00Z', summary: 'Imported supplier price revision', description: 'Source document change expressed in supplier currency.', severity: 'medium', delta_amount: '25000.00', delta_currency: 'USD', status: 'reviewed', ai_confidence: null, reviewed_by: 7, created_at: '2026-09-11T06:00:00Z', updated_at: fixedNow },
    ]
  }
  state.writes = []
  state.saveFailure = false
}

const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

export async function riskChangeHarness(page, options = {}) {
  const state = await scheduleHarness(page, {
    query: options.query || 'project=17&view=risk&shell=true',
    prepare: current => { prepareRiskChanges(current); options.prepare?.(current) },
  })
  await page.route('**/api/v1/planning-intelligence/schedule-versions/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const version = path.match(/\/schedule-versions\/(\d+)\//)?.[1]
    const record = Object.values(state.records).find(item => item.versions.some(row => String(row.id) === version))
    if (!record || !/\/governance(?:-items|-item|-comments)?\/$/.test(path)) return route.fallback()
    state.requests.push({ path, query: Object.fromEntries(url.searchParams), method: request.method(), project: record.project.id })
    if (state.failures.has('/governance/')) return reply(route, { detail: 'Governance service is temporarily unavailable.' }, 503)
    if (request.method() === 'GET') return reply(route, record.governance)
    const body = request.postDataJSON()
    state.writes.push({ method: request.method(), path, project: record.project.id, body })
    if (state.saveFailure) return reply(route, { title: ['The governance item could not be saved. Please retry.'] }, 400)
    if (!record.governance.can_manage && !path.endsWith('/governance-comments/')) return reply(route, { error: 'Only project editors can modify governance items.' }, 403)
    const owner = body.owner ? record.governance.members.find(member => String(member.id) === String(body.owner)) : null
    if (body.owner && !owner) return reply(route, { error: 'The owner must be an active project member.' }, 400)
    if (body.activity && !record.workspace.activities.some(activity => String(activity.id) === String(body.activity))) return reply(route, { error: 'The activity does not belong to this version.' }, 400)
    if (request.method() === 'POST' && path.endsWith('/governance-items/')) {
      const id = Math.max(...Object.values(state.records).flatMap(item => item.governance.items.map(row => row.id))) + 1
      const item = { id, version: Number(version), activity: null, description: '', status: 'open', priority: 'medium', due_date: null, schedule_impact_days: '0.00', cost_impact: '0.00', raised_by: riskActors[0], resolution: '', closed_at: null, metadata: {}, comments: [], is_overdue: false, created_at: fixedNow, updated_at: fixedNow, ...body, owner }
      record.governance.items.push(item)
      return reply(route, item, 201)
    }
    if (request.method() === 'PATCH' && path.endsWith('/governance-item/')) {
      const item = record.governance.items.find(row => String(row.id) === String(body.item_id))
      if (!item) return reply(route, { error: 'Governance item not found.' }, 404)
      const values = { ...body }
      delete values.item_id
      if (body.metadata) values.metadata = { ...item.metadata, ...body.metadata, risk_control: { ...item.metadata?.risk_control, ...body.metadata.risk_control } }
      Object.assign(item, values, { updated_at: fixedNow })
      if (Object.hasOwn(body, 'owner')) item.owner = owner
      item.closed_at = ['closed', 'implemented', 'rejected'].includes(item.status) ? fixedNow : null
      return reply(route, item)
    }
    if (request.method() === 'POST' && path.endsWith('/governance-comments/')) {
      const item = record.governance.items.find(row => String(row.id) === String(body.item))
      if (!item) return reply(route, { error: 'Governance item not found.' }, 404)
      const comment = { id: 3500 + state.writes.length, item: item.id, review: null, parent: null, body: body.body, author: riskActors[0], mentioned_user_ids: [], is_resolved: false, resolved_by: null, resolved_at: null, created_at: fixedNow, updated_at: fixedNow }
      item.comments.push(comment)
      return reply(route, comment, 201)
    }
    return reply(route, { detail: 'Unsupported mutation in Risk browser fixture.' }, 405)
  })
  // The existing schedule fixture does not distinguish project_id for document changes.
  await page.route('**/api/v1/project-control/change-events/**', route => {
    const url = new URL(route.request().url())
    const id = url.searchParams.get('project') || url.searchParams.get('project_id') || '17'
    const record = state.records[id]
    state.requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), method: route.request().method(), project: record.project.id })
    if (state.failures.has('/change-events/')) return reply(route, { detail: 'Document change service is temporarily unavailable.' }, 503)
    if (route.request().method() !== 'GET') return reply(route, { detail: 'Document changes are read-only in this workspace.' }, 405)
    return reply(route, { count: record.changes.length, next: null, previous: null, results: record.changes })
  })
  return state
}
