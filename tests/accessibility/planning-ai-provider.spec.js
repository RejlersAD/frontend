import { test, expect } from '@playwright/test'
import { masterScheduleHarness } from '../fixtures/master-schedule.fixture.js'
import { scheduleAction } from '../fixtures/schedule-controls.js'

test.setTimeout(60000)

const providers = [
  { value: 'anthropic', label: 'Anthropic (Claude)', default_model: 'claude-opus-5', model_choices: [{ value: 'claude-opus-5', label: 'Claude Opus 5' }] },
  { value: 'gemini', label: 'Google Gemini', default_model: 'gemini-3.8-flash', model_choices: [{ value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }, { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' }] },
]
const dialog = page => page.getByRole('dialog', { name: 'Document analysis AI settings', exact: true })
const inputs = page => page.getByRole('dialog', { name: 'Documents & project inputs', exact: true })

async function openSettings(page) {
  if (!await inputs(page).isVisible()) await scheduleAction(page, 'Project inputs')
  await inputs(page).getByRole('button', { name: 'AI settings', exact: true }).click()
  await expect(dialog(page).getByRole('combobox', { name: 'Provider', exact: true })).toBeEnabled()
  return dialog(page)
}

async function harness(page, settings = {}) {
  return masterScheduleHarness(page, {
    prepare(state) {
      state.aiSettings = { provider: 'anthropic', enabled: true, key_configured: true, encryption_configured: true, model: 'claude-opus-5', model_choices: providers[0].model_choices, provider_choices: providers, ...settings }
      state.aiWrites = []
      state.connectionTests = 0
    },
    async handleRequest({ path, route, state, reply }) {
      const method = route.request().method()
      if (path.endsWith('/ai-settings/test/')) {
        state.connectionTests += 1
        await reply(route, { success: true, message: `${state.aiSettings.provider === 'gemini' ? 'Google Gemini' : 'Anthropic'} connection verified.` })
        return true
      }
      if (!path.endsWith('/ai-settings/')) return false
      if (method === 'POST') {
        const payload = route.request().postDataJSON()
        state.aiWrites.push(payload)
        const { api_key: apiKey, ...configuration } = payload
        state.aiSettings = { ...state.aiSettings, ...configuration, key_configured: Boolean(apiKey || state.aiSettings.key_configured), model_choices: providers.find(provider => provider.value === payload.provider).model_choices }
      } else if (method !== 'GET') {
        state.unknownWrites.push(path)
        await reply(route, { detail: 'Unexpected settings action.' }, 400)
        return true
      }
      await reply(route, state.aiSettings)
      return true
    },
  })
}

function clean(state) {
  expect(state.pageErrors).toEqual([])
  expect(state.unknownWrites).toEqual([])
  expect(state.unknown).toEqual([])
}

test('switching to Gemini requires its own key and tests only the saved provider', async ({ page }) => {
  const state = await harness(page)
  const settings = await openSettings(page)
  const connection = settings.getByRole('button', { name: 'Test connection', exact: true })
  const save = settings.getByRole('button', { name: 'Save settings', exact: true })
  await expect(connection).toBeEnabled()
  await expect(settings.getByLabel('Anthropic API key', { exact: true })).toHaveValue('')

  await settings.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('gemini')
  await expect(settings.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('gemini-3.8-flash')
  await expect(settings.getByRole('combobox', { name: 'Model', exact: true }).locator('option')).toHaveText(['Gemini 3.8 Flash', 'Gemini 3.5 Flash-Lite'])
  await expect(settings.getByLabel('Google Gemini API key', { exact: true })).toHaveAttribute('placeholder', 'Enter Google Gemini API key')
  await expect(settings).toContainText('The saved key belongs to Anthropic (Claude).')
  await expect(connection).toBeDisabled()
  await expect(save).toBeDisabled()
  expect(state.aiWrites).toEqual([])
  expect(state.connectionTests).toBe(0)

  const testKey = 'AIzaBrowserFixtureOnlyNotARealKey0000000'
  await settings.getByLabel('Google Gemini API key', { exact: true }).fill(` ${testKey} `)
  await expect(save).toBeEnabled()
  await expect(connection).toBeDisabled()
  await save.click()
  await expect(settings).toContainText('AI settings saved.')
  expect(state.aiWrites).toEqual([{ provider: 'gemini', enabled: true, model: 'gemini-3.8-flash', api_key: testKey }])
  await expect(settings.getByLabel('Google Gemini API key', { exact: true })).toHaveValue('')
  await expect(settings.getByLabel('Google Gemini API key', { exact: true })).toHaveAttribute('placeholder', 'Key saved — enter to replace')
  await expect(settings).not.toContainText(testKey)
  await expect(connection).toBeEnabled()
  await connection.click()
  await expect(settings.getByRole('status')).toHaveText('Google Gemini connection verified.')
  expect(state.connectionTests).toBe(1)

  await settings.getByRole('button', { name: 'Close Document analysis AI settings', exact: true }).click()
  await openSettings(page)
  await expect(settings.getByRole('combobox', { name: 'Provider', exact: true })).toHaveValue('gemini')
  await expect(settings.getByLabel('Google Gemini API key', { exact: true })).toHaveValue('')
  clean(state)
})

test('model, key, and enabled edits must be saved before testing Gemini', async ({ page }) => {
  const state = await harness(page, { provider: 'gemini', model: 'gemini-3.8-flash', model_choices: providers[1].model_choices })
  const settings = await openSettings(page)
  const connection = settings.getByRole('button', { name: 'Test connection', exact: true })
  const model = settings.getByRole('combobox', { name: 'Model', exact: true })
  const enabled = settings.getByRole('checkbox', { name: 'Use AI for document analysis', exact: true })
  await model.selectOption('gemini-3.5-flash-lite')
  await expect(connection).toBeDisabled()
  await expect(settings).toContainText('Save your changes before testing the connection.')
  await settings.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(connection).toBeEnabled()
  expect(state.aiWrites).toEqual([{ provider: 'gemini', enabled: true, model: 'gemini-3.5-flash-lite' }])

  await settings.getByLabel('Google Gemini API key', { exact: true }).fill('unsaved-fixture-key')
  await expect(connection).toBeDisabled()
  await settings.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('anthropic')
  await expect(settings.getByLabel('Anthropic API key', { exact: true })).toHaveValue('')
  await settings.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('gemini')
  await expect(model).toHaveValue('gemini-3.5-flash-lite')
  await expect(connection).toBeEnabled()

  await enabled.uncheck()
  await expect(connection).toBeDisabled()
  await settings.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(settings).toContainText('AI settings saved.')
  await expect(connection).toBeDisabled()
  await enabled.check()
  await expect(connection).toBeDisabled()
  await settings.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(connection).toBeEnabled()
  expect(state.connectionTests).toBe(0)
  clean(state)
})

test('older Anthropic settings responses keep the available model catalog and do not expose unsupported providers', async ({ page }) => {
  const state = await harness(page, { provider_choices: undefined, provider: undefined, model: 'claude-server-model', model_choices: [{ value: 'claude-server-model', label: 'Server configured Claude' }] })
  const settings = await openSettings(page)
  await expect(settings.getByRole('combobox', { name: 'Provider', exact: true }).locator('option')).toHaveText(['Anthropic (Claude)'])
  await expect(settings.getByRole('combobox', { name: 'Model', exact: true })).toHaveValue('claude-server-model')
  await expect(settings.getByRole('combobox', { name: 'Model', exact: true }).locator('option')).toHaveText(['Server configured Claude'])
  await expect(settings.getByRole('button', { name: 'Test connection', exact: true })).toBeEnabled()
  clean(state)
})
