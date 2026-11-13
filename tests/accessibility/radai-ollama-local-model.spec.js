import { readFileSync } from 'node:fs'
import process from 'node:process'
import { test, expect } from '@playwright/test'

const statePath = process.env.RADAI_OLLAMA_MODEL_STATE_FILE
test.skip(!statePath, 'Requires a short-lived token for the local Docker backend.')

test('the actual RADAI frontend offers the configured local Qwen model', async ({ page }) => {
  const { token } = JSON.parse(readFileSync(statePath, 'utf8'))
  await page.addInitScript(access => {
    localStorage.setItem('radai_access_token', access)
    localStorage.setItem('radai_user_data', JSON.stringify({ first_name: 'Local' }))
  }, token)
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  const selector = page.getByRole('combobox', { name: 'Chat model' })
  await expect(selector).toContainText('Qwen3 8B', { timeout: 60000 })
  await selector.selectOption('qwen3:8b')
  await expect(selector).toHaveValue('qwen3:8b')
  await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
})
