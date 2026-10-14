import { test, expect } from '@playwright/test'
import { formRecordId, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture'

test.setTimeout(90000)
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } })
const originalVersion = '2026-09-15T07:00:00.123456Z'
const otherVersion = '2026-09-15T08:00:10.654321Z'
const save = page => page.getByRole('button', { name: 'Save', exact: true }).first()
const send = page => page.getByRole('button', { name: 'Send for Approval', exact: true }).first()
const product = page => page.getByRole('textbox', { name: 'Product / service', exact: true })
const confirmation = page => page.getByRole('dialog', { name: 'Confirm action', exact: true })
const writes = state => state.requests.filter(({ method, path }) => ['PATCH', 'POST'].includes(method) && /^\/api\/v1\/procurement\/requisitions\/(?:[^/]+\/)?$/.test(path))
const assertIsolated = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]) }
async function open(page, options = {}) {
  const state = await recommendationFormHarness(page, { edit: true, concurrency: true, record: { updated_at: originalVersion }, ...options })
  await expect(page.getByRole('heading', { name: options.edit === false ? 'Create purchase recommendation' : 'Edit purchase recommendation', exact: true })).toBeVisible()
  return state
}
async function confirmSend(page) {
  await send(page).click()
  await confirmation(page).getByRole('button', { name: 'Yes', exact: true }).click()
}

test('edited draft saves preserve timestamp precision and send the newly saved version for approval', async ({ page }) => {
  const state = await open(page)
  await product(page).fill('Reviewed design package')
  await save(page).click()
  await expect.poll(() => writes(state).length).toBe(1)
  expect(writes(state)[0].body.expected_updated_at).toBe(originalVersion)
  const firstSavedVersion = state.record.updated_at
  await expect(save(page)).toBeEnabled()
  await confirmSend(page)
  await expect.poll(() => state.submissions.length).toBe(1)
  expect(writes(state)[1].body.expected_updated_at).toBe(firstSavedVersion)
  expect(state.submissions[0].expected_updated_at).toBe(state.record.updated_at)
  expect(state.record.status).toBe('submitted')
  await expect(page).toHaveURL(/\/requisitions$/)
  assertIsolated(state)
})

test('a new draft adopts the create response token for its next save', async ({ page }) => {
  const state = await open(page, { edit: false })
  await page.getByRole('textbox', { name: 'PR number', exact: true }).fill('SYNTHETIC-NEW-DRAFT')
  await product(page).fill('New request')
  await save(page).click()
  await expect.poll(() => writes(state).length).toBe(1)
  expect(writes(state)[0].body.expected_updated_at).toBeUndefined()
  const version = state.record.updated_at
  await expect(save(page)).toBeEnabled()
  await product(page).fill('Updated new request')
  await save(page).click()
  await expect.poll(() => writes(state).length).toBe(2)
  expect(writes(state)[1].body.expected_updated_at).toBe(version)
  expect(writes(state)[1].method).toBe('PATCH')
  expect(state.record.product_service).toBe('Updated new request')
  assertIsolated(state)
})

test('stale manual save retains edits and files until confirmed reload, then uses the latest version', async ({ page }) => {
  const state = await open(page)
  await product(page).fill('My unsaved requirement')
  await page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Documents/ }).click()
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'local-notes.txt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic attachment') })
  state.record = { ...state.record, product_service: 'Changed by another requester', updated_at: otherVersion }
  await save(page).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Your edits are still here' })).toBeVisible()
  await expect(save(page)).toBeDisabled()
  await expect(send(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Remove local-notes.txt.pdf', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /^Request\s*,/ }).click()
  await expect(product(page)).toHaveValue('My unsaved requirement')
  await page.getByRole('button', { name: 'Reload latest version', exact: true }).click()
  await confirmation(page).getByRole('button', { name: 'Keep my edits', exact: true }).click()
  await expect(product(page)).toHaveValue('My unsaved requirement')
  expect(writes(state)).toHaveLength(1)
  await page.getByRole('button', { name: 'Reload latest version', exact: true }).click()
  await confirmation(page).getByRole('button', { name: 'Reload latest version', exact: true }).click()
  await expect(product(page)).toHaveValue('Changed by another requester')
  await expect(save(page)).toBeEnabled()
  await product(page).fill('Reviewed current requirement')
  await save(page).click()
  await expect.poll(() => writes(state).length).toBe(2)
  expect(writes(state)[1].body.expected_updated_at).toBe(otherVersion)
  assertIsolated(state)
})

test('stale autosave stops further background writes while preserving local edits', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') })
  const state = await open(page)
  await product(page).fill('Unsaved autosave change')
  state.record = { ...state.record, updated_at: otherVersion }
  await page.clock.fastForward(31000)
  await expect(page.getByRole('alert').filter({ hasText: 'Your edits are still here' })).toBeVisible()
  expect(writes(state)[0].body.expected_updated_at).toBe(originalVersion)
  await product(page).fill('Further local change')
  await page.clock.fastForward(65000)
  expect(writes(state)).toHaveLength(1)
  await expect(product(page)).toHaveValue('Further local change')
  assertIsolated(state)
})

test('a change between save and submission blocks sending and preserves the saved editor', async ({ page }) => {
  const state = await open(page, { afterSave: fixture => { fixture.record = { ...fixture.record, product_service: 'Concurrent requirement', updated_at: otherVersion } } })
  await product(page).fill('Requirement I reviewed')
  await confirmSend(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Your edits are still here' })).toBeVisible()
  expect(state.submissions).toHaveLength(1)
  expect(state.submissions[0].expected_updated_at).toBe('2026-09-15T08:00:00.000001Z')
  expect(state.record.status).toBe('draft')
  await expect(product(page)).toHaveValue('Requirement I reviewed')
  await expect(page).toHaveURL(new RegExp(`${formRecordId}/edit$`))
  assertIsolated(state)
})

test('review-page submission rejects a changed draft and requires reviewing its refreshed version', async ({ page }) => {
  const state = await open(page)
  await page.goto(`/procurement/requisitions/${formRecordId}`)
  const submit = page.getByRole('button', { name: 'Submit for Approval', exact: true })
  await expect(submit).toBeVisible()
  state.record = { ...state.record, product_service: 'Another saved version', updated_at: otherVersion }
  await submit.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Reload and review' })).toBeVisible()
  expect(state.submissions[0].expected_updated_at).toBe(originalVersion)
  await expect(submit).toBeDisabled()
  await page.getByRole('button', { name: 'Reload latest version', exact: true }).click()
  await expect(submit).toBeEnabled()
  await expect(page.locator('dd').filter({ hasText: 'Another saved version' })).toBeVisible()
  expect(state.submissions).toHaveLength(1)
  await submit.click()
  await expect(page.getByRole('dialog', { name: 'Notification', exact: true })).toContainText('submitted for approval')
  expect(state.submissions[1].expected_updated_at).toBe(otherVersion)
  expect(state.record.status).toBe('submitted')
  assertIsolated(state)
})
