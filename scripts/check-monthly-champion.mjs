import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const candidate = {user_id:'1',user:{id:'1',name:'Avery Engineer',email:'avery@example.test'},rank:1,score:100,activity_count:12,requests:12,successful_activity_count:12,requests:12,success_rate:100,active_days:3,modules:2,breakdown:{activity_volume:50,recorded_success_rate:30,active_days:20}};
const method={version:'radai-platform-engagement-v1',weights:{activity_volume:50,recorded_success_rate:30,active_days:20},eligibility:'Active account with recorded RADAI activity, including page visits.',description:'RADAI activity engagement.',limitations:'Request success does not prove verified business outcomes.'};
const mock=`const candidate=${JSON.stringify(candidate)},method=${JSON.stringify(method)};export default {
getMonthlyChampion:async(year,month)=>{if(window.fail)throw new Error('unavailable');const now=new Date();const closed=year<now.getUTCFullYear()||month<now.getUTCMonth()+1;return {year,month,fingerprint:'preview',profile_photos:{1:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='},scope:'All organizations',can_publish:!window.reader,period:{closed},candidates:window.empty?[]:[candidate],methodology:method,publication:window.award||null,period_published:!!window.award,history:window.award?[window.award]:[]}},
publishMonthlyChampion:async(data)=>{window.saved=data;if(window.stale)throw {response:{data:{preview:['Candidate data changed. Refresh and review the latest preview.']}}};window.award={id:'award',year:data.year,month:data.month,published_at:'2026-09-11T12:00:00Z',reviewer:'Review Administrator',reason:data.reason,podium:[candidate],methodology:method};return window.award}
};`;
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/Admin/MonthlyChampion';createRoot(document.getElementById('root')).render(<div className="ai-adoption-workspace ad-reference-workspace"><Page/></div>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/services[\\/]analyticsService\.js$/},()=>({loader:'js',contents:mock}));}}]});
await mkdir('../artifacts/ai-adoption',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1672,height:941}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0}</style><div id="root"></div>');
 for(const path of ['src/pages/Admin/AIAdoptionDashboard.css','src/pages/Admin/MonthlyChampion.css'])await page.addStyleTag({content:await readFile(path,'utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('heading',{name:'Avery Engineer',exact:true}).waitFor();
 await page.locator('.mc-winner .mc-avatar img').waitFor();
 await page.locator('.mc-winner .mc-avatar img').dispatchEvent('error');
 assert.equal(await page.locator('.mc-winner .mc-avatar').textContent(),'AE');
 await page.screenshot({path:'../artifacts/ai-adoption/monthly-champion-preview.png',fullPage:true});
 const today=new Date();assert.equal(await page.getByLabel('Award month',{exact:true}).inputValue(),`${today.getUTCFullYear()}-${String(today.getUTCMonth()+1).padStart(2,'0')}`);
 assert.equal(await page.getByRole('button',{name:'Review monthly award',exact:true}).isEnabled(),false);
 await page.getByLabel('Award month',{exact:true}).fill('2025-07');
 await page.getByRole('button',{name:'Review monthly award',exact:true}).click();
 assert.ok(await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<2&&Math.abs(r.y+r.height/2-innerHeight/2)<2}));
 assert.equal(await page.getByRole('button',{name:'Publish monthly award',exact:true}).isEnabled(),false);
 await page.getByRole('textbox',{name:'Reason for recognition'}).fill('Reviewed reliable contributions across the month.');
 await page.getByRole('checkbox').check();
 await page.screenshot({path:'../artifacts/ai-adoption/monthly-champion-review.png',fullPage:true});
 await page.getByRole('button',{name:'Publish monthly award',exact:true}).click();
 await page.getByText(/AI Champion of the Month published for/).waitFor();
 assert.equal(await page.getByRole('button',{name:'Review monthly award',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>window.saved.fingerprint),'preview');
 assert.ok(await page.getByRole('cell',{name:'Review Administrator',exact:true}).count());
 await page.evaluate(()=>{window.award=null;window.stale=true});
 await page.getByRole('button',{name:'Refresh monthly champion'}).click();
 await page.getByRole('button',{name:'Review monthly award',exact:true}).click();
 await page.getByRole('textbox',{name:'Reason for recognition'}).fill('Reviewed another contribution.');await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Publish monthly award',exact:true}).click();await page.getByRole('alert').waitFor();
 assert.ok((await page.getByRole('alert').textContent()).includes('Candidate data changed'));
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>{window.stale=false;window.reader=true});await page.getByRole('button',{name:'Refresh monthly champion'}).click();
 await page.getByText('Only a Super Administrator can publish the organization-wide monthly award.').waitFor();
 assert.equal(await page.getByRole('button',{name:'Review monthly award',exact:true}).isEnabled(),false);
 await page.evaluate(()=>{window.reader=false;window.empty=true});await page.getByRole('button',{name:'Refresh monthly champion'}).click();await page.getByRole('heading',{name:'No eligible candidate',exact:true}).waitFor();assert.equal(await page.getByText('Leading candidate ? not yet awarded',{exact:true}).count(),0);
 await page.evaluate(()=>{window.empty=false;window.fail=true});await page.getByRole('button',{name:'Refresh monthly champion'}).click();await page.getByRole('heading',{name:'Monthly award unavailable'}).waitFor();
 await page.evaluate(()=>window.fail=false);await page.getByRole('button',{name:'Retry monthly award'}).click();await page.getByRole('heading',{name:'Avery Engineer',exact:true}).waitFor();
 const now=new Date();await page.getByLabel('Award month',{exact:true}).fill(`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`);
 await page.getByText('Provisional — month in progress').waitFor();assert.equal(await page.getByRole('button',{name:'Review monthly award',exact:true}).isEnabled(),false);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'../artifacts/ai-adoption/monthly-champion-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: monthly preview, centered review, reason/acknowledgment, publication history, stale protection, permission states, empty/error/current month and mobile');
}finally{await browser.close();}
