import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(120000);
test.use({ serviceWorkers: 'block', actionTimeout: 12000, navigationTimeout: 90000, timezoneId: 'Asia/Dubai' });

const token = '2026-09-28T06:15:00.123456+00:00';
const order = {
  id: 'po-entry-1', po_number: 'SYN-PO-0085_JUL2026', title: 'Synthetic engineering materials',
  vendor_name: 'Synthetic engineering supplier', status: 'partially_received', currency: 'USD',
  project_number: '5900828', po_date: '2026-07-01', expected_delivery: '2026-09-28',
  total_amount: '8565.48', payment_terms: 'Net 30', delivery_terms: 'Delivery to project office', updated_at: token,
};
const line = { line_id: 'line:10', description: 'Synthetic pipe', uom: 'EA', ordered: '10', accepted: '4', pending: '1', remaining: '6', available: '5' };
const pageData = rows => ({ count: rows.length, next: null, previous: null, results: rows });
const dialog = page => page.getByRole('dialog');
const quantity = page => page.getByRole('spinbutton', { name: 'Received quantity for Synthetic pipe', exact: true });
const record = page => page.getByRole('button', { name: 'Record receipt', exact: true });
const copy = page => page.getByRole('button', { name: /Copy remaining (quantities|value)/i });

async function setup(page, { lines = [line], service = false, shell = false, custom } = {}) {
  const state = { posts: [], reads: [], errors: [], summary: {
    basis: service ? 'service_value' : 'quantity', currency: 'USD', po_updated_at: token,
    can_record: true, can_reconcile: false, lines: structuredClone(lines),
  } };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(value => {
    window.handoffFixture = { order: value };
    localStorage.setItem('radai_access_token', 'synthetic-token');
  }, order);
  if (shell) {
    await page.route('**/tests/fixtures/purchase-order-handoff.html*', async route => {
      const response = await route.fetch();
      const html = await response.text();
      const layout = '<style id="synthetic-shell-style">#application-sidebar{position:fixed;left:0;top:0;bottom:0;width:206px;background:#092840;color:white;padding:20px;z-index:20}#application-content{margin-left:206px}#synthetic-header{height:52px;background:white;padding:12px 20px;border-bottom:1px solid #d6e4f1}#application-content>main{position:relative;height:calc(100vh - 52px);overflow:auto}@media(max-width:700px){#application-sidebar{display:none}#application-content{margin-left:0}}</style><aside id="application-sidebar" aria-label="Synthetic unchanged sidebar"><button id="synthetic-sidebar-action">Synthetic sidebar</button></aside><div id="application-content"><header id="synthetic-header"><button id="synthetic-header-action">Synthetic existing header</button></header><main><div id="handoff-test"></div></main></div>';
      await route.fulfill({ response, body: html.replace('<div id="handoff-test"></div>', layout) });
    });
  }
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') state.reads.push(url);
    else state.posts.push({ path: url.pathname, data: request.postDataJSON() });
    if (custom && await custom(route, state, url)) return;
    let body = pageData([]);
    if (url.pathname.endsWith('/rbac/users/me/')) body = { user: { id: 'synthetic-recorder', first_name: 'Synthetic', last_name: 'Recorder' }, location: 'Synthetic project office' };
    else if (url.pathname.endsWith('/receiving-summary/')) body = state.summary;
    else if (url.pathname.endsWith('/available-orders/')) body = pageData([order]);
    else if (url.pathname.endsWith('/receipts/') && request.method() === 'POST') {
      const data = request.postDataJSON();
      body = { id: 'receipt-entry-1', purchase_order: data.purchase_order, operation_key: data.operation_key, status: 'pending' };
    }
    await route.fulfill({ json: body });
  });
  await page.goto('/tests/fixtures/purchase-order-handoff.html?view=creator');
  await expect(dialog(page)).toBeVisible();
  await page.getByLabel(/^Delivery Location/).fill('Synthetic receiving office');
  await page.getByLabel(/^Condition/).selectOption('good');
  await page.evaluate(() => document.fonts.ready);
  if (shell) await page.evaluate(() => {
    window.syntheticShellClicks = 0;
    for (const id of ['synthetic-sidebar-action', 'synthetic-header-action']) {
      document.getElementById(id).addEventListener('click', () => { window.syntheticShellClicks += 1; });
    }
  });
  return state;
}

async function fillException(page) {
  const reason = page.getByLabel(/^Exception reason/i);
  if (await reason.isVisible() && !await reason.inputValue()) await reason.fill('Synthetic remaining shipment');
}

async function clickRecord(page) {
  await fillException(page);
  await page.getByRole('button', { name: 'Record receipt', exact: true }).click();
}

async function clickShell(page) {
  for (const id of ['synthetic-sidebar-action', 'synthetic-header-action']) {
    const bounds = await page.locator(`#${id}`).boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }
}

test('record receipt reference keeps three panels within the main content and preserves keyboard access', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  const state = await setup(page, { shell: true });
  await expect(quantity(page)).toBeVisible();
  for (const name of ['Purchase order', 'Delivery information', 'Items received', 'Receipt review']) {
    await expect(dialog(page).getByRole('heading', { name, exact: true })).toBeVisible();
  }
  const bounds = await dialog(page).boundingBox();
  const main = await page.locator('#application-content > main').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(main.x - 1);
  expect(bounds.y).toBeGreaterThanOrEqual(main.y - 1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(main.x + main.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(main.y + main.height + 1);
  await expect(page.locator('#application-sidebar')).toHaveCSS('width', '206px');
  await expect(page.locator('#synthetic-header')).toHaveCSS('height', '52px');
  const headings = await Promise.all(['Purchase order', 'Delivery information', 'Receipt review'].map(name => dialog(page).getByRole('heading', { name, exact: true }).boundingBox()));
  expect(headings[0].x).toBeLessThan(headings[1].x);
  expect(headings[1].x).toBeLessThan(headings[2].x);
  expect(Math.max(...headings.map(box => box.y)) - Math.min(...headings.map(box => box.y))).toBeLessThan(6);
  await copy(page).click();
  await expect(quantity(page)).toHaveValue('5');
  await clickShell(page);
  expect(await page.evaluate(() => window.syntheticShellClicks)).toBe(0);
  const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  await testInfo.attach('receipt-entry-axe.json', { body: JSON.stringify(accessibility.violations, null, 2), contentType: 'application/json' });
  expect(accessibility.violations.filter(value => ['critical', 'serious'].includes(value.impact))).toEqual([]);
  await record(page).focus();
  await page.keyboard.press('Tab');
  expect(await dialog(page).evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('receipt-entry-reference-desktop.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await clickShell(page);
  expect(await page.evaluate(() => window.syntheticShellClicks)).toBe(2);
  expect(state.posts).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('narrow receipt form contains table overflow and keeps the record action reachable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page, { shell: true });
  await expect(quantity(page)).toBeVisible();
  await quantity(page).fill('2.5');
  await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Retained on a narrow display');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const geometry = await dialog(page).evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
  await record(page).scrollIntoViewIfNeeded();
  await expect(record(page)).toBeInViewport();
  const bounds = await record(page).boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('receipt-entry-reference-narrow.png'), fullPage: true });
  await clickRecord(page);
  await expect(page.getByText('Saved receipt receipt-entry-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.notes).toBe('Retained on a narrow display');
  expect(state.errors).toEqual([]);
});

test('copy remaining preserves exact decimal balances and keeps different quantity units separate', async ({ page }) => {
  const lines = [
    { ...line, ordered: '9007199254740993.3', accepted: '0.1', pending: '0.2', remaining: '9007199254740993.2', available: '9007199254740993' },
    { ...line, line_id: 'line:11', description: 'Synthetic cable', uom: 'm', ordered: '1.3', accepted: '0.1', pending: '0.2', remaining: '1.2', available: '1.0' },
  ];
  const state = await setup(page, { lines });
  await copy(page).click();
  await expect(quantity(page)).toHaveValue('9007199254740993');
  await expect(page.getByRole('spinbutton', { name: 'Received quantity for Synthetic cable', exact: true })).toHaveValue('1.0');
  const review = dialog(page).getByRole('region', { name: 'Receipt review', exact: true });
  await expect(review).toContainText('Received (EA)');
  await expect(review).toContainText('Received (M)');
  await expect(page.getByRole('rowheader', { name: 'Total · EA', exact: true }).locator('..')).toContainText('9007199254740993');
  await expect(page.getByRole('rowheader', { name: 'Total · M', exact: true }).locator('..')).toContainText('1.3');
  await clickRecord(page);
  await expect(page.getByText('Saved receipt receipt-entry-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.items_received).toEqual([
    { line_id: 'line:10', received_qty: '9007199254740993', rejected_qty: '0' },
    { line_id: 'line:11', received_qty: '1.0', rejected_qty: '0' },
  ]);
  expect(state.errors).toEqual([]);
});

test('service reference uses currency values and creates pending evidence without confirmation', async ({ page }, testInfo) => {
  const state = await setup(page, { service: true, lines: [{ line_id: 'service:total', description: 'Synthetic engineering service', uom: 'USD', ordered: '1000.30', accepted: '200.10', pending: '0.20', remaining: '800.20', available: '800.00' }] });
  await expect(page.getByRole('heading', { name: 'Record service acceptance', exact: true })).toBeVisible();
  await copy(page).click();
  await expect(page.getByRole('spinbutton', { name: 'Received value for Synthetic engineering service', exact: true })).toHaveValue('800.00');
  await expect(dialog(page)).toContainText('USD');
  await expect(page.getByRole('button', { name: /Confirm (receipt|delivery)/i })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('receipt-entry-reference-service.png'), fullPage: true });
  await clickRecord(page);
  await expect(page.getByText('Saved receipt receipt-entry-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(1);
  expect(state.posts[0].data.items_received).toEqual([{ line_id: 'service:total', received_amount: '800.00', rejected_amount: '0' }]);
  expect(state.posts[0].data.status).toBe('pending');
  expect(state.errors).toEqual([]);
});

test('service readiness respects the existing currency precision while preserving trailing zeros', async ({ page }) => {
  const state = await setup(page, { service: true, lines: [{ line_id: 'service:total', description: 'Synthetic engineering service', uom: 'USD', ordered: '10.00', accepted: '0.00', pending: '0.00', remaining: '10.00', available: '10.00' }] });
  const input = page.getByRole('spinbutton', { name: 'Received value for Synthetic engineering service', exact: true });
  const review = dialog(page).getByRole('region', { name: 'Receipt review', exact: true });
  await input.fill('1.001');
  await expect(review).not.toContainText('Ready to record');
  await expect(dialog(page)).toContainText('Service values must use at most two decimal places.');
  expect(state.posts).toEqual([]);
  await input.fill('1.230000');
  await fillException(page);
  await expect(review).toContainText('Ready to record');
  await clickRecord(page);
  await expect(page.getByText('Saved receipt receipt-entry-1 (pending)', { exact: true })).toBeVisible();
  expect(state.posts[0].data.items_received).toEqual([{ line_id: 'service:total', received_amount: '1.230000', rejected_amount: '0' }]);
  expect(state.errors).toEqual([]);
});

for (const status of [409, 500]) {
  test(`receipt HTTP ${status} retains input and requires the appropriate recovery`, async ({ page }) => {
    let failed = false;
    const state = await setup(page, { custom: async (route, current, url) => {
      if (!url.pathname.endsWith('/receipts/') || route.request().method() !== 'POST' || failed) return false;
      failed = true;
      if (status === 409) current.summary.po_updated_at = '2026-09-28T06:16:00.987654+00:00';
      await route.fulfill({ status, json: { detail: 'Receipt could not be saved.' } });
      return true;
    } });
    await quantity(page).fill('2.5');
    await page.getByLabel('Delivery Note No.', { exact: true }).fill('SYN-DN-PRESERVE');
    await page.getByLabel(/^Delivery Date/).fill('2026-09-20');
    await page.getByRole('textbox', { name: 'Remarks', exact: true }).fill('Keep all user entries');
    await clickRecord(page);
    await expect(page.getByRole('alert')).toContainText(status === 409 ? 'This record changed' : 'The server could not complete the request');
    await expect(quantity(page)).toHaveValue('2.5');
    await expect(page.getByLabel('Delivery Note No.', { exact: true })).toHaveValue('SYN-DN-PRESERVE');
    await expect(page.getByLabel(/^Delivery Date/)).toHaveValue('2026-09-20');
    await expect(page.getByRole('textbox', { name: 'Remarks', exact: true })).toHaveValue('Keep all user entries');
    if (status === 409) {
      await expect(record(page)).toBeDisabled();
      await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
      await expect(record(page)).toBeEnabled();
      await expect(quantity(page)).toHaveValue('2.5');
    }
    await clickRecord(page);
    await expect(page.getByText('Saved receipt receipt-entry-1 (pending)', { exact: true })).toBeVisible();
    expect(state.posts).toHaveLength(2);
    if (status === 500) expect(state.posts[1].data.operation_key).toBe(state.posts[0].data.operation_key);
    if (status === 409) expect(state.posts[1].data.expected_po_updated_at).toBe(state.summary.po_updated_at);
    expect(state.errors).toEqual([]);
  });
}

test('blocked and denied source balances cannot create a receipt or claim readiness', async ({ page }) => {
  let denied = true;
  const state = await setup(page, { custom: async (route, current, url) => {
    if (!url.pathname.endsWith('/receiving-summary/')) return false;
    if (denied) await route.fulfill({ status: 403, json: { detail: 'Denied' } });
    else await route.fulfill({ json: { ...current.summary, can_record: false, lines: [], basis: 'unknown', blocked_reason: 'The purchase order requires an approved receiving basis.' } });
    return true;
  } });
  await expect(page.getByRole('alert')).toContainText('You do not have access');
  await expect(record(page)).toBeDisabled();
  denied = false;
  await page.getByRole('button', { name: 'Refresh receipt balances', exact: true }).click();
  await expect(dialog(page)).toContainText('The purchase order requires an approved receiving basis.');
  await expect(record(page)).toBeDisabled();
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(copy(page)).toBeDisabled();
  expect(state.posts).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('recording keeps shell actions and dismissal blocked until the response completes', async ({ page }) => {
  let releaseResponse;
  const responseReady = new Promise(resolve => { releaseResponse = resolve; });
  const state = await setup(page, { shell: true, custom: async (route, current, url) => {
    if (!url.pathname.endsWith('/receipts/') || route.request().method() !== 'POST') return false;
    await responseReady;
    return false;
  } });
  try {
    await quantity(page).fill('1');
    await clickRecord(page);
    await expect(dialog(page)).toHaveAttribute('aria-busy', 'true');
    await clickShell(page);
    expect(await page.evaluate(() => window.syntheticShellClicks)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close receipt creator', exact: true })).toBeDisabled();
    expect(state.posts).toHaveLength(1);
  } finally {
    releaseResponse();
  }
  await expect(page.getByText('Saved receipt receipt-entry-1 (pending)', { exact: true })).toBeVisible();
  await clickShell(page);
  expect(await page.evaluate(() => window.syntheticShellClicks)).toBe(2);
  expect(state.errors).toEqual([]);
});
