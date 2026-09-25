import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { planningInputsHarness, populatePlanningEvidence } from '../fixtures/planning-inputs.fixture.js'
import { fixedNow, pageOf } from '../fixtures/schedule-performance.fixture.js'
import { expectRetainedScheduleVersion, selectRetainedScheduleVersion } from '../fixtures/retained-schedule-controls.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })
const mode = (page, name) => page.getByRole('navigation', { name: 'Schedule workspace', exact: true }).getByRole('button', { name, exact: true })
const area = (page, name) => page.getByRole('navigation', { name: 'Planning workspace areas', exact: true }).getByRole('button', { name, exact: true })
const settings = page => page.getByRole('dialog', { name: /^AI Settings \(BYOK\)/ })
const activityName = page => page.getByRole('textbox', { name: 'PIP-014 activity name', exact: true })

async function harness(page, options = {}) {
  return planningInputsHarness(page, {
    harnessPath: '/tests/fixtures/project-performance-harness.jsx',
    query: options.query || 'project=17&view=plan-baseline&scheduleMode=documents&shell=true',
    prepare(state) {
      state.packageJobs = {}; state.packages = {}; state.packageWorkspaces = {}; state.packageWrites = []
      state.analysisReleases = []; state.packageReleases = []
      state.holdAnalysis = Boolean(options.holdAnalysis); state.holdPackage = Boolean(options.holdPackage)
      state.packageError = options.packageError || null
      state.identityMismatch = options.identityMismatch || null
      state.initialFacts = {}
      for (const record of Object.values(state.records)) {
        populatePlanningEvidence(record)
        record.masterVersionId = record.versions[1].id
        const intelligence = record.runs.find(run => run.status === 'succeeded').intelligence
        intelligence.ai_processing_coverage = { status: 'complete', chunks_processed: 2, chunks_total: 2, chunks_failed: 0 }
        intelligence.ai_review.review_summary = Array.from({ length: 63 }, (_, i) => `Synthetic source section ${i + 1}: retain its review findings.`).join('\n')
        state.initialFacts[record.project.id] = JSON.stringify(record.facts)
      }
      options.prepare?.(state)
    },
    async handleRequest({ path, route, state, reply, record }) {
      const method = route.request().method()
      const send = async (data, status = 200) => { await reply(route, data, status); return true }
      const owner = Object.values(state.records).find(row => String(row.planningProject.id) === path.match(/\/projects\/(\d+)\//)?.[1]) || record
      if (path.endsWith('/jobs/')) return send(pageOf([]))
      if (path.endsWith('/analyze/') && method === 'POST') {
        state.packageWrites.push({ path, method })
        const job = { id: 501, project: owner.planningProject.id, job_type: 'analyze', status: 'running', progress: 20, message: 'Analyzing saved source documents.', terminal: false, created_at: fixedNow, updated_at: fixedNow }
        state.packageJobs[job.id] = job
        return send(job, 202)
      }
      if ((path.endsWith('/generate/') || path.endsWith('/generation-preview/')) && method === 'POST') {
        const body = route.request().postDataJSON()
        state.packageWrites.push({ path, method, body })
        if (state.packageError) return send(state.packageError.body, state.packageError.status)
        if (state.holdPackage) await new Promise(resolve => state.packageReleases.push(resolve))
        const runId = body.generation_options?.intelligence_run_id
        const run = owner.runs.find(row => String(row.id) === String(runId))
        if (!run) return send({ error: 'Saved analysis not found.' }, 404)
        const versionId = owner.project.id === 17 ? 99 : 199
        const version = { ...owner.versions[0], id: versionId, version: 4, status: 'draft', source_generation: 1702 }
        const activities = owner.workspace.activities.map(row => ({ ...row, version: versionId, name: `Package: ${row.name}` }))
        const data = { ...structuredClone(owner.workspace), version, activities, planning_package: {
          generation_id: 1702, intelligence_run_id: runId, project_start: '2026-09-25', contractual_finish: '2026-12-20', status: 'proposed',
          calendar: { name: 'Proposed package calendar', working_weekdays: [0, 1, 2, 3, 4], hours_per_day: 8 },
          assumptions: [{ field: 'workflow_durations', message: 'Workflow durations are proposed planning values.' }],
        } }
        const generation = { id: 1702, project: owner.planningProject.id, version: 4, generation_mode: 'planning_package',
          intelligence_run_id: runId, schedule_id: owner.schedule.id, schedule_version_id: versionId,
          intelligence: { ...structuredClone(run.intelligence), schedule_engine: { policy: 'planning_package', source_analysis_run_id: runId } },
          activities, wbs: data.wbs, logic_matrix: data.relationships, eddr: [], manhours: {}, validation: [], narrative: 'Synthetic proposed planning package.', created_at: fixedNow, updated_at: fixedNow }
        if (state.identityMismatch === 'source_generation') version.source_generation = 1601
        if (state.identityMismatch === 'schedule_version_id') generation.schedule_version_id = 91
        if (state.identityMismatch === 'schedule_id') generation.schedule_id = 999
        const preview = { generation_mode: 'planning_package', wbs_node_count: data.wbs.length,
          deliverable_count: 2, activity_count: activities.length, relationship_count: data.relationships.length,
          configured_workflow_activity_count: activities.length, milestone_count: 1, workflow_family_counts: { engineering_document: 2 },
          assumptions: ['Workflow durations are proposed planning values.'], sample_activities: activities.map(row => ({ ...row, original_duration_days: row.duration_days })), sample_logic_matrix: data.relationships, validation: [] }
        const isPreview = path.endsWith('/generation-preview/')
        const job = { id: isPreview ? 503 : 502, project: owner.planningProject.id, job_type: isPreview ? 'preview' : 'generate',
          request_data: body, status: 'succeeded', terminal: true, progress: 100, created_at: fixedNow, updated_at: fixedNow,
          result_generation: isPreview ? null : generation.id,
          result_data: isPreview ? { preview } : { generation_mode: 'planning_package', intelligence_run_id: runId,
            generation_id: generation.id, schedule_id: owner.schedule.id, schedule_version_id: versionId, state: 'draft' } }
        state.packageJobs[job.id] = job
        if (!isPreview) {
          state.packages[owner.planningProject.id] = generation
          state.packageWorkspaces[versionId] = data
          if (!owner.versions.some(row => row.id === versionId)) owner.versions.unshift(version)
        }
        return send(job, 202)
      }
      const jobId = path.match(/\/jobs\/(\d+)\/$/)?.[1]
      if (jobId && state.packageJobs[jobId]) {
        const job = state.packageJobs[jobId]
        if (job.job_type === 'analyze' && !job.terminal) {
          if (state.holdAnalysis) await new Promise(resolve => state.analysisReleases.push(resolve))
          const target = Object.values(state.records).find(row => row.planningProject.id === job.project)
          const run = { ...structuredClone(target.runs.find(row => row.status === 'succeeded')), id: 903, preview_confirmation: null }
          run.intelligence.document_intelligence_run_id = run.id
          target.runs.unshift(run)
          Object.assign(job, { status: 'succeeded', terminal: true, progress: 100, result_data: { intelligence: run.intelligence } })
        }
        return send(job)
      }
      const runId = path.match(/\/intelligence-runs\/(\d+)\/$/)?.[1]
      if (runId) return send(Object.values(state.records).flatMap(row => row.runs).find(row => String(row.id) === runId))
      if (path.endsWith('/generations/')) return send(pageOf(Object.values(state.packages).filter(row => row.project === record.planningProject.id)))
      const generationId = path.match(/\/generations\/(\d+)\/$/)?.[1]
      if (generationId) return send(Object.values(state.packages).find(row => String(row.id) === generationId))
      if (path.endsWith('/schedule-configurations/')) return send(pageOf([{ id: 301, project: owner.planningProject.id, configuration_version: 7 }]))
      const version = path.match(/\/schedule-versions\/(\d+)\/(workspace|bulk-activities)\/$/)
      if (version && state.packageWorkspaces[version[1]]) {
        const data = state.packageWorkspaces[version[1]]
        if (method === 'PATCH') {
          const body = route.request().postDataJSON()
          state.packageWrites.push({ path, method, body })
          for (const edited of body.activities || []) Object.assign(data.activities.find(row => row.id === edited.id), edited)
        }
        return send(data)
      }
      return false
    },
  })
}

async function analyze(page) {
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'Run Document Intelligence', exact: true }).click()
}
async function expectPackage(page, version = 99) {
  await expect(mode(page, 'Master Schedule')).toHaveAttribute('aria-pressed', 'true')
  await expectRetainedScheduleVersion(page, version)
  await area(page, 'Activities & Gantt').click()
  await page.getByRole('button', { name: 'Flat activities', exact: true }).click()
  await expect(activityName(page)).toHaveValue('Package: Piping isometrics package')
  await expect(activityName(page)).toBeEditable()
  await expect(page.getByRole('region', { name: 'Document analysis workspace', exact: true })).toHaveCount(0)
}
function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(row => row.method !== 'GET' && !/\/(analyze|generate|generation-preview|bulk-activities)\/$/.test(row.path))).toEqual([])
}

test('analysis builds its exact editable planning package with WBS and logic while preserving the earlier master and unreviewed facts', async ({ page }) => {
  const state = await harness(page)
  const oldMaster = structuredClone(state.records[17].versions.find(row => row.id === 90))
  await analyze(page)
  await expectPackage(page)
  await area(page, 'WBS').click()
  await expect(page.getByRole('textbox').first()).toHaveValue('Engineering')
  await expect(page.getByRole('textbox').first()).toBeEditable()
  await area(page, 'Logic').click()
  await expect(page.getByRole('button', { name: 'Add Tie', exact: true })).toBeEnabled()
  await area(page, 'Activities & Gantt').click()
  await activityName(page).fill('Planner edited package activity')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('1 unsaved', { exact: true })).toHaveCount(0)
  expect(state.packageWorkspaces[99].activities.find(row => row.external_id === 'PIP-014').name).toBe('Planner edited package activity')
  expect(state.packageWrites.filter(row => row.path.endsWith('/generate/'))).toHaveLength(1)
  expect(state.packageWrites.find(row => row.path.endsWith('/generate/')).body).toEqual({ generation_options: { mode: 'planning_package', intelligence_run_id: 903 } })
  expect(state.records[17].versions.find(row => row.id === 90)).toEqual(oldMaster)
  expect(JSON.stringify(state.records[17].facts)).toBe(state.initialFacts[17])
  await mode(page, 'Document Intelligence').click()
  await expect(page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true }).getByRole('button')).toHaveCount(11)
  await expect(page.getByRole('heading', { name: /Activities/ })).toContainText('v4')
  clean(state)
})

for (const status of [403, 409, 503]) test(`planning package ${status} preserves saved findings and retries without opening an older schedule`, async ({ page }) => {
  const message = status === 403 ? 'You cannot generate a planning package.' : status === 409 ? 'Source inputs changed. Analyze the current documents again.' : 'Planning generation temporarily unavailable.'
  const state = await harness(page, { packageError: { status, body: { error: message } } })
  await analyze(page)
  await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible()
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })).toHaveCount(0)
  state.packageError = null
  await page.getByRole('button', { name: 'Retry planning package', exact: true }).click()
  await expectPackage(page)
  expect(state.packageWrites.filter(row => row.path.endsWith('/analyze/'))).toHaveLength(1)
  clean(state)
})

test('AI Settings remains open after analysis and generation waits for the existing dialog guard', async ({ page }) => {
  const state = await harness(page, { holdAnalysis: true })
  await analyze(page)
  await expect.poll(() => state.analysisReleases.length).toBe(1)
  await page.getByRole('button', { name: 'AI settings', exact: true }).click()
  state.holdAnalysis = false; state.analysisReleases.splice(0).forEach(release => release())
  await expect(settings(page)).toContainText('Analysis findings are saved.')
  expect(state.packageWrites.filter(row => row.path.endsWith('/generate/'))).toEqual([])
  await settings(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expectPackage(page)
  clean(state)
})

for (const identityMismatch of ['source_generation', 'schedule_version_id', 'schedule_id']) test(`planning package rejects mismatched ${identityMismatch} without opening an unrelated version`, async ({ page }) => {
  const state = await harness(page, { identityMismatch })
  await analyze(page)
  await expect(page.getByRole('alert')).toContainText('The generated version does not match this project and analysis.')
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
  clean(state)
})

test('automatic package handoff preserves an unsaved existing planner activity when discard is cancelled', async ({ page }) => {
  const state = await harness(page, { query: 'project=17&view=plan-baseline&shell=true', prepare(current) { current.records[17].masterVersionId = 91 } })
  await expectRetainedScheduleVersion(page, 91)
  await page.getByRole('button', { name: 'Flat activities', exact: true }).click()
  await activityName(page).fill('Keep my unsaved existing activity')
  await mode(page, 'Document Intelligence').click()
  await analyze(page)
  const confirmation = page.getByRole('dialog', { name: 'Confirm action', exact: true })
  await expect(confirmation).toContainText('Discard unsaved activity changes and open this schedule?')
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await mode(page, 'Master Schedule').click()
  await expect(activityName(page)).toHaveValue('Keep my unsaved existing activity')
  await expect(page.getByText('1 unsaved', { exact: true })).toBeVisible()
  await expectRetainedScheduleVersion(page, 91)
  expect(state.packageWorkspaces[99]).toBeDefined()
  expect(state.packageWrites.filter(row => row.path.endsWith('/generate/'))).toHaveLength(1)
  clean(state)
})

test('saved analysis opens a package without confirmation and its 63 review notes remain collapsed', async ({ page }) => {
  const state = await harness(page)
  await page.getByRole('button', { name: 'Next: Document Intelligence Preview', exact: true }).click()
  await expect(page.getByText('Synthetic source section 63:', { exact: false })).toBeHidden()
  await expect(page.getByText('2 of 2 AI sections processed.', { exact: false })).toBeVisible()
  await page.getByText('Read analysis notes', { exact: true }).click()
  await expect(page.getByRole('region', { name: 'Saved analysis notes', exact: true })).toContainText('Synthetic source section 63:')
  await page.getByRole('button', { name: 'Open schedule workspace', exact: true }).click()
  await expectPackage(page)
  expect(state.packageWrites.find(row => row.path.endsWith('/generate/')).body.generation_options.intelligence_run_id).toBe(901)
  expect(state.packageWrites.filter(row => row.path.endsWith('/analyze/'))).toEqual([])
  clean(state)
})

test('explicit Master Schedule creates the saved analysis package once and subsequent tab switches reuse it', async ({ page }) => {
  const state = await harness(page)
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toHaveAttribute('aria-busy', 'false')
  expect(state.packageWrites).toEqual([])
  await mode(page, 'Master Schedule').click()
  await expectPackage(page)
  await selectRetainedScheduleVersion(page, 90)
  await expect(activityName(page)).toHaveValue('Piping isometrics package')
  await expectRetainedScheduleVersion(page, 90)
  await mode(page, 'Document Intelligence').click()
  await mode(page, 'Master Schedule').click()
  await expectPackage(page)
  expect(state.packageWrites.filter(row => row.path.endsWith('/generate/'))).toHaveLength(1)
  expect(state.packageWrites[0].body.generation_options).toEqual({ mode: 'planning_package', intelligence_run_id: 901 })
  clean(state)
})

test('generation wizard previews actual package workflows and sequence then opens the exact returned draft', async ({ page }) => {
  const state = await harness(page)
  await page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true }).getByRole('button', { name: /4\. Schedule Generator/ }).click()
  await page.getByRole('button', { name: 'Open Generation Wizard', exact: true }).click()
  const wizard = page.getByRole('dialog', { name: 'Schedule generation wizard', exact: true })
  await wizard.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(wizard.getByRole('heading', { name: 'Planned workflow families', exact: true })).toBeVisible()
  await expect(wizard).not.toContainText('reference only')
  await wizard.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(wizard.getByRole('heading', { name: 'Review planned logic and sequence', exact: true })).toBeVisible()
  await wizard.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(wizard).toContainText('Workflow durations are proposed planning values.')
  await wizard.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(wizard.getByRole('heading', { name: 'Editable planning package ready', exact: true })).toBeVisible()
  await wizard.getByRole('button', { name: 'Open Planner Workspace →', exact: true }).click()
  await expectPackage(page)
  expect(state.packageWrites.find(row => row.path.endsWith('/generation-preview/')).body.generation_options).toEqual({ mode: 'planning_package', intelligence_run_id: 901, expected_configuration_version: 7 })
  await expect(page.getByRole('region', { name: 'Planning package assumptions', exact: true })).toContainText('Registered start: 2026-09-25. Calendar: Proposed package calendar · 5 working days/week · 8 hours/day.')
  for (const viewport of [{ width: 1672, height: 941 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const scan = await new AxeBuilder({ page }).include('.planner-workspace').analyze()
    expect(scan.violations.filter(row => ['serious', 'critical'].includes(row.impact))).toEqual([])
    await page.screenshot({ path: `../artifacts/planning-package-${viewport.width}.png`, fullPage: true, animations: 'disabled' })
  }
  clean(state)
})

test('a late generated package cannot open after the selected enterprise project changes', async ({ page }) => {
  const state = await harness(page, { holdPackage: true })
  await analyze(page)
  await expect.poll(() => state.packageReleases.length).toBe(1)
  const header = page.locator('header.pd-header')
  await header.locator('summary[aria-label="More project actions"]').click()
  await header.getByRole('combobox', { name: 'Active Project', exact: true }).fill('Grid Power')
  await header.getByRole('option').filter({ hasText: state.records[18].project.name }).click()
  state.holdPackage = false; state.packageReleases.splice(0).forEach(release => release())
  await expect(page.getByRole('heading', { name: 'Grid Power Integration Project', exact: true })).toBeVisible()
  await expect(mode(page, 'Document Intelligence')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })).toHaveCount(0)
  expect(state.packageWrites.filter(row => row.path.endsWith('/generate/'))).toHaveLength(1)
  clean(state)
})
