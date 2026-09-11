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
await page.locator('.ua-row-actions button').first().click();
await page.getByRole('heading',{name:'User Details',exact:true}).waitFor();
await page.locator('.ud-profile').waitFor();
await page.screenshot({path:'../artifacts/user-directory/user-detail-desktop.png',fullPage:true});
for(const name of ['Modules & Permissions','Roles','Activity Log','Overview']){await page.getByRole('tab',{name,exact:true}).click();}
await page.setViewportSize({width:390,height:844});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await page.screenshot({path:'../artifacts/user-directory/user-detail-mobile.png',fullPage:true});
assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);
console.log('PASS: user details, four tabs, mobile overflow. API failures:',apiFailures);
}finally{await browser.close();}
