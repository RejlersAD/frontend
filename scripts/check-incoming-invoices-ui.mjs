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
import { INVOICE_CHECK_TIME, invoiceDetail, invoiceFixture, invoiceImportPreview, invoicePdf, invoiceUser } from './check-incoming-invoices-fixtures.mjs';

// Real Incoming Invoice page, service and shared shell; all network traffic stays in this fixture context.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'incoming-invoices');
const origin = 'http://incoming-invoices-check.test';
const visualsOnly = process.argv.includes('--visuals-only');
const workflowsOnly = process.argv.includes('--workflows-only');
const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/components/Layout/Header.jsx', 'src/components/Layout/Layout.jsx', 'src/config/layout.config.js', 'src/config/navigationLabels.config.js', 'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js', 'src/pages/UserDetail.jsx'];
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
import Layout from './src/components/Layout/Layout.jsx';import ProcurementInvoiceTracker from './src/pages/Finance/ProcurementInvoiceTracker.jsx';
const state={auth:{user:window.invoiceUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{user:window.invoiceUser,roles:window.invoiceUser.roles,modules:[]}}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
function Observer(){const location=useLocation();window.invoiceRoute=location.pathname+location.search;return null;}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/finance/incoming-invoices']}><Observer/><Routes><Route element={<Layout/>}><Route path='/finance/incoming-invoices' element={<ProcurementInvoiceTracker/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
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
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Incoming invoices"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'incoming-invoice-fixture', setup(builder) { builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' })); for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' })); } }] });
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(path.join(frontend, directory), { withFileTypes: true })) { const file = `${directory}/${entry.name}`; if (entry.isDirectory()) result.push(...await filesIn(file)); else result.push(file); }
  return result;
}
const componentFiles = [...await filesIn('src/components/Layout'), ...await filesIn('src/components/Finance'), ...await filesIn('src/pages/Finance'), 'src/config/layout.config.js'];
const classSources = await Promise.all(componentFiles.filter(file => /\.[jm]sx?$/.test(file)).map(file => readFile(path.join(frontend, file), 'utf8')));
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Incoming invoice browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const expectedSidebarWidth = await sidebarWidth(frontend);
const browser = await launchBrowser();
const runtimeErrors = [], unexpectedRequests = [], allMutations = [], checks = [], geometries = [], accessibility = [];
const record = message => { checks.push(message); console.log(`PASS: ${message}`); };
async function newPage({ fixture = 'full', width = 1672, dark = false, loading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(INVOICE_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => { window.invoiceUser = user; localStorage.setItem('radai_access_token', 'isolated-invoice-test-token'); document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark)); }, { user: invoiceUser, dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, requests: [], expectedMutations: [], mutations: [], failures: {}, detailOverrides: {}, deferredDetails: new Map(), loading, listPending: [] };
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const respond = async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api\/v1/, '');
    const fixtureData = typeof control.fixture === 'string' ? invoiceFixture(control.fixture) : structuredClone(control.fixture);
    const method = request.method(); const rawBody = request.postData();
    let body = rawBody; try { body = rawBody ? JSON.parse(rawBody) : null; } catch { /* Multipart data is deliberately kept intact for import assertions. */ }
    control.requests.push({ method, endpoint, query: url.search, body });
    if (method !== 'GET') {
      const mutation = { method, endpoint, body }; control.mutations.push(mutation); allMutations.push(mutation);
      const expected = control.expectedMutations.shift();
      if (!expected || expected.method !== method || expected.endpoint !== endpoint) { unexpectedRequests.push(`Unexpected ${method} ${endpoint}`); return json(route, { detail: 'Unrequested synthetic mutation refused.' }, 409); }
      if (expected.status && expected.status !== 200) return json(route, { detail: expected.detail || 'Synthetic operation failed.' }, expected.status);
      return json(route, expected.data || (endpoint.endsWith('/import-preview/') ? invoiceImportPreview : { message: 'Successfully recorded synthetic invoice.', invoice: invoiceDetail({ ...fixtureData.rows[0], id: 999, invoice_number: 'INV-SYN-NEW' }) }));
    }
    if (control.failures[endpoint]) return json(route, { detail: 'Synthetic invoice source unavailable.' }, control.failures[endpoint]);
    if (endpoint === '/rbac/users/me/') return json(route, { user: invoiceUser, roles: invoiceUser.roles, modules: [] });
    if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
    if (endpoint === '/finance/invoices/') {
      if (control.loading) { control.listPending.push(route); return; }
      if (fixtureData.failure) return json(route, { detail: fixtureData.failure === 403 ? 'Invoice access is required.' : 'Synthetic invoice register unavailable.' }, fixtureData.failure);
      const number = Math.max(1, Number(url.searchParams.get('page')) || 1), size = 8;
      const rows = fixtureData.rows.slice((number - 1) * size, number * size);
      const next = number * size < fixtureData.rows.length ? `${origin}/api/v1/finance/invoices/?page=${number + 1}` : null;
      return json(route, { count: fixtureData.count ?? fixtureData.rows.length, next, previous: number > 1 ? `${origin}/api/v1/finance/invoices/?page=${number - 1}` : null, results: rows });
    }
    const detailMatch = endpoint.match(/^\/finance\/invoices\/(\d+)\/$/);
    if (detailMatch) {
      const id = Number(detailMatch[1]); const row = fixtureData.rows.find(item => item.id === id);
      if (control.deferredDetails.has(id)) await new Promise(resolve => control.deferredDetails.set(id, resolve));
      return json(route, control.detailOverrides[id] || (row ? invoiceDetail(row) : { detail: 'Synthetic invoice not found.' }), row ? 200 : 404);
    }
    if (/^\/finance\/invoices\/\d+\/preview\/$/.test(endpoint)) return route.fulfill({ contentType: 'application/pdf', body: invoicePdf });
    unexpectedRequests.push(`${method} ${endpoint}`); return json(route, { detail: 'Unmapped isolated fixture request.' }, 404);
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    // Chrome's built-in PDF viewer loads browser-owned local assets, not application/network data.
    if (url.protocol === 'chrome:' || (url.protocol === 'chrome-extension:' && url.hostname === 'mhjfbmdgcfjbbpaeojofohoefgiehjai')) return route.continue();
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) return respond(route);
    if (route.request().isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Report below. */ }
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
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
}

// Selectors and behavioral checks follow the real workspace's public control labels.
const rows = page => page.locator('.incoming-invoice-table tbody tr[aria-selected]');
async function loaded(page) { await page.locator('.incoming-invoices').waitFor(); await page.waitForFunction(() => ![...document.querySelectorAll('.incoming-invoices button')].find(button => button.textContent.trim() === 'Refresh')?.disabled); }
async function open(options) { const result = await newPage(options); if (!options?.loading) await loaded(result.page); return result; }
const review = page => page.getByTestId('incoming-invoice-review');
const invoiceRow = (page, id) => rows(page).filter({ has: page.getByRole('button', { name: `Review invoice INV-SYN-${id}`, exact: true }) });
async function detailReady(page, number) { await review(page).getByRole('heading', { name: `INV-SYN-${number}`, exact: true }).waitFor(); await page.waitForFunction(() => document.querySelector('.incoming-review-body')?.getAttribute('aria-busy') === 'false'); }
async function select(page, number) { await page.getByRole('button', { name: `Review invoice INV-SYN-${number}`, exact: true }).click(); await detailReady(page, number); }
async function clear(page) { await page.getByRole('button', { name: 'Clear', exact: true }).click(); }
async function geometry(page, width, dark) {
  const result = await page.locator('.incoming-invoices').evaluate(root => {
    const rect = node => { if (!node) return null; const bounds = node.getBoundingClientRect(); return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom }; };
    const measure = node => node ? { ...rect(node), padding: getComputedStyle(node).padding, fontSize: getComputedStyle(node).fontSize, lineHeight: getComputedStyle(node).lineHeight } : null;
    const overflow = [...root.querySelectorAll('.incoming-status,.incoming-row-action')].filter(node => { const cell = node.closest('td'); if (!cell) return false; const inner = node.getBoundingClientRect(), outer = cell.getBoundingClientRect(); return inner.left < outer.left - 1 || inner.right > outer.right + 1; }).map(node => node.textContent);
    return { documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: document.querySelector('main.main-content').scrollWidth <= document.querySelector('main.main-content').clientWidth + 1,
      contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      root: rect(root), table: rect(root.querySelector('.incoming-invoice-table')), register: rect(root.querySelector('.incoming-register')), review: rect(root.querySelector('.incoming-review')), footer: rect(root.querySelector('.incoming-review-footer')),
      reviewMetrics: { header: measure(root.querySelector('.incoming-review-header')), identity: measure(root.querySelector('.incoming-review-identity')), total: measure(root.querySelector('.incoming-review-total')),
        body: { ...measure(root.querySelector('.incoming-review-body')), scrollHeight: root.querySelector('.incoming-review-body')?.scrollHeight, clientHeight: root.querySelector('.incoming-review-body')?.clientHeight },
        sections: [...root.querySelectorAll('.incoming-review-section')].map(section => ({ label: section.querySelector('h3')?.textContent, ...measure(section), heading: measure(section.querySelector('h3')) })),
      },
      rowHeights: [...root.querySelectorAll('.incoming-invoice-table tbody tr')].map(row => row.getBoundingClientRect().height), overflow,
    };
  });
  geometries.push({ width, dark, ...result });
  assert.ok(result.documentFits && result.mainFits, `${width}: page fits viewport`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth, `${width}: shell offset unchanged`);
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
  assert.deepEqual(result.overflow, [], `${width}: badges and row actions fit their cells`);
  if (width >= 1440) { assert.ok(result.review.x > result.register.x + result.register.width - 2, `${width}: review remains beside register`); assert.ok(result.rowHeights.every(height => height <= 62), 'Invoice rows remain dense'); }
  if (width === 1672) {
    assert.ok(result.footer.bottom <= 941, 'Desktop review actions remain visible while its body scrolls');
    for (const label of ['Coding & attachments', 'Activity']) {
      const section = result.reviewMetrics.sections.find(section => section.label === label);
      assert.ok(section && section.bottom <= result.reviewMetrics.body.bottom + 1, `Desktop default ${label} fits above the review actions`);
    }
  }
}
async function axe(page, name) {
  const result = await new AxeBuilder({ page }).include('.incoming-invoices').include('[data-testid="incoming-invoice-review"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  accessibility.push({ name, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
  await writeFile(path.join(artifacts, 'accessibility.json'), JSON.stringify(accessibility, null, 2));
  assert.deepEqual(result.violations.map(item => item.id), [], `${name}: no accessibility violations`);
}
async function visualChecks() {
  for (const width of [1672, 1440, 1024, 390]) {
    const state = await open({ width }); const { page } = state;
    await detailReady(page, 101);
    await capture(page, `incoming-invoices-${width}`);
    await geometry(page, width, false);
    await axe(page, `light-${width}`);
    record(`${width}px light layout, dense table, review panel and accessibility`);
    await state.close();
  }
  const state = await open({ dark: true }); await detailReady(state.page, 101);
  await capture(state.page, 'incoming-invoices-dark'); await geometry(state.page, 1672, true); await axe(state.page, 'dark-1672'); await state.close();
  record('Dark palette retains legible invoice and review controls');
}
async function workflowChecks() {
  let state = await open(); let { page, control } = state;
  await detailReady(page, 101);
  assert.equal(control.requests.filter(request => request.endpoint === '/finance/invoices/').length, 3, 'All API pages are loaded');
  assert.equal(await rows(page).count(), 7);
  for (const [label, count] of [['All', 24], ['Needs review', 16], ['Exceptions', 6], ['Unmatched', 6], ['Ready for approval', 2], ['Payment ready', 4]]) {
    const tab = page.getByRole('tab', { name: new RegExp(`^${label}(?:\\s|\\d|$)`) }); assert.equal(await tab.locator('strong').innerText(), String(count), `${label} source count`);
    await tab.click(); assert.equal(await page.locator('.incoming-record-count').innerText(), `${count} invoices`);
  }
  await page.getByRole('tab', { selected: true }).press('Home'); assert.equal(await page.getByRole('tab', { selected: true }).getAttribute('id'), 'incoming-tab-all');
  await page.getByRole('tab', { selected: true }).press('End'); assert.equal(await page.getByRole('tab', { selected: true }).getAttribute('id'), 'incoming-tab-payment_ready');
  await clear(page);
  assert.equal(await page.getByLabel('Company', { exact: true }).isDisabled(), true);
  await page.getByLabel('Search invoices', { exact: true }).fill('INV-SYN-109'); assert.equal(await rows(page).count(), 1); await detailReady(page, 109);
  await clear(page); await page.getByLabel('Matching status', { exact: true }).selectOption('exception'); assert.equal(await rows(page).count(), 6);
  await clear(page); await page.getByLabel('Workflow stage', { exact: true }).selectOption('approved_for_payment'); assert.equal(await rows(page).count(), 4);
  await clear(page); await page.getByLabel('Due date', { exact: true }).selectOption('overdue'); assert.equal(await rows(page).count(), 6);
  await clear(page); await page.getByRole('button', { name: /^More filters/ }).click(); await page.getByLabel('Currency', { exact: true }).selectOption('USD'); assert.equal(await rows(page).count(), 6);
  assert.ok((await rows(page).allTextContents()).every(text => text.includes('USD')));
  await clear(page); await page.getByLabel('Supplier', { exact: true }).selectOption('Atlas Technical Supplies LLC'); assert.equal(await rows(page).count(), 5);
  await clear(page); await page.getByLabel('Payment status', { exact: true }).selectOption('paid'); assert.equal(await rows(page).count(), 2);
  await clear(page); await page.getByLabel('AP queue', { exact: true }).selectOption('review'); assert.equal(await page.locator('.incoming-record-count').innerText(), '16 invoices');
  record('Complete API pagination, truthful queue counts, keyboard tabs and intersecting filters');

  await clear(page); await page.getByRole('button', { name: 'Next page', exact: true }).click(); assert.equal(await rows(page).first().getByRole('button', { name: 'INV-SYN-108', exact: true }).count(), 1); await detailReady(page, 108);
  await page.getByLabel('Rows per page', { exact: true }).selectOption('25'); assert.equal(await rows(page).count(), 24);
  await page.getByRole('button', { name: 'Sort by Invoice', exact: true }).click(); await page.getByRole('button', { name: 'Sort by Invoice', exact: true }).click(); assert.ok((await rows(page).first().innerText()).includes('INV-SYN-124'));
  await clear(page); await page.getByLabel('Rows per page', { exact: true }).selectOption('7');
  await page.getByRole('button', { name: 'Invoice cards', exact: true }).click(); assert.equal(await page.locator('.incoming-card-grid article').count(), 7); await page.getByRole('button', { name: 'List view', exact: true }).click();
  const zeroRow = invoiceRow(page, 102); assert.ok((await zeroRow.innerText()).includes('AED 0.00'));
  await page.getByRole('button', { name: 'Review invoice INV-SYN-102', exact: true }).focus(); await page.keyboard.press('Enter'); await detailReady(page, 102);
  assert.equal(await page.getByTestId('incoming-review-total').innerText(), 'AED 0.00'); assert.equal(await page.getByTestId('incoming-review-source-file').getByRole('link').count(), 0);
  await page.getByRole('button', { name: 'Close invoice review', exact: true }).click(); await review(page).getByRole('heading', { name: 'Select an invoice', exact: true }).waitFor(); await select(page, 101);
  assert.equal(await review(page).getByRole('link', { name: 'Review & continue', exact: true }).getAttribute('href'), '/finance/incoming-invoices/101');
  assert.equal(await review(page).getByRole('link', { name: 'Resolve match', exact: true }).getAttribute('href'), '/finance/incoming-invoices/101');
  assert.equal(control.mutations.length, 0, 'Viewing, filtering and selection never decide or mutate invoices');
  record('Pagination, sorting, invoice cards, keyboard selection, zero values and existing detail links');

  control.deferredDetails.set(102, null);
  await page.getByRole('button', { name: 'Review invoice INV-SYN-102', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.incoming-review-body')?.getAttribute('aria-busy') === 'true');
  await select(page, 103);
  assert.equal(typeof control.deferredDetails.get(102), 'function'); control.deferredDetails.get(102)(); control.deferredDetails.delete(102);
  await page.waitForTimeout(150); await detailReady(page, 103); assert.ok((await page.getByTestId('incoming-review-total').innerText()).startsWith('USD '));
  control.failures['/finance/invoices/104/'] = 503; await select(page, 104); await review(page).getByRole('heading', { name: 'Invoice could not be loaded', exact: true }).waitFor();
  assert.equal(await page.getByTestId('incoming-review-total').count(), 0); assert.equal(await review(page).getByRole('link', { name: 'Review & continue', exact: true }).count(), 0);
  delete control.failures['/finance/invoices/104/']; await page.getByRole('button', { name: 'Retry invoice details', exact: true }).click(); await detailReady(page, 104); await page.getByTestId('incoming-review-total').waitFor();
  control.detailOverrides[105] = invoiceDetail(invoiceFixture().rows[5]); await select(page, 105); await review(page).getByRole('heading', { name: 'Invoice could not be loaded', exact: true }).waitFor(); delete control.detailOverrides[105];
  await select(page, 101);
  record('Late detail responses, mismatched IDs and source failures cannot replace the selected invoice');

  await page.getByRole('checkbox', { name: 'Select invoice INV-SYN-101', exact: true }).check();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise; const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8'); assert.ok(csv.includes('INV-SYN-101')); assert.ok(!csv.includes('INV-SYN-102')); assert.ok(csv.includes('"AED"')); assert.equal(csv.trim().split('\r\n').length, 2);
  await writeFile(path.join(artifacts, 'selected-invoice-export.csv'), csv);
  assert.equal(control.mutations.length, 0);
  record('Export contains only selected records with original currencies and uses no business write');
  await state.close();

  for (const fixture of ['loading', 'empty', 'zero', 'unknown', 'error', 'restricted', 'partial']) {
    state = await open({ fixture: fixture === 'loading' ? 'full' : fixture, loading: fixture === 'loading' }); ({ page, control } = state);
    if (fixture === 'loading') { await page.getByRole('heading', { name: /^Loading invoices/ }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true); await control.releaseList(); await loaded(page); assert.equal(await rows(page).count(), 7); }
    if (fixture === 'empty') { await page.getByRole('heading', { name: 'No incoming invoices yet', exact: true }).waitFor(); assert.equal(await page.getByRole('tab', { name: /^All/ }).locator('strong').innerText(), '0'); }
    if (fixture === 'zero') { await detailReady(page, 102); assert.equal(await page.getByTestId('incoming-review-total').innerText(), 'AED 0.00'); }
    if (fixture === 'unknown') { await detailReady(page, 110); assert.equal(await page.getByTestId('incoming-review-total').innerText(), '—'); assert.ok((await review(page).innerText()).includes('Currency not recorded')); }
    if (['error', 'restricted', 'partial'].includes(fixture)) { await page.getByRole('heading', { name: 'Unable to load invoices', exact: true }).waitFor(); assert.equal(await page.getByRole('tab', { name: /^All/ }).locator('strong').innerText(), '—'); assert.equal(await rows(page).count(), 0); control.fixture = 'full'; await page.getByRole('button', { name: 'Try again', exact: true }).click(); await loaded(page); assert.equal(await rows(page).count(), 7); }
    if (fixture !== 'loading') await capture(page, `state-${fixture}`);
    await state.close();
  }
  record('Loading, empty, zero, unknown, restricted, failed and incomplete sources remain distinct and retryable');
  await importChecks();
}

async function importChecks() {
  const state = await open(); const { page, control } = state;
  await page.getByRole('button', { name: 'Import invoice', exact: true }).click();
  await page.getByRole('heading', { name: 'Import Procurement Invoice PDF', exact: true }).waitFor();
  const file = page.locator('input[type="file"]');
  await file.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic unsupported file') });
  await page.getByText('Select a PDF invoice document.', { exact: true }).waitFor(); assert.equal(control.mutations.length, 0);
  await file.setInputFiles({ name: 'synthetic-invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from(invoicePdf) });
  assert.equal(control.mutations.length, 0, 'Choosing a PDF alone never uploads it');
  control.expectedMutations.push({ method: 'POST', endpoint: '/finance/invoices/import-preview/' });
  await page.getByRole('button', { name: 'Capture and Review', exact: true }).click(); await page.getByRole('heading', { name: 'Review captured fields', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Validate and Record', exact: true }).click();
  await page.getByText('Complete all required invoice and company-vendor fields before saving.', { exact: true }).waitFor(); assert.equal(control.mutations.length, 1, 'Unconfirmed required fields prevent recording');
  const vendorSelect = page.locator('select').filter({ has: page.locator('option[value="201"]') }); await vendorSelect.selectOption('201');
  control.expectedMutations.push({ method: 'POST', endpoint: '/finance/invoices/import-reviewed/' });
  await page.getByRole('button', { name: 'Validate and Record', exact: true }).click(); await page.getByRole('heading', { name: 'Successfully recorded synthetic invoice.', exact: true }).waitFor();
  assert.equal(control.mutations.length, 2); assert.ok(control.mutations[1].body.includes('source_file_sha256')); assert.ok(control.mutations[1].body.includes('b'.repeat(64))); assert.ok(control.mutations[1].body.includes('INV-SYN-NEW'));
  await page.getByRole('button', { name: 'Close and View Invoice List', exact: true }).click(); await loaded(page);
  assert.equal(control.expectedMutations.length, 0);
  await state.close(); record('Existing import flow validates files and reviewer fields; only explicit synthetic preview/record calls occur');
}
try {
  if (!workflowsOnly) await visualChecks();
  if (!visualsOnly) await workflowChecks();
  await guards();
  assert.deepEqual(runtimeErrors, [], 'No browser runtime errors');
  assert.deepEqual(unexpectedRequests, [], 'Every request stays within explicitly mocked sources');
  await writeFile(path.join(artifacts, 'checks.json'), JSON.stringify({ passed: true, checks, runtimeErrors, unexpectedRequests, mutations: allMutations, geometries, accessibility }, null, 2));
  record('Protected shared shell is unchanged; all browser contexts closed.');
} catch (error) {
  for (const context of browser.contexts()) { const page = context.pages()[0]; if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); }
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ error: error.stack, checks, runtimeErrors, unexpectedRequests, geometries, accessibility }, null, 2));
  throw error;
} finally { await browser.close(); }
