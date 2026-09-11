import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import postcss from 'postcss';
const out = '../artifacts/admin-console';
await mkdir(out, { recursive: true });
const fixture = {
 getDashboardOverview: { active_users_today:70,total_users:355,environment:'Production',region:'UAE North (ae-north-1)',version:'v1.0.0',deploy_state:'Deployed',storage_used_gb:32.15,storage_total_gb:null,disk_used_gb:350.22,disk_total_gb:500,s3:{status:'connected',total_files:23261,total_size_gb:32.15,bucket:'production-test',region:'test-region',checked_at:new Date().toISOString()},database_used_gb:16,database_total_gb:50,api_requests_count:28000,api_requests_limit:100000,mfa_adoption_percentage:98,privileged_admins:5,last_access_review:'2026-08-17T10:00:00Z' },
 getLatestHealthCheck: { overall_status:'healthy',authentication_status:'healthy',api_status:'healthy',database_status:'healthy',storage_status:'healthy',disk_status:'healthy',redis_status:'healthy',celery_status:'healthy',ai_status:'degraded',check_time:new Date().toISOString(),response_times:{authentication:42,api:84,database:12,disk:1,redis:2,celery:36,ai:120},error_rates:{authentication:0,api:0,ai:10} },
 getSecurityAlerts:[],getHighPriorityInsights:[{id:1,title:'Review AI configuration finding',description:'Potential configuration drift detected in AI Services.',severity:'high',created_at:new Date().toISOString()}],
 getRealTimeActivity: ['Updated role permissions','Activated user account','Changed storage policy','Updated application settings'].map((description,i)=>({description,user_email:['Firaol Akawak','Sara Ahmed','Oskar Lindberg','Firaol Akawak'][i],timestamp:new Date().toISOString(),metadata:{resource_repr:['Data Analysts','m.rahman@rejlers.com','Production (AWS S3)','RADAI Core'][i],success:true}})),getLatestMetrics:{active_connections:70,cpu_usage_percentage:51.5,memory_usage_mb:2048},getHealthCheckHistory:Array.from({length:36},(_,i)=>({check_time:new Date(Date.now()-(35-i)*40*60000).toISOString(),overall_status:i===27?'critical':i===12?'degraded':'healthy'}))
};
const bundle = await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {MemoryRouter} from 'react-router-dom';import Admin from './src/pages/AdminDashboard';const state={auth:{user:{first_name:'Firaol',is_superuser:true}},rbac:{currentUser:{roles:[{code:'super_admin'}]}}};const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>{}};createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><Admin /></MemoryRouter></Provider>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,loader:{'.css':'empty'},format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/services[\\/]analyticsService\.js$/},()=>({contents:`const fixtures=${JSON.stringify(fixture)};export default Object.fromEntries(Object.entries(fixtures).map(([key,value])=>[key,async(...args)=>{window.refreshCalls=(window.refreshCalls||0)+1;if(window.failAnalytics)throw Error('offline');if(key==='getRealTimeActivity')window.activityHours=args[1];if(key==='getDashboardOverview'&&window.s3Offline)return {...value,s3:{status:'offline',message:'Storage service unavailable'}};return value}]));`,loader:'js'}));b.onLoad({filter:/store[\\/]slices[\\/]rbacSlice\.js$/},()=>({contents:'export const fetchCurrentUser=()=>({type:"test"});export const fetchUserStats=fetchCurrentUser;',loader:'js'}));b.onLoad({filter:/services[\\/]rbac\.service\.js$/},()=>({contents:'export default {};',loader:'js'}));}}]});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>');
 const sharedStyles = postcss.parse(await readFile('src/index.css', 'utf8')).nodes.filter(node => node.type === 'rule' && [':root', '.dark'].includes(node.selector)).map(node => node.toString()).join('\n');
 await page.addStyleTag({content:sharedStyles});
 await page.addStyleTag({content:(await readFile('src/pages/AdminDashboard.css','utf8')).replace(/^@import.*$/gm,'')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('heading',{name:'System Health',exact:true}).waitFor();
 await page.getByText('32.15 GB',{exact:true}).waitFor();
 const type=await page.locator('h1').evaluate(node=>({size:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight,font:getComputedStyle(node).fontFamily}));
 assert.equal(await page.locator('.ac-activity td').first().evaluate(node=>getComputedStyle(node).fontSize),'13px');
 assert.equal(type.size,'28px');assert.equal(type.line,'36px');assert.ok(type.font.includes('Segoe UI Variable'));
 assert.equal(await page.locator('.ac-panel').first().evaluate(node=>getComputedStyle(node).borderRadius),'8px');
 assert.equal(await page.locator('.ac-primary').first().evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(7, 91, 255)');
 assert.equal(await page.locator('.ac-services tbody tr').first().evaluate(node=>Math.round(node.getBoundingClientRect().height)),51);
 const columns=await page.locator('.ac-content-grid').evaluate(node=>[...node.children].map(child=>child.getBoundingClientRect().width));assert.ok(Math.abs(columns[0]/(columns[0]+columns[1])-.65)<.01);
 assert.ok(await page.locator('.ac-incident').evaluate(node=>node.getBoundingClientRect().bottom)<=await page.locator('.ac-signals').evaluate(node=>node.getBoundingClientRect().top));
 await page.screenshot({path:`${out}/desktop.png`,fullPage:true});
 await page.evaluate(()=>document.documentElement.classList.add('dark'));assert.equal(await page.locator('.ac-panel').first().evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(15, 23, 42)');await page.screenshot({path:`${out}/desktop-dark.png`,fullPage:true});await page.evaluate(()=>document.documentElement.classList.remove('dark'));
 await page.getByRole('textbox',{name:'Filter services',exact:true}).fill('PostgreSQL');assert.equal(await page.locator('.ac-services>.ac-table-scroll tbody tr').count(),1);
 await page.locator('.ac-services>.ac-table-scroll').getByRole('button',{name:'View service'}).click();await page.locator('.ac-service-details').getByRole('heading',{name:'PostgreSQL',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Filter services',exact:true}).fill('');
 await page.locator('.ac-services>.ac-table-scroll tr').filter({hasText:'AWS S3 Storage'}).getByRole('button',{name:'View service'}).click();await page.getByText('23,261 files',{exact:true}).waitFor();
 await page.locator('.ac-activity').getByRole('button',{name:'Details',exact:true}).first().click();await page.getByRole('dialog').getByText('Data Analysts',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').locator('pre').count(),0);await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'Maintenance',exact:true}).click();await page.getByRole('button',{name:'Create admin task'}).click();await page.getByLabel('Task title').fill('Review access');await page.getByRole('button',{name:'Save draft'}).click();await page.getByRole('heading',{name:'Task draft created'}).waitFor();await page.keyboard.press('Escape');
 await page.getByRole('tab',{name:'Incidents',exact:true}).click();await page.getByText('No active security incidents.',{exact:true}).waitFor();await page.getByRole('tab',{name:'Overview',exact:true}).click();
 await page.keyboard.press('Tab');await page.getByRole('button',{name:'Refresh',exact:true}).focus();assert.equal(await page.getByRole('button',{name:'Refresh',exact:true}).evaluate(node=>getComputedStyle(node).outlineWidth),'2px');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile overflow');
 await page.getByLabel('Activity time range').selectOption('168');await page.waitForFunction(()=>window.activityHours===168);
 await page.evaluate(()=>window.s3Offline=true);await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.locator('.ac-s3').getByText('Storage service unavailable',{exact:true}).waitFor();assert.equal(await page.locator('.ac-services>.ac-table-scroll tr').filter({hasText:'AWS S3 Storage'}).getByText('Critical',{exact:true}).count(),1);
 await page.setViewportSize({width:1672,height:941});await page.screenshot({path:`${out}/desktop-critical.png`,fullPage:true});
 await page.evaluate(()=>window.failAnalytics=true);await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('status').waitFor();await page.getByText('Incident status unavailable',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Passed: typography, 65/35 layout, incident priority, service selection, S3 data, activity details, tabs, task draft, focus ring, mobile overflow, time range and failed-data states.');
}finally{await browser.close();}
