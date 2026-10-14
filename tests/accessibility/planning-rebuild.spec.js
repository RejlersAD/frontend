import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { workflowStageHarness } from '../fixtures/workflow-stage-tree.fixture.js'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { scheduleAction, scheduleMenu, scheduleVersion, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const inputs = page => page.getByRole('dialog', { name: 'Documents & project inputs', exact: true })
const rebuildName = 'Rebuild draft from inputs'
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]) }
const rebuildWrites = state => state.writes.filter(item => item.path.endsWith('/simple-plan/analyse/'))
const generation = page => page.getByRole('dialog', { name: 'Generate project plan', exact: true })
const canonicalSnapshot = (plan, canGenerate = plan.state === 'review') => ({
  ...plan, canonical_version: true,
  permissions: { ...plan.permissions, can_edit: false, can_reopen: plan.state === 'baselined', can_generate_plan: canGenerate },
})

test('a current workflow draft can be explicitly rebuilt without a stale flag or extra confirmation steps', async ({ page }) => {
  const state = await workflowStageHarness(page, { async handleRequest({ path, route, state: current, record, reply }) {
    if (!path.endsWith('/simple-plan/analyse/') || route.request().method() !== 'POST') return false
    const body = route.request().postDataJSON()
    current.writes.push({ method: 'POST', path, data: body })
    // The server owns source reconciliation. This response exercises the UI
    // transition from an assigned workflow to reviewed current document rows.
    record.simplePlan = { ...record.simplePlan, revision: body.revision + 1, state: 'review', stale_inputs: false,
      deliverables: [], wbs_nodes: [], calculation_available: false,
      tasks: [{ id: 'new-source-row', title: 'Revised vendor document register', discipline: 'process', duration_days: null, duration_source: 'missing_source', planned_start_date: null, planned_finish_date: null, depends_on: [], assignee_id: null }],
      rebuild_summary: { preserved_workflow_deliverables: 0, replaced_workflow_deliverables: 3, archived_tasks: 15, new_tasks: 1 },
    }
    await reply(route, record.simplePlan)
    return true
  } })
  expect(state.records[17].simplePlan.stale_inputs).toBe(false)
  expect(state.records[17].simplePlan.deliverables).toHaveLength(3)
  const before = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, rebuildName)
  await expect(inputs(page)).toBeVisible()
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  await expect(inputs(page)).toContainText('matching source rows in the same document version')
  await expect(inputs(page)).toContainText('New, changed or ambiguous rows become unassigned draft activities.')
  await expect(inputs(page)).toContainText('archived with its employee history')
  expect(rebuildWrites(state)).toEqual([])
  await inputs(page).getByRole('button', { name: 'Keep current draft', exact: true }).click()
  expect(state.records[17].simplePlan).toEqual(before)
  expect(rebuildWrites(state)).toEqual([])
  await inputs(page).getByRole('button', { name: 'Close Documents & project inputs', exact: true }).click()
  await scheduleAction(page, rebuildName)
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  expect((await new AxeBuilder({ page }).include('.simple-schedule-dialog').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await inputs(page).getByRole('button', { name: rebuildName, exact: true }).click()
  await expect(inputs(page)).toHaveCount(0)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Revised vendor document register', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Draft rebuilt from current documents.' })).toBeVisible()
  expect(rebuildWrites(state)).toEqual([{ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/simple-plan/analyse/', data: { revision: 4, rebuild: true } }])
  clean(state)
})

test('rebuild submits the revision shown at confirmation and does not silently overwrite a newer draft', async ({ page }) => {
  const state = await workflowStageHarness(page)
  await scheduleAction(page, rebuildName)
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  const record = state.records[17]
  record.simplePlan.revision = 5
  record.simplePlan.tasks[0].title = 'Another planner has updated this task'
  const changedDraft = structuredClone(record.simplePlan)
  await inputs(page).getByRole('button', { name: rebuildName, exact: true }).click()
  await expect(inputs(page).getByRole('alert').filter({ hasText: 'The plan changed in another session.' })).toBeVisible()
  expect(rebuildWrites(state)).toHaveLength(1)
  expect(rebuildWrites(state)[0].data).toEqual({ revision: 4, rebuild: true })
  expect(record.simplePlan).toEqual(changedDraft)
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toHaveCount(1)
  await expect(inputs(page).getByRole('button', { name: 'Keep current draft', exact: true })).toBeEnabled()
  clean(state)
})

test('Analyze and update uses the same single rebuild confirmation when a document draft already exists', async ({ page }) => {
  const state = await masterScheduleHarness(page)
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Analyze & update schedule', exact: true }).click()
  await expect(inputs(page).getByText('Rebuild this draft from current inputs?', { exact: true })).toBeVisible()
  expect(rebuildWrites(state)).toEqual([])
  await inputs(page).getByRole('button', { name: rebuildName, exact: true }).click()
  await expect(inputs(page)).toHaveCount(0)
  expect(rebuildWrites(state)).toHaveLength(1)
  expect(rebuildWrites(state)[0].data).toEqual({ revision: 4, rebuild: true })
  clean(state)
})

test('a new canonical draft opens reviewed plan generation from project inputs without rebuilding the simple plan', async ({ page }) => {
  const fingerprint = 'a'.repeat(64)
  const state = await masterScheduleHarness(page, {
    prepare(current) {
      current.buildWrites = []
      Object.assign(current.records[17].simplePlan, {
        state: 'baselined', version_id: 90, version_number: 2, master_revision: 7,
        baseline: { id: 601, name: 'Approved project baseline', version_id: 90 },
      })
    },
    decorateSnapshot: plan => canonicalSnapshot(plan),
    async handleRequest({ path, route, record, state: current, reply }) {
      const method = route.request().method()
      if (path.endsWith('/simple-plan/reopen/') && method === 'POST') {
        const data = route.request().postDataJSON()
        current.writes.push({ method, path, data })
        expect(data).toEqual({ revision: 4 })
        Object.assign(record.simplePlan, { state: 'review', revision: 5, version_id: 91, version_number: 3, master_revision: 8 })
        await reply(route, canonicalSnapshot(record.simplePlan))
        return true
      }
      if (!path.includes('/planning-builds/')) return false
      if (method === 'GET') {
        await reply(route, {
          master_revision: 8, builds: [], permissions: { can_preview: true, can_apply: true },
          options: { graph_revision: 11, profile_selection_revision: 4, profile: { profile_id: 8, name: 'Reviewed delivery policy', profile_version: 2, valid: true },
            deliverables: [{ entity_id: 'deliverable-1', name: 'Pump package', fact_id: 'source-1' }], source_activities: [], dependency_rules: [] },
        })
        return true
      }
      current.buildWrites.push({ method, path, data: route.request().postDataJSON() })
      if (path.endsWith('/81/apply/')) {
        Object.assign(record.simplePlan, { revision: 6, version_id: 92, version_number: 4, master_revision: 9,
          tasks: [{ ...record.simplePlan.tasks[0], title: 'Pump package IFR' }] })
        await reply(route, { schedule_version_id: 92, activated: true, master_revision: 9 })
      } else {
        await reply(route, { id: 81, revision: 1, fingerprint, status: 'preview', ready_to_apply: true,
          summary: { activities: 1, relationships: 0 }, issues: [],
          plan: { activities: [{ id: 'generated-1', name: 'Pump package IFR', duration: { value: 8, unit: 'working_days' }, responsible_role: 'Equipment engineer' }], wbs: [], relationships: [], resources: [], risks: [], project_inputs: {} },
        })
      }
      return true
    },
  })
  const baseline = structuredClone(state.records[17].simplePlan.baseline)
  await scheduleAction(page, 'New version')
  await expect(page.getByRole('status').filter({ hasText: 'A new draft version is ready.' })).toBeVisible()
  const draft = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Generate new schedule draft', exact: true }).click()
  await expect(generation(page)).toBeVisible()
  await expect(inputs(page)).toHaveCount(0)
  expect(rebuildWrites(state)).toEqual([])
  expect(state.buildWrites).toEqual([])
  expect(state.records[17].simplePlan).toEqual(draft)
  await generation(page).getByRole('checkbox', { name: 'Pump package deliverable-1', exact: true }).check()
  await generation(page).getByLabel('Planning reason', { exact: true }).fill('Reviewed scope for the new draft.')
  await generation(page).getByRole('button', { name: 'Preview generated plan', exact: true }).click()
  await expect(generation(page).getByRole('region', { name: 'Generated plan preview', exact: true })).toContainText('Pump package IFR')
  expect(state.records[17].simplePlan).toEqual(draft)
  expect(state.buildWrites).toEqual([{ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/planning-builds/',
    data: { evidence_revision: 11, profile_selection_revision: 4, options: { deliverable_entity_ids: ['deliverable-1'], source_activity_entity_ids: [], dependency_bindings: {}, independent_entity_ids: [] }, reason: 'Reviewed scope for the new draft.' } }])
  await generation(page).getByRole('button', { name: 'Apply reviewed plan', exact: true }).click()
  await expect(generation(page)).toHaveCount(0)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Pump package IFR', exact: true })).toBeVisible()
  expect(state.buildWrites[1]).toEqual({ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/planning-builds/81/apply/',
    data: { fingerprint, master_revision: 8, reason: 'Reviewed scope for the new draft.' } })
  expect(state.buildWrites).toHaveLength(2)
  expect(state.records[17].simplePlan.baseline).toEqual(baseline)
  expect(rebuildWrites(state)).toEqual([])
  clean(state)
})

test('an imported canonical draft opens source logic from project inputs without requiring a generation profile', async ({ page }) => {
  const state = await masterScheduleHarness(page, {
    prepare(current) {
      Object.assign(current.records[17].simplePlan, { version_id: 91, master_revision: 7, source_import: { source_file_id: 801 } })
    },
    decorateSnapshot(plan) {
      const current = canonicalSnapshot(plan, false)
      current.permissions.can_build_source_logic = true
      return current
    },
  })
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Generate new schedule draft', exact: true }).click()
  const logic = page.getByRole('dialog', { name: 'Build logic & sequence', exact: true })
  await expect(logic).toBeVisible()
  await expect(logic.getByRole('button', { name: 'Preview logic & sequence', exact: true })).toBeEnabled()
  await expect(inputs(page)).toHaveCount(0)
  await expect(generation(page)).toHaveCount(0)
  expect(state.requests.filter(item => item.path.includes('/planning-builds/'))).toEqual([])
  expect(rebuildWrites(state)).toEqual([])
  expect(state.writes).toEqual([])
  expect(state.records[17].simplePlan).toEqual(original)
  clean(state)
})

for (const mode of ['baselined', 'unauthorized']) test(`project inputs cannot regenerate a ${mode} canonical schedule`, async ({ page }) => {
  const state = await masterScheduleHarness(page, {
    prepare(current) {
      Object.assign(current.records[17].simplePlan, { state: mode === 'baselined' ? 'baselined' : 'review', version_id: 91, master_revision: 7 })
    },
    decorateSnapshot: plan => canonicalSnapshot(plan, mode !== 'unauthorized'),
  })
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Generate new schedule draft', exact: true }).click()
  await expect(inputs(page).getByRole('alert').filter({ hasText: mode === 'unauthorized' ? 'Your access does not permit generating a schedule draft.' : 'read only' })).toBeVisible()
  await expect(inputs(page)).toContainText('Your inputs are saved. Schedule generation did not start; review the message above and retry.')
  await expect(inputs(page)).not.toContainText('Document Intelligence did not complete')
  await expect(generation(page)).toHaveCount(0)
  expect(rebuildWrites(state)).toEqual([])
  expect(state.requests.filter(item => item.path.includes('/planning-builds/'))).toEqual([])
  expect(state.records[17].simplePlan).toEqual(original)
  expect(state.writes).toEqual([])
  clean(state)
})

for (const capability of ['present', 'missing']) test(`an authorized canonical draft without a profile opens setup when its generation capability is ${capability}`, async ({ page }) => {
  const state = await masterScheduleHarness(page, {
    prepare(current) {
      current.buildReads = 0
      Object.assign(current.records[17].simplePlan, { version_id: 91, master_revision: 7, baseline: { id: 601, name: 'Preserved baseline', version_id: 90 } })
    },
    decorateSnapshot(plan) {
      const current = canonicalSnapshot(plan, true)
      if (capability === 'missing') delete current.permissions.can_generate_plan
      return current
    },
    async handleRequest({ path, route, state: current, reply }) {
      if (!path.endsWith('/planning-builds/') || route.request().method() !== 'GET') return false
      current.buildReads += 1
      await reply(route, { master_revision: 7, builds: [], permissions: { can_preview: true, can_apply: true },
        options: { graph_revision: 3, profile_selection_revision: 0, profile: { valid: false }, deliverables: [], source_activities: [], dependency_rules: [] } })
      return true
    },
  })
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Generate new schedule draft', exact: true }).click()
  await expect(generation(page)).toBeVisible()
  await expect(generation(page)).toContainText('Select a valid approved planning profile before generating a plan.')
  await expect(generation(page).getByRole('button', { name: 'Review profile', exact: true })).toBeEnabled()
  await expect(generation(page).getByRole('button', { name: 'Review source evidence', exact: true })).toBeEnabled()
  await expect(generation(page).getByRole('button', { name: 'Preview generated plan', exact: true })).toBeDisabled()
  await expect(inputs(page)).toHaveCount(0)
  await expect(page.getByText('Your access does not permit generating a schedule draft.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Your draft is saved. Document Intelligence did not complete; review the message above and retry.', { exact: true })).toHaveCount(0)
  expect(state.buildReads).toBeGreaterThanOrEqual(capability === 'missing' ? 2 : 1)
  expect(rebuildWrites(state)).toEqual([])
  expect(state.writes).toEqual([])
  expect(state.records[17].simplePlan).toEqual(original)
  clean(state)
})

for (const result of ['denied', 'unavailable']) test(`a missing generation capability stays blocked when the permission endpoint is ${result}`, async ({ page }) => {
  const state = await masterScheduleHarness(page, {
    prepare(current) {
      current.buildReads = 0
      Object.assign(current.records[17].simplePlan, { version_id: 91, master_revision: 7 })
    },
    decorateSnapshot(plan) {
      const current = canonicalSnapshot(plan)
      delete current.permissions.can_generate_plan
      return current
    },
    async handleRequest({ path, route, state: current, reply }) {
      if (!path.endsWith('/planning-builds/') || route.request().method() !== 'GET') return false
      current.buildReads += 1
      await reply(route, result === 'denied' ? { permissions: { can_preview: false, can_apply: false } } : { detail: 'Schedule generation access is temporarily unavailable.' }, result === 'denied' ? 200 : 503)
      return true
    },
  })
  const original = structuredClone(state.records[17].simplePlan)
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Generate new schedule draft', exact: true }).click()
  await expect(inputs(page).getByRole('alert').filter({ hasText: result === 'denied' ? 'Your access does not permit generating a schedule draft.' : 'Schedule generation access is temporarily unavailable.' })).toBeVisible()
  await expect(inputs(page)).toContainText('Your inputs are saved. Schedule generation did not start; review the message above and retry.')
  await expect(inputs(page)).not.toContainText('Document Intelligence did not complete')
  await expect(generation(page)).toHaveCount(0)
  expect(state.buildReads).toBe(1)
  expect(rebuildWrites(state)).toEqual([])
  expect(state.writes).toEqual([])
  expect(state.records[17].simplePlan).toEqual(original)
  clean(state)
})

test('an empty simple draft analyzes its documents without asking to rebuild an existing schedule', async ({ page }) => {
  const state = await masterScheduleHarness(page, { prepare(current) {
    Object.assign(current.records[17].simplePlan, { state: 'inputs', revision: 0, tasks: [] })
  } })
  await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'Analyze & update schedule', exact: true }).click()
  await expect(inputs(page)).toHaveCount(0)
  await expect(scheduleWorkspace(page).getByRole('button', { name: state.records[17].simplePlan.tasks[0].title, exact: true })).toBeVisible()
  await expect(generation(page)).toHaveCount(0)
  expect(rebuildWrites(state)).toEqual([{ method: 'POST', path: '/api/v1/planning-intelligence/projects/71/simple-plan/analyse/', data: { revision: 0, rebuild: false } }])
  clean(state)
})

for (const mode of ['manual', 'baselined', 'history']) test(`the rebuild action is not exposed for ${mode} schedules`, async ({ page }) => {
  const state = await masterScheduleHarness(page, { manual: mode === 'manual', history: mode === 'history', prepare(current) {
    if (mode === 'baselined') for (const record of Object.values(current.records)) record.simplePlan.state = 'baselined'
  } })
  if (mode === 'history') await scheduleVersion(page, '90')
  const menu = await scheduleMenu(page, 'Schedule actions')
  await expect(menu.getByRole('button', { name: rebuildName, exact: true })).toHaveCount(0)
  expect(rebuildWrites(state)).toEqual([])
  clean(state)
})
