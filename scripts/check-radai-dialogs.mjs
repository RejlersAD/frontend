import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
const bundle=await build({entryPoints:['src/services/radaiDialog.js'],bundle:true,write:false,outdir:'out',format:'iife',globalName:'dialogs'})
const browser=await chromium.launch({channel:'chrome',headless:true})
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});let native=0;page.on('dialog',async d=>{native++;await d.dismiss()})
 await page.setContent('<button id="opener">Open</button>');await page.addStyleTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});await page.locator('#opener').focus()
 await page.evaluate(()=>{window.done=false;dialogs.radaiConfirm('Approve?').then(v=>{window.result=v;done=true})});await page.getByRole('dialog').waitFor();assert.equal(await page.evaluate(()=>done),false);await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>result),false);assert.equal(await page.locator('#opener').evaluate(el=>el===document.activeElement),true)
 await page.evaluate(()=>{dialogs.radaiPrompt('Type FORCE DELETE','default').then(v=>window.result=v)});assert.equal(await page.getByRole('textbox').inputValue(),'default');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>result),null)
 await page.evaluate(()=>{dialogs.radaiPrompt('Note','').then(v=>window.result=v)});await page.getByRole('button',{name:'Confirm',exact:true}).click();assert.equal(await page.evaluate(()=>result),'')
 await page.evaluate(()=>{window.order=[];dialogs.radaiConfirm('First').then(v=>order.push(v));dialogs.radaiAlert('<img src=x onerror=alert(1)>').then(()=>order.push('ok'))});await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();assert.equal(await page.locator('dialog img').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'OK',exact:true}).click();assert.deepEqual(await page.evaluate(()=>order),[true,'ok']);assert.equal(native,0)
 console.log('Passed: awaited decisions, cancel, Escape, defaults, blank input, queue, safe text, focus and mobile width.')
}finally{await browser.close()}
