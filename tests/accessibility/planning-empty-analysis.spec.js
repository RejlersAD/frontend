import { test, expect } from '@playwright/test'
import { masterScheduleHarness, registerNames } from '../fixtures/master-schedule.fixture.js'
import { pageOf, fixedNow } from '../fixtures/schedule-performance.fixture.js'
import { scheduleAction, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)

const inputs = page => page.getByRole('dialog', { name: 'Documents & project inputs', exact: true })
const grid = page => scheduleWorkspace(page).getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
const analyze = page => inputs(page).getByRole('button', { name: 'Analyze & update schedule', exact: true })
const analysisWrites = state => state.writes.filter(item => item.path.endsWith('/simple-plan/analyse/'))
const message = 'Document analysis found 221 requirements, but no schedule activities. AI extraction did not run because no AI provider is configured. Configure AI settings and analyze again, or upload a deliverable register or activity schedule.'
const emptyResult = {
  status: 'no_activities', activity_count: 0, requirement_count: 221,
  code: 'provider_not_configured', message, next_action: 'ai_settings', ai_status: 'not_run',
}

async function harness(page, options = {}) {
  return masterScheduleHarness(page, {
    prepare(state) {
      state.retryWithActivities = false
      for (const record of Object.values(state.records)) {
        record.retryTasks = structuredClone(record.simplePlan.tasks)
        Object.assign(record.simplePlan, { state: 'inputs', revision: 0, tasks: [], disciplines: [{ code: 'general', name: 'General' }] })
        Object.assign(record.files[0], { original_filename: 'Scope of Services for FEED.pdf', category: 'sow' })
        record.runs = [{
          id: 901, project: record.planningProject.id, status: 'succeeded',
          source_file_ids: [record.files[0].id], fact_count: 221, conflict_count: 0,
          started_at: fixedNow, finished_at: fixedNow,
          intelligence: { ai_status: 'not_run', ai_error: 'No AI provider is configured.', evidence_summary: { fact_count: 221, conflict_count: 0 } },
        }]
        record.facts = Array.from({ length: 221 }, (_, index) => ({
          id: 1000 + index, run: 901, fact_type: 'requirement', status: 'detected',
          value: `The contractor shall comply with scope requirement ${index + 1}.`,
          source_file: record.files[0].id, source_filename: record.files[0].original_filename,
          source_locator: { page: 9, line: 260 + index }, extraction_method: 'deterministic',
        }))
      }
      options.prepare?.(state)
    },
    async handleRequest(context) {
      const { path, route, record, state, reply } = context
      if (await options.handleRequest?.(context)) return true
      if (path.endsWith('/intelligence-runs/')) { await reply(route, pageOf(record.runs)); return true }
      if (path.endsWith('/intelligence-facts/')) { await reply(route, pageOf(record.facts)); return true }
      if (!path.endsWith('/simple-plan/analyse/') || route.request().method() !== 'POST') return false
      const data = route.request().postDataJSON()
      state.writes.push({ method: 'POST', path, data })
      expect(data.revision).toBe(record.simplePlan.revision)
      Object.assign(record.simplePlan, {
        state: 'review', revision: data.revision + 1, stale_inputs: false,
        tasks: state.retryWithActivities ? structuredClone(record.retryTasks) : [],
        analysis_result: state.retryWithActivities
          ? { status: 'activities_created', activity_count: record.retryTasks.length, requirement_count: 221 }
          : structuredClone(emptyResult),
      })
      await reply(route, record.simplePlan)
      return true
    },
  })
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.unknown).toEqual([])
}

async function analyzeEmptyDocument(page, state) {
  await scheduleAction(page, 'Project inputs')
  await expect(inputs(page).getByText('Analyzed', { exact: true })).toBeVisible()
  await expect(inputs(page).getByRole('button', { name: 'View all 221 requirements', exact: true })).toBeVisible()
  await analyze(page).click()
  await expect.poll(() => analysisWrites(state).length).toBe(1)
  await expect(inputs(page)).toBeVisible()
  await expect(inputs(page)).toContainText(message)
  await expect(inputs(page)).not.toContainText('Schedule updated')
  await expect(analyze(page)).toBeEnabled()
}

test('requirements without activities keep the analysis explanation and AI settings available after analysis', async ({ page }) => {
  const state = await harness(page)
  await analyzeEmptyDocument(page, state)

  await expect(inputs(page).getByRole('button', { name: 'AI settings', exact: true })).toBeEnabled()
  await inputs(page).getByRole('button', { name: 'Configure AI settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: 'Document analysis AI settings', exact: true })
  await expect(settings).toBeVisible()
  await expect(settings.getByRole('checkbox', { name: 'Use AI for document analysis', exact: true })).toBeEnabled()
  await settings.getByRole('button', { name: 'Close Document analysis AI settings', exact: true }).click()
  await expect(inputs(page)).toContainText(message)

  await inputs(page).getByRole('button', { name: 'Back to schedule', exact: true }).click()
  await expect(inputs(page)).toHaveCount(0)
  await expect(grid(page)).toContainText(message)
  await expect(grid(page)).not.toContainText('Add an activity or upload the project documents.')
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(0)
  await expect(grid(page).locator('.p6-activity-bar')).toHaveCount(0)
  await page.reload()
  await expect(grid(page)).toContainText(message)
  expect(analysisWrites(state)).toEqual([{
    method: 'POST', path: '/api/v1/planning-intelligence/projects/71/simple-plan/analyse/',
    data: { revision: 0, rebuild: false },
  }])
  clean(state)
})

test('an existing analyzed draft without an outcome field explains the empty schedule before another analysis', async ({ page }) => {
  const state = await harness(page, { prepare(current) {
    Object.assign(current.records[17].simplePlan, {
      state: 'review', revision: 1, intelligence_run_id: 901,
      processing_coverage: { ai_processing: { chunks: [{ status: 'not_run', reason: 'provider_not_configured' }] } },
    })
  } })
  await expect(grid(page)).toContainText('no schedule activities were created')
  await expect(grid(page)).toContainText('no AI provider is configured')
  await expect(grid(page)).not.toContainText('Add an activity or upload the project documents.')
  await grid(page).getByRole('button', { name: 'Review analysis / Project inputs', exact: true }).click()
  await expect(inputs(page)).toContainText('no AI provider is configured')
  await expect(inputs(page).getByRole('button', { name: 'Configure AI settings', exact: true })).toBeEnabled()
  expect(analysisWrites(state)).toEqual([])
  clean(state)
})

test('an empty historical schedule does not inherit the current draft analysis diagnosis', async ({ page }) => {
  const state = await harness(page, { prepare(current) {
    Object.assign(current.records[17].simplePlan, {
      state: 'review', viewing_history: true, version_id: 90, version_number: 2,
      intelligence_run_id: 901, analysis_result: null,
      processing_coverage: { ai_processing: { chunks: [{ status: 'not_run', reason: 'provider_not_configured' }] } },
    })
  } })
  await expect(grid(page)).toBeVisible()
  await expect(grid(page).locator('[data-row-kind="task"]')).toHaveCount(0)
  await expect(grid(page)).not.toContainText('no AI provider is configured')
  await expect(grid(page).getByRole('button', { name: 'Review analysis / Project inputs', exact: true })).toHaveCount(0)
  expect(analysisWrites(state)).toEqual([])
  clean(state)
})

test('retrying an empty analysis with extracted activities closes inputs and restores the Gantt', async ({ page }) => {
  const state = await harness(page)
  await analyzeEmptyDocument(page, state)

  state.retryWithActivities = true
  await analyze(page).click()
  await expect(inputs(page)).toHaveCount(0)
  await expect(grid(page).locator('.sc-task-name')).toHaveText(registerNames)
  await expect(grid(page).locator('.p6-activity-bar')).toHaveCount(2)
  await expect(grid(page)).not.toContainText(message)
  expect(analysisWrites(state).map(item => item.data)).toEqual([
    { revision: 0, rebuild: false }, { revision: 1, rebuild: false },
  ])
  clean(state)
})

test('creates all extracted statements without AI after saving dates and shows source deliverables', async ({ page }) => {
  const state = await harness(page, { async handleRequest({ path, route, record, state: current, reply }) {
    if (!path.endsWith('/simple-plan/programmatic-draft/') || route.request().method() !== 'POST') return false
    const data = route.request().postDataJSON()
    current.writes.push({ method: 'POST', path, data })
    expect(data).toEqual({ revision: 0, requirement_scope: 'all' })
    expect(record.planningProject.planned_end_date).toBe('2026-12-18')
    Object.assign(record.simplePlan, {
      state: 'review', revision: 1, method: 'programmatic_requirements', permissions: { can_edit: true },
      tasks: record.facts.map((fact, index) => ({ ...record.retryTasks[0], id: `requirement-${fact.id}`, title: fact.value, discipline: 'general', task_type: 'task', depends_on: [], project_task_id: 4000 + index, duration_source: 'proposed', selection_basis: 'all_extracted_requirements', proposal_timing: true })),
      programmatic_summary: { requirement_count: 221, activity_count: 221, deliverable_count: 1 },
      document_deliverables: [{ id: 'source-1', title: 'FEED Fire and Gas Layout', discipline: 'Loss Prevention', planned_start_date: '2026-09-21', planned_finish_date: '2026-12-18', duration_days: 65, source_references: [{ filename: 'Scope of Services for FEED.pdf', locator: { page: 60 } }] }],
    })
    await reply(route, record.simplePlan)
    return true
  } })
  await scheduleAction(page, 'Project inputs')
  const create = inputs(page).getByRole('button', { name: 'Create draft without AI', exact: true })
  await expect(create).toBeEnabled()
  await expect(inputs(page)).toContainText('Create all 221 statements as draft activities, including contract clauses.')
  await inputs(page).getByLabel('Project end date', { exact: true }).fill('2026-12-18')
  await create.click()
  await expect(inputs(page)).toHaveCount(0)
  await expect(page.locator('.ssd-programmatic-summary')).toContainText('221 draft activities from all 221 requirement statements without AI')
  await expect(page.locator('.ssd-programmatic-summary')).toContainText('Dates and durations are provisional; no dependency links were inferred.')
  await expect(grid(page).locator('.p6-activity-bar').first()).toBeVisible()
  await expect(grid(page).locator('[data-row-kind="task"] [data-column="duration"]').first().getByRole('button')).toHaveAttribute('aria-description', /^Provisional duration · project date allocation\. Duration in working days\./)
  expect(analysisWrites(state)).toHaveLength(0)
  expect(state.writes.map(item => item.method)).toEqual(['PATCH', 'POST'])
  await scheduleAction(page, 'Project inputs')
  await expect(inputs(page).getByRole('button', { name: 'Create draft without AI', exact: true })).toHaveCount(0)
  await inputs(page).getByText('View 1 source deliverables', { exact: true }).click()
  await expect(inputs(page).getByText('FEED Fire and Gas Layout', { exact: true })).toBeVisible()
  await expect(inputs(page)).toContainText('2026-09-21 – 2026-12-18')
  await expect(inputs(page)).toContainText('p. 60')
  clean(state)
})

test('programmatic creation refuses activities added by another session', async ({ page }) => {
  const state = await harness(page)
  await scheduleAction(page, 'Project inputs')
  const create = inputs(page).getByRole('button', { name: 'Create draft without AI', exact: true })
  await expect(create).toBeEnabled()
  state.records[17].simplePlan.tasks = structuredClone(state.records[17].retryTasks)
  state.records[17].simplePlan.revision += 1
  await create.click()
  await expect(inputs(page)).toContainText('This draft already contains activities.')
  expect(state.writes).toEqual([])
  clean(state)
})

test('source deliverables preserve all source headings, repeated numbers and separate documents', async ({ page }) => {
  const sourceGroups = [
    ['General', 'general', 'Project execution plan.'],
    ['Conceptual Design Study', 'general', 'Concept selection report.'],
    ['HSE', 'hse', 'HSE study report.'],
    ['Loss Prevention', 'hse', 'Fire and gas mapping.'],
    ['Instrumentation', 'instrumentation', 'Specification (F&G) – Rev. 0.'],
    ['Electrical', 'electrical', 'Electrical load list.'],
    ['Civil', 'civil', 'Civil design basis.'],
  ]
  const state = await harness(page, { prepare(current) {
    const record = current.records[17]
    record.simplePlan.document_deliverables = sourceGroups.map(([source_heading, discipline, title], index) => ({
      id: `deliverable-${index}`, source_heading, discipline, title,
      source_item_number: index === 4 ? 12 : 1, source_file_id: record.files[0].id,
      source_references: [{ file_id: record.files[0].id, filename: 'Scope of Services for FEED.pdf', locator: { page: 60 + Math.floor(index / 2) } }],
    }))
    record.simplePlan.document_deliverables.push({
      ...record.simplePlan.document_deliverables[4], id: 'repeated-source-number', title: 'Instrument installation detail.',
    }, {
      ...record.simplePlan.document_deliverables[0], id: 'another-source-document', title: 'Second document scope.', source_file_id: 902,
      source_references: [{ file_id: 902, filename: 'Supplemental scope.pdf', locator: { page: 3 } }],
    })
  } })
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByText('View 9 source deliverables', { exact: true }).click()
  const deliverables = inputs(page).locator('.pln-source-deliverables')
  await expect(deliverables).toContainText('Source deliverable headings; final WBS requires review.')
  await expect(deliverables.locator('h3')).toHaveText([...sourceGroups.map(([heading]) => heading), 'General'])
  const instrumentation = deliverables.getByRole('region', { name: 'Instrumentation', exact: true })
  await expect(instrumentation.getByText('Source item 12', { exact: true })).toHaveCount(2)
  await expect(instrumentation.locator('strong')).toHaveText(['Specification (F&G) – Rev. 0.', 'Instrument installation detail.'])
  const general = deliverables.getByRole('region', { name: 'General', exact: true })
  await expect(general).toHaveCount(2)
  await expect(general.nth(0)).toContainText('Scope of Services for FEED.pdf')
  await expect(general.nth(1)).toContainText('Supplemental scope.pdf')
  await expect(deliverables.getByRole('region', { name: 'Conceptual Design Study', exact: true })).toContainText('Concept selection report.')
  await expect(deliverables.getByRole('region', { name: 'Loss Prevention', exact: true })).toContainText('Fire and gas mapping.')
  expect(state.writes).toEqual([])
  clean(state)
})
