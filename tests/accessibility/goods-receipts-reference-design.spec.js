import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.setTimeout(120000);
test.use({ serviceWorkers: 'block', actionTimeout: 10000, navigationTimeout: 90000, timezoneId: 'Asia/Dubai' });

const token = '2026-09-28T06:15:00.123456+00:00';
const receiptRows = ['pending', 'partial', 'accepted', 'pending', 'future_status'].map((status, index) => {
  const number = String(index + 1).padStart(3, '0');
  const pending = status === 'pending';
  return {
    id: `receipt-${index + 1}`, receipt_number: `SYN-GR-${number}`, purchase_order: `po-${index + 1}`,
    po_number: `SYN-PO-${number}`, vendor_id: index === 1 ? 'vendor-2' : 'vendor-1',
    vendor_name: index === 1 ? 'Synthetic marine services' : 'Synthetic engineering supplies',
    project_id: index === 1 ? 'project-2' : 'project-1', project_number: index === 1 ? '590002' : '590001',
    project_name: 'Synthetic receiving project', status, updated_at: token,
    receipt_date: '2026-09-28', created_at: `2026-09-28T0${index + 1}:00:00+00:00`,
    delivery_note_number: `SYN-DN-${number}`, received_by_name: 'Synthetic receiver', inspector_name: '',
    notes: `Delivery record ${number}`, quality_check_passed: index === 1 ? false : null,
    dimensional_check_passed: null, visual_inspection_passed: null, material_verification_passed: null,
    items_received: [{ line_id: `line:${index + 1}`, basis: 'quantity', item: `Synthetic valve ${number}`, uom: 'EA',
      ordered_qty: '10', received_qty: '2', accepted_qty: pending ? '2' : status === 'partial' ? '1' : '2',
      rejected_qty: status === 'partial' ? '1' : '0' }],
    attachments: index === 0 ? [{ id: 'file-1', name: 'Synthetic_Delivery_Note.pdf', url: '/synthetic-evidence/delivery.pdf' }] : [],
    evidence: { certificates: index === 1 ? { status: 'missing', required_count: 1, matched_count: 0 }
      : { status: 'unassessed', reason: 'Certificate requirements have not been assessed.' } },
    certificates_received: [], heat_numbers: [], ndt_performed: false,
    confirmation: { can_confirm: pending, blocked_reason: pending ? '' : 'Only pending receipts can be confirmed.',
      responsible_user_name: 'Synthetic receiver', confirmed_at: status === 'accepted' ? '2026-09-28T06:00:00+00:00' : null,
      confirmed_by_name: status === 'accepted' ? 'Synthetic receiver' : null },
    deletion: { can_delete: pending, blocked_reason: pending ? '' : 'Confirmed or decided receipts cannot be deleted.' },
    capabilities: { accept: false, reject: false, export: true, delete: pending },
  };
});

function filteredRows(rows, params, includeQueue = true) {
  return rows.filter(row => {
    const search = (params.get('search') || '').toLowerCase();
    if (search && ![row.receipt_number, row.po_number, row.vendor_name, row.project_number].some(value => value.toLowerCase().includes(search))) return false;
    for (const [filter, key] of [['status', 'status'], ['vendor', 'vendor_id'], ['project', 'project_id']]) {
      if (params.get(filter) && params.get(filter) !== row[key]) return false;
    }
    if (params.get('received_from') && row.receipt_date < params.get('received_from')) return false;
    if (params.get('received_to') && row.receipt_date > params.get('received_to')) return false;
    const queue = params.get('queue') || 'all';
    return !includeQueue || queue === 'all' || (queue === 'exceptions' ? row.quality_check_passed === false : row.status === queue);
  });
}

function summaryFor(rows, params) {
  const filtered = filteredRows(rows, params, false);
  const counts = Object.fromEntries(['pending', 'partial', 'accepted', 'rejected'].map(status => [status, filtered.filter(row => row.status === status).length]));
  counts.all = filtered.length;
  counts.exceptions = filtered.filter(row => row.quality_check_passed === false).length;
  return {
    schema_version: '1.0', as_of_date: '2026-09-28', generated_at: '2026-09-28T07:00:00+00:00',
    source_updated_at: token, filtered_count: filteredRows(rows, params).length, counts,
    kpis: { open_inspections: { value: counts.pending }, receipts_this_month: { value: filtered.length } },
    capabilities: { create: true, export: true, read_purchase_orders: true },
    filter_options: { vendors: [{ id: 'vendor-1', name: 'Synthetic engineering supplies' }, { id: 'vendor-2', name: 'Synthetic marine services' }],
      projects: [{ id: 'project-1', number: '590001' }, { id: 'project-2', number: '590002' }], inspectors: [] },
  };
}

async function setup(page, custom) {
  const state = { rows: structuredClone(receiptRows), reads: [], writes: [], errors: [] };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('radai_access_token', 'synthetic-token'); });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') state.reads.push(url);
    else state.writes.push({ path: url.pathname, data: request.postData() });
    if (custom && await custom(route, state, url)) return;
    let body = { count: 0, next: null, previous: null, results: [] };
    if (url.pathname.endsWith('/inspection-summary/')) body = summaryFor(state.rows, url.searchParams);
    else if (url.pathname.endsWith('/available-orders/')) body = { count: 1, next: null, previous: null, results: [{ id: 'po-1', po_number: 'SYN-PO-001', vendor_name: 'Synthetic engineering supplies', currency: 'AED', updated_at: token }] };
    else if (url.pathname.endsWith('/receiving-summary/')) body = { basis: 'quantity', po_updated_at: token, can_record: true,
      lines: [{ line_id: 'line:1', description: 'Synthetic valve 001', uom: 'EA', ordered: '10', accepted: '0', pending: '2', remaining: '10', available: '8' }] };
    else if (url.pathname.endsWith('/receipts/')) {
      const matches = filteredRows(state.rows, url.searchParams);
      const pageNumber = Number(url.searchParams.get('page') || 1);
      const pageSize = Number(url.searchParams.get('page_size') || 5);
      body = { count: matches.length, next: matches.length > pageNumber * pageSize ? '?page=2' : null,
        previous: null, results: matches.slice((pageNumber - 1) * pageSize, pageNumber * pageSize) };
    } else {
      const receipt = state.rows.find(row => url.pathname.endsWith(`/receipts/${row.id}/`));
      if (receipt) body = receipt;
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/tests/fixtures/purchase-order-handoff.html?view=receipts');
  return state;
}

const register = page => page.getByRole('region', { name: 'Goods receipt register', exact: true });
const review = page => page.getByRole('complementary', { name: 'Goods receipt review', exact: true });
const row = (page, number) => register(page).getByRole('row').filter({ hasText: `SYN-GR-${number}` });

test('reference layout uses actual receipt counts and separates the queue from selected delivery evidence', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1462, height: 891 });
  const state = await setup(page);
  await expect(page.getByRole('heading', { name: 'Goods Receipts & Delivery Confirmation', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Receipt queue', exact: true })).toBeVisible();
  await expect(review(page).getByRole('heading', { name: 'Delivery confirmation', exact: true })).toBeVisible();
  const cards = page.locator('.grw-kpi');
  await expect(cards).toHaveCount(4);
  for (const [label, count] of [['Awaiting confirmation', '2'], ['Partially accepted', '1'], ['Exceptions', '1'], ['Accepted receipts', '1']]) {
    await expect(cards.filter({ hasText: label }).locator('strong')).toHaveText(count);
  }
  await expect(page.getByText('Completed this month', { exact: true })).toHaveCount(0);
  await expect(review(page)).toContainText('SYN-DN-001');
  const receiptBasis = review(page).getByText('Receipt basis', { exact: true }).locator('..');
  await expect(receiptBasis).toContainText('Quantity');
  await expect(receiptBasis.locator('input, select')).toHaveCount(0);
  await expect(review(page).getByRole('link', { name: /Synthetic_Delivery_Note.pdf/ })).toHaveAttribute('href', '/synthetic-evidence/delivery.pdf');
  const activity = page.getByRole('region', { name: 'Recent receipt activity', exact: true });
  await expect(activity).toContainText('From receipts on this page');
  await expect(activity).toContainText('Delivery confirmed · SYN-GR-003');
  await expect(activity).not.toContainText('Evidence added');
  const queueBounds = await register(page).boundingBox();
  const reviewBounds = await review(page).boundingBox();
  expect(reviewBounds.x).toBeGreaterThan(queueBounds.x + queueBounds.width - 1);
  expect(Math.abs(reviewBounds.y - queueBounds.y)).toBeLessThan(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('goods-receipts-reference-desktop.png'), fullPage: true });
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('narrow layout contains table overflow and keeps selected details and actions usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);
  await expect(review(page)).toContainText('SYN-DN-001');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const queueBounds = await register(page).boundingBox();
  const reviewBounds = await review(page).boundingBox();
  expect(reviewBounds.y).toBeGreaterThan(queueBounds.y);
  await review(page).getByRole('button', { name: 'Confirm delivery', exact: true }).scrollIntoViewIfNeeded();
  const actionBounds = await review(page).getByRole('button', { name: 'Confirm delivery', exact: true }).boundingBox();
  expect(actionBounds.x).toBeGreaterThanOrEqual(0);
  expect(actionBounds.x + actionBounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('goods-receipts-reference-mobile.png'), fullPage: true });
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('receipt queue tabs and search request server-filtered results', async ({ page }) => {
  const state = await setup(page);
  await expect(row(page, '001')).toBeVisible();
  await page.getByRole('button', { name: /^Partial\s*1$/, exact: true }).click();
  await expect(row(page, '002')).toBeVisible();
  await expect(row(page, '001')).toHaveCount(0);
  expect(state.reads.some(url => url.pathname.endsWith('/receipts/') && url.searchParams.get('queue') === 'partial')).toBe(true);
  await page.getByRole('button', { name: /^All\s*5$/, exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search receipts', exact: true }).fill('SYN-PO-003');
  await expect(row(page, '003')).toBeVisible();
  await expect(row(page, '002')).toHaveCount(0);
  expect(state.reads.some(url => url.pathname.endsWith('/receipts/') && url.searchParams.get('search') === 'SYN-PO-003')).toBe(true);
  expect(state.writes).toEqual([]);
});

test('supplier, project and receipt status selections keep their server filter meanings', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('combobox', { name: 'Supplier', exact: true }).selectOption('vendor-2');
  await expect(row(page, '002')).toBeVisible();
  await page.getByRole('combobox', { name: 'Project', exact: true }).selectOption('project-2');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('partial');
  await expect.poll(() => state.reads.some(url => url.pathname.endsWith('/receipts/') && url.searchParams.get('vendor') === 'vendor-2' && url.searchParams.get('project') === 'project-2' && url.searchParams.get('status') === 'partial')).toBe(true);
  await expect(row(page, '002')).toBeVisible();
  await expect(row(page, '001')).toHaveCount(0);
  await page.getByRole('button', { name: 'More filters', exact: true }).click();
  await expect(page.getByLabel('Received from', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Received to', { exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('export downloads actual filtered receipt records', async ({ page }) => {
  const state = await setup(page);
  await expect(row(page, '001')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search receipts', exact: true }).fill('SYN-PO-003');
  await expect(row(page, '003')).toBeVisible();
  await expect(row(page, '001')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('RADAI-goods-receipts.csv');
  const content = await readFile(await download.path(), 'utf8');
  expect(content).toContain('"SYN-GR-003","SYN-PO-003"');
  expect(content).not.toContain('SYN-GR-001');
  expect(content).toContain('Delivery confirmed');
  expect(state.reads.some(url => url.pathname.endsWith('/receipts/') && url.searchParams.get('page_size') === '200' && url.searchParams.get('search') === 'SYN-PO-003')).toBe(true);
  expect(state.writes).toEqual([]);
});

test('custom receipt dates remain distinct from a selected calendar month', async ({ page }) => {
  const state = await setup(page);
  await expect(row(page, '001')).toBeVisible();
  const month = page.getByLabel('Receipt month', { exact: true });
  await expect(month).toHaveValue('');
  await expect(page.locator('.grw-period')).toContainText('All dates');
  await page.getByRole('button', { name: 'More filters', exact: true }).click();
  await page.getByLabel('Received from', { exact: true }).fill('2026-09-10');
  await page.getByLabel('Received to', { exact: true }).fill('2026-09-29');
  await expect.poll(() => state.reads.some(url => url.pathname.endsWith('/receipts/') && url.searchParams.get('received_from') === '2026-09-10' && url.searchParams.get('received_to') === '2026-09-29')).toBe(true);
  await expect(month).toHaveValue('');
  await expect(page.locator('.grw-period')).toContainText('Custom dates');
  await month.fill('2026-09');
  await expect(page.getByLabel('Received from', { exact: true })).toHaveValue('2026-09-01');
  await expect(page.getByLabel('Received to', { exact: true })).toHaveValue('2026-09-30');
  await expect.poll(() => state.reads.some(url => url.pathname.endsWith('/receipts/') && url.searchParams.get('received_from') === '2026-09-01' && url.searchParams.get('received_to') === '2026-09-30')).toBe(true);
  await expect(row(page, '001')).toBeVisible();
  await month.fill('2024-02');
  await expect(page.getByLabel('Received to', { exact: true })).toHaveValue('2024-02-29');
  await expect(register(page)).toContainText('No receipts match this queue');
  await expect(row(page, '001')).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

test('changing receipt selection discards a late response from the previous receipt', async ({ page }) => {
  let releaseFirst;
  let firstRequested = false;
  let firstSettled = false;
  const firstResponse = new Promise(resolve => { releaseFirst = resolve; });
  const state = await setup(page, async (route, current, url) => {
    if (!url.pathname.endsWith('/receipts/receipt-1/')) return false;
    firstRequested = true;
    await firstResponse;
    await route.fulfill({ json: { ...current.rows[0], delivery_note_number: 'STALE-DELIVERY-REFERENCE' } }).catch(() => {});
    firstSettled = true;
    return true;
  });
  await expect.poll(() => firstRequested).toBe(true);
  await row(page, '002').getByRole('button', { name: 'Review receipt SYN-GR-002', exact: true }).click();
  await expect(review(page)).toContainText('SYN-DN-002');
  releaseFirst();
  await expect.poll(() => firstSettled).toBe(true);
  await expect(review(page)).not.toContainText('STALE-DELIVERY-REFERENCE');
  await expect(review(page)).toContainText('SYN-GR-002');
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

for (const failure of [403, 500]) {
  test(`receipt detail HTTP ${failure} keeps decisions unavailable until explicit retry`, async ({ page }) => {
    let fail = true;
    const state = await setup(page, async (route, current, url) => {
      if (!fail || !url.pathname.endsWith('/receipts/receipt-1/')) return false;
      await route.fulfill({ status: failure, json: { detail: 'Synthetic unavailable receipt' } });
      return true;
    });
    await expect(review(page).getByRole('alert')).toContainText(failure === 403 ? 'You do not have access' : 'could not be loaded');
    await expect(review(page).getByRole('button', { name: 'Confirm delivery', exact: true })).toHaveCount(0);
    await expect(review(page)).not.toContainText('SYN-DN-001');
    fail = false;
    await review(page).getByRole('button', { name: 'Retry receipt details', exact: true }).click();
    await expect(review(page)).toContainText('SYN-DN-001');
    await expect(review(page).getByRole('button', { name: 'Confirm delivery', exact: true })).toBeEnabled();
    expect(state.writes).toEqual([]);
  });
}

test('unavailable summary counts stay unknown instead of displaying reference-image numbers', async ({ page }) => {
  const state = await setup(page, async (route, current, url) => {
    if (!url.pathname.endsWith('/inspection-summary/')) return false;
    await route.fulfill({ json: { ...summaryFor(current.rows, url.searchParams), counts: {}, kpis: {} } });
    return true;
  });
  await expect(row(page, '001')).toBeVisible();
  await expect(page.locator('.grw-kpi strong')).toHaveText(['—', '—', '—', '—']);
  expect(state.writes).toEqual([]);
});

test('acceptance requires a saved decision and unknown status cannot confirm delivery', async ({ page }) => {
  const state = await setup(page);
  await expect(review(page)).toContainText('SYN-DN-001');
  await expect(review(page).getByTestId('receipt-quantity-tiles').locator('[data-quantity="accepted_qty"] strong')).toContainText('—');
  await row(page, '003').getByRole('button', { name: 'Review receipt SYN-GR-003', exact: true }).click();
  await expect(review(page)).toContainText('SYN-DN-003');
  await expect(review(page).getByTestId('receipt-quantity-tiles').locator('[data-quantity="accepted_qty"] strong')).toHaveText('2EA');
  await row(page, '005').getByRole('button', { name: 'Review receipt SYN-GR-005', exact: true }).click();
  await expect(review(page)).toContainText('SYN-DN-005');
  await expect(review(page)).toContainText('Status not recorded');
  await expect(review(page).getByRole('button', { name: 'Confirm delivery', exact: true })).toBeDisabled();
  await expect(review(page)).not.toContainText('Delivery confirmed');
  expect(state.writes).toEqual([]);
});

test('a denied register refresh removes stale rows and retries without enabling record actions', async ({ page }) => {
  let denied = false;
  const state = await setup(page, async (route, current, url) => {
    if (!denied || !url.pathname.endsWith('/receipts/')) return false;
    await route.fulfill({ status: 403, json: { detail: 'Receipt register access denied.' } });
    return true;
  });
  await expect(review(page)).toContainText('SYN-DN-001');
  denied = true;
  await page.getByRole('button', { name: 'Refresh receipts', exact: true }).click();
  await expect(register(page).getByRole('alert')).toContainText('Receipt register access denied.');
  await expect(row(page, '001')).toHaveCount(0);
  await expect(review(page)).not.toContainText('SYN-DN-001');
  await expect(review(page).getByRole('button', { name: 'Confirm delivery', exact: true })).toHaveCount(0);
  denied = false;
  await register(page).getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(row(page, '001')).toBeVisible();
  await expect(review(page)).toContainText('SYN-DN-001');
  expect(state.writes).toEqual([]);
});

test('record receipt opens the delivery form without unsupported draft or upload actions', async ({ page }) => {
  const state = await setup(page);
  await expect(row(page, '001')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Report exception', exact: true })).toHaveCount(0);
  await expect(review(page).locator('input[type="file"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Record goods receipt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Purchase Order', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Record receipt', exact: true })).toBeDisabled();
  await dialog.getByRole('combobox', { name: 'Purchase Order', exact: true }).selectOption('po-1');
  await expect(dialog.getByLabel('Delivery Note No.', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel(/^Delivery Date/)).toBeVisible();
  await expect(dialog.getByLabel(/^Delivery Location/)).toBeVisible();
  await expect(dialog.getByLabel(/^Condition/)).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Remarks', exact: true })).toBeVisible();
  await expect(dialog.getByRole('spinbutton', { name: 'Received quantity for Synthetic valve 001', exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});
