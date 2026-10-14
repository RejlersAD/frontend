import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { scheduleArea, scheduleMenu, scheduleWorkspace } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)

async function setup(page, { canonical = false, historical = false, approvedProfile = false } = {}) {
  await page.setViewportSize({ width: 1700, height: 1050 })
  const state = await masterScheduleHarness(page, {
    decorateSnapshot(plan) {
      Object.assign(plan, {
        canonical_version: canonical,
        viewing_history: historical,
        version_id: canonical ? 120 : null,
        planning_profile: { valid: approvedProfile },
      })
      Object.assign(plan.permissions, {
        can_edit: !canonical && !historical,
        can_calculate: canonical && !historical,
        can_propose_sequence: true,
      })
      return plan
    },
  })
  await expect(scheduleWorkspace(page).getByRole('heading', { name: 'Master Schedule', exact: true })).toBeVisible()
  return state
}

async function expectSequenceRemoved(page, state) {
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Generate logic & sequence', exact: true })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'AI logic & sequence Proposal', exact: true })).toHaveCount(0)
  const actions = await scheduleMenu(page, 'Schedule actions')
  await expect(actions.getByRole('button', { name: /AI logic|Generate logic & sequence|AI settings/i })).toHaveCount(0)
  expect(state.requests.filter(({ path }) => /intelligent-sequence|project-setup\/ai-settings/.test(path))).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.writes).toEqual([])
}

test('working draft retains standard build and editable dependencies despite legacy AI sequence permission', async ({ page }) => {
  const state = await setup(page)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Build schedule', exact: true })).toBeEnabled()
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
  await scheduleArea(page, 'logic')
  await expect(scheduleWorkspace(page).getByRole('cell', { name: 'Finish to start', exact: true })).toBeVisible()
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
  await expectSequenceRemoved(page, state)
})

test('approved planning profile retains standard plan generation despite legacy AI sequence permission', async ({ page }) => {
  const state = await setup(page, { approvedProfile: true })
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Generate plan', exact: true })).toBeEnabled()
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Build schedule', exact: true })).toHaveCount(0)
  await expectSequenceRemoved(page, state)
})

test('canonical schedule retains calculation and prevents direct draft edits', async ({ page }) => {
  const state = await setup(page, { canonical: true })
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Calculate schedule', exact: true })).toBeEnabled()
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Build schedule', exact: true })).toHaveCount(0)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expectSequenceRemoved(page, state)
})

test('historical schedule keeps generation and editing unavailable', async ({ page }) => {
  const state = await setup(page, { canonical: true, historical: true, approvedProfile: true })
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Calculate schedule', exact: true })).toBeDisabled()
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Build schedule', exact: true })).toHaveCount(0)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Generate plan', exact: true })).toHaveCount(0)
  await expect(scheduleWorkspace(page).getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expectSequenceRemoved(page, state)
  const actions = await scheduleMenu(page, 'Schedule actions')
  await expect(actions.getByRole('button', { name: 'Generate project plan', exact: true })).toBeDisabled()
})
