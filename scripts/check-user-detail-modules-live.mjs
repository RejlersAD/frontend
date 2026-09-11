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
const response=await page.request.get('http://localhost:5173/api/v1/rbac/users/me/',{headers:{Authorization:'Bearer '+auth.token}});
assert.equal(response.status(),200);const profile=await response.json();
await page.goto('http://localhost:5173/admin/users/'+profile.id,{waitUntil:'domcontentloaded',timeout:120000});
await page.locator('.ud-profile').waitFor();
if(profile.profile_photo){await page.waitForFunction(()=>{const img=document.querySelector('.ud-avatar img');return img?.complete&&img.naturalWidth>0});}
await page.getByRole('tab',{name:/^Modules & Permissions(?:\s*\d+)?$/}).click();
const reminder=page.getByRole('button',{name:'Dismiss approval reminder for 10 minutes'});
await reminder.waitFor({timeout:10000}).catch(()=>{});if(await reminder.isVisible())await reminder.click();
const rows=page.locator('.ud-module-list li');assert.equal(await rows.count(),Math.min(12,profile.modules.length));
if(profile.modules.length>12){await page.getByRole('button',{name:'Next',exact:true}).click();assert.match(await page.locator('.ud-module-pagination').textContent(),/Showing 13/);}
await page.getByRole('searchbox',{name:'Search assigned modules'}).fill('no-module-matches-this-search');assert.equal(await rows.count(),0);
await page.getByRole('searchbox',{name:'Search assigned modules'}).fill('');assert.equal(await rows.count(),Math.min(12,profile.modules.length));
await page.screenshot({path:'../artifacts/user-directory/user-detail-compact-modules.png',fullPage:true});
if(profile.profile_photo){await page.locator('.ud-avatar img').evaluate(img=>img.dispatchEvent(new Event('error')));assert.equal(await page.locator('.ud-avatar img').count(),0);assert.ok((await page.locator('.ud-avatar').textContent()).trim());}
await page.setViewportSize({width:390,height:844});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await page.screenshot({path:'../artifacts/user-directory/user-detail-mobile.png',fullPage:true});
assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);
console.log('PASS: profile image, initials fallback, compact modules, search, pagination and mobile overflow. API failures:',apiFailures);
}finally{await browser.close();}
