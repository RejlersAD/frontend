import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { receivablesFixture } from './check-receivables-dashboard-fixtures.mjs';

// Real Executive shell and financial board; the parent harness intercepts every request.
export async function runFinancialPerformanceChecks({ frontend, newPage, assertGeometry, reportFixture, verification }) {
  const artifacts = verification?.artifacts || path.resolve(frontend, '../artifacts/financial-performance');
  await mkdir(artifacts, { recursive: true });
  const checks = [], accessibility = [], geometries = [];
  const record = message => { checks.push(message); console.log(`PASS financial: ${message}`); };
  const board = page => page.getByTestId('financial-performance');
  const requests = (control, endpoint = '/dashboard/executive/receivables/') => control.requests.filter(row => row.endpoint === endpoint);
  const response = page => page.waitForResponse(row => new URL(row.url()).pathname === '/fixture-api/dashboard/executive/receivables/');
  const ready = async page => {
    await page.getByRole('heading', { name: 'Financial Performance', exact: true }).waitFor();
    await board(page).locator('.ef-kpis').waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="financial-performance"]')?.getAttribute('aria-busy') === 'false');
  };
  const open = async (options = {}) => {
    const state = await newPage({ ...options, route: '/executive?tab=financial' });
    if (!options.loading && !options.financeLoading && (!options.status || options.status === 200)) await ready(state.page);
    return state;
  };
  const close = state => state.page.context().close();
  const capture = async (page, name, print = false) => {
    await page.locator('main.main-content').evaluate(main => { for (const node of [main, ...main.querySelectorAll('*')]) { node.scrollTop = 0; node.scrollLeft = 0; } });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: print, animations: 'disabled' });
  };
  const axe = async (page, name) => {
    const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const violations = result.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
    accessibility.push({ name, violations });
    if (violations.length) console.log(`Accessibility findings in ${name}: ${JSON.stringify(violations)}`);
  };
  const download = async (page, button) => {
    const event = page.waitForEvent('download'); await button.click(); const file = await event;
    return { filename: file.suggestedFilename(), bytes: await readFile(await file.path()) };
  };
  const financialSnapshotButton = async page => {
    await page.getByLabel('More financial options', { exact: true }).click();
    return page.locator('.ef-header-menu').getByRole('button', { name: 'Export snapshot', exact: true });
  };
  const headings = ['Revenue and margin performance', 'FY forecast', 'Business unit performance', 'Cash & working capital', 'Project margin exposure', 'Management actions', 'Financial controls'];
  const outcomeValues = async (page, available = true) => {
    assert.equal(await board(page).locator('[data-testid^="financial-kpi-"]').count(), 5);
    assert.equal(await page.getByTestId('financial-kpi-revenue').locator('strong').innerText(), '\u2014', 'Unconnected recognised revenue remains unknown');
    const expected = { total_amount: '315.5M', amount_received: '285.8M', amount_pending: 'AED 6.4M', total_projects: '496' };
    for (const [id, value] of Object.entries(expected)) assert.equal(await page.getByTestId(`financial-kpi-${id}`).locator('strong').innerText(), available ? value : '\u2014');
    assert.equal(await board(page).locator('.ef-chart-mark').count(), 0, 'Unconnected revenue, budget, forecast and working-capital series have no sample marks');
    assert.doesNotMatch(await board(page).innerText(), /NaN|Infinity|undefined/);
    if (available) {
      assert.equal(await page.getByTestId('financial-kpi-total_amount').locator('strong').getAttribute('title'), '315,481,678.41');
      assert.equal(await page.getByTestId('financial-kpi-amount_received').locator('strong').getAttribute('title'), '285,759,742.00');
      assert.equal(await page.getByTestId('financial-kpi-amount_pending').locator('strong').getAttribute('title'), 'AED 6,401,792.89');
    }
  };
  const workbookValues = async (page, available = true) => {
    const workbook = page.locator('.ar-workbook-summary'), panel = page.locator('.ar-payment-status-content');
    assert.deepEqual(await workbook.locator('h3').allTextContents(), ['Total amount', 'Total amount in AED', 'Total amount received', 'Total projects']);
    const text = await workbook.innerText();
    if (!available) {
      assert.equal(await workbook.locator('.ar-workbook-currencies').count(), 0); assert.equal(await panel.count(), 0);
      assert.doesNotMatch(await page.getByRole('dialog').innerText(), /315,481,678|466,151,390|285,759,742|3,895|4,404/);
      for (const id of ['invoice_amount', 'invoice_amount_aed', 'actual_payment_received', 'project_count']) assert.equal(await page.getByTestId(`workbook-total-${id}`).locator('strong').innerText(), '\u2014');
      return;
    }
    const expected = receivablesFixture().data.workbook_summary;
    for (const [id, value] of Object.entries(expected.totals)) {
      const displayed = await page.getByTestId(`workbook-total-${id}`).locator('strong').innerText();
      assert.equal(Number(displayed.replace(/[^\d.-]/g, '')), Number(value));
      if (id === 'invoice_amount_aed') assert.match(displayed, /AED/); else assert.doesNotMatch(displayed, /AED|USD/);
    }
    assert.match(text, /full workbook/i); assert.match(text, /unaffected by dashboard filters/i); assert.doesNotMatch(text, /Mixed original currencies/);
    for (const field of ['invoice_amount', 'actual_payment_received']) {
      const card = page.getByTestId(`workbook-total-${field}`);
      assert.equal(await card.locator('.ar-workbook-currencies > div').count(), expected.currency_breakdown.length);
      for (const row of expected.currency_breakdown) {
        const entry = card.locator(`[data-currency="${row.currency || row.currency_status}"]`);
        assert.equal(await entry.locator('dt').innerText(), row.currency === 'EUR' ? 'EUR (Euro)' : row.currency || (row.currency_status === 'conflict' ? 'Currency needs review' : 'Currency not recorded'));
        assert.equal(await entry.locator('dd').innerText(), `[${Number(row[field]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}]`);
      }
    }
    for (const row of expected.payment_status) {
      const statusRow = panel.locator(`[data-status="${row.id}"]`), excluded = row.amount_coverage.blank_count + row.amount_coverage.text_count + row.amount_coverage.error_count;
      assert.equal(await statusRow.locator('th').innerText(), row.label);
      assert.equal(await statusRow.locator('[data-field="invoice_count"]').innerText(), row.count.toLocaleString('en-US'));
      assert.equal(await statusRow.locator('[data-field="amount_aed"]').innerText(), Number(row.amount_aed).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (excluded ? '*' : ''));
    }
    assert.deepEqual(await panel.locator('thead th').allTextContents(), ['Payment status', 'Amount (AED)', 'Invoice rows']);
    assert.equal(await panel.locator('tfoot [data-field="invoice_count"]').innerText(), '4,404');
    assert.equal(await panel.locator('tfoot [data-field="amount_aed"]').innerText(), '466,151,390.16*');
  };
  const openWorkbook = async (page, currencyDetails = false) => {
    const button = currencyDetails ? page.getByTestId('financial-kpi-total_amount').getByRole('button', { name: 'View currency breakdown', exact: true }) : page.getByRole('button', { name: 'How Total amount is calculated', exact: true });
    await button.click(); await page.getByRole('dialog', { name: 'Workbook totals and payment status', exact: true }).waitFor(); return button;
  };
  const dismissDialog = async page => { await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); };

  await verification?.assertProtected?.();
  let state = await open(); let { page, control } = state;
  await capture(page, 'financial-reference-1672');
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.getByRole('tab', { name: 'Financial performance', exact: true }).getAttribute('aria-selected'), 'true');
  for (const heading of headings) assert.equal(await board(page).getByRole('heading', { name: heading, exact: true }).count(), 1);
  await outcomeValues(page);
  assert.ok(requests(control).length, 'The board reads its authorized Executive receivables endpoint');
  assert.ok(!control.requests.some(row => row.endpoint.startsWith('/finance/dashboard/')), 'Executive reporting does not borrow Finance-only endpoint access');
  assert.equal(requests(control, '/dashboard/executive/customer-invoices/').length, 0, 'The executive board does not load the full invoice register');
  assert.match(await board(page).locator('.ef-action-banner').innerText(), /AED 313,499/);
  assert.match(await board(page).locator('.ef-cash-stats').innerText(), /AED 380,828/);
  await page.getByRole('button', { name: 'Review financial actions', exact: true }).click();
  assert.equal(await page.locator('#ef-management-actions').evaluate(node => document.activeElement === node), true, 'Review action moves keyboard focus to the management panel');
  await page.locator('#ef-management-actions').evaluate(node => node.blur());
  record('Five source-backed KPIs and all seven reference panels render without invented accounting series');

  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width); await outcomeValues(page);
    const geometry = await board(page).evaluate(node => {
      const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; };
      const bounds = box(node);
      const styles = selector => [...node.querySelectorAll(selector)].map(element => { const style = getComputedStyle(element); return { text: element.textContent, font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, color: style.color }; });
      return { viewport: innerWidth, bounds, cards: [...node.querySelectorAll('[data-testid^="financial-kpi-"]')].map(box), pairs: [...node.querySelectorAll('.ef-panel-row')].map(row => [...row.children].map(box)), typography: { cards: styles('.ef-kpi-heading h2'), values: styles('.ef-kpi-value'), panels: styles('.ef-panel-heading h2') }, overflowing: [...node.querySelectorAll('section, article, .ef-chart')].filter(element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && (rect.left < bounds.x - 1 || rect.right > bounds.right + 1); }).map(element => element.className) };
    });
    assert.deepEqual(geometry.overflowing, [], `${width}: board panels remain inside the content area`);
    if (width >= 1440) {
      assert.ok(geometry.cards.every(card => Math.abs(card.y - geometry.cards[0].y) < 1), 'Five KPI cards share the desktop row');
      assert.ok(geometry.pairs.every(([left, right]) => Math.abs(left.y - right.y) < 1 && right.x >= left.right - 1), 'Reference panels share paired desktop rows');
    }
    if (width === 390) assert.ok(geometry.pairs.every(([left, right]) => right.y >= left.bottom - 1), 'Mobile panels stack in source order');
    assert.ok(geometry.cards.every(card => card.width > 100), 'KPI labels remain readable');
    geometries.push(geometry); await capture(page, `financial-reference-${width}`);
    if (width === 1672 || width === 390) await axe(page, `financial-reference-${width}`);
  }
  await assertGeometry(page, 1672); await page.evaluate(() => document.documentElement.classList.add('dark'));
  await capture(page, 'financial-reference-dark'); await axe(page, 'financial-reference-dark');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  record('Desktop, tablet, mobile and dark layouts preserve the sidebar and contain every panel');

  const calculationButton = await openWorkbook(page); await workbookValues(page); await axe(page, 'financial-workbook-dialog');
  await page.getByText('Workbook source', { exact: true }).click();
  assert.match(await page.getByRole('dialog').innerText(), /Conflicting labels|currency needs review/i);
  await page.getByRole('dialog').screenshot({ path: path.join(artifacts, 'financial-workbook-dialog.png'), animations: 'disabled' });
  await dismissDialog(page); assert.equal(await calculationButton.evaluate(node => document.activeElement === node), true, 'Escape restores focus to the invoking control');
  await page.setViewportSize({ width: 390, height: 844 }); await openWorkbook(page, true); await workbookValues(page);
  const dialogGeometry = await page.getByRole('dialog').evaluate(node => ({ width: node.getBoundingClientRect().width, fits: node.scrollWidth <= node.clientWidth + 1, documentFits: document.documentElement.scrollWidth <= innerWidth }));
  assert.ok(dialogGeometry.width <= 390 && dialogGeometry.fits && dialogGeometry.documentFits, 'Currency/status source dialog fits mobile');
  await page.getByRole('dialog').screenshot({ path: path.join(artifacts, 'financial-workbook-dialog-mobile.png'), animations: 'disabled' });
  await page.locator('.ar-payment-status-content').screenshot({ path: path.join(artifacts, 'financial-payment-status-mobile.png'), animations: 'disabled' });
  await axe(page, 'financial-workbook-dialog-mobile'); await dismissDialog(page); await assertGeometry(page, 1672);
  record('Keyboard-operable source dialogs retain exact workbook totals, independent currencies and AED payment-status amounts');

  await page.getByRole('button', { name: 'YTD', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'YTD', exact: true }).getAttribute('aria-pressed'), 'true'); await outcomeValues(page);
  await page.getByRole('button', { name: 'Monthly', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Monthly', exact: true }).getAttribute('aria-pressed'), 'true');
  let pending = response(page); await page.getByLabel('Financial reporting currency', { exact: true }).selectOption('USD'); await pending; await ready(page);
  assert.equal(new URLSearchParams(requests(control).at(-1).query).get('currency'), 'USD');
  await outcomeValues(page); assert.match(await board(page).locator('.ef-cash-stats').innerText(), /USD 5,000/);
  await openWorkbook(page); await workbookValues(page); await dismissDialog(page);
  const snapshot = await download(page, await financialSnapshotButton(page)), snapshotData = JSON.parse(snapshot.bytes.toString());
  assert.equal(snapshotData.report_type, 'executive_financial_performance'); assert.equal(snapshotData.receivables.currency, 'USD');
  assert.deepEqual(snapshotData.receivables.workbook_summary, receivablesFixture().data.workbook_summary);
  assert.equal(snapshotData.revenue.id, 'revenue_ytd'); assert.equal(snapshotData.revenue.value, null); assert.ok(snapshotData.project_register.projects.length > 0);
  assert.equal(Object.hasOwn(snapshotData, 'financial_performance'), false, 'The snapshot does not reintroduce legacy stored-balance aging');
  await writeFile(path.join(artifacts, snapshot.filename), snapshot.bytes);
  record('Monthly/YTD and current-AR currency controls preserve workbook scope and exported source data');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const printed = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printed.title, 'Financial Performance'); assert.equal(printed.financialCurrency, 'USD'); assert.equal(printed.financialKpis.length, 5); assert.equal(printed.financialProjects.length, snapshotData.project_register.projects.length, 'Printing exposes every project returned by the source');
  await page.setViewportSize({ width: 1123, height: 794 }); await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('#application-sidebar').isVisible(), false); assert.equal(await board(page).locator('[data-testid^="financial-kpi-"]').count(), 5);
  const printGeometry = await board(page).evaluate(node => ({ width: node.getBoundingClientRect().width, fits: node.scrollWidth <= node.clientWidth + 1, clipped: [...node.querySelectorAll('*')].filter(element => { const style = getComputedStyle(element); return element.getBoundingClientRect().height > 0 && /auto|scroll|hidden/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2; }).map(element => element.className) }));
  assert.equal(printGeometry.fits, true); assert.deepEqual(printGeometry.clipped, []);
  await capture(page, 'financial-reference-print', true); await page.pdf({ path: path.join(artifacts, 'financial-reference-board.pdf'), preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await page.setViewportSize({ width: 1672, height: 941 });
  assert.equal(await page.locator('#application-sidebar').isVisible(), true);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click(); await page.getByTestId('executive-outcomes').waitFor();
  const overviewSnapshot = JSON.parse((await download(page, page.getByRole('button', { name: 'Export snapshot', exact: true }))).bytes.toString()); assert.deepEqual(overviewSnapshot, reportFixture());
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await ready(page);
  assert.match(await page.evaluate(() => window.executiveRoute), /tab=financial/); await page.reload(); await ready(page); await close(state);
  record('Board print exposes the reference panels; keyboard/deep-link navigation and nonfinancial exports remain intact');

  for (const fixture of ['empty', 'partial', 'restricted', 'workbook-restricted', 'workbook-unavailable', 'error', 'forbidden']) {
    state = await open({ financeFixture: fixture }); ({ page, control } = state);
    const unavailable = ['restricted', 'workbook-restricted', 'workbook-unavailable', 'error', 'forbidden'].includes(fixture); await outcomeValues(page, !unavailable);
    if (fixture === 'empty' || fixture === 'partial') { await openWorkbook(page); await workbookValues(page); await dismissDialog(page); }
    if (fixture === 'restricted' || fixture === 'workbook-restricted' || fixture === 'workbook-unavailable') { await openWorkbook(page); await workbookValues(page, false); await dismissDialog(page); }
    if (fixture === 'restricted') assert.doesNotMatch(await board(page).innerText(), /Stripe Inc\.|313,499|380,828/);
    if (fixture === 'error' || fixture === 'forbidden') {
      assert.doesNotMatch(await board(page).innerText(), /315,481,678|313,499|380,828/);
      control.financeFixture = 'full'; pending = response(page); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await pending; await ready(page);
      await openWorkbook(page); await workbookValues(page); await dismissDialog(page);
    }
    await capture(page, `financial-reference-${fixture}`); await close(state);
  }
  state = await open({ financeFixture: 'formula' }); ({ page } = state);
  assert.match(await board(page).locator('.ef-action-banner').innerText(), /AED 9,500\*/);
  assert.match(await board(page).locator('.ef-cash-stats').innerText(), /AED 9,500\*/);
  assert.match(await board(page).locator('.ef-cash-stats').innerText(), /AED 7,500/);
  assert.doesNotMatch(await board(page).innerText(), /987,654|Cancelled Example|Credit Note Example/); await close(state);
  state = await open(); ({ page, control } = state); control.financeStatus = 503;
  await page.getByLabel('More financial options', { exact: true }).click(); pending = response(page);
  await page.locator('.ef-header-menu').getByRole('button', { name: 'Refresh financial performance', exact: true }).click(); await pending; await ready(page);
  await outcomeValues(page, false); assert.doesNotMatch(await board(page).locator('.ef-action-banner,.ef-cash-stats').allTextContents().then(values => values.join(' ')), /313,499|380,828/);
  control.financeStatus = null; pending = response(page); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await pending; await ready(page); await outcomeValues(page); await close(state);
  state = await open({ financeLoading: true }); ({ page, control } = state); await board(page).waitFor(); await outcomeValues(page, false);
  assert.equal(await (await financialSnapshotButton(page)).isDisabled(), true); await control.releaseFinance(); await ready(page); await close(state);
  record('Empty/partial balances, restricted workbook/AR, endpoint failure recovery and loading never leak stale values');

  await verification?.assertProtected?.();
  const accessibilityFailures = accessibility.filter(result => result.violations.length);
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: accessibilityFailures.length === 0, checks, accessibility, geometries, printGeometry, protectedHashesUnchanged: true }, null, 2));
  assert.deepEqual(accessibilityFailures, [], 'All financial board and source-dialog accessibility checks pass');
  console.log(`PASS: ${checks.length} Executive financial reference groups; ${accessibility.length} accessibility checks.`);
}
