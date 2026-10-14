import { test, expect } from '@playwright/test'
import {
  wrenchHarness, wrenchConfig, response, failure, syncLog, exportJob, wrenchToken,
} from '../fixtures/wrench-sync.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1536, height: 960 } })
const run = page => page.getByRole('button', { name: 'Run Sync', exact: true })
const alerts = page => page.getByRole('status')
const tab = (page, name) => page.getByRole('button', { name, exact: true }).first()
const entity = (page, name) => page.getByRole('button', { name, exact: true }).last()
// The dev App mounts through StrictMode and authentication bootstrap. Capture
// initial read counts once the mounted state is visible; assert retry deltas so
// discarded development mounts are not mistaken for the active retry cycle.
const assertIsolated = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.externalRequests.some(call => /wrench\.example\.test|amazonaws\.com/.test(call.url))).toBe(false)
}
const noCompleted = async page => {
  await expect(alerts(page).filter({ hasText: /Sync completed|Metadata retrieval completed|Export completed|started successfully|S3 will stay in sync/ })).toHaveCount(0)
}
async function openSync(page, options = {}) {
  const state = await wrenchHarness(page, options)
  await expect(page.getByRole('heading', { name: 'Wrench Integration', exact: true })).toBeVisible()
  await tab(page, 'Sync').click()
  await expect(run(page)).toBeVisible()
  state.initialConfigCalls = state.counts.config
  return state
}
async function openExport(page, options = {}) {
  const state = await wrenchHarness(page, options)
  await expect(page.getByRole('heading', { name: 'Wrench Integration', exact: true })).toBeVisible()
  await tab(page, 'S3 Export').click()
  await expect(page.getByRole('button', { name: 'Start Batch Export', exact: true })).toBeVisible()
  await expect.poll(() => state.counts.jobs || 0).toBeGreaterThan(0)
  await expect.poll(() => state.counts.watchers || 0).toBeGreaterThan(0)
  return state
}

test('unsupported directions and entities remain explainable without sending a sync request', async ({ page }, testInfo) => {
  const state = await openSync(page)
  for (const name of ['Projects', 'Users', 'All Entities']) {
    await entity(page, name).click()
    await expect(run(page)).toBeDisabled()
    await expect(alerts(page).filter({ hasText: /Unavailable/i })).toBeVisible()
  }
  await entity(page, 'Documents').click()
  await expect(run(page)).toBeEnabled()
  await page.getByRole('button', { name: /RADAI → Wrench/ }).click()
  await expect(run(page)).toBeDisabled()
  await expect(alerts(page).filter({ hasText: /Unavailable/i })).toBeVisible()
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('unsupported-sync.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await run(page).scrollIntoViewIfNeeded()
  await expect(run(page)).toBeDisabled()
  await expect(alerts(page).filter({ hasText: /Unavailable/i })).toBeVisible()
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('unsupported-sync-390.png') })
  expect(state.counts.trigger || 0).toBe(0)
  assertIsolated(state)
})

for (const records of [2, 0]) {
  test(`validated metadata retrieval of ${records} records reports its actual effect`, async ({ page }) => {
    const state = await openSync(page, {
      trigger: response(syncLog({ records_requested: records, records_synced: records }), 201),
    })
    await run(page).click()
    await expect(alerts(page).filter({ hasText: `Metadata retrieval completed (log #9402): ${records} records retrieved. No RADAI records were imported.` })).toBeVisible()
    expect(state.counts.trigger).toBe(1)
    const request = state.requests.find(call => call.path.endsWith('/sync/trigger/'))
    expect(request.body).toEqual({ direction: 'wrench_to_radai', entity_type: 'document' })
    expect(request.authorization).toBe(`Bearer ${wrenchToken}`)
    assertIsolated(state)
  })
}

for (const scenario of [
  { name: 'failed log in HTTP 201', body: syncLog({ status: 'failed', records_synced: 0, records_failed: 2, error_message: 'Synthetic adapter rejected the retrieval.' }), message: /Metadata retrieval failed/ },
  { name: 'partial retrieval with additional pages', body: syncLog({ status: 'partial', records_requested: 4 }), message: /Metadata retrieval partially completed.*2 of 4.*Additional requested records/ },
  { name: 'pending result', body: syncLog({ status: 'pending' }), message: /Metadata retrieval is pending.*Completion has not been confirmed/ },
  { name: 'in-progress result', body: syncLog({ status: 'in_progress' }), message: /Metadata retrieval is in progress.*Completion has not been confirmed/ },
  { name: 'legacy success without retrieval evidence', body: syncLog({ sync_details: {} }), message: /Metadata retrieval outcome is unconfirmed/ },
  { name: 'success-shaped response contradicting failure counts', body: syncLog({ records_failed: 1 }), message: /Metadata retrieval outcome is unconfirmed/ },
  { name: 'created log with no operation outcome', body: { id: 9402, success: true, message: 'Sync completed' }, message: /Metadata retrieval outcome is unconfirmed/ },
]) {
  test(`${scenario.name} cannot turn a resolved request into completed sync`, async ({ page }) => {
    await page.clock.install()
    const state = await openSync(page, { trigger: response({ ...scenario.body, entity_type: 'transmittal' }, 201) })
    await entity(page, 'Transmittals').click()
    await run(page).click()
    await expect(alerts(page).filter({ hasText: scenario.message })).toBeVisible()
    await noCompleted(page)
    await expect(entity(page, 'Transmittals')).toHaveAttribute('aria-pressed', 'true')
    await page.clock.fastForward(30000)
    expect(state.counts.trigger).toBe(1)
    await expect(run(page)).toBeEnabled()
    assertIsolated(state)
  })
}

test('sync permission denial preserves selection and has no automatic mutation retry', async ({ page }) => {
  await page.clock.install()
  const state = await openSync(page, { trigger: failure(403, 'Permission denied for synthetic sync.') })
  await entity(page, 'Transmittals').click()
  await run(page).click()
  await expect(alerts(page).filter({ hasText: /Access denied|Permission denied/i })).toBeVisible()
  await page.clock.fastForward(30000)
  expect(state.counts.trigger).toBe(1)
  await expect(entity(page, 'Transmittals')).toHaveAttribute('aria-pressed', 'true')
  await noCompleted(page)
  assertIsolated(state)
})

test('configuration absent is different from load failure and may be configured explicitly', async ({ page }) => {
  const state = await wrenchHarness(page, { config: response({ configured: false, config: null, sync_capabilities: wrenchConfig.sync_capabilities }) })
  await expect(page.getByText('Not configured', { exact: true })).toBeVisible()
  await tab(page, 'Configuration').click()
  await expect(page.getByRole('heading', { name: 'Connection Settings', exact: true })).toBeVisible()
  await expect(alerts(page).filter({ hasText: /could not be loaded|failed to load/i })).toHaveCount(0)
  assertIsolated(state)
})

test('transient configuration failure retries once then offers manual recovery without false absence', async ({ page }) => {
  await page.clock.install()
  const state = await wrenchHarness(page, { config: failure() })
  await expect(alerts(page).filter({ hasText: /Configuration is unavailable. Retrying once/ })).toBeVisible()
  const initialReads = state.counts.config
  await expect(page.getByText('Not configured', { exact: true })).toHaveCount(0)
  await page.clock.fastForward(4500)
  await expect.poll(() => state.counts.config).toBe(initialReads + 1)
  await page.clock.fastForward(30000)
  expect(state.counts.config).toBe(initialReads + 1)
  await expect(page.getByText('Not configured', { exact: true })).toHaveCount(0)
  state.config = response(wrenchConfig)
  await page.getByRole('button', { name: /Retry configuration/i }).click()
  await expect(page.getByText('Connection verified: Synthetic integration', { exact: true })).toBeVisible()
  expect(state.counts.config).toBe(initialReads + 2)
  assertIsolated(state)
})

test('configuration denial never auto-retries or shows a new configuration form', async ({ page }) => {
  await page.clock.install()
  const state = await wrenchHarness(page, { config: failure(403, 'Configuration access denied.') })
  await expect(alerts(page).filter({ hasText: /Access denied/i })).toBeVisible()
  const initialReads = state.counts.config
  await page.clock.fastForward(30000)
  expect(state.counts.config).toBe(initialReads)
  await tab(page, 'Configuration').click()
  await expect(page.getByRole('heading', { name: 'Connection Settings', exact: true })).toHaveCount(0)
  await expect(page.getByText('Not configured', { exact: true })).toHaveCount(0)
  assertIsolated(state)
})

test('history failure neither loses loaded configuration nor resets sync selection during recovery', async ({ page }) => {
  await page.clock.install()
  const state = await openSync(page, {
    trigger: response(syncLog({ entity_type: 'transmittal' }), 201),
  })
  state.logs = failure()
  const initialReads = state.counts.logs
  await entity(page, 'Transmittals').click()
  await run(page).click()
  await expect(alerts(page).filter({ hasText: /Metadata retrieval completed/ })).toBeVisible()
  await expect(alerts(page).filter({ hasText: /history/i })).toBeVisible()
  await page.clock.fastForward(4500)
  await expect.poll(() => state.counts.logs).toBe(initialReads + 2)
  await page.clock.fastForward(30000)
  expect(state.counts.logs).toBe(initialReads + 2)
  await expect(entity(page, 'Transmittals')).toHaveAttribute('aria-pressed', 'true')
  state.logs = response([])
  await page.getByRole('button', { name: /Retry sync history/i }).click()
  await expect(entity(page, 'Transmittals')).toHaveAttribute('aria-pressed', 'true')
  await expect(run(page)).toBeEnabled()
  expect(state.counts.config).toBe(state.initialConfigCalls)
  assertIsolated(state)
})

test('configuration draft survives independent history retry', async ({ page }) => {
  await page.clock.install()
  const state = await wrenchHarness(page, { logs: failure() })
  await tab(page, 'Configuration').click()
  await expect(page.getByRole('heading', { name: 'Connection Settings', exact: true })).toBeVisible()
  const urlInput = page.getByPlaceholder('https://your-org.wrenchproject.com')
  await expect(urlInput).toHaveValue(wrenchConfig.config.base_url)
  await urlInput.fill('https://preserved-draft.example.test/WebAPI')
  const initialReads = state.counts.logs
  await page.clock.fastForward(4500)
  await expect.poll(() => state.counts.logs).toBe(initialReads + 1)
  state.logs = response([])
  await page.getByRole('button', { name: /Retry sync history/i }).click()
  await expect(urlInput).toHaveValue('https://preserved-draft.example.test/WebAPI')
  expect(state.requests.some(call => call.path.endsWith('/wrench/config/') && call.method === 'POST')).toBe(false)
  assertIsolated(state)
})

test('accepted S3 job remains pending and failed history polling is bounded with explicit recovery', async ({ page }, testInfo) => {
  await page.clock.install()
  const job = exportJob()
  const state = await openExport(page)
  await page.getByRole('button', { name: 'Advanced settings', exact: true }).click()
  await page.getByPlaceholder('wrench/').fill('synthetic-preserved/')
  await page.getByPlaceholder('e.g. 5900620').fill('SYNTHETIC-ORDER')
  state.jobs = response([job])
  const initialReads = state.counts.jobs
  await page.getByRole('button', { name: 'Start Batch Export', exact: true }).click()
  await expect(alerts(page).filter({ hasText: /Export is pending.*Completion has not been confirmed/ })).toBeVisible()
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('pending-export.png') })
  await expect.poll(() => state.counts.jobs).toBe(initialReads + 1)
  state.jobs = failure()
  await page.clock.fastForward(5500)
  await expect.poll(() => state.counts.jobs).toBe(initialReads + 2)
  await page.clock.fastForward(5500)
  await expect.poll(() => state.counts.jobs).toBe(initialReads + 3)
  await page.clock.fastForward(30000)
  expect(state.counts.jobs).toBe(initialReads + 3)
  await expect(alerts(page).filter({ hasText: /job history|export history/i })).toBeVisible()
  await expect(page.getByPlaceholder('wrench/')).toHaveValue('synthetic-preserved/')
  await expect(page.getByPlaceholder('e.g. 5900620')).toHaveValue('SYNTHETIC-ORDER')
  state.jobs = response([exportJob({ status: 'failed', records_exported: 1, records_failed: 1, error_message: 'Synthetic write failure.' })])
  await page.getByRole('button', { name: /Retry.*(?:export|job).*history/i }).click()
  await expect(page.getByText('failed', { exact: true })).toBeVisible()
  await expect(alerts(page).filter({ hasText: /Export failed.*1 records were exported before failure/ })).toBeVisible()
  await expect(alerts(page).filter({ hasText: /Export is pending/ })).toHaveCount(0)
  await noCompleted(page)
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('export-failed-after-recovery.png') })
  expect(state.counts.start).toBe(1)
  assertIsolated(state)
})

test('S3 and library authorization failures stop polling and preserve export inputs', async ({ page }) => {
  await page.clock.install()
  const state = await openExport(page, {
    jobs: response([exportJob()]),
    watchers: failure(403, 'Synthetic watcher history access denied.'),
  })
  const initialJobReads = state.counts.jobs
  const initialWatcherReads = state.counts.watchers
  state.jobs = failure(403, 'Synthetic job history access denied.')
  await page.getByRole('button', { name: /Real-time Continuous/ }).click()
  await entity(page, 'Documents').click()
  await page.getByPlaceholder('e.g. 5900620').fill('SYNTHETIC-ORDER')
  await page.clock.fastForward(5500)
  await expect.poll(() => state.counts.jobs).toBe(initialJobReads + 1)
  await page.clock.fastForward(30000)
  expect(state.counts.jobs).toBe(initialJobReads + 1)
  expect(state.counts.watchers).toBe(initialWatcherReads)
  await expect(alerts(page).filter({ hasText: /Access denied/i })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Start Real-time Export', exact: true })).toBeVisible()
  await expect(entity(page, 'Documents')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByPlaceholder('e.g. 5900620')).toHaveValue('SYNTHETIC-ORDER')
  assertIsolated(state)
})

test('S3 failed and unconfirmed start responses never announce a successful export', async ({ page }) => {
  await page.clock.install()
  const state = await openExport(page, { start: response(exportJob({ status: 'failed', records_exported: 1, records_failed: 1, error_message: 'Synthetic storage failure.' }), 201) })
  await page.getByRole('button', { name: 'Start Batch Export', exact: true }).click()
  await expect(alerts(page).filter({ hasText: /Export failed.*1 records were exported before failure/ })).toBeVisible()
  await noCompleted(page)
  state.start = response({ id: 9403, status: 'success', message: 'Completed' }, 201)
  await page.getByRole('button', { name: 'Start Batch Export', exact: true }).click()
  await expect(alerts(page).filter({ hasText: /Export outcome is unconfirmed/ })).toBeVisible()
  await page.clock.fastForward(30000)
  expect(state.counts.start).toBe(2)
  await noCompleted(page)
  assertIsolated(state)
})

test('legacy success logs are preserved as unconfirmed instead of verified retrievals', async ({ page }) => {
  const state = await openSync(page, { logs: response([syncLog({ sync_details: {} })]) })
  await expect(page.getByText('Unconfirmed (recorded: success)', { exact: true })).toBeVisible()
  await expect(page.getByText('success', { exact: true })).toHaveCount(0)
  await noCompleted(page)
  assertIsolated(state)
})

test('malformed configuration is unavailable and never treated as an absent setup', async ({ page }) => {
  await page.clock.install()
  const state = await wrenchHarness(page, { config: response({ success: true }) })
  await expect(alerts(page).filter({ hasText: /Configuration could not be loaded/ })).toBeVisible()
  const initialReads = state.counts.config
  await page.clock.fastForward(30000)
  expect(state.counts.config).toBe(initialReads)
  await expect(page.getByText('Not configured', { exact: true })).toHaveCount(0)
  await tab(page, 'Configuration').click()
  await expect(page.getByRole('heading', { name: 'Connection Settings', exact: true })).toHaveCount(0)
  assertIsolated(state)
})

test('malformed history keeps known configuration and exposes recovery instead of crashing', async ({ page }) => {
  const state = await openSync(page, { logs: response([{ id: 9402, status: 'success' }]) })
  await expect(alerts(page).filter({ hasText: /Sync history could not be loaded/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry sync history', exact: true })).toBeVisible()
  await expect(run(page)).toBeEnabled()
  await expect(page.getByText('Connection verified: Synthetic integration', { exact: true })).toBeVisible()
  assertIsolated(state)
})
