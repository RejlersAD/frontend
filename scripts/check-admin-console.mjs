import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import postcss from 'postcss';
const out = '../artifacts/admin-console';
await mkdir(out, { recursive: true });
const fixture = {
 getDashboardOverview: { active_users_today:70,total_users:355,environment:'Production',region:'UAE North (ae-north-1)',version:'v1.0.0',deploy_state:'Deployed',storage_used_gb:75,storage_total_gb:100,database_used_gb:16,database_total_gb:50,api_requests_count:28000,api_requests_limit:100000,mfa_adoption_percentage:98,privileged_admins:5,last_access_review:'24 days ago' },
 getLatestHealthCheck: { overall_status:'healthy',authentication_status:'healthy',api_status:'healthy',database_status:'healthy',storage_status:'healthy',celery_status:'healthy',ai_status:'degraded',check_time:new Date().toISOString(),response_times:{authentication:42,api:84,database:12,storage:28,celery:36,ai:120},error_rates:{authentication:0,api:0,database:0,storage:0,celery:0,ai:0} },
 getSecurityAlerts:[],getHighPriorityInsights:[{id:1,title:'Review AI configuration finding',description:'Potential configuration drift detected in AI Services.',severity:'high',created_at:new Date().toISOString()}],
 getRealTimeActivity: ['Updated role permissions','Activated user account','Changed storage policy','Updated application settings'].map((description,i)=>({description,user_email:['Firaol Akawak','Sara Ahmed','Oskar Lindberg','Firaol Akawak'][i],timestamp:new Date().toISOString(),metadata:{resource_id:['Data Analysts','m.rahman@rejlers.com','Production (AWS S3)','RADAI Core'][i],success:true}})),getLatestMetrics:{active_connections:70}
};
const bundle = await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {MemoryRouter} from 'react-router-dom';import Admin from './src/pages/AdminDashboard';const state={auth:{user:{first_name:'Firaol',is_superuser:true}},rbac:{currentUser:{roles:[{code:'super_admin'}]}}};const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><Admin /></MemoryRouter></Provider>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,loader:{'.css':'empty'},format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/services[\\/]analyticsService\.js$/},()=>({contents:`const fixtures=${JSON.stringify(fixture)};export default Object.fromEntries(Object.entries(fixtures).map(([key,value])=>[key,async()=>{window.refreshCalls=(window.refreshCalls||0)+1;if(window.failAnalytics)throw Error('offline');return value}]));`,loader:'js'}));b.onLoad({filter:/store[\\/]slices[\\/]rbacSlice\.js$/},()=>({contents:'export const fetchCurrentUser=()=>({type:"test"});export const fetchUserStats=fetchCurrentUser;',loader:'js'}));b.onLoad({filter:/services[\\/]rbac\.service\.js$/},()=>({contents:'export default {};',loader:'js'}));}}]});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>');
 const sharedStyles = postcss.parse(await readFile('src/index.css', 'utf8')).nodes.filter(node => node.type === 'rule' && [':root', '.dark'].includes(node.selector)).map(node => node.toString()).join('\n');
 await page.addStyleTag({content:sharedStyles});
 await page.addStyleTag({content:await readFile('src/pages/AdminDashboard.css','utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByText('70',{exact:true}).first().waitFor();
 assert.equal(await page.locator('.ac-signal').first().evaluate(node => getComputedStyle(node).boxShadow), 'none');
 assert.equal(await page.locator('.ac-primary').first().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(55, 48, 163)');
 await page.screenshot({path:`${out}/desktop.png`,fullPage:true});
 await page.evaluate(() => document.documentElement.classList.add('dark'));
 assert.equal(await page.locator('.ac-panel').first().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(15, 23, 42)');
 await page.screenshot({path:`${out}/desktop-dark.png`,fullPage:true});
 await page.evaluate(() => document.documentElement.classList.remove('dark'));
 await page.getByRole('textbox',{name:'Filter services',exact:true}).fill('PostgreSQL');assert.equal(await page.locator('.ac-services tbody tr').count(),1);
 await page.getByRole('textbox',{name:'Filter services',exact:true}).fill('');
 await page.locator('.ac-services').getByRole('button',{name:'View details'}).first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Create admin task'}).click();await page.getByLabel('Task title').fill('Review access');await page.getByRole('button',{name:'Save draft'}).click();await page.getByRole('heading',{name:'Task draft created'}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Open security'}).click();await page.getByRole('heading',{name:'Security incidents'}).waitFor();await page.getByRole('tab',{name:'Overview',exact:true}).click();
 const calls=await page.evaluate(()=>window.refreshCalls);await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(previous=>window.refreshCalls>previous,calls);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile overflow');
 await page.evaluate(()=>window.failAnalytics=true);await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('status').waitFor();assert.equal(await page.getByText('Security incident status unavailable.',{exact:true}).count(),1);
 assert.deepEqual(errors,[]);console.log('Passed: desktop/mobile rendering, service search, details dialog, task draft, security navigation, refresh, unavailable-data states, and no mobile overflow.');
}finally{await browser.close();}
