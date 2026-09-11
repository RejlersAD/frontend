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

const topics=['Overview','Workforce adoption','Productivity outcomes','Workflow measurements','Contributions','AI Champion','Use cases','Enablement','Methodology','Administration'];
for(const topic of topics){
 await page.locator('.ad-tabs').getByRole('button',{name:topic,exact:true}).click();
 await page.getByRole('button',{name:`Open ${topic} help`,exact:true}).click();
 const help=page.getByRole('dialog',{name:`${topic} Help`,exact:true});
 await help.getByRole('heading',{name:topic,exact:true}).waitFor();
 assert.equal(await help.getByRole('navigation',{name:'Help knowledge topics'}).getByRole('button').count(),10);
 await page.keyboard.press('Escape');
}
await page.reload({waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'Open Administration help',exact:true}).click();
await page.getByRole('dialog',{name:'Administration Help',exact:true}).getByRole('heading',{name:'Administration',exact:true}).waitFor();
await page.screenshot({path:'../artifacts/ai-adoption/header-help-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await page.screenshot({path:'../artifacts/ai-adoption/header-help-mobile.png',fullPage:true});
await page.keyboard.press('Escape');
await page.goto('http://localhost:5173/admin/ai-adoption?tab=outcomes',{waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'Open Productivity outcomes help',exact:true}).click();
await page.getByRole('dialog',{name:'Productivity outcomes Help',exact:true}).getByRole('heading',{name:'Productivity outcomes',exact:true}).waitFor();
assert.deepEqual(errors,[]);
assert.deepEqual(apiFailures,[]);
console.log('PASS: actual header Help follows all ten tabs; reload, alias deep link, ten complete topics and mobile layout; server writes blocked.');
}finally{await browser.close();}
