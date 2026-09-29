import { test, expect } from '@playwright/test';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block', actionTimeout: 10000, navigationTimeout: 45000, viewport: { width: 1672, height: 941 } });
const original = '2026-09-28T09:00:00.123456+00:00';
const fresh = '2026-09-28T09:01:00.654321+00:00';
const reserved = '2026-09-28T09:02:00.654321+00:00';
const order = { id: 'synthetic-default-po', po_number: 'SYN-PO-0085_JUL2026', title: 'Synthetic source order', vendor_name: 'Synthetic supplier', status: 'sent', currency: 'USD', total_amount: '1050.00', updated_at: original, items: [] };
const rows = values => ({ count: values.length, next: null, results: values });
const record = page => page.getByRole('button', { name: 'Record receipt', exact: true });
const type = (page, name) => page.getByRole('group', { name: /^Receipt Type/ }).getByRole('button', { name, exact: true });
const status = (page, name) => page.getByRole('group', { name: /^Delivery Status/ }).getByRole('button', { name, exact: true });
const editor = page => page.getByRole('region', { name: 'Set receiving basis', exact: true });
const basisPosts = state => state.posts.filter(post => post.path.endsWith('/receiving-basis/'));
const receiptPosts = state => state.posts.filter(post => post.path.endsWith('/receipts/'));
const saved = page => expect(page.getByText('Saved receipt synthetic-default-receipt (pending)', { exact: true })).toBeVisible();
const inputQuantity = page => page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe', exact: true });

async function setup(page, { failure = '', denied = false, canonical = '', preselected = true, reserve = null, holdBasis = false } = {}) {
  const state = { failed: false, posts: [], events: [], errors: [], summary: { basis: 'unavailable', basis_source: null, po_updated_at: original, can_record: false, can_reconcile: false, needs_basis_review: true, can_review_basis: !denied, lines: [], blocked_reason: denied ? 'Receipt access is required.' : '' } };
  let releaseBasis;
  const gate = new Promise(resolve => { releaseBasis = resolve; });
  state.releaseBasis = releaseBasis;
  if (canonical) state.summary = { ...state.summary, basis: canonical, basis_source: 'purchase_order', needs_basis_review: false, can_review_basis: false, can_record: true, lines: [{ line_id: canonical === 'service_value' ? 'service:canonical' : 'line:canonical', description: canonical === 'service_value' ? 'Synthetic service' : 'Synthetic pipe', uom: canonical === 'service_value' ? 'USD' : 'EA', ordered: canonical === 'service_value' ? '1000.00' : '10', accepted: canonical === 'service_value' ? '200.00' : '4', pending: '0', available: canonical === 'service_value' ? '800.00' : '6', remaining: canonical === 'service_value' ? '800.00' : '6' }] };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(value => { window.handoffFixture = { order: value }; localStorage.setItem('radai_access_token', 'synthetic-token'); }, preselected ? order : null);
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    state.events.push(`${request.method()} ${path}`);
    if (request.method() !== 'GET') state.posts.push({ path, data: request.postDataJSON() });
    let body = rows([]);
    if (path.endsWith('/rbac/users/me/')) body = { user: { id: 'synthetic-recorder', first_name: 'Synthetic', last_name: 'Recorder' } };
    else if (path.endsWith(`/orders/${order.id}/`)) body = order;
    else if (path.endsWith('/available-orders/')) body = rows([order]);
    else if (path.endsWith('/receiving-summary/')) {
      if (state.summary.basis_source === 'reviewed_receiving' && failure.startsWith('refresh_') && !state.failed) {
        state.failed = true;
        if (failure === 'refresh_500') { await route.fulfill({ status: 500, json: { detail: 'Synthetic refresh failure.' } }); return; }
        body = { ...state.summary, lines: state.summary.lines.map(line => ({ ...line, line_id: 'reviewed:unexpected-line' })) };
      } else body = state.summary;
      if (reserve && body.basis_source === 'reviewed_receiving') body = { ...body, po_updated_at: reserved, lines: body.lines.map(line => ({ ...line, pending: reserve.pending, available: reserve.available })) };
    } else if (path.endsWith('/receiving-basis/') && request.method() === 'POST') {
      if (holdBasis) await gate;
      if (/^basis_(403|409|500)$/.test(failure) && !state.failed) {
        state.failed = true;
        const code = Number(failure.slice(-3));
        if (code === 409) state.summary.po_updated_at = fresh;
        await route.fulfill({ status: code, json: { detail: 'Synthetic basis command failure.' } }); return;
      }
      const payload = request.postDataJSON();
      state.summary = { ...state.summary, basis: payload.basis, basis_source: 'reviewed_receiving', po_updated_at: fresh, can_record: true, needs_basis_review: false, can_review_basis: false, lines: payload.lines.map((line, index) => ({ ...line, line_id: `reviewed:canonical-${index + 1}`, accepted: '0', pending: '0', available: line.ordered, remaining: line.ordered })) };
      body = failure === 'basis_unverified' && !state.failed ? {} : state.summary;
      if (failure === 'basis_unverified') state.failed = true;
    } else if (path.endsWith('/receipts/') && request.method() === 'POST') {
      if (failure === 'receipt_500' && !state.failed) { state.failed = true; await route.fulfill({ status: 500, json: { detail: 'Synthetic receipt command failure.' } }); return; }
      body = { ...request.postDataJSON(), id: 'synthetic-default-receipt', status: 'pending' };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/tests/fixtures/purchase-order-handoff.html?view=creator&toasts=1');
  return state;
}

async function delivery(page) {
  await page.getByLabel(/^Delivery Location/).fill('Synthetic receiving office');
  await page.getByLabel(/^Condition/).selectOption('good');
  await page.getByLabel('Delivery Note No.', { exact: true }).fill('SYN-DN-128');
}
async function goods(page, ordered = '12.5') {
  await page.getByLabel('Item description 1', { exact: true }).fill('Synthetic pipe');
  await page.getByLabel('Unit 1', { exact: true }).fill('EA');
  await page.getByLabel('Ordered quantity 1', { exact: true }).fill(ordered);
}

test('eligible uploaded PO starts with one active Goods choice, active Full and an enabled Record action', async ({ page }, testInfo) => {
  const state = await setup(page);
  await expect(editor(page)).toBeVisible();
  await expect(page.getByRole('group', { name: /^Receipt Type/ })).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Receiving basis', exact: true })).toHaveCount(0);
  await expect(type(page, 'Goods')).toHaveAttribute('aria-pressed', 'true');
  await expect(type(page, 'Goods')).toBeEnabled(); await expect(type(page, 'Services')).toBeEnabled();
  await expect(status(page, 'Full')).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Full', 'Partial', 'Rejected']) await expect(status(page, name)).toBeEnabled();
  await expect(record(page)).toBeEnabled();
  await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('');
  await page.screenshot({ path: testInfo.outputPath('goods-full-defaults.png'), fullPage: true });
  expect(state.posts).toEqual([]); expect(state.errors).toEqual([]);
});

test('Delivery Receipt Type switches preserve separate goods and service drafts', async ({ page }) => {
  const state = await setup(page); await delivery(page); await goods(page);
  await type(page, 'Services').click();
  await expect(page.getByLabel('Confirmed net value (excl. VAT)', { exact: true })).toHaveValue('');
  await page.getByLabel('Service scope', { exact: true }).fill('Synthetic service');
  await page.getByLabel('Confirmed net value (excl. VAT)', { exact: true }).fill('1000.00');
  await status(page, 'Partial').click();
  await page.getByLabel(/^Exception reason/).fill('Synthetic partial shipment');
  await type(page, 'Goods').click();
  await expect(page.getByLabel('Item description 1', { exact: true })).toHaveValue('Synthetic pipe');
  await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('12.5');
  await type(page, 'Services').click();
  await expect(page.getByLabel('Service scope', { exact: true })).toHaveValue('Synthetic service');
  await expect(page.getByLabel('Confirmed net value (excl. VAT)', { exact: true })).toHaveValue('1000.00');
  await expect(status(page, 'Partial')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel(/^Exception reason/)).toHaveValue('Synthetic partial shipment');
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic receiving office');
  expect(state.posts).toEqual([]); expect(state.errors).toEqual([]);
});

for (const service of [false, true]) test(`Full ${service ? 'service' : 'goods'} records once using verified canonical IDs and available balances`, async ({ page }) => {
  const state = await setup(page);
  await delivery(page);
  if (service) {
    await type(page, 'Services').click();
    await page.getByLabel('Service scope', { exact: true }).fill('Synthetic service');
    await page.getByLabel('Confirmed net value (excl. VAT)', { exact: true }).fill('1000.00');
  } else await goods(page);
  await record(page).click(); await saved(page);
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(1);
  const basis = basisPosts(state)[0].data; const receipt = receiptPosts(state)[0].data;
  expect(basis).toMatchObject({ basis: service ? 'service_value' : 'quantity', expected_updated_at: original, lines: [{ description: service ? 'Synthetic service' : 'Synthetic pipe', uom: service ? 'USD' : 'EA', ordered: service ? '1000.00' : '12.5' }] });
  expect(receipt).toMatchObject({ expected_po_updated_at: fresh, delivery_status: 'full', status: 'pending', delivery_note_number: 'SYN-DN-128', items_received: [{ line_id: 'reviewed:canonical-1', ...(service ? { received_amount: '1000.00', rejected_amount: '0' } : { received_qty: '12.5', rejected_qty: '0' }) }] });
  expect(basis.operation_key).toMatch(/^[\da-f-]{36}$/); expect(receipt.operation_key).toMatch(/^[\da-f-]{36}$/);
  expect(receipt.operation_key).not.toBe(basis.operation_key);
  const basisIndex = state.events.findIndex(event => event.startsWith('POST ') && event.endsWith('/receiving-basis/'));
  const receiptIndex = state.events.findIndex(event => event.startsWith('POST ') && event.endsWith('/receipts/'));
  expect(state.events.slice(basisIndex + 1, receiptIndex).some(event => event.startsWith('GET ') && event.endsWith('/receiving-summary/'))).toBe(true);
  expect(state.errors).toEqual([]);
});

test('Record validates missing delivery fields and explicit basis before either command is posted', async ({ page }) => {
  const state = await setup(page); await expect(record(page)).toBeEnabled();
  await record(page).click(); expect(state.posts).toEqual([]);
  expect(await page.getByLabel(/^Delivery Location/).evaluate(element => element.validity.valueMissing)).toBe(true);
  await page.getByLabel(/^Delivery Location/).fill('Synthetic receiving office');
  await record(page).click(); expect(state.posts).toEqual([]);
  expect(await page.getByLabel(/^Condition/).evaluate(element => element.validity.valueMissing)).toBe(true);
  await page.getByLabel(/^Condition/).selectOption('good');
  await record(page).click(); expect(state.posts).toEqual([]);
  expect(await page.getByLabel('Item description 1', { exact: true }).evaluate(element => element.validity.valueMissing)).toBe(true);
  await goods(page, '0'); await record(page).click();
  await expect(page.getByRole('alert')).toContainText('positive ordered quantity');
  await expect(page.getByLabel('Item description 1', { exact: true })).toHaveValue('Synthetic pipe');
  expect(state.posts).toEqual([]); expect(state.errors).toEqual([]);
});

test('no selected PO cannot submit either command', async ({ page }) => {
  const empty = await setup(page, { preselected: false });
  await expect(status(page, 'Full')).toHaveAttribute('aria-pressed', 'true');
  await expect(record(page)).toBeDisabled(); expect(empty.posts).toEqual([]);
});

test('denied receiving authority cannot submit either command', async ({ page }) => {
  const denied = await setup(page, { denied: true });
  await expect(page.getByText('Receipt access is required.', { exact: true })).toBeVisible();
  await expect(record(page)).toBeDisabled(); await expect(editor(page)).toHaveCount(0);
  expect(denied.posts).toEqual([]); expect(denied.errors).toEqual([]);
});

for (const code of [403, 409, 500]) test(`direct recording stops at basis HTTP ${code} and preserves the reviewed draft`, async ({ page }) => {
  const state = await setup(page, { failure: `basis_${code}` }); await delivery(page); await goods(page);
  await record(page).click();
  await expect(page.getByRole('alert')).toContainText(code === 409 ? 'This record changed' : code === 403 ? 'do not have access' : 'The server could not complete the request');
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(0);
  await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('12.5');
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic receiving office');
  if (code === 409) {
    await expect(record(page)).toBeDisabled();
    await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
  }
  await record(page).click(); await saved(page);
  expect(basisPosts(state)).toHaveLength(2); expect(receiptPosts(state)).toHaveLength(1);
  if (code === 409) expect(basisPosts(state)[1].data.expected_updated_at).toBe(fresh);
  else expect(basisPosts(state)[1].data).toEqual(basisPosts(state)[0].data);
  expect(state.errors).toEqual([]);
});

for (const failure of ['basis_unverified', 'refresh_500', 'refresh_mismatch']) test(`acknowledged ${failure} requires explicit refresh before any receipt command`, async ({ page }) => {
  const state = await setup(page, { failure }); await delivery(page); await goods(page);
  await record(page).click(); await expect(page.getByRole('alert')).toBeVisible();
  await expect(record(page)).toBeDisabled();
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(0);
  await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('12.5');
  await expect(page.getByLabel(/^Delivery Location/)).toHaveValue('Synthetic receiving office');
  await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  await record(page).click(); await saved(page);
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(1);
  expect(receiptPosts(state)[0].data.items_received[0].line_id).toBe('reviewed:canonical-1');
  expect(state.errors).toEqual([]);
});

test('receipt failure after successful basis keeps canonical input and retries only the same receipt command', async ({ page }) => {
  const state = await setup(page, { failure: 'receipt_500' }); await delivery(page); await goods(page);
  await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Retain my receipt note');
  await record(page).click(); await expect(page.getByRole('alert')).toContainText('The server could not complete the request');
  await expect(editor(page)).toHaveCount(0); await expect(inputQuantity(page)).toHaveValue('12.5');
  await expect(page.getByRole('textbox', { name: 'Remarks', exact: true })).toHaveValue('Retain my receipt note');
  await record(page).click(); await saved(page);
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(2);
  expect(receiptPosts(state)[1].data).toEqual(receiptPosts(state)[0].data); expect(state.errors).toEqual([]);
});

test('an intervening reservation stops direct recording until the new token and balances are explicitly refreshed', async ({ page }) => {
  const state = await setup(page, { reserve: { pending: '3', available: '9.5' } });
  await delivery(page); await goods(page); await record(page).click();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(record(page)).toBeDisabled();
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(0);
  await expect(page.getByLabel('Ordered quantity 1', { exact: true })).toHaveValue('12.5');
  await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
  await expect(inputQuantity(page)).toHaveValue('9.5');
  await record(page).click(); await saved(page);
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(1);
  expect(receiptPosts(state)[0].data).toMatchObject({ expected_po_updated_at: reserved, items_received: [{ line_id: 'reviewed:canonical-1', received_qty: '9.5', rejected_qty: '0' }] });
  expect(state.errors).toEqual([]);
});

for (const outcome of ['Partial', 'Rejected']) test(`${outcome} before basis requires actual received quantities after source setup`, async ({ page }) => {
  const state = await setup(page); await delivery(page); await goods(page);
  await status(page, outcome).click();
  await page.getByLabel(/^Exception reason/).fill('Synthetic delivery exception');
  await record(page).click(); await expect(editor(page)).toHaveCount(0);
  expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(0);
  await expect(inputQuantity(page)).toHaveValue('');
  await expect(status(page, outcome)).toHaveAttribute('aria-pressed', 'true');
  await inputQuantity(page).fill('4'); await record(page).click(); await saved(page);
  expect(receiptPosts(state)).toHaveLength(1);
  expect(receiptPosts(state)[0].data).toMatchObject({ delivery_status: outcome.toLowerCase(), exception_reason: 'Synthetic delivery exception', items_received: [{ line_id: 'reviewed:canonical-1', received_qty: '4', rejected_qty: outcome === 'Rejected' ? '4' : '0' }] });
  expect(state.errors).toEqual([]);
});

test('canonical service starts with Services and Full, and ordinary edits never overwrite entered values', async ({ page }) => {
  const state = await setup(page, { canonical: 'service_value' }); await delivery(page);
  await expect(type(page, 'Services')).toHaveAttribute('aria-pressed', 'true');
  await expect(type(page, 'Services')).toBeEnabled(); await expect(type(page, 'Goods')).toBeDisabled();
  await expect(status(page, 'Full')).toHaveAttribute('aria-pressed', 'true');
  const amount = page.getByRole('spinbutton', { name: 'Received value for Synthetic service', exact: true });
  await expect(amount).toHaveValue('800.00');
  await amount.fill('200.00');
  await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Keep entered amount');
  await type(page, 'Services').click(); await expect(amount).toHaveValue('200.00');
  await expect(status(page, 'Partial')).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel(/^Exception reason/).fill('Synthetic remaining service');
  await record(page).click(); await saved(page);
  expect(basisPosts(state)).toHaveLength(0); expect(receiptPosts(state)).toHaveLength(1);
  expect(receiptPosts(state)[0].data.items_received).toEqual([{ line_id: 'service:canonical', received_amount: '200.00', rejected_amount: '0' }]);
  expect(state.errors).toEqual([]);
});

test('one busy gate prevents duplicate basis or receipt commands during direct recording', async ({ page }) => {
  const state = await setup(page, { holdBasis: true }); await delivery(page); await goods(page);
  try {
    await record(page).click(); await expect.poll(() => basisPosts(state).length).toBe(1);
    await expect(page.getByRole('dialog').locator('button[type="submit"]')).toBeDisabled();
    await expect(type(page, 'Services')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Close receipt creator', exact: true })).toBeDisabled();
    await page.locator('form.receipt-entry__form').evaluate(form => form.requestSubmit());
    expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(0);
  } finally { state.releaseBasis(); }
  await saved(page); expect(basisPosts(state)).toHaveLength(1); expect(receiptPosts(state)).toHaveLength(1); expect(state.errors).toEqual([]);
});
