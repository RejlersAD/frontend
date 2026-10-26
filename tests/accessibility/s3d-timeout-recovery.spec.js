import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

for (const status of ['processing', 'completed', 'missing']) {
  test(`uncertain upload response recovers ${status} without replaying POST`, async ({ page }) => {
    const file = { name: 'PMS.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF synthetic browser fixture') };
    let uploads = 0, ownLookups = 0;
    const job = () => ({ id: 'accepted-job', status, progress_percent: 20,
      current_phase: 'Reading accepted document', created_at: new Date().toISOString(),
      document_meta: { original_filename: file.name, file_size_bytes: file.buffer.length } });
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/paper-spec/upload/')) { uploads += 1; return route.abort('timedout'); }
      if (url.pathname.endsWith('/paper-spec/jobs/')) {
        expect(url.searchParams.get('mine')).toBe('1'); ownLookups += 1;
        return route.fulfill({ json: status === 'missing' ? [] : [job()] });
      }
      if (url.pathname.endsWith('/paper-spec/jobs/accepted-job/')) return route.fulfill({ json: job() });
      return route.fulfill({ json: {} });
    });
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles(file);
    await page.getByRole('button', { name: 'Extract database', exact: true }).click();
    if (status === 'processing') {
      await expect(page.getByRole('button', { name: 'Cancel extraction' })).toBeVisible();
      await expect(page.getByTestId('location')).toContainText('screen=upload&job=accepted-job');
    } else if (status === 'completed') {
      await expect(page.getByTestId('location')).toContainText('screen=preview&job=accepted-job');
    } else {
      await expect(page.getByRole('alert')).toContainText('Check History logs before retrying');
      await expect(page.locator('.s3db-file-row')).toContainText(file.name);
    }
    expect(uploads).toBe(1); expect(ownLookups).toBe(1);
  });
}
