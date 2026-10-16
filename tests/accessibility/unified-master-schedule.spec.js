import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { planningInputsHarness, populatePlanningEvidence } from '../fixtures/planning-inputs.fixture.js'
import { openRetainedScheduleSettings, closeRetainedScheduleSettings, expectRetainedScheduleVersion, selectRetainedScheduleVersion, retainedScheduleAction } from '../fixtures/retained-schedule-controls.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

const outerNav = page => page.getByRole('navigation', { name: 'Schedule workspace', exact: true })
const plannerNav = page => page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })
const plannerArea = (page, name) => plannerNav(page).getByRole('button', { name, exact: true })
const activityName = page => page.getByRole('textbox', { name: 'PIP-014 activity name', exact: true })
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
    await expect(summary.locator('dt').nth(index)).toHaveText(label)
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
  await expect(page.getByText(message, { exact: true })).toBeVisible()
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
  await expect(page.getByText('Selected revision is temporarily unavailable.', { exact: true })).toBeVisible()
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
    await expect(resourcePlan.getByRole('status')).toContainText('Resource saved.')
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
