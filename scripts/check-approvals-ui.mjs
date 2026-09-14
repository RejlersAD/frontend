import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { checkArtifacts, historicalGuardsEnabled, loadSnapshot, launchBrowser, sidebarWidth } from './ui-check-support.mjs';
import AxeBuilder from '@axe-core/playwright';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { APPROVAL_CHECK_TIME, approvalDetail, approvalFixture, approvalUsers } from './check-approvals-fixtures.mjs';

// Real page, shell, configuration and review components. Every request is intercepted.
// Decision POSTs require a specific expectation in the current fixture control.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compact = !process.argv.includes('--legacy-layout');
const artifacts = checkArtifacts(frontend, compact ? 'approvals-compact' : 'approvals-command-center');
const origin = 'http://approvals-check.test';
const baselineOnly = process.argv.includes('--baseline');
const sourcesOnly = process.argv.includes('--sources-only');
const workflowsOnly = process.argv.includes('--workflows-only') || sourcesOnly;
await mkdir(artifacts, { recursive: true });
const snapshotGuards = historicalGuardsEnabled(baselineOnly);
console.log(`Historical snapshot guards: ${snapshotGuards ? 'enabled' : 'not requested; core checks remain enabled'}`);
const baseline = await loadSnapshot(frontend, path.join(artifacts, 'source-before-sha256.json'), snapshotGuards);
const protectedSources = baseline.filter(row => compact ? row.Protected : !row.RelativePath.endsWith('/ProcurementApprovalPreviewModal.jsx') && !row.RelativePath.endsWith('/ApprovalsPageDynamic.jsx') && !row.RelativePath.endsWith('/approvalsSystem.config.js'));
async function checkProtectedSources() {
  for (const row of baseline) assert.equal(createHash('sha256').update(await readFile(path.join(artifacts, 'source-before', row.RelativePath))).digest('hex').toUpperCase(), row.Hash, `Immutable baseline changed: ${row.RelativePath}`);
  for (const row of protectedSources) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Protected shell/Executive/UserDetail changed: ${row.RelativePath}`);
  await writeFile(path.join(artifacts, 'protected-source-checks.json'), JSON.stringify({ historicalGuardsEnabled: snapshotGuards, immutableFiles: baseline.length, protectedFiles: protectedSources.length, hashesUnchanged: true }, null, 2));
}
await checkProtectedSources();

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';
import ApprovalsPageDynamic from './src/pages/ApprovalsPageDynamic.jsx';
const state={auth:{user:window.approvalUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:window.approvalRbac}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
function Observer(){const location=useLocation();window.approvalRoute=location.pathname+location.search;window.approvalNavigate=useNavigate();return null;}
window.print=()=>{window.approvalPrintCalls=(window.approvalPrintCalls||0)+1;};
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/approvals']}><Observer/><Routes><Route element={<Layout/>}><Route path='/approvals' element={<ApprovalsPageDynamic/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
`;
const apiClient = `
async function request(method,url,body,config={}){
 const response=await fetch('/api/v1'+url,{method,signal:config.signal,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=config.responseType==='blob'?await response.blob():await response.json();
 if(!response.ok){const error=new Error(data.detail||'Fixture request failed');error.response={status:response.status,data};throw error;}
 return {data,status:response.status};
}
export default {get:(url,config)=>request('GET',url,undefined,config),post:(url,body,config)=>request('POST',url,body,config)};`;
const serviceButtons = `import React from 'react';import {BellIcon,ArrowDownTrayIcon} from '@heroicons/react/24/outline';
export function NotificationBell(){return <button aria-label='Notifications' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><BellIcon className='h-5 w-5'/></button>}
export default function PWAHeaderInstall(){return <button aria-label='Install RADAI on this device' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><ArrowDownTrayIcon className='h-5 w-5'/></button>}`;
const stubs = [
  [/services[\\/]api\.service\.js$/, apiClient],
  [/config[\\/]api\.config\.js$/, `export const API_BASE_URL='/api/v1';export const API_TIMEOUT=10000;export const API_ENDPOINTS={USER_ME:'/rbac/users/me/'};`],
  [/config[\\/]enterpriseDashboard\.config\.js$/, 'export const API_CONFIG={dashboardRefreshInterval:3600000,activityRefreshInterval:3600000,activityLimit:5};'],
  [/store[\\/]slices[\\/]authSlice\.js$/, 'export const updateUser=()=>({type:"fixture"});export const logout=()=>({type:"fixture-logout"});'],
  [/store[\\/]slices[\\/]themeSlice\.js$/, 'export const toggleTheme=()=>({type:"fixture-theme"});'],
  [/store[\\/]slices[\\/]rbacSlice\.js$/, 'export const fetchCurrentUser=()=>({type:"fixture-rbac"});'],
  [/components[\\/]Layout[\\/]Footer\.jsx$/, 'export default function Footer(){return null;}'],
  [/components[\\/]ProcurementApprovalReminder\.jsx$/, 'export default function Reminder(){return null;}'],
  [/components[\\/]notifications[\\/]NotificationBell\.jsx$/, serviceButtons.replace('export function NotificationBell', 'export default function NotificationBell').replace('export default function PWAHeaderInstall', 'export function PWAHeaderInstall')],
  [/components[\\/]PWAHeaderInstall\.jsx$/, serviceButtons],
  [/hooks[\\/]useAuthenticatedPhoto\.js$/, 'export default function useAuthenticatedPhoto(){return null;}'],
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Approvals"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const sourcePaths = new Map(baseline.map(row => [path.normalize(row.Path).toLowerCase(), path.join(artifacts, 'source-before', row.RelativePath)]));
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'approvals-fixture', setup(builder) {
  for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' }));
  if (baselineOnly) builder.onLoad({ filter: /\.[jm]sx?$/ }, async args => {
    const saved = sourcePaths.get(path.normalize(args.path).toLowerCase());
    return saved ? { contents: await readFile(saved, 'utf8'), loader: 'jsx' } : undefined;
  });
} }] });
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(path.join(frontend, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await filesIn(file)); else result.push(file);
  }
  return result;
}
const componentFiles = [...await filesIn('src/components/approvals'), ...await filesIn('src/components/Layout'),
  'src/config/layout.config.js', 'src/config/approvalsSystem.config.js',
  'src/pages/ApprovalsPageDynamic.jsx', 'src/pages/Procurement/PurchaseOrderLivePreview.jsx', 'src/pages/Procurement/PurchaseRequisitionDocumentPreview.jsx',
  ...((await readdir(path.join(frontend, 'src/pages'))).filter(file => /^Approvals.*\.(css|jsx)$/.test(file)).map(file => `src/pages/${file}`))];
const readSource = file => readFile(baselineOnly && sourcePaths.has(path.join(frontend, file).toLowerCase()) ? sourcePaths.get(path.join(frontend, file).toLowerCase()) : path.join(frontend, file), 'utf8');
const classSources = await Promise.all([...new Set(componentFiles)].filter(file => /\.[jm]sx?$/.test(file)).map(readSource));
const css = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), { from: undefined });
const styles = await Promise.all([...new Set(componentFiles)].filter(file => file.endsWith('.css')).map(readSource));
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Approvals fixture checks</title><style>${css.css}\n${styles.join('\n')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
if (baselineOnly) {
  if (process.argv.includes('--rebuild-baseline')) await writeFile(path.join(artifacts, 'baseline.html'), html);
  try { html = await readFile(path.join(artifacts, 'baseline.html'), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path.join(artifacts, 'baseline.html'), html, { flag: 'wx' }); }
}
const expectedSidebarWidth = await sidebarWidth(frontend);
const browser = await launchBrowser();
const runtimeErrors = [];
const unexpectedRequests = [];
const allDecisions = [];
const checks = [];
const focusIssues = [];
const geometryChecks = [];
function recordCheck(message) { checks.push(message); console.log(`PASS: ${message}`); }

async function newPage({ fixture = 'full', width = 1672, dark = false, role = 'admin', loading = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(APPROVAL_CHECK_TIME));
  await page.addInitScript(({ user, dark }) => {
    window.approvalUser = user;
    window.approvalRbac = { user, roles: user.roles, modules: [], is_reporting_manager: true, direct_reports_count: 2 };
    localStorage.setItem('radai_access_token', 'isolated-approval-test-token');
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark));
  }, { user: approvalUsers[role], dark });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, loading, pending: [], requests: [], decisions: [], expectedDecisions: [], removed: new Set(), removedStages: new Set(), detailOverrides: {}, endpointFailures: {} };
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const respond = async route => {
    const request = route.request(); const url = new URL(request.url());
    const endpoint = url.pathname.replace(/^\/api\/v1/, '');
    const data = typeof control.fixture === 'string' ? approvalFixture(control.fixture) : structuredClone(control.fixture);
    control.requests.push({ method: request.method(), endpoint, query: url.search, body: request.postDataJSON() });
    if (request.method() !== 'GET') {
      const decision = { method: request.method(), endpoint, body: request.postDataJSON() };
      control.decisions.push(decision); allDecisions.push(decision);
      const expected = control.expectedDecisions.shift();
      if (!expected || expected.endpoint !== endpoint || expected.method !== request.method()) {
        unexpectedRequests.push(`Unexpected decision ${request.method()} ${endpoint}`);
        return json(route, { detail: 'Unexpected fixture decision refused.' }, 409);
      }
      if (expected.status && expected.status !== 200) return json(route, { detail: expected.detail || 'The approval stage has changed.' }, expected.status);
      const match = endpoint.split('/').at(-3);
      if (endpoint.startsWith('/procurement/orders/') && decision.body?.approval_stage) control.removedStages.add(`${match}:${decision.body.approval_stage}`);
      else control.removed.add(match);
      return json(route, expected.data || { id: match, status: endpoint.includes('reject') ? 'rejected' : 'approved', approval_status: 'approved', can_review: false });
    }
    if (control.endpointFailures[endpoint]) return json(route, { detail: 'Synthetic source detail is unavailable.' }, control.endpointFailures[endpoint]);
    if (endpoint === '/rbac/users/me/') return json(route, { user: approvalUsers[role], roles: approvalUsers[role].roles, modules: [] });
    if (endpoint === '/dashboard/metrics/') return json(route, { users: { total_users: 127 } });
    if (endpoint === '/projects/stats/') return json(route, { active_count: 7 });
    if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
    if (data.queues[endpoint]) {
      if (data.failures[endpoint]) return json(route, { detail: data.failures[endpoint] === 403 ? 'This queue is restricted.' : 'This queue is temporarily unavailable.' }, data.failures[endpoint]);
      const rows = data.queues[endpoint].filter(row => !control.removed.has(String(row.id)) && !control.removedStages.has(`${row.id}:${row.approval_stage}`));
      return json(route, { count: data.counts[endpoint] ?? rows.length, pending_count: data.counts[endpoint] ?? rows.length, results: rows, next: data.counts[endpoint] > rows.length ? `${origin}/api/v1${endpoint}?page=2` : null });
    }
    const detail = control.detailOverrides[endpoint] || approvalDetail(data, endpoint);
    if (detail) return json(route, detail);
    if (/\/profile-documents\/[^/]+\/content\/$/.test(endpoint)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360"><rect width="600" height="360" fill="#eef2ff"/><text x="36" y="90" fill="#312e81" font-size="24">Synthetic document preview</text></svg>' });
    unexpectedRequests.push(`${request.method()} ${endpoint}`);
    return json(route, { detail: 'Unmapped fixture request.' }, 404);
  };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (route.request().isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) {
      if (control.loading) { control.pending.push(route); return; }
      return respond(route);
    }
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Report missing artwork below. */ }
    }
    unexpectedRequests.push(route.request().url()); return route.abort();
  });
  control.release = async () => { control.loading = false; await Promise.all(control.pending.splice(0).map(respond)); };
  await page.goto(origin);
  await page.locator('#application-sidebar').waitFor({ state: 'attached' });
  return { page, control };
}

async function geometry(page, width) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 941 });
  await page.waitForTimeout(200);
  const result = await page.locator('main.main-content').evaluate(main => ({ documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: main.scrollWidth <= main.clientWidth + 1, contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
    badgeOverflow: [...main.querySelectorAll('.apc-table td .apc-type-badge, .apc-table td .apc-stage-badge, .apc-table td .apc-review-button')].filter(node => {
      const bounds = node.getBoundingClientRect(), cell = node.closest('td').getBoundingClientRect();
      return bounds.left < cell.left - 1 || bounds.right > cell.right + 1;
    }).map(node => node.textContent),
    rowHeights: [...main.querySelectorAll('.apc-table tbody tr')].map(row => row.getBoundingClientRect().height),
  }));
  assert.equal(result.documentFits, true, `${width}: no document overflow`);
  assert.equal(result.mainFits, true, `${width}: approvals content remains inside shell`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth);
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
  assert.deepEqual(result.badgeOverflow, [], `${width}: type, stage and action controls stay in their table cells`);
  if (!baselineOnly) assert.ok(result.rowHeights.every(height => height <= 58.5), `${width}: standard approval rows retain their 58px density`);
  geometryChecks.push({ width, dark: await page.evaluate(() => document.documentElement.classList.contains('dark')), ...result });
}
async function capture(page, name) {
  await page.locator('main.main-content').evaluate(main => {
    main.querySelector('.apc-page')?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    for (let node = main; node; node = node.parentElement) node.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
}

async function compactLayout(page, width) {
  const result = await page.locator('.apc-page').evaluate(root => {
    const rect = node => { const { x, y, width, height, right, bottom } = node.getBoundingClientRect(); return { x, y, width, height, right, bottom }; };
    const summary = root.querySelector('.apc-decision-summary');
    const queue = root.querySelector('.apc-queue-column');
    const cards = [...root.querySelectorAll('.apc-kpi')];
    return {
      viewportHeight: innerHeight,
      page: rect(root), queue: rect(queue), tabs: rect(root.querySelector('.apc-tabs')),
      summary: rect(summary), footer: rect(summary.querySelector('.apc-summary-footer')),
      search: rect(root.querySelector('.apc-search')),
      allCardsInQueue: cards.length === 4 && cards.every(card => queue.contains(card)),
      cards: cards.map(card => ({ bounds: rect(card), note: rect(card.querySelector('p')), heading: rect(card.querySelector('h2')), value: rect(card.querySelector('strong')) })),
      dropdowns: root.querySelectorAll('select').length,
      tableRows: [...root.querySelectorAll('.apc-table tbody tr')].map(row => rect(row).height),
    };
  });
  assert.equal(result.allCardsInQueue, true, `${width}: all four KPIs belong to the table column`);
  assert.equal(result.dropdowns, 0, `${width}: search and queue tabs replace the dropdown panel`);
  assert.ok(result.search.bottom <= result.tabs.y + 1, `${width}: search is in the top toolbar`);
  assert.ok(result.tableRows.every(height => Math.abs(height - 58) < 0.5), `${width}: unchanged 58px table rows`);
  for (const card of result.cards) {
    assert.ok(card.note.bottom <= card.bounds.bottom + 1 && card.note.right <= card.bounds.right + 1, `${width}: KPI source note fits its card`);
    assert.ok(card.heading.bottom <= card.value.y + 1, `${width}: KPI title and value do not overlap`);
  }
  if (width > 1250) {
    assert.ok(Math.abs(result.summary.y - result.tabs.y) <= 1, `${width}: summary starts level with queue tabs`);
    assert.ok(result.cards.every(card => card.bounds.right <= result.summary.x && card.bounds.y > result.summary.y), `${width}: cards remain below tabs and left of the summary`);
    assert.ok(result.footer.bottom <= result.viewportHeight + 1 && result.summary.bottom <= result.page.bottom + 1, `${width}: desktop summary actions fit the workspace`);
  } else assert.ok(result.summary.y >= result.queue.bottom - 1, `${width}: narrower screens stack the summary below the queue`);
  return { width, ...result };
}

async function runCompactSummaryChecks() {
  const { page, control } = await open({ fixture: 'long-summary' });
  const panel = summary(page);
  await panel.getByText('Engineering and Project Services / Engineering, Procurement and Construction Management', { exact: true }).waitFor();
  assert.equal(await panel.getByTestId('approval-summary-steps').getAttribute('data-step-count'), '6');
  const measurements = [];
  for (const width of [1672, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 941 });
    await page.waitForTimeout(150);
    const body = panel.getByRole('region', { name: 'Decision summary details' });
    await body.evaluate(node => node.scrollTo({ top: 0, behavior: 'instant' }));
    if (width <= 1250) await panel.scrollIntoViewIfNeeded();
    const before = await panel.evaluate(node => {
      const body = node.querySelector('.apc-summary-body');
      const rect = element => { const { top, bottom, left, right } = element.getBoundingClientRect(); return { top, bottom, left, right }; };
      return { body: rect(body), header: rect(node.querySelector('header')), footer: rect(node.querySelector('footer')), bodyHeight: body.clientHeight, contentHeight: body.scrollHeight, viewportHeight: innerHeight, horizontalOverflow: body.scrollWidth > body.clientWidth + 1 };
    });
    assert.ok(before.contentHeight > before.bodyHeight, `${width}: a long six-step summary scrolls internally`);
    assert.equal(before.horizontalOverflow, false, `${width}: long department and workflow labels wrap within the summary`);
    assert.ok(before.footer.bottom <= before.viewportHeight + 1 && before.footer.top >= 0, `${width}: both decision actions remain visible`);
    assert.ok(before.body.bottom <= before.footer.top + 1, `${width}: summary content cannot cover decision actions`);
    await body.focus();
    await page.keyboard.press('End');
    await body.evaluate(node => node.scrollTo({ top: node.scrollHeight, behavior: 'instant' }));
    const after = await panel.locator('footer').boundingBox();
    assert.ok(Math.abs(after.y - before.footer.top) < 1, `${width}: scrolling keeps decision actions in place`);
    assert.ok(await body.evaluate(node => node.scrollTop > 0), `${width}: summary body actually scrolls`);
    await page.screenshot({ path: path.join(artifacts, `long-summary-${width}-scrolled.png`) });
    await body.evaluate(node => node.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(artifacts, `long-summary-${width}.png`) });
    measurements.push({ width, ...before, footerAfterScroll: after });
  }
  await page.setViewportSize({ width: 1672, height: 941 });
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await writeFile(path.join(artifacts, `accessibility-long-summary-${dark ? 'dark' : 'light'}.json`), JSON.stringify(result.violations, null, 2));
    assert.deepEqual(result.violations, [], 'Long summary remains keyboard accessible in both themes');
  }
  await capture(page, 'long-summary-dark');
  await writeFile(path.join(artifacts, 'long-summary-geometry.json'), JSON.stringify(measurements, null, 2));
  assert.deepEqual(control.decisions, [], 'Reading and scrolling a long summary never submits a decision');
  await page.context().close();
  recordCheck('Long departments and six approval steps scroll inside the summary while its header and decision actions remain visible');
}

const inboxRows = page => page.locator('tr[data-queue-key]');
const summary = page => page.getByTestId('approval-decision-summary');
const kpi = (page, label) => page.locator('.apc-kpi').filter({ has: page.getByRole('heading', { name: label, exact: true }) }).locator('strong');
async function loaded(page) {
  await page.getByTestId('approval-command-center').waitFor();
  await page.waitForFunction(() => document.querySelector('section[aria-label="Approval requests"]')?.getAttribute('aria-busy') === 'false');
}
async function open(options) { const state = await newPage(options); if (!options?.loading) await loaded(state.page); return state; }
async function tab(page, label) { await page.getByRole('navigation', { name: 'Approval queues' }).getByRole('button', { name: new RegExp(`^${label}`) }).click(); }
async function clear(page) {
  if (compact) { await page.getByRole('searchbox', { name: 'Search approvals' }).fill(''); await tab(page, 'My approvals'); }
  else await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
}
async function filter(page, label, value) { await page.getByLabel(label, { exact: true }).selectOption(value); }
async function select(page, reference) {
  await clear(page);
  await page.getByRole('searchbox', { name: 'Search approvals' }).fill(reference);
  await page.getByRole('button', { name: `Review ${reference}`, exact: true }).click();
  assert.match(await summary(page).innerText(), new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
async function review(page, reference, action = 'view') {
  await select(page, reference);
  await summary(page).getByRole('button', { name: action === 'reject' ? 'Reject' : 'Review & decide', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.waitFor(); return dialog;
}
async function focusContained(page, dialog) {
  const focusables = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
  const visible = [];
  for (let index = 0; index < await focusables.count(); index++) if (await focusables.nth(index).isVisible()) visible.push(focusables.nth(index));
  assert.ok(visible.length > 0);
  await visible.at(-1).focus(); await page.keyboard.press('Tab');
  if (!await dialog.evaluate(node => node.contains(document.activeElement))) {
    const issue = `Forward Tab escaped ${await dialog.getAttribute('aria-labelledby') || 'review dialog'}`;
    focusIssues.push(issue); console.error(issue);
  }
  await visible[0].focus(); await page.keyboard.press('Shift+Tab');
  if (!await dialog.evaluate(node => node.contains(document.activeElement))) {
    const issue = `Reverse Tab escaped ${await dialog.getAttribute('aria-labelledby') || 'review dialog'}`;
    focusIssues.push(issue); console.error(issue);
  }
}
async function downloadCsv(page) {
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await promise;
  assert.match(download.suggestedFilename(), /^approvals-.*\.csv$/);
  return readFile(await download.path(), 'utf8');
}

async function runFunctionalChecks() {
  const { page, control } = await open();
  assert.equal(await kpi(page, 'Awaiting my decision').innerText(), '16');
  assert.equal(await kpi(page, 'Overdue').innerText(), '1');
  assert.equal(await kpi(page, 'Due today').innerText(), '1');
  assert.equal(await kpi(page, 'Approved this week').innerText(), '—');
  assert.equal(await inboxRows(page).count(), 7);
  assert.equal(await summary(page).getByRole('heading', { name: 'Offshore safety equipment', exact: true }).isVisible(), true);
  const queueRequests = control.requests.filter(row => /leave-requests\/$|pending-for-me\/$|pending-verification\/$/.test(row.endpoint));
  assert.equal(queueRequests.length, 4, 'One GET per connected queue');
  assert.equal(control.requests.some(row => /master-payroll-history|finance\/invoices/.test(row.endpoint)), false, 'Unsupported registers are not requested as approval queues');
  for (const request of queueRequests.filter(row => /procurement/.test(row.endpoint))) assert.equal(new URLSearchParams(request.query).has('status__in'), false, 'Personal procurement endpoints retain their server-defined queue scope');
  await tab(page, 'All available');
  assert.match(await page.locator('.apc-table-footer').innerText(), /of 17/);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  assert.match(await page.locator('.apc-pagination').innerText(), /Page 2 of 3/);
  await tab(page, 'Leave');
  assert.equal(await inboxRows(page).count(), 3);
  await inboxRows(page).filter({ hasText: 'Unassigned stage example' }).getByRole('button', { name: /^Review / }).click();
  assert.equal(await summary(page).getByRole('button', { name: 'Reject', exact: true }).count(), 0);
  await summary(page).getByRole('button', { name: 'Review details', exact: true }).click();
  const readOnlyLeave = page.getByRole('dialog'); await readOnlyLeave.waitFor();
  await readOnlyLeave.getByText('With the current approver', { exact: true }).waitFor();
  assert.equal(await readOnlyLeave.getByRole('button', { name: /^Approve|^Reject/ }).count(), 0);
  await page.keyboard.press('Escape');
  for (const [label, destination] of [['Payroll', '/hr/payroll'], ['Invoices', '/finance/incoming-invoices']]) {
    await tab(page, label);
    await page.getByRole('heading', { name: 'Approval queue not connected' }).waitFor();
    assert.equal(await page.locator('.apc-empty a').getAttribute('href'), destination);
    assert.equal(await inboxRows(page).count(), 0);
  }
  recordCheck('Personal queue GET scope, six role-aware queue choices, My vs All actionability, real counts/pagination and explicit unsupported integrations');

  await clear(page);
  if (compact) {
    assert.equal(await page.getByRole('heading', { name: 'Approval Command Center', exact: true }).count(), 0);
    assert.equal(await page.locator('.apc-page select').count(), 0);
    await page.getByRole('searchbox', { name: 'Search approvals' }).fill('Nadia Hassan');
    assert.equal(await inboxRows(page).count(), 4);
    await tab(page, 'Procurement'); assert.equal(await inboxRows(page).count(), 4);
    await page.getByRole('searchbox', { name: 'Search approvals' }).fill('PR-2026-0101'); assert.equal(await inboxRows(page).count(), 1);
    await page.getByRole('searchbox', { name: 'Search approvals' }).fill('no matching synthetic request');
    await page.getByRole('heading', { name: 'No matching requests' }).waitFor();
    await tab(page, 'Purchase orders'); await page.getByRole('searchbox', { name: 'Search approvals' }).fill('Sam Reed');
    assert.equal(await inboxRows(page).count(), 4);
  } else {
  await filter(page, 'Queue', 'procurement'); await filter(page, 'Priority', 'urgent');
  assert.equal(await inboxRows(page).count(), 2);
  await filter(page, 'Age', '3d'); assert.equal(await inboxRows(page).count(), 1);
  await filter(page, 'Amount', 'AED:high'); await filter(page, 'Requester', 'Nadia Hassan');
  assert.match(await inboxRows(page).innerText(), /PR-2026-0101/);
  await page.getByRole('searchbox', { name: 'Search approvals' }).fill('no matching synthetic request');
  await page.getByRole('heading', { name: 'No matching requests' }).waitFor();
  await clear(page); await filter(page, 'Queue', 'procurement'); await filter(page, 'Age', '24h');
  assert.match(await inboxRows(page).innerText(), /PR-2026-0105/);
  }
  await select(page, 'PR-2026-0103');
  assert.equal(await inboxRows(page).locator('.apc-amount').innerText(), 'AED 0.00');
  assert.match(await summary(page).innerText(), /AED 0\.00/);
  await select(page, 'PR-2026-0104');
  assert.equal(await inboxRows(page).locator('.apc-amount').innerText(), 'USD 8,200.00');
  await select(page, 'PR-2026-0105');
  assert.equal(await inboxRows(page).locator('.apc-amount').innerText(), '—');
  await summary(page).getByRole('button', { name: 'Close decision summary' }).click();
  await page.getByTestId('approval-summary-empty').waitFor();
  await page.getByRole('button', { name: 'Review PR-2026-0105' }).click();
  assert.equal(await page.getByTestId('approval-summary-empty').count(), 0);
  assert.match(await page.getByTestId('approval-summary-evidence-budget_assessment').innerText(), /Not reported/);
  assert.match(await page.getByTestId('approval-summary-evidence-risk_assessment').innerText(), /Not reported/);
  assert.deepEqual(control.decisions, []);
  recordCheck(compact ? 'Compact toolbar search intersects queue tabs; true zero/original currencies and summary close/reopen remain intact' : 'Search and all six filters intersect correctly; true zero and original currencies survive normalization; selecting, closing and reopening summary never decides');

  await page.getByRole('button', { name: 'Approval settings', exact: true }).click();
  const settings = page.getByRole('dialog'); await settings.waitFor(); await focusContained(page, settings);
  assert.match(await settings.innerText(), /Not connected/);
  const beforeRefresh = control.requests.length;
  await settings.getByRole('button', { name: 'Refresh queues', exact: true }).click(); await loaded(page);
  assert.ok(control.requests.length >= beforeRefresh + 4);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Approval settings', exact: true }).evaluate(node => node === document.activeElement), true);
  await page.getByRole('button', { name: 'View analytics', exact: true }).click();
  await page.getByRole('heading', { name: 'Queue coverage', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Hide analytics', exact: true }).click();
  await clear(page);
  if (compact) { await tab(page, 'Procurement'); await page.getByRole('searchbox', { name: 'Search approvals' }).fill('PR-2026-0104'); }
  else await filter(page, 'Amount', 'USD:low');
  const csv = await downloadCsv(page);
  assert.equal(csv.split('\r\n').length, compact ? 2 : 3, 'CSV contains every search/tab-filtered loaded row');
  assert.match(csv, /"8200","USD"/); if (!compact) assert.match(csv, /"18250","USD"/); assert.doesNotMatch(csv, /"AED"/);
  assert.deepEqual(control.decisions, []);
  recordCheck('Settings focus/refresh, queue coverage and filtered original-currency CSV are read-only');
  await page.context().close();

  const formula = await open({ fixture: 'formula' });
  await formula.page.getByRole('searchbox', { name: 'Search approvals' }).fill('PR-2026-0101');
  const safeCsv = await downloadCsv(formula.page);
  assert.match(safeCsv, /"'=HYPERLINK/);
  await writeFile(path.join(artifacts, 'formula-safe-export.csv'), safeCsv);
  await formula.page.context().close();

  const readOnly = await open({ fixture: 'read-only' });
  for (const reference of ['PR-2026-0101', 'PO-2026-0201']) {
    await tab(readOnly.page, 'All available');
    await readOnly.page.getByRole('searchbox', { name: 'Search approvals' }).fill(reference);
    await readOnly.page.getByRole('button', { name: `Review ${reference}`, exact: true }).click();
    assert.equal(await summary(readOnly.page).getByRole('button', { name: 'Reject', exact: true }).count(), 0);
    await summary(readOnly.page).getByRole('button', { name: 'Review details', exact: true }).click();
    const dialog = readOnly.page.getByRole('dialog'); await dialog.waitFor();
    await dialog.getByText(reference).first().waitFor();
    assert.equal(await dialog.getByRole('button', { name: /^(Approve|Reject|Confirm rejection)$/ }).count(), 0);
    await focusContained(readOnly.page, dialog);
    await readOnly.page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
  assert.deepEqual(readOnly.control.decisions, []);
  await readOnly.page.context().close();
  recordCheck('Read-only procurement records remain reviewable without decision controls or writes');

  const multi = await open({ fixture: 'multi-stage' });
  await tab(multi.page, 'Purchase orders');
  assert.equal(await inboxRows(multi.page).count(), 5, 'Two approval entries for one PO stay distinct');
  await multi.page.locator('[data-queue-key="purchase_order:po-queue-b"]').getByRole('button', { name: /^Review / }).click();
  multi.control.detailOverrides['/procurement/orders/po-1/'] = { ...approvalFixture().queues['/procurement/orders/pending-for-me/'][0], current_approval: { stage: 'different_detail_stage' }, approval_stage: 'different_detail_stage' };
  await summary(multi.page).getByRole('button', { name: 'Review & decide' }).click();
  const poDialog = multi.page.getByRole('dialog'); await poDialog.waitFor();
  await poDialog.getByRole('button', { name: 'Approve', exact: true }).waitFor();
  assert.deepEqual(multi.control.decisions, []);
  await focusContained(multi.page, poDialog);
  multi.control.expectedDecisions.push({ method: 'POST', endpoint: '/procurement/orders/po-1/approve/' });
  await poDialog.getByRole('button', { name: 'Approve', exact: true }).click();
  await poDialog.getByText('Purchase Order approved successfully.', { exact: true }).waitFor();
  assert.deepEqual(multi.control.decisions[0].body, { approval_stage: 'finance_review', note: '', reason: '' });
  assert.equal(multi.control.decisions.length, 1);
  await multi.page.context().close();

  const reject = await open();
  const prDialog = await review(reject.page, 'PR-2026-0101', 'reject');
  await prDialog.getByRole('textbox', { name: 'Rejection reason' }).waitFor();
  assert.deepEqual(reject.control.decisions, [], 'Summary Reject only opens confirmation');
  await prDialog.getByRole('button', { name: 'Confirm rejection', exact: true }).click();
  await prDialog.getByText('Please provide a rejection reason of at least 10 characters.', { exact: true }).waitFor();
  assert.deepEqual(reject.control.decisions, []);
  await prDialog.getByRole('textbox', { name: 'Rejection reason' }).fill('  Quantity requires correction.  ');
  reject.control.expectedDecisions.push({ method: 'POST', endpoint: '/procurement/requisitions/pr-1/process_dynamic_rejection/' });
  await prDialog.getByRole('button', { name: 'Confirm rejection', exact: true }).click();
  await prDialog.getByText('Purchase Requisition rejected successfully.', { exact: true }).waitFor();
  assert.deepEqual(reject.control.decisions[0].body, { reason: 'Quantity requires correction.' });
  await reject.page.context().close();
  recordCheck('PO queue-entry identity and selected stage reach the correct mocked endpoint; PR rejection requires explicit confirmation and a valid reason');

  for (const [id, endpoint, button] of [['leave-manager', 'rm-approve', 'Approve and send to HR'], ['leave-hr', 'approve', 'Approve leave']]) {
    const state = await open(); await tab(state.page, 'Leave');
    await state.page.locator(`[data-queue-key="leave:${id}"]`).getByRole('button', { name: /^Review / }).click();
    await summary(state.page).getByRole('button', { name: 'Review & decide' }).click();
    const dialog = state.page.getByRole('dialog'); await dialog.getByRole('button', { name: button, exact: true }).waitFor();
    await focusContained(state.page, dialog);
    state.control.expectedDecisions.push({ method: 'POST', endpoint: `/payroll/leave-requests/${id}/${endpoint}/`, data: { ...approvalFixture().queues['/payroll/leave-requests/'].find(row => row.id === id), status: endpoint === 'rm-approve' ? 'RM_APPROVED' : 'APPROVED', can_review: false } });
    await dialog.getByRole('textbox').fill('Synthetic approval verification');
    await dialog.getByRole('button', { name: button, exact: true }).click();
    await state.page.waitForFunction(() => ![...document.querySelectorAll('dialog button')].some(node => /Saving/.test(node.textContent)));
    assert.equal(state.control.decisions.length, 1);
    assert.deepEqual(state.control.decisions[0].body, { note: 'Synthetic approval verification' });
    await state.page.context().close();
  }
  const identity = await open();
  let identityDialog = await review(identity.page, 'SYNTHETIC-IDENTITY-001');
  await identityDialog.locator('img[src^="blob:"]').waitFor(); await focusContained(identity.page, identityDialog);
  await identityDialog.getByRole('button', { name: 'Approve', exact: true }).click();
  assert.deepEqual(identity.control.decisions, []);
  identity.control.expectedDecisions.push({ method: 'POST', endpoint: '/rbac/profile-documents/identity-1/verify/', status: 409, detail: 'This verification stage has changed.' });
  await identityDialog.getByRole('button', { name: 'Confirm Approve', exact: true }).click();
  await identityDialog.getByText('This verification stage has changed.', { exact: true }).waitFor();
  assert.equal(identity.control.decisions.length, 1);
  await identity.page.keyboard.press('Escape');
  identityDialog = await review(identity.page, 'SYNTHETIC-IDENTITY-001', 'reject');
  await identityDialog.getByRole('button', { name: 'Confirm Reject', exact: true }).click();
  await identityDialog.getByText('Please provide a reason for rejection.', { exact: true }).waitFor();
  assert.equal(identity.control.decisions.length, 1);
  await identityDialog.getByRole('textbox').fill('Document image is incomplete.');
  identity.control.expectedDecisions.push({ method: 'POST', endpoint: '/rbac/profile-documents/identity-1/reject/' });
  await identityDialog.getByRole('button', { name: 'Confirm Reject', exact: true }).click();
  await identityDialog.waitFor({ state: 'hidden' });
  assert.deepEqual(identity.control.decisions[1].body, { reason: 'Document image is incomplete.' });
  await identity.page.context().close();
  recordCheck('Existing manager/HR Leave endpoints and authenticated ID previews/confirmations remain intact; rejected decisions stay visible and no unintended POST is allowed');

  const employee = await open({ role: 'employee' });
  const employeeTabs = employee.page.getByRole('navigation', { name: 'Approval queues' });
  for (const label of ['Payroll', 'Invoices', 'ID verification']) assert.equal(await employeeTabs.getByRole('button', { name: new RegExp(`^${label}`) }).count(), 0);
  assert.equal(employee.control.requests.some(row => /profile-documents|master-payroll|finance\/invoices/.test(row.endpoint)), false);
  await employee.page.context().close();
  recordCheck('Role-restricted queue choices do not fetch hidden registers');
}

async function runSourceChecks() {
  for (const fixture of ['empty', 'zero', 'error', 'restricted', 'partial', 'partial-restricted', 'truncated', 'unknown']) {
    const { page, control } = await open({ fixture });
    if (fixture === 'empty' || fixture === 'zero') {
      await page.getByRole('heading', { name: 'No pending requests' }).waitFor();
      for (const label of ['Awaiting my decision', 'Overdue', 'Due today']) assert.equal(await kpi(page, label).innerText(), '0');
      assert.equal(await kpi(page, 'Approved this week').innerText(), '—');
      assert.equal(await page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true);
    } else if (fixture === 'error' || fixture === 'restricted') {
      assert.equal(await kpi(page, 'Awaiting my decision').innerText(), '—');
      assert.equal(await inboxRows(page).count(), 0);
      await page.getByRole('heading', { name: 'No requests available from the loaded queues' }).waitFor();
      assert.equal(await summary(page).getByRole('button', { name: 'Reject', exact: true }).count(), 0);
      await capture(page, `source-${fixture}`);
      control.fixture = 'full'; await page.getByRole('button', { name: 'Retry queues', exact: true }).click(); await loaded(page);
      assert.equal(await kpi(page, 'Awaiting my decision').innerText(), '16');
    } else if (fixture.startsWith('partial')) {
      assert.match(await kpi(page, 'Awaiting my decision').innerText(), /\+$/);
      assert.match(await page.getByRole('alert').innerText(), /Counts cover available queues only/);
      assert.ok(await inboxRows(page).count() > 0);
    } else if (fixture === 'truncated') {
      assert.match(await page.getByRole('status').innerText(), /exports cover loaded requests/);
      assert.match(await page.getByRole('navigation', { name: 'Approval queues' }).getByRole('button', { name: /^Procurement/ }).innerText(), /150\*/);
      const csv = await downloadCsv(page); assert.equal(csv.split('\r\n').length, 17);
    } else if (fixture === 'unknown') {
      if (compact) await tab(page, 'Procurement');
      else { await filter(page, 'Queue', 'procurement'); await filter(page, 'Age', 'unknown'); }
      assert.equal(await inboxRows(page).count(), 7);
      assert.match(await inboxRows(page).first().innerText(), /Age unknown/);
      assert.equal(await inboxRows(page).first().locator('.apc-amount').innerText(), '—');
    }
    if (fixture !== 'error' && fixture !== 'restricted') await capture(page, `source-${fixture}`);
    assert.deepEqual(control.decisions, []); await page.context().close();
  }
  const stale = await open(); stale.control.fixture = 'error';
  await stale.page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(stale.page);
  assert.equal(await inboxRows(stale.page).count(), 0);
  assert.equal(await kpi(stale.page, 'Awaiting my decision').innerText(), '—');
  assert.equal(await stale.page.getByTestId('approval-summary-empty').isVisible(), true);
  await stale.page.context().close();
  const loading = await open({ loading: true });
  await loading.page.getByRole('heading', { name: 'Loading your approval queues' }).waitFor();
  assert.equal(await loading.page.getByRole('button', { name: 'Export', exact: true }).isDisabled(), true);
  await capture(loading.page, 'loading'); await loading.control.release(); await loaded(loading.page);
  assert.equal(await kpi(loading.page, 'Awaiting my decision').innerText(), '16');
  await loading.page.context().close();
  recordCheck('Known empty/zero, unavailable/restricted/partial queues, caps, missing fields, retries, loading and failed-refresh stale-data removal remain truthful');
}

try {
  if (!workflowsOnly) {
  const { page, control } = await newPage();
  if (!baselineOnly) await loaded(page);
  await page.waitForFunction(() => [...document.querySelectorAll('main')].some(node => node.textContent.includes('PR-2026-')));
  for (const width of [1672, 1440, 1024, 390]) {
    await geometry(page, width); await capture(page, `${baselineOnly ? 'before' : 'approvals'}-${width}`);
    if (compact && !baselineOnly) geometryChecks.at(-1).compact = await compactLayout(page, width);
    if (width === 390 && !baselineOnly) {
      await page.locator('.apc-table-scroll').evaluate(node => { node.scrollLeft = node.scrollWidth; });
      await inboxRows(page).first().getByRole('button', { name: /^Review / }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(artifacts, 'approvals-390-table-actions.png') });
      await summary(page).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(artifacts, 'approvals-390-summary.png') });
      await page.locator('.apc-table-scroll').evaluate(node => { node.scrollLeft = 0; });
    }
  }
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await geometry(page, 1672); await capture(page, `${baselineOnly ? 'before' : 'approvals'}-dark`);
  assert.deepEqual(control.decisions, [], 'Opening and viewing approvals never submits decisions');
  if (!baselineOnly) {
    for (const dark of [false, true]) {
      await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
      const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await writeFile(path.join(artifacts, `accessibility-${dark ? 'dark' : 'light'}.json`), JSON.stringify(result.violations, null, 2));
      assert.deepEqual(result.violations, [], `Approvals ${dark ? 'dark' : 'light'} accessibility`);
    }
    await page.context().close();
  }
  }
  if (compact && !baselineOnly && !workflowsOnly) await runCompactSummaryChecks();
  if (!baselineOnly && !process.argv.includes('--visuals-only')) { if (!sourcesOnly) await runFunctionalChecks(); await runSourceChecks(); }
  await checkProtectedSources();
  if (geometryChecks.length) await writeFile(path.join(artifacts, baselineOnly ? 'baseline-geometry.json' : 'geometry.json'), JSON.stringify(geometryChecks, null, 2));
  assert.deepEqual(runtimeErrors, [], 'No runtime errors');
  assert.deepEqual(unexpectedRequests, [], 'Every request is mocked and every decision explicitly expected');
  assert.deepEqual(focusIssues, [], 'Every review/settings dialog contains keyboard focus');
  const reportFile = baselineOnly ? 'baseline-checks.json' : sourcesOnly ? 'source-checks.json' : workflowsOnly ? 'workflow-checks.json' : process.argv.includes('--visuals-only') ? 'visual-checks.json' : 'checks.json';
  await writeFile(path.join(artifacts, reportFile), JSON.stringify({ historicalGuardsEnabled: snapshotGuards, checks, protectedFilesUnchanged: snapshotGuards ? true : null, runtimeErrors, unexpectedRequests, decisions: allDecisions }, null, 2));
  console.log(`PASS: Approvals ${baselineOnly ? 'immutable baseline' : sourcesOnly ? 'source checks' : workflowsOnly ? 'workflow and source checks' : process.argv.includes('--visuals-only') ? 'responsive preflight' : 'responsive, accessibility, workflow and source checks'} complete; ${snapshotGuards ? `${protectedSources.length} protected files unchanged` : 'historical guards not requested'}.`);
} catch (error) {
  const page = browser.contexts().flatMap(context => context.pages())[0];
  if (page) {
    await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {});
    await writeFile(path.join(artifacts, 'failure-debug.json'), JSON.stringify({ message: error.message, runtimeErrors, unexpectedRequests, focusIssues, text: await page.locator('body').innerText().catch(() => '') }, null, 2));
  }
  throw error;
} finally { await browser.close(); }
