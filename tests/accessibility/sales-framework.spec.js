import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareFrameworks, frameworkId, frameworkClientId, frameworkRow } from '../fixtures/sales-framework-api';

const register = page => page.getByRole('region', { name: 'Framework register', exact: true });
const selected = page => page.getByRole('region', { name: 'Framework workspace', exact: true });
const rows = page => register(page).locator('tbody tr').filter({ has: page.getByRole('button', { name: /^Select framework / }) });
const selectRow = (page, index) => register(page).getByRole('button', { name: `Select framework ${frameworkRow(index).framework_number}`, exact: true });
const dialog = (page, name) => page.getByRole('dialog', { name, exact: true });
const columns = page => register(page).locator('details').filter({ has: page.locator('summary', { hasText: 'Columns' }) });

async function ready(page) {
  await expect(rows(page)).toHaveCount(6);
  await expect(selected(page).getByRole('heading', { name: 'Engineering Services Framework', exact: true })).toBeVisible();
  await expect(selected(page).getByRole('button', { name: 'Edit agreement', exact: true })).toBeEnabled();
  await expect(selected(page)).toContainText('Contracts team');
}

test('reference layout uses real framework fields inside the unchanged shell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const state = await prepareFrameworks(page);
  await ready(page);
  await expect(register(page).getByRole('tab', { name: 'All', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(selected(page).getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(register(page)).toContainText(/1\s*[\u2013-]\s*6 of 6/);
  await expect(selected(page)).toContainText('5,000,000');
  await expect(selected(page)).toContainText('3,200,000');
  await expect(selected(page)).toContainText('1,800,000');
  await expect(selected(page)).not.toContainText('1,500,000');
  await expect(page.getByRole('button', { name: /Export frameworks/ })).toBeDisabled();
  await expect(selected(page).getByRole('button', { name: 'New call-off unavailable', exact: true })).toBeDisabled();
  await expect(page.locator('.sfw-page')).not.toContainText('Sample data');
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return { main: box('main.main-content'), register: box('[aria-label="Framework register"]'),
      workspace: box('[aria-label="Framework workspace"]'), header: box('header:has(nav[aria-label="Primary navigation"])'),
      agreementHeader: box('.sfw-workspace-header'), agreementTabs: box('.sfw-workspace-tabs'),
      controls: box('.sfw-controls-grid'), rates: box('.sfw-rates-grid'), callOffs: box('.sfw-calloffs'),
      rowHeights: [...document.querySelectorAll('[aria-label="Framework register"] tbody tr')].map(row => row.getBoundingClientRect().height),
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      family: getComputedStyle(document.querySelector('.sfw-page')).fontFamily };
  });
  await page.screenshot({ path: testInfo.outputPath('framework-reference-1586.png'), fullPage: true });
  await testInfo.attach('framework-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.header.height).toBe(56);
  expect(geometry.main.x).toBeGreaterThanOrEqual(249);
  expect(geometry.main.x).toBeLessThanOrEqual(251);
  expect(geometry.workspace.width / geometry.register.width).toBeGreaterThan(1.4);
  expect(geometry.workspace.width / geometry.register.width).toBeLessThan(1.6);
  expect(geometry.family).toContain('Roboto');
  expect(geometry.register.bottom).toBeLessThanOrEqual(992);
  expect(geometry.workspace.bottom).toBeLessThanOrEqual(992);
  for (const height of geometry.rowHeights) expect(height).toBeGreaterThanOrEqual(80);
  for (const height of geometry.rowHeights) expect(height).toBeLessThanOrEqual(98);
  const accessibility = await new AxeBuilder({ page }).include('.sfw-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(state.unexpected).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('status, search and filters include all API pages without changing records', async ({ page }) => {
  const state = await prepareFrameworks(page);
  await ready(page);
  expect(state.requests.filter(request => request.path.endsWith('/frameworks/') && request.method === 'GET').length).toBeGreaterThanOrEqual(2);
  await register(page).getByRole('tab', { name: 'Active', exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  for (const status of ['Draft', 'Suspended', 'Expired']) {
    await register(page).getByRole('tab', { name: status, exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
  }
  await register(page).getByRole('tab', { name: 'All', exact: true }).click();
  await register(page).getByLabel('Search frameworks', { exact: true }).fill('Client B');
  await expect(rows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Plant Support');
  await register(page).getByLabel('Search frameworks', { exact: true }).fill('');
  await register(page).getByRole('button', { name: 'Framework filters', exact: true }).click();
  await register(page).getByRole('combobox', { name: 'Client', exact: true }).selectOption(frameworkClientId(2));
  await expect(rows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Design Services');
  await register(page).getByRole('combobox', { name: 'Client', exact: true }).selectOption('');
  await register(page).getByRole('combobox', { name: 'Currency', exact: true }).selectOption('AED');
  await expect(rows(page)).toHaveCount(6);
  await register(page).getByLabel('Search frameworks', { exact: true }).fill('unrecorded framework');
  await expect(rows(page)).toHaveCount(0);
  expect(state.mutations).toEqual([]);
});

test('sorting, pagination and Columns keep saved agreement identity', async ({ page }) => {
  await prepareFrameworks(page, { rows: Array.from({ length: 13 }, (_, index) => frameworkRow(index)) });
  await columns(page).locator('summary').click();
  await register(page).getByLabel('Rows per page', { exact: true }).selectOption('5');
  await columns(page).locator('summary').click();
  await expect(rows(page)).toHaveCount(5);
  const firstPage = await rows(page).allTextContents();
  await register(page).getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows(page)).toHaveCount(5);
  expect(await rows(page).allTextContents()).not.toEqual(firstPage);
  await register(page).getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(rows(page)).toHaveText(firstPage);
  await register(page).getByRole('button', { name: 'Sort by Agreement / client', exact: true }).click();
  expect(await rows(page).allTextContents()).not.toEqual(firstPage);
  await columns(page).locator('summary').click();
  await register(page).getByRole('checkbox', { name: 'Valid until', exact: true }).uncheck();
  await expect(register(page).getByRole('button', { name: 'Sort by Valid until', exact: true })).toHaveCount(0);
  await register(page).getByRole('checkbox', { name: 'Valid until', exact: true }).check();
  await expect(register(page).getByRole('button', { name: 'Sort by Valid until', exact: true })).toBeVisible();
});

test('tabs distinguish saved metadata from unavailable call-offs and unverified documents', async ({ page }) => {
  const state = await prepareFrameworks(page);
  await ready(page);
  await selected(page).getByRole('tab', { name: 'Rates', exact: true }).click();
  await expect(selected(page)).toContainText('2026.1');
  await expect(selected(page)).not.toContainText('Senior engineer');
  await selected(page).getByRole('tab', { name: 'Eligibility', exact: true }).click();
  await expect(selected(page)).toContainText('Eligible by status and validity');
  await selected(page).getByRole('tab', { name: 'Call-offs', exact: true }).click();
  await expect(selected(page)).toContainText(/not available|unavailable|not recorded/i);
  await expect(selected(page)).not.toContainText('CO-0024');
  await expect(selected(page)).toContainText('Written scope and purchase order required.');
  await selected(page).getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(selected(page)).toContainText('agreements/FW-2026-0007-signed.pdf');
  await expect(selected(page).locator('a[href*="FW-2026-0007-signed"]')).toHaveCount(0);
  await selected(page).getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(selected(page)).toContainText(/Approval|Activation/i);
  await expect(selected(page)).not.toContainText('Revision 02');
  expect(state.mutations).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

test('loading has no fabricated controls and the register recovers after a failed or empty response', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const state = await prepareFrameworks(page, { listHold: held });
  await expect(rows(page)).toHaveCount(0);
  await expect(register(page)).toContainText(/Loading/i);
  release();
  state.listHold = null;
  await ready(page);
  state.listStatus = 503;
  await columns(page).locator('summary').click();
  await register(page).getByRole('button', { name: 'Refresh frameworks', exact: true }).click();
  await expect(page.locator('.sfw-page').getByRole('button', { name: /retry/i })).toBeVisible();
  state.listStatus = 200;
  state.rows = [];
  await page.locator('.sfw-page').getByRole('button', { name: /retry/i }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(register(page)).toContainText(/No frameworks|No agreements/);
  expect(state.mutations).toEqual([]);
});

test('late detail replies cannot replace a newer agreement and denied detail clears previous evidence', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const state = await prepareFrameworks(page, { detailHolds: { [frameworkId(1)]: held } });
  await ready(page);
  await selectRow(page, 1).click();
  await selectRow(page, 4).click();
  await expect(selected(page).getByRole('heading', { name: 'Asset Integrity', exact: true })).toBeVisible();
  release();
  await expect(selected(page)).not.toContainText('Plant Support');
  state.detailStatuses[frameworkId(0)] = 403;
  await selectRow(page, 0).click();
  await expect(selected(page).getByRole('button', { name: /retry/i })).toBeVisible();
  await expect(selected(page)).not.toContainText('Asset Integrity');
  await expect(selected(page)).not.toContainText('3,200,000');
  state.detailStatuses[frameworkId(0)] = 200;
  await selected(page).getByRole('button', { name: /retry/i }).click();
  await expect(selected(page)).toContainText('Engineering Services Framework');
  expect(state.pageErrors).toEqual([]);
});

test('existing deep links select the intended agreement without forcing a drawer', async ({ page }) => {
  const state = await prepareFrameworks(page, { entry: `/sales/frameworks?record=${frameworkId(4)}` });
  await expect(selected(page).getByRole('heading', { name: 'Asset Integrity', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await selected(page).getByRole('button', { name: 'Open agreement', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('FW-2026-0003');
  await page.getByRole('dialog').getByRole('button', { name: 'Close record', exact: true }).click();
  await expect(selected(page)).toContainText('Asset Integrity');
  expect(state.mutations).toEqual([]);
});

test('framework creation retains failed input and saves a draft through the existing command', async ({ page }) => {
  const state = await prepareFrameworks(page, { createStatuses: [400, 200] });
  await ready(page);
  await page.getByRole('button', { name: 'New framework', exact: true }).click();
  const form = dialog(page, 'Register framework');
  await form.getByLabel(/^Framework number/).fill('FW-SYNTHETIC-2026');
  await form.getByLabel(/^Framework title/).fill('Synthetic recurring services');
  await form.getByLabel(/^Client/).selectOption(frameworkClientId(1));
  await form.getByLabel(/^Expiry date/).fill('2027-12-31');
  await form.getByLabel(/^Value ceiling/).fill('250000');
  await form.getByLabel(/^Payment terms/).fill('Retain these reviewed payment terms.');
  await form.getByRole('button', { name: 'Create framework', exact: true }).click();
  await expect(form).toContainText(/could not be saved/i);
  await expect(form.getByLabel(/^Framework title/)).toHaveValue('Synthetic recurring services');
  await expect(form.getByLabel(/^Payment terms/)).toHaveValue('Retain these reviewed payment terms.');
  await form.getByRole('button', { name: 'Create framework', exact: true }).click();
  await expect(form).toHaveCount(0);
  const payload = state.mutations.filter(item => item.action === 'create').at(-1).body;
  expect(payload.status).toBe('draft');
  expect(payload.client).toBe(frameworkClientId(1));
  expect(payload.committed_value).toBe(0);
  expect(payload.invoiced_value).toBe(0);
  expect(state.mutations.filter(item => item.action === 'create')).toHaveLength(2);
});

test('ordinary edit retains denied input and saves without manufacturing an amendment', async ({ page }) => {
  const state = await prepareFrameworks(page, { patchStatuses: { [frameworkId(0)]: [403, 200] } });
  await ready(page);
  await selected(page).getByRole('button', { name: 'Edit agreement', exact: true }).click();
  const record = page.getByRole('dialog');
  await record.getByRole('textbox', { name: 'Framework title', exact: true }).fill('Engineering Services Framework revised title');
  await record.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(record.getByRole('textbox', { name: 'Framework title', exact: true })).toHaveValue('Engineering Services Framework revised title');
  await expect(record).toContainText('Changes could not be saved. Your draft is retained.');
  await record.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(record.getByRole('textbox', { name: 'Framework title', exact: true })).toHaveCount(0);
  await record.getByRole('button', { name: 'Close record', exact: true }).click();
  await expect(selected(page)).toContainText('Engineering Services Framework revised title');
  const payload = state.mutations.filter(item => item.action === 'edit').at(-1).body;
  expect(payload.title).toBe('Engineering Services Framework revised title');
  expect(payload).not.toHaveProperty('amendments');
  expect(payload).not.toHaveProperty('approved_by');
  expect(state.mutations.filter(item => item.action === 'edit')).toHaveLength(2);
});

test('activation remains explicit, surfaces denial and retries the retained command', async ({ page }) => {
  const state = await prepareFrameworks(page, { activateStatuses: [403, 200], rows: Array.from({ length: 6 }, (_, index) => frameworkRow(index, index === 3 ? { signed_document: 'agreements/draft-signed.pdf' } : {})) });
  await ready(page);
  await selectRow(page, 3).click();
  await expect(selected(page).getByRole('heading', { name: 'Specialist Studies', exact: true })).toBeVisible();
  await selected(page).getByLabel('More framework actions', { exact: true }).click();
  await selected(page).getByRole('button', { name: 'Activate framework', exact: true }).click();
  const confirmation = dialog(page, 'Activate framework');
  await expect(confirmation).toContainText('independent approval');
  expect(state.mutations).toEqual([]);
  await confirmation.getByRole('button', { name: 'Activate framework', exact: true }).click();
  await expect(confirmation).toContainText(/permission|access/i);
  await confirmation.getByRole('button', { name: 'Activate framework', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(selected(page)).toContainText('Active');
  expect(state.mutations.filter(item => item.action === 'activate')).toHaveLength(2);
  expect(state.mutations.filter(item => item.action === 'edit')).toHaveLength(0);
});

test('a successful activation followed by denied refresh clears stale actions and retries only the read', async ({ page }) => {
  const state = await prepareFrameworks(page, { rows: Array.from({ length: 6 }, (_, index) => frameworkRow(index,
    index === 3 ? { signed_document: 'agreements/draft-signed.pdf' } : {})) });
  await ready(page);
  await selectRow(page, 3).click();
  await expect(selected(page).getByRole('button', { name: 'Edit agreement', exact: true })).toBeEnabled();
  await selected(page).getByLabel('More framework actions', { exact: true }).click();
  await selected(page).getByRole('button', { name: 'Activate framework', exact: true }).click();
  state.detailStatuses[frameworkId(3)] = 403;
  await dialog(page, 'Activate framework').getByRole('button', { name: 'Activate framework', exact: true }).click();
  await expect(dialog(page, 'Activate framework')).toHaveCount(0);
  await expect(selected(page).getByRole('button', { name: /retry/i })).toBeVisible();
  await expect(selected(page).getByRole('button', { name: 'Activate framework', exact: true })).toHaveCount(0);
  await expect(selected(page).getByRole('button', { name: 'Edit agreement', exact: true })).toHaveCount(0);
  expect(state.mutations.filter(item => item.action === 'activate')).toHaveLength(1);
  state.detailStatuses[frameworkId(3)] = 200;
  await selected(page).getByRole('button', { name: /retry/i }).click();
  await expect(selected(page).getByRole('heading', { name: 'Specialist Studies', exact: true })).toBeVisible();
  await expect(selected(page)).toContainText('Active');
  expect(state.mutations.filter(item => item.action === 'activate')).toHaveLength(1);
});

test('all supported statuses stay visible and expired or closed agreements remain locked', async ({ page }) => {
  const extra = [frameworkRow(6, { status: 'internal_review' }), frameworkRow(7, { status: 'pending_signature' }),
    frameworkRow(8, { status: 'expiring' }), frameworkRow(9, { status: 'closed' })];
  const state = await prepareFrameworks(page, { rows: [...Array.from({ length: 6 }, (_, index) => frameworkRow(index)), ...extra] });
  for (const name of ['Internal Review', 'Pending Signature', 'Expiring', 'Closed']) {
    await register(page).getByRole('tab', { name, exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
  }
  await rows(page).getByRole('button', { name: /^Select framework/ }).click();
  await expect(selected(page).getByRole('button', { name: 'Edit agreement', exact: true })).toBeDisabled();
  await register(page).getByRole('tab', { name: 'Expired', exact: true }).click();
  await selectRow(page, 5).click();
  await expect(selected(page).getByRole('button', { name: 'Edit agreement', exact: true })).toBeDisabled();
  await selected(page).getByLabel('More framework actions', { exact: true }).click();
  await expect(selected(page).getByRole('button', { name: 'Activate framework', exact: true })).toHaveCount(0);
  expect(state.mutations).toEqual([]);
});

for (const width of [1024, 768, 390]) test(`framework controls remain reachable at ${width}px with the existing sidebar`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
  const state = await prepareFrameworks(page);
  await ready(page);
  const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    register: document.querySelector('[aria-label="Framework register"]').getBoundingClientRect().toJSON(),
    workspace: document.querySelector('[aria-label="Framework workspace"]').getBoundingClientRect().toJSON() }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  await selected(page).getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(selected(page)).toContainText('agreements/FW-2026-0007-signed.pdf');
  await selected(page).getByRole('tab', { name: 'Overview', exact: true }).click();
  await selected(page).getByRole('button', { name: 'Open agreement', exact: true }).click({ trial: true });
  await page.screenshot({ path: testInfo.outputPath(`framework-responsive-${width}.png`), fullPage: true });
  await testInfo.attach('responsive-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(state.pageErrors).toEqual([]);
});
