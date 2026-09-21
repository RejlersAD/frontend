import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import AxeBuilder from '@axe-core/playwright';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { checkArtifacts, inlineLocalCssImports, launchBrowser, sidebarWidth, snapshotSources } from './ui-check-support.mjs';
import { checkCreateEmployeeVisuals, checkCreateEmployeeWorkflows } from './check-create-employee-ui.mjs';
import { createOnboardingCaseFixture, checkOnboardingCaseVisuals, checkOnboardingCaseWorkflows } from './check-onboarding-case-ui.mjs';

// Exercise the real lifecycle page and shared navigation against synthetic data only.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'onboarding');
const origin = 'http://onboarding-check.test';
const frozenTime = '2025-04-26T09:00:00.000Z';
const visualsOnly = process.argv.includes('--visuals-only');
const workflowsOnly = process.argv.includes('--workflows-only');
const createOnly = process.argv.includes('--create-only');
const caseOnly = process.argv.includes('--case-only');
const exitCreationOnly = process.argv.includes('--exit-creation-only');
const creationVisibilityOnly = exitCreationOnly || process.argv.includes('--creation-visibility-only');
const selectedViewport = Number(process.argv.find(value => value.startsWith('--viewport='))?.split('=')[1]) || null;
const protectedFiles = ['src/components/Layout/Sidebar.jsx', 'src/components/Layout/Sidebar.css', 'src/components/Layout/Header.jsx', 'src/components/Layout/Layout.jsx', 'src/config/layout.config.js', 'src/hooks/useSidebarLayout.js', 'src/hooks/useSidebarDrawer.js'];
const sourceBefore = await snapshotSources(frontend, protectedFiles);
await mkdir(artifacts, { recursive: true });
const user = { id: 7001, first_name: 'Julia', last_name: 'Svensson', email: 'julia.svensson@example.test', is_superuser: true, is_staff: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] };
const people = [
  ['Erik Reinholm', 'Solutions Architect', '2025-05-04', 'Engineering', 'RAD'],
  ['Lisa Sandberg', 'Project Manager', '2025-05-06', 'Projects', 'RAD'],
  ['Marcus Karlsson', 'Consultant', '2025-04-28', 'Engineering', 'RAD'],
  ['Anna Persson', 'Business Analyst', '2025-04-28', 'Projects', 'RIN'],
  ['Sara Nilsson', 'UX Designer', '2025-04-30', 'Design', 'RAD'],
  ['Johan Olsson', 'Service Technician', '2025-05-02', 'Engineering', 'RIN'],
  ...Array.from({ length: 12 }, (_, index) => [`Employee ${index + 7}`, 'Engineer', `2025-05-${String(10 + index).padStart(2, '0')}`, 'Engineering', 'RAD']),
];
const rows = people.map(([name, position, joining_date, department, branch], index) => ({
  id: index + 1, canonical_employee: `fixture-employee-${index + 1}`, employee_name: name,
  employee_email: `employee${index + 1}@example.test`, employee_id: `SYN-${100 + index}`, user: 8100 + index,
  position, department, branch, joining_date, initiated_date: '2025-04-15T08:00:00Z',
  target_completion_date: joining_date, status: 'documentation', progress_percentage: index > 5 ? 100 : 30,
  equipment_count: 1, documents_count: 1, access_count: 1, checklist_count: 4,
  checklist_completed_count: index > 5 ? 4 : 1, reporting_manager: 'Julia Svensson', assigned_to_name: 'HR',
  created_at: '2025-04-15T08:00:00Z', updated_at: frozenTime, equipment: [], documents: [], access_records: [],
  checklist_stage_permissions: {}, engineer_profile: {},
}));
const taskDefinitions = [
  ['Verify employee master data', 'pre_hire'], ['Review employment documents', 'pre_hire'],
  ['Create system accounts', 'it_provisioning'], ['Prepare laptop and equipment', 'it_provisioning'],
];
const checklist = rows.flatMap((row, rowIndex) => taskDefinitions.map(([task_name, stage], taskIndex) => ({
  id: row.id * 10 + taskIndex, onboarding_record: row.id, offboarding_record: null, task_name, stage,
  completed: rowIndex >= 6 || taskIndex < 2, due_date: rowIndex < 2 ? `2025-04-${24 + rowIndex}` : row.joining_date,
  priority: taskIndex >= 2 ? 'critical' : 'medium', description: '',
})));
checklist.push(
  { id: 1001, onboarding_record: 3, offboarding_record: null, task_name: 'Confirm induction schedule', stage: 'first_day', completed: false, due_date: '2025-04-28', priority: 'medium' },
  { id: 1002, onboarding_record: 5, offboarding_record: null, task_name: 'Assign onboarding buddy', stage: 'first_day', completed: false, due_date: '2025-04-29', priority: 'medium' },
);
const exits = rows.slice(0, 8).map((row, index) => ({
  ...row, id: 201 + index, status: 'access_revocation', last_working_day: row.joining_date,
  exit_reason: 'resignation', target_completion_date: row.joining_date,
  days_until_exit: Math.round((Date.parse(row.joining_date) - Date.parse('2025-04-26')) / 86400000),
  project_manager_approval_status: 'not_required', ongoing_projects: [], exit_approvals: [],
  can_manage_actions: true, can_project_manager_decide: false,
}));
const exitTaskDefinitions = [
  ['Confirm resignation or termination approval', 'exit_initiation'],
  ['Schedule email and directory account deactivation', 'access_revocation'],
  ['Collect laptop, desktop, and monitors', 'asset_return'],
  ['Complete knowledge and document handover', 'exit_clearance'],
  ['Calculate and approve final settlement', 'final_settlement'],
];
const exitChecklist = exits.flatMap((row, rowIndex) => exitTaskDefinitions.map(([task_name, stage], taskIndex) => ({
  id: row.id * 10 + taskIndex, onboarding_record: null, offboarding_record: row.id, task_name, stage,
  completed: rowIndex >= 6 || taskIndex === 0, due_date: rowIndex < 2 ? `2025-04-${24 + rowIndex}` : row.last_working_day,
  priority: taskIndex ? 'critical' : 'medium', description: '',
})));
const completedExit = {
  ...exits[0], id: 209, employee_name: 'Clara Andersson', employee_email: 'clara.andersson@example.test',
  status: 'completed', last_working_day: '2025-05-01', actual_completion_date: '2025-04-25', progress_percentage: 100,
};
const completedExitChecklist = exitTaskDefinitions.map(([task_name, stage], index) => ({
  id: 2090 + index, onboarding_record: null, offboarding_record: completedExit.id, task_name, stage,
  completed: true, due_date: completedExit.last_working_day, priority: 'critical', description: '',
}));
const lifecycleFixtures = {
  onboarding: { count: 18, attention: 'Onboarding actions requiring attention', upcoming: 'Upcoming joiners', readiness: 'Onboarding readiness', metricLabels: ['Active onboardings', 'Actions overdue', 'Joining in 7 days', 'Day-one ready'] },
  offboarding: { count: 8, attention: 'Exit actions requiring attention', upcoming: 'Upcoming departures', readiness: 'Clearance readiness', metricLabels: ['Active exits', 'Actions overdue', 'Leaving in 7 days', 'Clearance complete'] },
};
const fixtureEmployees = [
  { id: 'fixture-manager-1', user_id: 7001, employee_number: 'SYN-MGR-001', first_name: 'Julia', last_name: 'Svensson', email: 'julia.svensson@rejlers.ae', designation: 'Department Manager', position: 'Department Manager', department: 'Engineering' },
  { id: 'fixture-manager-2', user_id: 7002, employee_number: 'SYN-MGR-002', first_name: 'Sven', last_name: 'Lindberg', email: 'sven.lindberg@rejlers.ae', designation: 'Engineering Manager', position: 'Engineering Manager', department: 'Engineering' },
];
const exitFixtureEmployees = [
  { id: '63749d62-1208-45d4-baae-8fa79b19d132', user_id: '9c4b97d0-b8f2-4058-b3ce-c4c348e78410', employee_number: 'SYN-EXIT-901', first_name: 'Nora', last_name: 'Eriksson', email: 'nora.eriksson@rejlers.ae', position: 'Project Engineer', department: 'Engineering', branch: 'RAD', reporting_manager: 'Lea Holm' },
  { id: '98c74db4-c049-42b1-8188-00e174fb8951', user_id: '35a37874-1c49-44eb-b9a6-191963d04374', employee_number: 'SYN-HR-901', first_name: 'Lea', last_name: 'Holm', email: 'lea.holm@rejlers.ae', position: 'HR Manager', department: 'HR', branch: 'RAD' },
];

const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes,useLocation} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';import OnboardingOffboarding from './src/pages/HR/OnboardingOffboarding.jsx';
const state={auth:{user:window.onboardingUser,isAuthenticated:true},theme:{mode:window.onboardingDark?'dark':'light'},rbac:{currentUser:{user:window.onboardingUser,roles:window.onboardingUser.roles,modules:[]}}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
function Observer(){const location=useLocation();window.onboardingRoute=location.pathname+location.search;return null;}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={[window.onboardingInitialRoute]}><Observer/><Routes><Route element={<Layout/>}><Route path='/hr/onboarding' element={<OnboardingOffboarding/>}/><Route path='*' element={<h1>Source destination</h1>}/></Route></Routes></MemoryRouter></Provider>);
`;
const apiClient = `
async function request(method,url,body,config={}){
 const target=new URL(url.startsWith('/api/v1')?url:'/api/v1'+url,location.origin);for(const [key,value] of Object.entries(config.params||{}))if(value!==undefined&&value!==null)target.searchParams.set(key,value);
 const multipart=body instanceof FormData;const response=await fetch(target,{method,signal:config.signal,headers:multipart?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:multipart?body:JSON.stringify(body)})});
 const data=await response.json();if(!response.ok){const error=new Error(data.detail||'Fixture request failed');error.response={status:response.status,data};throw error;}return {data,status:response.status};
}export default {get:(url,config)=>request('GET',url,undefined,config),post:(url,body,config)=>request('POST',url,body,config),patch:(url,body,config)=>request('PATCH',url,body,config),delete:(url,config)=>request('DELETE',url,undefined,config)};`;
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
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Onboarding"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'onboarding-fixture', setup(builder) { builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'empty' })); for (const [filter, contents] of stubs) builder.onLoad({ filter }, () => ({ contents, loader: 'jsx' })); } }] });
async function filesIn(directory) {
  const found = [];
  for (const item of await readdir(path.join(frontend, directory), { withFileTypes: true })) {
    const file = `${directory}/${item.name}`;
    if (item.isDirectory()) found.push(...await filesIn(file)); else found.push(file);
  }
  return found;
}
const componentFiles = [...await filesIn('src/components/Layout'), ...await filesIn('src/pages/HR'), ...await filesIn('src/components/HR'), 'src/components/DatePicker.jsx', 'src/config/layout.config.js'];
const classSources = await Promise.all(componentFiles.filter(file => /\.[jm]sx?$/.test(file)).map(file => readFile(path.join(frontend, file), 'utf8')));
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css')), { from: undefined });
const cssFiles = componentFiles.filter(file => file.startsWith('src/components/Layout/') && file.endsWith('.css'));
cssFiles.push('src/pages/HR/OnboardingDashboard.css');
if (componentFiles.includes('src/pages/HR/CreateEmployeeWizard.css')) cssFiles.push('src/pages/HR/CreateEmployeeWizard.css');
if (componentFiles.includes('src/pages/HR/FullOnboardingOverview.css')) cssFiles.push('src/pages/HR/FullOnboardingOverview.css');
const styleBundle = await build({ stdin: { contents: cssFiles.map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*', '/fonts/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onboarding browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const expectedSidebarWidth = await sidebarWidth(frontend);
const runtimeErrors = [], unexpectedRequests = [], checks = [], geometries = [], accessibility = [];
const record = text => { checks.push(text); console.log(`PASS: ${text}`); };
let browser;
async function open({ width = 1672, fixture = 'full', dark = false, mode = 'onboarding', permissions = 'default', recordId = null, userId = null, caseScenario = null, managerFixture = 'ready', exitCreation = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Dubai' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date(frozenTime));
  const pageUser = permissions === 'default' ? user : { ...user, is_superuser: false, roles: [{ code: permissions === 'hr' ? 'hr_admin' : 'employee', name: permissions === 'hr' ? 'HR Administrator' : 'Employee' }] };
  await page.addInitScript(({ user, dark, mode, recordId, userId }) => { window.onboardingUser = user; window.onboardingDark = dark; window.onboardingInitialRoute = mode === 'offboarding' ? `/hr/onboarding?tab=offboarding${recordId ? `&record_id=${recordId}` : ''}` : mode === 'create' ? '/hr/onboarding?tab=create' : recordId ? `/hr/onboarding?tab=onboarding&record_id=${recordId}` : userId ? `/hr/onboarding?tab=onboarding&user_id=${userId}` : '/hr/onboarding'; localStorage.setItem('radai_access_token', 'isolated-onboarding-fixture'); document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.toggle('dark', dark)); }, { user: pageUser, dark, mode, recordId, userId });
  page.on('pageerror', error => runtimeErrors.push(error.message));
  const control = { fixture, requests: [], allowCreate: mode === 'create', createResult: 'success', createdPayloads: [], identityResult: 'available', managerResult: managerFixture, allowExitCreate: exitCreation, createdExitPayloads: [] };
  if (caseScenario) {
    control.caseFixture = createOnboardingCaseFixture(rows[0], caseScenario);
    control.allowCaseWrites = ['progress', 'ready', 'edit'].includes(caseScenario);
    control.caseReadResult = caseScenario === 'error' ? 'error' : 'ready';
    control.caseWriteResult = 'ready';
  }
  const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  const list = data => ({ count: data.length, next: null, previous: null, results: data });
  const detailPermissions = (row, items, initialStage) => {
    if (permissions === 'default') return { ...row, checklist_items: items };
    const stages = initialStage === 'pre_hire' ? ['pre_hire', 'it_provisioning', 'first_day', 'final_validation'] : [initialStage];
    return {
      ...row, checklist_items: items.filter(item => !stages.includes(item.stage)),
      checklist_stage_permissions: Object.fromEntries(stages.map(stage => [stage, { owner_label: 'HR', can_start: permissions === 'hr', can_manage: permissions === 'hr', disabled_reason: permissions === 'hr' ? '' : 'Your HR workflow access does not allow changes to this stage.' }])),
    };
  };
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/v1/')) {
      const endpoint = url.pathname.replace(/^\/api\/v1/, ''), method = request.method();
      control.requests.push({ method, endpoint });
      const caseRoute = endpoint.match(/^\/onboarding\/onboarding\/(\d+)\/(start-checklist-stage|mark_completed)?\/?$/);
      const caseTaskRoute = endpoint.match(/^\/onboarding\/checklist\/(\d+)\/$/);
      if (control.caseFixture && method !== 'GET' && control.allowCaseWrites && (caseRoute || caseTaskRoute)) {
        if (control.caseWriteResult === 'error') return json(route, { detail: 'Synthetic onboarding update failed. Please try again.' }, 400);
        const payload = request.postDataJSON();
        if (caseTaskRoute && method === 'PATCH') return json(route, control.caseFixture.updateTask(caseTaskRoute[1], payload));
        if (caseRoute && Number(caseRoute[1]) === control.caseFixture.record.id) {
          if (method === 'PATCH' && !caseRoute[2]) {
            Object.assign(control.caseFixture.record, payload);
            if ('assigned_to' in payload) control.caseFixture.record.assigned_to_name = fixtureEmployees.find(employee => String(employee.user_id) === String(payload.assigned_to))?.first_name === 'Sven' ? 'Sven Lindberg' : payload.assigned_to ? 'Julia Svensson' : null;
            return json(route, control.caseFixture.snapshot());
          }
          if (method === 'POST' && caseRoute[2] === 'start-checklist-stage') {
            const permission = control.caseFixture.snapshot().checklist_stage_permissions[payload.stage];
            if (!permission?.can_start) return json(route, { detail: permission?.disabled_reason || 'Stage cannot be started.' }, 403);
            control.caseFixture.addStage(payload.stage);
            return json(route, control.caseFixture.snapshot());
          }
          if (method === 'POST' && caseRoute[2] === 'mark_completed') {
            const current = control.caseFixture.snapshot();
            if (!Object.keys(current.checklist_stage_permissions).every(stage => control.caseFixture.stageComplete(stage))) return json(route, { detail: 'Every onboarding checklist stage must be started and completed before final validation.' }, 400);
            control.caseFixture.record.status = 'completed'; control.caseFixture.record.actual_completion_date = '2025-04-26';
            return json(route, control.caseFixture.snapshot());
          }
        }
      }
      if (method === 'POST' && endpoint === '/onboarding/onboarding/create_employee/' && control.allowCreate) {
        const contentType = request.headers()['content-type'] || '';
        const submitted = contentType.includes('multipart/form-data') ? Object.fromEntries(await new Response(request.postDataBuffer(), { headers: { 'content-type': contentType } }).formData()) : request.postDataJSON();
        control.createdPayloads.push(Object.fromEntries(Object.entries(submitted).map(([key, value]) => [key, typeof value === 'string' ? value : { name: value.name, type: value.type, size: value.size }])));
        if (control.createDelayMs) await new Promise(resolve => setTimeout(resolve, control.createDelayMs));
        if (control.createResult === 'error') return json(route, { error: 'Synthetic employee creation failed. Please try again.' }, 400);
        control.createdEmployee = { ...rows[0], id: 901, user: 9101, employee_name: `${submitted.first_name} ${submitted.surname}`, employee_email: submitted.email, employee_id: 'SYN-901', department: submitted.division, position: submitted.job_title_uae, joining_date: submitted.joining_date, branch: submitted.branch || 'RAD', initiated_date: frozenTime, created_at: frozenTime, status: 'initiated', checklist_items: [], checklist_count: 0, checklist_completed_count: 0, progress_percentage: 0 };
        return json(route, { success: true, message: 'Employee created successfully', user_id: 9101, employee_master_id: 'fixture-created-employee', onboarding_id: 901, employee_number: 'SYN-901', employee_code: 'SYN-901', employment_id: 'SYN-901', email: submitted.email, reporting_manager: 'Julia Svensson', branch: submitted.branch || 'RAD' }, 201);
      }
      if (method === 'POST' && endpoint === '/onboarding/offboarding/' && control.allowExitCreate) {
        const submitted = request.postDataJSON();
        control.createdExitPayloads.push(submitted);
        control.createdExit = { ...exits[0], ...submitted, id: 902, canonical_employee: exitFixtureEmployees[0].id, initiated_date: frozenTime, created_at: frozenTime, status: 'initiated', progress_percentage: 0, checklist_items: [], checklist_count: 0, checklist_completed_count: 0, project_manager_approval_status: 'not_required' };
        return json(route, control.createdExit, 201);
      }
      if (method !== 'GET') { unexpectedRequests.push(`${method} ${endpoint}`); return json(route, { detail: 'This fixture refuses mutations.' }, 409); }
      if (endpoint === '/onboarding/onboarding/employee_identity_preview/') {
        if (control.identityResult === 'error') return json(route, { detail: 'Synthetic identity preview unavailable.' }, 503);
        const namePart = key => (url.searchParams.get(key) || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const email = url.searchParams.get('email') || `${namePart('first_name')}.${namePart('surname')}@rejlers.ae`;
        const collision = control.identityResult === 'duplicate' || fixtureEmployees.some(employee => employee.email === email);
        const duplicate = collision || control.identityResult === 'name-match';
        return json(route, { email, available: !collision, duplicate_count: duplicate ? 1 : 0, errors: collision ? { email: 'This company email is already assigned.' } : {}, duplicates: duplicate ? [{ employee_name: `${url.searchParams.get('first_name')} ${url.searchParams.get('surname')}`, email, employee_number: 'SYN-EXISTING', match_fields: [collision ? 'email' : 'name'] }] : [], ...(collision ? { suggested_email: email.replace('@', '2@') } : {}) });
      }
      if (endpoint === '/rbac/users/me/') return json(route, { user: pageUser, roles: pageUser.roles, modules: [] });
      if (/activity|notifications|reporting-hierarchy|direct-reports/.test(endpoint)) return json(route, { count: 0, results: [], activities: [], hierarchy: [], direct_reports: [] });
      if (endpoint === '/onboarding/onboarding/' || endpoint === '/onboarding/offboarding/' || endpoint === '/onboarding/checklist/') {
        if (control.fixture === 'error') return json(route, { detail: 'Synthetic lifecycle source unavailable.' }, 503);
        const exitRows = [...exits, ...(control.fixture === 'completed-future' ? [completedExit] : []), ...(control.createdExit ? [control.createdExit] : [])];
        const onboardingRows = (control.caseFixture ? rows.map(row => row.id === control.caseFixture.record.id ? control.caseFixture.snapshot() : row) : rows).filter(row => !url.searchParams.get('user_id') || String(row.user) === url.searchParams.get('user_id'));
        const onboardingTasks = control.caseFixture ? [...checklist.filter(task => task.onboarding_record !== control.caseFixture.record.id), ...control.caseFixture.snapshot().checklist_items] : checklist;
        const lifecycleChecklist = [...onboardingTasks, ...exitChecklist, ...(control.fixture === 'completed-future' ? completedExitChecklist : [])];
        return json(route, list(control.fixture === 'empty' ? [] : endpoint.endsWith('/checklist/') ? lifecycleChecklist : endpoint.endsWith('/offboarding/') ? exitRows : control.createdEmployee ? [...onboardingRows, control.createdEmployee] : onboardingRows));
      }
      const detail = endpoint.match(/^\/onboarding\/onboarding\/(\d+)\/$/);
      if (detail) {
        if (control.caseFixture && String(control.caseFixture.record.id) === detail[1]) return control.caseReadResult === 'error' ? json(route, { detail: 'Synthetic onboarding detail unavailable.' }, 503) : json(route, control.caseFixture.snapshot());
        const row = [...rows, ...(control.createdEmployee ? [control.createdEmployee] : [])].find(item => String(item.id) === detail[1]); return json(route, detailPermissions(row, checklist.filter(item => item.onboarding_record === row.id), 'pre_hire'));
      }
      const exitDetail = endpoint.match(/^\/onboarding\/offboarding\/(\d+)\/$/);
      if (exitDetail) { const row = [...exits, ...(control.createdExit ? [control.createdExit] : [])].find(item => String(item.id) === exitDetail[1]); return json(route, detailPermissions(row, exitChecklist.filter(item => item.offboarding_record === row.id), 'exit_initiation')); }
      if (endpoint === '/onboarding/offboarding/active-employees/') return json(route, control.createdExit ? [{ ...control.createdExit, user_id: control.createdExit.user }] : []);
      if (endpoint === '/onboarding/onboarding/employee_manager_options/') {
        if (control.managerResult === 'not-found') return json(route, { detail: 'Manager endpoint unavailable on this deployment.' }, 404);
        if (control.managerResult === 'forbidden') return json(route, { detail: 'Manager access is not permitted.' }, 403);
        return json(route, list(fixtureEmployees));
      }
      if (endpoint === '/onboarding/onboarding/owner_options/') return json(route, list(fixtureEmployees));
      if (endpoint === '/users/employees/active_employees/') return json(route, list(control.allowExitCreate ? url.searchParams.has('role_filter') ? [exitFixtureEmployees[1]] : exitFixtureEmployees : fixtureEmployees));
      if (endpoint === '/rbac/users/organization-catalog/') return json(route, { departments: [], roles: [] });
      unexpectedRequests.push(`${method} ${endpoint}`); return json(route, { detail: 'Unmapped isolated fixture request.' }, 404);
    }
    if (request.isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && ['/assets/', '/logo/', '/fonts/'].some(prefix => url.pathname.startsWith(prefix))) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) try { return route.fulfill({ contentType: url.pathname.endsWith('.woff2') ? 'font/woff2' : url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); } catch { /* Unknown assets are reported below. */ }
    }
    unexpectedRequests.push(request.url()); return route.abort();
  });
  await page.goto(origin);
  const directCase = mode === 'onboarding' && (recordId || userId);
  if (directCase) await page.locator('.onboarding-case').waitFor();
  else await page.getByRole('heading', { name: mode === 'create' ? 'Create new employee' : 'Employee Lifecycle', exact: true }).waitFor();
  if (fixture === 'full' && mode !== 'create' && !directCase) await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: new RegExp(`^${lifecycleFixtures[mode].count}$`) }).waitFor();
  return { page, control, close: () => context.close() };
}
async function capture(page, name) {
  await page.locator('main.main-content').evaluate(main => main.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), animations: 'disabled' });
}
async function geometry(page, width, mode = 'onboarding') {
  const result = await page.locator(mode === 'create' ? '.employee-create-workspace' : mode === 'case' ? '.onboarding-case' : '.employee-lifecycle').evaluate(root => {
    const main = document.querySelector('main.main-content');
    return { documentFits: document.documentElement.scrollWidth <= innerWidth, documentWidth: document.documentElement.scrollWidth, mainFits: main.scrollWidth <= main.clientWidth + 1, mainWidth: { scroll: main.scrollWidth, client: main.clientWidth }, rootWidth: { scroll: root.scrollWidth, client: root.clientWidth }, contentX: document.getElementById('application-content').getBoundingClientRect().x, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width,
      escaped: [...document.querySelectorAll('body *')].filter(node => !node.closest('.onboarding-table-scroll, .onboarding-case-table-scroll') && node.getBoundingClientRect().right > innerWidth + 1).slice(0, 20).map(node => ({ tag: node.tagName, className: node.getAttribute('class'), right: node.getBoundingClientRect().right, width: node.getBoundingClientRect().width })),
    };
  });
  geometries.push({ width, mode, ...result });
  assert.ok(result.documentFits && result.mainFits && result.rootWidth.scroll <= result.rootWidth.client + 1, `${width}: no page overflow`);
  assert.equal(Math.round(result.contentX), width < 1024 ? 0 : expectedSidebarWidth, 'Existing sidebar layout is preserved');
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
}
async function visualChecks() {
  for (const mode of ['onboarding', 'offboarding']) {
  const expected = lifecycleFixtures[mode];
  for (const width of selectedViewport ? [selectedViewport] : [1672, 1280, 390]) {
    const state = await open({ width, mode });
    try {
      assert.equal(await state.page.locator('.onboarding-kpi').count(), 4);
      for (const label of expected.metricLabels) await state.page.locator('.onboarding-kpi-label').filter({ hasText: new RegExp(`^${label}$`) }).waitFor();
      for (const heading of [expected.attention, expected.upcoming, expected.readiness, 'Owner workload']) await state.page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await capture(state.page, `${mode}-${width}`);
      await geometry(state.page, width, mode);
      const result = await new AxeBuilder({ page: state.page }).include('.employee-lifecycle').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      accessibility.push({ width, mode, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
      assert.deepEqual(result.violations.map(item => item.id), [], `${width}: no accessibility violations`);
      if (width === 390) {
        await state.page.locator('.onboarding-panel--attention').scrollIntoViewIfNeeded();
        await state.page.screenshot({ path: path.join(artifacts, `${mode}-390-actions.png`), animations: 'disabled' });
        await state.page.locator('.onboarding-panel--readiness').scrollIntoViewIfNeeded();
        await state.page.screenshot({ path: path.join(artifacts, `${mode}-390-readiness.png`), animations: 'disabled' });
      }
      record(`${mode} ${width}px dashboard: four cards, four panels, sidebar preserved, no overflow or accessibility violations`);
    } finally { await state.close(); }
  }
  if (!selectedViewport) {
    const state = await open({ dark: true, mode });
    try {
      await capture(state.page, `${mode}-1672-dark`);
      await geometry(state.page, 1672, mode);
      const result = await new AxeBuilder({ page: state.page }).include('.employee-lifecycle').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      accessibility.push({ width: 1672, mode, dark: true, violations: result.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
      assert.deepEqual(result.violations.map(item => item.id), [], 'Dark desktop: no accessibility violations');
      record(`${mode} dark desktop has no overflow or accessibility violations`);
    } finally { await state.close(); }
  }
  }
}
async function workflowChecks() {
  const state = await open(), { page, control } = state;
  try {
    await page.locator('.onboarding-kpi[data-metric="active"]').click();
    await page.getByRole('dialog', { name: 'Active onboardings (18)', exact: true }).waitFor();
    assert.equal(await page.locator('.onboarding-dialog-record').count(), 18);
    await capture(page, 'onboarding-active-records');
    await page.getByRole('button', { name: 'Close active onboardings', exact: true }).click();
    assert.ok(control.requests.every(request => request.method === 'GET'), 'Active records dialog never mutates workflows');
    record('Active card opens a read-only list of the 18 real fixture records');
    const department = page.getByLabel('Department', { exact: true });
    await department.selectOption({ label: 'Design' });
    await page.locator('.onboarding-kpi[data-metric="active"]').filter({ hasText: '1' }).waitFor();
    assert.equal(await page.locator('.onboarding-kpi[data-metric="active"]').innerText().then(text => /\b18\b/.test(text)), false);
    await department.selectOption({ label: 'All departments' });
    await page.locator('.onboarding-kpi[data-metric="active"]').filter({ hasText: '18' }).waitFor();
    const entity = page.getByLabel('Entity', { exact: true });
    const entityOptions = await entity.locator('option').allTextContents();
    assert.ok(entityOptions.length > 2, 'Both actual entities are available');
    await entity.selectOption({ label: entityOptions[1] });
    assert.ok(!(await page.locator('.onboarding-kpi[data-metric="active"]').innerText()).match(/\b18\b/));
    await entity.selectOption({ label: 'All entities' });
    assert.equal(await page.getByLabel('Date range', { exact: true }).locator('option:checked').innerText(), 'Next 30 days');
    await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Next 7 days' });
    await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^18$/ }).waitFor();
    await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Next 30 days' });
    record('Entity and department filter active records; upcoming date ranges preserve active totals and next 30 days is the default');
    for (const heading of ['Onboarding actions requiring attention', 'Upcoming joiners']) {
      const panel = page.locator('.onboarding-panel').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
      const before = await panel.locator('tbody tr').count();
      const viewAll = panel.getByRole('button', { name: /^View all/ });
      await viewAll.click();
      assert.ok(await panel.locator('tbody tr').count() > before, `${heading}: View all reveals additional records`);
      await panel.getByRole('button', { name: /^View fewer/ }).click();
      assert.equal(await panel.locator('tbody tr').count(), before, `${heading}: View less restores the preview`);
    }
    record('Both View all controls expand and collapse their own panels');
    const attention = page.locator('.onboarding-panel').filter({ has: page.getByRole('heading', { name: 'Onboarding actions requiring attention', exact: true }) });
    await attention.locator('.onboarding-row-action').first().click();
    await page.locator('.onboarding-case').waitFor();
    await page.getByRole('heading', { name: 'IT Provisioning', exact: true, level: 2 }).waitFor();
    assert.ok(control.requests.some(request => /^\/onboarding\/onboarding\/\d+\/$/.test(request.endpoint)), 'Action loads the actual onboarding detail endpoint');
    await capture(page, 'onboarding-detail');
    await page.getByRole('button', { name: 'Back to onboarding', exact: true }).click();
    await attention.getByRole('button', { name: /^View all/ }).click();
    await attention.getByRole('button', { name: 'Review schedule for Marcus Karlsson', exact: true }).click();
    await page.getByRole('heading', { name: 'First Day Orientation', exact: true, level: 2 }).waitFor();
    await page.getByRole('button', { name: 'Back to onboarding', exact: true }).click();
    await page.getByRole('button', { name: 'Start onboarding', exact: true }).click();
    await page.getByRole('heading', { name: 'Create new employee', exact: true }).waitFor();
    await capture(page, 'onboarding-create');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('heading', { name: 'Upcoming joiners', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Offboarding', exact: true }).click();
    await page.getByRole('heading', { name: 'Upcoming departures', exact: true }).waitFor();
    await capture(page, 'offboarding-navigation');
    record('Task action opens existing details; Start onboarding and Offboarding retain existing workflows');
    assert.ok(control.requests.every(request => request.method === 'GET'), 'Browsing never mutates employee records');
  } finally { await state.close(); }
  for (const fixture of ['empty', 'error']) {
    const state = await open({ fixture });
    try {
      if (fixture === 'empty') {
        await state.page.locator('.onboarding-kpi[data-metric="active"]').filter({ hasText: '0' }).waitFor();
        await capture(state.page, 'onboarding-empty');
      } else {
        await state.page.getByRole('button', { name: /try again/i }).waitFor();
        await capture(state.page, 'onboarding-error');
        state.control.fixture = 'full';
        await state.page.getByRole('button', { name: /try again/i }).click();
        await state.page.locator('.onboarding-kpi[data-metric="active"]').filter({ hasText: '18' }).waitFor();
      }
      record(`${fixture} state${fixture === 'error' ? ' and successful retry' : ''}`);
    } finally { await state.close(); }
  }
}
async function offboardingWorkflowChecks() {
  const state = await open({ mode: 'offboarding' }), { page, control } = state;
  try {
    assert.equal(await page.evaluate(() => window.onboardingRoute), '/hr/onboarding?tab=offboarding');
    await page.locator('.onboarding-kpi[data-metric="active"]').click();
    const activeDialog = page.getByRole('dialog', { name: 'Active exits (8)', exact: true });
    await activeDialog.waitFor();
    assert.equal(await activeDialog.locator('.onboarding-dialog-record').count(), 8);
    await capture(page, 'offboarding-active-records');
    await activeDialog.getByRole('button', { name: 'Close active exits', exact: true }).click();
    record('Offboarding direct URL and Active exits card show the eight fixture workflows');

    await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Design' });
    await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^1$/ }).waitFor();
    await page.getByLabel('Department', { exact: true }).selectOption({ label: 'All departments' });
    await page.getByLabel('Entity', { exact: true }).selectOption('RIN');
    await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^2$/ }).waitFor();
    await page.getByLabel('Entity', { exact: true }).selectOption({ label: 'All entities' });
    assert.equal(await page.getByLabel('Date range', { exact: true }).locator('option:checked').innerText(), 'Next 30 days');
    await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Next 7 days' });
    await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^8$/ }).waitFor();
    await page.locator('.onboarding-kpi[data-metric="joining"] strong').filter({ hasText: /^4$/ }).waitFor();
    await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Next 30 days' });
    record('Offboarding entity and department filter active exits; upcoming date ranges preserve active totals');

    const attention = page.locator('.onboarding-panel--attention');
    await page.locator('.onboarding-kpi[data-metric="overdue"]').click();
    assert.equal(await attention.locator('tbody tr').count(), 8);
    assert.equal(await attention.locator('.onboarding-status--overdue').count(), 8);
    await attention.getByRole('button', { name: /Showing overdue actions/ }).click();
    await page.locator('.onboarding-kpi[data-metric="joining"]').click();
    assert.equal(await page.getByLabel('Date range', { exact: true }).inputValue(), '7');
    await page.locator('.onboarding-kpi[data-metric="ready"]').click();
    await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Next 30 days' });
    assert.ok(control.requests.every(request => request.method === 'GET'), 'Offboarding metrics are read-only');
    record('Offboarding overdue, leaving soon, and clearance cards only filter or reveal real records');

    for (const heading of ['Exit actions requiring attention', 'Upcoming departures']) {
      const panel = page.locator('.onboarding-panel').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
      const before = await panel.locator('tbody tr').count();
      await panel.getByRole('button', { name: /^View all/ }).click();
      assert.ok(await panel.locator('tbody tr').count() > before, `${heading}: View all reveals records`);
      await panel.getByRole('button', { name: /^View fewer/ }).click();
      assert.equal(await panel.locator('tbody tr').count(), before);
    }
    record('Offboarding View all controls expand and collapse actions and departures');

    await attention.locator('.onboarding-row-action').first().click();
    await page.getByRole('heading', { name: 'Offboarding Checklist', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Access Revocation', exact: true, level: 5 }).waitFor();
    assert.ok(control.requests.some(request => /^\/onboarding\/offboarding\/\d+\/$/.test(request.endpoint)), 'Exit task loads its offboarding detail record');
    await capture(page, 'offboarding-detail');
    await page.getByTitle('Close offboarding checklist', { exact: true }).click();

    await page.locator('.onboarding-panel--upcoming .onboarding-employee').first().click();
    await page.getByRole('heading', { name: 'Offboarding Checklist', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Exit Initiation', exact: true, level: 5 }).waitFor();
    await page.getByTitle('Close offboarding checklist', { exact: true }).click();
    await page.getByRole('button', { name: 'Start offboarding', exact: true }).click();
    await page.getByRole('heading', { name: 'Initiate Exit Process', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
    await capture(page, 'offboarding-initiate');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('heading', { name: 'Upcoming departures', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Onboarding', exact: true }).click();
    await page.getByRole('heading', { name: 'Upcoming joiners', exact: true }).waitFor();
    assert.ok(control.requests.every(request => request.method === 'GET'), 'Exit navigation and modal opening never mutate workflows');
    record('Offboarding tasks open their stage; employee details, existing initiation modal, and return to onboarding work without writes');
  } finally { await state.close(); }

  for (const fixture of ['empty', 'error']) {
    const state = await open({ fixture, mode: 'offboarding' });
    try {
      if (fixture === 'empty') {
        await state.page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^0$/ }).waitFor();
        assert.ok(await state.page.locator('.onboarding-empty').count() >= 2);
        await capture(state.page, 'offboarding-empty');
      } else {
        await state.page.getByRole('button', { name: /try again/i }).waitFor();
        await capture(state.page, 'offboarding-error');
        state.control.fixture = 'full';
        await state.page.getByRole('button', { name: /try again/i }).click();
        await state.page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^8$/ }).waitFor();
      }
      record(`Offboarding ${fixture} state${fixture === 'error' ? ' retries successfully' : ' preserves the dashboard'}`);
    } finally { await state.close(); }
  }
}
async function exitCreationVisibilityChecks() {
  for (const lastWorkingDay of ['2025-04-30', '2025-07-12']) {
    const state = await open({ mode: 'offboarding', exitCreation: true }), { page, control } = state;
    try {
      await page.getByRole('button', { name: 'Start offboarding', exact: true }).click();
      await page.getByRole('heading', { name: 'Initiate Exit Process', exact: true }).waitFor();
      await page.getByPlaceholder('Search by name or email...', { exact: true }).fill('Nora');
      await page.getByRole('button', { name: /Nora Eriksson.*nora\.eriksson/ }).click();
      await page.getByText('Employee ID: SYN-EXIT-901', { exact: true }).waitFor();
      assert.equal(await page.getByPlaceholder('e.g., Senior Engineer', { exact: true }).inputValue(), 'Project Engineer');
      assert.equal(await page.getByPlaceholder('e.g., Engineering', { exact: true }).inputValue(), 'Engineering');
      const form = page.locator('form');
      await form.locator('select').filter({ has: page.locator('option[value="resignation"]') }).selectOption('resignation');
      await form.locator('input[type="date"]').fill(lastWorkingDay);
      const hrChoices = form.locator('select').filter({ has: page.locator(`option[value="${exitFixtureEmployees[1].user_id}"]`) });
      assert.equal(await hrChoices.count(), 2, 'Both HR coordinator and approver choices retain UUID identities');
      for (const select of await hrChoices.all()) await select.selectOption(exitFixtureEmployees[1].user_id);
      await page.getByRole('button', { name: 'Initiate Offboarding', exact: true }).click();
      await page.getByRole('heading', { name: 'Initiate Exit Process', exact: true }).waitFor({ state: 'detached' });
      await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^9$/ }).waitFor();
      assert.equal(control.createdExitPayloads.length, 1);
      assert.equal(control.createdExitPayloads[0].user, exitFixtureEmployees[0].user_id);
      assert.equal(control.createdExitPayloads[0].employee_id, 'SYN-EXIT-901');
      assert.equal(control.createdExitPayloads[0].hr_coordinator, exitFixtureEmployees[1].user_id);
      assert.equal(control.createdExitPayloads[0].hr_approver, exitFixtureEmployees[1].user_id);
      assert.equal(control.createdExitPayloads[0].last_working_day, lastWorkingDay);
      await page.locator('.onboarding-kpi[data-metric="active"]').click();
      const dialog = page.getByRole('dialog', { name: 'Active exits (9)', exact: true });
      await dialog.getByRole('button', { name: 'View Nora Eriksson offboarding details', exact: true }).waitFor();
      await dialog.locator('.onboarding-dialog-record').first().getByRole('button', { name: 'View Nora Eriksson offboarding details', exact: true }).waitFor();
      await dialog.getByLabel('Search active employees', { exact: true }).fill('SYN-EXIT-901');
      assert.equal(await dialog.locator('.onboarding-dialog-record').count(), 1);
      await dialog.getByRole('button', { name: 'Close active exits', exact: true }).click();
      const upcoming = page.locator('.onboarding-panel--upcoming');
      if (lastWorkingDay > '2025-05-26') {
        await upcoming.getByRole('button', { name: 'Show all upcoming', exact: true }).click();
        assert.equal(await page.getByLabel('Date range', { exact: true }).inputValue(), 'all');
      } else {
        await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'All dates' });
        await upcoming.getByRole('button', { name: /^View all/ }).click();
      }
      await upcoming.getByRole('button', { name: 'View Nora Eriksson offboarding details', exact: true }).click();
      await page.getByRole('heading', { name: 'Offboarding Checklist', exact: true }).waitFor();
      assert.ok(control.requests.some(request => request.endpoint === '/onboarding/offboarding/902/'));
      await page.getByTitle('Close offboarding checklist', { exact: true }).click();
      await page.getByLabel('Date range', { exact: true }).selectOption({ label: 'Next 7 days' });
      await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^9$/ }).waitFor();
      assert.equal(control.requests.filter(request => request.method !== 'GET').length, 1, 'Returning to and filtering a newly created exit does not write again');
      await capture(page, `offboarding-created-${lastWorkingDay}`);
      record(`UUID employee and HR identities create one exit dated ${lastWorkingDay}; refreshed Active exits and all-date Upcoming departures include the new record`);
    } finally { await state.close(); }
  }
}

async function dashboardRefreshChecks() {
  for (const mode of ['onboarding', 'offboarding']) {
    const state = await open({ mode }), { page, control } = state;
    try {
      const config = lifecycleFixtures[mode], key = mode === 'offboarding' ? 'createdExit' : 'createdEmployee';
      control[key] = { ...(mode === 'offboarding' ? exits[0] : rows[0]), id: 903, user: '928d5a70-15a2-4cc4-8726-c6d004175be9', employee_name: 'New External Employee', employee_email: 'new.external@example.test', employee_id: 'SYN-EXTERNAL-903', joining_date: '2025-07-12', last_working_day: '2025-07-12', status: 'initiated', created_at: frozenTime, initiated_date: frozenTime, checklist_items: [], checklist_count: 0, checklist_completed_count: 0, progress_percentage: 0 };
      await page.getByRole('button', { name: `Refresh ${mode} dashboard`, exact: true }).click();
      await page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: new RegExp(`^${config.count + 1}$`) }).waitFor();
      const upcoming = page.locator('.onboarding-panel--upcoming');
      await upcoming.getByRole('button', { name: 'Show all upcoming', exact: true }).click();
      await upcoming.getByRole('button', { name: `View New External Employee ${mode} details`, exact: true }).waitFor();
      control[key] = { ...control[key], employee_name: 'Updated External Employee', joining_date: '2025-04-20', last_working_day: '2025-04-20' };
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await upcoming.getByRole('button', { name: 'View active employees', exact: true }).waitFor();
      assert.equal(await upcoming.getByRole('button', { name: `View New External Employee ${mode} details`, exact: true }).count(), 0);
      await upcoming.getByRole('button', { name: 'View active employees', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Search active employees', { exact: true }).fill('Updated External');
      await dialog.getByRole('button', { name: `View Updated External Employee ${mode} details`, exact: true }).waitFor();
      assert.equal(await dialog.locator('.onboarding-dialog-record').count(), 1);
      assert.ok(control.requests.every(request => request.method === 'GET'), 'Dashboard refreshes only read API data');
      record(`${mode} manual refresh discovers a new future case; returning focus refreshes its updated past date and searchable Active record without writes`);
    } finally { await state.close(); }
  }
}

async function workflowPermissionChecks() {
  for (const mode of ['onboarding', 'offboarding']) {
    for (const permissions of ['hr', 'viewer']) {
      const state = await open({ mode, permissions });
      try {
        await state.page.locator('.onboarding-panel--upcoming .onboarding-employee').first().click();
        await state.page.getByRole('heading', { name: mode === 'onboarding' ? 'Pre-Hire Initiation' : 'Exit Initiation', exact: true, level: mode === 'onboarding' ? 2 : 5 }).waitFor();
        if (permissions === 'hr') {
          const start = state.page.getByRole('button', { name: 'Start Checklist', exact: true });
          await start.waitFor();
          assert.equal(await start.isEnabled(), true, `${mode}: API permission enables HR stage initiation`);
        } else {
          await state.page.getByText('Your HR workflow access does not allow changes to this stage.', { exact: true }).first().waitFor();
          assert.equal(await state.page.getByRole('button', { name: 'View Only', exact: true }).isDisabled(), true);
          assert.equal(await state.page.getByRole('button', { name: 'Start Checklist', exact: true }).count(), 0);
        }
        if (mode === 'onboarding') {
          for (const [shortLabel, heading] of [['IT Provisioning', 'IT Provisioning'], ['First Day', 'First Day Orientation'], ['Final Validation', 'Final Checklist Validation']]) {
            await state.page.getByRole('button', { name: new RegExp(`^${shortLabel}`) }).click();
            await state.page.getByRole('heading', { name: heading, exact: true, level: 2 }).waitFor();
            if (permissions === 'hr') assert.equal(await state.page.getByRole('button', { name: 'Start Checklist', exact: true }).isEnabled(), true, `HR may start ${heading}`);
            else assert.equal(await state.page.getByRole('button', { name: 'View Only', exact: true }).isDisabled(), true, `Viewer cannot start ${heading}`);
          }
        }
        assert.ok(state.control.requests.every(request => request.method === 'GET'), 'Permission verification does not modify employee data');
        record(`${mode} ${permissions === 'hr' ? 'HR permission enables Start Checklist' : 'denied permission displays the API reason and prevents editing'}${mode === 'onboarding' ? ' across all four stages' : ''}`);
      } finally { await state.close(); }
    }
  }
  const state = await open({ mode: 'offboarding', recordId: 201 });
  try {
    await state.page.getByRole('heading', { name: 'Offboarding Checklist', exact: true }).waitFor();
    await state.page.getByRole('heading', { name: 'Exit Initiation', exact: true, level: 5 }).waitFor();
    assert.equal(await state.page.evaluate(() => window.onboardingRoute), '/hr/onboarding?tab=offboarding&record_id=201');
    assert.ok(state.control.requests.some(request => request.endpoint === '/onboarding/offboarding/201/'));
    assert.ok(state.control.requests.every(request => request.method === 'GET'));
    record('Existing offboarding record links open the requested checklist without writes');
  } finally { await state.close(); }
}
async function completedExitChecks() {
  const state = await open({ mode: 'offboarding', fixture: 'completed-future' });
  try {
    await state.page.locator('.onboarding-kpi[data-metric="active"] strong').filter({ hasText: /^8$/ }).waitFor();
    await state.page.locator('.onboarding-kpi[data-metric="ready"] strong').filter({ hasText: /^33%$/ }).waitFor();
    await state.page.locator('.onboarding-kpi[data-metric="joining"] strong').filter({ hasText: /^5$/ }).waitFor();
    const completedDeparture = state.page.locator('.onboarding-panel--upcoming tbody tr').filter({ hasText: 'Clara Andersson' });
    await completedDeparture.waitFor();
    assert.ok((await completedDeparture.innerText()).includes('Clearance complete'));
    assert.equal(await state.page.locator('.onboarding-panel--attention tbody tr').filter({ hasText: 'Clara Andersson' }).count(), 0);
    assert.ok(state.control.requests.every(request => request.method === 'GET'));
    record('Completed future exits remain in departures and clearance totals without increasing active exits or requiring actions');
  } finally { await state.close(); }
}
try {
  browser = await launchBrowser();
  if (!workflowsOnly && !creationVisibilityOnly) {
    if (!createOnly && !caseOnly) await visualChecks();
    if (!caseOnly) await checkCreateEmployeeVisuals({ open, capture, geometry, record, accessibility, selectedViewport });
    if (!createOnly) await checkOnboardingCaseVisuals({ open, capture, geometry, record, accessibility, selectedViewport });
  }
  if (!visualsOnly) {
    if (!createOnly && !caseOnly && !creationVisibilityOnly) { await workflowChecks(); await offboardingWorkflowChecks(); await workflowPermissionChecks(); await completedExitChecks(); }
    if (!createOnly && !caseOnly) { await exitCreationVisibilityChecks(); await dashboardRefreshChecks(); }
    if (!caseOnly && !exitCreationOnly) await checkCreateEmployeeWorkflows({ open, capture, record });
    if (!createOnly && !creationVisibilityOnly) await checkOnboardingCaseWorkflows({ open, capture, record });
  }
  assert.deepEqual(runtimeErrors, [], 'No browser runtime errors');
  assert.deepEqual(unexpectedRequests, [], 'All traffic uses isolated fixture endpoints');
  assert.deepEqual(await snapshotSources(frontend, protectedFiles), sourceBefore, 'Shared sidebar and layout sources are unchanged');
  record('No runtime errors, unexpected requests, or shared shell source changes');
} finally {
  await writeFile(path.join(artifacts, 'browser-checks.json'), JSON.stringify({ checks, geometries, accessibility, runtimeErrors, unexpectedRequests }, null, 2));
  await browser?.close();
}
