import { planningInputsHarness, populatePlanningEvidence, confirmPlanningEvidence } from './planning-inputs.fixture.js'
import { fixedNow, pageOf } from './schedule-performance.fixture.js'

export function savedEvidenceGeneration(record, { id = 1701, version = 3, count = 78, prefix = 'Saved source activity' } = {}) {
  const activities = Array.from({ length: count }, (_, index) => ({
    id: `source-${id}-${index + 1}`, activity_code: `SRC-${String(index + 1).padStart(3, '0')}`,
    name: `${prefix} ${String(index + 1).padStart(3, '0')}`, discipline: 'not_specified', wbs_code: '1.1',
    original_duration_days: null, duration_unit: null, start_date: null, finish_date: null,
    total_float_days: null, is_critical: null, predecessors: [],
    source_references: [{ file_id: 801, filename: 'Synthetic scope register.pdf',
      locator: { page: 8, line: index + 101 }, excerpt: `Literal register entry ${index + 1}.` }],
  }))
  const validation = [{ rule: 'source_duration', severity: 'critical', message: 'Source durations are Not Specified.' },
    { rule: 'register_title_boundary_ambiguous', severity: 'error', message: 'Two register titles require source boundary review.' }]
  return {
    id, project: record.planningProject.id, version, created_at: fixedNow, updated_at: fixedNow,
    wbs: [{ code: '1', name: record.planningProject.name, level: 0 }, { code: '1.1', parent_code: '1', name: 'Source scope package', level: 1 }],
    activities, logic_matrix: [], eddr: [], manhours: {}, validation,
    narrative: 'Saved source proposal. Timing and dependency information require review.',
    intelligence: { ...structuredClone(record.runs.find(run => run.status === 'succeeded')?.intelligence || {}),
      schedule_engine: { policy: 'document_driven', ready_for_calculation: false,
        register_inventory: [{ id: 'uncertain-1', title: 'Uncertain register title A', schedule_activity_ids: [], source_references: activities[0]?.source_references || [] },
        { id: 'uncertain-2', title: 'Uncertain register title B', schedule_activity_ids: [], source_references: activities[0]?.source_references || [] }] },
    },
    missing_information: activities.map(activity => ({ activity_id: activity.id, missing_fields: ['duration', 'calendar', 'dependencies'] })),
  }
}

// Every API call is intercepted. Opening a saved draft is read-only; commands
// below are simulations used only when a test explicitly clicks an action.
export async function generationEvidenceHarness(page, options = {}) {
  return planningInputsHarness(page, {
    query: options.query || 'project=17&view=plan-baseline&shell=true',
    harnessPath: '/tests/fixtures/project-performance-harness.jsx',
    prepare(state) {
      Object.assign(state, { generationErrors: {}, heldGenerations: new Set(), generationReleases: [],
        materializeMode: 'review', materializeVersionId: 90, unexpectedWrites: [], workflowJobs: {},
        addNewerGenerationAfterGenerate: false, foreignGeneration: false, heldResolver: false, resolverReleases: [] })
      for (const record of Object.values(state.records)) {
        populatePlanningEvidence(record)
        confirmPlanningEvidence(record)
        record.hasSchedule = false
        record.generations = [savedEvidenceGeneration(record, record.project.id === 18
          ? { id: 2701, version: 2, count: 3, prefix: 'Grid source activity' } : {})]
      }
      options.prepare?.(state)
    },
    async handleRequest(context) {
      if (await options.handleRequest?.(context)) return true
      const { path, url, route, state, reply, record: inferred } = context
      const method = route.request().method()
      const planningId = path.match(/\/planning-intelligence\/projects\/(\d+)\//)?.[1] || url.searchParams.get('project')
      const record = Object.values(state.records).find(item => String(item.planningProject.id) === planningId) || inferred
      const send = async (data, status = 200) => { await reply(route, data, status); return true }
      if (path.endsWith('/planning-intelligence/projects/') && method === 'GET' && url.searchParams.has('enterprise_project') && state.heldResolver) {
        await new Promise(resolve => state.resolverReleases.push(resolve))
        return false
      }
      if (path.endsWith('/planning-intelligence/schedules/')) return send(pageOf(record.hasSchedule ? [record.schedule] : []))
      if (path.endsWith('/generations/')) {
        if (state.generationListError) return send({ detail: state.generationListError }, 503)
        return send(pageOf(record.generations.map(row => ({
          id: row.id, project: row.project, version: row.version, created_at: row.created_at,
          activity_count: row.activities.length, wbs_count: row.wbs.length,
        }))))
      }
      const editId = path.match(/\/generations\/(\d+)\/edit\/$/)?.[1]
      if (editId && method === 'PATCH') {
        const target = Object.values(state.records).find(item => item.generations.some(row => String(row.id) === editId))
        const previous = target?.generations.find(row => String(row.id) === editId)
        const data = route.request().postDataJSON()
        state.writes.push({ path, method, data })
        if (state.editError) return send({ error: state.editError }, 503)
        if (!previous) return send({ detail: 'Saved generation not found.' }, 404)
        const revision = { ...structuredClone(previous), ...data, id: 1704, version: previous.version + 1,
          parent_generation: previous.id, schedule_version_id: null, materialization_issues: previous.validation }
        target.generations.unshift(revision)
        return send(revision)
      }
      const generationId = path.match(/\/generations\/(\d+)\/(?:materialize\/)?$/)?.[1]
      if (generationId) {
        const target = Object.values(state.records).find(item => item.generations.some(row => String(row.id) === generationId))
        const generation = target?.generations.find(row => String(row.id) === generationId)
        if (!generation) return send({ detail: 'Saved generation not found.' }, 404)
        if (method === 'POST' && path.endsWith('/materialize/')) {
          state.writes.push({ path, method, generationId: Number(generationId) })
          if (state.materializeMode === 'failure') return send({ detail: 'The saved generation could not be validated.' }, 503)
          if (state.materializeMode === 'review') return send({ generation_id: generation.id, state: 'needs_evidence_review',
            schedule_id: null, schedule_version_id: null, calculation_run_id: null, issues: generation.validation })
          target.hasSchedule = true
          return send({ generation_id: generation.id, state: 'calculated', schedule_id: target.schedule.id,
            schedule_version_id: state.materializeVersionId, calculation_run_id: 701, issues: [] })
        }
        if (method === 'GET') {
          if (state.heldGenerations.has(Number(generationId))) await new Promise(resolve => state.generationReleases.push(resolve))
          const failure = state.generationErrors[generationId]
          if (failure) return send({ detail: failure.message }, failure.status)
          return send(state.foreignGeneration ? { ...generation, project: state.records[18].planningProject.id } : generation)
        }
      }
      if (path.endsWith('/generation-plans/')) return send(pageOf([]))
      if (path.endsWith('/schedule-configurations/')) return send(pageOf([{ id: 1401, project: record.planningProject.id, configuration_version: 3 }]))
      if (method === 'POST' && (path.endsWith('/generation-preview/') || path.endsWith('/generate/'))) {
        const generating = path.endsWith('/generate/')
        state.writes.push({ path, method, data: route.request().postDataJSON() })
        const id = generating ? 1802 : 1801
        const job = { id, project: record.planningProject.id, job_type: generating ? 'generate' : 'preview',
          status: 'succeeded', terminal: true, progress: 100, created_at: fixedNow, updated_at: fixedNow }
        if (generating) {
          const generation = savedEvidenceGeneration(record, { id: 1702, version: 4, count: 3, prefix: 'Exact generated evidence' })
          record.generations.unshift(generation)
          if (state.addNewerGenerationAfterGenerate) record.generations.unshift(savedEvidenceGeneration(record,
            { id: 1703, version: 5, count: 1, prefix: 'Different newer generation' }))
          Object.assign(job, { result_generation: generation.id, result_data: {
            generation_id: generation.id, schedule_version_id: null, schedule_id: null, state: 'needs_evidence_review',
          } })
        } else job.result_data = { preview: { wbs_node_count: 2, deliverable_count: 3, activity_count: 3,
          relationship_count: 0, milestone_count: 0, configured_workflow_activity_count: 0,
          sample_activities: record.generations[0].activities.slice(0, 3), validation: record.generations[0].validation,
          missing_information: record.generations[0].missing_information.slice(0, 3), sample_logic_matrix: [],
        } }
        state.workflowJobs[id] = job
        return send(job, 202)
      }
      const jobId = path.match(/\/jobs\/(\d+)\/$/)?.[1]
      if (jobId && state.workflowJobs[jobId]) return send(state.workflowJobs[jobId])
      if (!['GET', 'OPTIONS'].includes(method)) {
        state.unexpectedWrites.push({ path, method })
        return send({ detail: 'Unexpected mutation blocked by the evidence workspace fixture.' }, 405)
      }
      return false
    },
  })
}
