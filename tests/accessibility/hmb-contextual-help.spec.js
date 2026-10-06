import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('HMB guidance is a searchable Engineering Help knowledge base', async ({ page }) => {
  await page.goto('/tests/fixtures/hmb-contextual-help.html')
  await page.getByRole('button', { name: 'Open Engineering help' }).click()

  const drawer = page.getByRole('dialog', { name: 'Engineering Help' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByLabel('Search knowledge base')).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'HMB Extractor workflow' })).toHaveAttribute('aria-current', 'page')
  await expect(drawer).toContainText('Analyse case files')
  await expect(drawer).toContainText('analysis alone does not import records')

  await drawer.getByLabel('Search knowledge base').fill('PDF')
  await drawer.getByRole('button', { name: 'Supported HMB file formats' }).click()
  await expect(drawer).toContainText('PDF is accepted for case intake')

  const results = await new AxeBuilder({ page }).include('#contextual-help-drawer').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations).toEqual([])
})

test('Engineering Help closes with Escape and restores focus', async ({ page }) => {
  await page.goto('/tests/fixtures/hmb-contextual-help.html')
  const trigger = page.getByRole('button', { name: 'Open Engineering help' })
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Engineering Help' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Engineering Help' })).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
