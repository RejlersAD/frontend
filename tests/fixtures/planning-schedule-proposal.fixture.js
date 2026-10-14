import { primaveraTimelineHarness } from './primavera-schedule.fixture.js'

export const proposalWarning = 'Contract award date is not confirmed. Review the 28-week source requirement before approval.'
export const proposalConstraint = 'Engineering completion is required within 28 weeks of contract award; confirm the award date.'
export const proposalAssumption = 'Draft predecessor links follow engineering handoffs and require project-manager review.'

function workday(offset) {
  const date = new Date('2026-01-06T00:00:00Z')
  for (let count = 0; count < offset;) {
    date.setUTCDate(date.getUTCDate() + 1)
    if (![0, 6].includes(date.getUTCDay())) count += 1
  }
  return date.toISOString().slice(0, 10)
}

function proposedResponse(record, token) {
  const plan = structuredClone(record.simplePlan)
  plan.tasks = plan.tasks.map((task, index, tasks) => {
    const stage = Math.floor(index / 4)
    const start = workday(stage * 5)
    const finish = workday(stage * 5 + 4)
    const predecessor = index >= 4 ? tasks[index - 4].id : null
    return { ...task, planned_start_date: start, planned_finish_date: finish, due_date: finish,
      depends_on: predecessor ? [predecessor] : [], duration_source: 'proposed',
      schedule_rationale: predecessor ? 'Proposed engineering handoff; confirm the prerequisite with the discipline lead.' : 'Independent starting activity; project-manager review is required.',
      dependency_rationales: predecessor ? { [predecessor]: { status: 'proposed', relationship_type: 'FS', lag_days: 0, rationale: 'The predecessor provides the required design input.', source_references: [], evidence_type: 'planning_inference' } } : {},
    }
  })
  const relatedTasks = nodeId => plan.tasks.filter(task => {
    let current = task.wbs_node_id
    while (current !== null) { if (current === nodeId) return true; current = plan.wbs_nodes.find(node => node.id === current)?.parent_id ?? null }
    return false
  })
  for (const node of plan.wbs_nodes) {
    const tasks = relatedTasks(node.id)
    node.summary = { ...node.summary, planned_start_date: tasks.map(task => task.planned_start_date).sort()[0], planned_finish_date: tasks.map(task => task.planned_finish_date).sort().at(-1), duration_days: null, duration_basis: 'working_calendar_span' }
  }
  const finish = plan.tasks.map(task => task.planned_finish_date).sort().at(-1)
  plan.project_summary = { ...plan.project_summary, planned_finish_date: finish, duration_days: null }
  plan.permissions = { can_edit: true, can_assign: true, can_submit: true, can_approve_publish: false, can_reopen: false }
  plan.scheduling_status = { state: 'proposed', provisional_count: plan.tasks.length, relationship_count: 40, message: 'Review the proposed dates and predecessor links before approval.' }
  const proposal = {
    token, revision: plan.revision, task_count: plan.tasks.length, changed_count: 40, relationship_count: 40,
    start_date: '2026-01-06', finish_date: finish,
    assumptions: [proposalAssumption, 'Monday–Friday working calendar with eight hours per day.'],
    warnings: [proposalWarning],
    source_constraints: [{ message: proposalConstraint, source_references: [{ filename: 'Approved Scope of Work.pdf', locator: { page: 14 } }] }],
  }
  return { proposal, plan }
}

export async function scheduleProposalHarness(page, options = {}) {
  return primaveraTimelineHarness(page, {
    ...options,
    projectFinish: '2026-09-04',
    history: true,
    prepare(state) {
      Object.assign(state, { proposals: {}, proposalCalls: 0, applyError: null, proposeError: null, persistedProposals: [], pauseProposal: Boolean(options.pauseProposal), releaseProposal: null })
      for (const record of Object.values(state.records)) {
        record.simplePlan.tasks = record.simplePlan.tasks.map(task => ({ ...task, duration_source: 'proposed' }))
        record.simplePlan.scheduling_status = { state: 'unsequenced', provisional_count: 44, relationship_count: 0, message: 'Activities have provisional durations and no predecessor sequence.' }
        if (options.baselined) Object.assign(record.simplePlan, { state: 'baselined', baseline: { id: 601, name: 'Approved Phase 1 baseline', version_id: 91 } })
      }
      options.prepare?.(state)
    },
    async handleRequest(context) {
      if (await options.handleRequest?.(context)) return true
      const { path, route, record, state, reply } = context
      if (!path.endsWith('/propose-schedule/') && !path.endsWith('/apply-schedule/')) return false
      const body = route.request().postDataJSON()
      state.writes.push({ method: route.request().method(), path, data: body })
      if (route.request().method() !== 'POST') { state.unknownWrites.push(path); await reply(route, { error: 'Unexpected proposal method.' }, 400); return true }
      if (path.endsWith('/propose-schedule/')) {
        if (state.proposeError) { await reply(route, state.proposeError, 409); return true }
        if (state.pauseProposal) await new Promise(resolve => { state.releaseProposal = () => { state.pauseProposal = false; resolve() } })
        state.proposalCalls += 1
        const preview = proposedResponse(record, `mock-proposal-${state.proposalCalls}-r${record.simplePlan.revision}`)
        state.proposals[record.planningProject.id] = preview
        await reply(route, preview)
        return true
      }
      if (state.applyError) { await reply(route, state.applyError, 409); return true }
      const preview = state.proposals[record.planningProject.id]
      if (!preview || body.proposal_token !== preview.proposal.token || body.revision !== record.simplePlan.revision) {
        await reply(route, { error: 'The proposal no longer matches the current plan.', code: 'simple_plan_revision_conflict' }, 409)
        return true
      }
      record.simplePlan = { ...structuredClone(preview.plan), revision: record.simplePlan.revision + 1 }
      state.persistedProposals.push({ project: record.planningProject.id, revision: record.simplePlan.revision })
      await reply(route, record.simplePlan)
      return true
    },
  })
}
