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
await page.goto('http://localhost:5173/admin/ai-champion',{waitUntil:'domcontentloaded',timeout:120000});
await page.locator('.ad-kpi').first().waitFor();
const dismiss=page.getByRole('button',{name:'Dismiss approval reminder for 10 minutes'});
await dismiss.waitFor({timeout:10000}).catch(()=>{});
if(await dismiss.isVisible()) await dismiss.click();


await page.locator('.al-live tbody tr input').first().waitFor();
await page.getByRole('button',{name:'Pause live updates'}).click();
await page.getByRole('button',{name:/^Activity details for /}).first().click();
const detail=page.getByRole('complementary',{name:'User activity timeline'});
await detail.getByRole('heading',{name:'24-hour summary',exact:true}).waitFor();
const profile=detail.getByRole('link',{name:'Open user profile',exact:true});
const url=await profile.getAttribute('href');
assert.match(url,/^\/admin\/users\/[a-f0-9-]+$/);
await page.setViewportSize({width:1906,height:1400});
await page.locator('.al-live').screenshot({path:'../artifacts/ai-adoption/live-activity-reference-desktop.png'});
await detail.getByRole('button',{name:'Next user details',exact:true}).click();
await detail.getByRole('heading',{name:'24-hour summary',exact:true}).waitFor();
await detail.getByRole('button',{name:'AI requests',exact:true}).click();
await detail.getByRole('heading',{name:'AI requests',exact:true}).waitFor();
await detail.getByRole('button',{name:'View activity history',exact:true}).click();
await detail.getByText(/Latest 100 submitted events/).waitFor();
await page.getByRole('button',{name:'Close user activity'}).click();
await page.getByRole('button',{name:'User',exact:true}).click();
await page.waitForResponse(r=>r.url().includes('live-activity')&&r.url().includes('ordering=user')&&r.status()===200);
await page.getByRole('combobox',{name:'Live users per page'}).selectOption('25');
await page.waitForResponse(r=>r.url().includes('live-activity')&&r.url().includes('page_size=25')&&r.status()===200);
assert.equal(await page.locator('.al-live tbody input').count(),25);
await page.getByRole('button',{name:'Next users'}).click();
await page.waitForResponse(r=>r.url().includes('live-activity')&&r.url().includes('page=2')&&r.status()===200);
const moduleSelect=page.getByRole('combobox',{name:'Live activity module'});
const options=await moduleSelect.locator('option').evaluateAll(items=>items.map(i=>i.value).filter(Boolean));
if(options.length){await moduleSelect.selectOption(options[0]);await page.waitForResponse(r=>r.url().includes('live-activity')&&new URL(r.url()).searchParams.get('module')===options[0]&&r.status()===200);}
await page.getByRole('button',{name:'Clear activity filters'}).click();
await page.locator('.al-live tbody input').first().waitFor();
await page.getByRole('button',{name:/^Activity details for /}).first().click();
await detail.getByRole('heading',{name:'24-hour summary',exact:true}).waitFor();
await page.evaluate(()=>document.documentElement.classList.add('dark'));
await page.locator('.al-live').screenshot({path:'../artifacts/ai-adoption/live-activity-reference-dark.png'});
await page.evaluate(()=>document.documentElement.classList.remove('dark'));
await page.setViewportSize({width:390,height:844});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await detail.screenshot({path:'../artifacts/ai-adoption/live-activity-reference-mobile.png'});
assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);
console.log('PASS: live directory/details, profile link, history tabs, sorting, page size, pagination, module filter and desktop/dark/mobile layouts; server writes blocked.');
}finally{await browser.close();}
