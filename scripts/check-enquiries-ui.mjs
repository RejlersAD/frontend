import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inlineLocalCssImports, checkArtifacts, historicalGuardsEnabled, loadSnapshot, launchBrowser, sidebarWidth } from './ui-check-support.mjs';
import AxeBuilder from '@axe-core/playwright';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { ENQUIRY_CHECK_TIME, enquiryDetail, enquiryFixture, enquiryStats, enquiryUsers } from './check-enquiries-fixtures.mjs';

// Actual enquiry page and shared shell. All requests are intercepted; writes require an exact fixture expectation.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'enquiry-operations');
const origin = 'http://enquiries-check.test';
const baselineOnly = process.argv.includes('--baseline');
const workflowsOnly = process.argv.includes('--workflows-only');
const visualsOnly = process.argv.includes('--visuals-only');
await mkdir(artifacts, { recursive: true });
const snapshotGuards = historicalGuardsEnabled(baselineOnly);
console.log(`Historical snapshot guards: ${snapshotGuards ? 'enabled' : 'not requested; core checks remain enabled'}`);
const baseline = await loadSnapshot(frontend, path.join(artifacts, 'source-before-sha256.json'), snapshotGuards);
const sourcePaths = new Map(baseline.map(row => [path.normalize(row.Path).toLowerCase(), path.join(artifacts, 'source-before', row.RelativePath)]));
async function checkProtectedSources() {
  let approvedLayoutAddition = false;
  for (const row of baseline) {
    assert.equal(createHash('sha256').update(await readFile(path.join(artifacts, 'source-before', row.RelativePath))).digest('hex').toUpperCase(), row.Hash, `Immutable baseline changed: ${row.RelativePath}`);
    if (row.Protected) {
      let current = await readFile(row.Path);
      if (row.RelativePath === 'src/components/Layout/Layout.jsx' && createHash('sha256').update(current).digest('hex').toUpperCase() !== row.Hash) {
        const text = current.toString('utf8');
        const routeArray = text.match(/const isViewportWorkspace = \[[^\]]*\]\.includes\(location\.pathname\)/)?.[0];
        assert.ok(routeArray?.includes(", '/admin/enquiries'"), 'Only the approved Enquiries viewport route may be added to Layout');
        assert.equal(routeArray.split("'/admin/enquiries'").length, 2);
        current = Buffer.from(text.replace(routeArray, routeArray.replace(", '/admin/enquiries'", '')));
        approvedLayoutAddition = true;
      }
      assert.equal(createHash('sha256').update(current).digest('hex').toUpperCase(), row.Hash, `Protected source changed: ${row.RelativePath}`);
    }
  }
  await writeFile(path.join(artifacts, 'protected-source-checks.json'), JSON.stringify({ historicalGuardsEnabled: snapshotGuards, immutableFiles: baseline.length, protectedFiles: baseline.filter(row => row.Protected).length, hashesUnchanged: true, approvedLayoutAddition }, null, 2));
}
await checkProtectedSources();
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';import EnquiryManagement from './src/pages/Admin/EnquiryManagement.jsx';
let state={auth:{user:window.enquiryUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:window.enquiryRbac}};const listeners=new Set();
const store={getState:()=>state,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},dispatch:()=>{}};
window.enquirySetUser=user=>{state={...state,auth:{...state.auth,user},rbac:{currentUser:{...state.rbac.currentUser,user}}};for(const listener of listeners)listener()};
function Observer(){const location=useLocation();window.enquiryRoute=location.pathname+location.search;window.enquiryNavigate=useNavigate();return null;}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/admin/enquiries']}><Observer/><Routes><Route element={<Layout/>}><Route path='/admin/enquiries' element={<EnquiryManagement/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
`;
const apiClient = `
async function request(method,url,body,config={}){
 const target=new URL('/api/v1'+url,location.origin);for(const [key,value] of Object.entries(config.params||{}))if(value!==undefined&&value!==null)target.searchParams.set(key,value);
 const response=await fetch(target,{method,signal:config.signal,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=config.responseType==='blob'?await response.blob():await response.json();
 if(!response.ok){const error=new Error(data.detail||'Fixture request failed');error.response={status:response.status,data};throw error;}return {data,status:response.status};
}
export default {get:(url,config)=>request('GET',url,undefined,config),post:(url,body,config)=>request('POST',url,body,config),patch:(url,body,config)=>request('PATCH',url,body,config),delete:(url,config)=>request('DELETE',url,undefined,config)};`;
const serviceButtons = `import React from 'react';import {BellIcon,ArrowDownTrayIcon} from '@heroicons/react/24/outline';
export function NotificationBell(){return <button aria-label='Notifications' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><BellIcon className='h-5 w-5'/></button>}
export default function PWAHeaderInstall(){return <button aria-label='Install RADAI on this device' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><ArrowDownTrayIcon className='h-5 w-5'/></button>}`;
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
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Enquiries"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const savedSourcePlugin = { name: 'enquiry-saved-source', setup(builder) {
  if (baselineOnly) builder.onLoad({ filter: /\.[jm]sx?$|\.css$/ }, async args => {
    const saved = sourcePaths.get(path.normalize(args.path).toLowerCase());
    return saved ? { contents: await readFile(saved, 'utf8'), loader: args.path.endsWith('.css') ? 'css' : 'jsx', resolveDir: path.dirname(args.path) } : undefined;
  });
} };
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'enquiry-fixture', setup(builder) { builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' })); for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' })); } }, savedSourcePlugin] });
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(path.join(frontend, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await filesIn(file)); else result.push(file);
  }
  return result;
}
const related = [...(await filesIn('src/pages/Admin')).filter(file => /enquir/i.test(file)), ...await filesIn('src/components/enquiries')];
const componentFiles = [...new Set([...await filesIn('src/components/Layout'), 'src/config/layout.config.js', ...related])].filter(file => !baselineOnly || sourcePaths.has(path.normalize(path.join(frontend, file)).toLowerCase()));
const readSource = file => readFile(baselineOnly && sourcePaths.has(path.normalize(path.join(frontend, file)).toLowerCase()) ? sourcePaths.get(path.normalize(path.join(frontend, file)).toLowerCase()) : path.join(frontend, file), 'utf8');
const classSources = await Promise.all(componentFiles.filter(file => /\.[jm]sx?$/.test(file)).map(readSource));
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readSource('src/index.css'), path.join(frontend, 'src/index.css'), file => readSource(path.relative(frontend, file).replaceAll('\\', '/'))), { from: undefined });
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' }, plugins: [savedSourcePlugin] });
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Enquiry browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
if (baselineOnly) {
  try { html = await readFile(path.join(artifacts, 'baseline.html'), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path.join(artifacts, 'baseline.html'), html, { flag: 'wx' }); }
}
const expectedSidebarWidth = await sidebarWidth(frontend);
const browser = await launchBrowser();
const runtimeErrors = [], unexpectedRequests = [], allMutations = [], checks = [], geometryChecks = [];
const recordCheck = message => { checks.push(message); console.log(`PASS: ${message}`); };
async function newPage({ fixture = 'full', width = 1672, dark = false, role = 'admin', loading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(ENQUIRY_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => {
    window.enquiryUser = user; window.enquiryRbac = { user, roles: user.roles, modules: [], is_reporting_manager: true, direct_reports_count: 2 };
    localStorage.setItem('radai_access_token', 'isolated-enquiry-test-token');
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark));
  }, { user: enquiryUsers[role], dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, loading, pending: [], requests: [], mutations: [], expectedMutations: [], overrides: {}, endpointFailures: {}, updated: {} };
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const respond = async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace(/^\/api\/v1/, '');
    const data = typeof control.fixture === 'string' ? enquiryFixture(control.fixture) : structuredClone(control.fixture);
    data.rows = data.rows.map(row => control.updated[row.id] || row);
    if (Object.keys(control.updated).length) data.stats = enquiryStats(data.rows);
    control.requests.push({ method: request.method(), endpoint, query: url.search, body: request.postDataJSON() });
    if (request.method() !== 'GET') {
      const mutation = { method: request.method(), endpoint, body: request.postDataJSON() };
      control.mutations.push(mutation); allMutations.push(mutation);
      const expected = control.expectedMutations.shift();
      if (!expected || expected.method !== request.method() || expected.endpoint !== endpoint) { unexpectedRequests.push(`Unexpected mutation ${request.method()} ${endpoint}`); return json(route, { detail: 'Unexpected fixture mutation refused.' }, 409); }
      if (expected.defer) await new Promise(resolve => { control.releaseMutation = resolve; });
      if (expected.status && expected.status !== 200) return json(route, { detail: expected.detail || 'Synthetic update failed.' }, expected.status);
      const id = Number(endpoint.split('/').filter(Boolean).at(-1));
      const row = data.rows.find(record => record.id === id);
      const updated = expected.data?.enquiry || (row ? { ...row, ...mutation.body, assigned_to: mutation.body?.assigned_to === undefined ? row.assigned_to : data.representatives.find(person => person.id === Number(mutation.body.assigned_to)) || null, assigned_at: mutation.body?.assigned_to === undefined ? row.assigned_at : mutation.body.assigned_to === null ? null : ENQUIRY_CHECK_TIME } : null);
      if (updated) control.updated[id] = updated;
      return json(route, expected.data || { success: true, enquiry: updated ? enquiryDetail(updated) : null });
    }
    const failure = control.endpointFailures[endpoint] || data.failures[endpoint];
    if (failure) return json(route, { detail: failure === 403 ? 'Enquiry management access is required.' : 'Synthetic enquiry source is unavailable.' }, failure);
    if (control.overrides[endpoint]) return json(route, control.overrides[endpoint]);
    if (endpoint === '/rbac/users/me/') return json(route, { user: enquiryUsers[role], roles: enquiryUsers[role].roles, modules: [] });
    if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
    if (endpoint === '/enquiry/') {
      let rows = data.rows;
      const q = url.searchParams;
      const active = row => !['resolved', 'closed', 'spam'].includes(row.status);
      const assessed = row => active(row) && row.status !== 'pending_confirmation';
      const instant = new Date(ENQUIRY_CHECK_TIME).getTime();
      if (q.get('queue') === 'mine') rows = rows.filter(row => active(row) && row.assigned_to?.id === enquiryUsers[role].id);
      if (q.get('queue') === 'unassigned') rows = rows.filter(row => active(row) && !row.assigned_to);
      if (q.get('queue') === 'at_risk') rows = rows.filter(row => assessed(row) && row.due_at && new Date(row.due_at).getTime() < instant);
      for (const field of ['status', 'urgency', 'department', 'service', 'inquiry_type']) if (q.get(field)) rows = rows.filter(row => row[field] === q.get(field));
      if (q.get('assigned_to') === 'me') rows = rows.filter(row => row.assigned_to?.id === enquiryUsers[role].id);
      else if (q.get('assigned_to') === 'unassigned') rows = rows.filter(row => !row.assigned_to);
      else if (q.get('assigned_to')) rows = rows.filter(row => String(row.assigned_to?.id) === q.get('assigned_to'));
      if (q.get('sla')) rows = rows.filter(row => {
        if (!assessed(row)) return false;
        if (q.get('sla') === 'no_deadline') return !row.due_at;
        const due = row.due_at ? new Date(row.due_at).getTime() : null;
        if (due === null) return false;
        if (q.get('sla') === 'overdue') return due < instant;
        if (q.get('sla') === 'on_track') return due >= instant;
        if (q.get('sla') === 'due_today') return due >= Date.parse('2026-09-13T20:00:00Z') && due < Date.parse('2026-09-14T20:00:00Z');
        return true;
      });
      if (q.get('search')) rows = rows.filter(row => [row.reference, row.name, row.email, row.company, row.subject, row.message].join(' ').toLowerCase().includes(q.get('search').trim().toLowerCase()));
      const pageNumber = Math.max(1, Number(q.get('page')) || 1), size = Math.min(100, Math.max(1, Number(q.get('page_size')) || 25));
      const payload = { success: true, count: rows.length, page: pageNumber, page_size: size, results: rows.slice((pageNumber - 1) * size, pageNumber * size) };
      if (size === 100 && control.exportMode === 'oversized') payload.count = 5001;
      if (size === 100 && pageNumber > 1 && control.exportMode === 'count-change') payload.count += 1;
      if (size === 100 && pageNumber > 1 && control.exportMode === 'duplicate') payload.results = rows.slice(0, payload.results.length);
      if (size === 100 && control.deferExports) await new Promise(resolve => { control.releaseExport = resolve; control.onExportHeld?.(); });
      return json(route, payload);
    }
    if (endpoint === '/enquiry/stats/') return json(route, data.stats);
    if (endpoint === '/enquiry/representatives/') return json(route, { results: data.representatives });
    const detailMatch = endpoint.match(/^\/enquiry\/(\d+)\/$/);
    if (detailMatch) { const row = data.rows.find(row => row.id === Number(detailMatch[1])); return json(route, row ? { success: true, enquiry: enquiryDetail(row) } : { detail: 'Enquiry not found.' }, row ? 200 : 404); }
    if (/^\/enquiry\/\d+\/attachments\/\d+\/$/.test(endpoint)) return route.fulfill({ contentType: 'text/plain', body: 'Synthetic attachment for isolated browser verification.' });
    unexpectedRequests.push(`${request.method()} ${endpoint}`); return json(route, { detail: 'Unmapped fixture request.' }, 404);
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (route.request().isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) { if (control.loading) { control.pending.push(route); return; } return respond(route); }
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Report missing artwork below. */ }
    }
    unexpectedRequests.push(route.request().url()); return route.abort();
  });
  control.release = async () => { control.loading = false; await Promise.all(control.pending.splice(0).map(respond)); };
  await page.goto(origin);
  return { page, control };
}
async function capture(page, name) {
  await page.locator('main.main-content').evaluate(main => {
    for (const node of [main, ...main.querySelectorAll('*')]) if (node.scrollTop) node.scrollTo({ top: 0, behavior: 'instant' });
    for (let node = main.parentElement; node; node = node.parentElement) node.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
}
async function geometry(page, width) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 941 }); await page.waitForTimeout(200);
  const result = await page.locator('main.main-content').evaluate(main => {
    const queues = main.querySelector('.eop-queues')?.getBoundingClientRect();
    const selected = main.querySelector('.eop-queues [aria-current="page"]')?.getBoundingClientRect();
    return { documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: main.scrollWidth <= main.clientWidth + 1, contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      rowHeights: [...main.querySelectorAll('.eop-table tbody tr')].map(row => row.getBoundingClientRect().height),
      selectedQueueVisible: !queues || !selected || (selected.left >= queues.left - 1 && selected.right <= queues.right + 1),
      badgeOverflow: [...main.querySelectorAll('.eop-table td .eop-status,.eop-table td .eop-priority,.eop-table td .eop-open')].filter(node => { const bounds = node.getBoundingClientRect(), cell = node.closest('td').getBoundingClientRect(); return bounds.left < cell.left - 1 || bounds.right > cell.right + 1; }).map(node => node.textContent),
    };
  });
  assert.equal(result.documentFits, true, `${width}: no page overflow`);
  if (!baselineOnly) assert.equal(result.mainFits, true, `${width}: content fits shared shell`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth);
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
  if (!baselineOnly) { assert.deepEqual(result.badgeOverflow, [], `${width}: table badges/actions do not overlap adjacent columns`); assert.ok(result.rowHeights.every(height => height <= 53.5), `${width}: standard enquiry rows preserve53px density`); assert.equal(result.selectedQueueVisible, true, `${width}: selected queue remains visible`); }
  geometryChecks.push({ width, ...result });
}
const registerRows = page => page.locator('.eop-table tbody tr[data-enquiry-id]');
const triage = page => page.getByTestId('enquiry-triage-summary');
const kpi = (page, title) => page.locator('.eop-kpi').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).locator('strong');
const health = (page, label) => page.locator('.eop-health-metric').filter({ hasText: label }).locator('strong');
async function loaded(page) {
  await page.getByTestId('enquiry-operations').waitFor();
  await page.waitForFunction(() => document.querySelector('.eop-register')?.getAttribute('aria-busy') === 'false'
    && document.querySelector('[data-testid="enquiry-triage-summary"]')?.getAttribute('aria-busy') === 'false'
    && ![...document.querySelectorAll('.eop-header-actions button')].find(node => node.textContent.trim() === 'Refresh')?.disabled);
}
async function open(options) { const state = await newPage(options); if (!options?.loading) await loaded(state.page); return state; }
async function queue(page, label) { await page.getByRole('navigation', { name: 'Enquiry queues' }).getByRole('button', { name: new RegExp(`^${label}`) }).click(); await loaded(page); }
async function filter(page, label, value) { await page.getByLabel(label, { exact: true }).selectOption(value); await loaded(page); }
async function clear(page) { await page.getByRole('region', { name: 'Enquiry filters' }).getByRole('button', { name: 'Clear filters', exact: true }).click(); await loaded(page); }
async function search(page, text) { await page.getByRole('searchbox', { name: 'Search enquiries' }).fill(text); await loaded(page); }
async function choose(page, reference) { await page.getByRole('button', { name: `Open ${reference} summary`, exact: true }).click(); await loaded(page); }
async function focusContained(page, dialog) {
  const controls = dialog.locator('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
  const visible = [];
  for (let index = 0; index < await controls.count(); index++) if (await controls.nth(index).isVisible()) visible.push(controls.nth(index));
  assert.ok(visible.length);
  await visible.at(-1).focus(); await page.keyboard.press('Tab');
  assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, 'Forward Tab remains in assignment dialog');
  await visible[0].focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, 'Reverse Tab remains in assignment dialog');
}
async function assignDialog(page) {
  await triage(page).getByRole('button', { name: 'Assign', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Assign enquiry' }); await dialog.waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="enquiry-assign-dialog"] .eop-assign-loading'));
  return dialog;
}
async function exportCsv(page) {
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloaded; assert.match(download.suggestedFilename(), /^enquiries-.*\.csv$/);
  return readFile(await download.path(), 'utf8');
}
async function runFunctionalChecks() {
  const { page, control } = await open();
  assert.equal(await registerRows(page).count(), 7);
  for (const [label, value] of [['Open enquiries', '20'], ['Unassigned', '5'], ['Overdue SLA', '5'], ['Median response', '1.5h']]) assert.equal(await kpi(page, label).innerText(), value);
  assert.equal(await health(page, 'First response within SLA').innerText(), '100%');
  assert.equal(await health(page, 'Resolved this week').innerText(), '1');
  assert.match(await page.locator('.eop-pagination').innerText(), /of 24 enquiries/);
  assert.equal(control.requests.filter(row => row.endpoint === '/enquiry/stats/').length, 1);
  assert.equal(control.requests.some(row => row.endpoint === '/enquiry/representatives/'), false);
  await page.getByRole('button', { name: 'Next page', exact: true }).click(); await loaded(page);
  assert.match(await page.locator('.eop-pagination').innerText(), /Page 2 of 4/);
  assert.match(await triage(page).innerText(), /ENQ-000108/);
  for (const [name, count] of [['My queue', 8], ['Unassigned', 5], ['At risk', 5], ['All enquiries', 24]]) {
    await queue(page, name); assert.match(await page.locator('.eop-pagination').innerText(), new RegExp(`of ${count} enquiries`));
  }
  await filter(page, 'Status', 'new'); await filter(page, 'Priority', 'urgent'); await filter(page, 'Department', 'IT / Digital'); await filter(page, 'Owner', 'unassigned'); await filter(page, 'SLA', 'overdue');
  assert.equal(await registerRows(page).count(), 2);
  await search(page, 'ENQ-000101'); assert.equal(await registerRows(page).count(), 1);
  assert.match(await registerRows(page).innerText(), /Access to project document workspace/);
  assert.equal(await kpi(page, 'Open enquiries').innerText(), '20', 'Register filters do not change global service metrics');
  assert.equal(control.requests.filter(row => row.endpoint === '/enquiry/stats/').length, 1);
  await search(page, 'no matching synthetic enquiry'); await page.getByRole('heading', { name: 'No matching enquiries' }).waitFor();
  await clear(page); await filter(page, 'Owner', '610'); assert.equal(await registerRows(page).count(), 6);
  await clear(page); await filter(page, 'SLA', 'no_deadline'); assert.equal(await registerRows(page).count(), 1); assert.match(await registerRows(page).innerText(), /ENQ-000122/);
  await clear(page); await filter(page, 'SLA', 'due_today'); assert.equal(await registerRows(page).count(), 6);
  assert.equal(await page.locator('[data-enquiry-id="106"]').count(), 0, 'Awaiting confirmation is excluded from SLA assessment');
  await clear(page); await choose(page, 'ENQ-000101');
  assert.match(await triage(page).innerText(), /Access to project document workspace/);
  for (const id of ['similar_requests', 'suggested_assignment', 'knowledge_article']) assert.match(await page.getByTestId(`enquiry-triage-${id}`).innerText(), /Not available/);
  assert.equal(await page.getByTestId('enquiry-triage-stage-triaged').getAttribute('data-state'), 'unknown');
  await page.getByRole('button', { name: 'Close triage summary' }).click(); await page.getByTestId('enquiry-triage-empty').waitFor();
  await choose(page, 'ENQ-000102'); assert.match(await triage(page).innerText(), /Supplier onboarding/);
  assert.deepEqual(control.mutations, []);
  recordCheck('Server pagination, all queue/search/status/priority/department/owner/SLA intersections, unchanged global metrics and truthful selected triage');

  await page.getByRole('button', { name: 'View service analytics' }).click(); await page.getByRole('heading', { name: 'Service analytics', exact: true }).waitFor();
  assert.match(await page.locator('#eop-service-analytics').innerText(), /16/);
  await page.getByRole('button', { name: 'Hide service analytics' }).click();
  const statsBefore = control.requests.filter(row => row.endpoint === '/enquiry/stats/').length;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page);
  assert.equal(control.requests.filter(row => row.endpoint === '/enquiry/stats/').length, statsBefore + 1);
  await filter(page, 'Department', 'Procurement');
  const csv = await exportCsv(page); assert.equal(csv.split('\r\n').length, 4); assert.doesNotMatch(csv, /Invoice allocation/);
  await writeFile(path.join(artifacts, 'filtered-export.csv'), csv);
  assert.deepEqual(control.mutations, []);
  await clear(page); await choose(page, 'ENQ-000101');
  await triage(page).getByRole('button', { name: 'Open & respond' }).click(); await page.getByRole('heading', { name: 'Source destination' }).waitFor();
  assert.equal(await page.evaluate(() => window.enquiryRoute), '/admin/enquiries/101');
  await page.evaluate(() => window.enquiryNavigate('/admin/enquiries')); await loaded(page);
  await page.getByRole('link', { name: 'ENQ-000102', exact: true }).click(); assert.equal(await page.evaluate(() => window.enquiryRoute), '/admin/enquiries/102');
  await page.evaluate(() => window.enquiryNavigate('/admin/enquiries')); await loaded(page);
  await page.getByRole('link', { name: 'New enquiry', exact: true }).click(); assert.equal(await page.evaluate(() => window.enquiryRoute), '/enquiry');
  await page.context().close();
  recordCheck('Read-only service analytics/refresh, filtered export and existing new-enquiry/detail/response destinations');

  const assignment = await open();
  const original = enquiryFixture().rows[0];
  let dialog = await assignDialog(assignment.page);
  assert.equal(await dialog.getByRole('button', { name: 'Save assignment' }).isDisabled(), true);
  await focusContained(assignment.page, dialog);
  await dialog.getByRole('searchbox', { name: 'Search representatives' }).fill('Dana');
  await dialog.getByLabel('New owner', { exact: true }).selectOption('610');
  await dialog.getByRole('searchbox', { name: 'Search representatives' }).fill('Omar');
  assert.equal(await dialog.getByLabel('New owner', { exact: true }).inputValue(), '610');
  await dialog.getByText('Dana White (selected)', { exact: true }).waitFor({ state: 'attached' });
  assert.deepEqual(assignment.control.mutations, []);
  assignment.control.expectedMutations.push({ method: 'PATCH', endpoint: '/enquiry/101/', defer: true });
  await dialog.getByRole('button', { name: 'Save assignment' }).click();
  await assignment.page.waitForFunction(() => document.querySelector('[data-testid="enquiry-assign-dialog"]')?.getAttribute('aria-busy') === 'true');
  await assignment.page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true);
  assignment.control.releaseMutation(); await dialog.waitFor({ state: 'hidden' }); await loaded(assignment.page);
  assert.deepEqual(assignment.control.mutations[0].body, { assigned_to: 610 });
  assert.match(await assignment.page.getByTestId('enquiry-triage-fact-owner').innerText(), /Dana White/);
  assert.equal(assignment.control.updated[101].status, original.status); assert.equal(assignment.control.updated[101].due_at, original.due_at);
  dialog = await assignDialog(assignment.page); await dialog.getByLabel('New owner', { exact: true }).selectOption('');
  assignment.control.expectedMutations.push({ method: 'PATCH', endpoint: '/enquiry/101/' });
  await dialog.getByRole('button', { name: 'Save assignment' }).click(); await dialog.waitFor({ state: 'hidden' }); await loaded(assignment.page);
  assert.deepEqual(assignment.control.mutations[1].body, { assigned_to: null });
  dialog = await assignDialog(assignment.page); await dialog.getByLabel('New owner', { exact: true }).selectOption('610');
  assignment.control.expectedMutations.push({ method: 'PATCH', endpoint: '/enquiry/101/', status: 409, detail: 'This enquiry assignment has changed.' });
  await dialog.getByRole('button', { name: 'Save assignment' }).click(); await dialog.getByText('This enquiry assignment has changed.', { exact: true }).waitFor();
  assert.equal(await dialog.getByLabel('New owner', { exact: true }).inputValue(), '610');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
  assert.equal(await triage(assignment.page).getByRole('button', { name: 'Assign', exact: true }).evaluate(node => node === document.activeElement), true);
  await assignment.page.context().close();

  const missingOwner = await open({ fixture: 'current-owner-missing' });
  dialog = await assignDialog(missingOwner.page);
  assert.equal(await dialog.getByLabel('New owner', { exact: true }).inputValue(), '999');
  assert.equal(await dialog.getByRole('option', { name: /Former owner.*current owner/ }).evaluate(node => node.disabled), true);
  assert.equal(await dialog.getByRole('button', { name: 'Save assignment' }).isDisabled(), true);
  await missingOwner.page.keyboard.press('Escape'); assert.deepEqual(missingOwner.control.mutations, []); await missingOwner.page.context().close();
  recordCheck('Assignment requires explicit Save, preserves ID/null/status/deadline, retains searched choices and errors, contains/restores focus and blocks dismissal during pending PATCH');

  const large = await open({ fixture: 'large' });
  const largeCsv = await exportCsv(large.page); assert.equal(largeCsv.split('\r\n').length, 116);
  const exportRequests = large.control.requests.filter(row => row.endpoint === '/enquiry/' && new URLSearchParams(row.query).get('page_size') === '100');
  assert.deepEqual(exportRequests.map(row => new URLSearchParams(row.query).get('page')), ['1', '2']);
  for (const mode of ['count-change', 'duplicate', 'oversized']) {
    large.control.exportMode = mode;
    const downloads = []; const onDownload = download => downloads.push(download.suggestedFilename()); large.page.on('download', onDownload);
    await large.page.getByRole('button', { name: 'Export', exact: true }).click();
    await large.page.getByRole('alert').filter({ hasText: mode === 'oversized' ? '5,000' : 'Enquiries changed during export' }).waitFor();
    assert.deepEqual(downloads, []); large.page.off('download', onDownload);
  }
  assert.deepEqual(large.control.mutations, []); await large.page.context().close();
  const formula = await open({ fixture: 'formula' }); await search(formula.page, 'ENQ-000101');
  assert.match(await exportCsv(formula.page), /"'=HYPERLINK/); await formula.page.context().close();
  recordCheck('Full filtered CSV pagination, formula protection, export cap and changed/duplicated-page failures never produce incomplete downloads');

  for (const change of ['filter', 'user']) {
    const state = await open(); state.control.deferExports = true;
    const downloads = []; state.page.on('download', item => downloads.push(item.suggestedFilename()));
    const held = new Promise(resolve => { state.control.onExportHeld = resolve; });
    await state.page.getByRole('button', { name: 'Export', exact: true }).click(); await held;
    if (change === 'filter') await filter(state.page, 'Department', 'Finance');
    else { state.control.fixture = 'restricted'; await state.page.evaluate(user => window.enquirySetUser(user), enquiryUsers.employee); await loaded(state.page); }
    state.control.releaseExport();
    await state.page.getByRole('button', { name: 'Export', exact: true }).waitFor();
    await state.page.waitForTimeout(100);
    assert.deepEqual(downloads, [], `Changing ${change} cancels the prior-scope export`);
    assert.equal(await state.page.getByText(/Exported \d+ enquiries matching/).count(), 0);
    if (change === 'filter') assert.equal(await state.page.getByRole('button', { name: 'Export', exact: true }).isEnabled(), true);
    else assert.equal(await registerRows(state.page).count(), 0);
    assert.deepEqual(state.control.mutations, []); await state.page.context().close();
  }
  const shrinking = await open();
  for (let index = 0; index < 3; index++) { await shrinking.page.getByRole('button', { name: 'Next page' }).click(); await loaded(shrinking.page); }
  const small = enquiryFixture(); small.rows = small.rows.slice(0, 4); small.stats = enquiryStats(small.rows); shrinking.control.fixture = small;
  await shrinking.page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(shrinking.page);
  assert.equal(await registerRows(shrinking.page).count(), 4); assert.match(await shrinking.page.locator('.eop-pagination').innerText(), /Page 1 of 1/);
  await shrinking.page.context().close();
  recordCheck('Shrinking queues clamp pagination; filter and user-context changes cancel pending exports without stale downloads');
}
async function runSourceChecks() {
  for (const fixture of ['empty', 'zero', 'error', 'restricted', 'stats-error', 'list-error', 'unknown', 'zero-sla', 'instant-response']) {
    const { page, control } = await open({ fixture, role: fixture === 'restricted' ? 'employee' : 'admin' });
    if (fixture === 'empty' || fixture === 'zero') {
      await page.getByRole('heading', { name: 'No enquiries yet' }).waitFor();
      assert.equal(await kpi(page, 'Open enquiries').innerText(), '0'); assert.equal(await kpi(page, 'Median response').innerText(), '—');
      assert.equal(await health(page, 'First response within SLA').innerText(), '—'); assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true);
    } else if (fixture === 'error' || fixture === 'restricted' || fixture === 'list-error') {
      await page.getByRole('heading', { name: 'Enquiries could not be loaded' }).waitFor();
      assert.equal(await registerRows(page).count(), 0); assert.equal(await page.getByTestId('enquiry-triage-empty').isVisible(), true);
      assert.equal(await page.getByRole('button', { name: 'Assign', exact: true }).count(), 0);
      assert.equal(await kpi(page, 'Open enquiries').innerText(), fixture === 'list-error' ? '20' : '—');
    } else if (fixture === 'stats-error') {
      assert.equal(await registerRows(page).count(), 7); assert.equal(await kpi(page, 'Open enquiries').innerText(), '—');
      assert.equal(await health(page, 'First response within SLA').innerText(), '—');
      assert.equal(await triage(page).getByRole('button', { name: 'Assign', exact: true }).isEnabled(), true);
    } else if (fixture === 'unknown') {
      assert.equal(await kpi(page, 'Median response').innerText(), '—'); assert.equal(await health(page, 'First response within SLA').innerText(), '—');
      assert.equal(await page.getByTestId('enquiry-triage-overdue').count(), 0);
      assert.match(await registerRows(page).first().locator('.eop-due').innerText(), /Not set/);
    } else if (fixture === 'zero-sla') assert.equal(await health(page, 'First response within SLA').innerText(), '0%');
    else if (fixture === 'instant-response') assert.equal(await kpi(page, 'Median response').innerText(), '0h');
    await capture(page, `source-${fixture}`);
    if (['error', 'restricted', 'list-error'].includes(fixture)) { control.fixture = 'full'; await page.getByRole('button', { name: 'Retry enquiries' }).click(); await loaded(page); assert.equal(await registerRows(page).count(), 7); }
    assert.deepEqual(control.mutations, []); await page.context().close();
  }
  const directory = await open({ fixture: 'representatives-error' });
  const dialog = await assignDialog(directory.page); await dialog.getByRole('button', { name: 'Retry representatives' }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Save assignment' }).isDisabled(), true);
  directory.control.fixture = 'full'; await dialog.getByRole('button', { name: 'Retry representatives' }).click();
  await dialog.getByRole('option', { name: /Dana White/ }).waitFor({ state: 'attached' });
  assert.deepEqual(directory.control.mutations, []); await directory.page.context().close();
  const detail = await open(); detail.control.endpointFailures['/enquiry/102/'] = 503;
  await choose(detail.page, 'ENQ-000102'); await triage(detail.page).getByRole('button', { name: 'Retry details' }).waitFor();
  assert.match(await triage(detail.page).innerText(), /Supplier onboarding/); assert.doesNotMatch(await triage(detail.page).innerText(), /Access to project document/);
  assert.equal(await triage(detail.page).getByRole('button', { name: 'Assign', exact: true }).isDisabled(), true);
  delete detail.control.endpointFailures['/enquiry/102/']; await triage(detail.page).getByRole('button', { name: 'Retry details' }).click(); await loaded(detail.page);
  assert.equal(await triage(detail.page).getByRole('button', { name: 'Assign', exact: true }).isEnabled(), true);
  detail.control.fixture = 'error'; await detail.page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(detail.page);
  assert.equal(await registerRows(detail.page).count(), 0); assert.equal(await kpi(detail.page, 'Open enquiries').innerText(), '—');
  assert.equal(await detail.page.getByTestId('enquiry-triage-empty').isVisible(), true); await detail.page.context().close();
  const loading = await open({ loading: true }); await loading.page.getByRole('heading', { name: 'Loading enquiries' }).waitFor();
  assert.equal(await kpi(loading.page, 'Open enquiries').innerText(), '—'); await capture(loading.page, 'loading'); await loading.control.release(); await loaded(loading.page);
  await loading.page.context().close();
  recordCheck('Empty/zero/absent SLA cohorts, true0%/0h, restricted/partial/failed sources, directory/detail retry, loading and failed-refresh stale-data removal');
}
try {
  if (!workflowsOnly) {
  const { page, control } = await newPage();
  await page.getByRole('heading', { name: 'Enquiry Operations', exact: true }).waitFor();
  await page.getByText('ENQ-000101', { exact: true }).first().waitFor();
  for (const width of [1672, 1440, 1024, 390]) {
    await geometry(page, width); await capture(page, `${baselineOnly ? 'before' : 'enquiries'}-${width}`);
    if (width === 390 && !baselineOnly) {
      await page.getByRole('navigation', { name: 'Enquiry queues' }).getByRole('button', { name: /^My queue/ }).focus();
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await loaded(page);
      assert.match(await page.locator('.eop-queues [aria-current="page"]').innerText(), /Unassigned/);
      await queue(page, 'All enquiries'); await choose(page, 'ENQ-000101');
      await page.screenshot({ path: path.join(artifacts, 'enquiries-390-triage.png') });
      await page.locator('.eop-table-scroll').evaluate(node => { node.scrollLeft = node.scrollWidth; });
      await page.getByRole('button', { name: 'Open ENQ-000101 summary', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(artifacts, 'enquiries-390-table-actions.png') });
      await page.locator('.eop-table-scroll').evaluate(node => { node.scrollLeft = 0; });
    }
  }
  await page.evaluate(() => document.documentElement.classList.add('dark')); await geometry(page, 1672); await capture(page, `${baselineOnly ? 'before' : 'enquiries'}-dark`);
  assert.deepEqual(control.mutations, []);
  if (!baselineOnly) {
    const accessibilityIssues = [];
    for (const dark of [false, true]) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
      const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await writeFile(path.join(artifacts, `accessibility-${dark ? 'dark' : 'light'}.json`), JSON.stringify(result.violations, null, 2));
      if (result.violations.length) accessibilityIssues.push({ scope: 'page', dark, violations: result.violations });
    }
    const dialog = await assignDialog(page); await focusContained(page, dialog);
    for (const dark of [false, true]) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
      const result = await new AxeBuilder({ page }).include('[data-testid="enquiry-assign-dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await writeFile(path.join(artifacts, `accessibility-assignment-${dark ? 'dark' : 'light'}.json`), JSON.stringify(result.violations, null, 2));
      if (result.violations.length) accessibilityIssues.push({ scope: 'assignment', dark, violations: result.violations });
    }
    await page.keyboard.press('Escape');
    assert.deepEqual(accessibilityIssues, [], 'Enquiry page and assignment dialog light/dark accessibility');
  }
  await page.context().close();
  recordCheck(baselineOnly ? 'Immutable current page captured at 1672/1440/1024/390 and dark mode; existing mobile content overflow recorded' : 'Real enquiry page and unchanged shared shell fit 1672/1440/1024/390 and dark mode without mutations');
  }
  if (!baselineOnly && !visualsOnly) { await runFunctionalChecks(); await runSourceChecks(); }
  await checkProtectedSources();
  assert.deepEqual(runtimeErrors, []); assert.deepEqual(unexpectedRequests, []);
  await writeFile(path.join(artifacts, baselineOnly ? 'baseline-checks.json' : visualsOnly ? 'visual-checks.json' : workflowsOnly ? 'workflow-checks.json' : 'checks.json'), JSON.stringify({ historicalGuardsEnabled: snapshotGuards, checks, geometryChecks, runtimeErrors, unexpectedRequests, mutations: allMutations, protectedFilesUnchanged: snapshotGuards ? true : null }, null, 2));
  console.log(`PASS: ${baselineOnly ? 'Immutable enquiry baseline' : visualsOnly ? 'Enquiry responsive preflight' : 'Enquiry checks'} captured; ${snapshotGuards ? `${baseline.filter(row => row.Protected).length} protected files unchanged` : 'historical guards not requested'}.`);
} catch (error) {
  const page = browser.contexts().flatMap(context => context.pages())[0];
  if (page) { await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); await writeFile(path.join(artifacts, 'failure-debug.json'), JSON.stringify({ message: error.message, runtimeErrors, unexpectedRequests, text: await page.locator('body').innerText().catch(() => '') }, null, 2)); }
  throw error;
} finally { await browser.close(); }
