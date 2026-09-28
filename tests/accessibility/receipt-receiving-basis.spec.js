import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(120000);
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 }, actionTimeout: 12000, navigationTimeout: 90000 });
const token = '2026-09-28T06:15:00.123456+00:00';
const later = '2026-09-28T06:16:00.654321+00:00';
const order = { id: 'synthetic-header-po', po_number: 'SYN-RAD-PRJ-PUR-0085_JUL2026', title: 'Synthetic uploaded order', status: 'sent', vendor_name: 'Synthetic supplier', currency: 'USD', total_amount: '1050.00', updated_at: token, items: [] };
const editor = page => page.getByRole('region', { name: 'Set receiving basis', exact: true });
const save = page => editor(page).getByRole('button', { name: 'Save receiving basis', exact: true });
const record = page => page.getByRole('dialog').getByRole('button', { name: 'Record receipt', exact: true });
const pageData = rows => ({ count: rows.length, next: null, previous: null, results: rows });

async function setup(page, { view = 'creator', denied = false, failure = 0, postSuccessFailure = '' } = {}) {
  const state = { posts: [], errors: [], reads: [], failed: false, summary: { basis: 'unavailable', basis_source: null, status: 'blocked', po_updated_at: token, lines: [], can_record: false, can_reconcile: false, needs_basis_review: true, can_review_basis: !denied, blocked_reason: denied ? 'Receipt create access is required.' : 'Record a valid goods line basis or a service scope with confirmed net value and currency before receiving.' } };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(value => { window.handoffFixture = { order: value }; localStorage.setItem('radai_access_token', 'synthetic-token'); }, order);
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (request.method() === 'GET') state.reads.push(url.pathname);
    else state.posts.push({ path: url.pathname, data: request.postDataJSON() });
    let body = pageData([]);
    if (url.pathname.endsWith('/rbac/users/me/')) body = { user: { id: 'synthetic-recorder', first_name: 'Synthetic', last_name: 'Recorder' } };
    else if (url.pathname.endsWith('/receiving-summary/')) {
      if (postSuccessFailure === 'refresh_failed' && state.summary.basis_source === 'reviewed_receiving' && !state.failed) {
        state.failed = true; await route.fulfill({ status: 500, json: { detail: 'Synthetic balance refresh failed.' } }); return;
      }
      body = state.summary;
    }
    else if (url.pathname.endsWith(`/orders/${order.id}/`)) body = order;
    else if (url.pathname.endsWith('/available-orders/')) body = pageData([{ ...order, receiving: state.summary }]);
    else if (url.pathname.endsWith('/inspection-summary/')) body = { capabilities: { create: !denied, read_purchase_orders: true }, counts: {}, filter_options: {} };
    else if (url.pathname.endsWith('/receiving-basis/') && request.method() === 'POST') {
      if (failure && !state.failed) {
        state.failed = true;
        if (failure === 409) state.summary.po_updated_at = later;
        await route.fulfill({ status: failure, json: { detail: 'Synthetic basis save failed.' } }); return;
      }
      const data = request.postDataJSON();
      state.summary = { ...state.summary, basis: data.basis, basis_source: 'reviewed_receiving', status: 'none', needs_basis_review: false, can_review_basis: false, can_record: true, blocked_reason: '', po_updated_at: later,
        lines: data.lines.map((line, index) => ({ ...line, line_id: `reviewed:canonical-${index + 1}`, accepted: '0', pending: '0', available: line.ordered, remaining: line.ordered })) };
      body = postSuccessFailure === 'unverified' ? {} : state.summary;
    } else if (url.pathname.endsWith('/receipts/') && request.method() === 'POST') body = { ...request.postDataJSON(), id: 'saved-reviewed-receipt', status: 'pending' };
    await route.fulfill({ json: body });
  });
  await page.goto(`/tests/fixtures/purchase-order-handoff.html?view=${view}`);
  return state;
}
async function goods(page) {
  await editor(page).getByRole('button', { name: 'Goods', exact: true }).click();
  await page.getByLabel('Item description 1', { exact: true }).fill('Synthetic pipe');
  await page.getByLabel('Unit 1', { exact: true }).fill('EA');
  await page.getByLabel('Ordered quantity 1', { exact: true }).fill('12.5');
}
async function delivery(page) {
  await page.getByLabel(/^Delivery Location/).fill('Synthetic receiving office');
  await page.getByLabel(/^Condition/).selectOption('good');
  await page.getByLabel('Delivery Note No.', { exact: true }).fill('SYN-DN-128');
}

test('header-only uploaded PO recovers source goods lines and records using returned canonical identities', async ({ page }, testInfo) => {
  const state = await setup(page);
  await expect(record(page)).toBeDisabled();
  await expect(editor(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('before-receiving-basis.png'), fullPage: true });
  await delivery(page); await goods(page);
  await save(page).click();
  await expect(editor(page)).toHaveCount(0);
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic receiving office');
  await expect(page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe', exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Copy remaining quantities', exact: true }).click();
  await expect(record(page)).toBeEnabled();
  await expect(page.getByText('All required information complete', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('after-receiving-basis.png'), fullPage: true });
  await record(page).click();
  await expect(page.getByText('Saved receipt saved-reviewed-receipt (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data).toMatchObject({ basis: 'quantity', expected_updated_at: token, lines: [{ description: 'Synthetic pipe', uom: 'EA', ordered: '12.5' }] });
  expect(state.posts[0].data.operation_key).toMatch(/^[\da-f-]{36}$/);
  expect(state.posts[1].data).toMatchObject({ expected_po_updated_at: later, delivery_note_number: 'SYN-DN-128', items_received: [{ line_id: 'reviewed:canonical-1', received_qty: '12.5', rejected_qty: '0' }] });
  expect(state.posts[0].path).toContain(`/orders/${order.id}/receiving-basis/`);
  expect(state.posts).toHaveLength(2); expect(state.errors).toEqual([]);
});

test('service recovery requires explicit confirmed net value and records canonical service amounts', async ({ page }) => {
  const state = await setup(page); await delivery(page);
  await editor(page).getByRole('button', { name: 'Services', exact: true }).click();
  await expect(page.getByLabel('Confirmed net value (excl. VAT)', { exact: true })).toHaveValue('');
  await page.getByLabel('Service scope', { exact: true }).fill('Synthetic verified engineering scope');
  await page.getByLabel('Confirmed net value (excl. VAT)', { exact: true }).fill('1000.00');
  await save(page).click();
  await page.getByRole('button', { name: 'Copy remaining value', exact: true }).click();
  await record(page).click();
  await expect(page.getByText('Saved receipt saved-reviewed-receipt (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.lines).toEqual([{ description: 'Synthetic verified engineering scope', uom: 'USD', ordered: '1000.00' }]);
  expect(state.posts[1].data.items_received).toEqual([{ line_id: 'reviewed:canonical-1', received_amount: '1000.00', rejected_amount: '0' }]);
  expect(state.errors).toEqual([]);
});

test('invalid reviewed quantities stay editable and cannot create a basis or receipt', async ({ page }) => {
  const state = await setup(page); await goods(page);
  await page.getByLabel('Ordered quantity 1', { exact: true }).fill('0');
  await save(page).click();
  await expect(editor(page).getByRole('alert')).toContainText('positive ordered quantity');
  await expect(page.getByLabel('Item description 1', { exact: true })).toHaveValue('Synthetic pipe');
  await expect(record(page)).toBeDisabled(); expect(state.posts).toEqual([]);
});

for (const failure of [403, 409, 500]) {
  test(`basis HTTP ${failure} retains reviewed lines and delivery details for guarded recovery`, async ({ page }) => {
    const state = await setup(page, { failure }); await delivery(page); await goods(page);
    await save(page).click();
    await expect(page.getByRole('alert')).toContainText(failure === 409 ? 'This record changed' : failure === 403 ? 'do not have access' : 'The server could not complete the request');
    await expect(page.getByLabel('Item description 1', { exact: true })).toHaveValue('Synthetic pipe');
    await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('12.5');
    await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic receiving office');
    await expect(record(page)).toBeDisabled();
    if (failure === 409) {
      await expect(save(page)).toBeDisabled();
      await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
      await expect(save(page)).toBeEnabled();
      await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('12.5');
    }
    await save(page).click(); await expect(editor(page)).toHaveCount(0);
    expect(state.posts).toHaveLength(2);
    if (failure === 409) expect(state.posts[1].data.expected_updated_at).toBe(later);
    else expect(state.posts[1].data.operation_key).toBe(state.posts[0].data.operation_key);
    expect(state.errors).toEqual([]);
  });
}

for (const denied of [false, true]) {
  test(`${denied ? 'denied' : 'eligible'} missing-basis PO has the correct queue recovery action`, async ({ page }) => {
    const state = await setup(page, { view: 'receipts', denied });
    await page.getByRole('button', { name: 'POs awaiting receipt / service acceptance', exact: true }).click();
    const queue = page.getByRole('region', { name: 'POs awaiting receipt / service acceptance', exact: true });
    const action = queue.getByRole('button', { name: 'Record receipt', exact: true });
    if (denied) { await expect(action).toBeDisabled(); await expect(editor(page)).toHaveCount(0); }
    else { await expect(action).toBeEnabled(); await action.click(); await expect(editor(page)).toBeVisible(); }
    expect(state.posts).toEqual([]); expect(state.errors).toEqual([]);
  });
}

for (const postSuccessFailure of ['unverified', 'refresh_failed']) {
  test(`acknowledged basis save with ${postSuccessFailure} requires explicit balance refresh and preserves input`, async ({ page }) => {
    const state = await setup(page, { postSuccessFailure }); await delivery(page); await goods(page);
    await save(page).click();
    await expect(page.getByRole('alert')).toContainText(postSuccessFailure === 'unverified' ? 'could not be verified' : 'The server could not complete the request');
    await expect(save(page)).toBeDisabled();
    await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('12.5');
    await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
    await expect(editor(page)).toHaveCount(0);
    await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic receiving office');
    expect(state.posts).toHaveLength(1);
    await page.getByRole('button', { name: 'Copy remaining quantities', exact: true }).click();
    await record(page).click();
    await expect(page.getByText('Saved receipt saved-reviewed-receipt (pending)', { exact: true })).toBeVisible();
    expect(state.posts).toHaveLength(2); expect(state.errors).toEqual([]);
  });
}

test('reviewed-basis controls remain accessible and within the mobile form', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page); await goods(page);
  await editor(page).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const report = await new AxeBuilder({ page }).include('.receipt-basis').analyze();
  expect(report.violations.filter(value => ['serious', 'critical'].includes(value.impact))).toEqual([]);
  await editor(page).screenshot({ path: testInfo.outputPath('receiving-basis-mobile.png') });
  expect(state.posts).toEqual([]); expect(state.errors).toEqual([]);
});
