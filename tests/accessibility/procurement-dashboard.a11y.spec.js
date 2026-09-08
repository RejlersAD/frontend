import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const testEmail = process.env.PW_TEST_EMAIL
const testPassword = process.env.PW_TEST_PASSWORD
const hasTestCredentials = Boolean(testEmail && testPassword)

async function signIn(page) {
  await page.goto('/login')
  await page.locator('#login-email').fill(testEmail)
  await page.locator('#login-password').fill(testPassword)
  await page.getByRole('button', { name: /log in|login|sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 })
}

test('protected procurement dashboard returns unauthenticated users to sign-in', async ({ page }) => {
  await page.goto('/procurement')
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
})

test.describe('authenticated procurement command centre', () => {
  test.skip(!hasTestCredentials, 'Set PW_TEST_EMAIL and PW_TEST_PASSWORD for authenticated Procurement checks.')

  test.beforeEach(async ({ page }) => { await signIn(page) })

  test('supports keyboard operation and WCAG 2.2 AA', async ({ page }) => {
    await page.goto('/procurement')
    await expect(page.getByRole('heading', { name: 'Procurement Overview' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Action required' })).toBeVisible()
    await expect(page.getByRole('table', { name: /recent procurement approvals/i })).toBeVisible()

    await page.getByRole('button', { name: /metric definitions and reporting controls/i }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(/controlled definitions/i)).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const blocking = results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')
    expect(blocking).toEqual([])
  })

  test('keeps controls usable at 320 CSS pixels', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await page.goto('/procurement')
    await page.getByRole('button', { name: /current portfolio/i }).click()
    await expect(page.getByLabel('Dashboard reporting scope')).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  })
})
