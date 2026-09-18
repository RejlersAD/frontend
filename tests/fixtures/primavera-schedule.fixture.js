import { masterScheduleHarness, masterEmployees } from './master-schedule.fixture.js'
import { fixedNow } from './schedule-performance.fixture.js'

// Synthetic schedule-version records. IDs and parent links deliberately model
// two Process Engineering branches rather than a discipline-only grouping.
export const primaveraTitles = {
  overlap: 'Process Design Basis - FEED / Area 210 (Rev. A)',
  parallel: 'Heat & Material Balance - FEED / Area 210 (Rev. A)',
  detailed: 'P&ID - Amine Regeneration Unit / Area 210 (Rev. A)',
  milestone: 'Phase 1 design approved - client acceptance',
  unknown: 'Vendor interface review - duration to be agreed',
}
export const primaveraNodes = [
  { id: 1000, parent_id: null, code: 'RAD-210', name: 'Amine Regeneration Upgrade', level: 0 },
  { id: 1100, parent_id: 1000, code: 'RAD-210.1', name: 'Engineering', level: 1 },
  { id: 1110, parent_id: 1100, code: 'RAD-210.1.1', name: 'FEED', level: 2 },
  { id: 1111, parent_id: 1110, code: 'RAD-210.1.1.1', name: 'Process Engineering', discipline: 'process', level: 3 },
  { id: 1112, parent_id: 1110, code: 'RAD-210.1.1.2', name: 'Electrical Engineering', discipline: 'electrical', level: 3 },
  { id: 1120, parent_id: 1100, code: 'RAD-210.1.2', name: 'Detailed Engineering', level: 2 },
  { id: 1121, parent_id: 1120, code: 'RAD-210.1.2.1', name: 'Process Engineering', discipline: 'process', level: 3 },
  { id: 1122, parent_id: 1120, code: 'RAD-210.1.2.2', name: 'Mechanical Engineering', discipline: 'mechanical', level: 3 },
  { id: 1123, parent_id: 1120, code: 'RAD-210.1.2.3', name: 'Piping Engineering', discipline: 'piping', level: 3 },
  { id: 1124, parent_id: 1120, code: 'RAD-210.1.2.4', name: 'Electrical Engineering', discipline: 'electrical', level: 3 },
  { id: 1200, parent_id: 1000, code: 'RAD-210.2', name: 'Project Management', level: 1 },
  { id: 1210, parent_id: 1200, code: 'RAD-210.2.1', name: 'Project Controls', discipline: 'controls', level: 2 },
  { id: 1300, parent_id: 1000, code: 'RAD-210.3', name: 'Project Milestones', discipline: 'milestones', level: 1 },
].map((node, sort_order) => ({ discipline: '', is_derived: false, ...node, sort_order }))

function workday(offset) {
  const date = new Date('2026-09-21T00:00:00Z')
  for (let count = 0; count < offset;) {
    date.setUTCDate(date.getUTCDate() + 1)
    if (![0, 6].includes(date.getUTCDay())) count += 1
  }
  return date.toISOString().slice(0, 10)
}

export function primaveraTasks() {
  const batches = [
    [1111, 'FEED-PRO', [primaveraTitles.overlap, primaveraTitles.parallel]],
    [1112, 'FEED-ELE', ['Electrical design philosophy', 'Preliminary electrical load list', 'Power system concept', 'Electrical equipment layout', 'Substation space allocation', 'Power supply options assessment']],
    [1121, 'DE-PRO', [primaveraTitles.detailed, 'Process flow diagram - Amine Regeneration', 'Equipment list - Unit 210', 'Line list - Unit 210', 'Cause & effect diagram', 'Relief valve sizing report', 'Process data sheets for equipment', 'Operating & control philosophy']],
    [1122, 'DE-MEC', ['Mechanical design basis', 'Pressure vessel specifications', 'Pump data sheets', 'Heat exchanger mechanical review', 'Equipment maintenance access study', 'Mechanical package review']],
    [1123, 'DE-PIP', ['Piping design basis', 'Plot plan - Unit 210', 'Piping arrangement drawings', 'Pipe stress analysis report', 'Piping material specifications', 'Isometric drawings & material take-off']],
    [1124, 'DE-ELE', ['ELECTRICAL LOAD LIST - UNIT 210', 'Single-line diagram - Main distribution', 'Protection coordination study', 'Cable sizing calculations', 'Cable routing & tray layout', 'Earthing & lightning protection']],
    [1210, 'PC', ['Project execution plan', 'Integrated engineering schedule', 'Document control procedure', 'Risk register review', 'Weekly progress reporting', primaveraTitles.unknown]],
    [1300, 'MS', [primaveraTitles.milestone, 'FEED package review', 'Design completion review', 'Final handover preparation']],
  ]
  let sequence = 0
  return batches.flatMap(([nodeId, prefix, titles], batch) => titles.map((title, position) => {
    const index = sequence++
    const milestone = title === primaveraTitles.milestone
    const unknown = title === primaveraTitles.unknown
    const startOffset = batch === 0 ? 0 : (batch * 5) + position
    const duration = unknown ? null : milestone ? 0 : batch === 0 ? 10 : 3 + position % 5
    const start = unknown ? null : workday(startOffset)
    const finish = unknown ? null : workday(startOffset + Math.max(0, duration - 1))
    return {
      id: `activity-${index + 1}`, activity_id: 4001 + index,
      activity_code: `${prefix}-${String((position + 1) * 10).padStart(3, '0')}`,
      external_id: `${prefix}-${String((position + 1) * 10).padStart(3, '0')}`,
      activity_code_source: 'schedule_activity', wbs_node_id: nodeId,
      wbs_code: primaveraNodes.find(node => node.id === nodeId).code,
      discipline: primaveraNodes.find(node => node.id === nodeId).discipline,
      title, document_number: `${prefix}-${String(position + 1).padStart(3, '0')}`, document_revision: 'A',
      assignee_id: 8, assignee: masterEmployees[1], owner: 'Omar Saleh',
      reviewer_id: 7, reviewer_user: masterEmployees[0], reviewer: 'Maya Hassan',
      project_task_id: 3001 + index, task_type: 'deliverable', priority: 'medium',
      duration_days: duration, duration_source: unknown ? 'unknown' : 'schedule_activity',
      planned_start_date: start, planned_finish_date: finish, due_date: finish,
      effort_hours: unknown ? null : duration * 8, depends_on: [], sort_order: index,
      is_milestone: milestone, activity_type: milestone ? 'finish_milestone' : 'task',
      total_float_days: unknown ? null : index % 3 === 0 ? 0 : 4,
      is_critical: unknown ? null : index % 3 === 0, calculated: !unknown,
      status: index === 0 ? 'in_progress' : 'todo', progress_percent: index === 0 ? 45 : 0,
      acceptance_criteria: 'Reviewed against the approved register and accepted by the project manager.',
      source_references: [{ file_id: 801, filename: 'Approved MDR.csv', locator: { sheet: 'MDR', row: 12 + index } }],
    }
  }))
}

function summary(tasks) {
  const starts = tasks.map(task => task.planned_start_date).filter(Boolean).sort()
  const finishes = tasks.map(task => task.planned_finish_date).filter(Boolean).sort()
  const complete = Boolean(tasks.length && starts.length === tasks.length && finishes.length === tasks.length)
  let days = complete ? 0 : null
  if (complete) {
    const cursor = new Date(`${starts[0]}T00:00:00Z`)
    while (cursor.toISOString().slice(0, 10) <= finishes.at(-1)) {
      if (![0, 6].includes(cursor.getUTCDay())) days += 1
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    if (starts[0] === finishes.at(-1) && tasks.every(task => task.is_milestone)) days = 0
  }
  return { planned_start_date: starts[0] || null, planned_finish_date: finishes.at(-1) || null, duration_days: days, total_float_days: tasks.every(task => task.total_float_days !== null) ? Math.min(...tasks.map(task => task.total_float_days)) : null, is_critical: tasks.some(task => task.is_critical), task_count: tasks.length, complete, duration_basis: 'working_calendar_span' }
}

export async function primaveraScheduleHarness(page, options = {}) {
  return masterScheduleHarness(page, {
    ...options,
    prepare(state) {
      for (const record of Object.values(state.records)) {
        Object.assign(record.project, { code: 'RAD-210', name: 'Amine Regeneration Upgrade', project_manager_name: 'Maya Hassan' })
        Object.assign(record.planningProject, { name: record.project.name })
        const tasks = primaveraTasks()
        const nodes = structuredClone(primaveraNodes)
        for (const node of nodes) {
          const descendants = tasks.filter(task => {
            let id = task.wbs_node_id
            while (id !== null) { if (id === node.id) return true; id = nodes.find(item => item.id === id)?.parent_id ?? null }
            return false
          })
          node.summary = summary(descendants)
        }
        const project = { id: record.planningProject.id, enterprise_project_id: record.project.id, code: record.project.code, name: record.project.name, phase: 'Detailed Engineering', start_date: '2026-09-21', end_date: '2026-12-20', planned_start_date: '2026-09-21', planned_finish_date: '2026-12-20' }
        const calendar = { id: 31, name: 'Monday–Friday', working_weekdays: [0, 1, 2, 3, 4], hours_per_day: 8, timezone: 'Asia/Dubai', exceptions: [], duration_basis: 'working_days' }
        Object.assign(record.simplePlan, { tasks, project, wbs_nodes: nodes, calendar, work_calendar: calendar, project_summary: summary(tasks), hierarchy_source: 'schedule_version', calculation_available: true, version_id: 91, version_number: 3, current_version_id: 91, disciplines: ['process', 'electrical', 'mechanical', 'piping', 'controls', 'milestones'].map(code => ({ code, name: nodes.find(node => node.discipline === code).name })) })
      }
      options.prepare?.(state)
    },
    async handleRequest(context) {
      if (await options.handleRequest?.(context)) return true
      const { path, record, reply, route } = context
      if (!path.endsWith('/employee-activity/')) return false
      const task = record.simplePlan.tasks[0]
      await reply(route, {
        employee: masterEmployees[1], project: { id: record.planningProject.id, code: record.project.code, name: record.project.name },
        summary: { total: 1, open: 1, completed: 0, overdue: 0 },
        tasks: [{ project_task_id: task.project_task_id, wbs_task_id: task.id, title: task.title, task_type: task.task_type, role: 'assignee', assignment_state: 'current', status: 'in_progress', progress_percent: 45, assigned_to: masterEmployees[1], reviewer: masterEmployees[0], assigned_by: masterEmployees[0], assigned_at: fixedNow, due_date: task.due_date, priority: 'medium' }],
        activity: [{ id: 'progress-1', project_task_id: task.project_task_id, wbs_task_id: task.id, title: task.title, action: 'progress_updated', timestamp: fixedNow, actor: masterEmployees[1], before: { status: 'todo', progress_percent: 0 }, after: { status: 'in_progress', progress_percent: 45 } }],
      })
      return true
    },
  })
}

// Reproduces short, identical source dates without inventing sequencing. The
// project horizon may be much longer than these activities' recorded dates.
export async function primaveraTimelineHarness(page, options = {}) {
  const taskStart = options.taskStart || '2026-01-06'
  const taskFinish = options.taskFinish || '2026-01-12'
  const projectStart = options.projectStart || taskStart
  const projectFinish = options.projectFinish || taskFinish
  return primaveraScheduleHarness(page, {
    ...options,
    prepare(state) {
      for (const record of Object.values(state.records)) {
        Object.assign(record.project, { start_date: projectStart, end_date: projectFinish })
        Object.assign(record.planningProject, { effective_date: projectStart, planned_end_date: projectFinish })
        const plan = record.simplePlan
        Object.assign(plan.project, { start_date: projectStart, end_date: projectFinish, planned_start_date: projectStart, planned_finish_date: projectFinish })
        plan.tasks = plan.tasks.map(task => ({ ...task, planned_start_date: taskStart, planned_finish_date: taskFinish, due_date: taskFinish, duration_days: 5, effort_hours: 40, duration_source: 'schedule_activity', is_milestone: false, activity_type: 'task', is_critical: null, total_float_days: null, calculated: false }))
        plan.calculation_available = false
        plan.project_summary = summary(plan.tasks)
        for (const node of plan.wbs_nodes) node.summary = { ...summary(plan.tasks), task_count: node.summary.task_count }
      }
      options.prepare?.(state)
    },
  })
}
