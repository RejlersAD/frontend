import { masterScheduleHarness, masterEmployees } from './master-schedule.fixture.js'

export const workflowStages = [
  ['IFR', 'IFR', '2026-09-21', '2026-09-22', 2],
  ['COMPANY_REVIEW', 'Company Review', '2026-09-23', '2026-09-24', 2],
  ['IFA', 'IFA', '2026-09-25', '2026-09-28', 2],
  ['COMPANY_APPROVAL', 'Company Approval', '2026-09-29', '2026-09-30', 2],
  ['FINAL_ISSUE', 'Final Issue', '2026-10-01', '2026-10-01', 0],
]

export async function workflowStageHarness(page, options = {}) {
  return masterScheduleHarness(page, {
    ...options,
    prepare(state) {
      for (const record of Object.values(state.records)) {
        const sourceParents = options.largeDataset ? Array.from({ length: 220 }, (_, index) => ({
          id: `source-${String(index + 1).padStart(3, '0')}`,
          title: `Synthetic deliverable ${String(index + 1).padStart(3, '0')}`,
          document_number: `DOC-${String(index + 1).padStart(3, '0')}`,
          discipline: 'process', parent_wbs_node_id: 201,
        })) : [
          { id: 'source-a', title: 'HVAC ADEQUEACY REPORT', document_number: 'FAR-0', discipline: 'process', parent_wbs_node_id: 201 },
          { id: 'source-b', title: 'HVAC ADEQUEACY REPORT', document_number: 'FAR-6', discipline: 'process', parent_wbs_node_id: 201 },
          { id: 'source-c', title: 'Final design package', document_number: 'PKG-001', discipline: 'process', wbs_node_id: 203 },
        ]
        const parents = sourceParents.map(parent => ({ ...parent, workflow_task_ids: workflowStages.map(([code], index) => options.largeDataset && index === 0 ? parent.id : `${parent.id}-${code}`) }))
        const tasks = parents.flatMap((parent, parentIndex) => workflowStages.map(([code, name, start, finish, duration], index) => ({
          id: parent.workflow_task_ids[index], parent_deliverable_id: parent.id,
          title: `${parent.title} — ${name}`, discipline: parent.discipline,
          activity_code: `${parent.document_number}-${code}`, wbs_node_id: parent.wbs_node_id || parent.parent_wbs_node_id,
          workflow_stage_code: code, workflow_stage_name: name, workflow_stage_sequence: index + 1,
          responsible_role: [1, 3].includes(index) ? 'Company' : 'Contractor',
          schedule_phase: 'engineering', duration_days: duration, duration_source: 'proposed',
          planned_start_date: start, planned_finish_date: finish,
          is_milestone: duration === 0, activity_type: duration === 0 ? 'finish_milestone' : 'task',
          total_float_days: 0, is_critical: parentIndex === 0 && index === 0,
          effort_hours: duration * 8, assignee_id: 8, assignee: masterEmployees[1], owner: masterEmployees[1].name,
          depends_on: index ? [parent.workflow_task_ids[index - 1]] : [],
          dependency_details: index ? [{ task_id: parent.workflow_task_ids[index - 1], type: 'FS', lag_days: 0 }] : [],
          source_references: [{ file_id: 801, filename: 'Synthetic MDR.csv', locator: { row: parentIndex + 1 } }],
        })))
        const calendar = { name: 'Monday–Friday', working_weekdays: [0, 1, 2, 3, 4], hours_per_day: 8, exceptions: [] }
        Object.assign(record.simplePlan, {
          tasks: [...tasks].reverse(), deliverables: parents,
          project: { id: record.planningProject.id, code: 'TEST-WORKFLOW', name: 'Synthetic workflow schedule' },
          work_calendar: calendar, calendar, calculation_available: true,
          wbs_nodes: [
            { id: 201, parent_id: null, code: '1', name: 'Process Engineering', discipline: 'process', sort_order: 0 },
            { id: 203, parent_id: 201, code: '1.3', name: 'Final design package', discipline: 'process', sort_order: 2 },
          ],
          disciplines: [{ code: 'process', name: 'Process Engineering' }],
        })
        if (options.largeDataset) record.simplePlan.wbs_nodes = record.simplePlan.wbs_nodes.slice(0, 1)
      }
      options.prepare?.(state)
    },
  })
}

export async function workflowProposalHarness(page, { blocked = false, existingSequence = false } = {}) {
  return workflowStageHarness(page, {
    prepare(state) {
      state.workflowPreviews = {}
      state.workflowApplied = 0
      for (const record of Object.values(state.records)) {
        const preview = structuredClone(record.simplePlan)
        preview.permissions = { can_edit: true, can_assign: true, can_submit: true, can_approve_publish: false }
        preview.workflow_mode = 'standard_five'
        if (existingSequence) {
          const shiftDate = (value, days) => {
            const date = new Date(`${value}T00:00:00Z`)
            date.setUTCDate(date.getUTCDate() + days)
            return date.toISOString().slice(0, 10)
          }
          for (const task of preview.tasks) {
            const index = preview.deliverables.findIndex(parent => parent.id === task.parent_deliverable_id)
            task.planned_start_date = shiftDate(task.planned_start_date, index * 14)
            task.planned_finish_date = shiftDate(task.planned_finish_date, index * 14)
            if (index > 0 && task.workflow_stage_code === 'IFR') {
              const predecessor = preview.deliverables[index - 1].workflow_task_ids.at(-1)
              task.depends_on = [predecessor]
              task.dependency_details = [{ task_id: predecessor, type: 'FS', lag_days: 0, source: 'deliverable_sequence', status: 'proposed' }]
            }
          }
          preview.schedule_proposal = { workflow_mode: 'standard_five', relationship_count: 14 }
        }
        if (blocked) preview.deliverables[0].expansion_blockers = [{ code: 'workflow_completed_parent', task_id: 'source-a', message: 'Review the completed HVAC deliverable before converting it into workflow tasks.' }]
        state.workflowPreviews[record.planningProject.id] = preview
        if (existingSequence) continue
        record.simplePlan.tasks = preview.deliverables.map(parent => ({
          id: parent.id, title: parent.title, discipline: parent.discipline, activity_code: parent.document_number,
          wbs_node_id: parent.wbs_node_id || parent.parent_wbs_node_id,
          duration_days: 9, duration_source: 'planner', effort_hours: 64,
          planned_start_date: '2026-09-21', planned_finish_date: '2026-10-01',
          depends_on: [], is_milestone: false, task_type: 'deliverable',
        }))
        delete record.simplePlan.deliverables
      }
    },
    async handleRequest({ path, route, record, state, reply }) {
      if (!path.endsWith('/propose-schedule/') && !path.endsWith('/apply-schedule/')) return false
      const body = route.request().postDataJSON()
      state.writes.push({ method: route.request().method(), path, data: body })
      const plan = state.workflowPreviews[record.planningProject.id]
      const token = `workflow-${record.planningProject.id}-${record.simplePlan.revision}`
      if (path.endsWith('/propose-schedule/')) {
        await reply(route, { plan, proposal: {
          token, revision: record.simplePlan.revision, workflow_mode: 'standard_five',
          task_count: plan.tasks.length, deliverable_count: plan.deliverables.length,
          changed_count: plan.tasks.length, relationship_count: plan.tasks.reduce((sum, task) => sum + task.depends_on.length, 0),
          assumptions: [], warnings: [], source_constraints: [],
          expansion_blockers: plan.deliverables.flatMap(parent => parent.expansion_blockers || []),
        } })
        return true
      }
      if (blocked || body.proposal_token !== token || body.revision !== record.simplePlan.revision) {
        await reply(route, { error: 'The workflow cannot be applied.' }, 409)
        return true
      }
      record.simplePlan = { ...structuredClone(plan), revision: record.simplePlan.revision + 1 }
      state.workflowApplied += 1
      await reply(route, record.simplePlan)
      return true
    },
  })
}
