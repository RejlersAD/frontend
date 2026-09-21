import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { primaveraScheduleHarness } from '../fixtures/primavera-schedule.fixture.js'
import { scheduleArea, scheduleVersion } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const review = page => page.getByRole('region', { name: 'Document evidence review', exact: true })
const source = (filename, row, value, url = null) => ({ file_id: row, filename, document_version: 2, sha256: 'synthetic-file-hash', locator: { sheet: 'Activities', row, cell: `D${row}` }, excerpt: `Planned duration: ${value} working days`, preview_url: url })
const fact = (id, value, sources = []) => ({ id, entity_id: 'activity-1', entity_name: 'Pressure test', property: 'duration', value, unit: 'working_days', status: 'unreviewed', provenance_type: 'document_evidence', sources, input_schema: { type: 'number', minimum: 0, title: 'Planned duration' }, allowed_actions: ['accept', 'reject', 'correct'] })
function envelope() {
  return {
    revision: 4, master_revision: 6, graph_id: 'graph-test', permissions: { can_review: true, can_supply_inputs: true, can_link: true }, capabilities: { correct: true, link: true, source_preview: true }, warnings: ['A source calendar still requires review.'],
    readiness: { calculation: { ready: false, reasons: [{ code: 'conflict', message: 'Resolve conflicting duration values.' }] }, baseline: { eligible: false, reasons: ['Calculation and explicit approval are required.'] } },
    issues: [{ id: 'conflict-1', kind: 'conflict', title: 'Conflicting planned durations', message: 'Two sources report different durations for Pressure test.', status: 'open', blocks: ['calculation', 'baseline'], candidate_fact_ids: ['duration-a', 'duration-b'], affected_entities: [{ id: 'activity-1', name: 'Pressure test' }], allowed_actions: ['accept', 'reject', 'correct'] },
      { id: 'missing-1', kind: 'missing_information', title: 'Completion date not specified', message: 'Provide an approved planning date or add source evidence.', status: 'open', blocks: ['calculation'], candidate_fact_ids: ['finish-missing'], allowed_actions: ['correct'] }],
    facts: [fact('duration-a', 8, [source('Scope.xlsx', 12, 8, '/authorized-source/12/')]), fact('duration-b', 12, [source('Schedule.xlsx', 23, 12, 'javascript:alert(1)')]), { ...fact('finish-missing', null), property: 'finish_date', unit: null, input_schema: { type: 'string', format: 'date', title: 'Reviewed finish date' } }],
    decisions: [], pagination: { offset: 0, limit: 100, total: 2, has_more: false, next_offset: null },
  }
}
async function harness(page, options = {}) {
  const state = await primaveraScheduleHarness(page, {
    history: options.history,
    prepare(current) { current.evidence = envelope(); current.evidenceReads = []; current.evidenceWrites = []; options.prepare?.(current) },
    async handleRequest(context) {
      const { path, route, reply, state: current, url } = context
      if (await options.handleRequest?.(context)) return true
      if (path.endsWith('/export-capabilities/') && options.exportAdapters) {
        current.exportReads = (current.exportReads || 0) + 1
        await reply(route, { schema_version: '1.0', adapters: options.exportAdapters })
        return true
      }
      if (!path.includes('/evidence-review/')) return false
      if (route.request().method() === 'GET') {
        current.evidenceReads.push(Object.fromEntries(url.searchParams))
        await reply(route, options.read ? options.read(current, url) : current.evidence)
        return true
      }
      const body = route.request().postDataJSON()
      current.evidenceWrites.push({ path, body })
      if (options.write) return options.write(context, body)
      current.evidence.revision += 1
      if (path.endsWith('/decisions/')) {
        current.evidence.decisions.push({ id: current.evidence.revision, ...body, actor_name: 'Maya Hassan' })
        const issue = current.evidence.issues.find(item => item.id === body.issue_id)
        if (issue) issue.status = 'resolved'
      }
      await reply(route, current.evidence)
      return true
    },
  })
  return state
}
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]) }

test('Evidence tab loads only when opened, compares verbatim citations and never accepts a conflict automatically', async ({ page }) => {
  const state = await harness(page)
  expect(state.evidenceReads).toEqual([])
  await scheduleArea(page, 'evidence')
  await expect(review(page).getByRole('region', { name: 'Calculation readiness', exact: true })).toContainText('Not ready to calculate')
  await expect(review(page).getByRole('region', { name: 'Baseline readiness', exact: true })).toContainText('Not eligible for baseline')
  await expect(review(page).getByRole('article')).toHaveCount(2)
  await expect(review(page)).toContainText('Planned duration: 8 working days')
  await expect(review(page)).toContainText('Planned duration: 12 working days')
  await expect(review(page)).toContainText('Activities · Row 12 · D12 · Version 2')
  await expect(review(page).getByRole('button', { name: 'Accept value', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('button', { name: 'Create schedule from accepted inputs', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('link', { name: 'Open source', exact: true })).toHaveCount(1)
  await expect(review(page).getByRole('link', { name: 'Open source', exact: true })).toHaveAttribute('href', /\/authorized-source\/12\/$/)
  expect(state.evidenceWrites).toEqual([])
  expect(state.writes).toEqual([])
  expect((await new AxeBuilder({ page }).include('.planning-evidence-review').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.screenshot({ path: '../artifacts/planning-evidence-review-desktop.png' })
  clean(state)
})

test('accepting a selected conflict value requires a reason and sends the graph revision without changing the schedule', async ({ page }) => {
  const state = await harness(page)
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('article').first().getByRole('button', { name: 'Select this value' }).click()
  await review(page).getByRole('button', { name: 'Accept value', exact: true }).click()
  await expect(review(page).getByRole('button', { name: 'Save decision', exact: true })).toBeDisabled()
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Accepted against signed scope revision 2.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page)).toContainText('Review decision saved.')
  expect(state.evidenceWrites[0].body).toEqual({ revision: 4, action: 'accept', issue_id: 'conflict-1', fact_id: 'duration-a', reason: 'Accepted against signed scope revision 2.' })
  expect(state.records[17].simplePlan).toEqual(original)
  expect(state.writes).toEqual([])
  clean(state)
})

test('missing dates remain Not Specified until an explicit typed planning value and reason are supplied', async ({ page }) => {
  const state = await harness(page)
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('combobox', { name: 'Evidence issue filter', exact: true }).selectOption('missing')
  await expect(review(page).getByRole('article')).toContainText('Not Specified')
  await review(page).getByRole('button', { name: 'Correct / supply value', exact: true }).click()
  await review(page).getByLabel('Reviewed finish date', { exact: true }).fill('2026-12-20')
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Project manager confirmed the phase launch date.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page)).toContainText('Review decision saved.')
  expect(state.evidenceWrites[0].body).toMatchObject({ action: 'correct', fact_id: 'finish-missing', value: '2026-12-20', revision: 4 })
  expect(state.writes).toEqual([])
  clean(state)
})

test('a stale decision is not retried or overwritten; reload is explicit and clears the old decision form', async ({ page }) => {
  const state = await harness(page, { async write({ reply, route, state: current }) {
    current.evidence.revision = 5
    await reply(route, { detail: 'Revision mismatch.' }, 409)
    return true
  } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('article').first().getByRole('button', { name: 'Select this value' }).click()
  await review(page).getByRole('button', { name: 'Reject value', exact: true }).click()
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Superseded by signed schedule.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page).getByRole('alert')).toContainText('Evidence changed in another session.')
  await expect(review(page).getByRole('button', { name: 'Reject value', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('form', { name: 'Record evidence decision' })).toHaveCount(0)
  expect(state.evidenceWrites).toHaveLength(1)
  await review(page).getByRole('button', { name: 'Reload review', exact: true }).click()
  await expect(review(page).getByRole('alert')).toHaveCount(0)
  await expect.poll(() => state.evidenceReads.length).toBe(2)
  expect(state.evidenceWrites).toHaveLength(1)
  clean(state)
})

test('pagination reaches every issue and refresh is an explicit graph action', async ({ page }) => {
  const state = await harness(page, { read(current, url) {
    const data = structuredClone(current.evidence)
    const offset = Number(url.searchParams.get('offset') || 0)
    data.issues = [data.issues[offset]]
    data.pagination = { offset, limit: 1, total: 2, has_more: offset === 0, next_offset: offset === 0 ? 1 : null }
    return data
  } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('navigation', { name: 'Evidence queue pages' }).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(review(page).getByRole('region', { name: 'Selected evidence issue' })).toContainText('Completion date not specified')
  expect(state.evidenceReads[1].offset).toBe('1')
  expect(state.evidenceWrites).toEqual([])
  await review(page).getByRole('button', { name: 'Refresh evidence', exact: true }).click()
  await expect(review(page)).toContainText('Evidence refreshed.')
  expect(state.evidenceWrites[0]).toMatchObject({ path: expect.stringContaining('/evidence-review/refresh/'), body: { revision: 4 } })
  expect(state.writes).toEqual([])
  clean(state)
})

test('identity links require exact chosen facts and a recorded reason', async ({ page }) => {
  const state = await harness(page, { prepare(current) {
    const identity = { ...fact('identity-a', 'Pressure test'), property: 'identity', input_schema: { type: 'string' }, allowed_actions: ['accept', 'reject', 'link'] }
    current.evidence.facts = [identity, { ...identity, id: 'identity-b', entity_id: 'source-activity-9', entity_name: 'Pressure test - source B' }]
    current.evidence.issues = [{ id: 'identity-review', kind: 'unreviewed', title: 'Review activity identity', status: 'open', candidate_fact_ids: ['identity-a'], allowed_actions: ['accept', 'reject', 'link'] }]
    current.evidence.pagination.total = 1
  } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('button', { name: 'Link fact', exact: true }).click()
  await review(page).getByLabel('Target fact ID', { exact: true }).fill('identity-b')
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Matching explicit activity identifiers in both sources.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page)).toContainText('Review decision saved.')
  expect(state.evidenceWrites[0].body).toMatchObject({ action: 'link', fact_id: 'identity-a', target_fact_id: 'identity-b', revision: 4 })
  expect(state.writes).toEqual([])
  clean(state)
})

test('saved versions show current project evidence read only and unsupported structured corrections remain explicit', async ({ page }) => {
  const state = await harness(page, { history: true, prepare(current) {
    current.evidence.facts[2].input_schema = { type: 'array', items: { type: 'object' } }
  } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('combobox', { name: 'Evidence issue filter', exact: true }).selectOption('missing')
  await expect(review(page)).toContainText('Its editor is not yet available in this review view')
  await expect(review(page).getByRole('button', { name: 'Correct / supply value', exact: true })).toBeDisabled()
  await scheduleVersion(page, '90')
  await expect(review(page)).toContainText('Read only. Evidence below belongs to the current project review')
  await expect(review(page).getByRole('button', { name: 'Refresh evidence', exact: true })).toBeDisabled()
  await expect(review(page).getByRole('button', { name: 'Correct / supply value', exact: true })).toHaveCount(0)
  expect(state.evidenceWrites).toEqual([])
  clean(state)
})

const dependencySchema = { type: 'array', items: { type: 'object', required: ['predecessor_id', 'type', 'lag', 'lag_unit'], properties: { predecessor_id: { type: 'string' }, type: { type: 'string', enum: ['FS', 'SS', 'FF', 'SF'] }, lag: { type: 'number' }, lag_unit: { type: 'string', enum: ['calendar_days', 'hours', 'working_days'] } } } }
function onlyStructuredIssue(current, property, inputSchema) {
  current.evidence.facts = [{ ...fact(`${property}-missing`, null), property, unit: null, input_schema: inputSchema, allowed_actions: ['correct'] }]
  current.evidence.issues = [{ id: `${property}-issue`, kind: 'missing_input', title: `${property} not specified`, field: property, status: 'open', candidate_fact_ids: [`${property}-missing`], allowed_actions: ['correct'] }]
  current.evidence.pagination.total = 1
}

test('dependency editor never supplies default relationships or lag and requires explicit independence confirmation', async ({ page }) => {
  const state = await harness(page, { prepare(current) { onlyStructuredIssue(current, 'dependencies', dependencySchema) } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('button', { name: 'Correct / supply value', exact: true }).click()
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Confirmed by the responsible planner.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page).getByRole('alert')).toContainText('explicitly confirm this activity has no predecessors')
  expect(state.evidenceWrites).toEqual([])
  await review(page).getByRole('button', { name: 'Add predecessor', exact: true }).click()
  await expect(review(page).getByLabel('type', { exact: true })).toHaveValue('')
  await expect(review(page).getByLabel('lag', { exact: true })).toHaveValue('')
  await expect(review(page).getByLabel('lag unit', { exact: true })).toHaveValue('')
  await review(page).getByRole('button', { name: 'Remove predecessor 1', exact: true }).click()
  await review(page).getByRole('checkbox', { name: 'I confirm this activity has no predecessors.' }).check()
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page)).toContainText('Review decision saved.')
  expect(state.evidenceWrites[0].body).toMatchObject({ action: 'correct', fact_id: 'dependencies-missing', value: [] })
  expect(state.writes).toEqual([])
  clean(state)
})

test('calendar editor requires reviewed weekdays hours timezone and explicit exception choices', async ({ page }) => {
  const schema = { type: 'object', required: ['working_weekdays', 'hours_per_day', 'timezone', 'exceptions'], properties: {
    working_weekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }, hours_per_day: { type: 'number', exclusiveMinimum: 0, maximum: 24 }, timezone: { type: 'string' },
    exceptions: { type: 'array', items: { type: 'object', required: ['date', 'is_working'], properties: { date: { type: 'string', format: 'date' }, is_working: { type: 'boolean' }, working_hours: { type: 'number', minimum: 0, maximum: 24 } } } },
  } }
  const state = await harness(page, { prepare(current) { onlyStructuredIssue(current, 'calendar', schema) } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('button', { name: 'Correct / supply value', exact: true }).click()
  await expect(review(page).getByRole('checkbox', { name: 'Monday', exact: true })).not.toBeChecked()
  await expect(review(page).getByLabel('Working hours per day', { exact: true })).toHaveValue('')
  await expect(review(page).getByLabel('Calendar timezone (IANA)', { exact: true })).toHaveValue('')
  await review(page).getByRole('checkbox', { name: 'Monday', exact: true }).check()
  await review(page).getByRole('checkbox', { name: 'Tuesday', exact: true }).check()
  await review(page).getByLabel('Working hours per day', { exact: true }).fill('7.5')
  await review(page).getByLabel('Calendar timezone (IANA)', { exact: true }).fill('Asia/Dubai')
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Approved specialist work calendar.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page).getByRole('alert')).toContainText('explicitly confirm there are no exceptions')
  expect(state.evidenceWrites).toEqual([])
  await review(page).getByRole('button', { name: 'Add calendar exception', exact: true }).click()
  await review(page).getByLabel('date', { exact: true }).fill('2026-12-02')
  await review(page).getByLabel('is working', { exact: true }).selectOption('false')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page)).toContainText('Review decision saved.')
  expect(state.evidenceWrites[0].body.value).toEqual({ working_weekdays: [0, 1], hours_per_day: 7.5, timezone: 'Asia/Dubai', exceptions: [{ date: '2026-12-02', is_working: false }] })
  expect(state.writes).toEqual([])
  clean(state)
})

test('export support loads on request and distinguishes implemented formats from unvalidated and unavailable native exports', async ({ page }) => {
  const state = await harness(page, { exportAdapters: [
    { format: 'json', name: 'RADAI JSON', status: 'implemented', baseline: true, limitations: ['RADAI schema; not a native Primavera file.'], traceability: 'embedded' },
    { format: 'xer', name: 'Primavera P6 XER', status: 'legacy_unvalidated', baseline: false, limitations: ['No validated P6 round-trip; unavailable for document-driven plans.'], traceability: 'not included' },
    { format: 'primavera_xml', name: 'Primavera XML', status: 'unavailable', baseline: false, limitations: ['No implemented or validated adapter.'] },
  ] })
  await scheduleArea(page, 'evidence')
  await expect(review(page).getByRole('heading', { name: 'Evidence review', exact: true })).toBeVisible()
  expect(state.exportReads || 0).toBe(0)
  await review(page).getByText('Export format support', { exact: true }).click()
  const xer = review(page).getByRole('row').filter({ hasText: 'Primavera P6 XER' })
  await expect(xer).toContainText('legacy unvalidated')
  await expect(xer).toContainText('Not supported')
  await expect(xer).toContainText('No validated P6 round-trip')
  await expect(review(page).getByRole('row').filter({ hasText: 'Primavera XML' })).toContainText('unavailable')
  expect(state.exportReads).toBe(1)
  expect(state.evidenceWrites).toEqual([])
  expect(state.writes).toEqual([])
  clean(state)
})

test('activity source navigation uses its recorded fact ID and opens the matching evidence issue', async ({ page }) => {
  const state = await harness(page, { prepare(current) {
    for (const record of Object.values(current.records)) record.simplePlan.tasks[0].evidence_fact_id = 'finish-missing'
  } })
  await page.getByRole('region', { name: 'Master schedule workspace', exact: true }).getByRole('button', { name: state.records[17].simplePlan.tasks[0].title, exact: true }).click()
  await page.getByRole('complementary', { name: 'Activity details', exact: true }).getByRole('button', { name: 'Review source evidence', exact: true }).click()
  await expect(review(page).getByRole('region', { name: 'Selected evidence issue', exact: true })).toContainText('Completion date not specified')
  expect(state.evidenceReads[0].fact_id).toBe('finish-missing')
  expect(state.evidenceWrites).toEqual([])
  expect(state.writes).toEqual([])
  clean(state)
})

test('accepted knowledge creates a schedule only through an explicit revision-checked action with no calculation or approval claim', async ({ page }) => {
  const state = await harness(page, {
    prepare(current) { current.evidence.readiness.calculation = { ready: true, reasons: [] }; current.evidence.issues = []; current.evidence.pagination.total = 0 },
    async write({ path, reply, route }, body) {
      expect(path).toContain('/evidence-review/materialize/')
      expect(body).toEqual({ revision: 4, activate: true, master_revision: 6 })
      await reply(route, { schedule_version_id: 92, created: true, policy: 'document_driven', calculated: false, message: 'Schedule version 92 created. Calculate and review before approval.' })
      return true
    },
  })
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleArea(page, 'evidence')
  const create = review(page).getByRole('button', { name: 'Create schedule from accepted inputs', exact: true })
  await expect(create).toBeEnabled()
  expect(state.evidenceWrites).toEqual([])
  await create.click()
  await expect(page.getByRole('region', { name: 'Master schedule workspace', exact: true })).toBeVisible()
  await expect(review(page)).toHaveCount(0)
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.records[17].simplePlan).toEqual(original)
  expect(state.writes).toEqual([])
  clean(state)
})

test('unsupported evidence acceptance displays the server reason without reporting a revision conflict', async ({ page }) => {
  const state = await harness(page, { async write({ route, reply }) {
    await reply(route, { error: 'This value has no verified document fragment. Supply it as an approved planning input.', code: 'evidence_not_supported' }, 409)
    return true
  } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('article').first().getByRole('button', { name: 'Select this value' }).click()
  await review(page).getByRole('button', { name: 'Accept value', exact: true }).click()
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Review attempted from the displayed source.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page).getByRole('alert')).toContainText('This value has no verified document fragment.')
  await expect(review(page).getByRole('alert')).not.toContainText('another session')
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.writes).toEqual([])
  clean(state)
})

test('date constraint editor preserves the explicit type and date and never infers an unconstrained activity', async ({ page }) => {
  const schema = { type: 'array', items: { type: 'object', required: ['type', 'date'], properties: { type: { type: 'string', enum: ['start_no_earlier', 'start_no_later', 'finish_no_later', 'must_start', 'must_finish'] }, date: { type: 'string', format: 'date' } } } }
  const state = await harness(page, { prepare(current) { onlyStructuredIssue(current, 'constraints', schema) } })
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('button', { name: 'Correct / supply value', exact: true }).click()
  await expect(review(page).getByRole('checkbox', { name: 'Confirm no date constraints', exact: true })).not.toBeChecked()
  await review(page).getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Contract requires this exact handover date.')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page).getByRole('alert')).toContainText('explicitly confirm there are no date constraints')
  expect(state.evidenceWrites).toEqual([])
  await review(page).getByRole('button', { name: 'Add date constraint', exact: true }).click()
  await expect(review(page).getByLabel('type', { exact: true })).toHaveValue('')
  await expect(review(page).getByLabel('date', { exact: true })).toHaveValue('')
  await review(page).getByLabel('type', { exact: true }).selectOption('must_finish')
  await review(page).getByLabel('date', { exact: true }).fill('2026-12-20')
  await review(page).getByRole('button', { name: 'Save decision', exact: true }).click()
  await expect(review(page)).toContainText('Review decision saved.')
  expect(state.evidenceWrites[0].body.value).toEqual([{ type: 'must_finish', date: '2026-12-20' }])
  expect(state.writes).toEqual([])
  clean(state)
})

test('accepted evidence opens the exact active version in Master Schedule and calculation preserves its revision boundary', async ({ page }) => {
  let activated = false
  let canonical
  const state = await harness(page, {
    prepare(current) {
      current.evidence.readiness.calculation = { ready: true, reasons: [] }; current.evidence.issues = []; current.evidence.pagination.total = 0
      canonical = structuredClone(current.records[17].simplePlan)
      Object.assign(canonical, { canonical_version: true, version_id: 192, master_revision: 7, revision: 28431, viewing_history: false,
        permissions: { can_edit: false, can_calculate: true, can_validate: true, can_submit: true, can_select_version: true },
        versions: [{ id: 192, version_number: 1, status: 'draft', label: 'Accepted evidence v1' }] })
      canonical.tasks[0].title = 'Pressure test from accepted source'
    },
    async write({ reply, route }, body) {
      expect(body).toEqual({ revision: 4, activate: true, master_revision: 6 })
      activated = true
      await reply(route, { schedule_version_id: 192, master_revision: 7, activated: true, created: true, policy: 'document_driven', calculated: false })
      return true
    },
    async handleRequest({ path, reply, route, state: current }) {
      if (path.endsWith('/simple-plan/') && route.request().method() === 'GET' && activated) { await reply(route, canonical); return true }
      if (path.endsWith('/simple-plan/calculate/')) {
        const body = route.request().postDataJSON()
        expect(body).toEqual({ revision: 28431 })
        current.writes.push({ path, data: body })
        canonical = { ...canonical, revision: 29702, calculation_available: true }
        await reply(route, canonical)
        return true
      }
      return false
    },
  })
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleArea(page, 'evidence')
  await review(page).getByRole('button', { name: 'Create schedule from accepted inputs', exact: true }).click()
  const workspace = page.getByRole('region', { name: 'Master schedule workspace', exact: true })
  await expect(workspace.getByRole('button', { name: 'Pressure test from accepted source', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Schedule Controls', exact: true })).toHaveCount(0)
  await expect(workspace.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await workspace.getByRole('button', { name: 'Calculate schedule', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Schedule calculation completed.' })).toBeVisible()
  expect(state.evidenceWrites).toHaveLength(1)
  expect(state.writes).toHaveLength(1)
  expect(state.records[17].simplePlan).toEqual(original)
  expect(state.requests.some(request => request.path.endsWith('/schedule-versions/192/workspace/'))).toBe(false)
  clean(state)
})
