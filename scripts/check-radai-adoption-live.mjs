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
assert.equal(await page.locator('.ad-kpi-label').first().textContent(), 'RADAI users');
await page.screenshot({path:'../artifacts/ai-adoption/radai-adoption-overview.png',fullPage:true});
await page.locator('.ad-tabs').getByRole('button',{name:'AI Champion',exact:true}).click();
await page.getByRole('textbox',{name:'Search monthly candidates'}).waitFor();
const now=new Date();
assert.equal(await page.getByLabel('Award month',{exact:true}).inputValue(), `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`);
assert.ok((await page.locator('.mc-methodology').textContent()).includes('including page visits'));
assert.ok(await page.locator('.mc-winner-stats').count());
assert.equal(await page.getByRole('button',{name:'Review monthly award',exact:true}).isEnabled(),false);
await page.locator('.mc-winner .mc-avatar img').waitFor();
assert.ok(await page.locator('.mc-winner .mc-avatar img').evaluate(img => img.complete && img.naturalWidth > 0));
console.log('Current RADAI candidate activity:',await page.locator('.mc-winner-stats').innerText());
await page.screenshot({path:'../artifacts/ai-adoption/radai-champion-current.png',fullPage:true});
await page.locator('.ad-tabs').getByRole('button',{name:'Workforce adoption',exact:true}).click();
await page.locator('.wa-kpis').waitFor();
assert.ok((await page.locator('.wa-context').innerText()).includes('including page visits'));
await page.locator('.ad-tabs').getByRole('button',{name:'Productivity outcomes',exact:true}).click();
await page.getByRole('heading',{name:'Productivity evidence',exact:true}).waitFor();
await page.locator('.ai-outcomes .ad-kpis').waitFor();
assert.equal(await page.locator('.ai-outcomes [role=alert]').count(),0);
assert.equal(await page.getByRole('button',{name:'Record outcome',exact:true}).isEnabled(),true);
await page.getByRole('button',{name:'Refresh evidence',exact:true}).click();
await page.locator('.ai-outcomes .ad-kpis').waitFor();
await page.screenshot({path:'../artifacts/ai-adoption/productivity-evidence-fixed.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);
console.log('PASS: live RADAI overview, current-month page-visit candidate, workforce definitions, productivity evidence load/retry and mobile; server writes blocked');
}finally{await browser.close();}
