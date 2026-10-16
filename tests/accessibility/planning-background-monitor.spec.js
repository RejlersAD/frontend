import { expect, test } from '@playwright/test'

const mount = async (page, setup = {}) => {
  await page.addInitScript(value => { window.monitorSetup = value }, setup)
  await page.goto('/tests/fixtures/planning-background-monitor.html')
  await expect(page.locator('output')).toContainText('"projectId":117')
  await expect(page.locator('output')).toContainText('"savedRunId":51')
}
test('idle master entry loads only project, active-job and latest-run summaries', async ({ page }) => {
  await mount(page)
  const calls = await page.evaluate(() => window.backgroundMonitor.calls)
  expect(calls.map(call => call.url)).toEqual(expect.arrayContaining([
    '/planning-intelligence/projects/', '/planning-intelligence/jobs/active/', '/planning-intelligence/intelligence-runs/latest/',
  ]))
  expect(calls).toHaveLength(3)
  expect(await page.evaluate(() => window.backgroundMonitor.completed)).toHaveLength(0)
})
test('running analysis uses compact progress and transfers its exact completed payload once', async ({ page }) => {
  await mount(page, { active: true })
  await page.evaluate(() => window.backgroundMonitor.finish())
  await expect.poll(() => page.evaluate(() => window.backgroundMonitor.completed.length)).toBe(1)
  const result = await page.evaluate(() => window.backgroundMonitor)
  expect(result.completed[0].result_data.intelligence.document_intelligence_run_id).toBe(51)
  expect(result.calls.filter(call => call.url.endsWith('/jobs/88/'))).toHaveLength(1)
  expect(result.calls.filter(call => call.url.endsWith('/jobs/88/progress/')).length).toBeGreaterThan(0)
  expect(result.calls.some(call => /\/(files|generations|ai-settings|intelligence-facts|intelligence-conflicts)\//.test(call.url))).toBe(false)
})
test('switching projects resets background scope without loading the editing page', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => window.backgroundMonitor.setProject(23))
  await expect(page.locator('output')).toContainText('"projectId":123')
  await expect.poll(() => page.evaluate(() => window.backgroundMonitor.calls.filter(call => call.url.endsWith('/jobs/active/')).map(call => call.params.project))).toEqual([117, 123])
  expect(await page.evaluate(() => window.backgroundMonitor.completed)).toHaveLength(0)
})
