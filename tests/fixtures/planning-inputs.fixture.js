import { fixedNow, pageOf, scheduleHarness } from './schedule-performance.fixture'

// Shapes match PlanningProject, PlanningFile and the persisted intelligence
// serializers. All writes are browser interceptions and never reach RADAI.
const fileRecord = (project, overrides = {}) => ({
  id: 801, project, category: 'sow', original_filename: '5900913-scope-of-work.pdf',
  file: '/mock-media/scope.pdf', content_type: 'application/pdf', size_bytes: 241664,
  parse_status: 'done', confidence_score: 0.92, parse_error: '', uploaded_by: 7,
  created_at: fixedNow, updated_at: fixedNow, ...overrides,
})

const factRecord = (id, run, type, key, value, overrides = {}) => ({
  id, run, source_file: 801, source_filename: '5900913-scope-of-work.pdf',
  fact_type: type, key, value, normalized_value: typeof value === 'string' ? value.toLowerCase() : '',
  confidence: 0.88, extraction_method: 'deterministic', source_excerpt: '',
  source_locator: { page: 4, line: 32 }, status: 'detected', reviewed_by: null, reviewed_at: null,
  created_at: fixedNow, updated_at: fixedNow, ...overrides,
})

export function populatePlanningEvidence(record) {
  const project = record.planningProject.id
  const run = 901
  record.files = [fileRecord(project)]
  record.facts = [
    factRecord(911, run, 'discipline', 'process', { code: 'process', name: 'Process Engineering' }),
    factRecord(912, run, 'discipline', 'piping', { code: 'piping', name: 'Piping Engineering' }),
    factRecord(913, run, 'deliverable', 'process:design-basis', { discipline: 'process', name: 'Process design basis' }),
    factRecord(914, run, 'deliverable', 'piping:isometrics', { discipline: 'piping', name: 'Piping isometric drawings' }),
    factRecord(915, run, 'requirement', '801:1', 'Confirm shutdown access before tie-in work.'),
    factRecord(916, run, 'exclusion', 'exclusion:1', 'Civil foundations are excluded from this engineering package.'),
    factRecord(917, run, 'milestone', 'ifc-release', { name: 'IFC package release', date: '2026-11-20' }),
    factRecord(918, run, 'effective_date', 'effective_date', '2026-01-05', { status: 'conflicted' }),
    factRecord(919, run, 'effective_date', 'effective_date', '2026-01-12', { source_filename: 'contract-clarification.pdf', status: 'conflicted' }),
    factRecord(920, run, 'deliverable', 'rejected-deliverable', { discipline: 'civil', name: 'Rejected foundation design' }, { status: 'rejected' }),
  ]
  record.conflicts = [{
    id: 931, run, key: 'effective_date:effective_date', conflict_type: 'value_mismatch', fact_ids: [918, 919],
    facts: record.facts.filter(row => [918, 919].includes(row.id)),
    description: 'Conflicting effective date values were found across source evidence.', status: 'open',
    resolution: {}, resolved_by: null, resolved_at: null, created_at: fixedNow, updated_at: fixedNow,
  }]
  const completed = {
    id: run, project, status: 'succeeded', engine_version: '2.0', source_file_ids: [801],
    fact_count: record.facts.length, conflict_count: 1, intelligence: {
      document_intelligence_run_id: run,
      detected_project_name: record.planningProject.name,
      detected_effective_date_text: '2026-01-05', detected_duration_months: 12,
      evidence_summary: { fact_count: record.facts.length, conflict_count: 1, confirmed_count: 0 },
      open_conflicts: record.conflicts.map(({ id, description }) => ({ id, description })),
      ai_review: { review_summary: 'Review process and piping deliverables before planning the tie-in sequence.' },
      ai_scope: {
        scope_summary: 'Process and piping design for the residue yield improvement package.',
        disciplines_in_scope: ['process', 'piping'], disciplines_out_of_scope: ['civil'],
      },
      disciplines: {
        process: { in_scope: true, deliverables: ['Process design basis'], mentioned_in_source: ['Process design basis'], excluded_deliverables: [], ai_discovered: [] },
        piping: { in_scope: true, deliverables: ['Piping isometric drawings'], mentioned_in_source: ['Piping isometric drawings'], excluded_deliverables: [], ai_discovered: [] },
      },
      hse_studies: ['HAZOP'], available_hse_studies: ['HAZOP', 'HAZID'],
      notes: ['Confirm shutdown access before finalizing the planning sequence.'],
    },
    started_at: '2026-09-15T06:31:00Z', finished_at: '2026-09-15T06:32:00Z', error_message: '',
    requested_by: 7, created_at: '2026-09-15T06:31:00Z', updated_at: '2026-09-15T06:32:00Z', preview_confirmation: null,
  }
  // A newer failed run must not hide the most recent completed evidence.
  record.runs = [{ ...completed, id: 902, status: 'failed', intelligence: null, fact_count: 0, conflict_count: 0, error_message: 'Document extraction failed.', created_at: fixedNow }, completed]
}

export function confirmPlanningEvidence(record, confirmedAt = '2026-09-15T06:34:00Z') {
  record.conflicts = []
  record.facts.forEach(fact => { if (fact.status !== 'rejected') fact.status = fact.id === 919 ? 'rejected' : 'confirmed' })
  const run = record.runs.find(item => item.status === 'succeeded')
  run.intelligence.open_conflicts = []
  run.intelligence.evidence_summary.conflict_count = 0
  run.intelligence.evidence_summary.confirmed_count = record.facts.filter(fact => fact.status === 'confirmed').length
  const data = run.intelligence
  run.preview_confirmation = {
    confirmed_at: confirmedAt, confirmed_by: 7, is_current: true,
    preview: {
      detected_project_name: data.detected_project_name,
      detected_effective_date_text: data.detected_effective_date_text,
      detected_duration_months: data.detected_duration_months,
      disciplines: Object.fromEntries(Object.entries(data.disciplines).map(([code, discipline]) => [code, {
        in_scope: discipline.in_scope, deliverables: [...discipline.deliverables], excluded_deliverables: [...discipline.excluded_deliverables],
      }])),
      hse_studies: [...data.hse_studies],
    },
  }
}

export const planningEmployees = [
  { user_id: 7, employee_id: '00000000-0000-0000-0000-000000000007', employee_code: 'RAD-007', name: 'Maya Hassan', email: 'maya.hassan@example.test', department: 'Process Engineering', job_title: 'Lead Process Engineer' },
  { user_id: 8, employee_id: '00000000-0000-0000-0000-000000000008', employee_code: 'RAD-008', name: 'Omar Saleh', email: 'omar.saleh@example.test', department: 'Piping Engineering', job_title: 'Lead Piping Engineer' },
  { user_id: 9, employee_id: '00000000-0000-0000-0000-000000000009', employee_code: 'RAD-009', name: 'Layla Ahmed', email: 'layla.ahmed@example.test', department: 'Project Control', job_title: 'Project Manager' },
  { user_id: 10, employee_id: '00000000-0000-0000-0000-000000000010', employee_code: 'RAD-010', name: 'Nadia Ali', email: 'nadia.ali@example.test', department: 'Mechanical Engineering', job_title: 'Stress Engineer' },
]

export const taskAssignmentDefaults = {
  assignee_id: null, reviewer_id: null, assignee: null, reviewer_user: null,
  task_type: 'deliverable', due_date: null, priority: 'medium', status: 'todo', progress_percent: 0, project_task_id: null,
}

export function workBreakdownRecord(record) {
  const run = record.runs.find(item => item.status === 'succeeded')
  const names = { process: 'Process Engineering', piping: 'Piping Engineering', electrical: 'Electrical', civil: 'Civil' }
  const disciplines = Object.entries(run?.intelligence.disciplines || {}).filter(([, item]) => item.in_scope !== false).map(([code]) => ({ code, name: names[code] || code }))
  return {
    intelligence_run_id: run?.id, preview_confirmed_at: run?.preview_confirmation?.confirmed_at,
    revision: 0, saved_at: null,
    disciplines,
    source_documents: record.files.map(file => ({ id: file.id, name: file.original_filename, category: file.category, status: 'reviewed' })),
    tasks: disciplines.flatMap(discipline => (run.intelligence.disciplines[discipline.code].deliverables || []).filter(title => !(run.intelligence.disciplines[discipline.code].excluded_deliverables || []).includes(title)).map((title, index) => ({
      ...taskAssignmentDefaults, id: `${discipline.code}-${index + 1}`, discipline: discipline.code, title, owner: '', effort_hours: null, depends_on: [], acceptance_criteria: '', reviewer: '', source_references: [],
    }))),
  }
}

export async function planningInputsHarness(page, options = {}) {
  return scheduleHarness(page, {
    query: options.query || 'project=17&view=plan-baseline&scheduleMode=planner&shell=true',
    harnessPath: '/tests/fixtures/retained-planning-harness.jsx',
    prepare(state) {
      state.writes = []
      state.pageErrors = []
      state.missingPlanning = new Set()
      state.saveError = null
      state.uploadError = null
      state.confirmError = null
      state.wbsSaveError = null
      state.wbsStatus = 409
      state.employees = structuredClone(planningEmployees)
      state.employeeLookupError = null
      state.nextProjectTaskId = 3001
      state.employeeActivities = {}
      state.employeeActivityError = null
      state.fileListReads = 0
      state.jobs = {}
      state.jobReads = 0
      state.analysisProjects = []
      for (const record of Object.values(state.records)) {
        Object.assign(record.planningProject, {
          scope_summary: record.project.id === 17 ? 'Engineering for the residue yield improvement package.' : 'Grid protection and electrical integration.',
          exclusions: record.project.id === 17 ? 'Field installation by others.' : 'Civil works by others.',
          budgeted_effort_hours: record.project.id === 17 ? '12500.00' : '8000.00',
        })
        Object.assign(record, { files: [], runs: [], facts: [], conflicts: [], workBreakdown: null })
      }
      if (options.populated) populatePlanningEvidence(state.records[17])
      options.prepare?.(state)
      page.on('pageerror', error => state.pageErrors.push(error.message))
    },
    async handleRequest(context) {
      const { route, url, path, state, reply } = context
      if (await options.handleRequest?.(context)) return true
      if (!path.includes('/planning-intelligence/')) return false
      const method = route.request().method()
      const projectMatch = path.match(/\/planning-intelligence\/projects\/(\d+)\//)
      const planningId = projectMatch?.[1] || url.searchParams.get('project')
      const runId = url.searchParams.get('run')
      let record = Object.values(state.records).find(row => String(row.planningProject.id) === planningId)
        || Object.values(state.records).find(row => row.runs.some(run => String(run.id) === runId))
        || state.records[url.searchParams.get('enterprise_project')]
        || context.record
      const send = async (body, status = 200) => { await reply(route, body, status); return true }
      if (path.endsWith('/planning-intelligence/projects/')) {
        if (method === 'GET') return send(pageOf(state.missingPlanning.has(record.project.id) ? [] : [record.planningProject]))
        if (method === 'POST') {
          const data = route.request().postDataJSON()
          state.writes.push({ method, path, data })
          if (state.saveError) return send(state.saveError, 400)
          record = state.records[data.enterprise_project]
          if (!record) return send({ enterprise_project: ['A canonical enterprise project is required.'] }, 400)
          Object.assign(record.planningProject, data)
          state.missingPlanning.delete(record.project.id)
          return send(record.planningProject, 201)
        }
      }
      if (projectMatch && /\/projects\/\d+\/$/.test(path)) {
        if (method === 'PATCH') {
          const data = route.request().postDataJSON()
          state.writes.push({ method, path, data })
          if (state.saveError) return send(state.saveError, 400)
          Object.assign(record.planningProject, data, { updated_at: '2026-09-15T06:33:00Z' })
          for (const run of record.runs) if (run.preview_confirmation) run.preview_confirmation.is_current = false
        }
        return send(record.planningProject)
      }
      if (projectMatch && path.endsWith('/employee-activity/') && method === 'GET') {
        if (state.employeeActivityError) return send(state.employeeActivityError.body, state.employeeActivityError.status)
        const activity = state.employeeActivities[`${record.planningProject.id}:${url.searchParams.get('user_id')}`]
        return send(activity || { detail: 'Not found.' }, activity ? 200 : 404)
      }
      if (projectMatch && path.endsWith('/eligible-employees/') && method === 'GET') {
        if (state.employeeLookupError) return send(state.employeeLookupError, 503)
        const search = (url.searchParams.get('search') || '').trim().toLowerCase()
        const results = state.employees.filter(employee => Object.values(employee).join(' ').toLowerCase().includes(search))
        return send({ count: results.length, results })
      }
      if (projectMatch && path.endsWith('/work-breakdown/')) {
        const run = record.runs.find(item => item.status === 'succeeded')
        if (!run?.preview_confirmation?.is_current) return send({ error: 'Confirm and save the Document Intelligence Preview before editing the work breakdown.', code: 'intelligence_preview_confirmation_required' }, 409)
        const base = record.workBreakdown?.preview_confirmed_at === run.preview_confirmation.confirmed_at ? record.workBreakdown : workBreakdownRecord(record)
        const draft = { ...base, tasks: base.tasks.map(task => {
          const core = record.tasks.find(row => row.id === task.project_task_id && !row.is_deleted)
          return core ? { ...task, status: core.status, progress_percent: core.progress_percent } : task
        }) }
        if (method === 'GET') return send(draft)
        if (method === 'PUT') {
          const data = route.request().postDataJSON()
          state.writes.push({ method, path, data })
          if (state.wbsSaveError) return send(state.wbsSaveError, state.wbsStatus)
          if (data.preview_confirmed_at !== run.preview_confirmation.confirmed_at || data.intelligence_run_id !== run.id) return send({ error: 'Preview confirmation changed. Review the latest inputs before saving.', code: 'work_breakdown_preview_changed' }, 409)
          if (data.revision !== draft.revision) return send({ error: 'Another user updated this work breakdown. Reload before saving.', code: 'work_breakdown_revision_conflict' }, 409)
          const tasks = data.tasks.map(task => {
            const previous = draft.tasks.find(row => row.id === task.id)
            const assignee = state.employees.find(employee => employee.user_id === task.assignee_id) || null
            const reviewer = state.employees.find(employee => employee.user_id === task.reviewer_id) || null
            const core = record.tasks.find(row => row.wbs_task_id === task.id)
            const saved = { ...taskAssignmentDefaults, ...structuredClone(task), assignee, reviewer_user: reviewer,
              owner: assignee?.name || task.owner || '', reviewer: reviewer?.name || task.reviewer || '',
              status: assignee ? core?.status || previous?.status || 'todo' : 'todo',
              progress_percent: assignee ? core?.progress_percent || previous?.progress_percent || 0 : 0,
              project_task_id: assignee ? core?.id || previous?.project_task_id || state.nextProjectTaskId++ : null,
            }
            if (saved.project_task_id) {
              const coreTask = { id: saved.project_task_id, project: record.project.id, title: saved.title, assigned_to: saved.assignee_id,
                task_type: saved.task_type, due_date: saved.due_date, priority: saved.priority, status: saved.status,
                progress_percent: saved.progress_percent, wbs_task_id: saved.id, is_deleted: false }
              record.tasks = [...record.tasks.filter(row => row.id !== coreTask.id), coreTask]
            } else if (core) core.is_deleted = true
            return saved
          })
          record.tasks.forEach(task => { if (!tasks.some(row => row.project_task_id === task.id)) task.is_deleted = true })
          record.workBreakdown = { ...draft, tasks, revision: draft.revision + 1, saved_at: new Date(Date.parse(fixedNow) + 420000).toISOString() }
          if (data.advance) Object.assign(record.workBreakdown, { schedule_id: record.schedule.id, schedule_version_id: record.versions[0].id })
          return send(record.workBreakdown)
        }
      }
      if (path.endsWith('/enterprise-contract/')) return send({ project: record.planningProject, enterprise_project: record.project, linked: true, in_sync: true, differences: [], lifecycle: 'draft', baseline_locked: false, baseline: null })
      if (projectMatch && path.endsWith('/analyze/') && method === 'POST') {
        state.writes.push({ method, path })
        state.analysisProjects.push(structuredClone(record.planningProject))
        const id = 960 + state.analysisProjects.length
        const job = {
          id, project: record.planningProject.id, job_type: 'analyze', status: 'queued', progress: 0,
          message: 'Document intelligence queued.', result_data: {}, result_generation: null,
          error_code: '', error_message: '', idempotency_key: '', progress_log: [], heartbeat_at: null,
          attempt_count: 0, task_id: '', api_contract_version: 4,
          poll_url: `/api/v1/planning-intelligence/jobs/${id}/`, terminal: false,
          requested_by: 7, started_at: null, finished_at: null, created_at: fixedNow, updated_at: fixedNow,
        }
        state.jobs[id] = job
        return send(job, 202)
      }
      const jobMatch = path.match(/\/jobs\/(\d+)\/$/)
      if (jobMatch && method === 'GET') {
        state.jobReads += 1
        const job = state.jobs[jobMatch[1]]
        if (!job) return send({ detail: 'Job not found.' }, 404)
        record = Object.values(state.records).find(row => row.planningProject.id === job.project)
        const intelligence = { document_intelligence_run_id: 903, detected_project_name: record.planningProject.name, detected_effective_date_text: record.planningProject.effective_date, disciplines: {}, hse_studies: [], evidence_summary: { fact_count: record.facts.length, conflict_count: record.conflicts.length, confirmed_count: 0 } }
        if (job.status !== 'succeeded') {
          record.runs.unshift({ id: 903, project: job.project, status: 'succeeded', engine_version: '2.0', source_file_ids: record.files.map(file => file.id), fact_count: record.facts.length, conflict_count: record.conflicts.length, intelligence, started_at: '2026-09-15T06:34:00Z', finished_at: '2026-09-15T06:35:00Z', error_message: '', requested_by: 7, created_at: fixedNow, updated_at: fixedNow, preview_confirmation: null })
          record.facts.forEach(fact => { fact.run = 903 })
          record.conflicts.forEach(conflict => { conflict.run = 903 })
          Object.assign(job, { status: 'succeeded', terminal: true, progress: 100, message: 'Document intelligence completed.', result_data: { intelligence }, started_at: fixedNow, finished_at: fixedNow })
        }
        return send(job)
      }
      if (path.endsWith('/files/')) {
        if (method === 'POST') {
          const body = route.request().postDataBuffer().toString('utf8')
          const field = name => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]+)`))?.[1]
          const data = { project: field('project'), category: field('category'), filename: body.match(/filename="([^"]+)"/)?.[1] }
          state.writes.push({ method, path, data })
          record = Object.values(state.records).find(row => String(row.planningProject.id) === data.project)
          if (!record) return send({ project: ['Unknown planning workspace.'] }, 400)
          if (state.uploadError) return send(state.uploadError, 400)
          const file = fileRecord(record.planningProject.id, { id: 850 + state.writes.length, category: data.category, original_filename: data.filename, parse_status: 'pending' })
          record.files.push(file)
          for (const run of record.runs) if (run.preview_confirmation) run.preview_confirmation.is_current = false
          return send(file, 201)
        }
        state.fileListReads += 1
        return send(pageOf(record.files))
      }
      const fileMatch = path.match(/\/files\/(\d+)\/$/)
      if (fileMatch && method === 'DELETE') {
        state.writes.push({ method, path })
        for (const row of Object.values(state.records)) row.files = row.files.filter(file => String(file.id) !== fileMatch[1])
        await route.fulfill({ status: 204, body: '' })
        return true
      }
      const confirmPreview = path.match(/\/intelligence-runs\/(\d+)\/confirm-preview\/$/)
      if (confirmPreview && method === 'POST') {
        const data = route.request().postDataJSON()
        state.writes.push({ method, path, data })
        if (state.confirmError) return send(state.confirmError, 409)
        record = Object.values(state.records).find(row => row.runs.some(run => String(run.id) === confirmPreview[1]))
        const run = record?.runs.find(row => String(row.id) === confirmPreview[1])
        if (!run) return send({ error: 'Analysis not found.' }, 404)
        if (record.conflicts.some(conflict => ['open', 'ignored'].includes(conflict.status))) return send({ error: 'Resolve open clarifications before confirming this preview.', code: 'intelligence_conflicts_unresolved' }, 409)
        if (record.files.some(file => file.parse_status !== 'done') || run.source_file_ids.join(',') !== record.files.map(file => file.id).join(',')) return send({ error: 'Project inputs or source documents have changed.', code: 'intelligence_sources_changed' }, 409)
        const preview = structuredClone(data.preview)
        const disciplines = Object.fromEntries(Object.entries(preview.disciplines || {}).map(([code, choices]) => [code, { ...run.intelligence.disciplines?.[code], ...choices }]))
        Object.assign(run.intelligence, preview, { disciplines, evidence_summary: { ...run.intelligence.evidence_summary, conflict_count: 0, confirmed_count: record.facts.filter(fact => fact.status !== 'rejected').length }, open_conflicts: [] })
        run.preview_confirmation = { confirmed_at: new Date(Date.parse(fixedNow) + 300000 + state.writes.filter(write => write.path.endsWith('/confirm-preview/')).length * 1000).toISOString(), confirmed_by: 7, is_current: true, preview }
        record.facts.forEach(fact => { if (fact.status === 'detected') fact.status = 'confirmed' })
        return send(run)
      }
      if (path.endsWith('/intelligence-runs/')) return send(pageOf(record.runs))
      if (path.endsWith('/intelligence-facts/')) return send(pageOf(record.facts.filter(fact => String(fact.run) === runId)))
      if (path.endsWith('/intelligence-conflicts/')) return send(pageOf(record.conflicts.filter(conflict => String(conflict.run) === runId)))
      const factReview = path.match(/\/intelligence-facts\/(\d+)\/review\/$/)
      if (factReview && method === 'POST') {
        const data = route.request().postDataJSON()
        state.writes.push({ method, path, data })
        const fact = Object.values(state.records).flatMap(row => row.facts).find(row => String(row.id) === factReview[1])
        if (!fact) return send({ detail: 'Fact not found.' }, 404)
        Object.assign(fact, { status: data.status, reviewed_by: 7, reviewed_at: fixedNow })
        for (const row of Object.values(state.records)) for (const run of row.runs) if (run.preview_confirmation) run.preview_confirmation.is_current = false
        return send(fact)
      }
      const resolve = path.match(/\/intelligence-conflicts\/(\d+)\/resolve\/$/)
      if (resolve && method === 'POST') {
        const data = route.request().postDataJSON()
        state.writes.push({ method, path, data })
        record = Object.values(state.records).find(row => row.conflicts.some(conflict => String(conflict.id) === resolve[1]))
        const conflict = record?.conflicts.find(row => String(row.id) === resolve[1])
        if (!conflict || !conflict.fact_ids.includes(data.selected_fact_id)) return send({ error: 'Selected fact does not belong to this conflict.' }, 400)
        record.facts.filter(fact => conflict.fact_ids.includes(fact.id)).forEach(fact => { fact.status = fact.id === data.selected_fact_id ? 'confirmed' : 'rejected' })
        Object.assign(conflict, { status: 'resolved', resolution: data, resolved_by: 7, resolved_at: fixedNow })
        for (const run of record.runs) {
          if (run.preview_confirmation) run.preview_confirmation.is_current = false
          if (run.status === 'succeeded') {
            run.intelligence.open_conflicts = []
            run.intelligence.evidence_summary.conflict_count = 0
          }
        }
        return send(conflict)
      }
      if (path.endsWith('/workable-plan-status/') && method === 'GET') return send({ job: null, baseline: null })
      if (path.endsWith('/schedule-default-proposals/')) return send(pageOf([]))
      return false
    },
  })
}
