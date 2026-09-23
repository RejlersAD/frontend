import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import AxeBuilder from '@axe-core/playwright';
import tailwindConfig from '../tailwind.config.js';
import { reportFixture } from './check-executive-fixtures.mjs';
import { checkArtifacts, inlineLocalCssImports, launchBrowser } from './ui-check-support.mjs';
import { revenueMoney, revenueNumber } from '../src/pages/Executive/portfolioRevenuePresentation.js';

// Synthetic browser fixture. Optional local DTO input is never copied into source control.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'portfolio-revenue');
await mkdir(artifacts, { recursive: true });
const protectedSidebarFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/components/Layout/Layout.jsx', 'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js'];
const sidebarHashes = async () => Object.fromEntries(await Promise.all(protectedSidebarFiles.map(async file => [file, createHash('sha256').update(await readFile(path.join(frontend, file))).digest('hex')])));
const sidebarBefore = await sidebarHashes();
assert.equal(revenueMoney('999999999999999999.995'), '1,000,000,000,000,000,000.00');
assert.equal(revenueMoney('-0.004'), '0.00');
assert.equal(revenueMoney('1.2345E+4'), '12,345.00');
assert.equal(revenueMoney('0E-8'), '0.00');
assert.equal(revenueNumber(null), null);
assert.equal(revenueNumber('0E-8'), 0);

const metric = (id, value, extra = {}) => ({ id, label: id.replaceAll('_', ' '), value, known_value: value, status: 'available', missing_count: 0, unit: 'currency', description: `${id} from the workbook.`, ...extra });
const ids = ['total_revenue_actual', 'current_forecast', 'pm_forecast', 'variance', 'total_backlog', 'total_poc_risk'];
const project = index => ({ id: index, project_code: `P${index}`, subproject_code: `S${index}`, title: `Synthetic project ${index}`, client: 'Client A', pm: 'DM', business_unit: 'Energy', contract_value_aed: '1000.00', recognized_revenue_aed: '500.00', actual_revenue: index === 1 ? '0E-8' : '100.00', forecast_revenue: '200.00', pm_forecast: '150.00', variance: '50.00', backlog: '500.00', poc_risk: null, poc_pct: index === 1 ? '0E-8' : '45', eddr_pct: null, forecast_margin_pct: '12.5', direct_cost_aed: '75.00', ld_min_pct: '1', ld_max_pct: '10', delay_days: '7', resource_cost_aed: '55.12', forecast_finish: '2027-01-01' });
function fixture() {
  return {
    enabled: true, status: 'partial', currency: 'AED', period: '2026-09', source: { snapshot_id: 10, file_name: 'Synthetic portfolio.xlsx', reporting_date: '2026-09-18', imported_at: '2026-09-23T09:00:00Z' }, scope: { label: 'Complete synthetic source scope', full_source: true },
    kpis: ids.map((id, index) => metric(id, ['1200.00', '1600.00', '1500.00', '100.00', null, '0E-8'][index], index === 4 ? { status: 'partial', missing_count: 1, known_value: '7000.00' } : {})),
    filters: { business_units: ['Energy', 'Empty', 'Fail', 'Denied', 'Slow'], clients: ['Client A', 'Client B'], project_managers: ['DM'] },
    breakdowns: Object.fromEntries(['business_unit', 'client', 'project_manager'].map(key => [key, [{ label: key === 'project_manager' ? 'DM' : 'Energy', project_count: 12, actual_revenue: null, forecast_revenue: '1600.00', coverage: { actual_revenue: { status: 'partial', known_value: '1200.00', missing_count: 1 } } }]])),
    forecast: Array.from({ length: 36 }, (_, index) => ({ period: `${2025 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}-01`, actual_revenue: index === 20 ? '1200.00' : null, forecast_revenue: null, pm_forecast: index === 20 ? '1500.00' : null, known_values: { forecast_revenue: index === 21 ? null : String(index * 100) }, coverage: { forecast_revenue: { included_rows: 12, known_rows: 11, missing_count: 1, status: 'partial' } } })),
    projects: { rows: Array.from({ length: 12 }, (_, index) => project(index + 1)), total_rows: 12, offset: 0, limit: 200 },
    risks: { status: 'partial', missing_count: 1, total_rows: 3, rows: ['poc', 'ld', 'prolongation'].map((type, index) => ({ ...project(index + 1), type, label: type, amount: '100.00' })), totals: { poc: metric('poc', '0E-8'), ld: metric('ld', '100.00'), prolongation: metric('prolongation', '100.00') }, poc_history: [{ date: '2026-09-18', poc_risk_aed: '0E-8' }], history: [{ date: '2025-09-18', poc_risk_aed: '100.123456', ld_exposure_aed: null, prolongation_cost_aed: '0E-8' }] },
    invoicing: { status: 'partial', warnings: [{ code: 'source_header_period_conflict' }, { code: 'mixed_comparison_periods' }], totals: { invoiced_aed: metric('invoiced', null, { known_value: '400.00', status: 'partial', missing_count: 2 }), balance_aed: metric('balance', null, { known_value: '600.00', status: 'partial', missing_count: 1 }), variance_aed: metric('gap', null, { known_value: '50.00', status: 'partial', known_value_label: 'Mixed-period subtotal', basis: 'mixed_comparison_periods' }) }, rows: [{ ...project(1), invoiced_aed: '400.00', balance_aed: '600.00', variance_aed: '50.00', reporting_date: '2026-09-18', comparison_date: '2026-08-31' }], comparison_periods: [{ comparison_date: '2026-08-31', included_rows: 1, totals: { comparison_revenue_aed: metric('comparison', '100.00'), variance_aed: metric('variance', '50.00') } }, { comparison_date: '2026-07-31', included_rows: 1, totals: { comparison_revenue_aed: metric('comparison', '100.00'), variance_aed: metric('variance', '0E-8') } }] },
    pm_performance: { status: 'partial', warnings: [{ code: 'kpi_label_period_mismatch' }], rows: [{ pm: 'DM', label: 'DM', project_count: 12, actual_revenue: '1200.00', pm_forecast: '1500.00', variance: '100.00', delivered_margin_pct: '15', kpi: { name: 'Synthetic Manager', period_label: 'KPI - JUN -2026', revenue_ratio: '0E-8', invoicing_ratio: '0.5', cpi_ratio: '1', overall_ratio: '0.8' } }] },
    capacity: { status: 'available', unit: 'manhours', rows: Array.from({ length: 24 }, (_, index) => ({ period: `2026-${String(index % 12 + 1).padStart(2, '0')}-01`.replace('2026', String(2026 + Math.floor(index / 12))), demand_manhours: '1000', gross_capacity_manhours: '1200', adjusted_capacity_manhours: '1100', gap_manhours: '100' })), staffing: [{ label: 'Engineering', value: '20', unit: 'fte', planning_amount_aed: '999.99' }, { label: 'Reported planning total', value: '25', unit: 'mixed_source_units', is_total: true }], warnings: ['Staffing quantities have no source date and mixed or unspecified units; do not total as headcount.'] }, definitions: ['Current forecast less PM forecast.'],
  };
}
const source = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import ExecutiveDashboard from './src/pages/Executive/ExecutiveDashboard.jsx';window.print=()=>{window.didPrint=true;window.printHidden=!document.querySelector('[data-testid="portfolio-intervention-launcher"]');window.printHasPanels=['revenue-projects','revenue-pm-performance','revenue-risks','revenue-invoicing','revenue-capacity'].every(id=>document.querySelector('[data-testid="'+id+'"]'))};createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/executive?tab=portfolio']}><main><ExecutiveDashboard/></main></MemoryRouter>);`;
const api = `export default {get:async(url,config={})=>{const target=new URL('/fixture'+url,location.origin);Object.entries(config.params||{}).forEach(([key,value])=>target.searchParams.set(key,value));const r=await fetch(target,{signal:config.signal});const data=await r.json();if(!r.ok){const e=new Error('Fixture failed');e.response={status:r.status,data};throw e;}return {data};}};`;
const bundle = await build({ stdin: { contents: source, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'fixture-api', setup(builder) { builder.onLoad({ filter: /services[\\/]api\.service\.js$/ }, () => ({ contents: api, loader: 'js' })); } }] });
const files = await readdir(path.join(frontend, 'src/pages/Executive'));
const componentSources = await Promise.all(files.filter(file => /\.(jsx?|css)$/.test(file)).map(file => readFile(path.join(frontend, 'src/pages/Executive', file), 'utf8')));
const css = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [source, ...componentSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css')), { from: undefined });
const styles = await Promise.all(files.filter(file => file.endsWith('.css')).map(file => readFile(path.join(frontend, 'src/pages/Executive', file), 'utf8')));
const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio revenue check</title><style>${css.css}\n${styles.join('\n')}body{margin:0}main{padding:16px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const browser = await launchBrowser();
const errors = [], checks = [], requests = [], accessibility = [];
const back = page => page.getByRole('button', { name: 'Back to Project Portfolio', exact: true });
async function showSection(page, label, testId) {
  if (await back(page).count()) await back(page).click();
  await page.getByTestId('revenue-watchlist').waitFor();
  if (label !== 'Revenue overview') {
    const actions = {
      'Projects & Delivery': page.getByTestId('revenue-watchlist').getByRole('button', { name: 'View all', exact: true }),
      'PM Performance': page.getByTestId('revenue-overview-attainment').getByRole('button', { name: 'View all project managers', exact: true }),
      'Risk & Claims': page.getByTestId('revenue-intervention-strip').getByRole('button', { name: 'Review interventions', exact: true }),
      'Invoice Control': page.getByTestId('revenue-overview-invoice').getByRole('button', { name: 'Open invoice control', exact: true }),
      Capacity: page.locator('.prv-overview-links').getByRole('button', { name: /^Capacity / }),
    };
    assert.ok(actions[label], `Overview action exists for ${label}`);
    await actions[label].click();
    assert.equal(await back(page).isVisible(), true, `${label} can return to Project Portfolio`);
  }
  if (testId) await page.getByTestId(testId).waitFor();
  assert.equal(await page.locator('#revenue-content').getAttribute('role'), 'region');
  assert.equal(await page.locator('#revenue-content').getAttribute('aria-label'), label);
}
async function accessibleAmounts(locator) {
  return locator.evaluate(node => [node.innerText, ...[node, ...node.querySelectorAll('[title],[aria-label]')].flatMap(element => [element.getAttribute('title'), element.getAttribute('aria-label')])].filter(Boolean).join('\n'));
}
async function assertAmount(locator, value) {
  const exact = revenueMoney(value);
  assert.ok((await accessibleAmounts(locator)).includes(exact), `Exact workbook amount ${exact} must remain accessible`);
}
async function checkAccessibility(page, view) {
  const result = await new AxeBuilder({ page }).include('.cc-command-center').withTags(['wcag2a', 'wcag2aa']).analyze();
  accessibility.push({ view, violations: result.violations });
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
  assert.deepEqual(result.violations.map(item => ({ id: item.id, nodes: item.nodes.length })), [], `${view} WCAG A/AA`);
}
async function open(data = fixture(), width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 940 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname === '/fixture/dashboard/executive/') { const report = reportFixture(); report.portfolio_performance.revenue_dashboard = data; return route.fulfill({ json: report }); }
    if (url.pathname === '/fixture/dashboard/executive/portfolio-workbook/revenue/') {
      requests.push(Object.fromEntries(url.searchParams));
      const bu = url.searchParams.get('business_unit');
      if (bu === 'Fail') return route.fulfill({ status: 500, json: { detail: 'Fixture failure' } });
      if (bu === 'Denied') return route.fulfill({ status: 403, json: { detail: 'Access restricted' } });
      if (bu === 'Slow') await new Promise(resolve => setTimeout(resolve, 600));
      const result = structuredClone(data);
      const filtered = ['business_unit', 'client', 'pm', 'search'].some(key => url.searchParams.get(key));
      result.scope = { ...data.scope, label: filtered ? 'Filtered source scope' : data.scope.label, filtered };
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 200);
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const matching = search ? result.projects.rows.filter(row => `${row.title} ${row.project_code} ${row.client}`.toLowerCase().includes(search)) : result.projects.rows;
      if (search) result.projects.total_rows = matching.length;
      result.projects.rows = matching.slice(offset, offset + limit);
      Object.assign(result.projects, { offset, limit, returned_rows: result.projects.rows.length, truncated: offset + limit < result.projects.total_rows });
      if (bu) result.kpis[0] = metric(ids[0], bu === 'Slow' ? '111.11' : '987.65');
      if (filtered) result.capacity = { status: 'restricted_scope', rows: [], description: 'Global capacity is unavailable for filtered scope.' };
      if (bu === 'Empty') { result.status = 'unavailable'; result.projects.total_rows = 0; result.projects.rows = []; }
      return route.fulfill({ json: result });
    }
    if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/assets/')) return route.fulfill({ status: 204, body: '' });
    return route.abort();
  });
  await page.goto('http://revenue-check.test/');
  await page.getByTestId('portfolio-revenue-dashboard').waitFor();
  return { page, context };
}
if (process.argv.includes('--visual-only')) {
  const input = process.argv.find(value => value.startsWith('--actual-dto='))?.slice('--actual-dto='.length);
  const datasets = [{ name: 'synthetic', data: fixture() }];
  if (input) datasets.push({ name: 'actual', data: JSON.parse((await readFile(path.resolve(input), 'utf8')).replace(/^\uFEFF/, '')) });
  const geometry = [];
  try {
    for (const dataset of datasets) for (const [width, dark] of [[1440, false], [1190, false], [390, false], [1440, true]]) {
      const { page, context } = await open(dataset.data, width);
      if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'));
      const labels = page.getByTestId('revenue-overview-invoice').locator('.prv-invoice-reference-stats > div > span');
      assert.equal(await labels.evaluateAll(nodes => nodes.length === 3 && nodes.every(node => {
        const style = getComputedStyle(node); return style.overflow === 'hidden' && style.textOverflow === 'ellipsis';
      })), true, 'Latest invoice labels clip within their columns with ellipsis');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Overview has no horizontal page overflow');
      const labelBoxes = await labels.evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
      }));
      for (let index = 0; index < labelBoxes.length - 1; index += 1) {
        const first = labelBoxes[index], second = labelBoxes[index + 1];
        assert.ok(first.right <= second.x + 1 || first.bottom <= second.y + 1, 'Invoice label boxes do not overlap');
      }
      const view = `${dataset.name}-${dark ? 'dark' : width}`;
      await checkAccessibility(page, view);
      geometry.push({ view, labelBoxes, bottomTiles: await page.locator('.prv-overview-links').boundingBox() });
      await page.screenshot({ path: path.join(artifacts, `revenue-final-${view}.png`), fullPage: true });
      await context.close();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(await sidebarHashes(), sidebarBefore, 'Protected sidebar files remain unchanged');
    await writeFile(path.join(artifacts, 'visual-result.json'), JSON.stringify({ geometry, accessibility: accessibility.map(({ view, violations }) => ({ view, violations: violations.length })), sidebar: sidebarBefore }, null, 2));
    console.log(`PASS: final overview geometry, invoice label clipping, mobile/dark WCAG checks and protected sidebar hashes (${geometry.length} views). Artifacts: ${artifacts}`);
  } finally { await browser.close(); }
  process.exit(0);
}
try {
  const { page, context } = await open();
  assert.equal(await page.getByRole('heading', { name: 'Project Portfolio', exact: true }).count(), 1);
  assert.equal(await page.getByRole('tabpanel', { name: 'Project portfolio', exact: true }).count(), 1);
  assert.deepEqual(await page.getByRole('tablist', { name: 'Executive dashboard sections', exact: true }).getByRole('tab').allTextContents(), ['Overview', 'Financial performance', 'Project portfolio', 'Commercial pipeline', 'Workforce', 'Risk & compliance']);
  assert.equal(await page.locator('[id="executive-tab-portfolio"]').count(), 1, 'Parent portfolio tab ID remains unique');
  assert.equal(await page.getByLabel('Portfolio reporting currency', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Upload Excel workbook', { exact: true }).count(), 0);
  assert.equal(await page.locator('#executive-revenue-navigation,.prv-view-tabs').count(), 0, 'Inner revenue tabs and their portal are removed');
  assert.equal(await page.getByRole('tablist').count(), 1, 'Only the six main Executive tabs remain');
  assert.equal(await page.locator('#revenue-content').getAttribute('role'), 'region');
  assert.equal(await back(page).count(), 0, 'Overview has no unnecessary Back button');
  assert.equal(await page.locator('.rv-header-secondary').count(), 0, 'Removed inner navigation leaves no empty header spacer');
  assert.equal(await page.locator('#executive-revenue-filters').getByLabel('Revenue business unit', { exact: true }).count(), 1);
  for (const item of fixture().kpis) if (item.value !== null) await assertAmount(page.getByTestId(`revenue-kpi-${item.id}`), item.value);
  assert.match(await page.getByTestId('revenue-kpi-total_backlog').innerText(), /subtotal/i);
  await assertAmount(page.getByTestId('revenue-kpi-total_backlog'), '7000.00');
  const overviewIds = ['revenue-overview-outlook', 'revenue-overview-attainment', 'revenue-overview-bu', 'revenue-overview-risks', 'revenue-overview-invoice'];
  for (const id of overviewIds) await page.getByTestId(id).waitFor();
  assert.match(await page.getByTestId('revenue-overview-invoice').innerText(), /Known balance to invoice/);
  await assertAmount(page.getByTestId('revenue-overview-invoice'), '600.00');
  assert.equal(await page.locator('.prv-summary-table-wrap').evaluateAll(nodes => nodes.length === 2 && nodes.every(node => node.tabIndex === 0 && node.getAttribute('role') === 'region' && node.getAttribute('aria-label'))), true, 'Overview table scroll regions are keyboard accessible');
  const boxes = await Promise.all(overviewIds.map(id => page.getByTestId(id).boundingBox()));
  assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 3, 'Outlook and PM attainment occupy the first overview row');
  assert.ok(boxes[0].x + boxes[0].width <= boxes[1].x, 'First overview row has two distinct columns');
  assert.ok(Math.max(...boxes.slice(2).map(box => box.y)) - Math.min(...boxes.slice(2).map(box => box.y)) < 3, 'BU, risk and invoice panels share the second row');
  assert.ok(boxes[2].y > boxes[0].y, 'Second overview row follows the revenue outlook');
  assert.equal(await page.getByTestId('revenue-watchlist').locator('tbody tr').count(), 5);
  assert.equal(await page.locator('.prv-overview-links > button').count(), 3);
  assert.equal(await page.getByTestId('revenue-projects').count(), 0, 'Detailed register belongs to its tab');
  assert.equal(await page.getByTestId('portfolio-intervention-launcher').count(), 0, 'Workbook mode uses the inline intervention strip');
  assert.match(await page.getByTestId('revenue-overview-attainment').innerText(), /80(?:\.0+)?%/, 'Attainment uses current actual / PM forecast, not the June KPI score');
  assert.match(await accessibleAmounts(page.locator('.prv-chart-legend').first()), /Partial series: known source-row subtotals/);
  assert.match(await page.getByTestId('revenue-overview-outlook').innerText(), /Known subtotals; source coverage is incomplete/);
  const revenueChart = page.getByTestId('revenue-forecast-chart');
  assert.equal(await revenueChart.locator('circle[data-series="pm_forecast"]').count(), 1, 'Only the supplied PM forecast observation is plotted');
  assert.equal(await revenueChart.locator('circle[data-series="pm_forecast"]').getAttribute('data-period'), '2026-09-01');
  assert.equal(await revenueChart.locator('[data-series="forecast_revenue"][data-period="2026-10-01"]').count(), 0, 'Missing forecast observation is a gap, not zero');
  assert.match(await revenueChart.locator('[data-current-period="true"]').textContent(), /Sep(?:t)?\s*2026/);
  assert.doesNotMatch(await page.getByTestId('portfolio-revenue-dashboard').innerText(), /\b(vs\.? last (?:month|period)|month.over.month growth)\b/i, 'No fabricated growth comparison');
  await checkAccessibility(page, 'Revenue overview');
  const beforeException = requests.length;
  await page.getByLabel('Watchlist exception', { exact: true }).selectOption('ld');
  assert.equal(await page.getByTestId('revenue-watchlist').locator('tbody tr').count(), 1);
  assert.match(await page.getByTestId('revenue-watchlist').locator('tbody').innerText(), /Synthetic project 2/);
  assert.equal(requests.length, beforeException, 'Watchlist exception selection filters the returned source rows locally');
  await page.getByLabel('Watchlist exception', { exact: true }).selectOption('all');
  await page.getByRole('button', { name: 'Open Synthetic project 1', exact: true }).click();
  assert.match(await page.getByRole('dialog').innerText(), /Actual revenue AED 0.00/);
  await page.getByRole('button', { name: 'Close definitions' }).click();
  await page.getByLabel('Watchlist business unit', { exact: true }).selectOption('Energy');
  await page.waitForFunction(() => document.querySelector('[data-testid="revenue-kpi-total_revenue_actual"] .prv-kpi-value')?.getAttribute('aria-label') === 'AED 987.65');
  assert.equal(await page.getByLabel('Revenue business unit', { exact: true }).inputValue(), 'Energy');
  assert.equal(requests.at(-1).limit, '200', 'Overview loads source rows before selecting its five-row watchlist');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Search revenue portfolio', { exact: true }).fill('Synthetic project 12');
  await page.waitForFunction(() => document.querySelector('[data-testid="revenue-watchlist"] tbody')?.textContent.includes('Synthetic project 12'));
  assert.equal(await page.getByTestId('revenue-watchlist').locator('tbody tr').count(), 1);
  assert.equal(requests.at(-1).search, 'Synthetic project 12');
  assert.equal(requests.at(-1).offset, '0');
  await page.getByLabel('Search revenue portfolio', { exact: true }).fill('');
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="revenue-watchlist"] tbody tr').length === 5);
  await page.locator('.prv-overview-links').getByRole('button', { name: /^Capacity / }).focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('revenue-capacity').waitFor();
  assert.equal(await page.locator('#revenue-content').getAttribute('aria-label'), 'Capacity');
  await back(page).focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('revenue-watchlist').waitFor();
  assert.equal(await back(page).count(), 0);
  await page.getByTestId('revenue-overview-outlook').getByRole('button', { name: 'Open forecast', exact: true }).click();
  await page.getByTestId('revenue-projects').waitFor();
  assert.equal(await page.locator('#revenue-content').getAttribute('aria-label'), 'Projects & Delivery');
  await page.getByText('All 36 monthly figures', { exact: true }).click();
  assert.equal(await page.getByRole('region', { name: 'Monthly revenue figures', exact: true }).locator('tbody tr').count(), 36);

  await showSection(page, 'PM Performance', 'revenue-pm-performance');
  assert.match(await page.getByTestId('revenue-pm-performance').innerText(), /Formulas mix current Report references/);
  assert.match(await page.getByTestId('revenue-pm-performance').innerText(), /Synthetic Manager \(DM\)/);
  assert.match(await page.getByTestId('revenue-pm-performance').innerText(), /JUN.*2026/);
  await checkAccessibility(page, 'PM Performance');

  await showSection(page, 'Invoice Control', 'revenue-invoicing');
  assert.match(await page.getByTestId('revenue-invoicing').innerText(), /Mixed-period subtotal 50.00/);
  await page.getByText('Revenue comparisons by baseline date', { exact: true }).click();
  assert.match(await page.getByRole('region', { name: 'Invoice comparison baselines' }).innerText(), /Jul[\s\S]*2026/);
  assert.match(await page.getByRole('region', { name: 'Invoice comparison baselines' }).innerText(), /Aug[\s\S]*2026/);
  await checkAccessibility(page, 'Invoice Control');

  await showSection(page, 'Capacity', 'revenue-capacity');
  assert.equal(await page.locator('.prv-capacity-period').first().locator('span').first().innerText(), 'Sept 2026');
  assert.match(await page.locator('.prv-staffing').innerText(), /25 mixed planning units/);
  assert.doesNotMatch(await page.locator('.prv-staffing').innerText(), /AED|999\.99/);
  await checkAccessibility(page, 'Capacity');

  await showSection(page, 'Revenue overview', 'revenue-watchlist');
  const strip = page.getByTestId('revenue-intervention-strip');
  assert.match(await strip.innerText(), /3/);
  const review = strip.getByRole('button', { name: 'Review interventions', exact: true });
  await review.focus(); await page.keyboard.press('Enter');
  await page.getByTestId('revenue-risks').waitFor();
  assert.equal(await page.locator('#revenue-content').getAttribute('aria-label'), 'Risk & Claims');
  assert.equal(await back(page).isVisible(), true);
  await checkAccessibility(page, 'Risk & Claims');

  await showSection(page, 'Projects & Delivery', 'revenue-projects');
  assert.equal(await page.getByTestId('revenue-projects').locator('tbody tr').count(), 10);
  assert.match(await page.getByTestId('revenue-projects').locator('tbody tr').first().innerText(), /0%[\s\S]*EDDR[\s\S]*\u2014/);
  await page.getByRole('button', { name: 'Synthetic project 1', exact: true }).click();
  assert.match(await page.getByRole('dialog').innerText(), /Cumulative recognized revenue AED 500.00/);
  assert.match(await page.getByRole('dialog').innerText(), /Delay 7 days/);
  await page.getByRole('button', { name: 'Close definitions' }).click();
  await checkAccessibility(page, 'Projects & Delivery');
  await page.getByRole('button', { name: 'Next revenue project page' }).click();
  await page.getByRole('button', { name: 'Synthetic project 11', exact: true }).waitFor();
  assert.equal(await page.getByTestId('revenue-projects').locator('tbody tr').count(), 2);
  await assertAmount(page.getByTestId('revenue-kpi-total_revenue_actual'), '1200.00');
  assert.equal(requests.at(-1).offset, '10');
  assert.equal(requests.at(-1).limit, '10');
  await page.getByLabel('Revenue business unit', { exact: true }).selectOption('Energy');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="revenue-kpi-total_revenue_actual"] [title],[data-testid="revenue-kpi-total_revenue_actual"] [aria-label]')].some(node => `${node.title} ${node.getAttribute('aria-label')}`.includes('987.65')));
  assert.equal(requests.at(-1).offset, '0');
  await page.getByLabel('More revenue export options', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
  const download = await downloadPromise; const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.report_type, 'executive_revenue'); assert.equal(exported.filters.business_unit, 'Energy'); assert.equal(exported.revenue_dashboard.kpis[0].value, '987.65');
  await page.getByLabel('Revenue business unit', { exact: true }).selectOption('Empty');
  await page.getByText('No projects match this scope', { exact: true }).waitFor();
  assert.equal(await back(page).isVisible(), true, 'Empty detail scope retains its Back button');
  await page.getByLabel('Revenue business unit', { exact: true }).selectOption('Fail');
  await page.getByRole('alert').filter({ hasText: 'selected portfolio scope' }).waitFor();
  assert.equal(await page.getByTestId('revenue-kpi-total_revenue_actual').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Export revenue board' }).isDisabled(), true);
  assert.equal(await back(page).isVisible(), true, 'Failed detail scope retains its Back button');
  await back(page).click();
  assert.equal(await back(page).count(), 0, 'Back works while the detail request has failed');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await showSection(page, 'Projects & Delivery', 'revenue-projects');
  await page.getByLabel('Revenue business unit', { exact: true }).selectOption('Denied');
  await page.getByRole('alert').filter({ hasText: 'access is restricted' }).waitFor();
  assert.equal(await page.getByTestId('revenue-kpi-total_revenue_actual').count(), 0);
  assert.equal(await back(page).isVisible(), true, 'Restricted detail scope retains its Back button');
  await page.getByLabel('Revenue business unit', { exact: true }).selectOption('Slow');
  assert.equal(await back(page).isVisible(), true, 'Loading detail scope retains its Back button');
  await back(page).click();
  assert.equal(await back(page).count(), 0, 'Back works while the detail request is pending');
  await page.getByLabel('Revenue business unit', { exact: true }).selectOption('Energy');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="revenue-kpi-total_revenue_actual"] [title],[data-testid="revenue-kpi-total_revenue_actual"] [aria-label]')].some(node => `${node.title} ${node.getAttribute('aria-label')}`.includes('987.65')));
  await page.waitForTimeout(700);
  await assertAmount(page.getByTestId('revenue-kpi-total_revenue_actual'), '987.65');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await showSection(page, 'Revenue overview', 'revenue-watchlist');
  await assertAmount(page.getByTestId('revenue-kpi-total_revenue_actual'), '1200.00');
  await page.getByRole('button', { name: 'Export revenue board' }).click();
  await page.waitForFunction(() => window.didPrint && window.printHidden && window.printHasPanels);
  await page.getByTestId('revenue-watchlist').waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, 'revenue-desktop.png'), fullPage: true });
  checks.push('Compact overview layout, six exact AED headlines, five-row watchlist, current PM attainment, source-only forecast points, retained main Executive tabs and all detail views reachable through overview links with Back navigation');
  checks.push('Zero/missing values, source warnings, mixed invoice dates, project details, risk keyboard control, pagination, scoped filters/export, empty/error/403/stale-request states and complete print');
  await context.close();

  for (const [width, dark] of [[390, false], [1440, true]]) {
    const { page: visual, context: visualContext } = await open(fixture(), width);
    if (dark) await visual.evaluate(() => document.documentElement.classList.add('dark'));
    assert.equal(await visual.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal page overflow');
    assert.equal(await visual.getByTestId('revenue-watchlist').locator('tbody tr').count(), 5);
    assert.equal(await visual.getByRole('tablist').count(), 1, 'Mobile and dark mode retain only main Executive tabs');
    assert.equal(await visual.locator('#executive-revenue-navigation,.prv-view-tabs,.rv-header-secondary').count(), 0);
    await visual.screenshot({ path: path.join(artifacts, `revenue-${dark ? 'dark' : width}.png`), fullPage: true });
    await checkAccessibility(visual, dark ? 'Dark overview' : 'Mobile overview');
    await visualContext.close();
  }
  for (const status of ['restricted', 'error']) {
    const data = fixture(); data.status = status;
    const { page: unavailable, context: unavailableContext } = await open(data);
    assert.equal(await unavailable.getByTestId('revenue-kpi-total_revenue_actual').count(), 0);
    assert.equal(await unavailable.getByTestId('project-portfolio').count(), 0, 'Active source failure must not silently show operational fallback');
    await unavailableContext.close();
  }
  const stale = fixture(); stale.source.is_stale = true;
  const { page: stalePage, context: staleContext } = await open(stale);
  assert.match(await stalePage.getByTestId('portfolio-revenue-dashboard').innerText(), /older than the freshness window|stale source|stale report/i);
  await assertAmount(stalePage.getByTestId('revenue-kpi-total_revenue_actual'), '1200.00');
  await staleContext.close();
  for (const missing of [0, 3]) {
    const coverage = fixture();
    coverage.risks = { status: missing ? 'partial' : 'available', total_rows: 0, missing_count: missing, rows: [], totals: Object.fromEntries(['poc', 'ld', 'prolongation'].map(key => [key, metric(key, missing ? null : '0E-8', missing ? { status: 'partial', known_value: null, missing_count: 1 } : {})])) };
    const { page: riskPage, context: riskContext } = await open(coverage);
    const message = await riskPage.getByTestId('revenue-intervention-strip').innerText();
    assert.match(message, missing ? /coverage requires review/i : /No recorded portfolio interventions/i);
    assert.doesNotMatch(message, /all clear|healthy portfolio/i, 'Absence of recorded exposure is not a health assessment');
    if (missing) assert.doesNotMatch(message, /\b0 portfolio interventions\b/i, 'Missing risk observations do not become zero interventions');
    await riskContext.close();
  }

  const actualPath = process.argv.find(value => value.startsWith('--actual-dto='))?.slice('--actual-dto='.length);
  if (actualPath) {
    const actual = JSON.parse((await readFile(path.resolve(actualPath), 'utf8')).replace(/^\uFEFF/, ''));
    const { page: live, context: liveContext } = await open(actual);
    for (const item of actual.kpis) await assertAmount(live.getByTestId(`revenue-kpi-${item.id}`), item.value);
    assert.equal(await live.locator('.prv-kpis article').count(), 6);
    assert.equal(await live.getByTestId('revenue-watchlist').locator('tbody tr').count(), Math.min(5, actual.projects.total_rows));
    assert.match(await live.getByTestId('revenue-intervention-strip').innerText(), new RegExp(String(actual.risks.total_rows)));
    await live.screenshot({ path: path.join(artifacts, 'revenue-actual-source.png'), fullPage: true });
    await showSection(live, 'Projects & Delivery', 'revenue-projects');
    assert.equal(await live.getByTestId('revenue-projects').locator('tbody tr').count(), Math.min(10, actual.projects.total_rows));
    if (actual.capacity?.staffing?.length) {
      await showSection(live, 'Capacity', 'revenue-capacity');
      const staffingText = await live.locator('.prv-staffing').innerText();
      assert.doesNotMatch(staffingText, /AED/, 'Undated staffing quantities do not show unverified monetary amounts');
      const total = actual.capacity.staffing.find(row => row.is_total);
      if (total) assert.ok(staffingText.includes(`${revenueNumber(total.value)} mixed planning units`), 'Saved staffing total retains mixed planning units');
    }
    await showSection(live, 'Revenue overview', 'revenue-watchlist');
    await live.setViewportSize({ width: 390, height: 940 });
    assert.equal(await live.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Actual source mobile has no horizontal page overflow');
    await live.screenshot({ path: path.join(artifacts, 'revenue-actual-source-390.png'), fullPage: true });
    checks.push('Actual local DTO: all six API amounts, compact overview, full project count, staffing units and workbook intervention count');
    await liveContext.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(await sidebarHashes(), sidebarBefore, 'Sidebar, shared Layout and sidebar hooks remain unchanged');
  checks.push('Responsive mobile/dark screenshots, WCAG A/AA across all views, source restriction/failure/staleness and protected sidebar file hashes');
  await writeFile(path.join(artifacts, 'result.json'), JSON.stringify({ checks, errors, requests, accessibility: accessibility.map(({ view, violations }) => ({ view, violations: violations.length })), sidebar: sidebarBefore, artifacts }, null, 2));
  console.log(`PASS: ${checks.join('; ')}. Artifacts: ${artifacts}`);
} finally { await browser.close(); }
