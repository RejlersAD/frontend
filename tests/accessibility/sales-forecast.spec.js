import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareForecasts, forecastId, forecastRow } from '../fixtures/sales-forecast-api';

const workspace = page => page.getByRole('region', { name: 'Forecast planning workspace', exact: true });
const dialog = (page, name) => page.getByRole('dialog', { name, exact: true });
const select = (page, name) => workspace(page).getByRole('combobox', { name, exact: true });

async function ready(page) {
  await expect(workspace(page).getByRole('heading', { name: 'Forecast', exact: true })).toBeVisible();
  await expect(workspace(page).getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
  await expect(select(page, 'Snapshot')).toHaveValue(forecastId(0));
}

test('reference structure and source-backed measures use the unchanged application shell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const state = await prepareForecasts(page);
  await ready(page);
  const view = workspace(page);
  await expect(view.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const heading of ['Monthly outlook', 'Commercial performance', 'Forecast controls', 'Forecast basis', 'Review & approval'])
    await expect(view.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(view.getByRole('heading', { name: /^Inputs requiring review/ })).toBeVisible();
  await expect(view).toContainText('1.80m');
  await expect(view).toContainText('Oct 2026');
  await expect(view).toContainText('Nov 2026');
  await expect(view).toContainText('Dec 2026');
  await expect(view.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await expect(view.getByRole('button', { name: 'Submit for approval', exact: true })).toBeDisabled();
  await expect(select(page, 'Client')).toBeDisabled();
  await expect(select(page, 'Currency')).toBeDisabled();
  await expect(view).not.toContainText('Sample data');
  await expect(view).not.toContainText('v03');
  await expect(view).not.toContainText('AED');
  const geometry = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      main: rect('main.main-content'), page: rect('.sfc-page'), header: rect('header:has(nav[aria-label="Primary navigation"])'),
      font: getComputedStyle(document.querySelector('.sfc-page')).fontFamily };
  });
  await page.screenshot({ path: testInfo.outputPath('forecast-reference-1586.png'), fullPage: true });
  await testInfo.attach('forecast-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.main.x).toBeGreaterThanOrEqual(249);
  expect(geometry.main.x).toBeLessThanOrEqual(251);
  expect(geometry.header.height).toBe(56);
  expect(geometry.font).toContain('Roboto');
  const accessibility = await new AxeBuilder({ page }).include('.sfc-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(state.unexpected).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('period and scenario selection preserve actual zero and do not fabricate filtered forecasts', async ({ page }) => {
  const state = await prepareForecasts(page, { rows: [forecastRow(0, { worst_case: '0.00', actual_revenue: '0.00' }), forecastRow(1), forecastRow(2, { forecast_period: '2026-Q3' })] });
  await ready(page);
  expect(state.requests.filter(request => request.path.endsWith('/forecasts/') && request.method === 'GET').length).toBeGreaterThanOrEqual(2);
  await select(page, 'Scenario').selectOption({ label: 'Best case' });
  await expect(workspace(page)).toContainText('2.25m');
  await select(page, 'Scenario').selectOption({ label: 'Worst case' });
  await expect(workspace(page).locator('.sfc-metric').filter({ hasText: 'Forecast revenue' }).locator('strong')).toHaveText('0.00');
  await expect(workspace(page)).not.toContainText('2.25m');
  await expect(workspace(page)).not.toContainText('1.35m');
  await workspace(page).getByRole('tab', { name: 'Performance', exact: true }).click();
  await expect(workspace(page).getByRole('row').filter({ hasText: 'Actual revenue' }).getByRole('cell').nth(1)).toHaveText('0');
  await select(page, 'Service line').selectOption('engineering_design');
  await expect(workspace(page).getByRole('tab', { name: 'Awards', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(workspace(page)).toContainText('1,200,000');
  await select(page, 'Period').selectOption('2026-Q3');
  await expect(select(page, 'Snapshot')).toHaveValue(forecastId(2));
  expect(state.mutations).toEqual([]);
});

test('compare uses dated snapshots from the same period without claiming an unknown-currency variance', async ({ page }) => {
  const state = await prepareForecasts(page);
  await ready(page);
  await workspace(page).getByRole('button', { name: 'Compare versions', exact: true }).click();
  const comparison = dialog(page, 'Compare forecast snapshots');
  await expect(comparison).toBeVisible();
  await expect(comparison.getByRole('combobox', { name: 'Compare with', exact: true }).getByRole('option')).toHaveCount(1);
  await expect(comparison).toContainText('30 Sep 2026');
  await expect(comparison).toContainText('1,800,000');
  await expect(comparison).toContainText('1,700,000');
  await expect(comparison).not.toContainText('v1.0');
  await expect(comparison).not.toContainText('100,000');
  await expect(comparison).not.toContainText('29 Sep 2026');
  expect(state.mutations).toEqual([]);
});

test('approved dates use Dubai time, comparison does not name itself, and mixed periods sort by their end', async ({ page }) => {
  const state = await prepareForecasts(page, { rows: [
    forecastRow(0, { status: 'approved', approved_by: 13, approved_at: '2026-09-30T22:00:00Z' }),
    forecastRow(1, { status: 'draft', approved_by: null, approved_at: null }),
    forecastRow(2, { forecast_period: '2026-12' }),
    forecastRow(3, { forecast_period: '2026-Q1', forecast_date: '2026-09-28' }),
  ] });
  await expect(select(page, 'Snapshot')).toHaveValue(forecastId(0));
  await expect(workspace(page).getByRole('button', { name: 'Edit snapshot', exact: true })).toBeDisabled();
  await expect(workspace(page).locator('.sfc-approval dd').last()).toHaveText('01 Oct 2026');
  const periodOptions = await select(page, 'Period').getByRole('option').allTextContents();
  expect(periodOptions.indexOf('Dec 2026')).toBeGreaterThanOrEqual(0);
  expect(periodOptions.indexOf('Dec 2026')).toBeLessThan(periodOptions.indexOf('Q1 2026'));
  const changes = workspace(page).getByRole('button', { name: 'View changes', exact: true });
  await expect(changes).toBeEnabled();
  await expect(workspace(page)).not.toContainText('View changes since 01 Oct 2026');
  await changes.click();
  await expect(dialog(page, 'Compare forecast snapshots').getByRole('combobox', { name: 'Compare with', exact: true })).toHaveValue(forecastId(1));
  expect(state.mutations).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('tabs expose stored breakdowns and gaps without converting model metadata into approval policy', async ({ page }) => {
  const state = await prepareForecasts(page);
  await ready(page);
  for (const tab of ['Awards', 'Revenue', 'Workload', 'Performance', 'Overview']) {
    await workspace(page).getByRole('tab', { name: tab, exact: true }).click();
    await expect(workspace(page).getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');
  }
  await workspace(page).getByRole('button', { name: /Review \d+ missing inputs/ }).click();
  await expect(workspace(page)).toContainText(/currency/i);
  await expect(workspace(page)).toContainText(/delivery phasing/i);
  await expect(workspace(page).getByRole('button', { name: 'Approve snapshot', exact: true })).toBeEnabled();
  expect(state.mutations).toEqual([]);
});

test('list failure retries and an empty forecast register keeps unsupported values unavailable', async ({ page }) => {
  const state = await prepareForecasts(page, { listStatus: 503 });
  await expect(workspace(page)).toContainText('could not be loaded');
  await expect(workspace(page).getByRole('button', { name: /retry/i })).toBeVisible();
  state.listStatus = 200;
  await workspace(page).getByRole('button', { name: /retry/i }).click();
  await ready(page);
  state.rows = [];
  await workspace(page).getByRole('button', { name: 'Refresh forecast', exact: true }).click();
  await expect(workspace(page)).toContainText(/No .*snapshots|No forecasts/i);
  await expect(workspace(page).getByRole('button', { name: /Save draft|Edit snapshot/ })).toBeDisabled();
  await expect(workspace(page)).not.toContainText('1.80m');
  expect(state.mutations).toEqual([]);
});

test('loading keeps actions unavailable until the forecast list arrives', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const state = await prepareForecasts(page, { listHold: held });
  await expect(workspace(page)).toContainText(/loading/i);
  await expect(workspace(page).getByRole('button', { name: /Save draft|Edit snapshot/ })).toBeDisabled();
  release();
  await ready(page);
  expect(state.pageErrors).toEqual([]);
});

test('late details do not replace a newer snapshot and denied details remove prior source data', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const state = await prepareForecasts(page, { rows: [forecastRow(), forecastRow(1), forecastRow(2, { forecast_date: '2026-09-28', predicted_revenue: '950000.00' })], detailHolds: { [forecastId(1)]: held } });
  await ready(page);
  await select(page, 'Snapshot').selectOption(forecastId(1));
  await select(page, 'Snapshot').selectOption(forecastId(2));
  await expect(select(page, 'Snapshot')).toHaveValue(forecastId(2));
  release();
  await expect(workspace(page)).toContainText('950');
  await expect(select(page, 'Snapshot')).toHaveValue(forecastId(2));
  state.detailStatuses[forecastId(0)] = 403;
  await select(page, 'Snapshot').selectOption(forecastId(0));
  await expect(workspace(page)).toContainText('no longer available');
  await expect(workspace(page)).not.toContainText('950,000');
  await expect(workspace(page).getByRole('button', { name: /Save draft|Edit snapshot/ })).toBeDisabled();
  state.detailStatuses[forecastId(0)] = 200;
  await workspace(page).getByRole('button', { name: /retry/i }).click();
  await ready(page);
  expect(state.pageErrors).toEqual([]);
});

test('draft edit preserves entered values after denial and saves through the retained API', async ({ page }) => {
  const state = await prepareForecasts(page, { patchStatuses: { [forecastId(0)]: [403, 200] } });
  await ready(page);
  await workspace(page).getByRole('button', { name: 'Save draft', exact: true }).click();
  const form = dialog(page, 'Forecast record');
  await form.getByLabel('Weighted revenue', { exact: true }).fill('1900000');
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(form).toContainText('could not be saved');
  await expect(form.getByLabel('Weighted revenue', { exact: true })).toHaveValue('1900000');
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(form.getByLabel('Weighted revenue', { exact: true })).toHaveCount(0);
  await form.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(workspace(page)).toContainText('1.90m');
  expect(state.mutations.filter(item => item.action === 'edit').at(-1).body.predicted_revenue).toBe('1900000');
});

test('a concurrent approval conflict retains edit input and an approved snapshot stays locked', async ({ page }) => {
  const state = await prepareForecasts(page, { patchStatuses: { [forecastId(0)]: 409 } });
  await ready(page);
  await workspace(page).getByRole('button', { name: 'Save draft', exact: true }).click();
  const form = dialog(page, 'Forecast record');
  await form.getByLabel('Weighted revenue', { exact: true }).fill('1950000');
  await form.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(form).toContainText('Approved forecast snapshots are immutable.');
  await expect(form.getByLabel('Weighted revenue', { exact: true })).toHaveValue('1950000');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await form.getByRole('button', { name: 'Close', exact: true }).click();
  await select(page, 'Snapshot').selectOption(forecastId(1));
  await expect(workspace(page).getByRole('button', { name: /Save draft|Edit snapshot/ })).toBeDisabled();
  await workspace(page).getByRole('button', { name: 'Open full forecast record', exact: true }).click();
  await expect(form).toContainText('read-only');
  await expect(form.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  expect(state.mutations.filter(item => item.action === 'edit')).toHaveLength(1);
});

test('generation retains failed input and uses the existing generation command', async ({ page }) => {
  const state = await prepareForecasts(page, { generateStatuses: [400, 200] });
  await ready(page);
  await workspace(page).getByRole('button', { name: 'Generate forecast', exact: true }).click();
  const form = dialog(page, 'Generate forecast');
  await form.getByLabel(/^Forecast period/).fill('2027-Q1');
  await form.getByLabel(/^Historical months/).fill('9');
  await form.getByRole('button', { name: 'Generate snapshot', exact: true }).click();
  await expect(form).toContainText('could not be generated');
  await expect(form.getByLabel(/^Forecast period/)).toHaveValue('2027-Q1');
  await expect(form.getByLabel(/^Historical months/)).toHaveValue('9');
  await form.getByRole('button', { name: 'Generate snapshot', exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(state.mutations.filter(item => item.action === 'generate').at(-1).body).toEqual({ period: '2027-Q1', historical_months: '9' });
});

test('existing approval command remains explicit and preserves denial before a permitted retry', async ({ page }) => {
  const state = await prepareForecasts(page, { approveStatuses: [403, 200] });
  await ready(page);
  await workspace(page).getByRole('button', { name: 'Approve snapshot', exact: true }).click();
  const form = dialog(page, 'Approve forecast snapshot');
  expect(state.mutations).toEqual([]);
  await form.getByRole('button', { name: 'Approve snapshot', exact: true }).click();
  await expect(form).toContainText('do not have permission');
  await form.getByRole('button', { name: 'Approve snapshot', exact: true }).click();
  await expect(form).toHaveCount(0);
  await expect(workspace(page).getByRole('button', { name: /Save draft|Edit snapshot/ })).toBeDisabled();
  expect(state.mutations.filter(item => item.action === 'approve')).toHaveLength(2);
});

for (const width of [1024, 768, 390]) test(`forecast controls stay reachable at ${width}px within the unchanged sidebar shell`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
  const state = await prepareForecasts(page);
  await ready(page);
  const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    page: document.querySelector('.sfc-page').getBoundingClientRect().toJSON() }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  await workspace(page).getByRole('tab', { name: 'Workload', exact: true }).click();
  await expect(workspace(page).getByRole('tab', { name: 'Workload', exact: true })).toHaveAttribute('aria-selected', 'true');
  await workspace(page).getByRole('tab', { name: 'Overview', exact: true }).click();
  await workspace(page).getByRole('button', { name: 'Generate forecast', exact: true }).click({ trial: true });
  await page.screenshot({ path: testInfo.outputPath(`forecast-responsive-${width}.png`), fullPage: true });
  await testInfo.attach('responsive-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(state.pageErrors).toEqual([]);
});
