import { test, expect } from '@playwright/test'
import { Buffer } from 'node:buffer'

const retiredKey = 'synthetic-retired-secret-do-not-send'
const capabilities = ready => ({ providers: ['openai', 'anthropic', 'gemini'].map(provider => ({ provider, managed: true, enabled: ready, ready, model: '' })) })
async function prepare(page, { ready = true, failure = false, checks = false } = {}) {
  const requests = [], unexpected = []
  const status = { ready, failure }
  await page.addInitScript(key => {
    localStorage.setItem('radai_access_token', 'ordinary-user-test-token')
    sessionStorage.setItem('radai_pidv2_byok_apikey', key)
    sessionStorage.setItem('radai_pidv2_byok_apikey::project-one', key)
  }, retiredKey)
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.includes('/api/')) {
      requests.push({ path: url.pathname, method: request.method(), data: request.postData() || '' })
      if (url.pathname.endsWith('/rbac/ai-provider-status/')) return route.fulfill({ status: status.failure ? 503 : 200, json: status.failure ? { detail: 'Unavailable' } : capabilities(status.ready) })
      if (url.pathname.endsWith('/pid-verification/projects/')) return route.fulfill({ json: [{ project_id: 'project-one', project_name: 'Central AI test project', description: 'Synthetic source', document_count: 0, created_at: '2026-09-30T00:00:00Z' }] })
      if (url.pathname.endsWith('/extract-line-tags/')) return route.fulfill({ json: { tags: [], summary: { total_tags: 0 }, filename: 'source.pdf' } })
      if (url.pathname.endsWith('/cross-check/')) return route.fulfill({ json: { findings: [], summary: { match: 1 } } })
      if (request.method() === 'GET' && (url.pathname.includes('/pid-checker-v2/') || url.pathname.includes('/pid-verification/'))) return route.fulfill({ json: [] })
      unexpected.push(`${request.method()} ${url.pathname}`)
      return route.fulfill({ status: 404, json: { detail: 'Unexpected test request' } })
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { unexpected.push(url.origin); return route.abort() }
    return route.continue()
  })
  await page.goto(`/tests/fixtures/central-ai-extraction.html${checks ? '?checks=true' : ''}`)
  if (!checks) {
    await page.getByRole('heading', { name: 'Central AI test project' }).click()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'source.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% synthetic source\n%%EOF') })
  }
  return { requests, unexpected, status }
}

test('ordinary user extracts in selected AI mode without entering or transmitting a key', async ({ page }) => {
  const state = await prepare(page)
  await page.getByRole('button', { name: 'AI Vision', exact: true }).click()
  await page.locator('select').filter({ has: page.locator('option[value="claude"]') }).selectOption('claude')
  await expect(page.getByRole('button', { name: 'Analyse P&ID', exact: true })).toBeEnabled()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Analyse P&ID', exact: true }).click()
  await expect.poll(() => state.requests.filter(row => row.path.endsWith('/extract-line-tags/')).length).toBe(1)
  const sent = state.requests.find(row => row.path.endsWith('/extract-line-tags/')).data
  expect(sent).toContain('claude')
  expect(sent).toContain('vision')
  expect(sent).not.toContain('name="api_key"')
  expect(sent).not.toContain(retiredKey)
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage }))).not.toContain(retiredKey)
  expect(state.unexpected).toEqual([])
})

test('disabled central provider blocks AI and preserves explicit offline extraction', async ({ page }) => {
  const state = await prepare(page, { ready: false })
  await page.getByRole('button', { name: 'AI Vision', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Analyse P&ID', exact: true })).toBeDisabled()
  await expect(page.getByText('This AI provider is unavailable.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: /OCR/ }).first().click()
  await expect(page.getByRole('button', { name: 'Analyse P&ID', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Analyse P&ID', exact: true }).click()
  await expect.poll(() => state.requests.filter(row => row.path.endsWith('/extract-line-tags/')).length).toBe(1)
  expect(state.requests.find(row => row.path.endsWith('/extract-line-tags/')).data).not.toContain(retiredKey)
})

test('unavailable readiness never treats a stored browser key as active AI configuration', async ({ page }) => {
  const state = await prepare(page, { failure: true })
  await page.getByRole('button', { name: 'AI Vision', exact: true }).click()
  await expect(page.getByText('AI configuration could not be checked.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Analyse P&ID', exact: true })).toBeDisabled()
  expect(state.requests.filter(row => row.method === 'POST')).toEqual([])
})

test('AI cross-check uses central provider readiness without sending a credential', async ({ page }) => {
  const state = await prepare(page, { checks: true })
  await page.getByRole('button', { name: /Run Cross|Cross.check|Run comparison/i }).last().click()
  await expect.poll(() => state.requests.filter(row => row.path.endsWith('/cross-check/')).length).toBe(1)
  const sent = JSON.parse(state.requests.find(row => row.path.endsWith('/cross-check/')).data)
  expect(sent).toMatchObject({ use_ai: true, vision_provider: 'claude', project_id: 'project-one' })
  expect(sent).not.toHaveProperty('vision_api_key')
  expect(state.unexpected).toEqual([])
})

test('refresh after administrator activation updates both button and extraction guard', async ({ page }) => {
  const state = await prepare(page, { ready: false })
  await page.getByRole('button', { name: 'AI Vision', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Analyse P&ID', exact: true })).toBeDisabled()
  state.status.ready = true
  await page.getByRole('button', { name: 'Refresh AI status', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Analyse P&ID', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Analyse P&ID', exact: true }).click()
  await expect.poll(() => state.requests.filter(row => row.path.endsWith('/extract-line-tags/')).length).toBe(1)
})
