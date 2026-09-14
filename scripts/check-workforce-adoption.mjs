import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const groups=Array.from({length:12},(_,i)=>({id:`d${i}`,name:i===0?'=Example team':`Department ${i+1}`,organization:'Test organization',eligible:2,wau:1,mau:2,adoption_rate:50,previous_wau:1,returning:i<6?1:0,repeat_rate:i<6?100:0}));
const report={generated_at:'2026-09-11T12:00:00Z',scope:'Your organization',window:{start:'2026-08-31T00:00:00Z',end:'2026-09-07T00:00:00Z',month_start:'2026-09-01T00:00:00Z',partial:false},totals:{eligible:24,wau:12,mau:24,previous_wau:12,returning:6,weekly_adoption_rate:50,repeat_rate:50,no_observed_use:12,average_active_days:2},departments:groups,teams:groups.map((r,i)=>({...r,name:`Manager ${i+1}`})),trend:Array.from({length:8},(_,i)=>({week_start:new Date(Date.UTC(2026,6,13+i*7)).toISOString(),wau:i,eligible:24,adoption_rate:Math.round(i/24*100)})),quality:{eligibility_basis:'Active employee accounts with RADAI module access.',history_basis:'Current eligibility and current department/manager assignments are used for every period.',usage_basis:'Recorded RADAI activity, including page visits.',missing_data:'No observed use does not prove non-use.',unlinked_accounts:3,inactive_employees:1,excluded_accounts:1,employees_without_module_access:2,modules:[{code:'example',name:'Example AI'}]},effectiveness:{reason:'Requires task baselines, accepted outputs and review/rework measurements.'}};
report.engagement={version:'observed-engagement-40-30-30-v1',start:'2026-08-10T00:00:00Z',end:'2026-09-07T00:00:00Z',methodology:'Observed engagement, not productivity.',people:Array.from({length:12},(_,i)=>({user_id:String(i),name:`Employee ${i+1}`,department:'Engineering',organization:'Test',active_days:i,modules_used:1,entitled_modules:2,active_weeks:2,score:i?53:null,band:i?'Moderate':'Unknown'}))};
const fixture=`export default{getWorkforceAdoption:async(week)=>{window.lastWeek=week;if(window.fail)throw Error('failure');const r=${JSON.stringify(report)};if(window.empty){r.departments=[];r.teams=[];r.totals={...r.totals,eligible:0,wau:0,mau:0,weekly_adoption_rate:null,repeat_rate:null}}return r}};`;
const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import Page from'./src/pages/Admin/WorkforceAdoption';createRoot(document.getElementById('root')).render(<div className="ai-adoption-workspace ad-reference-workspace"><Page/></div>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/services[\\/]analyticsService\.js$/},()=>({loader:'js',contents:fixture}));}}]});
await mkdir('../artifacts/ai-adoption',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0}</style><div id="root"></div>');
 for(const file of ['AIAdoptionDashboard.css','WorkforceAdoption.css'])await page.addStyleTag({content:await readFile(`src/pages/Admin/${file}`,'utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('heading',{name:'Adoption by department and team'}).waitFor();
 assert.deepEqual(await page.locator('.wa-kpis strong').allTextContents(),['24','50%','24','50%']);
 await page.getByRole('button',{name:'Next groups',exact:true}).click();assert.equal(await page.locator('.wa-main table').first().locator('tbody tr').count(),2);
 await page.getByRole('textbox',{name:'Search adoption groups'}).fill('=Example');assert.equal(await page.locator('.wa-main table').first().locator('tbody tr').count(),1);
 const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Export adoption',exact:true}).click();const csv=await readFile(await(await promise).path(),'utf8');assert.ok(csv.includes("'=Example"));assert.ok(csv.includes('Current eligibility'));assert.ok(!csv.includes('Department 2'));
 await page.getByRole('button',{name:'Reset adoption filters'}).click();
 await page.getByRole('button',{name:/Repeat weekly usage/}).click();assert.equal(await page.locator('.wa-main table').first().locator('tbody tr').count(),6);
 await page.getByRole('button',{name:'Manager teams',exact:true}).click();assert.ok(await page.getByRole('cell',{name:'Manager 1',exact:true}).count());
 await page.getByRole('button',{name:'Reset adoption filters'}).click();await page.screenshot({path:'../artifacts/ai-adoption/workforce-desktop.png',fullPage:true});
 await page.getByRole('combobox',{name:'Adoption reporting week'}).selectOption({index:2});assert.ok(await page.evaluate(()=>window.lastWeek));
 await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.screenshot({path:'../artifacts/ai-adoption/workforce-dark.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'../artifacts/ai-adoption/workforce-mobile.png',fullPage:true});
 await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'Refresh workforce adoption'}).click();await page.getByRole('heading',{name:'Workforce report unavailable'}).waitFor();assert.equal(await page.locator('.wa-kpis').count(),0);
 await page.evaluate(()=>{window.fail=false;window.empty=true});await page.getByRole('button',{name:'Retry workforce report'}).click();await page.getByRole('heading',{name:'No eligible employees identified'}).waitFor();assert.equal(await page.locator('.wa-kpis strong').nth(1).textContent(),'Not available');
 await page.getByRole('textbox',{name:'Search engagement',exact:true}).fill('Employee 12');assert.equal(await page.getByRole('cell',{name:/Employee 12/}).count(),1);
 await page.getByRole('textbox',{name:'Search engagement',exact:true}).fill('');await page.getByRole('combobox',{name:'Engagement band'}).selectOption('Unknown');assert.equal(await page.getByRole('cell',{name:/Employee 1\s*Engineering/}).count(),1);
 assert.deepEqual(errors,[]);console.log('PASS: workforce cards, group filters, team view, pagination, safe filtered CSV, week selector, coverage/empty/error states and mobile/dark');
}finally{await browser.close();}
