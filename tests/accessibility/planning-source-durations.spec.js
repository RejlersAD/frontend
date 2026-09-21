import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { primaveraScheduleHarness, primaveraTitles } from '../fixtures/primavera-schedule.fixture.js'
import { scheduleProposalHarness } from '../fixtures/planning-schedule-proposal.fixture.js'
import { scheduleArea } from '../fixtures/schedule-controls.js'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture.js'

test.setTimeout(60000)
const workspace = page => page.getByRole('region', { name: 'Master schedule workspace', exact: true })
const row = (page, id) => workspace(page).locator(`[data-row-id="${id}"]`)
const source = { filename: 'Approved MDR.xlsx', locator: { sheet: 'Schedule', row: 12 }, excerpt: 'Original Duration: 8 working days' }
const clean = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
}
function review(plan) {
  // Deliberately retain stale legacy timing to verify that unknown source
  // durations cannot be rendered as valid dates, float or a Gantt bar.
  Object.assign(plan.tasks[0], { duration_days: null, duration_source: 'missing_source', duration_review_status: 'missing_source', duration_review_reason: 'No activity-specific planned duration in the uploaded documents.' })
  Object.assign(plan.tasks[1], { duration_days: 8, duration_source: 'source_document', duration_review_status: 'source_verified', duration_evidence: { source_references: [source] } })
  const rows = [
    { task_id: plan.tasks[0].id, title: plan.tasks[0].title, status: 'missing_source', previous_duration_days: 10, duration_days: null, reason: plan.tasks[0].duration_review_reason, source_references: [] },
    { task_id: plan.tasks[1].id, title: plan.tasks[1].title, status: 'source_verified', previous_duration_days: 10, duration_days: 8, reason: 'Matched activity-specific duration.', source_references: [source] },
  ]
  plan.duration_review = { total_count: plan.tasks.length, source_document_count: 1, missing_source_count: 1, source_requirement_count: 0, manual_unverified_count: 0, rows, package_reviews: [{ parent_deliverable_id: 'package-1', title: 'Process design package', duration_complete: false, duration_days: null, source_original_duration_days: 31, missing_duration_count: 1, source_references: [source] }] }
}

test('missing source duration has no fabricated dates, float, bar or dependency while explicit milestones remain', async ({ page }) => {
  const state = await primaveraScheduleHarness(page, { prepare(current) {
    Object.values(current.records).forEach(record => review(record.simplePlan))
  } })
  const plan = state.records[17].simplePlan
  const first = row(page, plan.tasks[0].id)
  await expect(first.locator('[data-column="duration"]')).toHaveText('Not Specified')
  await expect(first.locator('[data-column="duration"]')).toHaveAttribute('data-duration-kind', 'missing_source')
  for (const column of ['start', 'finish']) await expect(first.locator(`[data-column="${column}"]`)).toHaveText('Not Specified')
  await expect(first.locator('.p6-activity-bar, .p6-milestone')).toHaveCount(0)
  await expect(row(page, 1111).locator('.p6-summary-bar')).toHaveCount(0)
  const milestone = plan.tasks.find(task => task.title === primaveraTitles.milestone)
  await expect(row(page, milestone.id).locator('[data-column="duration"]')).toHaveText('0 d')
  await expect(row(page, milestone.id).locator('.p6-milestone')).toHaveCount(1)
  await workspace(page).getByRole('button', { name: plan.tasks[0].title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details', exact: true })
  await expect(details).toContainText('Not Specified')
  await expect(details).toContainText('No activity-specific planned duration in the uploaded documents.')
  await expect(details).toContainText('Not calculated')
  expect(state.writes).toEqual([])
  clean(state)
})

test('saved schedule exposes activity-specific duration citation separately from deliverable references', async ({ page }) => {
  const state = await primaveraScheduleHarness(page, { prepare(current) {
    Object.values(current.records).forEach(record => review(record.simplePlan))
  } })
  await scheduleArea(page, 'evidence')
  await expect(workspace(page).getByRole('region', { name: 'Duration source review', exact: true })).toContainText('1 source durations')
  const evidence = workspace(page).getByRole('row').filter({ hasText: state.records[17].simplePlan.tasks[1].title })
  await expect(evidence).toContainText('Source duration')
  await expect(evidence).toContainText('Approved MDR.xlsx · Schedule · Row 12')
  await expect(evidence).toContainText('Original Duration: 8 working days')
  await workspace(page).getByText('Package duration evidence (1)', { exact: true }).click()
  const packages = workspace(page).getByRole('region', { name: 'Package duration evidence', exact: true })
  await expect(packages).toContainText('31 d as printed')
  await expect(packages).toContainText('Not calculated')
  await expect(packages).toContainText('Approved MDR.xlsx · Schedule · Row 12')
  expect(state.writes).toEqual([])
  clean(state)
})

test('a general review-period requirement is evidence rather than an invented activity duration', async ({ page }) => {
  const state = await primaveraScheduleHarness(page, { prepare(current) {
    for (const record of Object.values(current.records)) {
      const task = record.simplePlan.tasks[0]
      Object.assign(task, { duration_days: null, duration_source: 'source_requirement', duration_review_status: 'requirement_needs_review', duration_evidence: { values: { required_review_days: 10 }, source_references: [{ filename: 'Scope of Work.pdf', locator: { page: 15 } }] } })
    }
  } })
  const task = state.records[17].simplePlan.tasks[0]
  await expect(row(page, task.id).locator('[data-column="duration"]')).toHaveText('Not Specified')
  await expect(row(page, task.id).locator('.p6-activity-bar')).toHaveCount(0)
  await workspace(page).getByRole('button', { name: task.title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details', exact: true })
  await expect(details).toContainText('Source requirement · review activity timing')
  await expect(details).toContainText('Required review period: 10 days. Activity duration remains unconfirmed.')
  await expect(details).toContainText('Scope of Work.pdf · Page 15')
  expect(state.writes).toEqual([])
  clean(state)
})

test('source-only preview reports each removed template duration and citation without claiming a fitted schedule', async ({ page }) => {
  const state = await scheduleProposalHarness(page, { async handleRequest({ path, route, record, reply, state: current }) {
    if (!path.endsWith('/propose-schedule/')) return false
    current.writes.push({ method: 'POST', path, data: route.request().postDataJSON() })
    const plan = structuredClone(record.simplePlan)
    review(plan)
    await reply(route, { plan, proposal: {
      token: 'source-only-preview', revision: plan.revision, changed_count: 2, duration_review: plan.duration_review,
      horizon_fit: { fits: false, start_date: '2026-01-06', finish_date: '2026-09-04', original_forecast_finish: '2026-10-01', forecast_finish: null, source_values_changed: false },
    } })
    return true
  } })
  const before = structuredClone(state.records[17].simplePlan)
  await workspace(page).getByRole('button', { name: 'Build schedule', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Review proposed schedule', exact: true })
  await expect(dialog).toContainText('Timing not calculated · missing source durations')
  await expect(dialog).toContainText('No template durations are added or shortened to fit the target.')
  await expect(dialog).not.toContainText('planning estimates, not a verified import')
  const rows = dialog.getByRole('region', { name: 'Proposed schedule changes', exact: true }).locator('tbody tr')
  await expect(rows.first()).toContainText('Not Specified')
  await expect(rows.first().locator('td').nth(2)).toHaveText('Not Specified → Not Specified')
  await expect(rows.first()).toContainText('Not Specified: no documented or intentionally retained predecessor.')
  await expect(rows.nth(1)).toContainText('Approved MDR.xlsx · Schedule · Row 12')
  await expect(dialog.getByRole('button', { name: 'Apply draft schedule', exact: true })).toBeEnabled()
  const violations = (await new AxeBuilder({ page }).include('.psq-dialog').analyze()).violations.filter(issue => ['serious', 'critical'].includes(issue.impact))
  expect(violations).toEqual([])
  await dialog.getByRole('button', { name: 'Gantt preview', exact: true }).click()
  await expect(dialog.locator(`[data-row-id="${before.tasks[0].id}"] .p6-activity-bar`)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(state.records[17].simplePlan).toEqual(before)
  expect(state.writes).toHaveLength(1)
  clean(state)
})

test('source-only relationships need explicit type and lag instead of silently drawing finish-to-start', async ({ page }) => {
  const state = await primaveraScheduleHarness(page, { prepare(current) {
    for (const record of Object.values(current.records)) {
      const plan = record.simplePlan
      plan.duration_policy = 'source_only'
      const [first, second, third] = plan.tasks
      Object.assign(second, { depends_on: [first.id], dependency_details: [], dependency_rationales: {} })
      Object.assign(third, { depends_on: [second.id], dependency_details: [{ task_id: second.id, type: 'FS', lag_days: 0 }], dependency_rationales: { [second.id]: { source: 'workflow_template', relationship_type: 'FS', lag_days: 0 } } })
    }
  } })
  const [, second, third] = state.records[17].simplePlan.tasks
  await expect(workspace(page).locator(`.p6-dependency-link[data-successor-id="${second.id}"]`)).toHaveCount(0)
  await expect(workspace(page).locator(`.p6-dependency-link[data-successor-id="${third.id}"]`)).toHaveCount(1)
  await scheduleArea(page, 'logic')
  const relationship = workspace(page).getByRole('row').filter({ has: page.locator('td:nth-child(2)', { hasText: second.title }) })
  await expect(relationship.locator('td').nth(2)).toContainText('Not Specified')
  await expect(relationship.locator('td').nth(2)).not.toContainText('Finish to start')
  await expect(workspace(page)).toContainText('User-configured workflow')
  expect(state.writes).toEqual([])
  clean(state)
})

test('source duration retains calendar-day unit without becoming working days', async ({ page }) => {
  const state = await primaveraScheduleHarness(page, { prepare(current) {
    for (const record of Object.values(current.records)) Object.assign(record.simplePlan.tasks[0], {
      duration_days: 12, duration_source: 'source_document', duration_evidence: { values: { duration_unit: 'calendar_days' }, source_references: [source] },
    })
  } })
  await workspace(page).getByRole('button', { name: state.records[17].simplePlan.tasks[0].title, exact: true }).click()
  const details = page.getByRole('complementary', { name: 'Activity details', exact: true })
  const duration = details.locator('dl > div').filter({ has: page.getByText('Duration', { exact: true }) })
  await expect(duration).toContainText('Duration12 calendar days')
  await expect(duration).not.toContainText('working days')
  await expect(row(page, state.records[17].simplePlan.tasks[0].id).locator('[data-column="duration"]')).toHaveText('12 cd')
  clean(state)
})

for (const coverageKnown of [true, false]) test(`document preview reports ${coverageKnown ? 'partial' : 'unknown'} extraction coverage without claiming full understanding`, async ({ page }) => {
  const state = await planningInputsHarness(page, { populated: true, prepare(current) {
    if (!coverageKnown) return
    const run = current.records[17].runs.find(item => item.status === 'succeeded')
    run.intelligence.ai_processing_coverage = { status: 'partial', chunks_total: 15, chunks_processed: 12, chunks_skipped: 2, chunks_failed: 1, rejected_claim_count: 3, semantic_coverage_verified: false }
    run.intelligence.processing_coverage = {
      status: 'partial', file_count: 1, analyzed_file_count: 1, complete_file_count: 0,
      semantic_coverage_verified: false, interpretation_status: 'requires_review',
      files: [{ file_id: 801, filename: 'Contract requirements.pdf', status: 'partial', unit_type: 'pages', units_total: 250, units_processed: 249, included_in_analysis: true, text_truncated: true, issues: [{ code: 'unreadable_page', page: 212, message: 'Page text could not be extracted.' }] }],
    }
  } })
  await page.getByRole('button', { name: 'Next: Document Intelligence Preview', exact: true }).click()
  const coverage = page.getByRole('region', { name: 'Extraction coverage', exact: true })
  await expect(coverage).toContainText(coverageKnown ? 'Partial extraction' : 'Not Specified')
  await expect(coverage).toContainText('Text extraction does not confirm that every requirement or relationship has been understood.')
  if (coverageKnown) {
    await coverage.getByText('Document extraction details (1)', { exact: true }).click()
    await expect(coverage).toContainText('249 / 250 pages')
    await expect(coverage).toContainText('Extracted text was truncated.')
    await expect(coverage).toContainText('Page 212: Page text could not be extracted.')
    await expect(coverage).toContainText('AI analysis coverage: Partial; 12 of 15 chunks processed, 2 skipped, 1 failed. 3 unsupported claims rejected.')
  } else await expect(coverage).toContainText('Coverage was not recorded for this analysis.')
  expect(state.writes).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
})
