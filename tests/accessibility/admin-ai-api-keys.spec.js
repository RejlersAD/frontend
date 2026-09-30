import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const root = '/api/v1/rbac/admin/ai-api-keys/'
const secret = 'test-only-not-a-real-provider-key'
const overview = () => ({
  encryption_ready: true,
  providers: ['openai', 'anthropic', 'gemini'].map(provider => ({ provider, managed: provider === 'anthropic', enabled: provider === 'anthropic', model: provider === 'anthropic' ? 'synthetic-model' : '', key_configured: provider === 'anthropic', revision: provider === 'anthropic' ? 2 : 0, selected_credential_id: provider === 'anthropic' ? 'one' : null, encryption_ready: true, ready: provider === 'anthropic' })),
  credentials: [
    { id: 'one', provider: 'anthropic', label: 'Primary Claude', enabled: true, is_selected: true, revision: 3, last_test_status: '', last_tested_at: null, last_test_model: '' },
    { id: 'two', provider: 'anthropic', label: 'Backup Claude', enabled: true, is_selected: false, revision: 1, last_test_status: '', last_tested_at: null, last_test_model: '' },
  ],
})

async function prepare(page, { data = overview(), actor, handle } = {}) {
  const calls = [], unexpected = [], logs = []
  const state = { data, calls, unexpected, logs }
  page.on('console', message => logs.push(message.text()))
  await page.addInitScript(() => { localStorage.setItem('radai_access_token', 'synthetic-admin-session') })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.startsWith(root)) {
      const call = { method: request.method(), path: url.pathname, body: request.postData() ? request.postDataJSON() : null }
      calls.push(call)
      const response = await handle?.(call, state)
      await route.fulfill(response || { status: 200, json: state.data })
      return
    }
    if (url.pathname.includes('/api/') || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      unexpected.push(`${request.method()} ${url.origin}${url.pathname}`)
      await route.abort(); return
    }
    await route.continue()
  })
  await page.goto(`/tests/fixtures/admin-ai-api-keys.html${actor ? `?actor=${actor}` : ''}`)
  return state
}
const row = (page, label) => page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: label, exact: false }) })
const add = async page => { await page.getByRole('button', { name: 'Add API key', exact: true }).click(); await page.getByLabel('Key name', { exact: true }).fill('New provider key'); await page.getByLabel('API key', { exact: true }).fill(secret) }

test('administrator sees safe metadata and accessible desktop/mobile layout', async ({ page }, testInfo) => {
  const state = await prepare(page)
  await expect(page.getByRole('heading', { name: 'AI API keys', exact: true })).toBeVisible()
  await expect(row(page, 'Primary Claude')).toContainText('Default')
  await expect(page.getByLabel('API key stored securely')).toHaveCount(2)
  expect((await new AxeBuilder({ page }).include('.aik-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('admin-ai-keys-desktop.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('admin-ai-keys-mobile.png') })
  expect(state.unexpected).toEqual([])
})

test('staff-only user is denied without requesting credential data', async ({ page }) => {
  const state = await prepare(page, { actor: 'staff' })
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  expect(state.calls).toEqual([])
})

test('server denial removes sensitive admin controls', async ({ page }) => {
  await prepare(page, { handle: () => ({ status: 403, json: { detail: 'Denied' } }) })
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add API key' })).toHaveCount(0)
})

test('missing encryption blocks writes but keeps refresh available', async ({ page }) => {
  const state = await prepare(page, { data: { ...overview(), encryption_ready: false } })
  await expect(page.getByText('Secure credential storage is not configured on this server.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add API key', exact: true })).toBeDisabled()
  await expect(row(page, 'Primary Claude').getByRole('button', { name: 'Edit Primary Claude' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  expect(state.calls.every(call => call.method === 'GET')).toBe(true)
})

test('new key is write-only, success clears it and blank edit retains saved key', async ({ page }) => {
  const state = await prepare(page, { handle: (call, state) => {
    if (call.method === 'POST') state.data = { ...state.data, credentials: [...state.data.credentials, { id: 'three', provider: 'anthropic', label: call.body.label, enabled: true, is_selected: false, revision: 1 }] }
  } })
  await add(page)
  expect((await new AxeBuilder({ page }).include('.aik-dialog').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Save key', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(state.calls.find(call => call.method === 'POST').body).toEqual({ provider: 'anthropic', label: 'New provider key', enabled: true, api_key: secret, expected_provider_revision: 2 })
  await row(page, 'New provider key').getByRole('button', { name: 'Edit New provider key' }).click()
  await expect(page.getByLabel('Replacement API key (optional)')).toHaveValue('')
  await page.getByRole('button', { name: 'Save key', exact: true }).click()
  expect(state.calls.find(call => call.method === 'PATCH').body).not.toHaveProperty('api_key')
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(secret)
  expect(await page.locator('body').innerText()).not.toContain(secret)
  expect(state.logs.join('\n')).not.toContain(secret)
})

test('failed save retains entered key and safely handles untrusted error payload', async ({ page }) => {
  const state = await prepare(page, { handle: call => call.method === 'POST' ? { status: 400, json: { api_key: `Rejected ${secret}` } } : undefined })
  await add(page)
  await page.getByRole('button', { name: 'Save key', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('could not be saved')
  await expect(page.getByLabel('API key', { exact: true })).toHaveValue(secret)
  expect(await page.locator('body').innerText()).not.toContain(secret)
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(secret)
  expect(state.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  expect(state.logs.join('\n')).not.toContain(secret)
})

test('stale edit keeps user input and requires an explicit latest-state review', async ({ page }) => {
  let attempts = 0
  const state = await prepare(page, { handle: (call, state) => {
    if (call.method === 'PATCH' && attempts++ === 0) { state.data.credentials[0].revision = 5; state.data.providers[1].revision = 4; return { status: 409, json: { code: 'ai_credentials_stale' } } }
  } })
  await row(page, 'Primary Claude').getByRole('button', { name: 'Edit Primary Claude' }).click()
  await page.getByLabel('Key name', { exact: true }).fill('Edited primary')
  await page.getByLabel('Replacement API key (optional)').fill(secret)
  await page.getByRole('button', { name: 'Save key', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save key', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Replacement API key (optional)')).toHaveValue(secret)
  await page.getByRole('button', { name: 'Reload latest settings' }).click()
  await expect(page.getByLabel('Key name', { exact: true })).toHaveValue('Edited primary')
  await page.getByRole('button', { name: 'Save key', exact: true }).click()
  expect(state.calls.filter(call => call.method === 'PATCH').at(-1).body).toMatchObject({ expected_revision: 5, expected_provider_revision: 4 })
})

test('explicit default switch and disable carry both current revisions', async ({ page }) => {
  const state = await prepare(page, { handle: (call, state) => {
    if (call.path.endsWith('/select/')) { state.data.credentials.forEach(key => { key.is_selected = key.id === 'two' }); state.data.providers[1].revision = 3 }
  } })
  await row(page, 'Backup Claude').getByRole('button', { name: 'Set default Backup Claude' }).click()
  await expect(row(page, 'Backup Claude')).toContainText('Default')
  expect(state.calls.find(call => call.path.endsWith('/select/')).body).toEqual({ expected_revision: 1, expected_provider_revision: 2 })
  await row(page, 'Backup Claude').getByRole('button', { name: 'Disable Backup Claude' }).click()
  expect(state.calls.find(call => call.method === 'PATCH').body).toEqual({ expected_revision: 1, expected_provider_revision: 3, enabled: false })
})

test('synthetic connection test requires a model and reports failure without losing key', async ({ page }) => {
  const state = await prepare(page, { handle: (call, state) => call.path.endsWith('/test/') ? { status: 200, json: { ...state.data, test: { success: false, reason: 'authentication_failed', model: call.body.model } } } : undefined })
  await row(page, 'Primary Claude').getByRole('button', { name: 'Test Primary Claude' }).click()
  await expect(page.getByText('No emails or documents are included.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Test connection', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('saved credential was retained')
  await expect(row(page, 'Primary Claude')).toBeVisible()
  expect(state.calls.find(call => call.path.endsWith('/test/')).body).toEqual({ expected_revision: 3, model: 'synthetic-model' })
  expect(state.unexpected).toEqual([])
})

test('provider configuration keeps explicit enabled and model settings', async ({ page }) => {
  const state = await prepare(page)
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Anthropic Claude', exact: true }) }).getByRole('button', { name: 'Provider settings' }).click()
  await page.getByLabel('Enable provider', { exact: true }).uncheck()
  await page.getByLabel('Default model (optional)').fill('approved-model')
  await page.getByRole('button', { name: 'Save provider', exact: true }).click()
  expect(state.calls.find(call => call.method === 'PATCH').body).toEqual({ expected_revision: 2, enabled: false, model: 'approved-model' })
})

test('removal requires its local confirmation and preserves default warning', async ({ page }) => {
  const state = await prepare(page)
  await row(page, 'Primary Claude').getByRole('button', { name: 'Remove Primary Claude' }).click()
  await expect(page.getByRole('dialog')).toContainText('replacement will not be selected automatically')
  expect(state.calls.every(call => call.method === 'GET')).toBe(true)
  await page.getByRole('button', { name: 'Remove key', exact: true }).click()
  expect(state.calls.find(call => call.method === 'DELETE').body).toEqual({ expected_revision: 3, expected_provider_revision: 2 })
})

test('identity change clears unsaved credentials and denies the new ordinary user', async ({ page }) => {
  await prepare(page)
  await add(page)
  await page.evaluate(() => window.setAIKeyActor({ id: 102, user: { id: 102, is_active: true }, roles: [] }))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  expect(await page.locator('body').innerHTML()).not.toContain(secret)
})
