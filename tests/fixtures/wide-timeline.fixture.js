import { compactScheduleHarness } from './compact-schedule.fixture.js'

export const verificationScopeMessage = 'Source states 28 weeks relative to award/effective date. The contract-award date is unconfirmed; the project start has not been substituted.'

function verificationRecord(record, mode) {
  const plan = record.simplePlan
  const examples = [...plan.tasks]
  for (let index = plan.tasks.length; index < 220; index += 1) {
    plan.tasks.push({ ...structuredClone(examples[index % examples.length]), id: `register-${index + 1}`, activity_code: `MDR-${index + 1}`, title: `Synthetic deliverable ${index + 1}`, document_number: `TEST-${index + 1}`, depends_on: [], dependency_details: [], dependency_rationales: {} })
  }
  const registerFile = { id: 901, name: 'Synthetic MDR.xlsx', category: 'mdr' }
  const scopeFile = { id: 902, name: 'Scope of Work.pdf', category: 'sow' }
  const referenceFile = { id: 903, name: 'Reference schedule.xer', category: 'reference_schedule' }
  const files = [registerFile, scopeFile, ...(mode === 'not_imported' ? [referenceFile] : [])]
  record.files = files.map(file => ({ ...file, project: record.planningProject.id, original_filename: file.name, parse_status: 'done', size_bytes: 100 }))
  const workingDate = offset => {
    const date = new Date('2026-01-06T00:00:00Z')
    for (let day = 0; day < offset;) { date.setUTCDate(date.getUTCDate() + 1); if (![0, 6].includes(date.getUTCDay())) day += 1 }
    return date.toISOString().slice(0, 10)
  }
  plan.tasks.forEach((task, index) => {
    const start = Math.floor(index * 188 / (plan.tasks.length - 1))
    Object.assign(task, { planned_start_date: workingDate(start), planned_finish_date: workingDate(start + 4), duration_days: 5, is_milestone: false, activity_type: 'task' })
    task.duration_source = 'proposed'
    task.source_references = [{ file_id: registerFile.id, filename: registerFile.name, locator: { sheet: 'MDR', row: index + 12 } }]
  })
  Object.assign(plan.project_summary, { planned_start_date: workingDate(0), planned_finish_date: workingDate(192), duration_days: 193, complete: true, task_count: plan.tasks.length })
  for (const node of plan.wbs_nodes) {
    const descendants = plan.tasks.filter(task => {
      let parent = task.wbs_node_id
      while (parent != null) { if (parent === node.id) return true; parent = plan.wbs_nodes.find(item => item.id === parent)?.parent_id }
      return false
    })
    const start = descendants.map(task => task.planned_start_date).sort()[0]
    const finish = descendants.map(task => task.planned_finish_date).sort().at(-1)
    let days = 0
    for (const date = new Date(`${start}T00:00:00Z`); date.toISOString().slice(0, 10) <= finish; date.setUTCDate(date.getUTCDate() + 1)) if (![0, 6].includes(date.getUTCDay())) days += 1
    Object.assign(node.summary, { planned_start_date: start, planned_finish_date: finish, duration_days: days, complete: true, task_count: descendants.length })
  }
  const counts = { expected_count: plan.tasks.length, matched_count: plan.tasks.length, missing: [], extra: [], changed: [] }
  if (mode === 'mismatch') {
    const changed = plan.tasks[0], missing = plan.tasks[1]
    const expectedTitle = changed.title
    changed.title = `${changed.title} (revised)`
    counts.changed.push({ id: changed.id, code: changed.activity_code, title: changed.title, actual_title: changed.title, expected_title: expectedTitle, expected_discipline: changed.discipline, source_references: changed.source_references, expected_source_references: changed.source_references })
    counts.missing.push({ id: `register:${registerFile.id}:2`, code: missing.activity_code, title: missing.title, discipline: missing.discipline, source_references: missing.source_references })
    const extra = { ...missing, activity_code: 'MANUAL-EXTRA', title: 'Additional planner review', source_references: [], depends_on: [] }
    counts.extra.push({ id: extra.id, code: extra.activity_code, title: extra.title, discipline: extra.discipline, source_references: [] })
    plan.tasks[1] = extra
    counts.matched_count -= 2
  }
  const blocker = mode === 'not_imported' ? { code: 'reference_schedule_not_imported', message: 'A reference schedule is uploaded, but its activity dates, calendars and relationships have not been imported and validated. Uploaded text alone cannot establish an exact schedule match.', files: [referenceFile] } : null
  plan.blockers = blocker ? [blocker] : []
  const inferred = plan.tasks.reduce((count, task) => count + (task.depends_on || []).filter(id => task.dependency_rationales?.[id]?.evidence_type === 'planning_inference').length, 0)
  const registerMessage = mode === 'mismatch' ? `Register comparison: ${counts.matched_count} of ${counts.expected_count} parsed rows match; 1 missing, 1 extra and 1 changed.` : `All ${counts.matched_count} parsed register rows match the draft's exact titles and disciplines. This verifies register content only.`
  plan.source_verification = {
    status: 'unverified',
    document_register: { status: mode === 'mismatch' ? 'mismatch' : 'matched', ...counts, files: [registerFile], unparsed_files: [], unrecognized_files: [], comparison: 'Exact titles and disciplines; repeated source rows remain separate.' },
    schedule_reference: { status: mode === 'not_imported' ? 'not_imported' : 'missing', files: mode === 'not_imported' ? [referenceFile] : [], blocker },
    timing: { proposed_duration_count: plan.tasks.length, inferred_relationship_count: inferred, source_date_count: 0, dates_verified: false, dependencies_verified: false, source_date_reason: 'No validated structured source-schedule import is available; entered and calculated dates are not counted as source dates.' },
    calendar: { status: 'default_unverified', name: 'Monday–Friday', exception_count: 0 },
    source_requirements: [{ kind: 'relative_weeks', value: 28, anchor_status: 'unconfirmed', message: verificationScopeMessage, source_references: [{ file_id: scopeFile.id, filename: scopeFile.name, locator: { page: 14 }, excerpt: 'Completion within 28 weeks from contract award.' }] }],
    messages: [registerMessage, mode === 'not_imported' ? 'Reference schedule files are uploaded but have not been imported and validated.' : 'No original reference schedule is uploaded. Original activity dates, durations and relationships are unavailable for exact comparison.', `${plan.tasks.length} task durations and ${inferred} predecessor links are planning proposals, not verified original schedule values.`, 'The default Monday–Friday calendar has 0 exceptions and has not been compared with the original schedule calendar.'],
  }
}

// These original-duration values are synthetic UI fixtures. They are not a
// claim that any uploaded project document contains a 165-day source schedule.
export async function wideTimelineHarness(page, options = {}) {
  return compactScheduleHarness(page, {
    ...options,
    prepare(state) {
      for (const record of Object.values(state.records)) {
        const plan = record.simplePlan
        if (options.proposed) {
          plan.tasks.forEach(task => { task.duration_source = 'proposed' })
          plan.scheduling_status.state = 'proposed'
        }
        if (options.originals) {
          plan.tasks.forEach(task => { task.original_duration_days = task.duration_days ?? 4 })
          plan.wbs_nodes.forEach(node => { node.summary.original_duration_days = node.summary.duration_days ?? 165 })
          Object.assign(plan.wbs_nodes.find(node => node.id === 1000).summary, { original_duration_days: 165, duration_days: 249 })
          // Conflicting aggregate checks that an explicit root-row original
          // takes precedence; the second variant tests project-only fallback.
          Object.assign(plan.project_summary, { original_duration_days: options.projectOriginalOnly ? 165 : 180, duration_days: 249 })
          if (options.projectOriginalOnly) delete plan.wbs_nodes.find(node => node.id === 1000).summary.original_duration_days
        }
        if (options.verification) verificationRecord(record, options.verification)
      }
      options.prepare?.(state)
    },
    async handleRequest(context) {
      if (await options.handleRequest?.(context)) return true
      const { route, path, record, reply } = context
      if (options.verification && path.endsWith('/simple-plan/') && route.request().method() === 'GET') {
        const plan = structuredClone(record.simplePlan)
        plan.permissions = { can_edit: true, can_assign: true, can_submit: !plan.blockers.length, can_approve_publish: false, can_reopen: false }
        plan.source_documents = record.files.map(file => ({ id: file.id, original_filename: file.original_filename, category: file.category, parse_status: file.parse_status }))
        await reply(route, plan)
        return true
      }
      return false
    },
  })
}
