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
import { inlineLocalCssImports, checkArtifacts, historicalGuardsEnabled, launchBrowser, loadSnapshot, sidebarWidth, snapshotSources } from './ui-check-support.mjs';
import { FINANCE_CHECK_TIME, financeFixture, financeUser } from './check-finance-command-center-fixtures.mjs';

// Real Finance Command Center, service and shared shell; every network request is intercepted.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'finance-command-center');
const origin = 'http://finance-command-center-check.test';
const visualsOnly = process.argv.includes('--visuals-only');
const workflowsOnly = process.argv.includes('--workflows-only');
const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/components/Layout/Header.jsx', 'src/components/Layout/Layout.jsx', 'src/config/layout.config.js', 'src/config/navigationLabels.config.js', 'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js', 'src/pages/UserDetail.jsx', 'src/pages/Finance/ProcurementInvoiceTracker.jsx', 'src/services/finance.service.js', 'src/components/Finance/InvoiceContextPanel.jsx', 'src/components/Finance/IncomingInvoiceWorkspace.jsx', 'src/components/Finance/IncomingInvoiceReview.jsx', 'src/components/Finance/IncomingInvoiceReview.css', 'src/components/Finance/incomingInvoiceRegister.js', 'src/components/Finance/incomingReviewPresentation.js', 'src/pages/Finance/IncomingInvoices.css'];
await mkdir(artifacts, { recursive: true });
const startHashes = await snapshotSources(frontend, protectedFiles);
const historical = [...await loadSnapshot(frontend, path.join(artifacts, 'source-before-sha256.json'), historicalGuardsEnabled()), ...await loadSnapshot(frontend, path.join(artifacts, 'entry-source-before-sha256.json'), historicalGuardsEnabled())];
async function guards() {
  let approvedServiceAddition = false;
  for (const row of [...startHashes, ...historical.filter(row => row.Protected)]) {
    const bytes = await readFile(row.Path);
    const currentHash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
    if (historical.includes(row) && row.RelativePath === 'src/services/finance.service.js' && currentHash !== row.Hash) {
      const addedMethod = / {2}\/\*\* Read-only finance dashboard, with separate currencies and source permissions\. \*\/\r?\n {2}async getFinanceCommandCenter\(\) \{\r?\n {4}const response = await apiClient\.get\(`\$\{API_BASE\}\/dashboard\/command-center\/`\);\r?\n {4}return response\.data;\r?\n {2}\},\r?\n\r?\n/g;
      const source = bytes.toString('utf8'); assert.equal([...source.matchAll(addedMethod)].length, 1, 'Only the authorized read-only service method may be added');
      const original = await readFile(path.join(artifacts, 'source-before', row.RelativePath), 'utf8');
      assert.equal(source.replace(addedMethod, '').replaceAll('\r\n', '\n'), original.replaceAll('\r\n', '\n'), 'Existing finance service methods remain unchanged');
      approvedServiceAddition = true;
    } else assert.equal(currentHash, row.Hash, `Protected source changed: ${row.RelativePath}`);
  }
  for (const row of historical) assert.equal(createHash('sha256').update(await readFile(path.join(artifacts, 'source-before', row.RelativePath))).digest('hex').toUpperCase(), row.Hash, `Immutable baseline changed: ${row.RelativePath}`);
  await writeFile(path.join(artifacts, 'protected-source-checks.json'), JSON.stringify({ protectedFiles: protectedFiles.length, unchangedDuringRun: true, historicalGuardsEnabled: historicalGuardsEnabled(), immutableFiles: historical.length, approvedServiceAddition, serviceLineEndingsNormalizedForComparison: approvedServiceAddition }, null, 2));
}
await guards();
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';import InvoiceManagementHub from './src/pages/Finance/InvoiceManagementHub.jsx';
const state={auth:{user:window.financeUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{user:window.financeUser,roles:window.financeUser.roles,modules:[]}}};
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
  [/components[\\/]Layout[\\/]Footer\.jsx$/, 'export default function Footer(){return null;}'],
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
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finance command center browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const expectedSidebarWidth = await sidebarWidth(frontend);
const runtimeErrors = [], unexpectedRequests = [], checks = [], geometries = [], accessibility = [];
const record = message => { checks.push(message); console.log(`PASS: ${message}`); };
let browser;
async function newPage({ fixture = 'full', width = 1672, dark = false, loading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(FINANCE_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => {
    window.financeUser = user;
    window.financePrintCalls = 0;
    window.print = () => { window.financePrintCalls += 1; window.financePrintedText = document.querySelector('main')?.innerText; };
    localStorage.setItem('radai_access_token', 'isolated-finance-test-token');
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark));
  }, { user: financeUser, dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, loading, pending: [], requests: [], failure: null, deferNext: false };
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const respond = async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api\/v1/, '');
    control.requests.push({ method: request.method(), endpoint, query: url.search });
    if (request.method() !== 'GET') { unexpectedRequests.push(`Forbidden write ${request.method()} ${endpoint}`); return json(route, { detail: 'This fixture only permits read-only requests.' }, 409); }
    if (endpoint === '/finance/dashboard/command-center/') {
      if (control.loading) { control.pending.push(route); return; }
      const fixtureData = typeof control.fixture === 'string' ? financeFixture(control.fixture) : structuredClone(control.fixture);
      if (control.deferNext) { control.deferNext = false; await new Promise(resolve => { control.releaseNext = resolve; }); }
      const failure = control.failure || fixtureData.failure;
      if (failure) return json(route, { detail: failure === 403 ? 'Finance overview access is required.' : 'Synthetic finance source unavailable.' }, failure);
      return json(route, fixtureData.data);
    }
    if (endpoint === '/rbac/users/me/') return json(route, { user: financeUser, roles: financeUser.roles, modules: [] });
    if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
    unexpectedRequests.push(`${request.method()} ${endpoint}`); return json(route, { detail: 'Unmapped fixture request.' }, 404);
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) return respond(route);
    if (route.request().isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Report unmapped assets below. */ }
    }
    unexpectedRequests.push(route.request().url()); return route.abort();
  });
  control.release = async () => { control.loading = false; await Promise.all(control.pending.splice(0).map(respond)); };
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
const positions = page => page.locator('.finance-command-positions tbody tr');
async function loaded(page) { await root(page).waitFor(); await page.waitForFunction(() => document.querySelector('.finance-command-center')?.getAttribute('aria-busy') === 'false'); }
async function open(options) { const result = await newPage(options); if (!options?.loading) await loaded(result.page); return result; }
async function currency(page, code) { await page.getByLabel('Reporting currency', { exact: true }).selectOption(code); }
async function geometry(page, width, dark) {
  const result = await root(page).evaluate(element => {
    const box = node => { const bounds = node.getBoundingClientRect(); return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom }; };
    return { documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth + 1,
      contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      kpis: [...element.querySelectorAll('.finance-command-kpi')].map(box), actionRows: [...element.querySelectorAll('.finance-command-actions-table tbody tr')].map(box),
      trend: box(element.querySelector('[data-testid="finance-cash-working-capital-trend"]')), ageing: box(element.querySelector('[data-testid="finance-receivables-ageing"]')),
      ageingSvg: element.querySelector('[data-testid="finance-receivables-ageing-svg"]') ? box(element.querySelector('[data-testid="finance-receivables-ageing-svg"]')) : null,
      ageingBars: [...element.querySelectorAll('.finance-command-charts-age-bucket')].map(row => ({ label: box(row.querySelector('.finance-command-charts-age-label')), track: box(row.querySelector('.finance-command-charts-age-track')), bar: box(row.querySelector('.finance-command-charts-age-value')), amount: box(row.querySelector('.finance-command-charts-age-amount')), share: Number(row.querySelector('.finance-command-charts-age-value').getAttribute('data-share')) })),
      meters: [...element.querySelectorAll('.finance-command-progress [role="meter"]')].map(meter => ({ value: Number(meter.getAttribute('aria-valuenow')), track: box(meter), fill: box(meter.querySelector('i')), fillHeight: getComputedStyle(meter.querySelector('i')).height, fillBackground: getComputedStyle(meter.querySelector('i')).backgroundImage })),
      controls: box(element.querySelector('.finance-command-controls')), overflow: [...element.querySelectorAll('td .finance-command-row-action')].filter(node => { const cell = node.closest('td').getBoundingClientRect(), bounds = node.getBoundingClientRect(); return bounds.left < cell.left - 1 || bounds.right > cell.right + 1; }).map(node => node.textContent),
    };
  });
  geometries.push({ width, dark, ...result });
  assert.ok(result.documentFits && result.mainFits, `${width}: no page overflow`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth);
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
  assert.equal(result.kpis.length, 5); assert.deepEqual(result.overflow, [], 'Actions fit within their table cells');
  assert.ok(result.ageingSvg?.width >= 200 && result.ageingSvg.height >= 120, 'Available ageing plot uses chart dimensions rather than icon dimensions');
  assert.equal(result.ageingBars.length, 6, 'Each actual ageing bucket, including unknown dates, has a separate horizontal row');
  for (const [index, row] of result.ageingBars.entries()) {
    assert.ok(row.track.width > row.track.height && Math.abs(row.bar.x - row.track.x) < 1 && Math.abs(row.bar.height - row.track.height) < 1, 'Ageing values fill horizontal tracks from a common origin');
    assert.ok(Math.abs(row.bar.width / row.track.width * 100 - row.share) < 0.1, 'Horizontal length reflects the actual outstanding share');
    assert.ok(row.label.right <= row.track.x && row.amount.x >= row.track.right, 'Age labels sit left of tracks and amounts sit right without overlap');
    if (index) assert.ok(row.track.y > result.ageingBars[index - 1].track.bottom, 'Ageing rows remain vertically separated');
  }
  assert.ok(result.meters.filter(meter => meter.value > 0).every(meter => meter.fill.width > 0 && meter.fill.height > 0), 'Known positive process shares have visible meter fills');
  if (width >= 1440) { assert.equal(new Set(result.kpis.map(card => Math.round(card.y))).size, 1, 'Five outcomes remain on one desktop row'); assert.ok(result.ageing.x > result.trend.x + result.trend.width - 1, 'Cash trend and ageing remain side by side'); }
  if (width === 1672) {
    // The approved 13px table text can move the decorative strip edge just below
    // the fold. Preserve density; verify the full strip and action are reachable.
    assert.ok(result.controls.y < 941, 'Desktop controls begin within the viewport');
    const controls = page.locator('.finance-command-controls');
    const scrollState = await page.evaluate(() => {
      window.financeCheckScrollState = [...document.querySelectorAll('html,body,main,main *')]
        .filter(node => node.scrollTop || node.scrollLeft).map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }));
      return { x: scrollX, y: scrollY };
    });
    await controls.scrollIntoViewIfNeeded();
    const button = controls.getByRole('button', { name: 'View controls', exact: true });
    await button.focus();
    result.controlsReachable = await controls.evaluate(node => {
      const bounds = node.getBoundingClientRect(), main = document.querySelector('main').getBoundingClientRect();
      const action = node.querySelector('button'), actionBounds = action.getBoundingClientRect();
      return { fullyVisible: bounds.top >= Math.max(0, main.top) && bounds.bottom <= Math.min(innerHeight, main.bottom) + 1,
        actionVisible: actionBounds.top >= 0 && actionBounds.bottom <= innerHeight, actionFocused: document.activeElement === action };
    });
    geometries.at(-1).controlsReachable = result.controlsReachable;
    assert.deepEqual(result.controlsReachable, { fullyVisible: true, actionVisible: true, actionFocused: true });
    await page.evaluate(position => {
      document.activeElement?.blur();
      for (const node of document.querySelectorAll('html,body,main,main *')) { node.scrollTop = 0; node.scrollLeft = 0; }
      for (const row of window.financeCheckScrollState) row.node.scrollTo({ top: row.top, left: row.left, behavior: 'instant' });
      delete window.financeCheckScrollState;
      window.scrollTo(position.x, position.y);
    }, scrollState);
  }
}
async function axe(page, name) {
  const result = await new AxeBuilder({ page }).include('.finance-command-center').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  accessibility.push({ name, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
  assert.deepEqual(result.violations.map(item => item.id), [], `${name}: no accessibility violations`);
}
async function visualChecks() {
  for (const width of [1672, 1440, 1024, 390]) {
    const state = await open({ width }); await capture(state.page, `finance-command-center-${width}`); await geometry(state.page, width, false); await axe(state.page, `light-${width}`); await state.close();
    record(`${width}px light layout, five outcomes, charts and accessible controls`);
  }
  const state = await open({ dark: true }); await capture(state.page, 'finance-command-center-dark'); await geometry(state.page, 1672, true); await axe(state.page, 'dark-1672'); await state.close();
  record('Dark theme retains readable metrics, charts and tables');
}
async function workflowChecks() {
  let state = await open(); let { page, control } = state;
  assert.equal(await kpi(page, 'cash').innerText(), '—'); assert.equal(await kpi(page, 'working_capital').innerText(), '—');
  assert.equal(await kpi(page, 'receivables').innerText(), 'AED 125K'); assert.equal(await kpi(page, 'payables').innerText(), 'AED 80K'); assert.equal(await kpi(page, 'overdue').innerText(), 'AED 55K');
  assert.equal(await page.getByTestId('finance-cash-trend-svg').count(), 0, 'Missing history never becomes a fabricated trend');
  assert.equal(await page.getByTestId('finance-ageing-bar-current').getAttribute('data-amount'), '60000');
  assert.equal(await page.getByTestId('finance-ageing-bar-unknown_due_date').getAttribute('data-amount'), '10000');
  const ageing = page.getByTestId('finance-receivables-ageing'); await ageing.getByText('View chart data', { exact: true }).click(); assert.ok((await ageing.getByRole('table').innerText()).includes('60,000')); await ageing.getByText('View chart data', { exact: true }).click();
  await currency(page, 'USD'); assert.equal(await kpi(page, 'receivables').innerText(), 'USD 30K'); assert.equal(await kpi(page, 'payables').innerText(), 'USD 35K');
  assert.equal(await page.getByTestId('finance-ageing-bar-days_31_60').getAttribute('data-amount'), '0');
  const usdRow = positions(page).filter({ has: page.getByRole('rowheader', { name: 'USD', exact: true }) }); assert.ok((await usdRow.innerText()).includes('USD -5,000.00'));
  await currency(page, 'EUR'); assert.equal(await kpi(page, 'receivables').innerText(), 'EUR 0.00'); assert.equal(await kpi(page, 'payables').innerText(), 'EUR 23K');
  await currency(page, 'AED');
  record('Original currencies, known absent-group zero, ageing buckets and unknown cash/history remain distinct');

  assert.equal(await page.locator('.finance-command-actions-table tbody tr').count(), 3);
  await page.getByRole('button', { name: /^View all 6 actions/ }).click();
  let dialog = page.getByRole('dialog', { name: 'Financial report', exact: true }); await dialog.waitFor();
  assert.equal(await dialog.locator('.finance-command-actions-table tbody tr').count(), 6); assert.ok((await dialog.innerText()).includes('Not recorded'));
  await axe(page, 'financial-report-dialog');
  await dialog.getByRole('button', { name: 'Close financial dialog', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog'))), true, 'Native report dialog contains keyboard focus');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog'))), true, 'Forward Tab also wraps inside the report');
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
  assert.ok((await page.evaluate(() => document.activeElement?.textContent || '')).startsWith('View all 6 actions'), 'Closing the report restores its trigger');
  await page.getByRole('button', { name: 'View controls', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Forecast, controls and source coverage', exact: true }); await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes('does not measure ledger completeness or cash accuracy')); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  record('Full action report, source definitions, keyboard focus and dialog restoration');

  await currency(page, 'USD'); const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
  const download = await downloadPromise; const stream = await download.createReadStream(); const parts = []; for await (const chunk of stream) parts.push(chunk); const pdf = Buffer.concat(parts);
  assert.ok(pdf.subarray(0, 5).toString() === '%PDF-'); assert.ok(download.suggestedFilename().endsWith('-USD.pdf'));
  const text = pdf.toString('latin1'); assert.ok(text.includes('Finance Command Center')); assert.ok(text.includes('Selected currency: USD')); assert.ok(text.includes('Cash forecast accuracy')); assert.ok(/ageing/i.test(text), 'PDF includes selected-currency ageing');
  await writeFile(path.join(artifacts, download.suggestedFilename()), pdf); await page.getByText('Financial report exported.', { exact: true }).waitFor();
  assert.ok(control.requests.every(request => request.method === 'GET'));
  await page.locator('.finance-command-actions').getByRole('link', { name: 'Review', exact: true }).click(); await page.getByRole('heading', { name: 'Source destination', exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.financeRoute), '/finance/outgoing-invoices');
  await state.close(); record('Real PDF download reflects selected currency and existing register navigation performs no writes');

  for (const fixture of ['loading', 'empty', 'zero', 'incomplete', 'unknown-currency', 'receivables-restricted', 'payables-error', 'both-restricted', 'error', 'forbidden']) {
    state = await open({ fixture: fixture === 'loading' ? 'full' : fixture, loading: fixture === 'loading' }); ({ page, control } = state);
    if (fixture === 'loading') { assert.equal(await kpi(page, 'receivables').innerText(), '—'); assert.equal(await page.getByRole('button', { name: 'Export PDF', exact: true }).isDisabled(), true); await control.release(); await loaded(page); assert.equal(await kpi(page, 'receivables').innerText(), 'AED 125K'); }
    if (fixture === 'empty' || fixture === 'zero') {
      assert.equal(await page.getByLabel('Reporting currency', { exact: true }).locator('option[value="AED"]').count(), 0, 'No original currency is invented for an empty exposure cohort');
      await page.getByText('No open receivables', { exact: true }).waitFor(); assert.equal(await page.getByTestId('finance-receivables-ageing-svg').count(), 0);
      const meters = page.locator('.finance-command-progress [role="meter"]');
      if (fixture === 'empty') assert.equal(await meters.count(), 0, 'An empty denominator does not imply a measured 0% or100%');
      else { assert.equal(await meters.count(), 1); assert.equal(await meters.getAttribute('aria-valuenow'), '0', 'Settled records retain a genuine zero share of outstanding invoices'); }
      assert.equal(await kpi(page, 'cash').innerText(), '—');
    }
    if (fixture === 'incomplete') {
      assert.equal(await kpi(page, 'receivables').innerText(), 'AED 125K'); await currency(page, 'USD'); assert.equal(await kpi(page, 'receivables').innerText(), '—'); assert.equal(await page.getByTestId('finance-receivables-ageing-svg').count(), 0);
      assert.equal(await kpi(page, 'payables').innerText(), 'USD 35K');
    }
    if (fixture === 'unknown-currency') {
      assert.ok((await positions(page).allTextContents()).every(text => text.includes('—')), 'Missing original units withhold every net exposure'); await currency(page, 'UNSPECIFIED'); assert.equal(await kpi(page, 'receivables').innerText(), '—'); assert.equal(await page.getByTestId('finance-receivables-ageing-svg').count(), 0);
    }
    if (fixture === 'receivables-restricted') { assert.equal(await kpi(page, 'receivables').innerText(), '—'); assert.equal(await kpi(page, 'payables').innerText(), 'AED 80K'); assert.equal(await root(page).locator('a[href="/finance/outgoing-invoices"]').count(), 0); }
    if (fixture === 'payables-error') { assert.equal(await kpi(page, 'payables').innerText(), '—'); assert.equal(await kpi(page, 'receivables').innerText(), 'AED 125K'); assert.equal(await page.locator('.finance-command-health [role="meter"]').count(), 1); }
    if (fixture === 'both-restricted') { assert.equal(await kpi(page, 'receivables').innerText(), '—'); assert.equal(await kpi(page, 'payables').innerText(), '—'); assert.equal(await root(page).getByRole('link').count(), 0); }
    if (fixture === 'error' || fixture === 'forbidden') {
      await page.locator('.finance-command-notice-error').waitFor(); assert.equal(await kpi(page, 'receivables').innerText(), '—'); assert.equal(await page.getByRole('button', { name: 'Export PDF', exact: true }).isDisabled(), true); await capture(page, `state-${fixture}`);
      control.fixture = 'full'; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await loaded(page); assert.equal(await kpi(page, 'receivables').innerText(), 'AED 125K');
    } else if (fixture !== 'loading') await capture(page, `state-${fixture}`);
    await state.close();
  }
  record('Loading, empty/settled, incomplete currencies, independent grants, unknown units and errors preserve source truth');
  state = await open(); ({ page, control } = state); control.failure = 503; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page);
  assert.equal(await kpi(page, 'receivables').innerText(), '—'); assert.equal(await positions(page).count(), 0); assert.equal(await page.getByTestId('finance-receivables-ageing-svg').count(), 0);
  control.failure = null; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await loaded(page); assert.equal(await kpi(page, 'receivables').innerText(), 'AED 125K'); await state.close();
  record('Refresh failures remove stale financial values, charts and positions until retry succeeds');
}

try {
  browser = await launchBrowser();
  if (!workflowsOnly) await visualChecks();
  if (!visualsOnly) await workflowChecks();
  await guards(); assert.deepEqual(runtimeErrors, [], 'No browser runtime errors'); assert.deepEqual(unexpectedRequests, [], 'Every request is read-only and explicitly mocked');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: true, checks, runtimeErrors, unexpectedRequests, geometries, accessibility }, null, 2));
} catch (error) {
  for (const context of browser?.contexts() || []) { const page = context.pages()[0]; if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); }
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ error: error.stack, checks, runtimeErrors, unexpectedRequests, geometries, accessibility }, null, 2)); throw error;
} finally { await browser?.close(); }
