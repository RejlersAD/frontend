import { masterScheduleHarness } from './master-schedule.fixture.js'

export const delayEnvelope = () => {
  const activities = [{ id: 101, external_id: 'ACT-001', name: 'Equipment foundations', activity_type: 'task', planned_start: '2026-09-14', planned_finish: '2026-10-02' }, { id: 102, external_id: 'ACT-002', name: 'Equipment installation', activity_type: 'task', planned_start: '2026-10-05', planned_finish: '2026-10-09' }]
  const events = [{ id: 41, revision: 2, title: 'Recorded access hold', description: 'Access was unavailable under permit 42.', start_date: '2026-09-21', end_date: null, status: 'recorded', activity_ids: [101, 102], evidence: [{ reference: 'Permit register 42, 21 Sept 2026', document_version_id: 'd6c29ef0-0724-4d19-bce2-9112f0bd9eb2' }], permissions: { can_edit: true } }]
  const current = { id: 51, name: 'Access impact review', revision: 3, status: 'draft', reference_report_id: 31, baseline_id: 11, current_run_id: null, event_ids: [41], changes: [], scenarios: [], recommendation: { selected_scenario_id: null, requested_extension_calendar_days: null, contract_clause_reference: '', notice_reference: '', causation_assessment: '', concurrency_assessment: '', mitigation_assessment: '', basis: '' }, run: null, source_fingerprint: 'a'.repeat(64), source_stale: false, reference_observations: [{ activity_id: 101, remaining_duration_days: '3', actual_start: '2026-09-14' }, { activity_id: 102, remaining_duration_days: '5' }], reference_relationships: [{ predecessor_id: 101, successor_id: 102, type: 'FS', lag_days: 0 }], permissions: { can_edit: true, can_calculate: true, can_submit: false, can_approve: false, can_return: false, can_revise: false, can_export: false } }
  return { baseline: { id: 11, name: 'Approved engineering baseline', version_id: 91 }, baselines: [{ id: 11, name: 'Approved engineering baseline', version_id: 91 }], published_reports: [{ id: 31, baseline_id: 11, name: 'Published week 39', data_date: '2026-09-21', published_at: '2026-09-22T08:00:00Z', revision: 4 }], activities, events, linked_items: { governance: [{ id: 71, title: 'Access notification', status: 'open' }], risks: [{ id: 81, title: 'Site access risk', status: 'monitoring' }] }, cases: [structuredClone(current)], case: current, permissions: { can_write: true, can_approve: true }, issues: [], current_user_id: 7 }
}

export const delayResult = () => ({ method: 'retained_logic_whole_working_days', reference: { report_id: 31, data_date: '2026-09-21', forecast_finish: '2026-10-09', contractual_finish: '2026-10-09' }, impact: { status: 'complete', forecast_finish: '2026-10-14', net_finish_shift_calendar_days: 5, contract_overrun_calendar_days: 5, affected_activities: [{ activity_id: 101, external_id: 'ACT-001', name: 'Equipment foundations', reference_start: '2026-09-14', reference_finish: '2026-10-02', scenario_start: '2026-09-14', scenario_finish: '2026-10-07', start_shift_calendar_days: 0, finish_shift_calendar_days: 5, reference_float: 0, scenario_float: -3 }], affected_milestones: [], paths: { nodes: [101, 102], edges: [{ predecessor_id: 101, successor_id: 102, type: 'FS', lag_days: 0 }], witnesses: [] } }, scenarios: [{ id: 'recovery-1', name: 'Additional access shift', status: 'partial', forecast_finish: null, recovered_calendar_days: null, net_finish_shift_calendar_days: null, contract_overrun_calendar_days: null, affected_activities: [], affected_milestones: [] }], issues: [{ code: 'recovery_unavailable', message: 'Recovery input is Not Specified for an affected activity.' }], limitations: ['Whole working-day scenario inputs only.'] })

export async function delayHarness(page, options = {}) {
  return masterScheduleHarness(page, {
    history: options.history,
    decorateSnapshot(plan) { return { ...plan, version_id: 91, baseline: { id: 11 }, ...options.decorateSnapshot?.(plan) } },
    prepare(state) { state.delay = delayEnvelope(); state.delayReads = []; state.delayWrites = []; state.delayExports = []; options.prepare?.(state) },
    async handleRequest(context) {
      const { path, url, route, reply, state } = context
      if (path.includes('/delay-analysis/cases/') && path.endsWith('/export/')) { state.delayExports.push({ path, format: url.searchParams.get('format') }); await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Content-Disposition': 'attachment; filename="reviewed-delay-case.json"' }, body: JSON.stringify({ case: state.delay.case }) }); return true }
      if (!path.endsWith('/delay-analysis/')) return false
      if (route.request().method() === 'GET') { state.delayReads.push({ baseline_id: url.searchParams.get('baseline_id'), case_id: url.searchParams.get('case_id') }); await reply(route, state.delay); return true }
      const body = route.request().postDataJSON(); state.delayWrites.push(body)
      if (options.onCommand) return options.onCommand(context, body)
      if (body.action === 'save_case') { Object.assign(state.delay.case, { event_ids: body.event_ids, changes: body.changes, scenarios: body.scenarios, recommendation: body.recommendation, revision: state.delay.case.revision + 1, run: null }); state.delay.cases = [structuredClone(state.delay.case)] }
      if (body.action === 'create_event') state.delay.events.push({ ...body, id: 42, revision: 1, status: 'recorded', permissions: { can_edit: true } })
      if (body.action === 'calculate_case') { Object.assign(state.delay.case, { revision: state.delay.case.revision + 1, status: 'calculated', run: { id: 61, fingerprint: 'b'.repeat(64), result: delayResult() }, permissions: { ...state.delay.case.permissions, can_submit: true, can_export: true } }); state.delay.cases = [structuredClone(state.delay.case)] }
      await reply(route, state.delay); return true
    },
  })
}
