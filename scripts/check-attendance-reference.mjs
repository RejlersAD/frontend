import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import tailwindConfig from '../tailwind.config.js';
import { checkArtifacts, inlineLocalCssImports, launchBrowser, sidebarWidth } from './ui-check-support.mjs';

// Actual attendance module, shared shell and correction-list service. Synthetic
// API/service responses stay in this fixture; unexpected network is blocked.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = checkArtifacts(frontend, 'attendance-reference-20260930');
const origin = 'http://attendance-reference-check.test';
await mkdir(artifacts, { recursive: true });

const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import Layout from './src/components/Layout/Layout.jsx';import Payroll from './src/pages/HR/Payroll.jsx';
const user={id:901,first_name:'Morgan',last_name:'Reviewer',email:'fixture@example.test',is_staff:window.attendanceEditor,is_superuser:window.attendanceEditor,roles:window.attendanceEditor?[{code:'hr_manager',name:'HR Manager'}]:[]};
window.attendanceUser=user;
const state={auth:{user,isAuthenticated:true},theme:{mode:'light'},rbac:{currentUser:{user,roles:user.roles,modules:[]}}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/hr/'+window.attendanceModule]}><Routes><Route element={<Layout/>}><Route path='/hr/attendance' element={<Payroll module='attendance'/>}/><Route path='/hr/leave' element={<Payroll module='leave'/>}/><Route path='/hr/payroll' element={<Payroll/>}/></Route></Routes></MemoryRouter></Provider>);
`;
const fixtureService = `
import actualPayroll from 'attendance-real-payroll';
window.attendanceReadCorrections=(...args)=>actualPayroll.getAttendanceOverrides(...args);
window.attendanceReadPending=()=>actualPayroll.getPendingLeaveApprovals();
const scenario=()=>window.attendanceScenario;
const date=(year,month,day)=>year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
const monthly=(year,month)=>({standard_working_days:22,working_days_in_month:22,source:'manual_upload',attendance_source:'manual_upload',rows:Array.from({length:31},(_,i)=>({
 id:i+1,radai_user_id:i+1,employee_code:'ATT'+String(i+1).padStart(3,'0'),radai_full_name:(month===9?'September':month===8?'August':month===7?'July':'Period '+month)+' Employee '+String(i+1).padStart(2,'0'),
 department:i%2?'Engineering':'Delivery',days_present:3,total_hours:24,attendance_source:'manual_upload',
 days_detail:[{date:date(year,month,1),hours:8},{date:date(year,month,2),hours:9},{date:date(year,month,3),hours:7}]
}))});
const failure=detail=>Object.assign(new Error(detail),{response:{status:503,data:{detail}}});
async function invoke(method,...args){
 const s=scenario();s.calls.push({method,args:args.map(value=>value instanceof File?{name:value.name}:value instanceof FormData?{file:value.get('file')?.name}:value)});
 if(method==='fetchMonthly'){
  const [year,month]=args;
  if(s.yearly){
   const key=year+'-'+month;
   if(s.deferYearlyYears.includes(year))await new Promise(resolve=>{s.pendingYearly[key]=resolve;});
   if(s.failYearlyMonths.includes(key))throw failure('Synthetic yearly month unavailable.');
   const rows=s.emptyYearlyMonths.includes(month)?[]:monthly(year,month).rows.map((row,index)=>{
    const missing=s.missingYearlyMonths.includes(month)||(year===2026&&month>9)||(index===30&&month===5);
    const daysPresent=missing||index===1?0:22;
    const result={...row,radai_full_name:'Year '+year+' Employee '+String(index+1).padStart(2,'0'),days_present:daysPresent,
     total_hours:daysPresent*9,overtime_hours:index===1?0:1.5,total_presence_hours:daysPresent*9+(index===1?0:1.5),
     attendance_source:missing?'not_uploaded':'manual_upload',days_detail:missing?[]:[{date:date(year,month,1),hours:index===1?0:9}]};
    if(missing)delete result.overtime_hours;
    return result;
   });
   return {configured:true,year,month,standard_working_days:22,working_days_in_month:22,attendance_source:'manual_upload',rows};
  }
  if(s.deferMonths.includes(month))await new Promise(resolve=>{s.pending[month]=resolve;});
  if(s.failMonths.includes(month))throw failure('Synthetic attendance source unavailable.');
  return monthly(year,month);
 }
 if(method==='fetchLive')return monthly(2026,9);
 if(method==='fetchDaily'){
  const selectedDate=args[0]||'2026-09-30';
  if(s.deferDailyDates.includes(selectedDate))await new Promise(resolve=>{s.pendingDaily[selectedDate]=resolve;});
  if(s.deniedDailyDates.includes(selectedDate))throw Object.assign(failure('Synthetic attendance read denied.'),{response:{status:403,data:{detail:'Synthetic attendance read denied.'}}});
  if(s.failDailyDates.includes(selectedDate))throw failure('Synthetic daily attendance source unavailable.');
  if(s.dailyConfigured===false)return {configured:false,message:s.dailyUnavailableMessage||'The fixture attendance source is unavailable.'};
  return {configured:true,attendance_source:'hybrid',date:selectedDate,rows:s.emptyDailyDates.includes(selectedDate)?[]:monthly(2026,9).rows.map((row,index)=>{
   const kind=index%5,absent=kind===3,open=kind===4,half=kind===2;
   const dailyRow={...row,radai_full_name:'Daily '+selectedDate.slice(-2)+' Employee '+String(index+1).padStart(2,'0'),
    first_in:absent?null:selectedDate+'T'+(kind===1?'09:20':'08:00')+':00+04:00',
    last_out:absent||open?null:selectedDate+'T'+(half?'12:00':'17:00')+':00+04:00',
    regular_hours:absent||open?0:half?4:8,overtime_hours:kind===0?1:0,total_presence_hours:absent||open?0:half?4:kind===0?9:8,
    is_full_day:kind===0||kind===1,is_late:kind===1,open_shift:open,attendance_source:'hybrid'};
   if(s.noOpenShift)delete dailyRow.open_shift;
   if(s.overview&&s.missingOverviewNumbers&&index===0){dailyRow.regular_hours=null;dailyRow.overtime_hours=' ';dailyRow.total_presence_hours=false;delete dailyRow.is_late;delete dailyRow.open_shift;}
   return dailyRow;
  }).concat(s.overview?[{employee_code:'VISITOR001',name:'Visitor badge',radai_user_id:null,attendance_source:'biometric',first_in:selectedDate+'T08:00:00+04:00',regular_hours:99,overtime_hours:99,total_presence_hours:198,is_late:true,open_shift:true}]:[])};
 }
 if(method==='fetchHealth'){
  if(s.failOverviewHealth)throw failure('Private synthetic health diagnostics must not be shown.');
  return {config:{configured:true},ping:{ok:true,mode:'mirror',event_count:42,latest_event:'2026-09-30T07:12:00Z',error:'private-synthetic-health-detail'},driver:{available:true,driver_in_use:'postgres-mirror'},data_source:'mirror',sqlserver_host:'private-synthetic-host.example',sqlserver_port:1433};
 }
 if(method==='getBranchEmployeeCodes'){
  if(s.yearly&&s.failYearlyBranch===args[0])throw failure('Synthetic yearly branch mapping unavailable.');
  if(s.overview&&s.failOverviewBranch===args[0])throw failure('Synthetic overview branch mapping unavailable.');
  if(s.overview&&s.overviewBranchCodesByYear)return {codes:s.overviewBranchCodesByYear[args[1]]||[]};
  return {codes:monthly(2026,9).rows.filter((_,i)=>args[0]==='RAD'?i%2===0:i%2===1).map(row=>row.employee_code)};
 }
 if(method==='getLeaveCalendar'){
  if(s.overview){
   if(s.failOverviewLeave)throw failure('Synthetic overview leave unavailable.');
   return {calendar:s.emptyOverviewLeave?{}:{ATT002:{[date(args[0],args[1],30)]:{code:'AL',name:'Annual Leave'}},ATT040:{[date(args[0],args[1],30)]:{code:'AL',name:'Annual Leave'}}}};
  }
  return {calendar:{ATT002:{[date(args[0],args[1],4)]:{code:'AL',name:'Annual Leave'}}}};
 }
 if(method==='getAnnualLeaveBalanceSummary'){
  if(s.yearly){
   if(s.failYearlyLeave)throw failure('Synthetic yearly leave unavailable.');
   return {year:args[0],month:args[1],balances:Object.fromEntries(monthly(args[0],1).rows.filter(row=>row.employee_code!==s.missingYearlyLeaveCode).map(row=>[row.employee_code,{employee_name:row.radai_full_name,taken_ytd:s.invalidYearlyLeave&&row.employee_code==='ATT001'?false:2,balance:s.invalidYearlyLeave&&row.employee_code==='ATT001'?' ':18}]))};
  }
  return {balances:{ATT001:{balance:12}},balances_by_name:{}};
 }
 if(method==='getAttendanceOverrides')return actualPayroll.getAttendanceOverrides(...args);
 if(method==='getPendingLeaveApprovals')return actualPayroll.getPendingLeaveApprovals();
 if(method==='getPublicHolidays'){
  if(s.overview){
   const page=Number(args[1]?.page||1);
   if(s.failOverviewHolidayPage===page)throw failure('Synthetic holiday page unavailable.');
   const rows=s.emptyOverviewHolidays?[]:[{id:1,date:date(args[0],9,10),name:'Earlier fixture holiday',source:'government',region:'AE'},{id:2,date:date(args[0],9,30),name:'Selected fixture holiday',source:'government',region:'SE'}];
   return {count:rows.length,next:page<rows.length?location.origin+'/api/v1/payroll/public-holidays/?page='+(page+1):null,previous:page>1?location.origin+'/api/v1/payroll/public-holidays/?page='+(page-1):null,results:rows.slice(page-1,page)};
  }
  return [{id:1,date:date(args[0],9,10),name:'Fixture public holiday',source:'government'}];
 }
 if(method==='uploadDailyAttendance'){
  if(s.deferUpload)await new Promise(resolve=>{s.pendingUpload=resolve;});
  s.finishedUploads=(s.finishedUploads||0)+1;
  if(s.uploadSucceeds)return {created:1,updated:0,skipped:0};
  throw failure('Synthetic attendance upload failed.');
 }
 if(method==='syncLeaveData')throw failure('Synthetic leave sync failed.');
 if(method==='createAttendanceOverride')throw failure('Synthetic correction failed.');
 if(method.startsWith('download')){if(s.failExport)throw failure('Synthetic export unavailable.');return;}
 throw new Error('Unmapped attendance fixture service: '+method);
}
export const downloadBlob=()=>{};
export default new Proxy({}, {get:(_,method)=>(...args)=>invoke(method,...args)});
`;
const apiFixture = `
const failure=detail=>Object.assign(new Error(detail),{response:{status:503,data:{detail}}});
export const apiClientLongTimeout={get:async(url,config={})=>{
 if(url==='/payroll/leave-requests/pending-for-me/'){
  const s=window.attendanceScenario;s.pendingRequests.push({url,params:config.params||{}});
  if(s.failOverviewPending)throw Object.assign(failure('Synthetic pending approvals unavailable.'),{response:{status:s.failOverviewPending===403?403:503,data:{detail:'Synthetic pending approvals unavailable.'}}});
  const results=s.emptyOverviewPending?[]:Array.from({length:4},(_,index)=>({id:801+index,employee_code:'ATT'+String(index+1).padStart(3,'0'),employee_name:'Queue Employee '+String(index+1).padStart(2,'0'),department:index%2?'Engineering':'Delivery',leave_type:1,leave_type_detail:{id:1,code:'AL',name:'Annual Leave'},start_date:'2026-10-05',end_date:'2026-10-06',days_requested:'2.00',status:index%2?'RM_APPROVED':'PENDING',status_display:index%2?'Reporting Manager Approved':'Pending',can_review:true,review_stage:index%2?'hr_review':'manager_review',created_at:'2026-09-29T10:00:00Z'}));
  return {data:{count:results.length,results:s.invalidOverviewPending?null:results}};
 }
 if(url!=='/payroll/attendance-overrides/')return {data:{results:[],count:0}};
 const s=window.attendanceScenario,params={...config.params},page=Number(params.page||1);
 s.correctionRequests.push({url,params});
 if(s.failCorrections||s.failCorrectionsPage===page)throw failure('Synthetic corrections unavailable on page '+page+'.');
 const date=day=>params.year+'-'+String(params.month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
 const all=[
  {id:901,employee_code:'ATT001',date:date(2),override_hours:'6',reason:'hr_correction',note:'Synthetic fixture correction'},
  {id:902,employee_code:'ATT002',date:date(2),override_hours:'5',reason:'hr_correction',note:'Second-page correction'},
  {id:903,employee_code:'ATT003',date:date(1),override_hours:'4',reason:'hr_correction',note:'Third-page correction'}
 ];
 const rows=s.correctionMode==='empty'?[]:s.overview?Array.from({length:6},(_,index)=>({id:901+index,employee_code:'ATT'+String(index+1).padStart(3,'0'),employee_name:'Corrected Employee '+String(index+1).padStart(2,'0'),date:date(index+1),original_hours:'8',override_hours:'6',reason:'hr_correction',reason_display:'HR correction',note:'Synthetic fixture correction',created_by:901,created_by_name:'Morgan Reviewer',created_at:date(index+1)+'T07:00:00Z',updated_at:date(index+1)+'T07:00:00Z',is_active:true})):s.correctionMode==='multiple'?all:all.slice(0,1);
 if(s.correctionMode==='array')return {data:rows};
 const pageSize=1,start=(page-1)*pageSize;
 return {data:{count:rows.length,next:start+pageSize<rows.length?location.origin+'/api/v1/payroll/attendance-overrides/?page='+(page+1):null,previous:page>1?location.origin+'/api/v1/payroll/attendance-overrides/?page='+(page-1):null,results:rows.slice(start,start+pageSize)}};
}};
export default apiClientLongTimeout;
`;
const serviceButtons = `import React from 'react';import {BellIcon,ArrowDownTrayIcon} from '@heroicons/react/24/outline';export function NotificationBell(){return <button aria-label='Notifications' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><BellIcon className='h-5 w-5'/></button>}export default function PWAHeaderInstall(){return <button aria-label='Install RADAI on this device' className='inline-flex h-9 w-9 items-center justify-center rounded-lg'><ArrowDownTrayIcon className='h-5 w-5'/></button>}`;
const stubs = [
  // These smoke checks exercise only their shared Payroll shell and visible title.
  [/pages[\\/]HR[\\/]payroll[\\/](PayrollDashboard|LeaveDashboard|ApprovalTracker)\.jsx$/, 'export default function OtherModuleBody(){return <div data-testid="other-module-body"/>;}'],
  [/services[\\/](timesheet|payroll|payrollEngine)\.service\.js$/, fixtureService],
  [/services[\\/]api\.service\.js$/, apiFixture],
  [/config[\\/]api\.config\.js$/, "export const API_BASE_URL='/api/v1';export const API_TIMEOUT=10000;export const API_ENDPOINTS={USER_ME:'/rbac/users/me/'};"],
  [/store[\\/]slices[\\/]authSlice\.js$/, 'export const updateUser=()=>({type:"fixture"});export const logout=()=>({type:"fixture-logout"});'],
  [/store[\\/]slices[\\/]themeSlice\.js$/, 'export const toggleTheme=()=>({type:"fixture-theme"});'],
  [/store[\\/]slices[\\/]rbacSlice\.js$/, 'export const fetchCurrentUser=()=>({type:"fixture-rbac"});'],
  [/components[\\/]ProcurementApprovalReminder\.jsx$/, 'export default function Reminder(){return null;}'],
  [/components[\\/]notifications[\\/]NotificationBell\.jsx$/, serviceButtons.replace('export function NotificationBell', 'export default function NotificationBell').replace('export default function PWAHeaderInstall', 'export function PWAHeaderInstall')],
  [/components[\\/]PWAHeaderInstall\.jsx$/, serviceButtons],
  [/hooks[\\/]useAuthenticatedPhoto\.js$/, 'export default function useAuthenticatedPhoto(){return null;}'],
  [/components[\\/]help[\\/]HelpContext\.jsx$/, 'export function HelpContextProvider({children}){return children;}export const useHelpContext=()=>({helpContext:{featureLabel:"Attendance"},isOpen:false,openHelp:()=>{}});'],
  [/components[\\/]help[\\/]ContextualHelpDrawer\.jsx$/, 'export default function ContextualHelpDrawer(){return null;}'],
];
const bundle = await build({ stdin: { contents: entry, loader: 'jsx', resolveDir: frontend }, jsx: 'automatic', bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'isolated-attendance-fixture', setup(builder) {
  builder.onResolve({ filter: /^attendance-real-payroll$/ }, () => ({ path: path.join(frontend, 'src/services/payroll.service.js'), namespace: 'attendance-real' }));
  builder.onLoad({ filter: /./, namespace: 'attendance-real' }, async args => ({ contents: await readFile(args.path, 'utf8'), loader: 'js', resolveDir: path.dirname(args.path) }));
  for (const [filter, contents] of stubs) builder.onLoad({ filter, namespace: 'file' }, () => ({ contents, loader: 'jsx' }));
} }] });
async function filesIn(directory) {
  const result = [];
  for (const entry of await readdir(path.join(frontend, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await filesIn(file)); else result.push(file);
  }
  return result;
}
const componentFiles = [...await filesIn('src/components/Layout'), ...await filesIn('src/pages/HR/payroll'), 'src/pages/HR/Payroll.jsx', 'src/config/layout.config.js', 'src/config/hrAttendance.config.js', 'src/config/hrLeave.config.js'];
const classSources = await Promise.all(componentFiles.filter(file => /\.[jm]sx?$/.test(file)).map(file => readFile(path.join(frontend, file), 'utf8')));
const utilityCss = await postcss([tailwind({ ...tailwindConfig, content: [{ raw: [entry, serviceButtons, ...classSources].join('\n'), extension: 'jsx' }] })]).process(await inlineLocalCssImports(await readFile(path.join(frontend, 'src/index.css'), 'utf8'), path.join(frontend, 'src/index.css')), { from: undefined });
const styleBundle = await build({ stdin: { contents: componentFiles.filter(file => file.endsWith('.css')).map(file => `@import ${JSON.stringify('./' + file)};`).join('\n'), loader: 'css', resolveDir: frontend }, bundle: true, write: false, external: ['/assets/*'], loader: { '.woff2': 'dataurl', '.woff': 'dataurl' } });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Attendance reference browser checks</title><style>${utilityCss.css}\n${styleBundle.outputFiles[0].text}</style></head><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script', '<\\/script')}</script></body></html>`;
const checks = [], errors = [], unexpectedRequests = [], geometry = [], correctionEvidence = [];
const record = message => { checks.push(message); console.log(`PASS: ${message}`); };
const expectedSidebarWidth = await sidebarWidth(frontend);
const browser = await launchBrowser();

async function newPage({ editor = true, width = 1788, scenario = {}, module = 'attendance' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, timezoneId: 'Asia/Dubai', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.clock.setFixedTime(new Date('2026-09-30T08:00:00Z'));
  await page.addInitScript(({ editor, scenario, module }) => {
    window.attendanceEditor = editor;
    window.attendanceModule = module;
    window.attendanceScenario = { failMonths: [], deferMonths: [], failDailyDates: [], deniedDailyDates: [], deferDailyDates: [], emptyDailyDates: [], failExport: false, pending: {}, pendingDaily: {}, calls: [], correctionRequests: [], pendingRequests: [], deferYearlyYears: [], pendingYearly: {}, failYearlyMonths: [], emptyYearlyMonths: [], missingYearlyMonths: [], ...scenario };
    localStorage.setItem('radai_access_token', 'isolated-attendance-test-token');
  }, { editor, scenario, module });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.isNavigationRequest() && url.origin === origin) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === origin && /\/rbac\/users\/me\/?$/.test(url.pathname)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ user: { is_superuser: editor, is_staff: editor }, roles: editor ? [{ code: 'hr_manager' }] : [], modules: [] }) });
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      const file = path.resolve(frontend, 'public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(path.resolve(frontend, 'public') + path.sep)) {
        try { return route.fulfill({ contentType: url.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: await readFile(file) }); }
        catch { /* Unmapped assets are recorded below. */ }
      }
    }
    unexpectedRequests.push(`${request.method()} ${url.href}`);
    return route.abort();
  });
  await page.goto(origin);
  return { page, close: () => context.close() };
}
const matrixRows = page => page.locator('.att-matrix-table tbody tr');
async function waitRows(page, count = 25) { await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector: '.att-matrix-table tbody tr', count }); }
const dailyRows = page => page.locator('.att-daily-table tbody tr');
async function waitDailyRows(page, count = 25) { await page.waitForFunction(count => document.querySelectorAll('.att-daily-table tbody tr').length === count, count); }
const yearlyRows = page => page.locator('.att-yearly-table tbody tr');
async function waitYearlyRows(page, count = 25) { await page.waitForFunction(count => document.querySelectorAll('.att-yearly-table tbody tr').length === count, count); }
async function openYearly(options = {}) {
  const context = await newPage(options);
  await waitRows(context.page);
  await context.page.evaluate(() => { window.attendanceScenario.yearly = true; });
  await context.page.getByRole('button', { name: 'Yearly', exact: true }).click();
  return context;
}
async function openOverview(options = {}) {
  const context = await newPage(options);
  await waitRows(context.page);
  await context.page.evaluate(() => { window.attendanceScenario.overview = true; });
  await context.page.getByRole('button', { name: 'Overview', exact: true }).click();
  return context;
}
async function waitOverviewCount(page, count = '31') {
  await page.waitForFunction(value => document.querySelector('.att-overview [aria-label="Overview attendance summary"] dd')?.textContent === value, count);
}
async function capture(page, name, { activeTab } = {}) {
  await page.evaluate(async () => { await document.fonts.ready; for (const node of document.querySelectorAll('html,body,main,main *')) if (node.scrollTop || node.scrollLeft) node.scrollTo(0, 0); });
  if (activeTab) await page.getByRole('button', { name: activeTab, exact: true }).evaluate(node => node.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), animations: 'disabled' });
}
async function assertGeometry(page, width) {
  const result = await page.evaluate(() => {
    const main = document.querySelector('main');
    return { width: innerWidth, documentFits: document.documentElement.scrollWidth <= innerWidth, mainFits: main.scrollWidth <= main.clientWidth + 1, sidebarWidth: document.getElementById('application-sidebar').getBoundingClientRect().width, contentLeft: document.getElementById('application-content').getBoundingClientRect().left };
  });
  geometry.push(result);
  assert.ok(result.documentFits && result.mainFits, `${width}px: no document or main overflow`);
  assert.equal(Math.round(result.contentLeft), width < 1024 ? 0 : expectedSidebarWidth, 'Shared sidebar/content geometry is retained');
  if (width >= 1024) assert.equal(Math.round(result.sidebarWidth), expectedSidebarWidth);
}

async function checkDailyViews() {
  const context = await newPage();
  const { page } = context;
  await waitRows(page);
  await page.getByRole('button', { name: 'Daily', exact: true }).click();
  await waitDailyRows(page);
  const daily = page.locator('.att-daily');
  const summary = daily.getByLabel('Daily attendance summary', { exact: true });
  assert.equal(await daily.getByLabel('Attendance date', { exact: true }).inputValue(), '2026-09-30');
  assert.deepEqual(await summary.locator('dt').allTextContents(), ['Attendance records', 'Present', 'Late', 'Half day', 'Absent', 'In progress']);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '7', '6', '12', '6', '6']);
  assert.equal(await daily.getByRole('button', { name: /^All\s*\(31\)$/ }).getAttribute('aria-pressed'), 'true');
  assert.match(await dailyRows(page).first().innerText(), /Daily 30 Employee 01/);
  assert.equal(await daily.getByRole('button', { name: 'Next day', exact: true }).isDisabled(), true);
  await assertGeometry(page, 1788);
  await capture(page, 'attendance-daily-desktop');
  record('Daily view renders actual recorded attendance counts, all status groups and 25-row default');

  await daily.getByRole('button', { name: 'Sort by Employee', exact: true }).click();
  await daily.getByRole('button', { name: 'Next page', exact: true }).click();
  await waitDailyRows(page, 6);
  assert.match(await dailyRows(page).first().innerText(), /Daily 30 Employee 26/);
  await daily.getByLabel('Search employees', { exact: true }).fill('Employee 09');
  await waitDailyRows(page, 1);
  assert.match(await dailyRows(page).first().innerText(), /Daily 30 Employee 09/);
  await daily.getByLabel('Search employees', { exact: true }).fill('no matching employee');
  await waitDailyRows(page, 0);
  await daily.getByLabel('Search employees', { exact: true }).fill('');
  await waitDailyRows(page);
  await daily.getByRole('combobox', { name: 'Department', exact: true }).selectOption({ label: 'Delivery' });
  await waitDailyRows(page, 16);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '7', '6', '12', '6', '6'], 'Date summary retains its established full-date scope while table filters change');
  await daily.getByRole('combobox', { name: 'Department', exact: true }).selectOption({ index: 0 });
  for (const [label, count] of [['Present', 7], ['Late', 6], ['Half day', 12], ['Absent', 6], ['In progress', 6]]) {
    const filter = daily.getByRole('button', { name: new RegExp('^' + label + '\\s*\\(' + count + '\\)$', 'i') });
    await filter.click();
    await waitDailyRows(page, count);
    assert.equal(await filter.getAttribute('aria-pressed'), 'true');
    if (label === 'In progress') assert.match(await dailyRows(page).first().innerText(), /In progress/i);
  }
  await daily.getByRole('button', { name: /^All\s*\(31\)$/ }).click();
  await waitDailyRows(page);
  record('Daily search, department/status filters, empty search and paging reflect fixture records');

  const employeeSort = daily.getByRole('button', { name: 'Sort by Employee', exact: true });
  await employeeSort.click();
  const sortHeader = employeeSort.locator('..');
  const direction = await sortHeader.getAttribute('aria-sort');
  assert.ok(['ascending', 'descending'].includes(direction));
  assert.match(await dailyRows(page).first().innerText(), direction === 'descending' ? /Daily 30 Employee 31/ : /Daily 30 Employee 01/);
  await employeeSort.click();
  assert.equal(await sortHeader.getAttribute('aria-sort'), direction === 'descending' ? 'ascending' : 'descending');
  assert.match(await dailyRows(page).first().innerText(), direction === 'descending' ? /Daily 30 Employee 01/ : /Daily 30 Employee 31/);
  if (await sortHeader.getAttribute('aria-sort') === 'descending') await employeeSort.click();
  const comfortableHeight = await dailyRows(page).first().evaluate(node => node.getBoundingClientRect().height);
  await daily.getByLabel('Density', { exact: true }).selectOption('compact');
  await page.waitForFunction(height => document.querySelector('.att-daily-table tbody tr')?.getBoundingClientRect().height < height, comfortableHeight);
  await daily.getByLabel('Density', { exact: true }).selectOption('comfortable');
  await daily.getByText('Columns', { exact: true }).click();
  await daily.getByRole('checkbox', { name: 'Code', exact: true }).uncheck();
  assert.equal(await daily.getByRole('button', { name: 'Sort by Code', exact: true }).count(), 0);
  assert.equal(await daily.getByRole('button', { name: 'Sort by Employee', exact: true }).count(), 1);
  await daily.getByRole('checkbox', { name: 'Code', exact: true }).check();
  assert.equal(await daily.getByRole('button', { name: 'Sort by Code', exact: true }).count(), 1);
  await daily.getByText('Columns', { exact: true }).click();
  record('Daily sorting, density and optional columns change the real table presentation');

  await daily.getByRole('button', { name: 'Previous day', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-daily-table tbody tr')?.textContent.includes('Daily 29 Employee'));
  assert.equal(await daily.getByLabel('Attendance date', { exact: true }).inputValue(), '2026-09-29');
  await daily.getByRole('button', { name: 'Export', exact: true }).click();
  assert.ok(await page.evaluate(() => window.attendanceScenario.calls.some(call => call.method === 'downloadDailyExcel' && call.args[0] === '2026-09-29')));
  await page.evaluate(() => { window.attendanceScenario.failExport = true; });
  await daily.getByRole('button', { name: 'Export', exact: true }).click();
  await daily.getByRole('alert').filter({ hasText: 'The daily report could not be exported. Please try again.' }).waitFor();
  await daily.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-daily-table tbody tr')?.textContent.includes('Daily 30 Employee'));
  await daily.getByRole('button', { name: 'Previous day', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-daily-table tbody tr')?.textContent.includes('Daily 29 Employee'));
  await daily.getByRole('button', { name: 'Next day', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-daily-table tbody tr')?.textContent.includes('Daily 30 Employee'));
  record('Daily date navigation and export use the selected date and expose export failures');

  await daily.getByRole('combobox', { name: 'Department', exact: true }).selectOption({ label: 'Delivery' });
  await daily.getByLabel('Search employees', { exact: true }).fill('Employee 01');
  await waitDailyRows(page, 1);
  await page.evaluate(() => { window.attendanceScenario.failDailyDates = ['2026-09-27']; });
  await daily.getByLabel('Attendance date', { exact: true }).fill('2026-09-27');
  await daily.getByRole('alert').filter({ hasText: 'Daily attendance could not be loaded. Please try again.' }).waitFor();
  assert.equal(await dailyRows(page).count(), 0);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['—', '—', '—', '—', '—', '—'], 'Failed daily reads do not manufacture zero attendance counts');
  assert.equal(await daily.getByLabel('Search employees', { exact: true }).inputValue(), 'Employee 01');
  assert.equal(await daily.getByRole('combobox', { name: 'Department', exact: true }).inputValue(), 'Delivery');
  await page.evaluate(() => { window.attendanceScenario.failDailyDates = []; });
  await daily.getByRole('button', { name: 'Retry', exact: true }).click();
  await waitDailyRows(page, 1);
  assert.match(await dailyRows(page).first().innerText(), /Daily 27 Employee 01/);
  await daily.getByLabel('Search employees', { exact: true }).fill('');
  await daily.getByRole('combobox', { name: 'Department', exact: true }).selectOption({ index: 0 });
  await page.evaluate(() => { window.attendanceScenario.deferDailyDates = ['2026-09-28']; });
  await daily.getByLabel('Attendance date', { exact: true }).fill('2026-09-28');
  await page.waitForFunction(() => !!window.attendanceScenario.pendingDaily['2026-09-28']);
  assert.equal(await dailyRows(page).count(), 0, 'Loading a different date hides old daily rows');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['—', '—', '—', '—', '—', '—']);
  await daily.getByLabel('Attendance date', { exact: true }).fill('2026-09-29');
  await waitDailyRows(page);
  await page.evaluate(() => { window.attendanceScenario.pendingDaily['2026-09-28'](); window.attendanceScenario.deferDailyDates = []; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.match(await dailyRows(page).first().innerText(), /Daily 29 Employee 01/);
  const beforeRefresh = await page.evaluate(() => window.attendanceScenario.calls.filter(call => call.method === 'fetchDaily' && call.args[0] === '2026-09-29').length);
  await daily.getByRole('button', { name: 'Refresh daily attendance', exact: true }).click();
  await waitDailyRows(page);
  assert.ok(await page.evaluate(() => window.attendanceScenario.calls.filter(call => call.method === 'fetchDaily' && call.args[0] === '2026-09-29').length) > beforeRefresh);
  record('Daily loading/error retry and obsolete responses preserve date/filter context without stale rows');

  await page.evaluate(() => { window.attendanceScenario.deferUpload = true; });
  const upload = daily.getByLabel('Upload daily hours', { exact: true });
  await upload.setInputFiles({ name: 'daily-fixture.csv', mimeType: 'text/csv', buffer: Buffer.from('employee_code,date,hours\nATT001,2026-09-29,8\n') });
  await page.waitForFunction(() => !!window.attendanceScenario.pendingUpload);
  assert.equal(await upload.isDisabled(), true);
  assert.equal(await daily.getByLabel('Attendance date', { exact: true }).isDisabled(), true);
  await page.evaluate(() => { window.attendanceScenario.deferUpload = false; window.attendanceScenario.pendingUpload(); });
  await daily.getByText('Synthetic attendance upload failed.', { exact: false }).waitFor();
  assert.equal(await upload.evaluate(node => node.files?.[0]?.name), 'daily-fixture.csv');
  assert.equal(await daily.getByLabel('Attendance date', { exact: true }).inputValue(), '2026-09-29');
  await daily.getByLabel('Attendance date', { exact: true }).fill('2026-08-29');
  await page.waitForFunction(() => window.attendanceScenario.calls.some(call => call.method === 'fetchDaily' && call.args[0] === '2026-08-29'));
  await waitDailyRows(page);
  await daily.getByText('Upload period: 2026-09', { exact: false }).waitFor();
  await page.evaluate(() => { window.attendanceScenario.uploadSucceeds = true; });
  await daily.getByRole('button', { name: 'Retry upload', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-daily input[aria-label="Upload daily hours"]')?.files.length === 0);
  await waitDailyRows(page);
  const uploadCalls = await page.evaluate(() => window.attendanceScenario.calls.filter(call => call.method === 'uploadDailyAttendance'));
  assert.equal(uploadCalls.length, 2);
  assert.ok(uploadCalls.every(call => call.args[0].name === 'daily-fixture.csv' && call.args[1] === 2026 && call.args[2] === 9));
  await daily.getByRole('status').filter({ hasText: 'Imported 1 daily entries for 2026-09.' }).waitFor();
  record('Daily uploads retain failed files, lock dates during upload and retry the original month after date changes');

  await page.evaluate(() => { window.attendanceScenario.emptyDailyDates = ['2026-09-26']; });
  await daily.getByLabel('Attendance date', { exact: true }).fill('2026-09-26');
  await page.waitForFunction(() => document.querySelector('.att-daily dl dd')?.textContent === '0');
  assert.equal(await dailyRows(page).count(), 0);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['0', '0', '0', '0', '0', '0']);
  assert.equal(await daily.getByRole('alert').filter({ hasText: 'Daily attendance could not be loaded. Please try again.' }).count(), 0);
  await context.close();

  const mobile = await newPage({ width: 390 });
  await waitRows(mobile.page);
  await mobile.page.getByRole('button', { name: 'Daily', exact: true }).click();
  await waitDailyRows(mobile.page);
  await assertGeometry(mobile.page, 390);
  await capture(mobile.page, 'attendance-daily-mobile');
  await mobile.page.locator('.att-daily-table').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await mobile.page.screenshot({ path: path.join(artifacts, 'attendance-daily-mobile-table.png'), animations: 'disabled' });
  await mobile.close();
  const readonly = await newPage({ editor: false });
  await waitRows(readonly.page);
  await readonly.page.getByRole('button', { name: 'Daily', exact: true }).click();
  await waitDailyRows(readonly.page);
  assert.equal(await readonly.page.locator('.att-daily').getByLabel('Upload daily hours', { exact: true }).count(), 0);
  await readonly.close();
  record('Daily empty data, mobile layout and readonly upload visibility retain honest usable states');

  const partialSource = await newPage();
  await waitRows(partialSource.page);
  await partialSource.page.getByRole('button', { name: 'Daily', exact: true }).click();
  await waitDailyRows(partialSource.page);
  const partialDaily = partialSource.page.locator('.att-daily');
  await partialDaily.getByRole('button', { name: /^In progress\s*\(6\)$/ }).click();
  await waitDailyRows(partialSource.page, 6);
  await partialSource.page.evaluate(() => { window.attendanceScenario.noOpenShift = true; });
  await partialDaily.getByRole('button', { name: 'Refresh daily attendance', exact: true }).click();
  await waitDailyRows(partialSource.page);
  assert.equal(await partialDaily.getByLabel('Daily attendance summary', { exact: true }).locator('dd').last().innerText(), '—');
  assert.equal(await partialDaily.getByRole('button', { name: /^In progress\s*\(—\)$/ }).isDisabled(), true);
  assert.equal(await partialDaily.getByRole('button', { name: /^All\s*\(31\)$/ }).getAttribute('aria-pressed'), 'true', 'Unsupported In progress filter resets to All');
  await partialSource.page.evaluate(() => { window.attendanceScenario.dailyConfigured = false; window.attendanceScenario.dailyUnavailableMessage = 'The biometric attendance connection is unavailable.'; });
  await partialDaily.getByRole('button', { name: 'Refresh daily attendance', exact: true }).click();
  await partialDaily.getByRole('alert').filter({ hasText: 'The biometric attendance connection is unavailable.' }).waitFor();
  assert.equal(await dailyRows(partialSource.page).count(), 0);
  assert.deepEqual(await partialDaily.getByLabel('Daily attendance summary', { exact: true }).locator('dd').allTextContents(), ['—', '—', '—', '—', '—', '—']);
  await partialSource.close();
  record('Missing open-shift evidence stays unknown; unavailable daily sources retain their actual message');

  const leaveDuringUpload = await newPage({ scenario: { deferUpload: true, uploadSucceeds: true } });
  await waitRows(leaveDuringUpload.page);
  await leaveDuringUpload.page.getByRole('button', { name: 'Daily', exact: true }).click();
  await waitDailyRows(leaveDuringUpload.page);
  await leaveDuringUpload.page.locator('.att-daily').getByLabel('Upload daily hours', { exact: true }).setInputFiles({ name: 'late-upload-fixture.csv', mimeType: 'text/csv', buffer: Buffer.from('employee_code,date,hours\nATT001,2026-09-30,8\n') });
  await leaveDuringUpload.page.waitForFunction(() => !!window.attendanceScenario.pendingUpload);
  await leaveDuringUpload.page.getByRole('button', { name: 'Monthly matrix', exact: true }).click();
  await waitRows(leaveDuringUpload.page);
  await leaveDuringUpload.page.evaluate(() => { window.attendanceScenario.pendingUpload(); });
  await leaveDuringUpload.page.waitForFunction(() => window.attendanceScenario.finishedUploads === 1);
  await leaveDuringUpload.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await leaveDuringUpload.page.locator('.att-daily').count(), 0);
  assert.equal(await matrixRows(leaveDuringUpload.page).count(), 25);
  await leaveDuringUpload.close();
  record('A deferred successful daily upload completes after leaving the tab without disturbing the matrix');
}

async function checkYearlyViews() {
  const context = await openYearly();
  const { page } = context;
  await waitYearlyRows(page);
  const yearly = page.locator('.att-yearly');
  const summary = yearly.getByLabel('Yearly attendance summary', { exact: true });
  const select = name => yearly.getByRole('combobox', { name, exact: true });
  const trend = yearly.getByRole('img', { name: /^\d{4} recorded attendance rates\./ });
  const rowFor = name => yearlyRows(page).filter({ hasText: name });
  const cellForMonth = (row, month) => row.locator('td').nth(month + 1);
  assert.equal(await select('Year').inputValue(), '2026');
  assert.deepEqual(await select('Year').locator('option').allTextContents(), ['2024', '2025', '2026']);
  assert.deepEqual(await summary.locator('dt').allTextContents(), ['Employees', 'Average recorded rate', 'Below target (< 90%)', 'Annual leave taken', 'Recorded OT (Unapproved)']);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '97%', '—', '62 days', '403.5 h']);
  assert.equal(await summary.getByText('Partial · recorded months only', { exact: true }).count(), 1);
  assert.match(await rowFor('Year 2026 Employee 01').locator('.att-yearly-overtime').innerText(), /13\.5 h\s*Partial/);
  assert.equal(await cellForMonth(rowFor('Year 2026 Employee 02'), 1).innerText(), '0%', 'A recorded zero remains a genuine zero');
  assert.match(await cellForMonth(rowFor('Year 2026 Employee 01'), 10).innerText(), /Upcoming/);
  assert.equal(await rowFor('Year 2026 Employee 01').locator('td').last().innerText(), '—');
  assert.match(await rowFor('Year 2026 Employee 01').innerText(), /Incomplete data/);
  assert.match(await trend.getAttribute('aria-label'), /Jan: 97%.*Sep: 97%.*Oct: —.*Nov: —.*Dec: —/);
  assert.match(await yearly.locator('.att-yearly-trend-stats').innerText(), /Full-year rate\s*—[\s\S]*9 of 12/);
  assert.ok(await page.evaluate(() => window.attendanceScenario.calls.some(call => call.method === 'getAnnualLeaveBalanceSummary' && call.args[0] === 2026 && call.args[1] === 12)));
  await assertGeometry(page, 1788);
  await capture(page, 'attendance-yearly-desktop', { activeTab: 'Yearly' });
  assert.ok(await yearly.getByRole('button', { name: 'Next page', exact: true }).evaluate(node => {
    const footerTop = document.querySelector('footer')?.getBoundingClientRect().top ?? innerHeight;
    const bounds = node.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= footerTop;
  }), 'Desktop yearly pagination fits above the shared footer on the initial view');
  record('Yearly current-year data uses actual recorded rates, genuine zero, unknown future months and annual code-keyed leave');

  await yearly.getByRole('button', { name: 'Next page', exact: true }).click();
  await waitYearlyRows(page, 6);
  assert.match(await yearlyRows(page).first().innerText(), /Year 2026 Employee 26/);
  assert.match(await cellForMonth(rowFor('Year 2026 Employee 31'), 5).innerText(), /No data/);
  assert.equal(await rowFor('Year 2026 Employee 31').locator('td').last().innerText(), '—');
  await select('Year').selectOption('2025');
  await page.waitForFunction(() => document.querySelector('.att-yearly-table tbody tr')?.textContent.includes('Year 2025 Employee 01'));
  await waitYearlyRows(page);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '97%', '1', '62 days', '538.5 h']);
  assert.deepEqual(await select('Year').locator('option').allTextContents(), ['2024', '2025', '2026'], 'Year options stay anchored to the current year');
  await select('Status').selectOption({ label: 'Below target' });
  await waitYearlyRows(page, 1);
  assert.match(await yearlyRows(page).first().innerText(), /Year 2025 Employee 02/);
  assert.equal(await yearlyRows(page).first().locator('td').last().innerText(), '0%');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['1', '0%', '1', '2 days', '0 h']);
  assert.equal(await summary.getByText('Partial · recorded months only', { exact: true }).count(), 0, 'A complete recorded year has no partial overtime qualifier');
  await select('Status').selectOption({ label: 'Incomplete data' });
  await waitYearlyRows(page, 1);
  assert.match(await yearlyRows(page).first().innerText(), /Year 2025 Employee 31/);
  assert.match(await cellForMonth(yearlyRows(page).first(), 5).innerText(), /No data/);
  await select('Status').selectOption({ label: 'On target' });
  await waitYearlyRows(page);
  assert.equal(await summary.locator('dd').first().innerText(), '29');
  await select('Status').selectOption('all');
  await select('Branch').selectOption({ label: 'Rejlers IN' });
  await waitYearlyRows(page, 15);
  assert.match(await yearlyRows(page).first().innerText(), /Year 2025 Employee 02/);
  await select('Branch').selectOption({ label: 'Rejlers AB' });
  await waitYearlyRows(page, 16);
  assert.match(await yearlyRows(page).first().innerText(), /Year 2025 Employee 01/);
  await select('Branch').selectOption('all');
  await select('Department').selectOption('Delivery');
  await waitYearlyRows(page, 16);
  await yearly.getByLabel('Search employees', { exact: true }).fill('Employee 09');
  await waitYearlyRows(page, 1);
  assert.equal(await summary.locator('dd').first().innerText(), '1');
  await yearly.getByLabel('Search employees', { exact: true }).fill('');
  await select('Department').selectOption('all');
  await yearly.getByLabel('Search in yearly table', { exact: true }).fill('Employee 09');
  await waitYearlyRows(page, 1);
  assert.equal(await summary.locator('dd').first().innerText(), '31', 'Table search retains the stated dashboard filter scope');
  await yearly.getByLabel('Search in yearly table', { exact: true }).fill('no matching employee');
  await yearly.getByText('No employees match the selected filters.', { exact: true }).waitFor();
  await yearly.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await waitYearlyRows(page);
  record('Yearly branch, department, search, status and paging retain recorded/missing distinctions and honest summary scope');

  await yearly.getByRole('button', { name: 'Sort by Employee', exact: true }).click();
  assert.match(await yearlyRows(page).first().innerText(), /Year 2025 Employee 31/);
  assert.equal(await yearly.getByRole('button', { name: 'Sort by Employee', exact: true }).locator('..').getAttribute('aria-sort'), 'descending');
  await yearly.getByRole('button', { name: 'Sort by Employee', exact: true }).click();
  const comfortableHeight = await yearlyRows(page).first().evaluate(node => node.getBoundingClientRect().height);
  await select('Density').selectOption('compact');
  await page.waitForFunction(height => document.querySelector('.att-yearly-table tbody tr')?.getBoundingClientRect().height < height, comfortableHeight);
  await select('Density').selectOption('comfortable');
  await yearly.getByText('Columns', { exact: true }).click();
  for (const name of ['Department', 'Status', 'Leave balance', 'Recorded OT (Unapproved)', 'Year']) {
    await yearly.getByRole('checkbox', { name, exact: true }).uncheck();
  }
  assert.equal(await yearly.getByRole('columnheader').count(), 13, 'Employee and 12 months remain visible');
  assert.equal(await yearly.getByRole('button', { name: 'Sort by Employee', exact: true }).count(), 1);
  for (const name of ['Department', 'Status', 'Leave balance', 'Recorded OT (Unapproved)', 'Year']) {
    await yearly.getByRole('checkbox', { name, exact: true }).check();
  }
  await yearly.getByText('Columns', { exact: true }).click();
  await yearly.getByRole('button', { name: 'Export', exact: true }).click();
  const exportPanel = yearly.getByRole('group', { name: 'Yearly export formats', exact: true });
  assert.match(await exportPanel.innerText(), /Monthly recorded hours.*2025/);
  await exportPanel.getByRole('button', { name: /^Excel/ }).click();
  await exportPanel.getByRole('button', { name: /^PDF/ }).click();
  assert.ok(await page.evaluate(() => ['downloadYearlyExcel', 'downloadYearlyPdf'].every(method => window.attendanceScenario.calls.some(call => call.method === method && call.args[0] === 2025))));
  await page.evaluate(() => { window.attendanceScenario.failExport = true; });
  await exportPanel.getByRole('button', { name: /^PDF/ }).click();
  await yearly.getByRole('alert').filter({ hasText: 'The yearly report could not be exported. Please try again.' }).waitFor();
  await page.evaluate(() => { window.attendanceScenario.failExport = false; });
  await yearly.getByRole('button', { name: 'Retry export', exact: true }).click();
  await yearly.getByRole('button', { name: 'Retry export', exact: true }).waitFor({ state: 'detached' });
  assert.equal(await select('Year').inputValue(), '2025');
  record('Yearly sort, columns, density and monthly-hours exports work for the selected year with explicit failure retry');

  await page.evaluate(() => { window.attendanceScenario.failYearlyMonths = ['2025-2', '2025-6']; });
  await yearly.getByRole('button', { name: 'Refresh yearly attendance', exact: true }).click();
  await yearly.getByRole('alert').filter({ hasText: 'Attendance unavailable for Feb, Jun.' }).waitFor();
  await waitYearlyRows(page);
  assert.match(await cellForMonth(yearlyRows(page).first(), 2).innerText(), /Unavailable/);
  assert.match(await cellForMonth(yearlyRows(page).first(), 6).innerText(), /Unavailable/);
  assert.equal(await summary.locator('dd').nth(2).innerText(), '—');
  assert.match(await trend.getAttribute('aria-label'), /Feb: —.*Jun: —/);
  assert.match(await yearly.locator('.att-yearly-trend-stats').innerText(), /10 of 12/);
  await page.evaluate(() => { window.attendanceScenario.failYearlyMonths = []; });
  await yearly.getByRole('button', { name: 'Retry attendance', exact: true }).click();
  await yearly.getByRole('button', { name: 'Retry attendance', exact: true }).waitFor({ state: 'detached' });
  await waitYearlyRows(page);
  assert.equal(await cellForMonth(yearlyRows(page).first(), 2).innerText(), '100%');
  assert.equal(await summary.locator('dd').nth(2).innerText(), '1');
  await page.evaluate(() => { window.attendanceScenario.missingYearlyMonths = [4]; window.attendanceScenario.emptyYearlyMonths = [6]; });
  await yearly.getByRole('button', { name: 'Refresh yearly attendance', exact: true }).click();
  await waitYearlyRows(page);
  await page.waitForFunction(() => document.querySelector('.att-yearly-chart')?.getAttribute('aria-label').includes('Apr: —'));
  assert.match(await cellForMonth(yearlyRows(page).first(), 4).innerText(), /No data/);
  assert.match(await cellForMonth(yearlyRows(page).first(), 6).innerText(), /No data/);
  assert.equal(await yearly.getByRole('button', { name: 'Retry attendance', exact: true }).count(), 0);
  assert.match(await trend.getAttribute('aria-label'), /Apr: —.*Jun: —/);
  record('Yearly failed, empty and not_uploaded months remain chart gaps and unknown annual values; retry restores recorded data');

  await page.evaluate(() => { window.attendanceScenario.missingYearlyMonths = []; window.attendanceScenario.emptyYearlyMonths = []; window.attendanceScenario.deferYearlyYears = [2024]; });
  await select('Year').selectOption('2024');
  await page.waitForFunction(() => Object.keys(window.attendanceScenario.pendingYearly).length === 12);
  assert.equal(await yearlyRows(page).count(), 0, 'Loading another year clears previous-year rows');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['—', '—', '—', '—', '—']);
  await select('Year').selectOption('2025');
  await waitYearlyRows(page);
  await page.evaluate(() => { Object.values(window.attendanceScenario.pendingYearly).forEach(resolve => resolve()); window.attendanceScenario.deferYearlyYears = []; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.match(await yearlyRows(page).first().innerText(), /Year 2025 Employee 01/);
  assert.equal(await select('Year').inputValue(), '2025');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '97%', '1', '62 days', '538.5 h']);
  record('Yearly loading clears obsolete rows and a late 12-month response cannot replace the selected year');

  await page.evaluate(() => { window.attendanceScenario.failYearlyLeave = true; });
  await yearly.getByRole('button', { name: 'Refresh yearly attendance', exact: true }).click();
  await yearly.getByRole('status').filter({ hasText: 'Annual leave figures could not be loaded.' }).waitFor();
  await waitYearlyRows(page);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '97%', '1', '—', '538.5 h']);
  assert.equal(await yearlyRows(page).first().locator('.att-yearly-leave').innerText(), '—');
  await page.evaluate(() => { window.attendanceScenario.failYearlyLeave = false; });
  await yearly.getByRole('button', { name: 'Retry leave', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-yearly-summary dd:nth-child(2)') && [...document.querySelectorAll('.att-yearly-summary dd')][3]?.textContent === '62 days');
  await page.evaluate(() => { window.attendanceScenario.missingYearlyLeaveCode = 'ATT001'; });
  await yearly.getByRole('button', { name: 'Refresh yearly attendance', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-yearly-table tbody tr .att-yearly-leave')?.textContent === '—');
  assert.equal(await summary.locator('dd').nth(3).innerText(), '—', 'A missing employee leave balance withholds the aggregate');
  assert.equal(await rowFor('Year 2025 Employee 02').locator('.att-yearly-leave').innerText(), '18 d');
  assert.equal(await yearly.getByRole('button', { name: 'Retry leave', exact: true }).count(), 0);
  await page.evaluate(() => { window.attendanceScenario.missingYearlyLeaveCode = null; window.attendanceScenario.invalidYearlyLeave = true; });
  await yearly.getByRole('button', { name: 'Refresh yearly attendance', exact: true }).click();
  await waitYearlyRows(page);
  await page.waitForFunction(() => document.querySelector('.att-yearly-table tbody tr .att-yearly-leave')?.textContent === '—');
  assert.equal(await summary.locator('dd').nth(3).innerText(), '—', 'Malformed boolean and blank leave numbers remain unavailable');
  await page.evaluate(() => { window.attendanceScenario.invalidYearlyLeave = false; });
  record('Yearly leave failures and unmatched employee codes withhold leave figures while preserving attendance');

  await page.evaluate(() => { window.attendanceScenario.failYearlyBranch = 'RAD'; });
  await select('Branch').selectOption('RAD');
  await yearly.getByRole('alert').filter({ hasText: 'Branch employees could not be loaded.' }).waitFor();
  assert.equal(await select('Branch').inputValue(), 'RAD');
  assert.equal(await yearlyRows(page).count(), 0);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['—', '—', '—', '—', '—']);
  await page.evaluate(() => { window.attendanceScenario.failYearlyBranch = null; window.attendanceScenario.missingYearlyLeaveCode = null; });
  await yearly.getByRole('button', { name: 'Retry branch', exact: true }).click();
  await waitYearlyRows(page, 16);
  assert.equal(await select('Branch').inputValue(), 'RAD');
  assert.equal(await summary.locator('dd').first().innerText(), '16');
  assert.ok(await page.evaluate(() => window.attendanceScenario.calls.some(call => call.method === 'getBranchEmployeeCodes' && call.args[0] === 'RAD' && call.args[1] === 2025)));
  await context.close();
  record('Yearly branch mapping failures preserve the selected branch and retry without exposing All-branch rows');

  const noData = await openYearly({ scenario: { emptyYearlyMonths: Array.from({ length: 12 }, (_, index) => index + 1) } });
  await noData.page.getByText('No attendance records for the selected year.', { exact: true }).waitFor();
  assert.equal(await yearlyRows(noData.page).count(), 0);
  assert.deepEqual(await noData.page.getByLabel('Yearly attendance summary', { exact: true }).locator('dd').allTextContents(), ['0', '—', '—', '—', '—']);
  assert.equal(await noData.page.getByRole('button', { name: 'Retry attendance', exact: true }).count(), 0);
  await noData.page.evaluate(() => { window.attendanceScenario.emptyYearlyMonths = []; window.attendanceScenario.failYearlyMonths = Array.from({ length: 12 }, (_, index) => '2026-' + (index + 1)); });
  await noData.page.getByRole('button', { name: 'Refresh yearly attendance', exact: true }).click();
  await noData.page.getByRole('button', { name: 'Retry attendance', exact: true }).waitFor();
  assert.equal(await yearlyRows(noData.page).count(), 0);
  assert.deepEqual(await noData.page.getByLabel('Yearly attendance summary', { exact: true }).locator('dd').allTextContents(), ['—', '—', '—', '—', '—']);
  await noData.page.evaluate(() => { window.attendanceScenario.failYearlyMonths = Array.from({ length: 9 }, (_, index) => '2026-' + (index + 1)); });
  await noData.page.getByRole('button', { name: 'Refresh yearly attendance', exact: true }).click();
  await noData.page.getByRole('button', { name: 'Retry attendance', exact: true }).waitFor();
  assert.equal(await yearlyRows(noData.page).count(), 0);
  assert.deepEqual(await noData.page.getByLabel('Yearly attendance summary', { exact: true }).locator('dd').allTextContents(), ['—', '—', '—', '—', '—'], 'Successful future placeholders cannot manufacture a loaded empty current year');
  assert.equal(await noData.page.locator('.att-yearly-trend-stats dd').last().innerText(), '—');
  await noData.close();
  record('Yearly empty results remain distinct from all-month read failure without fabricated rates or leave totals');

  const mobile = await openYearly({ width: 390 });
  await waitYearlyRows(mobile.page);
  await assertGeometry(mobile.page, 390);
  await capture(mobile.page, 'attendance-yearly-mobile', { activeTab: 'Yearly' });
  await mobile.page.locator('.att-yearly-table').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await mobile.page.screenshot({ path: path.join(artifacts, 'attendance-yearly-mobile-table.png'), animations: 'disabled' });
  const scrollRegion = mobile.page.getByRole('region', { name: 'Yearly attendance table', exact: true });
  assert.ok(await scrollRegion.evaluate(node => node.scrollWidth > node.clientWidth && node.getBoundingClientRect().right <= innerWidth), 'The wide yearly table scrolls within its region');
  await mobile.page.locator('.att-yearly').getByRole('button', { name: 'Export', exact: true }).click();
  assert.ok(await mobile.page.getByRole('group', { name: 'Yearly export formats', exact: true }).evaluate(node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), 'Yearly export fits the mobile viewport');
  await assertGeometry(mobile.page, 390);
  await mobile.page.setViewportSize({ width: 320, height: 844 });
  await mobile.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.ok(await mobile.page.getByRole('group', { name: 'Yearly export formats', exact: true }).evaluate(node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), 'Yearly export also fits a narrow 320px viewport');
  await assertGeometry(mobile.page, 320);
  await capture(mobile.page, 'attendance-yearly-mobile-export-320', { activeTab: 'Yearly' });
  await mobile.close();
  record('Yearly desktop/mobile layouts and export controls fit the shared shell with contained table scrolling');
}

async function checkOverviewViews() {
  const context = await openOverview();
  const { page } = context;
  await waitOverviewCount(page);
  const overview = page.locator('.att-overview');
  const summary = overview.getByLabel('Overview attendance summary', { exact: true });
  const panel = name => overview.getByRole('region', { name, exact: true });
  const select = name => overview.getByRole('combobox', { name, exact: true });
  const attentionRows = overview.locator('.att-overview-attention tbody tr');
  const departmentRows = overview.locator('.att-overview-departments tbody tr');
  const correctionRows = overview.locator('.att-overview-corrections tbody tr');
  const approvalRows = overview.locator('.att-overview-approvals tbody tr');
  const chart = overview.locator('.att-overview-chart');
  await page.waitForFunction(() => document.querySelectorAll('.att-overview-corrections tbody tr').length === 5);
  assert.deepEqual(await summary.locator('dt').allTextContents(), ['Attendance records', 'Check-ins', 'Approved leave', 'Late records', 'Attention items', 'Pending leave']);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '25', '2', '6', '19', '4']);
  assert.equal(await overview.getByLabel('Overview date', { exact: true }).inputValue(), '2026-09-30');
  assert.equal(await overview.getByRole('button', { name: 'Next overview day', exact: true }).isDisabled(), true);
  assert.equal(await attentionRows.count(), 5);
  assert.deepEqual(await departmentRows.first().locator('td').allTextContents(), ['Delivery', '16', '13', '3', '68h', '81.3%']);
  assert.deepEqual(await departmentRows.last().locator('td').allTextContents(), ['Engineering', '15', '12', '3', '60h', '80%']);
  assert.match(await panel('Daily summary').innerText(), /Configured standard day\s*9h[\s\S]*Source regular hours\s*128h[\s\S]*Recorded OT · unapproved\s*7h[\s\S]*Expected hours \/ variance\s*Not available/);
  assert.match(await panel('Daily summary').innerText(), /Selected fixture holiday \(SE\)/);
  assert.match(await chart.getAttribute('aria-label'), /24 Sept?: 31 records.*30 Sept?: 31 records/);
  assert.match(await panel('Data health').innerText(), /Mirror records available[\s\S]*Latest recorded event/);
  assert.doesNotMatch(await overview.innerText(), /private-synthetic|Visitor badge/);
  assert.match(await correctionRows.first().innerText(), /Corrected Employee 06[\s\S]*8h[\s\S]*6h[\s\S]*Morgan Reviewer/);
  assert.equal(await approvalRows.count(), 3);
  assert.equal(await panel('Pending leave approvals').getByRole('link', { name: 'Review', exact: true }).first().getAttribute('href'), '/hr/leave-requests/801');
  assert.equal(await overview.getByRole('link', { name: 'Leave management', exact: true }).getAttribute('href'), '/hr/leave');
  const reads = await page.evaluate(() => ({ pending: window.attendanceScenario.pendingRequests, daily: window.attendanceScenario.calls.filter(call => call.method === 'fetchDaily'), holidays: window.attendanceScenario.calls.filter(call => call.method === 'getPublicHolidays').slice(-2) }));
  assert.deepEqual(reads.pending, [{ url: '/payroll/leave-requests/pending-for-me/', params: {} }], 'The actual payroll service reads the dedicated current-user queue endpoint');
  assert.deepEqual([...new Set(reads.daily.map(call => call.args[0]))].sort(), Array.from({ length: 7 }, (_, index) => '2026-09-' + (24 + index)));
  assert.deepEqual(reads.holidays.map(call => call.args), [1, 2].map(page => [2026, { active_only: 'true', page }]));
  await assertGeometry(page, 1788);
  await capture(page, 'attendance-overview-desktop', { activeTab: 'Overview' });
  await panel('Recent corrections').evaluate(node => node.scrollIntoView({ block: 'end' }));
  await page.screenshot({ path: path.join(artifacts, 'attendance-overview-desktop-lower.png'), animations: 'disabled' });
  record('Overview renders real-shaped seven-day records, safe health, paginated holidays/corrections and the actual pending-approvals service');

  await panel('Requires attention').getByRole('button', { name: /^View all \(19\)/ }).click();
  assert.equal(await attentionRows.count(), 19);
  assert.equal(await attentionRows.filter({ has: page.getByRole('cell', { name: 'Recorded overtime', exact: true }) }).count(), 7);
  assert.equal(await attentionRows.filter({ has: page.getByRole('cell', { name: 'Late arrival', exact: true }) }).count(), 6);
  assert.equal(await attentionRows.filter({ has: page.getByRole('cell', { name: 'Open shift', exact: true }) }).count(), 6);
  await select('Branch').selectOption('RIN');
  await waitOverviewCount(page, '15');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['15', '12', '2', '3', '9', '4']);
  await select('Branch').selectOption('RAD');
  await waitOverviewCount(page, '16');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['16', '13', '2', '3', '10', '4']);
  await select('Branch').selectOption('all');
  await select('Department').selectOption('Delivery');
  await waitOverviewCount(page, '16');
  await overview.getByLabel('Employee search', { exact: true }).fill('ATT009');
  await waitOverviewCount(page, '1');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['1', '0', '2', '0', '0', '4']);
  assert.match(await chart.getAttribute('aria-label'), /24 Sept?: 1 records.*30 Sept?: 1 records/);
  assert.equal(await correctionRows.count(), 5);
  assert.equal(await approvalRows.count(), 3);
  assert.match(await panel('Requires attention').innerText(), /No attention items in the returned records/);
  await overview.getByLabel('Employee search', { exact: true }).fill('no matching employee');
  await waitOverviewCount(page, '0');
  assert.match(await panel('Requires attention').innerText(), /No attendance records match this date and filters/);
  await overview.getByLabel('Employee search', { exact: true }).fill('');
  await select('Department').selectOption('all');
  await waitOverviewCount(page);
  record('Overview attendance filters and expanded attention rows work while leave, approvals and corrections retain their stated scope');

  await overview.getByRole('button', { name: 'Previous overview day', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-overview-attention tbody tr')?.textContent.includes('Daily 29 Employee'));
  await overview.getByRole('button', { name: 'Export daily hours', exact: true }).click();
  assert.ok(await page.evaluate(() => window.attendanceScenario.calls.some(call => call.method === 'downloadDailyExcel' && call.args[0] === '2026-09-29')));
  await page.evaluate(() => { window.attendanceScenario.failExport = true; });
  await overview.getByRole('button', { name: 'Export daily hours', exact: true }).click();
  await overview.getByRole('alert').filter({ hasText: 'The daily report could not be exported. Please try again.' }).waitFor();
  assert.equal(await overview.getByLabel('Overview date', { exact: true }).inputValue(), '2026-09-29');
  await page.evaluate(() => { window.attendanceScenario.failExport = false; });
  await overview.getByRole('button', { name: 'Retry export', exact: true }).click();
  await overview.getByRole('button', { name: 'Retry export', exact: true }).waitFor({ state: 'detached' });
  await overview.getByRole('button', { name: 'Today', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-overview-attention tbody tr')?.textContent.includes('Daily 30 Employee'));
  assert.match(await overview.locator('.att-overview-scope').innerText(), /Excel includes all permitted records for the selected date/);
  record('Overview date navigation and daily-hours export preserve selected date and provide a working failure retry');

  await page.evaluate(() => { window.attendanceScenario.failDailyDates = ['2026-09-27']; });
  await overview.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await overview.getByRole('alert').filter({ hasText: 'Unavailable days: 27 Sept' }).waitFor();
  await waitOverviewCount(page);
  assert.match(await chart.getAttribute('aria-label'), /27 Sept?: unavailable/);
  assert.match(await panel('Seven-day attendance trend').innerText(), /6 of 7/);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '25', '2', '6', '19', '4']);
  await page.evaluate(() => { window.attendanceScenario.failDailyDates = []; });
  await overview.getByRole('button', { name: 'Retry trend', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.att-overview-chart')?.getAttribute('aria-label').includes('27 Sept: 31 records'));
  await page.evaluate(() => { window.attendanceScenario.deniedDailyDates = ['2026-09-30']; });
  await overview.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await overview.getByRole('alert').filter({ hasText: 'Daily attendance: Access denied.' }).waitFor();
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['—', '—', '2', '—', '—', '4']);
  assert.equal(await attentionRows.count(), 0);
  assert.equal(await departmentRows.count(), 0);
  await page.evaluate(() => { window.attendanceScenario.deniedDailyDates = []; });
  await overview.getByRole('button', { name: 'Retry daily attendance', exact: true }).click();
  await waitOverviewCount(page);
  await page.evaluate(() => { window.attendanceScenario.deferDailyDates = ['2026-08-29']; });
  await overview.getByLabel('Overview date', { exact: true }).fill('2026-08-29');
  await page.waitForFunction(() => !!window.attendanceScenario.pendingDaily['2026-08-29']);
  await page.evaluate(() => { window.attendanceScenario.obsoleteOverviewDay = window.attendanceScenario.pendingDaily['2026-08-29']; });
  assert.equal(await summary.locator('dd').first().innerText(), '—');
  assert.equal(await attentionRows.count(), 0, 'A different loading date clears prior attention rows');
  await overview.getByLabel('Overview date', { exact: true }).fill('2026-08-30');
  await waitOverviewCount(page);
  await page.evaluate(() => { window.attendanceScenario.obsoleteOverviewDay(); window.attendanceScenario.pendingDaily['2026-08-29'](); window.attendanceScenario.deferDailyDates = []; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await overview.getByLabel('Overview date', { exact: true }).inputValue(), '2026-08-30');
  assert.match(await attentionRows.first().innerText(), /Daily 30 Employee/);
  record('Overview partial trend failures, denied selected-date reads, retry and late responses retain honest date-specific state');

  await page.evaluate(() => { window.attendanceScenario.failOverviewBranch = 'RAD'; });
  await select('Branch').selectOption('RAD');
  await overview.getByRole('alert').filter({ hasText: 'Branch attendance: Could not be loaded.' }).waitFor();
  assert.equal(await select('Branch').inputValue(), 'RAD');
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['—', '—', '2', '—', '—', '4']);
  assert.equal(await attentionRows.count(), 0);
  assert.ok((await chart.getAttribute('aria-label')).split('; ').every(day => day.endsWith('unavailable')));
  await page.evaluate(() => { window.attendanceScenario.failOverviewBranch = null; });
  await overview.getByRole('button', { name: 'Retry branch attendance', exact: true }).click();
  await waitOverviewCount(page, '16');
  assert.equal(await select('Branch').inputValue(), 'RAD');
  await select('Branch').selectOption('all');
  await waitOverviewCount(page);
  record('Overview failed branch mapping withholds attendance and trend without falling back to all employees');

  await page.evaluate(() => { window.attendanceScenario.overviewBranchCodesByYear = { 2025: ['ATT001'], 2026: ['ATT002', 'ATT003'] }; });
  await overview.getByLabel('Overview date', { exact: true }).fill('2026-01-03');
  await select('Branch').selectOption('RAD');
  await waitOverviewCount(page, '2');
  assert.match(await chart.getAttribute('aria-label'), /28 Dec: 1 records.*31 Dec: 1 records.*1 Jan: 2 records.*3 Jan: 2 records/);
  assert.ok(await page.evaluate(() => [2025, 2026].every(year => window.attendanceScenario.calls.some(call => call.method === 'getBranchEmployeeCodes' && call.args[0] === 'RAD' && call.args[1] === year))));
  await select('Branch').selectOption('all');
  await page.evaluate(() => { window.attendanceScenario.overviewBranchCodesByYear = null; });
  record('Overview seven-day branch filtering uses each calendar year when the selected week crosses New Year');

  await overview.getByLabel('Overview date', { exact: true }).fill('2026-09-30');
  await waitOverviewCount(page);
  await page.evaluate(() => { const s = window.attendanceScenario; s.failOverviewLeave = true; s.failOverviewPending = 403; s.failCorrectionsPage = 2; s.failOverviewHolidayPage = 2; s.failOverviewHealth = true; });
  await overview.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  for (const label of ['Retry approved leave', 'Retry leave approvals', 'Retry hr corrections', 'Retry public holidays', 'Retry source health']) await overview.getByRole('button', { name: label, exact: true }).waitFor();
  await waitOverviewCount(page);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '25', '—', '6', '19', '—']);
  assert.equal(await correctionRows.count(), 0, 'A later correction-page failure does not show partial recent activity');
  assert.equal(await approvalRows.count(), 0);
  assert.match(await panel('Pending leave approvals').innerText(), /Access denied/);
  assert.doesNotMatch(await panel('Daily summary').innerText(), /None listed|Selected fixture holiday/);
  assert.doesNotMatch(await overview.innerText(), /private-synthetic|Private synthetic health diagnostics/);
  await page.evaluate(() => { const s = window.attendanceScenario; s.failOverviewLeave = false; s.failOverviewPending = false; s.failCorrectionsPage = null; s.failOverviewHolidayPage = null; s.failOverviewHealth = false; });
  await overview.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.att-overview-corrections tbody tr').length === 5);
  assert.deepEqual(await summary.locator('dd').allTextContents(), ['31', '25', '2', '6', '19', '4']);
  assert.match(await panel('Daily summary').innerText(), /Selected fixture holiday/);
  assert.equal(await overview.getByRole('alert').count(), 0);
  record('Overview independent leave/queue/health and later-page holiday/correction failures preserve attendance and recover without partial figures');

  await page.evaluate(() => { window.attendanceScenario.missingOverviewNumbers = true; });
  await overview.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.att-overview-summary dd')][4]?.textContent === '18');
  assert.match(await panel('Daily summary').innerText(), /Source regular hours\s*—[\s\S]*Recorded OT · unapproved\s*—[\s\S]*Expected hours \/ variance\s*Not available/);
  assert.deepEqual(await departmentRows.first().locator('td').allTextContents(), ['Delivery', '16', '13', '—', '—', '81.3%']);
  assert.deepEqual(await departmentRows.last().locator('td').allTextContents(), ['Engineering', '15', '12', '3', '60h', '80%']);
  assert.equal(await summary.locator('dd').first().innerText(), '31');
  await page.evaluate(() => { window.attendanceScenario.missingOverviewNumbers = false; });
  await overview.getByLabel('Overview date', { exact: true }).fill('2026-08-29');
  await page.waitForFunction(() => document.querySelector('.att-overview-attention tbody tr')?.textContent.includes('Daily 29 Employee'));
  await overview.getByRole('button', { name: 'Review Daily 29 Employee 01', exact: true }).click();
  await waitDailyRows(page, 1);
  assert.equal(await page.locator('.att-daily').getByLabel('Attendance date', { exact: true }).inputValue(), '2026-08-29');
  assert.equal(await page.locator('.att-daily').getByLabel('Search employees', { exact: true }).inputValue(), 'ATT001');
  assert.match(await dailyRows(page).first().innerText(), /Daily 29 Employee 01/);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await waitOverviewCount(page);
  await page.locator('.att-overview').getByRole('button', { name: 'Open monthly matrix', exact: true }).click();
  await waitRows(page);
  assert.equal(await page.getByLabel('Month', { exact: true }).inputValue(), '8');
  assert.equal(await page.getByLabel('Year', { exact: true }).inputValue(), '2026');
  assert.match(await matrixRows(page).first().innerText(), /August Employee 01/);
  await context.close();
  record('Overview missing numeric evidence stays unknown and Review/monthly links transfer the selected employee/date into existing views');

  const empty = await openOverview({ editor: false, scenario: { emptyDailyDates: Array.from({ length: 7 }, (_, index) => '2026-09-' + (24 + index)), emptyOverviewLeave: true, emptyOverviewPending: true, emptyOverviewHolidays: true, correctionMode: 'empty' } });
  await waitOverviewCount(empty.page, '0');
  await empty.page.getByText('No active corrections for this month.', { exact: true }).waitFor();
  assert.deepEqual(await empty.page.getByLabel('Overview attendance summary', { exact: true }).locator('dd').allTextContents(), ['0', '0', '0', '0', '0', '0']);
  await empty.page.getByText('No leave requests are waiting for your review.', { exact: true }).waitFor();
  assert.match(await empty.page.locator('.att-overview-chart').getAttribute('aria-label'), /24 Sept?: 0 records.*30 Sept?: 0 records/);
  assert.equal(await empty.page.locator('.att-overview').getByRole('button', { name: /^(Approve|Reject|Record attendance|Check in)$/i }).count(), 0);
  assert.equal(await empty.page.locator('.att-overview').getByRole('alert').count(), 0);
  await empty.close();
  record('Overview loaded empty and readonly states show actual zeros and no invented recording or approval actions');

  const mobile = await openOverview({ width: 390 });
  await waitOverviewCount(mobile.page);
  await assertGeometry(mobile.page, 390);
  await capture(mobile.page, 'attendance-overview-mobile', { activeTab: 'Overview' });
  await mobile.page.getByRole('region', { name: 'Requires attention', exact: true }).evaluate(node => node.scrollIntoView({ block: 'start' }));
  await mobile.page.screenshot({ path: path.join(artifacts, 'attendance-overview-mobile-attention.png'), animations: 'disabled' });
  assert.ok(await mobile.page.locator('.att-overview-attention').locator('..').evaluate(node => node.scrollWidth > node.clientWidth && node.getBoundingClientRect().right <= innerWidth), 'Overview attention columns scroll inside their card');
  await mobile.page.setViewportSize({ width: 320, height: 844 });
  await assertGeometry(mobile.page, 320);
  await capture(mobile.page, 'attendance-overview-mobile-320', { activeTab: 'Overview' });
  await mobile.close();
  record('Overview desktop and narrow mobile layouts preserve the shared shell and contain wide card tables');
}

try {
  const desktop = await newPage();
  const { page } = desktop;
  await waitRows(page);
  const title = page.getByRole('heading', { name: 'Attendance Management', exact: true });
  assert.equal(await title.count(), 1, 'Accessible page heading is retained');
  assert.ok(await title.evaluate(node => node.classList.contains('sr-only') && node.getBoundingClientRect().height <= 1), 'Large title block is visually removed');
  assert.equal(await page.getByText('Review monthly employee hours, absences and attendance exceptions.', { exact: true }).count(), 0);
  assert.equal(await page.locator('.att-actions').count(), 0, 'The removed top action panel is absent');
  const filters = page.locator('.att-filters');
  assert.equal(await filters.getByRole('button', { name: 'Export', exact: true }).count(), 1);
  assert.equal(await filters.getByRole('button', { name: 'Refresh attendance', exact: true }).count(), 1);
  assert.equal(await filters.getByLabel('Upload daily hours', { exact: true }).count(), 1);
  assert.ok(await filters.evaluate(node => {
    const year = node.querySelector('select[aria-label="Year"]');
    const exportButton = [...node.querySelectorAll('button')].find(button => button.textContent.trim() === 'Export');
    const upload = node.querySelector('input[aria-label="Upload daily hours"]');
    const sync = node.querySelector('input[aria-label="Sync leave"]');
    return !!(year.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !!(exportButton.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !!(upload.compareDocumentPosition(sync) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), 'Export/Upload actions sit between Year and Sync leave in the filter toolbar');
  assert.equal(await page.getByRole('button', { name: 'Monthly matrix', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await page.getByRole('navigation', { name: 'Attendance views', exact: true }).getByRole('button').allTextContents(), ['Overview', 'Daily', 'Monthly matrix', 'Yearly', 'Reports']);
  assert.equal(await page.getByRole('button', { name: 'Monthly totals', exact: true }).count(), 0, 'The removed Monthly totals tab is absent');
  assert.equal(await page.getByLabel('Month', { exact: true }).inputValue(), '9');
  assert.equal(await page.getByLabel('Year', { exact: true }).inputValue(), '2026');
  assert.equal(await matrixRows(page).count(), 25);
  await assertGeometry(page, 1788);
  await capture(page, 'attendance-desktop');
  record('Default matrix; large heading/top action panel removed; actions grouped between Year and Sync leave');

  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await waitRows(page, 6);
  assert.match(await matrixRows(page).first().innerText(), /September Employee 26/);
  await page.getByLabel('Employee search', { exact: true }).fill('Employee 03');
  await waitRows(page, 1);
  assert.match(await matrixRows(page).first().innerText(), /September Employee 03/);
  await page.getByLabel('Employee search', { exact: true }).fill('No matching employee');
  await page.waitForFunction(() => document.querySelectorAll('.att-matrix-table tbody tr').length === 0);
  await page.getByLabel('Employee search', { exact: true }).fill('');
  await waitRows(page);
  await page.getByRole('button', { name: 'Rejlers IN', exact: true }).click();
  await waitRows(page, 15);
  assert.match(await matrixRows(page).first().innerText(), /September Employee 02/);
  await page.getByRole('button', { name: 'Rejlers AB', exact: true }).click();
  await waitRows(page, 16);
  assert.match(await matrixRows(page).first().innerText(), /September Employee 01/);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await waitRows(page);
  record('Real employee search, branch filtering, empty state and pagination');

  const comfortableHeight = await matrixRows(page).first().evaluate(node => node.getBoundingClientRect().height);
  await page.getByLabel('Density', { exact: true }).selectOption('compact');
  const compactHeight = await matrixRows(page).first().evaluate(node => node.getBoundingClientRect().height);
  assert.ok(compactHeight < comfortableHeight, 'Compact density reduces row height');
  assert.equal(await page.getByRole('columnheader', { name: 'Total', exact: true }).count(), 1);
  assert.equal(await page.getByRole('columnheader', { name: 'Days', exact: true }).count(), 0);
  await page.getByText('Columns', { exact: true }).click();
  await page.getByLabel('Detailed totals', { exact: true }).check();
  assert.equal(await page.getByRole('columnheader', { name: 'Days', exact: true }).count(), 1);
  await page.getByLabel('Detailed totals', { exact: true }).uncheck();
  await page.getByText('Columns', { exact: true }).click();
  await page.getByLabel('Density', { exact: true }).selectOption('comfortable');
  const summaryText = await page.getByLabel('Filtered attendance summary', { exact: true }).innerText();
  assert.match(summaryText, /Recorded[\s\S]*741(?:\.00)?h/);
  assert.match(summaryText, /Expected[\s\S]*6,138(?:\.00)?h/);
  assert.match(summaryText, /HR corrections[\s\S]*1/);
  assert.equal(await page.getByRole('status').filter({ hasText: 'HR corrections could not be loaded.' }).count(), 0, 'Populated DRF results are read by the actual correction service without a warning');
  record('Density and detailed columns work; summary uses actual fixture hours and corrections');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByText('Select report type & format', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Excel (Pivot)', exact: true }).click();
  assert.ok(await page.evaluate(() => window.attendanceScenario.calls.some(call => call.method === 'downloadSummaryExcel' && call.args[0] === 2026 && call.args[1] === 9)));
  await page.evaluate(() => { window.attendanceScenario.failExport = true; });
  await page.getByRole('button', { name: 'PDF (Roll-up)', exact: true }).click();
  await page.getByText('Synthetic export unavailable.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  record('Export opens actual report panel, calls selected format and exposes service failure');

  await page.getByLabel('Employee search', { exact: true }).fill('Employee 01');
  await waitRows(page, 1);
  const upload = page.getByLabel('Upload daily hours', { exact: true });
  await upload.setInputFiles({ name: 'synthetic-attendance.csv', mimeType: 'text/csv', buffer: Buffer.from('employee_code,date,hours\nATT001,2026-09-01,8\n') });
  await page.getByRole('status').filter({ hasText: 'Synthetic attendance upload failed.' }).waitFor();
  assert.equal(await upload.evaluate(node => node.files?.[0]?.name), 'synthetic-attendance.csv');
  await page.getByRole('button', { name: 'Retry upload', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Synthetic attendance upload failed.' }).waitFor();
  assert.equal(await page.evaluate(() => window.attendanceScenario.calls.filter(call => call.method === 'uploadDailyAttendance').length), 2, 'Explicit retry submits the retained file again');
  assert.equal(await upload.evaluate(node => node.files?.[0]?.name), 'synthetic-attendance.csv');
  const sync = page.getByLabel('Sync leave', { exact: true });
  await sync.setInputFiles({ name: 'synthetic-leave.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('isolated-service-fixture') });
  await page.getByRole('status').filter({ hasText: 'Synthetic leave sync failed.' }).waitFor();
  assert.equal(await sync.evaluate(node => node.files?.[0]?.name), 'synthetic-leave.xlsx');
  await page.getByRole('button', { name: 'Retry sync', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Synthetic leave sync failed.' }).waitFor();
  assert.equal(await page.evaluate(() => window.attendanceScenario.calls.filter(call => call.method === 'syncLeaveData').length), 2);
  assert.equal(await page.getByLabel('Employee search', { exact: true }).inputValue(), 'Employee 01');
  assert.match(await matrixRows(page).first().innerText(), /September Employee 01/);
  await page.getByRole('button', { name: 'Edit September Employee 01, 2026-09-01', exact: true }).click();
  await page.getByRole('heading', { name: 'Edit Attendance', exact: true }).waitFor();
  const correctionDialog = page.getByRole('dialog', { name: 'Edit Attendance', exact: true });
  const correctionHours = correctionDialog.getByLabel('Corrected Hours', { exact: false });
  await correctionHours.fill('7.5');
  await correctionDialog.getByLabel('HR Note (optional)', { exact: true }).fill('Retain this correction note after failure.');
  await correctionDialog.getByRole('button', { name: 'Save Correction', exact: true }).click();
  await correctionDialog.getByText('Failed to save correction. Please try again.', { exact: true }).waitFor();
  assert.equal(await correctionHours.inputValue(), '7.5');
  assert.equal(await correctionDialog.getByLabel('HR Note (optional)', { exact: true }).inputValue(), 'Retain this correction note after failure.');
  await correctionDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByLabel('Employee search', { exact: true }).fill('');
  await waitRows(page);
  record('Upload, leave sync and correction failures retain input; file retries reuse the selected files');

  await page.evaluate(() => { window.attendanceScenario.failMonths = [8]; });
  await page.getByLabel('Month', { exact: true }).selectOption('8');
  await page.getByRole('alert').filter({ hasText: 'Synthetic attendance source unavailable.' }).waitFor();
  assert.equal(await matrixRows(page).count(), 0, 'Previous month rows are cleared on failure');
  await page.evaluate(() => { window.attendanceScenario.failMonths = []; });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await waitRows(page);
  assert.match(await matrixRows(page).first().innerText(), /August Employee 01/);
  await page.evaluate(() => { window.attendanceScenario.deferMonths = [7]; });
  await page.getByLabel('Month', { exact: true }).selectOption('7');
  await page.waitForFunction(() => !!window.attendanceScenario.pending[7]);
  assert.equal(await matrixRows(page).count(), 0, 'Loading hides the prior period');
  await page.getByLabel('Month', { exact: true }).selectOption('9');
  await waitRows(page);
  await page.evaluate(() => { window.attendanceScenario.pending[7](); window.attendanceScenario.deferMonths = []; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.match(await matrixRows(page).first().innerText(), /September Employee 01/);
  record('Monthly loading, error/retry and late-response protection keep period data accurate');

  await page.reload();
  await waitRows(page);
  for (const width of [1280, 768, 390]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await assertGeometry(page, width);
    await capture(page, `attendance-${width}`);
    if (width === 390) {
      const tableScroll = page.getByRole('region', { name: 'Employee daily hours matrix', exact: true });
      assert.ok(await tableScroll.evaluate(node => node.scrollWidth > node.clientWidth), 'Mobile day columns stay readable in their own horizontal scroller');
      await page.locator('.att-matrix-heading').evaluate(node => node.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: path.join(artifacts, 'attendance-mobile-matrix.png'), animations: 'disabled' });
    }
  }
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await assertGeometry(page, 390);
  const exportPanel = page.getByText('Select report type & format', { exact: true }).locator('..');
  assert.ok(await exportPanel.evaluate(node => { const b = node.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth; }), 'Export panel fits mobile viewport');
  await capture(page, 'attendance-mobile-export');
  await page.getByRole('button', { name: 'PDF (Summary)', exact: true }).click();
  assert.ok(await page.evaluate(() => window.attendanceScenario.calls.some(call => call.method === 'downloadYearlyPdf' && call.args[0] === 2026)), 'The last report format remains reachable in the mobile export panel');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  record('Desktop, tablet and mobile matrix/export fit without page overflow');
  await desktop.close();

  const readonly = await newPage({ editor: false });
  await waitRows(readonly.page);
  assert.equal(await readonly.page.getByLabel('Upload daily hours', { exact: true }).count(), 0);
  assert.equal(await readonly.page.getByLabel('Sync leave', { exact: true }).count(), 0);
  await matrixRows(readonly.page).first().locator('td').nth(1).click();
  assert.equal(await readonly.page.getByRole('dialog', { name: 'Edit Attendance', exact: true }).count(), 0);
  await readonly.close();
  record('Read-only users retain matrix access without upload, sync or correction controls');
  const failedCorrections = await newPage({ scenario: { failCorrections: true } });
  await waitRows(failedCorrections.page);
  await failedCorrections.page.getByRole('status').filter({ hasText: 'HR corrections could not be loaded.' }).waitFor();
  assert.deepEqual(await failedCorrections.page.getByLabel('Filtered attendance summary', { exact: true }).locator('dd').allTextContents(), ['—', '—', '—', '—'], 'Unavailable correction evidence does not manufacture zero counts or authoritative totals');
  await failedCorrections.page.evaluate(() => { window.attendanceScenario.failCorrections = false; });
  await failedCorrections.page.getByRole('button', { name: 'Retry corrections', exact: true }).click();
  await failedCorrections.page.waitForFunction(() => document.querySelector('.att-summary dd')?.textContent === '741h');
  assert.equal(await failedCorrections.page.getByRole('button', { name: 'Retry corrections', exact: true }).count(), 0);
  assert.deepEqual(await failedCorrections.page.getByLabel('Filtered attendance summary', { exact: true }).locator('dd').allTextContents(), ['741h', '6,138h', '-5,397h', '1']);
  await failedCorrections.close();
  record('Unavailable corrections show missing summary values and recover through explicit retry');

  const emptyCorrections = await newPage({ scenario: { correctionMode: 'empty' } });
  await waitRows(emptyCorrections.page);
  await emptyCorrections.page.waitForFunction(() => document.querySelector('.att-summary dd')?.textContent === '744h');
  assert.deepEqual(await emptyCorrections.page.getByLabel('Filtered attendance summary', { exact: true }).locator('dd').allTextContents(), ['744h', '6,138h', '-5,394h', '0']);
  assert.equal(await emptyCorrections.page.getByRole('status').filter({ hasText: 'HR corrections could not be loaded.' }).count(), 0, 'An empty paginated response is valid absence of corrections');
  correctionEvidence.push({ scenario: 'empty', requests: await emptyCorrections.page.evaluate(() => window.attendanceScenario.correctionRequests) });
  await emptyCorrections.close();
  record('Actual correction service accepts empty DRF results without warning or missing totals');

  const multipleCorrections = await newPage({ scenario: { correctionMode: 'multiple' } });
  await waitRows(multipleCorrections.page);
  await multipleCorrections.page.waitForFunction(() => document.querySelector('.att-summary dd')?.textContent === '733h');
  assert.deepEqual(await multipleCorrections.page.getByLabel('Filtered attendance summary', { exact: true }).locator('dd').allTextContents(), ['733h', '6,138h', '-5,405h', '3']);
  assert.equal(await multipleCorrections.page.getByRole('status').filter({ hasText: 'HR corrections could not be loaded.' }).count(), 0);
  const multipleRequests = await multipleCorrections.page.evaluate(() => window.attendanceScenario.correctionRequests);
  assert.deepEqual(multipleRequests.map(request => Number(request.params.page || 1)), [1, 2, 3]);
  assert.ok(multipleRequests.every(request => request.url === '/payroll/attendance-overrides/' && request.params.year === 2026 && request.params.month === 9));
  correctionEvidence.push({ scenario: 'multiple', requests: multipleRequests });
  const scopedRead = await multipleCorrections.page.evaluate(async () => {
    window.attendanceScenario.correctionRequests = [];
    const rows = await window.attendanceReadCorrections(2025, 8, { reason: 'hr_correction' });
    return { rows, requests: window.attendanceScenario.correctionRequests };
  });
  assert.equal(scopedRead.rows.length, 3, 'The actual service returns all pages as the array expected by the UI');
  assert.deepEqual(scopedRead.requests.map(request => request.params), [1, 2, 3].map(page => ({ year: 2025, month: 8, reason: 'hr_correction', page })));
  assert.ok(scopedRead.requests.every(request => request.url === '/payroll/attendance-overrides/'), 'Continuation uses the original endpoint');
  correctionEvidence.push({ scenario: 'preserved-period-and-filter', requests: scopedRead.requests });
  await multipleCorrections.close();
  record('Actual correction service reads every page and preserves period/filter scope on the original endpoint');

  const partialCorrections = await newPage({ scenario: { correctionMode: 'multiple', failCorrectionsPage: 2 } });
  await waitRows(partialCorrections.page);
  await partialCorrections.page.getByRole('status').filter({ hasText: 'HR corrections could not be loaded.' }).waitFor();
  assert.deepEqual(await partialCorrections.page.getByLabel('Filtered attendance summary', { exact: true }).locator('dd').allTextContents(), ['—', '—', '—', '—'], 'A later-page failure does not expose partial correction totals');
  const partialRequests = await partialCorrections.page.evaluate(() => window.attendanceScenario.correctionRequests);
  assert.deepEqual(partialRequests.map(request => Number(request.params.page || 1)), [1, 2]);
  await partialCorrections.page.evaluate(() => { window.attendanceScenario.failCorrectionsPage = null; window.attendanceScenario.correctionRequests = []; });
  await partialCorrections.page.getByRole('button', { name: 'Retry corrections', exact: true }).click();
  await partialCorrections.page.waitForFunction(() => document.querySelector('.att-summary dd')?.textContent === '733h');
  assert.deepEqual(await partialCorrections.page.getByLabel('Filtered attendance summary', { exact: true }).locator('dd').allTextContents(), ['733h', '6,138h', '-5,405h', '3']);
  assert.equal(await partialCorrections.page.getByRole('button', { name: 'Retry corrections', exact: true }).count(), 0);
  const retriedRequests = await partialCorrections.page.evaluate(() => window.attendanceScenario.correctionRequests);
  assert.deepEqual(retriedRequests.map(request => Number(request.params.page || 1)), [1, 2, 3]);
  correctionEvidence.push({ scenario: 'second-page-failure-and-retry', failedRequests: partialRequests, retriedRequests });
  await partialCorrections.close();
  record('Second-page correction failures withhold partial totals and explicit retry reloads every page');

  for (const [module, heading] of [['leave', 'Leave Management'], ['payroll', 'Payroll Management']]) {
    const smoke = await newPage({ module });
    const title = smoke.page.getByRole('heading', { name: heading, exact: true });
    await title.waitFor();
    assert.ok(await title.evaluate(node => !node.classList.contains('sr-only') && node.getBoundingClientRect().height > 1), `${heading} keeps its visible shared-shell title`);
    await smoke.page.getByTestId('other-module-body').waitFor({ state: 'attached' });
    await smoke.close();
  }
  record('Attendance-only title removal preserves visible Payroll and Leave shell headings');
  await checkDailyViews();
  await checkYearlyViews();
  await checkOverviewViews();
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  assert.deepEqual(unexpectedRequests, [], 'No live or unexpected network requests');
  await writeFile(path.join(artifacts, 'verification.json'), JSON.stringify({ checks, geometry, correctionEvidence, errors, unexpectedRequests, fixtureBoundary: 'Actual Payroll attendance, Layout, header/sidebar, payrollService.getAttendanceOverrides and getPendingLeaveApprovals; apiClient GET uses synthetic correction DRF envelopes and current-user leave queue, other service calls use isolated fixtures; Payroll/Leave title smoke checks use placeholder module bodies; no live APIs or business writes.' }, null, 2));
  console.log(`Passed ${checks.length} bounded attendance checks. Artifacts: ${artifacts}`);
} catch (error) {
  await writeFile(path.join(artifacts, 'verification-failure.json'), JSON.stringify({ checks, geometry, errors, unexpectedRequests, failure: error.stack }, null, 2));
  throw error;
} finally {
  await browser.close();
}
