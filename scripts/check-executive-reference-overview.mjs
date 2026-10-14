import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import AxeBuilder from '@axe-core/playwright';
import { receivablesFixture } from './check-receivables-dashboard-fixtures.mjs';
import { overviewMoney, overviewModel } from '../src/pages/Executive/overviewPresentation.js';
import { invoicePerformanceModel } from '../src/pages/Executive/invoicePerformancePresentation.js';

// Run through check-executive-ui.mjs --reference-overview. Its isolated real-shell
// harness serves only synthetic GET responses; this suite never contacts live APIs.
const requiredSections = ['.eov-kpis', '.eov-floating-decisions', '.eov-alert', '.eov-primary-row', '.eov-secondary-row', '.eov-tables-row', '.eov-controls'];
const tabNames = ['Overview', 'Financial performance', 'Project portfolio', 'Commercial pipeline', 'Workforce', 'Risk & compliance'];

export async function assertInvoiceKpiGraphics(page, { prefix, currency = 'AED', mode = 'monthly', month = '', fixture = 'full' }) {
  const values = invoicePerformanceModel(receivablesFixture(fixture, { currency }).data.invoice_performance, currency, mode, month).performance.rows.map(row => row.invoiced);
  const ids = ['revenue', 'total_amount', 'amount_received', 'amount_pending', 'total_projects'];
  for (const id of ids) {
    const card = page.getByTestId(`${prefix}-kpi-${id}`), graphic = card.locator('.pp-kpi-graphic'), svg = graphic.locator('svg');
    assert.equal(await graphic.count(), 1, `${prefix}/${id}: one mini chart per card`);
    assert.equal(await graphic.isVisible(), true);
    const box = await svg.boundingBox(), cardBox = await card.boundingBox();
    assert.ok(box.width > 30 && box.height > 20, `${prefix}/${id}: mini chart retains visible dimensions`);
    assert.ok(box.x + box.width / 2 > cardBox.x + cardBox.width / 2, `${prefix}/${id}: mini chart sits on the right`);
    const valueBox = await card.locator(prefix === 'financial' ? '.ef-kpi-value' : '.eov-kpi-value').boundingBox();
    const overlap = Math.min(box.x + box.width, valueBox.x + valueBox.width) - Math.max(box.x, valueBox.x) > 1
      && Math.min(box.y + box.height, valueBox.y + valueBox.height) - Math.max(box.y, valueBox.y) > 1;
    assert.equal(overlap, false, `${prefix}/${id}: source value and mini chart do not overlap`);
    const illustrative = id !== 'revenue' || !values.some(value => value !== null);
    const title = await svg.locator('title').textContent();
    assert.equal(await graphic.locator('.pp-kpi-graphic-caption').count(), illustrative ? 1 : 0);
    if (illustrative) {
      assert.equal(await graphic.locator('.pp-kpi-graphic-caption').innerText(), 'Illustrative');
      assert.equal(await graphic.locator('.pp-kpi-graphic-caption').isVisible(), true);
      assert.match(title, /illustrative reference graphic, not historical data/i);
    } else {
      const expected = values.map(value => value === null ? 'not recorded' : value.toLocaleString('en-GB', { maximumFractionDigits: 10 })).join(', ');
      assert.ok(title.includes(`recorded history, ${expected}.`), `${prefix}: revenue mini chart follows the same period, month and currency cohorts as the main chart`);
    }
    if (id === 'total_projects') assert.ok(await svg.locator('rect').count() > 1, 'Total projects uses the reference bar graphic');
    else {
      assert.ok(await svg.locator('path[stroke]').count() > 0, `${id}: line graphic is present`);
      assert.ok(await svg.locator('path[fill^="url"]').count() > 0, `${id}: reference area fill is present`);
    }
  }
}

async function runOverviewKpiChecks({ newPage, assertGeometry, assertSidebarUnchanged, artifacts, errors, unexpectedRequests }) {
  const cases = [];
  for (const options of [{ width: 1672 }, { width: 1440 }, { width: 1280 }, { width: 1024 }, { width: 390 }, { width: 1672, dark: true }]) {
    const { page } = await newPage(options);
    await ready(page);
    const geometry = await inspectLayout(page, options.width, assertGeometry);
    await assertInvoiceKpiGraphics(page, { prefix: 'executive' });
    const name = `overview-kpi-${options.width}${options.dark ? '-dark' : ''}`;
    await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
    await page.locator('.eov-kpis').screenshot({ path: path.join(artifacts, `${name}-row.png`) });
    const scan = [1672, 390].includes(options.width) ? await new AxeBuilder({ page }).include('.cc-command-center').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze() : { violations: [] };
    cases.push({ name, geometry, violations: scan.violations });
    assert.deepEqual(scan.violations, [], `${name}: no accessibility violations`);
    if (options.width === 1672 && !options.dark) {
      const before = await sidebarAppearance(page);
      await page.evaluate(() => window.executiveNavigate('/executive?tab=portfolio'));
      await page.getByTestId('portfolio-outcomes').waitFor();
      assert.deepEqual(await sidebarAppearance(page), before, 'Overview KPI graphics preserve actual sidebar appearance');
    }
    await page.context().close();
  }
  const { page } = await newPage();
  await ready(page);
  const card = page.getByTestId('executive-kpi-revenue');
  assert.match(await card.locator('.eov-kpi-value').innerText(), /AED 120\.3K/);
  const period = page.getByRole('group', { name: 'Invoiced revenue period', exact: true });
  const chartPeriod = page.getByRole('group', { name: 'Revenue reporting period', exact: true });
  await period.getByRole('button', { name: 'YTD', exact: true }).click();
  assert.match(await card.locator('.eov-kpi-value').innerText(), /AED 684\.8K/);
  assert.equal(await chartPeriod.getByRole('button', { name: 'YTD', exact: true }).getAttribute('aria-pressed'), 'true');
  await assertInvoiceKpiGraphics(page, { prefix: 'executive', mode: 'ytd' });
  await page.getByLabel('Invoicing month', { exact: true }).selectOption('2026-08');
  await assertInvoiceKpiGraphics(page, { prefix: 'executive', mode: 'ytd', month: '2026-08' });
  await chartPeriod.getByRole('button', { name: 'Monthly', exact: true }).click();
  assert.match(await card.locator('.eov-kpi-value').innerText(), /AED 75\.9K/);
  await assertInvoiceKpiGraphics(page, { prefix: 'executive', month: '2026-08' });
  await page.getByLabel('Invoicing month', { exact: true }).selectOption('2026-09');
  const response = page.waitForResponse(response => response.url().includes('/dashboard/executive/receivables/') && response.status() === 200);
  await page.getByLabel('Overview reporting currency', { exact: true }).selectOption('USD');
  await response;
  await ready(page);
  await assertInvoiceKpiGraphics(page, { prefix: 'executive', currency: 'USD' });
  assert.equal(await card.locator('.eov-kpi-value').innerText(), overviewModel(null, 'USD', receivablesFixture('full', { currency: 'USD' }).data).cards.find(card => card.id === 'revenue').value);
  await page.getByRole('button', { name: /^How Invoiced revenue is calculated$/i }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await page.context().close();
  const unavailable = await newPage({ financeFixture: 'restricted' });
  await ready(unavailable.page);
  await assertInvoiceKpiGraphics(unavailable.page, { prefix: 'executive', fixture: 'restricted' });
  await unavailable.page.context().close();
  await assertSidebarUnchanged();
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedRequests, []);
  await writeFile(path.join(artifacts, 'overview-kpi-checks.json'), JSON.stringify({ cases, protectedSourcesUnchanged: true, monthlyYtdMonthCurrencyAndDefinitionsPassed: true, unavailableHistoryLabelledIllustrative: true }, null, 2));
  console.log('PASS: Overview five mini charts, responsive/dark accessibility, period/month/currency synchronisation, definitions and protected sources');
}

async function ready(page) {
  await page.locator('.eov-board').waitFor();
  await page.waitForFunction(() => document.querySelector('.eov-board')?.getAttribute('aria-busy') !== 'true');
  await page.evaluate(() => document.fonts.ready);
}

async function sidebarAppearance(page) {
  return page.locator('#application-sidebar').evaluate(sidebar => [sidebar, ...sidebar.querySelectorAll('*')].map(node => {
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    return {
      tag: node.tagName, text: node.childElementCount ? '' : node.textContent,
      x: Math.round(rect.x * 100) / 100, y: Math.round(rect.y * 100) / 100,
      width: Math.round(rect.width * 100) / 100, height: Math.round(rect.height * 100) / 100,
      colour: style.color, background: style.backgroundColor, font: style.fontFamily,
      size: style.fontSize, weight: style.fontWeight, padding: style.padding,
      border: style.border, radius: style.borderRadius,
    };
  }));
}

async function inspectLayout(page, width, assertGeometry) {
  await assertGeometry(page, width);
  assert.equal(await page.locator('.eov-kpis .eov-kpi').count(), 5, 'Overview renders all five reference KPI cards');
  for (const selector of requiredSections) assert.equal(await page.locator(selector).count(), 1, `${selector} renders once`);
  const geometry = await page.locator('.eov-board').evaluate(board => {
    const rect = board.getBoundingClientRect();
    const sections = [...board.querySelectorAll(':scope > *')].filter(node => node.getBoundingClientRect().width > 0);
    const overlaps = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const toolbarControls = [...document.querySelectorAll('.cc-toolbar button, .cc-toolbar select')].map(node => node.getBoundingClientRect());
    const headerOverlaps = [...document.querySelectorAll('.cc-title-block h1, .cc-title-block > p')].filter(node => toolbarControls.some(control => overlaps(node.getBoundingClientRect(), control))).map(node => node.tagName);
    const revenueCard = document.querySelector('[data-testid="executive-kpi-revenue"]');
    const revenueControlsOverlap = overlaps(revenueCard?.querySelector('.eov-calculation')?.getBoundingClientRect(), revenueCard?.querySelector('.eov-period')?.getBoundingClientRect());
    const banner = document.querySelector('.eov-floating-decisions');
    const bannerBox = banner.getBoundingClientRect();
    const kpis = document.querySelector('.eov-kpis').getBoundingClientRect();
    const primary = document.querySelector('.eov-primary-row').getBoundingClientRect();
    const sidebar = document.querySelector('#application-sidebar')?.getBoundingClientRect();
    return {
      boardFits: board.scrollWidth <= board.clientWidth + 1,
      pageFits: document.querySelector('.cc-command-center').scrollWidth <= document.querySelector('.cc-command-center').clientWidth + 1,
      sectionsFit: sections.every(node => { const box = node.getBoundingClientRect(); return box.left >= rect.left - 1 && box.right <= rect.right + 1; }),
      headerOverlaps, revenueControlsOverlap: !!revenueControlsOverlap,
      invoiceChartGap: primary.top - kpis.bottom,
      banner: { position: getComputedStyle(banner).position, viewportFits: bannerBox.left >= 0 && bannerBox.right <= innerWidth + 1 && bannerBox.top >= 0 && bannerBox.bottom <= innerHeight + 1,
        rightOffset: innerWidth - bannerBox.right, bottomOffset: innerHeight - bannerBox.bottom, height: bannerBox.height,
        sidebarOverlaps: !!overlaps(bannerBox, sidebar) },
      boxes: Object.fromEntries(['.eov-board', '.eov-kpi', '.eov-alert', '.eov-primary-row', '.eov-performance', '.eov-performance .eov-panel-heading', '.eov-performance .eov-chart', '.eov-health', '.eov-health-body', '.eov-health-notice', '.eov-secondary-row', '.eov-tables-row', '.eov-project-table', '.eov-project-table thead tr', '.eov-project-table tbody tr', '.eov-decision-table', '.eov-decision-table thead tr', '.eov-decision-table tbody tr', '.eov-controls', '.eov-footer'].map(selector => {
        const node = document.querySelector(selector), box = node?.getBoundingClientRect();
        return [selector, box ? { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom } : null];
      })),
    };
  });
  assert.deepEqual({ boardFits: geometry.boardFits, pageFits: geometry.pageFits, sectionsFit: geometry.sectionsFit }, { boardFits: true, pageFits: true, sectionsFit: true }, `All overview panels fit at ${width}px`);
  assert.deepEqual(geometry.headerOverlaps, [], `Header toolbar does not overlap the title or subtitle at ${width}px`);
  assert.equal(geometry.revenueControlsOverlap, false, `Revenue calculation and period controls do not overlap at ${width}px`);
  assert.ok(geometry.invoiceChartGap >= 0 && geometry.invoiceChartGap <= 20, `Charts follow KPI cards without an inline decision-panel gap at ${width}px`);
  assert.equal(geometry.banner.position, 'fixed', 'Decision banner floats independently of the dashboard grid');
  assert.equal(geometry.banner.viewportFits, true, `Floating decisions fit the ${width}px viewport`);
  assert.equal(geometry.banner.sidebarOverlaps, false, 'Floating decisions do not cover the existing sidebar');
  assert.ok(geometry.banner.rightOffset >= 0 && geometry.banner.rightOffset <= 32 && geometry.banner.bottomOffset >= 0 && geometry.banner.bottomOffset <= 48, 'Decision banner sits in the bottom-right viewport corner');
  assert.ok(geometry.banner.height <= 220, 'Default floating decision banner remains compact');
  return geometry;
}

async function openMenu(page) {
  const menu = page.getByLabel('More overview options', { exact: true });
  await menu.click();
}

async function captureLocalInvoiceSource({ newPage, artifacts }) {
  if (!process.env.EXECUTIVE_INVOICE_PERFORMANCE_DTO) return;
  const exported = JSON.parse(await readFile(path.resolve(process.env.EXECUTIVE_INVOICE_PERFORMANCE_DTO), 'utf8'));
  const response = exported.data || exported;
  const source = response.invoice_performance || response;
  assert.equal(source.schema_version, '1.0', 'Local invoice export uses the supported DTO schema');
  assert.ok(source.currency && source.monthly?.length, 'Local invoice export has scoped invoice cohorts');
  const { page } = await newPage();
  await ready(page);
  const invoiceResponse = response.invoice_performance ? response : { ...receivablesFixture('full', { currency: source.currency }).data, invoice_performance: source };
  await page.route('**/fixture-api/dashboard/executive/receivables/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(invoiceResponse),
  }));
  const completed = page.waitForResponse(response => response.url().includes('/dashboard/executive/receivables/') && response.status() === 200);
  if (source.currency !== 'AED') await page.getByLabel('Overview reporting currency', { exact: true }).selectOption(source.currency);
  else {
    await openMenu(page);
    await page.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  }
  await completed;
  await ready(page);
  const latest = [...source.monthly].sort((a, b) => a.month.localeCompare(b.month)).at(-1);
  const amount = latest.invoiced.amount ?? latest.invoiced.known_amount;
  const expected = `${overviewMoney(amount, source.currency)}${latest.invoiced.partial && amount !== null ? '*' : ''}`;
  await page.waitForFunction(value => document.querySelector('[data-testid="executive-kpi-revenue"] .eov-kpi-value')?.textContent === value, expected);
  assert.equal(await page.getByLabel('Invoicing month', { exact: true }).inputValue(), latest.month, 'Real workbook defaults to its latest available invoice period');
  assert.ok(latest.month <= source.as_of_date.slice(0, 7), 'Real workbook source does not render future invoice cohorts');
  if (latest.invoiced.partial && amount !== null) assert.match(await page.getByTestId('executive-kpi-revenue').innerText(), /known subtotal/i);
  for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'invoice-workbook-overview-1672.png') });
  await page.getByRole('group', { name: 'Invoiced revenue period', exact: true }).getByRole('button', { name: 'YTD', exact: true }).click();
  const expectedYtd = overviewModel(null, source.currency, invoiceResponse, 'ytd').cards.find(card => card.id === 'revenue').value;
  assert.equal(await page.getByTestId('executive-kpi-revenue').locator('.eov-kpi-value').innerText(), expectedYtd, 'Real workbook YTD uses its complete dated calendar-year cohorts');
  await page.screenshot({ path: path.join(artifacts, 'invoice-workbook-overview-ytd-1672.png') });
  await writeFile(path.join(artifacts, 'invoice-workbook-overview-source.json'), JSON.stringify({
    invoicePerformanceSource: 'Local backend export', currency: source.currency, asOf: source.as_of_date,
    otherSources: response.invoice_performance ? 'Exported receivables plus synthetic executive report' : 'Synthetic executive and receivables fixture data',
    latestMonth: latest.month, displayedMonthlyInvoiceValue: expected, displayedYtdInvoiceValue: expectedYtd,
    sourceStatus: source.status, latestMonthPartial: latest.invoiced.partial, coverage: source.coverage,
  }, null, 2));
  await page.context().close();
  console.log('PASS: Local workbook invoice cohorts rendered; non-invoice fixture sources are disclosed in the screenshot metadata.');
}

export async function runReferenceOverviewChecks({ newPage, assertGeometry, assertSidebarUnchanged, artifacts, errors, unexpectedRequests }) {
  if (process.argv.includes('--kpi-graphics-only')) return runOverviewKpiChecks({ newPage, assertGeometry, assertSidebarUnchanged, artifacts, errors, unexpectedRequests });
  const cases = [];
  for (const options of [{ width: 1672 }, { width: 1440 }, { width: 1024 }, { width: 390 }, { width: 1672, dark: true }]) {
    const { page } = await newPage(options);
    await ready(page);
    const geometry = await inspectLayout(page, options.width, assertGeometry);
    const sidebarBefore = await sidebarAppearance(page);
    await page.evaluate(() => window.executiveNavigate('/executive?tab=portfolio'));
    await page.getByTestId('portfolio-outcomes').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.deepEqual(await sidebarAppearance(page), sidebarBefore, 'Overview preserves existing sidebar geometry, typography, colours and icons');
    await page.evaluate(() => window.executiveNavigate('/executive'));
    await ready(page);
    for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo(0, 0));
    const name = `reference-overview-${options.width}${options.dark ? '-dark' : ''}`;
    await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
    const scan = await new AxeBuilder({ page }).include('.cc-command-center').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const violations = scan.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target), details: nodes.map(node => node.failureSummary) }));
    cases.push({ name, geometry, sidebarUnchanged: true, violations });
    await page.getByRole('button', { name: 'Minimize decision banner', exact: true }).click();
    const expand = page.getByRole('button', { name: 'Expand decision banner', exact: true });
    await expand.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Minimize decision banner', exact: true }).count(), 0, 'Minimized banner removes its expanded controls');
    await page.screenshot({ path: path.join(artifacts, `${name}-banner-minimized.png`) });
    await expand.press('Enter');
    await page.getByRole('button', { name: 'Minimize decision banner', exact: true }).waitFor();
    const floatingBeforeScroll = await page.locator('.eov-floating-decisions').boundingBox();
    for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo({ top: node.scrollHeight, behavior: 'instant' }));
    assert.deepEqual(await page.locator('.eov-floating-decisions').boundingBox(), floatingBeforeScroll, 'Decision banner stays anchored while the dashboard scrolls');
    await writeFile(path.join(artifacts, 'reference-overview-visuals.json'), JSON.stringify(cases, null, 2));
    console.log(`${violations.length ? 'FAIL' : 'PASS'}: ${name}, unchanged sidebar and ${violations.length ? `${violations.length} accessibility issue(s)` : 'accessible responsive panels'}`);
    await page.context().close();
  }

  const { page, control } = await newPage();
  await ready(page);
  const revenueCard = page.locator('.eov-kpi').filter({ has: page.getByRole('heading', { name: 'Invoiced revenue', exact: true }) });
  assert.match(await revenueCard.innerText(), /AED 120\.3K/, 'Current monthly invoiced revenue includes paid and unpaid invoice-date cohorts');
  assert.doesNotMatch(await revenueCard.innerText(), /48\.6M|7\.2%/, 'Reference image metrics are not used as live financial values');
  assert.equal(await page.locator('.eov-chart-company rect').count(), 36, 'Twelve invoice months render three recorded money series');
  assert.match(await page.locator('.eov-chart-company').innerText(), /Collected against invoices/);
  assert.match(await page.locator('.eov-chart-company').innerText(), /Collection rate \(%\)/);
  assert.doesNotMatch(await page.locator('.eov-chart-company .eov-chart-legend').innerText(), /Approved budget|Operating margin/, 'Unapproved financial overlays are not implied');
  assert.match(await page.locator('.eov-chart-forecast').innerText(), /Estimated invoicing/);
  assert.equal(await page.locator('.eov-chart-forecast path[stroke-dasharray="5 3"]').count(), 1, 'Estimated invoicing is visibly dashed');
  assert.match(await page.getByTestId('executive-kpi-total_amount').innerText(), /AED 256\.7M/i, 'Invoice totals use only the verified AED workbook rows');
  assert.match(await page.getByTestId('executive-kpi-amount_received').innerText(), /AED 236\.9M/i, 'Received amount uses the verified AED receipt rows');
  assert.match(await page.getByTestId('executive-kpi-amount_pending').innerText(), /AED 380\.8K/i, 'Pending amount uses current invoice balances');
  assert.doesNotMatch(await page.locator('.eov-tables-row').innerText(), /11\.2%|15\.8%/, 'Unconnected project margins are not invented');
  const projectMargins = await page.locator('.eov-project-table tbody tr td:nth-child(5)').allTextContents();
  assert.ok(projectMargins.length, 'Authorised project exceptions remain visible');
  assert.ok(projectMargins.every(value => value.trim() === '—'), 'Every unconnected project margin remains unavailable');
  assert.match(await page.locator('.eov-secondary-row').innerText(), /127/, 'Current employee count comes from authorised report data');

  const cardPeriod = page.getByRole('group', { name: 'Invoiced revenue period', exact: true });
  const chartPeriod = page.getByRole('group', { name: 'Revenue reporting period', exact: true });
  await cardPeriod.getByRole('button', { name: 'YTD', exact: true }).click();
  assert.match(await revenueCard.innerText(), /AED 684\.8K/, 'Revenue card supports year-to-date invoice value');
  assert.equal(await chartPeriod.getByRole('button', { name: 'YTD', exact: true }).getAttribute('aria-pressed'), 'true', 'Card period synchronises company chart');
  assert.match(await page.locator('.eov-chart-company').textContent(), /Sep 2026 · Invoiced: AED 684,845/, 'YTD chart receives cumulative values exactly once');
  assert.match(await page.locator('.eov-chart-company').textContent(), /Sep 2026 · Collection rate: 48\.6%/, 'YTD collection rate uses period receipts divided by period invoicing');
  await chartPeriod.getByRole('button', { name: 'Monthly', exact: true }).click();
  assert.equal(await cardPeriod.getByRole('button', { name: 'Monthly', exact: true }).getAttribute('aria-pressed'), 'true', 'Chart period synchronises revenue card');
  const invoicingMonth = page.getByLabel('Invoicing month', { exact: true });
  await invoicingMonth.selectOption('2026-08');
  assert.match(await revenueCard.innerText(), /AED 75\.9K/, 'Earlier invoice month changes the revenue card');
  assert.doesNotMatch(await page.locator('.eov-chart-company').textContent(), /Sep 2026 · Invoiced:/, 'Chart follows the selected invoice-month cutoff');
  await invoicingMonth.selectOption('2026-09');
  await page.getByRole('button', { name: /^How Invoiced revenue is calculated$/i }).click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /Definition|Source/);
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  const floatingDecisions = page.locator('.eov-floating-decisions');
  assert.match(await floatingDecisions.innerText(), /7 executive decisions require attention/, 'Floating banner preserves the authorised decision count');
  await floatingDecisions.getByRole('button', { name: 'Review 7 decisions', exact: true }).click();
  await page.getByRole('button', { name: 'Expand decision banner', exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'eov-decisions');
  assert.equal(await page.getByRole('button', { name: 'Minimize decision banner', exact: true }).count(), 0, 'Reviewing decisions minimizes the floating banner');
  await page.getByRole('button', { name: 'Expand decision banner', exact: true }).click();
  await page.getByRole('button', { name: 'Minimize decision banner', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review decisions', exact: true }).click();
  assert.equal(await page.locator('#eov-decisions').evaluate(node => node === document.activeElement), true, 'Review decisions moves keyboard focus to the decisions table');

  const currency = page.getByLabel('Overview reporting currency', { exact: true });
  await currency.selectOption('USD');
  await page.waitForFunction(() => document.querySelector('select[aria-label="Overview reporting currency"]')?.value === 'USD');
  await ready(page);
  assert.ok(control.requests.some(request => request.endpoint === '/dashboard/executive/receivables/' && request.query.includes('currency=USD')), 'Currency selection requests scoped invoice values');
  assert.match(await page.getByTestId('executive-kpi-total_amount').innerText(), /USD 41\.7M/i, 'Currency selection changes the invoice amount, not just the currency label');
  assert.match(await page.getByTestId('executive-kpi-amount_received').innerText(), /USD 36\.2M/i, 'Currency selection changes received amounts');
  assert.match(await revenueCard.innerText(), /USD 5K/i, 'Invoice-date revenue uses the selected original currency without relabeling AED');
  assert.match(await page.locator('.eov-chart-forecast').innerText(), /unavailable/i, 'Insufficient USD invoice history does not invent an estimate');
  await currency.selectOption('AED');
  await ready(page);

  const reportsBefore = control.requests.filter(row => row.endpoint === '/dashboard/executive/').length;
  await openMenu(page);
  await page.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.cc-content')?.getAttribute('aria-busy') === 'false');
  await ready(page);
  assert.ok(control.requests.filter(row => row.endpoint === '/dashboard/executive/').length > reportsBefore, 'Refresh reloads the current executive report');

  await openMenu(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export snapshot', exact: true }).first().click();
  assert.match((await download).suggestedFilename(), /^radai-executive-.*\.json$/);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  assert.equal(await page.evaluate(() => window.executivePrintCalls), 1, 'Export opens the printable board');

  for (const name of tabNames) {
    await page.getByRole('tab', { name, exact: true }).click();
    await page.waitForFunction(label => [...document.querySelectorAll('[role="tab"]')].some(tab => tab.textContent === label && tab.getAttribute('aria-selected') === 'true'), name);
    assert.equal(await page.locator('[role="tabpanel"]').count(), 1, `${name} has one accessible tab panel`);
  }
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await ready(page);
  await page.getByRole('tab', { name: 'Overview', exact: true }).press('End');
  assert.equal(await page.getByRole('tab', { name: 'Risk & compliance', exact: true }).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab', { name: 'Risk & compliance', exact: true }).press('Home');
  await ready(page);
  await page.context().close();

  for (const options of [{ fixture: 'portfolio-zero', financeFixture: 'empty' }, { fixture: 'portfolio-restricted', financeFixture: 'restricted' }, { fixture: 'workforce-restricted' }]) {
    const state = await newPage(options);
    await ready(state.page);
    await inspectLayout(state.page, 1672, assertGeometry);
    assert.doesNotMatch(await state.page.locator('.eov-board').innerText(), /NaN|Infinity|undefined/);
    if (options.financeFixture === 'empty') assert.equal(await state.page.getByTestId('executive-kpi-amount_pending').locator('.eov-kpi-value').innerText(), 'AED 0', 'A recorded zero outstanding balance stays zero');
    if (options.financeFixture === 'restricted') {
      for (const id of ['revenue', 'total_amount', 'amount_received', 'amount_pending']) assert.equal(await state.page.getByTestId(`executive-kpi-${id}`).locator('.eov-kpi-value').innerText(), '—', `${id} never falls back to unauthorised invoice values`);
    }
    if (options.fixture === 'portfolio-restricted') assert.equal(await state.page.getByTestId('executive-kpi-total_projects').locator('.eov-kpi-value').innerText(), '—', 'Restricted projects remain unavailable');
    if (options.fixture === 'workforce-restricted') assert.equal(await state.page.getByTestId('executive-side-metric-headcount').locator('strong').innerText(), '—', 'Restricted headcount remains unavailable');
    await state.page.context().close();
  }
  for (const financeFixture of ['performance-zero', 'performance-missing', 'performance-approved', 'performance-unapproved']) {
    const state = await newPage({ financeFixture });
    await ready(state.page);
    const card = state.page.getByTestId('executive-kpi-revenue').locator('.eov-kpi-value');
    const legend = state.page.locator('.eov-chart-company .eov-chart-legend');
    if (financeFixture === 'performance-zero') assert.equal(await card.innerText(), 'AED 0', 'Explicit recorded zero monthly invoicing remains zero');
    if (financeFixture === 'performance-missing') {
      assert.equal(await card.innerText(), '—', 'Missing invoice values remain unavailable instead of zero');
      assert.doesNotMatch(await state.page.locator('.eov-chart-company').textContent(), /Sep 2026 · (Invoiced|Collected against invoices|Outstanding):/, 'Missing current-month marks are absent');
    }
    if (financeFixture === 'performance-approved') {
      assert.match(await legend.innerText(), /Approved budget/);
      assert.match(await legend.innerText(), /Operating margin/);
      assert.match(await state.page.locator('.eov-chart-forecast').innerText(), /Approved forecast/);
      assert.equal(await state.page.locator('.eov-chart-forecast path[stroke-dasharray="5 3"]').count(), 0, 'Approved Finance forecast is a solid line');
    }
    if (financeFixture === 'performance-unapproved') {
      assert.doesNotMatch(await legend.innerText(), /Approved budget|Operating margin/, 'Unapproved populated Finance fields remain hidden');
      assert.match(await state.page.locator('.eov-chart-forecast').innerText(), /unavailable/i);
    }
    assert.doesNotMatch(await state.page.locator('.eov-board').innerText(), /NaN|Infinity|undefined/);
    await state.page.context().close();
  }
  await captureLocalInvoiceSource({ newPage, artifacts });
  await assertSidebarUnchanged();
  assert.deepEqual(cases.filter(row => row.violations.length), [], 'All responsive light and dark cases have no accessibility violations');
  assert.deepEqual(errors, [], 'No runtime errors across overview checks');
  assert.deepEqual(unexpectedRequests, [], 'All requests remain isolated fixture reads');
  await writeFile(path.join(artifacts, 'reference-overview-checks.json'), JSON.stringify({
    cases, checks: ['Five live KPI cards', 'Fixed compact decisions with no inline gap', 'Minimize and keyboard-expand decision banner', 'Decision review minimizes banner and focuses table', 'Invoice-date monthly/YTD revenue and weighted collection rate', 'Shared card/chart periods and month cutoff', 'Estimated versus approved forecast', 'Zero and missing invoice values', 'Unapproved financial overlays withheld', 'Definitions dialog', 'Decision keyboard focus', 'Currency filtering', 'Refresh', 'Snapshot download', 'Print export', 'All six tabs and keyboard navigation', 'Empty and restricted sources'],
    sidebarHashesUnchanged: true, sidebarAppearanceUnchanged: true, runtimeErrors: errors, unexpectedRequests,
  }, null, 2));
  console.log(`PASS: Reference overview interactions and source states. Screenshots: ${artifacts}`);
}

export async function assertReferenceOverviewPrint(page) {
  await ready(page);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.eov-decision-table tbody tr').count(), 7, 'Print includes every authorised decision instead of the three-row screen preview');
  assert.equal(await page.locator('.eov-project-table tbody tr').count(), 9, 'Print includes every project exception instead of the four-row screen preview');
  assert.equal(await page.locator('#application-sidebar').isVisible(), false, 'Print hides the existing sidebar');
  assert.equal(await page.locator('.eov-floating-decisions').isVisible(), false, 'Floating decision controls are omitted from printed reports');
  const clipped = await page.locator('.eov-tables-row tbody :is(th, td, .eov-cell-button)').evaluateAll(nodes => nodes.filter(node => {
    const style = getComputedStyle(node);
    return style.textOverflow === 'ellipsis' && style.overflow === 'hidden' || style.whiteSpace === 'nowrap';
  }).map(node => ({ tag: node.tagName, text: node.textContent, overflow: getComputedStyle(node).overflow, whitespace: getComputedStyle(node).whiteSpace })));
  assert.deepEqual(clipped, [], 'Print cells wrap without truncating source descriptions');
}

export async function assertReferenceOverviewAfterPrint(page) {
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.waitForFunction(() => document.querySelectorAll('.eov-decision-table tbody tr').length === 3);
  assert.equal(await page.locator('#application-sidebar').isVisible(), true, 'Existing sidebar returns after printing');
  assert.equal(await page.locator('.eov-floating-decisions').isVisible(), true, 'Floating decisions return to the screen after printing');
  assert.equal(await page.locator('.eov-decision-table tbody tr').count(), 3, 'Decision screen preview returns after printing');
  assert.equal(await page.locator('.eov-project-table tbody tr').count(), 4, 'Project screen preview returns after printing');
}
