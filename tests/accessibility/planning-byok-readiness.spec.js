import { test, expect } from '@playwright/test'
import { planningInputsHarness } from '../fixtures/planning-inputs.fixture.js'

test.setTimeout(60000)

const ready = 'Settings saved. Connection established. AI is ready for analysis.'
const fixtureKey = 'BrowserFixtureOnlyNotARealProviderKey0000000'
const providers = [
  { value: 'anthropic', label: 'Anthropic (Claude)', default_model: 'fixture-claude', model_choices: [{ value: 'fixture-claude', label: 'Fixture Claude' }] },
  { value: 'gemini', label: 'Google Gemini', default_model: 'fixture-gemini', model_choices: [{ value: 'fixture-gemini', label: 'Fixture Gemini' }, { value: 'fixture-gemini-alternative', label: 'Fixture Gemini alternative' }] },
]
const dialog = page => page.getByRole('dialog', { name: /^AI Settings \(BYOK\)/ })
const keyInput = settings => settings.locator('input[type="password"]')

function deferred() {
  let release
  const promise = new Promise(resolve => { release = resolve })
  return { promise, release }
}

async function harness(page, options = {}) {
  return planningInputsHarness(page, {
    prepare(state) {
      state.aiSettings = { provider: 'gemini', enabled: true, key_configured: true,
        encryption_configured: true, model: 'fixture-gemini', provider_choices: providers,
        model_choices: providers[1].model_choices, ...options.settings }
      state.aiCalls = []
      state.aiSettingsReads = 0
      state.aiLoadError = options.loadError || null
      state.aiSaveError = null
      state.aiTestError = null
      state.aiTestResult = { success: true, message: 'Synthetic provider connection verified.' }
      state.aiSaveGate = options.saveGate
      state.aiTestGate = options.testGate
    },
    async handleRequest({ path, route, state, reply }) {
      const method = route.request().method()
      if (path === '/api/v1/planning-intelligence/projects/71/ai-settings/test/' && method === 'POST') {
        state.aiCalls.push({ action: 'test', settings: structuredClone(state.aiSettings) })
        if (state.aiTestGate) await state.aiTestGate.promise
        await reply(route, state.aiTestError?.body || state.aiTestResult, state.aiTestError?.status || 200)
        return true
      }
      if (path !== '/api/v1/planning-intelligence/projects/71/ai-settings/') return false
      if (method === 'GET') {
        state.aiSettingsReads += 1
        if (options.loadGate) await options.loadGate.promise
        await reply(route, state.aiLoadError?.body || state.aiSettings, state.aiLoadError?.status || 200)
        return true
      }
      if (method === 'POST') {
        const payload = route.request().postDataJSON()
        state.aiCalls.push({ action: 'save', payload })
        if (state.aiSaveGate) await state.aiSaveGate.promise
        if (state.aiSaveError) {
          await reply(route, state.aiSaveError.body, state.aiSaveError.status)
          return true
        }
        const { api_key: suppliedKey, ...settings } = payload
        const sameProvider = settings.provider === state.aiSettings.provider
        state.aiSettings = { ...state.aiSettings, ...settings,
          key_configured: Boolean(suppliedKey || (sameProvider && state.aiSettings.key_configured)),
          model_choices: providers.find(provider => provider.value === settings.provider).model_choices }
        await reply(route, state.aiSettings)
        return true
      }
      if (method === 'DELETE') {
        state.aiCalls.push({ action: 'remove' })
        state.aiSettings = { ...state.aiSettings, key_configured: false }
        await reply(route, state.aiSettings)
        return true
      }
      return false
    },
  })
}

async function openSettings(page) {
  await expect(page.getByRole('complementary', { name: 'AI input review', exact: true })).toHaveAttribute('aria-busy', 'false')
  await page.getByRole('button', { name: 'AI settings', exact: true }).click()
  const settings = dialog(page)
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toHaveValue('gemini')
  return settings
}

async function expectReady(settings) {
  await expect(settings.getByRole('status')).toHaveText(ready)
  await expect(settings).toHaveAttribute('aria-busy', 'false')
}

async function expectBusyDialog(page, settings, progressName) {
  await expect(settings).toHaveAttribute('aria-busy', 'true')
  await expect(settings.getByRole('progressbar', { name: progressName, exact: true })).toBeVisible()
  await expect(settings.getByRole('button', { name: 'Close', exact: true })).toBeDisabled()
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toBeDisabled()
  await expect(settings.getByRole('combobox', { name: 'AI model', exact: true })).toBeDisabled()
  await expect(settings.getByRole('checkbox')).toBeDisabled()
  await expect(keyInput(settings)).toBeDisabled()
  await expect(settings.locator('button:enabled')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.mouse.click(4, 4)
  await expect(settings).toBeVisible()
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknown).toEqual([])
  expect(state.requests.filter(request => request.method !== 'GET'
    && !/^\/api\/v1\/planning-intelligence\/projects\/71\/ai-settings\/(?:test\/)?$/.test(request.path))).toEqual([])
}

test('BYOK save persists before testing and keeps the dialog open through both pending requests and verified readiness', async ({ page }) => {
  const saveGate = deferred()
  const testGate = deferred()
  const state = await harness(page, { saveGate, testGate, settings: { key_configured: false } })
  const settings = await openSettings(page)
  await keyInput(settings).fill(` ${fixtureKey} `)
  await settings.getByRole('combobox', { name: 'AI model', exact: true }).selectOption('fixture-gemini-alternative')
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect.poll(() => state.aiCalls.map(call => call.action)).toEqual(['save'])
  await expectBusyDialog(page, settings, 'Saving AI settings')
  expect(state.aiCalls[0].payload).toEqual({ provider: 'gemini', model: 'fixture-gemini-alternative', enabled: true, api_key: fixtureKey })
  expect(state.aiSettings.key_configured).toBe(false)

  saveGate.release()
  await expect.poll(() => state.aiCalls.map(call => call.action)).toEqual(['save', 'test'])
  await expectBusyDialog(page, settings, 'Testing AI connection')
  expect(state.aiCalls[1].settings).toMatchObject({ provider: 'gemini', model: 'fixture-gemini-alternative', key_configured: true })
  await expect(keyInput(settings)).toHaveValue('')
  testGate.release()
  await expectReady(settings)
  await expect(settings).toContainText('key configured')
  await expect(settings).not.toContainText(fixtureKey)
  await settings.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(settings).toBeHidden()
  await page.reload()
  await openSettings(page)
  await expect(settings.getByRole('combobox', { name: 'AI model', exact: true })).toHaveValue('fixture-gemini-alternative')
  await expect(keyInput(settings)).toHaveValue('')
  await expect(settings).toContainText('key configured')
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save', 'test'])
  clean(state)
})

test('BYOK denied save retains the typed key and selected model without testing until an explicit successful retry', async ({ page }) => {
  const state = await harness(page, { settings: { key_configured: false } })
  state.aiSaveError = { status: 403, body: { detail: 'You do not have permission to update AI settings.' } }
  const settings = await openSettings(page)
  await keyInput(settings).fill(fixtureKey)
  await settings.getByRole('combobox', { name: 'AI model', exact: true }).selectOption('fixture-gemini-alternative')
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect(settings.getByRole('alert')).toHaveText('You do not have permission to update AI settings.')
  await expect(settings).toHaveAttribute('aria-busy', 'false')
  await expect(keyInput(settings)).toHaveValue(fixtureKey)
  await expect(settings.getByRole('combobox', { name: 'AI model', exact: true })).toHaveValue('fixture-gemini-alternative')
  await expect(settings.getByRole('button', { name: 'Test Connection', exact: true })).toBeDisabled()
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save'])
  state.aiSaveError = null
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expectReady(settings)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save', 'save', 'test'])
  await expect(keyInput(settings)).toHaveValue('')
  clean(state)
})

test('BYOK failed connection retains saved configuration and retries the test without saving or losing the stored key', async ({ page }) => {
  const state = await harness(page, { settings: { key_configured: false } })
  state.aiTestResult = { success: false, message: 'The provider rejected this key. Check the key and test again.' }
  const settings = await openSettings(page)
  await keyInput(settings).fill(fixtureKey)
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect(settings.getByRole('alert')).toHaveText(state.aiTestResult.message)
  await expect(settings).toContainText('key configured')
  await expect(keyInput(settings)).toHaveValue('')
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toHaveValue('gemini')
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save', 'test'])

  state.aiTestError = { status: 503, body: { detail: 'Provider temporarily unavailable. Retry the connection test.' } }
  await settings.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expect(settings.getByRole('alert')).toHaveText(state.aiTestError.body.detail)
  await expect(settings).toContainText('key configured')
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  state.aiTestError = null
  state.aiTestResult = { success: true }
  await settings.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expectReady(settings)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save', 'test', 'test', 'test'])
  expect(state.aiSettings.key_configured).toBe(true)
  clean(state)
})

test('BYOK readiness is invalidated immediately when model, key, enabled state or provider changes', async ({ page }) => {
  const state = await harness(page)
  const settings = await openSettings(page)
  const connection = settings.getByRole('button', { name: 'Test Connection', exact: true })
  const model = settings.getByRole('combobox', { name: 'AI model', exact: true })
  const enabled = settings.getByRole('checkbox', { name: 'Enable AI BYOK for this project', exact: true })
  const provider = settings.getByRole('combobox', { name: 'AI provider', exact: true })
  const edits = [
    { apply: () => model.selectOption('fixture-gemini-alternative'), restore: () => model.selectOption('fixture-gemini') },
    { apply: () => keyInput(settings).fill(fixtureKey), restore: () => keyInput(settings).fill('') },
    { apply: () => enabled.uncheck(), restore: () => enabled.check() },
    { apply: () => provider.selectOption('anthropic'), restore: () => provider.selectOption('gemini') },
  ]
  for (const edit of edits) {
    await connection.click()
    await expectReady(settings)
    await edit.apply()
    await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
    await expect(connection).toBeDisabled()
    await expect(settings).toContainText('Unsaved changes have not been tested.')
    await edit.restore()
    await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
    await expect(connection).toBeEnabled()
  }
  expect(state.aiCalls.map(call => call.action)).toEqual(['test', 'test', 'test', 'test'])
  clean(state)
})

test('BYOK disabled settings save without a connection test or ready claim and allow idle Escape and backdrop close', async ({ page }) => {
  const state = await harness(page)
  const settings = await openSettings(page)
  await settings.getByRole('checkbox', { name: 'Enable AI BYOK for this project', exact: true }).uncheck()
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect(settings.getByRole('status')).toHaveText('Settings saved. AI is disabled for this project.')
  await expect(settings.getByRole('button', { name: 'Test Connection', exact: true })).toBeDisabled()
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save'])
  expect(state.aiSettings.enabled).toBe(false)
  await page.keyboard.press('Escape')
  await expect(settings).toBeHidden()
  await openSettings(page)
  await expect(settings.getByRole('checkbox')).not.toBeChecked()
  await page.mouse.click(4, 4)
  await expect(settings).toBeHidden()
  clean(state)
})

test('BYOK removing the stored key clears verified readiness and an enabled save without a key cannot claim readiness', async ({ page }) => {
  const state = await harness(page)
  const settings = await openSettings(page)
  await settings.getByRole('button', { name: 'Test Connection', exact: true }).click()
  await expectReady(settings)
  await settings.getByRole('button', { name: 'Remove Key', exact: true }).click()
  await expect(settings.getByRole('status')).toHaveText('API key removed. Configure and test a key to use AI analysis.')
  await expect(settings.getByRole('button', { name: 'Test Connection', exact: true })).toBeDisabled()
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expect(settings.getByRole('status')).toHaveText('Settings saved. Configure an API key and test the connection before analysis.')
  expect(state.aiCalls.map(call => call.action)).toEqual(['test', 'remove', 'save'])
  expect(state.aiSettings.key_configured).toBe(false)
  clean(state)
})

test('BYOK initial settings load prevents edits and writes until the saved configuration is available', async ({ page }) => {
  const loadGate = deferred()
  const state = await harness(page, { loadGate })
  await page.getByRole('button', { name: 'AI settings', exact: true }).click()
  const settings = dialog(page)
  await expect(settings.getByRole('status')).toContainText('Loading AI settings')
  await expect(settings).toHaveAttribute('aria-busy', 'true')
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toBeDisabled()
  await expect(settings.getByRole('combobox', { name: 'AI model', exact: true })).toBeDisabled()
  await expect(settings.getByRole('checkbox')).toBeDisabled()
  await expect(keyInput(settings)).toBeDisabled()
  await expect(settings.getByRole('button', { name: 'Save Settings', exact: true })).toBeDisabled()
  await expect(settings.getByRole('button', { name: 'Test Connection', exact: true })).toBeDisabled()
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  expect(state.aiCalls).toEqual([])
  loadGate.release()
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toHaveValue('gemini')
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toBeEnabled()
  await expect(settings).toHaveAttribute('aria-busy', 'false')
  await expect(settings).toContainText('key configured')
  await keyInput(settings).fill(fixtureKey)
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expectReady(settings)
  expect(state.aiSettingsReads).toBe(1)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save', 'test'])
  clean(state)
})

test('BYOK failed settings load exposes an in-dialog retry and cannot save or test assumed defaults', async ({ page }) => {
  const state = await harness(page, { loadError: { status: 503, body: { detail: 'Saved AI settings are temporarily unavailable.' } } })
  await page.getByRole('button', { name: 'AI settings', exact: true }).click()
  const settings = dialog(page)
  await expect(settings.getByRole('alert')).toHaveText('Saved AI settings are temporarily unavailable.')
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toBeDisabled()
  await expect(keyInput(settings)).toBeDisabled()
  await expect(settings.getByRole('button', { name: 'Save Settings', exact: true })).toBeDisabled()
  await expect(settings.getByRole('button', { name: 'Test Connection', exact: true })).toBeDisabled()
  expect(state.aiCalls).toEqual([])
  state.aiLoadError = null
  await settings.getByRole('button', { name: 'Retry loading AI settings', exact: true }).click()
  await expect(settings.getByRole('alert')).toHaveCount(0)
  await expect(settings.getByRole('combobox', { name: 'AI provider', exact: true })).toHaveValue('gemini')
  await expect(settings.getByRole('button', { name: 'Save Settings', exact: true })).toBeEnabled()
  await expect(settings).toContainText('key configured')
  await expect(settings.getByText(ready, { exact: true })).toHaveCount(0)
  await settings.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await expectReady(settings)
  expect(state.aiSettingsReads).toBe(2)
  expect(state.aiCalls.map(call => call.action)).toEqual(['save', 'test'])
  clean(state)
})
