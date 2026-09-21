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
import { OUTGOING_CHECK_TIME, outgoingFixture, outgoingSummary, filterOutgoingRows, outgoingUser } from './check-outgoing-invoices-fixtures.mjs';

// Real Outgoing Invoice page, service and shared shell; all network traffic stays in this fixture context.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'outgoing-invoices');
const origin = 'http://outgoing-invoices-check.test';
const visualsOnly = process.argv.includes('--visuals-only');
const workflowsOnly = process.argv.includes('--workflows-only');
const sourcesOnly = process.argv.includes('--sources-only');
const selectedViewport = Number(process.argv.find(value => value.startsWith('--viewport='))?.split('=')[1]) || null;
const protectedFiles = ["src/components/Layout/Sidebar.jsx", "src/components/Layout/Sidebar.css", "src/components/Layout/Header.jsx", "src/components/Layout/Layout.jsx", "src/config/layout.config.js", "src/config/navigationLabels.config.js", "src/hooks/useSidebarLayout.js", "src/hooks/useSidebarDrawer.js", "src/pages/UserDetail.jsx", "src/pages/Finance/ProcurementInvoiceTracker.jsx", "src/components/Finance/InvoiceContextPanel.jsx", "src/components/Finance/IncomingInvoiceWorkspace.jsx", "src/components/Finance/IncomingInvoiceReview.jsx", "src/components/Finance/IncomingInvoiceReview.css", "src/components/Finance/incomingInvoiceRegister.js", "src/components/Finance/incomingReviewPresentation.js", "src/pages/Finance/IncomingInvoices.css", "src/pages/Finance/InvoiceManagementHub.jsx", "src/components/Finance/FinanceCommandCenter.jsx", "src/components/Finance/FinanceCommandCenter.css", "src/components/Finance/financeCommandPresentation.js", "src/components/Finance/financeCommandPdf.js", "src/components/Finance/FinanceCommandCharts.jsx", "src/components/Finance/FinanceCommandCharts.css", "src/components/Finance/financeCommandChartPresentation.js", "src/services/finance.service.js"];
await mkdir(artifacts, { recursive: true });
const startHashes = await snapshotSources(frontend, protectedFiles);
const historical = await loadSnapshot(frontend, path.join(artifacts, 'source-before-sha256.json'), historicalGuardsEnabled());
async function guards() {
  for (const row of [...startHashes, ...historical.filter(row => row.Protected)]) {
    assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Protected source changed: ${row.RelativePath}`);
  }
  for (const row of historical) assert.equal(createHash('sha256').update(await readFile(path.join(artifacts, 'source-before', row.RelativePath))).digest('hex').toUpperCase(), row.Hash, `Immutable baseline changed: ${row.RelativePath}`);
  await writeFile(path.join(artifacts, 'protected-source-checks.json'), JSON.stringify({ protectedFiles: protectedFiles.length, unchanged: true, historicalGuardsEnabled: historicalGuardsEnabled(), immutableFiles: historical.length }, null, 2));
}
await guards();
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';import InvoiceTracker from './src/pages/Finance/InvoiceTracker.jsx';
const state={auth:{user:window.outgoingUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{user:window.outgoingUser,roles:window.outgoingUser.roles,modules:[]}}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
function Observer(){const location=useLocation();window.outgoingRoute=location.pathname+location.search;return null;}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/finance/outgoing-invoices']}><Observer/><Routes><Route element={<Layout/>}><Route path='/finance/outgoing-invoices' element={<InvoiceTracker/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
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
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Outgoing invoices"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'outgoing-invoice-fixture', setup(builder) { builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' })); for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' })); } }] });
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(path.join(frontend, directory), { withFileTypes: true })) { const file = `${directory}/${entry.name}`; if (entry.isDirectory()) result.push(...await filesIn(file)); else result.push(file); }
  return result;
}
const componentFiles = [...await filesIn('src/components/Layout'), ...await filesIn('src/components/Finance'), ...await filesIn('src/pages/Finance'), 'src/config/layout.config.js'];
const classSources = await Promise.all(componentFiles.filter(file => /\.[jm]sx?$/.test(file)).map(file => readFile(path.join(frontend, file), 'utf8')));
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Outgoing invoice browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const expectedSidebarWidth = await sidebarWidth(frontend);
let browser;
const runtimeErrors = [], unexpectedRequests = [], allMutations = [], checks = [], geometries = [], accessibility = [];
const record = message => { checks.push(message); console.log(`PASS: ${message}`); };
async function newPage({ fixture = 'full', width = 1672, dark = false, loading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(OUTGOING_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => { window.outgoingUser = user; localStorage.setItem('radai_access_token', 'isolated-outgoing-test-token'); document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark)); }, { user: outgoingUser, dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, requests: [], expectedMutations: [], mutations: [], failures: {}, detailOverrides: {}, deferredDetails: new Map(), loading, listPending: [] };
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const respond = async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api\/v1/, '');
    const fixtureData = typeof control.fixture === 'string' ? outgoingFixture(control.fixture) : structuredClone(control.fixture);
    const method = request.method(), rawBody = request.postData(); let body = rawBody;
    try { body = rawBody ? JSON.parse(rawBody) : null; } catch { /* Keep synthetic multipart upload intact for assertions. */ }
    control.requests.push({ method, endpoint, query: url.search, body });
    if (method !== 'GET') {
      const mutation = { method, endpoint, body }; control.mutations.push(mutation); allMutations.push(mutation);
      const expected = control.expectedMutations.shift();
      if (!expected || expected.method !== method || expected.endpoint !== endpoint) { unexpectedRequests.push(`Unexpected ${method} ${endpoint}`); return json(route, { detail: 'Unrequested synthetic mutation refused.' }, 409); }
      return json(route, expected.data || { rows_created: 1, rows_updated: 0, rows_skipped: 0, errors: [] }, expected.status || 200);
    }
    if (control.failures[endpoint]) return json(route, { detail: 'Synthetic outgoing source unavailable.' }, control.failures[endpoint]);
    if (endpoint === '/rbac/users/me/') return json(route, { user: outgoingUser, roles: outgoingUser.roles, modules: [] });
    if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
    if (endpoint === '/invoice-tracker/invoices/' || endpoint === '/invoice-tracker/invoices/collections-summary/') {
      if (control.loading) { control.listPending.push(route); return; }
      if (fixtureData.failure) return json(route, { detail: fixtureData.failure === 403 ? 'Outgoing invoice access is required.' : 'Synthetic outgoing register unavailable.' }, fixtureData.failure);
      if (endpoint.endsWith('/collections-summary/')) {
        const summary = fixtureData.summary || outgoingSummary(fixtureData.rows, url.searchParams);
        if ('capabilities' in fixtureData) summary.capabilities = fixtureData.capabilities;
        return json(route, summary);
      }
      const filtered = filterOutgoingRows(fixtureData.rows, url.searchParams), number = Math.max(1, Number(url.searchParams.get('page')) || 1), size = Math.min(200, Math.max(1, Number(url.searchParams.get('page_size')) || 50));
      if (number > 1 && (number - 1) * size >= filtered.length) return json(route, { detail: 'Invalid page.' }, 404);
      return json(route, { count: fixtureData.count ?? filtered.length, next: number * size < filtered.length ? `${origin}/api/v1/invoice-tracker/invoices/?page=${number + 1}` : null, previous: number > 1 ? `${origin}/api/v1/invoice-tracker/invoices/?page=${number - 1}` : null, results: filtered.slice((number - 1) * size, number * size) });
    }
    const detailMatch = endpoint.match(/^\/invoice-tracker\/invoices\/(\d+)\/$/);
    if (detailMatch) {
      const id = Number(detailMatch[1]), row = fixtureData.rows.find(item => item.id === id);
      if (control.deferredDetails.has(id)) await new Promise(resolve => control.deferredDetails.set(id, resolve));
      return json(route, control.detailOverrides[id] || row || { detail: 'Synthetic invoice not found.' }, row ? 200 : 404);
    }
    unexpectedRequests.push(`${method} ${endpoint}`); return json(route, { detail: 'Unmapped isolated fixture request.' }, 404);
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) return respond(route);
    if (route.request().isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Report unknown assets below. */ }
    }
    unexpectedRequests.push(route.request().url()); return route.abort();
  });
  control.releaseList = async () => { control.loading = false; await Promise.all(control.listPending.splice(0).map(respond)); };
  await page.goto(origin);
  return { page, control, close: () => context.close() };
}
async function capture(page, name) {
  await page.locator('main.main-content').evaluate(main => { for (const node of [main, ...main.querySelectorAll('*')]) if (node.scrollTop || node.scrollLeft) node.scrollTo({ top: 0, left: 0, behavior: 'instant' }); window.scrollTo(0, 0); });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), animations: 'disabled' });
}
const workspace = page => page.locator('.outgoing-collections');
const rows = page => page.locator('.oc-table tbody tr');
const review = page => page.getByTestId('outgoing-invoice-review');
const focusedText = page => page.evaluate(() => document.activeElement?.tagName === 'BODY' ? 'BODY' : document.activeElement?.textContent?.trim().slice(0, 100));
async function loaded(page) {
  await workspace(page).waitFor();
  await page.waitForFunction(() => {
    const root = document.querySelector('.outgoing-collections');
    const refresh = [...root.querySelectorAll('button')].find(button => button.textContent.trim() === 'Refresh');
    return root.getAttribute('aria-busy') !== 'true' && refresh && !refresh.disabled;
  });
}
async function open(options) { const state = await newPage(options); if (!options?.loading) await loaded(state.page); return state; }
async function detailReady(page, id) {
  await review(page).getByRole('heading', { name: `AR-SYN-${id}`, exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.outgoing-review-body')?.getAttribute('aria-busy') === 'false');
}
async function select(page, id) { await page.getByRole('button', { name: `Review invoice AR-SYN-${id}`, exact: true }).click(); await detailReady(page, id); }
async function queue(page, id) { await page.getByLabel('Collection queue', { exact: true }).selectOption(id); await loaded(page); }
async function clear(page) { await page.getByRole('button', { name: 'Clear', exact: true }).click(); await loaded(page); }
async function expectRows(page, expected) { await page.waitForFunction(count => document.querySelectorAll('.oc-table tbody tr').length === count, expected); assert.equal(await rows(page).count(), expected); }
async function axe(page, name, selector = '.outgoing-collections') {
  const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  accessibility.push({ name, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
  assert.deepEqual(result.violations.map(item => item.id), [], `${name}: no accessibility violations`);
}
async function geometry(page, width, dark) {
  const result = await workspace(page).evaluate(root => {
    const rect = node => { if (!node) return null; const bounds = node.getBoundingClientRect(); return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom }; };
    const main = document.querySelector('main.main-content');
    return { documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: main.scrollWidth <= main.clientWidth + 1, mainWidth: { scroll: main.scrollWidth, client: main.clientWidth }, heading: rect(root.querySelector('.oc-page-heading')), headerActions: rect(root.querySelector('.oc-page-actions')),
      contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      table: rect(root.querySelector('.oc-table')), register: rect(root.querySelector('.oc-register')), review: rect(root.querySelector('[data-testid="outgoing-invoice-review"]')), reviewFooter: rect(root.querySelector('.outgoing-review-footer')), health: rect(root.querySelector('.oc-health')),
      rowHeights: [...root.querySelectorAll('.oc-table tbody tr')].map(row => row.getBoundingClientRect().height),
      overflow: [...root.querySelectorAll('.oc-table td button')].filter(button => { const cell = button.closest('td').getBoundingClientRect(), bounds = button.getBoundingClientRect(); return bounds.left < cell.left - 1 || bounds.right > cell.right + 1; }).map(button => button.textContent),
      escaped: [...root.querySelectorAll('*')].filter(node => !node.closest('.oc-table-scroll') && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().right > root.getBoundingClientRect().right - 5).map(node => ({ tag: node.tagName, className: node.getAttribute('class'), ...rect(node), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth })).slice(0, 20),
    };
  });
  geometries.push({ width, dark, ...result });
  assert.ok(result.documentFits && result.mainFits, `${width}: no page overflow`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth);
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
  assert.deepEqual(result.overflow, [], 'Row actions stay within their cells');
  if (width >= 1440) { assert.ok(result.rowHeights.every(height => height <= 64), 'Outgoing invoice rows remain dense'); assert.ok(result.review && result.review.x >= result.register.right, 'Desktop review remains beside the register'); }
  if (width === 1672) assert.ok(result.reviewFooter?.bottom <= 941, 'Desktop collection review actions remain above the fold');
}
async function visualChecks() {
  for (const width of selectedViewport ? [selectedViewport] : [1672, 1440, 1024, 390]) {
    const state = await open({ width }); await capture(state.page, `outgoing-invoices-${width}`); await geometry(state.page, width, false); await axe(state.page, `light-${width}`); await state.close();
    record(`${width}px light register, review, dense rows and accessible controls`);
  }
  if (selectedViewport && selectedViewport !== 1672) return;
  const state = await open({ dark: true }); await capture(state.page, 'outgoing-invoices-dark'); await geometry(state.page, 1672, true); await axe(state.page, 'dark-1672'); await state.close();
  record('Dark theme retains readable invoice values and review details');
}
async function workflowChecks() {
  let state = await open(); let { page, control } = state;
  const fixture = outgoingFixture(), totals = outgoingSummary(fixture.rows);
  const queueNames = { open: 'All open', overdue: 'Overdue', due_soon: 'Due this week', partial: 'Partially paid', paid: 'Settled' };
  for (const [id, label] of Object.entries(queueNames)) assert.ok((await page.locator('.oc-queues').getByRole('button', { name: new RegExp(`^${label}`) }).innerText()).includes(String(totals.counts[id])), `${label} uses complete authorized counts`);
  assert.equal(await page.locator('.oc-queues').getByRole('button', { name: /^Disputed/ }).isDisabled(), true);
  assert.ok((await page.locator('.oc-queues').getByRole('button', { name: /^Disputed/ }).innerText()).includes('—'));
  await expectRows(page, 7); await detailReady(page, 201);
  assert.equal(await page.getByTestId('outgoing-review-outstanding').innerText(), 'AED 105,000.00');
  assert.ok(!(await review(page).getByTestId('outgoing-review-timeline').innerText()).includes('Sent'), 'Missing sent date never becomes a sent event');
  assert.equal(await review(page).getByRole('link', { name: 'AR-SYN-201.pdf', exact: true }).count(), 0, 'Missing attachment URL is never replaced with an invented link');
  assert.equal(await page.getByRole('button', { name: 'Next invoice page', exact: true }).isDisabled(), false);
  await page.getByRole('button', { name: 'Next invoice page', exact: true }).click(); await loaded(page); await expectRows(page, totals.counts.overdue - 7);
  assert.ok(control.requests.some(request => request.endpoint === '/invoice-tracker/invoices/' && new URLSearchParams(request.query).get('page') === '2'));
  await page.getByRole('button', { name: 'Previous invoice page', exact: true }).click(); await loaded(page);
  await page.getByLabel('Rows per page', { exact: true }).selectOption('15'); await loaded(page); await expectRows(page, totals.counts.overdue);
  await page.getByLabel('Rows per page', { exact: true }).selectOption('7'); await loaded(page);
  await page.getByRole('button', { name: 'Close collection review', exact: true }).click(); assert.equal(await review(page).count(), 0);
  await select(page, 201);
  await queue(page, 'partial'); await expectRows(page, totals.counts.partial);
  await queue(page, 'paid'); await expectRows(page, totals.counts.paid);
  await queue(page, 'all'); await page.getByLabel('Search outgoing invoices', { exact: true }).fill('AR-SYN-203'); await loaded(page); await expectRows(page, 1);
  assert.ok((await rows(page).innerText()).includes('AR-SYN-203'));
  await clear(page); await queue(page, 'all');
  const baseHeight = await rows(page).first().evaluate(row => row.getBoundingClientRect().height);
  await page.getByLabel('Table density', { exact: true }).selectOption('comfortable');
  await page.waitForFunction(height => document.querySelector('.oc-table.oc-comfortable tbody tr')?.getBoundingClientRect().height > height, baseHeight);
  await page.getByLabel('Table density', { exact: true }).selectOption('compact'); await page.locator('.oc-table.oc-compact').waitFor();
  await page.getByRole('button', { name: 'Invoice', exact: true }).click(); await loaded(page);
  assert.ok((await rows(page).first().innerText()).includes('AR-SYN-201'));
  await page.getByRole('button', { name: 'Invoice', exact: true }).click(); await loaded(page);
  assert.ok((await rows(page).first().innerText()).includes('AR-SYN-216'));
  record('Complete queue counts, server pagination, search, sorting, density and review reopening work');

  await clear(page); await queue(page, 'all');
  for (const [label, value, key] of [['Company', 'Rejlers Finland', 'company'], ['Project manager', 'Jordan Lee', 'pm'], ['Ageing bucket', 'unknown_due_date', 'ageing'], ['Status', 'partial', 'payment_status'], ['Currency', 'USD', 'currency']]) {
    await page.getByRole('region', { name: 'Invoice filters', exact: true }).getByLabel(label, { exact: true }).selectOption(value); await loaded(page);
    const expected = filterOutgoingRows(fixture.rows, new URLSearchParams({ queue: 'all', [key]: value })); await expectRows(page, Math.min(7, expected.length));
    assert.ok(control.requests.some(request => request.endpoint === '/invoice-tracker/invoices/' && new URLSearchParams(request.query).get(key) === value));
    await clear(page); await queue(page, 'all');
  }
  await page.getByRole('button', { name: 'More filters', exact: true }).click();
  await page.getByLabel('Category', { exact: true }).selectOption('internal'); await loaded(page); await expectRows(page, fixture.rows.filter(row => row.category === 'internal').length);
  await page.getByLabel('Customer account', { exact: true }).fill('Rejlers'); await loaded(page);
  await page.locator('.oc-more-filters').getByLabel('Project reference', { exact: true }).fill('RAD-26-305'); await loaded(page); await expectRows(page, 1);
  await clear(page); await queue(page, 'all');
  await page.getByLabel('Invoice date from', { exact: true }).fill('2026-09-13'); await loaded(page); await expectRows(page, fixture.rows.filter(row => row.invoice_date >= '2026-09-13').length);
  await clear(page); await page.getByRole('button', { name: 'More filters', exact: true }).click();
  record('Company, project manager, ageing, status, original currency and advanced filters reach the server');

  await page.getByLabel('Health currency', { exact: true }).selectOption('USD');
  await page.getByRole('button', { name: 'View ageing analysis', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Receivables ageing', exact: true }); await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes('USD')); assert.ok((await dialog.innerText()).includes('Due date unknown'));
  await axe(page, 'ageing-dialog');
  await dialog.getByRole('button', { name: 'Close ageing analysis', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await focusedText(page), 'Close', 'Ageing dialog wraps backwards to its final control');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close ageing analysis');
  await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 0);
  record('Original-currency ageing and native dialog focus remain accessible');

  await queue(page, 'all'); await page.getByLabel('Select invoice AR-SYN-201', { exact: true }).check();
  let downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); let download = await downloadEvent;
  await download.saveAs(path.join(artifacts, 'selected-outgoing-invoices.csv')); let csv = await readFile(await download.path(), 'utf8');
  assert.ok(csv.includes('AR-SYN-201')); assert.ok(!csv.includes('AR-SYN-202')); assert.ok(csv.includes('AED')); assert.ok(csv.includes('105000'));
  await page.getByLabel('Select invoice AR-SYN-201', { exact: true }).uncheck();
  downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); download = await downloadEvent;
  await download.saveAs(path.join(artifacts, 'filtered-outgoing-invoices.csv')); csv = await readFile(await download.path(), 'utf8');
  assert.ok(csv.includes('AR-SYN-216')); assert.equal(csv.trim().split('\r\n').length, fixture.rows.length + 1); assert.ok(csv.includes('USD') && csv.includes('EUR'));
  assert.ok(control.requests.some(request => request.endpoint === '/invoice-tracker/invoices/' && new URLSearchParams(request.query).get('page_size') === '200'));
  assert.equal(control.mutations.length, 0);
  record('Selected and complete filtered CSV exports preserve original currencies without business writes');
  await state.close();

  state = await open(); ({ page, control } = state);
  control.deferredDetails.set(202, null); await page.getByRole('button', { name: 'Review invoice AR-SYN-202', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.outgoing-review-body')?.getAttribute('aria-busy') === 'true');
  await select(page, 203); const release = control.deferredDetails.get(202); assert.equal(typeof release, 'function'); release();
  await page.waitForResponse(response => response.url().endsWith('/invoice-tracker/invoices/202/')); await detailReady(page, 203);
  assert.equal(await page.getByTestId('outgoing-review-outstanding').innerText(), 'AED 94,500.00');
  control.detailOverrides[201] = { ...fixture.rows[0], id: 999 }; await select(page, 201); await review(page).getByText('Invoice could not be loaded', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('outgoing-review-outstanding').count(), 0);
  delete control.detailOverrides[201]; await review(page).getByRole('button', { name: 'Retry invoice details', exact: true }).click(); await detailReady(page, 201);
  await review(page).getByRole('button', { name: 'Open invoice', exact: true }).click(); await page.waitForFunction(() => window.outgoingRoute === '/finance/outgoing-invoices/201');
  assert.equal(control.mutations.length, 0); await state.close();
  record('Late and mismatched invoice details are suppressed; retry and existing detail navigation work');

  const formulaRow = { ...fixture.rows[0], currency: 'AED', invoice_amount: '100.00', actual_payment_received: '40.00', calculated_receivable_balance: '60.00', balance_to_be_received: '999.00', payment_status: 'partial' };
  state = await open({ fixture: { rows: [formulaRow], summary: outgoingSummary([{ ...formulaRow, balance_to_be_received: '60.00' }]) } }); ({ page, control } = state);
  await detailReady(page, 201);
  assert.equal(await rows(page).locator('.oc-money').innerText(), 'AED 60.00');
  assert.equal(await page.getByTestId('outgoing-review-outstanding').innerText(), 'AED 60.00');
  downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); download = await downloadEvent;
  csv = await readFile(await download.path(), 'utf8'); assert.ok(csv.includes('"60.00"')); assert.ok(!csv.includes('999.00'));
  await state.close();
  state = await open({ fixture: { rows: [{ ...formulaRow, invoice_amount: null, calculated_receivable_balance: null }] } }); ({ page } = state);
  await detailReady(page, 201);
  assert.equal(await rows(page).locator('.oc-money').innerText(), '—');
  assert.equal(await page.getByTestId('outgoing-review-outstanding').innerText(), '—');
  await state.close();
  record('Collection rows, review and CSV use calculated L minus AA without falling back to stale Y');
}
async function sourceChecks() {
  let state = await open({ loading: true }); let { page, control } = state;
  await page.getByText('Loading the collection queue…', { exact: true }).waitFor(); assert.equal(await rows(page).count(), 0); assert.equal(await review(page).count(), 0);
  await control.releaseList(); await loaded(page); await expectRows(page, 7); await state.close();
  for (const fixture of ['empty', 'zero', 'missing', 'error', 'forbidden']) {
    state = await open({ fixture }); ({ page, control } = state);
    if (['error', 'forbidden'].includes(fixture)) {
      await page.getByText('Invoices could not be loaded', { exact: true }).waitFor(); assert.equal(await rows(page).count(), 0); assert.equal(await review(page).count(), 0);
      assert.ok((await page.locator('.oc-queues').innerText()).includes('—')); control.fixture = 'full'; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await loaded(page); await expectRows(page, 7);
    } else if (fixture === 'empty') {
      await page.getByText('No invoices in this queue', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Health currency', { exact: true }).isDisabled(), true);
      assert.ok((await page.locator('.oc-health').innerText()).includes('Not available')); assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true);
    } else {
      await queue(page, 'all'); await expectRows(page, 1); await detailReady(page, 201);
      if (fixture === 'zero') { assert.ok((await rows(page).innerText()).includes('AED 0.00')); assert.equal(await page.getByTestId('outgoing-review-outstanding').innerText(), 'AED 0.00'); }
      else { assert.equal(await page.getByTestId('outgoing-review-outstanding').innerText(), '—'); assert.ok((await review(page).innerText()).includes('Currency not recorded')); assert.ok(!(await review(page).innerText()).includes('AED')); assert.ok((await page.locator('.oc-health').innerText()).includes('balances missing')); }
    }
    await capture(page, `state-${fixture}`); await state.close();
  }
  record('Loading, empty, genuine zero, missing currency/balance and 403/503 retry remain distinct');

  state = await open(); ({ page, control } = state);
  control.failures['/invoice-tracker/invoices/collections-summary/'] = 503;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page); await expectRows(page, 7);
  await page.getByRole('button', { name: 'Retry totals', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Create invoice', exact: true }).isDisabled(), true);
  assert.ok((await page.locator('.oc-queues').innerText()).includes('—')); assert.ok(!(await page.locator('.oc-health').innerText()).includes('AED 105,000.00'));
  delete control.failures['/invoice-tracker/invoices/collections-summary/']; await page.getByRole('button', { name: 'Retry totals', exact: true }).click(); await loaded(page);
  control.failures['/invoice-tracker/invoices/'] = 503; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page);
  assert.equal(await rows(page).count(), 0); assert.equal(await review(page).count(), 0); assert.ok((await page.locator('.oc-queues').getByRole('button', { name: /^Overdue/ }).innerText()).includes('8'), 'Independent summary stays available when only list fails');
  delete control.failures['/invoice-tracker/invoices/']; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await loaded(page); await expectRows(page, 7); await state.close();
  record('Register and summary failures clear stale values independently and refresh restores them');

  state = await open(); ({ page, control } = state);
  await page.getByRole('button', { name: 'Next invoice page', exact: true }).click(); await loaded(page); await expectRows(page, 1);
  control.fixture = { rows: outgoingFixture().rows.slice(0, 5) };
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page); await expectRows(page, 3);
  assert.ok((await page.locator('.oc-pagination').innerText()).includes('Page 1 of 1')); assert.equal(await page.getByText('Invoices could not be loaded', { exact: true }).count(), 0); await state.close();
  state = await open({ fixture: 'settled_currency' }); ({ page } = state);
  await page.getByLabel('Health currency', { exact: true }).selectOption('EUR'); assert.ok((await page.locator('.oc-health-metrics').innerText()).includes('EUR 0.00'));
  await page.getByRole('button', { name: 'View ageing analysis', exact: true }).click(); assert.ok((await page.getByRole('dialog', { name: 'Receivables ageing', exact: true }).innerText()).includes('EUR 0.00')); await state.close();
  state = await open({ fixture: 'missing_currency' }); ({ page } = state);
  await page.getByRole('button', { name: 'View ageing analysis', exact: true }).click(); const explanation = await page.getByRole('dialog', { name: 'Receivables ageing', exact: true }).innerText();
  assert.ok(/currenc/i.test(explanation)); assert.ok(!/balances are missing/i.test(explanation), 'Unknown units alone are not labeled as missing balances'); await state.close();
  state = await open({ fixture: 'zero_unknown_total' }); ({ page } = state); await queue(page, 'all'); await expectRows(page, 1);
  assert.ok(!(await rows(page).innerText()).includes('Due in -')); await state.close();
  record('Last-page shrink, other-currency incompleteness, unknown units and zero-balance date wording remain accurate');

  for (const fixture of ['readonly', 'export_denied', 'capabilities_missing']) {
    state = await open({ fixture }); ({ page, control } = state);
    assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Create invoice', exact: true }).isDisabled(), fixture !== 'export_denied');
    await page.getByLabel('More invoice actions', { exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Import Excel', exact: true }).isDisabled(), fixture !== 'export_denied');
    assert.equal(control.mutations.length, 0); await state.close();
  }
  record('Authoritative create/import/export grants and missing capability responses gate every action');
}

async function mutationChecks() {
  let state = await open(); let { page, control } = state;
  await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Create customer invoice', exact: true }); await create.waitFor();
  await create.getByRole('button', { name: 'Create invoice', exact: true }).click(); assert.equal(control.mutations.length, 0, 'Native required validation prevents an empty create');
  await create.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(control.mutations.length, 0, 'Open and cancel never create a business record');
  await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
  await create.getByLabel('Invoice number', { exact: true }).fill('AR-SYN-NEW'); await create.getByLabel('Customer / account', { exact: true }).fill('Synthetic Customer');
  await create.getByLabel('Due date', { exact: true }).fill('2026-10-14'); await create.getByLabel('Invoice currency', { exact: true }).selectOption('USD');
  await create.getByLabel('Invoice total (including tax)', { exact: true }).fill('1050.00');
  await axe(page, 'create-dialog');
  await create.getByRole('button', { name: 'Close create invoice', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await focusedText(page), 'Create invoice', 'Create dialog traps backward focus');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close create invoice');
  control.expectedMutations.push({ method: 'POST', endpoint: '/invoice-tracker/invoices/', status: 400, data: { invoice_number: ['This invoice number already exists.'] } });
  await create.getByRole('button', { name: 'Create invoice', exact: true }).click(); await create.getByRole('alert').waitFor();
  assert.ok((await create.getByRole('alert').innerText()).includes('already exists')); assert.equal(await create.getByLabel('Invoice number', { exact: true }).inputValue(), 'AR-SYN-NEW');
  control.expectedMutations.push({ method: 'POST', endpoint: '/invoice-tracker/invoices/', status: 201, data: { ...outgoingFixture().rows[0], id: 999, invoice_number: 'AR-SYN-NEW' } });
  await create.getByRole('button', { name: 'Create invoice', exact: true }).click(); await page.waitForFunction(() => window.outgoingRoute === '/finance/outgoing-invoices/999');
  const payload = control.mutations.at(-1).body; assert.equal(payload.currency, 'USD'); assert.equal(payload.grand_total, '1050.00'); assert.equal(payload.invoice_amount, '1050.00'); assert.equal(payload.actual_payment_received, '0.00'); assert.equal(payload.payment_status, 'pending');
  await state.close(); record('Existing create endpoint requires explicit valid submission, preserves original currency and keeps API errors reviewable');

  state = await open(); ({ page, control } = state);
  await page.getByLabel('More invoice actions', { exact: true }).click(); await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
  const imported = page.getByRole('dialog', { name: 'Import customer invoices', exact: true }); await imported.waitFor();
  assert.equal(await imported.getByRole('button', { name: 'Start Import', exact: true }).isDisabled(), true);
  await imported.getByRole('button', { name: 'Close invoice import', exact: true }).click(); assert.equal(control.mutations.length, 0);
  await page.getByLabel('More invoice actions', { exact: true }).click(); await page.getByRole('button', { name: 'Import Excel', exact: true }).click();
  await imported.locator('input[type=file]').setInputFiles({ name: 'synthetic-receivables.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('Isolated fixture bytes; no actual workbook is uploaded.') });
  await imported.getByLabel('Restrict to sheets', { exact: true }).fill('Customer invoices');
  await axe(page, 'import-dialog', '[role="dialog"]');
  await imported.getByRole('button', { name: 'Close invoice import', exact: true }).focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await focusedText(page), 'Start Import'); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close invoice import');
  control.expectedMutations.push({ method: 'POST', endpoint: '/invoice-tracker/invoices/import-excel/', data: { rows_created: 1, rows_updated: 2, rows_skipped: 0, errors: [] } });
  await imported.getByRole('button', { name: 'Start Import', exact: true }).click(); await imported.getByText('Import complete', { exact: true }).waitFor();
  assert.ok(control.mutations[0].body.includes('synthetic-receivables.xlsx')); assert.ok(control.mutations[0].body.includes('Customer invoices'));
  await imported.getByRole('button', { name: 'Close', exact: true }).click(); await loaded(page); await expectRows(page, 7);
  assert.equal(control.expectedMutations.length, 0); await state.close();
  record('Original Excel import remains explicit, focus-contained and refreshes only after its synthetic response');
}

try {
  browser = await launchBrowser();
  if (!workflowsOnly && !sourcesOnly) await visualChecks();
  if (sourcesOnly) await sourceChecks();
  else if (!visualsOnly) { await workflowChecks(); await sourceChecks(); await mutationChecks(); }
  await guards(); assert.deepEqual(runtimeErrors, [], 'No browser runtime errors'); assert.deepEqual(unexpectedRequests, [], 'Every network request is explicitly intercepted');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: true, checks, runtimeErrors, unexpectedRequests, mutations: allMutations, geometries, accessibility }, null, 2));
} catch (error) {
  for (const context of browser?.contexts() || []) { const page = context.pages()[0]; if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); }
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ error: error.stack, checks, runtimeErrors, unexpectedRequests, mutations: allMutations, geometries, accessibility }, null, 2)); throw error;
} finally { await browser?.close(); }
