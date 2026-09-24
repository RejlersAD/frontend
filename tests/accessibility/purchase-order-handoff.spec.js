import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

test.setTimeout(90000);
test.use({ serviceWorkers: 'block', actionTimeout: 10000, navigationTimeout: 45000, timezoneId: 'Asia/Dubai' });
const token = '2026-09-24T10:00:00.123456+00:00';
const order = { id: 'po-1', po_number: 'SYN-PO-001', title: 'Synthetic equipment', vendor_id: 'vendor-1', vendor_name: 'Synthetic supplier', status: 'partially_received', currency: 'AED', total_amount: '1000.00', remaining_amount: '800.00', updated_at: token, can_import_invoice: true };
const summary = { basis: 'quantity', status: 'partial', po_updated_at: token, can_record: true, can_reconcile: false, lines: [{ line_id: 'line:10', description: 'Synthetic pipe', line_number: 10, uom: 'EA', ordered: '10', accepted: '4', pending: '1', remaining: '6', available: '5' }] };
const invoice = { id: 'invoice-1', invoice_number: 'SYN-INV-001', vendor_name: 'Synthetic supplier', vendor_master_name: 'Synthetic supplier', currency: 'AED', total_amount: '100.00', procurement_status: 'ready_for_matching', match_status: 'unmatched', payment_status: 'not_scheduled', updated_at: token, po_reference_text: 'OCR-OTHER', confirmed_po_references: [{ id: 'po-1', po_number: order.po_number }], capabilities: { can_allocate_purchase_order: true }, po_allocations: [], structured_line_items: [], audit_logs: [] };
const receipt = { id: 'receipt-1', receipt_number: 'SYN-GR-001', po_number: order.po_number, vendor_name: order.vendor_name, status: 'pending', updated_at: token, receipt_date: '2026-09-24', items_received: [], capabilities: { accept: true, reject: true, export: true } };
const pageData = rows => ({ count: rows.length, next: null, previous: null, results: rows });

async function setup(page, { view = 'creator', reconciliation = false, service = false, preselected = true, custom } = {}) {
  const state = { posts: [], reads: [], errors: [], summary: structuredClone(summary), receipt: structuredClone(receipt), invoice: structuredClone(invoice) };
  if (reconciliation) { state.summary.can_record = false; state.summary.can_reconcile = true; }
  if (service) state.summary = { ...state.summary, basis: 'service_value', lines: [{ line_id: 'service:total', description: 'Synthetic service', uom: 'AED', ordered: '1000.00', accepted: '200.00', pending: '0.00', remaining: '800.00', available: '800.00' }] };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(fixture => { window.handoffFixture = fixture; localStorage.setItem('radai_access_token', 'synthetic-token'); }, { order: preselected ? order : null, reconciliation, invoice });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (request.method() !== 'GET') state.posts.push({ path, raw: request.postData(), data: request.headers()['content-type']?.includes('json') ? request.postDataJSON() : null });
    else state.reads.push(url);
    if (custom && await custom(route, state, url)) return;
    let body = pageData([]);
    if (path.endsWith('/receiving-summary/')) body = state.summary;
    else if (path.endsWith('/available-orders/')) body = pageData([{ ...order, receiving: { ...state.summary, can_reconcile: true } }]);
    else if (path.endsWith('/inspection-summary/')) body = { schema_version: '1.0', as_of_date: '2026-09-24', filtered_count: 0, capabilities: { create: true, approve: true, read_purchase_orders: true }, counts: {}, kpis: {} };
    else if (path.endsWith('/reconcile/') || (path.endsWith('/receipts/') && request.method() === 'POST')) body = { ...state.receipt, purchase_order: request.postDataJSON().purchase_order, operation_key: request.postDataJSON().operation_key };
    else if (path.endsWith('/receipts/receipt-1/')) body = state.receipt;
    else if (path.endsWith('/awaiting-purchase-orders/') || path.endsWith('/purchase-order-options/')) body = pageData([order]);
    else if (path.endsWith('/allocate-purchase-order/')) body = { invoice: state.invoice, allocation_id: 'allocation-1' };
    else if (path.endsWith('/finance/invoices/')) body = pageData([state.invoice]);
    else if (path.endsWith('/finance/invoices/invoice-1/')) body = state.invoice;
    else if (path.endsWith('/import-preview/')) body = { extracted: { invoice_number: 'SYN-IMPORT-1', vendor_name: order.vendor_name, invoice_date: '2026-09-24', total_amount: '100.00', currency: 'AED' }, vendor_options: [{ id: order.vendor_id, name: order.vendor_name }], source_file_sha256: 'synthetic-hash', extracted_text: 'Synthetic invoice', field_confidence: {}, ocr_confidence: 90 };
    else if (path.endsWith('/import-reviewed/')) body = { invoice: state.invoice, message: 'Invoice recorded' };
    await route.fulfill({ json: body });
  });
  await page.goto(`/tests/fixtures/purchase-order-handoff.html?view=${view}`);
  return state;
}

test('simple receipt records the chosen date, reference and remarks with pending confirmation', async ({ page }, testInfo) => {
  const state = await setup(page);
  const dialog = page.getByRole('dialog');
  for (const label of ['Inspector name', 'Inspection agency', 'Inspection report number', 'Overall quality', 'Dimensional check', 'Visual inspection', 'Material verification', 'Certificates received', 'Heat numbers / serial numbers', 'NDT performed', 'NDT results', 'Inspection notes', 'Additional notes']) {
    await expect(dialog.getByLabel(label, { exact: true })).toHaveCount(0);
  }
  await expect(dialog.getByRole('spinbutton', { name: /Rejected/ })).toHaveCount(0);
  await page.getByLabel('Delivery Note / Reference', { exact: true }).fill('SYN-DN-025');
  await page.getByLabel(/^Receipt Date/).fill('2026-09-18');
  await page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' }).fill('2.5');
  await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Keep this delivery note');
  await page.screenshot({ path: testInfo.outputPath('receipt-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByText('Saved receipt receipt-1')).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].data).toMatchObject({ status: 'pending', receipt_date: '2026-09-18', delivery_note_number: 'SYN-DN-025', notes: 'Keep this delivery note', expected_po_updated_at: token, quality_check_passed: null, dimensional_check_passed: null, visual_inspection_passed: null, material_verification_passed: null, items_received: [{ line_id: 'line:10', received_qty: '2.5', rejected_qty: '0' }] });
  expect(state.posts[0].data.operation_key).toMatch(/^[0-9a-f-]{36}$/);
  expect(state.errors).toEqual([]);
});

test('receipt date defaults to the local day and is required before posting', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-23T21:15:00Z'));
  const state = await setup(page);
  const date = page.getByLabel(/^Receipt Date/);
  await expect(date).toHaveAttribute('type', 'date');
  await expect(date).toHaveValue('2026-09-24');
  await page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' }).fill('1');
  await date.fill('');
  await page.getByRole('button', { name: 'Record receipt' }).click();
  expect(await date.evaluate(element => element.validity.valueMissing)).toBe(true);
  expect(state.posts).toHaveLength(0);
});

test('receipt form loads lines after choosing a purchase order', async ({ page }, testInfo) => {
  const state = await setup(page, { preselected: false });
  await expect(page.getByRole('button', { name: 'Record receipt' })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Purchase Order', exact: true }).selectOption(order.id);
  await expect(page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' })).toBeVisible();
  await expect(page.getByLabel(/^Receipt Date/)).not.toHaveValue('');
  await page.screenshot({ path: testInfo.outputPath('receipt-selector-desktop.png'), fullPage: true });
  expect(state.reads.some(url => url.pathname.endsWith('/available-orders/') && url.searchParams.get('queue') === 'awaiting')).toBe(true);
  expect(state.posts).toHaveLength(0);
});

test('receipt line previews previous receipts, remaining balance and partial or complete coverage', async ({ page }) => {
  await setup(page);
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader')).toHaveText(['Description', 'Ordered', 'Previously Received', 'Received Quantity', 'Balance Remaining', 'Line Status']);
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /^Synthetic pipe/ }) });
  const cells = row.locator('th, td');
  await expect(cells.nth(1)).toHaveText('10');
  await expect(cells.nth(2)).toContainText('5');
  await expect(cells.nth(4)).toHaveText('5');
  await expect(cells.nth(5)).toContainText('Partial');
  await expect(row).toContainText('Awaiting confirmation');
  const quantity = row.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' });
  await quantity.fill('2.5');
  await expect(cells.nth(4)).toHaveText('2.5');
  await expect(cells.nth(5)).toContainText('Partial');
  await quantity.fill('5');
  await expect(cells.nth(4)).toHaveText('0');
  await expect(cells.nth(5)).toContainText('Complete');
  await expect(row).toContainText('Awaiting confirmation');
});

test('service receiving previews exact value balances with currency and pending coverage', async ({ page }) => {
  const state = await setup(page, { service: true });
  const table = page.getByRole('table');
  await expect(table.getByRole('columnheader', { name: 'Received Value', exact: true })).toBeVisible();
  await expect(table).toContainText('AED');
  const row = table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: /^Synthetic service/ }) });
  const cells = row.locator('th, td');
  await expect(cells.nth(2)).toContainText('200');
  await expect(row).not.toContainText('Awaiting confirmation');
  await row.getByRole('spinbutton', { name: 'Received value for Synthetic service' }).fill('125.25');
  await expect(cells.nth(4)).toContainText('674.75');
  await expect(cells.nth(5)).toContainText('Partial');
  await expect(row).toContainText('Awaiting confirmation');
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByText('Saved receipt receipt-1')).toBeVisible();
  expect(state.posts[0].data.items_received).toEqual([{ line_id: 'service:total', received_amount: '125.25', rejected_amount: '0' }]);
});

test('zero, negative and over-balance quantities cannot be posted', async ({ page }) => {
  const state = await setup(page);
  const quantity = page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' });
  await quantity.fill('0');
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByRole('alert')).toContainText('greater than zero');
  for (const value of ['-1', '5.01']) {
    await quantity.fill(value);
    await page.getByRole('button', { name: 'Record receipt' }).click();
    expect(await quantity.evaluate(element => element.validity.valid)).toBe(false);
  }
  expect(state.posts).toHaveLength(0);
  await expect(quantity).toHaveValue('5.01');
  await expect(page.getByLabel(/^Receipt Date/)).not.toHaveValue('');
});

test('missing line basis explains the blocked receipt and prevents posting', async ({ page }) => {
  const state = await setup(page, { custom: async (route, state, url) => {
    if (!url.pathname.endsWith('/receiving-summary/')) return;
    await route.fulfill({ json: { ...state.summary, basis: 'unknown', lines: [], can_record: false, blocked_reason: 'Record a valid goods line basis or a service scope with confirmed net value and currency before receiving.' } });
    return true;
  } });
  await expect(page.getByRole('status').filter({ hasText: 'Record a valid goods line basis' })).toBeVisible();
  await expect(page.getByText('No receivable lines are available for this purchase order.')).toBeVisible();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Record receipt' })).toBeDisabled();
  expect(state.posts).toHaveLength(0);
});

test('denied receipt balances remain unavailable until an explicit successful refresh', async ({ page }) => {
  let denied = true;
  const state = await setup(page, { custom: async (route, state, url) => {
    if (!url.pathname.endsWith('/receiving-summary/') || !denied) return;
    await route.fulfill({ status: 403, json: { detail: 'Denied' } });
    return true;
  } });
  await expect(page.getByRole('alert')).toContainText('You do not have access');
  await expect(page.getByRole('button', { name: 'Record receipt' })).toBeDisabled();
  denied = false;
  await page.getByRole('button', { name: 'Refresh receipt balances' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' })).toBeVisible();
  expect(state.posts).toHaveLength(0);
});

test('failed response keeps values and retries with the same operation key', async ({ page }) => {
  let failed = false;
  const state = await setup(page, { custom: async (route, state, url) => {
    if (url.pathname.endsWith('/receipts/') && route.request().method() === 'POST' && !failed) { failed = true; await route.fulfill({ status: 500, json: { detail: 'Receipt could not be saved.' } }); return true; }
  } });
  await page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' }).fill('1');
  await page.getByLabel(/^Receipt Date/).fill('2026-09-20');
  await page.getByLabel('Delivery Note / Reference', { exact: true }).fill('SYN-RETRY-01');
  await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Retained after failure');
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByRole('alert')).toContainText('Receipt could not be saved');
  await expect(page.getByRole('textbox', { name: 'Remarks', exact: true })).toHaveValue('Retained after failure');
  await expect(page.getByLabel(/^Receipt Date/)).toHaveValue('2026-09-20');
  await expect(page.getByLabel('Delivery Note / Reference', { exact: true })).toHaveValue('SYN-RETRY-01');
  await expect(page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' })).toHaveValue('1');
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByText('Saved receipt receipt-1')).toBeVisible();
  expect(state.posts[0].data.operation_key).toBe(state.posts[1].data.operation_key);
});

test('narrow service receipt scrolls its line table without shifting the form', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { service: true });
  await page.getByRole('spinbutton', { name: 'Received value for Synthetic service' }).fill('125.25');
  const geometry = await page.getByRole('dialog').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth, left: element.scrollLeft }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
  expect(geometry.left).toBe(0);
  await expect(page.getByRole('heading', { name: 'Record service acceptance' })).toBeInViewport();
  await expect(page.getByLabel('Delivery Note / Reference', { exact: true })).toBeInViewport();
  await expect(page.getByLabel(/^Receipt Date/)).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Service value (AED)', exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('receipt-service-narrow.png'), fullPage: true });
});

test('lost creation response can replay an already inspected receipt without a duplicate', async ({ page }) => {
  let failed = false;
  const state = await setup(page, { custom: async (route, state, url) => {
    if (url.pathname.endsWith('/receipts/') && route.request().method() === 'POST' && !failed) {
      failed = true; state.receipt.status = 'accepted';
      await route.fulfill({ status: 502, json: { detail: 'Response unavailable.' } }); return true;
    }
  } });
  await page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe' }).fill('1');
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByRole('alert')).toContainText('Response unavailable');
  await page.getByRole('button', { name: 'Record receipt' }).click();
  await expect(page.getByText('Saved receipt receipt-1 (accepted)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.operation_key).toBe(state.posts[1].data.operation_key);
  expect(state.posts[1].data.status).toBe('pending');
});

test('receipt decision conflict retains rejection reason and inspection fields for explicit refresh', async ({ page }) => {
  let first = true;
  const state = await setup(page, { view: 'receipts', custom: async (route, state, url) => {
    if (url.pathname.endsWith('/receipts/') && route.request().method() === 'GET') { await route.fulfill({ json: pageData([state.receipt]) }); return true; }
    if (url.pathname.endsWith('/reject_delivery/')) {
      if (first) { first = false; state.receipt.updated_at = '2026-09-24T10:05:00.654321+00:00'; await route.fulfill({ status: 409, json: { detail: { message: 'Changed receipt' } } }); }
      else { state.receipt.status = 'rejected'; await route.fulfill({ json: state.receipt }); }
      return true;
    }
  } });
  await page.getByRole('button', { name: 'Open receipt', exact: true }).click();
  await page.getByLabel('Rejection reason').fill('Damaged delivery');
  await page.getByRole('combobox', { name: 'Overall quality', exact: true }).selectOption('false');
  await page.getByRole('button', { name: 'Reject receipt', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This record changed');
  await page.getByRole('button', { name: 'Refresh receipt details' }).click();
  await expect(page.getByLabel('Rejection reason')).toHaveValue('Damaged delivery');
  await expect(page.getByRole('combobox', { name: 'Overall quality', exact: true })).toHaveValue('false');
  await page.getByRole('button', { name: 'Reject receipt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reject receipt', exact: true })).toHaveCount(0);
  expect(state.posts[1].data).toMatchObject({ expected_updated_at: state.receipt.updated_at, reason: 'Damaged delivery', quality_check_passed: false });
  expect(state.errors).toEqual([]);
});

async function setupConfirmation(page, { blockedReason = '', failure = null, missingMetadata = false, technicalAuthority = false } = {}) {
  let attempted = false;
  return setup(page, { view: 'receipts', custom: async (route, state, url) => {
    if (!state.confirmationReady) {
      state.confirmationReady = true;
      state.receipt = { ...state.receipt, purchase_order: order.id, received_by_name: 'Synthetic receiver',
        capabilities: { accept: technicalAuthority, reject: technicalAuthority, export: true },
        confirmation: missingMetadata ? undefined : { can_confirm: !blockedReason, blocked_reason: blockedReason, responsible_user_id: 7, responsible_user_name: 'Synthetic receiver', confirmed_by_id: null, confirmed_by_name: null, confirmed_at: null },
        items_received: [{ line_id: 'line:10', item: 'Synthetic pipe', uom: 'EA', ordered_qty: '10', received_qty: '2', accepted_qty: '0', rejected_qty: '0' }],
        quality_check_passed: null, dimensional_check_passed: null, visual_inspection_passed: null, material_verification_passed: null,
      };
    }
    if (url.pathname.endsWith('/receipts/') && route.request().method() === 'GET') { await route.fulfill({ json: pageData([state.receipt]) }); return true; }
    if (!url.pathname.endsWith('/confirm_delivery/')) return false;
    if (failure && !attempted) {
      attempted = true;
      if (failure === 409) state.receipt.updated_at = '2026-09-24T10:05:00.654321+00:00';
      await route.fulfill({ status: failure, json: { detail: failure === 403 ? 'Your receipt access was revoked. Delivery was not confirmed.' : failure === 409 ? 'Receipt changed.' : 'Delivery confirmation could not be saved. Try again.' } }); return true;
    }
    state.receipt.status = 'accepted';
    state.receipt.items_received[0].accepted_qty = '2';
    state.receipt.updated_at = '2026-09-24T10:10:00.654321+00:00';
    state.receipt.confirmation = { ...state.receipt.confirmation, can_confirm: false, confirmed_by_id: 7, confirmed_by_name: 'Synthetic receiver', confirmed_at: state.receipt.updated_at };
    await route.fulfill({ json: state.receipt }); return true;
  } });
}

test('recorder confirms delivery without inspection authority and sees actual confirmation in review and print', async ({ page }, testInfo) => {
  const state = await setupConfirmation(page);
  const review = page.getByRole('complementary', { name: 'Goods receipt review' });
  await expect(review).toContainText('Awaiting confirmation');
  await expect(review).toContainText('Synthetic receiver');
  await expect(review.getByText('Technical inspector', { exact: true }).locator('..')).toContainText('Not recorded');
  await page.getByRole('complementary', { name: 'Goods receipt review' }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true });
  await expect(details.getByRole('combobox', { name: 'Overall quality', exact: true })).toHaveCount(0);
  await expect(details.getByRole('button', { name: 'Accept receipt', exact: true })).toHaveCount(0);
  await details.getByRole('textbox', { name: 'Confirmation notes (optional)', exact: true }).fill('Delivery count checked against reference');
  await page.screenshot({ path: testInfo.outputPath('recorder-confirmation-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await details.getByRole('textbox', { name: 'Confirmation notes (optional)', exact: true }).scrollIntoViewIfNeeded();
  const confirmationButton = details.getByRole('button', { name: 'Confirm delivery', exact: true });
  const buttonBounds = await confirmationButton.boundingBox();
  expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(390);
  expect(buttonBounds.y + buttonBounds.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: testInfo.outputPath('recorder-confirmation-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await details.getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  await expect(details).toContainText('Delivery confirmed');
  await expect(details.getByText('Confirmed By', { exact: true }).locator('..')).toContainText('Synthetic receiver');
  await expect(details.getByText('Confirmed At', { exact: true }).locator('..')).toContainText('14:10');
  await expect(details).not.toContainText('RECORDED PASS');
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].data).toEqual({ expected_updated_at: token, notes: 'Delivery count checked against reference' });
  expect(state.posts[0].path).toMatch(/\/confirm_delivery\/$/);
  await details.getByRole('button', { name: 'Print Preview', exact: true }).click();
  const preview = page.getByRole('dialog', { name: /Print Preview/ });
  await expect(preview.getByText('Delivery Confirmed By', { exact: true }).locator('..')).toContainText('Synthetic receiver');
  await expect(preview).toContainText('DELIVERY CONFIRMED');
  await expect(preview).not.toContainText('RECORDED PASS');
  expect(state.errors).toEqual([]);
});

for (const blockedReason of ['Only the person who recorded this receipt can confirm delivery.', 'Complete a purchase order approval route before progressing this order.']) {
  test(`blocked delivery confirmation explains the reason: ${blockedReason}`, async ({ page }) => {
    const state = await setupConfirmation(page, { blockedReason });
    const review = page.getByRole('complementary', { name: 'Goods receipt review' });
    await expect(review).toContainText(blockedReason);
    await expect(review).toContainText('Synthetic receiver');
    await expect(review.getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Open receipt', exact: true }).click();
    const confirmation = page.getByRole('region', { name: 'Delivery confirmation', exact: true });
    await expect(confirmation).toContainText(blockedReason);
    await expect(confirmation.getByRole('link', { name: /Open purchase order/ })).toHaveAttribute('href', '/procurement/orders/po-1');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
    expect(state.posts).toHaveLength(0);
    expect(state.errors).toEqual([]);
  });
}

test('stale delivery confirmation preserves notes and requires explicit refresh before retry', async ({ page }) => {
  const state = await setupConfirmation(page, { failure: 409 });
  await page.getByRole('complementary', { name: 'Goods receipt review' }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  await page.getByRole('textbox', { name: 'Confirmation notes (optional)', exact: true }).fill('Retain this checked delivery reference');
  await page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This record changed');
  await expect(page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true }).getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Confirmation notes (optional)', exact: true })).toHaveValue('Retain this checked delivery reference');
  await page.getByRole('button', { name: 'Refresh receipt details', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Confirmation notes (optional)', exact: true })).toHaveValue('Retain this checked delivery reference');
  await page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true })).toContainText('Delivery confirmed');
  expect(state.posts).toHaveLength(2);
  expect(state.posts[1].data).toEqual({ expected_updated_at: '2026-09-24T10:05:00.654321+00:00', notes: 'Retain this checked delivery reference' });
  expect(state.errors).toEqual([]);
});

for (const failure of [403, 500]) {
  test(`delivery confirmation HTTP ${failure} preserves notes without showing success`, async ({ page }) => {
    const state = await setupConfirmation(page, { failure });
    await page.getByRole('complementary', { name: 'Goods receipt review' }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
    await page.getByRole('textbox', { name: 'Confirmation notes (optional)', exact: true }).fill('Keep this evidence for retry');
    await page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(failure === 403 ? 'Your receipt access was revoked' : 'could not be saved');
    await expect(page.getByRole('textbox', { name: 'Confirmation notes (optional)', exact: true })).toHaveValue('Keep this evidence for retry');
    await expect(page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true })).not.toContainText('Delivery confirmed');
    expect(state.posts).toHaveLength(1);
    expect(state.receipt.status).toBe('pending');
    expect(state.errors).toEqual([]);
  });
}

test('missing server confirmation metadata leaves confirmation unavailable', async ({ page }) => {
  const state = await setupConfirmation(page, { missingMetadata: true });
  await page.getByRole('button', { name: 'Open receipt', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Delivery confirmation', exact: true })).toContainText('availability could not be verified');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
  expect(state.posts).toHaveLength(0);
});

test('delivery confirmation cannot silently discard unsaved technical review entries', async ({ page }) => {
  const state = await setupConfirmation(page, { technicalAuthority: true });
  await page.getByRole('complementary', { name: 'Goods receipt review' }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  await page.getByRole('combobox', { name: 'Overall quality', exact: true }).selectOption('false');
  await page.getByRole('textbox', { name: 'Rejection reason', exact: true }).fill('Technical review still in progress');
  await expect(page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true }).getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Delivery confirmation', exact: true })).toContainText('Technical review entries are unsaved');
  expect(state.posts).toHaveLength(0);
  await page.getByRole('button', { name: 'clear technical review entries', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Overall quality', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Rejection reason', exact: true })).toHaveValue('');
  await expect(page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true }).getByRole('button', { name: 'Confirm delivery', exact: true })).toBeEnabled();
});

test('accepted service receipt displays value and currency in details and print preview', async ({ page }) => {
  const serviceReceipt = { ...receipt, status: 'accepted', items_received: [{ line_id: 'service:total', basis: 'service_value', item: 'Synthetic service', uom: 'AED', ordered_amount: '1000.00', received_amount: '125.25', accepted_amount: '125.25', rejected_amount: '0.00' }] };
  const state = await setup(page, { view: 'receipts', custom: async (route, state, url) => {
    state.receipt = serviceReceipt;
    if (url.pathname.endsWith('/receipts/') && route.request().method() === 'GET') { await route.fulfill({ json: pageData([serviceReceipt]) }); return true; }
  } });
  await expect(page.getByRole('heading', { name: 'Service acceptance value', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open receipt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Service Acceptance Details' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Receipt details and evidence' })).toContainText('125.25 AED');
  await page.getByRole('button', { name: 'Print Preview', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Print Preview/ }).getByRole('heading', { name: 'SERVICE ACCEPTANCE', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Print Preview/ })).toContainText('125.25');
  expect(state.errors).toEqual([]);
});

test.describe('date-only receipt display in a timezone behind UTC', () => {
  test.use({ timezoneId: 'America/New_York' });
  test('recorded receipt day remains unchanged in details and print preview', async ({ page }) => {
    const state = await setup(page, { view: 'receipts', custom: async (route, state, url) => {
      if (url.pathname.endsWith('/receipts/') && route.request().method() === 'GET') {
        await route.fulfill({ json: pageData([state.receipt]) });
        return true;
      }
    } });
    await page.getByRole('button', { name: 'Open receipt', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true });
    await expect(details).toContainText(/24 Sept? 2026/);
    await expect(details).not.toContainText(/23 Sept? 2026/);
    await page.getByRole('button', { name: 'Print Preview', exact: true }).click();
    const preview = page.getByRole('dialog', { name: /Print Preview/ });
    const receiptDateRow = preview.getByRole('row').filter({ has: page.getByText('Receipt Date', { exact: true }) });
    await expect(receiptDateRow).toContainText(/24 Sept? 2026/);
    await expect(receiptDateRow).not.toContainText(/23 Sept? 2026/);
    expect(state.errors).toEqual([]);
  });
});

test('stale reconciliation preserves reason/value and requires refreshed balances plus confirmation', async ({ page }) => {
  let stale = true;
  const state = await setup(page, { service: true, reconciliation: true, custom: async (route, state, url) => {
    if (url.pathname.endsWith('/reconcile/') && stale) { stale = false; state.summary.po_updated_at = '2026-09-24T10:01:00.654321+00:00'; await route.fulfill({ status: 409, json: { detail: 'Order changed.' } }); return true; }
  } });
  await page.getByLabel(/^Receipt Date/).fill('2026-08-31');
  await page.getByLabel('Delivery Note / Reference', { exact: true }).fill('SYN-LATE-REF');
  await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Retain historic receipt details');
  await page.getByRole('spinbutton', { name: 'Received value for Synthetic service' }).fill('125.25');
  await page.getByLabel('Reconciliation reason').fill('Delivery evidence received late');
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Record reconciliation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Record reconciliation', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Refresh receipt balances' }).click();
  await expect(page.getByLabel('Reconciliation reason')).toHaveValue('Delivery evidence received late');
  await expect(page.getByLabel(/^Receipt Date/)).toHaveValue('2026-08-31');
  await expect(page.getByLabel('Delivery Note / Reference', { exact: true })).toHaveValue('SYN-LATE-REF');
  await expect(page.getByRole('textbox', { name: 'Remarks', exact: true })).toHaveValue('Retain historic receipt details');
  await expect(page.getByRole('spinbutton', { name: 'Received value for Synthetic service' })).toHaveValue('125.25');
  await expect(page.getByRole('checkbox', { name: /I reviewed/ })).not.toBeChecked();
  await page.getByRole('checkbox', { name: /I reviewed/ }).check();
  await page.getByRole('button', { name: 'Record reconciliation', exact: true }).click();
  await expect(page.getByText('Saved receipt receipt-1')).toBeVisible();
  expect(state.posts[1].data).toMatchObject({ expected_po_updated_at: state.summary.po_updated_at, reason: 'Delivery evidence received late', receipt_date: '2026-08-31', delivery_note_number: 'SYN-LATE-REF', notes: 'Retain historic receipt details', items_received: [{ line_id: 'service:total', received_amount: '125.25', rejected_amount: '0' }] });
});

test('receipt workspace exposes missing-evidence queue and opens preselected reconciliation', async ({ page }) => {
  const state = await setup(page, { view: 'receipts' });
  await page.getByRole('button', { name: 'Completed POs missing receipt evidence' }).click();
  await page.getByRole('button', { name: 'Reconcile receipt', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Reconcile receipt evidence' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(order.po_number);
  expect(state.reads.some(url => url.searchParams.get('queue') === 'reconciliation')).toBe(true);
  expect(state.errors).toEqual([]);
});

test('queue search/pagination uses server requests and reload resets an empty later page', async ({ page }) => {
  let shortened = false;
  const state = await setup(page, { view: 'finance', custom: async (route, state, url) => {
    if (!url.pathname.endsWith('/awaiting-purchase-orders/')) return;
    const second = url.searchParams.get('page') === '2';
    await route.fulfill({ json: { count: shortened ? 1 : 21, results: [{ ...order, po_number: second ? 'SYN-PAGE-2' : 'SYN-PAGE-1' }], next: null, previous: null } });
    if (second) shortened = true;
    return true;
  } });
  await page.getByRole('button', { name: 'POs awaiting supplier invoice' }).click();
  await page.getByRole('button', { name: 'Next PO page' }).click();
  await expect(page.getByText('SYN-PAGE-2')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh purchase orders', exact: true }).click();
  await expect(page.getByText('SYN-PAGE-1')).toBeVisible();
  await expect(page.getByText('Page 1 of 1', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search purchase orders' }).fill('OLD-PO');
  await expect(page.getByText('SYN-PAGE-1')).toBeVisible();
  expect(state.reads.some(url => url.searchParams.get('search') === 'OLD-PO' && url.searchParams.get('page') === '1')).toBe(true);
});

test('denied and empty PO queues explain their state without an enabled action', async ({ page }) => {
  let denied = true;
  await setup(page, { view: 'finance', custom: async (route, state, url) => {
    if (!url.pathname.endsWith('/awaiting-purchase-orders/')) return;
    await route.fulfill(denied ? { status: 403, json: { detail: 'Denied' } } : { json: pageData([]) }); return true;
  } });
  await page.getByRole('button', { name: 'POs awaiting supplier invoice' }).click();
  await expect(page.getByRole('alert')).toContainText('You do not have access');
  denied = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No purchase orders are awaiting a supplier invoice.')).toBeVisible();
});

test('invoice register displays and searches confirmed PO reference', async ({ page }) => {
  const state = await setup(page, { view: 'finance' });
  await expect(page.locator('.incoming-po')).toHaveText(order.po_number);
  await page.getByRole('textbox', { name: 'Search invoices' }).fill(order.po_number);
  await expect(page.getByRole('button', { name: invoice.invoice_number, exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('confirmed PO references link separately in register, cards and review without opening the invoice row', async ({ page }) => {
  const state = await setup(page, { view: 'finance', custom: async (route, state, url) => {
    state.invoice.confirmed_po_references = [{ id: 'po-1', po_number: 'SYN-PO-001' }, { id: 'po-2', po_number: 'SYN-PO-002' }];
    const other = { ...state.invoice, id: 'invoice-2', invoice_number: 'SYN-INV-002', confirmed_po_references: [], po_reference_text: 'CAPTURED-ONLY' };
    if (url.pathname.endsWith('/finance/invoices/')) { await route.fulfill({ json: pageData([state.invoice, other]) }); return true; }
    if (url.pathname.endsWith('/finance/invoices/invoice-2/')) { await route.fulfill({ json: other }); return true; }
  } });
  const firstRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'SYN-INV-001', exact: true }) });
  await expect(firstRow.getByRole('link', { name: 'SYN-PO-001' })).toHaveAttribute('href', '/procurement/orders/po-1');
  await expect(firstRow.getByRole('link', { name: 'SYN-PO-002' })).toHaveAttribute('href', '/procurement/orders/po-2');
  await page.getByRole('button', { name: 'SYN-INV-002', exact: true }).click();
  const review = page.getByRole('complementary', { name: 'Invoice review' });
  await expect(review.getByRole('heading', { name: 'SYN-INV-002', exact: true })).toBeVisible();
  await expect(review.getByRole('link', { name: 'CAPTURED-ONLY' })).toHaveCount(0);
  await expect(review).toContainText('CAPTURED-ONLY');
  const firstPo = firstRow.getByRole('link', { name: 'SYN-PO-001' });
  await firstPo.evaluate(element => element.addEventListener('click', event => event.preventDefault(), { once: true }));
  await firstPo.click();
  await firstPo.dispatchEvent('dblclick');
  await expect(review.getByRole('heading', { name: 'SYN-INV-002', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/purchase-order-handoff\.html\?view=finance/);
  await page.getByRole('button', { name: 'SYN-INV-001', exact: true }).click();
  await expect(review.getByRole('link', { name: 'SYN-PO-002' })).toHaveAttribute('href', '/procurement/orders/po-2');
  await page.getByRole('button', { name: 'Invoice cards', exact: true }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('button', { name: 'SYN-INV-001', exact: true }) });
  await expect(card.getByRole('link', { name: 'SYN-PO-001' })).toHaveAttribute('href', '/procurement/orders/po-1');
  await card.getByRole('link', { name: 'SYN-PO-002' }).click();
  await expect(page).toHaveURL(/\/procurement\/orders\/po-2$/);
  expect(state.errors).toEqual([]);
});

test('awaiting invoice imports actual PDF with preselected PO and requires explicit match confirmation', async ({ page }) => {
  const state = await setup(page, { view: 'finance' });
  await page.getByRole('button', { name: 'POs awaiting supplier invoice' }).click();
  await page.getByRole('region', { name: 'POs awaiting supplier invoice' }).getByRole('button', { name: 'Import invoice' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%synthetic test invoice\n%%EOF') });
  await page.getByRole('button', { name: 'Capture and Review' }).click();
  await expect(page.getByRole('combobox', { name: 'Select PO (optional)' })).toHaveValue(order.id);
  await page.getByRole('button', { name: 'Validate and Record' }).click();
  await expect(page.getByRole('alert')).toContainText('Confirm the PO match checkbox');
  expect(state.posts.filter(item => item.path.endsWith('/import-reviewed/'))).toHaveLength(0);
  await page.getByRole('checkbox', { name: /I confirm this PO match/ }).check();
  await page.getByRole('button', { name: 'Validate and Record' }).click();
  await expect(page.getByRole('heading', { name: 'Invoice recorded', exact: true })).toBeVisible();
  const imported = state.posts.find(item => item.path.endsWith('/import-reviewed/'));
  expect(imported.raw).toContain('synthetic-invoice.pdf');
  expect(imported.raw).toContain('"confirmed_po_id":"po-1"');
  expect(imported.raw).toContain('"confirm_po_match":true');
  expect(state.errors).toEqual([]);
});

test('existing invoice match retains entered amount/reason after conflict and refreshes exact token', async ({ page }) => {
  let first = true;
  const state = await setup(page, { view: 'match', custom: async (route, state, url) => {
    if (url.pathname.endsWith('/allocate-purchase-order/') && first) { first = false; state.invoice.updated_at = '2026-09-24T10:03:00.123456+00:00'; await route.fulfill({ status: 409, json: { detail: 'Changed' } }); return true; }
  } });
  await page.getByRole('combobox', { name: 'Select purchase order' }).selectOption(order.id);
  await page.getByRole('spinbutton', { name: 'Allocated amount (AED)' }).fill('12.25');
  await page.getByLabel('Matching reason').fill('Confirmed supplier reference');
  await page.getByRole('checkbox', { name: /I confirm this purchase order/ }).check();
  await page.getByRole('button', { name: 'Confirm PO match' }).click();
  await page.getByRole('button', { name: 'Refresh invoice details' }).click();
  await expect(page.getByLabel('Matching reason')).toHaveValue('Confirmed supplier reference');
  await expect(page.getByRole('spinbutton', { name: 'Allocated amount (AED)' })).toHaveValue('12.25');
  await page.getByRole('checkbox', { name: /I confirm this purchase order/ }).check();
  await page.getByRole('button', { name: 'Confirm PO match' }).click();
  await expect(page.getByText('Saved invoice match')).toBeVisible();
  expect(state.posts[1].data.expected_updated_at).toBe(state.invoice.updated_at);
});


async function setupReceiptActions(page, { confirmationBlock = '', deletionBlock = '', status = 'pending', failure = null } = {}) {
  let attempted = false;
  return setup(page, { view: 'receipts', custom: async (route, state, url) => {
    if (!state.actionsReady) {
      state.actionsReady = true;
      state.receipt = { ...state.receipt, status, purchase_order: order.id, received_by_name: 'Synthetic receiver',
        capabilities: { accept: false, reject: false, export: true, delete: !deletionBlock },
        confirmation: { can_confirm: status === 'pending' && !confirmationBlock, blocked_reason: confirmationBlock, responsible_user_name: 'Synthetic receiver' },
        deletion: { can_delete: !deletionBlock, blocked_reason: deletionBlock },
      };
    }
    if (url.pathname.endsWith('/receipts/') && route.request().method() === 'GET') {
      await route.fulfill({ json: pageData(state.deleted ? [] : [state.receipt]) }); return true;
    }
    if (url.pathname.endsWith('/receipts/receipt-1/') && route.request().method() === 'DELETE') {
      if (failure && !attempted) {
        attempted = true;
        if (failure === 409) state.receipt.updated_at = '2026-09-24T11:10:00.654321+00:00';
        if (failure === 404) state.deleted = true;
        await route.fulfill({ status: failure, json: { detail: failure === 403 ? 'You do not have permission to delete this receipt.' : failure === 409 ? 'Receipt changed.' : failure === 404 ? 'Not found.' : 'Receipt could not be deleted. Try again.' } }); return true;
      }
      state.deleted = true;
      await route.fulfill({ status: 204 }); return true;
    }
  } });
}

test('register exposes confirm and delete, with the PO blocker visible while pending deletion remains available', async ({ page }, testInfo) => {
  const block = 'Complete a purchase order approval route before progressing this order.';
  const state = await setupReceiptActions(page, { confirmationBlock: block });
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'SYN-GR-001', exact: true }) });
  await expect(row.getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
  await expect(row).toContainText(block);
  await expect(row.getByRole('button', { name: 'Delete receipt', exact: true })).toBeEnabled();
  const rowDeleteBounds = await row.getByRole('button', { name: 'Delete receipt', exact: true }).boundingBox();
  const registerBounds = await page.getByRole('region', { name: 'Goods receipt register', exact: true }).boundingBox();
  expect(rowDeleteBounds.x + rowDeleteBounds.width).toBeLessThanOrEqual(registerBounds.x + registerBounds.width);
  await page.screenshot({ path: testInfo.outputPath('receipt-register-actions-desktop.png'), fullPage: true });
  await row.getByRole('button', { name: 'Open', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Goods Receipt Details' });
  await expect(detail.getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
  await expect(detail.getByRole('button', { name: 'Delete receipt', exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await detail.getByRole('button', { name: 'Delete receipt', exact: true }).boundingBox();
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('receipt-actions-blocked-mobile.png'), fullPage: true });
  expect(state.posts).toHaveLength(0);
});

test('delete cancellation preserves confirmation notes and makes no delete request', async ({ page }) => {
  const state = await setupReceiptActions(page);
  await page.getByRole('region', { name: 'Goods receipt register', exact: true }).getByRole('button', { name: 'Confirm delivery', exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Goods Receipt Details' });
  await detail.getByRole('textbox', { name: 'Confirmation notes (optional)' }).fill('Keep these checked quantities');
  await detail.getByRole('button', { name: 'Delete receipt', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: 'Delete goods receipt?' });
  await expect(deletion).toContainText('SYN-GR-001');
  await expect(deletion).toContainText('SYN-PO-001');
  await expect(deletion.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(detail.getByRole('textbox', { name: 'Confirmation notes (optional)' })).toHaveValue('Keep these checked quantities');
  expect(state.posts).toHaveLength(0);
});

test('explicit delete sends the exact version and refreshes register and receiving metrics after success', async ({ page }, testInfo) => {
  const state = await setupReceiptActions(page);
  const register = page.getByRole('region', { name: 'Goods receipt register', exact: true });
  await register.getByRole('button', { name: 'Delete receipt', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: 'Delete goods receipt?' });
  await expect(deletion.getByRole('button', { name: 'Delete receipt', exact: true })).toBeEnabled();
  expect(state.posts).toHaveLength(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const deleteDialogBounds = await deletion.boundingBox();
  expect(deleteDialogBounds.x).toBeGreaterThanOrEqual(10);
  expect(deleteDialogBounds.y).toBeGreaterThanOrEqual(10);
  expect(deleteDialogBounds.x + deleteDialogBounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('receipt-delete-mobile.png'), fullPage: true });
  await deletion.getByRole('button', { name: 'Delete receipt', exact: true }).click();
  await expect(deletion).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Receipt SYN-GR-001 deleted.');
  await expect(register).toContainText('No receipts match this queue');
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].data).toEqual({ expected_updated_at: token });
  expect(state.reads.filter(url => url.pathname.endsWith('/inspection-summary/')).length).toBeGreaterThan(1);
  expect(state.errors).toEqual([]);
});

test('stale deletion stays open and requires explicit refresh before a new attempt', async ({ page }) => {
  const state = await setupReceiptActions(page, { failure: 409 });
  await page.getByRole('region', { name: 'Goods receipt register', exact: true }).getByRole('button', { name: 'Delete receipt', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: 'Delete goods receipt?' });
  await deletion.getByRole('button', { name: 'Delete receipt', exact: true }).click();
  await expect(deletion.getByRole('alert')).toContainText('This record changed');
  await expect(deletion.getByRole('button', { name: 'Delete receipt', exact: true })).toBeDisabled();
  expect(state.posts).toHaveLength(1);
  await deletion.getByRole('button', { name: 'Refresh receipt details' }).click();
  await expect(deletion.getByRole('button', { name: 'Delete receipt', exact: true })).toBeEnabled();
  expect(state.posts).toHaveLength(1);
  await deletion.getByRole('button', { name: 'Delete receipt', exact: true }).click();
  await expect(deletion).toHaveCount(0);
  expect(state.posts[1].data).toEqual({ expected_updated_at: '2026-09-24T11:10:00.654321+00:00' });
});

for (const failure of [403, 500]) {
  test(`delete HTTP ${failure} retains the named receipt and shows no success`, async ({ page }) => {
    const state = await setupReceiptActions(page, { failure });
    await page.getByRole('region', { name: 'Goods receipt register', exact: true }).getByRole('button', { name: 'Delete receipt', exact: true }).click();
    const deletion = page.getByRole('dialog', { name: 'Delete goods receipt?' });
    await deletion.getByRole('button', { name: 'Delete receipt', exact: true }).click();
    await expect(deletion.getByRole('alert')).toContainText(failure === 403 ? 'permission' : 'could not be deleted');
    await expect(deletion).toContainText('SYN-GR-001');
    expect(state.deleted).not.toBe(true);
    expect(state.posts).toHaveLength(1);
    await deletion.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Goods receipt register', exact: true })).toContainText('SYN-GR-001');
    await expect(page.getByText('Receipt SYN-GR-001 deleted.')).toHaveCount(0);
  });
}

test('already removed receipt offers register refresh without claiming deletion succeeded', async ({ page }) => {
  const state = await setupReceiptActions(page, { failure: 404 });
  await page.getByRole('region', { name: 'Goods receipt register', exact: true }).getByRole('button', { name: 'Delete receipt', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: 'Delete goods receipt?' });
  await deletion.getByRole('button', { name: 'Delete receipt', exact: true }).click();
  await expect(deletion.getByRole('alert')).toContainText('no longer available');
  await expect(deletion.getByRole('button', { name: 'Delete receipt', exact: true })).toBeDisabled();
  await deletion.getByRole('button', { name: 'Refresh register' }).click();
  await expect(page.getByRole('status')).toContainText('Receipt no longer available');
  await expect(page.getByText('Receipt SYN-GR-001 deleted.')).toHaveCount(0);
  expect(state.posts).toHaveLength(1);
});

for (const status of ['accepted', 'pending']) {
  test(`deletion blocked for ${status === 'accepted' ? 'confirmed evidence' : 'denied delete permission'} in list, card and detail`, async ({ page }) => {
    const deletionBlock = status === 'accepted' ? 'Confirmed or decided receipts cannot be deleted.' : 'You do not have permission to delete this receipt.';
    const state = await setupReceiptActions(page, { status, deletionBlock });
    const register = page.getByRole('region', { name: 'Goods receipt register', exact: true });
    await expect(register.getByRole('button', { name: 'Delete receipt', exact: true })).toBeDisabled();
    await expect(register).toContainText(deletionBlock);
    await page.getByRole('button', { name: 'Card view', exact: true }).click();
    await expect(register.getByRole('button', { name: 'Delete receipt', exact: true })).toBeDisabled();
    await register.getByRole('button', { name: 'Open', exact: true }).click();
    const detail = page.getByRole('dialog', { name: 'Goods Receipt Details' });
    await expect(detail.getByRole('button', { name: 'Delete receipt', exact: true })).toBeDisabled();
    await expect(detail).toContainText(deletionBlock);
    expect(state.posts).toHaveLength(0);
  });
}
