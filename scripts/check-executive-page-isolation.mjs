import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { reportFixture } from './check-executive-fixtures.mjs';
import { RECEIVABLES_CHECK_TIME, receivablesFixture } from './check-receivables-dashboard-fixtures.mjs';
import { checkArtifacts, inlineLocalCssImports, launchBrowser } from './ui-check-support.mjs';

// Compare unchanged executive pages against Git HEAD with an active portfolio
// workbook. Every request is intercepted; no live API or database is used.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'executive-page-isolation');
await mkdir(artifacts, { recursive: true });
const git = (...args) => execFileSync('git', args, { cwd: frontend, encoding: 'utf8' });
const revision = git('rev-parse', 'HEAD').trim();
const hash = value => createHash('sha256').update(value).digest('hex');
const protectedFiles = ['src/pages/Executive/ExecutiveReferenceOverview.jsx', 'src/pages/Executive/ExecutiveReferenceOverview.css', 'src/pages/Executive/ExecutiveOverview.css', 'src/pages/Executive/FinancialPerformance.jsx', 'src/pages/Executive/FinancialPerformance.css', 'src/pages/Executive/ExecutiveDashboard.css', 'src/pages/Executive/ExecutiveTabColors.css', 'src/pages/Executive/ExecutiveKpiCard.css', 'src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/components/Layout/Layout.jsx', 'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js'];
for (const file of protectedFiles) assert.equal((await readFile(path.join(frontend, file), 'utf8')).replaceAll('\r\n', '\n'), git('show', `HEAD:${file}`).replaceAll('\r\n', '\n'), `${file} remains identical to HEAD`);
const source = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import ExecutiveDashboard from './src/pages/Executive/ExecutiveDashboard.jsx';const route=new URLSearchParams(location.search).get('route')||'/executive';createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[route]}><main><ExecutiveDashboard/></main></MemoryRouter>);`;
const api = `export default {get:async(url,config={})=>{const target=new URL('/fixture'+url,location.origin);Object.entries(config.params||{}).forEach(([key,value])=>target.searchParams.set(key,value));const response=await fetch(target,{signal:config.signal});return {data:await response.json()};}};`;
const filenames = await readdir(path.join(frontend, 'src/pages/Executive'));
const components = await Promise.all(filenames.filter(file => /\.(jsx?|css)$/.test(file)).map(file => readFile(path.join(frontend, 'src/pages/Executive', file), 'utf8')));
const css = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [source, ...components].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css')), { from: undefined });
const trackedCss = new Set(git('ls-tree', '-r', '--name-only', 'HEAD', 'src/pages/Executive').trim().split('\n').filter(file => file.endsWith('.css')));
const documents = {};
for (const baseline of [true, false]) {
  const bundle = await build({ stdin: { contents: source, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'isolated-api-and-baseline', setup(builder) {
    builder.onLoad({ filter: /services[\\/]api\.service\.js$/ }, () => ({ contents: api, loader: 'js' }));
    if (baseline) builder.onLoad({ filter: /pages[\\/]Executive[\\/](ExecutiveDashboard|ProjectPortfolio)\.jsx$/ }, args => ({ contents: git('show', `HEAD:${path.relative(frontend, args.path).replaceAll('\\', '/')}`), loader: 'jsx' }));
  } }] });
  const styles = await Promise.all(filenames.filter(file => file.endsWith('.css')).filter(file => !baseline || trackedCss.has(`src/pages/Executive/${file}`)).map(file => baseline ? git('show', `HEAD:src/pages/Executive/${file}`) : readFile(path.join(frontend, 'src/pages/Executive', file), 'utf8')));
  documents[baseline ? 'baseline' : 'current'] = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Executive page isolation</title><style>${css.css}\n${styles.join('\n')}body{margin:0}main{padding:16px}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
}
const workbook = { enabled: true, status: 'available', currency: 'AED', period: '2026-09', source: { file_name: 'Synthetic isolation workbook.xlsx', reporting_date: '2026-09-18', imported_at: '2026-09-23T09:00:00Z' }, scope: { label: 'Uploaded portfolio source', full_source: true }, kpis: ['total_revenue_actual', 'current_forecast', 'pm_forecast', 'variance', 'total_backlog', 'total_poc_risk'].map(id => ({ id, label: id, value: '100.00', known_value: '100.00', status: 'available', unit: 'currency', missing_count: 0 })), filters: {}, breakdowns: { business_unit: [], client: [], project_manager: [] }, forecast: [], projects: { rows: [], total_rows: 0, offset: 0, limit: 200 }, risks: { rows: [], total_rows: 0, missing_count: 0, status: 'available', totals: {} }, invoicing: { rows: [], totals: {} }, pm_performance: { rows: [] }, capacity: { rows: [], staffing: [] } };
const browser = await launchBrowser();
const errors = [], results = [];
const tabs = page => page.getByRole('tablist', { name: 'Executive dashboard sections', exact: true });
const parentLabels = ['Overview', 'Financial performance', 'Project portfolio', 'Commercial pipeline', 'Workforce', 'Risk & compliance'];
async function ready(page, section) {
  await page.getByRole('heading', { name: section === 'overview' ? 'Executive Command Center' : 'Financial Performance', exact: true }).waitFor();
  await page.waitForFunction(section => section === 'overview' ? document.querySelector('.eov-board')?.getAttribute('aria-busy') === 'false' : document.querySelector('select[aria-label="Financial reporting currency"]')?.disabled === false, section);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function assertOriginal(page, section) {
  assert.deepEqual(await tabs(page).getByRole('tab').allTextContents(), parentLabels);
  assert.equal(await page.locator('.rv-reference-page,.rv-page-header,.prv-dashboard,#executive-revenue-navigation,#executive-revenue-filters').count(), 0, `${section} has no portfolio classes or portals`);
  assert.equal(await page.getByTestId('portfolio-revenue-dashboard').count(), 0);
  assert.equal(await page.getByLabel(section === 'overview' ? 'Overview reporting currency' : 'Financial reporting currency', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: section === 'overview' ? 'Review decisions' : 'Review financial actions', exact: true }).count(), 1);
  assert.equal(await page.locator('.cc-tabpanel').getAttribute('role'), 'tabpanel');
}
async function snapshot(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.locator('.cc-command-center').evaluate(root => {
    const clean = value => value.replace(/:r[\w]+:/g, ':react-id:');
    const properties = ['display', 'position', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'borderColor', 'padding', 'margin', 'gap', 'gridTemplateColumns'];
    return { html: clean(root.outerHTML), text: root.innerText, geometry: [...root.querySelectorAll('*')].filter(node => { const closed = node.closest('details:not([open])'); return node.getClientRects().length && (!closed || closed === node || closed.querySelector(':scope > summary')?.contains(node)); }).map(node => { const bounds = node.getBoundingClientRect(), computed = getComputedStyle(node); return { tag: node.tagName, className: node.getAttribute('class'), rect: ['x', 'y', 'width', 'height'].map(key => Math.round(bounds[key] * 100) / 100), styles: properties.map(key => computed[key]) }; }) };
  });
}
async function open(mode, section, width, dark) {
  const context = await browser.newContext({ viewport: { width, height: 940 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(RECEIVABLES_CHECK_TIME));
  page.on('pageerror', error => errors.push(error.message));
  if (dark) await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('dark')));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: documents[mode] });
    if (url.pathname === '/fixture/dashboard/executive/') { const report = reportFixture(); report.portfolio_performance.revenue_dashboard = workbook; return route.fulfill({ json: report }); }
    if (url.pathname === '/fixture/dashboard/executive/portfolio-workbook/revenue/') return route.fulfill({ json: workbook });
    if (url.pathname === '/fixture/dashboard/executive/receivables/') return route.fulfill({ json: receivablesFixture('full', { currency: url.searchParams.get('currency') || 'AED' }).data });
    if (url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/assets/')) return route.fulfill({ status: 204, body: '' });
    return route.abort();
  });
  await page.goto(`http://executive-isolation.test/?route=${encodeURIComponent(`/executive${section === 'overview' ? '' : '?tab=financial'}`)}`);
  await ready(page, section);
  return { context, page };
}
try {
  for (const { width, dark } of [{ width: 1440, dark: false }, { width: 390, dark: false }, { width: 1440, dark: true }]) for (const section of ['overview', 'financial']) {
    const name = `${section}-${dark ? 'dark' : width}`;
    const baseline = await open('baseline', section, width, dark), current = await open('current', section, width, dark);
    await assertOriginal(current.page, section);
    const original = await snapshot(baseline.page), restored = await snapshot(current.page);
    await writeFile(path.join(artifacts, `${name}-comparison.json`), JSON.stringify({ baseline: original, current: restored }));
    assert.equal(restored.text, original.text, `${name}: all original page text is preserved`);
    assert.equal(restored.html, original.html, `${name}: original page DOM is preserved`);
    assert.equal(hash(JSON.stringify(restored.geometry)), hash(JSON.stringify(original.geometry)), `${name}: original computed styles and geometry are preserved (see comparison artifact)`);
    await current.page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true, animations: 'disabled' });
    await tabs(current.page).getByRole('tab', { name: 'Project portfolio', exact: true }).click();
    await current.page.getByTestId('portfolio-revenue-dashboard').waitFor();
    assert.equal(await current.page.getByRole('heading', { name: 'Project Portfolio', exact: true }).count(), 1);
    assert.deepEqual(await tabs(current.page).getByRole('tab').allTextContents(), parentLabels);
    assert.equal(await current.page.getByRole('tablist').count(), 1, 'Portfolio retains only main Executive navigation');
    assert.equal(await current.page.locator('#executive-revenue-navigation,.prv-view-tabs,.rv-header-secondary').count(), 0, 'Portfolio has no inner tabs or empty navigation spacer');
    assert.equal(await current.page.locator('[id="executive-tab-portfolio"]').count(), 1, 'Parent portfolio tab ID is unique');
    await tabs(current.page).getByRole('tab', { name: section === 'overview' ? 'Overview' : 'Financial performance', exact: true }).click();
    await ready(current.page, section);
    await assertOriginal(current.page, section);
    const returned = await snapshot(current.page);
    await writeFile(path.join(artifacts, `${name}-returned.json`), JSON.stringify({ baseline: original, returned }));
    assert.equal(returned.text, original.text, `${name}: returning from Portfolio preserves source content`);
    assert.equal(hash(JSON.stringify(returned.geometry)), hash(JSON.stringify(original.geometry)), `${name}: returning from Portfolio leaves no layout changes`);
    results.push({ view: name, baseline: revision, text: 'identical', dom: 'identical', computed_styles_and_geometry: 'identical', return_from_portfolio: 'passed', content_sha256: hash(original.text) });
    await baseline.context.close(); await current.context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(artifacts, 'result.json'), JSON.stringify({ revision, results, protected_files: protectedFiles, errors }, null, 2));
  console.log(`PASS: ${results.length} Overview/Financial views exactly match Git HEAD DOM, text, computed styles and geometry with workbook enabled; direct routes and returning from Project Portfolio pass. Artifacts: ${artifacts}`);
} finally { await browser.close(); }
