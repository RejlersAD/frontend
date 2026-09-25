import { test, expect } from '@playwright/test'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture.js'
import { fixedNow } from '../fixtures/schedule-performance.fixture.js'

test.setTimeout(60000)

const coverage = page => page.getByRole('region', { name: 'Extraction coverage', exact: true })
const preview = page => page.locator('.pln-intelligence-preview')
const completeAi = { status: 'complete', chunks_total: 2, chunks_processed: 2, chunks_failed: 0,
  chunks_skipped: 0, chunks_remaining: 0, rejected_claim_count: 0, semantic_coverage_verified: false }
const failedAi = { ...completeAi, status: 'partial', chunks_processed: 0, chunks_failed: 2 }
const partialAi = { ...completeAi, status: 'partial', chunks_processed: 1, chunks_failed: 1 }
const completeText = { status: 'complete', file_count: 1, analyzed_file_count: 1, complete_file_count: 1,
  semantic_coverage_verified: false, files: [{ file_id: 801, filename: '5900913-scope-of-work.pdf',
    status: 'complete', units_total: 2, units_processed: 2, unit_type: 'pages', included_in_analysis: true, issues: [] }] }
const success = 'Document analysis completed. Review the extracted findings.'
const unknown = 'Document analysis finished. Coverage was not fully recorded; review the extracted findings.'

function evidence(record, runId, result = {}) {
  return { document_intelligence_run_id: runId, detected_project_name: record.planningProject.name,
    detected_effective_date_text: record.planningProject.effective_date, disciplines: {}, hse_studies: [],
    ai_review: { review_summary: '' }, ai_augmented: false, sow_only_mode: true, open_conflicts: [],
    evidence_summary: { fact_count: record.facts.length, confirmed_count: 0, conflict_count: 0 },
    processing_coverage: structuredClone(result.text === undefined ? completeText : result.text),
    ...(result.ai === undefined ? {} : { ai_processing_coverage: structuredClone(result.ai) }),
  }
}

async function outcomeHarness(page, options = {}) {
  const state = await planningInputsHarness(page, {
    populated: true,
    prepare(current) {
      const record = current.records[17]
      record.facts = record.facts.filter(fact => ['requirement', 'exclusion'].includes(fact.fact_type))
      record.conflicts = []
      const run = record.runs.find(item => item.status === 'succeeded')
      run.intelligence = evidence(record, run.id, options.initial)
      Object.assign(run, { fact_count: record.facts.length, conflict_count: 0 })
      record.runs = [run]
      current.outcomes = [...(options.outcomes || [])]
      current.liveProgress = options.liveProgress || null
      current.nextJobReadGate = null
      current.delayedJobReplies = 0
      current.resumeRequests = []
      current.resumeError = options.resumeError || null
      current.jobReadError = null
      current.unexpectedWrites = []
    },
    async handleRequest({ path, route, state: current, reply }) {
      const resumeId = path.match(/\/intelligence-runs\/(\d+)\/resume\/$/)?.[1]
      if (resumeId && route.request().method() === 'POST') {
        current.resumeRequests.push(Number(resumeId))
        current.writes.push({ method: 'POST', path, data: route.request().postDataJSON() })
        if (current.resumeError) {
          await reply(route, current.resumeError.body, current.resumeError.status)
          return true
        }
        const job = { id: 970 + current.resumeRequests.length, project: 71, job_type: 'analyze',
          status: 'queued', terminal: false, progress: 0, message: 'Analysis continuation queued.',
          request_data: { resume_run_id: Number(resumeId) }, result_data: {}, error_message: '' }
        current.jobs[job.id] = job
        await reply(route, job, 202)
        return true
      }
      if (path.endsWith('/ai-settings/') && route.request().method() === 'GET') {
        await reply(route, { enabled: true, key_configured: true, provider: 'anthropic', model: 'fixture-model',
          provider_choices: [{ value: 'anthropic', label: 'Anthropic (Claude)', default_model: 'fixture-model',
            model_choices: [{ value: 'fixture-model', label: 'Fixture model' }] }] })
        return true
      }
      const jobId = path.match(/\/jobs\/(\d+)\/$/)?.[1]
      if (!jobId || route.request().method() !== 'GET') return false
      const job = current.jobs[jobId]
      if (!job) return false
      current.jobReads += 1
      if (current.jobReadError) {
        await reply(route, current.jobReadError.body, current.jobReadError.status)
        return true
      }
      if (current.nextJobReadGate) {
        const gate = current.nextJobReadGate
        current.nextJobReadGate = null
        const snapshot = structuredClone(job)
        await gate.promise
        await reply(route, snapshot)
        current.delayedJobReplies += 1
        return true
      }
      if (current.liveProgress && !job.terminal) {
        Object.assign(job, { status: 'running', started_at: fixedNow, ...current.liveProgress })
        await reply(route, job)
        return true
      }
      if (!job.terminal) {
        const next = current.outcomes.shift() || {}
        if (next.failure) Object.assign(job, { status: 'failed', terminal: true, error_message: next.failure, finished_at: fixedNow })
        else {
          const record = Object.values(current.records).find(item => item.planningProject.id === job.project)
          const runId = 1000 + Number(jobId)
          const intelligence = evidence(record, runId, next)
          record.facts.forEach(fact => { fact.run = runId })
          record.runs.unshift({ ...record.runs[0], id: runId, intelligence, preview_confirmation: null,
            started_at: fixedNow, finished_at: fixedNow, created_at: fixedNow, updated_at: fixedNow })
          Object.assign(job, { status: 'succeeded', terminal: true, progress: 100,
            message: 'Extraction job finished.', result_data: { intelligence }, finished_at: fixedNow })
        }
      }
      await reply(route, job)
      return true
    },
  })
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toHaveAttribute('aria-busy', 'false')
  return state
}

async function openPreview(page) {
  await page.getByRole('button', { name: 'Next: Document Intelligence Preview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Document Intelligence Preview', exact: true })).toBeVisible()
}

const analyzeWrites = state => state.writes.filter(write => write.path.endsWith('/analyze/'))
function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET' && !/\/projects\/71\/(?:analyze\/)?$/.test(request.path)
    && !/\/intelligence-runs\/901\/resume\/$/.test(request.path))).toEqual([])
}

test('all failed AI chunks retain source facts and expose real settings without claiming complete analysis', async ({ page }) => {
  const state = await outcomeHarness(page, { outcomes: [{ ai: failedAi }] })
  await page.getByRole('button', { name: 'Run Document Intelligence', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Document analysis needs attention: AI analysis failed.' })).toBeVisible()
  await expect(coverage(page)).toContainText('Text extraction complete')
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed, 0 skipped, 2 failed.')
  await expect(coverage(page)).toContainText('The failure reason was not recorded in this saved analysis.')
  await expect(preview(page)).toContainText('AI analysis failed · source extraction retained')
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  await expect(preview(page)).toContainText('The fact count is not an activity or deliverable count.')
  await expect(preview(page)).not.toContainText('RADAI Review')
  await expect(preview(page)).not.toContainText('Enable AI')
  await expect(page.getByText(success, { exact: true })).toHaveCount(0)
  await coverage(page).getByRole('button', { name: 'Review AI settings', exact: true }).click()
  const settings = page.getByRole('dialog', { name: /^AI Settings \(BYOK\)/ })
  await expect(settings).toBeVisible()
  await expect(settings.getByRole('checkbox', { name: 'Enable AI BYOK for this project', exact: true })).toBeChecked()
  await expect(settings).toContainText('key configured')
  await page.keyboard.press('Escape')
  await expect(coverage(page).getByRole('button', { name: 'Review AI settings', exact: true })).toBeFocused()
  await page.reload()
  await openPreview(page)
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed')
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

test('partial AI analysis keeps its diagnostic and an explicit successful retry replaces the warning', async ({ page }) => {
  const diagnostic = 'The AI provider is temporarily unavailable. Retry document analysis.'
  const ai = { ...partialAi, chunks: [{ status: 'failed', error: { code: 'provider_unavailable',
    message: diagnostic, next_action: 'retry_analysis' } }] }
  const state = await outcomeHarness(page, { outcomes: [{ ai }, { ai: completeAi }] })
  await page.getByRole('button', { name: 'Run Document Intelligence', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Document analysis is incomplete.' })).toBeVisible()
  await expect(coverage(page)).toContainText('AI analysis coverage: Partial; 1 of 2 chunks processed')
  await expect(coverage(page)).toContainText(diagnostic)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  await expect(coverage(page)).toContainText('All stored text chunks processed; 2 of 2 chunks processed, 0 skipped, 0 failed.')
  await expect(coverage(page)).not.toContainText(diagnostic)
  await expect(preview(page)).not.toContainText('AI analysis incomplete')
  await expect(coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true })).toHaveCount(0)
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  expect(analyzeWrites(state)).toHaveLength(2)
  clean(state)
})

for (const mode of ['unknown', 'not_run']) test(`${mode} AI coverage remains distinct from fully processed analysis`, async ({ page }) => {
  const result = mode === 'unknown' ? { text: null } : { ai: { status: 'not_run', reason: 'disabled_by_project' } }
  const state = await outcomeHarness(page, { outcomes: [result] })
  await page.getByRole('button', { name: 'Run Document Intelligence', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: mode === 'unknown' ? unknown : 'Source analysis finished. AI analysis was not run;' })).toBeVisible()
  await expect(coverage(page)).toContainText(mode === 'unknown' ? 'AI analysis coverage: Not recorded.' : 'AI analysis coverage: Not run (disabled_by_project)')
  await expect(coverage(page)).not.toContainText('All stored text chunks processed')
  await expect(page.getByText(success, { exact: true })).toHaveCount(0)
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  clean(state)
})

test('a failed analysis job preserves the previously loaded source evidence', async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: failedAi }, outcomes: [{ failure: 'Analysis service is temporarily unavailable.' }] })
  await openPreview(page)
  const originalRun = state.records[17].runs[0].id
  await expect(preview(page)).toContainText(`Run #${originalRun}`)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Analysis service is temporarily unavailable.')
  await expect(preview(page)).toContainText(`Run #${originalRun}`)
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed')
  await expect(coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true })).toBeEnabled()
  expect(state.records[17].runs).toHaveLength(1)
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

test('live analysis progress follows server chunk updates while previous findings remain labeled until the new result is saved', async ({ page }) => {
  const previousNotice = 'A new analysis is running. The findings below are from the previous saved analysis.'
  const state = await outcomeHarness(page, { initial: { ai: failedAi }, outcomes: [{ ai: completeAi }],
    liveProgress: { progress: 15, message: 'Reading parsed project documents' } })
  await openPreview(page)
  const originalRun = state.records[17].runs[0].id
  await expect(preview(page)).toContainText(`Run #${originalRun}`)
  await expect(page.getByText(previousNotice, { exact: true })).toHaveCount(0)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: previousNotice })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Reading parsed project documents (15%)' })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '15')
  await expect(preview(page)).toContainText(`Run #${originalRun}`)
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed')
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  await expect(coverage(page).getByRole('button', { name: /^Analyzing/ })).toBeDisabled()

  state.liveProgress = { progress: 30, message: 'AI analysis: processing chunk 1 of 2; waiting for provider response' }
  await expect(page.getByRole('status').filter({ hasText: `${state.liveProgress.message} (30%)` })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  const readsBeforeWaiting = state.jobReads
  await expect.poll(() => state.jobReads).toBeGreaterThan(readsBeforeWaiting)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  await expect(page.getByText(success, { exact: true })).toHaveCount(0)
  expect(state.records[17].runs).toHaveLength(1)

  state.liveProgress = { progress: 60, message: 'AI analysis: processing chunk 2 of 2; waiting for provider response' }
  await expect(page.getByRole('status').filter({ hasText: `${state.liveProgress.message} (60%)` })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
  await expect(preview(page)).toContainText(`Run #${originalRun}`)
  state.liveProgress = { progress: 90, message: 'Saving document analysis findings' }
  await expect(page.getByRole('status').filter({ hasText: `${state.liveProgress.message} (90%)` })).toBeVisible()
  await expect(page.getByText(previousNotice, { exact: true })).toBeVisible()

  state.liveProgress = null
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  await expect(page.getByText(previousNotice, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(preview(page)).toContainText(`Run #${state.records[17].runs[0].id}`)
  await expect(preview(page)).not.toContainText(`Run #${originalRun}`)
  await expect(coverage(page)).toContainText('All stored text chunks processed; 2 of 2 chunks processed')
  expect(state.records[17].runs).toHaveLength(2)
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

test('live analysis failure removes the running notice while retaining the explicitly previous saved findings', async ({ page }) => {
  const previousNotice = 'A new analysis is running. The findings below are from the previous saved analysis.'
  const state = await outcomeHarness(page, { initial: { ai: failedAi }, outcomes: [{ failure: 'Analysis processing failed. Retry the analysis.' }],
    liveProgress: { progress: 30, message: 'AI analysis: processing chunk 1 of 2; waiting for provider response' } })
  await openPreview(page)
  const originalRun = state.records[17].runs[0].id
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: previousNotice })).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  await expect(preview(page)).toContainText(`Run #${originalRun}`)
  state.liveProgress = null
  await expect(page.getByRole('alert')).toContainText('Analysis processing failed. Retry the analysis.')
  await expect(page.getByText(previousNotice, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(preview(page)).toContainText(`Run #${originalRun}`)
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed')
  await expect(coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true })).toBeEnabled()
  expect(state.records[17].runs).toHaveLength(1)
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

for (const outcome of ['success', 'failure']) test(`a pending analysis resumes after reload and consumes its ${outcome} once without another POST`, async ({ page }) => {
  const previousNotice = 'A new analysis is running. The findings below are from the previous saved analysis.'
  const state = await outcomeHarness(page, { initial: { ai: failedAi },
    outcomes: [outcome === 'success' ? { ai: completeAi } : { failure: 'Restored analysis failed. Previous findings are retained.' }],
    liveProgress: { progress: 30, message: 'AI analysis: processing chunk 1 of 2; waiting for provider response' } })
  await openPreview(page)
  const originalRun = state.records[17].runs[0].id
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  const jobId = Object.keys(state.jobs)[0]
  await expect.poll(() => page.evaluate(() => localStorage.getItem('radai-planning-active-job'))).toBe(jobId)
  await page.reload()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  await expect(page.getByText(previousNotice, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Running Document Intelligence', exact: false })).toBeDisabled()
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toContainText('Extracted from 1 source document')
  expect(analyzeWrites(state)).toHaveLength(1)
  state.liveProgress = null

  if (outcome === 'success') {
    await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
    await expect(preview(page)).toContainText(`Run #${state.records[17].runs[0].id}`)
    await expect(preview(page)).not.toContainText(`Run #${originalRun}`)
    await expect(coverage(page)).toContainText('All stored text chunks processed; 2 of 2 chunks processed')
    await preview(page).getByRole('button', { name: /Edit$/ }).click()
    await preview(page).locator('input[type="text"]').first().fill('Reviewed project name after restored analysis')
    await preview(page).getByRole('button', { name: 'Apply edits', exact: true }).click()
    await expect(preview(page)).toContainText('Reviewed project name after restored analysis')
  } else {
    await expect(page.getByRole('alert')).toContainText('Restored analysis failed. Previous findings are retained.')
    await openPreview(page)
    await expect(preview(page)).toContainText(`Run #${originalRun}`)
    await expect(coverage(page)).toContainText('AI analysis coverage: Failed; 0 of 2 chunks processed')
    await expect(coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true })).toBeEnabled()
  }
  await expect(page.getByText(previousNotice, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('radai-planning-active-job'))).toBeNull()
  const readsAfterCompletion = state.jobReads
  // Pass the real poll interval: a consumed terminal job must not poll/reapply.
  await page.waitForTimeout(1800)
  expect(state.jobReads).toBe(readsAfterCompletion)
  if (outcome === 'success') await expect(preview(page)).toContainText('Reviewed project name after restored analysis')
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

test('an old analysis poll cannot populate the next selected project after its workspace unmounts', async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: failedAi },
    liveProgress: { progress: 30, message: 'AI analysis: processing chunk 1 of 2; waiting for provider response' } })
  await openPreview(page)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  let release
  state.nextJobReadGate = { promise: new Promise(resolve => { release = resolve }) }
  await expect.poll(() => state.nextJobReadGate).toBeNull()
  await page.getByRole('combobox', { name: 'Active Project', exact: true }).fill('5900738')
  await page.getByRole('option', { name: /5900738/ }).click()
  await expect(page).toHaveURL(/project=18/)
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toHaveAttribute('aria-busy', 'false')
  release()
  await expect.poll(() => state.delayedJobReplies).toBe(1)
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText('A new analysis is running. The findings below are from the previous saved analysis.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toContainText('Analyze source documents to extract project requirements.')
  await expect(page.getByText('AI analysis: processing chunk 1 of 2; waiting for provider response (30%)', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Scope summary', exact: true })).toHaveValue(state.records[18].planningProject.scope_summary)
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

test('a restored analysis polling failure retains its job and reconnects with GET only before consuming the saved result', async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: failedAi }, outcomes: [{ ai: completeAi }],
    liveProgress: { progress: 30, message: 'AI analysis: processing chunk 1 of 2; waiting for provider response' } })
  await openPreview(page)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  const jobId = Object.keys(state.jobs)[0]
  await page.reload()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  state.jobReadError = { status: 503, body: { detail: 'Job status is temporarily unavailable.' } }
  await expect(page.getByRole('alert')).toContainText('Connection to the analysis job was interrupted.')
  await expect(page.getByRole('alert')).toContainText('The server may still be processing.')
  await expect(page.getByRole('alert').getByRole('button', { name: 'Dismiss notification', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Check analysis status', exact: true })).toBeEnabled()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByText('Analysis status is unavailable. The findings below are from the previous saved analysis.', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('radai-planning-active-job'))).toBe(jobId)
  expect(state.jobs[jobId].status).toBe('running')
  expect(state.records[17].runs).toHaveLength(1)
  expect(analyzeWrites(state)).toHaveLength(1)
  state.jobReadError = null
  state.liveProgress = null
  await page.getByRole('button', { name: 'Check analysis status', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  await expect(coverage(page)).toContainText('2 of 2 chunks processed')
  await expect(page.getByRole('button', { name: 'Check analysis status', exact: true })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('radai-planning-active-job'))).toBeNull()
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

test('an initial saved-job read failure stays unscoped and reconnects without starting another analysis', async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: failedAi }, outcomes: [{ ai: completeAi }],
    liveProgress: { progress: 30, message: 'AI analysis: waiting for provider response' } })
  await openPreview(page)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  state.jobReadError = { status: 503, body: { detail: 'Job status is temporarily unavailable.' } }
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Connection to the saved job was interrupted.')
  await expect(page.getByRole('alert')).not.toContainText('Connection to the analysis job')
  await expect(page.getByRole('button', { name: 'Check saved job status', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Running Document Intelligence', exact: false })).toBeDisabled()
  expect(analyzeWrites(state)).toHaveLength(1)
  state.jobReadError = null
  state.liveProgress = null
  await page.getByRole('button', { name: 'Check saved job status', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

for (const status of [403, 404]) test(`a restored job ${status} clears the unavailable local pointer and releases analysis without a GET retry loop`, async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: failedAi },
    liveProgress: { progress: 30, message: 'AI analysis: waiting for provider response' } })
  await openPreview(page)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  if (status === 404) state.jobReadError = { status, body: { detail: 'This job is unavailable.' } }
  await page.reload()
  if (status === 403) {
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    state.jobReadError = { status, body: { detail: 'This job is unavailable.' } }
  }
  await expect(page.getByRole('alert')).toContainText('This saved job is unavailable or you no longer have access.')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Check (?:analysis|saved job) status/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Run Document Intelligence', exact: true })).toBeEnabled()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('radai-planning-active-job'))).toBeNull()
  const reads = state.jobReads
  await page.waitForTimeout(1800)
  expect(state.jobReads).toBe(reads)
  expect(analyzeWrites(state)).toHaveLength(1)
  expect(state.records[17].runs).toHaveLength(1)
  clean(state)
})

test('a fresh analysis polling failure keeps duplicate starts blocked while GET-only reconnect completes the same job', async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: failedAi }, outcomes: [{ ai: completeAi }],
    liveProgress: { progress: 30, message: 'AI analysis: waiting for provider response' } })
  await openPreview(page)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  state.jobReadError = { status: 503, body: { detail: 'Job status is temporarily unavailable.' } }
  await expect(page.getByRole('alert')).toContainText('Connection to the analysis job was interrupted.')
  await expect(coverage(page).getByRole('button', { name: /^Analyzing/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Back to scope & inputs', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Running Document Intelligence', exact: false })).toBeDisabled()
  expect(analyzeWrites(state)).toHaveLength(1)
  state.jobReadError = null
  state.liveProgress = null
  await page.getByRole('button', { name: 'Check analysis status', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  expect(analyzeWrites(state)).toHaveLength(1)
  clean(state)
})

test('retry resumes the saved partial analysis and displays returned reused chunk coverage without starting a duplicate analysis', async ({ page }) => {
  const retainedChunk = { chunk_id: 'source-chunk-1', status: 'processed', resumed_from_run_id: 901 }
  const state = await outcomeHarness(page, { initial: { ai: { ...partialAi, resume_available: true } },
    outcomes: [{ ai: { ...completeAi, chunks: [retainedChunk, { chunk_id: 'source-chunk-2', status: 'processed' }] } }],
    liveProgress: { progress: 60, message: 'AI analysis: processing chunk 2 of 2; 1 completed chunk reused' } })
  await openPreview(page)
  await expect(coverage(page)).toContainText('1 of 2 chunks processed')
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '1 completed chunk reused (60%)' })).toBeVisible()
  expect(state.resumeRequests).toEqual([901])
  expect(analyzeWrites(state)).toHaveLength(0)
  await expect(preview(page)).toContainText('Run #901')
  state.liveProgress = null
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  await expect(coverage(page)).toContainText('2 of 2 chunks processed')
  await expect(preview(page)).toContainText(`${state.records[17].facts.length} facts`)
  expect(state.records[17].runs[0].intelligence.ai_processing_coverage.chunks[0]).toEqual(retainedChunk)
  expect(state.records[17].runs[1].id).toBe(901)
  expect(state.resumeRequests).toEqual([901])
  expect(analyzeWrites(state)).toHaveLength(0)
  clean(state)
})

test('retry starts a fresh analysis only when continuation rejects changed source or settings', async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: { ...partialAi, resume_available: true } }, outcomes: [{ ai: completeAi }],
    resumeError: { status: 409, body: { code: 'intelligence_resume_sources_changed', error: 'Source files or AI settings changed.' } } })
  await openPreview(page)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: success })).toBeVisible()
  expect(state.resumeRequests).toEqual([901])
  expect(analyzeWrites(state)).toHaveLength(1)
  expect(state.writes.map(write => write.path)).toEqual([
    '/api/v1/planning-intelligence/intelligence-runs/901/resume/',
    '/api/v1/planning-intelligence/projects/71/analyze/',
  ])
  await expect(coverage(page)).toContainText('2 of 2 chunks processed')
  clean(state)
})

test('a denied continuation retains the saved partial findings and does not bypass denial with a fresh analysis', async ({ page }) => {
  const state = await outcomeHarness(page, { initial: { ai: { ...partialAi, resume_available: true } },
    resumeError: { status: 403, body: { error: 'You do not have permission to resume this analysis.' } } })
  await openPreview(page)
  await coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('You do not have permission to resume this analysis.')
  await expect(preview(page)).toContainText('Run #901')
  await expect(coverage(page)).toContainText('1 of 2 chunks processed')
  await expect(coverage(page).getByRole('button', { name: 'Retry document analysis', exact: true })).toBeEnabled()
  expect(state.resumeRequests).toEqual([901])
  expect(analyzeWrites(state)).toHaveLength(0)
  clean(state)
})

for (const gap of ['contradictory AI totals', 'partial text extraction']) test(`${gap} cannot claim fully completed analysis`, async ({ page }) => {
  const result = gap === 'contradictory AI totals'
    ? { ai: { ...partialAi, status: 'complete' } }
    : { ai: completeAi, text: { ...completeText, status: 'partial', complete_file_count: 0,
      files: [{ ...completeText.files[0], status: 'partial', units_processed: 1,
        issues: [{ code: 'unreadable_page', page: 2, message: 'Page text could not be extracted.' }] }] } }
  const state = await outcomeHarness(page, { outcomes: [result] })
  await page.getByRole('button', { name: 'Run Document Intelligence', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: gap === 'contradictory AI totals'
    ? 'Document analysis is incomplete.' : 'Document analysis needs attention: text extraction is incomplete.' })).toBeVisible()
  await expect(page.getByText(success, { exact: true })).toHaveCount(0)
  if (gap === 'contradictory AI totals') {
    await expect(coverage(page)).toContainText('AI analysis coverage: Partial; 1 of 2 chunks processed')
    await expect(coverage(page)).not.toContainText('All stored text chunks processed')
  } else {
    await expect(coverage(page)).toContainText('AI analysis coverage: All stored text chunks processed')
    await coverage(page).getByText('Document extraction details (1)', { exact: true }).click()
    await expect(coverage(page)).toContainText('Page 2: Page text could not be extracted.')
  }
  clean(state)
})
