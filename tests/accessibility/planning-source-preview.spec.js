import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'

test.setTimeout(60000)
const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const preview = page => page.getByRole('region', { name: 'Extracted source schedule', exact: true })
const sample = (id, start = '2026-10-01', finish = '2026-10-07') => ({
  id, title: `Source package ${id}`, source_activity_id: id, duration_days: 5, duration_unit: 'working_days',
  source_start_date: start, source_finish_date: finish, source_start_status: start ? 'extracted' : 'not_specified',
  source_finish_status: finish ? 'extracted' : 'not_specified', is_milestone: false, calendar_verified: false,
  total_float_days: null, predecessors: [], missing_fields: ['dependencies'],
  source_references: [{ file_id: 904, filename: 'Execution schedule.csv', locator: { row: 12 }, excerpt: `${id}, 5d, ${start}, ${finish}` }],
})
async function harness(page, handler) {
  await page.setViewportSize({ width: 1700, height: 1000 })
  return masterScheduleHarness(page, {
    prepare(state) {
      for (const record of Object.values(state.records)) {
        Object.assign(record.simplePlan, { source_preview_available: true, duration_policy: 'source_only', evidence_policy: 'document_driven' })
        record.simplePlan.tasks.forEach(task => Object.assign(task, { duration_days: null, duration_source: 'missing_source', planned_start_date: null, planned_finish_date: null, due_date: null, depends_on: [] }))
      }
    },
    async handleRequest(context) {
      if (!context.path.endsWith('/simple-plan/source-preview/')) return false
      const offset = Number(context.url.searchParams.get('offset') || 0), search = context.url.searchParams.get('search') || ''
      if (handler) return handler(context, { offset, search })
      await context.reply(context.route, {
        summary: { activity_count: 102, duration_count: 102, relationship_count: 0, unmapped_register_count: 2 },
        project_window: { start_date: '2026-09-21', finish_date: '2026-12-20' },
        rows: search ? [sample('FILTERED')] : offset ? [sample('NEXT-PAGE')] : [sample('SRC-10'), sample('SRC-20', null, null)],
        pagination: { offset, limit: 100, total: search ? 1 : 102, has_next: !search && offset === 0 },
        extraction_reports: [], validation: [],
      }); return true
    },
  })
}

test('recovered source timing is visible without altering the MDR or inventing CPM', async ({ page }) => {
  const state = await harness(page)
  const before = structuredClone(state.records[17].simplePlan)
  await workspace(page).getByRole('button', { name: 'Review extracted schedule', exact: true }).click()
  await expect(preview(page)).toContainText('102 recovered rows')
  await expect(preview(page)).toContainText('2 MDR rows awaiting source links')
  await expect(workspace(page).getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  await expect(workspace(page).locator('.sc-footer')).toHaveCount(0)
  await expect(preview(page)).toContainText('No explicit predecessor relationships were recovered')
  const dated = preview(page).locator('[data-row-id="SRC-10"]')
  await expect(dated.locator('[data-column="duration"]')).toHaveText('5 d')
  await expect(dated.locator('[data-column="start"]')).toHaveText('01-Oct-26')
  await expect(dated.locator('[data-column="finish"]')).toHaveText('07-Oct-26')
  await expect(dated.locator('[data-column="float"]')).toHaveText('Not calculated')
  await expect(dated.locator('.p6-activity-bar')).toHaveCount(1)
  await expect(preview(page).locator('[data-row-id="SRC-20"] .p6-activity-bar')).toHaveCount(0)
  await dated.getByRole('button', { name: 'Source package SRC-10', exact: true }).click()
  await expect(preview(page).getByRole('complementary', { name: 'Extracted activity evidence' })).toContainText('Execution schedule.csv · Row 12')
  await preview(page).getByRole('button', { name: 'Working plan', exact: true }).click()
  await expect(workspace(page).locator(`[data-row-id="${before.tasks[0].id}"] [data-column="duration"]`)).toHaveText('Not Specified')
  expect(state.records[17].simplePlan).toEqual(before)
  expect(state.writes).toEqual([]); expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([])
})

test('source rows paginate and search without hidden replacements of the draft', async ({ page }) => {
  const state = await harness(page)
  await workspace(page).getByRole('combobox', { name: 'Schedule workspace area' }).selectOption('source-schedule')
  await preview(page).getByRole('button', { name: 'Next', exact: true }).click()
  await expect(preview(page)).toContainText('Source package NEXT-PAGE')
  await expect(preview(page).getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await preview(page).getByRole('textbox', { name: 'Search extracted schedule' }).fill('filter')
  await preview(page).getByRole('button', { name: 'Search', exact: true }).click()
  await expect(preview(page)).toContainText('1–1 of 1 rows matching search')
  await expect(preview(page)).toContainText('Source package FILTERED')
  await expect(preview(page).getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  expect(state.writes).toEqual([]); expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([])
})

test('preview retains printed float evidence without declaring a CPM calculation', async ({ page }) => {
  const state = await harness(page, async ({ route, reply }) => {
    await reply(route, { summary: { activity_count: 1 }, project_window: {}, pagination: { total: 1 },
      rows: [{ ...sample('PRINTED-ZERO'), source_total_float_days: '0', source_total_float_status: 'extracted',
        source_total_float_references: [{ file_id: 904, filename: 'Execution schedule.csv', locator: { row: 12 } }] }] })
    return true
  })
  await workspace(page).getByRole('button', { name: 'Review extracted schedule', exact: true }).click()
  const row = preview(page).locator('[data-row-id="PRINTED-ZERO"]')
  await expect(row.locator('[data-column="float"]')).toHaveText('0')
  await expect(row.locator('[data-column="float"]')).toHaveAttribute('data-float-basis', 'source')
  await row.getByRole('button', { name: 'Source package PRINTED-ZERO', exact: true }).click()
  await expect(preview(page).getByRole('complementary', { name: 'Extracted activity evidence' })).toContainText('Source total float: 0 days as printed.')
  expect(state.writes).toEqual([])
  expect(state.pageErrors).toEqual([])
})

test('an extraction preview error remains visible and can be retried', async ({ page }) => {
  let attempts = 0
  const state = await harness(page, async context => {
    attempts += 1
    await context.reply(context.route, attempts === 1 ? { error: 'Saved source text unavailable.' } : { rows: [], summary: {}, pagination: {} }, attempts === 1 ? 503 : 200)
    return true
  })
  await workspace(page).getByRole('button', { name: 'Review extracted schedule', exact: true }).click()
  await expect(preview(page).getByRole('alert')).toHaveText('Saved source text unavailable.')
  await preview(page).getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(preview(page)).toContainText('No supported schedule activity rows were recovered')
  expect(state.writes).toEqual([]); expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([])
})

test('source duration units and milestones stay explicit instead of becoming assumed days', async ({ page }) => {
  const state = await harness(page, async context => {
    await context.reply(context.route, {
      rows: [{ ...sample('HOURS'), duration_days: 8, duration_unit: 'hours' },
        { ...sample('MILESTONE', '2026-10-08', '2026-10-08'), duration_days: 0, is_milestone: true },
        { ...sample('UNCERTAIN', null, null), source_start_status: 'ambiguous', source_finish_status: 'ambiguous', printed_single_date: '2026-10-09' }],
      summary: { activity_count: 3 }, pagination: { offset: 0, total: 3, has_next: false },
    }); return true
  })
  await workspace(page).getByRole('button', { name: 'Review extracted schedule', exact: true }).click()
  await expect(preview(page).locator('[data-row-id="HOURS"] [data-column="duration"]')).toHaveText('8 h')
  await expect(preview(page).locator('[data-row-id="MILESTONE"] .p6-milestone')).toHaveCount(1)
  await expect(preview(page).locator('[data-row-id="UNCERTAIN"] [data-column="start"]')).toHaveText('Review source')
  await expect(preview(page).locator('[data-row-id="UNCERTAIN"] .p6-activity-bar, [data-row-id="UNCERTAIN"] .p6-milestone')).toHaveCount(0)
  expect(state.writes).toEqual([]); expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([])
})

async function importHarness(page, { staleOnce = false, readOnly = false } = {}) {
  let imported = false, masterRevision = 3, attempts = 0
  await page.setViewportSize({ width: 1700, height: 1000 })
  return masterScheduleHarness(page, {
    prepare(state) {
      for (const record of Object.values(state.records)) Object.assign(record.simplePlan, {
        master_revision: masterRevision, source_preview_available: true,
        duration_policy: 'source_only', evidence_policy: 'document_driven',
      })
      state.sourceImportRequests = []
    },
    decorateSnapshot(plan) {
      if (readOnly) { plan.viewing_history = true; plan.permissions.can_edit = false }
      if (imported) {
        Object.assign(plan, { canonical_version: true, version_id: 120, master_revision: masterRevision,
          tasks: [{ ...sample('SOURCE-001'), discipline: 'source', duration_source: 'source_document', duration_calendar_verified: false, planned_start_date: null, planned_finish_date: null, depends_on: [] }],
          blockers: [{ code: 'source_import_review_required', message: 'Review the imported source timing and calendar.' }],
        })
        plan.permissions.can_edit = false
      }
      return plan
    },
    async handleRequest({ path, route, reply, state, url }) {
      if (path.endsWith('/simple-plan/source-preview/')) {
        await reply(route, { can_import: true, master_revision: masterRevision,
          source_files: [{ id: 904, original_filename: 'Execution schedule.csv', category: 'schedule', activity_count: 1 }],
          summary: { activity_count: 1, duration_count: 1, relationship_count: 0, unmapped_register_count: 2 },
          project_window: { start_date: '2026-09-21', finish_date: '2026-12-20' }, rows: [sample('SOURCE-001')],
          pagination: { offset: 0, limit: 100, total: 1, has_next: false }, extraction_reports: [], validation: [],
          selected_source_id: url.searchParams.get('source_file_id'),
        }); return true
      }
      if (path.endsWith('/simple-plan/preview-source-import/')) {
        state.sourceImportRequests.push({ action: 'preview', body: route.request().postDataJSON() })
        await reply(route, { proposal_token: `source-token-${masterRevision}`, can_apply: true,
          summary: { source_file: { id: 904, name: 'Execution schedule.csv' }, activity_count: 1, duration_count: 1, relationship_count: 0, unmapped_register_count: 2, start_date: '2026-10-01', finish_date: '2026-10-07', prior_work_preserved: true },
          warnings: [{ code: 'logic_missing', message: 'No explicit predecessor links were recovered.' }],
        }); return true
      }
      if (path.endsWith('/simple-plan/apply-source-import/')) {
        const body = route.request().postDataJSON()
        state.sourceImportRequests.push({ action: 'apply', body }); attempts += 1
        if (staleOnce && attempts === 1) {
          masterRevision = 8
          await reply(route, { error: 'Source or Master Schedule changed. Review again.' }, 409)
        } else {
          imported = true; masterRevision += 1
          await reply(route, { created: true, schedule_version_id: 120, notice: 'Source activities opened in Master Schedule. Timing is from the document; calculation remains pending.' })
        }
        return true
      }
      return false
    },
  })
}

test('a reviewed source import opens dated Master activities and retains the MDR draft', async ({ page }) => {
  const state = await importHarness(page)
  const originalDraft = structuredClone(state.records[17].simplePlan)
  await workspace(page).getByRole('combobox', { name: 'Schedule workspace area' }).selectOption('source-schedule')
  const review = preview(page).getByRole('button', { name: 'Review & use in Master Schedule', exact: true })
  await expect(review).toBeDisabled()
  await preview(page).getByRole('combobox', { name: 'Source schedule document' }).selectOption('904')
  await review.click()
  const dialog = page.getByRole('dialog', { name: 'Use source schedule in Master Schedule', exact: true })
  await expect(dialog).toContainText('employee assignments and history are retained')
  await expect(dialog).toContainText('No explicit predecessor links were recovered')
  const apply = dialog.getByRole('button', { name: 'Use in Master Schedule', exact: true })
  await expect(apply).toBeDisabled()
  expect(state.sourceImportRequests.map(item => item.action)).toEqual(['preview'])
  await dialog.getByRole('checkbox').check()
  await expect(apply).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Source schedule review note' }).fill('Reviewed applicable source activities for this project.')
  await apply.click()
  await expect(dialog).toHaveCount(0)
  await expect(workspace(page).getByRole('combobox', { name: 'Schedule workspace area' })).toHaveValue('activities')
  const row = workspace(page).locator('[data-row-id="SOURCE-001"]')
  await expect(row.locator('[data-column="start"]')).toHaveText('01-Oct-26')
  await expect(row.locator('.p6-activity-bar')).toHaveCount(1)
  await expect(row.locator('[data-column="float"]')).toHaveText('Not calculated')
  await expect(page.getByRole('status').filter({ hasText: 'Source activities opened in Master Schedule' })).toBeVisible()
  expect(state.sourceImportRequests.at(-1).body).toEqual({ proposal_token: 'source-token-3', reason: 'Reviewed applicable source activities for this project.', acknowledge_scope: true })
  expect(state.records[17].simplePlan).toEqual(originalDraft)
  await workspace(page).getByRole('button', { name: 'Review 1 action', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Schedule issues' }).getByRole('button', { name: 'Review source evidence', exact: true })).toBeEnabled()
  await workspace(page).getByRole('combobox', { name: 'Schedule workspace area' }).selectOption('source-schedule')
  await preview(page).getByRole('combobox', { name: 'Source schedule document' }).selectOption('904')
  await expect(preview(page).getByRole('button', { name: 'Review & use in Master Schedule', exact: true })).toBeEnabled()
  expect(state.unknownWrites).toEqual([]); expect(state.pageErrors).toEqual([])
})

test('a stale source import requires a fresh review using the latest Master revision', async ({ page }) => {
  const state = await importHarness(page, { staleOnce: true })
  await workspace(page).getByRole('combobox', { name: 'Schedule workspace area' }).selectOption('source-schedule')
  await preview(page).getByRole('combobox', { name: 'Source schedule document' }).selectOption('904')
  await preview(page).getByRole('button', { name: 'Review & use in Master Schedule', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Use source schedule in Master Schedule', exact: true })
  await dialog.getByRole('checkbox').check()
  await dialog.getByRole('textbox', { name: 'Source schedule review note' }).fill('Reviewed original schedule.')
  const apply = dialog.getByRole('button', { name: 'Use in Master Schedule', exact: true })
  await apply.click()
  await expect(dialog.getByRole('alert')).toHaveText('Source or Master Schedule changed. Review again.')
  await expect(apply).toBeDisabled()
  await dialog.getByRole('button', { name: 'Review latest source' }).click()
  await expect(dialog.getByRole('checkbox')).not.toBeChecked()
  await expect(apply).toBeDisabled()
  expect(state.sourceImportRequests.at(-1)).toEqual({ action: 'preview', body: { source_file_id: 904, master_revision: 8 } })
  await dialog.getByRole('checkbox').check()
  await apply.click()
  await expect(dialog).toHaveCount(0)
  expect(state.sourceImportRequests.at(-1).body.proposal_token).toBe('source-token-8')
  expect(state.pageErrors).toEqual([])
})

test('historical schedule views can inspect source rows without importing a new Master', async ({ page }) => {
  const state = await importHarness(page, { readOnly: true })
  await workspace(page).getByRole('combobox', { name: 'Schedule workspace area' }).selectOption('source-schedule')
  await preview(page).getByRole('combobox', { name: 'Source schedule document' }).selectOption('904')
  await expect(preview(page)).toContainText('Source package SOURCE-001')
  await expect(preview(page).getByRole('button', { name: 'Review & use in Master Schedule', exact: true })).toHaveCount(0)
  expect(state.sourceImportRequests).toEqual([]); expect(state.pageErrors).toEqual([])
})
