import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readFile, mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const rows = Array.from({length:12}, (_, i) => ({id:`run-${i+1}`,user:`Employee ${i+1}`,module:'planning_package',operation:'job:generate',status:'completed',started_at:'2026-09-11T08:00:00Z',source_type:'planning_intelligence.PlanningGeneration',source_id:String(i+1),sdk_calls:3,can_record_outcome:true}));
const fixture = `export default {getAIMeasurements:async p=>{window.lastQuery=p;if(window.fail)throw Error('offline');const all=${JSON.stringify(rows)}.filter(r=>(!p.search||r.user.includes(p.search))&&(!p.module||p.module===r.module));return {count:all.length,page:p.page,results:all.slice((p.page-1)*10,p.page*10),totals:{ai_workflows:12,completed_ai_workflows:12,active_users:12,derived_sessions:12,sdk_calls:36,successful_sdk_calls:34,stalled_workflows:1,eligible_employees:20,sessions_per_active_employee_per_week:0.23,sessions_per_eligible_employee_per_week:0.14},latest_snapshot:null,snapshot_stale:true,snapshot_fresh_organizations:0,snapshot_organizations:1,coverage:[{module:'planning_package',name:'Planning packages',status:'Instrumented pilot',paths:['Schedule generation'],boundary:'Provider calls only',sdk_calls:36,pricing_missing:2,last_request:null,reconciliation:{status:'Missing workflow links',unlinked_outputs:1}},{module:'designiq',name:'DesignIQ',status:'Not instrumented',paths:[],boundary:'No adapter',sdk_calls:0,pricing_missing:0,last_request:null}],methodology:{version:'pilot-workflow-v1',sessions:'Thirty-minute inactivity boundary',requests:'SDK calls are not user prompts',coverage:'No inferred workforce coverage'}}}}`;
const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import Page from'./src/pages/Admin/AIWorkflowMeasurements';createRoot(document.getElementById('root')).render(<div className="ai-adoption-workspace ad-reference-workspace"><Page onRecordOutcome={r=>window.selectedWorkflow=r}/></div>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/services[\\/]analyticsService\.js$/},()=>({loader:'js',contents:fixture}));}}]});
await mkdir('../artifacts/ai-adoption',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0}</style><div id="root"></div>');
 for(const name of ['AIAdoptionDashboard.css','AIWorkflowMeasurements.css'])await page.addStyleTag({content:await readFile(`src/pages/Admin/${name}`,'utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('heading',{name:'Workflow register',exact:true}).waitFor();
 assert.deepEqual(await page.locator('.ad-kpi strong').allTextContents(),['12','12','12','36']);
 await page.getByText('Workforce snapshot needs attention',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Next workflows',exact:true}).click();await page.getByRole('cell',{name:/Employee 12/}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Record outcome',exact:true}).count(),2);
 await page.getByRole('textbox',{name:'Search workflows'}).fill('Employee 12');await page.getByText('1 workflows · Page 1 of 1',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Record outcome',exact:true}).click();assert.equal(await page.evaluate(()=>window.selectedWorkflow.id),'run-12');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export this page'}).click();const csv=await readFile(await(await downloadPromise).path(),'utf8');assert.ok(csv.includes('run-12'));assert.ok(!csv.includes('run-11'));
 await page.getByRole('textbox',{name:'Search workflows'}).fill('');await page.getByRole('combobox',{name:'Workflow module'}).selectOption('designiq');await page.getByRole('cell',{name:/No server workflow measurements/}).waitFor();
 await page.getByRole('combobox',{name:'Workflow module'}).selectOption('');await page.getByRole('cell',{name:/Employee 1\s*run-1/}).waitFor();
 await page.screenshot({path:'../artifacts/ai-adoption/measurements-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'../artifacts/ai-adoption/measurements-mobile.png',fullPage:true});
 await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'Refresh measurements'}).click();await page.getByRole('alert').waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: workflow metrics, coverage gaps, stale snapshots, pagination, search, module filters, linked outcome action, CSV, error and mobile states');
} finally {await browser.close();}
