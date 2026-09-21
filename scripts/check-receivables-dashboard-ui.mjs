import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import AxeBuilder from '@axe-core/playwright';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { inlineLocalCssImports, checkArtifacts, launchBrowser, sidebarWidth, snapshotSources } from './ui-check-support.mjs';
import { RECEIVABLES_CHECK_TIME, customerInvoicesFixture, formulaInvoiceSources, receivablesFixture, receivablesUser } from './check-receivables-dashboard-fixtures.mjs';

// Render the real receivables dashboard, API service, shared shell and unchanged sidebar.
// All records are synthetic; every network request is intercepted and read-only.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'finance-receivables-redesign');
const origin = 'http://receivables-dashboard-check.test';
const visualsOnly = process.argv.includes('--visuals-only');
const workflowsOnly = process.argv.includes('--workflows-only');
const registerMobileOnly = process.argv.includes('--register-mobile-only');
const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/config/layout.config.js', 'src/config/navigationLabels.config.js', 'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js'];
await mkdir(artifacts, { recursive: true });
const startHashes = await snapshotSources(frontend, protectedFiles);
async function guards() {
  for (const row of startHashes) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Sidebar source changed during checks: ${row.RelativePath}`);
  await writeFile(path.join(artifacts, 'protected-sidebar-checks.json'), JSON.stringify({ unchangedDuringRun: true, files: startHashes }, null, 2));
}
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';import InvoiceManagementHub from './src/pages/Finance/InvoiceManagementHub.jsx';
const state={auth:{user:window.receivablesUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{user:window.receivablesUser,roles:window.receivablesUser.roles,modules:[]}}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
function Observer(){const location=useLocation();window.financeRoute=location.pathname+location.search;return null;}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/finance']}><Observer/><Routes><Route element={<Layout/>}><Route path='/finance' element={<InvoiceManagementHub/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
`;
const apiClient = `
async function request(method,url,body,config={}){
 const target=new URL('/api/v1'+url,location.origin);for(const [key,value] of Object.entries(config.params||{}))if(value!==undefined&&value!==null)target.searchParams.set(key,value);
 const multipart=body instanceof FormData;
 const response=await fetch(target,{method,signal:config.signal,headers:multipart?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:multipart?body:JSON.stringify(body)})});
 const data=config.responseType==='blob'&&response.ok?await response.blob():await response.json();
 if(!response.ok){const error=new Error(data.detail||data.error||'Fixture request failed');error.response={status:response.status,data};throw error;}return {data,status:response.status};
}
export default {get:(url,config)=>request('GET',url,undefined,config),post:(url,body,config)=>request('POST',url,body,config),patch:(url,body,config)=>request('PATCH',url,body,config)};`;
const serviceButtons = `import React from 'react';import {BellIcon,ArrowDownTrayIcon} from '@heroicons/react/24/outline';export function NotificationBell(){return <button aria-label='Notifications' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><BellIcon className='h-5 w-5'/></button>}export default function PWAHeaderInstall(){return <button aria-label='Install RADAI on this device' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><ArrowDownTrayIcon className='h-5 w-5'/></button>}`;
const stubs = [
  [/services[\\/]api\.service\.js$/, apiClient],
  [/config[\\/]api\.config\.js$/, `export const API_BASE_URL='/api/v1';export const API_TIMEOUT=10000;export const API_ENDPOINTS={USER_ME:'/rbac/users/me/'};`],
  [/store[\\/]slices[\\/]authSlice\.js$/, 'export const updateUser=()=>({type:"fixture"});export const logout=()=>({type:"fixture-logout"});'],
  [/store[\\/]slices[\\/]themeSlice\.js$/, 'export const toggleTheme=()=>({type:"fixture-theme"});'],
  [/store[\\/]slices[\\/]rbacSlice\.js$/, 'export const fetchCurrentUser=()=>({type:"fixture-rbac"});'],
  [/components[\\/]ProcurementApprovalReminder\.jsx$/, 'export default function Reminder(){return null;}'],
  [/components[\\/]notifications[\\/]NotificationBell\.jsx$/, serviceButtons.replace('export function NotificationBell', 'export default function NotificationBell').replace('export default function PWAHeaderInstall', 'export function PWAHeaderInstall')],
  [/components[\\/]PWAHeaderInstall\.jsx$/, serviceButtons],
  [/hooks[\\/]useAuthenticatedPhoto\.js$/, 'export default function useAuthenticatedPhoto(){return null;}'],
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Finance command center"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'finance-command-center-fixture', setup(builder) { builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' })); for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' })); } }] });
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(path.join(frontend, directory), { withFileTypes: true })) { const file = `${directory}/${entry.name}`; if (entry.isDirectory()) result.push(...await filesIn(file)); else result.push(file); }
  return result;
}
const componentFiles = [...await filesIn('src/components/Layout'), ...await filesIn('src/components/Finance'), ...await filesIn('src/pages/Finance'), 'src/config/layout.config.js'];
const classSources = await Promise.all(componentFiles.filter(file => /\.[jm]sx?$/.test(file)).map(file => readFile(path.join(frontend, file), 'utf8')));
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*', '/fonts/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accounts receivable browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const expectedSidebarWidth = await sidebarWidth(frontend);
const runtimeErrors = [], unexpectedRequests = [], checks = [], geometries = [], accessibility = [];
const record = message => { checks.push(message); console.log(`PASS: ${message}`); };
let browser;
async function newPage({ fixture = 'full', width = 1672, dark = false, loading = false, registerLoading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(RECEIVABLES_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => {
    window.receivablesUser = user;
    window.financePrintCalls = 0;
    window.print = () => { window.financePrintCalls += 1; window.financePrintedText = document.querySelector('main')?.innerText; };
    localStorage.setItem('radai_access_token', 'isolated-finance-test-token');
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark));
  }, { user: receivablesUser, dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, loading, registerLoading, pending: [], registerPending: [], requests: [], failure: null, registerFailure: null, deferNext: false };
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const respond = async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api\/v1/, '');
    control.requests.push({ method: request.method(), endpoint, query: url.search });
    if (request.method() !== 'GET') { unexpectedRequests.push(`Forbidden write ${request.method()} ${endpoint}`); return json(route, { detail: 'This fixture only permits read-only requests.' }, 409); }
    if (endpoint === '/finance/dashboard/receivables/') {
      if (control.loading) { control.pending.push(route); return; }
      const fixtureData = typeof control.fixture === 'string' ? receivablesFixture(control.fixture, Object.fromEntries(url.searchParams)) : structuredClone(control.fixture);
      if (control.deferNext) { control.deferNext = false; await new Promise(resolve => { control.releaseNext = resolve; }); }
      const failure = control.failure || fixtureData.failure;
      if (failure) return json(route, { detail: failure === 403 ? 'Finance overview access is required.' : 'Synthetic finance source unavailable.' }, failure);
      return json(route, fixtureData.data);
    }
    if (endpoint === '/finance/dashboard/customer-invoices/') {
      if (control.registerLoading) { control.registerPending.push(route); return; }
      const fixtureData = customerInvoicesFixture(typeof control.fixture === 'string' ? control.fixture : 'full', Object.fromEntries(url.searchParams));
      const failure = control.registerFailure || fixtureData.failure;
      if (failure) return json(route, { detail: failure === 403 ? 'Customer invoice access is required.' : 'Synthetic customer invoice source unavailable.' }, failure);
      return json(route, fixtureData.data);
    }
    if (endpoint === '/rbac/users/me/') return json(route, { user: receivablesUser, roles: receivablesUser.roles, modules: [] });
    if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
    unexpectedRequests.push(`${request.method()} ${endpoint}`); return json(route, { detail: 'Unmapped fixture request.' }, 404);
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) return respond(route);
    if (route.request().isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/'))) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.woff2') ? 'font/woff2' : url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Report unmapped assets below. */ }
    }
    unexpectedRequests.push(route.request().url()); return route.abort();
  });
  control.release = async () => { control.loading = false; await Promise.all(control.pending.splice(0).map(respond)); };
  control.releaseRegister = async () => { control.registerLoading = false; await Promise.all(control.registerPending.splice(0).map(respond)); };
  await page.goto(origin);
  return { page, control, close: () => context.close() };
}
async function capture(page, name) {
  await page.locator('main.main-content').evaluate(main => { for (const node of [main, ...main.querySelectorAll('*')]) if (node.scrollTop || node.scrollLeft) node.scrollTo({ top: 0, left: 0, behavior: 'instant' }); window.scrollTo(0, 0); });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), animations: 'disabled' });
}
const root = page => page.locator('.finance-command-center');
const kpi = (page, id) => page.getByTestId(`finance-kpi-${id}`).locator('strong');
const workbook = page => page.locator('.ar-workbook-summary');
const workbookAmount = (page, id) => page.getByTestId(`workbook-total-${id}`).locator('strong');
async function workbookValues(page, available = true) {
  const text = await workbook(page).innerText();
  const panel = page.locator('.ar-payment-status-panel');
  assert.equal(await page.getByRole('heading', { name: 'Ageing by due period', exact: true }).count(), 0, 'Payment status replaces the former ageing chart');
  if (!available) {
    assert.doesNotMatch(text + await panel.innerText(), /315,481,678|466,151,390|285,759,742|3,895|4,404/);
    for (const id of ['invoice_amount', 'invoice_amount_aed', 'actual_payment_received', 'project_count']) assert.equal(await workbookAmount(page, id).innerText(), '\u2014');
    return;
  }
  const summary = receivablesFixture().data.workbook_summary;
  for (const [id, expected] of Object.entries(summary.totals)) {
    assert.equal(Number((await workbookAmount(page, id).innerText()).replace(/[^\d.-]/g, '')), Number(expected), `${id} uses the independent full-workbook aggregate`);
  }
  assert.doesNotMatch(await workbookAmount(page, 'invoice_amount').innerText(), /AED|USD/);
  assert.doesNotMatch(await workbookAmount(page, 'actual_payment_received').innerText(), /AED|USD/);
  assert.match(await workbookAmount(page, 'invoice_amount_aed').innerText(), /AED/);
  assert.match(text, /full workbook/i); assert.match(text, /unaffected by dashboard filters/i);
  assert.match(text, /mixed|original currencies/i);
  for (const row of summary.payment_status) {
    assert.equal((await panel.locator(`[data-status="${row.id}"]`).innerText()).replace(/\s+/g, ' ').trim(), `${row.label} ${row.count.toLocaleString('en-US')}`);
  }
  assert.match(await panel.locator('tfoot').innerText(), /Total\s+4,404/);
  assert.match(await panel.innerText(), /full workbook/i);
}
async function loaded(page) { await root(page).waitFor(); await page.waitForFunction(() => document.querySelector('.finance-command-center')?.getAttribute('aria-busy') === 'false'); }
async function open(options) { const result = await newPage(options); if (!options?.loading) await loaded(result.page); return result; }

async function geometry(page, width, dark) {
  const result = await root(page).evaluate(element => {
    const box = node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }; };
    const main = document.querySelector('main');
    const header = document.querySelector('#application-content > header');
    return { documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: main.scrollWidth <= main.clientWidth + 1,
      contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      header: header ? box(header) : null, mainPaddingTop: getComputedStyle(main).paddingTop, footerCount: document.querySelectorAll('.app-footer').length,
      kpis: [...element.querySelectorAll('[data-testid^="finance-kpi-"]')].map(box),
      workbookCards: [...element.querySelectorAll('[data-testid^="workbook-total-"]')].map(node => ({ ...box(node), fits: node.scrollWidth <= node.clientWidth + 1 })),
      paymentStatus: (() => { const panel = element.querySelector('.ar-payment-status-panel'), table = panel.querySelector('.ar-payment-status-table'); return { panel: box(panel), table: box(table), minWidth: getComputedStyle(table).minWidth, rows: [...table.rows].map(row => box(row)), fits: table.scrollWidth <= panel.clientWidth + 1 && table.getBoundingClientRect().bottom <= panel.getBoundingClientRect().bottom + 1 }; })(),
      panels: [...element.querySelectorAll('.ar-analysis-grid > .ar-panel')].map(node => ({ name: node.className, ...box(node) })),
      tables: [...element.querySelectorAll('.ar-table')].map(table => ({ className: table.className, ...box(table), rows: [...table.querySelectorAll('tr')].map(row => ({ ...box(row), cells: [...row.children].map(cell => { const style = getComputedStyle(cell); return { text: cell.textContent.trim(), height: cell.getBoundingClientRect().height, fontSize: style.fontSize, lineHeight: style.lineHeight, padding: style.padding, border: style.borderWidth }; }) })) })),
      svgs: [...element.querySelectorAll('.ar-panel svg[role="img"]')].map(svg => ({ chart: svg.closest('.ar-chart')?.className, ...box(svg) })),
      chartTextOverflow: [...element.querySelectorAll('.ar-panel svg[role="img"]')].flatMap(svg => { const bounds = svg.getBoundingClientRect(); return [...svg.querySelectorAll('text')].flatMap(node => { const textBounds = node.getBoundingClientRect(); return textBounds.width > 0 && (textBounds.left < bounds.left - 2 || textBounds.right > bounds.right + 2 || textBounds.top < bounds.top - 2 || textBounds.bottom > bounds.bottom + 2) ? [{ chart: svg.closest('.ar-chart')?.className, text: node.textContent, chartBox: box(svg), textBox: box(node) }] : []; }); }),
      buttons: [...element.querySelectorAll('button,a')].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ label: node.getAttribute('aria-label') || node.textContent.trim(), ...box(node) })),
    };
  });
  geometries.push({ width, dark, ...result });
  assert.ok(result.documentFits && result.mainFits, `${width}px: no horizontal page overflow`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth, 'Existing sidebar offset is preserved');
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth, 'Existing desktop sidebar width is preserved');
  assert.equal(result.footerCount, 0, 'Finance overview uses the full height without the shared footer');
  assert.equal(result.mainPaddingTop, '0px', 'Finance has no inherited gap below the compact top bar');
  assert.equal(result.kpis.length, 4);
  assert.equal(result.workbookCards.length, 4);
  assert.ok(result.workbookCards.every(card => card.fits && card.width > 0 && card.x >= result.contentX - 1 && card.right <= width + 1), 'Four workbook cards fit without clipped amounts');
  assert.equal(result.paymentStatus.minWidth, '0px', 'Status table does not inherit the wide invoice-table minimum');
  assert.equal(result.paymentStatus.rows.length, 7, 'Status heading, all five states and total remain in the panel');
  assert.equal(result.paymentStatus.fits, true, 'Payment status rows fit in the panel at each viewport');
  assert.equal(result.panels.length, 7, 'All seven dashboard panels render');
  assert.equal(result.svgs.length, 4, 'Four financial charts remain after payment status replaces ageing');
  assert.ok(result.svgs.every(svg => svg.width >= (svg.chart.includes('ar-chart-exposure') ? 150 : 200) && svg.height >= 50), 'Cartesian plots and the responsive donut have usable dimensions');
  assert.deepEqual(result.chartTextOverflow, [], 'Chart labels fit within each SVG without clipping');
  assert.ok(result.panels.every(panel => panel.width > 0 && panel.height > 0 && panel.x >= result.contentX - 1 && panel.right <= width + 1), 'Panels fit within the content column');
  if (width >= 1440) {
    assert.equal(new Set(result.kpis.map(card => Math.round(card.y))).size, 1, 'Four outcomes remain on one desktop row');
    assert.equal(new Set(result.workbookCards.map(card => Math.round(card.y))).size, 1, 'Four workbook totals remain on one desktop row');
    assert.ok(result.workbookCards.every(card => card.bottom <= result.kpis[0].y), 'Workbook totals appear before scoped receivables outcomes');
    assert.ok(result.header && result.header.height >= 32 && result.header.height <= 45, 'Compact finance top bar remains close to the 37px reference');
    for (const pair of [['ar-customer-panel', 'ar-exposure-panel'], ['ar-ageing-panel', 'ar-trend-panel'], ['ar-summary-panel', 'ar-invoices-panel']]) {
      const panels = pair.map(name => result.panels.find(panel => panel.name.includes(name)));
      assert.equal(Math.round(panels[0].y), Math.round(panels[1].y), `${pair.join(' and ')} share their desktop row`);
      assert.ok(panels[1].x >= panels[0].right - 1, 'Paired desktop panels do not overlap');
    }
    const history = result.panels.find(panel => panel.name.includes('ar-history-panel'));
    const leftPanel = result.panels.find(panel => panel.name.includes('ar-customer-panel'));
    const rightPanel = result.panels.find(panel => panel.name.includes('ar-exposure-panel'));
    assert.ok(Math.abs(history.x - leftPanel.x) < 1 && Math.abs(history.right - rightPanel.right) < 1, 'Payment history spans both desktop columns');
    assert.ok(history.bottom > history.y, 'Payment history remains reachable below the expanded summary');
  }
  for (const panel of await page.locator('.ar-panel').all()) {
    await panel.scrollIntoViewIfNeeded();
    assert.equal(await panel.isVisible(), true, 'Every responsive panel can be reached');
  }
}

async function axe(page, name) {
  const result = await new AxeBuilder({ page }).include('.finance-command-center').include('#application-content > header').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  accessibility.push({ name, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
  assert.deepEqual(result.violations.map(item => item.id), [], `${name}: no accessibility violations`);
}

async function visualChecks() {
  for (const width of [1672, 1440, 1024, 390]) {
    const state = await open({ width }); await registerReady(state.page); await capture(state.page, `receivables-${width}`); await geometry(state.page, width, false); await axe(state.page, `light-${width}`);
    await registerSection(state.page).screenshot({ path: path.join(artifacts, `customer-invoices-${width}.png`), animations: 'disabled' });
    if (width === 390) {
      await state.page.locator('.ar-exposure-panel').screenshot({ path: path.join(artifacts, 'receivables-390-exposure.png'), animations: 'disabled' });
      await state.page.getByRole('button', { name: 'Open sidebar', exact: true }).click();
      await state.page.getByRole('dialog', { name: 'Application navigation', exact: true }).waitFor();
      assert.equal(await state.page.locator('#application-content').getAttribute('inert'), '', 'Mobile navigation retains the shared focus isolation');
      await state.page.keyboard.press('Escape'); await state.page.getByRole('dialog', { name: 'Application navigation', exact: true }).waitFor({ state: 'hidden' });
      await state.page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open sidebar');
      assert.equal(await state.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open sidebar');
    }
    await state.close();
    record(`${width}px light layout: four workbook totals, four receivables KPIs, seven panels and unchanged sidebar geometry`);
  }
  const state = await open({ dark: true }); await registerReady(state.page); await capture(state.page, 'receivables-dark'); await geometry(state.page, 1672, true); await axe(state.page, 'dark-1672'); await registerSection(state.page).screenshot({ path: path.join(artifacts, 'customer-invoices-dark.png'), animations: 'disabled' }); await state.close();
  record('Dark theme remains readable and accessible');
}

const kpiAmount = async (page, id) => Number((await kpi(page, id).innerText()).replace(/[^\d.-]/g, ''));
const dashboardRequests = control => control.requests.filter(request => request.endpoint === '/finance/dashboard/receivables/');
async function moreAction(page, text) { await page.getByLabel('More dashboard options', { exact: true }).click(); await page.getByText(text, { exact: true }).click(); }
async function changeFilter(page, control, label, value, input = false) {
  const before = dashboardRequests(control).length;
  const field = page.getByLabel(label, { exact: true });
  const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/finance/dashboard/receivables/');
  if (input) await field.fill(value); else await field.selectOption(value);
  await response; await loaded(page);
  assert.ok(dashboardRequests(control).length > before, `${label} changes request fresh server aggregates`);
  return new URLSearchParams(dashboardRequests(control).at(-1).query);
}

async function fixtureConsistency() {
  const data = receivablesFixture().data;
  assert.equal(data.workbook_summary.payment_status.reduce((sum, row) => sum + row.count, 0), data.workbook_summary.invoice_count);
  assert.deepEqual(receivablesFixture('full', { currency: 'USD', company: 'Stripe Inc.', months: 6 }).data.workbook_summary, data.workbook_summary, 'Full workbook aggregates are independent of live receivables filters');
  assert.deepEqual(Object.values(data.kpis).map(item => Number(item.amount)), [380828, 313499, 286591, 148983]);
  assert.equal(data.customers.reduce((sum, row) => sum + Number(row.amount), 0), Number(data.kpis.unpaid.amount));
  assert.equal(data.ageing.reduce((sum, row) => sum + Number(row.receivables.amount), 0), Number(data.kpis.unpaid.amount));
  for (const customer of data.customers) assert.equal(Object.values(customer.buckets).reduce((sum, row) => sum + Number(row.amount), 0), Number(customer.amount));
  const register = customerInvoicesFixture().data;
  assert.equal(register.pagination.count, 28); assert.equal(register.rows.length, 8);
  assert.equal(Number(register.totals.amount.amount), 752828);
  assert.equal(Number(register.totals.actual_payment_received.amount), 372000);
  assert.equal(Number(register.totals.amount_due_home.amount), Number(data.kpis.unpaid.amount));
  assert.ok(register.rows.some(row => row.company === 'Stripe Inc.' && row.account === ''), 'Fixture includes recorded companies with blank legacy accounts');
  const allInvoices = customerInvoicesFixture('full', { page_size: 50 }).data.rows;
  assert.deepEqual([...new Set(allInvoices.filter(row => row.account === 'LEGACY-SHARED-ACCOUNT').map(row => row.company))].sort(), ['Gala SARL', 'Wozel & Co. LLP'], 'Fixture distinguishes companies sharing the same legacy account');
  assert.equal(receivablesFixture('full', { company: 'Stripe Inc.' }).data.kpis.unpaid.amount, '127520.00');
  assert.equal(receivablesFixture('full', { company: 'LEGACY-SHARED-ACCOUNT' }).data.kpis.unpaid.amount, '0.00', 'Customer filters apply to company, never raw account');
  const foreign = customerInvoicesFixture('full', { currency: 'USD' }).data;
  assert.equal(foreign.rows[0].amount, '5000.00'); assert.equal(foreign.rows[0].amount_home, null); assert.equal(foreign.rows[0].amount_due_home, null);
  assert.equal(foreign.rows[1].amount_due_home, '0.00', 'An explicitly settled foreign balance has an exact zero without inferred FX');
  const formula = receivablesFixture('formula').data, formulaRegister = customerInvoicesFixture('formula').data;
  assert.deepEqual(formulaInvoiceSources().map(row => [row.id, row.amount]), [[901, 7500], [902, 2000], [903, null], [904, 0], [905, -250], [906, 7000], [907, 500], [908, 700]]);
  assert.equal(formula.kpis.unpaid.amount, null); assert.equal(formula.kpis.unpaid.known_amount, '9500.00'); assert.equal(formula.kpis.unpaid.missing_count, 1);
  assert.equal(formula.kpis.overdue.known_amount, '9500.00'); assert.equal(formula.kpis.over90.amount, '7500.00');
  assert.deepEqual(formulaRegister.rows.map(row => row.id).sort(), [901, 902, 903, 904, 905, 906], 'Register preserves paid/settled rows and excludes cancelled invoices and credit notes');
  assert.equal(formulaRegister.totals.amount.known_amount, '24000.00'); assert.equal(formulaRegister.totals.actual_payment_received.amount, '7850.00');
  assert.equal(formula.paid_unpaid_by_month.reduce((sum, row) => sum + Number(row.paid.amount), 0), 7850, 'Blank receipts count as zero in payment charts');
  assert.ok(formulaRegister.rows.every(row => row.balance_to_be_received === '987654.32'), 'Conflicting legacy balances remain present so tests can detect accidental fallback');
  record('Synthetic balances use invoice amount minus receipts, ignore conflicting stored balances, and preserve unknown invoice amounts');
}

async function workflowChecks() {
  let state = await open(); let { page, control } = state;
  await page.getByRole('heading', { name: 'Accounts Receivable', exact: true }).waitFor();
  for (const [id, expected] of [['unpaid', 380828], ['overdue', 313499], ['over30', 286591], ['over90', 148983]]) assert.equal(await kpiAmount(page, id), expected, `${id} uses the server aggregate`);
  assert.equal(await page.getByTestId('finance-kpi-cash').count(), 0);
  await workbookValues(page);
  await workbook(page).getByText('Workbook source', { exact: true }).click();
  assert.match(await workbook(page).innerText(), /Synthetic invoice workbook\.xlsx/);
  assert.match(await workbook(page).innerText(), /2.*error|error.*2/i);
  await workbook(page).getByText('Workbook source', { exact: true }).click();
  const text = await root(page).innerText();
  for (const customer of receivablesFixture().data.customers) {
    assert.ok(text.includes(customer.company));
    for (const panel of ['.ar-customer-panel', '.ar-exposure-panel', '.ar-summary-panel']) assert.ok((await page.locator(panel).innerText()).includes(customer.company), `${panel} names customers from recorded company`);
  }
  assert.doesNotMatch(text, /LEGACY-|Customer not recorded/, 'Recorded companies remain visible when raw accounts are blank or conflicting');
  assert.deepEqual(await page.locator('.ar-invoices-panel tbody th[scope="row"]').allTextContents(), receivablesFixture().data.priority_invoices.map(row => row.company), 'Priority invoices display the recorded company');
  assert.equal(await page.getByLabel('Customer', { exact: true }).locator('option').first().innerText(), 'All customers');
  const customerBars = page.locator('.ar-customer-panel rect.ar-chart-mark');
  assert.equal(await customerBars.count(), 5);
  const widths = await customerBars.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  assert.ok(Math.abs(widths[1] / widths[0] - 85116 / 127520) < 0.001, 'Customer bar lengths represent the actual invoice balances');
  await customerBars.first().focus(); await page.getByRole('tooltip').waitFor(); assert.match(await page.getByRole('tooltip').innerText(), /127,520/);
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('tooltip').count(), 0, 'Chart tooltips support keyboard dismissal');
  let params = await changeFilter(page, control, 'Reporting currency', 'USD');
  assert.equal(params.get('currency'), 'USD'); assert.equal(await kpiAmount(page, 'unpaid'), 5000);
  await workbookValues(page);
  params = await changeFilter(page, control, 'Reporting currency', 'AED'); assert.equal(params.get('currency'), 'AED');
  params = await changeFilter(page, control, 'Customer', 'Stripe Inc.'); assert.equal(params.get('company'), 'Stripe Inc.'); assert.equal(await kpiAmount(page, 'unpaid'), 127520);
  assert.equal(params.has('account'), false);
  params = await changeFilter(page, control, 'Customer', ''); assert.equal(params.get('company') || '', '');
  params = await changeFilter(page, control, 'Period', '6'); assert.equal(params.get('months'), '6');
  params = await changeFilter(page, control, 'As of', '2026-09-20', true); assert.equal(params.get('as_of'), '2026-09-20');
  await workbookValues(page);
  record('Company-based customer labels and currency, customer, period and reporting date filters use the authoritative source');

  await moreAction(page, 'Source coverage'); const dialog = page.getByRole('dialog'); await dialog.waitFor();
  assert.match(await dialog.innerText(), /receivable|customer invoice/i);
  await axe(page, 'source-coverage');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'More dashboard options', 'Closing source coverage restores the visible menu trigger');
  const beforeRefresh = dashboardRequests(control).length; await moreAction(page, 'Refresh data'); await loaded(page); assert.ok(dashboardRequests(control).length > beforeRefresh);
  record('Source coverage dialog, Escape focus restoration and refresh are operational');

  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: /^Export/ }).click();
  const download = await downloadPromise; const stream = await download.createReadStream(); const parts = []; for await (const chunk of stream) parts.push(chunk); const csv = Buffer.concat(parts);
  assert.match(download.suggestedFilename(), /\.csv$/i);
  const csvText = csv.toString('utf8'); assert.match(csvText, /380828/); assert.match(csvText, /Stripe Inc\./); assert.match(csvText, /SYN-2026-/); assert.match(csvText, /AED/);
  for (const value of ['315481678.41', '466151390.16', '285759742.00', '4404', '3895']) assert.ok(csvText.includes(value), `CSV retains the workbook source value ${value}`);
  assert.doesNotMatch(csvText, /LEGACY-|Customer not recorded/, 'Customer CSV columns use company even when source accounts are blank or conflicting');
  await writeFile(path.join(artifacts, download.suggestedFilename()), csv);
  assert.ok(control.requests.every(request => request.method === 'GET'));
  record('CSV download contains actual scoped KPI, customer ageing and invoice data without server writes');

  const invoiceLink = page.locator('.ar-invoices-panel a[href^="/finance/outgoing-invoices/"]').first(); const invoiceHref = await invoiceLink.getAttribute('href');
  await invoiceLink.click(); await page.getByRole('heading', { name: 'Source destination', exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.financeRoute), invoiceHref);
  assert.equal(await page.locator('.app-footer').count(), 1, 'Existing footer remains on invoice detail routes'); await state.close();
  state = await open(); ({ page, control } = state); await root(page).getByRole('link', { name: /collection queue/i }).click(); await page.getByRole('heading', { name: 'Source destination', exact: true }).waitFor();
  const queueRoute = new URL(await page.evaluate(() => window.financeRoute), origin); assert.equal(queueRoute.pathname, '/finance/outgoing-invoices'); assert.equal(queueRoute.searchParams.get('queue'), 'overdue'); assert.equal(queueRoute.searchParams.get('currency'), 'AED'); await state.close();
  record('Invoice review and collection queue navigate to existing outgoing invoice routes; shell changes stay on /finance');

  state = await open(); ({ page } = state);
  const customerLink = page.locator('.ar-summary-panel').getByRole('link', { name: 'Stripe Inc.', exact: true });
  const customerRoute = new URL(await customerLink.getAttribute('href'), origin);
  assert.equal(customerRoute.pathname, '/finance/outgoing-invoices'); assert.equal(customerRoute.searchParams.get('company'), 'Stripe Inc.'); assert.equal(customerRoute.searchParams.has('account'), false);
  await customerLink.click(); await page.getByRole('heading', { name: 'Source destination', exact: true }).waitFor();
  assert.equal(new URL(await page.evaluate(() => window.financeRoute), origin).searchParams.get('company'), 'Stripe Inc.'); await state.close();
  record('Customer ageing drilldowns scope the outgoing register by company without legacy account filters');

  for (const fixture of ['loading', 'empty', 'partial', 'restricted', 'payables-restricted', 'workbook-restricted', 'workbook-unavailable', 'error', 'forbidden']) {
    state = await open({ fixture: fixture === 'loading' ? 'full' : fixture, loading: fixture === 'loading' }); ({ page, control } = state);
    if (fixture === 'loading') {
      await root(page).waitFor(); assert.equal(await root(page).getAttribute('aria-busy'), 'true'); assert.equal(await page.getByRole('button', { name: /^Export/ }).isDisabled(), true);
      await workbookValues(page, false);
      await capture(page, 'state-loading'); await control.release(); await loaded(page); assert.equal(await kpiAmount(page, 'unpaid'), 380828);
    }
    if (fixture === 'empty') { assert.equal(await kpiAmount(page, 'unpaid'), 0); assert.equal(await page.locator('.ar-invoices-panel a[href^="/finance/outgoing-invoices/"]').count(), 0); await workbookValues(page); }
    if (fixture === 'partial') { assert.equal(await kpiAmount(page, 'unpaid'), 380828); assert.match(await page.getByTestId('finance-kpi-unpaid').innerText(), /recorded|partial|missing/i); assert.match(await root(page).innerText(), /missing|partial/i); }
    if (fixture === 'restricted') {
      await workbookValues(page, false);
      for (const id of ['unpaid', 'overdue', 'over30', 'over90']) assert.equal(await kpi(page, id).innerText(), '—');
      assert.ok(!(await root(page).innerText()).includes('Stripe Inc.')); assert.match(await root(page).innerText(), /restricted|access/i);
      assert.equal(await root(page).locator('a[href^="/finance/outgoing-invoices"]').count(), 0);
    }
    if (fixture === 'payables-restricted') {
      await workbookValues(page);
      assert.equal(await kpiAmount(page, 'unpaid'), 380828);
      assert.equal(await page.locator('.ar-ageing-panel .ar-chart-mark[aria-label*="Bills"], .ar-trend-panel .ar-chart-mark[aria-label*="Bills"]').count(), 0, 'Restricted payable amounts never become chart marks');
      await moreAction(page, 'Source coverage'); assert.match(await page.getByRole('dialog').innerText(), /restricted|access/i); await page.keyboard.press('Escape');
    }
    if (fixture === 'workbook-restricted' || fixture === 'workbook-unavailable') {
      await workbookValues(page, false); assert.equal(await kpiAmount(page, 'unpaid'), 380828, 'Independent workbook failure preserves live receivables');
      assert.match(await workbook(page).innerText(), /unavailable|access|restricted/i);
    }
    if (fixture === 'error' || fixture === 'forbidden') {
      await workbookValues(page, false);
      assert.equal(await kpi(page, 'unpaid').innerText(), '—'); assert.equal(await page.getByRole('button', { name: /^Export/ }).isDisabled(), true);
      await capture(page, `state-${fixture}`); control.fixture = 'full'; await page.getByRole('button', { name: /try again|retry/i }).click(); await loaded(page); assert.equal(await kpiAmount(page, 'unpaid'), 380828);
    } else if (fixture !== 'loading') await capture(page, `state-${fixture}`);
    await axe(page, `state-${fixture}`); await state.close();
  }
  record('Loading, empty, partial recorded balances, restricted sources and retry states remain accurate and accessible');

  for (const summaryOverride of [{ status: 'restricted' }, { schema_version: '2.0' }]) {
    const fixture = receivablesFixture(); Object.assign(fixture.data.workbook_summary, summaryOverride);
    state = await open({ fixture }); ({ page } = state); await workbookValues(page, false);
    assert.equal(await kpiAmount(page, 'unpaid'), 380828);
    await state.close();
  }
  record('Workbook permission and schema guards hide aggregate values even if a response contains stale totals');

  state = await open(); ({ page, control } = state); control.failure = 503; await moreAction(page, 'Refresh data'); await loaded(page);
  assert.equal(await kpi(page, 'unpaid').innerText(), '—'); assert.equal(await page.locator('.ar-invoices-panel a[href^="/finance/outgoing-invoices/"]').count(), 0);
  await workbookValues(page, false);
  assert.ok(!(await page.locator('.ar-customer-panel, .ar-summary-panel, .ar-invoices-panel').allTextContents()).join(' ').includes('Stripe Inc.'), 'Refresh failures remove stale customer values from financial panels');
  control.failure = null; await page.getByRole('button', { name: /try again|retry/i }).click(); await loaded(page); assert.equal(await kpiAmount(page, 'unpaid'), 380828); await state.close();
  record('Failed refresh clears stale financial amounts and successful retry restores current values');
}

const registerSection = page => page.getByTestId('customer-invoices-section');
const registerRequests = control => control.requests.filter(request => request.endpoint === '/finance/dashboard/customer-invoices/');
async function registerReady(page) {
  await registerSection(page).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="customer-invoices-section"]')?.getAttribute('aria-busy') === 'false');
}
const registerResponse = page => page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/finance/dashboard/customer-invoices/');

async function customerInvoiceChecks() {
  let state = await open(); let { page, control } = state; await registerReady(page);
  let section = registerSection(page), table = section.getByRole('table', { name: 'Customer invoices', exact: true });
  assert.equal(await table.locator('tbody tr').count(), 8, 'First page shows eight customer invoices');
  assert.deepEqual(await table.locator('tbody th[scope="row"]').allTextContents(), customerInvoicesFixture().data.rows.map(row => row.company), 'Register customer column shows companies despite blank or conflicting raw accounts');
  assert.doesNotMatch(await table.innerText(), /LEGACY-|Customer not recorded/);
  assert.ok((await table.innerText()).includes('Paid'), 'Register includes settled invoices alongside outstanding invoices');
  const grandTotal = await table.locator('tfoot').innerText(); assert.match(grandTotal, /752,828/); assert.match(grandTotal, /372,000/);
  const columnLabels = ['Invoice #', 'Invoice Date', 'Invoice Sent', 'COMPANY', 'Project Name', 'Invoice Amount', 'Inv Amt. (AED)', 'Due Date', 'Payment terms', 'PM', 'Payment Status', 'Days overdue', 'Payment Date', 'Actual Payment Received', 'Remarks'];
  assert.deepEqual(await table.locator('thead th button span').allTextContents(), columnLabels, 'All fifteen source columns follow the requested order');
  for (const label of columnLabels) {
    assert.equal(await section.getByRole('button', { name: `Sort customer invoices by ${label}`, exact: true }).count(), 1);
  }
  const firstPage = await table.locator('tbody').innerText();
  let response = registerResponse(page); await section.getByRole('button', { name: 'Next customer invoice page', exact: true }).click(); await response; await registerReady(page);
  assert.equal(new URLSearchParams(registerRequests(control).at(-1).query).get('page'), '2');
  assert.notEqual(await table.locator('tbody').innerText(), firstPage, 'Pagination renders the next server page');
  assert.equal(await table.locator('tfoot').innerText(), grandTotal, 'Grand totals cover all filtered invoices on every page');
  response = registerResponse(page); await section.getByRole('button', { name: 'Sort customer invoices by COMPANY', exact: true }).click(); await response; await registerReady(page);
  let params = new URLSearchParams(registerRequests(control).at(-1).query); assert.equal(params.get('ordering'), 'company'); assert.equal(params.get('page'), '1');
  assert.match(await table.locator('tbody tr').first().innerText(), /Business Tech/);
  response = registerResponse(page); await section.getByRole('button', { name: 'Sort customer invoices by COMPANY', exact: true }).click(); await response; await registerReady(page);
  assert.equal(new URLSearchParams(registerRequests(control).at(-1).query).get('ordering'), '-company');
  assert.match(await table.locator('tbody tr').first().innerText(), /Wozel/);
  await section.screenshot({ path: path.join(artifacts, 'customer-invoices-1672.png'), animations: 'disabled' });
  await axe(page, 'customer-invoice-register');
  record('Customer invoice register has all fifteen source columns, eight-row pages and invoice/receipt totals across all filtered rows');

  response = registerResponse(page); await changeFilter(page, control, 'Reporting currency', 'USD'); await response; await registerReady(page);
  params = new URLSearchParams(registerRequests(control).at(-1).query); assert.equal(params.get('currency'), 'USD'); assert.equal(params.get('page'), '1');
  assert.equal(await table.locator('tbody tr').count(), 2);
  const foreignCells = await table.locator('tbody tr').first().locator('td,th').allTextContents();
  assert.match(foreignCells.join(' '), /5,000/);
  assert.deepEqual(await table.locator('tbody [data-field="amount_home"]').allTextContents(), ['—', '—'], 'Missing AED invoice amounts stay unknown instead of inventing FX');
  assert.deepEqual(await table.locator('tbody [data-field="actual_payment_received"]').allTextContents(), ['0', '1,100'], 'Actual receipts remain in the original currency');
  await section.screenshot({ path: path.join(artifacts, 'customer-invoices-foreign-currency.png'), animations: 'disabled' });
  response = registerResponse(page); await changeFilter(page, control, 'Reporting currency', 'AED'); await response; await registerReady(page);
  response = registerResponse(page); await changeFilter(page, control, 'Customer', 'Business Tech'); await response; await registerReady(page);
  params = new URLSearchParams(registerRequests(control).at(-1).query); assert.equal(params.get('company'), 'Business Tech'); assert.equal(await table.locator('tbody tr').count(), 1);
  assert.match(await table.locator('tfoot').innerText(), /15,000/); await state.close();
  record('Customer register follows currency/company filters and preserves unknown AED equivalents for foreign invoices');

  state = await open({ fixture: 'missing-company' }); ({ page } = state); await registerReady(page);
  for (const panel of ['.ar-customer-panel', '.ar-summary-panel', '.ar-invoices-panel', '[data-testid="customer-invoices-section"]']) {
    assert.match(await page.locator(panel).innerText(), /Customer not recorded/);
    assert.doesNotMatch(await page.locator(panel).innerText(), /LEGACY-ONLY-ACCOUNT/, 'Missing company must never fall back to a raw account');
  }
  assert.equal(await page.locator('.ar-summary-panel tbody a').count(), 0, 'A missing customer company cannot create a misleading company drilldown');
  await axe(page, 'missing-company'); await state.close();
  record('Only missing company values show Customer not recorded, without legacy account fallback or misleading drilldowns');

  for (const fixture of ['register-loading', 'register-empty', 'register-restricted', 'register-error', 'partial']) {
    state = await open({ fixture: fixture === 'register-loading' ? 'full' : fixture, registerLoading: fixture === 'register-loading' }); ({ page, control } = state); section = registerSection(page);
    if (fixture === 'register-loading') {
      await section.waitFor(); await page.waitForFunction(() => document.querySelector('[data-testid="customer-invoices-section"]')?.getAttribute('aria-busy') === 'true');
      await section.screenshot({ path: path.join(artifacts, 'customer-invoices-loading.png'), animations: 'disabled' }); await control.releaseRegister(); await registerReady(page);
    } else await registerReady(page);
    table = section.getByRole('table', { name: 'Customer invoices', exact: true });
    if (fixture === 'register-empty') { assert.match(await table.locator('tbody').innerText(), /no .*invoices|no .*records/i); assert.ok(!(await table.innerText()).includes('Stripe Inc.')); }
    if (fixture === 'register-restricted') { assert.match(await section.innerText(), /restricted|access/i); assert.ok(!(await section.innerText()).includes('Stripe Inc.')); }
    if (fixture === 'register-error') {
      assert.match(await section.innerText(), /unavailable|could not/i); assert.equal(await kpiAmount(page, 'unpaid'), 380828, 'An independent register error preserves successful dashboard metrics');
      control.fixture = 'full'; response = registerResponse(page); await section.getByRole('button', { name: /try again|retry/i }).click(); await response; await registerReady(page); assert.equal(await table.locator('tbody tr').count(), 8);
    }
    if (fixture === 'partial') { assert.match(await table.locator('tfoot').innerText(), /752,828/); assert.match(await table.locator('tfoot').innerText(), /372,000/); assert.match(await section.innerText(), /recorded|partial|missing/i); }
    await axe(page, fixture); if (fixture !== 'register-loading') await section.screenshot({ path: path.join(artifacts, `customer-invoices-${fixture}.png`), animations: 'disabled' }); await state.close();
  }
  record('Customer invoice loading, empty, access-restricted, partial and independent retry states remain accurate and accessible');
}

async function formulaChecks() {
  const state = await open({ fixture: 'formula' }); const { page, control } = state; await registerReady(page);
  const section = registerSection(page), table = section.getByRole('table', { name: 'Customer invoices', exact: true });
  for (const id of ['unpaid', 'overdue']) assert.equal(await kpiAmount(page, id), 9500, 'Only positive eligible L minus AA balances contribute to exposure');
  assert.equal(await kpiAmount(page, 'over90'), 7500);
  assert.match(await page.getByTestId('finance-kpi-unpaid').innerText(), /recorded|missing|partial/i);
  assert.doesNotMatch(await root(page).innerText(), /987,654|987654|Cancelled Example|Credit Note Example/, 'The stale stored balance and excluded invoices are never displayed');
  const invoice = id => table.locator('tbody tr').filter({ has: page.locator(`[data-field="invoice_number"] a[href="/finance/outgoing-invoices/${id}"]`) });
  const cell = (id, field) => invoice(id).locator(`[data-field="${field}"]`);
  assert.equal(await table.locator('tbody tr').count(), 6);
  assert.equal(await cell(901, 'amount').innerText(), '10,000'); assert.equal(await cell(901, 'actual_payment_received').innerText(), '2,500');
  assert.equal(await cell(902, 'actual_payment_received').innerText(), '—'); assert.match(await cell(902, 'actual_payment_received').getAttribute('title'), /zero/);
  assert.equal(await cell(903, 'amount').innerText(), '—', 'A missing source invoice amount cannot use grand total as fallback');
  assert.equal(await cell(903, 'actual_payment_received').innerText(), '100');
  assert.equal(await cell(905, 'amount').innerText(), '1,000'); assert.equal(await cell(905, 'actual_payment_received').innerText(), '1,250', 'Raw overpayments remain intact in the register');
  assert.equal(await cell(906, 'payment_status').innerText(), 'Paid'); assert.equal(await cell(906, 'days_overdue').innerText(), '0');
  assert.equal(await cell(901, 'days_overdue').innerText(), '143'); assert.equal(await cell(902, 'days_overdue').innerText(), '11');
  assert.match(await table.locator('tfoot').innerText(), /24,000/); assert.match(await table.locator('tfoot').innerText(), /7,850/);
  const initialTotals = await table.locator('tfoot').innerText();
  let pending = registerResponse(page); await section.getByRole('button', { name: 'Sort customer invoices by Actual Payment Received', exact: true }).click(); await pending; await registerReady(page);
  assert.equal(new URLSearchParams(registerRequests(control).at(-1).query).get('ordering'), 'actual_payment_received');
  assert.equal(await table.locator('tbody tr').last().locator('[data-field="actual_payment_received"]').innerText(), '—', 'Blank source receipts sort last');
  pending = registerResponse(page); await changeFilter(page, control, 'As of', '2026-09-20', true); await pending; await registerReady(page);
  assert.equal(new URLSearchParams(registerRequests(control).at(-1).query).get('as_of'), '2026-09-20');
  assert.equal(await cell(901, 'days_overdue').innerText(), '142'); assert.equal(await cell(902, 'days_overdue').innerText(), '10');
  assert.equal(await table.locator('tfoot').innerText(), initialTotals, 'Changing the reporting date updates days overdue without changing source totals');
  await page.getByLabel('More dashboard options', { exact: true }).click(); await page.getByText('Source coverage', { exact: true }).click();
  await page.getByRole('dialog').waitFor(); assert.match(await page.getByRole('dialog').innerText(), /Invoice Amount|column L/i); assert.match(await page.getByRole('dialog').innerText(), /Actual Payment Received|column AA/i);
  await page.keyboard.press('Escape');
  const downloadEvent = page.waitForEvent('download'); await root(page).getByRole('button', { name: /^Export/ }).click(); const download = await downloadEvent;
  const csv = await readFile(await download.path(), 'utf8'); assert.match(csv, /9500/); assert.doesNotMatch(csv, /987654/); assert.match(csv, /Invoice Amount|column L/i); assert.match(csv, /Actual Payment Received|column AA/i);
  await writeFile(path.join(artifacts, 'receivables-formula.csv'), csv);
  await axe(page, 'source-formula-and-fifteen-columns'); await section.screenshot({ path: path.join(artifacts, 'customer-invoices-formula.png'), animations: 'disabled' });
  await state.close(); record('Formula cases preserve raw source columns, ignore stored Y, handle blank receipts/missing L and update days overdue with the reporting date');
}

async function mobileRegisterStateChecks() {
  for (const fixture of ['register-error', 'register-empty', 'register-restricted', 'register-loading']) {
    const state = await open({ fixture: fixture === 'register-loading' ? 'full' : fixture, width: 390, registerLoading: fixture === 'register-loading' });
    const { page, control } = state, section = registerSection(page);
    if (fixture === 'register-loading') await section.waitFor(); else await registerReady(page);
    await section.scrollIntoViewIfNeeded();
    const geometry = await section.locator('.ar-customer-register-state > div').evaluate(node => { const box = element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width }; }; const scroller = node.closest('.ar-customer-register-scroll').getBoundingClientRect(); return { viewport: innerWidth, scroller: { left: scroller.left, right: scroller.right }, state: box(node), children: [...node.querySelectorAll('p, button')].map(element => ({ label: element.textContent, ...box(element) })) }; });
    geometries.push({ name: fixture, width: 390, registerState: geometry });
    await section.screenshot({ path: path.join(artifacts, `customer-invoices-mobile-${fixture}.png`), animations: 'disabled' });
    assert.ok(geometry.children.length > 0 && geometry.children.every(child => child.x >= geometry.scroller.left - 1 && child.right <= geometry.scroller.right + 1), `${fixture}: state text and retry remain visible in the mobile table viewport: ${JSON.stringify(geometry)}`);
    if (fixture === 'register-error') { control.fixture = 'full'; const pending = registerResponse(page); await section.getByRole('button', { name: /try again|retry/i }).click(); await pending; await registerReady(page); assert.equal(await section.locator('tbody tr').count(), 8); }
    if (fixture === 'register-loading') { await control.releaseRegister(); await registerReady(page); }
    await state.close();
  }
  record('Mobile customer invoice error, empty, access and loading messages remain visible within the table viewport');
}

try {
  await fixtureConsistency(); browser = await launchBrowser();
  if (!registerMobileOnly && !workflowsOnly) await visualChecks();
  if (!registerMobileOnly && !visualsOnly) { await workflowChecks(); await customerInvoiceChecks(); await formulaChecks(); }
  if (registerMobileOnly) await mobileRegisterStateChecks();
  await guards(); assert.deepEqual(runtimeErrors, [], 'No browser runtime errors'); assert.deepEqual(unexpectedRequests, [], 'Every request is read-only and explicitly mocked');
  await writeFile(path.join(artifacts, registerMobileOnly ? 'mobile-state-checks.json' : visualsOnly ? 'visual-checks.json' : workflowsOnly ? 'workflow-checks.json' : 'checks.json'), JSON.stringify({ passed: true, checks, runtimeErrors, unexpectedRequests, geometries, accessibility }, null, 2));
} catch (error) {
  for (const context of browser?.contexts() || []) { const page = context.pages()[0]; if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); }
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ error: error.stack, checks, runtimeErrors, unexpectedRequests, geometries, accessibility }, null, 2)); throw error;
} finally { await browser?.close(); }
