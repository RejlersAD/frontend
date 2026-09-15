import assert from 'node:assert/strict';
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
import { RECEIPT_CHECK_TIME, receiptFixture, receiptSummary, filterReceiptRows, receiptUser, receiptId } from './check-goods-receipts-fixtures.mjs';

// Real Goods Receipt page, service and shared shell; all network traffic stays in this fixture context.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'goods-receipts');
const origin = 'http://goods-receipts-check.test';
const visualsOnly = process.argv.includes('--visuals-only');
const workflowsOnly = process.argv.includes('--workflows-only');
const sourcesOnly = process.argv.includes('--sources-only');
const dialogsOnly = process.argv.includes('--dialogs-only');
const creatorAccessOnly = process.argv.includes('--creator-access-only');
const selectedViewport = Number(process.argv.find(value => value.startsWith('--viewport='))?.split('=')[1]) || null;
const protectedFiles = ["src/components/Layout/Sidebar.jsx", "src/components/Layout/Sidebar.css", "src/components/Layout/Header.jsx", "src/components/Layout/Layout.jsx", "src/config/layout.config.js", "src/config/navigationLabels.config.js", "src/hooks/useSidebarLayout.js", "src/hooks/useSidebarDrawer.js", "src/pages/UserDetail.jsx", "src/pages/Finance/ProcurementInvoiceTracker.jsx", "src/components/Finance/InvoiceContextPanel.jsx", "src/components/Finance/IncomingInvoiceWorkspace.jsx", "src/components/Finance/IncomingInvoiceReview.jsx", "src/components/Finance/IncomingInvoiceReview.css", "src/components/Finance/incomingInvoiceRegister.js", "src/components/Finance/incomingReviewPresentation.js", "src/pages/Finance/IncomingInvoices.css", "src/pages/Finance/InvoiceManagementHub.jsx", "src/components/Finance/FinanceCommandCenter.jsx", "src/components/Finance/FinanceCommandCenter.css", "src/components/Finance/financeCommandPresentation.js", "src/components/Finance/financeCommandPdf.js", "src/components/Finance/FinanceCommandCharts.jsx", "src/components/Finance/FinanceCommandCharts.css", "src/components/Finance/financeCommandChartPresentation.js", "src/services/finance.service.js", "src/pages/Finance/InvoiceTracker.jsx", "src/services/invoiceTracker.service.js", "src/config/invoiceTracker.config.js", "src/components/Finance/OutgoingInvoiceCreate.jsx", "src/components/Finance/outgoingInvoicePresentation.js", "src/components/Finance/OutgoingInvoiceReview.css", "src/components/Finance/OutgoingInvoiceReview.jsx", "src/components/Finance/OutgoingInvoiceWorkspace.css", "src/components/Finance/OutgoingInvoiceWorkspace.jsx", "src/components/Finance/outgoingReviewPresentation.js"];
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
import Layout from './src/components/Layout/Layout.jsx';import ReceiptManagement from './src/pages/Procurement/ReceiptManagement.jsx';
const state={auth:{user:window.receiptUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{user:window.receiptUser,roles:window.receiptUser.roles,modules:[]}}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
function Observer(){const location=useLocation();window.receiptRoute=location.pathname+location.search;return null;}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/procurement/receipts']}><Observer/><Routes><Route element={<Layout/>}><Route path='/procurement/receipts' element={<ReceiptManagement/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
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
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Goods receipts"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'goods-receipt-fixture', setup(builder) { builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' })); for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' })); } }] });
async function filesIn(directory) {
  const result = [];
  try { await readdir(path.join(frontend, directory)); } catch { return result; }
  for (const entry of await readdir(path.join(frontend, directory), { withFileTypes: true })) { const file = `${directory}/${entry.name}`; if (entry.isDirectory()) result.push(...await filesIn(file)); else result.push(file); }
  return result;
}
const componentFiles = [...await filesIn('src/components/Layout'), ...await filesIn('src/components/Procurement'), ...await filesIn('src/pages/Procurement'), 'src/config/layout.config.js'];
const classSources = await Promise.all(componentFiles.filter(file => /\.[jm]sx?$/.test(file)).map(file => readFile(path.join(frontend, file), 'utf8')));
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goods receipt browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const expectedSidebarWidth = await sidebarWidth(frontend);
let browser;
const runtimeErrors = [], unexpectedRequests = [], allMutations = [], checks = [], geometries = [], accessibility = [];
const record = message => { checks.push(message); console.log(`PASS: ${message}`); };
async function newPage({ fixture = 'full', width = 1672, dark = false, loading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(RECEIPT_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => { window.receiptUser = user; window.receiptPrintCalls = []; window.print = () => { window.receiptPrintCalls.push(document.querySelector('.gr-print-document')?.textContent || ''); window.dispatchEvent(new Event('afterprint')); }; localStorage.setItem('radai_access_token', 'isolated-goods-receipt-test-token'); document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark)); }, { user: receiptUser, dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, requests: [], expectedMutations: [], mutations: [], failures: {}, detailOverrides: {}, deferredDetails: new Map(), loading, listPending: [] };
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const respond = async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api\/v1/, '');
    const fixtureData = typeof control.fixture === 'string' ? receiptFixture(control.fixture) : structuredClone(control.fixture);
    const method = request.method(), rawBody = request.postData(); let body = rawBody;
    try { body = rawBody ? JSON.parse(rawBody) : null; } catch { /* Keep synthetic multipart upload intact for assertions. */ }
    control.requests.push({ method, endpoint, query: url.search, body });
    if (method !== 'GET') {
      const mutation = { method, endpoint, body }; control.mutations.push(mutation); allMutations.push(mutation);
      const expected = control.expectedMutations.shift();
      if (!expected || expected.method !== method || expected.endpoint !== endpoint) { unexpectedRequests.push(`Unexpected ${method} ${endpoint}`); return json(route, { detail: 'Unrequested synthetic mutation refused.' }, 409); }
      if (expected.defer) await new Promise(resolve => { control.releaseMutation = resolve; });
      if (expected.update) control.fixture = expected.update(fixtureData, body);
      return json(route, expected.data || { rows_created: 1, rows_updated: 0, rows_skipped: 0, errors: [] }, expected.status || 200);
    }
    if (control.failures[endpoint]) return json(route, { detail: 'Synthetic receipt source unavailable.' }, control.failures[endpoint]);
    if (endpoint === '/rbac/users/me/') return json(route, { user: receiptUser, roles: receiptUser.roles, modules: [] });
    if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
    if (endpoint === '/procurement/receipts/' || endpoint === '/procurement/receipts/inspection-summary/') {
      if (control.loading) { control.listPending.push(route); return; }
      if (fixtureData.failure) return json(route, { detail: fixtureData.failure === 403 ? 'Goods receipt access is required.' : 'Synthetic receipt register unavailable.' }, fixtureData.failure);
      if (endpoint.endsWith('/inspection-summary/')) {
        const summary = fixtureData.summary || receiptSummary(fixtureData.rows, url.searchParams);
        if ('capabilities' in fixtureData) summary.capabilities = fixtureData.capabilities;
        return json(route, summary);
      }
      const filtered = filterReceiptRows(fixtureData.rows, url.searchParams), number = Math.max(1, Number(url.searchParams.get('page')) || 1), size = Math.min(200, Math.max(1, Number(url.searchParams.get('page_size')) || 50));
      if (number > 1 && (number - 1) * size >= filtered.length) return json(route, { detail: 'Invalid page.' }, 404);
      return json(route, { count: fixtureData.count ?? filtered.length, next: number * size < filtered.length ? `${origin}/api/v1/procurement/receipts/?page=${number + 1}` : null, previous: number > 1 ? `${origin}/api/v1/procurement/receipts/?page=${number - 1}` : null, results: filtered.slice((number - 1) * size, number * size) });
    }
    if (endpoint === '/procurement/orders/') return json(route, {count: fixtureData.orders.length, results: fixtureData.orders, next: null});
    const detailMatch = endpoint.match(/^\/procurement\/receipts\/([a-f0-9-]+)\/$/);
    if (detailMatch) {
      const id = detailMatch[1], row = fixtureData.rows.find(item => item.id === id);
      if (control.deferredDetails.has(id)) await new Promise(resolve => control.deferredDetails.set(id, resolve));
      return json(route, control.detailOverrides[id] || row || { detail: 'Synthetic invoice not found.' }, row ? 200 : 404);
    }
    unexpectedRequests.push(`${method} ${endpoint}`); return json(route, { detail: 'Unmapped isolated fixture request.' }, 404);
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) return respond(route);
    if (route.request().isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/logo/'))) {
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
const workspace = page => page.locator('.goods-receipts-workspace');
const rows = page => page.locator('.grw-table tbody tr');
const review = page => page.getByTestId('goods-receipt-review');
const focusedText = page => page.evaluate(() => document.activeElement?.tagName === 'BODY' ? 'BODY' : document.activeElement?.textContent?.trim().slice(0, 100));
async function loaded(page) {
  await workspace(page).waitFor();
  await page.waitForFunction(() => {
    const root = document.querySelector('.goods-receipts-workspace');
    const refresh = [...root.querySelectorAll('button')].find(button => button.textContent.trim() === 'Refresh');
    return root.querySelector('.grw-register')?.getAttribute('aria-busy') !== 'true' && refresh && !refresh.disabled;
  });
}
async function open(options) { const state = await newPage(options); if (!options?.loading) await loaded(state.page); return state; }
async function detailReady(page, id) {
  await review(page).getByRole('heading', { name: `GRN-SYN-${id}`, exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.goods-receipt-review-body')?.getAttribute('aria-busy') === 'false');
}
async function select(page, id) { await page.getByRole('button', { name: `Review receipt GRN-SYN-${id}`, exact: true }).click(); await detailReady(page, id); }
async function queue(page, id) { await page.getByLabel('Inspection queue', { exact: true }).selectOption(id); await loaded(page); }
async function clear(page) { await page.getByRole('button', { name: 'Clear', exact: true }).click(); await loaded(page); }
async function expectRows(page, expected) { await page.waitForFunction(count => document.querySelectorAll('.grw-table tbody tr').length === count, expected); assert.equal(await rows(page).count(), expected); }
async function axe(page, name, selector = '.goods-receipts-workspace') {
  const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  accessibility.push({ name, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
  assert.deepEqual(result.violations.map(item => item.id), [], `${name}: no accessibility violations`);
}
async function geometry(page, width, dark) {
  const result = await workspace(page).evaluate(root => {
    const rect = node => { if (!node) return null; const bounds = node.getBoundingClientRect(); return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom }; };
    const main = document.querySelector('main.main-content');
    return { documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: main.scrollWidth <= main.clientWidth + 1, mainWidth: { scroll: main.scrollWidth, client: main.clientWidth }, heading: rect(root.querySelector('.grw-page-heading')), headerActions: rect(root.querySelector('.grw-page-actions')),
      contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      table: rect(root.querySelector('.grw-table')), register: rect(root.querySelector('.grw-register')), review: rect(root.querySelector('[data-testid="goods-receipt-review"]')), reviewFooter: rect(root.querySelector('.goods-receipt-review-footer')), health: rect(root.querySelector('.grw-health')),
      rowHeights: [...root.querySelectorAll('.grw-table tbody tr')].map(row => row.getBoundingClientRect().height),
      overflow: [...root.querySelectorAll('.grw-table td button')].filter(button => { const cell = button.closest('td').getBoundingClientRect(), bounds = button.getBoundingClientRect(); return bounds.left < cell.left - 1 || bounds.right > cell.right + 1; }).map(button => button.textContent),
      escaped: [...root.querySelectorAll('*')].filter(node => !node.closest('.grw-table-scroll') && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().right > root.getBoundingClientRect().right - 5).map(node => ({ tag: node.tagName, className: node.getAttribute('class'), ...rect(node), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth })).slice(0, 20),
    };
  });
  geometries.push({ width, dark, ...result });
  assert.ok(result.documentFits && result.mainFits, `${width}: no page overflow`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth);
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
  assert.deepEqual(result.overflow, [], 'Row actions stay within their cells');
  if (width >= 1440) { assert.ok(result.rowHeights.every(height => height <= 72), 'Goods receipt rows remain dense'); assert.ok(result.review && result.review.x >= result.register.right, 'Desktop review remains beside the register'); }
  if (width === 1672) assert.ok(result.reviewFooter?.bottom <= 941, 'Desktop receipt review actions remain above the fold');
}
async function visualChecks() {
  for (const width of selectedViewport ? [selectedViewport] : [1672, 1440, 1024, 390]) {
    const state = await open({ width }); await capture(state.page, `goods-receipts-${width}`); await geometry(state.page, width, false); await axe(state.page, `light-${width}`); await state.close();
    record(`${width}px light register, review, dense rows and accessible controls`);
  }
  if (selectedViewport && selectedViewport !== 1672) return;
  const state = await open({ dark: true }); await capture(state.page, 'goods-receipts-dark'); await geometry(state.page, 1672, true); await axe(state.page, 'dark-1672'); await state.close();
  record('Dark theme retains readable receipt values and review details');
}

async function workflowChecks() {
  let state = await open(); let { page, control } = state;
  const fixture = receiptFixture(), summary = receiptSummary(fixture.rows);
  await expectRows(page, 6); await detailReady(page, 301);
  for (const [id, label] of [['all', 'All receipts'], ['pending', 'Awaiting inspection'], ['exceptions', 'Exceptions'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['ndt_pending', 'NDT pending']]) {
    assert.ok((await page.locator('.grw-queues').getByRole('button', { name: new RegExp(`^${label}`) }).innerText()).includes(String(summary.counts[id])));
    await queue(page, id); await expectRows(page, Math.min(6, summary.counts[id]));
  }
  await queue(page, 'all');
  await page.getByRole('button', { name: 'Next receipt page', exact: true }).click(); await loaded(page); await expectRows(page, 6);
  assert.ok(control.requests.some(request => request.endpoint === '/procurement/receipts/' && new URLSearchParams(request.query).get('page') === '2'));
  await page.getByRole('button', { name: 'Previous receipt page', exact: true }).click(); await loaded(page);
  await page.getByLabel('Rows per page', { exact: true }).selectOption('24'); await loaded(page); await expectRows(page, 16);
  await page.getByLabel('Rows per page', { exact: true }).selectOption('6'); await loaded(page);
  await page.getByRole('button', { name: 'Close receipt review', exact: true }).click(); assert.equal(await review(page).count(), 0); await select(page, 301);
  await page.getByLabel('Search goods receipts', { exact: true }).fill('GRN-SYN-303'); await loaded(page); await expectRows(page, 1);
  assert.ok((await rows(page).innerText()).includes('GRN-SYN-303')); await clear(page);
  await page.getByRole('button', { name: 'GR number', exact: true }).click(); await loaded(page); assert.ok((await rows(page).first().innerText()).includes('GRN-SYN-301'));
  await page.getByRole('button', { name: 'GR number', exact: true }).click(); await loaded(page); assert.ok((await rows(page).first().innerText()).includes('GRN-SYN-316'));
  await clear(page);
  await page.getByLabel('Card view', { exact: true }).click(); assert.equal(await page.locator('.grw-receipt-cards > button').count(), 6);
  await page.getByLabel('List view', { exact: true }).click(); await expectRows(page, 6);
  record('Full queue counts, server pagination, search, sorting, card/list view and review reopening work');

  for (const [label, value, key] of [['Receipt status', 'accepted', 'status'], ['Quality status', 'failed', 'quality_check'], ['Supplier', fixture.rows[1].vendor_id, 'vendor'], ['Project', 'core:82', 'project']]) {
    await page.getByLabel(label, { exact: true }).selectOption(value); await loaded(page);
    await expectRows(page, Math.min(6, filterReceiptRows(fixture.rows, new URLSearchParams({ [key]: value })).length));
    assert.ok(control.requests.some(request => request.endpoint === '/procurement/receipts/' && new URLSearchParams(request.query).get(key) === value)); await clear(page);
  }
  await page.getByLabel('Received from', { exact: true }).fill('2026-09-13'); await loaded(page); await expectRows(page, 4); await clear(page);
  await page.getByLabel('Received to', { exact: true }).fill('2026-09-05'); await loaded(page); await expectRows(page, 3); await clear(page);
  await page.getByRole('button', { name: 'More filters', exact: true }).click(); await page.getByLabel('Inspector', { exact: true }).selectOption('Jordan Lee'); await loaded(page);
  await expectRows(page, Math.min(6, fixture.rows.filter(row => row.inspector_name === 'Jordan Lee').length)); await clear(page);
  record('Supplier, project, disposition, quality, received date and inspector filters reach the API');

  await page.getByRole('button', { name: 'View quality analytics', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Receiving quality analytics', exact: true }); await dialog.waitFor();
  assert.ok((await dialog.innerText()).includes('not recorded')); await axe(page, 'analytics-dialog', '.grw-dialog');
  await dialog.getByLabel('Close quality analytics').focus(); await page.keyboard.press('Shift+Tab'); assert.equal(await focusedText(page), 'Close');
  await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close quality analytics');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  await page.getByLabel('Select receipt GRN-SYN-301', { exact: true }).check();
  let downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); let download = await downloadEvent;
  await download.saveAs(path.join(artifacts, 'selected-receipts.csv')); let csv = await readFile(await download.path(), 'utf8'); assert.ok(csv.includes('GRN-SYN-301')); assert.ok(!csv.includes('GRN-SYN-302'));
  await page.getByLabel('Select receipt GRN-SYN-301', { exact: true }).uncheck();
  downloadEvent = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); download = await downloadEvent;
  await download.saveAs(path.join(artifacts, 'filtered-receipts.csv')); csv = await readFile(await download.path(), 'utf8'); assert.equal(csv.trim().split('\r\n').length, fixture.rows.length + 1); assert.ok(csv.includes('GRN-SYN-316'));
  assert.equal(control.mutations.length, 0); await state.close();
  record('Analytics dialog traps focus; selected and full filtered CSV exports require no business writes');

  state = await open(); ({ page, control } = state);
  control.deferredDetails.set(receiptId(302), null); await page.getByRole('button', { name: 'Review receipt GRN-SYN-302', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.goods-receipt-review-body')?.getAttribute('aria-busy') === 'true');
  await select(page, 303); const release = control.deferredDetails.get(receiptId(302)); assert.equal(typeof release, 'function'); release(); await detailReady(page, 303);
  control.detailOverrides[receiptId(301)] = { ...fixture.rows[0], id: receiptId(999) }; await select(page, 301); await review(page).getByRole('button', { name: 'Retry receipt details', exact: true }).waitFor();
  assert.equal(await page.getByTestId('receipt-quantity-tiles').count(), 0); delete control.detailOverrides[receiptId(301)];
  await review(page).getByRole('button', { name: 'Retry receipt details', exact: true }).click(); await detailReady(page, 301);
  assert.ok((await page.getByTestId('receipt-inspection-checklist').innerText()).includes('Not verified'));
  assert.equal(control.mutations.length, 0); await state.close();
  record('Late and mismatched receipt details are suppressed; default quality flags never become verified inspection results');
}

async function sourceChecks() {
  let state = await open({ loading: true }); let { page, control } = state;
  await page.getByText('Loading goods receipts…', { exact: true }).waitFor(); assert.equal(await rows(page).count(), 0); assert.equal(await review(page).count(), 0);
  await control.releaseList(); await loaded(page); await expectRows(page, 6); await state.close();
  for (const fixture of ['empty', 'zero', 'missing', 'mixed_units', 'error', 'forbidden']) {
    state = await open({ fixture }); ({ page, control } = state);
    if (['error', 'forbidden'].includes(fixture)) {
      await page.getByText('Receipts could not be loaded', { exact: true }).waitFor(); assert.equal(await rows(page).count(), 0); assert.equal(await review(page).count(), 0);
      assert.ok((await page.locator('.grw-kpis').innerText()).includes('—')); control.fixture = 'full'; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await loaded(page); await expectRows(page, 6);
    } else if (fixture === 'empty') {
      await page.getByText('No receipts match this queue', { exact: true }).waitFor(); assert.equal(await review(page).count(), 0);
      assert.ok((await page.locator('.grw-kpis').innerText()).includes('—')); assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true);
    } else {
      await expectRows(page, 1); await detailReady(page, 301);
      if (fixture === 'zero') assert.equal(await page.locator('[data-quantity="received_qty"] strong').innerText(), '0');
      else if (fixture === 'missing') assert.ok(!(await review(page).innerText()).includes('0 EA'));
      else {
        const selector = page.getByLabel('Quantity unit', { exact: true }); await selector.selectOption('M');
        assert.equal(await page.locator('[data-quantity="received_qty"] strong').innerText(), '12.5'); assert.equal(await page.locator('[data-quantity="accepted_qty"] strong').innerText(), '12.25');
      }
    }
    await capture(page, `state-${fixture}`); await state.close();
  }
  record('Loading, empty, known zero, absent quantities, mixed units and 403/503 retry remain distinct');
  state = await open(); ({ page, control } = state);
  control.failures['/procurement/receipts/inspection-summary/'] = 503; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page); await expectRows(page, 6);
  await page.getByRole('button', { name: 'Retry metrics', exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Record goods receipt', exact: true }).isDisabled(), true);
  assert.ok((await page.locator('.grw-kpis').innerText()).includes('—')); delete control.failures['/procurement/receipts/inspection-summary/']; await page.getByRole('button', { name: 'Retry metrics', exact: true }).click(); await loaded(page);
  control.failures['/procurement/receipts/'] = 503; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page); assert.equal(await rows(page).count(), 0); assert.equal(await review(page).count(), 0); await state.close();
  state = await open({ fixture: 'readonly' }); ({ page, control } = state);
  assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Record goods receipt', exact: true }).isDisabled(), true);
  await detailReady(page, 301); const print = review(page).getByRole('button', { name: 'Print receipt', exact: true }); assert.ok(await print.count() === 0 || await print.isDisabled()); assert.equal(control.mutations.length, 0); await state.close();
  state = await open({ fixture: 'no_po_access' }); ({ page, control } = state); await page.getByRole('button', { name: 'Record goods receipt', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Purchase order access is required to select an order for this receipt.' }).waitFor(); assert.ok(!control.requests.some(request => request.endpoint === '/procurement/orders/')); assert.equal(control.mutations.length, 0); await state.close();
  state = await open(); ({ page, control } = state); await page.getByRole('button', { name: 'Next receipt page', exact: true }).click(); await loaded(page);
  await page.getByRole('button', { name: 'Next receipt page', exact: true }).click(); await loaded(page); await expectRows(page, 4);
  control.fixture = { ...receiptFixture(), rows: receiptFixture().rows.slice(0, 4) }; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page); await expectRows(page, 4);
  assert.ok((await page.locator('.grw-pagination').innerText()).includes('Page 1 of 1')); await state.close();
  record('Independent source failures clear stale totals, capability denials gate writes/exports, and shrinking pages recover');
}

async function mutationChecks() {
  const state = await open(); const { page, control } = state;
  await page.getByRole('button', { name: 'Record goods receipt', exact: true }).click();
  const creator = page.getByRole('dialog', { name: 'AI-Powered Goods Receipt', exact: true }); await creator.waitFor();
  assert.equal(control.mutations.length, 0); await creator.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.equal(control.mutations.length, 0);
  await page.getByRole('button', { name: 'Record goods receipt', exact: true }).click();
  await creator.getByLabel('Select purchase order', { exact: true }).selectOption(receiptFixture().orders[0].id);
  await creator.getByLabel('Received quantity for PO line 1', { exact: true }).fill('3');
  await creator.getByLabel('Rejected quantity for PO line 1', { exact: true }).fill('4');
  await creator.getByRole('button', { name: 'Record Goods Receipt', exact: true }).click();
  await creator.getByText('Unable to Record Receipt', { exact: false }).waitFor(); assert.equal(control.mutations.length, 0);
  await creator.getByLabel('Rejected quantity for PO line 1', { exact: true }).fill('1');
  await creator.getByLabel('Close receipt creator', { exact: true }).focus(); await page.keyboard.press('Shift+Tab'); assert.equal(await focusedText(page), 'Record Goods Receipt'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close receipt creator');
  await axe(page, 'receipt-creator', '[role="dialog"]');
  control.expectedMutations.push({ method: 'POST', endpoint: '/procurement/receipts/', status: 400, data: { purchase_order: ['Synthetic validation failure.'] } });
  await creator.getByRole('button', { name: 'Record Goods Receipt', exact: true }).click(); await creator.getByText(/Synthetic validation failure/).waitFor();
  assert.equal(await creator.getByLabel('Received quantity for PO line 1', { exact: true }).inputValue(), '3');
  control.expectedMutations.push({ method: 'POST', endpoint: '/procurement/receipts/', status: 201, data: receiptFixture().rows[0], defer: true });
  await creator.getByRole('button', { name: 'Record Goods Receipt', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.getAttribute('aria-busy') === 'true');
  assert.equal(await creator.getByLabel('Received quantity for PO line 1', { exact: true }).isDisabled(), true); await page.keyboard.press('Escape'); assert.equal(await creator.isVisible(), true);
  assert.equal(typeof control.releaseMutation, 'function'); control.releaseMutation(); await creator.waitFor({ state: 'hidden' });
  const item = control.mutations.at(-1).body.items_received[0]; assert.equal(item.received_qty, '3'); assert.equal(item.rejected_qty, '1'); assert.equal(item.accepted_qty, '2'); assert.equal(item.uom, 'EA'); assert.equal(item.ordered_qty, '10.00');
  assert.equal(control.expectedMutations.length, 0); await state.close();
  record('Receipt creation submits explicit partial line quantities, rejects invalid quantities and preserves API errors without unrequested writes');
}

async function detailChecks() {
  const state = await open(); const { page, control } = state;
  await detailReady(page, 301); await review(page).getByRole('button', { name: 'Open receipt', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true });
  await dialog.getByRole('button', { name: 'Accept & complete PO', exact: true }).waitFor();
  assert.equal(control.mutations.length, 0); assert.ok((await dialog.innerText()).includes('also completes its purchase order'));
  await axe(page, 'receipt-detail-dialog', '[role="dialog"]');
  await dialog.getByLabel('Close receipt details', { exact: true }).focus(); await page.keyboard.press('Shift+Tab'); assert.equal(await focusedText(page), 'Close'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Close receipt details');
  await dialog.getByRole('button', { name: 'Print Preview', exact: true }).click();
  const print = page.getByRole('dialog', { name: /Print Preview.*Goods Receipt Note/ }); await print.waitFor();
  assert.ok((await print.innerText()).includes('NOT VERIFIED')); assert.ok((await print.innerText()).includes('GRN-SYN-301'));
  await print.getByRole('button', { name: 'Print / Save PDF', exact: true }).click();
  assert.equal(await page.evaluate(() => window.receiptPrintCalls.length), 1); assert.ok((await page.evaluate(() => window.receiptPrintCalls[0])).includes('GRN-SYN-301'));
  await page.emulateMedia({ media: 'print' }); await page.pdf({ path: path.join(artifacts, 'goods-receipt-note.pdf'), preferCSSPageSize: true, printBackground: true }); await page.emulateMedia({ media: 'screen' });
  await print.getByRole('button', { name: 'Close Preview', exact: true }).click(); await dialog.waitFor();
  control.expectedMutations.push({ method: 'POST', endpoint: `/procurement/receipts/${receiptId(301)}/accept/`, status: 400, data: { error: 'Synthetic acceptance was refused.' }, defer: true });
  await dialog.getByRole('button', { name: 'Accept & complete PO', exact: true }).click(); await dialog.getByRole('button', { name: 'Accepting...', exact: true }).waitFor();
  assert.equal(await dialog.getByLabel('Close receipt details', { exact: true }).isDisabled(), true); assert.equal(await dialog.getByLabel('Close', { exact: true }).isDisabled(), true);
  await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true); assert.equal(typeof control.releaseMutation, 'function'); control.releaseMutation();
  await dialog.getByRole('alert').waitFor(); assert.ok((await dialog.getByRole('alert').innerText()).includes('refused'));
  const accepted = { ...receiptFixture().rows[0], status: 'accepted', status_display: 'Accepted', capabilities: { update: true, accept: false, reject: false, export: true } };
  control.expectedMutations.push({ method: 'POST', endpoint: `/procurement/receipts/${receiptId(301)}/accept/`, data: accepted, update: fixture => ({ ...fixture, rows: fixture.rows.map(row => row.id === accepted.id ? accepted : row) }) });
  await dialog.getByRole('button', { name: 'Accept & complete PO', exact: true }).click(); await dialog.getByRole('button', { name: 'Accept & complete PO', exact: true }).waitFor({ state: 'hidden' });
  assert.equal(control.mutations.length, 2); assert.equal(control.expectedMutations.length, 0);
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Close');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await state.close();
  record('Existing detail and print workflows preserve recorded evidence; acceptance requires the labeled explicit action and surfaces API errors');

  for (const variant of ['malformed_detail', 'attachments']) {
    const edge = await open({ fixture: variant }); await detailReady(edge.page, 301);
    if (variant === 'attachments') await review(edge.page).getByRole('button', { name: 'View all attachments', exact: true }).click();
    else await review(edge.page).getByRole('button', { name: 'Open receipt', exact: true }).click();
    const details = edge.page.getByRole('dialog', { name: 'Goods Receipt Details', exact: true }); await details.getByRole('button', { name: 'Print Preview', exact: true }).waitFor();
    if (variant === 'attachments') for (const id of [1, 2, 3]) assert.equal(await details.locator(`a[href="https://files.example.test/receipt-${id}.pdf"]`).count(), 1);
    else { await details.getByRole('button', { name: 'Print Preview', exact: true }).click(); await edge.page.getByRole('dialog', { name: /Print Preview.*Goods Receipt Note/ }).waitFor(); }
    assert.equal(edge.control.mutations.length, 0); await edge.close();
  }
  record('Malformed legacy detail data stays readable and every attachment remains reachable through full details');
}

async function creatorAccessChecks() {
  for (const passed of [true, false]) {
    const state = await open({ fixture: 'create_only' }); const { page, control } = state;
    try {
      await page.getByRole('button', { name: 'Record goods receipt', exact: true }).click();
      const creator = page.getByRole('dialog', { name: 'AI-Powered Goods Receipt', exact: true });
      await creator.getByTestId('receipt-approval-note').waitFor();
      assert.match(await creator.getByTestId('receipt-approval-note').innerText(), /pending inspection.*Acceptance or rejection requires approval access/s);
      await creator.getByLabel('Select purchase order', { exact: true }).selectOption(receiptFixture().orders[0].id);
      await creator.getByLabel('Received quantity for PO line 1', { exact: true }).fill('3');
      const checks = creator.getByRole('button', { name: /Passed$/ });
      assert.equal(await checks.count(), 3);
      for (const check of await checks.all()) await check.click();
      if (!passed) await creator.getByRole('button', { name: /Failed$/ }).first().click();
      assert.equal(control.mutations.length, 0, 'Selecting quantities and findings never writes a receipt');
      control.expectedMutations.push({ method: 'POST', endpoint: '/procurement/receipts/', status: 201, data: receiptFixture().rows[0] });
      await creator.getByRole('button', { name: 'Record Goods Receipt', exact: true }).click();
      await creator.waitFor({ state: 'hidden' });
      assert.equal(control.mutations.length, 1);
      const payload = control.mutations[0].body;
      assert.equal(payload.status, 'pending', `Create-only access cannot ${passed ? 'accept' : 'reject'} a receipt`);
      assert.equal(payload.dimensional_check_passed, passed);
      assert.equal(payload.quality_check_passed, passed);
      assert.equal(payload.items_received[0].received_qty, '3');
      assert.equal(control.expectedMutations.length, 0);
    } finally { await state.close(); }
  }
  record('Create-only access submits pending inspection for both passing and failing findings while preserving quantities');
}

try {
  browser = await launchBrowser();
  if (!workflowsOnly && !sourcesOnly && !dialogsOnly && !creatorAccessOnly) await visualChecks();
  if (creatorAccessOnly) await creatorAccessChecks();
  else if (dialogsOnly) { await mutationChecks(); await creatorAccessChecks(); await detailChecks(); }
  else if (sourcesOnly) await sourceChecks();
  else if (!visualsOnly) { await workflowChecks(); await sourceChecks(); await mutationChecks(); await creatorAccessChecks(); await detailChecks(); }
  await guards(); assert.deepEqual(runtimeErrors, [], 'No browser runtime errors'); assert.deepEqual(unexpectedRequests, [], 'Every request stays in the isolated fixture');
  await writeFile(path.join(artifacts, creatorAccessOnly ? 'creator-access-checks.json' : 'checks.json'), JSON.stringify({ passed: true, checks, runtimeErrors, unexpectedRequests, mutations: allMutations, geometries, accessibility }, null, 2));
} catch (error) {
  for (const context of browser?.contexts() || []) { const page = context.pages()[0]; if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); }
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ error: error.stack, checks, runtimeErrors, unexpectedRequests, mutations: allMutations, geometries, accessibility }, null, 2)); throw error;
} finally { await browser?.close(); }
