import { test, expect } from '@playwright/test'
import { masterScheduleHarness, registerNames } from '../fixtures/master-schedule.fixture.js'

test.setTimeout(60000)

test('manual activities save phase, deliverable, typed dependencies and constraints, then reload for editing', async ({ page }) => {
  const state = await masterScheduleHarness(page, { manual: true })
  const workspace = page.getByRole('region', { name: 'Master schedule workspace', exact: true })
  await workspace.getByRole('button', { name: 'Add activity', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Add task', exact: true })
  await editor.getByLabel('Task / deliverable', { exact: true }).fill('Validate commissioned package')
  await editor.getByLabel('WBS phase', { exact: true }).fill('Commissioning')
  await editor.getByLabel('WBS deliverable', { exact: true }).fill('Accepted system')
  await editor.getByLabel('Duration (working days)', { exact: true }).fill('3')
  await editor.getByRole('checkbox', { name: registerNames[0], exact: true }).check()
  await editor.getByRole('combobox', { name: `Relationship to ${registerNames[0]}`, exact: true }).selectOption('FF')
  await editor.getByLabel(`Lag for ${registerNames[0]} (working days)`, { exact: true }).fill('1.1')
  await editor.getByRole('combobox', { name: 'Schedule constraint', exact: true }).selectOption('must_finish')
  await editor.getByLabel('Constraint date', { exact: true }).fill('2026-10-02')
  await editor.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(editor).toHaveCount(0)
  const write = state.writes.find(item => item.method === 'PUT' && item.path.endsWith('/simple-plan/'))
  expect(write.data.tasks.at(-1)).toMatchObject({
    wbs_phase: 'Commissioning', wbs_deliverable: 'Accepted system', duration_days: 3,
    constraint_type: 'must_finish', constraint_date: '2026-10-02', depends_on: ['register-1'],
    dependency_details: [{ task_id: 'register-1', type: 'FF', lag_days: 1.1 }],
  })
  await page.reload()
  await workspace.getByRole('button', { name: 'Edit duration for Validate commissioned package', exact: true }).click()
  const reopened = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await expect(reopened.getByLabel('WBS phase', { exact: true })).toHaveValue('Commissioning')
  await expect(reopened.getByLabel('WBS deliverable', { exact: true })).toHaveValue('Accepted system')
  await expect(reopened.getByRole('combobox', { name: `Relationship to ${registerNames[0]}`, exact: true })).toHaveValue('FF')
  await expect(reopened.getByLabel('Constraint date', { exact: true })).toHaveValue('2026-10-02')
  // A previously persisted non-quarter-day lag must not block an unrelated edit.
  await reopened.getByLabel('Acceptance criteria', { exact: true }).fill('Commissioning certificate accepted.')
  await reopened.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(reopened).toHaveCount(0)
  for (const type of ['SS', 'SF']) {
    await workspace.getByRole('button', { name: 'Edit duration for Validate commissioned package', exact: true }).click()
    await reopened.getByRole('combobox', { name: `Relationship to ${registerNames[0]}`, exact: true }).selectOption(type)
    await reopened.getByRole('button', { name: 'Save task', exact: true }).click()
    await expect(reopened).toHaveCount(0)
    expect(state.records[17].simplePlan.tasks.at(-1).dependency_details[0]).toMatchObject({ type, lag_days: 1.1 })
  }
  expect(state.pageErrors).toEqual([])
  expect(state.unknownWrites).toEqual([])
})
