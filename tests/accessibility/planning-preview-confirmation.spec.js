import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { fixedNow, pageOf } from '../fixtures/schedule-performance.fixture.js'
import { scheduleAction } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)

const inputs = page => page.getByRole('dialog', { name: 'Documents & project inputs', exact: true })
const review = page => page.getByRole('dialog', { name: 'Review & confirm inputs', exact: true })
const preview = page => page.getByRole('dialog', { name: 'Document Intelligence Preview', exact: true })
const confirm = page => preview(page).getByRole('button', { name: 'Confirm & save preview', exact: true })
const closePreview = page => preview(page).getByRole('button', { name: 'Close Document Intelligence Preview', exact: true })
const confirmationWrites = state => state.evidenceWrites.filter(write => write.path.endsWith('/confirm-preview/'))
const expectedPreview = {
  detected_project_name: 'Synthetic scope package',
  detected_effective_date_text: '2026-09-21',
  detected_duration_months: 3,
  disciplines: { process: { in_scope: true, deliverables: ['Process design basis'], excluded_deliverables: [] } },
  hse_studies: [],
}

async function harness(page, options = {}) {
  return masterScheduleHarness(page, {
    prepare(state) {
      const record = state.records[17]
      record.facts = ['Synthetic client', 'Engineering scope phase'].map((value, index) => ({
        id: 911 + index, run: 901, source_file: 801, source_filename: 'Approved MDR.csv',
        fact_type: index ? 'project_name' : 'client', key: index ? 'phase' : 'client', value,
        normalized_value: value, extraction_method: 'deterministic', status: 'detected',
        source_excerpt: `Source states: ${value}`, source_locator: { sheet: 'Project inputs', row: index + 2 },
        reviewed_by: null, reviewed_at: null, created_at: fixedNow, updated_at: fixedNow,
      }))
      record.runs = [{
        id: 901, project: record.planningProject.id, status: 'succeeded', source_file_ids: [801],
        fact_count: record.facts.length, conflict_count: 0, preview_confirmation: null,
        intelligence: { ...structuredClone(expectedPreview), document_intelligence_run_id: 901, notes: ['Synthetic browser fixture.'] },
        created_at: fixedNow, updated_at: fixedNow,
      }]
      state.evidenceWrites = []
      state.confirmationFailure = null
      options.prepare?.(state)
    },
    async handleRequest(context) {
      const { path, route, reply, record, state } = context
      if (path.endsWith('/intelligence-runs/')) { await reply(route, pageOf(record.runs || [])); return true }
      if (path.endsWith('/intelligence-runs/901/')) { await reply(route, record.runs[0]); return true }
      if (path.endsWith('/intelligence-facts/')) { await reply(route, pageOf(record.facts || [])); return true }
      if (path.endsWith('/confirm-preview/')) {
        const data = route.request().postDataJSON()
        state.evidenceWrites.push({ path, data })
        if (options.beforeConfirm) await options.beforeConfirm(context)
        if (state.confirmationFailure) {
          await reply(route, state.confirmationFailure.body, state.confirmationFailure.status)
          return true
        }
        record.runs[0].preview_confirmation = { preview: structuredClone(data.preview), confirmed_at: fixedNow, confirmed_by: 7, is_current: true }
        record.facts.forEach(fact => {
          if (fact.status === 'detected') Object.assign(fact, { status: 'confirmed', reviewed_at: fixedNow, reviewed_by: 7 })
        })
        await reply(route, record.runs[0])
        return true
      }
      const factReview = path.match(/\/intelligence-facts\/(\d+)\/review\/$/)
      if (factReview) {
        const data = route.request().postDataJSON()
        state.evidenceWrites.push({ path, data })
        const fact = record.facts.find(item => item.id === Number(factReview[1]))
        Object.assign(fact, { status: data.status, reviewed_by: 7, reviewed_at: fixedNow })
        if (record.runs[0].preview_confirmation) record.runs[0].preview_confirmation.is_current = false
        await reply(route, fact)
        return true
      }
      return false
    },
  })
}

async function openReview(page, openInputs = true) {
  if (openInputs) await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'View all 2 findings', exact: true }).click()
  await expect(review(page)).toBeVisible()
}

async function openPreview(page, openInputs = true) {
  await openReview(page, openInputs)
  await review(page).getByRole('button', { name: 'Document Intelligence Preview', exact: true }).click()
  await expect(preview(page).getByRole('table')).toContainText('Synthetic client')
  await expect(preview(page).getByRole('table')).toContainText('Engineering scope phase')
}

function clean(state) {
  expect(state.unknown).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.pageErrors).toEqual([])
  expect(state.writes).toEqual([])
}

test('viewing evidence never confirms it; explicit preview confirmation stays saved after reopening and a full reload', async ({ page }) => {
  const state = await harness(page)
  const originalPlan = structuredClone(state.records[17].simplePlan)
  await openPreview(page)
  await expect(confirm(page)).toBeEnabled()
  await expect(preview(page)).not.toContainText('Preview confirmed and saved.')
  expect(state.evidenceWrites).toEqual([])
  await closePreview(page).click()
  await openPreview(page, false)
  expect(state.evidenceWrites).toEqual([])

  await confirm(page).click()
  await expect(preview(page)).toContainText('Preview confirmed and saved.')
  expect(confirmationWrites(state)).toEqual([{ path: '/api/v1/planning-intelligence/intelligence-runs/901/confirm-preview/', data: { preview: expectedPreview } }])
  await closePreview(page).click()
  await inputs(page).getByRole('button', { name: 'Save inputs', exact: true }).click()
  await expect(inputs(page).getByRole('status').filter({ hasText: 'Planning draft saved.' })).toBeVisible()
  expect(state.writes).toEqual([])
  await openPreview(page, false)
  await expect(preview(page)).toContainText('Preview confirmed and saved.')
  await page.reload()
  await openPreview(page)
  await expect(preview(page)).toContainText('Preview confirmed and saved.')
  await expect(preview(page).getByRole('row').filter({ hasText: 'Synthetic client' })).toContainText('confirmed')
  expect(confirmationWrites(state)).toHaveLength(1)
  expect(state.records[17].simplePlan).toEqual(originalPlan)
  clean(state)
})

test('individual confirmed and rejected findings survive closing and reloading without confirming the full preview', async ({ page }) => {
  const state = await harness(page)
  await openReview(page)
  await review(page).getByRole('listitem').filter({ hasText: 'Synthetic client' }).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(review(page).getByRole('listitem').filter({ hasText: 'Synthetic client' }).getByRole('button', { name: 'Confirm', exact: true })).toBeDisabled()
  await review(page).getByRole('listitem').filter({ hasText: 'Engineering scope phase' }).getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(review(page).getByRole('listitem').filter({ hasText: 'Engineering scope phase' })).toContainText('rejected')
  await review(page).getByRole('button', { name: 'Close', exact: true }).click()
  await openReview(page, false)
  await expect(review(page).getByRole('listitem').filter({ hasText: 'Synthetic client' })).toContainText('confirmed')
  await page.reload()
  await openReview(page)
  await expect(review(page).getByRole('listitem').filter({ hasText: 'Synthetic client' })).toContainText('confirmed')
  await expect(review(page).getByRole('listitem').filter({ hasText: 'Engineering scope phase' })).toContainText('rejected')
  expect(state.evidenceWrites.map(write => write.data)).toEqual([{ status: 'confirmed' }, { status: 'rejected' }])
  expect(confirmationWrites(state)).toEqual([])
  clean(state)
})

test('a later finding decision makes a saved preview visibly stale until the user confirms again', async ({ page }) => {
  const state = await harness(page)
  await openPreview(page)
  await confirm(page).click()
  await expect(preview(page)).toContainText('Preview confirmed and saved.')
  await closePreview(page).click()
  await openReview(page, false)
  await review(page).getByRole('listitem').filter({ hasText: 'Engineering scope phase' }).getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(review(page).getByRole('listitem').filter({ hasText: 'Engineering scope phase' })).toContainText('rejected')
  await review(page).getByRole('button', { name: 'Document Intelligence Preview', exact: true }).click()
  await expect(preview(page)).toContainText('Preview confirmation is out of date.')
  await expect(preview(page)).not.toContainText('Preview confirmed and saved.')
  await expect(confirm(page)).toBeEnabled()
  expect(confirmationWrites(state)).toHaveLength(1)
  await confirm(page).click()
  await expect(preview(page)).toContainText('Preview confirmed and saved.')
  await expect(preview(page).getByRole('row').filter({ hasText: 'Engineering scope phase' })).toContainText('rejected')
  expect(confirmationWrites(state)).toHaveLength(2)
  clean(state)
})

for (const failure of [
  { status: 403, body: { error: 'You do not have permission to confirm project inputs.' } },
  { status: 409, body: { error: 'Project inputs or source documents have changed. Run Document Intelligence again.', code: 'intelligence_sources_changed' } },
  { status: 503, body: { detail: 'Confirmation is temporarily unavailable. Please retry.' } },
]) test(`a ${failure.status} confirmation failure preserves the loaded evidence and requires an explicit retry`, async ({ page }) => {
  const state = await harness(page, { prepare(current) { current.confirmationFailure = failure } })
  await openPreview(page)
  await confirm(page).click()
  await expect(preview(page).getByRole('alert')).toContainText(failure.body.error || failure.body.detail)
  await expect(preview(page).getByRole('table')).toContainText('Synthetic client')
  await expect(preview(page)).not.toContainText('Preview confirmed and saved.')
  expect(state.records[17].runs[0].preview_confirmation).toBeNull()
  expect(confirmationWrites(state)).toHaveLength(1)
  state.confirmationFailure = null
  if (failure.status === 409) {
    // Reload after the source has been reanalyzed; stale contents are never retried automatically.
    state.records[17].runs[0].updated_at = '2026-09-25T08:00:00Z'
    await preview(page).getByRole('button', { name: 'Reload preview', exact: true }).click()
    await expect(preview(page).getByRole('table')).toContainText('Synthetic client')
  }
  await confirm(page).click()
  await expect(preview(page)).toContainText('Preview confirmed and saved.')
  await expect(preview(page).getByRole('alert')).toHaveCount(0)
  expect(confirmationWrites(state)).toHaveLength(2)
  clean(state)
})

test('a pending preview save prevents close and Escape until its server result is known', async ({ page }) => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const state = await harness(page, { beforeConfirm: () => pending })
  await openPreview(page)
  try {
    await confirm(page).click()
    await expect.poll(() => confirmationWrites(state).length).toBe(1)
    await expect(closePreview(page)).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(preview(page)).toBeVisible()
    await expect(preview(page)).not.toContainText('Preview confirmed and saved.')
    expect(state.records[17].runs[0].preview_confirmation).toBeNull()
  } finally { release() }
  await expect(preview(page)).toContainText('Preview confirmed and saved.')
  await expect(closePreview(page)).toBeEnabled()
  expect(confirmationWrites(state)).toHaveLength(1)
  clean(state)
})
