import { readFileSync } from 'node:fs'
import process from 'node:process'
import { test, expect } from '@playwright/test'

const statePath = process.env.RADAI_OLLAMA_PILOT_STATE_FILE
test.skip(!statePath, 'Requires disposable PostgreSQL pilot state and local Ollama responses.')
test.setTimeout(180000)

test('saved general and cited project replies reopen in the actual workspace', async ({ page }) => {
  const { token } = JSON.parse(readFileSync(statePath, 'utf8'))
  await page.addInitScript(access => {
    localStorage.setItem('radai_access_token', access)
    localStorage.setItem('radai_user_data', JSON.stringify({ first_name: 'Local' }))
  }, token)
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  await expect(page.getByRole('combobox', { name: 'Chat model' })).toContainText('Qwen3 8B', { timeout: 120000 })
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: /New conversation/ }).first().click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('Paris')
  await expect(page.locator('[aria-live="polite"]')).not.toContainText('synthetic-pms.pdf')
  await page.getByRole('button', { name: 'Local Ollama pilot' }).click()
  await page.getByRole('button', { name: 'Open chat' }).click()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: /New conversation/ }).first().click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('ASTM A106')
  await expect(page.locator('[aria-live="polite"]')).toContainText('synthetic-pms.pdf')
})
