import { scheduleHarness, pageOf, fixedNow } from './schedule-performance.fixture.js'

export const registerNames = [
  'P&ID - Amine Regeneration Unit / Area 210 (Rev. A)',
  'ELECTRICAL LOAD LIST - UNIT 210',
]
export const masterEmployees = [
  { user_id: 7, name: 'Maya Hassan', employee_code: 'RAD-007', email: 'maya@example.test', department: 'Project Control' },
  { user_id: 8, name: 'Omar Saleh', employee_code: 'RAD-008', email: 'omar@example.test', department: 'Engineering' },
]
const finish = (start, days) => {
  const current = new Date(`${start}T00:00:00Z`)
  let left = Math.max(1, Math.ceil(Number(days || 1)))
  while (left > 0) { if (![0, 6].includes(current.getUTCDay())) left -= 1; if (left) current.setUTCDate(current.getUTCDate() + 1) }
  return current.toISOString().slice(0, 10)
}
const registerTasks = () => registerNames.map((title, index) => ({
  id: `register-${index + 1}`, discipline: index ? 'electrical' : 'process', title,
  document_number: index ? 'RAD-210-EL-001' : 'RAD-210-PID-001', document_revision: index ? '0' : 'A',
  assignee_id: 8, assignee: masterEmployees[1], owner: 'Omar Saleh', reviewer_id: 7, reviewer_user: masterEmployees[0], reviewer: 'Maya Hassan',
  task_type: 'deliverable', priority: 'medium', effort_hours: index ? 16 : 24,
  duration_days: index ? 2 : 3, duration_source: 'planner', planned_start_date: index ? '2026-09-24' : '2026-09-21',
  planned_finish_date: index ? '2026-09-25' : '2026-09-23', due_date: index ? '2026-09-25' : '2026-09-23',
  depends_on: index ? ['register-1'] : [], acceptance_criteria: 'Reviewed against the approved register and source evidence.',
  status: 'todo', progress_percent: 0, project_task_id: 3001 + index, is_critical: null, total_float_days: null,
  source_references: [{ file_id: 801, filename: 'Approved MDR.csv', locator: { sheet: 'MDR', row: 12 + index } }],
}))
const documentRecord = (name = 'Approved MDR.csv', category = 'mdr', id = 801) => ({
  id, project: 71, original_filename: name, category, parse_status: 'done', parse_error: '',
  size_bytes: 640, file: null, parsed_metadata: {}, created_at: fixedNow, updated_at: fixedNow,
})

function snapshot(record, historicalVersion) {
  const plan = structuredClone(record.simplePlan)
  plan.permissions = {
    can_edit: plan.state !== 'baselined', can_assign: plan.state !== 'baselined',
    can_submit: plan.state === 'review' && plan.tasks.length > 0 && !plan.stale_inputs,
    can_approve_publish: plan.state === 'submitted' && !plan.stale_inputs,
    can_reopen: plan.state === 'baselined',
  }
  plan.blockers = plan.tasks.length ? [] : [{ code: 'tasks_required', message: 'Add at least one task to the plan.' }]
  plan.source_documents = record.files.map(file => ({ id: file.id, original_filename: file.original_filename, category: file.category, parse_status: file.parse_status }))
  if (historicalVersion) {
    Object.assign(plan, { viewing_history: true, version_id: Number(historicalVersion), version_number: 2, calculation_available: true, read_only_reason: 'You are viewing a saved schedule version. Return to the current draft to make changes.' })
    plan.permissions = { can_edit: false, can_assign: false, can_submit: false, can_approve_publish: false, can_reopen: false }
    plan.tasks = plan.tasks.map((task, index) => ({ ...task, is_critical: index === 0, calculated: true, total_float_days: index ? 2 : 0 }))
  }
  return plan
}

export async function masterScheduleHarness(page, options = {}) {
  return scheduleHarness(page, {
    query: options.query || 'project=17&view=plan-baseline&shell=true',
    prepare(state) {
      Object.assign(state, { writes: [], pageErrors: [], unknownWrites: [], saveError: null, uploadError: null, analysisError: null, projectListError: Boolean(options.projectListError), missingPlanning: Boolean(options.noWorkspace), nextTaskId: 3100 })
      for (const record of Object.values(state.records)) {
        Object.assign(record.project, { start_date: options.blankDates ? null : '2026-09-21', end_date: options.blankDates ? null : '2026-12-20', custom_fields: { project_type: options.manual ? 'internal' : 'engineering', planning_mode: options.manual ? 'manual' : 'document' } })
        Object.assign(record.planningProject, {
          effective_date: record.project.start_date, planned_end_date: record.project.end_date,
          phase: 'Phase 1', planning_mode: options.manual ? 'manual' : 'document',
          scope_summary: options.blankDates ? '' : 'Deliver the approved project scope and register.',
          exclusions: '', budgeted_effort_hours: null,
        })
        record.files = options.empty ? [] : [documentRecord()]
        record.baselines = []
        record.simplePlan = {
          project_id: record.planningProject.id, state: options.empty ? 'inputs' : 'review', revision: options.empty ? 0 : 4,
          tasks: options.empty ? [] : registerTasks(), disciplines: options.manual ? [{ code: 'general', name: 'General' }] : [{ code: 'process', name: 'Process Engineering' }, { code: 'electrical', name: 'Electrical Engineering' }],
          stale_inputs: false, assumptions: [{ code: 'calendar', message: 'Review the Monday–Friday working calendar.' }],
          warnings: [], source_documents: [], baseline: null, review: null,
          approvers: [{ id: 7, name: 'Maya Hassan' }], method: options.manual ? 'manual' : 'document_extraction',
          viewing_history: false, calculation_available: false, version_id: null, version_number: null,
          versions: options.history ? [{ id: 90, schedule_id: 81, version: 2, version_number: 2, status: 'baselined', label: 'Version 2 · Baseline', created_at: fixedNow }] : [],
        }
      }
      options.prepare?.(state)
      page.on('pageerror', error => state.pageErrors.push(error.message))
    },
    async handleRequest(context) {
      const { route, path, url, state, record, reply } = context
      if (await options.handleRequest?.(context)) return true
      const method = route.request().method()
      const send = async (body, status = 200) => { await reply(route, body, status); return true }
      const json = () => route.request().postDataJSON()
      const write = data => state.writes.push({ method, path, data })
      if (path.endsWith('/planning-intelligence/projects/')) {
        if (method === 'GET') return state.projectListError ? send({ detail: 'Planning workspace connection temporarily unavailable.' }, 503) : send(pageOf(state.missingPlanning ? [] : [record.planningProject]))
        if (method === 'POST') {
          const body = json(); write(body); Object.assign(record.planningProject, body); state.missingPlanning = false
          return send(record.planningProject, 201)
        }
      }
      if (/\/planning-intelligence\/projects\/\d+\/$/.test(path)) {
        if (method === 'PATCH') {
          const body = json(); write(body); Object.assign(record.planningProject, body)
          record.simplePlan.stale_inputs = record.simplePlan.tasks.length > 0
        }
        return send(record.planningProject)
      }
      if (path.endsWith('/enterprise-contract/')) return send({ project: record.planningProject, enterprise_project: record.project, linked: true, in_sync: true, differences: [], lifecycle: record.simplePlan.state === 'baselined' ? 'baselined' : 'planning', baseline_locked: record.simplePlan.state === 'baselined', baseline: record.simplePlan.baseline })
      if (path.endsWith('/eligible-employees/')) {
        const query = (url.searchParams.get('search') || '').toLowerCase()
        return send({ count: masterEmployees.length, results: masterEmployees.filter(employee => Object.values(employee).join(' ').toLowerCase().includes(query)) })
      }
      if (path.endsWith('/employee-activity/')) return send({ employee: masterEmployees[1], project: { id: record.planningProject.id, name: record.project.name }, summary: { total: 2, todo: 2 }, tasks: record.simplePlan.tasks.map(task => ({ id: task.project_task_id, title: task.title, status: 'todo', assigned_by_name: 'Maya Hassan', assigned_at: fixedNow, due_date: task.due_date, history: [] })), activity: [] })
      if (path.endsWith('/planning-intelligence/files/')) {
        if (method === 'POST') {
          const multipart = route.request().postDataBuffer().toString('utf8')
          const name = multipart.match(/filename="([^"]+)"/)?.[1] || 'Uploaded document.csv'
          const category = multipart.match(/name="category"\r\n\r\n([^\r]+)/)?.[1] || 'other'
          write({ name, category, project: Number(multipart.match(/name="project"\r\n\r\n([^\r]+)/)?.[1]) })
          if (state.uploadError) return send(state.uploadError, 503)
          const file = documentRecord(name, category, 801 + record.files.length)
          record.files.push(file); record.simplePlan.stale_inputs = Boolean(record.simplePlan.tasks.length)
          return send(file, 201)
        }
        return send(pageOf(record.files))
      }
      if (/\/planning-intelligence\/files\/\d+\/$/.test(path) && method === 'DELETE') {
        write(null); record.files = record.files.filter(file => !path.endsWith(`/${file.id}/`)); return send({}, 200)
      }
      if (path.includes('/simple-plan/')) {
        if (method === 'GET') return send(snapshot(record, url.searchParams.get('version_id')))
        const body = json(); write(body)
        if (state.saveError && method === 'PUT') return send(state.saveError, 409)
        if (body.revision !== record.simplePlan.revision) return send({ error: 'The plan changed in another session. Refresh before saving.', code: 'simple_plan_revision_conflict' }, 409)
        if (path.endsWith('/analyse/')) {
          if (state.analysisError) return send(state.analysisError, 409)
          if (record.files.length) record.simplePlan.tasks = registerTasks()
          Object.assign(record.simplePlan, { state: 'review', revision: body.revision + 1, stale_inputs: false })
        } else if (method === 'PUT') {
          record.simplePlan.tasks = body.tasks.map(task => {
            const previous = record.simplePlan.tasks.find(item => item.id === task.id) || {}
            const assignee = masterEmployees.find(person => person.user_id === task.assignee_id) || null
            const duration = task.duration_days ?? (task.effort_hours != null ? Math.max(1, Math.ceil(task.effort_hours / 8)) : 5)
            const start = task.planned_start_date || record.planningProject.effective_date || '2026-09-21'
            return { ...previous, ...task, assignee, owner: assignee?.name || task.owner || '', reviewer_user: masterEmployees.find(person => person.user_id === task.reviewer_id) || null, duration_days: duration, duration_source: task.duration_days == null ? 'proposed' : 'planner', planned_start_date: start, planned_finish_date: finish(start, duration), project_task_id: previous.project_task_id || state.nextTaskId++, status: previous.status || 'todo' }
          })
          Object.assign(record.simplePlan, { disciplines: body.disciplines, revision: body.revision + 1, state: 'review', stale_inputs: false })
        } else if (path.endsWith('/submit/')) Object.assign(record.simplePlan, { state: 'submitted', revision: body.revision + 1, review: { id: 501, status: 'pending' } })
        else if (path.endsWith('/approve-publish/')) Object.assign(record.simplePlan, { state: 'baselined', revision: body.revision + 1, baseline: { id: 601, name: 'Approved Phase 1 baseline', version_id: 91, approved_at: fixedNow }, review: { id: 501, status: 'approved' } })
        else if (path.endsWith('/reopen/')) Object.assign(record.simplePlan, { state: 'review', revision: body.revision + 1, review: null })
        else { state.unknownWrites.push(path); return send({ detail: 'Unexpected mocked planning action.' }, 400) }
        return send(snapshot(record))
      }
      if (method !== 'GET' && method !== 'OPTIONS') { state.unknownWrites.push(path); return send({ detail: 'Unexpected write blocked by the browser fixture.' }, 400) }
      return false
    },
  })
}
