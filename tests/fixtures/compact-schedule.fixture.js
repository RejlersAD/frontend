import { primaveraScheduleHarness } from './primavera-schedule.fixture.js'

// Captured from the previous actual ProjectsPage layout before compacting it.
// The 42px sticky calendar header is excluded from usable activity-body height.
export const scheduleHeightBaseline = {
  '1900x950': { top: 335, viewport: 556, activities: 514, footerBottom: 959 },
  '1440x900': { top: 335, viewport: 506, activities: 464, footerBottom: 909 },
}
export const compactRelations = [
  { predecessor: 'activity-1', successor: 'activity-2', type: 'FS', lag: 0 },
  { predecessor: 'activity-1', successor: 'activity-3', type: 'SS', lag: 2 },
  { predecessor: 'activity-2', successor: 'activity-4', type: 'FF', lag: 0 },
  { predecessor: 'activity-3', successor: 'activity-5', type: 'SF', lag: 0 },
]

export async function compactScheduleHarness(page, options = {}) {
  const state = await primaveraScheduleHarness(page, {
    ...options,
    prepare(state) {
      for (const record of Object.values(state.records)) {
        const tasks = record.simplePlan.tasks
        const windows = [
          ['2026-09-21', '2026-09-25', 5], ['2026-09-28', '2026-10-02', 5],
          ['2026-09-23', '2026-10-02', 8], ['2026-09-29', '2026-10-02', 4],
          ['2026-09-22', '2026-09-23', 2],
        ]
        for (let index = 0; index < windows.length; index += 1) {
          const [start, finish, duration] = windows[index]
          Object.assign(tasks[index], { planned_start_date: start, planned_finish_date: finish, due_date: finish, duration_days: duration, effort_hours: duration * 8 })
        }
        for (const relation of compactRelations) {
          const task = tasks.find(task => task.id === relation.successor)
          task.depends_on = [relation.predecessor]
          task.dependency_details = [{ task_id: relation.predecessor, type: relation.type, lag_days: relation.lag }]
          task.dependency_rationales = { [relation.predecessor]: { status: 'proposed', relationship_type: relation.type, lag_days: relation.lag, evidence_type: 'planning_inference', rationale: 'Engineering handoff proposed for project-manager review.', source_references: [{ filename: 'Logic Review.pdf', locator: { page: 3 } }] } }
        }
        tasks[0].schedule_phase = 'basis'
        tasks[1].schedule_phase = 'engineering'
        tasks[2].schedule_phase = 'review'
        tasks[3].metadata = { workflow_stage_code: 'IFR' }
        tasks[4].metadata = { workflow_stage_code: 'COMPANY_REVIEW' }
        tasks[21].schedule_phase = ''
        tasks[21].metadata = {}
        const electrical = record.simplePlan.wbs_nodes.find(node => node.id === 1112)
        const electricalTasks = tasks.filter(task => task.wbs_node_id === electrical.id)
        const first = electricalTasks.map(task => task.planned_start_date).sort()[0]
        const last = electricalTasks.map(task => task.planned_finish_date).sort().at(-1)
        let duration = 0
        for (const cursor = new Date(`${first}T00:00:00Z`); cursor.toISOString().slice(0, 10) <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
          if (![0, 6].includes(cursor.getUTCDay())) duration += 1
        }
        Object.assign(electrical.summary, { planned_start_date: first, planned_finish_date: last, duration_days: duration })
        record.simplePlan.scheduling_status = { state: 'proposed', provisional_count: 0, relationship_count: 4, message: 'Review proposed dates and dependencies before approval.' }
      }
      options.prepare?.(state)
    },
  })
  if (options.realShell) {
    await page.route(url => url.pathname === '/projects', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="en"><head><title>Compact schedule with application footer</title><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="performance-test"></div><script type="module" src="/tests/fixtures/compact-real-shell-harness.jsx"></script></body></html>',
    }))
    await page.reload()
  }
  return state
}
