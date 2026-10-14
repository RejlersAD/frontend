import { masterScheduleHarness } from './master-schedule.fixture.js'

// Synthetic API results exercise rendering only; the backend tests verify CPM.
export async function draftFloatHarness(page, calculationBasis = 'draft_cpm') {
  return masterScheduleHarness(page, {
    prepare(state) {
      for (const record of Object.values(state.records)) {
        const examples = [
          ['negative', 'Late design activity', 31, '2026-09-21', '2026-11-02', -3, true],
          ['zero', 'Critical review activity', 28, '2026-09-21', '2026-10-28', 0, true],
          ['positive', 'Parallel design activity', 4.25, '2026-09-21', '2026-09-25', 23, false],
          ['unknown', 'Unestimated scope activity', null, null, null, null, null],
          ['milestone', 'Approval milestone', 0, '2026-10-28', '2026-10-28', 0, true],
        ]
        const tasks = examples.map(([code, title, duration, start, finish, float, critical]) => ({
          id: `draft-${code}`, activity_code: `DRAFT-${code.toUpperCase()}`, title, discipline: 'general',
          wbs_node_id: 'draft:general', duration_days: duration, duration_source: 'proposed',
          planned_start_date: start, planned_finish_date: finish, total_float_days: float, is_critical: critical,
          is_milestone: code === 'milestone', activity_type: code === 'milestone' ? 'finish_milestone' : 'task',
          depends_on: [], source_references: [],
        }))
        const calendar = { name: 'Monday–Friday', working_weekdays: [0, 1, 2, 3, 4], exceptions: [], hours_per_day: 8 }
        Object.assign(record.simplePlan, {
          tasks, calculation_basis: calculationBasis, calculation_available: true,
          project: { id: record.planningProject.id, code: 'TEST-FLOAT', name: 'Synthetic draft float', start_date: '2026-09-21', end_date: '2026-10-28' },
          work_calendar: calendar, calendar,
          disciplines: [{ code: 'general', name: 'General' }],
          wbs_nodes: [{ id: 'draft:general', parent_id: null, code: '1', name: 'General', discipline: 'general', is_derived: true }],
        })
      }
    },
  })
}
