import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { planningInputsHarness, populatePlanningEvidence } from '../fixtures/planning-inputs.fixture.js'
import { openRetainedScheduleSettings, closeRetainedScheduleSettings, expectRetainedScheduleVersion, selectRetainedScheduleVersion, retainedScheduleAction } from '../fixtures/retained-schedule-controls.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

const outerNav = page => page.getByRole('navigation', { name: 'Schedule workspace', exact: true })
const plannerNav = page => page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })
const plannerArea = (page, name) => plannerNav(page).getByRole('button', { name, exact: true, includeHidden: true })
const activityName = page => page.getByRole('textbox', { name: 'PIP-014 activity name', exact: true })
async function openScheduleDetails(page) {
  if (await page.locator('.pw-footer-more').getAttribute('open') === null) await page.locator('.pw-footer-more > summary').click()
  if (await page.locator('.pw-schedule-details').getAttribute('open') === null) await page.locator('.pw-schedule-details > summary').click()
}
const documentNav = page => page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true })

// Keep the old empty Simple Planning draft beside populated relational versions.
// The unified UI must select the stored master; opening it never creates data.
async function harness(page, options = {}) {
  return planningInputsHarness(page, {
    query: options.query || 'project=17&view=plan-baseline&shell=true',
    harnessPath: '/tests/fixtures/project-performance-harness.jsx',
    prepare(state) {
      state.workspaceErrors = {}
      state.heldWorkspaces = new Set()
      state.releaseWorkspaces = []
      state.unexpectedWrites = []
      for (const record of Object.values(state.records)) {
        populatePlanningEvidence(record)
        record.masterVersionId = null
        record.versionWorkspaces = {}
        record.versionControls = {}
        for (const version of record.versions) {
          const historic = version.id !== record.versions[0].id
          const source = historic ? record.baselines.find(baseline => baseline.source_version === version.id).snapshot.activities : record.workspace.activities
          const activities = source.map(activity => ({ ...activity, version: version.id,
            name: `${record.project.id === 18 ? 'Grid scope: ' : ''}${historic ? 'Baseline: ' : ''}${activity.name}`,
          }))
          record.versionWorkspaces[version.id] = { ...structuredClone(record.workspace), version, activities,
            can_edit: !historic, can_control: !historic, can_approve_field_updates: !historic,
          }
          record.versionControls[version.id] = { ...structuredClone(record.controls),
            progress_pct: historic ? '17.00' : record.controls.progress_pct,
            activities: record.controls.activities.map(activity => ({ ...activity,
              name: activities.find(row => row.id === activity.id).name,
            })),
          }
        }
      }
      options.prepare?.(state)
    },
    async handleRequest(context) {
      if (await options.handleRequest?.(context)) return true
      const { route, path, state, reply, record } = context
      const method = route.request().method()
      if (method !== 'GET') {
        state.unexpectedWrites.push({ path, method })
        await reply(route, { detail: 'The unified schedule navigation fixture does not allow mutations.' }, 405)
        return true
      }
      const planningId = path.match(/\/planning-intelligence\/projects\/(\d+)\//)?.[1]
      const selected = Object.values(state.records).find(item => String(item.planningProject.id) === planningId) || record
      if (path.endsWith('/simple-plan/')) {
        await reply(route, { project_id: selected.planningProject.id, state: 'inputs', revision: 0,
          tasks: [], source_documents: [], disciplines: [], versions: [], blockers: [], warnings: [],
          master_version_id: selected.masterVersionId, master_revision: 0,
          permissions: { can_edit: true, can_assign: true, can_submit: false, can_approve_publish: false },
        })
        return true
      }
      const version = path.match(/\/schedule-versions\/(\d+)\/(workspace|controls)\/$/)
      if (!version) return false
      const [, versionId, resource] = version
      if (resource === 'workspace') {
        if (state.heldWorkspaces.has(Number(versionId))) {
          await new Promise(resolve => state.releaseWorkspaces.push(resolve))
        }
        const failure = state.workspaceErrors[versionId]
        if (failure) await reply(route, { detail: failure.message }, failure.status)
        else await reply(route, record.versionWorkspaces[versionId])
      } else await reply(route, record.versionControls[versionId])
      return true
    },
  })
}

async function expectMaster(page, versionId = 91) {
  await expect(outerNav(page).getByRole('button')).toHaveText(['Document Intelligence', 'Master Schedule'])
  await expect(outerNav(page).getByRole('button', { name: 'Master Schedule', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(plannerNav(page)).toBeVisible()
  await expectRetainedScheduleVersion(page, versionId)
  await expect(page.getByRole('heading', { name: 'Resolve schedule blockers', exact: true })).toHaveCount(0)
}

async function showActivities(page, expectedName = 'Piping isometrics package') {
  await plannerArea(page, 'Activities & Gantt').click()
  await page.getByRole('button', { name: 'Flat activities', exact: true }).click()
  await expect(activityName(page)).toHaveValue(expectedName)
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unexpectedWrites).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([])
}

test('quality warnings keep save and approval preparation available', async ({ page }) => {
  const state = await harness(page, { prepare(current) {
    const workspace = current.records[17].versionWorkspaces[91]
    workspace.version = { ...workspace.version, status: 'calculated', can_prepare_approval: true, can_approve: false, can_baseline: false }
    workspace.schedule_assurance = { ...workspace.schedule_assurance, status: 'ready', can_approve: true,
      blockers: [], warnings: [{ code: 'resource_overallocation', severity: 'warning', message: '3 resources exceed daily capacity.' }],
    }
  }, async handleRequest({ path, route, reply }) {
    if (!path.endsWith('/resources/plan/')) return false
    await reply(route, { resources: [], activities: [], assignments: [],
      permissions: { can_manage_resources: false, can_allocate: false } })
    return true
  } })
  await expectMaster(page)
  const actions = page.locator('.pw-actions')
  await page.locator('.pw-footer-more > summary').click()
  await expect(actions.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await actions.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('All activity changes are already saved.', { exact: true })).toBeVisible()
  await expect(actions.getByRole('button', { name: 'Approve Schedule', exact: true })).toBeEnabled()
  await expect(actions.getByRole('button', { name: 'Save Baseline', exact: true })).toBeEnabled()
  await openScheduleDetails(page)
  await expect(page.getByRole('status', { name: 'Schedule action status' })).toContainText('3 resources exceed daily capacity.')
  await page.getByRole('button', { name: 'Review resource allocations', exact: true }).click()
  await expect(plannerArea(page, 'Resources')).toHaveAttribute('aria-current', 'page')
  clean(state)
})

for (const status of ['calculated', 'approved']) {
  test(`assured ${status} version enables authorized approval preparation`, async ({ page }) => {
    const state = await harness(page, { prepare(current) {
      const workspace = current.records[17].versionWorkspaces[91]
      workspace.version = { ...workspace.version, status, can_approve: status === 'calculated', can_baseline: status === 'approved' }
    } })
    await expectMaster(page)
    const actions = page.locator('.pw-actions')
    if (status === 'calculated') {
      await expect(actions.getByRole('button', { name: 'Approve Schedule', exact: true })).toBeEnabled()
      await expect(actions.getByRole('button', { name: 'Save Baseline', exact: true })).toBeEnabled()
    } else {
      await expect(actions.getByRole('button', { name: 'Approve Schedule', exact: true })).toBeDisabled()
      await expect(actions.getByRole('button', { name: 'Save Baseline', exact: true })).toBeEnabled()
    }
    clean(state)
  })
}

test('long workflow IDs stay inside their column and activity edits enable Save', async ({ page }) => {
  const id = 'PKG-6889F5F2C2A3-100'
  const state = await harness(page, { prepare(current) {
    current.records[17].versionWorkspaces[91].activities[0].external_id = id
  } })
  await expectMaster(page)
  const editor = page.getByRole('textbox', { name: `${id} activity name`, exact: true })
  const row = editor.locator('xpath=ancestor::tr')
  const identifier = row.locator('.planner-activity-id')
  await expect(identifier).toHaveText(id)
  await expect(identifier).toHaveAttribute('title', id)
  const resize = page.getByRole('button', { name: 'Resize WBS / ID column', exact: true })
  const handle = await resize.boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x - 120, handle.y + handle.height / 2)
  await page.mouse.up()
  for (const width of [1328, 390]) {
    await page.setViewportSize({ width, height: 768 })
    const bounds = await identifier.boundingBox()
    const cell = await row.locator('td').first().boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(cell.x)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(cell.x + cell.width + 1)
    expect((await row.boundingBox()).height).toBeLessThanOrEqual(41)
  }
  await editor.fill('Reviewed process design basis')
  await page.locator('.pw-footer-more > summary').click()
  await expect(page.locator('.pw-actions').getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await expect(page.getByText('1 unsaved', { exact: true })).toBeVisible()
  clean(state)
})

test('approval permissions remain enforced after assurance is approved', async ({ page }) => {
  const state = await harness(page, { prepare(current) {
    const workspace = current.records[17].versionWorkspaces[91]
    workspace.version = { ...workspace.version, status: 'calculated', can_approve: false, can_baseline: false }
    current.records[17].governance = { items: [], comments: [], reviews: [], audit_events: [], members: [],
      summary: { open_items: 0, critical_items: 0, pending_reviews: 0, unresolved_comments: 0 },
      can_manage: false,
    }
  } })
  await expectMaster(page)
  await expect(page.locator('.pw-actions').getByRole('button', { name: 'Approve Schedule', exact: true })).toBeDisabled()
  await openScheduleDetails(page)
  await expect(page.getByRole('status', { name: 'Schedule action status' })).toContainText('project approval permissions')
  await page.getByRole('button', { name: 'Review approval blockers', exact: true }).click()
  await expect(plannerArea(page, 'Governance')).toHaveAttribute('aria-current', 'page')
  clean(state)
})

async function recoveryHarness(page, options = {}) {
  return harness(page, {
    prepare(current) {
      const record = current.records[17]
      const workspace = record.versionWorkspaces[91]
      workspace.version = { ...workspace.version, status: 'draft', can_prepare_approval: true,
        can_approve: false, can_baseline: false, calculated_finish: null }
      workspace.schedule_assurance = null
      workspace.can_edit = true
      current.recoveryWrites = []
      current.recoveryJobs = {}
      options.prepare?.(current)
    },
    async handleRequest({ path, route, state, reply, record }) {
      const method = route.request().method()
      if (method === 'GET' && path.endsWith('/schedule-versions/91/')) {
        await reply(route, record.versionWorkspaces[91].version)
        return true
      }
      if (method === 'GET' && path.endsWith('/jobs/812/') && state.activeScheduleJob) {
        await reply(route, state.activeScheduleJob)
        return true
      }
      if (!['POST', 'PATCH'].includes(method)) return false
      const operation = path.match(/\/schedule-versions\/91\/([^/]+)\/$/)?.[1]
      if (!['recover-draft', 'calculate', 'run-assurance', 'approve-assurance', 'approve', 'baseline'].includes(operation)) return false
      const body = route.request().postDataJSON()
      state.recoveryWrites.push({ operation, body })
      const workspace = record.versionWorkspaces[91]
      if (options.rejectCalculation && operation === 'calculate') {
        await reply(route, { error: 'The network contains a dependency cycle.', code: 'dependency_cycle' }, 409)
        return true
      }
      if (operation === 'recover-draft') {
        if (body.operation === 'renumber_activity_ids') workspace.activities.forEach((row, index) => {
          row.metadata = { ...row.metadata, original_external_id: row.external_id }
          row.external_id = String(100 + index * 10)
        })
        else workspace.version.planning_target_finish = '2026-12-28'
        workspace.version.status = 'draft'
        workspace.version.calculated_at = null
        Object.assign(record.versions[0], workspace.version)
        await reply(route, { changed: true, version: workspace.version })
        return true
      }
      if (operation === 'calculate') {
        workspace.version.status = 'calculated'
        workspace.version.calculated_finish = '2026-12-28'
        workspace.version.calculated_at = '2026-09-15T06:30:00Z'
        Object.assign(record.versions[0], workspace.version)
      }
      if (operation === 'run-assurance') workspace.schedule_assurance = {
        status: 'ready', can_approve: true, blockers: [],
        warnings: [{ code: 'resource_overallocation', severity: 'warning', message: '3 resources exceed daily capacity.' }],
        calculated_state_at: '2026-09-15T06:30:00Z',
      }
      if (['calculate', 'run-assurance'].includes(operation)) {
        const job = { id: 7000 + state.recoveryWrites.length, project: record.planningProject.id,
          job_type: operation === 'calculate' ? 'calculate' : 'assurance', status: 'succeeded', terminal: true,
          progress: 100, result_data: {}, created_at: '2026-09-15T06:30:00Z', updated_at: '2026-09-15T06:30:00Z' }
        state.recoveryJobs[job.id] = job
        await reply(route, job, 202)
        return true
      }
      if (operation === 'approve-assurance') workspace.schedule_assurance.status = 'approved'
      if (operation === 'approve') workspace.version.status = 'approved'
      if (operation === 'baseline') {
        workspace.version.status = 'baselined'
        workspace.can_edit = false
        workspace.version.can_prepare_approval = false
      }
      Object.assign(record.versions[0], workspace.version)
      await reply(route, workspace.version)
      return true
    },
  })
}

test('one baseline action prepares calculation and authorized reviews with warnings', async ({ page }) => {
  const state = await recoveryHarness(page, { prepare(current) {
    const workspace = current.records[17].versionWorkspaces[91]
    workspace.version.planning_target_finish = '2026-12-20'
    workspace.planning_package = { contractual_finish: '2026-12-20' }
  } })
  await expectMaster(page)
  await page.locator('.pw-actions').getByRole('button', { name: 'Save Baseline', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Enter details', exact: true })
  await dialog.getByRole('textbox', { name: 'Baseline name', exact: true }).fill('Reviewed planning baseline')
  await dialog.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Baseline created and locked.', { exact: true })).toBeVisible()
  expect(state.recoveryWrites.map(row => row.operation)).toEqual([
    'calculate', 'recover-draft', 'calculate', 'run-assurance',
    'approve-assurance', 'approve', 'baseline',
  ])
  expect(state.recoveryWrites.at(-1).body.name).toBe('Reviewed planning baseline')
  expect(state.records[17].planningProject.planned_end_date).toBe('2026-12-20')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('an active schedule job blocks edits, recalculation, approval, baseline and target recovery', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('radai-schedule-job-71', '812'))
  const state = await recoveryHarness(page, { prepare(current) {
    current.records[17].versionWorkspaces[91].activities[0].total_float_days = -2
    current.activeScheduleJob = {
      id: 812, project: current.records[17].planningProject.id,
      job_type: 'calculate', status: 'running', progress: 20,
      message: 'Validating activity network and calendars', result_data: {},
      api_contract_version: 4,
    }
  } })
  await expectMaster(page)
  const actions = page.locator('.pw-actions')
  await page.locator('.pw-footer-more > summary').click()
  await expect(actions.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(actions.getByRole('button', { name: 'Recalculate CPM', exact: true })).toBeDisabled()
  await expect(actions.getByRole('button', { name: 'Approve Schedule', exact: true })).toBeDisabled()
  await expect(actions.getByRole('button', { name: 'Save Baseline', exact: true })).toBeDisabled()
  await openScheduleDetails(page)
  await expect(page.getByRole('button', { name: 'Adjust planning target & recalculate', exact: true })).toBeDisabled()
  await expect(page.getByText('Validating activity network and calendars', { exact: true })).toBeVisible()

  state.activeScheduleJob.status = 'succeeded'
  state.activeScheduleJob.terminal = true
  state.activeScheduleJob.progress = 100
  await expect(actions.getByRole('button', { name: 'Recalculate CPM', exact: true })).toBeEnabled({ timeout: 10000 })
  await expect(page.getByText('Validating activity network and calendars', { exact: true })).toHaveCount(0)
  clean(state)
})

test('running assurance does not approve the assurance review automatically', async ({ page }) => {
  const state = await recoveryHarness(page)
  await expectMaster(page)
  await plannerNav(page).locator('.pw-more-tabs > summary').click()
  await plannerArea(page, 'Schedule Assurance').click()
  await page.getByRole('button', { name: 'Run Phase 3 assurance', exact: true }).click()
  await expect(page.getByText('Schedule recalculated and Phase 3 assurance completed.', { exact: true })).toBeVisible()
  expect(state.recoveryWrites.map(row => row.operation)).toEqual(['calculate', 'run-assurance'])
  expect(state.records[17].versionWorkspaces[91].schedule_assurance.status).toBe('ready')
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('confirmed numeric IDs and planning target actions preserve source and contract dates', async ({ page }) => {
  const state = await recoveryHarness(page)
  await expectMaster(page)
  await page.locator('.pw-footer-more > summary').click()
  await page.getByRole('button', { name: 'Numeric IDs', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByText('Numeric activity IDs applied and CPM recalculated. Original IDs are retained.', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '100 activity name', exact: true })).toHaveValue('Process design basis')
  await openScheduleDetails(page)
  await page.getByRole('button', { name: 'Adjust planning target & recalculate', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Confirm action', exact: true })
  await expect(confirm).toContainText('2026-12-28')
  await confirm.getByRole('button', { name: 'Confirm', exact: true }).click()
  await openScheduleDetails(page)
  await expect(page.getByText('Draft planning target:', { exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Schedule action status' })).toContainText('2026-12-28')
  expect(state.records[17].versionWorkspaces[91].activities[0].metadata.original_external_id).toBe('ENG-001')
  expect(state.records[17].planningProject.planned_end_date).toBe('2026-12-20')
  expect(state.recoveryWrites.map(row => row.operation)).toEqual([
    'recover-draft', 'calculate', 'calculate', 'recover-draft', 'calculate',
  ])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('integrity failure offers a correction action without approving or baselining', async ({ page }) => {
  const state = await recoveryHarness(page, { rejectCalculation: true })
  await expectMaster(page)
  await page.locator('.pw-actions').getByRole('button', { name: 'Approve Schedule', exact: true }).click()
  await page.getByRole('dialog', { name: 'Confirm action', exact: true }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Action needs attention')
  await page.getByRole('button', { name: 'Open Logic', exact: true }).click()
  await expect(plannerArea(page, 'Logic')).toHaveAttribute('aria-current', 'page')
  expect(state.recoveryWrites.map(row => row.operation)).toEqual(['calculate'])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('Schedule opens the original populated master on desktop and mobile without creating a replacement draft', async ({ page }, testInfo) => {
  const state = await harness(page, { prepare(current) {
    current.records[17].versionWorkspaces[91].scheduling_configuration = {
      configuration_version: 3, workflow_template: 'Reviewed source workflow', workflow_stages: [],
      dependency_template: 'Recorded source relationships', standard_task_count: 4,
      confirmed_dependency_rule_count: 2, dependency_rule_count: 2,
    }
  } })
  await expectMaster(page)
  await expect(page.getByRole('button', { name: 'Schedule settings', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  const settings = page.getByRole('dialog', { name: 'Schedule settings', exact: true })
  await expect(settings).toBeVisible()
  await expect(settings.getByRole('combobox', { name: 'Schedule', exact: true })).toHaveValue('81')
  await expect(settings.locator('.pw-configuration')).toHaveCount(1)
  await settings.locator('.pw-configuration > summary').click()
  await expect(settings.getByText('Recorded source relationships', { exact: true })).toBeVisible()
  const settingsScan = await new AxeBuilder({ page }).include('.pw-settings-dialog').analyze()
  expect(settingsScan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.keyboard.press('Escape')
  await expect(settings).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Schedule settings', exact: true })).toBeFocused()
  // The retained deliverables/Gantt view displays existing activities immediately.
  await expect(page.locator('input[value="Piping isometrics package"]')).toBeVisible()
  await expect(page.getByText('No schedule activities created', { exact: true })).toHaveCount(0)
  await expect(page.locator('.planner-workspace .pw-header, .planner-workspace .pw-metrics')).toHaveCount(0)
  await expect(page.locator('.planner-workspace .pw-main > .pw-configuration')).toHaveCount(0)
  const workspace = state.records[17].versionWorkspaces[91]
  const expectedCounts = [
    ['Activities', String(workspace.activities.length)], ['Critical', String(workspace.activities.filter(row => row.is_critical).length)],
    ['Milestones', String(workspace.activities.filter(row => row.is_milestone).length)], ['WBS Nodes', String(workspace.wbs.length)],
    ['Logic Ties', String(workspace.relationships.length)], ['Resources', String(workspace.resources.length)], ['Open Evidence', 'Not available'],
  ]
  const summary = page.locator('.pw-inline-metrics[aria-label="Selected schedule summary"]')
  await expect(summary.locator(':scope > div')).toHaveCount(7)
  for (const [index, [label, value]] of expectedCounts.entries()) {
    await expect(summary.locator('dt').nth(index)).toHaveText(label === 'WBS Nodes' ? 'WBS' : label === 'Logic Ties' ? 'ties' : label.toLowerCase())
    await expect(summary.locator('dd').nth(index)).toHaveText(value)
  }
  const desktopTable = await page.locator('.planner-workspace table').first().boundingBox()
  // Prior inspected 1672px desktop proof placed this table header at y≈813px.
  expect(desktopTable.y).toBeLessThan(650)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: '../artifacts/compact-master-schedule-desktop.png', fullPage: true, animations: 'disabled' })
  await showActivities(page)
  await expect(activityName(page)).toBeEnabled()
  await expect(page.getByText('6 activities', { exact: true })).toBeVisible()
  const desktopScan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(desktopScan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(plannerArea(page, 'Performance')).toBeVisible()
  for (const [index, [, value]] of expectedCounts.entries()) await expect(summary.locator('dd').nth(index)).toHaveText(value)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: '../artifacts/compact-master-schedule-mobile.png', fullPage: true, animations: 'disabled' })
  const mobileScan = await new AxeBuilder({ page }).include('.project-performance-workspace').analyze()
  expect(mobileScan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  const mobileSettings = await openRetainedScheduleSettings(page)
  await mobileSettings.locator('.pw-configuration > summary').click()
  await expect(mobileSettings.getByText('Recorded source relationships', { exact: true })).toBeVisible()
  const bounds = await mobileSettings.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  const mobileSettingsScan = await new AxeBuilder({ page }).include('.pw-settings-dialog').analyze()
  expect(mobileSettingsScan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await closeRetainedScheduleSettings(page)
  await expect(page.getByRole('button', { name: 'Schedule settings', exact: true })).toBeFocused()
  await testInfo.attach('compact-layout', { body: JSON.stringify({ desktopWidth: 1672, priorScreenshotTableTop: 813,
    compactTableTop: desktopTable.y, verticalSpaceRecovered: 813 - desktopTable.y, counts: expectedCounts,
    mobileWidth: 390, settingsBounds: bounds }, null, 2), contentType: 'application/json' })
  clean(state)
})

test('the saved master pointer selects its existing version even when a newer empty draft state exists', async ({ page }) => {
  const state = await harness(page, { prepare(current) { current.records[17].masterVersionId = 90 } })
  await expectMaster(page, 90)
  await showActivities(page, 'Baseline: Piping isometrics package')
  await expect(activityName(page)).toBeDisabled()
  await page.reload()
  await expectMaster(page, 90)
  await showActivities(page, 'Baseline: Piping isometrics package')
  clean(state)
})

test('Performance follows the selected immutable revision and returns to the same master activities', async ({ page }) => {
  const state = await harness(page)
  await expectMaster(page)
  await selectRetainedScheduleVersion(page, '90')
  await expect(page.locator('input[value="Baseline: Piping isometrics package"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Schedule settings', exact: true })).toBeFocused()
  await showActivities(page, 'Baseline: Piping isometrics package')
  await expect(activityName(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Add Activity', exact: true })).toBeDisabled()
  await plannerArea(page, 'Performance').click()
  await expect(plannerArea(page, 'Performance')).toHaveAttribute('aria-current', 'page')
  await expectRetainedScheduleVersion(page, '90')
  await expect(page.getByRole('combobox', { name: 'Compare', exact: true })).toHaveCount(0)
  await expect(page.getByRole('progressbar', { name: 'Actual progress', exact: true })).toHaveAttribute('aria-valuenow', '17')
  await expect(page.getByRole('region', { name: 'Critical and late activity records', exact: true })).toContainText('Baseline: Piping isometrics package')
  await page.getByRole('button', { name: 'Open full schedule', exact: true }).click()
  await expect(plannerArea(page, 'Activities & Gantt')).toHaveAttribute('aria-current', 'page')
  await expectRetainedScheduleVersion(page, '90')
  await expect(activityName(page)).toHaveValue('Baseline: Piping isometrics package')
  await selectRetainedScheduleVersion(page, '91')
  await expect(activityName(page)).toHaveValue('Piping isometrics package')
  await expect(page.getByRole('button', { name: 'Schedule settings', exact: true })).toBeFocused()
  await expect(activityName(page)).toBeEnabled()
  await plannerArea(page, 'Performance').click()
  await expectRetainedScheduleVersion(page, '91')
  await expect(page.getByRole('progressbar', { name: 'Actual progress', exact: true })).toHaveAttribute('aria-valuenow', '42')
  await expect(page).toHaveURL(url => url.searchParams.get('scheduleTab') === 'performance')
  await page.reload()
  await expectMaster(page)
  await expect(plannerArea(page, 'Performance')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('progressbar', { name: 'Actual progress', exact: true })).toHaveAttribute('aria-valuenow', '42')
  expect(state.requests.some(request => request.path.endsWith('/schedule-versions/90/controls/'))).toBe(true)
  clean(state)
})

for (const [mode, initialTab] of [['planner', 'Activities & Gantt'], ['management', 'Performance']]) {
  test(`legacy ${mode} links open a tab of the same retained master workspace`, async ({ page }) => {
    const state = await harness(page, { query: `project=17&view=plan-baseline&scheduleMode=${mode}&shell=true` })
    await expectMaster(page)
    await expect(plannerArea(page, initialTab)).toHaveAttribute('aria-current', 'page')
    if (mode === 'management') {
      await expectRetainedScheduleVersion(page, '91')
      await page.getByRole('button', { name: 'Open full schedule', exact: true }).click()
    }
    await showActivities(page)
    await expect(plannerNav(page)).toHaveCount(1)
    clean(state)
  })
}

test('Document Intelligence keeps its eleven steps and hands the project to the unified master without losing input', async ({ page }) => {
  const state = await harness(page, { query: 'project=17&view=plan-baseline&scheduleMode=documents&shell=true' })
  await expect(documentNav(page).getByRole('button')).toHaveCount(11)
  await page.getByRole('textbox', { name: 'Scope summary', exact: true }).fill('Unsaved document scope for this project.')
  await documentNav(page).getByRole('button', { name: /^4\. Schedule Generator/ }).click()
  await page.getByRole('button', { name: 'Open schedule workspace', exact: true }).click()
  await expectMaster(page)
  await showActivities(page)
  await expect(plannerNav(page)).toHaveCount(1)
  await outerNav(page).getByRole('button', { name: 'Document Intelligence', exact: true }).click()
  await expect(documentNav(page)).toBeVisible()
  await documentNav(page).getByRole('button', { name: /^1\. Upload Files/ }).click()
  await expect(page.getByRole('textbox', { name: 'Scope summary', exact: true })).toHaveValue('Unsaved document scope for this project.')
  clean(state)
})

test('an unsaved master activity survives Performance and document navigation and cancelling New Revision writes nothing', async ({ page }) => {
  const state = await harness(page)
  await expectMaster(page)
  await showActivities(page)
  await activityName(page).fill('Unsaved piping scope clarification')
  await retainedScheduleAction(page, 'New Revision')
  const confirmation = page.getByRole('dialog', { name: 'Confirm action', exact: true })
  await expect(confirmation).toContainText('Discard unsaved activity changes and continue?')
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await closeRetainedScheduleSettings(page)
  await expect(activityName(page)).toHaveValue('Unsaved piping scope clarification')
  await plannerArea(page, 'Performance').click()
  await expect(page.getByRole('progressbar', { name: 'Actual progress', exact: true })).toHaveAttribute('aria-valuenow', '42')
  await outerNav(page).getByRole('button', { name: 'Document Intelligence', exact: true }).click()
  await expect(documentNav(page).getByRole('button')).toHaveCount(11)
  await outerNav(page).getByRole('button', { name: 'Master Schedule', exact: true }).click()
  await showActivities(page, 'Unsaved piping scope clarification')
  await expect(page.getByText('1 unsaved', { exact: true })).toBeVisible()
  await expectRetainedScheduleVersion(page, '91')
  clean(state)
})

test('a denied master workspace exposes retry and never substitutes an empty editable draft', async ({ page }) => {
  const message = 'You do not have access to this schedule version.'
  const state = await harness(page, { prepare(current) { current.workspaceErrors[91] = { status: 403, message } } })
  await expect(page.getByRole('alert')).toContainText(message)
  await expect(page.locator('input[value="Piping isometrics package"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add Activity', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Recalculate CPM', exact: true })).toBeDisabled()
  delete state.workspaceErrors[91]
  await retainedScheduleAction(page, 'Reload schedule')
  await expectMaster(page)
  await showActivities(page)
  await expect(activityName(page)).toBeEnabled()
  clean(state)
})

test('a failed revision load removes the previous version values and retries the selected revision', async ({ page }) => {
  const state = await harness(page)
  await expectMaster(page)
  await showActivities(page)
  state.workspaceErrors[90] = { status: 503, message: 'Selected revision is temporarily unavailable.' }
  await selectRetainedScheduleVersion(page, '90')
  await expect(page.getByRole('alert')).toContainText('Selected revision is temporarily unavailable.')
  await expect(activityName(page)).toHaveCount(0)
  await expectRetainedScheduleVersion(page, '90')
  await expect(page.getByRole('button', { name: 'Export schedule', exact: true })).toBeDisabled()
  delete state.workspaceErrors[90]
  await retainedScheduleAction(page, 'Reload schedule')
  await showActivities(page, 'Baseline: Piping isometrics package')
  await expect(activityName(page)).toBeDisabled()
  clean(state)
})

test('switching enterprise projects ignores a late response from the previous master', async ({ page }) => {
  const state = await harness(page)
  await expectMaster(page)
  await showActivities(page)
  state.heldWorkspaces.add(91)
  await retainedScheduleAction(page, 'Reload schedule')
  await expect.poll(() => state.releaseWorkspaces.length).toBeGreaterThan(0)
  const header = page.locator('header.pd-header')
  await header.locator('summary[aria-label="More project actions"]').click()
  await header.getByRole('combobox', { name: 'Active Project', exact: true }).fill('Grid Power')
  await header.getByRole('option').filter({ hasText: state.records[18].project.name }).click()
  await expectMaster(page, 1091)
  await showActivities(page, 'Grid scope: Piping isometrics package')
  state.heldWorkspaces.clear()
  for (const release of state.releaseWorkspaces.splice(0)) release()
  await expect(header.getByRole('heading', { level: 1 })).toHaveText(state.records[18].project.name)
  await expectRetainedScheduleVersion(page, '1091')
  await expect(activityName(page)).toHaveValue('Grid scope: Piping isometrics package')
  await plannerArea(page, 'Performance').click()
  await expectRetainedScheduleVersion(page, '1091')
  await expect(page.getByRole('progressbar', { name: 'Actual progress', exact: true })).toHaveAttribute('aria-valuenow', '28')
  await expect(page.getByRole('region', { name: 'Critical and late activity records', exact: true })).toContainText('Grid scope: Piping isometrics package')
  clean(state)
})

for (const conflicting of [false, true]) {
  test(`a resource save refresh ${conflicting ? 'reports a concurrent activity conflict without replacing local edits' : 'preserves unsaved activity edits and refreshes calculated dates'}`, async ({ page }) => {
    const state = await harness(page, {
      prepare(current) {
        current.resourceWrites = []
        current.resource = { id: 701, project: 71, code: 'MAYA', name: 'Maya Hassan', resource_type: 'labor',
          unit: 'hour', capacity_units_per_day: '8.00', productivity_rate: null, productivity_unit: '', can_edit: true }
      },
      async handleRequest({ path, route, url, state: current, reply }) {
        if (path.endsWith('/resources/plan/')) {
          expect(url.searchParams.get('project')).toBe('71')
          expect(url.searchParams.get('version')).toBe('91')
          await reply(route, { resources: [current.resource], activities: current.records[17].versionWorkspaces[91].activities,
            assignments: [], permissions: { can_manage_resources: true, can_allocate: true } })
          return true
        }
        if (path.endsWith('/resources/701/') && route.request().method() === 'PATCH') {
          const data = route.request().postDataJSON()
          current.resourceWrites.push({ path, method: 'PATCH', data })
          Object.assign(current.resource, data)
          const workspace = current.records[17].versionWorkspaces[91]
          workspace.version = { ...workspace.version, updated_at: '2026-09-15T06:35:00Z' }
          const row = workspace.activities.find(activity => activity.external_id === 'PIP-014')
          row.planned_finish = '2026-10-01'
          if (conflicting) row.name = 'Activity renamed by another planner'
          await reply(route, current.resource)
          return true
        }
        return false
      },
    })
    await expectMaster(page)
    await showActivities(page)
    await activityName(page).fill('Locally reviewed piping package')
    await page.getByRole('spinbutton', { name: 'PIP-014 duration in days', exact: true }).fill('45')
    await plannerArea(page, 'Resources').click()
    const resourcePlan = page.getByRole('region', { name: 'Resource planning', exact: true })
    await resourcePlan.getByRole('button', { name: 'Edit MAYA', exact: true }).click()
    await resourcePlan.getByRole('textbox', { name: 'Resource name', exact: true }).fill('Reviewed process lead')
    await resourcePlan.getByRole('button', { name: 'Save resource', exact: true }).click()
    await expect(resourcePlan.getByRole('status').filter({ hasText: 'Resource saved.' })).toContainText('Resource saved.')
    if (conflicting) await expect(page.getByRole('alert')).toContainText('The schedule changed while you had unsaved activity edits.')
    await showActivities(page, 'Locally reviewed piping package')
    await expect(page.getByRole('spinbutton', { name: 'PIP-014 duration in days', exact: true })).toHaveValue('45')
    await expect(activityName(page).locator('xpath=ancestor::tr')).toContainText(conflicting ? '2026-09-29' : '2026-10-01')
    await expect(page.getByText('1 unsaved', { exact: true })).toBeVisible()
    expect(state.resourceWrites).toEqual([{ method: 'PATCH', path: '/api/v1/planning-intelligence/resources/701/',
      data: expect.objectContaining({ project: 71, name: 'Reviewed process lead' }) }])
    expect(state.requests.filter(request => request.method !== 'GET')).toHaveLength(1)
    expect(state.unexpectedWrites).toEqual([])
    expect(state.pageErrors).toEqual([])
    expect(state.unknown).toEqual([])
  })
}


test('compact schedule keeps table rows aligned with timeline and retains footer actions', async ({ page }) => {
  await harness(page, { prepare(state) {
    const record = state.records[17]
    const workspace = record.versionWorkspaces[91]
    const definitions = [
      ['Base database synchronization', ['Database schema update', 'Company review', 'Issue for approval', 'Company approval', 'Final issue']],
      ['Technical deviations & queries', ['Deviation register', 'Technical query review', 'Close-out approval']],
      ['Master drawing updates', ['Drawing register reconciliation', 'Interdisciplinary review', 'Approved drawing release']],
    ]
    const stages = ['IFR', 'COMPANY_REVIEW', 'IFA', 'COMPANY_APPROVAL', 'FINAL_ISSUE']
    const tasks = definitions.flatMap(([deliverable, names], group) => names.map((name, index) => ({
      ...workspace.activities[0], id: 4001 + group * 100 + index, external_id: String(101 + group * 100 + index * 10),
      name, discipline: 'engineering', metadata: { deliverable, workflow_stage_code: stages[index], workflow_stage_sequence: index },
      planned_start: ['2026-11-04', '2026-11-18', '2026-12-02', '2026-12-09', '2026-12-16'][index],
      planned_finish: ['2026-11-17', '2026-12-01', '2026-12-08', '2026-12-15', '2026-12-16'][index],
      duration_days: [10, 10, 5, 5, 1][index], is_milestone: false, is_critical: group === 2 && index === 1,
    })))
    workspace.activities = tasks
    workspace.deliverable_summaries = definitions.map(([deliverable, names]) => ({
      deliverable, discipline: 'engineering', task_count: names.length, planned_start: '2026-11-04', planned_finish: '2026-12-16',
    }))
    workspace.relationships = definitions.flatMap(([, names], group) => names.slice(1).map((_, index) => ({
      id: group * 100 + index, predecessor: 4001 + group * 100 + index, successor: 4002 + group * 100 + index, relationship_type: 'FS', lag_days: 0,
    })))
    workspace.planning_package = { contractual_finish: '2027-01-27', project_start: '2026-11-04' }
    workspace.version.calculated_finish = '2027-02-10'
    workspace.version.status = 'calculated'
  } })
  await expect(page.locator('.pw-reference .planner-grid-table')).toBeVisible()
  await page.locator('.pg-menu > summary').click()
  await page.getByRole('checkbox', { name: 'Float', exact: true }).check()
  await expect(page.locator('.planner-grid-header').getByText('Float', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Float', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Expand all', exact: true }).click()
  await page.locator('.pg-menu > summary').click()
  const tableRows = await page.locator('.pg-activity-row').evaluateAll(rows => rows.map(row => ({ top: row.getBoundingClientRect().top, height: row.getBoundingClientRect().height })))
  const timelineRows = await page.locator('.pg-timeline-activity, .pg-timeline-selected').evaluateAll(rows => rows.map(row => ({ top: row.getBoundingClientRect().top, height: row.getBoundingClientRect().height })))
  expect(tableRows).toHaveLength(11)
  expect(timelineRows).toHaveLength(tableRows.length)
  tableRows.forEach((row, index) => {
    expect(Math.abs(row.top - timelineRows[index].top)).toBeLessThanOrEqual(1)
    expect(Math.abs(row.height - timelineRows[index].height)).toBeLessThanOrEqual(1)
  })
  const toolbar = await page.locator('.pw-activity-filters').boundingBox()
  const chart = await page.locator('.planner-gantt-screen').boundingBox()
  const footer = await page.locator('.pw-action-bar').boundingBox()
  expect(toolbar.y).toBeLessThan(chart.y)
  expect(footer.y).toBeGreaterThan(chart.y + chart.height)
  await expect(page.getByRole('button', { name: 'Approve Schedule', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Baseline', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Logic on', exact: true }).click()
  await expect(page.locator('.planner-gantt-screen svg > g')).toHaveCount(0)
  await page.getByRole('button', { name: 'Logic off', exact: true }).click()
  await expect(page.locator('.planner-gantt-screen svg > g')).toHaveCount(8)
  await page.addStyleTag({ content: '.performance-test-shell { margin-left: 218px !important; padding-top: 48px; }' })
  const finalChart = await page.locator('.planner-gantt-screen').boundingBox()
  const finalFooter = await page.locator('.pw-action-bar').boundingBox()
  expect(Math.abs(finalChart.y - 383)).toBeLessThanOrEqual(1)
  expect(finalFooter.y + finalFooter.height).toBeLessThanOrEqual(942)
  await page.screenshot({ path: '../artifacts/schedule-reference-main.png', fullPage: true })
  await page.locator('.project-performance-workspace').screenshot({ path: '../artifacts/schedule-reference-main-content.png' })
})
