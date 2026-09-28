import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(120000);
test.use({ serviceWorkers: 'block', actionTimeout: 12000, navigationTimeout: 90000, timezoneId: 'Asia/Dubai' });

const token = '2026-09-28T06:15:00.123456+00:00';
const order = { id: 'po-delivery-1', po_number: 'SYN-PO-0085_JUL2026', title: 'Synthetic materials', vendor_name: 'Synthetic supplier', status: 'approved', currency: 'USD', project_number: '5900828', updated_at: token };
const profile = { user: { id: 'synthetic-recorder', first_name: 'Synthetic', last_name: 'Recorder', email: 'receipt-fixture@example.invalid' }, location: 'Synthetic project office' };
const line = { line_id: 'line:10', description: 'Synthetic pipe', uom: 'EA', ordered: '10', accepted: '4', pending: '1', remaining: '6', available: '5' };
const dialog = page => page.getByRole('dialog');
const panel = page => dialog(page).getByRole('region', { name: 'Delivery information', exact: true });
const location = page => page.getByLabel(/^Delivery Location/);
const condition = page => page.getByLabel(/^Condition/);
const quantity = page => page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe', exact: true });
const record = page => page.getByRole('button', { name: 'Record receipt', exact: true });
const statusButton = (page, name) => panel(page).getByRole('group', { name: /^Delivery Status/ }).getByRole('button', { name, exact: true });
const pageData = rows => ({ count: rows.length, next: null, previous: null, results: rows });

async function setup(page, { service = false, custom } = {}) {
  const state = { posts: [], reads: [], errors: [], summary: { basis: service ? 'service_value' : 'quantity', currency: 'USD', po_updated_at: token, can_record: true, can_reconcile: false, lines: service ? [{ ...line, line_id: 'service:total', description: 'Synthetic service', uom: 'USD', ordered: '1000.00', accepted: '0', pending: '0', remaining: '1000.00', available: '1000.00' }] : [line] } };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(value => {
    window.handoffFixture = { order: value };
    localStorage.setItem('radai_access_token', 'synthetic-token');
  }, order);
  await page.route('**/tests/fixtures/purchase-order-handoff.html*', async route => {
    const response = await route.fetch();
    const html = await response.text();
    const shell = '<style>#fixture-sidebar{position:fixed;inset:0 auto 0 0;width:226px;background:#092840;color:white;padding:20px}#application-content{margin-left:226px}#fixture-header{height:50px;background:white;border-bottom:1px solid #d6e4f1}#application-content>main{height:calc(100vh - 50px);position:relative;overflow:auto}@media(max-width:700px){#fixture-sidebar{display:none}#application-content{margin-left:0}}</style><aside id="fixture-sidebar">Existing sidebar</aside><div id="application-content"><header id="fixture-header"></header><main><div id="handoff-test"></div></main></div>';
    await route.fulfill({ response, body: html.replace('<div id="handoff-test"></div>', shell) });
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') state.reads.push(url);
    else state.posts.push({ path: url.pathname, data: request.postDataJSON() });
    if (custom && await custom(route, state, url)) return;
    let body = pageData([]);
    if (url.pathname.endsWith('/rbac/users/me/')) body = profile;
    else if (url.pathname.endsWith('/receiving-summary/')) body = state.summary;
    else if (url.pathname.endsWith('/available-orders/')) body = pageData([order]);
    else if (url.pathname.endsWith(`/orders/${order.id}/`)) body = order;
    else if (url.pathname.endsWith('/receipts/') && request.method() === 'POST') {
      const payload = request.postDataJSON();
      body = { ...payload, id: 'receipt-delivery-1', status: 'pending', received_by: profile.user.id, received_by_name: 'Synthetic Recorder' };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/tests/fixtures/purchase-order-handoff.html?view=creator');
  await expect(panel(page)).toBeVisible();
  await expect(page.getByRole('combobox', { name: /^Received By/ })).toContainText('Synthetic Recorder');
  await page.evaluate(() => document.fonts.ready);
  return state;
}

async function fillDelivery(page) {
  await location(page).fill('Synthetic receiving office');
  await condition(page).selectOption('good');
  await page.getByLabel('Delivery Note No.', { exact: true }).fill('SYN-DN-0918');
  await page.getByLabel('Supplier Reference', { exact: true }).fill('SYN-INV-104');
  await page.getByLabel(/^Delivery Date/).fill('2026-09-28');
}

test('delivery panel matches four paired rows, compact typography and the reference controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  const state = await setup(page);
  await fillDelivery(page);
  await page.getByRole('button', { name: 'Copy remaining quantities', exact: true }).click();
  const fields = [
    panel(page).getByRole('group', { name: /^Receipt Type/ }), page.getByLabel(/^Delivery Date/),
    page.getByRole('combobox', { name: /^Received By/ }), location(page),
    page.getByLabel('Delivery Note No.', { exact: true }), page.getByLabel('Supplier Reference', { exact: true }),
    condition(page), panel(page).getByRole('group', { name: /^Delivery Status/ }),
  ];
  const boxes = await Promise.all(fields.map(field => field.boundingBox()));
  for (let index = 0; index < boxes.length; index += 2) {
    expect(Math.abs(boxes[index].y - boxes[index + 1].y)).toBeLessThan(3);
    expect(boxes[index].x + boxes[index].width).toBeLessThan(boxes[index + 1].x);
    if (index) expect(boxes[index].y).toBeGreaterThan(boxes[index - 2].y + 40);
  }
  expect(boxes[0].width).toBeLessThanOrEqual(225);
  await expect(panel(page).getByRole('heading', { name: 'Delivery information', exact: true })).toHaveCSS('font-size', '16px');
  await expect(location(page)).toHaveCSS('font-size', '12px');
  await expect(location(page)).toHaveCSS('line-height', '18px');
  await expect(page.getByLabel(/^Delivery Date/)).toHaveCSS('padding-left', '32px');
  await expect(statusButton(page, 'Full')).toHaveAttribute('aria-pressed', 'true');
  await expect(panel(page).getByRole('group', { name: /^Receipt Type/ }).getByRole('button', { name: 'Goods', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: /^Received By/ })).toBeDisabled();
  await expect(panel(page)).toContainText('Partial or rejected receipts require an exception reason.');
  await expect(page.locator('#fixture-sidebar')).toHaveCSS('width', '226px');
  const accessibility = await new AxeBuilder({ page }).include('[aria-labelledby="receipt-delivery-title"]').analyze();
  await testInfo.attach('delivery-panel-axe.json', { body: JSON.stringify(accessibility.violations, null, 2), contentType: 'application/json' });
  expect(accessibility.violations.filter(value => ['critical', 'serious'].includes(value.impact))).toEqual([]);
  await panel(page).screenshot({ path: testInfo.outputPath('delivery-information-desktop.png') });
  await page.screenshot({ path: testInfo.outputPath('receipt-delivery-desktop.png'), fullPage: true });
  expect(state.posts).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('narrow delivery panel keeps every field usable without horizontal page overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);
  await fillDelivery(page);
  for (const control of [location(page), condition(page), page.getByLabel(/^Delivery Date/), statusButton(page, 'Full')]) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await panel(page).screenshot({ path: testInfo.outputPath('delivery-information-mobile.png') });
  await page.getByRole('button', { name: 'Copy remaining quantities', exact: true }).click();
  await record(page).click();
  await expect(page.getByText('Saved receipt receipt-delivery-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.delivery_location).toBe('Synthetic receiving office');
  expect(state.errors).toEqual([]);
});

test('delivery metadata persists in the pending command while recorder identity remains server owned', async ({ page }) => {
  const state = await setup(page);
  await expect(location(page)).toHaveValue('');
  await expect(page.locator('datalist option[value="Synthetic project office"]')).toHaveCount(1);
  await fillDelivery(page);
  await statusButton(page, 'Full').click();
  await expect(quantity(page)).toHaveValue('5');
  await record(page).click();
  await expect(page.getByText('Saved receipt receipt-delivery-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].data).toMatchObject({ delivery_location: 'Synthetic receiving office', supplier_reference: 'SYN-INV-104', condition: 'good', delivery_status: 'full', exception_reason: '', receipt_date: '2026-09-28', delivery_note_number: 'SYN-DN-0918', status: 'pending', expected_po_updated_at: token, quality_check_passed: null, visual_inspection_passed: null, items_received: [{ line_id: 'line:10', received_qty: '5', rejected_qty: '0' }] });
  for (const field of ['received_by', 'received_by_name', 'confirmed_by', 'confirmed_at']) expect(state.posts[0].data).not.toHaveProperty(field);
  expect(state.posts.some(post => /confirm|accept|reject_delivery/.test(post.path))).toBe(false);
  expect(state.reads.some(url => url.pathname.endsWith('/rbac/users/me/') && url.searchParams.get('view') === 'profile')).toBe(true);
  expect(state.errors).toEqual([]);
});

test('required delivery location and condition block submission without losing entered quantities', async ({ page }) => {
  const state = await setup(page);
  await statusButton(page, 'Full').click();
  await record(page).click();
  expect(state.posts).toEqual([]);
  expect(await location(page).evaluate(element => element.validity.valueMissing)).toBe(true);
  await location(page).fill('Synthetic receiving office');
  await record(page).click();
  expect(state.posts).toEqual([]);
  expect(await condition(page).evaluate(element => element.validity.valueMissing)).toBe(true);
  await expect(quantity(page)).toHaveValue('5');
  await condition(page).selectOption('not_inspected');
  await record(page).click();
  await expect(page.getByText('Saved receipt receipt-delivery-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.condition).toBe('not_inspected');
  expect(state.posts[0].data.status).toBe('pending');
});

for (const deliveryStatus of ['Partial', 'Rejected']) {
  test(`${deliveryStatus} requires a recorded exception and keeps the inspection command separate`, async ({ page }) => {
    const state = await setup(page);
    await fillDelivery(page);
    await quantity(page).fill('2');
    await statusButton(page, deliveryStatus).click();
    const reason = page.getByLabel(/^Exception reason/i);
    await expect(reason).toBeVisible();
    await record(page).click();
    expect(state.posts).toEqual([]);
    expect(await reason.evaluate(element => element.validity.valueMissing)).toBe(true);
    await reason.fill('Synthetic shipment exception');
    await record(page).click();
    await expect(page.getByText('Saved receipt receipt-delivery-1 (pending)', { exact: true })).toBeVisible();
    expect(state.posts[0].data).toMatchObject({ delivery_status: deliveryStatus.toLowerCase(), exception_reason: 'Synthetic shipment exception', status: 'pending', items_received: [{ line_id: 'line:10', received_qty: '2', rejected_qty: deliveryStatus === 'Rejected' ? '2' : '0' }] });
    expect(state.posts).toHaveLength(1);
    expect(state.errors).toEqual([]);
  });
}

for (const failure of [409, 500]) {
  test(`delivery HTTP ${failure} preserves all fields and uses the guarded retry`, async ({ page }) => {
    let failed = false;
    const state = await setup(page, { custom: async (route, current, url) => {
      if (!url.pathname.endsWith('/receipts/') || route.request().method() !== 'POST' || failed) return false;
      failed = true;
      if (failure === 409) current.summary.po_updated_at = '2026-09-28T06:16:00.654321+00:00';
      await route.fulfill({ status: failure, json: { detail: 'Receipt could not be saved.' } });
      return true;
    } });
    await fillDelivery(page);
    await quantity(page).fill('2');
    await statusButton(page, 'Partial').click();
    await page.getByLabel(/^Exception reason/i).fill('Synthetic outstanding shipment');
    await record(page).click();
    await expect(page.getByRole('alert')).toContainText(failure === 409 ? 'This record changed' : 'Receipt could not be saved');
    await expect(location(page)).toHaveValue('Synthetic receiving office');
    await expect(condition(page)).toHaveValue('good');
    await expect(page.getByLabel('Supplier Reference', { exact: true })).toHaveValue('SYN-INV-104');
    await expect(page.getByLabel('Delivery Note No.', { exact: true })).toHaveValue('SYN-DN-0918');
    await expect(page.getByLabel(/^Delivery Date/)).toHaveValue('2026-09-28');
    await expect(page.getByLabel(/^Exception reason/i)).toHaveValue('Synthetic outstanding shipment');
    await expect(statusButton(page, 'Partial')).toHaveAttribute('aria-pressed', 'true');
    if (failure === 409) {
      await expect(record(page)).toBeDisabled();
      await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
      await expect(record(page)).toBeEnabled();
    }
    await record(page).click();
    await expect(page.getByText('Saved receipt receipt-delivery-1 (pending)', { exact: true })).toBeVisible();
    expect(state.posts).toHaveLength(2);
    if (failure === 500) expect(state.posts[1].data.operation_key).toBe(state.posts[0].data.operation_key);
    else expect(state.posts[1].data.expected_po_updated_at).toBe(state.summary.po_updated_at);
    expect(state.errors).toEqual([]);
  });
}

test('service receipt type reflects the canonical order basis', async ({ page }) => {
  const state = await setup(page, { service: true });
  const type = panel(page).getByRole('group', { name: /^Receipt Type/ });
  await expect(type.getByRole('button', { name: 'Services', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(type.getByRole('button', { name: 'Goods', exact: true })).toBeDisabled();
  await fillDelivery(page);
  await statusButton(page, 'Full').click();
  await record(page).click();
  await expect(page.getByText('Saved receipt receipt-delivery-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.items_received).toEqual([{ line_id: 'service:total', received_amount: '1000.00', rejected_amount: '0' }]);
  expect(state.posts[0].data).not.toHaveProperty('receipt_type');
  expect(state.errors).toEqual([]);
});
