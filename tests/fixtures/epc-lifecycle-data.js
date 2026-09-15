// Isolated browser-only records. Every API request is intercepted; no live writes.
const phaseNames = ['Engineering', 'Procurement', 'Construction', 'Commissioning']
const phaseCodes = ['EPC-ENG', 'EPC-PROC', 'EPC-CON', 'EPC-COM']
const phases = phaseNames.map(name => ({ value: name.toLowerCase(), label: name }))
const controlScope = project => ({ scope_type: project.scope_type, owned_phases: project.scope_type === 'detailed_engineering' ? ['engineering'] : phases.map(phase => phase.value), dependency_phases: project.scope_type === 'detailed_engineering' ? ['procurement', 'construction', 'commissioning'] : [], description: project.scope_type === 'detailed_engineering' ? 'Engineering is the controlled scope. Procurement, construction and commissioning are external dependencies.' : 'Engineering, procurement, construction and commissioning are controlled project scope.' })
const pageOf = results => ({ count: results.length, next: null, previous: null, results })
const respond = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
const actor = { id: 7, first_name: 'Maya', last_name: 'Hassan', email: 'manager@example.test' }
function record(id) {
  const project = { id, code: `EPC-${id}`, name: id === 17 ? 'Synthetic EPC engineering project' : 'Synthetic EPC second project', status: 'active', priority: 'medium', progress: 0, start_date: '2026-09-01', end_date: '2027-03-31', client_name: 'Test client', currency: 'AED', scope_type: 'epc', owner: actor, owner_name: 'Maya Hassan', team_members_data: [], budget: null, spent: null, custom_fields: {}, tags: [] }
  const wbs = phaseNames.map((name, index) => ({ id: id * 10 + index, code: phaseCodes[index], name, parent: null }))
  const activity = { id: id * 100, external_id: 'ENG-100', name: 'Engineering package release', version: id * 10, activity_type: 'task' }
  const document = { id: id * 100 + 1, project: id, title: 'Engineering review evidence', original_filename: 'engineering-evidence.pdf', kind: 'spec', kind_display: 'Specification', content_type: 'application/pdf', file_size: 16000, file: '/protected/evidence.pdf', parse_status: 'done', parsed_data: {}, created_at: '2026-09-10T08:00:00Z', updated_at: '2026-09-10T08:00:00Z', uploaded_by: 7, uploaded_by_name: 'Maya Hassan' }
  const baseline = { id: id * 100 + 2, revision: 1, name: 'Approved EPC baseline', data_date: '2026-09-10', currency: 'AED', budget_total: '100000', approved_at: '2026-09-10T08:00:00Z', checksum: 'e'.repeat(64), manifest: { project_id: id, schedule_baseline_id: id * 10, budget_ids: [id * 10], wbs_activity_links: [{ activity_id: activity.id, wbs_node_id: wbs[0].id }] } }
  const item = { id: id * 100 + 3, project: id, code: 'ENG-PKG-01', title: 'Release engineering package', phase: 'engineering', wbs_node: wbs[0].id, wbs_code: wbs[0].code, owner: 7, reviewer: 8, owner_name: 'Maya Hassan', reviewer_name: 'Samir Ali', activity: activity.id, activity_name: activity.name, baseline: baseline.id, documents: [document.id], document_details: [document], predecessors: [], predecessor_details: [], purchase_order: null, requires_materials: false, milestone: id * 10 + 5, acceptance_criteria: ['All design comments are resolved.', 'The signed review record is attached.'], evidence_note: 'Refer to the signed design review record.', data_date: '2026-09-15', status: 'draft', material_readiness: { ready: true, reason: 'Materials are not required.' }, accepted_at: null, review_note: '', events: [{ id: 1, action: 'created', actor_name: 'Maya Hassan', note: '', created_at: '2026-09-14T08:00:00Z' }] }
  return { project, wbs, activity, document, baseline, items: [item], links: [{ id: id * 10, wbs_node: wbs[0].id, wbs_code: wbs[0].code, wbs_name: wbs[0].name, activity: activity.id, activity_code: activity.external_id, activity_name: activity.name, version: activity.version, link_type: 'engineering', notes: '' }], captures: [baseline], requisitions: [{ id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, pr_number: `PR-${id}`, title: 'Valve procurement', enterprise_project: null, wbs_node: null, link_id: null, status: 'draft', match_status: 'ambiguous', suggested_project: null, project_codes: [] }], ready: true }
}
export async function epcHarness(page, options = {}) {
  const state = { records: { 17: record(17), 18: record(18) }, requests: [], unknown: [], readOnly: false, reviewer: false, rejectAccept: false, failSource: null }
  options.prepare?.(state)
  const decorate = item => ({ ...item, can_edit: !state.readOnly && item.status === 'draft', can_submit: !state.readOnly && !state.reviewer && item.status === 'draft' && !item.blocked, can_review: !state.readOnly && state.reviewer && ['submitted', 'reviewed'].includes(item.status), can_accept: !state.readOnly && !state.reviewer && item.status === 'reviewed' && !item.blocked, action_blockers: { submit: item.blocked ? ['Link approved project evidence before submission.'] : [], review: [], accept: item.blocked ? ['Material quantities have not all been accepted.'] : item.status === 'reviewed' ? [] : ['Evidence review must be approved before acceptance.'] } })
  await page.clock.setFixedTime(new Date('2026-09-15T06:30:00Z'))
  await page.route(url => url.pathname === '/projects', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><title>EPC lifecycle test</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/project-performance-harness.jsx"></script></body></html>' }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    const body = method === 'GET' ? null : request.postDataJSON()
    state.requests.push({ path, method, body })
    const foundation = path.match(/\/epc-projects\/(\d+)\/(setup|links|requisitions|baseline)\/$/)
    const id = foundation?.[1] || url.searchParams.get('project') || url.searchParams.get('project_id') || '17'
    const data = state.records[id] || state.records[17]
    const canEdit = !state.readOnly
    if (foundation) {
      const type = foundation[2]
      if (state.failSource === type) return respond(route, { detail: `${type} service unavailable.` }, 503)
      if (type === 'setup') {
        if (method === 'POST') { Object.assign(data.project, body); data.ready = true }
        return respond(route, { project: { ...data.project, owner: 7 }, scope_options: [{ value: 'epc', label: 'Full EPC' }, { value: 'detailed_engineering', label: 'Detailed Engineering' }], control_scope: controlScope(data.project), capabilities: { can_setup: canEdit, can_link: canEdit, can_associate_requisitions: canEdit, can_capture_baseline: canEdit }, ready: data.ready, checks: [{ id: 'master', label: 'Project master data', ready: data.ready, detail: data.ready ? 'Required values have been validated.' : 'Confirm the client and project owner.' }, { id: 'wbs', label: 'Four phase WBS roots', ready: data.ready, detail: 'Engineering, Procurement, Construction and Commissioning.' }], wbs: data.ready ? data.wbs : [], owners: [{ id: 7, label: 'Maya Hassan' }], currencies: [{ value: 'AED', label: 'AED — UAE dirham' }, { value: 'USD', label: 'USD — US dollar' }], phases: data.wbs.map(({ code, name }) => ({ code, name })) })
      }
      if (type === 'links') {
        if (method === 'DELETE') { data.links = data.links.filter(row => row.id !== body.id); return route.fulfill({ status: 204 }) }
        if (method === 'POST') {
          const node = data.wbs.find(row => row.id === body.wbs_node), activity = body.activity === data.activity.id ? data.activity : { id: body.activity, external_id: 'PROC-200', name: 'Procurement release', version: data.activity.version }
          const link = { ...body, id: body.id || 999, wbs_code: node.code, wbs_name: node.name, activity_code: activity.external_id, activity_name: activity.name, version: activity.version }
          data.links = [...data.links.filter(row => row.id !== link.id), link]; return respond(route, link, 201)
        }
        return respond(route, { results: data.links.map(row => ({ ...row, control_role: controlScope(data.project).owned_phases.includes(row.link_type) ? 'owned' : 'dependency' })), wbs: data.wbs, can_edit: canEdit, versions: [{ id: data.activity.version, schedule: 41, name: 'Approved EPC schedule', version: 1, status: 'approved' }], activities: [data.activity, { id: data.activity.id + 9, external_id: 'PROC-200', name: 'Procurement release', version: data.activity.version, activity_type: 'task' }], link_types: phases })
      }
      if (type === 'requisitions') {
        if (method === 'POST') {
          if (!body.review_confirmed) return respond(route, { review_confirmed: ['Review the ambiguous reference before association.'] }, 400)
          Object.assign(data.requisitions[0], { enterprise_project: data.project.id, wbs_node: body.wbs_node, match_status: 'linked' }); return respond(route, data.requisitions[0])
        }
        return respond(route, { results: data.requisitions, wbs: data.wbs, can_edit: canEdit })
      }
      if (type === 'baseline') {
        if (method === 'POST') { const capture = { ...data.baseline, ...body, id: 999, revision: 2, manifest: { schedule_baseline_id: body.schedule_baseline, budget_ids: body.budget_ids } }; data.captures.push(capture); return respond(route, capture, 201) }
        return respond(route, { results: data.captures, schedule_baselines: [{ id: id * 10, name: 'Approved schedule v1', source_version: data.activity.version, data_date: '2026-09-10', approved_at: '2026-09-10T08:00:00Z' }], budgets: [{ id: id * 10, code: 'CA-ENG', name: 'Engineering control budget', wbs_node: data.wbs[0].id, amount: '100000', currency: 'AED' }], can_capture: canEdit, blockers: data.links.length ? [] : ['Every schedule activity needs a WBS link.'] })
      }
    }
    if (path.endsWith('/epc-work-items/options/')) return respond(route, { control_scope: controlScope(data.project), phases: phases.filter(phase => controlScope(data.project).owned_phases.includes(phase.value)), wbs_nodes: data.project.scope_type === 'detailed_engineering' ? data.wbs.slice(0, 1) : data.wbs, activities: [{ id: data.activity.id + 9, external_id: 'PROC-200', name: 'Procurement release' }], documents: [data.document], purchase_orders: [{ id: '00000000-0000-4000-8000-000000000099', po_number: 'PO-TEST-99' }], milestones: [], people: [{ id: 7, name: 'Maya Hassan' }, { id: 8, name: 'Samir Ali' }], predecessors: data.items.map(({ id, code, title, status }) => ({ id, code, title, status })), baselines: data.captures, can_create: canEdit })
    if (path.endsWith('/epc-work-items/')) {
      if (method === 'POST') { const item = { ...data.items[0], ...body, id: 999, status: 'draft', activity_name: 'Procurement release', document_details: body.documents.length ? [data.document] : [], events: [] }; data.items.push(item); return respond(route, decorate(item), 201) }
      return respond(route, pageOf(data.items.map(decorate)))
    }
    const work = path.match(/\/epc-work-items\/(\d+)\/(?:(submit|review|accept)\/)?$/)
    if (work) {
      const item = Object.values(state.records).flatMap(row => row.items).find(row => String(row.id) === work[1])
      if (!item) return respond(route, { detail: 'Work not found.' }, 404)
      if (method === 'PATCH') Object.assign(item, body)
      if (work[2] === 'accept' && state.rejectAccept) return respond(route, { detail: 'Evidence changed after review. Return the work item and review the current evidence.' }, 400)
      if (work[2]) {
        item.status = work[2] === 'submit' ? 'submitted' : work[2] === 'review' ? body.decision === 'return' ? 'draft' : 'reviewed' : 'accepted'
        if (work[2] === 'review') item.review_note = body.note
        if (work[2] === 'accept') item.accepted_at = '2026-09-15T06:30:00Z'
        item.events.push({ id: item.events.length + 1, action: work[2], actor_name: state.reviewer ? 'Samir Ali' : 'Maya Hassan', note: body.note || '', created_at: '2026-09-15T06:30:00Z' })
      }
      return respond(route, decorate(item))
    }
    if (path.endsWith('/phase-flags/')) return respond(route, { phase_flags: { phase_1_project_dashboard: true, phase_1_documents: true, phase_1_cost_dashboard: true } })
    if (path.endsWith('/planning-intelligence/projects/')) return respond(route, pageOf([]))
    if (path.endsWith('/analytics/cost-kpis/')) return respond(route, { currency: 'AED', budget: null, spent: null, calculation_source: 'not_configured', forecast: {} })
    if (path.endsWith('/analytics/commercial-dashboard/')) return respond(route, { currency: 'AED', project: { id }, budget: null, actual: null, controls: {}, counts: {} })
    if (path.endsWith('/analytics/estimate-variance/')) return respond(route, { message: 'No estimates recorded.' })
    if (path.endsWith('/projects/')) return respond(route, pageOf(Object.values(state.records).map(row => row.project)))
    const projectDetail = path.match(/\/projects\/(\d+)\/$/)
    if (projectDetail) return respond(route, state.records[projectDetail[1]].project)
    if (path.endsWith('/project-control/documents/')) return respond(route, pageOf([data.document]))
    const doc = path.match(/\/project-control\/documents\/(\d+)\/$/)
    if (doc) return respond(route, Object.values(state.records).find(row => String(row.document.id) === doc[1]).document)
    if (['/projects/tasks/', '/projects/milestones/', '/change-events/', '/integrated-snapshots/', '/estimates/', '/control-accounts/', '/reporting-periods/', '/approved-hours/', '/cost-ledger/', '/budget-allocations/', '/wbs-nodes/', '/file-replica/scopes/'].some(suffix => path.endsWith(suffix))) return respond(route, pageOf([]))
    state.unknown.push(path); return respond(route, { detail: 'Unconfigured isolated test endpoint.' }, 404)
  })
  await page.goto(`/projects?project=17&view=epc-lifecycle${options.shell ? '&shell=true' : ''}`)
  return state
}
