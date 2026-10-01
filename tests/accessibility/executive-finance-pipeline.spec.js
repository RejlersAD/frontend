import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ serviceWorkers: 'block' });
test.setTimeout(90000);

const publication = '2026-10-01T07:00:00Z';
const metric = value => ({ status: 'available', value: String(value), known_value: String(value), missing_count: 0 });
const amount = value => ({ amount: String(value), known_amount: String(value), count: 1 });
const source = id => ({ kind: 'finance_source_snapshot', mode: 'workbook', status: 'available', snapshot_id: id,
  imported_at: publication, published_at: publication, route: '/finance', label: 'Published Finance workbook' });
const portfolio = {
  enabled: true, status: 'available', period: '2026-09', source: { snapshot_id: 3, reporting_date: '2026-09-30', imported_at: publication, file_name: 'Synthetic portfolio.xlsx' },
  projects: { rows: [], total_rows: 0 }, kpis: [], scope: { label: 'Synthetic portfolio scope' },
  filters: { business_units: ['Engineering'], clients: [], project_managers: [] },
};
const report = {
  schema_version: '1.0', generated_at: '2026-10-01T09:00:00Z', kpis: [], departments: [], actions: [], scope: {}, portfolio: {},
  portfolio_performance: { status: 'available', revenue_dashboard: portfolio },
};

function finance(id, currency = 'AED') {
  const value = id * 100;
  return {
    schema_version: '1.0', currency, generated_at: '2026-10-01T09:00:00Z', as_of_date: '2026-10-01', source_updated_at: publication,
    sources: { receivables: source(id) }, kpis: Object.fromEntries(['unpaid', 'overdue', 'over30', 'over60', 'over90'].map(key => [key, amount(value)])),
    customers: [], ageing: [], priority_invoices: [], filters: { currencies: ['AED', 'EUR'] },
    workbook_summary: { schema_version: '1.0', status: 'available', invoice_count: id, source: { snapshot_at: publication }, totals: { project_count: 2 }, currency_breakdown: [
      { currency, currency_status: 'recorded', totals: { invoice_amount: String(value), actual_payment_received: '20.00' }, coverage: {} },
    ] },
    invoice_performance: { schema_version: '1.0', status: 'available', currency, as_of_date: '2026-10-01', source: source(id), monthly: [
      { month: '2026-09', invoiced: amount(value), received: amount(20), outstanding: amount(value - 20) },
    ] },
  };
}

function invoices(id, offset = 0) {
  return { status: 'available', source_snapshot_id: 3, finance_snapshot_id: id, source: source(id), total_rows: 12,
    coverage: { invoice_count: 12 }, totals_by_currency: [{ currency: 'AED', invoice_count: 12, included_invoice_count: 12,
      invoice_amount: metric(id * 100), actual_payment_received: metric(20), calculated_receivable_balance: metric(80) }],
    rows: [{ id: null, record_key: `source-${id}-${offset}`, source_row_number: offset + 6, invoice_number: `SYNTHETIC-${id}-${offset}`, currency: 'AED', invoice_amount: '100.00', actual_payment_received: '20.00', actual_payment_currency: 'AED', calculated_receivable_balance: '80.00', balance_currency: 'AED', payment_status: 'partially_paid' }],
  };
}

async function open(page, tab = '') {
  const state = { id: 7, deny: false, requests: [], errors: [], unknown: [] };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('radai_access_token', 'synthetic-executive-pipeline'));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    state.requests.push({ path, method: request.method(), params: Object.fromEntries(url.searchParams) });
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/v1/dashboard/executive/') return reply(report);
    if (path === '/api/v1/dashboard/executive/receivables/') return state.deny ? reply({ detail: 'Denied' }, 403) : reply(finance(state.id, url.searchParams.get('currency')));
    if (path === '/api/v1/dashboard/executive/portfolio-workbook/revenue/') return reply(portfolio);
    if (path === '/api/v1/dashboard/executive/portfolio-workbook/outgoing-invoices/') {
      const pin = url.searchParams.get('finance_snapshot_id');
      return pin !== null && Number(pin) !== state.id ? reply({ code: 'finance_source_changed' }, 409) : reply(invoices(state.id, Number(url.searchParams.get('offset'))));
    }
    state.unknown.push(path); return reply({ detail: 'Unexpected request' }, 404);
  });
  await page.goto(`/tests/fixtures/executive-finance-pipeline.html${tab ? `?tab=${tab}` : ''}`, { waitUntil: 'domcontentloaded' });
  return state;
}
const clean = state => {
  expect(state.errors).toEqual([]); expect(state.unknown).toEqual([]);
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
};

test('Overview refreshes published Finance on focus, preserves period and exports the displayed source', async ({ page }) => {
  const state = await open(page);
  await expect(page.getByTestId('executive-kpi-revenue')).toContainText('AED 700');
  await expect(page.getByTestId('executive-kpi-total_projects').locator('.eov-kpi-value')).toHaveText('2');
  await expect(page.getByTestId('executive-kpi-total_projects')).toContainText('Unique RAD project numbers');
  await expect(page.getByRole('link', { name: 'View Finance source' })).toHaveAttribute('href', '/finance');
  await page.getByRole('group', { name: 'Invoiced revenue period', exact: true }).getByRole('button', { name: 'YTD' }).click();
  state.id = 8;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('executive-kpi-revenue')).toContainText('AED 800');
  await expect(page.getByRole('group', { name: 'Invoiced revenue period', exact: true }).getByRole('button', { name: 'YTD' })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('summary[aria-label="More overview options"]').click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
  const saved = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'));
  expect(saved.finance.receivables.sources.receivables.snapshot_id).toBe(8);
  expect(saved.finance.reporting_period.mode).toBe('ytd');
  await page.getByRole('tab', { name: 'Financial performance', exact: true }).click();
  await expect(page.getByTestId('financial-kpi-total_projects')).toContainText('2');
  clean(state);
});

test('Financial publication provenance is explicit and source denial clears old Finance values', async ({ page }) => {
  const state = await open(page, 'financial');
  await expect(page.locator('.cc-retrieved')).toContainText('Finance snapshot published');
  await expect(page.locator('.ef-kpi').first()).toContainText('700');
  state.deny = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('You do not have access to the financial invoice summary.')).toBeVisible();
  await expect(page.locator('.ef-kpi').first()).not.toContainText('700');
  await expect(page.getByRole('tab', { name: 'Project portfolio' })).toBeEnabled();
  clean(state);
});

test('Portfolio pins Finance publication across pages and reloads changed sources as read-only workbook rows', async ({ page }) => {
  const state = await open(page, 'portfolio');
  await page.getByRole('button', { name: 'Open invoice control' }).click();
  const section = page.getByTestId('portfolio-recorded-invoices');
  await expect(section).toContainText('SYNTHETIC-7-0');
  await expect(section).toContainText('Workbook row 6');
  await expect(section.getByRole('link', { name: 'Open Finance source' })).toHaveAttribute('href', '/finance');
  await expect(section.getByRole('link', { name: 'Open invoice', exact: true })).toHaveCount(0);
  state.id = 8;
  await page.getByRole('button', { name: 'Next recorded invoice page' }).click();
  await expect(section.getByRole('alert')).toContainText('A reporting source changed');
  expect(state.requests.at(-1).params.finance_snapshot_id).toBe('7');
  await section.getByRole('button', { name: 'Refresh portfolio source' }).click();
  await expect(section).toContainText('SYNTHETIC-8-0');
  await expect(section).toContainText('Page 1 of 2');
  clean(state);
});
