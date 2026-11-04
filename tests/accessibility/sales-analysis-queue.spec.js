import { test, expect } from '@playwright/test';

test('queued analysis with omitted counters stays numeric and refresh retries dispatch', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/v1/sales/deals/synthetic-tender/analysis/**', route => {
    if (route.request().method() === 'POST') requests++;
    return route.fulfill({ json: { opportunity_id: 'synthetic-tender', status: 'queued',
      stale: false, counts: { total: 3 }, result: {} } });
  });
  await page.goto('/tests/fixtures/sales-tender-facts.html');
  await expect(page.getByText('Analysis queued', { exact: true })).toBeVisible();
  await expect(page.locator('.soa-progress-pct')).toHaveText('0%');
  await expect(page.locator('.soa-progress-detail')).toContainText('0 of 3 sources processed');
  await expect(page.locator('.soa-progress-fill')).toHaveAttribute('style', 'width: 0%;');
  await expect(page.locator('body')).not.toContainText('NaN%');
  await expect(page.locator('body')).not.toContainText('undefined');
  await page.getByRole('button', { name: 'Refresh briefing', exact: true }).click();
  await expect.poll(() => requests).toBe(1);
});

test('status failures are visible instead of silently leaving an old queue status', async ({ page }) => {
  await page.route('**/api/v1/sales/deals/synthetic-tender/analysis/**', route =>
    route.fulfill({ status: 503, json: { detail: 'Unavailable' } }));
  await page.goto('/tests/fixtures/sales-tender-facts.html');
  await expect(page.getByRole('alert')).toContainText('Analysis status could not be loaded');
});
