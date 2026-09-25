import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { generationEvidenceHarness, savedEvidenceGeneration } from '../fixtures/generation-evidence-workspace.fixture.js'
import { fixedNow } from '../fixtures/schedule-performance.fixture.js'
import { expectRetainedScheduleVersion } from '../fixtures/retained-schedule-controls.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

const mode = (page, name) => page.getByRole('navigation', { name: 'Schedule workspace', exact: true }).getByRole('button', { name, exact: true })
const workspace = page => page.getByRole('region', { name: 'Document analysis workspace', exact: true })
const sourceTable = page => page.getByRole('table', { name: 'Activity source evidence', exact: true })
const coverage = page => page.getByRole('region', { name: 'Extraction coverage', exact: true })
const settings = page => page.getByRole('dialog', { name: /^AI Settings \(BYOK\)/ })
const completeAi = { status: 'complete', chunks_total: 2, chunks_processed: 2, chunks_failed: 0,
  chunks_remaining: 0, chunks_skipped: 0, rejected_claim_count: 0, semantic_coverage_verified: false }
const completeText = { status: 'complete', file_count: 1, analyzed_file_count: 1, complete_file_count: 1,
  files: [{ file_id: 801, filename: 'Synthetic analysis source.pdf', status: 'complete', units_total: 2,
    units_processed: 2, unit_type: 'pages', included_in_analysis: true, issues: [] }] }
const failure = (code, next_action, message) => ({ ...completeAi, status: 'partial', chunks_processed: 0,
  chunks_failed: 2, resume_available: true, chunks: [{ status: 'failed', error: { code, next_action, message } }] })

async function harness(page, options = {}) {
  return generationEvidenceHarness(page, {
    query: options.query || 'project=17&view=plan-baseline&scheduleMode=documents&shell=true',
    prepare(state) {
      state.outcomes = [...(options.outcomes || [{}])]
      state.analysisJobs = {}
      state.discoveryJobs = []
      state.liveProgress = null
      state.analysisWorkspaces = {}
      state.analysisSequence = 0
      state.analysisReads = []
      state.analysisReleases = []
      state.runListReleases = []
      state.runListReplies = 0
      state.runListWasHeld = false
      state.holdAnalysis = Boolean(options.holdAnalysis)
      state.workspaceError = options.workspaceError || null
      state.aiCalls = []
      state.packageJobs = {}
      state.packageWorkspaces = {}
      state.aiSettings = { provider: 'anthropic', model: 'fixture-model', enabled: true, key_configured: true,
        encryption_configured: true, provider_choices: [{ value: 'anthropic', label: 'Anthropic (Claude)',
          default_model: 'fixture-model', model_choices: [{ value: 'fixture-model', label: 'Fixture model' }] }] }
      state.records[17].hasSchedule = Boolean(options.oldMaster)
      if (options.noGeneration) state.records[17].generations = []
      options.prepare?.(state)
    },
    async handleRequest({ path, route, state, reply }) {
      const method = route.request().method()
      const send = async (data, status = 200) => { await reply(route, data, status); return true }
      const projectId = path.match(/\/projects\/(\d+)\//)?.[1]
      const record = Object.values(state.records).find(item => String(item.planningProject.id) === projectId) || state.records[17]
      if (path.endsWith('/intelligence-runs/') && method === 'GET' && options.holdInitialRunList && !state.runListWasHeld) {
        state.runListWasHeld = true
        const snapshot = structuredClone(state.records[17].runs)
        await new Promise(resolve => state.runListReleases.push(resolve))
        await reply(route, { count: snapshot.length, next: null, previous: null, results: snapshot })
        state.runListReplies += 1
        return true
      }
      if (path.endsWith('/ai-settings/test/') && method === 'POST') {
        state.aiCalls.push('test')
        return send({ success: true, message: 'Synthetic provider connection verified.' })
      }
      if (path.endsWith('/ai-settings/')) {
        if (method === 'POST') { state.aiCalls.push('save'); Object.assign(state.aiSettings, route.request().postDataJSON()) }
        return send(state.aiSettings)
      }
      if (/\/planning-intelligence\/projects\/\d+\/$/.test(path) && method === 'PATCH') {
        const data = route.request().postDataJSON()
        state.writes.push({ path, method, data })
        Object.assign(record.planningProject, data)
        return send(record.planningProject)
      }
      const resumeRunId = path.match(/\/intelligence-runs\/(\d+)\/resume\/$/)?.[1]
      const detailRunId = path.match(/\/intelligence-runs\/(\d+)\/$/)?.[1]
      if (detailRunId && method === 'GET') {
        const run = Object.values(state.records).flatMap(item => item.runs).find(item => String(item.id) === detailRunId)
        return send(run || { detail: 'Analysis run not found.' }, run ? 200 : 404)
      }
      if (method === 'POST' && (path.endsWith('/analyze/') || resumeRunId)) {
        state.writes.push({ path, method, data: route.request().postDataJSON() })
        const sequence = ++state.analysisSequence
        const job = { id: 3100 + sequence, project: record.planningProject.id, job_type: 'analyze',
          status: 'queued', terminal: false, progress: 0, message: 'Analysis queued.', result_data: {},
          created_at: fixedNow, updated_at: fixedNow }
        state.analysisJobs[job.id] = job
        return send(job, 202)
      }
      const jobId = path.match(/\/jobs\/(\d+)\/$/)?.[1]
      if (method === 'POST' && path.endsWith('/generate/')) {
        const data = route.request().postDataJSON()
        state.writes.push({ path, method, data })
        const runId = data.generation_options?.intelligence_run_id
        const analysis = state.analysisWorkspaces[runId]
        if (!analysis?.activities.length) return send({ error: 'No eligible source deliverables are available for a planning package.' }, 409)
        const versionId = 5000 + runId
        const generationId = 9000 + runId
        const version = { ...record.versions[0], id: versionId, version: 4, status: 'draft', source_generation: generationId }
        const activities = record.workspace.activities.map(row => ({ ...row, version: versionId, name: `Run ${runId} package: ${row.name}` }))
        state.packageWorkspaces[versionId] = { ...structuredClone(record.workspace), version, activities,
          planning_package: { generation_id: generationId, intelligence_run_id: runId, status: 'proposed',
            assumptions: [{ field: 'workflow_durations', message: 'Workflow durations are proposed planning values.' }] } }
        const generation = { ...structuredClone(analysis), id: generationId, version: 4, generation_mode: 'planning_package',
          intelligence_run_id: runId, schedule_id: record.schedule.id, schedule_version_id: versionId,
          activities, logic_matrix: record.workspace.relationships }
        record.generations.unshift(generation)
        record.versions.unshift(version)
        record.hasSchedule = true
        const job = { id: 6000 + runId, project: record.planningProject.id, job_type: 'generate', status: 'succeeded', terminal: true,
          progress: 100, created_at: fixedNow, updated_at: fixedNow, result_generation: generationId,
          result_data: { generation_id: generationId, generation_mode: 'planning_package', intelligence_run_id: runId,
            schedule_id: record.schedule.id, schedule_version_id: versionId, state: 'draft' } }
        state.packageJobs[job.id] = job
        return send(job, 202)
      }
      if (jobId && state.packageJobs[jobId]) return send(state.packageJobs[jobId])
      const versionId = path.match(/\/schedule-versions\/(\d+)\/workspace\/$/)?.[1]
      if (versionId && state.packageWorkspaces[versionId]) return send(state.packageWorkspaces[versionId])
      if (path.endsWith('/jobs/') && method === 'GET') return send({ count: state.discoveryJobs.length, next: null, results: state.discoveryJobs })
      if (jobId && state.analysisJobs[jobId]) {
        const job = state.analysisJobs[jobId]
        if (state.holdAnalysis) await new Promise(resolve => state.analysisReleases.push(resolve))
        if (state.liveProgress && !job.terminal) {
          Object.assign(job, { status: 'running', ...state.liveProgress })
          return send(job)
        }
        if (!job.terminal) {
          const result = state.outcomes.shift() || {}
          if (result.failure) Object.assign(job, { status: 'failed', terminal: true, error_message: result.failure, finished_at: fixedNow })
          else {
            const target = Object.values(state.records).find(item => item.planningProject.id === job.project)
            const runId = 4100 + Number(jobId) - 3100
            const previous = target.runs.find(run => run.status === 'succeeded')
            const intelligence = { ...structuredClone(previous.intelligence), document_intelligence_run_id: runId,
              detected_project_name: `Analyzed source run ${runId}`, processing_coverage: structuredClone(result.text || completeText),
              ai_processing_coverage: structuredClone(result.ai || completeAi), open_conflicts: [] }
            target.facts.forEach(fact => { fact.run = runId })
            target.runs.unshift({ ...structuredClone(previous), id: runId, intelligence, preview_confirmation: null,
              created_at: fixedNow, started_at: fixedNow, finished_at: fixedNow })
            const proposal = savedEvidenceGeneration(target, { id: 9900 + runId, count: result.empty ? 0 : 2,
              prefix: `Fresh analyzed source ${runId}` })
            const payload = { ...proposal }
            delete payload.id
            delete payload.version
            state.analysisWorkspaces[runId] = { ...payload, analysis_run_id: runId, project: target.planningProject.id,
              state: 'analysis_evidence', analysis_completed_at: fixedNow, intelligence: { ...intelligence, schedule_engine: proposal.intelligence.schedule_engine } }
            Object.assign(job, { status: 'succeeded', terminal: true, progress: 100,
              message: 'Analysis findings saved.', result_data: { intelligence }, finished_at: fixedNow })
          }
        }
        return send(job)
      }
      const workspaceRunId = path.match(/\/intelligence-runs\/(\d+)\/schedule-workspace\/$/)?.[1]
      if (workspaceRunId) {
        state.analysisReads.push(Number(workspaceRunId))
        if (state.workspaceError) return send(state.workspaceError.body, state.workspaceError.status)
        return send(state.analysisWorkspaces[workspaceRunId] || { detail: 'Analysis workspace not found.' }, state.analysisWorkspaces[workspaceRunId] ? 200 : 404)
      }
      return false
    },
  })
}

async function analyze(page) {
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Run Document Intelligence', exact: true }).click()
}

async function expectPackage(page, runId = 4101) {
  await expect(mode(page, 'Master Schedule')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Schedule settings', exact: true })).toContainText('Version 4')
  await expectRetainedScheduleVersion(page, 5000 + runId)
  await page.getByRole('button', { name: 'Flat activities', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'PIP-014 activity name', exact: true })).toHaveValue(`Run ${runId} package: Piping isometrics package`)
  await expect(page.getByRole('textbox', { name: 'PIP-014 activity name', exact: true })).toBeEditable()
}

async function reviewSource(page, runId = 4101, { empty = false } = {}) {
  if (empty) await expect(page.getByRole('alert').filter({ hasText: 'No eligible source deliverables' })).toBeVisible()
  else await expectPackage(page, runId)
  if (await mode(page, 'Document Intelligence').getAttribute('aria-pressed') !== 'true') await mode(page, 'Document Intelligence').click()
  await page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true }).getByRole('button', { name: /^2\. Document Intelligence/ }).click()
  await page.getByRole('button', { name: 'Review extracted source', exact: true }).click()
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unexpectedWrites).toEqual([])
  expect(state.requests.filter(row => row.method !== 'GET' && !/\/projects\/\d+\/(?:analyze\/|ai-settings\/(?:test\/)?)?$/.test(row.path)
    && !/\/intelligence-runs\/\d+\/resume\/$/.test(row.path) && !/\/projects\/\d+\/generate\/$/.test(row.path))).toEqual([])
}

test('completed analysis opens its exact editable package and explicit source review retains literal evidence', async ({ page }) => {
  const state = await harness(page, { oldMaster: true })
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await analyze(page)
  await expectPackage(page)
  expect(state.writes.filter(row => row.path.endsWith('/generate/'))).toEqual([{ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/generate/',
    data: { generation_options: { mode: 'planning_package', intelligence_run_id: 4101 } } }])
  await reviewSource(page)
  await expect(workspace(page)).toBeVisible()
  await expect(workspace(page).getByRole('heading', { name: 'Document analysis #4101', exact: true })).toBeVisible()
  await expect(sourceTable(page)).toContainText('Fresh analyzed source 4101 001')
  await expect(sourceTable(page)).not.toContainText('Saved source activity')
  await expect(coverage(page)).toContainText('2 of 2 chunks processed')
  await expect(page.getByRole('button', { name: 'Export schedule', exact: true })).toBeDisabled()
  await expect(page.locator('header.pd-header .pd-report-date')).toContainText('Not set')
  const plannerTabs = workspace(page).getByRole('navigation', { name: 'Planning workspace areas', exact: true })
  await expect(plannerTabs.getByRole('button')).toHaveText(['Activities & Gantt', 'WBS', 'Logic', 'Evidence'])
  await expect(workspace(page)).toContainText('Evidence draft')
  await expect(sourceTable(page)).toContainText('Not Specified')
  await expect(workspace(page)).toContainText('Gantt dates are not calculated.')
  await expect(workspace(page).getByRole('button', { name: /Recalculate CPM|Save & Calculate|Approve|Publish baseline/ })).toHaveCount(0)
  const writesBeforeTabs = state.requests.filter(row => row.method !== 'GET').length
  for (const [label, content] of [['WBS', 'Source scope package'], ['Logic', 'No schedule relationships are mapped. Review source dependency findings before calculation.'], ['Evidence', 'Source durations are Not Specified.']]) {
    const button = plannerTabs.getByRole('button', { name: label, exact: true })
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-current', 'page')
    await expect(workspace(page)).toContainText(content)
    await expect(workspace(page).getByRole('heading', { name: 'Document analysis #4101', exact: true })).toBeVisible()
  }
  await plannerTabs.getByRole('button', { name: 'Activities & Gantt', exact: true }).click()
  await expect(sourceTable(page)).toContainText('Fresh analyzed source 4101 001')
  expect(state.requests.filter(row => row.method !== 'GET')).toHaveLength(writesBeforeTabs)
  for (const [label, viewport] of [['desktop', { width: 1672, height: 941 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const scan = await new AxeBuilder({ page }).include('.generation-evidence-workspace').analyze()
    expect(scan.violations.filter(issue => ['serious', 'critical'].includes(issue.impact))).toEqual([])
    await page.screenshot({ path: `../artifacts/analysis-workspace-${label}.png`, fullPage: true, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1672, height: 941 })
  await mode(page, 'Document Intelligence').click()
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm & save preview', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Review extracted source', exact: true }).click()
  await expect(workspace(page)).toBeVisible()
  expect(state.analysisReads.every(id => id === 4101)).toBe(true)
  expect(state.writes.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  clean(state)
})

test('direct Master entry recovers the server analysis and creates only its exact planning package without reanalysis', async ({ page }) => {
  const state = await harness(page, {
    query: 'project=17&view=plan-baseline&scheduleMode=planner&shell=true', oldMaster: true,
    prepare(current) {
      const external = { id: 3101, project: 71, job_type: 'analyze', status: 'running', terminal: false,
        progress: 79, message: 'AI source section 51 of 61: 50 processed, 0 failed.', result_data: {},
        created_at: fixedNow, updated_at: fixedNow }
      current.analysisJobs[external.id] = external
      current.discoveryJobs = [external]
      current.liveProgress = { progress: external.progress, message: external.message }
    },
  })
  await expect(mode(page, 'Master Schedule')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true })).toHaveCount(0)
  await expect(page.locator('#project-document-planning-inputs-form')).toHaveCount(1)
  await expect(page.locator('#project-document-planning-inputs-form')).toBeHidden()
  await expect.poll(() => state.requests.some(row => row.path.endsWith('/jobs/3101/'))).toBe(true)
  expect(state.analysisReads).toEqual([])
  expect(state.requests.filter(row => row.method !== 'GET')).toEqual([])
  state.liveProgress = null
  await expectPackage(page)
  expect(state.writes).toEqual([{ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/generate/',
    data: { generation_options: { mode: 'planning_package', intelligence_run_id: 4101 } } }])
  await reviewSource(page)
  await expect(workspace(page).getByRole('heading', { name: 'Document analysis #4101', exact: true })).toBeVisible()
  await expect(sourceTable(page)).toContainText('Fresh analyzed source 4101 001')
  await expect(mode(page, 'Master Schedule')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Export schedule', exact: true })).toBeDisabled()
  await expect(page.locator('header.pd-header .pd-report-date')).toContainText('Not set')
  await expect(page.locator('#project-document-planning-inputs-form')).toHaveCount(1)
  expect(state.analysisReads.length).toBeGreaterThan(0)
  expect(state.analysisReads.every(id => id === 4101)).toBe(true)
  expect(state.requests.filter(row => row.method !== 'GET')).toHaveLength(1)
  clean(state)
})

test('direct Master entry without a linked planning project keeps document monitoring read-only and inactive', async ({ page }) => {
  const state = await harness(page, {
    query: 'project=17&view=plan-baseline&scheduleMode=planner&shell=true',
    prepare(current) { current.missingPlanning.add(17) },
  })
  await expect(mode(page, 'Master Schedule')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Set up project inputs to create a schedule workspace.', { exact: true })).toBeVisible()
  await expect(page.locator('#project-document-planning-inputs-form')).toHaveCount(1)
  await expect(page.locator('#project-document-planning-inputs-form')).toBeHidden()
  expect(state.requests.filter(row => row.path.endsWith('/jobs/'))).toEqual([])
  expect(state.requests.filter(row => row.method !== 'GET')).toEqual([])
  expect(state.writes).toEqual([])
  clean(state)
})

test('a new server-side analysis is recovered on focus after a prior result and opens the exact planner without a second analysis POST', async ({ page }) => {
  const diagnostic = failure('output_limit', 'retry_analysis', 'The saved provider response exceeded its output limit.')
  const parsed125 = { ...structuredClone(completeText), files: [{ ...completeText.files[0], units_processed: 125, units_total: 125 }] }
  const state = await harness(page, { outcomes: [{ ai: diagnostic, text: parsed125, empty: true }, {}] })
  await analyze(page)
  await reviewSource(page, 4101, { empty: true })
  await expect(workspace(page)).toBeVisible()
  await workspace(page).getByRole('button', { name: 'Review source evidence', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Document analysis needs attention: AI analysis failed.' })).toBeVisible()
  const external = { id: 3102, project: 71, job_type: 'analyze', status: 'running', terminal: false,
    progress: 24, message: 'AI source section 8 of 61: 7 processed, 0 failed.', result_data: {}, created_at: fixedNow, updated_at: fixedNow }
  state.analysisJobs[external.id] = external
  state.discoveryJobs = [{ ...external, id: 3199, status: 'succeeded', terminal: true },
    { ...external, id: 3200, project: 72 }, external]
  state.liveProgress = { progress: 24, message: external.message }
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('status').filter({ hasText: external.message })).toBeVisible()
  await expect(coverage(page)).toContainText('Previous saved analysis')
  await expect(coverage(page)).toContainText('Previous AI analysis coverage: Failed; 0 of 2 chunks processed')
  await expect(coverage(page)).toContainText('These counts and diagnostics do not describe the analysis currently being monitored.')
  await expect(coverage(page)).toContainText('Reading every document page completes text extraction, not AI analysis.')
  await expect(page.getByRole('status').filter({ hasText: /^Document analysis needs attention: AI analysis failed\./ })).toHaveCount(0)
  await coverage(page).locator('summary').click()
  await expect(coverage(page)).toContainText('125 / 125 pages')
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  expect(state.writes.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  await mode(page, 'Master Schedule').click()
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(coverage(page)).toContainText('Previous AI analysis coverage: Failed; 0 of 2 chunks processed')
  await expect(sourceTable(page)).toBeHidden()
  expect(state.writes.filter(row => row.path.endsWith('/generate/'))).toHaveLength(1)
  state.liveProgress = null
  await reviewSource(page, 4102)
  await expect(workspace(page).getByRole('heading', { name: 'Document analysis #4102', exact: true })).toBeVisible()
  await expect(workspace(page).getByRole('navigation', { name: 'Planning workspace areas' })).toBeVisible()
  await expect(sourceTable(page)).toContainText('Fresh analyzed source 4102 001')
  await expect(coverage(page)).toContainText('AI analysis coverage: All stored text chunks processed; 2 of 2 chunks processed')
  expect(state.writes.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  expect(state.analysisReads.every(id => [4101, 4102].includes(id))).toBe(true)
  clean(state)
})

test('completed analysis explains a deferred planner handoff while AI Settings stays open then opens after closing', async ({ page }) => {
  const state = await harness(page, { holdAnalysis: true })
  await analyze(page)
  await expect.poll(() => state.analysisReleases.length).toBe(1)
  await page.getByRole('button', { name: 'AI settings', exact: true }).click()
  await expect(settings(page)).toBeVisible()
  state.holdAnalysis = false
  state.analysisReleases.splice(0).forEach(release => release())
  await expect(settings(page)).toContainText('Analysis findings are saved. Close AI Settings to open the Schedule Planner.')
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  expect(state.analysisReads).toEqual([])
  await settings(page).getByRole('button', { name: 'Close', exact: true }).click()
  await reviewSource(page)
  await expect(workspace(page).getByRole('heading', { name: 'Document analysis #4101', exact: true })).toBeVisible()
  expect(state.writes.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  expect(state.aiCalls).toEqual([])
  clean(state)
})

test('no eligible source activities blocks package generation and explicit review opens honest empty evidence', async ({ page }) => {
  const state = await harness(page, { noGeneration: true, outcomes: [{ empty: true }] })
  await analyze(page)
  await reviewSource(page, 4101, { empty: true })
  await expect(workspace(page)).toBeVisible()
  await expect(workspace(page)).toContainText('0 activities')
  await expect(workspace(page)).not.toContainText('Saved source activity')
  await expect(sourceTable(page)).toContainText('No schedule activities were extracted from this analysis.')
  await expect(sourceTable(page)).not.toContainText('AI analysis failed')
  await expect(sourceTable(page)).not.toContainText('No document source references')
  await expect(sourceTable(page)).not.toContainText('Activities may be created directly from project scope')
  await expect(workspace(page).getByRole('button', { name: 'Review source evidence', exact: true })).toBeEnabled()
  expect(state.records[17].generations).toHaveLength(0)
  clean(state)
})

test('six failed output-limited AI chunks retain 876 source facts without inventing activities and explicit retry opens new findings', async ({ page }) => {
  const diagnostic = { code: 'output_limit', next_action: 'retry_analysis', message: 'The provider response reached its output limit.' }
  const failedAi = { ...completeAi, status: 'partial', chunks_total: 6, chunks_processed: 0,
    chunks_failed: 6, resume_available: true, chunks: Array.from({ length: 6 }, (_, index) => ({
      chunk_id: `synthetic-chunk-${index + 1}`, status: 'failed', error: diagnostic,
    })) }
  const state = await harness(page, { noGeneration: true, outcomes: [{ empty: true, ai: failedAi }, {}],
    prepare(current) {
      const record = current.records[17]
      const template = record.facts[0]
      record.facts = Array.from({ length: 876 }, (_, index) => ({ ...structuredClone(template), id: 10000 + index }))
      const run = record.runs.find(item => item.status === 'succeeded')
      run.fact_count = record.facts.length
      run.intelligence.evidence_summary = { ...run.intelligence.evidence_summary, fact_count: record.facts.length }
    },
  })
  await analyze(page)
  await reviewSource(page, 4101, { empty: true })
  await expect(workspace(page)).toBeVisible()
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 6 chunks processed, 0 skipped, 6 failed.')
  await expect(sourceTable(page)).toContainText('No schedule activities were extracted from this analysis. AI analysis failed.')
  await expect(sourceTable(page)).toContainText('876 source facts remain available for review; facts are not schedule activities.')
  await expect(sourceTable(page)).not.toContainText('No document source references')
  await expect(sourceTable(page)).not.toContainText('Activities may be created directly from project scope')
  await expect(coverage(page)).toContainText('Retry document analysis to process failed or remaining source sections in smaller parts.')
  await expect(coverage(page)).not.toContainText('Review AI settings')
  await expect(page.getByRole('button', { name: 'Export schedule', exact: true })).toBeDisabled()
  expect(state.records[17].generations).toHaveLength(0)
  for (const [label, viewport] of [['desktop', { width: 1672, height: 941 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const scan = await new AxeBuilder({ page }).include('.generation-evidence-workspace').analyze()
    expect(scan.violations.filter(issue => ['serious', 'critical'].includes(issue.impact))).toEqual([])
    await page.screenshot({ path: `../artifacts/analysis-empty-failed-${label}.png`, fullPage: true, animations: 'disabled' })
    const emptyTableLayout = await sourceTable(page).evaluate(table => ({ tableWidth: table.getBoundingClientRect().width,
      minWidth: getComputedStyle(table).minWidth, scrollWidth: table.parentElement.scrollWidth, clientWidth: table.parentElement.clientWidth }))
    expect(emptyTableLayout.scrollWidth, JSON.stringify(emptyTableLayout)).toBeLessThanOrEqual(emptyTableLayout.clientWidth + 1)
  }
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await reviewSource(page, 4102)
  await expect(workspace(page).getByRole('heading', { name: 'Document analysis #4102', exact: true })).toBeVisible()
  await expect(sourceTable(page)).toContainText('Fresh analyzed source 4102 001')
  await expect(sourceTable(page)).not.toContainText('No schedule activities were extracted')
  await expect(coverage(page)).toContainText('2 of 2 chunks processed')
  expect(state.records[17].runs.find(run => run.id === 4101).intelligence.ai_processing_coverage.chunks_failed).toBe(6)
  expect(state.records[17].facts).toHaveLength(876)
  expect(state.writes.filter(row => row.path.endsWith('/intelligence-runs/4101/resume/'))).toHaveLength(1)
  expect(state.writes.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  expect(state.aiCalls).toEqual([])
  clean(state)
})

test('partial AI analysis with no activity proposals and no fact count uses an honest unknown-count message', async ({ page }) => {
  const state = await harness(page, { outcomes: [{ empty: true, ai: { ...failure('provider_timeout', 'retry_analysis', 'The provider request timed out.'),
    chunks_processed: 1, chunks_failed: 1 } }],
    prepare(current) { delete current.records[17].runs.find(run => run.status === 'succeeded').intelligence.evidence_summary },
  })
  await analyze(page)
  await reviewSource(page, 4101, { empty: true })
  await expect(workspace(page)).toBeVisible()
  await expect(sourceTable(page)).toContainText('No schedule activities were extracted from this analysis. AI analysis is incomplete.')
  await expect(sourceTable(page)).toContainText('Review the saved source findings and missing planning inputs.')
  await expect(sourceTable(page)).not.toContainText('source facts remain')
  await expect(sourceTable(page)).not.toContainText('AI analysis failed')
  await expect(coverage(page)).toContainText('AI analysis coverage: Partial; 1 of 2 chunks processed')
  clean(state)
})

test('a verified BYOK connection does not erase a later provider analysis failure and explicit retry opens the new run', async ({ page }) => {
  const diagnostic = 'The provider returned no usable analysis. Retry document analysis.'
  const state = await harness(page, { outcomes: [{ ai: failure('empty_response', 'retry_analysis', diagnostic) }, {}] })
  await page.getByRole('button', { name: 'AI settings', exact: true }).click()
  await expect(settings(page).getByRole('button', { name: 'Save Settings', exact: true })).toBeEnabled()
  await settings(page).getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect(settings(page)).toContainText('AI is ready for analysis.')
  await settings(page).getByRole('button', { name: 'Close', exact: true }).click()
  expect(state.aiCalls).toEqual(['save', 'test'])
  await analyze(page)
  await reviewSource(page)
  await expect(workspace(page)).toBeVisible()
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed')
  await expect(coverage(page)).toContainText(diagnostic)
  await expect(coverage(page)).not.toContainText('Review AI settings')
  await expect(coverage(page)).not.toContainText('key')
  await expect(sourceTable(page)).toContainText('Fresh analyzed source 4101 001')
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await reviewSource(page, 4102)
  await expect(workspace(page).getByRole('heading', { name: 'Document analysis #4102', exact: true })).toBeVisible()
  await expect(coverage(page)).toContainText('2 of 2 chunks processed')
  expect(state.writes.filter(row => row.path.endsWith('/intelligence-runs/4101/resume/'))).toHaveLength(1)
  expect(state.writes.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  expect(state.aiCalls).toEqual(['save', 'test'])
  clean(state)
})

test('an authentication failure keeps source evidence and routes to actual AI settings without starting another analysis', async ({ page }) => {
  const state = await harness(page, { outcomes: [{ ai: failure('authentication_failed', 'ai_settings', 'The provider rejected authentication. Review AI settings.') }] })
  await analyze(page)
  await reviewSource(page)
  await expect(workspace(page)).toBeVisible()
  await coverage(page).getByRole('button', { name: 'Review AI settings', exact: true }).click()
  await expect(settings(page)).toBeVisible()
  await expect(settings(page)).toContainText('key configured')
  expect(state.aiCalls).toEqual([])
  await settings(page).getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(settings(page)).toContainText('The connection test passed. The previous document analysis is still incomplete; retry it with these saved settings.')
  await settings(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed')
  expect(state.aiCalls).toEqual(['test'])
  expect(state.writes.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  clean(state)
})

test('a hard analysis job failure stays in Document Intelligence and preserves the previous saved findings', async ({ page }) => {
  const state = await harness(page, { outcomes: [{ failure: 'The analysis worker could not complete the request. Retry document analysis.' }] })
  await analyze(page)
  await expect(page.getByRole('alert').filter({ hasText: 'The analysis worker could not complete the request.' })).toBeVisible()
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(workspace(page)).toHaveCount(0)
  expect(state.analysisReads).toEqual([])
  expect(state.records[17].runs.some(run => run.id === 901)).toBe(true)
  clean(state)
})

for (const status of [403, 409]) test(`analysis workspace ${status} does not fall back to an older generation and recovers through a read-only retry`, async ({ page }) => {
  const detail = status === 403 ? 'This account cannot read this analysis.' : 'Source files changed. Refresh this analysis workspace.'
  const state = await harness(page, { oldMaster: true, workspaceError: { status, body: { detail, code: status === 409 ? 'intelligence_workspace_sources_changed' : 'permission_denied' } } })
  await analyze(page)
  await reviewSource(page)
  await expect(page.getByRole('alert').filter({ hasText: detail })).toBeVisible()
  await expect(sourceTable(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Export schedule', exact: true })).toBeDisabled()
  const writesBeforeRetry = state.requests.filter(row => row.method !== 'GET').length
  state.workspaceError = null
  await page.getByRole('button', { name: 'Retry workspace', exact: true }).click()
  await expect(workspace(page)).toBeVisible()
  await expect(sourceTable(page)).toContainText('Fresh analyzed source 4101 001')
  expect(state.requests.filter(row => row.method !== 'GET')).toHaveLength(writesBeforeRetry)
  clean(state)
})

test('a late analysis completion cannot open its workspace after switching enterprise projects', async ({ page }) => {
  const state = await harness(page, { holdAnalysis: true })
  await analyze(page)
  await expect.poll(() => state.analysisReleases.length).toBeGreaterThan(0)
  const header = page.locator('header.pd-header')
  await header.locator('summary[aria-label="More project actions"]').click()
  await header.getByRole('combobox', { name: 'Active Project', exact: true }).fill('Grid Power')
  await header.getByRole('option').filter({ hasText: state.records[18].project.name }).click()
  await expect(header.getByRole('heading', { level: 1 })).toHaveText(state.records[18].project.name)
  state.holdAnalysis = false
  state.analysisReleases.splice(0).forEach(release => release())
  await expect.poll(() => state.analysisJobs[3101].status).toBe('succeeded')
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(workspace(page)).toHaveCount(0)
  expect(state.analysisReads).toEqual([])
  clean(state)
})

test('unsaved preview edits defer package handoff and cancelling preserves the exact saved analysis', async ({ page }) => {
  const state = await harness(page)
  await analyze(page)
  await reviewSource(page)
  await expect(workspace(page)).toBeVisible()
  await mode(page, 'Document Intelligence').click()
  const preview = page.locator('.pln-intelligence-preview')
  await preview.getByRole('button', { name: /Edit$/ }).click()
  await preview.locator('input[type="text"]').first().fill('Unsaved preview title to discard')
  const exact = state.records[17].runs.find(run => run.id === 4101)
  state.records[17].runs.unshift({ ...structuredClone(exact), id: 4901,
    intelligence: { ...structuredClone(exact.intelligence), document_intelligence_run_id: 4901, detected_project_name: 'Different newer saved analysis' } })
  await mode(page, 'Master Schedule').click()
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(preview.locator('input[type="text"]').first()).toHaveValue('Unsaved preview title to discard')
  expect(state.writes.filter(row => row.path.endsWith('/generate/'))).toHaveLength(1)
  await preview.getByRole('button', { name: 'Cancel', exact: true }).click()
  await reviewSource(page)
  await workspace(page).getByRole('button', { name: 'Review source evidence', exact: true }).click()
  await expect(preview).toContainText('Run #4101')
  await expect(preview).toContainText('Analyzed source run 4101')
  await expect(preview).not.toContainText('Unsaved preview title to discard')
  await expect(preview).not.toContainText('Different newer saved analysis')
  await expect(page.getByRole('button', { name: 'Open schedule workspace', exact: true })).toBeEnabled()
  clean(state)
})

test('a delayed latest-analysis read cannot overwrite the exact newly completed analysis', async ({ page }) => {
  const state = await harness(page, { holdInitialRunList: true })
  await expect.poll(() => state.runListReleases.length).toBe(1)
  const run = page.getByRole('button', { name: 'Run Document Intelligence', exact: true })
  await expect(run).toBeEnabled()
  await run.click()
  await reviewSource(page)
  await expect(workspace(page)).toBeVisible()
  await mode(page, 'Document Intelligence').click()
  await expect(page.locator('.pln-intelligence-preview')).toContainText('Run #4101')
  state.runListReleases.splice(0).forEach(release => release())
  await expect.poll(() => state.runListReplies).toBe(1)
  await expect(page.locator('.pln-intelligence-preview')).toContainText('Run #4101')
  await expect(page.locator('.pln-intelligence-preview')).toContainText('Analyzed source run 4101')
  await expect(page.locator('.pln-intelligence-preview')).not.toContainText('Run #901')
  clean(state)
})
