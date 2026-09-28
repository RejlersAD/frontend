import { test, expect } from '@playwright/test';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block', actionTimeout: 10000, navigationTimeout: 45000 });
const timestamp = '2026-09-28T08:00:00.123456+00:00';
const order = { id: 'synthetic-safe-errors-po', po_number: 'SYN-PO-0085_JUL2026', vendor_name: 'Synthetic supplier', status: 'sent', currency: 'USD', updated_at: timestamp };
const line = { line_id: 'line:source-1', description: 'Synthetic pipe', uom: 'EA', ordered: '5', accepted: '0', pending: '0', available: '5', remaining: '5' };
const serverFailure = 'The server could not complete the request. Please try again.';
const fallback = 'The request could not be completed. Please try again.';
const html = '<!DOCTYPE html><html><body>TypeError: SYNTHETIC_PRIVATE_DEBUG' + ' synthetic settings'.repeat(100) + '</body></html>';
const pageData = rows => ({ count: rows.length, next: null, results: rows });
const record = page => page.getByRole('button', { name: 'Record receipt', exact: true });
const quantity = page => page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe', exact: true });

async function setup(page, { stage, status = 500, validation = false }) {
  const state = { failure: true, posts: [], reads: [], errors: [], summary: { basis: 'quantity', po_updated_at: timestamp, can_record: true, can_reconcile: false, lines: [line] } };
  if (stage === 'basis') state.summary = { ...state.summary, basis: 'unavailable', basis_source: null, can_record: false, lines: [], needs_basis_review: true, can_review_basis: true };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(value => { window.handoffFixture = { order: value }; localStorage.setItem('radai_access_token', 'synthetic-token'); }, stage === 'selector' ? null : order);
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (request.method() === 'GET') state.reads.push(url.href);
    else state.posts.push({ path, data: request.postDataJSON() });
    const target = stage === 'selector' ? '/available-orders/' : stage === 'summary' ? '/receiving-summary/' : stage === 'basis' ? '/receiving-basis/' : '/receipts/';
    if (state.failure && path.endsWith(target)) {
      if (validation) await route.fulfill({ status: 400, json: { delivery_location: ['Choose a delivery location.'] } });
      else if (status === 400) await route.fulfill({ status, json: { detail: stage === 'receipt' ? 'Traceback (most recent call last): SYNTHETIC_PRIVATE_DEBUG' : html } });
      else await route.fulfill({ status, contentType: 'text/html', body: html });
      return;
    }
    let body = pageData([]);
    if (path.endsWith('/rbac/users/me/')) body = { user: { id: 'synthetic-recorder', first_name: 'Synthetic', last_name: 'Recorder' } };
    else if (path.endsWith('/available-orders/')) body = pageData([order]);
    else if (path.endsWith('/receiving-summary/')) body = state.summary;
    else if (path.endsWith(`/orders/${order.id}/`)) body = order;
    else if (path.endsWith('/receiving-basis/')) {
      const payload = request.postDataJSON();
      state.summary = { ...state.summary, basis: payload.basis, basis_source: 'reviewed_receiving', can_record: true, needs_basis_review: false, can_review_basis: false, lines: [{ ...line, line_id: 'reviewed:canonical-1' }] };
      body = state.summary;
    } else if (path.endsWith('/receipts/') && request.method() === 'POST') body = { ...request.postDataJSON(), id: 'synthetic-saved-receipt', status: 'pending' };
    await route.fulfill({ json: body });
  });
  await page.goto('/tests/fixtures/purchase-order-handoff.html?view=creator&toasts=1');
  await page.getByLabel(/^Delivery Location/).fill('Synthetic office');
  await page.getByLabel(/^Condition/).selectOption('good');
  await page.getByLabel('Delivery Note No.', { exact: true }).fill('SYN-DN-128');
  return state;
}

async function safeError(page, message) {
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByRole('alert')).toContainText(message);
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_PRIVATE_DEBUG');
  await expect(page.locator('body')).not.toContainText('<!DOCTYPE');
  await expect(page.locator('.Toastify__toast')).toHaveCount(0);
  expect((await page.getByRole('alert').innerText()).length).toBeLessThan(360);
}

for (const status of [500, 400]) test(`selector HTTP ${status} hides debug content and retains search and delivery input on retry`, async ({ page }) => {
  const state = await setup(page, { stage: 'selector', status });
  await safeError(page, status === 500 ? serverFailure : fallback);
  await page.getByLabel('Search purchase orders', { exact: true }).fill('JUL2026');
  await expect.poll(() => state.reads.some(url => new URL(url).searchParams.get('search') === 'JUL2026')).toBe(true);
  await safeError(page, status === 500 ? serverFailure : fallback);
  state.failure = false;
  await page.getByRole('button', { name: 'Retry purchase orders', exact: true }).click();
  await page.getByRole('combobox', { name: 'Purchase Order', exact: true }).selectOption(order.id);
  await expect(quantity(page)).toBeVisible();
  await expect(page.getByLabel('Search purchase orders', { exact: true })).toHaveValue('JUL2026');
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic office');
  await expect(page.getByLabel('Delivery Note No.', { exact: true })).toHaveValue('SYN-DN-128');
  expect(state.posts).toEqual([]); expect(state.errors).toEqual([]);
});

test('HTML balance failure offers explicit refresh and preserves delivery details', async ({ page }) => {
  const state = await setup(page, { stage: 'summary' });
  await safeError(page, serverFailure); await expect(record(page)).toBeDisabled();
  state.failure = false;
  await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
  await expect(quantity(page)).toBeVisible();
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic office');
  await page.getByRole('button', { name: 'Copy remaining quantities', exact: true }).click();
  await record(page).click();
  await expect(page.getByText('Saved receipt synthetic-saved-receipt (pending)', { exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(1); expect(state.errors).toEqual([]);
});

for (const status of [500, 400]) test(`basis HTTP ${status} hides debug content and retries the exact retained command`, async ({ page }) => {
  const state = await setup(page, { stage: 'basis', status });
  const editor = page.getByRole('region', { name: 'Set receiving basis', exact: true });
  await editor.getByRole('button', { name: 'Goods', exact: true }).click();
  await page.getByLabel('Item description 1', { exact: true }).fill('Synthetic pipe');
  await page.getByLabel('Unit 1', { exact: true }).fill('EA');
  await page.getByLabel('Ordered quantity 1', { exact: true }).fill('5');
  await editor.getByRole('button', { name: 'Save receiving basis', exact: true }).click();
  await safeError(page, status === 500 ? serverFailure : fallback);
  await expect(page.getByLabel('Item description 1', { exact: true })).toHaveValue('Synthetic pipe');
  await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic office');
  state.failure = false;
  await editor.getByRole('button', { name: 'Save receiving basis', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(state.posts).toHaveLength(2); expect(state.posts[1].data).toEqual(state.posts[0].data); expect(state.errors).toEqual([]);
});

for (const status of [500, 400]) test(`receipt HTTP ${status} hides debug content and preserves quantity, notes and operation key`, async ({ page }) => {
  const state = await setup(page, { stage: 'receipt', status });
  await quantity(page).fill('5');
  await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Retain this note');
  await record(page).click();
  await safeError(page, status === 500 ? serverFailure : fallback);
  await expect(quantity(page)).toHaveValue('5');
  await expect(page.getByRole('textbox', { name: 'Remarks', exact: true })).toHaveValue('Retain this note');
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic office');
  state.failure = false;
  await record(page).click();
  await expect(page.getByText('Saved receipt synthetic-saved-receipt (pending)', { exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(2); expect(state.posts[1].data).toEqual(state.posts[0].data); expect(state.errors).toEqual([]);
});

test('concise field validation remains visible once and retains the receipt draft', async ({ page }) => {
  const state = await setup(page, { stage: 'receipt', validation: true });
  await quantity(page).fill('5'); await record(page).click();
  await safeError(page, 'Choose a delivery location.');
  await expect(quantity(page)).toHaveValue('5');
  state.failure = false; await record(page).click();
  await expect(page.getByText('Saved receipt synthetic-saved-receipt (pending)', { exact: true })).toBeVisible();
  expect(state.posts[1].data).toEqual(state.posts[0].data); expect(state.errors).toEqual([]);
});
