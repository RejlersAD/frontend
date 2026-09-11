import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const run=promisify(execFile);
const accountEmail=process.env.USER_DIRECTORY_AUDIT_EMAIL;
if(!accountEmail) throw new Error('Set USER_DIRECTORY_AUDIT_EMAIL to a local administrator account before running this read-only check.');
const code=`import os,json,sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
import django
django.setup()
from apps.rbac.models import UserProfile
from rest_framework_simplejwt.tokens import AccessToken
p=UserProfile.objects.select_related('user').get(user__email=sys.argv[1])
print('CHECK_AUTH:'+json.dumps({'token':str(AccessToken.for_user(p.user)),'user':{'id':str(p.user_id),'email':p.user.email,'is_superuser':p.user.is_superuser}}))`;
const {stdout}=await run('docker',['exec','radai_backend_local','python','-c',code,accountEmail],{maxBuffer:1024*1024});
const auth=JSON.parse(stdout.split('CHECK_AUTH:')[1].trim());
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1906,height:960}});page.setDefaultTimeout(60000);const errors=[];const apiFailures=[];
await page.addInitScript(auth=>{localStorage.setItem('radai_access_token',auth.token);localStorage.setItem('radai_user_data',JSON.stringify(auth.user));},auth);
await page.route('**/api/**',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/rbac/')&&r.status()>=400)apiFailures.push({url:new URL(r.url()).pathname,status:r.status()});});
await page.goto('http://localhost:5173/admin/users',{waitUntil:'domcontentloaded',timeout:120000});
await page.locator('.ua-directory tbody tr').first().waitFor();
assert.equal(await page.locator('.ua-directory tbody tr').count(),6);
await page.locator('.ua-user-button').nth(2).click();await page.locator('.ua-details[aria-busy=false]').waitFor();
await page.locator('.ua-page-heading').scrollIntoViewIfNeeded();
await page.screenshot({path:'../artifacts/user-directory/live-desktop.png',fullPage:true});
console.log('LIVE cards:',await page.locator('.ua-signal strong').allTextContents());
console.log('LIVE pagination:',await page.locator('.ua-pagination').innerText());
await page.getByRole('button',{name:'Next page',exact:true}).click();assert.match(await page.locator('.ua-pagination').textContent(),/7–12/);
await page.getByRole('combobox',{name:'MFA',exact:true}).selectOption('enabled');
await page.getByRole('button',{name:'Clear filters',exact:true}).first().click();
await page.getByRole('tab',{name:'Audit',exact:true}).click();await page.getByRole('heading',{name:'Account audit',exact:true}).waitFor();
await page.getByRole('tab',{name:'All users',exact:true}).click();
await page.locator('.ua-directory tbody input[type=checkbox]:not(:disabled)').first().check();
await page.getByRole('button',{name:'Assign role',exact:true}).click();
assert.ok(await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<2&&Math.abs(r.y+r.height/2-innerHeight/2)<2}));
await page.getByRole('button',{name:'Close action review',exact:true}).click();
await page.getByRole('button',{name:'Clear',exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'../artifacts/user-directory/live-mobile.png',fullPage:true});
console.log('LIVE mobile page widths:',await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth})));
assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);
console.log('PASS: live directory, details, pagination, MFA filter and account audit; all server writes blocked');
}finally{await browser.close();}
