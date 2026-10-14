import { masterScheduleHarness } from './master-schedule.fixture.js'

export const operationalEnvelope = (count = 2) => {
  const activities = Array.from({ length: count }, (_, index) => ({ id: 101 + index, external_id: `ACT-${String(index + 1).padStart(3, '0')}`, name: `Reviewed activity ${index + 1}`, planned_start: '2026-09-14', planned_finish: '2026-10-02' }))
  const report = { id: 31, revision: 3, status: 'draft', reporting_period_id: 12, policy_id: 21, data_date: '2026-09-21', baseline_id: 11, observations: [], cost_coverage_confirmed: false, notes: '', source_fingerprint: 'a'.repeat(64), permissions: { can_save: true, can_submit: true, can_publish: false, can_return: false, can_correct: false }, source_actuals: { hours: [], costs: [], total_hours: null, costs_by_currency: {}, issues: [], fingerprint: 'b'.repeat(64) }, preview: { metrics: { currency: 'AED', progress_pct: null, planned_progress_pct: null, bac: null, planned_value: null, earned_value: null, actual_cost: null, spi: null, cpi: null, eac: null, null_reasons: { progress_pct: ['progress_not_reported'], actual_cost: ['cost_coverage_not_confirmed'] } }, activity_comparisons: [], forecast: { status: 'unavailable', method: 'retained_logic_whole_working_days', data_date: '2026-09-21', forecast_finish: null, contractual_finish: '2026-10-02', activities: [] }, issues: [{ code: 'progress_not_reported', message: 'Some activity progress is Not Specified.', severity: 'warning' }] } }
  return { baseline: { id: 11, name: 'Approved engineering baseline', version_id: 91 }, baselines: [{ id: 11, name: 'Approved engineering baseline', version_id: 91 }], activities, reporting_periods: [{ id: 12, name: 'Week 39', start_date: '2026-09-15', end_date: '2026-09-21', data_date: '2026-09-21', status: 'open' }], policies: [{ id: 21, revision: 2, name: 'Reviewed weekly earning', status: 'approved', created_by_id: 7, approved_by_id: 8, can_approve: false, definition: { currency: 'AED', activities: activities.map(activity => ({ activity_id: activity.id, method: 'manual_percent', weight: null, budget: null, pv_method: 'not_specified', planned_value: [] })) } }], reports: [structuredClone(report)], report, curves: [], permissions: { can_write: true, can_approve: true, can_view_costs: true }, current_user_id: 7, issues: [] }
}

export async function operationalHarness(page, options = {}) {
  return masterScheduleHarness(page, {
    history: options.history,
    decorateSnapshot(plan) { return { ...plan, version_id: 91, baseline: { id: 11 }, ...options.decorateSnapshot?.(plan) } },
    prepare(state) { state.controls = operationalEnvelope(options.activityCount || 2); state.operationalReads = []; state.operationalWrites = []; options.prepare?.(state) },
    async handleRequest(context) {
      const { path, url, route, reply, state } = context
      if (!path.endsWith('/operational-controls/')) return false
      if (route.request().method() === 'GET') { state.operationalReads.push({ baseline_id: url.searchParams.get('baseline_id'), report_id: url.searchParams.get('report_id') }); await reply(route, state.controls); return true }
      const body = route.request().postDataJSON(); state.operationalWrites.push(body)
      if (options.onCommand) return options.onCommand(context, body)
      if (body.action === 'save_report') { Object.assign(state.controls.report, { observations: body.observations, notes: body.notes, ...(body.cost_coverage_confirmed != null ? { cost_coverage_confirmed: body.cost_coverage_confirmed } : {}), revision: state.controls.report.revision + 1 }); state.controls.reports = [structuredClone(state.controls.report)] }
      await reply(route, state.controls); return true
    },
  })
}
