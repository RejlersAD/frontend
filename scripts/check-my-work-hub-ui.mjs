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
import { WORK_HUB_CHECK_TIME, workHubUsers, baselineFeatures, baselineDashboardResponses, workHubFeatures, workHubFixture } from './check-my-work-hub-fixtures.mjs';
import { approvalDetail } from './check-approvals-fixtures.mjs';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'my-work-hub');
const origin = 'http://my-work-hub-check.test';
const baselineOnly = process.argv.includes('--baseline');
const sourcesOnly = process.argv.includes('--sources-only');
const workflowsOnly = process.argv.includes('--workflows-only') || sourcesOnly;
const visualsOnly = process.argv.includes('--visuals-only');
const measureOnly = process.argv.includes('--measure-only');
const accessOnly = process.argv.includes('--access-only');
const colorBaselineOnly = process.argv.includes('--kpi-color-baseline');
const recentOnly = process.argv.includes('--recent-only');
const recentViewCapture = recentOnly && process.argv.includes('--view-capture');
const recentBaselineOnly = process.argv.includes('--recent-baseline');
const recentArtifacts = path.join(artifacts, 'recent-activity');
await mkdir(artifacts, { recursive: true });
const snapshotGuards = historicalGuardsEnabled(baselineOnly || recentBaselineOnly || colorBaselineOnly);
console.log(`Historical snapshot guards: ${snapshotGuards ? 'enabled' : 'not requested; core checks remain enabled'}`);
const baseline = await loadSnapshot(frontend, path.join(artifacts, 'source-before-sha256.json'), snapshotGuards);
const recentBaseline = await loadSnapshot(frontend, path.join(recentArtifacts, 'source-before-sha256.json'), snapshotGuards && (recentOnly || recentBaselineOnly));
let externalChanges = [];
async function checkProtectedSources() {
  externalChanges = [];
  for (const row of baseline) {
    assert.equal(createHash('sha256').update(await readFile(path.join(artifacts, 'source-before', row.RelativePath))).digest('hex').toUpperCase(), row.Hash, `Immutable baseline changed: ${row.RelativePath}`);
    if (row.Protected) {
      const current = await readFile(row.Path);
      const hash = createHash('sha256').update(current).digest('hex').toUpperCase();
      // A concurrent workspace edit was identified by the parent and explicitly preserved.
      // Pin its exact reviewed hash, then compare the two width substitutions and five converted line endings.
      const reviewedExternalWidths = { E84BAB527086AEDBD1616F0C3F73153EA551DB9EF374C3F151E265A26A990064: 250, FA111E603314B861CADA6D0C6CA41FE866616ED581E9A8C6B69798703FC2D6C2: 230 };
      const reviewedWidth = reviewedExternalWidths[hash];
      if (row.RelativePath === 'src/config/layout.config.js' && reviewedWidth) {
        const normalized = current.toString('utf8').replace(`'w-[${reviewedWidth}px]'`, "'w-[266px]'").replace(`'lg:ml-[${reviewedWidth}px]'`, "'lg:ml-[266px]'");
        const original = await readFile(path.join(artifacts, 'source-before', row.RelativePath), 'utf8');
        assert.equal(normalized.replace(/\r\n/g, '\n'), original.replace(/\r\n/g, '\n'), 'Only the reviewed width literals and line endings may differ');
        externalChanges.push({ file: row.RelativePath, beforeHash: row.Hash, currentHash: hash, beforeWidth: 266, currentWidth: reviewedWidth, lineEndingsConvertedToCRLF: 5, classification: 'Concurrent workspace edit preserved; not part of the Work Hub implementation', normalizedComparisonMatches: true });
      } else assert.equal(hash, row.Hash, `Protected source changed: ${row.RelativePath}`);
    }
  }
  const protectedCount = baseline.filter(row => row.Protected).length;
  await writeFile(path.join(artifacts, 'protected-source-checks.json'), JSON.stringify({ historicalGuardsEnabled: snapshotGuards, immutableFiles: baseline.length, protectedFiles: protectedCount, unchangedProtectedFiles: protectedCount - externalChanges.length, hashesUnchanged: externalChanges.length === 0, externalChanges }, null, 2));
  if (externalChanges.length) await writeFile(path.join(artifacts, 'external-layout-change.json'), JSON.stringify(externalChanges[0], null, 2));
  if (recentBaseline.length) {
    for (const row of recentBaseline) {
      assert.equal(createHash('sha256').update(await readFile(path.join(recentArtifacts, 'source-before', row.RelativePath))).digest('hex').toUpperCase(), row.Hash, `Immutable Recent baseline changed: ${row.RelativePath}`);
      if (row.Protected) assert.equal(createHash('sha256').update(await readFile(row.Path)).digest('hex').toUpperCase(), row.Hash, `Unrelated Work Hub source changed: ${row.RelativePath}`);
    }
    await writeFile(path.join(recentArtifacts, 'protected-source-checks.json'), JSON.stringify({ originalProtectedFiles: protectedCount - externalChanges.length, externalChanges, unchangedWorkHubFiles: recentBaseline.filter(row => row.Protected).map(row => row.RelativePath), allowedChanges: recentBaseline.filter(row => !row.Protected).map(row => row.RelativePath) }, null, 2));
  }
}
await checkProtectedSources();
const expectedSidebarWidth = baselineOnly ? 266 : await sidebarWidth(frontend);
assert.ok(Number.isFinite(expectedSidebarWidth), 'Expanded sidebar width can be read from the current configuration');

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';
import Dashboard from './src/pages/Dashboard.jsx';
const state={auth:{user:window.workHubUser,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:window.workHubRbac,loading:false},features:{features:window.workHubFeatures,loading:false,initialized:true}};
window.workHubDispatched=[];
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:action=>{window.workHubDispatched.push(action)}};
function Observer(){const location=useLocation();window.workHubRoute=location.pathname+location.search;window.workHubNavigate=useNavigate();return null;}
window.print=()=>{window.workHubPrintCalls=(window.workHubPrintCalls||0)+1;};
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/dashboard']}><Observer/><Routes><Route element={<Layout/>}><Route path='/dashboard' element={<Dashboard/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
`;
const apiClient = `
async function request(method,url,body,config={}){
 const target=new URL('/api/v1'+url,location.origin);Object.entries(config.params||{}).forEach(([key,value])=>{if(value!==undefined&&value!==null)target.searchParams.set(key,value)});
 const response=await fetch(target,{method,signal:config.signal,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=config.responseType==='blob'?await response.blob():await response.json();
 if(!response.ok){const error=new Error(data.detail||'Fixture request failed');error.response={status:response.status,data};throw error;}
 return {data,status:response.status};
}
export default {get:(url,config)=>request('GET',url,undefined,config),post:(url,body,config)=>request('POST',url,body,config),patch:(url,body,config)=>request('PATCH',url,body,config)};`;
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
  [/store[\\/]featureSlice\.js$/, 'export const fetchFeatures=()=>({type:"fixture-features"});'],
  [/components[\\/]Layout[\\/]Footer\.jsx$/, 'export default function Footer(){return null;}'],
  [/components[\\/]ProcurementApprovalReminder\.jsx$/, 'export default function Reminder(){return null;}'],
  [/components[\\/]notifications[\\/]NotificationBell\.jsx$/, serviceButtons.replace('export function NotificationBell', 'export default function NotificationBell').replace('export default function PWAHeaderInstall', 'export function PWAHeaderInstall')],
  [/components[\\/]PWAHeaderInstall\.jsx$/, serviceButtons],
  [/hooks[\\/]useAuthenticatedPhoto\.js$/, 'export default function useAuthenticatedPhoto(){return null;}'],
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Dashboard"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const sourcePaths = new Map(baseline.map(row => [path.normalize(row.Path).toLowerCase(), path.join(artifacts, 'source-before', row.RelativePath)]));
const recentSourcePaths = new Map(recentBaseline.map(row => [path.normalize(row.Path).toLowerCase(), path.join(recentArtifacts, 'source-before', row.RelativePath)]));
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'work-hub-fixture', setup(builder) {
  for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' }));
  if (baselineOnly || recentBaselineOnly) builder.onLoad({ filter: /\.[jm]sx?$/ }, async args => {
    const saved = (recentBaselineOnly ? recentSourcePaths : sourcePaths).get(path.normalize(args.path).toLowerCase());
    return saved ? { contents: await readFile(saved, 'utf8'), loader: 'jsx' } : undefined;
  });
} }] });
async function filesIn(directory) {
  const result = [];
  for (const item of await readdir(path.join(frontend, directory), { withFileTypes: true })) {
    const file = `${directory}/${item.name}`;
    if (item.isDirectory()) result.push(...await filesIn(file)); else result.push(file);
  }
  return result;
}
const componentFiles = [...await filesIn('src/components/Layout'), ...await filesIn('src/components/approvals'),
  'src/pages/Procurement/PurchaseOrderLivePreview.jsx', 'src/pages/Procurement/PurchaseRequisitionDocumentPreview.jsx',
  'src/config/layout.config.js', 'src/pages/Dashboard.jsx', 'src/components/support/ContactSupport.jsx', 'src/components/documentation/Documentation.jsx'];
for (const folder of ['src/pages/MyWorkHub', 'src/components/workhub']) {
  try { componentFiles.push(...await filesIn(folder)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
componentFiles.push(...(await readdir(path.join(frontend, 'src/pages'))).filter(file => /^MyWorkHub.*\.(css|jsx)$/.test(file)).map(file => `src/pages/${file}`));
const readSource = file => readFile(colorBaselineOnly && file === 'src/pages/MyWorkHub.css' ? path.join(artifacts, 'kpi-color-polish/MyWorkHub-before.css') : baselineOnly && sourcePaths.has(path.join(frontend, file).toLowerCase()) ? sourcePaths.get(path.join(frontend, file).toLowerCase()) : path.join(frontend, file), 'utf8');
const classSources = await Promise.all([...new Set(componentFiles)].filter(file => /\.[jm]sx?$/.test(file)).map(readSource));
const css = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await readSource('src/index.css'), { from: undefined });
const styles = await Promise.all([...new Set(componentFiles)].filter(file => file.endsWith('.css')).map(readSource));
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Work Hub fixture checks</title><style>${css.css}\n${styles.join('\n')}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
if (baselineOnly) {
  try { html = await readFile(path.join(artifacts, 'baseline.html'), 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path.join(artifacts, 'baseline.html'), html, { flag: 'wx' }); }
}
const browser = await launchBrowser();
const runtimeErrors = [], unexpectedRequests = [], requests = [], geometryChecks = [], checks = [];
function recordCheck(message) { checks.push(message); console.log(`PASS: ${message}`); }
async function open({ width = 1672, dark = false, role = 'admin', fixture = 'full', loading = false, profileMissing = false, initialPreferences, responses = baselineOnly ? baselineDashboardResponses : {} } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(WORK_HUB_CHECK_TIME));
  await page.addInitScript(({ user, features, dark, initialPreferences, profileMissing }) => {
    window.workHubUser = user;
    window.workHubFeatures = features;
    const codes = user.is_superuser ? ['pid_analysis', 'project_control', 'qhse', 'procurement', 'sales_overview', 'finance_overview'] : [];
    window.workHubRbac = { user, roles: user.roles, modules: codes.map(code => ({ code })), module_actions: Object.fromEntries(codes.map(code => [code, ['read']])), is_reporting_manager: true, direct_reports_count: 2 };
    if (profileMissing) window.workHubRbac = null;
    localStorage.setItem('radai_access_token', 'isolated-work-hub-test-token');
    if (initialPreferences !== undefined) localStorage.setItem(`wh.preferences.v1.${user.id}`, typeof initialPreferences === 'string' ? initialPreferences : JSON.stringify(initialPreferences));
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark));
  }, { user: workHubUsers[role], features: baselineFeatures, dark, initialPreferences, profileMissing });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, loading, pending: [], requests: [], failures: {}, responses };
  const respond = async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) {
      const endpoint = url.pathname.replace(/^\/api\/v1/, '');
      const record = { method: request.method(), endpoint, query: url.search };
      requests.push(record); control.requests.push(record);
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
      if (request.method() !== 'GET') { unexpectedRequests.push(`Unexpected mutation ${request.method()} ${endpoint}`); return json({ detail: 'All mutations are refused by this isolated harness.' }, 409); }
      if (control.failures[endpoint]) return json({ detail: control.failures[endpoint] === 403 ? 'This source is restricted.' : 'This source could not be read.' }, control.failures[endpoint]);
      if (endpoint === '/rbac/users/me/') return json({ user: workHubUsers[role], roles: workHubUsers[role].roles, modules: [] });
      if (Object.hasOwn(control.responses, endpoint)) return json(control.responses[endpoint]);
      if (!baselineOnly) {
        const fixture = workHubFixture(control.fixture, { year: Number(url.searchParams.get('year')) || 2026, month: Number(url.searchParams.get('month')) || 9 });
        if (endpoint === '/dashboard/work-hub/') return json(fixture.report);
        if (endpoint === '/features/') return json({ features: workHubFeatures });
        if (endpoint === '/notifications/') return json({ results: fixture.notifications, count: fixture.notifications.length, next: null });
        if (fixture.approvals.queues[endpoint]) {
          if (fixture.approvals.failures[endpoint]) return json({ detail: 'This approval queue is unavailable.' }, fixture.approvals.failures[endpoint]);
          const rows = fixture.approvals.queues[endpoint];
          return json({ results: rows, count: fixture.approvals.counts[endpoint] ?? rows.length, pending_count: fixture.approvals.counts[endpoint] ?? rows.length, next: null });
        }
        const detail = approvalDetail(fixture.approvals, endpoint);
        if (detail) return json(detail);
        if (endpoint === '/dashboard/metrics/') return json({ users: { total_users: 127 } });
        if (endpoint === '/projects/stats/') return json({ active_count: 7 });
      }
      if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json({ count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
      unexpectedRequests.push(`GET ${endpoint}`); return json({ detail: 'Unmapped fixture source.' }, 404);
    }
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Report unavailable artwork below. */ }
    }
    unexpectedRequests.push(request.url()); return route.abort();
  };
  await page.route('**/*', async route => {
    if (control.loading && route.request().url().startsWith(`${origin}/api/v1/`)) { control.pending.push(route); return; }
    return respond(route);
  });
  control.release = async () => { control.loading = false; await Promise.all(control.pending.splice(0).map(respond)); };
  await page.goto(origin);
  await page.locator('#application-sidebar').waitFor({ state: 'attached' });
  return { page, control };
}
async function capture(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('main.main-content').evaluate(main => { main.querySelector('.wh-page')?.scrollTo({ top: 0, left: 0, behavior: 'instant' }); for (let node = main; node; node = node.parentElement) node.scrollTo({ top: 0, left: 0, behavior: 'instant' }); window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); });
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
}
const kpi = (page, title) => page.locator('.wh-kpi').filter({ has: page.locator('.wh-kpi-title').filter({ hasText: new RegExp(`^${title}$`) }) }).locator('strong');
const work = page => page.locator('.wh-work');
async function loaded(page) {
  await page.getByTestId('my-work-hub').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.wh-header-actions button')].some(node => node.textContent.trim() === 'Refresh' && !node.disabled));
}
async function showView(page, name) { await page.getByRole('navigation', { name: 'My work views' }).getByRole('button', { name, exact: true }).click(); }
async function closeDialog(page) { await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' }); }
async function focusLoop(page, dialog) {
  const candidates = dialog.locator('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]');
  const visible = [];
  for (let index = 0; index < await candidates.count(); index++) if (await candidates.nth(index).isVisible()) visible.push(candidates.nth(index));
  assert.ok(visible.length);
  await visible.at(-1).focus(); await page.keyboard.press('Tab');
  assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, 'Dialog retains forward keyboard focus');
  await visible[0].focus(); await page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, 'Dialog retains backward keyboard focus');
}
async function runFunctionalChecks() {
  const { page, control } = await open(); await loaded(page);
  for (const [title, value] of [['Tasks due', '3'], ['Approvals waiting', '16'], ['Leave balance', '12.5 days'], ['Hours this month', '84.5h']]) assert.equal(await kpi(page, title).innerText(), value);
  assert.equal(await work(page).locator('tbody tr').count(), 5);
  assert.match(await page.getByTestId('workhub-activity').innerText(), /14\s+Recorded activity/);
  assert.equal(await page.locator('.wh-chart-day').count(), 7);
  assert.ok(control.requests.some(row => row.endpoint === '/dashboard/work-hub/' && new URLSearchParams(row.query).get('month') === '9'));
  assert.ok(control.requests.some(row => row.endpoint === '/features/' && new URLSearchParams(row.query).get('status') === 'active'));
  assert.ok(control.requests.some(row => row.endpoint === '/notifications/' && new URLSearchParams(row.query).get('exclude_expired') === 'true'));
  assert.equal(control.requests.some(row => /master-payroll|finance\/invoices/.test(row.endpoint)), false);
  await work(page).getByRole('button', { name: 'View all', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'My assigned tasks' }); await dialog.waitFor();
  assert.equal(await dialog.locator('tbody tr').count(), 8);
  await focusLoop(page, dialog); await closeDialog(page);
  await work(page).getByRole('button', { name: 'Open Review offshore inspection plan', exact: true }).click();
  await page.waitForFunction(() => window.workHubRoute === '/projects?project=project-1');
  await page.evaluate(() => window.workHubNavigate('/dashboard')); await loaded(page);
  await showView(page, 'Approvals');
  assert.equal(await work(page).locator('tbody tr').count(), 5);
  await work(page).getByRole('button', { name: 'Review PR-2026-0101', exact: true }).click();
  dialog = page.getByRole('dialog'); await dialog.waitFor(); await focusLoop(page, dialog); await closeDialog(page);
  await showView(page, 'Recent');
  assert.equal(await work(page).locator('tbody tr').count(), 5);
  await work(page).getByRole('button', { name: 'View details for Transformer datasheet generated', exact: true }).first().click();
  dialog = page.getByRole('dialog', { name: 'Activity details' }); await dialog.waitFor();
  assert.equal(await dialog.getByRole('link', { name: 'Open source' }).count(), 0);
  await closeDialog(page);
  recordCheck('Personal source metrics, five-row previews, expanded task register, original task routes and existing approval review entry remain truthful and read-only');

  const calendar = page.getByTestId('workhub-calendar');
  assert.equal(await calendar.locator('[data-date]').count(), 35);
  assert.equal(await calendar.locator('[data-date]').first().getAttribute('data-date'), '2026-08-31');
  for (const day of [20, 21, 22]) {
    await calendar.locator(`[data-date="2026-09-${day}"]`).click();
    assert.match(await calendar.getByTestId('workhub-calendar-events').innerText(), /Approved annual leave/);
  }
  await calendar.locator('[data-date="2026-09-23"]').click();
  assert.match(await calendar.getByTestId('workhub-calendar-events').innerText(), /United Kingdom/);
  const previousRequests = control.requests.filter(row => row.endpoint === '/dashboard/work-hub/').length;
  await calendar.getByRole('button', { name: 'Next month', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.wh-calendar-title')?.textContent === 'October 2026');
  await page.waitForFunction(() => !document.querySelector('[data-testid="workhub-calendar"] .wh-panel-loading'));
  assert.ok(control.requests.filter(row => row.endpoint === '/dashboard/work-hub/').length > previousRequests);
  assert.equal(new URLSearchParams(control.requests.filter(row => row.endpoint === '/dashboard/work-hub/').at(-1).query).get('month'), '10');
  assert.equal(await kpi(page, 'Hours this month').innerText(), '84.5h', 'Browsing calendar months does not replace this-month KPIs');
  await calendar.getByRole('button', { name: 'Show today', exact: true }).click();
  await calendar.getByRole('button', { name: 'Show upcoming', exact: true }).click();
  await calendar.getByRole('button', { name: 'View full calendar', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'HR calendar' }); await dialog.waitFor(); await focusLoop(page, dialog); await closeDialog(page);
  recordCheck('Monday-first calendar, inclusive approved-leave ranges, explicit holiday regions and month browsing preserve current personal KPI values');

  const notices = page.getByTestId('workhub-notices');
  assert.equal(await notices.getByTestId('workhub-notice-list').locator('li').count(), 4);
  assert.match(await notices.getByTestId('workhub-notice-unread-count').innerText(), /^3 unread notices in this preview/);
  assert.match(await notices.getByTestId('workhub-notice-list').locator('li').first().innerText(), /Critical recorded assurance notice/);
  await notices.getByRole('tab', { name: 'News', exact: true }).click();
  assert.equal(await notices.getByTestId('workhub-notice-list').locator('li').count(), 1);
  await notices.getByRole('tab', { name: 'News', exact: true }).focus(); await page.keyboard.press('End');
  assert.equal(await notices.getByRole('tab', { name: 'Urgent', exact: true }).getAttribute('aria-selected'), 'true');
  assert.match(await notices.getByTestId('workhub-notice-list').innerText(), /Urgent recorded procurement notice/);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await notices.getByRole('tab', { name: 'Critical', exact: true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  await notices.getByRole('button', { name: 'Open notice: Project inspection plan requires review', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Notice details' }); await dialog.waitFor();
  assert.equal(await dialog.getByRole('link', { name: 'Open source' }).getAttribute('href'), '/projects?project=project-1');
  await focusLoop(page, dialog); await closeDialog(page);
  assert.match(await notices.getByTestId('workhub-notice-unread-count').innerText(), /^3 unread/, 'Opening a notice does not mark it read');
  recordCheck('Notice tabs support keyboard navigation, count only confirmed unread visible notices, and open source details without marking anything read');

  await page.locator('.wh-workspaces').getByRole('button', { name: 'View all', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Available workspaces' }); await dialog.waitFor();
  await dialog.getByRole('textbox', { name: 'Search workspaces' }).fill('procurement');
  assert.equal(await dialog.locator('.wh-shortcut').count(), 1);
  assert.equal(await dialog.locator('.wh-shortcut').getAttribute('href'), '/procurement');
  await dialog.getByRole('textbox', { name: 'Search workspaces' }).fill('no matching workspace');
  await dialog.getByText('No matching workspaces.', { exact: true }).waitFor(); await closeDialog(page);
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Customize your work hub' }); await dialog.waitFor();
  await focusLoop(page, dialog);
  await dialog.getByRole('checkbox', { name: 'HR calendar', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: 'Important notices', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await page.getByTestId('workhub-calendar').count(), 0);
  assert.equal(await page.getByTestId('workhub-notices').count(), 0);
  assert.equal(await page.locator('.wh-columns--full').count(), 1);
  const saved = await page.evaluate(id => JSON.parse(localStorage.getItem(`wh.preferences.v1.${id}`)), workHubUsers.admin.id);
  assert.equal(saved.calendar, false); assert.equal(saved.notices, false); assert.ok(saved.shortcuts.length <= 6);
  await page.reload(); await loaded(page);
  assert.equal(await page.getByTestId('workhub-calendar').count(), 0);
  await page.getByRole('button', { name: 'Customize', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Customize your work hub' });
  await dialog.getByRole('button', { name: 'Restore defaults', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await page.getByTestId('workhub-calendar').waitFor(); await page.getByTestId('workhub-notices').waitFor();
  assert.equal(control.requests.some(row => row.method !== 'GET'), false);
  await page.context().close();
  const restricted = await open({ role: 'employee', initialPreferences: '{invalid json' }); await loaded(restricted.page);
  assert.deepEqual(await restricted.page.locator('.wh-workspaces .wh-shortcut').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')).sort()), ['/my-enquiries', '/profile']);
  assert.equal(restricted.control.requests.some(row => row.endpoint.includes('profile-documents')), false);
  await restricted.page.context().close();
  recordCheck('Workspace search respects effective read grants; per-user customization persists safely, restores defaults and tolerates corrupt stored preferences');
}

async function runSourceChecks() {
  for (const fixture of ['zero', 'unavailable', 'source-error', 'approval-partial', 'calendar-partial', 'negative-balance', 'truncated', 'unsafe-notice', 'unknown-notice-read']) {
    const { page, control } = await open({ fixture }); await loaded(page);
    if (fixture === 'zero') {
      for (const [title, value] of [['Tasks due', '0'], ['Approvals waiting', '0'], ['Leave balance', '0 days'], ['Hours this month', '0h']]) assert.equal(await kpi(page, title).innerText(), value);
      await page.getByRole('heading', { name: 'No open tasks assigned', exact: true }).waitFor();
      assert.equal(await work(page).getByRole('button', { name: 'View all', exact: true }).isDisabled(), true);
      assert.equal(await page.locator('.wh-chart-bar').evaluateAll(nodes => nodes.every(node => node.style.height === '0%')), true);
    } else if (fixture === 'unavailable' || fixture === 'source-error') {
      for (const title of ['Tasks due', 'Leave balance', 'Hours this month']) assert.equal(await kpi(page, title).innerText(), '—');
      assert.equal(await kpi(page, 'Approvals waiting').innerText(), '16');
      assert.equal(await page.locator('.wh-chart').count(), 0);
      assert.equal(await work(page).locator('tbody tr').count(), 0);
    } else if (fixture === 'approval-partial') assert.equal(await kpi(page, 'Approvals waiting').innerText(), '12+');
    else if (fixture === 'calendar-partial') {
      assert.match(await page.getByTestId('workhub-calendar').innerText(), /Some calendar sources are unavailable/);
      assert.match(await page.getByTestId('workhub-calendar-events').innerText(), /Published regional holiday/);
      assert.doesNotMatch(await page.getByTestId('workhub-calendar-events').innerText(), /Approved annual leave/);
    } else if (fixture === 'negative-balance') assert.equal(await kpi(page, 'Leave balance').innerText(), '-0.5 days');
    else if (fixture === 'truncated') {
      assert.equal(await kpi(page, 'Tasks due').innerText(), '32');
      assert.match(await work(page).innerText(), /More records are available/);
      await work(page).getByRole('button', { name: 'View all', exact: true }).click();
      assert.equal(await page.getByRole('dialog').locator('tbody tr').count(), 100);
      assert.match(await page.getByRole('dialog').innerText(), /limited preview/); await closeDialog(page);
    } else if (fixture === 'unsafe-notice') {
      await page.getByRole('button', { name: 'Open notice: Project inspection plan requires review', exact: true }).click();
      assert.equal(await page.getByRole('dialog').getByRole('link', { name: 'Open source' }).count(), 0); await closeDialog(page);
    } else if (fixture === 'unknown-notice-read') assert.match(await page.getByTestId('workhub-notice-unread-count').innerText(), /^2 confirmed unread/);
    await capture(page, `source-${fixture}`);
    assert.equal(control.requests.some(row => row.method !== 'GET'), false);
    await page.context().close();
  }
  const { page, control } = await open(); await loaded(page);
  for (const status of [503, 403]) {
    control.failures['/dashboard/work-hub/'] = status;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page);
    assert.equal(await kpi(page, 'Hours this month').innerText(), '—');
    assert.equal(await work(page).locator('tbody tr').count(), 0);
    assert.equal(await kpi(page, 'Approvals waiting').innerText(), '16');
    await capture(page, `source-http-${status}`);
    delete control.failures['/dashboard/work-hub/'];
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page);
    assert.equal(await kpi(page, 'Hours this month').innerText(), '84.5h');
  }
  control.failures['/notifications/'] = 503;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page);
  await page.getByRole('button', { name: 'Retry notices', exact: true }).waitFor();
  assert.equal(await page.getByTestId('workhub-notice-list').count(), 0);
  delete control.failures['/notifications/'];
  await page.getByRole('button', { name: 'Retry notices', exact: true }).click(); await loaded(page);
  await page.getByTestId('workhub-notice-list').waitFor();
  await page.context().close();
  const pending = await open({ loading: true });
  await pending.page.getByRole('heading', { name: 'Loading your work', exact: true }).waitFor();
  for (const title of ['Tasks due', 'Approvals waiting', 'Leave balance', 'Hours this month']) assert.equal(await kpi(pending.page, title).innerText(), '—');
  await capture(pending.page, 'loading'); await pending.control.release(); await loaded(pending.page);
  assert.equal(await kpi(pending.page, 'Tasks due').innerText(), '3'); await pending.page.context().close();
  recordCheck('Zero, missing, negative ledger values, failed/partial/capped sources, unsafe notice links, retries and loading preserve source truth without stale values or writes');
}
async function runAccessRetryCheck() {
  const { page, control } = await open({ profileMissing: true }); await loaded(page);
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
  assert.equal(await refresh.isEnabled(), true);
  assert.equal(await kpi(page, 'Approvals waiting').innerText(), '—');
  await showView(page, 'Approvals');
  await work(page).getByRole('heading', { name: 'This work list could not be loaded', exact: true }).waitFor();
  const before = await page.evaluate(() => window.workHubDispatched.filter(action => action?.type === 'fixture-rbac').length);
  await refresh.click(); await loaded(page);
  const after = await page.evaluate(() => window.workHubDispatched.filter(action => action?.type === 'fixture-rbac').length);
  assert.ok(after > before, 'Refresh requests the missing access profile again');
  assert.equal(control.requests.some(row => /pending-for-me|profile-documents/.test(row.endpoint)), false, 'No approval queue is requested before the access profile exists');
  assert.equal(await kpi(page, 'Approvals waiting').innerText(), '—');
  await capture(page, 'source-access-profile-missing');
  await page.context().close();
  recordCheck('Missing access profile shows unavailable approvals, keeps Refresh enabled, retries the profile and never requests approval queues prematurely');
}
async function assertFriendlyActivity(locator) {
  const text = await locator.innerText();
  const labels = await locator.locator('[title],[aria-label]').evaluateAll(nodes => nodes.map(node => `${node.getAttribute('title') || ''} ${node.getAttribute('aria-label') || ''}`).join('\n'));
  assert.doesNotMatch(`${text}\n${labels}`, /\b(?:GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)\s+(?:\/|https?:\/\/)|\/api\/|192\.0\.2\.1/i, 'Activity content and accessible labels contain no raw telemetry');
}
async function runRecentChecks() {
  if (recentViewCapture) {
    const { page } = await open({ fixture: 'recent-views-only' }); await loaded(page); await showView(page, 'Recent');
    const rows = work(page).locator('tbody tr');
    assert.equal(await rows.count(), 3);
    assert.deepEqual(await rows.locator('td:nth-child(2) small').allTextContents(), ['You viewed Project Control.', 'You viewed Sales opportunities.', 'You viewed Quality.']);
    assert.deepEqual(await rows.locator('td:nth-child(5)').allTextContents(), ['Viewed', 'Viewed', 'Viewed']);
    await capture(page, 'recent-activity/recent-views-only'); await page.context().close();
    recordCheck('Final visit descriptions use friendly You viewed copy and retain Viewed status');
    return;
  }
  const { page, control } = await open({ fixture: 'recent-friendly' }); await loaded(page);
  const cardGeometry = await page.locator('.wh-kpi').evaluateAll(nodes => nodes.map(node => { const rect = node.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
  assert.ok(cardGeometry.every(row => row.height === 96), 'Existing KPI size retained');
  await showView(page, 'Recent');
  let rows = work(page).locator('tbody tr');
  assert.equal(await rows.count(), 5);
  assert.equal(await rows.first().locator('td').nth(1).locator('strong').innerText(), 'Transformer datasheet generated');
  assert.equal(await rows.first().locator('td').nth(3).innerText(), 'Electrical Engineering');
  assert.equal(await rows.first().locator('td').nth(5).innerText(), 'View details');
  assert.match(await rows.nth(1).innerText(), /Viewed Project Control[\s\S]*Viewed[\s\S]*Open/);
  assert.equal(await rows.nth(1).locator('td').nth(4).innerText(), 'Viewed', 'Workspace visits are not completed work');
  assert.equal(await rows.nth(2).locator('td').nth(5).innerText(), 'View details', 'A historical visit does not invent a currently granted destination');
  assert.match(await rows.nth(4).innerText(), /Transformer datasheet generation unsuccessful[\s\S]*Failed/);
  await assertFriendlyActivity(work(page));
  for (const width of [1672, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 941 });
    await page.waitForTimeout(100);
    const result = await page.locator('.wh-page').evaluate(root => ({ width: innerWidth, documentFits: document.documentElement.scrollWidth <= innerWidth, pageFits: root.scrollWidth <= root.clientWidth + 1, rowHeights: [...root.querySelectorAll('.wh-work-table tbody tr')].map(row => row.getBoundingClientRect().height), sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width }));
    assert.equal(result.documentFits, true); assert.equal(result.pageFits, true);
    assert.ok(result.rowHeights.every(height => height === 49), `${width}: Recent rows retain49px density`);
    if (width >= 1024) assert.equal(result.sidebarWidth, expectedSidebarWidth);
    geometryChecks.push(result);
    await capture(page, `recent-activity/recent-${width}`);
  }
  await page.setViewportSize({ width: 1672, height: 941 });
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    await capture(page, `recent-activity/recent-${dark ? 'dark' : 'light'}`);
    const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await writeFile(path.join(recentArtifacts, `accessibility-${dark ? 'dark' : 'light'}.json`), JSON.stringify(result.violations, null, 2));
    assert.deepEqual(result.violations, [], 'Recent preview accessibility');
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await rows.first().getByRole('button', { name: 'View details for Transformer datasheet generated', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Activity details' }); await dialog.waitFor();
  await assertFriendlyActivity(dialog);
  assert.match(await dialog.innerText(), /You generated a transformer datasheet/);
  assert.equal(await dialog.getByRole('link', { name: 'Open source' }).count(), 0, 'No source link is invented for a null route');
  await focusLoop(page, dialog);
  await page.screenshot({ path: path.join(recentArtifacts, 'activity-details.png') }); await closeDialog(page);
  await rows.nth(2).getByRole('button', { name: 'View details for Viewed Purchase orders', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Activity details' }); await dialog.waitFor();
  assert.match(await dialog.innerText(), /You viewed Purchase orders\./);
  assert.equal(await dialog.getByRole('link', { name: 'Open source' }).count(), 0);
  await assertFriendlyActivity(dialog); await closeDialog(page);
  await work(page).getByRole('button', { name: 'View all', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Recent activity' }); await dialog.waitFor();
  assert.equal(await dialog.locator('tbody tr').count(), 10); await assertFriendlyActivity(dialog);
  assert.match(await dialog.innerText(), /latest 10 activity records/);
  await page.screenshot({ path: path.join(recentArtifacts, 'recent-expanded.png') });
  await dialog.getByRole('button', { name: 'View details for Report generated', exact: true }).last().click();
  dialog = page.getByRole('dialog', { name: 'Activity details' }); await dialog.waitFor();
  await assertFriendlyActivity(dialog); assert.match(await dialog.innerText(), /You generated a report/);
  await closeDialog(page);
  await rows.nth(1).getByRole('button', { name: 'Open Viewed Project Control', exact: true }).click();
  await page.waitForFunction(() => window.workHubRoute === '/projects');
  await page.evaluate(() => window.workHubNavigate('/dashboard')); await loaded(page);
  await showView(page, 'Tasks');
  await work(page).getByRole('button', { name: 'Open Review offshore inspection plan', exact: true }).click();
  await page.waitForFunction(() => window.workHubRoute === '/projects?project=project-1');
  assert.equal(control.requests.some(row => row.method !== 'GET'), false);
  await page.context().close();
  recordCheck('Recent actions and workspace visits show distinct Recorded/Failed/Viewed statuses, friendly details and granted Open links; null destinations remain read-only and 49px density is retained');

  for (const fixture of ['recent-legacy', 'recent-mixed', 'recent-views-only', 'zero']) {
    const { page, control } = await open({ fixture }); await loaded(page); await showView(page, 'Recent');
    await assertFriendlyActivity(work(page));
    if (fixture === 'recent-legacy') {
      assert.equal(await work(page).locator('tbody tr').count(), 0);
      await work(page).getByRole('heading', { name: 'Work list unavailable', exact: true }).waitFor();
      assert.equal(await work(page).getByRole('button', { name: 'View all', exact: true }).isDisabled(), true);
      assert.equal(await page.locator('.wh-chart').count(), 0, 'Legacy request totals and chart series are withheld');
      control.fixture = 'recent-friendly'; await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await loaded(page);
      assert.equal(await work(page).locator('tbody tr').count(), 5); await assertFriendlyActivity(work(page));
    } else if (fixture === 'recent-mixed') {
      assert.equal(await work(page).locator('tbody tr').count(), 5);
      await work(page).getByRole('button', { name: 'View all', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Recent activity' }); await dialog.waitFor();
      assert.equal(await dialog.locator('tbody tr').count(), 10); await assertFriendlyActivity(dialog); await closeDialog(page);
      await work(page).getByRole('button', { name: 'View details for Transformer datasheet generated', exact: true }).first().click();
      await assertFriendlyActivity(page.getByRole('dialog')); await closeDialog(page);
    } else if (fixture === 'recent-views-only') {
      const rows = work(page).locator('tbody tr');
      assert.equal(await rows.count(), 3, 'Recorded visits populate Recent when there are no explicit action records');
      assert.deepEqual(await rows.locator('td:nth-child(5)').allTextContents(), ['Viewed', 'Viewed', 'Viewed']);
      assert.match(await page.getByTestId('workhub-activity').innerText(), /3\s+Recorded activity[\s\S]*Actions and page visits/);
      assert.doesNotMatch(await work(page).innerText(), /no recent|no description/i);
      assert.deepEqual(await rows.locator('td:nth-child(2) small').allTextContents(), ['You viewed Project Control.', 'You viewed Sales opportunities.', 'You viewed Quality.']);
      await work(page).getByRole('button', { name: 'View all', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Recent activity' }); await dialog.waitFor();
      assert.equal(await dialog.locator('tbody tr').count(), 3); await assertFriendlyActivity(dialog); await closeDialog(page);
      await capture(page, `recent-activity/${fixture}`);
      await rows.first().getByRole('button', { name: 'Open Viewed Project Control', exact: true }).click();
      await page.waitForFunction(() => window.workHubRoute === '/projects');
      assert.equal(control.requests.some(row => row.method !== 'GET'), false);
      await page.context().close(); continue;
    } else {
      await work(page).getByRole('heading', { name: 'No recent activity yet', exact: true }).waitFor();
      assert.match(await page.getByTestId('workhub-activity').innerText(), /0\s+Recorded activity/);
    }
    await capture(page, `recent-activity/${fixture}`); await page.context().close();
  }
  recordCheck('View-only history stays visible with accurate activity totals; legacy and mixed API telemetry is withheld, while genuine empty activity remains zero');
}
try {
  if (recentOnly) await runRecentChecks();
  if (recentBaselineOnly) {
    const { page } = await open({ fixture: 'recent-legacy' }); await loaded(page); await showView(page, 'Recent');
    assert.match(await work(page).innerText(), /GET \/api\/v1\/dashboard\/work-hub/);
    await capture(page, 'recent-activity/before-recent-1672');
    await work(page).getByRole('button', { name: 'View all', exact: true }).click();
    await page.getByRole('dialog').waitFor(); await page.screenshot({ path: path.join(recentArtifacts, 'before-expanded-1672.png') });
    await page.context().close();
  }
  if (accessOnly) await runAccessRetryCheck();
  if (measureOnly) {
    const { page } = await open({ dark: process.argv.includes('--dark') }); await loaded(page);
    const selectors = ['.wh-main-column', '.wh-kpis', '.wh-kpi', '.wh-kpi-icon', '.wh-kpi-title', '.wh-work', '.wh-work .wh-panel-heading', '.wh-work .wh-panel-heading h2', '.wh-work .wh-panel-heading .wh-text-button', '.wh-tabs', '.wh-tabs button', '.wh-work-table', '.wh-work-table tbody tr', '.wh-workspaces', '.wh-workspaces .wh-panel-heading', '.wh-workspaces .wh-panel-heading h2', '.wh-workspaces .wh-panel-heading .wh-text-button', '.wh-shortcuts', '.wh-shortcut', '.wh-activity', '.wh-page-footer'];
    const measurement = await page.evaluate(selectors => Object.fromEntries(selectors.map(selector => [selector, [...document.querySelectorAll(selector)].map(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return { text: node.textContent.trim().slice(0, 90), top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, lineHeight: style.lineHeight, fontSize: style.fontSize, padding: style.padding, margin: style.margin, minHeight: style.minHeight, gap: style.gap, boxSizing: style.boxSizing, display: style.display, alignItems: style.alignItems, color: style.color, backgroundColor: style.backgroundColor, borderColor: style.borderColor, boxShadow: style.boxShadow };
    })])), selectors);
    await writeFile(path.join(artifacts, 'layout-measurements.json'), JSON.stringify(measurement, null, 2));
    console.log(JSON.stringify(measurement, null, 2));
    await capture(page, 'work-hub-measured-1672'); await page.context().close();
  }
  if (!workflowsOnly && !measureOnly && !accessOnly && !recentOnly && !recentBaselineOnly) {
  const { page } = await open();
  if (baselineOnly) await page.getByRole('heading', { name: /AI Operations Center/ }).waitFor();
  else { await loaded(page); await page.getByRole('heading', { name: /Good (morning|afternoon|evening),/i }).waitFor(); }
  await page.waitForTimeout(300);
  for (const width of [1672, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 941 });
    await page.waitForTimeout(150);
    const result = await page.locator('main.main-content').evaluate(main => ({ documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: main.scrollWidth <= main.clientWidth + 1, contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      workRowHeights: [...main.querySelectorAll('.wh-work-table tbody tr')].map(row => row.getBoundingClientRect().height),
      activityBottom: main.querySelector('.wh-activity')?.getBoundingClientRect().bottom,
      footerBottom: main.querySelector('.wh-page-footer')?.getBoundingClientRect().bottom,
      kpiOverflow: [...main.querySelectorAll('.wh-kpi')].filter(card => [...card.querySelectorAll('strong,small,.wh-kpi-title')].some(child => { const bounds = child.getBoundingClientRect(), outer = card.getBoundingClientRect(); return bounds.right > outer.right + 1 || bounds.bottom > outer.bottom + 1; })).map(card => card.textContent),
    }));
    geometryChecks.push({ width, ...result });
    if (!baselineOnly) {
      assert.equal(result.documentFits, true); assert.equal(result.mainFits, true);
      assert.deepEqual(result.kpiOverflow, [], `${width}: KPI text fits its card`);
      if (width === 1672) {
        assert.ok(result.workRowHeights.every(height => height === 49), 'Desktop task rows retain their original 49px density');
        assert.ok(result.activityBottom <= 941, 'The full activity panel fits the 1672×941 desktop view');
      }
    }
    assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth);
    if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
    await capture(page, `${baselineOnly ? 'before' : 'work-hub'}-${width}`);
    if (!baselineOnly && width === 390) {
      for (const panel of ['calendar', 'notices']) {
        await page.getByTestId(`workhub-${panel}`).scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(artifacts, `work-hub-390-${panel}.png`) });
      }
      const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await writeFile(path.join(artifacts, 'accessibility-mobile.json'), JSON.stringify(result.violations, null, 2));
      assert.deepEqual(result.violations, [], 'Mobile work hub accessibility');
    }
  }
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await capture(page, `${baselineOnly ? 'before' : 'work-hub'}-dark`);
  if (!baselineOnly) for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    const result = await new AxeBuilder({ page }).include('main.main-content').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await writeFile(path.join(artifacts, `accessibility-${dark ? 'dark' : 'light'}.json`), JSON.stringify(result.violations, null, 2));
    assert.deepEqual(result.violations, []);
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize your work hub' }); await dialog.waitFor();
    const dialogResult = await new AxeBuilder({ page }).include('.wh-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    await writeFile(path.join(artifacts, `accessibility-customize-${dark ? 'dark' : 'light'}.json`), JSON.stringify(dialogResult.violations, null, 2));
    assert.deepEqual(dialogResult.violations, [], 'Customization dialog accessibility');
    await closeDialog(page);
  }
  await page.context().close();
  }
  if (!baselineOnly && !visualsOnly && !measureOnly && !accessOnly && !recentOnly && !recentBaselineOnly) { if (!sourcesOnly) await runFunctionalChecks(); await runSourceChecks(); await runAccessRetryCheck(); }
  await checkProtectedSources();
  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(unexpectedRequests, []);
  await writeFile(path.join(artifacts, recentBaselineOnly ? 'recent-activity/baseline-checks.json' : recentViewCapture ? 'recent-activity/view-capture-checks.json' : recentOnly ? 'recent-activity/checks.json' : baselineOnly ? 'baseline-checks.json' : accessOnly ? 'access-checks.json' : measureOnly ? 'measure-checks.json' : sourcesOnly ? 'source-checks.json' : workflowsOnly ? 'workflow-checks.json' : visualsOnly ? 'visual-checks.json' : 'checks.json'), JSON.stringify({ historicalGuardsEnabled: snapshotGuards, checks, protectedFilesUnchanged: snapshotGuards ? externalChanges.length === 0 : null, unchangedProtectedFiles: baseline.filter(row => row.Protected).length - externalChanges.length, externalChanges, runtimeErrors, unexpectedRequests, requests, geometry: geometryChecks }, null, 2));
  console.log(`PASS: My Work Hub ${recentBaselineOnly ? 'Recent immutable before capture' : recentOnly ? 'Recent checks' : baselineOnly ? 'immutable before capture' : accessOnly ? 'access-profile retry check' : measureOnly ? 'layout measurements' : sourcesOnly ? 'source checks' : workflowsOnly ? 'workflow and source checks' : visualsOnly ? 'responsive and accessibility checks' : 'responsive, accessibility, workflow and source checks'}; ${snapshotGuards ? `${baseline.filter(row => row.Protected).length - externalChanges.length} protected files unchanged${externalChanges.length ? ', one acknowledged external sidebar edit preserved' : ''}` : 'historical guards not requested'}.`);
} catch (error) {
  const page = browser.contexts().flatMap(context => context.pages())[0];
  if (page) { await page.screenshot({ path: path.join(artifacts, 'failure.png') }).catch(() => {}); await writeFile(path.join(artifacts, 'failure-debug.json'), JSON.stringify({ message: error.message, runtimeErrors, unexpectedRequests, text: await page.locator('body').innerText().catch(() => '') }, null, 2)); }
  throw error;
} finally { await browser.close(); }
