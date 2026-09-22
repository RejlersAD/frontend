import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { scheduleAction, scheduleArea, scheduleVersion, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)
const drawer = page => page.getByRole('dialog', { name: 'Planning profile', exact: true })
const workflow = { id: 4, name: 'Reviewed delivery workflow', code: 'DELIVERY', version: 3, stages: [
  { id: 31, code: 'IFR', name: 'Issue for review', duration: { value: 6, unit: 'working_days' }, role: 'Designer', progress_weight: 30 },
  { id: 32, code: 'COMPANY_REVIEW', name: 'Company review', duration: { value: 3, unit: 'working_days' }, role: 'Client reviewer', progress_weight: 20, relationship_to_previous: 'FS', lag_days: 0 },
  { id: 33, code: 'IFA', name: 'Issue for approval', duration: { value: 2, unit: 'working_days' }, role: 'Designer', progress_weight: 20, relationship_to_previous: 'FS', lag_days: 0 },
  { id: 34, code: 'COMPANY_APPROVAL', name: 'Company approval', duration: { value: 3, unit: 'working_days' }, role: 'Client approver', progress_weight: 20, relationship_to_previous: 'FS', lag_days: 0 },
  { id: 35, code: 'FINAL_ISSUE', name: 'Final issue', duration: { value: 1, unit: 'working_days' }, role: 'Document controller', progress_weight: 10, relationship_to_previous: 'FS', lag_days: 0 },
] }
const configuration = { workflow_template_id: 4, dependency_template_id: null, final_gate_label: 'Issue for manufacture', approved_dependency_rule_ids: [], wbs_convention: { levels: ['project', 'deliverable', 'workflow_stage'] }, calendar_policy: { mode: 'not_specified' }, progress_policy: { mode: 'not_specified' }, resource_policy: { mode: 'not_specified' } }
function profile(status = 'proposed') {
  const definition = { configuration: structuredClone(configuration), workflow, dependency_template: null, rules: [], wbs_convention: configuration.wbs_convention, calendar_policy: configuration.calendar_policy, progress_policy: configuration.progress_policy, resource_policy: configuration.resource_policy }
  return { id: 8, code: 'DELIVERY-POLICY', name: 'Reviewed project delivery', version: 2, revision: 11, status, definition, approved_snapshot: status === 'approved' ? { definition, approval: { actor_id: 3 } } : null, content_fingerprint: 'synthetic-profile-fingerprint', approved_by_id: status === 'approved' ? 3 : null, permissions: { can_edit: status === 'draft', can_propose: status === 'draft', can_approve: status === 'proposed', can_reject: status === 'proposed', can_revise: status === 'approved' } }
}
async function harness(page, options = {}) {
  return masterScheduleHarness(page, {
    prepare(current) {
      current.profileReads = []; current.profileWrites = []
      current.profileEnvelope = { profiles: [profile(options.status)], selection: { revision: 7, profile_id: null, valid: false, snapshot: null }, options: { workflow_templates: [workflow], dependency_templates: [], calendars: [{ id: 5, name: 'Approved project calendar' }] }, permissions: { can_create: true, can_approve: true, can_select: true } }
      options.prepare?.(current)
    },
    async handleRequest(context) {
      const { path, route, reply, state } = context
      if (await options.handleRequest?.(context)) return true
      if (!path.includes('/planning-profiles/')) return false
      if (route.request().method() === 'GET') { state.profileReads.push(path); await reply(route, state.profileEnvelope); return true }
      const body = route.request().postDataJSON(); state.profileWrites.push({ path, body, method: route.request().method() })
      if (options.write) return options.write(context, body)
      await reply(route, state.profileEnvelope)
      return true
    },
  })
}
const clean = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); expect(state.unknownWrites).toEqual([]) }

test('profile drawer is lazy and a new draft uses only explicit workflow and policy selections', async ({ page }) => {
  const state = await harness(page, { async write({ reply, route, state: current }, body) {
    const saved = { ...profile('draft'), id: 9, code: body.code, name: body.name, revision: 1 }
    current.profileEnvelope.profiles.push(saved)
    await reply(route, { ...current.profileEnvelope, profile: saved })
    return true
  } })
  expect(state.profileReads).toEqual([])
  await scheduleAction(page, 'Planning profile')
  await expect(drawer(page)).toBeVisible()
  await expect(drawer(page).getByText('Not Specified', { exact: true })).toBeVisible()
  expect(state.profileWrites).toEqual([])
  await drawer(page).getByRole('button', { name: 'New profile draft', exact: true }).click()
  await expect(drawer(page).getByLabel('Workflow template', { exact: true })).toHaveValue('')
  await expect(drawer(page).getByLabel('Calendar policy', { exact: true })).toHaveValue('not_specified')
  await drawer(page).getByLabel('Profile code', { exact: true }).fill('FABRICATION')
  await drawer(page).getByLabel('Profile name', { exact: true }).fill('Fabrication release policy')
  await drawer(page).getByLabel('Workflow template', { exact: true }).selectOption('4')
  await drawer(page).getByLabel('Final gate label', { exact: true }).fill('Issue for manufacture')
  await drawer(page).getByRole('button', { name: 'Save profile draft', exact: true }).click()
  await expect(drawer(page).getByRole('status')).toContainText('Profile draft saved')
  expect(state.profileWrites).toHaveLength(1)
  expect(state.profileWrites[0].body).toEqual({ code: 'FABRICATION', name: 'Fabrication release policy', workflow_template_id: 4, dependency_template_id: null, final_gate_label: 'Issue for manufacture', approved_dependency_rule_ids: [], wbs_convention: { levels: [] }, calendar_policy: { mode: 'not_specified' }, progress_policy: { mode: 'not_specified' }, resource_policy: { mode: 'not_specified' } })
  expect(state.writes).toEqual([])
  clean(state)
})

test('proposed profile review requires a reason and exact revision, approval does not select or generate a schedule', async ({ page }) => {
  const state = await harness(page, { async write({ path, reply, route, state: current }, body) {
    if (path.endsWith('/approve/')) { const approved = profile('approved'); approved.revision = 12; current.profileEnvelope.profiles = [approved]; await reply(route, { ...current.profileEnvelope, profile: approved }); return true }
    current.profileEnvelope.selection = { revision: 8, profile_id: 8, profile_version: 2, valid: true, snapshot: current.profileEnvelope.profiles[0].approved_snapshot }
    expect(body.selection_revision).toBe(7)
    await reply(route, current.profileEnvelope)
    return true
  } })
  await scheduleAction(page, 'Planning profile')
  await drawer(page).getByLabel('Profile version', { exact: true }).selectOption('8')
  await expect(drawer(page).getByRole('region', { name: 'Profile version details' })).toContainText('Issue for manufacture')
  expect((await new AxeBuilder({ page }).include('.planning-context-drawer').analyze()).violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await drawer(page).getByRole('button', { name: 'Approve profile version', exact: true }).click()
  await expect(drawer(page).getByRole('button', { name: 'Confirm approve', exact: true })).toBeDisabled()
  await drawer(page).getByLabel('Decision reason', { exact: true }).fill('Project manager has reviewed each workflow rule.')
  await drawer(page).getByRole('button', { name: 'Confirm approve', exact: true }).click()
  await expect(drawer(page).getByRole('status')).toContainText('Schedule approval remains separate')
  expect(state.profileWrites[0].body).toEqual({ revision: 11, reason: 'Project manager has reviewed each workflow rule.' })
  expect(state.profileEnvelope.selection.profile_id).toBeNull()
  expect(state.writes).toEqual([])
  await drawer(page).getByRole('button', { name: 'Use approved profile', exact: true }).click()
  await drawer(page).getByLabel('Decision reason', { exact: true }).fill('Use the approved delivery policy for this project.')
  await drawer(page).getByRole('button', { name: 'Confirm selection', exact: true }).click()
  await expect(drawer(page).getByRole('status')).toContainText('Approved profile selected')
  expect(state.profileWrites[1].body).toEqual({ profile_id: 8, selection_revision: 7, reason: 'Use the approved delivery policy for this project.' })
  expect(state.writes).toEqual([])
  clean(state)
})

test('a reviewer without profile authority can inspect the exact version but cannot mutate or select it', async ({ page }) => {
  const state = await harness(page, { status: 'approved', prepare(current) {
    current.profileEnvelope.permissions = { can_create: false, can_approve: false, can_select: false }
    current.profileEnvelope.profiles[0].permissions = {}
  } })
  await scheduleAction(page, 'Planning profile')
  await drawer(page).getByLabel('Profile version', { exact: true }).selectOption('8')
  await expect(drawer(page).getByRole('region', { name: 'Profile version details' })).toContainText('Version 2')
  await expect(drawer(page).getByRole('button', { name: 'Use approved profile', exact: true })).toHaveCount(0)
  await expect(drawer(page).getByRole('button', { name: 'New profile draft', exact: true })).toHaveCount(0)
  await expect(drawer(page).getByRole('button', { name: 'Approve profile version', exact: true })).toHaveCount(0)
  expect(state.profileWrites).toEqual([])
  clean(state)
})

test('profile revision conflict is displayed without silently approving the refreshed revision', async ({ page }) => {
  const state = await harness(page, { async write({ reply, route }) { await reply(route, { detail: 'The profile changed. Refresh before continuing.', code: 'planning_profile_revision_conflict' }, 409); return true } })
  await scheduleAction(page, 'Planning profile')
  await drawer(page).getByLabel('Profile version', { exact: true }).selectOption('8')
  await drawer(page).getByRole('button', { name: 'Approve profile version', exact: true }).click()
  await drawer(page).getByLabel('Decision reason', { exact: true }).fill('Reviewed the displayed version.')
  await drawer(page).getByRole('button', { name: 'Confirm approve', exact: true }).click()
  await expect(drawer(page).getByRole('alert')).toContainText('The profile changed. Refresh before continuing.')
  expect(state.profileWrites).toHaveLength(1)
  expect(state.profileWrites[0].body.revision).toBe(11)
  expect(state.writes).toEqual([])
  clean(state)
})

test('activity details distinguish source, rule, proposal, calculation and planner values without guessing provenance', async ({ page }) => {
  const state = await harness(page, { prepare(current) {
    for (const record of Object.values(current.records)) record.simplePlan.tasks[0].field_provenance = {
      title: { type: 'document', status: 'accepted' }, duration_days: { type: 'approved_rule', profile_name: 'Reviewed delivery', profile_version: 2, rule_id: 'stage:IFR', status: 'approved' },
      planned_start_date: { type: 'calculated', status: 'current' }, planned_finish_date: { type: 'proposal', status: 'unreviewed' }, assignee_id: { type: 'planner', status: 'approved' },
    }
  } })
  await scheduleWorkspace(page).getByRole('button', { name: state.records[17].simplePlan.tasks[0].title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details', exact: true })
  for (const type of ['Source document', 'Approved rule', 'Calculated', 'Proposal', 'Planner input', 'Provenance not recorded']) await expect(details.locator('.planning-provenance-badge').filter({ hasText: type }).first()).toBeVisible()
  await expect(details).toContainText('Reviewed delivery · Version 2 · Rule stage:IFR')
  expect(state.profileReads).toEqual([])
  expect(state.writes).toEqual([])
  clean(state)
})

test('broader extraction categories stay visible with evidence provenance', async ({ page }) => {
  const state = await harness(page, { async handleRequest({ path, reply, route }) {
    if (!path.endsWith('/evidence-review/')) return false
    await reply(route, { revision: 2, master_revision: 3, graph_id: 'coverage-1', permissions: {}, capabilities: {}, readiness: {}, category_summary: [{ category: 'procurement_requirement', label: 'Procurement requirements', count: 4 }, { category: 'construction_constraint', label: 'Construction constraints', count: 3 }], facts: [], issues: [], pagination: { offset: 0, limit: 100, total: 0, has_more: false } })
    return true
  } })
  await scheduleArea(page, 'evidence')
  await page.getByText('Extracted document content', { exact: true }).click()
  await expect(page.getByRole('region', { name: 'Document evidence review', exact: true })).toContainText('Procurement requirements: 4')
  await expect(page.getByRole('region', { name: 'Document evidence review', exact: true })).toContainText('Construction constraints: 3')
  expect(state.writes).toEqual([])
  clean(state)
})

test('a reviewed version can be selected explicitly and the preserved working draft remains reachable', async ({ page }) => {
  let activeId = 192, masterRevision = 7
  const makePlan = (record, id, historical = false) => ({ ...record.simplePlan, canonical_version: true, version_id: id, master_revision: masterRevision, revision: 28431,
    tasks: [{ ...record.simplePlan.tasks[0], title: `Accepted schedule ${id}` }], viewing_history: historical,
    permissions: { can_edit: false, can_calculate: !historical, can_validate: !historical, can_select_version: true, can_submit: !historical },
    versions: [{ id: 192, label: 'Accepted version 192' }, { id: 193, label: 'Accepted version 193' }] })
  const state = await harness(page, { async handleRequest({ path, url, route, reply, record, state: current }) {
    if (path.endsWith('/simple-plan/') && route.request().method() === 'GET' && activeId != null) {
      const selected = url.searchParams.get('version_id')
      await reply(route, makePlan(record, selected ? Number(selected) : activeId, Boolean(selected))); return true
    }
    if (path.endsWith('/simple-plan/select-version/')) {
      const body = route.request().postDataJSON(); current.writes.push({ path, data: body })
      expect(body.revision).toBe(masterRevision)
      activeId = body.version_id; masterRevision += 1
      await reply(route, activeId == null ? { ...record.simplePlan, permissions: { can_edit: true } } : makePlan(record, activeId)); return true
    }
    return false
  } })
  const original = structuredClone(state.records[17].simplePlan)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Accepted schedule 192', exact: true })).toBeVisible()
  await scheduleVersion(page, '193')
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Accepted schedule 193', exact: true })).toBeVisible()
  expect(state.writes).toEqual([])
  await scheduleAction(page, 'Use this version in Master Schedule')
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Calculate schedule', exact: true })).toBeEnabled()
  expect(state.writes[0].data).toEqual({ revision: 7, version_id: 193 })
  await scheduleAction(page, 'Open preserved working draft')
  await expect(scheduleWorkspace(page).getByRole('button', { name: original.tasks[0].title, exact: true })).toBeVisible()
  expect(state.writes[1].data).toEqual({ revision: 8, version_id: null })
  expect(state.records[17].simplePlan).toEqual(original)
  clean(state)
})

test('partial extraction continues only on request and asks for evidence review without silently accepting findings', async ({ page }) => {
  const resumeWrites = []
  const state = await harness(page, { async handleRequest({ path, route, reply }) {
    if (path.endsWith('/evidence-review/')) {
      await reply(route, { revision: 2, master_revision: 3, graph_id: 'partial-graph', permissions: { can_review: true }, capabilities: {}, readiness: { stale: resumeWrites.length > 0, calculation: { ready: false } }, extraction: { run_id: 55, status: 'partial', fact_count: 12, chunks_remaining: resumeWrites.length ? 1 : 2, resume_available: true, facts_by_type: { requirement: 12 } }, issues: [], facts: [], pagination: { offset: 0, limit: 100, total: 0, has_more: false } })
      return true
    }
    if (path.endsWith('/intelligence-runs/55/resume/')) { resumeWrites.push(route.request().postDataJSON()); await reply(route, { id: 88, status: 'queued' }, 202); return true }
    if (path.endsWith('/jobs/88/')) { await reply(route, { id: 88, status: 'succeeded', result_data: {} }); return true }
    return false
  } })
  await scheduleArea(page, 'evidence')
  const evidence = page.getByRole('region', { name: 'Document evidence review', exact: true })
  await expect(evidence).toContainText('2 processing chunks remain')
  expect(resumeWrites).toEqual([])
  await evidence.getByRole('button', { name: 'Continue extraction', exact: true }).click()
  await expect(evidence.getByRole('status')).toContainText('Refresh evidence to review the latest findings')
  await expect(evidence).toContainText('1 processing chunk remains')
  await expect(evidence.getByRole('button', { name: 'Continue extraction', exact: true })).toBeEnabled()
  expect(resumeWrites).toEqual([{}])
  expect(state.writes).toEqual([])
  clean(state)
})


test('profile duration edits retain other overrides and require a separate approval decision', async ({ page }) => {
  const state = await harness(page, { status: 'draft', prepare(current) {
    current.profileEnvelope.profiles[0].definition.configuration.stage_duration_overrides = {
      IFR: { value: 4, unit: 'calendar_days' }, COMPANY_REVIEW: { value: 12, unit: 'hours' },
    }
  }, async write({ reply, route, state: current }, body) {
    const saved = current.profileEnvelope.profiles[0]
    saved.revision = 12
    saved.definition.configuration.stage_duration_overrides = body.stage_duration_overrides
    await reply(route, { ...current.profileEnvelope, profile: saved })
    return true
  } })
  await scheduleAction(page, 'Planning profile')
  await drawer(page).getByLabel('Profile version', { exact: true }).selectOption('8')
  await drawer(page).getByRole('button', { name: 'Edit profile draft', exact: true }).click()
  await expect(drawer(page).getByLabel('IFR duration', { exact: true })).toHaveValue('4')
  await expect(drawer(page).getByLabel('IFR duration unit', { exact: true })).toHaveValue('calendar_days')
  await expect(drawer(page).getByLabel('COMPANY_REVIEW duration', { exact: true })).toHaveValue('12')
  await drawer(page).getByLabel('IFR duration', { exact: true }).fill('18')
  await drawer(page).getByLabel('IFR duration unit', { exact: true }).selectOption('hours')
  await drawer(page).getByRole('button', { name: 'Save profile draft', exact: true }).click()
  await expect(drawer(page).getByRole('status')).toContainText('Submit it for review before selection')
  expect(state.profileWrites).toHaveLength(1)
  expect(state.profileWrites[0].method).toBe('PATCH')
  expect(state.profileWrites[0].body.revision).toBe(11)
  expect(state.profileWrites[0].body.stage_duration_overrides).toEqual({ IFR: { value: 18, unit: 'hours' }, COMPANY_REVIEW: { value: 12, unit: 'hours' } })
  expect(state.profileWrites[0].body.workflow_template_id).toBe(4)
  expect(state.profileEnvelope.selection.profile_id).toBeNull()
  expect(state.writes).toEqual([])
  clean(state)
})
