import { test, expect } from '@playwright/test'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

async function setup(page, options = {}) {
  return planningInputsHarness(page, {
    harnessPath: '/tests/fixtures/project-performance-harness.jsx',
    query: 'project=17&view=plan-baseline&scheduleTab=logic&shell=true',
    prepare(state) {
      state.guidanceWrites = []
      const workspace = state.records[17].workspace
      workspace.can_edit = !options.readOnly
      workspace.version.status = options.readOnly ? 'approved' : 'draft'
    },
    async handleRequest({ path, route, reply, state }) {
      if (!path.endsWith('/piping-guidance/')) return false
      if (route.request().method() === 'POST') {
        state.guidanceWrites.push(route.request().postDataJSON())
        await reply(route, options.stale ? { error: 'The schedule or preview changed. Review the piping guidance again.' }
          : { version_id: 91, matched_rule_count: 36 }, options.stale ? 409 : 200)
        return true
      }
      await reply(route, {
        version_id: 91, preview_token: 'reviewed-schedule-state', can_apply: !options.blocked && !options.readOnly,
        matched_rule_count: 36, add_links: [{ predecessor_id: 1, successor_id: 2,
          predecessor: 'P&IDs IFR', successor: 'Plot Plan IFR', type: 'FF', lag_days: 3 }],
        remove_links: [], duration_changes: [{ activity_id: 3, name: 'Valve Vendor Offers Milestone',
          previous_duration_days: 0, duration_days: 15, previous_activity_type: 'finish_milestone' }],
        missing_scope: [], issues: options.blocked ? [{ code: 'piping_stage_missing', message: 'Required stage missing: TBE for Valves IFC.' }] : [],
        deadline: { finish_by: '2027-01-13', contractual_finish: '2027-01-27',
          piping_working_days: 54, project_working_days: 60, contingency_working_days: 6 },
      })
      return true
    },
  })
}

test('piping guidance previews changes without writing and applies only the reviewed token', async ({ page }) => {
  const state = await setup(page)
  await page.getByRole('button', { name: 'Review piping guidance', exact: true }).click()
  await expect(page.getByText('Piping finish by 2027-01-13', { exact: true })).toBeVisible()
  expect(state.guidanceWrites).toEqual([])
  await page.getByText('Review relationship changes', { exact: true }).click()
  await expect(page.getByRole('cell', { name: 'FF+3 working days', exact: true })).toBeVisible()
  await page.getByText('Review duration and milestone corrections', { exact: true }).click()
  await expect(page.getByText(/Valve Vendor Offers Milestone: 0/)).toContainText('15 working days')
  await page.getByRole('button', { name: 'Apply reviewed piping guidance', exact: true }).click()
  await expect(page.getByText('Piping guidance applied. Recalculate CPM, then review schedule assurance and the 90% piping deadline.', { exact: true })).toBeVisible()
  expect(state.guidanceWrites).toEqual([{ preview_token: 'reviewed-schedule-state' }])
  expect(state.pageErrors).toEqual([])
})

test('missing exact revisions block application', async ({ page }) => {
  const state = await setup(page, { blocked: true })
  await page.getByRole('button', { name: 'Review piping guidance', exact: true }).click()
  await expect(page.getByText('Required stage missing: TBE for Valves IFC.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply reviewed piping guidance', exact: true })).toBeDisabled()
  expect(state.guidanceWrites).toEqual([])
})

test('approved schedules can review guidance but cannot apply it', async ({ page }) => {
  const state = await setup(page, { readOnly: true })
  await page.getByRole('button', { name: 'Review piping guidance', exact: true }).click()
  await expect(page.getByText('Create or open an editable revision with schedule edit access to apply this guidance.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply reviewed piping guidance', exact: true })).toBeDisabled()
  expect(state.guidanceWrites).toEqual([])
})

test('stale guidance failures remain visible and require a new preview', async ({ page }) => {
  const state = await setup(page, { stale: true })
  await page.getByRole('button', { name: 'Review piping guidance', exact: true }).click()
  await page.getByRole('button', { name: 'Apply reviewed piping guidance', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The schedule or preview changed. Review the piping guidance again.')
  await expect(page.getByRole('button', { name: 'Apply reviewed piping guidance', exact: true })).toHaveCount(0)
  expect(state.guidanceWrites).toHaveLength(1)
})

test('unsaved activity changes disable guidance review and application', async ({ page }) => {
  const state = await setup(page)
  const navigation = page.getByRole('navigation', { name: 'Planning workspace areas', exact: true })
  await navigation.getByRole('button', { name: 'Activities & Gantt', exact: true }).click()
  await page.getByRole('textbox', { name: 'PIP-014 activity name', exact: true }).fill('Unsaved piping activity')
  await navigation.getByRole('button', { name: 'Logic', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Review piping guidance', exact: true })).toBeDisabled()
  await expect(page.getByText('Save activity changes before reviewing and applying guidance.', { exact: true })).toBeVisible()
  expect(state.guidanceWrites).toEqual([])
})
