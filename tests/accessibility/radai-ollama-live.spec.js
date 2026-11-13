import { readFileSync } from 'node:fs'
import process from 'node:process'
import { test, expect } from '@playwright/test'

const statePath = process.env.RADAI_OLLAMA_PILOT_STATE_FILE
test.skip(!statePath, 'Run only with a disposable Django database and local Ollama pilot token.')
test.setTimeout(720000)

test('real general and project-grounded Ollama responses appear and persist in RADAI Intelligence', async ({ page }) => {
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  await page.addInitScript(token => {
    localStorage.setItem('radai_access_token', token)
    localStorage.setItem('radai_user_data', JSON.stringify({ id: 1, first_name: 'Local', last_name: 'Pilot' }))
  }, state.token)
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  await expect(page.getByRole('combobox', { name: 'Chat model' })).toContainText('Qwen3 8B', { timeout: 120000 })
  await expect(page.getByRole('combobox', { name: 'Chat model' })).toHaveValue('qwen3:8b')
  await page.getByPlaceholder('Message RADAI Intelligence').fill('/no_think Answer briefly: what is the capital of France?')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('Paris', { timeout: 300000 })
  await expect(page.locator('[aria-live="polite"]')).not.toContainText('synthetic-pms.pdf')
  await page.getByRole('button', { name: 'Add files or actions' }).click()
  await page.getByRole('menuitem', { name: 'Add to project' }).click()
  await page.getByRole('menuitem', { name: 'Local Ollama pilot' }).click()
  await page.getByPlaceholder('Message RADAI Intelligence').fill('/no_think In one short sentence, what material is specified for component P-101? Cite the source page.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('ASTM A106', { timeout: 300000 })
  await expect(page.locator('[aria-live="polite"]')).toContainText('synthetic-pms.pdf')
  await page.reload({ waitUntil: 'commit' })
  await expect(page.getByRole('button', { name: 'Local Ollama pilot' })).toBeVisible({ timeout: 60000 })
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: /New conversation/ }).first().click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('Paris')
  await page.getByRole('button', { name: 'Local Ollama pilot' }).click()
  await page.getByRole('button', { name: 'Open chat' }).click()
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: /New conversation/ }).first().click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('ASTM A106')
})
