import { test, expect } from '@playwright/test'
import {
  dataMiningHarness, miningProjectName, miningToken, miningCsv, miningArtifact, storedExportResult,
} from '../fixtures/data-mining.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const run = page => page.getByRole('button', { name: 'Execute Pipeline', exact: true })
const download = page => page.getByRole('button', { name: 'Download Master File', exact: true })
const calls = (state, action) => state.requests.filter(call => call.path.endsWith(`/${action}/`))
const failure = (status, code, error) => ({ status, body: { code, error } })
const noSuccess = async page => {
  await expect(page.getByRole('heading', { name: 'Pipeline Completed Successfully', exact: true })).toHaveCount(0)
  await expect(page.getByText('Saved pipeline executed successfully. Export is available.', { exact: true })).toHaveCount(0)
  await expect(download(page)).toHaveCount(0)
}
const assertIsolated = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.externalRequests.filter(request => request.url.includes(miningArtifact))).toEqual([])
}
async function openPreparedEditor(page, options = {}) {
  const state = await dataMiningHarness(page, options)
  await expect(page.getByRole('heading', { name: miningProjectName, exact: true })).toBeVisible()
  await page.getByRole('main').getByRole('combobox').selectOption('SYNTHETIC-WRENCH-01')
  await page.getByRole('heading', { name: miningProjectName, exact: true }).click()
  await page.getByRole('button', { name: 'Search Wrench Documents', exact: true }).click()
  await page.getByRole('checkbox', { name: /SYNTHETIC-DOC-01/ }).check()
  await page.getByRole('button', { name: /Build Pipeline/ }).click()
  // These are unsaved local steps, deliberately not asserted as persisted or
  // used by execution. The configured saved pipeline comes from the fixture.
  await page.getByRole('button', { name: 'Select Select columns', exact: true }).click()
  await expect(page.getByText('Select 1', { exact: true })).toBeVisible()
  return state
}
async function assertInputsPreserved(page) {
  await page.getByRole('button', { name: /Build Pipeline/ }).click()
  await expect(page.getByText('Select 1', { exact: true })).toBeVisible()
  await expect(run(page)).toBeEnabled()
  await page.getByRole('button', { name: /Add Documents/ }).click()
  await expect(page.getByRole('checkbox', { name: /SYNTHETIC-DOC-01/ })).toBeChecked()
  await expect(page.getByText(miningProjectName, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Select Project/ }).click()
  await expect(page.getByRole('main').getByRole('combobox')).toHaveValue('SYNTHETIC-WRENCH-01')
  await page.getByRole('button', { name: /Build Pipeline/ }).click()
}
async function assertFailure(page, title) {
  await expect(page.getByRole('alert').filter({ hasText: title })).toBeVisible()
  await noSuccess(page)
}
async function executeSuccessfully(page) {
  const state = await openPreparedEditor(page, { prepared: true })
  await run(page).click()
  await expect(page.getByRole('heading', { name: 'Pipeline Completed Successfully', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'SYNTHETIC-EQUIPMENT-A', exact: true })).toBeVisible()
  expect(calls(state, 'extract_data')).toHaveLength(0)
  expect(calls(state, 'execute_pipeline')).toHaveLength(1)
  await expect(download(page)).toBeEnabled()
  return state
}

test('unsupported extraction remains visible through retry and preserves source selection and local steps', async ({ page }) => {
  await page.clock.install()
  const state = await openPreparedEditor(page)
  for (let attempt = 1; attempt <= 2; attempt++) {
    await run(page).click()
    await assertFailure(page, 'Extraction unavailable')
    await page.clock.fastForward(6000)
    await assertFailure(page, 'Extraction unavailable')
    expect(calls(state, 'extract_data')).toHaveLength(attempt)
    expect(calls(state, 'execute_pipeline')).toHaveLength(0)
    expect(state.downloads).toEqual([])
    await assertInputsPreserved(page)
  }
  assertIsolated(state)
})

test('artifact storage failure preserves inputs and cannot report completed export', async ({ page }, testInfo) => {
  const state = await openPreparedEditor(page, {
    prepared: true,
    execution: failure(503, 'artifact_storage_unavailable', 'The export could not be stored. Retry later.'),
  })
  await run(page).click()
  await assertFailure(page, 'Export unavailable')
  await page.getByRole('alert').filter({ hasText: 'Export unavailable' }).screenshot({ path: testInfo.outputPath('storage-unavailable.png') })
  expect(calls(state, 'extract_data')).toHaveLength(0)
  expect(calls(state, 'execute_pipeline')).toHaveLength(1)
  await assertInputsPreserved(page)
  await run(page).click()
  await assertFailure(page, 'Export unavailable')
  expect(calls(state, 'execute_pipeline')).toHaveLength(2)
  expect(state.downloads).toEqual([])
  assertIsolated(state)
})

for (const operation of ['extraction', 'execution']) {
  test(`${operation} permission denial exposes no result and retains inputs`, async ({ page }) => {
    const state = await openPreparedEditor(page, {
      prepared: operation === 'execution',
      [operation]: failure(403, 'permission_denied', 'You do not have permission to perform this action.'),
    })
    await run(page).click()
    await assertFailure(page, 'Access denied')
    if (operation === 'extraction') expect(calls(state, 'execute_pipeline')).toHaveLength(0)
    await assertInputsPreserved(page)
    expect(state.downloads).toEqual([])
    assertIsolated(state)
  })
}

test('existing prepared sources expose only a stored export and download through the authenticated API', async ({ page }) => {
  const state = await executeSuccessfully(page)
  const downloadEvent = page.waitForEvent('download')
  await download(page).click()
  const artifact = await downloadEvent
  const stream = await artifact.createReadStream()
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  expect(Buffer.concat(chunks).toString()).toBe(miningCsv)
  expect(artifact.suggestedFilename()).toMatch(/\.csv$/)
  expect(calls(state, 'download_master')).toHaveLength(1)
  expect(calls(state, 'download_master')[0].authorization).toBe(`Bearer ${miningToken}`)
  expect(calls(state, 'download_master')[0].query.expected_master_file).toBe(miningArtifact)
  expect(page.context().pages()).toHaveLength(1)
  assertIsolated(state)
})

for (const scenario of [
  { name: 'missing stored artifact', title: 'Export unavailable', response: failure(404, 'artifact_unavailable', 'No stored export is available.') },
  { name: 'download permission revoked', title: 'Access denied', response: failure(403, 'permission_denied', 'You do not have permission to download this export.') },
  { name: 'stored artifact changed after preview', title: 'Export unavailable', response: failure(409, 'artifact_changed', 'The stored export changed. Run the saved pipeline again before downloading.') },
]) {
  test(`${scenario.name} clears prior success and download availability`, async ({ page }) => {
    const state = await executeSuccessfully(page)
    state.download = scenario.response
    await download(page).click()
    await assertFailure(page, scenario.title)
    await assertInputsPreserved(page)
    expect(state.downloads).toEqual([])
    expect(calls(state, 'download_master')).toHaveLength(1)
    assertIsolated(state)
  })
}

for (const scenario of [
  { name: 'legacy unverified success', body: { rows_processed: 2, execution_time: 1, master_file: 's3://synthetic-bucket/invented-master.xlsx' } },
  { name: 'completed response without artifact confirmation', body: { ...storedExportResult(), artifact_available: false } },
  { name: 'completed response without artifact path', body: { ...storedExportResult(), master_file: '' } },
]) {
  test(`${scenario.name} is refused without success or download`, async ({ page }) => {
    const state = await openPreparedEditor(page, { prepared: true, execution: { status: 200, body: scenario.body } })
    await run(page).click()
    await assertFailure(page, 'Export unavailable')
    await assertInputsPreserved(page)
    expect(state.downloads).toEqual([])
    expect(calls(state, 'download_master')).toHaveLength(0)
    assertIsolated(state)
  })
}

test('failed pipeline response preserves inputs and is distinct from unsupported extraction', async ({ page }) => {
  const state = await openPreparedEditor(page, {
    prepared: true, execution: failure(500, 'pipeline_execution_failed', 'The pipeline could not finish. Review the saved configuration and retry.'),
  })
  await run(page).click()
  await assertFailure(page, 'Pipeline failed')
  await assertInputsPreserved(page)
  expect(state.downloads).toEqual([])
  assertIsolated(state)
})
