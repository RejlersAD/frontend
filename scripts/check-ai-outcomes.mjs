import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
const fixture = `let rows=[];export default{getAIOutcomes:async()=>({count:rows.length,results:rows,modules:[{code:'planning_package',name:'Planning packages'}],totals:{approved:0,pending:rows.length,measured_minutes_saved:null,self_reported_minutes_saved:null}}),submitAIOutcome:async(data)=>{window.submitted=data;rows=[{...data,id:'test',module:'Planning packages',saved_minutes:25,status:'pending',can_review:true,submitted_by:'Pilot operator'}]},reviewAIOutcome:async(data)=>{window.reviewed=data;rows[0].status=data.decision;rows[0].can_review=false}}`;
const bundle = await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Page from './src/pages/Admin/AIOutcomes';createRoot(document.getElementById('root')).render(<Page/>);`, resolveDir: process.cwd(), loader: 'jsx' }, bundle:true,write:false,format:'iife',loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){b.onLoad({filter:/services[\\/]analyticsService\.js$/},()=>({loader:'js',contents:fixture}));}}] });
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('cell',{name:'No outcome evidence recorded yet.'}).waitFor();
 await page.getByRole('button',{name:'Record outcome',exact:true}).click();
 for(const [label,value] of [['Task title','Planning pilot'],['Unique task / job reference','plan-001'],['Evidence link (HTTPS)','https://example.test/evidence'],['Comparable manual baseline (minutes)','120'],['AI-assisted work (minutes)','75'],['Review time (minutes)','15'],['Rework time (minutes)','5'],['Explain baseline source, comparable scope and accepted output quality','Same package scope, documented manual baseline and accepted output.']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Submit for independent review'}).click();
 await page.getByRole('button',{name:'Review evidence',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Approve evidence'}).isDisabled(),true);
 await page.getByLabel('Review reason',{exact:true}).fill('Evidence verified against comparable baseline.');
 assert.equal(await page.getByRole('button',{name:'Approve evidence'}).isDisabled(),true);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Approve evidence'}).click();
 await page.getByRole('cell',{name:'approved',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.reviewed.comparable_quality_confirmed),true);
 assert.deepEqual(errors,[]);console.log('PASS: empty evidence, submission, review reason and quality gates, approval refresh (fixture only)');
} finally {await browser.close();}
