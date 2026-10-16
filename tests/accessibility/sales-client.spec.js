import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareClients, clientId, clientRow } from '../fixtures/sales-client-api';

const register = page => page.getByRole('region', { name: 'Client register', exact: true });
const selected = page => page.getByRole('region', { name: 'Selected client', exact: true });
const rows = page => register(page).locator('tbody tr').filter({ has: page.getByRole('button', { name: /^Select client / }) });
const selectRow = (page, index) => register(page).getByRole('button', { name: `Select client ${clientRow(index).company_name}`, exact: true });
const dialog = (page, name) => page.getByRole('dialog', { name, exact: true });

async function ready(page) {
  await expect(rows(page)).toHaveCount(6);
  await expect(selected(page).getByRole('heading', { name: 'Demo Client A', exact: true })).toBeVisible();
  await expect(selected(page).getByRole('button', { name: 'Edit client', exact: true })).toBeEnabled();
  await expect(selected(page)).toContainText('Engineering Services Framework');
}

test('reference layout uses six real-shaped clients and the unchanged application shell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const state = await prepareClients(page);
  await ready(page);
  await expect(register(page).getByRole('tab', { name: 'All', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(selected(page).getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(register(page)).toContainText(/1\s*[–-]\s*6 of 6/);
  await expect(selected(page)).toContainText('Demo Client A LLC');
  await expect(selected(page)).toContainText('Abu Dhabi');
  await expect(selected(page)).toContainText('procurement@client-a.example');
  await expect(selected(page)).toContainText('VF-2026-0142');
  await expect(page.getByRole('button', { name: /^Export/ })).toBeDisabled();
  await expect(page.locator('.scl-page')).not.toContainText('Sample data');
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    return { main: box('main.main-content'), page: box('.scl-page'), register: box('[aria-label="Client register"]'),
      workspace: box('[aria-label="Selected client"]'), header: box('header:has(nav[aria-label="Primary navigation"])'),
      rowHeights: [...document.querySelectorAll('.scl-register tbody tr')].map(row => row.getBoundingClientRect().height),
      clippedNames: [...document.querySelectorAll('.scl-client-name')].filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.textContent),
      family: getComputedStyle(document.querySelector('.scl-page')).fontFamily,
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  await page.screenshot({ path: testInfo.outputPath('client-reference-1586.png'), fullPage: true });
  await testInfo.attach('client-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.header.height).toBe(56);
  expect(geometry.main.x).toBeGreaterThanOrEqual(249);
  expect(geometry.main.x).toBeLessThanOrEqual(251);
  expect(geometry.workspace.width / geometry.register.width).toBeGreaterThan(1.04);
  expect(geometry.workspace.width / geometry.register.width).toBeLessThan(1.25);
  expect(geometry.family).toContain('Roboto');
  expect(geometry.register.bottom).toBeLessThanOrEqual(992);
  expect(geometry.workspace.bottom).toBeLessThanOrEqual(992);
  expect(geometry.clippedNames).toEqual([]);
  for (const height of geometry.rowHeights) expect(height).toBeGreaterThanOrEqual(65);
  for (const height of geometry.rowHeights) expect(height).toBeLessThanOrEqual(80);
  const accessibility = await new AxeBuilder({ page }).include('.scl-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(state.unexpected).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('status, text, country and additional filters include all API pages', async ({ page }) => {
  const state = await prepareClients(page);
  await ready(page);
  expect(state.requests.filter(request => request.path.endsWith('/clients/') && request.method === 'GET').length).toBeGreaterThanOrEqual(2);
  await register(page).getByRole('tab', { name: 'Active', exact: true }).click();
  await expect(rows(page)).toHaveCount(3);
  await register(page).getByRole('tab', { name: 'Prospects', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await register(page).getByRole('tab', { name: 'Inactive', exact: true }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Demo Client F');
  await register(page).getByRole('tab', { name: 'All', exact: true }).click();
  await register(page).getByLabel('Search clients', { exact: true }).fill('client-f.example');
  await expect(rows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('CL-0006');
  await register(page).getByLabel('Search clients', { exact: true }).fill('');
  await register(page).getByRole('combobox', { name: 'Country', exact: true }).selectOption('Oman');
  await expect(rows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Demo Client B');
  await register(page).getByRole('combobox', { name: 'Country', exact: true }).selectOption('');
  await register(page).getByRole('button', { name: 'Client filters', exact: true }).click();
  await register(page).getByRole('combobox', { name: 'Owner', exact: true }).selectOption('11');
  await expect(rows(page)).toHaveCount(2);
  await register(page).getByRole('combobox', { name: 'Industry', exact: true }).selectOption('construction');
  await expect(rows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Demo Client C');
  await register(page).getByLabel('Search clients', { exact: true }).fill('absent client');
  await expect(rows(page)).toHaveCount(0);
  expect(state.mutations).toEqual([]);
});

test('sorting, pagination and Columns remain usable without changing saved client identity', async ({ page }) => {
  await prepareClients(page, { rows: Array.from({ length: 13 }, (_, index) => clientRow(index)) });
  await register(page).locator('.scl-columns-menu > summary').click();
  await register(page).getByLabel('Rows per page', { exact: true }).selectOption('5');
  await register(page).locator('.scl-columns-menu > summary').click();
  await expect(rows(page)).toHaveCount(5);
  const firstPage = await rows(page).allTextContents();
  await register(page).getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows(page)).toHaveCount(5);
  expect(await rows(page).allTextContents()).not.toEqual(firstPage);
  await register(page).getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(rows(page)).toHaveText(firstPage);
  await register(page).getByRole('button', { name: 'Sort by Client', exact: true }).click();
  expect(await rows(page).allTextContents()).not.toEqual(firstPage);
  await register(page).locator('.scl-columns-menu > summary').click();
  await register(page).getByRole('checkbox', { name: 'Country', exact: true }).uncheck();
  await expect(register(page).getByRole('button', { name: 'Sort by Country', exact: true })).toHaveCount(0);
  await register(page).getByRole('checkbox', { name: 'Country', exact: true }).check();
  await expect(register(page).getByRole('button', { name: 'Sort by Country', exact: true })).toBeVisible();
});

test('related tabs display canonical contacts and paginated links within the selected client', async ({ page }) => {
  const state = await prepareClients(page);
  await ready(page);
  await expect(selected(page)).toContainText('2 opportunities');
  await expect(selected(page)).toContainText('2 proposals');
  await expect(selected(page)).toContainText('1 framework');
  await selected(page).getByRole('tab', { name: 'Contacts', exact: true }).click();
  await expect(selected(page)).toContainText('Engineering coordinator');
  await selected(page).getByRole('tab', { name: 'Opportunities', exact: true }).click();
  await expect(selected(page).getByRole('link', { name: 'VF-2026-0142', exact: true })).toHaveAttribute('href', /\/sales\/opportunities\?record=deal-1/);
  await expect(selected(page)).toContainText('VF-2026-0138');
  await selected(page).getByRole('tab', { name: 'Proposals', exact: true }).click();
  await expect(selected(page)).toContainText('P-2026-0142');
  await expect(selected(page)).toContainText('P-2026-0138');
  await selected(page).getByRole('tab', { name: 'Frameworks', exact: true }).click();
  await expect(selected(page).getByRole('link', { name: 'FW-2026-0007', exact: true })).toHaveAttribute('href', /\/sales\/frameworks\?record=framework-1/);
  await selected(page).getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(selected(page)).toContainText('Quarterly relationship review');
  expect(state.requests.filter(request => request.path.endsWith('/deals/') && request.search.includes(`client=${clientId(0)}`)).length).toBeGreaterThanOrEqual(2);
  await selectRow(page, 1).click();
  await expect(selected(page).getByRole('heading', { name: 'Demo Client B', exact: true })).toBeVisible();
  await expect(selected(page)).not.toContainText('Quarterly relationship review');
  await expect(selected(page)).not.toContainText('VF-2026-0142');
  expect(state.mutations).toEqual([]);
});

test('late detail replies cannot replace a newer selection and denied details clear prior evidence', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const state = await prepareClients(page, { detailHolds: { [clientId(1)]: held } });
  await ready(page);
  await selectRow(page, 1).click();
  await selectRow(page, 4).click();
  await expect(selected(page).getByRole('heading', { name: 'Demo Client E', exact: true })).toBeVisible();
  release();
  await expect(selected(page)).toContainText('Demo Client E LLC');
  await expect(selected(page)).not.toContainText('Demo Client B LLC');
  state.detailStatuses[clientId(0)] = 403;
  await selectRow(page, 0).click();
  await expect(selected(page).getByRole('button', { name: /retry/i })).toBeVisible();
  await expect(selected(page)).not.toContainText('Demo Client E LLC');
  await expect(selected(page)).not.toContainText('procurement@client-a.example');
  state.detailStatuses[clientId(0)] = 200;
  await selected(page).getByRole('button', { name: /retry/i }).click();
  await expect(selected(page)).toContainText('Demo Client A LLC');
  expect(state.pageErrors).toEqual([]);
});

test('denied linked records retain the client and recover only after retry', async ({ page }) => {
  const state = await prepareClients(page, { relatedStatuses: { [`deals:${clientId(0)}`]: 403 } });
  await ready(page);
  await expect(selected(page)).toContainText('Demo Client A LLC');
  await expect(selected(page)).toContainText('You do not have permission to view these records.');
  await expect(selected(page)).not.toContainText('VF-2026-0142');
  await expect(selected(page)).toContainText('Opportunities unavailable');
  state.relatedStatuses[`deals:${clientId(0)}`] = 200;
  await selected(page).getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(selected(page)).toContainText('VF-2026-0142');
  await expect(selected(page)).toContainText('2 opportunities');
  expect(state.mutations).toEqual([]);
});

test('late linked replies do not leak a previous client into the selected workspace', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await prepareClients(page, { relatedHolds: { [`deals:${clientId(0)}`]: held } });
  await ready(page);
  await expect(selected(page)).toContainText('Loading opportunities');
  await selectRow(page, 1).click();
  await expect(selected(page).getByRole('heading', { name: 'Demo Client B', exact: true })).toBeVisible();
  release();
  await expect(selected(page)).toContainText('No opportunities linked to this client.');
  await expect(selected(page)).not.toContainText('VF-2026-0142');
});

test('failed register loads can retry and empty results never invent clients', async ({ page }) => {
  const state = await prepareClients(page, { listStatus: 503 });
  await expect(page.locator('.scl-page').getByRole('button', { name: /retry/i })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  state.listStatus = 200;
  await page.locator('.scl-page').getByRole('button', { name: /retry/i }).click();
  await ready(page);
  state.rows = [];
  await register(page).locator('.scl-columns-menu > summary').click();
  await register(page).getByRole('button', { name: 'Refresh clients', exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(register(page)).toContainText(/No clients/);
  await expect(page.getByRole('button', { name: /^Export/ })).toBeDisabled();
  expect(state.mutations).toEqual([]);
});

test('client creation retains failed input and saves through the existing command', async ({ page }) => {
  const state = await prepareClients(page, { createStatuses: [400, 200] });
  await ready(page);
  await page.getByRole('button', { name: 'New client', exact: true }).click();
  const form = dialog(page, 'Register client');
  await form.getByLabel(/^Company name/).fill('Synthetic client registration');
  await form.getByLabel(/^Legal name/).fill('Synthetic client registration LLC');
  await form.getByRole('textbox', { name: 'Relationship notes', exact: true }).fill('Retain the reviewed relationship note after a failed save.');
  await form.getByRole('button', { name: 'Create client', exact: true }).click();
  await expect(form).toContainText('could not be saved');
  await expect(form.getByLabel(/^Company name/)).toHaveValue('Synthetic client registration');
  await expect(form.getByRole('textbox', { name: 'Relationship notes', exact: true })).toHaveValue('Retain the reviewed relationship note after a failed save.');
  await form.getByRole('button', { name: 'Create client', exact: true }).click();
  await expect(form).toHaveCount(0);
  const payload = state.mutations.filter(item => item.action === 'create').at(-1).body;
  expect(payload.company_name).toBe('Synthetic client registration');
  expect(payload.industry_type).toBe('oil_gas');
  expect(payload.verification_status).toBe('unverified');
  expect(state.mutations.filter(item => item.action === 'create')).toHaveLength(2);
});

test('existing client edit and full record actions retain failed changes', async ({ page }) => {
  const state = await prepareClients(page, { patchStatuses: { [clientId(0)]: [400, 200] } });
  await ready(page);
  await selected(page).getByRole('button', { name: 'Edit client', exact: true }).click();
  const record = page.getByRole('dialog');
  await record.getByRole('textbox', { name: 'Legal name', exact: true }).fill('Demo Client A revised legal name');
  await record.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(record.getByRole('textbox', { name: 'Legal name', exact: true })).toHaveValue('Demo Client A revised legal name');
  await expect(record).toContainText('Changes could not be saved. Your draft is retained.');
  await record.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(record.getByRole('textbox', { name: 'Legal name', exact: true })).toHaveCount(0);
  await record.getByRole('button', { name: 'Close record', exact: true }).click();
  await expect(selected(page)).toContainText('Demo Client A revised legal name');
  await selected(page).getByLabel('More client actions', { exact: true }).click();
  await selected(page).getByRole('button', { name: /(?:Open full client record|View full record)/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Verification Status');
  expect(state.mutations.filter(item => item.action === 'edit')).toHaveLength(2);
});

test('add contact retains denied input and refreshes the saved client contacts', async ({ page }) => {
  const state = await prepareClients(page, { contactStatuses: [403, 200] });
  await ready(page);
  await selected(page).getByRole('button', { name: 'Add contact', exact: true }).click();
  const form = dialog(page, 'Add contact');
  await form.getByLabel(/^First name/).fill('Synthetic');
  await form.getByLabel(/^Last name/).fill('Contact');
  await form.getByLabel(/^Email/).fill('synthetic-contact@example.test');
  await form.getByRole('button', { name: 'Add contact', exact: true }).click();
  await expect(form).toContainText(/could not be saved|permission|access/i);
  await expect(form.getByLabel(/^Email/)).toHaveValue('synthetic-contact@example.test');
  await form.getByRole('button', { name: 'Add contact', exact: true }).click();
  await expect(form).toHaveCount(0);
  await selected(page).getByRole('tab', { name: 'Contacts', exact: true }).click();
  await expect(selected(page)).toContainText('synthetic-contact@example.test');
  expect(state.mutations.filter(item => item.action === 'contact').at(-1).body.client).toBe(clientId(0));
});

test('log activity retains failed notes and displays the saved activity', async ({ page }) => {
  const state = await prepareClients(page, { activityStatuses: [503, 200] });
  await ready(page);
  await selected(page).getByRole('button', { name: 'Log activity', exact: true }).click();
  const form = dialog(page, 'Log activity');
  await form.getByLabel(/^Subject/).fill('Synthetic follow-up call');
  await form.getByRole('textbox', { name: 'Outcome', exact: true }).fill('Retained outcome after a failed save.');
  await form.getByRole('button', { name: 'Log activity', exact: true }).click();
  await expect(form).toContainText('could not be saved');
  await expect(form.getByRole('textbox', { name: 'Outcome', exact: true })).toHaveValue('Retained outcome after a failed save.');
  await form.getByRole('button', { name: 'Log activity', exact: true }).click();
  await expect(form).toHaveCount(0);
  await selected(page).getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(selected(page)).toContainText('Synthetic follow-up call');
  const payload = state.mutations.filter(item => item.action === 'activity').at(-1).body;
  expect(payload.client).toBe(clientId(0));
  expect(payload.performed_by).toBe(11);
});

test('New opportunity opens the retained registration form without saving prematurely', async ({ page }) => {
  const state = await prepareClients(page);
  await ready(page);
  await selected(page).getByRole('button', { name: 'New opportunity', exact: true }).click();
  const form = dialog(page, 'Register opportunity (VF)');
  await expect(form.getByLabel('Opportunity name', { exact: true })).toBeVisible();
  await expect(form.getByRole('option', { name: 'Demo Client A', exact: true })).toHaveCount(1);
  await expect(form.getByRole('combobox', { name: 'Opportunity type', exact: true })).toBeEnabled();
  await expect(form.getByRole('combobox', { name: 'Owner', exact: true })).toHaveValue('11');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(selected(page)).toContainText('Demo Client A LLC');
  expect(state.mutations).toEqual([]);
  expect(state.unexpected).toEqual([]);
});

for (const width of [1024, 768, 390]) test(`client controls remain reachable at ${width}px with the existing sidebar`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
  const state = await prepareClients(page);
  await ready(page);
  const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    register: document.querySelector('[aria-label="Client register"]').getBoundingClientRect().toJSON(),
    workspace: document.querySelector('[aria-label="Selected client"]').getBoundingClientRect().toJSON() }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  await selected(page).getByRole('tab', { name: 'Activity', exact: true }).click();
  await expect(selected(page)).toContainText('Quarterly relationship review');
  await selected(page).getByRole('tab', { name: 'Overview', exact: true }).click();
  await selected(page).getByRole('button', { name: 'Log activity', exact: true }).click({ trial: true });
  await page.screenshot({ path: testInfo.outputPath(`client-responsive-${width}.png`), fullPage: true });
  await testInfo.attach('responsive-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(state.pageErrors).toEqual([]);
});
