import { readFileSync } from 'node:fs'
import process from 'node:process'
import { test, expect } from '@playwright/test'

const statePath = process.env.RADAI_SOW_PILOT_STATE_FILE
const pdfPath = process.env.RADAI_SOW_PDF_PATH
const disposableProxy = process.env.RADAI_SOW_DISPOSABLE_PROXY === '1'

test.skip(!statePath || !pdfPath || !disposableProxy,
  'Requires a Vite server configured to proxy only to disposable Django, pilot state, and the real SOW.pdf.')
test.setTimeout(360000)

test('real SOW upload, cited local answer, persistence, and compact composer', async ({ page }) => {
  const state = JSON.parse(readFileSync(statePath, 'utf8'))
  await page.addInitScript(auth => {
    localStorage.setItem('radai_access_token', auth.token)
    localStorage.setItem('radai_user_data', JSON.stringify({ id: auth.user_id, first_name: 'Local', last_name: 'Pilot' }))
  }, state)
  await page.goto('/radai-intelligence', { waitUntil: 'commit' })
  await expect(page.getByRole('combobox', { name: 'Chat model' })).toHaveValue('qwen3:8b', { timeout: 60000 })
  const composerText = await page.locator('form').first().innerText()
  expect(composerText.split(/\s+/)).not.toContain('0')
  await page.getByRole('button', { name: 'Add files or actions' }).click()
  await page.getByRole('menuitem', { name: /Upload or add files/ }).click()
  await page.locator('input[type="file"]').setInputFiles(pdfPath)
  await expect(page.getByText('SOW.pdf', { exact: true })).toBeVisible({ timeout: 15000 })
  await page.getByPlaceholder('Message RADAI Intelligence').fill('/no_think What revision is printed on page 1 of SOW.pdf? Answer in one sentence and cite the page.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('Rev. 1', { timeout: 300000 })
  await expect(page.locator('[aria-live="polite"]')).toContainText('SOW.pdf')
  await expect(page.locator('[aria-live="polite"]')).toContainText('page 1')
  await page.reload({ waitUntil: 'commit' })
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await page.getByRole('button', { name: /New conversation/ }).first().click()
  await expect(page.locator('[aria-live="polite"]')).toContainText('Rev. 1')
  await expect(page.getByRole('button', { name: 'Download SOW.pdf' })).toBeVisible()
})
