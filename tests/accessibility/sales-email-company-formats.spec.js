import { test, expect } from '@playwright/test'
import { prepare, message, listing, paginated, opportunityDetails } from '../fixtures/sales-email-api-fixture.js'

const sourceId = 'synthetic-company-source'
const subject = 'RFQ for synthetic engineering'
const information = () => ({
  detection_version: 2, title: subject, tender_reference: '',
  organization_reference: 'TEN/REF/2026/123', document_reference: 'TEN-PRJ-001-MEC-DS-0001',
  project_name: 'Synthetic Gas Upgrade', estimated_value: '125000.50', currency: 'USD',
  due_date: '2026-11-20',
  evidence: {
    organization_reference: 'Technip Energies Reference: TEN/REF/2026/123',
    document_reference: 'Document No.: TEN-PRJ-001-MEC-DS-0001',
    due_date: 'Bid Submission Date: 20 November 2026',
    currency: 'Estimated project value: USD 125,000.50',
  },
  field_sources: {
    organization_reference: [sourceId], document_reference: [sourceId],
    due_date: [sourceId], currency: [sourceId],
  },
  classification: {
    version: 1, status: 'classified', code: 'rfq', needs_review: true, evidence: [], alternatives: [],
    confidence: { level: 'high', method: 'rule_evidence_v1', reason: 'Explicit RFQ label.' },
  },
  analysis: {
    version: 1, key_points: [], sources: [{ id: sourceId, origin: 'message', direction: 'incoming', is_selected: true }],
    coverage: { status: 'saved_content' },
  },
})
const review = page => page.getByRole('complementary', { name: 'Email review', exact: true })

async function setup(page, saved, changes = {}) {
  const info = { ...information(), ...changes }
  const record = {
    ...message({ id: 'company-example', subject }), ...opportunityDetails({ subject, extracted_information: info }),
    id: 'company-example', status: 'received',
  }
  const state = await prepare(page, saved
    ? { view: 'imported', imported: paginated([record]) }
    : { messages: listing([message({ subject })]), details: opportunityDetails({ subject, extracted_information: info }) })
  await expect(review(page).getByRole('button', { name: 'Confirm classification', exact: true })).toBeEnabled()
  return state
}

for (const saved of [false, true]) {
  test(`${saved ? 'saved' : 'live'} typed company references are visible but never become tender form defaults`, async ({ page }) => {
    const state = await setup(page, saved)
    const details = review(page).getByRole('region', { name: 'Opportunity Details Detected', exact: true })
    await expect(details).toContainText('TEN/REF/2026/123')
    await expect(details).toContainText('TEN-PRJ-001-MEC-DS-0001')
    await expect(details).toContainText('Requires review')
    await page.getByRole('tab', { name: 'Extracted details', exact: true }).click()
    const extracted = page.getByRole('region', { name: 'Detected information', exact: true })
    await expect(extracted).toContainText('TEN/REF/2026/123')
    await expect(extracted).toContainText('TEN-PRJ-001-MEC-DS-0001')
    await review(page).getByRole('button', { name: 'Confirm classification', exact: true }).click()
    await review(page).getByRole('button', { name: 'Create opportunity', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Create opportunity from email', exact: true })
    await expect(form.getByLabel('Client reference', { exact: true })).toHaveValue('')
    await expect(form.getByLabel('Proposal deadline', { exact: true })).toHaveValue('2026-11-20')
    await expect(form.getByLabel('Estimated value', { exact: true })).toHaveValue('125000.50')
    await expect(form.getByLabel('Currency', { exact: true })).toHaveValue('USD')
    expect(state.requests.every(row => row.method === 'GET')).toBe(true)
    expect(state.errors).toEqual([])
  })
}

test('unsupported reference source IDs are not promoted into the summary', async ({ page }) => {
  const state = await setup(page, true, {
    field_sources: { organization_reference: ['missing'], document_reference: ['missing'] },
  })
  const details = review(page).getByRole('region', { name: 'Opportunity Details Detected', exact: true })
  await expect(details).not.toContainText('TEN/REF/2026/123')
  await expect(details).not.toContainText('TEN-PRJ-001-MEC-DS-0001')
  expect(state.requests.every(row => row.method === 'GET')).toBe(true)
})

test('typed reference cards fit a narrow screen without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await setup(page, true)
  await expect(review(page).getByRole('region', { name: 'Opportunity Details Detected', exact: true })).toContainText('TEN-PRJ-001-MEC-DS-0001')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
