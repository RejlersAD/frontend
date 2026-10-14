import { test, expect } from '@playwright/test'
import { planningInputsHarness, populatePlanningEvidence } from '../fixtures/planning-inputs.fixture.js'
import { fixedNow, pageOf } from '../fixtures/schedule-performance.fixture.js'
import { expectRetainedScheduleVersion } from '../fixtures/retained-schedule-controls.js'

test.setTimeout(60000)

const workflow = page => page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true })
const stage = (page, label) => workflow(page).getByRole('button', { name: new RegExp(`^\\d+\\. ${label}(?:\\s|$)`) })
const previewHeading = page => page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })
const wizard = page => page.getByRole('dialog', { name: 'Schedule generation wizard', exact: true })
const continueWizard = page => wizard(page).getByRole('button', { name: 'Continue →', exact: true })
const confirmPreview = page => page.getByRole('button', { name: 'Confirm & save preview', exact: true })
const generationWrites = state => state.writes.filter(write => write.path.endsWith('/generate/'))
const previewWrites = state => state.writes.filter(write => write.path.endsWith('/generation-preview/'))
const confirmationWrites = state => state.writes.filter(write => write.path.endsWith('/confirm-preview/'))
const stepLabels = ['Upload Files', 'Document Intelligence', 'WBS Builder', 'Schedule Generator', 'EDDR', 'Manhours', 'Validation', 'Narrative', 'PowerPoint Presentation', 'Export', 'Final Project Proposal']
const sourceActivity = {
  id: 'source-design-basis', name: 'Process design basis', discipline: 'process', wbs_code: '1.1',
  original_duration_days: 12, duration_unit: 'working_days', start_date: null, finish_date: null,
  total_float_days: null, is_critical: null, predecessors: [],
  source_references: [{ file_id: 801, filename: '5900913-scope-of-work.pdf', locator: { page: 4 } }],
}
const sourcePreview = {
  generation_mode: 'planning_package', configured_workflow_activity_count: 1, workflow_family_counts: { engineering_document: 1 },
  wbs_node_count: 2, deliverable_count: 1, activity_count: 1, relationship_count: 0, milestone_count: 0,
  missing_information: [{ activity_id: sourceActivity.id, missing_fields: ['calendar', 'dependencies'] }],
  assumptions: ['Workflow durations and calendar are proposed planning values.'],
  validation: [{ rule: 'planning_proposal', severity: 'warning', message: 'Review proposed workflow durations and calendar.' }],
  sample_activities: [sourceActivity], sample_logic_matrix: [],
}

async function harness(page, options = {}) {
  const enterpriseId = options.enterpriseId || 17
  const state = await planningInputsHarness(page, {
    query: `project=${enterpriseId}&view=plan-baseline&scheduleMode=${options.initialMaster ? 'planner' : 'documents'}&shell=true`,
    harnessPath: '/tests/fixtures/project-performance-harness.jsx',
    prepare(current) {
      const record = current.records[enterpriseId]
      populatePlanningEvidence(record)
      record.conflicts = []
      record.facts.forEach(fact => { if (fact.status === 'conflicted') fact.status = fact.id === 918 ? 'confirmed' : 'rejected' })
      const run = record.runs.find(item => item.status === 'succeeded')
      Object.assign(run.intelligence, { open_conflicts: [], evidence_summary: { ...run.intelligence.evidence_summary, conflict_count: 0 } })
      if (options.noFiles) record.files = []
      if (options.noAnalysis || options.noFiles) Object.assign(record, { runs: [], facts: [], conflicts: [] })
      if (options.manual) {
        record.project.custom_fields = { ...record.project.custom_fields, project_type: 'software', planning_mode: 'manual' }
        Object.assign(record.planningProject, { planning_mode: 'manual', phase: 'Implementation' })
        record.manualWorkBreakdown = {
          project_id: record.planningProject.id, planning_mode: 'manual', intelligence_run_id: null,
          preview_confirmed_at: `manual:${record.planningProject.id}`, revision: 0, tasks: [],
          disciplines: [{ code: 'general', name: 'General' }], source_documents: [], permissions: { can_assign: true },
        }
      }
      for (const item of Object.values(current.records)) item.generations = []
      current.workflowJobs = {}
      current.unexpectedWrites = []
      current.generationFailure = null
      current.targetEnterpriseId = enterpriseId
      options.prepare?.(current)
    },
    async handleRequest({ path, url, route, state: current, reply }) {
      const method = route.request().method()
      const planningId = path.match(/\/planning-intelligence\/projects\/(\d+)\//)?.[1] || url.searchParams.get('project')
      const record = Object.values(current.records).find(item => String(item.planningProject.id) === planningId)
      if (path.endsWith('/simple-plan/') && method === 'GET') {
        await reply(route, { project_id: record.planningProject.id, master_version_id: options.masterVersionId || null, state: 'inputs', revision: 0, tasks: [], disciplines: [],
          permissions: { can_edit: true, can_assign: true, can_submit: false, can_approve_publish: false },
          source_documents: record.files, blockers: [], warnings: [], assumptions: [], versions: [], stale_inputs: false,
        })
        return true
      }
      if (path.endsWith('/manual-work-breakdown/')) {
        if (method === 'PUT') {
          const data = route.request().postDataJSON()
          current.writes.push({ path, method, data })
          record.manualWorkBreakdown = { ...record.manualWorkBreakdown, ...data, revision: record.manualWorkBreakdown.revision + 1 }
        }
        await reply(route, record.manualWorkBreakdown)
        return true
      }
      if (path.endsWith('/generation-plans/')) { await reply(route, pageOf([])); return true }
      const detailRunId = path.match(/\/intelligence-runs\/(\d+)\/$/)?.[1]
      if (detailRunId && method === 'GET') {
        const run = Object.values(current.records).flatMap(item => item.runs).find(item => String(item.id) === detailRunId)
        await reply(route, run || { detail: 'Analysis run not found.' }, run ? 200 : 404)
        return true
      }
      if (path.endsWith('/schedule-configurations/')) {
        await reply(route, pageOf([{ id: 1401, project: record.planningProject.id, configuration_version: 3 }]))
        return true
      }
      if (path.endsWith('/generations/')) { await reply(route, pageOf(record.generations)); return true }
      const generationId = path.match(/\/generations\/(\d+)\/$/)?.[1]
      if (generationId) {
        const generation = Object.values(current.records).flatMap(item => item.generations).find(item => String(item.id) === generationId)
        await reply(route, generation || { detail: 'Generation not found.' }, generation ? 200 : 404)
        return true
      }
      if (method === 'POST' && (path.endsWith('/generation-preview/') || path.endsWith('/generate/'))) {
        const data = route.request().postDataJSON()
        current.writes.push({ path, method, data })
        const generating = path.endsWith('/generate/')
        if (generating && current.generationFailure) {
          await reply(route, current.generationFailure, 503)
          return true
        }
        const id = generating ? 1802 : 1801
        const job = {
          id, project: record.planningProject.id, job_type: generating ? 'generate' : 'generation_preview',
          status: 'queued', terminal: false, progress: 0, result_generation: null, result_data: {},
          message: generating ? 'Generation queued.' : 'Source preview queued.', created_at: fixedNow, updated_at: fixedNow,
          request_data: data,
        }
        current.workflowJobs[id] = job
        await reply(route, job, 202)
        return true
      }
      const jobId = path.match(/\/jobs\/(\d+)\/$/)?.[1]
      if (jobId && current.workflowJobs[jobId]) {
        const job = current.workflowJobs[jobId]
        const target = Object.values(current.records).find(item => item.planningProject.id === job.project)
        if (job.status !== 'succeeded') {
          Object.assign(job, { status: 'succeeded', terminal: true, progress: 100, finished_at: fixedNow })
          if (job.job_type === 'generation_preview') job.result_data = { preview: structuredClone(sourcePreview) }
          else {
            const run = target.runs.find(item => String(item.id) === String(job.request_data.generation_options.intelligence_run_id))
            const scheduleVersionId = options.scheduleVersionId || target.versions.find(item => item.status === 'draft')?.id || target.versions[0].id
            const generation = {
              id: 1701, project: target.planningProject.id, version: 1, created_at: fixedNow,
              generation_mode: 'planning_package', intelligence_run_id: run.id,
              schedule_id: target.schedule.id, schedule_version_id: scheduleVersionId,
              wbs: [{ code: '1', name: target.planningProject.name, level: 0 }, { code: '1.1', parent_code: '1', name: 'Process evidence package', level: 1 }],
              activities: [structuredClone(sourceActivity)], eddr: [], manhours: {}, validation: sourcePreview.validation,
              logic_matrix: [], narrative: 'Workflow durations and calendar are proposed planning values.', intelligence: structuredClone(run.intelligence),
            }
            target.generations = [generation]
            target.versions.find(item => item.id === scheduleVersionId).source_generation = generation.id
            // The optional stored version response tests the UI handoff contract;
            // browser interception does not exercise backend generation/calculation.
            Object.assign(job, { result_generation: generation.id, result_data: { generation_id: generation.id,
              generation_mode: 'planning_package', intelligence_run_id: run.id,
              schedule_version_id: scheduleVersionId, schedule_id: target.schedule.id, state: 'draft',
            } })
          }
        }
        await reply(route, job)
        return true
      }
      if (method === 'PATCH' && /\/planning-intelligence\/projects\/\d+\/$/.test(path)) return false
      if (method === 'POST' && path.endsWith('/analyze/')) return false
      if (!['GET', 'OPTIONS'].includes(method) && !path.includes('/intelligence-')) {
        current.unexpectedWrites.push({ path, method })
        await reply(route, { detail: 'Unexpected write blocked by the workflow browser fixture.' }, 400)
        return true
      }
      return false
    },
  })
  if (!options.initialMaster) {
    await expect(workflow(page)).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toHaveAttribute('aria-busy', 'false')
  }
  return state
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unexpectedWrites).toEqual([])
}

async function savePreview(page) {
  await stage(page, 'Document Intelligence').click()
  await expect(previewHeading(page)).toBeVisible()
  await expect(confirmPreview(page)).toBeEnabled()
  await confirmPreview(page).click()
  await expect(page.getByRole('button', { name: 'Open Generation Wizard', exact: true })).toBeEnabled()
}

async function reviewGeneration(page) {
  await page.getByRole('button', { name: 'Open Generation Wizard', exact: true }).click()
  await expect(wizard(page).getByRole('heading', { name: 'Confirm generation scope', exact: true })).toBeVisible()
  await continueWizard(page).click()
  await expect(wizard(page).getByRole('heading', { name: 'Review planned activities', exact: true })).toBeVisible()
  await expect(wizard(page)).toContainText('Process design basis')
  await expect(wizard(page)).toContainText('12 working days')
  await continueWizard(page).click()
  await expect(wizard(page).getByRole('heading', { name: 'Review planned logic and sequence', exact: true })).toBeVisible()
  await expect(wizard(page)).toContainText('Not Specified: no extracted source relationships.')
  await continueWizard(page).click()
  await expect(wizard(page).getByRole('heading', { name: 'Review the exact generation plan', exact: true })).toBeVisible()
  await expect(wizard(page)).toContainText('Workflow durations and calendar are proposed planning values.')
}

test('Document Intelligence opens all eleven steps and saves a reviewed generation that survives reload', async ({ page }) => {
  const state = await harness(page)
  const record = state.records[17]
  await expect(page.getByRole('navigation', { name: 'Schedule workspace', exact: true }).getByRole('button', { name: 'Document Intelligence', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(workflow(page).getByRole('button')).toHaveCount(11)
  for (const label of stepLabels) await expect(stage(page, label)).toBeVisible()
  const primaryBounds = await page.getByRole('button', { name: 'Open Master Schedule', exact: true }).evaluate(button => {
    const label = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes('Open Master Schedule'))
    const range = document.createRange()
    range.selectNodeContents(label)
    const text = range.getBoundingClientRect(), control = button.getBoundingClientRect()
    return { textLeft: text.left, textRight: text.right, controlLeft: control.left, controlRight: control.right }
  })
  expect(primaryBounds.textLeft).toBeGreaterThanOrEqual(primaryBounds.controlLeft - 1)
  expect(primaryBounds.textRight).toBeLessThanOrEqual(primaryBounds.controlRight + 1)
  await page.screenshot({ path: '../artifacts/document-intelligence-workflow-desktop.png', fullPage: true, animations: 'disabled' })
  await expect(stage(page, 'WBS Builder')).toBeDisabled()
  await expect(stage(page, 'Export')).toBeDisabled()
  await stage(page, 'Schedule Generator').click()
  await expect(page.getByRole('button', { name: 'Open Generation Wizard', exact: true })).toBeEnabled()
  expect(state.writes).toEqual([])
  await savePreview(page)
  expect(confirmationWrites(state)).toHaveLength(1)
  await page.reload()
  await expect(workflow(page)).toBeVisible()
  await stage(page, 'Document Intelligence').click()
  await expect(page.getByText('Preview confirmed and saved.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Continue to Schedule Generator', exact: true }).click()
  expect(confirmationWrites(state)).toHaveLength(1)
  await reviewGeneration(page)
  await page.screenshot({ path: '../artifacts/document-intelligence-wizard-review.png', fullPage: true, animations: 'disabled' })
  expect(generationWrites(state)).toEqual([])
  expect(previewWrites(state)).toHaveLength(1)
  await wizard(page).getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(wizard(page).getByRole('heading', { name: 'Editable planning package ready', exact: true })).toBeVisible()
  await expect(wizard(page)).not.toContainText('Schedule generated successfully')
  expect(generationWrites(state)).toEqual([{ method: 'POST', path: `/api/v1/planning-intelligence/projects/${record.planningProject.id}/generate/`, data: {
    generation_options: { mode: 'planning_package', intelligence_run_id: 901, expected_configuration_version: 3 },
  } }])
  await wizard(page).getByRole('button', { name: 'Return to package', exact: true }).click()
  await stage(page, 'WBS Builder').click()
  await expect(page.getByRole('heading', { name: /^Work Breakdown Structure/ })).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Process evidence package')
  await page.reload()
  await expect(stage(page, 'Schedule Generator')).toBeEnabled()
  await stage(page, 'Schedule Generator').click()
  await expect(page.getByRole('heading', { name: /^Activities / })).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Process design basis')
  expect(generationWrites(state)).toHaveLength(1)
  clean(state)
})

test('a failed saved preview retains edited selections and cannot open the generator until an explicit successful retry', async ({ page }) => {
  const state = await harness(page)
  await stage(page, 'Document Intelligence').click()
  await expect(previewHeading(page)).toBeVisible()
  await page.getByRole('checkbox', { name: 'HAZID', exact: true }).check()
  state.confirmError = { error: 'Preview could not be saved. Please retry.', code: 'intelligence_save_unavailable' }
  await confirmPreview(page).click()
  await expect(page.getByText('Preview could not be saved. Please retry.', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'HAZID', exact: true })).toBeChecked()
  await expect(previewHeading(page)).toBeVisible()
  await stage(page, 'Schedule Generator').click()
  await expect(page.getByRole('button', { name: 'Open Generation Wizard', exact: true })).toBeDisabled()
  await stage(page, 'Document Intelligence').click()
  await expect(page.getByRole('checkbox', { name: 'HAZID', exact: true })).toBeChecked()
  state.confirmError = null
  await confirmPreview(page).click()
  await expect(page.getByRole('button', { name: 'Open Generation Wizard', exact: true })).toBeEnabled()
  expect(confirmationWrites(state)).toHaveLength(2)
  expect(confirmationWrites(state)[1].data.preview.hse_studies).toEqual(['HAZOP', 'HAZID'])
  expect(generationWrites(state)).toEqual([])
  clean(state)
})

for (const missing of ['files', 'analysis']) test(`missing ${missing} keeps confirmation and generated outputs locked without producing a synthetic plan`, async ({ page }) => {
  const state = await harness(page, missing === 'files' ? { noFiles: true } : { noAnalysis: true })
  await expect(stage(page, 'WBS Builder')).toBeDisabled()
  await expect(stage(page, 'Validation')).toBeDisabled()
  if (missing === 'files') await expect(page.getByText('No reference documents uploaded yet.', { exact: true })).toBeVisible()
  await stage(page, 'Document Intelligence').click()
  await expect(page.getByText('Run document intelligence from the Upload step first.', { exact: true })).toBeVisible()
  await expect(confirmPreview(page)).toBeDisabled()
  await stage(page, 'Schedule Generator').click()
  await expect(page.getByRole('button', { name: 'Open Generation Wizard', exact: true })).toBeDisabled()
  await expect(wizard(page)).toHaveCount(0)
  expect(state.writes).toEqual([])
  clean(state)
})

test('preview and generation requests remain tied to the selected enterprise project rather than the first project in the portfolio', async ({ page }) => {
  const state = await harness(page, { enterpriseId: 18 })
  const record = state.records[18]
  await savePreview(page)
  await reviewGeneration(page)
  await expect(wizard(page)).toContainText(record.project.name)
  await wizard(page).getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(wizard(page).getByRole('heading', { name: 'Editable planning package ready', exact: true })).toBeVisible()
  expect(previewWrites(state)[0].path).toBe(`/api/v1/planning-intelligence/projects/${record.planningProject.id}/generation-preview/`)
  expect(generationWrites(state)[0].path).toBe(`/api/v1/planning-intelligence/projects/${record.planningProject.id}/generate/`)
  expect(generationWrites(state)[0].data.generation_options).toEqual({ mode: 'planning_package', intelligence_run_id: record.runs.find(run => run.status === 'succeeded').id, expected_configuration_version: 3 })
  expect(record.generations[0].project).toBe(record.planningProject.id)
  expect(state.records[17].generations).toEqual([])
  expect(state.requests.filter(request => request.path.endsWith('/planning-intelligence/projects/')).every(request => request.query.enterprise_project === '18')).toBe(true)
  clean(state)
})

test('a failed generation keeps the reviewed plan in the wizard and does not invent a completed output', async ({ page }) => {
  const state = await harness(page)
  await savePreview(page)
  await reviewGeneration(page)
  state.generationFailure = { error: 'Schedule generation is temporarily unavailable.' }
  await wizard(page).getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(wizard(page)).toContainText('Schedule generation is temporarily unavailable.')
  await expect(wizard(page).getByRole('heading', { name: 'Review the exact generation plan', exact: true })).toBeVisible()
  await expect(wizard(page).getByRole('heading', { name: 'Editable planning package ready', exact: true })).toHaveCount(0)
  expect(state.records[17].generations).toEqual([])
  expect(generationWrites(state)).toHaveLength(1)
  clean(state)
})

test('document and master drafts survive switching and document analysis saves its own inputs on desktop and mobile', async ({ page }) => {
  const state = await harness(page, { initialMaster: true })
  await expectRetainedScheduleVersion(page, 91)
  const modes = page.getByRole('navigation', { name: 'Schedule workspace', exact: true })
  const master = page.getByRole('region', { name: 'Master Schedule', exact: true })
  await master.getByRole('button', { name: 'Flat activities', exact: true }).click()
  const name = master.getByRole('textbox', { name: 'PIP-014 activity name', exact: true })
  await expect(name).toHaveValue('Piping isometrics package')
  await name.fill('Unsaved master activity clarification')
  await modes.getByRole('button', { name: 'Document Intelligence', exact: true }).click()
  const scope = page.getByRole('textbox', { name: 'Scope summary', exact: true })
  const unsaved = 'Unsaved scope clarification retained while consulting the master schedule.'
  await scope.fill(unsaved)
  await modes.getByRole('button', { name: 'Master Schedule', exact: true }).click()
  await expect(page).toHaveURL(url => url.searchParams.get('scheduleMode') !== 'documents')
  await expect(master).toBeVisible()
  await expect(name).toHaveValue('Unsaved master activity clarification')
  await modes.getByRole('button', { name: 'Document Intelligence', exact: true }).click()
  await expect(scope).toHaveValue(unsaved)
  const save = page.getByRole('button', { name: 'Run Document Intelligence', exact: true })
  expect(await save.evaluate(button => Boolean(button.form && button.form.contains(document.getElementById('document-planning-project-start'))))).toBe(true)
  const formIds = await page.locator('form[id]').evaluateAll(forms => forms.map(form => form.id))
  expect(new Set(formIds).size).toBe(formIds.length)
  await save.click()
  const confirmation = page.getByRole('dialog', { name: 'Confirm action', exact: true })
  await expect(confirmation).toContainText('Discard unsaved activity changes and open this schedule?')
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await stage(page, 'Document Intelligence').click()
  await expect(previewHeading(page)).toBeVisible()
  expect(state.writes).toHaveLength(3)
  expect(state.writes[0]).toMatchObject({ method: 'PATCH', path: '/api/v1/planning-intelligence/projects/71/', data: { scope_summary: unsaved } })
  expect(state.writes[1]).toMatchObject({ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/analyze/' })
  expect(state.writes[2]).toMatchObject({ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/generate/', data: {
    generation_options: { mode: 'planning_package', intelligence_run_id: 903 },
  } })
  expect(state.analysisProjects[0].scope_summary).toBe(unsaved)
  await modes.getByRole('button', { name: 'Master Schedule', exact: true }).click()
  await expect(name).toHaveValue('Unsaved master activity clarification')
  await modes.getByRole('button', { name: 'Document Intelligence', exact: true }).click()
  await stage(page, 'Upload Files').click()
  await expect(scope).toHaveValue(unsaved)
  expect(new URL(page.url()).searchParams.get('scheduleMode')).toBe('documents')
  expect(state.writes).toHaveLength(3)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(workflow(page)).toBeVisible()
  await expect(scope).toHaveValue(unsaved)
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1)
  await page.screenshot({ path: '../artifacts/document-intelligence-workflow-mobile.png', fullPage: true, animations: 'disabled' })
  clean(state)
})

test('a manual project retains its editable WBS without documents or Document Intelligence confirmation', async ({ page }) => {
  const state = await harness(page, { noFiles: true, manual: true })
  await expect(stage(page, 'WBS Builder')).toBeEnabled()
  await stage(page, 'WBS Builder').click()
  await expect(page.getByRole('heading', { name: 'Work breakdown', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add task', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Add task', exact: true })
  await editor.getByRole('textbox', { name: 'Task / deliverable', exact: true }).fill('Verify workflow restoration')
  await editor.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(editor).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: 'Verify workflow restoration' })).toBeVisible()
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0]).toMatchObject({ method: 'PUT', path: '/api/v1/planning-intelligence/projects/71/manual-work-breakdown/',
    data: { tasks: [expect.objectContaining({ title: 'Verify workflow restoration' })] },
  })
  await page.reload()
  await stage(page, 'WBS Builder').click()
  await expect(page.getByRole('row').filter({ hasText: 'Verify workflow restoration' })).toBeVisible()
  expect(confirmationWrites(state)).toEqual([])
  expect(generationWrites(state)).toEqual([])
  clean(state)
})

test('the wizard opens its returned schedule version when the saved master still points to an older baseline', async ({ page }) => {
  const state = await harness(page, { masterVersionId: 90, scheduleVersionId: 91 })
  await savePreview(page)
  await reviewGeneration(page)
  await wizard(page).getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(wizard(page).getByRole('heading', { name: 'Editable planning package ready', exact: true })).toBeVisible()
  await wizard(page).getByRole('button', { name: /^Open Planner Workspace/ }).click()
  await expect(page.getByRole('navigation', { name: 'Schedule workspace', exact: true }).getByRole('button', { name: 'Master Schedule', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expectRetainedScheduleVersion(page, '91')
  await page.getByRole('button', { name: 'Flat activities', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'PIP-014 activity name', exact: true })).toHaveValue('Piping isometrics package')
  await expect(page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })).toHaveCount(1)
  expect(generationWrites(state)).toHaveLength(1)
  expect(state.requests.some(request => request.path.endsWith('/schedule-versions/90/'))).toBe(true)
  expect(state.requests.some(request => request.path.endsWith('/schedule-versions/91/'))).toBe(true)
  clean(state)
})
