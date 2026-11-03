import { test, expect } from '@playwright/test'
import { prepare, message, paginated, opportunityDetails } from '../fixtures/sales-email-api-fixture.js'

const saved = () => ({
  ...message({ id: 'archive-review', subject: 'RADAI-TEST RFQ SOURCE-123' }),
  ...opportunityDetails(), id: 'archive-review', subject: 'RADAI-TEST RFQ SOURCE-123',
  source_message_id: `onedrive-test:${'a'.repeat(64)}`, status: 'received',
  extracted_information: {
    classification: {
      version: 1, status: 'classified', code: 'rfq', needs_review: true,
      confidence: { level: 'high', method: 'rule_evidence_v1', reason: 'Explicit RFQ' },
      evidence: [], alternatives: [],
    },
    warnings: [], analysis: { version: 1, key_points: [], sources: [], coverage: { status: 'saved_content' } },
  },
})

test('archive match is read-only until classification and explicit link confirmation', async ({ page }) => {
  const record = saved()
  const path = '/api/v1/sales/email-intakes/archive-review/link-opportunity/'
  const state = await prepare(page, {
    view: 'imported', imported: paginated([record]), allowConversion: true, allowedConversionPath: path,
    conversionHandler: async ({ request }) => {
      expect(request.postDataJSON()).toMatchObject({
        opportunity: 'existing-one', source_token: 'synthetic-source-token-1',
        classification_code: 'rfq', classification_confirmed: true,
      })
      Object.assign(state.imported.results[0], { status: 'converted', opportunity: 'existing-one' })
      return { status: 200, body: state.imported.results[0] }
    },
  })
  await page.route('**/opportunity-matches/', route => route.fulfill({
    json: { state: 'unique_match', matches: [{ id: 'existing-one', code: 'Q-102101', title: 'Existing tender' }] },
  }))
  const panel = page.getByRole('region', { name: 'Existing opportunity match' })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Check existing opportunity' }).click()
  await expect(panel.getByText('Q-102101 - Existing tender')).toBeVisible()
  const confirmLink = panel.getByRole('button', { name: 'Confirm link to this opportunity' })
  await expect(confirmLink).toBeDisabled()
  expect(state.requests.filter(row => row.method === 'POST')).toHaveLength(0)
  await page.getByRole('button', { name: 'Confirm classification', exact: true }).click()
  await expect(confirmLink).toBeEnabled()
  await confirmLink.click()
  await expect(panel).toHaveCount(0)
  expect(state.requests.filter(row => row.method === 'POST')).toHaveLength(1)
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})

test('ambiguous and unavailable matches stay reviewable without writes', async ({ page }) => {
  const state = await prepare(page, { view: 'imported', imported: paginated([saved()]) })
  let failed = false
  await page.route('**/opportunity-matches/', route => route.fulfill({
    status: failed ? 403 : 200,
    json: failed ? { detail: 'Matching access revoked.' } : { state: 'requires_review', matches: [] },
  }))
  const panel = page.getByRole('region', { name: 'Existing opportunity match' })
  await panel.getByRole('button', { name: 'Check existing opportunity' }).click()
  await expect(panel.getByRole('status')).toContainText('No unique exact')
  failed = true
  await panel.getByRole('button', { name: 'Check existing opportunity' }).click()
  await expect(panel.getByRole('status')).toContainText('Matching access revoked.')
  expect(state.requests.filter(row => row.method === 'POST')).toHaveLength(0)
})

test('archive matching remains keyboard accessible at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await prepare(page, { view: 'imported', imported: paginated([saved()]) })
  await page.route('**/opportunity-matches/', route => route.fulfill({
    json: { state: 'requires_review', matches: [] },
  }))
  const check = page.getByRole('button', { name: 'Check existing opportunity' })
  await expect(check).toBeEnabled()
  await check.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Existing opportunity match' }).getByRole('status')).toContainText('No unique exact')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
