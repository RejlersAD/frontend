import { test, expect } from '@playwright/test';

test('Existing analysis layout presents Rejlers evidence without new dashboard cards', async ({ page }) => {
  const dimensions = [
    ['strategic_fit', 'Strategic fit', null],
    ['engineering_capability', 'Engineering capability match', 30],
    ['qualification_compliance', 'Qualification compliance', 20],
    ['resource_availability', 'Resource availability', 15],
    ['commercial_attractiveness', 'Commercial attractiveness', 15],
    ['contract_risk', 'Contract risk', null],
    ['delivery_feasibility', 'Delivery feasibility', null],
    ['win_probability', 'Win probability', 10],
    ['strategic_value', 'Strategic value', 10],
  ].map(([key, title, weight]) => ({ key, title, weight, assessment: 'unknown', score: null,
    evidence_found: 1, evidence_total: 2, items: [{ key: 'required', label: 'Tender requirement',
      evidence: [{ text: 'Provide FEED and detailed engineering services.', source_file: 'Synthetic SOW.pdf',
        source_page: 'Page 8', source_id: 'synthetic' }] },
    { key: 'missing', label: 'Other requirement', evidence: [] }] }));
  await page.route('**/api/v1/sales/deals/synthetic-tender/analysis/**', (route) => route.fulfill({ json: {
    opportunity_id: 'synthetic-tender', status: 'ready', result: { manager_review: { tender_evaluation: {
      opportunity_summary: { project_facts: {}, project_name: 'Synthetic engineering project' },
      decision: { recommendation: 'INSUFFICIENT_EVIDENCE' },
      rejlers_review: { dimensions, weighted_score: null, missing_internal: ['Approved capability inventory'] },
      evidence_coverage: [],
    } } },
  } }));
  await page.goto('/tests/fixtures/sales-tender-facts.html');
  await expect(page.getByRole('heading', { name: 'INSUFFICIENT EVIDENCE', exact: true })).toBeVisible();
  const assessment = page.getByRole('heading', { name: 'Comprehensive Assessment' }).locator('..');
  await expect(assessment).toBeVisible();
  await expect(assessment).toContainText('Provide FEED and detailed engineering services.');
  await expect(assessment).toContainText('Synthetic SOW.pdf, Page 8');
  await expect(assessment).toContainText("Rejlers' engineering consulting and EPCM delivery model");
  await expect(page.locator('.soa-ref-driver-card')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Rejlers Go / No-Go dashboard' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Source coverage gaps' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tender evidence checklist' })).toHaveCount(0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(assessment).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
