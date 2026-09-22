import { workflowStageHarness } from './workflow-stage-tree.fixture.js'

const stages = [
  ['IFR', 10, '2026-04-15', '2026-04-28'],
  ['COMPANY_REVIEW', 10, '2026-04-29', '2026-05-12'],
  ['IFA', 5, '2026-05-13', '2026-05-19'],
  ['COMPANY_APPROVAL', 5, '2026-05-20', '2026-05-26'],
  ['FINAL_ISSUE', 1, '2026-05-27', '2026-05-27'],
]
const disciplines = [['hse', 40], ['process', 50], ['piping', 50], ['electrical', 33]]
export const logicGateIds = ['source-001-FINAL_ISSUE', 'source-002-FINAL_ISSUE']
export const firstReviewTaskIds = ['source-003', 'source-004']

function decorate(plan, options) {
  const baseline = plan.state === 'baselined'
  plan.permissions = {
    ...plan.permissions, can_edit: !baseline && !options.viewer, can_assign: !baseline && !options.viewer,
    can_review_logic: !baseline && !options.viewer, can_submit: false, can_approve_publish: false,
    can_reopen: baseline && !options.viewer, can_generate: !options.viewer,
  }
  if (options.history || options.viewer) {
    plan.permissions.can_edit = false
    plan.permissions.can_assign = false
    plan.permissions.can_review_logic = false
    plan.permissions.can_reopen = false
    plan.permissions.can_generate = false
  }
  if (options.history) {
    plan.viewing_history = true
    plan.read_only_reason = 'You are viewing an immutable historical version.'
  }
  return plan
}

export async function scheduleLogicHarness(page, options = {}) {
  return workflowStageHarness(page, {
    largeDataset: true,
    history: options.history,
    decorateSnapshot: plan => decorate(plan, options),
    prepare(state) {
      state.logicError = null
      for (const record of Object.values(state.records)) {
        const plan = record.simplePlan
        plan.version_id = 91
        plan.version_number = 1
        plan.master_revision = 4
        plan.state = options.baseline ? 'baselined' : 'review'
        if (options.baseline) plan.baseline = { id: 601, version_id: 91, name: 'Baseline 1' }
        const byId = new Map(plan.tasks.map(task => [task.id, task]))
        const groups = []
        let offset = 2
        for (const [discipline, count] of disciplines) {
          const parents = plan.deliverables.slice(offset, offset + count)
          offset += count
          for (const parent of parents) {
            parent.discipline = discipline
            parent.title = `${discipline.toUpperCase()} ${parent.title}`
            for (const taskId of parent.workflow_task_ids) {
              const task = byId.get(taskId)
              const stage = stages[task.workflow_stage_sequence - 1]
              Object.assign(task, { discipline, title: `${parent.title} - ${stage[0]}`, duration_days: stage[1],
                planned_start_date: stage[2], planned_finish_date: stage[3], is_milestone: false, activity_type: 'task' })
              if (stage[0] === 'IFR') {
                task.depends_on = [...logicGateIds]
                task.dependency_details = logicGateIds.map(task_id => ({ task_id, type: 'FS', lag_days: 0, lag_unit: 'working_days' }))
              }
            }
          }
          groups.push({
            id: `parallel-${discipline}`, kind: 'parallel_workflow', status: 'requires_review', requires_review: true,
            discipline, deliverable_count: count, deliverable_ids: parents.map(parent => parent.id),
            deliverable_titles: parents.map(parent => parent.title), task_ids: parents.flatMap(parent => parent.workflow_task_ids),
            first_task_ids: parents.map(parent => parent.workflow_task_ids[0]),
            terminal_task_ids: parents.map(parent => parent.workflow_task_ids.at(-1)), terminal_task_count: count,
            terminal_deliverable_count: count, stage_durations: stages.map(([stage_code, duration_days]) => ({ stage_code, duration_days, duration_unit: 'working_days' })),
            start_date: '2026-04-15', finish_date: '2026-05-27', date_basis: 'planned',
            common_predecessors: logicGateIds.map(task_id => ({ task_id, title: byId.get(task_id).title, type: 'FS', lag_days: 0, lag_unit: 'working_days', successor_stage_code: 'IFR' })),
            message: 'These deliverables share incoming gates, workflow durations and the available date window. Confirm that parallel execution is intended and feasible.',
          })
        }
        for (const taskId of logicGateIds) Object.assign(byId.get(taskId), { planned_start_date: '2026-04-14', planned_finish_date: '2026-04-14' })
        plan.disciplines = disciplines.map(([code]) => ({ code, name: code.toUpperCase() }))
        plan.logic_quality = {
          fingerprint: 'a'.repeat(64), groups,
          summary: { workflow_deliverable_count: 220, parallel_group_count: 4, parallel_deliverable_count: 173,
            requires_review_count: 4, unreviewed_group_count: 4, warning_count: 0, unconnected_workflow_start_count: 0, terminal_branch_count: 218 },
        }
        if (options.compact !== false) {
          const retained = new Set(plan.deliverables.slice(0, 2).map(parent => parent.id))
          for (const group of groups) {
            group.deliverable_ids = group.deliverable_ids.slice(0, 6)
            group.deliverable_titles = group.deliverable_titles.slice(0, 6)
            group.first_task_ids = group.first_task_ids.slice(0, 6)
            group.terminal_task_ids = group.terminal_task_ids.slice(0, 6)
            group.task_ids = group.task_ids.slice(0, 30)
            group.deliverable_count = group.terminal_task_count = group.terminal_deliverable_count = 6
            group.deliverable_ids.forEach(id => retained.add(id))
          }
          plan.deliverables = plan.deliverables.filter(parent => retained.has(parent.id))
          plan.tasks = plan.tasks.filter(task => retained.has(task.parent_deliverable_id))
          plan.logic_quality.summary.workflow_deliverable_count = 26
          plan.logic_quality.summary.parallel_deliverable_count = 24
          plan.logic_quality.summary.terminal_branch_count = 24
        }
        decorate(plan, options)
      }
      options.prepare?.(state)
      state.logicBefore = structuredClone(state.records[17].simplePlan)
    },
    async handleRequest(context) {
      const { path, route, record, state, reply } = context
      if (await options.handleRequest?.(context)) return true
      const method = route.request().method()
      if (method !== 'POST' || !['/edit-activity/', '/confirm-parallel-logic/', '/reopen/'].some(suffix => path.endsWith(suffix))) return false
      const body = route.request().postDataJSON()
      state.writes.push({ method, path, data: body })
      if (state.logicError) {
        await reply(route, { error: state.logicError.message, code: state.logicError.code }, state.logicError.status)
        return true
      }
      if (body.revision !== record.simplePlan.revision) {
        await reply(route, { error: 'The plan changed in another session. Refresh before saving.', code: 'simple_plan_revision_conflict' }, 409)
        return true
      }
      const next = structuredClone(record.simplePlan)
      if (path.endsWith('/edit-activity/')) {
        for (const update of body.updates || []) {
          const task = next.tasks.find(task => task.id === update.task_id)
          if (update.dependency_details) {
            task.dependency_details = update.dependency_details
            task.depends_on = [...new Set(update.dependency_details.map(link => link.task_id))]
          }
          if (update.duration_days != null) { task.duration_days = update.duration_days; task.duration_source = 'planner' }
        }
        next.logic_quality.fingerprint = 'b'.repeat(64)
      } else if (path.endsWith('/confirm-parallel-logic/')) {
        const group = next.logic_quality.groups.find(group => group.id === body.group_id)
        group.status = 'reviewed'
        group.requires_review = false
        group.review = { rationale: body.rationale, duration_basis: body.duration_basis, capacity_basis: body.capacity_basis, max_parallel_deliverables: body.max_parallel_deliverables }
        next.logic_quality.summary.unreviewed_group_count -= 1
      } else {
        next.state = 'review'
        next.version_id = 92
        next.version_number = 2
        next.viewing_history = false
      }
      next.revision += 1
      next.master_revision = next.revision
      record.simplePlan = decorate(next, options)
      await reply(route, record.simplePlan)
      return true
    },
  })
}
