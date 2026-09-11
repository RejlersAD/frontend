import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const bundle = await build({ stdin: { contents: `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Workspace,{ProfileWorkspaceNavigation} from './src/components/HR/ProfileOverviewWorkspace';
const data={profile:{id:'self',department:'delivery',manager_detail:{id:'manager',name:'Morgan Lee'}},organizationEmployees:[{id:'manager',name:'Morgan Lee',department:'delivery'},{id:'self',name:'Self User',department:'delivery'},{id:'other',name:'Other Department',department:'sales'},...Array.from({length:8},(_,i)=>({id:String(i),name:'Colleague '+i,job_title:'Project Engineer',department:'delivery'}))],monthlyTs:{total_hours:32.2667,expected_hours:40},leaveRecord:{leave_balance:3.7,annual_entitlement:24},leaveRequests:[{id:'leave',status:'PENDING',created_at:'2026-09-09'}],slips:[{id:'slip',month:9,year:2026,status:'Draft',net_salary:987654,basic_salary:123456}],documents:[{id:'letter',document_file_name:'Employment letter',updated_at:'2026-08-18'},{id:'policy',document_file_name:'Policy acknowledgment',updated_at:'2026-08-04'}]};
function App(){const [tab,setTab]=useState('overview');const [missing,setMissing]=useState(false);window.setMissing=setMissing;return <div className="epw-page"><div className="epw-container"><ProfileWorkspaceNavigation activeTab={tab} onChange={t=>{setTab(t);window.tab=t}}/><Workspace {...(missing?{profile:{department:'delivery'},organizationEmployees:null,todayData:{status:'missing',total_hours:0},leaveAvailable:false,documents:null}:data)} onNavigate={t=>window.tab=t} onRefresh={()=>window.refreshed=true} onDownloadPayslip={s=>window.downloaded=s.id}/></div></div>}
createRoot(document.getElementById('root')).render(<App/>);`, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' } });
await mkdir('../artifacts/profile-workspace', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<style>body{margin:0}button{font-family:inherit}</style><div id="root"></div>');
  await page.addStyleTag({ content: await readFile('src/components/HR/ProfileOverviewWorkspace.css', 'utf8') });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole('heading', { name: 'Organization', exact: true }).waitFor();
  assert.equal(await page.locator('.epw-primary-nav button').count(), 15);
  assert.equal(await page.locator('.epw-signal').count(), 4);
  assert.ok((await page.locator('.epw-signals').textContent()).includes('32h 16m'));
  assert.ok(!(await page.locator('body').textContent()).includes('987654'));
  assert.ok(!(await page.locator('body').textContent()).includes('123456'));
  for (const [name, destination] of [['Request leave','leave'],['Update personal details','career'],['Submit timesheet','daily_tracker'],['View payslip','payroll']]) {
    await page.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.evaluate(() => window.tab), destination);
  }
  assert.equal(await page.locator('.epw-org-colleagues li').count(), 6);
  assert.equal(await page.locator('.epw-org-manager strong').innerText(), 'Morgan Lee');
  assert.ok(!(await page.locator('.epw-org-colleagues').innerText()).includes('Other Department'));
  assert.ok(!(await page.locator('.epw-org-colleagues').innerText()).includes('Morgan Lee'));
  assert.ok(!(await page.locator('.epw-org-colleagues').innerText()).includes('Self User'));
  assert.equal(await page.getByRole('heading', { name: 'My day', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Download payslip', exact: true }).click();
  assert.equal(await page.evaluate(() => window.downloaded), 'slip');
  const destinations = [
    ['Overview','overview'],['Career Profile','career'],['My Signature','signature'],['My Work','workspace'],
    ['Leave','leave'],['Attendance','attendance'],['Timesheet','timesheet'],['Payroll','payroll'],
    ['My Requests','requests'],['Performance','performance'],['Schedule','schedule'],['Daily Tracker','daily_tracker'],
    ['Site Visits','site_visits'],['Digital Twin','twin'],['HR Assistant','assistant'],
  ];
  const navigation = page.getByRole('navigation', { name: 'Employee profile sections' });
  assert.deepEqual(await navigation.locator('button').allTextContents(), destinations.map(([name]) => name));
  for (const [name, destination] of destinations) {
    await navigation.getByRole('button', { name, exact: true }).click();
    assert.equal(await page.evaluate(() => window.tab), destination);
    assert.equal(await navigation.getByRole('button', { name, exact: true }).getAttribute('aria-current'), 'page');
  }
  assert.equal(await page.getByRole('button', { name: 'More', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: '../artifacts/profile-workspace/fixture-desktop.png', fullPage: true });
  await page.evaluate(() => window.setMissing(true));
  await page.getByText('Not assigned', { exact: true }).waitFor();
  await page.getByText('Colleagues are currently unavailable.', { exact: true }).waitFor();
  assert.equal(await page.getByText('0h 0m', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Download payslip', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), null);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.ok(await navigation.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
  assert.equal(await navigation.locator('button:visible').count(), 15);
  await page.screenshot({ path: '../artifacts/profile-workspace/fixture-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: all 15 destinations, four signals, action navigation, private pay, organization filtering, download, missing data, empty documents, and mobile layout.');
} finally { await browser.close(); }
