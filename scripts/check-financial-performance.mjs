import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { receivablesFixture, customerInvoicesFixture } from './check-receivables-dashboard-fixtures.mjs';

// Real Executive shell plus shared receivables components; every response is synthetic and read-only.
export async function runFinancialPerformanceChecks({ frontend, newPage, assertGeometry, reportFixture, verification }) {
  const artifacts = verification?.artifacts || path.resolve(frontend, '../artifacts/financial-performance');
  await mkdir(artifacts, { recursive: true });
  const checks = [], accessibility = [], geometries = [];
  const record = message => { checks.push(message); console.log(`PASS financial: ${message}`); };
  const finance = page => page.locator('.finance-command-center');
  const register = page => page.getByTestId('customer-invoices-section');
  const amount = async (page, id) => Number((await page.getByTestId(`finance-kpi-${id}`).locator('strong').innerText()).replace(/[^\d.-]/g, ''));
  const requests = (control, endpoint = '/dashboard/executive/receivables/') => control.requests.filter(row => row.endpoint === endpoint);
  const response = (page, endpoint = 'receivables') => page.waitForResponse(row => new URL(row.url()).pathname === `/fixture-api/dashboard/executive/${endpoint}/`);
  const ready = async page => { await page.getByRole('heading', { name: 'Financial Performance', exact: true }).waitFor(); await finance(page).waitFor(); await page.waitForFunction(() => document.querySelector('.finance-command-center')?.getAttribute('aria-busy') === 'false'); };
  const registerReady = async page => { await register(page).waitFor(); await page.waitForFunction(() => document.querySelector('[data-testid="customer-invoices-section"]')?.getAttribute('aria-busy') === 'false'); };
  const open = async (options = {}) => { const state = await newPage({ ...options, route: '/executive?tab=financial' }); if (!options.loading && !options.financeLoading && (!options.status || options.status === 200)) await ready(state.page); return state; };
  const close = state => state.page.context().close();
  const capture = async (page, name, print = false) => {
    await page.locator('main.main-content').evaluate(main => { for (const node of [main, ...main.querySelectorAll('*')]) { node.scrollTop = 0; node.scrollLeft = 0; } });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: print, animations: 'disabled' });
  };
  const axe = async (page, name) => {
    const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const violations = result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
    accessibility.push({ name, violations }); assert.deepEqual(violations, [], `${name}: accessible Executive receivables`);
  };
  const more = async (page, label) => { await page.getByLabel('More dashboard options', { exact: true }).click(); await page.getByText(label, { exact: true }).click(); };
  const filter = async (state, label, value, input = false) => {
    const pending = response(state.page), field = state.page.getByLabel(label, { exact: true });
    if (input) await field.fill(value); else await field.selectOption(value);
    await pending; await ready(state.page); return new URLSearchParams(requests(state.control).at(-1).query);
  };
  const download = async (page, button) => { const event = page.waitForEvent('download'); await button.click(); const file = await event; return { filename: file.suggestedFilename(), bytes: await readFile(await file.path()) }; };
  await verification?.assertProtected?.();

  let state = await open(); let { page, control } = state; await registerReady(page);
  assert.equal(await page.locator('main h1').count(), 1, 'Embedded dashboard preserves the single Executive title');
  assert.equal(await page.getByRole('tab', { name: 'Financial performance', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByLabel('Financial reporting currency', { exact: true }).count(), 0, 'Legacy duplicate currency control is removed');
  assert.equal(await page.getByLabel('Comparison basis', { exact: true }).count(), 0, 'Unavailable target control is not duplicated above live receivables');
  for (const [id, expected] of [['unpaid', 380828], ['overdue', 313499], ['over30', 286591], ['over90', 148983]]) assert.equal(await amount(page, id), expected);
  assert.equal(await page.locator('[data-testid^="finance-kpi-"]').count(), 4); assert.equal(await page.locator('.ar-analysis-grid > .ar-panel').count(), 7);
  assert.deepEqual(await page.locator('.ar-invoices-panel tbody th[scope="row"]').allTextContents(), receivablesFixture().data.priority_invoices.map(row => row.company));
  assert.deepEqual(await register(page).locator('tbody th[scope="row"]').allTextContents(), customerInvoicesFixture().data.rows.map(row => row.company));
  assert.doesNotMatch(await finance(page).innerText(), /LEGACY-|Customer not recorded/);
  assert.ok(requests(control).length && requests(control, '/dashboard/executive/customer-invoices/').length);
  assert.ok(!control.requests.some(row => row.endpoint.startsWith('/finance/dashboard/')), 'Executive access uses its own authorized Finance endpoints');
  record('Four live receivables KPIs, seven panels and company-based invoices use authorized Executive endpoints');

  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    const geometry = await finance(page).evaluate(node => ({ width: node.getBoundingClientRect().width, charts: [...node.querySelectorAll('.ar-panel svg[role="img"]')].map(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, text: [...svg.querySelectorAll('text')].map(text => { const rect = text.getBoundingClientRect(), bounds = svg.getBoundingClientRect(); return { text: text.textContent, inside: rect.left >= bounds.left - 2 && rect.right <= bounds.right + 2 && rect.top >= bounds.top - 2 && rect.bottom <= bounds.bottom + 2 }; }) })) }));
    assert.equal(geometry.charts.length, 5);
    for (const chart of geometry.charts) { assert.ok(chart.width > 100 && chart.height > 40, 'Executive icon rules cannot shrink chart SVGs'); assert.ok(chart.text.every(row => row.inside), 'Chart labels remain within SVG bounds'); }
    geometries.push({ width, ...geometry }); await capture(page, `financial-${width}`); if (width === 1672 || width === 390) await axe(page, `financial-${width}`);
  }
  await assertGeometry(page, 1672); await page.evaluate(() => document.documentElement.classList.add('dark'));
  await capture(page, 'financial-dark'); await axe(page, 'financial-dark'); await page.evaluate(() => document.documentElement.classList.remove('dark'));
  record('Desktop, tablet, mobile and dark preserve sidebar geometry, full-size charts and accessible controls');

  let params = await filter(state, 'Reporting currency', 'USD'); assert.equal(params.get('currency'), 'USD'); assert.equal(await amount(page, 'unpaid'), 5000);
  await filter(state, 'Reporting currency', 'AED'); params = await filter(state, 'Customer', 'Stripe Inc.'); assert.equal(params.get('company'), 'Stripe Inc.'); assert.equal(params.has('account'), false); assert.equal(await amount(page, 'unpaid'), 127520);
  params = await filter(state, 'Period', '6'); assert.equal(params.get('months'), '6'); params = await filter(state, 'As of', '2026-09-20', true); assert.equal(params.get('as_of'), '2026-09-20'); await registerReady(page);
  await more(page, 'Source coverage'); const dialog = page.getByRole('dialog'); await dialog.waitFor(); assert.match(await dialog.innerText(), /COMPANY|company/); await axe(page, 'financial-source-dialog');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'More dashboard options');
  const csv = await download(page, finance(page).getByRole('button', { name: /^Export/ })); assert.match(csv.filename, /\.csv$/); assert.match(csv.bytes.toString(), /127520/); assert.match(csv.bytes.toString(), /Stripe Inc\./); assert.doesNotMatch(csv.bytes.toString(), /LEGACY-/); await writeFile(path.join(artifacts, csv.filename), csv.bytes);
  record('Currency/customer/period/date filters, source coverage and scoped CSV match shared Finance behavior');

  await page.getByRole('button', { name: 'Export board report', exact: true }).click(); const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printed.title, 'Financial Performance'); assert.deepEqual(printed.actions, []); assert.equal(printed.receivablesCurrency, 'AED'); assert.equal(printed.receivablesCompany, 'Stripe Inc.'); assert.match(printed.receivablesText, /Stripe Inc\./); assert.equal(printed.receivablesKpis.length, 4); assert.ok(printed.customerInvoices.length > 0);
  assert.equal(await page.locator('.ar-print-scope').isVisible(), false, 'Print scope does not duplicate screen filters');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.ar-print-scope').isVisible(), true);
  assert.match(await page.locator('.ar-print-scope').innerText(), /Stripe Inc\./); assert.match(await page.locator('.ar-print-scope').innerText(), /AED/); assert.match(await page.locator('.ar-print-scope').innerText(), /6/);
  const clippedPrintRegions = await finance(page).evaluate(node => [...node.querySelectorAll('[class*="scroll"]')].filter(element => { const style = getComputedStyle(element); return /auto|scroll|hidden/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2; }).map(element => element.className));
  assert.deepEqual(clippedPrintRegions, [], 'Printed financial panels expose current rows without scroll clipping');
  await capture(page, 'financial-board-print', true); await page.pdf({ path: path.join(artifacts, 'financial-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await ready(page);
  assert.equal(await page.getByLabel('Customer', { exact: true }).inputValue(), 'Stripe Inc.'); assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  const snapshot = await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true })), snapshotData = JSON.parse(snapshot.bytes.toString());
  assert.equal(snapshotData.report_type, 'executive_financial_performance'); assert.equal(snapshotData.schema_version, '1.0');
  assert.deepEqual(snapshotData.receivables, receivablesFixture('full', { currency: 'AED', company: 'Stripe Inc.', months: '6', as_of: '2026-09-20' }).data);
  assert.deepEqual(snapshotData.customer_invoice_register, customerInvoicesFixture('full', { currency: 'AED', company: 'Stripe Inc.' }).data);
  assert.ok(!snapshotData.customer_invoice_register_error); await writeFile(path.join(artifacts, snapshot.filename), snapshot.bytes);
  record('Board print includes current Financial rows; snapshots contain the exact filtered receivables/register responses and preserve screen state');

  await filter(state, 'Customer', ''); await registerReady(page);
  let pending = response(page, 'customer-invoices'); await register(page).getByRole('button', { name: 'Next customer invoice page', exact: true }).click(); await pending; await registerReady(page); assert.equal(new URLSearchParams(requests(control, '/dashboard/executive/customer-invoices/').at(-1).query).get('page'), '2');
  pending = response(page, 'customer-invoices'); await register(page).getByRole('button', { name: 'Sort customer invoices by Customer', exact: true }).click(); await pending; await registerReady(page); params = new URLSearchParams(requests(control, '/dashboard/executive/customer-invoices/').at(-1).query); assert.equal(params.get('ordering'), 'company'); assert.equal(params.get('page'), '1'); assert.match(await register(page).locator('tbody tr').first().innerText(), /Business Tech/);
  const companyLink = page.locator('.ar-summary-panel').getByRole('link', { name: 'Stripe Inc.', exact: true }); const companyRoute = new URL(await companyLink.getAttribute('href'), 'http://executive-check.test'); assert.equal(companyRoute.searchParams.get('company'), 'Stripe Inc.'); assert.equal(companyRoute.searchParams.has('account'), false);
  await companyLink.click(); await page.getByRole('heading', { name: 'Drilldown destination', exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.executiveRoute), companyRoute.pathname + companyRoute.search);
  await page.evaluate(() => window.executiveNavigate('/executive?tab=financial')); await ready(page); await registerReady(page);
  const before = requests(control).length; pending = response(page); await page.getByRole('button', { name: /^Refresh (overview|financial)/i }).click(); await pending; await ready(page); assert.ok(requests(control).length > before, 'Outer Refresh reloads embedded data');
  record('Company sorting, pagination, company drilldowns, deep links and outer Refresh work together');

  await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.getByTestId('executive-outcomes').waitFor(); assert.equal(await finance(page).count(), 0);
  const overviewSnapshot = await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true })); assert.deepEqual(JSON.parse(overviewSnapshot.bytes.toString()), reportFixture());
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await ready(page); assert.match(await page.evaluate(() => window.executiveRoute), /tab=financial/); await page.reload(); await ready(page); await close(state);
  record('Tab keyboard navigation/reload retain Financial deep links; other tabs retain the original report export');

  for (const fixture of ['empty', 'partial', 'restricted', 'payables-restricted', 'missing-company', 'error', 'forbidden', 'register-error']) {
    state = await open({ financeFixture: fixture }); ({ page, control } = state);
    if (fixture === 'empty') assert.equal(await amount(page, 'unpaid'), 0);
    if (fixture === 'partial') { assert.equal(await amount(page, 'unpaid'), 380828); assert.match(await page.getByTestId('finance-kpi-unpaid').innerText(), /recorded|missing|partial/i); }
    if (fixture === 'restricted') { assert.match(await finance(page).innerText(), /access|restricted/i); assert.doesNotMatch(await finance(page).innerText(), /Stripe Inc\./); assert.equal(await finance(page).locator('a[href^="/finance/outgoing-invoices"]').count(), 0); }
    if (fixture === 'payables-restricted') { assert.equal(await amount(page, 'unpaid'), 380828); assert.equal(await page.locator('.ar-ageing-panel .ar-chart-mark[aria-label*="Bills"],.ar-trend-panel .ar-chart-mark[aria-label*="Bills"]').count(), 0); }
    if (fixture === 'missing-company') { assert.match(await finance(page).innerText(), /Customer not recorded/); assert.doesNotMatch(await finance(page).innerText(), /LEGACY-ONLY-ACCOUNT/); }
    if (fixture === 'error' || fixture === 'forbidden') { assert.equal(await finance(page).getByRole('button', { name: /^Export/ }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Export snapshot', exact: true }).isDisabled(), true); control.financeFixture = 'full'; pending = response(page); await finance(page).getByRole('button', { name: /try again|retry/i }).click(); await pending; await ready(page); assert.equal(await amount(page, 'unpaid'), 380828); }
    if (fixture === 'register-error') { await registerReady(page); assert.match(await register(page).innerText(), /unavailable|could not/i); assert.equal(await amount(page, 'unpaid'), 380828); const failedSnapshot = JSON.parse((await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true }))).bytes.toString()); assert.equal(failedSnapshot.customer_invoice_register, null); assert.match(failedSnapshot.customer_invoice_register_error, /unavailable|could not/i); control.financeFixture = 'full'; pending = response(page, 'customer-invoices'); await register(page).getByRole('button', { name: /try again|retry/i }).click(); await pending; await registerReady(page); }
    await capture(page, `financial-${fixture}`); await axe(page, `financial-${fixture}`); await close(state);
  }
  record('Zero/partial balances, company gaps, restricted AR/AP, endpoint errors and independent register retry remain truthful');

  state = await open({ financeLoading: true }); ({ page, control } = state); await finance(page).waitFor(); assert.equal(await finance(page).getAttribute('aria-busy'), 'true'); assert.equal(await page.getByRole('button', { name: 'Export board report', exact: true }).isDisabled(), true); await control.releaseFinance(); await ready(page); await close(state);
  state = await open({ registerLoading: true }); ({ page, control } = state); await register(page).waitFor(); await page.waitForFunction(() => document.querySelector('[data-testid="customer-invoices-section"]')?.getAttribute('aria-busy') === 'true'); assert.equal(await amount(page, 'unpaid'), 380828); assert.equal(await page.getByRole('button', { name: 'Export snapshot', exact: true }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Export board report', exact: true }).isDisabled(), true); await control.releaseRegister(); await registerReady(page);
  control.registerLoading = true; await filter(state, 'Reporting currency', 'USD');
  await page.waitForFunction(() => document.querySelector('[data-testid="customer-invoices-section"]')?.getAttribute('aria-busy') === 'true');
  assert.equal(await page.getByRole('button', { name: 'Export snapshot', exact: true }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Export board report', exact: true }).isDisabled(), true);
  await control.releaseRegister(); await registerReady(page);
  const foreignSnapshot = JSON.parse((await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true }))).bytes.toString());
  assert.deepEqual(foreignSnapshot.receivables, receivablesFixture('full', { currency: 'USD' }).data); assert.deepEqual(foreignSnapshot.customer_invoice_register, customerInvoicesFixture('full', { currency: 'USD' }).data); await close(state);
  for (const status of [403, 503]) { state = await open({ status }); ({ page, control } = state); await page.getByRole('alert').waitFor(); assert.equal(await finance(page).count(), 0); control.status = 200; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await ready(page); await close(state); }
  state = await open(); ({ page, control } = state); control.financeStatus = 503; await more(page, 'Refresh data'); await ready(page); assert.doesNotMatch((await page.locator('.ar-analysis-grid, .ar-customer-register').allTextContents()).join(' '), /Stripe Inc\./); assert.equal(await finance(page).getByRole('button', { name: /^Export/ }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Export snapshot', exact: true }).isDisabled(), true); control.financeStatus = null; pending = response(page); await finance(page).getByRole('button', { name: /try again|retry/i }).click(); await pending; await ready(page); assert.equal(await amount(page, 'unpaid'), 380828); await close(state);
  record('Independent loading, outer Executive failures and failed-refresh stale-data removal recover without exposing unauthorized data');
  await verification?.assertProtected?.();
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: true, checks, accessibility, geometries, protectedHashesUnchanged: true }, null, 2));
  console.log(`Financial artifacts: ${artifacts}`);
}
