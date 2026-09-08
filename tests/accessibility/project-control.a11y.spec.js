import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const testEmail = process.env.PW_TEST_EMAIL
const testPassword = process.env.PW_TEST_PASSWORD
const hasTestCredentials = Boolean(testEmail && testPassword)
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

function describeViolations(violations) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .flatMap((node) => node.target)
        .slice(0, 5)
        .join(', ')
      return `${violation.impact}: ${violation.id} - ${violation.help} (${targets})`
    })
    .join('\n')
}

async function expectNoBlockingAxeViolations(page, context) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  const blocking = results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious')

  expect(blocking, `${context} has blocking WCAG violations:\n${describeViolations(blocking)}`).toEqual([])
}

async function signIn(page) {
  await page.goto('/login')
  await page.locator('#login-email').fill(testEmail)
  await page.locator('#login-password').fill(testPassword)
  await page.getByRole('button', { name: /log in|login|sign in/i }).click()
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 })
}

test('login is keyboard reachable and has no blocking WCAG violations', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /user login/i })).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).not.toHaveCount(0)
  await expectNoBlockingAxeViolations(page, 'Login')
})

test('login reflows without page-level horizontal overflow at 320 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/login')

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth, 'Login must not create page-level horizontal scrolling').toBeLessThanOrEqual(dimensions.clientWidth)
  await expectNoBlockingAxeViolations(page, 'Login at 320 CSS pixels')
})

test('protected Project Control routes return unauthenticated users to sign-in', async ({ page }) => {
  await page.goto('/projects')
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(page.getByRole('heading', { name: /user login/i })).toBeVisible()
})

test.describe('authenticated Project Control journeys', () => {
  test.skip(!hasTestCredentials, 'Set PW_TEST_EMAIL and PW_TEST_PASSWORD for authenticated Project Control checks.')

  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  test('opens an authorised project and reviews project health', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: /project performance|project portfolio/i })).toBeVisible()
    await expect(page.getByLabel(/active project/i)).toBeVisible()
    await expectNoBlockingAxeViolations(page, 'Project Control overview')
  })

  test('opens the embedded five-stage planning workflow', async ({ page }) => {
    await page.goto('/projects')
    const selector = page.getByLabel(/active project/i)
    const pilotOption = selector.locator('option').filter({ hasText: '5900913' })
    if (await pilotOption.count()) {
      await selector.selectOption(await pilotOption.first().getAttribute('value'))
    }

    await page.getByRole('button', { name: /plan & baseline/i }).click()
    await expect(page.getByText(/linked planning workspace/i)).toBeVisible()
    for (const stage of ['Setup', 'Collect Inputs', 'Build Plan', 'Validate & Approve', 'Publish Baseline']) {
      await expect(page.getByText(stage, { exact: true }).first()).toBeVisible()
    }
    await expectNoBlockingAxeViolations(page, 'Plan & Baseline')
  })
})
