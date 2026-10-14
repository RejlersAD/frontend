import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import {
  pfdHarness, conversion, newConversion, response, failure, originalId, regeneratedId,
  documentId, originalBytes, regeneratedBytes, originalHash, pfdToken,
} from '../fixtures/pfd-output.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1536, height: 960 } })
// Close the live App while its context routes are still installed. Otherwise a
// delayed telemetry timer can fire during automatic route/fixture teardown.
test.afterEach(async ({ page }) => { await page.close() })
const review = page => page.getByRole('region', { name: 'Output identity and review' })
const operationAlert = page => page.getByRole('alert').filter({ hasText: 'Output operation' })
const selectedOutput = page => page.getByLabel('Output version', { exact: true })
const regenerate = page => page.getByRole('button', { name: /^Regenerate(?: P&ID)?$/ })
const download = page => page.getByRole('button', { name: /^Download P&ID Drawing(?: \(PDF\))?$/ })
const mutations = state => state.requests.filter(call => call.path.startsWith('/api/v1/pfd/') && call.method !== 'GET')
const assertIsolated = state => {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.externalRequests.filter(call => /synthetic-storage|openai|roboflow|amazonaws/.test(call.url))).toEqual([])
}

async function openOutput(page, options = {}) {
  const state = await pfdHarness(page, options)
  await expect(page.getByRole('heading', { name: 'Synthetic F05 source', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Generated P&ID', exact: true }).click()
  await expect(review(page)).toBeVisible()
  await expect(selectedOutput(page)).toHaveValue(originalId)
  return state
}

async function savedBytes(page, button) {
  const pending = page.waitForEvent('download')
  await button.click()
  const artifact = await pending
  return readFile(await artifact.path())
}

for (const branch of ['legacy specifications', 'three-step specifications']) {
  test(`${branch}: opening and repeated downloads preserve the reviewed output without mutation`, async ({ page }, testInfo) => {
    const record = conversion(branch === 'three-step specifications' ? { pid_data: { step1_core_extraction: { equipment_list: [] } } } : {})
    const state = await openOutput(page, { conversions: response({ count: 1, results: [record] }) })
    await expect(review(page)).toContainText(originalId)
    await expect(review(page)).toContainText(/Approved/)
    for (let index = 0; index < 2; index += 1) {
      expect(await savedBytes(page, download(page))).toEqual(originalBytes)
    }
    await expect(selectedOutput(page)).toHaveValue(originalId)
    await expect(review(page)).toContainText(/Approved/)
    expect(mutations(state)).toEqual([])
    expect(state.requests.filter(call => call.path.endsWith('/download_drawing/')).every(call => Object.keys(call.query).length === 0)).toBe(true)
    expect(state.requests.filter(call => call.path.endsWith('/download_drawing/')).every(call => call.authorization === `Bearer ${pfdToken}`)).toBe(true)
    if (branch === 'legacy specifications') {
      await page.getByRole('main').screenshot({ path: testInfo.outputPath('reviewed-output-desktop.png') })
      await page.setViewportSize({ width: 390, height: 844 })
      await review(page).scrollIntoViewIfNeeded()
      await expect(review(page)).toBeVisible()
      await expect(selectedOutput(page)).toBeEnabled()
      await page.getByRole('main').screenshot({ path: testInfo.outputPath('reviewed-output-390.png') })
    }
    assertIsolated(state)
  })
}

test('export-only capability permits a stored download without regeneration', async ({ page }) => {
  const state = await openOutput(page, {
    actions: ['read', 'export'],
    conversions: response({ count: 1, results: [conversion({ allowed_actions: ['download'] })] }),
  })
  await expect(regenerate(page)).toBeDisabled()
  expect(await savedBytes(page, download(page))).toEqual(originalBytes)
  expect(mutations(state)).toEqual([])
  assertIsolated(state)
})

test('regeneration creates a distinct unreviewed output while the approved original remains selectable', async ({ page }, testInfo) => {
  const state = await openOutput(page)
  await regenerate(page).click()
  await expect(page.getByRole('status').filter({ hasText: /new unreviewed output/ })).toBeVisible()
  await expect(selectedOutput(page)).toHaveValue(regeneratedId)
  await expect(review(page)).toContainText(regeneratedId)
  await expect(review(page)).toContainText(/Unreviewed/)
  expect(await savedBytes(page, download(page))).toEqual(regeneratedBytes)
  const request = mutations(state).find(call => call.path.endsWith('/regenerate/'))
  expect(request.body).toEqual({ expected_updated_at: conversion().updated_at, expected_artifact_sha256: originalHash })
  expect(request.authorization).toBe(`Bearer ${pfdToken}`)
  expect(mutations(state)).toHaveLength(1)
  await page.getByRole('main').screenshot({ path: testInfo.outputPath('regenerated-unreviewed-output.png') })
  await selectedOutput(page).selectOption(originalId)
  await expect(review(page)).toContainText(/Approved/)
  await expect(review(page)).toContainText(originalHash)
  expect(await savedBytes(page, download(page))).toEqual(originalBytes)
  assertIsolated(state)
})

for (const scenario of [
  { name: 'permission denial', status: 403, code: 'permission_denied', detail: 'Regeneration denied for this synthetic actor.' },
  { name: 'generation failure', status: 503, code: 'generation_failed', detail: 'Synthetic generation failed; the original remains available.' },
  { name: 'storage failure', status: 503, code: 'artifact_storage_unavailable', detail: 'Synthetic artifact storage failed; the original remains available.' },
]) {
  test(`${scenario.name} preserves selected identity and approval without false completion or replay`, async ({ page }) => {
    await page.clock.install()
    const state = await openOutput(page, { regenerate: failure(scenario.status, scenario.detail, scenario.code) })
    await regenerate(page).click()
    await expect(operationAlert(page)).toBeVisible()
    await expect(selectedOutput(page)).toHaveValue(originalId)
    await expect(review(page)).toContainText(/Approved/)
    await expect(page.getByRole('status').filter({ hasText: /created|completed/i })).toHaveCount(0)
    await page.clock.fastForward(30000)
    expect(mutations(state)).toHaveLength(1)
    expect(await savedBytes(page, download(page))).toEqual(originalBytes)
    assertIsolated(state)
  })
}

test('stale regeneration retains the original and requires explicit read recovery before another attempt', async ({ page }) => {
  const state = await openOutput(page, { regenerate: failure(409, 'The output changed. Reload outputs before regenerating.', 'stale_output') })
  await regenerate(page).click()
  await expect(operationAlert(page)).toContainText(/changed|stale|Reload/i)
  await expect(selectedOutput(page)).toHaveValue(originalId)
  await expect(review(page)).toContainText(/Approved/)
  await expect(regenerate(page)).toBeDisabled()
  const reads = state.counts.conversions
  state.conversions = response({ count: 1, results: [conversion({ updated_at: '2026-09-24T08:05:00Z' })] })
  await page.getByRole('button', { name: 'Reload outputs', exact: true }).first().click()
  await expect.poll(() => state.counts.conversions).toBe(reads + 1)
  await expect(selectedOutput(page)).toHaveValue(originalId)
  await expect(regenerate(page)).toBeEnabled()
  expect(mutations(state)).toHaveLength(1)
  assertIsolated(state)
})

for (const scenario of [
  { name: 'same output returned', body: conversion() },
  { name: 'new output carrying old approval', body: newConversion({ reviewed_by: 9500, reviewed_at: conversion().reviewed_at, artifact: { ...newConversion().artifact, review_state: 'approved' } }) },
]) {
  test(`${scenario.name} is rejected as an unconfirmed regeneration outcome`, async ({ page }) => {
    const state = await openOutput(page, { regenerate: response(scenario.body, 201) })
    await regenerate(page).click()
    await expect(operationAlert(page)).toBeVisible()
    await expect(selectedOutput(page)).toHaveValue(originalId)
    await expect(review(page)).toContainText(/Approved/)
    await expect(page.getByRole('status').filter({ hasText: /created|completed/i })).toHaveCount(0)
    expect(mutations(state)).toHaveLength(1)
    assertIsolated(state)
  })
}

test('failed output history is unavailable and does not trigger generation or an empty result', async ({ page }) => {
  const state = await pfdHarness(page, { conversions: failure(503, 'Synthetic output history unavailable.') })
  await expect(operationAlert(page)).toBeVisible()
  await page.getByRole('button', { name: 'Generated P&ID', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Output history unavailable', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload outputs', exact: true })).toBeVisible()
  await expect(page.getByText(/No P&ID.*generated|No output.*available/i)).toHaveCount(0)
  expect(mutations(state)).toEqual([])
  state.conversions = response({ count: 1, results: [conversion()] })
  await page.getByRole('button', { name: 'Reload outputs', exact: true }).click()
  await page.getByRole('button', { name: 'Generated P&ID', exact: true }).click()
  await expect(review(page)).toContainText(/Approved/)
  expect(mutations(state)).toEqual([])
  assertIsolated(state)
})

test('an empty successful output history requires explicit generation instead of generating on open', async ({ page }) => {
  const state = await pfdHarness(page, { conversions: response({ count: 0, results: [] }) })
  await page.getByRole('button', { name: 'Generated P&ID', exact: true }).click()
  await expect(page.getByRole('button', { name: /Standard Generation/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Standard Generation/ })).toBeEnabled()
  expect(mutations(state)).toEqual([])
  assertIsolated(state)
})

test('the PFD history download remains a read of the stored output with identity and review state', async ({ page }) => {
  const item = {
    ...conversion(), pfd_id: documentId, document_number: conversion().pid_drawing_number,
    document_title: conversion().pid_title, filename: 'synthetic-reviewed.pdf', can_download: true,
  }
  const state = await pfdHarness(page, {
    route: '/pfd/history',
    overview: response({ success: true, data: { profile: null, recent_uploads: [], recent_conversions: [item] } }),
    historyConversions: response({ success: true, data: { conversions: [item], pagination: { page: 1, limit: 50, total: 1, total_pages: 1 } } }),
  })
  await expect(page.getByRole('heading', { name: 'PFD to P&ID Conversion History', exact: true })).toBeVisible()
  await expect(page.getByText(originalId, { exact: false })).toBeVisible()
  expect(await savedBytes(page, page.getByRole('button', { name: 'Download', exact: true }))).toEqual(originalBytes)
  expect(mutations(state)).toEqual([])
  assertIsolated(state)
})

test('verification display resets to the selected output identity', async ({ page }) => {
  const state = await openOutput(page, { conversions: response({ count: 2, results: [conversion(), newConversion()] }) })
  await page.getByRole('button', { name: /Design Check/i }).click()
  await expect(page.getByText('Synthetic original verification result.', { exact: true })).toBeVisible()
  state.verify = response({ issues: [{ severity: 'observation', issue_observed: 'Synthetic regenerated verification result.' }] })
  await selectedOutput(page).selectOption(regeneratedId)
  await expect(page.getByText('Synthetic regenerated verification result.', { exact: true })).toBeVisible()
  await expect(page.getByText('Synthetic original verification result.', { exact: true })).toHaveCount(0)
  expect(state.requests.filter(call => call.path.endsWith('/verify-pid/')).at(-1).body.conversion_id).toBe(regeneratedId)
  await expect(review(page)).toContainText(/Unreviewed/)
  assertIsolated(state)
})
