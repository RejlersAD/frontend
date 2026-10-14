import { fixedNow, scheduleHarness } from './schedule-performance.fixture'

// These browser-only milestone records use the core and planning serializers.
// No evidence, owner, approval or contractual classification is added to core milestones.
export function prepareMilestones(state) {
  for (const record of Object.values(state.records)) {
    const offset = record.project.id === 17 ? 0 : 1000
    record.milestones = [
      { id: 901, name: 'Design basis approved', description: 'Recorded project design gate.', target_date: '2026-09-01', completed_date: '2026-08-30', is_completed: true },
      { id: 902, name: 'Vendor data approval', description: 'Vendor package decision recorded in the project register.', target_date: '2026-09-12', completed_date: null, is_completed: false },
      { id: 903, name: 'Safety review closure', description: 'Close the recorded safety review actions.', target_date: '2026-09-25', completed_date: null, is_completed: false },
      { id: 904, name: 'Project handover', description: 'Project completion target.', target_date: '2026-12-20', completed_date: null, is_completed: false },
      { id: 905, name: 'Commissioning readiness', description: 'Readiness milestone from the project register.', target_date: '2026-10-08', completed_date: null, is_completed: false },
    ].map(row => ({ ...row, id: row.id + offset, project: record.project.id, created_at: '2026-01-05T08:00:00Z', updated_at: fixedNow }))
    record.project.milestones_summary = { total: 5, completed: 1, pending: 4 }
    const template = record.workspace.activities.find(row => row.id === 406)
    const additions = [
      { ...template, id: 407, external_id: 'MS-HAZOP', name: 'HAZOP workshop close', discipline: 'process', responsible_role: 'Process Lead', planned_start: '2026-08-20', planned_finish: '2026-08-20', is_critical: false, total_float_days: '5.00', sort_order: 407 },
      { ...template, id: 408, external_id: 'MS-MECH', name: 'Mechanical completion', discipline: 'construction', responsible_role: 'Construction Lead', planned_start: '2026-10-14', planned_finish: '2026-10-14', is_critical: true, total_float_days: '-7.00', sort_order: 408 },
    ]
    record.workspace.activities.push(...additions)
    for (const baseline of record.baselines) baseline.snapshot.activities.push(...additions.map(row => ({ ...row, version: baseline.source_version, planned_start: row.id === 408 ? '2026-10-10' : row.planned_start, planned_finish: row.id === 408 ? '2026-10-10' : row.planned_finish })))
    const report = record.controls.activities.find(row => row.id === 406)
    record.controls.activities.push(
      { ...report, id: 407, external_id: 'MS-HAZOP', name: 'HAZOP workshop close', physical_progress_pct: '100.00', actual_start: '2026-08-18', actual_finish: '2026-08-18', forecast_finish: '2026-08-18', last_reported_date: '2026-08-18', is_critical: false },
      { ...report, id: 408, external_id: 'MS-MECH', name: 'Mechanical completion', physical_progress_pct: '0.00', actual_start: null, actual_finish: null, forecast_finish: '2026-10-21', last_reported_date: '2026-09-15', is_critical: true },
    )
    record.workspace.relationships.push({ id: 605, version: record.versions[0].id, predecessor: 408, successor: 405, relationship_type: 'FS', lag_days: 0 })
    record.governance.items.push({ id: 1102, version: record.versions[0].id, activity: 408, item_type: 'issue', title: 'Tie-in window confirmation', description: 'The construction team is reviewing the recorded tie-in window.', status: 'open', priority: 'high', due_date: '2026-10-01', owner: { id: 8, name: 'Omar Saleh' }, schedule_impact_days: 7 })
  }
  state.writes = []
  state.saveFailure = false
}

const reply = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

export async function milestoneHarness(page, options = {}) {
  const state = await scheduleHarness(page, {
    query: options.query || 'project=17&view=milestones&shell=true',
    prepare: current => { prepareMilestones(current); options.prepare?.(current) },
  })
  await page.route('**/api/v1/projects/milestones/**', route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const detail = path.match(/\/milestones\/(\d+)\/$/)
    const body = ['POST', 'PATCH', 'PUT'].includes(request.method()) ? request.postDataJSON() : null
    const projectId = url.searchParams.get('project_id') || url.searchParams.get('project') || body?.project || body?.project_id || '17'
    const record = detail ? Object.values(state.records).find(row => row.milestones.some(milestone => String(milestone.id) === detail[1])) : state.records[projectId]
    state.requests.push({ path, query: Object.fromEntries(url.searchParams), method: request.method(), project: record?.project.id, body })
    if (state.failures.has('/projects/milestones/')) return reply(route, { detail: 'Milestone service is temporarily unavailable.' }, 503)
    if (!record) return reply(route, { detail: 'Project milestone not found.' }, 404)
    if (request.method() === 'GET') {
      return reply(route, detail ? record.milestones.find(row => String(row.id) === detail[1]) : { count: record.milestones.length, next: null, previous: null, results: record.milestones })
    }
    state.writes.push({ method: request.method(), path, project: record.project.id, body })
    if (state.saveFailure || (state.saveFailureName && state.saveFailureName === body?.name)) return reply(route, { name: ['The milestone could not be saved. Please retry.'] }, 400)
    if (request.method() === 'POST' && !detail) {
      if (!body?.name || !body?.target_date) return reply(route, { detail: 'Name and target date are required.' }, 400)
      const row = { id: Math.max(0, ...Object.values(state.records).flatMap(item => item.milestones.map(milestone => milestone.id))) + 1, project: record.project.id, description: '', is_completed: false, completed_date: null, created_at: fixedNow, updated_at: fixedNow, ...body }
      record.milestones.push(row)
      return reply(route, row, 201)
    }
    if (request.method() === 'PATCH' && detail) {
      const row = record.milestones.find(item => String(item.id) === detail[1])
      Object.assign(row, body, { updated_at: fixedNow })
      return reply(route, row)
    }
    return reply(route, { detail: 'Unsupported mutation in browser fixture.' }, 405)
  })
  return state
}
