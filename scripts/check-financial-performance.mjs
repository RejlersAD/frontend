import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
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
  const workbook = page => page.locator('.ar-workbook-summary');
  const workbookValues = async (page, available = true) => {
    const panel = page.locator('.ar-payment-status-panel');
    assert.deepEqual(await workbook(page).locator('h3').allTextContents(), ['Total amount', 'Total amount in AED', 'Total amount received', 'Total projects']);
    const text = await workbook(page).innerText();
    assert.equal(await page.getByRole('heading', { name: 'Ageing by due period', exact: true }).count(), 0);
    if (!available) {
      assert.doesNotMatch(text + await panel.innerText(), /315,481,678|466,151,390|285,759,742|3,895|4,404/);
      for (const id of ['invoice_amount', 'invoice_amount_aed', 'actual_payment_received', 'project_count']) assert.equal(await page.getByTestId(`workbook-total-${id}`).locator('strong').innerText(), '\u2014');
      return;
    }
    const expected = receivablesFixture().data.workbook_summary;
    for (const [id, value] of Object.entries(expected.totals)) {
      const displayed = await page.getByTestId(`workbook-total-${id}`).locator('strong').innerText();
      assert.equal(Number(displayed.replace(/[^\d.-]/g, '')), Number(value));
      if (id === 'invoice_amount_aed') assert.match(displayed, /AED/); else assert.doesNotMatch(displayed, /AED|USD/);
    }
    assert.match(text, /full workbook/i); assert.match(text, /unaffected by dashboard filters/i); assert.match(text, /mixed|original currencies/i);
    for (const row of expected.payment_status) assert.equal((await panel.locator(`[data-status="${row.id}"]`).innerText()).replace(/\s+/g, ' ').trim(), `${row.label} ${row.count.toLocaleString('en-US')}`);
    assert.match(await panel.locator('tfoot').innerText(), /Total\s+4,404/);
  };
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
  const invoiceOverviewLayout = async (page, printing = false) => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const result = await page.locator('.ar-invoice-overview').evaluate(node => { const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; }; const history = node.querySelector('.ar-history-panel'), register = node.querySelector('.ar-customer-register'), plot = history.querySelector('svg[role="img"]'); return { viewport: innerWidth, wrapper: box(node), history: box(history), register: box(register), plot: box(plot), columns: register.querySelectorAll('thead th').length, monthLabels: [...history.querySelectorAll('text.ar-chart-axis-label')].map(box) }; });
    assert.equal(result.columns, 15); assert.ok(result.plot.height >= 250);
    assert.ok(result.monthLabels.every((label, index, labels) => index === 0 || label.x >= labels[index - 1].right - 1), 'Payment month labels remain distinct');
    if (printing || result.viewport <= 1100) {
      assert.ok(result.register.y >= result.history.bottom - 1, 'Invoice panels stack for mobile and print');
      assert.equal(Math.round(result.register.x), Math.round(result.history.x));
      assert.equal(Math.round(result.register.width), Math.round(result.wrapper.width));
    } else {
      assert.equal(Math.round(result.register.y), Math.round(result.history.y), 'Invoice panels share their desktop row');
      assert.ok(result.register.x >= result.history.right - 1, 'Desktop invoice panels do not overlap');
    }
    geometries.push({ invoiceOverview: result, printing });
  };
  await verification?.assertProtected?.();

  if (process.argv.includes('--print-only') || process.argv.includes('--invoice-layout-only')) {
    const state = await open(); const { page } = state; await registerReady(page);
    if (process.argv.includes('--invoice-layout-only')) {
      for (const width of [1672, 1440, 1024, 390]) {
        await assertGeometry(page, width); await workbookValues(page); await invoiceOverviewLayout(page);
        await page.locator('.ar-invoice-overview').screenshot({ path: path.join(artifacts, `financial-invoice-overview-${width}.png`), animations: 'disabled' });
        if (width === 1672 || width === 390) await axe(page, `financial-invoice-overview-${width}`);
      }
      await assertGeometry(page, 1672); await page.evaluate(() => document.documentElement.classList.add('dark')); await invoiceOverviewLayout(page); await axe(page, 'financial-invoice-overview-dark');
      await page.locator('.ar-invoice-overview').screenshot({ path: path.join(artifacts, 'financial-invoice-overview-dark.png'), animations: 'disabled' });
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      record('Clean workbook labels and paired invoice panels fit desktop, tablet, mobile and dark layouts');
    }
    await page.setViewportSize({ width: 1123, height: 794 });
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await page.emulateMedia({ media: 'print' });
    await workbookValues(page);
    await invoiceOverviewLayout(page, true);
    const geometry = await register(page).evaluate(node => { const table = node.querySelector('table'), bounds = table.getBoundingClientRect(), viewport = node.getBoundingClientRect(); return { tableFits: bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1, columns: [...table.querySelectorAll('thead th')].map(cell => ({ field: cell.dataset.field, visible: getComputedStyle(cell).display !== 'none', width: cell.getBoundingClientRect().width })), clipped: [...node.querySelectorAll('[class*="scroll"]')].some(element => { const style = getComputedStyle(element); return /auto|scroll|hidden/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 2 || /auto|scroll|hidden/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2; }) }; });
    assert.equal(geometry.tableFits, true); assert.equal(geometry.clipped, false); assert.equal(geometry.columns.length, 15); assert.ok(geometry.columns.every(column => column.visible && column.width > 0), 'All fifteen printed columns fit the landscape report width');
    await register(page).screenshot({ path: path.join(artifacts, 'financial-customer-invoices-print.png'), animations: 'disabled' });
    await capture(page, 'financial-board-print', true); await page.pdf({ path: path.join(artifacts, 'financial-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
    await close(state); await verification?.assertProtected?.();
    record('All fifteen customer invoice columns remain visible and unclipped in the landscape printed report');
    await writeFile(path.join(artifacts, process.argv.includes('--invoice-layout-only') ? 'invoice-layout-checks.json' : 'print-checks.json'), JSON.stringify({ passed: true, checks, geometry, geometries, accessibility, protectedHashesUnchanged: true }, null, 2));
    return;
  }

  let state = await open(); let { page, control } = state; await registerReady(page);
  assert.equal(await page.locator('main h1').count(), 1, 'Embedded dashboard preserves the single Executive title');
  assert.equal(await page.getByRole('tab', { name: 'Financial performance', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByLabel('Financial reporting currency', { exact: true }).count(), 0, 'Legacy duplicate currency control is removed');
  assert.equal(await page.getByLabel('Comparison basis', { exact: true }).count(), 0, 'Unavailable target control is not duplicated above live receivables');
  for (const [id, expected] of [['unpaid', 380828], ['overdue', 313499], ['over30', 286591], ['over90', 148983]]) assert.equal(await amount(page, id), expected);
  assert.equal(await page.locator('[data-testid^="finance-kpi-"]').count(), 4); assert.equal(await page.locator('.ar-analysis-grid > .ar-panel').count(), 6); assert.equal(await page.locator('.ar-invoice-overview > .ar-panel').count(), 1);
  await workbookValues(page);
  assert.deepEqual(await page.locator('.ar-invoices-panel tbody th[scope="row"]').allTextContents(), receivablesFixture().data.priority_invoices.map(row => row.company));
  assert.deepEqual(await register(page).locator('tbody th[scope="row"]').allTextContents(), customerInvoicesFixture().data.rows.map(row => row.company));
  assert.doesNotMatch(await finance(page).innerText(), /LEGACY-|Customer not recorded/);
  assert.ok(requests(control).length && requests(control, '/dashboard/executive/customer-invoices/').length);
  assert.ok(!control.requests.some(row => row.endpoint.startsWith('/finance/dashboard/')), 'Executive access uses its own authorized Finance endpoints');
  record('Four workbook totals and payment status counts accompany live receivables via authorized Executive endpoints');

  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    await invoiceOverviewLayout(page);
    const geometry = await finance(page).evaluate(node => ({ width: node.getBoundingClientRect().width, charts: [...node.querySelectorAll('.ar-panel svg[role="img"]')].map(svg => ({ width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height, text: [...svg.querySelectorAll('text')].map(text => { const rect = text.getBoundingClientRect(), bounds = svg.getBoundingClientRect(); return { text: text.textContent, inside: rect.left >= bounds.left - 2 && rect.right <= bounds.right + 2 && rect.top >= bounds.top - 2 && rect.bottom <= bounds.bottom + 2 }; }) })) }));
    assert.equal(geometry.charts.length, 4);
    const summaryFits = await workbook(page).evaluate(node => [...node.querySelectorAll('[data-testid^="workbook-total-"]')].every(card => { const rect = card.getBoundingClientRect(); return card.scrollWidth <= card.clientWidth + 1 && rect.left >= 0 && rect.right <= innerWidth + 1; }));
    assert.equal(summaryFits, true, 'Workbook amounts fit at every Executive viewport');
    await workbookValues(page);
    for (const chart of geometry.charts) { assert.ok(chart.width > 100 && chart.height > 40, 'Executive icon rules cannot shrink chart SVGs'); assert.ok(chart.text.every(row => row.inside), 'Chart labels remain within SVG bounds'); }
    geometries.push({ width, ...geometry }); await capture(page, `financial-${width}`); if (width === 1672 || width === 390) await axe(page, `financial-${width}`);
  }
  await assertGeometry(page, 1672); await page.evaluate(() => document.documentElement.classList.add('dark'));
  await capture(page, 'financial-dark'); await axe(page, 'financial-dark'); await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.setViewportSize({ width: 2560, height: 1440 });
  await register(page).screenshot({ path: path.join(artifacts, 'financial-customer-invoices-wide.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1672, height: 941 });
  await register(page).locator('.ar-customer-register-scroll').evaluate(node => { node.scrollLeft = node.scrollWidth; });
  await register(page).screenshot({ path: path.join(artifacts, 'financial-customer-invoices-right.png'), animations: 'disabled' });
  await register(page).locator('.ar-customer-register-scroll').evaluate(node => { node.scrollLeft = 0; });
  record('Desktop, tablet, mobile and dark preserve sidebar geometry, full-size charts and accessible controls');

  let params = await filter(state, 'Reporting currency', 'USD'); assert.equal(params.get('currency'), 'USD'); assert.equal(await amount(page, 'unpaid'), 5000);
  await workbookValues(page);
  await filter(state, 'Reporting currency', 'AED'); params = await filter(state, 'Customer', 'Stripe Inc.'); assert.equal(params.get('company'), 'Stripe Inc.'); assert.equal(params.has('account'), false); assert.equal(await amount(page, 'unpaid'), 127520);
  params = await filter(state, 'Period', '6'); assert.equal(params.get('months'), '6'); params = await filter(state, 'As of', '2026-09-20', true); assert.equal(params.get('as_of'), '2026-09-20'); await registerReady(page);
  await workbookValues(page);
  await more(page, 'Source coverage'); const dialog = page.getByRole('dialog'); await dialog.waitFor(); assert.match(await dialog.innerText(), /COMPANY|company/); await axe(page, 'financial-source-dialog');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'More dashboard options');
  const csv = await download(page, finance(page).getByRole('button', { name: /^Export/ })); assert.match(csv.filename, /\.csv$/); assert.match(csv.bytes.toString(), /127520/); assert.match(csv.bytes.toString(), /Stripe Inc\./); assert.doesNotMatch(csv.bytes.toString(), /LEGACY-/); await writeFile(path.join(artifacts, csv.filename), csv.bytes);
  for (const value of ['315481678.41', '466151390.16', '285759742.00', '4404', '3895']) assert.ok(csv.bytes.toString().includes(value), `Executive CSV includes workbook value ${value}`);
  record('Currency/customer/period/date filters, source coverage and scoped CSV match shared Finance behavior');

  await page.getByRole('button', { name: 'Export board report', exact: true }).click(); const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printed.title, 'Financial Performance'); assert.deepEqual(printed.actions, []); assert.equal(printed.receivablesCurrency, 'AED'); assert.equal(printed.receivablesCompany, 'Stripe Inc.'); assert.match(printed.receivablesText, /Stripe Inc\./); assert.equal(printed.receivablesKpis.length, 4); assert.ok(printed.customerInvoices.length > 0);
  assert.equal(await page.locator('.ar-print-scope').isVisible(), false, 'Print scope does not duplicate screen filters');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await page.emulateMedia({ media: 'print' });
  await invoiceOverviewLayout(page, true);
  await workbookValues(page);
  const workbookPrint = await workbook(page).evaluate(node => { const bounds = node.getBoundingClientRect(); return [...node.querySelectorAll('[data-testid^="workbook-total-"]')].map(card => { const rect = card.getBoundingClientRect(); return { inside: rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1, visible: getComputedStyle(card).display !== 'none', fits: card.scrollWidth <= card.clientWidth + 1 }; }); });
  assert.equal(workbookPrint.length, 4); assert.ok(workbookPrint.every(card => card.inside && card.visible && card.fits), 'All four workbook values fit in the printed report');
  assert.equal(await page.locator('.ar-print-scope').isVisible(), true);
  assert.match(await page.locator('.ar-print-scope').innerText(), /Stripe Inc\./); assert.match(await page.locator('.ar-print-scope').innerText(), /AED/); assert.match(await page.locator('.ar-print-scope').innerText(), /6/);
  const clippedPrintRegions = await finance(page).evaluate(node => [...node.querySelectorAll('[class*="scroll"]')].filter(element => { const style = getComputedStyle(element); return /auto|scroll|hidden/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2; }).map(element => element.className));
  assert.deepEqual(clippedPrintRegions, [], 'Printed financial panels expose current rows without scroll clipping');
  const printedRegister = await register(page).evaluate(node => { const table = node.querySelector('table'), bounds = table.getBoundingClientRect(), viewport = node.getBoundingClientRect(); return { tableFits: bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1, columns: [...table.querySelectorAll('thead th')].map(cell => ({ field: cell.dataset.field, visible: getComputedStyle(cell).display !== 'none', width: cell.getBoundingClientRect().width })), scrollClipped: [...node.querySelectorAll('[class*="scroll"]')].some(element => /auto|scroll|hidden/.test(getComputedStyle(element).overflowX) && element.scrollWidth > element.clientWidth + 2) }; });
  assert.equal(printedRegister.tableFits, true); assert.equal(printedRegister.scrollClipped, false); assert.equal(printedRegister.columns.length, 15); assert.ok(printedRegister.columns.every(column => column.visible && column.width > 0), 'All fifteen printed columns are visible within the report width');
  await register(page).screenshot({ path: path.join(artifacts, 'financial-customer-invoices-print.png'), animations: 'disabled' });
  await capture(page, 'financial-board-print', true); await page.pdf({ path: path.join(artifacts, 'financial-board-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await ready(page);
  assert.equal(await page.getByLabel('Customer', { exact: true }).inputValue(), 'Stripe Inc.'); assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  const snapshot = await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true })), snapshotData = JSON.parse(snapshot.bytes.toString());
  assert.equal(snapshotData.report_type, 'executive_financial_performance'); assert.equal(snapshotData.schema_version, '1.0');
  assert.deepEqual(snapshotData.receivables, receivablesFixture('full', { currency: 'AED', company: 'Stripe Inc.', months: '6', as_of: '2026-09-20' }).data);
  assert.deepEqual(snapshotData.customer_invoice_register, customerInvoicesFixture('full', { currency: 'AED', company: 'Stripe Inc.', as_of: '2026-09-20' }).data);
  assert.ok(!snapshotData.customer_invoice_register_error); await writeFile(path.join(artifacts, snapshot.filename), snapshot.bytes);
  record('Board print includes current Financial rows; snapshots contain the exact filtered receivables/register responses and preserve screen state');

  await filter(state, 'Customer', ''); await registerReady(page);
  let pending = response(page, 'customer-invoices'); await register(page).getByRole('button', { name: 'Next customer invoice page', exact: true }).click(); await pending; await registerReady(page); assert.equal(new URLSearchParams(requests(control, '/dashboard/executive/customer-invoices/').at(-1).query).get('page'), '2');
  pending = response(page, 'customer-invoices'); await register(page).getByRole('button', { name: 'Sort customer invoices by COMPANY', exact: true }).click(); await pending; await registerReady(page); params = new URLSearchParams(requests(control, '/dashboard/executive/customer-invoices/').at(-1).query); assert.equal(params.get('ordering'), 'company'); assert.equal(params.get('page'), '1'); assert.match(await register(page).locator('tbody tr').first().innerText(), /Business Tech/);
  const companyLink = page.locator('.ar-summary-panel').getByRole('link', { name: 'Stripe Inc.', exact: true }); const companyRoute = new URL(await companyLink.getAttribute('href'), 'http://executive-check.test'); assert.equal(companyRoute.searchParams.get('company'), 'Stripe Inc.'); assert.equal(companyRoute.searchParams.has('account'), false);
  await companyLink.click(); await page.getByRole('heading', { name: 'Drilldown destination', exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.executiveRoute), companyRoute.pathname + companyRoute.search);
  await page.evaluate(() => window.executiveNavigate('/executive?tab=financial')); await ready(page); await registerReady(page);
  const before = requests(control).length; pending = response(page); await page.getByRole('button', { name: /^Refresh (overview|financial)/i }).click(); await pending; await ready(page); assert.ok(requests(control).length > before, 'Outer Refresh reloads embedded data');
  record('Company sorting, pagination, company drilldowns, deep links and outer Refresh work together');

  await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.getByTestId('executive-outcomes').waitFor(); assert.equal(await finance(page).count(), 0);
  const overviewSnapshot = await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true })); assert.deepEqual(JSON.parse(overviewSnapshot.bytes.toString()), reportFixture());
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await ready(page); assert.match(await page.evaluate(() => window.executiveRoute), /tab=financial/); await page.reload(); await ready(page); await close(state);
  record('Tab keyboard navigation/reload retain Financial deep links; other tabs retain the original report export');

  for (const fixture of ['empty', 'partial', 'restricted', 'payables-restricted', 'workbook-restricted', 'workbook-unavailable', 'missing-company', 'error', 'forbidden', 'register-error']) {
    state = await open({ financeFixture: fixture }); ({ page, control } = state);
    if (fixture === 'empty') { assert.equal(await amount(page, 'unpaid'), 0); await workbookValues(page); }
    if (fixture === 'partial') { assert.equal(await amount(page, 'unpaid'), 380828); assert.match(await page.getByTestId('finance-kpi-unpaid').innerText(), /recorded|missing|partial/i); }
    if (fixture === 'restricted') { await workbookValues(page, false); assert.match(await finance(page).innerText(), /access|restricted/i); assert.doesNotMatch(await finance(page).innerText(), /Stripe Inc\./); assert.equal(await finance(page).locator('a[href^="/finance/outgoing-invoices"]').count(), 0); }
    if (fixture === 'payables-restricted') { assert.equal(await amount(page, 'unpaid'), 380828); assert.equal(await page.locator('.ar-ageing-panel .ar-chart-mark[aria-label*="Bills"],.ar-trend-panel .ar-chart-mark[aria-label*="Bills"]').count(), 0); }
    if (fixture === 'missing-company') { assert.match(await finance(page).innerText(), /Customer not recorded/); assert.doesNotMatch(await finance(page).innerText(), /LEGACY-ONLY-ACCOUNT/); }
    if (fixture === 'workbook-restricted' || fixture === 'workbook-unavailable') { await workbookValues(page, false); assert.equal(await amount(page, 'unpaid'), 380828); assert.match(await workbook(page).innerText(), /access|unavailable|restricted/i); }
    if (fixture === 'error' || fixture === 'forbidden') await workbookValues(page, false);
    if (fixture === 'error' || fixture === 'forbidden') { assert.equal(await finance(page).getByRole('button', { name: /^Export/ }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Export snapshot', exact: true }).isDisabled(), true); control.financeFixture = 'full'; pending = response(page); await finance(page).getByRole('button', { name: /try again|retry/i }).click(); await pending; await ready(page); assert.equal(await amount(page, 'unpaid'), 380828); }
    if (fixture === 'register-error') { await registerReady(page); assert.match(await register(page).innerText(), /unavailable|could not/i); assert.equal(await amount(page, 'unpaid'), 380828); const failedSnapshot = JSON.parse((await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true }))).bytes.toString()); assert.equal(failedSnapshot.customer_invoice_register, null); assert.match(failedSnapshot.customer_invoice_register_error, /unavailable|could not/i); control.financeFixture = 'full'; pending = response(page, 'customer-invoices'); await register(page).getByRole('button', { name: /try again|retry/i }).click(); await pending; await registerReady(page); }
    await capture(page, `financial-${fixture}`); await axe(page, `financial-${fixture}`); await close(state);
  }
  record('Zero/partial balances, company gaps, restricted AR/AP, endpoint errors and independent register retry remain truthful');

  state = await open({ financeFixture: 'formula' }); ({ page, control } = state); await registerReady(page);
  assert.equal(await amount(page, 'unpaid'), 9500); assert.equal(await amount(page, 'overdue'), 9500); assert.equal(await amount(page, 'over90'), 7500);
  assert.equal(await register(page).locator('thead th').count(), 15, 'Embedded Finance uses all fifteen source columns');
  assert.doesNotMatch(await finance(page).innerText(), /987,654|987654|Cancelled Example|Credit Note Example/);
  const formulaRows = register(page).locator('tbody tr');
  const formulaInvoice = id => formulaRows.filter({ has: page.locator(`[data-field="invoice_number"] a[href="/finance/outgoing-invoices/${id}"]`) });
  assert.equal(await formulaInvoice(901).locator('[data-field="amount"]').innerText(), '10,000'); assert.equal(await formulaInvoice(901).locator('[data-field="actual_payment_received"]').innerText(), '2,500');
  assert.equal(await formulaInvoice(902).locator('[data-field="actual_payment_received"]').innerText(), '—'); assert.equal(await formulaInvoice(903).locator('[data-field="amount"]').innerText(), '—');
  assert.match(await register(page).locator('tfoot').innerText(), /7,850/);
  const formulaSnapshot = JSON.parse((await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true }))).bytes.toString());
  assert.deepEqual(formulaSnapshot.receivables, receivablesFixture('formula').data); assert.deepEqual(formulaSnapshot.customer_invoice_register, customerInvoicesFixture('formula').data);
  await capture(page, 'financial-source-formula'); await axe(page, 'financial-source-formula'); await close(state);
  record('Executive KPIs, source table and snapshots share the exact L minus AA calculation and preserve raw blanks');

  state = await open({ financeLoading: true }); ({ page, control } = state); await finance(page).waitFor(); assert.equal(await finance(page).getAttribute('aria-busy'), 'true'); await workbookValues(page, false); assert.equal(await page.getByRole('button', { name: 'Export board report', exact: true }).isDisabled(), true); await control.releaseFinance(); await ready(page); await close(state);
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
