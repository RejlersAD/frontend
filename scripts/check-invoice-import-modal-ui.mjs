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
import { INVOICE_CHECK_TIME, invoiceDetail, invoiceFixture, invoiceImportPreview, invoicePdf, invoiceUser } from './check-incoming-invoices-fixtures.mjs';

// Real Incoming Invoice page, service and shared shell; all network traffic stays in this fixture context.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'invoice-import-modal');
const origin = 'http://incoming-invoices-check.test';
const baseline = process.argv.includes('--baseline');
const workflowOnly = process.argv.includes('--workflow-only');
const phase = baseline ? 'before' : 'after';
const beforeSource = path.join(artifacts, 'ProcurementInvoiceTracker.before.jsx');
const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/components/Layout/Header.jsx', 'src/components/Layout/Layout.jsx', 'src/config/layout.config.js', 'src/config/navigationLabels.config.js', 'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js', 'src/pages/UserDetail.jsx'];
await mkdir(artifacts, { recursive: true });
const startHashes = await snapshotSources(frontend, protectedFiles);

async function guards() {
  for (const row of startHashes) {
    assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Protected source changed: ${row.RelativePath}`);
  }
  await writeFile(path.join(artifacts, 'protected-source-checks.json'), JSON.stringify({ protectedFiles: protectedFiles.length, unchanged: true, phase }, null, 2));
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
  ...(baseline ? [[/pages[\\/]Finance[\\/]ProcurementInvoiceTracker\.jsx$/, await readFile(beforeSource, 'utf8')]] : []),
  [/services[\\/]api\.service\.js$/, apiClient],
  [/config[\\/]api\.config\.js$/, `export const API_BASE_URL='/api/v1';export const API_TIMEOUT=10000;export const API_ENDPOINTS={USER_ME:'/rbac/users/me/'};`],
  [/store[\\/]slices[\\/]authSlice\.js$/, 'export const updateUser=()=>({type:"fixture"});export const logout=()=>({type:"fixture-logout"});'],
  [/store[\\/]slices[\\/]themeSlice\.js$/, 'export const toggleTheme=()=>({type:"fixture-theme"});'],
  [/store[\\/]slices[\\/]rbacSlice\.js$/, 'export const fetchCurrentUser=()=>({type:"fixture-rbac"});'],
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
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources, ...(baseline ? [await readFile(beforeSource, 'utf8')] : [])].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css'), file => readFile(file, 'utf8')), { from: undefined });
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Incoming invoice browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const expectedSidebarWidth = await sidebarWidth(frontend);
const browser = await launchBrowser();
const runtimeErrors = [], unexpectedRequests = [], allMutations = [], checks = [], geometries = [], accessibility = [], defects = [];
const record = message => { checks.push(message); console.log(`PASS: ${message}`); };
async function newPage({ fixture = 'full', width = 1672, dark = false, loading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(INVOICE_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => { if (window !== window.top) return; window.invoiceUser = user; localStorage.setItem('radai_access_token', 'isolated-invoice-test-token'); document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark)); }, { user: invoiceUser, dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, requests: [], expectedMutations: [], mutations: [], failures: {}, detailOverrides: {}, deferredDetails: new Map(), loading, listPending: [], releases: {} };
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
      if (expected.hold) await new Promise(resolve => { control.releases[expected.hold] = resolve; });
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

const title = 'Import Procurement Invoice PDF';
const panel = page => page.locator('[data-check-import-panel]');
const modal = page => page.locator('[data-check-import-overlay]');
function verify(condition, message, detail) {
  if (!condition) defects.push({ message, detail });
  if (!condition && !baseline) console.warn(`FAIL: ${message}`);
}
async function identifyModal(page) {
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  await page.getByRole('heading', { name: title, exact: true }).evaluate(heading => {
    const content = heading.closest('header').parentElement;
    const overlay = heading.closest('dialog,[role="dialog"]') || heading.closest('.fixed');
    content.setAttribute('data-check-import-panel', ''); overlay.setAttribute('data-check-import-overlay', '');
  });
}
async function measure(page, name, width) {
  const value = await panel(page).evaluate(element => {
    const bounds = node => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
    const overlay = document.querySelector('[data-check-import-overlay]');
    const header = element.querySelector('header');
    const button = [...element.querySelectorAll('button')].find(node => /Choose or drop|synthetic-invoice\.pdf/.test(node.textContent));
    const visibleAt = (x, y) => { const hit = document.elementFromPoint(x, y); return { x, y, inside: !!hit && overlay.contains(hit), hit: hit?.tagName, hitClass: hit?.className?.baseVal || hit?.className || '' }; };
    const box = element.getBoundingClientRect();
    const points = [[box.left + 8, box.top + 8], [box.left + 8, Math.min(innerHeight - 8, box.top + box.height / 2)], [box.right - 8, box.top + 8]];
    if (button) { const rect = button.getBoundingClientRect(); points.push([rect.left + 8, Math.min(innerHeight - 8, rect.top + rect.height / 2)]); }
    return { panel: bounds(element), header: bounds(header), overlay: bounds(overlay), viewport: { width: innerWidth, height: innerHeight },
      horizontalOverflow: element.scrollWidth > element.clientWidth + 1, documentOverflow: document.documentElement.scrollWidth > innerWidth,
      semanticDialog: overlay.matches('dialog[open],[role="dialog"][aria-modal="true"]'), topLayer: overlay.matches(':modal'),
      focusInside: overlay.contains(document.activeElement), activeTag: document.activeElement?.tagName, activeLabel: document.activeElement?.getAttribute('aria-label'),
      points: points.map(([x, y]) => visibleAt(x, y)),
      sidebarPoint: visibleAt(24, Math.min(160, innerHeight - 10)),
      sidebarWidth: document.querySelector('#application-sidebar')?.getBoundingClientRect().width,
      scrollContainers: [...element.querySelectorAll('*')].filter(node => /auto|scroll/.test(getComputedStyle(node).overflowY)).map(node => ({ tag: node.tagName, className: node.className, ...bounds(node), clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollWidth: node.scrollWidth })),
    };
  });
  geometries.push({ name, width, ...value });
  verify(value.panel.x >= 0 && value.panel.right <= value.viewport.width + 1, `${name}: modal fits horizontally`, value.panel);
  verify(value.panel.y >= 0 && value.panel.bottom <= value.viewport.height + 1, `${name}: modal fits vertically`, value.panel);
  verify(!value.horizontalOverflow && !value.documentOverflow, `${name}: modal has no horizontal overflow`, value);
  verify(value.points.every(point => point.inside), `${name}: sidebar never paints over modal content`, value.points);
  verify(value.semanticDialog, `${name}: import is exposed as a modal dialog`, value);
  verify(value.focusInside, `${name}: keyboard focus stays inside the import dialog`, value);
  if (width >= 1024) {
    assert.equal(Math.round(value.sidebarWidth), expectedSidebarWidth, 'Existing sidebar width is unchanged');
    verify(value.sidebarPoint.inside, `${name}: background sidebar is blocked by the modal`, value.sidebarPoint);
  }
  return value;
}
async function a11y(page, name) {
  const result = await new AxeBuilder({ page }).include('[data-check-import-overlay]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const violations = result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
  accessibility.push({ name, violations }); verify(!violations.length, `${name}: modal accessibility`, violations);
}
async function resetModalScroll(page) {
  await modal(page).evaluate(element => { for (const node of [element, ...element.querySelectorAll('*')]) if (node.scrollTop || node.scrollLeft) node.scrollTo({ top: 0, left: 0, behavior: 'instant' }); });
}
async function closeModal(page) {
  if (baseline) await panel(page).locator('header button').last().click();
  else await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: title, exact: true }).waitFor({ state: 'hidden' });
  if (!baseline) await page.waitForFunction(() => document.activeElement?.textContent.trim() === 'Import invoice');
}
async function runScenario({ width, dark = false }) {
  const state = await newPage({ width, dark }); const { page, control } = state;
  const name = `${phase}-${width}${dark ? '-dark' : ''}`;
  await page.getByRole('button', { name: 'Import invoice', exact: true }).click(); await identifyModal(page);
  await capture(page, `${name}-upload`); await measure(page, `${name}-upload`, width); await a11y(page, `${name}-upload`);
  if (!baseline) {
    const last = modal(page).locator('button:not(:disabled),a[href],input:not([type="file"]),select,textarea').last();
    await last.focus(); await page.keyboard.press('Tab');
    verify(await modal(page).evaluate(element => element.contains(document.activeElement)), `${name}: Tab wraps inside the modal`);
  }
  const file = modal(page).locator('input[type="file"]');
  await file.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic unsupported file') });
  await page.getByText('Select a PDF invoice document.', { exact: true }).waitFor(); assert.equal(control.mutations.length, 0);
  await file.setInputFiles({ name: 'synthetic-invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from(invoicePdf) });
  assert.equal(control.mutations.length, 0, 'Choosing a synthetic PDF alone does not upload it');
  control.expectedMutations.push({ method: 'POST', endpoint: '/finance/invoices/import-preview/' });
  await modal(page).getByRole('button', { name: 'Capture and Review', exact: true }).click();
  await page.getByRole('heading', { name: 'Review captured fields', exact: true }).waitFor(); await resetModalScroll(page);
  await capture(page, `${name}-review`); await measure(page, `${name}-review`, width); await a11y(page, `${name}-review`);
  const save = modal(page).getByRole('button', { name: 'Validate and Record', exact: true });
  await save.scrollIntoViewIfNeeded();
  const actions = await save.evaluate(button => {
    const rect = button.getBoundingClientRect(), overlay = document.querySelector('[data-check-import-overlay]');
    const close = overlay.querySelector('header button'); const closeRect = close.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { reachable: rect.top >= 0 && rect.bottom <= innerHeight && (hit === button || button.contains(hit)), closeVisible: closeRect.top >= 0 && closeRect.bottom <= innerHeight, activeTag: document.activeElement?.tagName };
  });
  verify(actions.reachable, `${name}: review action can be reached by scrolling`, actions);
  verify(actions.closeVisible, `${name}: close control remains visible while reviewing the final fields`, actions);
  if (!baseline) {
    await modal(page).getByRole('button', { name: /Change PDF/i }).click();
    await modal(page).getByRole('button', { name: 'Capture and Review', exact: true }).waitFor();
    assert.equal(control.mutations.length, 1, 'Returning to PDF selection does not record or reupload the invoice');
  }
  await closeModal(page);
  assert.equal(control.mutations.length, 1, 'Only the explicitly mocked preview call occurs; no record is written');
  assert.equal(control.expectedMutations.length, 0);
  await page.getByRole('button', { name: 'Import invoice', exact: true }).click(); await identifyModal(page);
  assert.equal(await modal(page).getByRole('button', { name: 'Capture and Review', exact: true }).isDisabled(), true, 'Reopening starts with a clean file selection');
  await closeModal(page); await state.close();
  record(`${name}: isolated upload, OCR review, scroll access, close and reset`);
}

async function dropPdf(page, files) {
  const transfer = await page.evaluateHandle(({ pdf, files }) => {
    const data = new DataTransfer(); for (const file of files) data.items.add(new File([pdf], file.name, { type: file.type || 'application/pdf' })); return data;
  }, { pdf: invoicePdf, files });
  await modal(page).locator('.pi-import-dropzone').dispatchEvent('drop', { dataTransfer: transfer }); await transfer.dispose();
}
async function enhancedWorkflow() {
  const state = await newPage(); const { page, control } = state;
  await page.getByRole('button', { name: 'Import invoice', exact: true }).click(); await identifyModal(page);
  const file = modal(page).locator('input[type="file"]');
  await file.setInputFiles({ name: 'invoice.txt', mimeType: 'application/pdf', buffer: Buffer.from(invoicePdf) });
  await modal(page).getByText('Select a PDF invoice document.', { exact: true }).waitFor();
  await file.setInputFiles({ name: 'oversized.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(20 * 1024 * 1024 + 1) });
  await modal(page).getByText('PDF exceeds the 20 MB limit.', { exact: true }).waitFor();
  await dropPdf(page, [{ name: 'first.pdf' }, { name: 'second.pdf' }]); await modal(page).getByText('Choose one PDF invoice at a time.', { exact: true }).waitFor();
  await dropPdf(page, [{ name: 'dropped-invoice.pdf', type: 'application/octet-stream' }]);
  await modal(page).getByText('dropped-invoice.pdf', { exact: true }).waitFor();
  assert.equal(control.mutations.length, 0, 'Validation and dropping a PDF do not upload it');
  const preview = structuredClone(invoiceImportPreview);
  preview.extracted.currency = 'EUR'; preview.vendor_options[0].id = '201';
  preview.purchase_order_options = [{ id: 'po-synthetic-1', po_number: 'PO-SYN-1', vendor_name: preview.extracted.vendor_name, currency: 'EUR', total_amount: '105.00' }, { id: 'po-synthetic-2', po_number: 'PO-SYN-2', vendor_name: preview.extracted.vendor_name, currency: 'USD', total_amount: '105.00' }];
  control.expectedMutations.push({ method: 'POST', endpoint: '/finance/invoices/import-preview/', data: preview, hold: 'preview' });
  await modal(page).getByRole('button', { name: 'Capture and Review', exact: true }).click();
  await modal(page).getByRole('button', { name: /Reading invoice with OCR/ }).waitFor();
  assert.equal(await file.isDisabled(), true); assert.equal(await modal(page).locator('.pi-import-dropzone').isDisabled(), true);
  await dropPdf(page, [{ name: 'replacement.pdf' }]); assert.equal(await modal(page).getByText('dropped-invoice.pdf', { exact: true }).count(), 1);
  await page.keyboard.press('Escape'); assert.equal(await modal(page).isVisible(), true, 'OCR cannot be closed while its source is being processed');
  assert.equal(typeof control.releases.preview, 'function'); control.releases.preview();
  await modal(page).getByRole('heading', { name: 'Review captured fields', exact: true }).waitFor();
  const po = modal(page).getByLabel(/^Select PO \(optional\)/);
  await po.selectOption('po-synthetic-1'); await modal(page).getByRole('checkbox', { name: /I confirm this PO match/ }).check();
  await po.selectOption('po-synthetic-2'); assert.equal(await modal(page).getByRole('checkbox', { name: /I confirm this PO match/ }).isChecked(), false, 'Changing the PO requires a fresh explicit confirmation');
  await modal(page).getByRole('button', { name: 'Add line', exact: true }).click();
  await modal(page).getByLabel(/^Currency/).selectOption('USD');
  await modal(page).getByRole('button', { name: 'Add line', exact: true }).click();
  for (const number of [1, 2]) {
    await modal(page).getByLabel(`Line ${number} description`, { exact: true }).fill(`Synthetic line ${number}`);
    await modal(page).getByLabel(`Line ${number} quantity`, { exact: true }).fill('1');
    await modal(page).getByLabel(`Line ${number} unit price`, { exact: true }).fill('50');
    await modal(page).getByLabel(`Line ${number} total`, { exact: true }).fill('52.50');
  }
  await modal(page).getByLabel(/^Company vendor master/).selectOption('201');
  await modal(page).getByRole('checkbox', { name: /I confirm this PO match/ }).check();
  control.expectedMutations.push({ method: 'POST', endpoint: '/finance/invoices/import-reviewed/', hold: 'record' });
  await modal(page).getByRole('button', { name: 'Validate and Record', exact: true }).click();
  await modal(page).getByRole('button', { name: /Recording/i }).waitFor();
  assert.equal(await modal(page).getByLabel('Line 1 description', { exact: true }).isDisabled(), true, 'Reviewed fields cannot change while recording is pending');
  assert.equal(await modal(page).getByRole('button', { name: 'Close invoice import', exact: true }).isDisabled(), true);
  const body = control.mutations.at(-1).body;
  const captured = JSON.parse(body.match(/name="reviewed_data"\r\n\r\n([\s\S]*?)\r\n--/)[1]);
  assert.equal(captured.currency, 'USD'); assert.deepEqual(captured.line_items.map(line => line.currency), ['USD', 'USD']);
  assert.equal(captured.confirmed_po_id, 'po-synthetic-2'); assert.equal(captured.confirm_po_match, true);
  assert.ok(body.includes('dropped-invoice.pdf') && body.includes('b'.repeat(64)), 'Reviewed fields stay bound to the selected PDF and OCR hash');
  assert.equal(typeof control.releases.record, 'function'); control.releases.record();
  await modal(page).getByRole('heading', { name: 'Successfully recorded synthetic invoice.', exact: true }).waitFor();
  await capture(page, 'after-recorded-synthetic'); await a11y(page, 'after-recorded-synthetic');
  await modal(page).getByRole('button', { name: 'Close and View Invoice List', exact: true }).click();
  await page.getByRole('heading', { name: title, exact: true }).waitFor({ state: 'hidden' });
  assert.equal(control.expectedMutations.length, 0); await state.close();
  record('PDF extension/size/drop validation, OCR source lock, PO confirmation reset, currency consistency and mocked recording state');
}

try {
  if (!workflowOnly) {
    for (const width of baseline ? [1672, 1024, 390] : [1672, 1440, 1024, 390]) await runScenario({ width });
    if (!baseline) await runScenario({ width: 1672, dark: true });
  }
  if (!baseline) await enhancedWorkflow();
  await guards(); assert.deepEqual(runtimeErrors, [], 'No browser runtime errors'); assert.deepEqual(unexpectedRequests, [], 'Every request is explicitly mocked');
  if (!baseline) assert.deepEqual(defects, [], 'No modal layout, focus, scrolling or accessibility defects remain');
  assert.ok(allMutations.every(mutation => ['/finance/invoices/import-preview/', '/finance/invoices/import-reviewed/'].includes(mutation.endpoint)), 'Every import operation is explicitly intercepted; no real database is accessed');
  await writeFile(path.join(artifacts, `${phase}${workflowOnly ? '-workflow' : ''}-checks.json`), JSON.stringify({ passed: baseline ? defects.length === 0 : true, phase, defects, checks, geometries, accessibility, runtimeErrors, unexpectedRequests, mutations: allMutations }, null, 2));
} catch (error) {
  for (const context of browser.contexts()) { const page = context.pages()[0]; if (page && !page.isClosed()) await page.screenshot({ path: path.join(artifacts, `${phase}-failure.png`) }).catch(() => {}); }
  await writeFile(path.join(artifacts, `${phase}-failure.json`), JSON.stringify({ error: error.stack, phase, defects, checks, geometries, accessibility, runtimeErrors, unexpectedRequests }, null, 2)); throw error;
} finally { await browser.close(); }
