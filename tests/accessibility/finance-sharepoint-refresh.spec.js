import { test, expect } from '@playwright/test';

async function openFinance(page, { outcome = 'synchronized', canRefresh = true, holdPost = false } = {}) {
  await page.clock.install({ time: new Date('2026-10-19T08:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-19T08:00:01Z'));
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-finance-refresh-test'));
  const state = { outcome, amount: '10.00', checked: '2026-10-19T07:30:00Z', published: '2026-10-19T07:00:00Z', status: 'idle', reads: [], posts: 0, statusReads: 0, unexpected: [], errors: [] };
  const pending = holdPost ? new Promise(resolve => { state.releasePost = resolve; }) : Promise.resolve();
  const sync = () => ({ status: state.status, last_checked_at: state.checked, last_attempt_at: state.checked, snapshot_id: 7, snapshot_published_at: state.published, can_refresh: canRefresh });
  page.on('pageerror', error => state.errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/v1/finance/dashboard/receivables/refresh/') {
      if (request.method() === 'GET') { state.statusReads += 1; return reply(sync()); }
      if (request.method() !== 'POST') { state.unexpected.push(request.method()); return reply({}, 405); }
      state.posts += 1;
      await pending;
      if (state.outcome === 'denied') { state.denied = true; return reply({ detail: 'Finance access was revoked.' }, 403); }
      if (state.outcome === 'failed') { state.status = 'failed'; return reply({ detail: 'Workbook validation failed.', sync: sync() }, 502); }
      if (state.outcome === 'busy') { state.status = 'syncing'; return reply({ status: 'busy', sync: sync() }); }
      state.checked = '2026-10-19T08:00:00Z';
      if (state.outcome === 'synchronized') { state.amount = '20.00'; state.published = '2026-10-19T08:00:00Z'; }
      return reply({ status: state.outcome, sync: sync() });
    }
    if (request.method() !== 'GET') { state.unexpected.push(request.method()); return reply({}, 405); }
    if (url.pathname === '/api/v1/finance/dashboard/receivables/') {
      state.reads.push(Object.fromEntries(url.searchParams));
      if (state.denied) return reply({ detail: 'Finance access was revoked.' }, 403);
      return reply({ schema_version: '1.0', currency: 'AED', as_of_date: '2026-10-19', source_updated_at: state.published,
        sharepoint_sync: sync(), sources: { receivables: { status: 'available', mode: 'workbook' }, payables: { status: 'restricted' } },
        kpis: Object.fromEntries(['unpaid', 'overdue', 'over30', 'over60', 'over90'].map(key => [key, { amount: state.amount, count: 1 }])),
        customers: [], filters: { currencies: ['AED'], companies: ['Synthetic customer'] }, workbook_summary: { status: 'unavailable', reason: 'Synthetic test' } });
    }
    if (url.pathname === '/api/v1/finance/dashboard/customer-invoices/') return reply({ schema_version: '1.0', rows: [], source: { status: 'available', mode: 'workbook' }, pagination: { count: 0, page: 1, page_size: 8, total_pages: 1 }, totals: {}, currency: 'AED' });
    state.unexpected.push(url.pathname); return reply({}, 404);
  });
  await page.route('**/finance', async route => {
    const response = await route.fetch({ url: new URL('/tests/fixtures/receivables-workbook-upload.html', route.request().url()).href });
    await route.fulfill({ response });
  });
  await page.goto('/finance', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 10');
  return state;
}

async function refresh(page) {
  await page.getByLabel('More dashboard options').click();
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
}

async function filters(page) {
  await page.getByRole('combobox', { name: 'Customer', exact: true }).selectOption('Synthetic customer');
  await expect(page.locator('.ar-dashboard')).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('combobox', { name: 'Period', exact: true }).selectOption('6');
  await expect(page.locator('.ar-dashboard')).toHaveAttribute('aria-busy', 'false');
}

test('Refresh data checks the workbook before reloading SQL values and retains filters', async ({ page }) => {
  const state = await openFinance(page, { holdPost: true });
  await filters(page);
  const reads = state.reads.length;
  await refresh(page);
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('Checking SharePoint workbook');
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 10');
  expect(state.reads.length).toBe(reads);
  await page.getByLabel('More dashboard options').click();
  await expect(page.getByRole('button', { name: 'Checking workbook' })).toBeDisabled();
  state.releasePost();
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 20');
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('Workbook changes were published');
  expect(state.posts).toBe(1);
  expect(state.reads.at(-1)).toMatchObject({ company: 'Synthetic customer', months: '6' });
  expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
  await page.getByLabel('More dashboard options').click();
  await page.screenshot({ path: test.info().outputPath('finance-refresh-desktop.png') });
});

test('An unchanged check advances Last checked without changing Snapshot published', async ({ page }) => {
  const state = await openFinance(page, { outcome: 'unchanged' });
  const publication = await page.getByTestId('finance-snapshot-published').textContent();
  const checked = await page.getByTestId('finance-workbook-checked').textContent();
  await refresh(page);
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('No changes were found');
  await expect(page.locator('.ar-dashboard')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByTestId('finance-workbook-checked')).not.toHaveText(checked);
  await expect(page.getByTestId('finance-snapshot-published')).toHaveText(publication);
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 10');
  expect(state.posts).toBe(1);
});

test('A failed import keeps validated values and filters with an explicit error', async ({ page }) => {
  const state = await openFinance(page, { outcome: 'failed' });
  await filters(page);
  const checked = await page.getByTestId('finance-workbook-checked').textContent();
  const publication = await page.getByTestId('finance-snapshot-published').textContent();
  await refresh(page);
  await expect(page.getByTestId('finance-sync-feedback')).toHaveAttribute('role', 'alert');
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('Workbook validation failed');
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 10');
  await expect(page.getByTestId('finance-workbook-checked')).toHaveText(checked);
  await expect(page.getByTestId('finance-snapshot-published')).toHaveText(publication);
  await expect(page.getByRole('combobox', { name: 'Customer', exact: true })).toHaveValue('Synthetic customer');
  await expect(page.getByRole('combobox', { name: 'Period', exact: true })).toHaveValue('6');
  expect(state.posts).toBe(1);
});

test('An existing refresh uses status GETs and reloads only after completion', async ({ page }) => {
  const state = await openFinance(page, { outcome: 'busy' });
  await refresh(page);
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('already in progress');
  await page.clock.fastForward(2000);
  await expect.poll(() => state.statusReads).toBe(1);
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 10');
  state.status = 'idle'; state.amount = '30.00'; state.checked = '2026-10-19T08:01:00Z'; state.published = state.checked;
  await page.clock.fastForward(2000);
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 30');
  expect(state.posts).toBe(1); expect(state.statusReads).toBe(2);
});

test('Busy status polling stops after two minutes and leaves published values visible', async ({ page }) => {
  const state = await openFinance(page, { outcome: 'busy' });
  await refresh(page);
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('already in progress');
  await page.clock.fastForward(120000);
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('still running');
  const reads = state.statusReads;
  await page.clock.fastForward(10000);
  expect(state.statusReads).toBe(reads);
  expect(state.posts).toBe(1);
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 10');
});

test('Read-only users refresh the SQL view without starting a workbook import', async ({ page }) => {
  const state = await openFinance(page, { canRefresh: false });
  const reads = state.reads.length;
  await refresh(page);
  await expect.poll(() => state.reads.length).toBe(reads + 1);
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('do not have access to check the workbook');
  expect(state.posts).toBe(0); expect(state.statusReads).toBe(0);
});

test('The five-minute browser timer reads SQL without starting an import', async ({ page }) => {
  const state = await openFinance(page);
  await filters(page);
  const reads = state.reads.length;
  state.amount = '40.00';
  await page.clock.fastForward(300000);
  await expect(page.getByTestId('finance-kpi-unpaid')).toContainText('AED 40');
  expect(state.reads.length).toBe(reads + 1);
  expect(state.reads.at(-1)).toMatchObject({ company: 'Synthetic customer', months: '6' });
  expect(state.posts).toBe(0); expect(state.statusReads).toBe(0);
});

test('Revoked access during manual refresh rechecks the dashboard and clears protected values', async ({ page }) => {
  const state = await openFinance(page, { outcome: 'denied' });
  await filters(page);
  await refresh(page);
  await expect(page.getByText('Finance access was revoked.', { exact: true })).toBeVisible();
  await expect(page.getByTestId('finance-kpi-unpaid')).not.toContainText('AED 10');
  await expect(page.getByTestId('finance-sync-feedback')).toContainText('verify access');
  await expect(page.getByRole('combobox', { name: 'Customer', exact: true })).toHaveValue('Synthetic customer');
  expect(state.posts).toBe(1);
});
