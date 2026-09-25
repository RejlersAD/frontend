import { test, expect } from '@playwright/test'

async function openWizard(page, approved = true, evidenceOnly = false, options = {}) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/__tests/document-generation', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><title>Source generation validation</title><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="test-root"></div><script type="module">
    import { React, ReactDOM } from '/tests/fixtures/wizard-test-dependencies.js';
    import GenerationWizard from '/src/components/planning/GenerationWizard.jsx';
    import service from '/src/services/planningIntelligence.service.js';
    window.calls = [];
    const record = (name, value) => async (...args) => { window.calls.push({ name, args }); return value; };
    service.listScheduleConfigurations = record('configuration', [{ configuration_version: 3 }]);
    service.listScheduleBases = record('basis', [{ id: 1, status: 'approved' }]);
    const planRows = ${options.emptyPlan ? '[]' : `[{ id: 2, basis: 1, version: 4, status: '${approved ? 'approved' : 'draft'}', selected_scenario: 'common', deliverables: [{ id: 'package-a', canonical_name: 'Lift inspection package', workflow_family: '${approved ? 'inspection_report' : 'not_specified'}', source_references: [{ filename: 'Inspection contract.docx', locator: { page: 7 } }] }], dependencies: [], phases: [] }, { id: 1, version: 2, status: 'approved', deliverables: [] }]`};
    let planAttempts = 0;
    service.listGenerationPlans = async (...args) => { window.calls.push({ name: 'plan', args }); if (${Boolean(options.planFailure)} && planAttempts++ === 0) throw new Error('Unavailable'); return planRows; };
    service.listWorkflowTemplates = record('UNEXPECTED workflow templates', []);
    service.listDependencyTemplates = record('UNEXPECTED dependency templates', []);
    service.createScheduleDefaultProposal = record('UNEXPECTED default approval', {});
    if (!${Boolean(options.apiPreview)}) service.previewGeneration = record('preview', { wbs_node_count: 1, deliverable_count: 1, activity_count: 1, configured_workflow_activity_count: 0, relationship_count: 0, milestone_count: 0, missing_information: [{ activity_id: 'inspect-a', missing_fields: ['dependencies', 'calendar'] }], validation: [{ severity: 'warning', message: 'Calendar Not Specified.' }], sample_activities: [{ id: 'inspect-a', name: 'Lift inspection package', original_duration_days: 12, duration_unit: 'calendar_days', source_references: [{ filename: 'Inspection contract.docx', locator: { page: 7 } }], predecessors: [] }] });
    if (${Boolean(options.unknownMetric)}) { const originalPreview = service.previewGeneration; service.previewGeneration = async (...args) => { const preview = await originalPreview(...args); delete preview.configured_workflow_activity_count; return preview; }; }
    const generatedResult = { generation: { version: 5 }, job: { result_data: { schedule_version_id: ${evidenceOnly ? 'null' : 8}, state: '${evidenceOnly ? 'needs_evidence_review' : 'complete'}' } } };
    const onGenerate = async (...args) => { window.calls.push({ name: 'generate', args }); if (${Boolean(options.pendingGeneration)}) await new Promise(resolve => { window.releaseGeneration = resolve; }); return generatedResult; };
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [projectId, setProjectId] = React.useState(21);
      window.selectWizardProject = setProjectId;
      return React.createElement(React.Fragment, null,
        React.createElement('button', { onClick: () => setOpen(true) }, 'Launch wizard'),
        React.createElement(GenerationWizard, { open, project: { id: projectId, name: 'Inspection programme ' + projectId }, files: [{ id: 1, parse_status: 'done' }], intelligence: { disciplines: ${approved ? "{ inspection: { in_scope: true, deliverables: ['Lift inspection package'] } }" : "{}"} }, onClose: () => setOpen(false), onGenerate, onOpenPlanner: record('UNEXPECTED planner navigation', null), onReviewEvidence: record('review evidence', null) }));
    }
    ReactDOM.createRoot(document.getElementById('test-root')).render(React.createElement(Harness));
  </script></body></html>` }))
  await page.goto('/__tests/document-generation')
  await page.getByRole('button', { name: 'Launch wizard', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Schedule generation wizard', exact: true })
  await expect(dialog.getByRole('button', { name: 'Continue →', exact: true })).toBeVisible()
  return { dialog, errors }
}

const sourcePreviewFor = projectId => ({
  wbs_node_count: 1, deliverable_count: 0, activity_count: 1, configured_workflow_activity_count: 0,
  relationship_count: 0, milestone_count: 0, missing_information: [], validation: [],
  sample_activities: [{ id: `source-${projectId}`, name: `Project ${projectId} source activity`,
    original_duration_days: 12, duration_unit: 'calendar_days', predecessors: [],
    source_references: [{ filename: `Project ${projectId} source.txt`, locator: { page: 1 } }],
  }],
})

// Exercise the real preview service and job polling, with no live records or workers.
async function openApiWizard(page, options = {}) {
  const state = { posts: [], gets: [], unexpected: [], jobs: {}, releases: [],
    holdProjects: new Set(), pollFailure: null }
  options.prepare?.(state)
  const reply = (route, value, status = 200) => route.fulfill({ status,
    contentType: 'application/json', body: JSON.stringify(value) })
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const projectId = path.match(/\/projects\/(\d+)\/generation-preview\/$/)?.[1]
    if (projectId && method === 'POST') {
      const data = route.request().postDataJSON()
      const id = data.retry_queued_job_id || 501 + state.posts.length
      const job = { id, project: Number(projectId), job_type: 'generation_preview', status: 'queued',
        progress: 0, terminal: false, message: 'Preview queued for a worker.', result_data: {},
      }
      state.posts.push({ id, projectId: Number(projectId), data })
      if (data.retry_queued_job_id && state.retryConflict) {
        await reply(route, { code: 'preview_retry_conflict', detail: 'The source inputs changed after this preview was queued.' }, 409)
        return
      }
      state.jobs[id] = state.jobs[id] || { ...job, ...options.jobForPoll?.(Number(projectId), id) }
      if (state.holdProjects.has(Number(projectId))) await new Promise(resolve => state.releases.push(resolve))
      await reply(route, job, 202)
      return
    }
    const jobId = path.match(/\/jobs\/(\d+)\/$/)?.[1]
    if (jobId && method === 'GET' && state.jobs[jobId]) {
      state.gets.push(Number(jobId))
      if (state.pollFailure) {
        const failure = state.pollFailure
        state.pollFailure = null
        await reply(route, { detail: failure.message }, failure.status)
      } else await reply(route, state.jobs[jobId])
      return
    }
    state.unexpected.push({ path, method })
    await reply(route, { detail: 'Unexpected request in preview recovery fixture.' }, 404)
  })
  const harness = await openWizard(page, false, true, { apiPreview: true })
  return { ...harness, state }
}

function finishPreview(state, id, preview = sourcePreviewFor(state.jobs[id].project)) {
  Object.assign(state.jobs[id], { status: 'succeeded', terminal: true, progress: 100,
    message: 'Source preview ready.', result_data: { preview } })
}

test('document generation reviews source evidence without auto-selecting or saving workflow templates', async ({ page }) => {
  const { dialog, errors } = await openWizard(page)
  for (const label of ['1. Inputs', '2. Workflow families', '3. Evidence logic', '4. Review', '5. Complete']) await expect(dialog.getByText(label, { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review source activities', exact: true })).toBeVisible()
  const families = dialog.getByRole('region', { name: 'Recorded workflow families', exact: true })
  await expect(families).toContainText('Version 4')
  await expect(families).toContainText('approved')
  await expect(families).toContainText('inspection report')
  await expect(families).toContainText('Recorded families are reference only.')
  await expect(dialog).toContainText('Lift inspection package')
  await expect(dialog).toContainText('Inspection contract.docx · Page 7')
  await expect(dialog).toContainText('12 calendar days')
  await expect(dialog.getByRole('spinbutton')).toHaveCount(0)
  await expect(dialog.getByText('Standard five-stage workflow', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('Not Specified: no extracted source relationships.')
  await expect(dialog.getByRole('combobox')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review the exact generation plan', exact: true })).toBeVisible()
  await expect(dialog.getByText('Workflow tasks', { exact: true }).locator('..')).toHaveText('0Workflow tasks')
  await expect(dialog.getByText('Source gaps', { exact: true }).locator('..')).toHaveText('1Source gaps')
  await dialog.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Schedule generated successfully', exact: true })).toBeVisible()
  const calls = await page.evaluate(() => window.calls)
  expect(calls.map(call => call.name)).toEqual(['configuration', 'plan', 'preview', 'generate'])
  expect(calls.at(-1).args).toEqual([{ expected_configuration_version: 3 }])
  expect(errors).toEqual([])
})

test('generic activity evidence can be reviewed without catalogue deliverables or schedule-control approvals', async ({ page }) => {
  const { dialog, errors } = await openWizard(page, false, true)
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('Showing 1 of 1 extracted activities.')
  await expect(dialog).toContainText('Lift inspection package')
  const families = dialog.getByRole('region', { name: 'Recorded workflow families', exact: true })
  await expect(families).toContainText('Version 4')
  await expect(families).toContainText('draft')
  await expect(families).toContainText('Not Specified')
  for (let step = 0; step < 2; step++) await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('Calendar Not Specified.')
  await dialog.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Document evidence ready for review', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.calls.map(call => call.name))).toEqual(['configuration', 'plan', 'preview', 'generate'])
  expect(errors).toEqual([])
})

test('an unavailable family reference keeps source evidence accessible and retries independently', async ({ page }) => {
  const { dialog, errors } = await openWizard(page, true, true, { planFailure: true })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('The recorded workflow family reference is unavailable.')
  await expect(dialog).toContainText('12 calendar days')
  await dialog.getByRole('button', { name: 'Retry workflow reference', exact: true }).click()
  await expect(dialog.getByRole('region', { name: 'Recorded workflow families', exact: true })).toContainText('inspection report')
  expect(await page.evaluate(() => window.calls.filter(call => call.name === 'plan').length)).toBe(2)
  expect(await page.evaluate(() => window.calls.filter(call => call.name === 'preview').length)).toBe(1)
  expect(await page.evaluate(() => window.calls.some(call => call.name.startsWith('UNEXPECTED')))).toBe(false)
  expect(errors).toEqual([])
})

test('absent recorded plans and unknown workflow counts remain unspecified', async ({ page }) => {
  const { dialog, errors } = await openWizard(page, true, true, { emptyPlan: true, unknownMetric: true })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('No generation plan is recorded. Workflow families are Not Specified')
  for (let step = 0; step < 2; step++) await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByText('Workflow tasks', { exact: true }).locator('..')).toHaveText('Not SpecifiedWorkflow tasks')
  await expect(dialog.getByText('Activities', { exact: true }).locator('..')).toHaveText('1Activities')
  await expect(dialog).toContainText('Extracted source evidence')
  await expect(dialog).toContainText('Calendar Not Specified.')
  expect(errors).toEqual([])
})

test('wizard traps focus, prevents Escape while generating, and restores the opener on close', async ({ page }) => {
  const { dialog, errors } = await openWizard(page, true, true, { pendingGeneration: true })
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Continue →', exact: true })).toBeFocused()
  for (let step = 0; step < 3; step++) await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await dialog.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(dialog).toHaveAttribute('aria-busy', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await page.evaluate(() => window.releaseGeneration())
  await expect(dialog.getByRole('heading', { name: 'Document evidence ready for review', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Launch wizard', exact: true })).toBeFocused()
  expect(errors).toEqual([])
})

test('an evidence-only result cannot claim calculated CPM or navigate to a nonexistent schedule version', async ({ page }) => {
  const { dialog, errors } = await openWizard(page, true, true)
  for (let step = 0; step < 3; step++) await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await dialog.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Document evidence ready for review', exact: true })).toBeVisible()
  await expect(dialog).toContainText('Review Not Specified values and source relationships before schedule calculation.')
  await expect(dialog).not.toContainText('Schedule generated successfully')
  await expect(dialog).not.toContainText('relational CPM')
  await expect(dialog).not.toContainText('undefined')
  await expect(dialog.getByRole('button', { name: 'Open Planner Workspace →', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Review source evidence', exact: true }).click()
  expect(await page.evaluate(() => window.calls.at(-1).name)).toBe('review evidence')
  expect(errors).toEqual([])
})

test('a queued preview resumes after closing and dispatch retry explicitly targets the same job', async ({ page }) => {
  const { dialog, errors, state } = await openApiWizard(page)
  await page.clock.install({ time: new Date('2026-09-25T06:00:00Z') })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(dialog).toHaveAttribute('aria-busy', 'true')
  await expect(dialog).toContainText('Preview queued — waiting for a worker')
  await page.clock.runFor(16000)
  await expect(dialog).toContainText(/still waiting for a worker/i)
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Launch wizard', exact: true })).toBeFocused()
  const pollsAfterClose = state.gets.length
  await page.clock.runFor(5000)
  expect(state.gets.length).toBe(pollsAfterClose)
  await page.getByRole('button', { name: 'Launch wizard', exact: true }).click()
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('Preview queued — waiting for a worker')
  expect(state.posts).toHaveLength(1)
  expect(state.gets.at(-1)).toBe(501)
  await page.clock.runFor(16000)
  await dialog.getByRole('button', { name: 'Retry queued preview', exact: true }).click()
  await expect.poll(() => state.posts.length).toBe(2)
  expect(state.posts[1]).toEqual({ id: 501, projectId: 21, data: { retry_queued_job_id: 501 } })
  expect(Object.keys(state.jobs)).toEqual(['501'])
  Object.assign(state.jobs[501], { status: 'running', progress: 47, message: 'Reading source activity rows.' })
  await page.clock.runFor(1600)
  await expect(dialog.getByRole('progressbar', { name: 'Reading source activity rows.', exact: true })).toHaveAttribute('aria-valuenow', '47')
  await expect(dialog.getByRole('button', { name: 'Retry queued preview', exact: true })).toHaveCount(0)
  finishPreview(state, 501)
  await page.clock.runFor(1600)
  await expect(dialog.getByRole('heading', { name: 'Review source activities', exact: true })).toBeVisible()
  await expect(dialog).toContainText('Project 21 source activity')
  expect(state.posts).toHaveLength(2)
  expect(state.gets.at(-1)).toBe(501)
  expect(state.unexpected).toEqual([])
  expect(errors).toEqual([])
})

test('a failed preview status read retries the same job without submitting another preview', async ({ page }) => {
  const { dialog, errors, state } = await openApiWizard(page, { prepare(current) {
    current.pollFailure = { status: 503, message: 'Preview status is temporarily unavailable.' }
  } })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Preview status is temporarily unavailable.')
  await expect(dialog).toHaveAttribute('aria-busy', 'false')
  finishPreview(state, 501)
  await dialog.getByRole('button', { name: 'Retry preview', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review source activities', exact: true })).toBeVisible()
  await expect(dialog).toContainText('Project 21 source activity')
  expect(state.posts).toHaveLength(1)
  expect(state.gets).toEqual([501, 501])
  expect(state.unexpected).toEqual([])
  expect(errors).toEqual([])
})

test('a terminal failed preview permits a fresh explicit retry and clears processing', async ({ page }) => {
  const { dialog, errors, state } = await openApiWizard(page, { jobForPoll(projectId, id) {
    return id === 501
      ? { status: 'failed', terminal: true, error_message: 'Source preview could not be extracted.' }
      : { status: 'succeeded', terminal: true, progress: 100, result_data: { preview: sourcePreviewFor(projectId) } }
  } })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Source preview could not be extracted.')
  await expect(dialog).toHaveAttribute('aria-busy', 'false')
  await dialog.getByRole('button', { name: 'Retry preview', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review source activities', exact: true })).toBeVisible()
  expect(state.posts.map(post => post.id)).toEqual([501, 502])
  expect(state.gets).toEqual([501, 502])
  expect(await page.evaluate(() => window.calls.some(call => call.name === 'generate'))).toBe(false)
  expect(state.unexpected).toEqual([])
  expect(errors).toEqual([])
})

test('a delayed preview response from a closed project cannot replace another project review', async ({ page }) => {
  const { dialog, errors, state } = await openApiWizard(page, {
    prepare(current) { current.holdProjects.add(21) },
    jobForPoll(projectId) { return { status: 'succeeded', terminal: true, progress: 100,
      result_data: { preview: sourcePreviewFor(projectId) } } },
  })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect.poll(() => state.releases.length).toBe(1)
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.evaluate(() => window.selectWizardProject(22))
  await page.getByRole('button', { name: 'Launch wizard', exact: true }).click()
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review source activities', exact: true })).toBeVisible()
  await expect(dialog).toContainText('Project 22 source activity')
  for (const release of state.releases.splice(0)) release()
  await expect(dialog).not.toContainText('Project 21 source activity')
  expect(state.posts.map(post => post.projectId)).toEqual([21, 22])
  expect(state.gets).toEqual([502])
  expect(state.unexpected).toEqual([])
  expect(errors).toEqual([])
})

test('an empty completed preview explains the missing source activities and offers evidence review', async ({ page }) => {
  const { dialog, errors, state } = await openApiWizard(page, { jobForPoll(projectId) {
    return { status: 'succeeded', terminal: true, progress: 100,
      result_data: { preview: { ...sourcePreviewFor(projectId), activity_count: 0, sample_activities: [] } } }
  } })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review source activities', exact: true })).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-busy', 'false')
  await expect(dialog).toContainText('Showing 0 of 0 extracted activities.')
  await expect(dialog).toContainText('No source activities were extracted.')
  await expect(dialog).not.toContainText('Schedule generated successfully')
  await dialog.getByRole('button', { name: 'Review source evidence', exact: true }).click()
  expect(await page.evaluate(() => window.calls.at(-1).name)).toBe('review evidence')
  expect(await page.evaluate(() => window.calls.some(call => call.name === 'generate'))).toBe(false)
  expect(state.posts).toHaveLength(1)
  expect(state.unexpected).toEqual([])
  expect(errors).toEqual([])
})

test('changed source inputs reject queued recovery and require evidence review without resuming the stale job', async ({ page }) => {
  const { dialog, errors, state } = await openApiWizard(page, { prepare(current) { current.retryConflict = true } })
  await page.clock.install({ time: new Date('2026-09-25T06:00:00Z') })
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(dialog).toContainText('Preview queued — waiting for a worker')
  await page.clock.runFor(16000)
  await dialog.getByRole('button', { name: 'Retry queued preview', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('The source inputs changed after this preview was queued.')
  await expect(dialog).toHaveAttribute('aria-busy', 'false')
  await expect(dialog.getByRole('button', { name: 'Retry preview', exact: true })).toHaveCount(0)
  const pollsAtConflict = state.gets.length
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Review the current source evidence')
  await page.clock.runFor(5000)
  expect(state.gets.length).toBe(pollsAtConflict)
  expect(state.posts).toHaveLength(2)
  expect(state.posts[1].data).toEqual({ retry_queued_job_id: 501 })
  await dialog.getByRole('button', { name: 'Review current source evidence', exact: true }).click()
  expect(await page.evaluate(() => window.calls.at(-1).name)).toBe('review evidence')
  expect(await page.evaluate(() => window.calls.some(call => call.name === 'generate'))).toBe(false)
  expect(state.unexpected).toEqual([])
  expect(errors).toEqual([])
})
