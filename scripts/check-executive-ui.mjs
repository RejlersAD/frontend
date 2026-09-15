import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inlineLocalCssImports, checkArtifacts, historicalGuardsEnabled, loadSnapshot, snapshotSources, launchBrowser, sidebarWidth } from './ui-check-support.mjs';
import AxeBuilder from '@axe-core/playwright';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { reportFixture } from './check-executive-fixtures.mjs';
import { runFinancialPerformanceChecks } from './check-financial-performance.mjs';
import { runProjectPortfolioChecks } from './check-project-portfolio.mjs';
import { runCommercialPipelineChecks } from './check-commercial-pipeline.mjs';
import { runWorkforcePerformanceChecks } from './check-workforce-performance.mjs';
import { runRiskComplianceChecks } from './check-risk-compliance.mjs';

// Real executive page, Layout, Header and Sidebar; synthetic API responses only.
// All requests are intercepted, so this script cannot write to a live service.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const visualsOnly = process.argv.includes('--visuals-only');
const overviewPolish = process.argv.includes('--overview-polish') || process.argv.includes('--overview-polish-baseline');
const tabsPolishBaseline = process.argv.includes('--tabs-polish-baseline');
const tabsPolish = tabsPolishBaseline || process.argv.includes('--tabs-polish') || process.argv.includes('--tabs-polish-visuals');
const artifacts = checkArtifacts(frontend, tabsPolish ? 'executive-tabs-polish' : overviewPolish ? 'executive-overview-polish' : 'executive-reference');
const origin = 'http://executive-check.test';
const guardedFiles = [
  'src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css',
  'src/config/layout.config.js', 'src/config/navigationLabels.config.js',
  'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js',
];
await mkdir(artifacts, { recursive: true });
const baselinePath = path.join(artifacts, 'sidebar-baseline-sha256.json');
const snapshotGuards = historicalGuardsEnabled(overviewPolish, tabsPolish);
console.log(`Historical snapshot guards: ${snapshotGuards ? 'enabled' : 'not requested'}; mode: ${visualsOnly ? 'current responsive visuals' : 'functional checks'}`);
const sidebarBaseline = snapshotGuards ? await loadSnapshot(frontend, baselinePath) : await snapshotSources(frontend, guardedFiles);
async function assertSidebarUnchanged() {
  for (const row of sidebarBaseline) {
    const actual = createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase();
    assert.equal(actual, row.Hash, `Sidebar guard changed: ${row.Path}`);
  }
}
await assertSidebarUnchanged();
async function assertOverviewPolishProtected() {
  if (!overviewPolish) return;
  const rows = await loadSnapshot(frontend, path.join(artifacts, 'protected-baseline-sha256.json'));
  assert.equal(rows.length, 30, 'Overview polish protects shell, UserDetail and five completed tabs');
  for (const row of rows) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Overview polish changed protected file: ${row.Path}`);
}
await assertOverviewPolishProtected();
const source = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';
import ExecutiveDashboard from './src/pages/Executive/ExecutiveDashboard.jsx';

const user = {id:'executive-check',first_name:'Executive',last_name:'Review',email:'executive@example.test',is_superuser:true,roles:[{code:'super_admin',name:'Super Administrator'}]};
const state = {auth:{user,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{modules:[]}}};
const store = {getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
const initialRoute = new URLSearchParams(window.location.search).get('route') || '/executive';
function RouteObserver() {
  const location = useLocation();
  window.executiveNavigate = useNavigate();
  window.executiveRoute = location.pathname + location.search;
  return null;
}
function Destination() {return <h1 className="p-6 text-xl">Drilldown destination</h1>;}
window.print = () => {
  window.executivePrintCalls = (window.executivePrintCalls || 0) + 1;
  window.executivePrintSnapshot = {
    actions:[...document.querySelectorAll('[data-testid^="executive-action-"]')].map(node=>node.dataset.testid),
    financialActions:[...document.querySelectorAll('[data-testid^="financial-action-"]')].map(node=>node.dataset.testid),
    portfolioProjects:[...document.querySelectorAll('[data-testid^="portfolio-project-"]')].map(node=>node.dataset.testid),
    portfolioExceptions:[...document.querySelectorAll('[data-testid^="portfolio-action-"]')].map(node=>node.dataset.testid),
    portfolioText:document.querySelector('[data-testid="project-portfolio"]')?.textContent,
    commercialOpportunities:[...document.querySelectorAll('[data-testid^="commercial-opportunity-"]')].map(node=>node.dataset.testid),
    commercialActions:[...document.querySelectorAll('[data-testid^="commercial-action-"]')].map(node=>node.dataset.testid),
    commercialBids:[...document.querySelectorAll('[data-testid^="commercial-bid-"]')].filter(node=>node.tagName==='TR').map(node=>node.dataset.testid),
    commercialText:document.querySelector('[data-testid="commercial-pipeline"]')?.textContent,
    commercialCurrency:document.querySelector('select[aria-label="Commercial reporting currency"]')?.value,
    workforceCapacity:[...document.querySelectorAll('[data-testid="workforce-capacity-plan"] tbody tr')].map(node=>node.querySelector('th')?.textContent),
    workforceActions:[...document.querySelectorAll('[data-testid="workforce-decisions"] tbody tr')].map(node=>node.querySelector('th')?.textContent),
    workforceDistribution:[...document.querySelectorAll('[data-testid="workforce-distribution-row"]')].map(node=>node.textContent),
    workforceText:document.querySelector('[data-testid="workforce-performance"]')?.textContent,
    riskRows:[...document.querySelectorAll('[data-testid="risk-register"] tbody tr')].map(node=>node.textContent),
    riskActions:[...document.querySelectorAll('[data-testid="risk-actions"] tbody tr')].map(node=>node.textContent),
    riskCalendar:[...document.querySelectorAll('[data-testid="risk-compliance-calendar"] tbody tr')].map(node=>node.textContent),
    riskText:document.querySelector('[data-testid="risk-compliance"]')?.textContent,
    title:document.querySelector('main h1')?.textContent,
    notesOpen:document.querySelector('.cc-report-notes')?.open,
    alertLimit:document.querySelector('.cc-cap-note')?.textContent,
  };
};
createRoot(document.getElementById('root')).render(
  <Provider store={store}><MemoryRouter initialEntries={[initialRoute]}>
    <RouteObserver/>
    <Routes><Route element={<Layout/>}>
      <Route path="/executive" element={<ExecutiveDashboard/>}/>
      <Route path="*" element={<Destination/>}/>
    </Route></Routes>
  </MemoryRouter></Provider>
);
`;

const apiFixture = `
export default {get: async (url, config = {}) => {
  const response = await fetch('/fixture-api' + url, {signal:config.signal});
  const data = await response.json();
  if (!response.ok) {const error = new Error(data.detail || 'Fixture request failed');error.response={status:response.status,data};throw error;}
  return {data};
}};
`;
const serviceButtons = `import React from 'react';import {BellIcon,ArrowDownTrayIcon} from '@heroicons/react/24/outline';
export function NotificationBell(){return <button aria-label="Notifications" className="inline-flex h-9 w-9 items-center justify-center rounded-lg"><BellIcon className="h-5 w-5"/></button>}
export default function PWAHeaderInstall(){return <button aria-label="Install RADAI on this device" className="inline-flex h-9 w-9 items-center justify-center rounded-lg"><ArrowDownTrayIcon className="h-5 w-5"/></button>}`;
const stubs = [
  [/services[\\/]api\.service\.js$/, apiFixture],
  [/store[\\/]slices[\\/]authSlice\.js$/, 'export const updateUser=()=>({type:"fixture"});export const logout=()=>({type:"fixture-logout"});'],
  [/store[\\/]slices[\\/]themeSlice\.js$/, 'export const toggleTheme=()=>({type:"fixture-theme"});'],
  [/components[\\/]Layout[\\/]Footer\.jsx$/, 'export default function Footer(){return null;}'],
  [/components[\\/]ProcurementApprovalReminder\.jsx$/, 'import React from "react";export default function Reminder(){return <aside data-testid="fixture-procurement-reminder">Fixture reminder</aside>;}'],
  [/components[\\/]notifications[\\/]NotificationBell\.jsx$/, serviceButtons.replace('export function NotificationBell', 'export default function NotificationBell').replace('export default function PWAHeaderInstall', 'export function PWAHeaderInstall')],
  [/components[\\/]PWAHeaderInstall\.jsx$/, serviceButtons],
  [/hooks[\\/]useAuthenticatedPhoto\.js$/, 'export default function useAuthenticatedPhoto(){return null;}'],
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Executive overview"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];

const buildBundle = baselineMain => build({
  stdin: { contents: source, loader: 'jsx', resolveDir: frontend },
  bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' },
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'executive-fixture', setup(builder) {
    if (baselineMain) builder.onLoad({ filter: /pages[\\/]Executive[\\/]ExecutiveMainPanels\.jsx$/ }, () => ({ contents: baselineMain, loader: 'jsx' }));
    for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' }));
  } }],
});
const bundle = tabsPolishBaseline ? { outputFiles: [{ text: '' }] } : await buildBundle();
const beforeCardsMain = overviewPolish ? await readFile(path.join(artifacts, 'ExecutiveMainPanels-before-cards.jsx'), 'utf8') : null;
const beforeCardsCss = overviewPolish ? await readFile(path.join(artifacts, 'ExecutiveOverview-before-cards.css'), 'utf8') : null;
const beforeCardsBundle = beforeCardsMain ? await buildBundle(beforeCardsMain) : bundle;
const executiveFiles = await readdir(path.join(frontend, 'src/pages/Executive'));
const components = await Promise.all([
  'src/components/Layout/Sidebar.jsx', 'src/components/Layout/Layout.jsx',
  'src/components/Layout/Header.jsx', 'src/components/Layout/GlobalSearch.jsx',
  'src/components/help/ContextualHelpButton.jsx', 'src/config/layout.config.js',
  ...executiveFiles.filter(file => /\.(jsx?|mjs)$/.test(file)).map(file => `src/pages/Executive/${file}`),
].map(file => readFile(path.join(frontend, file), 'utf8')));
const css = await postcss([tailwind({
  ...tailwindConfig,
  content: [{ raw: [source, serviceButtons, ...components].join('\n'), extension: 'jsx' }],
})]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const componentCssFiles = [
  'src/components/Layout/Sidebar.css',
  ...executiveFiles.filter(file => file.endsWith('.css')).map(file => `src/pages/Executive/${file}`),
];
const componentCss = await Promise.all(componentCssFiles.map(file => readFile(path.join(frontend, file), 'utf8')));
const markup = (styles, script = bundle.outputFiles[0].text) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Executive overview checks</title><style>${css.css}\n${styles.join('\n')}</style></head><body><div id="root"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`;
const html = tabsPolishBaseline ? await readFile(path.join(artifacts, 'baseline.html'), 'utf8') : markup(componentCss);
const undecoratedHtml = tabsPolish && !tabsPolishBaseline ? await readFile(path.join(artifacts, 'baseline.html'), 'utf8') : markup(componentCss.map((text, index) => componentCssFiles[index].endsWith('/ExecutiveOverview.css') ? beforeCardsCss || '' : text), beforeCardsBundle.outputFiles[0].text);
await mkdir(artifacts, { recursive: true });
const expectedSidebarWidth = await sidebarWidth(frontend);
const browser = await launchBrowser();
const errors = [];
const requests = [];
const unexpectedRequests = [];
const checks = [];

async function newPage({ fixture = 'full', status = 200, loading = false, width = 1672, dark = false, decoration = true, route: initialRoute = '/executive' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  if (dark) await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('dark')));
  const control = { fixture, status, loading, pending: [] };
  const fulfillReport = route => route.fulfill({
    status: control.status, contentType: 'application/json',
    body: JSON.stringify(control.status === 200 ? reportFixture(control.fixture) : { detail: control.status === 403 ? 'Executive overview access is restricted.' : 'Fixture source unavailable.' }),
  });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: decoration ? html : undecoratedHtml });
    requests.push({ url: request.url(), method: request.method() });
    if (url.origin === origin && url.pathname === '/fixture-api/dashboard/executive/') {
      if (control.loading) { control.pending.push(route); return; }
      return fulfillReport(route);
    }
    if (url.pathname.endsWith('/rbac/users/me/')) return route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ user: { id: 'executive-check', is_superuser: true }, roles: [{ code: 'super_admin', name: 'Super Administrator' }], modules: [] }),
    });
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const resolved = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (resolved.startsWith(path.resolve(frontend, 'public') + path.sep)) {
        try {
          const asset = await readFile(resolved);
          return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : url.pathname.endsWith('.woff2') ? 'font/woff2' : 'image/png', body: asset });
        } catch { /* Missing optional artwork is recorded below. */ }
      }
    }
    unexpectedRequests.push(request.url());
    return route.abort();
  });
  control.release = async () => {
    control.loading = false;
    await Promise.all(control.pending.splice(0).map(fulfillReport));
  };
  await page.goto(origin + '?route=' + encodeURIComponent(initialRoute));
  await page.locator('#application-sidebar').waitFor({ state: 'attached' });
  return { page, control };
}

async function ready(page) {
  await page.getByRole('heading', { name: 'Executive Command Center', exact: true }).waitFor();
  await page.getByTestId('executive-kpi-revenue').waitFor();
}

async function screenshot(page, name) {
  if (overviewPolish || tabsPolish) {
    for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  } else await page.locator('main.main-content').evaluate(main => main.scrollTo(0, 0));
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: name === 'board-print' });
}

async function compareOverviewPolishTabs() {
  const comparisons = {};
  for (const [name, testId] of [['financial', 'financial-outcomes'], ['portfolio', 'portfolio-outcomes'], ['commercial', 'commercial-outcomes'], ['workforce', 'workforce-outcomes'], ['risk', 'risk-outcomes']]) {
    const { page } = await newPage({ route: `/executive?tab=${name}` });
    await page.getByTestId(testId).waitFor(); await assertGeometry(page, 1672);
    for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(artifacts, `${name}-after.png`) });
    const images = await Promise.all(['before', 'after'].map(suffix => readFile(path.join(artifacts, `${name}-${suffix}.png`))));
    comparisons[name] = await page.evaluate(async sources => {
      const decoded = await Promise.all(sources.map(async source => { const image = new Image(); image.src = source; await image.decode(); return image; }));
      if (decoded[0].width !== decoded[1].width || decoded[0].height !== decoded[1].height) return { dimensionsMatch: false };
      const canvas = document.createElement('canvas'); canvas.width = decoded[0].width; canvas.height = decoded[0].height;
      const context = canvas.getContext('2d');
      const pixels = decoded.map(image => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; });
      let changedPixels = 0;
      for (let index = 0; index < pixels[0].length; index += 4) if ([0, 1, 2, 3].some(channel => Math.abs(pixels[0][index + channel] - pixels[1][index + channel]) > 3)) changedPixels++;
      return { dimensionsMatch: true, width: canvas.width, height: canvas.height, changedPixels };
    }, images.map(bytes => `data:image/png;base64,${bytes.toString('base64')}`));
    await writeFile(path.join(artifacts, `${name}-comparison.json`), JSON.stringify(comparisons[name], null, 2));
    assert.equal(comparisons[name].dimensionsMatch, true);
    assert.equal(comparisons[name].changedPixels, 0, `${name} pixels remain unchanged by Overview decoration`);
    await page.context().close();
  }
  await assertOverviewPolishProtected();
  await writeFile(path.join(artifacts, 'protected-comparisons.json'), JSON.stringify({ protectedHashesUnchanged: true, protectedFileCount: 30, comparisons }, null, 2));
}

async function assertOverviewProtectedPanelLayout() {
  const before = await loadSnapshot(frontend, path.join(artifacts, 'overview-before-sha256.json'));
  for (const row of before.filter(row => /ExecutiveSidePanels\.jsx$/.test(row.Path))) {
    assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `KPI card polish preserves Overview side-panel markup: ${row.Path}`);
  }
  const currentMain = await readFile(path.join(frontend, 'src/pages/Executive/ExecutiveMainPanels.jsx'), 'utf8');
  const unchangedSections = text => text.slice(text.indexOf('export function DecisionsRequired')).replaceAll('\r\n', '\n');
  assert.equal(unchangedSections(currentMain), unchangedSections(beforeCardsMain), 'All main-panel functions outside OutcomeCards retain their original source');
  const beforeState = await newPage({ decoration: false });
  const afterState = await newPage();
  await ready(beforeState.page); await ready(afterState.page);
  const snapshot = async page => {
    for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.evaluate(() => document.fonts.ready);
    return page.locator('.cc-command-center').evaluate(node => [...node.querySelectorAll('.cc-panel, .cc-panel *')].filter(item => item instanceof HTMLElement).map(item => {
      const rect = item.getBoundingClientRect(); const anchor = item.closest('.cc-panel').getBoundingClientRect(); const style = getComputedStyle(item);
      const hasBox = rect.width !== 0 || rect.height !== 0;
      return { tag: item.tagName, className: item.className, x: hasBox ? Math.round((rect.x - anchor.x) * 100) / 100 : 0, y: hasBox ? Math.round((rect.y - anchor.y) * 100) / 100 : 0,
        width: Math.round(rect.width * 100) / 100, height: Math.round(rect.height * 100) / 100,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing, padding: style.padding, margin: style.margin, borderWidth: style.borderWidth, borderRadius: style.borderRadius };
    }));
  };
  const compare = async (current, previous, label) => {
    assert.equal(current.length, previous.length, `${label}: protected element count`);
    const differences = current.flatMap((row, index) => Object.keys(row).filter(key => row[key] !== previous[index][key]).map(key => ({ index, tag: row.tag, className: row.className, property: key, before: previous[index][key], after: row[key] })));
    if (differences.length) await writeFile(path.join(artifacts, 'panel-geometry-differences.json'), JSON.stringify({ label, differences }, null, 2));
    assert.equal(differences.length, 0, `${label}: ${JSON.stringify(differences.slice(0, 12))}`);
  };
  const comparisons = [];
  for (const [width, dark] of [[1672, false], [1440, false], [1024, false], [390, false], [1672, true]]) {
    for (const state of [beforeState, afterState]) {
      await state.page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
      await assertGeometry(state.page, width);
    }
    const previous = await snapshot(beforeState.page); const current = await snapshot(afterState.page);
    await compare(current, previous, `KPI card changes preserve other panels' geometry, table density and font metrics at ${width}px ${dark ? 'dark' : 'light'}`);
    comparisons.push({ width, mode: dark ? 'dark' : 'light', elementsChecked: current.length, exactGeometryAndTypography: true });
  }
  for (const state of [beforeState, afterState]) {
    await state.page.evaluate(() => { document.documentElement.classList.remove('dark'); window.dispatchEvent(new Event('beforeprint')); });
    await state.page.emulateMedia({ media: 'print' });
  }
  const printBefore = await snapshot(beforeState.page); const printAfter = await snapshot(afterState.page);
  await compare(printAfter, printBefore, 'KPI card changes preserve printed table and panel geometry and typography');
  comparisons.push({ width: 1672, mode: 'print', elementsChecked: printAfter.length, exactGeometryAndTypography: true });
  await beforeState.page.context().close(); await afterState.page.context().close();
  await writeFile(path.join(artifacts, 'protected-panel-geometry.json'), JSON.stringify({ sidePanelHashUnchanged: true, mainFunctionsOutsideOutcomeCardsUnchanged: true, cardLayoutChangesAllowed: true, comparisons }, null, 2));
}

async function assertGeometry(page, width) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 941 });
  await page.waitForTimeout(350);
  const geometry = await page.locator('main.main-content').evaluate(main => {
    const box = main.getBoundingClientRect();
    const content = document.getElementById('application-content').getBoundingClientRect();
    const sidebar = document.getElementById('application-sidebar').getBoundingClientRect();
    return {
      documentFits: document.documentElement.scrollWidth <= innerWidth,
      mainFits: main.scrollWidth <= main.clientWidth + 1,
      mainX: box.x, contentX: content.x, sidebarWidth: sidebar.width,
    };
  });
  assert.equal(geometry.documentFits, true, `No document overflow at ${width}px`);
  assert.equal(geometry.mainFits, true, `No executive page overflow at ${width}px`);
  assert.equal(Math.round(geometry.contentX), width < 1024 ? 0 : expectedSidebarWidth);
  if (width >= 1024) assert.equal(Math.round(geometry.sidebarWidth), expectedSidebarWidth);
}

async function backToOverview(page) {
  await page.evaluate(() => window.executiveNavigate('/executive'));
  await ready(page);
}

const polishedTabs = ['financial', 'portfolio', 'commercial', 'workforce', 'risk'];
async function panelGeometry(page) {
  for (const selector of ['main.main-content', '.cc-command-center']) await page.locator(selector).evaluate(node => node.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await page.evaluate(() => document.fonts.ready);
  return page.locator('.cc-command-center').evaluate(node => {
    const selector = '.fp-panel, .pp-panel, .cp-panel, .wf-panel, .rc-panel';
    return [...node.querySelectorAll(selector)].flatMap(panel => [panel, ...panel.querySelectorAll('*')]).filter(item => item instanceof HTMLElement).map(item => {
      const rect = item.getBoundingClientRect(); const anchor = item.closest(selector).getBoundingClientRect(); const style = getComputedStyle(item);
      const hasBox = rect.width !== 0 || rect.height !== 0;
      return { tag: item.tagName, className: item.className, x: hasBox ? Math.round((rect.x - anchor.x) * 100) / 100 : 0, y: hasBox ? Math.round((rect.y - anchor.y) * 100) / 100 : 0,
        width: Math.round(rect.width * 100) / 100, height: Math.round(rect.height * 100) / 100,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing, padding: style.padding, margin: style.margin, borderWidth: style.borderWidth, borderRadius: style.borderRadius };
    });
  });
}

async function captureTabsPolishBaseline() {
  for (const name of ['overview', ...polishedTabs]) {
    try { await readFile(path.join(artifacts, `${name}-before-geometry.json`)); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const route = name === 'overview' ? '/executive' : `/executive?tab=${name}`;
    const { page } = await newPage({ route });
    await page.getByTestId(`${name === 'overview' ? 'executive' : name}-outcomes`).waitFor();
    const measurements = [];
    for (const [width, dark] of [[1672, false], [1440, false], [1024, false], [390, false], [1672, true]]) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
      await assertGeometry(page, width);
      const elements = await panelGeometry(page);
      measurements.push({ width, mode: dark ? 'dark' : 'light', elements });
      await screenshot(page, `${name}-before-${dark ? 'dark' : width}`);
    }
    await page.evaluate(() => { document.documentElement.classList.remove('dark'); window.dispatchEvent(new Event('beforeprint')); });
    await page.emulateMedia({ media: 'print' });
    measurements.push({ width: 1672, mode: 'print', elements: await panelGeometry(page) });
    await writeFile(path.join(artifacts, `${name}-before-geometry.json`), JSON.stringify(measurements, null, 2), { flag: 'wx' });
    await page.context().close();
  }
  console.log('PASS: Immutable source/HTML baseline plus six responsive before views and panel geometry captured.');
}

async function assertTabsPolishProtected() {
  const rows = await loadSnapshot(frontend, path.join(artifacts, 'source-before-sha256.json'));
  const outcomeFiles = ['FinancialPerformance.jsx', 'ProjectPortfolio.jsx', 'CommercialPipeline.jsx', 'WorkforcePerformance.jsx', 'RiskCompliance.jsx'];
  const allowedFiles = [...outcomeFiles, 'ExecutiveDashboard.jsx', 'ExecutiveOverview.css'];
  let protectedCount = 0;
  for (const row of rows) {
    const original = await readFile(path.join(artifacts, 'source-before', row.RelativePath));
    assert.equal(createHash('sha256').update(original).digest('hex').toUpperCase(), row.Hash, `Immutable baseline is intact: ${row.RelativePath}`);
    if (allowedFiles.includes(path.basename(row.RelativePath))) continue;
    assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Tab polish changed protected source: ${row.RelativePath}`);
    protectedCount++;
  }
  for (const file of outcomeFiles) {
    const sources = await Promise.all([path.join(artifacts, 'source-before/src/pages/Executive', file), path.join(frontend, 'src/pages/Executive', file)].map(filePath => readFile(filePath, 'utf8')));
    const remainder = text => {
      const start = text.search(/function \w+Outcomes\(/);
      assert.ok(start >= 0, `Outcome function located: ${file}`);
      return text.slice(text.indexOf('\nfunction ', start + 1)).replaceAll('\r\n', '\n');
    };
    assert.equal(remainder(sources[1]), remainder(sources[0]), `${file}: all functions after outcomes remain unchanged`);
  }
  const originalColors = await readFile(path.join(artifacts, 'source-before/src/pages/Executive/ExecutiveOverview.css'), 'utf8');
  const currentColors = await readFile(path.join(frontend, 'src/pages/Executive/ExecutiveOverview.css'), 'utf8');
  const normalizedColors = currentColors.replaceAll('.cc-radai-page', '.cc-overview-page').replaceAll('\r\n', '\n')
    .replace(/:is\((\.cc-overview-kpi--\w+), \.cc-reference-kpi--\w+\)/g, '$1')
    .replace(/^.*\.cc-reference-kpi--amber.*\n/gm, '');
  const withoutComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.equal(withoutComments(normalizedColors), withoutComments(originalColors.replaceAll('\r\n', '\n')), 'Overview stylesheet only widens the scope and reuses existing palette values for new cards');
  await writeFile(path.join(artifacts, 'protected-source-checks.json'), JSON.stringify({ protectedCount, immutableSourceCount: rows.length, protectedHashesUnchanged: true, allFiveFunctionsAfterOutcomesUnchanged: true, overviewColorScopeOnly: true }, null, 2));
}

async function pixelDifference(page, images, region) {
  return page.evaluate(async ({ sources, region }) => {
    const decoded = await Promise.all(sources.map(async source => { const image = new Image(); image.src = source; await image.decode(); return image; }));
    if (decoded[0].width !== decoded[1].width || decoded[0].height !== decoded[1].height) return { dimensionsMatch: false };
    const canvas = document.createElement('canvas'); canvas.width = decoded[0].width; canvas.height = decoded[0].height;
    const context = canvas.getContext('2d');
    const pixels = decoded.map(image => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; });
    let changedPixels = 0;
    for (let index = 0; index < pixels[0].length; index += 4) {
      const x = (index / 4) % canvas.width; const y = Math.floor(index / 4 / canvas.width);
      if (region && (x < region.x || y < region.y || x >= region.x + region.width || y >= region.y + region.height)) continue;
      if ([0, 1, 2, 3].some(channel => Math.abs(pixels[0][index + channel] - pixels[1][index + channel]) > 3)) changedPixels++;
    }
    return { dimensionsMatch: true, width: canvas.width, height: canvas.height, comparedRegion: region || 'full', changedPixels };
  }, { sources: images.map(bytes => `data:image/png;base64,${bytes.toString('base64')}`), region });
}

async function verifyTabsPolishVisuals() {
  await assertTabsPolishProtected();
  const comparisons = [];
  const cardMeasurements = [];
  for (const name of ['portfolio', 'risk', 'financial', 'commercial', 'workforce', 'overview']) {
    const route = name === 'overview' ? '/executive' : `/executive?tab=${name}`;
    const { page } = await newPage({ route });
    await page.getByTestId(`${name === 'overview' ? 'executive' : name}-outcomes`).waitFor();
    const baseline = JSON.parse(await readFile(path.join(artifacts, `${name}-before-geometry.json`), 'utf8'));
    if (name === 'risk') {
      const original = await newPage({ route, width: 1201, decoration: false });
      await original.page.getByTestId('risk-outcomes').waitFor();
      await assertGeometry(original.page, 1201);
      baseline.splice(2, 0, { width: 1201, mode: 'light', elements: await panelGeometry(original.page) });
      await original.page.screenshot({ path: path.join(artifacts, 'risk-before-1201.png') });
      await original.page.context().close();
    }
    for (const previous of baseline) {
      const { width, mode } = previous;
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), mode === 'dark');
      await assertGeometry(page, width);
      if (mode === 'print') {
        await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
        await page.emulateMedia({ media: 'print' });
      }
      const current = await panelGeometry(page);
      if (name !== 'overview' && mode !== 'print') {
        const cards = await page.locator('.cc-reference-kpi').evaluateAll(nodes => nodes.map(card => {
          const cardBox = card.getBoundingClientRect(); const title = card.querySelector('h2'); const titleBox = title.getBoundingClientRect();
          const button = card.querySelector('.cc-info-button'); const buttonBox = button.getBoundingClientRect();
          return { label: title.textContent, width: cardBox.width, bodyWidth: card.querySelector('.cc-reference-kpi-body').getBoundingClientRect().width,
            titleWidth: titleBox.width, titleHeight: titleBox.height, headingHeight: card.querySelector('.cc-reference-kpi-heading').getBoundingClientRect().height,
            buttonWidth: buttonBox.width, buttonOverflowRight: buttonBox.right - cardBox.right, buttonOverflowLeft: cardBox.left - buttonBox.left,
            titleButtonOverlap: Math.min(titleBox.bottom, buttonBox.bottom) > Math.max(titleBox.top, buttonBox.top) ? Math.min(titleBox.right, buttonBox.right) - Math.max(titleBox.left, buttonBox.left) : 0,
            iconDecorative: card.querySelector('.cc-reference-kpi-icon').getAttribute('aria-hidden') === 'true' };
        }));
        assert.equal(cards.length, 5, `${name}: five reference KPI cards`);
        cardMeasurements.push({ name, width, mode, cards });
        await writeFile(path.join(artifacts, 'card-containment-checks.json'), JSON.stringify(cardMeasurements, null, 2));
        for (const card of cards) {
          assert.ok(card.buttonOverflowRight <= -1 && card.buttonOverflowLeft <= -1, `${name} ${width} ${mode}: About ${card.label} stays inside its card: ${JSON.stringify(card)}`);
          assert.ok(card.titleButtonOverlap <= 0.1, `${name} ${width} ${mode}: title and About control do not overlap`);
          assert.equal(card.iconDecorative, true);
        }
      }
      assert.equal(current.length, previous.elements.length, `${name} ${width} ${mode}: protected panel element count`);
      const differences = current.flatMap((row, index) => Object.keys(row).filter(key => row[key] !== previous.elements[index][key]).map(key => ({ index, tag: row.tag, className: row.className, property: key, before: previous.elements[index][key], after: row[key] })));
      if (differences.length) await writeFile(path.join(artifacts, `${name}-geometry-differences.json`), JSON.stringify({ width, mode, differences }, null, 2));
      assert.equal(differences.length, 0, `${name} ${width} ${mode}: panel/table geometry or typography changed: ${JSON.stringify(differences.slice(0, 8))}`);
      const capturePath = path.join(artifacts, `${name}-after-${mode === 'light' ? width : mode}.png`);
      const image = await page.screenshot({ path: capturePath, fullPage: mode === 'print' });
      const result = { name, width, mode, elementsChecked: current.length, exactPanelGeometryAndTypography: true };
      if (name === 'overview' && mode !== 'print') {
        result.pixelComparison = await pixelDifference(page, [await readFile(path.join(artifacts, `overview-before-${mode === 'light' ? width : mode}.png`)), image], await page.locator('main.main-content').boundingBox());
        assert.equal(result.pixelComparison.dimensionsMatch, true);
        assert.equal(result.pixelComparison.changedPixels, 0, `Overview remains pixel-identical at ${width} ${mode}`);
      }
      comparisons.push(result);
      if (name !== 'overview' && width === 1672 && mode !== 'print') {
        const accessibility = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        await writeFile(path.join(artifacts, `${name}-accessibility-${mode}.json`), JSON.stringify(accessibility.violations, null, 2));
        assert.deepEqual(accessibility.violations, [], `${name} ${mode}: final card and panel accessibility`);
      }
      console.log(`PASS: ${name} ${width}px ${mode} protected panel geometry; screenshot saved.`);
    }
    await page.context().close();
  }
  await writeFile(path.join(artifacts, 'visual-geometry-checks.json'), JSON.stringify(comparisons, null, 2));
}

async function runTabsPolishChecks() {
  await verifyTabsPolishVisuals();
  if (process.argv.includes('--tabs-polish-visuals')) return;
  const suites = [runFinancialPerformanceChecks, runProjectPortfolioChecks, runCommercialPipelineChecks, runWorkforcePerformanceChecks, runRiskComplianceChecks];
  for (const [index, run] of suites.entries()) {
    await run({ frontend, newPage, assertGeometry, reportFixture, verification: { artifacts: path.join(artifacts, polishedTabs[index]), assertProtected: assertTabsPolishProtected } });
    await Promise.all(browser.contexts().map(context => context.close()));
  }
  await assertTabsPolishProtected();
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ suites: polishedTabs, allFiveFunctionalSuitesPassed: true, protectedSourcesAndPanelGeometry: true, overviewPixelIdentical: true, runtimeErrors: errors, requestMethods: [...new Set(requests.map(row => row.method))], unexpectedRequests }, null, 2));
  console.log('PASS: All five polished tab functional/source/filter/dialog/print suites, protected sources, exact panel geometry and responsive Overview pixel comparisons.');
}

const suiteOptions = name => ({ frontend, newPage, assertGeometry, reportFixture, ...(!snapshotGuards ? { verification: { artifacts: path.join(artifacts, name), assertProtected: assertSidebarUnchanged, comparisonMode: 'historical_snapshots_not_requested' } } : {}) });

async function runCurrentVisualChecks() {
  const requestedTabs = process.argv.find(arg => arg.startsWith('--tabs='))?.slice(7).split(',');
  const tabs = ['overview', ...polishedTabs].filter(tab => !requestedTabs || requestedTabs.includes(tab));
  assert.ok(tabs.length, 'Choose at least one supported Executive tab');
  const results = [];
  for (const tab of tabs) {
    for (const options of [{ width: 1672 }, { width: 1440 }, { width: 1024 }, { width: 390 }, { width: 1672, dark: true }]) {
      const { page } = await newPage({ ...options, route: tab === 'overview' ? '/executive' : `/executive?tab=${tab}` });
      try {
        await page.getByTestId(tab === 'overview' ? 'executive-outcomes' : `${tab}-outcomes`).waitFor();
        await page.evaluate(() => document.fonts.ready);
        await assertGeometry(page, options.width);
        const headers = await page.locator('.cc-command-center table thead th:visible').evaluateAll(nodes => nodes.map(node => ({
          label: node.textContent.trim(), size: getComputedStyle(node).fontSize, weight: getComputedStyle(node).fontWeight,
        })));
        assert.ok(headers.length, `${tab} renders real table headings`);
        for (const header of headers) assert.deepEqual([header.size, header.weight], ['13px', '600'], `${tab}: ${header.label}`);
        const actions = page.locator('.cc-command-center table tbody button:not([disabled]):visible, .cc-command-center table tbody a[href]:visible');
        if (await actions.count()) {
          await actions.last().focus();
          assert.equal(await actions.last().evaluate(node => node === document.activeElement), true);
          await page.evaluate(() => {
            document.activeElement?.blur();
            for (const node of document.querySelectorAll('main,main *')) { node.scrollLeft = 0; node.scrollTop = 0; }
          });
        }
        const name = `${tab}-${options.width}${options.dark ? '-dark' : ''}`;
        await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
        const scan = options.width === 1672 || options.width === 390
          ? await new AxeBuilder({ page }).include('.cc-command-center').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
          : { violations: [] };
        const violations = scan.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }));
        results.push({ name, headers, violations });
        await writeFile(path.join(artifacts, 'visual-checks.json'), JSON.stringify({ mode: 'current-source-visuals', cases: results }, null, 2));
        assert.deepEqual(violations, [], `${name} has no accessibility violations`);
        console.log(`PASS: ${name} layout, shared table typography and keyboard controls`);
      } finally { await page.context().close(); }
    }
  }
  await assertSidebarUnchanged();
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpectedRequests, []);
  assert.ok(requests.every(request => request.method === 'GET'));
  await writeFile(path.join(artifacts, 'visual-checks.json'), JSON.stringify({ mode: 'current-source-visuals', cases: results, runtimeErrors: errors, unexpectedRequests, sidebarHashesUnchanged: true }, null, 2));
}

try {
  const { page } = await newPage();
  await ready(page);
  if (visualsOnly) {
    await page.context().close();
    await runCurrentVisualChecks();
  } else if (tabsPolishBaseline) {
    await captureTabsPolishBaseline();
  } else if (tabsPolish) {
    await runTabsPolishChecks();
  } else if (process.argv.includes('--overview-polish-baseline')) {
    try {
      await readFile(path.join(artifacts, 'overview-before.png'));
      throw new Error('Overview polish baseline already exists; refusing to replace the captured before image.');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    for (const [name, route, testId] of [['overview', '/executive', 'executive-outcomes'], ['financial', '/executive?tab=financial', 'financial-outcomes'], ['portfolio', '/executive?tab=portfolio', 'portfolio-outcomes'], ['commercial', '/executive?tab=commercial', 'commercial-outcomes'], ['workforce', '/executive?tab=workforce', 'workforce-outcomes'], ['risk', '/executive?tab=risk', 'risk-outcomes']]) {
      const state = await newPage({ route });
      await state.page.getByTestId(testId).waitFor(); await assertGeometry(state.page, 1672);
      for (const selector of ['main.main-content', '.cc-command-center']) await state.page.locator(selector).evaluate(node => node.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
      await state.page.evaluate(() => document.fonts.ready);
      await state.page.screenshot({ path: path.join(artifacts, `${name}-before.png`) });
      await state.page.context().close();
    }
    console.log('PASS: Fresh Overview polish baseline screenshots captured.');
  } else if (process.argv.includes('--risk-only')) {
    await runRiskComplianceChecks(suiteOptions('risk'));
    await Promise.all(browser.contexts().map(context => context.close()));
  } else if (process.argv.includes('--workforce-only')) {
    await runWorkforcePerformanceChecks(suiteOptions('workforce'));
    await Promise.all(browser.contexts().map(context => context.close()));
  } else if (process.argv.includes('--commercial-only')) {
    await runCommercialPipelineChecks(suiteOptions('commercial'));
    await Promise.all(browser.contexts().map(context => context.close()));
  } else if (process.argv.includes('--portfolio-only')) {
    await runProjectPortfolioChecks(suiteOptions('portfolio'));
    await Promise.all(browser.contexts().map(context => context.close()));
  } else if (process.argv.includes('--financial-only')) {
    await runFinancialPerformanceChecks(suiteOptions('financial'));
    await Promise.all(browser.contexts().map(context => context.close()));
  } else if (process.argv.includes('--print-only')) {
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });
    await screenshot(page, 'board-print');
    await page.pdf({ path: path.join(artifacts, 'board-print.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
    await assertSidebarUnchanged();
    console.log('PASS: Board print artifacts use the CSS page size; all sidebar hashes unchanged.');
  } else {
  assert.equal(await page.getByTestId('fixture-procurement-reminder').count(), 0);
  assert.equal(await page.getByRole('button', { name: /^Board view$/ }).count(), 0, 'Screen keeps the existing sidebar');
  assert.equal(await page.getByTestId('executive-outcomes').locator('[data-testid^="executive-kpi-"]').count(), 4);
  for (const width of [1672, 1440, 1024, 390]) {
    await assertGeometry(page, width);
    if (overviewPolish) assert.equal(await page.locator('.cc-command-center').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true, `Polished Overview content fits at ${width}`);
    if (width === 1672) {
      const outcomes = await page.getByTestId('executive-outcomes').boundingBox();
      const risk = await page.getByTestId('executive-enterprise-risk').boundingBox();
      const decisions = await page.getByTestId('executive-decisions').boundingBox();
      const portfolio = await page.getByTestId('executive-portfolio-health').boundingBox();
      const commercial = await page.getByTestId('executive-commercial-outlook').boundingBox();
      const ratio = outcomes.width / (outcomes.width + risk.width);
      assert.ok(ratio >= .65 && ratio <= .75, 'Reference desktop columns use approximately 70% / 30%');
      assert.ok(risk.x >= outcomes.x + outcomes.width && Math.abs(risk.y - outcomes.y) <= 3, 'Enterprise risk aligns beside four outcome cards');
      assert.ok(decisions.y >= outcomes.y + outcomes.height && portfolio.y >= decisions.y + decisions.height && commercial.y >= portfolio.y + portfolio.height, 'Left column follows outcomes, decisions, portfolio, commercial order');
    }
    await screenshot(page, `overview-${width}`);
  }
  checks.push('Reference geometry at 1672x941; responsive 1440 / 1024 / 390 shell with the configured sidebar width');
  await assertGeometry(page, 1672);

  const tabs = page.getByRole('tab');
  assert.deepEqual(await tabs.allTextContents(), ['Overview', 'Financial performance', 'Project portfolio', 'Commercial pipeline', 'Workforce', 'Risk & compliance']);
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'Financial performance');
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'Risk & compliance');
  await page.keyboard.press('Home');
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'Overview');
  for (const [name, target] of [
    ['Financial performance', 'financial-outcomes'], ['Project portfolio', 'portfolio-outcomes'],
    ['Commercial pipeline', 'commercial-outcomes'], ['Workforce', 'workforce-outcomes'],
    ['Risk & compliance', 'risk-outcomes'],
  ]) {
    await page.getByRole('tab', { name, exact: true }).click();
    await page.getByTestId(target).waitFor();
    assert.equal(await page.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#application-sidebar').isVisible(), true);
    await screenshot(page, `tab-${name.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`);
  }
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  checks.push('Six functional tabs with ArrowRight / Home / End keyboard navigation');

  const revenue = page.getByTestId('executive-kpi-revenue');
  assert.equal((await revenue.locator('.cc-outcome-value').innerText()).trim(), '\u2014');
  assert.match(await revenue.innerText(), /not available/i);
  assert.equal(await page.getByTestId('executive-side-metric-project_risks').locator('strong').innerText(), '3');
  assert.equal(await page.getByTestId('executive-side-metric-safety_incidents').locator('strong').innerText(), '0');
  assert.equal(await page.getByTestId('executive-side-metric-delayed_audit_projects').locator('strong').innerText(), '2');
  assert.equal(await page.getByTestId('executive-side-metric-headcount').locator('strong').innerText(), '127');
  for (const id of ['critical_roles', 'capacity_gap', 'overdue_mitigations']) {
    assert.equal(await page.getByTestId(`executive-side-metric-${id}`).locator('strong').innerText(), '\u2014');
  }
  assert.equal(await page.locator('[aria-label="Engineering: 78 people"]').count(), 1);
  assert.equal(await page.locator('[aria-label="Other departments: 15 people"]').count(), 1);
  assert.equal(await page.getByRole('img', { name: /Revenue forecast chart unavailable/ }).count(), 1);
  assert.equal(await page.locator('input[type="date"]').count(), 0, 'Snapshot does not imply an unsupported historical reporting period');
  checks.push('Four honest outcome cards, verified risk/headcount/zero-safety values, unavailable measures and actual workforce allocation');

  const currency = page.getByRole('combobox', { name: 'Pipeline currency', exact: true });
  assert.equal(await currency.inputValue(), 'AED');
  assert.match(await page.locator('.cc-weighted').innerText(), /AED\s+970K/i);
  await currency.selectOption('USD');
  assert.match(await page.locator('.cc-weighted').innerText(), /USD\s+36K/i);
  assert.doesNotMatch(await page.locator('.cc-weighted').innerText(), /970/);
  await currency.selectOption('AED');
  checks.push('Commercial stage chart keeps original currencies separate and leaves financial history unavailable');

  const about = page.getByRole('button', { name: 'About Revenue', exact: true });
  await about.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /No connected consolidated source/);
  for (const key of ['Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, `Definitions contain ${key}`);
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await about.evaluate(node => document.activeElement === node), true);
  await page.getByRole('button', { name: 'View Human Resources', exact: true }).click();
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /Active employees/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  const dialogBox = await dialog.boundingBox();
  assert.ok(dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 390);
  await screenshot(page, 'definitions-mobile');
  await page.getByRole('button', { name: 'Close definitions', exact: true }).click();
  await assertGeometry(page, 1672);
  checks.push('Source and department definitions, forward/backward focus trap, Escape and mobile dialog');

  const portfolio = page.getByTestId('executive-portfolio-health');
  assert.equal(await page.getByRole('combobox', { name: 'Filter portfolio by business unit' }).isDisabled(), true);
  await page.getByRole('combobox', { name: 'Filter portfolio by status' }).selectOption('active');
  assert.equal(await portfolio.locator('[data-testid^="executive-project-"]').count(), 2);
  await page.getByRole('combobox', { name: 'Filter portfolio by owner' }).selectOption('Fixture project owner');
  assert.equal(await portfolio.locator('[data-testid^="executive-project-"]').count(), 1);
  await page.getByRole('combobox', { name: 'Filter portfolio by status' }).selectOption('all');
  await page.getByRole('combobox', { name: 'Filter portfolio by owner' }).selectOption('all');
  const project = page.getByTestId('executive-project-one');
  assert.match(await project.innerText(), /AED\s+1\.2M/i);
  assert.equal((await project.locator('td').nth(3).innerText()).trim(), '\u2014', 'No invented margin forecast');
  assert.equal((await project.locator('td').nth(4).innerText()).trim(), '\u2014', 'No invented schedule variance');
  assert.match(await page.getByTestId('executive-project-two').locator('td').nth(2).innerText(), /0%/);
  await project.getByRole('link').click();
  await page.waitForFunction(() => window.executiveRoute === '/projects?project=one');
  await backToOverview(page);
  checks.push('Portfolio table filters, verified contract currencies/progress, unknown forecasts and query-based project drilldowns');

  await page.getByRole('button', { name: 'View all 7 decisions', exact: true }).click();
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 7);
  await page.getByRole('button', { name: 'Show top 3 decisions', exact: true }).click();
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 3);
  await page.getByRole('button', { name: 'Filter decisions', exact: true }).click();
  const departmentFilter = page.getByRole('combobox', { name: 'Filter actions by department' });
  const actionSearch = page.getByRole('searchbox', { name: 'Search management actions' });
  await departmentFilter.selectOption('finance');
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 1);
  await departmentFilter.selectOption('all');
  await actionSearch.fill('no matching decision');
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 0);
  await actionSearch.fill('Engineering review');
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 1);
  await page.getByTestId('executive-action-action-engineering').getByRole('link').click();
  await page.waitForFunction(() => window.executiveRoute === '/engineering');
  await backToOverview(page);
  await page.getByRole('button', { name: 'Filter decisions', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter decisions by priority' }).selectOption('urgent');
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 4);
  await page.getByRole('combobox', { name: 'Filter decisions by priority' }).selectOption('all');
  await departmentFilter.selectOption('finance');
  checks.push('Decisions table preview, view-all, department/search/priority filters and source drilldowns');

  await page.getByRole('button', { name: 'Export board report', exact: true }).click();
  const printSnapshot = await page.evaluate(() => window.executivePrintSnapshot);
  assert.equal(printSnapshot.actions.length, 7, 'Board report includes unfiltered decisions');
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 1, 'Screen decision filters survive print');
  assert.equal(await page.locator('#application-sidebar').isVisible(), true, 'Print does not change on-screen navigation');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 7);
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('#application-sidebar').isVisible(), false);
  await screenshot(page, 'board-print');
  await page.pdf({ path: path.join(artifacts, 'board-print.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('[data-testid^="executive-action-"]').count(), 1);
  await departmentFilter.selectOption('all');
  await page.getByRole('button', { name: 'Filter decisions', exact: true }).click();
  checks.push('Export board report and native print include all decisions and restore screen filters/sidebar');

  if (await page.getByRole('button', { name: 'Export snapshot', exact: true }).count()) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export snapshot', exact: true }).click();
    assert.deepEqual(JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8')), reportFixture());
    checks.push('Snapshot export preserves exact API values');
  }
  for (const mode of ['light', 'dark']) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), mode === 'dark');
    await screenshot(page, `overview-${mode}`);
    const results = await new AxeBuilder({ page }).include('main.main-content').withRules(['color-contrast', 'button-name', 'label', 'aria-valid-attr-value']).analyze();
    if (overviewPolish) await writeFile(path.join(artifacts, `accessibility-${mode}.json`), JSON.stringify(results.violations, null, 2));
    assert.deepEqual(results.violations, [], `${mode} command center contrast and control labeling`);
  }
  checks.push('Light/dark appearance, contrast and control-label accessibility');

  for (const fixture of ['zero', 'empty', 'partial']) {
    const state = await newPage({ fixture });
    await ready(state.page);
    assert.doesNotMatch(await state.page.locator('main').innerText(), /NaN|Infinity|undefined/);
    if (fixture === 'zero') {
      assert.equal(await state.page.getByTestId('executive-side-metric-project_risks').locator('strong').innerText(), '0');
      assert.equal(await state.page.getByTestId('executive-side-metric-headcount').locator('strong').innerText(), '0');
      assert.doesNotMatch(await state.page.getByTestId('executive-department-pulse').innerText(), /on track/i);
    }
    if (fixture === 'empty') {
      assert.equal(await state.page.locator('[data-testid^="executive-action-"]').count(), 0);
      assert.equal(await state.page.getByTestId('executive-side-metric-project_risks').locator('strong').innerText(), '\u2014');
      assert.equal(await state.page.locator('.cc-allocation-row').count(), 0);
    }
    if (fixture === 'partial') {
      assert.equal(await state.page.getByRole('button', { name: 'View Finance', exact: true }).count(), 0);
      assert.match(await state.page.getByTestId('executive-department-finance').innerText(), /restricted/i);
    }
    await screenshot(state.page, fixture);
  }
  checks.push('Verified zero, empty and partial sources remain distinct; no fabricated allocations or on-track conclusions');

  const loading = await newPage({ loading: true });
  assert.equal(await loading.page.getByTestId('executive-kpi-revenue').count(), 0);
  await screenshot(loading.page, 'loading');
  await loading.control.release();
  await ready(loading.page);
  for (const status of [403, 503]) {
    const state = await newPage({ status });
    await state.page.getByRole('alert').waitFor();
    assert.equal(await state.page.getByTestId('executive-kpi-revenue').count(), 0);
    await screenshot(state.page, `error-${status}`);
    state.control.status = 200;
    await state.page.getByRole('button', { name: 'Try again', exact: true }).click();
    await ready(state.page);
  }
  const refreshing = await newPage();
  await ready(refreshing.page);
  refreshing.control.status = 503;
  await refreshing.page.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await refreshing.page.getByRole('alert').waitFor();
  assert.equal(await refreshing.page.getByTestId('executive-kpi-revenue').count(), 0);
  checks.push('Loading, permission/service errors, retry and failed-refresh stale-data removal');

  const truncated = await newPage({ fixture: 'truncated' });
  await ready(truncated.page);
  const cap = truncated.page.locator('.cc-cap-note');
  assert.match(await cap.innerText(), /Showing 7 of 57 selected source alerts/);
  await truncated.page.getByRole('button', { name: 'Export board report', exact: true }).click();
  assert.match(await truncated.page.evaluate(() => window.executivePrintSnapshot.alertLimit), /Showing 7 of 57/);
  await truncated.page.emulateMedia({ media: 'print' });
  assert.equal(await cap.isVisible(), true);
  await truncated.page.emulateMedia({ media: 'screen' });
  checks.push('Source alert truncation is disclosed on screen and in print');

  if (overviewPolish) {
    await assertOverviewProtectedPanelLayout();
    await compareOverviewPolishTabs();
    checks.push('KPI card treatment preserves other panels and exact table geometry/typography/density; all five other tabs remain pixel-identical and all30 shell/UserDetail/tab files unchanged');
  } else {
    await runFinancialPerformanceChecks(suiteOptions('financial'));
    await Promise.all(browser.contexts().map(context => context.close()));
    await runProjectPortfolioChecks(suiteOptions('portfolio'));
    await Promise.all(browser.contexts().map(context => context.close()));
    await runCommercialPipelineChecks(suiteOptions('commercial'));
    await Promise.all(browser.contexts().map(context => context.close()));
    await runWorkforcePerformanceChecks(suiteOptions('workforce'));
    await Promise.all(browser.contexts().map(context => context.close()));
    await runRiskComplianceChecks(suiteOptions('risk'));
    await Promise.all(browser.contexts().map(context => context.close()));
  }
  await assertSidebarUnchanged();
  await assertOverviewPolishProtected();
  checks.push(snapshotGuards ? 'Six sidebar/navigation files match the historical snapshot hashes' : 'Six sidebar/navigation files retain their hashes throughout this run');
  assert.deepEqual(errors, [], 'No runtime errors');
  assert.ok(requests.every(request => request.method === 'GET'), 'Checks never issue write requests');
  assert.deepEqual(unexpectedRequests, [], 'No unmocked external requests');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ checks, runtimeErrors: errors, requestMethods: [...new Set(requests.map(row => row.method))], unexpectedRequests, sidebarHashesUnchanged: true }, null, 2));
  console.log('PASS: ' + checks.join('; ') + '.');
  console.log('Screenshots and print artifact: ' + artifacts);
  }
  await assertSidebarUnchanged();
  assert.deepEqual(errors, [], 'No runtime errors in executive tab scenarios');
  assert.ok(requests.every(request => request.method === 'GET'), 'Checks never issue write requests');
  assert.deepEqual(unexpectedRequests, [], 'No unmocked external requests');
} finally {
  await browser.close();
}
