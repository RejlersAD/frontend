import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { scheduleAction, scheduleArea, scheduleMenu, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const generation = page => page.getByRole('dialog', { name: 'Generate project plan', exact: true })
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]) }
const envelope = () => ({ master_revision: 7, builds: [], permissions: { can_preview: true, can_apply: true }, options: { graph_revision: 11, profile_selection_revision: 4, profile: { profile_id: 8, name: 'Reviewed delivery policy', profile_version: 2, valid: true }, deliverables: [{ entity_id: 'deliverable-1', name: 'Pump package', fact_id: 'source-1' }], source_activities: [{ entity_id: 'source-2', name: 'Factory acceptance test', fact_id: 'fact-2' }], dependency_rules: [{ id: 'rule-1', kind: 'dependency', value: { predecessor_code: 'PUMP', successor_code: 'TEST' } }] } })
const preview = () => ({ id: 81, revision: 1, fingerprint: 'a'.repeat(64), status: 'preview', ready_to_apply: true, summary: { activities: 1, relationships: 0 }, issues: [], plan: { wbs: [{ id: 'wbs-1', name: 'Pump package' }], activities: [{ id: 'activity-1', name: 'Pump package IFR', duration: { value: 8, unit: 'working_days' }, responsible_role: 'Equipment engineer', start_date: null, finish_date: null, workflow_stage_code: 'IFR', property_lineage: { name: { type: 'document', fact_ids: ['source-1'] }, duration: { type: 'approved_rule', rule_id: 'profile-duration-IFR', profile_version: 2 } } }], relationships: [], resources: [], risks: [], project_inputs: {} } })

async function buildHarness(page, options = {}) {
  return masterScheduleHarness(page, { prepare(state) { state.buildReads = []; state.buildWrites = []; state.buildEnvelope = envelope(); options.prepare?.(state) }, async handleRequest(context) {
    if (await options.handleRequest?.(context)) return true
    const { path, route, reply, state } = context
    if (!path.includes('/planning-builds/')) return false
    if (route.request().method() === 'GET') { state.buildReads.push(path); await reply(route, state.buildEnvelope); return true }
    const body = route.request().postDataJSON(); state.buildWrites.push({ path, body })
    if (options.write) return options.write(context, body)
    await reply(route, preview()); return true
  } })
}

test('L1 L2 and L3 filter one schedule without changing dates, timeline or saved work', async ({ page }) => {
  const state = await masterScheduleHarness(page)
  const original = structuredClone(state.records[17].simplePlan)
  const grid = page.getByRole('region', { name: 'Schedule activities and Gantt', exact: true })
  const axis = grid.locator('.p6-timescale')
  const dates = await axis.evaluate(element => ({ start: element.dataset.startDate, finish: element.dataset.finishDate }))
  const taskCount = await grid.locator('[data-row-kind="task"]').count()
  await scheduleWorkspace(page).getByLabel('Schedule detail level', { exact: true }).selectOption('project')
  await expect(grid.locator('.p6-rows > [role="row"]')).toHaveCount(1)
  await expect(grid.locator('[data-row-kind="task"]')).toHaveCount(0)
  await scheduleWorkspace(page).getByLabel('Schedule detail level', { exact: true }).selectOption('wbs')
  expect(await grid.locator('.p6-rows > [role="row"]').count()).toBeGreaterThan(1)
  await expect(grid.locator('[data-row-kind="task"]')).toHaveCount(0)
  await scheduleWorkspace(page).getByLabel('Schedule detail level', { exact: true }).selectOption('activities')
  await expect(grid.locator('[data-row-kind="task"]')).toHaveCount(taskCount)
  expect(await axis.evaluate(element => ({ start: element.dataset.startDate, finish: element.dataset.finishDate }))).toEqual(dates)
  expect(state.records[17].simplePlan).toEqual(original); expect(state.writes).toEqual([]); clean(state)
})

test('generation previews only explicitly selected accepted scope and rule bindings without applying it', async ({ page }) => {
  const state = await buildHarness(page)
  expect(state.buildReads).toEqual([])
  await scheduleAction(page, 'Generate project plan')
  await expect(generation(page).getByRole('button', { name: 'Preview generated plan', exact: true })).toBeDisabled()
  await generation(page).getByRole('checkbox', { name: 'Pump package deliverable-1', exact: true }).check()
  await generation(page).getByText('Approved dependency rule bindings', { exact: true }).click()
  await generation(page).getByLabel('Rule endpoint PUMP', { exact: true }).selectOption('deliverable-1')
  await generation(page).getByText('Confirm independent starting work', { exact: true }).click()
  await generation(page).getByRole('checkbox', { name: 'Pump package has no external predecessor', exact: true }).check()
  await generation(page).getByLabel('Planning reason', { exact: true }).fill('Scope and profile reviewed for equipment package planning.')
  await generation(page).getByRole('button', { name: 'Preview generated plan', exact: true }).click()
  await expect(generation(page).getByRole('region', { name: 'Generated plan preview', exact: true })).toContainText('Pump package IFR')
  expect(state.buildWrites).toHaveLength(1)
  expect(state.buildWrites[0].body).toEqual({ evidence_revision: 11, profile_selection_revision: 4, options: { deliverable_entity_ids: ['deliverable-1'], source_activity_entity_ids: [], dependency_bindings: { PUMP: 'deliverable-1' }, independent_entity_ids: ['deliverable-1'] }, reason: 'Scope and profile reviewed for equipment package planning.' })
  await generation(page).getByText('Planning basis', { exact: true }).click()
  await expect(generation(page)).toContainText('Approved rule')
  await expect(generation(page)).toContainText('Source document')
  expect((await new AxeBuilder({ page }).include('.planning-context-drawer').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  expect(state.writes).toEqual([]); clean(state)
})

test('applying a reviewed build uses its fingerprint and master revision and returns to the same canvas', async ({ page }) => {
  const state = await buildHarness(page, { async write({ path, route, reply }, body) {
    if (path.endsWith('/apply/')) { expect(body.fingerprint).toBe('a'.repeat(64)); expect(body.master_revision).toBe(7); await reply(route, { schedule_version_id: 91, activated: true, master_revision: 8 }); return true }
    await reply(route, preview()); return true
  } })
  await scheduleAction(page, 'Generate project plan')
  await generation(page).getByRole('checkbox', { name: 'Pump package deliverable-1', exact: true }).check()
  await generation(page).getByLabel('Planning reason', { exact: true }).fill('Reviewed package plan.')
  await generation(page).getByRole('button', { name: 'Preview generated plan', exact: true }).click()
  expect(state.buildWrites).toHaveLength(1)
  await generation(page).getByRole('button', { name: 'Apply reviewed plan', exact: true }).click()
  await expect(generation(page)).toHaveCount(0)
  await expect(scheduleWorkspace(page)).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Schedule Controls', exact: true })).toHaveCount(0)
  expect(state.buildWrites).toHaveLength(2); expect(state.writes).toEqual([]); clean(state)
})

test('missing build inputs block apply and stale build rejection never retries with a newer revision', async ({ page }) => {
  let blockApply = true
  const state = await buildHarness(page, { async write({ path, route, reply }) {
    if (path.endsWith('/apply/')) { await reply(route, { detail: 'Accepted evidence changed. Generate and review a new preview.', code: 'planning_build_stale' }, 409); return true }
    const build = preview(); build.ready_to_apply = !blockApply; build.issues = blockApply ? [{ code: 'calendar_missing', message: 'Working calendar is Not Specified.', severity: 'error', blocks: ['apply'] }] : []
    await reply(route, build); return true
  } })
  await scheduleAction(page, 'Generate project plan')
  await generation(page).getByRole('checkbox', { name: 'Pump package deliverable-1', exact: true }).check()
  await generation(page).getByLabel('Planning reason', { exact: true }).fill('Review required inputs.')
  await generation(page).getByRole('button', { name: 'Preview generated plan', exact: true }).click()
  await expect(generation(page)).toContainText('Working calendar is Not Specified.')
  await expect(generation(page).getByRole('button', { name: 'Apply reviewed plan', exact: true })).toBeDisabled()
  blockApply = false
  await generation(page).getByRole('button', { name: 'Preview generated plan', exact: true }).click()
  await generation(page).getByRole('button', { name: 'Apply reviewed plan', exact: true }).click()
  await expect(generation(page).getByRole('alert')).toContainText('Accepted evidence changed')
  expect(state.buildWrites.filter(item => item.path.endsWith('/apply/'))).toHaveLength(1)
  expect(state.writes).toEqual([]); clean(state)
})

test('MSPDI bundle download shows its verification boundary and uses the current version', async ({ page }) => {
  const downloads = []
  const state = await masterScheduleHarness(page, { decorateSnapshot(plan) { return { ...plan, version_id: 91 } }, async handleRequest({ path, url, route, reply }) {
    if (path.endsWith('/schedule-versions/91/export-capabilities/')) { await reply(route, { adapters: [{ format: 'mspdi_zip', name: 'MS Project XML bundle', status: 'implemented_subset', baseline: true, limitations: ['Vendor application import has not been round-trip tested.'], verification: { input_preservation: 'validated', vendor_application_roundtrip: 'not_tested' } }] }); return true }
    if (path.endsWith('/schedule-versions/91/export/')) { downloads.push(url.searchParams.get('export_format')); await route.fulfill({ status: 200, contentType: 'application/zip', headers: { 'content-disposition': 'attachment; filename="reviewed-plan.zip"' }, body: 'synthetic export payload' }); return true }
    return false
  } })
  await scheduleAction(page, 'Export schedule')
  const drawer = page.getByRole('dialog', { name: 'Export schedule', exact: true })
  await expect(drawer).toContainText('implemented subset')
  await drawer.getByText('Verification boundary', { exact: true }).click()
  await expect(drawer).toContainText('not tested')
  const download = page.waitForEvent('download')
  await drawer.getByRole('button', { name: 'Download MS Project XML bundle', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('reviewed-plan.zip')
  expect(downloads).toEqual(['mspdi_zip']); expect(state.writes).toEqual([]); clean(state)
})

test('resource requirements retain missing quantities and risk management preserves immutable source findings', async ({ page }) => {
  const decisions = []
  const register = { version_id: 91, revision: 'register-fingerprint', permissions: { can_edit: true, can_create: true }, owners: [{ id: '7', name: 'Maya Hassan' }], items: [{ id: 4, version_id: 91, title: 'Supplier lead time uncertainty', description: 'Vendor duration remains subject to confirmation.', status: 'open', priority: null, owner_id: null, owner_name: null, response: '', resolution: '', revision: 3, provenance: { type: 'document', label: 'Approved procurement register' } }] }
  const state = await masterScheduleHarness(page, { decorateSnapshot(plan) { return { ...plan, version_id: 91, resource_requirements: [{ activity_id: 'register-1', role: 'Process engineer', quantity: null, unit: null, lineage: { type: 'approved_rule', rule_id: 'resource-role-IFR' } }] } }, async handleRequest({ path, route, reply }) {
    if (path.endsWith('/resources/plan/') && route.request().method() === 'GET') {
      await reply(route, { project_id: 71, version_id: 91, resources: [], assignments: [], activities: [], permissions: { can_manage_resources: false, can_allocate: false }, basis: 'current_catalog' })
      return true
    }
    if (!path.endsWith('/risk-register/')) return false
    if (route.request().method() === 'GET') { await reply(route, register); return true }
    const body = route.request().postDataJSON(); decisions.push(body)
    register.items[0] = { ...register.items[0], status: body.status, priority: body.priority, owner_id: body.owner_id, response: body.response, resolution: body.resolution, revision: 4 }
    await reply(route, register); return true
  } })
  await scheduleArea(page, 'resources')
  const resources = page.getByRole('region', { name: 'Planning resource requirements', exact: true })
  await expect(resources).toContainText('Process engineer')
  await expect(resources.getByRole('cell', { name: 'Not Specified', exact: true })).toHaveCount(2)
  await scheduleArea(page, 'risks')
  const risk = page.getByRole('region', { name: 'Planning risk register', exact: true })
  await expect(risk).toContainText('Not Specified')
  await risk.getByRole('button', { name: 'Review Supplier lead time uncertainty', exact: true }).click()
  await expect(risk.getByRole('textbox', { name: 'Risk description', exact: true })).toHaveCount(0)
  await risk.getByLabel('Risk status', { exact: true }).selectOption('monitoring')
  await risk.getByLabel('Risk owner', { exact: true }).selectOption('7')
  await risk.getByLabel('Risk response', { exact: true }).fill('Obtain the supplier commitment before the release gate.')
  await risk.getByLabel('Risk decision reason', { exact: true }).fill('Procurement lead reviewed the source requirement.')
  await risk.getByRole('button', { name: 'Save risk review', exact: true }).click()
  await expect(risk.getByRole('status')).toContainText('Risk register decision saved')
  expect(decisions).toEqual([{ version_id: 91, item_id: 4, revision: 3, status: 'monitoring', priority: null, owner_id: '7', response: 'Obtain the supplier commitment before the release gate.', resolution: '', reason: 'Procurement lead reviewed the source requirement.', probability_percent: null, schedule_impact_days: null, impact_basis: '', mitigation_status: 'not_planned', mitigation_due_date: null }])
  expect(register.items[0].description).toBe('Vendor duration remains subject to confirmation.')
  expect(state.writes).toEqual([]); clean(state)
})

test('explicit profile calendars never supply a working shift and preserve entered intervals exactly', async ({ page }) => {
  const writes = []
  const profileData = { profiles: [], selection: { revision: 0, profile_id: null }, permissions: { can_create: true }, options: { workflow_templates: [{ id: 4, name: 'Reviewed workflow', version: 1, stages: ['IFR', 'COMPANY_REVIEW', 'IFA', 'COMPANY_APPROVAL', 'FINAL_ISSUE'].map((code, index) => ({ code, id: index + 1, name: code, duration: { value: 1, unit: 'working_days' }, role: 'Reviewed role' })) }], calendars: [], dependency_templates: [] } }
  const state = await masterScheduleHarness(page, { async handleRequest({ path, route, reply }) {
    if (!path.includes('/planning-profiles/')) return false
    if (route.request().method() === 'GET') { await reply(route, profileData); return true }
    const body = route.request().postDataJSON(); writes.push(body)
    await reply(route, profileData); return true
  } })
  await scheduleAction(page, 'Planning profile')
  const drawer = page.getByRole('dialog', { name: 'Planning profile', exact: true })
  await drawer.getByRole('button', { name: 'New profile draft', exact: true }).click()
  await drawer.getByLabel('Profile code', { exact: true }).fill('REVIEWED')
  await drawer.getByLabel('Profile name', { exact: true }).fill('Reviewed project policy')
  await drawer.getByLabel('Workflow template', { exact: true }).selectOption('4')
  await drawer.getByLabel('Final gate label', { exact: true }).fill('Issue for manufacture')
  await drawer.getByLabel('Calendar policy', { exact: true }).selectOption('explicit')
  await expect(drawer.getByLabel('Profile working hours per day', { exact: true })).toHaveValue('')
  await expect(drawer.getByLabel('Profile calendar timezone', { exact: true })).toHaveValue('')
  await drawer.getByRole('checkbox', { name: 'Monday', exact: true }).check()
  await expect(drawer.getByLabel('Monday interval 1 from', { exact: true })).toHaveCount(0)
  await drawer.getByLabel('Profile working hours per day', { exact: true }).fill('8')
  await drawer.getByLabel('Profile calendar timezone', { exact: true }).fill('Asia/Dubai')
  await drawer.getByRole('button', { name: 'Add Monday interval', exact: true }).click()
  await expect(drawer.getByLabel('Monday interval 1 from', { exact: true })).toHaveValue('')
  await drawer.getByLabel('Monday interval 1 from', { exact: true }).fill('08:00:00')
  await drawer.getByLabel('Monday interval 1 to', { exact: true }).fill('16:00:00')
  await drawer.getByRole('button', { name: 'Save profile draft', exact: true }).click()
  await expect(drawer.getByRole('status')).toContainText('Profile draft saved')
  expect(writes).toHaveLength(1)
  expect(writes[0].calendar_policy).toEqual({ mode: 'explicit', calendar: { working_weekdays: [0], hours_per_day: 8, timezone: 'Asia/Dubai', exceptions: [], working_times: { 0: [{ from: '08:00:00', to: '16:00:00' }] } } })
  expect(state.writes).toEqual([]); clean(state)
})

test('an approved profile exposes its generation action without automatically generating a plan', async ({ page }) => {
  const state = await buildHarness(page, { prepare(current) { for (const record of Object.values(current.records)) record.simplePlan.planning_profile = { valid: true, profile_id: 8, profile_version: 2 } } })
  const actions = await scheduleMenu(page, 'Schedule actions')
  await expect(actions.getByRole('button', { name: 'Generate plan', exact: true })).toBeVisible()
  await expect(actions.getByRole('button', { name: 'Build schedule', exact: true })).toHaveCount(0)
  expect(state.buildReads).toEqual([]); expect(state.buildWrites).toEqual([])
  await actions.getByRole('button', { name: 'Generate plan', exact: true }).click()
  await expect(generation(page)).toBeVisible()
  expect(state.buildWrites).toEqual([]); clean(state)
})

test('native export rejection displays the missing shifts and does not claim a completed download', async ({ page }) => {
  const state = await masterScheduleHarness(page, { decorateSnapshot(plan) { return { ...plan, version_id: 91 } }, async handleRequest({ path, route, reply }) {
    if (path.endsWith('/export-capabilities/')) { await reply(route, { adapters: [{ format: 'mspdi_zip', name: 'MSPDI ZIP', status: 'implemented_subset', baseline: true, verification: { vendor_application_roundtrip: 'not_tested' } }] }); return true }
    if (path.endsWith('/export/')) { await reply(route, { error: 'The schedule cannot be exported without changing its meaning.', code: 'mspdi_unsupported_semantics', issues: [{ code: 'working_times_missing', message: 'Working-time intervals are Not Specified for Monday.' }] }, 409); return true }
    return false
  } })
  await scheduleAction(page, 'Export schedule')
  const drawer = page.getByRole('dialog', { name: 'Export schedule', exact: true })
  await drawer.getByRole('button', { name: 'Download MSPDI ZIP', exact: true }).click()
  await expect(drawer.getByRole('alert')).toContainText('Working-time intervals are Not Specified for Monday.')
  await expect(drawer.getByRole('status')).toHaveCount(0)
  expect(state.writes).toEqual([]); clean(state)
})

test('derived activity values retain accepted fact and approved rule references in the same details panel', async ({ page }) => {
  const state = await masterScheduleHarness(page, { decorateSnapshot(plan) {
    const copy = structuredClone(plan)
    copy.tasks[0].field_provenance = { title: { type: 'derived', lineage: { type: 'deterministic_derivation', profile_id: 8, profile_version: 2, rule_id: 'stage-name', fact_ids: ['source-1'], source_references: [{ filename: 'Register.xlsx', locator: { sheet: 'Deliverables', row: 12 }, excerpt: 'Reviewed pump package' }] } } }
    return copy
  } })
  await scheduleWorkspace(page).getByRole('button', { name: state.records[17].simplePlan.tasks[0].title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details', exact: true })
  await details.getByText('Field provenance', { exact: true }).click()
  await expect(details).toContainText('Derived from accepted inputs')
  await expect(details).toContainText('Planning profile 8')
  await expect(details).toContainText('Rule stage-name')
  await details.getByText('Input references', { exact: true }).click()
  await expect(details.getByText('Fact source-1', { exact: true })).toBeVisible()
  await details.getByText('Register.xlsx', { exact: true }).click()
  await expect(details.getByText('Reviewed pump package', { exact: true })).toBeVisible()
  expect(state.writes).toEqual([]); clean(state)
})

test('risk field validation explains a stale decision while preserving the planner response', async ({ page }) => {
  const decisions = []
  const state = await masterScheduleHarness(page, { decorateSnapshot: plan => ({ ...plan, version_id: 91 }), async handleRequest({ path, route, reply }) {
    if (!path.endsWith('/risk-register/')) return false
    if (route.request().method() === 'GET') { await reply(route, { version_id: 91, permissions: { can_edit: true }, owners: [], items: [{ id: 4, title: 'Supplier uncertainty', description: 'Delivery date requires confirmation.', revision: 3, status: 'open', priority: null, owner_id: null }] }); return true }
    decisions.push(route.request().postDataJSON())
    await reply(route, { revision: ['This risk changed. Refresh the register before saving.'] }, 400); return true
  } })
  await scheduleArea(page, 'risks')
  const risk = page.getByRole('region', { name: 'Planning risk register', exact: true })
  await risk.getByRole('button', { name: 'Review Supplier uncertainty', exact: true }).click()
  await risk.getByLabel('Risk response', { exact: true }).fill('Request the vendor commitment.')
  await risk.getByLabel('Risk decision reason', { exact: true }).fill('Reviewed with procurement.')
  await risk.getByRole('button', { name: 'Save risk review', exact: true }).click()
  await expect(risk.getByRole('alert')).toContainText('This risk changed. Refresh the register before saving.')
  await expect(risk.getByLabel('Risk response', { exact: true })).toHaveValue('Request the vendor commitment.')
  expect(decisions).toHaveLength(1); expect(decisions[0].revision).toBe(3)
  expect(state.writes).toEqual([]); clean(state)
})
