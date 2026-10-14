import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { primaveraScheduleHarness } from '../fixtures/primavera-schedule.fixture.js'
import { scheduleArea, scheduleVersion } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const review = page => page.getByRole('region', { name: 'Document evidence review', exact: true })
const bulk = page => page.getByRole('region', { name: 'Bulk evidence review', exact: true })
const group = { key: 'missing_calendar', label: 'Missing calendar', count: 178 }
const defaultReason = 'Accept source-verified candidates through RADAI bulk review; leave missing or ambiguous evidence unresolved.'
const evidence = (project = 71) => ({
  graph_id: `graph-${project}`, revision: 4, master_revision: 6,
  permissions: { can_review: true, can_supply_inputs: true, can_link: true }, capabilities: { correct: true, link: true, source_preview: true },
  readiness: { calculation: { ready: false, reasons: ['Calendar needs an approved input.'] }, baseline: { eligible: false, reasons: ['Calculation and approval remain required.'] } },
  issues: Array.from({ length: 100 }, (_, index) => ({ id: `issue-${index}`, kind: 'unreviewed', field: 'duration', status: 'open', title: `Review source duration ${index + 1}`, candidate_fact_ids: [`fact-${index}`], allowed_actions: ['accept', 'reject', 'correct'] })),
  facts: Array.from({ length: 100 }, (_, index) => ({ id: `fact-${index}`, entity_id: `activity-${index}`, entity_name: `Activity ${index + 1}`, property: 'duration', value: index + 1, unit: 'working_days', provenance_type: 'document_evidence', allowed_actions: ['accept', 'reject', 'correct'], input_schema: { type: 'number', minimum: 0 }, sources: [{ file_id: 801, filename: 'Approved schedule.pdf', locator: { page: 1, row: index + 1 }, excerpt: `Original printed duration: ${index + 1} days`, sha256: 'synthetic-source-checksum' }] })),
  warnings: [], decisions: [], pagination: { offset: 0, limit: 100, total: 10778, overall_total: 10778, has_more: true, next_offset: 100 },
  bulk_review: { enabled: true, eligibility_rechecked_on_run: true, ai_available: true, ai_reason: '', provider: 'test-provider', model: 'test-model', total_open: 10778, verified_unambiguous: 10000, conflict_groups: 600, unresolved_groups: [group], active_job: null, latest_job: null },
})
const makeJob = (project = 71, status = 'queued', mode = 'verified') => ({
  id: project + 430, project, job_type: 'evidence_bulk', status, progress: 0, message: 'Queued for source verification',
  result_data: { graph_id: `graph-${project}`, source_revision: 4, mode, counts: { processed: 0, total: 10778, accepted_verified: 0, accepted_ai: 0, unresolved: 0, skipped: 0 }, unresolved_groups: [], review_complete: false },
})
function complete(state, project = 71, status = 'succeeded') {
  const job = state.jobs[project + 430]
  Object.assign(job, { status, progress: status === 'succeeded' ? 100 : 40, message: status === 'succeeded' ? 'Bulk decisions recorded' : 'AI service interrupted', error_message: status === 'failed' ? 'AI provider unavailable during review.' : '' })
  Object.assign(job.result_data, { result_revision: 5, counts: { processed: status === 'succeeded' ? 10778 : 4000, total: 10778, accepted_verified: status === 'succeeded' ? 10000 : 4000, accepted_ai: job.result_data.mode === 'ai_verified' && status === 'succeeded' ? 600 : 0, unresolved: job.result_data.mode === 'ai_verified' ? 178 : 778, skipped: 0 }, unresolved_groups: [group], review_complete: false, calculation_ready: false, warnings: [] })
  const data = state.evidence[project]
  data.revision = 5
  Object.assign(data.bulk_review, { active_job: null, latest_job: structuredClone(job), total_open: job.result_data.counts.unresolved, verified_unambiguous: 0 })
  return job
}
async function harness(page, options = {}) {
  return primaveraScheduleHarness(page, {
    history: options.history,
    prepare(state) {
      state.evidence = Object.fromEntries(Object.values(state.records).map(record => [record.planningProject.id, evidence(record.planningProject.id)]))
      state.evidenceReads = []; state.evidenceWrites = []; state.jobs = {}; state.jobReads = []
      options.prepare?.(state)
    },
    async handleRequest(context) {
      if (await options.handleRequest?.(context)) return true
      const { path, route, reply, state, record, url } = context
      const jobMatch = path.match(/\/jobs\/(\d+)\/$/)
      if (jobMatch) {
        state.jobReads.push(Number(jobMatch[1]))
        if (options.poll) return options.poll(context, Number(jobMatch[1]))
        await reply(route, state.jobs[jobMatch[1]])
        return true
      }
      if (!path.includes('/evidence-review/')) return false
      const project = record.planningProject.id
      if (route.request().method() === 'GET') {
        state.evidenceReads.push({ project, ...Object.fromEntries(url.searchParams) })
        if (options.read) return options.read(context, project)
        const data = structuredClone(state.evidence[project])
        const offset = Number(url.searchParams.get('offset') || 0)
        if (url.searchParams.get('group')) {
          data.issues = [{ id: 'calendar-missing', title: 'Supply the approved working calendar', status: 'open', kind: 'missing_information', code: 'missing_calendar', candidate_fact_ids: [], allowed_actions: [] }]
          data.facts = []; data.pagination = { offset: 0, total: 178, overall_total: 10778, limit: 100, has_more: false }
        } else if (offset) {
          data.issues = [{ ...data.issues[0], id: 'page-two', title: 'Review source duration 101' }]
          data.pagination = { ...data.pagination, offset, next_offset: null, has_more: false }
        }
        await reply(route, data)
        return true
      }
      const body = route.request().postDataJSON()
      state.evidenceWrites.push({ path, project, body })
      if (options.write) return options.write(context, body, project)
      if (path.endsWith('/bulk/')) {
        const job = makeJob(project, 'queued', body.mode)
        state.jobs[job.id] = job; state.evidence[project].bulk_review.active_job = structuredClone(job)
        await reply(route, job, 202)
      } else {
        state.evidence[project].revision += 1
        await reply(route, state.evidence[project])
      }
      return true
    },
  })
}
async function open(page, options) {
  const state = await harness(page, options)
  await scheduleArea(page, 'evidence')
  await expect(bulk(page)).toBeVisible()
  return state
}
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]); expect(state.writes).toEqual([]) }

test('one click accepts verified values across the full 10778 issue queue while only one page is rendered', async ({ page }) => {
  const state = await open(page)
  const original = structuredClone(state.records[17].simplePlan)
  await expect(bulk(page).getByLabel('Full evidence queue counts')).toContainText('10,778')
  await expect(review(page).locator('.per-queue-items > button')).toHaveCount(100)
  await expect(review(page).getByRole('article')).toHaveCount(1)
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect(bulk(page).getByRole('progressbar', { name: 'Bulk review progress' })).toBeVisible()
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.evidenceWrites[0].body).toEqual({ revision: 4, mode: 'verified', reason: defaultReason })
  await expect(review(page).getByRole('button', { name: 'Accept value', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('button', { name: 'Refresh evidence', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('button', { name: 'Create schedule from accepted inputs', exact: true })).toBeDisabled()
  await review(page).getByRole('navigation', { name: 'Evidence queue pages' }).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(review(page).getByRole('region', { name: 'Selected evidence issue' })).toContainText('Review source duration 101')
  const before = state.evidenceReads.length
  complete(state)
  await expect(bulk(page)).toContainText('Bulk review finished with unresolved issues')
  await expect.poll(() => state.evidenceReads.length).toBe(before + 1)
  await expect(bulk(page).getByLabel('Bulk review results')).toContainText('10,000')
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.records[17].simplePlan).toEqual(original)
  clean(state)
})

test('AI mode records a chosen reason, reports source and AI counts, and opens unresolved server groups', async ({ page }) => {
  const state = await open(page)
  await bulk(page).getByText('Decision reason', { exact: true }).click()
  await bulk(page).getByRole('textbox', { name: 'Bulk decision reason' }).fill('Accept only source-verified candidates; retain ambiguous calendars for planner review.')
  await bulk(page).getByRole('button', { name: 'AI resolve & accept', exact: true }).click()
  await expect.poll(() => state.evidenceWrites.length).toBe(1)
  expect(state.evidenceWrites[0].body).toMatchObject({ revision: 4, mode: 'ai_verified', reason: 'Accept only source-verified candidates; retain ambiguous calendars for planner review.' })
  complete(state)
  await expect(bulk(page)).toContainText('Bulk review finished with unresolved issues')
  await expect(bulk(page).getByLabel('Bulk review results')).toContainText('600')
  await bulk(page).getByRole('button', { name: 'Missing calendar (178)', exact: true }).click()
  await expect(review(page).getByRole('region', { name: 'Selected evidence issue' })).toContainText('Supply the approved working calendar')
  expect(state.evidenceReads.at(-1)).toMatchObject({ offset: '0', group: 'missing_calendar' })
  await expect(review(page).getByRole('navigation', { name: 'Evidence queue pages' })).toContainText('of 178')
  await bulk(page).getByRole('button', { name: 'Show all evidence issues', exact: true }).click()
  await expect(review(page).getByRole('button', { name: 'Accept value', exact: true })).toBeEnabled()
  expect(state.evidenceReads.at(-1).group).toBeUndefined()
  await review(page).getByRole('button', { name: 'Accept value', exact: true }).click()
  await expect(review(page).getByRole('form', { name: 'Record evidence decision' })).toBeVisible()
  clean(state)
})

test('active jobs resume after leaving the evidence tab without starting another job', async ({ page }) => {
  const state = await open(page, { prepare(current) { const job = makeJob(); current.jobs[job.id] = job; current.evidence[71].bulk_review.active_job = job } })
  await expect(bulk(page).getByRole('progressbar')).toBeVisible()
  await scheduleArea(page, 'activities')
  await scheduleArea(page, 'evidence')
  await expect(bulk(page).getByRole('progressbar')).toBeVisible()
  complete(state)
  await expect(bulk(page)).toContainText('Bulk review finished with unresolved issues')
  expect(state.evidenceWrites).toEqual([])
  clean(state)
})

test('latest completed summary resumes only when its result revision matches the current review', async ({ page }) => {
  const state = await open(page, { prepare(current) { const job = makeJob(); current.jobs[job.id] = job; complete(current) } })
  await expect(bulk(page)).toContainText('Bulk review finished with unresolved issues')
  expect(state.evidenceReads).toHaveLength(1)
  await scheduleArea(page, 'activities')
  state.evidence[71].revision = 6
  await scheduleArea(page, 'evidence')
  await expect(bulk(page)).not.toContainText(/Bulk review complete|Bulk review finished with unresolved issues/)
  expect(state.jobReads).toEqual([])
  expect(state.evidenceWrites).toEqual([])
  clean(state)
})

test('a failed job poll preserves the job and Check progress retries GET without a second POST', async ({ page }) => {
  let unavailable = true
  const state = await open(page, { async poll({ route, reply, state: current }, id) { await reply(route, unavailable ? { detail: 'Temporary status outage' } : current.jobs[id], unavailable ? 503 : 200); return true } })
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect(bulk(page).getByRole('alert')).toContainText('The job may still be running')
  await expect(bulk(page).getByRole('button', { name: 'Accept verified values' })).toBeDisabled()
  unavailable = false
  complete(state)
  await bulk(page).getByRole('button', { name: 'Check progress', exact: true }).click()
  await expect(bulk(page)).toContainText('Bulk review finished with unresolved issues')
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.jobReads.length).toBeGreaterThanOrEqual(2)
  clean(state)
})

test('an unavailable start response recovers the saved active job through Reload review without another POST', async ({ page }) => {
  const state = await open(page, { async write({ state: current, route, reply }, body, project) {
    const job = makeJob(project, 'queued', body.mode)
    current.jobs[job.id] = job
    current.evidence[project].bulk_review.active_job = structuredClone(job)
    await reply(route, { detail: 'The request response was interrupted. Reload review to check saved progress.' }, 503)
    return true
  } })
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect(bulk(page).getByRole('alert')).toContainText('request response was interrupted')
  await expect(bulk(page).getByRole('button', { name: 'Accept verified values', exact: true })).toBeDisabled()
  await bulk(page).getByRole('button', { name: 'Reload review', exact: true }).click()
  await expect(bulk(page).getByRole('progressbar')).toBeVisible()
  complete(state)
  await expect(bulk(page)).toContainText('Bulk review finished with unresolved issues')
  expect(state.evidenceWrites).toHaveLength(1)
  clean(state)
})

test('a server-matched failed job without a result revision remains visible after reopening review', async ({ page }) => {
  const state = await open(page, { prepare(current) {
    const job = makeJob(71, 'failed')
    job.error_message = 'The configured provider could not complete verification.'
    current.evidence[71].bulk_review.latest_job = job
  } })
  await expect(bulk(page)).toContainText('Bulk review failed')
  await expect(bulk(page)).toContainText('The configured provider could not complete verification.')
  await scheduleArea(page, 'activities')
  await scheduleArea(page, 'evidence')
  await expect(bulk(page)).toContainText('Bulk review failed')
  expect(state.evidenceWrites).toEqual([])
  expect(state.jobReads).toEqual([])
  clean(state)
})

test('running jobs display server progress context counts without inventing final results', async ({ page }) => {
  const state = await open(page, { prepare(current) {
    const job = makeJob(71, 'running')
    // A persisted initial count must not mask newer worker progress.
    delete job.result_data.counts.unresolved
    Object.assign(job, { progress: 37, message: 'Checking source candidates' })
    job.result_data.progress_context = { counts: { processed: 4000, total: 10778, accepted_verified: 3900, skipped: 2 } }
    current.jobs[job.id] = job
    current.evidence[71].bulk_review.active_job = job
  } })
  await expect(bulk(page)).toContainText('4,000 of 10,778 issues processed')
  await expect(bulk(page).getByRole('progressbar')).toHaveAttribute('value', '37')
  await expect(bulk(page).getByLabel('Bulk review results')).toContainText('3,900')
  await expect(bulk(page).getByLabel('Bulk review results')).toContainText('Not available')
  await expect(bulk(page)).not.toContainText(/Bulk review complete|Bulk review finished with unresolved issues/)
  expect(state.evidenceWrites).toEqual([])
  clean(state)
})

test('actual worker phase and AI group progress remain distinct from processed issues', async ({ page }) => {
  const state = await open(page, { prepare(current) {
    const job = makeJob(71, 'running', 'ai_verified')
    job.result_data = { progress_context: {} }
    job.message = 'Checking the complete evidence queue and original sources.'
    job.progress = 10
    current.jobs[job.id] = job
    current.evidence[71].bulk_review.active_job = structuredClone(job)
  } })
  await expect(bulk(page)).toContainText('Checking the complete evidence queue')
  await expect(bulk(page)).not.toContainText('issues processed')
  await expect(bulk(page).getByLabel('Bulk review results')).toHaveCount(0)
  state.jobs[501].result_data.progress_context = { stage: 'ai_review', completed_groups: 12, total_groups: 36, batch_index: 1, batch_count: 3 }
  state.jobs[501].progress = 48
  await expect(bulk(page)).toContainText('12 of 36 conflict groups reviewed')
  await expect(bulk(page)).not.toContainText('12 of 36 issues')
  expect(state.evidenceWrites).toEqual([])
  clean(state)
})

test('queues whose citations need original file verification can run with zero preview eligibility', async ({ page }) => {
  const state = await open(page, { prepare(current) {
    Object.assign(current.evidence[71].bulk_review, { verified_unambiguous: 0, conflict_groups: 0, eligibility_rechecked_on_run: true })
  } })
  await expect(bulk(page)).toContainText('Source eligibility is checked during each run')
  await expect(bulk(page)).not.toContainText('Review the remaining issues individually')
  await expect(bulk(page).getByRole('button', { name: 'AI resolve & accept', exact: true })).toBeEnabled()
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect.poll(() => state.evidenceWrites.length).toBe(1)
  expect(state.evidenceWrites[0].body.mode).toBe('verified')
  clean(state)
})

test('retrying a failed job with the same durable ID reloads the completed attempt once', async ({ page }) => {
  const state = await open(page, { prepare(current) {
    const job = makeJob(71, 'failed')
    current.jobs[job.id] = job
    current.evidence[71].bulk_review.latest_job = structuredClone(job)
  } })
  await expect(bulk(page)).toContainText('Bulk review failed')
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect(bulk(page).getByRole('progressbar')).toBeVisible()
  const reads = state.evidenceReads.length
  complete(state)
  await expect(bulk(page)).toContainText('Bulk review finished with unresolved issues')
  await expect.poll(() => state.evidenceReads.length).toBe(reads + 1)
  await expect(bulk(page)).toContainText('revision 5')
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.jobReads).toContain(501)
  clean(state)
})

test('all issues resolved is distinguished from a run finishing with unresolved issues', async ({ page }) => {
  const state = await open(page)
  await bulk(page).getByRole('button', { name: 'AI resolve & accept', exact: true }).click()
  await expect.poll(() => state.evidenceWrites.length).toBe(1)
  const job = complete(state)
  job.result_data.counts.unresolved = 0
  job.result_data.unresolved_groups = []
  job.result_data.review_complete = true
  job.result_data.calculation_ready = true
  Object.assign(state.evidence[71].bulk_review, { latest_job: structuredClone(job), total_open: 0, verified_unambiguous: 0, conflict_groups: 0, unresolved_groups: [] })
  await expect(bulk(page)).toContainText('Bulk review complete')
  await expect(bulk(page)).not.toContainText('finished with unresolved')
  await expect(bulk(page)).toContainText('Schedule creation, calculation and baseline approval remain separate actions.')
  clean(state)
})

test('partial job failure preserves recorded counts and never reports review complete', async ({ page }) => {
  const state = await open(page)
  await bulk(page).getByRole('button', { name: 'AI resolve & accept', exact: true }).click()
  await expect.poll(() => state.evidenceWrites.length).toBe(1)
  complete(state, 71, 'failed')
  await expect(bulk(page)).toContainText('Bulk review failed')
  await expect(bulk(page)).toContainText('4,000')
  await expect(bulk(page)).toContainText('AI provider unavailable during review.')
  await expect(bulk(page)).not.toContainText(/Bulk review complete|Bulk review finished with unresolved issues/)
  await expect(bulk(page).getByRole('progressbar')).toHaveCount(0)
  clean(state)
})

test('stale bulk start does not retry and disables all review mutations until explicit reload', async ({ page }) => {
  const state = await open(page, { async write({ route, reply }) { await reply(route, { code: 'evidence_revision_conflict', detail: 'Revision mismatch.' }, 409); return true } })
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect(review(page)).toContainText('Evidence changed in another session.')
  await expect(bulk(page).getByRole('button', { name: 'Accept verified values', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('button', { name: 'Accept value', exact: true })).toBeDisabled()
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.jobReads).toEqual([])
  clean(state)
})

for (const guard of ['permission', 'history', 'stale', 'unprepared', 'ai-unavailable']) test(`bulk acceptance preserves the ${guard} guard`, async ({ page }) => {
  const state = await harness(page, { history: guard === 'history', prepare(current) {
    const data = current.evidence[71]
    if (guard === 'permission') data.permissions.can_review = false
    if (guard === 'stale') data.readiness.stale = true
    if (guard === 'unprepared') { data.graph_id = null; data.revision = 0; data.issues = []; data.facts = [] }
    if (guard === 'ai-unavailable') { data.bulk_review.ai_available = false; data.bulk_review.ai_reason = 'No enabled AI model for this project.' }
  } })
  if (guard === 'history') await scheduleVersion(page, '90')
  await scheduleArea(page, 'evidence')
  await expect(bulk(page).getByRole('button', { name: 'AI resolve & accept', exact: true })).toBeDisabled()
  if (guard === 'ai-unavailable') {
    await expect(bulk(page).getByRole('button', { name: 'Accept verified values', exact: true })).toBeEnabled()
    await expect(bulk(page)).toContainText('No enabled AI model')
  } else await expect(bulk(page).getByRole('button', { name: 'Accept verified values', exact: true })).toBeDisabled()
  expect(state.evidenceWrites).toEqual([])
  clean(state)
})

test('late job response after switching projects cannot replace the new project review', async ({ page }) => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const state = await open(page, { async poll({ route, reply, state: current }, id) { await gate; await reply(route, current.jobs[id]).catch(() => {}); return true } })
  const otherProject = state.records[18].planningProject.id
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect.poll(() => state.jobReads.length).toBe(1)
  await page.locator('summary[aria-label="More project actions"]').click()
  await page.getByRole('combobox', { name: 'Active Project', exact: true }).fill('Grid Operations')
  await page.getByRole('option').filter({ hasText: 'Grid Operations' }).click()
  await scheduleArea(page, 'evidence')
  await expect.poll(() => state.evidenceReads.at(-1)?.project).toBe(otherProject)
  complete(state)
  release()
  await expect(bulk(page)).not.toContainText(/Bulk review complete|Bulk review finished with unresolved issues/)
  await expect(bulk(page).getByRole('button', { name: 'Accept verified values', exact: true })).toBeEnabled()
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect.poll(() => state.evidenceWrites.length).toBe(2)
  expect(state.evidenceWrites[1].project).toBe(otherProject)
  expect(state.evidenceWrites[1].body.revision).toBe(4)
  clean(state)
})

test('a terminal result older than a newly loaded review revision cannot replace current evidence', async ({ page }) => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const state = await open(page, { async poll({ route, reply, state: current }, id) { await gate; await reply(route, current.jobs[id]); return true } })
  await bulk(page).getByRole('button', { name: 'Accept verified values', exact: true }).click()
  await expect.poll(() => state.jobReads.length).toBe(1)
  const oldResult = structuredClone(complete(state))
  state.evidence[71].revision = 6
  state.evidence[71].bulk_review.latest_job = null
  await review(page).getByRole('navigation', { name: 'Evidence queue pages' }).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(bulk(page)).toContainText('revision 6')
  state.jobs[501] = oldResult
  const reads = state.evidenceReads.length
  release()
  await expect(bulk(page)).toContainText('older review revision')
  await expect(bulk(page)).not.toContainText(/Bulk review complete|Bulk review finished with unresolved issues/)
  expect(state.evidenceReads).toHaveLength(reads)
  expect(state.evidenceWrites).toHaveLength(1)
  clean(state)
})

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }, { name: 'dark', width: 1440, height: 900 }]) test(`bulk review ${viewport.name} keeps compact accessible controls and loads IBM Plex`, async ({ page }, testInfo) => {
  await page.setViewportSize(viewport)
  const state = await open(page)
  if (viewport.name === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'))
  const font = await page.evaluate(async () => { const faces = await document.fonts.load('400 14px "IBM Plex Sans"'); await document.fonts.ready; return { loaded: faces.some(face => face.status === 'loaded'), checked: document.fonts.check('400 14px "IBM Plex Sans"') } })
  expect(font).toEqual({ loaded: true, checked: true })
  const dimensions = await bulk(page).evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height, viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.width).toBeLessThanOrEqual(viewport.width)
  expect(dimensions.scroll).toBeLessThanOrEqual(viewport.width)
  if (viewport.name !== 'mobile') expect(dimensions.height).toBeLessThan(300)
  const violations = (await new AxeBuilder({ page }).include('.per-bulk').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))
  expect(violations).toEqual([])
  await testInfo.attach(`bulk-${viewport.name}.png`, { body: await bulk(page).screenshot(), contentType: 'image/png' })
  expect(state.evidenceWrites).toEqual([])
  clean(state)
})
