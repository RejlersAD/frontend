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
console.log('LIVE cards:',await page.locator('.ad-kpi strong').allTextContents());
assert.ok(await page.locator('.ad-kpi').first().evaluate(el => getComputedStyle(el).backgroundImage.includes('linear-gradient')));
assert.equal(await page.locator('.ad-kpi').first().evaluate(el => getComputedStyle(el).borderRadius), '8px');
await page.screenshot({path:'../artifacts/ai-adoption/live-desktop.png',fullPage:true});
await page.getByRole('heading',{name:'Live user activity',exact:true}).waitFor();
await page.locator('.al-live tbody button').first().waitFor();
assert.equal(await page.locator('.al-live [role=alert]').count(),0);
await page.locator('.al-live tbody').getByRole('button',{name:/^Activity details for /}).first().click();
await page.getByRole('complementary',{name:'User activity timeline'}).waitFor();
await page.screenshot({path:'../artifacts/ai-adoption/live-user-timeline.png',fullPage:true});
await page.getByRole('button',{name:'Close user activity',exact:true}).click();
await page.getByRole('button',{name:'Knowledge base',exact:true}).click();
const help=page.getByRole('dialog',{name:'AI Adoption knowledge base'});
await help.waitFor();
assert.equal(await help.getByRole('navigation',{name:'Knowledge base topics'}).getByRole('button').count(),10);
await help.getByRole('textbox',{name:'Search knowledge base'}).fill('manual baseline');
await help.getByRole('heading',{name:'Productivity outcomes',exact:true}).waitFor();
await page.screenshot({path:'../artifacts/ai-adoption/knowledge-base-live.png',fullPage:true});
await page.keyboard.press('Escape');

for(const name of ['Contributions','Use cases','Enablement','Methodology']) {
 await page.locator('.ad-tabs').getByRole('button',{name,exact:true}).click();
 assert.equal(await page.locator('.ad-error').count(),0);
}
await page.getByRole('heading',{name:'Reporting boundaries'}).waitFor();
await page.getByRole('combobox',{name:'Reporting period'}).selectOption('90');
await page.locator('.ad-kpi').first().waitFor();
await page.locator('.ad-tabs').getByRole('button',{name:'Overview',exact:true}).click();
await page.getByRole('heading',{name:'Contribution register',exact:true}).waitFor();
await page.screenshot({path:'../artifacts/ai-adoption/live-reference-90days.png',fullPage:true});
await page.locator('.ad-tabs').getByRole('button',{name:'Enablement',exact:true}).click();
await page.getByRole('heading',{name:'Stored monthly results'}).waitFor();
await page.screenshot({path:'../artifacts/ai-adoption/live-champion.png',fullPage:true});
await page.locator('.ad-tabs').getByRole('button',{name:'AI Champion',exact:true}).click();
await page.getByRole('heading',{name:'AI Champion of the Month',exact:true}).waitFor();
await page.getByRole('textbox',{name:'Search monthly candidates'}).waitFor();
await page.getByLabel('Award month',{exact:true}).fill('2026-07');
await page.getByRole('heading',{name:'Sohail Nasir',exact:true}).waitFor();
await page.getByRole('button',{name:'Review monthly award',exact:true}).click();
await page.getByRole('dialog').waitFor();
assert.equal(await page.getByRole('button',{name:'Publish monthly award',exact:true}).isEnabled(),false);
await page.screenshot({path:'../artifacts/ai-adoption/monthly-champion-live-review.png',fullPage:true});
await page.getByRole('button',{name:'Cancel',exact:true}).click();
await page.screenshot({path:'../artifacts/ai-adoption/monthly-champion-live.png',fullPage:true});
await page.locator('.ad-tabs').getByRole('button',{name:'Workforce adoption',exact:true}).click();
await page.locator('.wa-kpis').waitFor();
console.log('LIVE workforce cards:',await page.locator('.wa-kpis strong').allTextContents());
await page.getByRole('button',{name:'Manager teams',exact:true}).click();
await page.screenshot({path:'../artifacts/ai-adoption/workforce-live.png',fullPage:true});
await page.getByRole('heading',{name:'Observed engagement',exact:true}).waitFor();
await page.locator('.ad-tabs').getByRole('button',{name:'Productivity outcomes',exact:true}).click();
await page.getByRole('button',{name:'Record outcome',exact:true}).waitFor();
await page.getByRole('cell',{name:'No outcome evidence recorded yet.',exact:true}).waitFor();
await page.screenshot({path:'../artifacts/ai-adoption/outcomes-live.png',fullPage:true});
await page.locator('.ad-tabs').getByRole('button',{name:'Workflow measurements',exact:true}).click();
await page.getByRole('heading',{name:'Workflow register',exact:true}).waitFor();
await page.getByRole('heading',{name:'Integration coverage',exact:true}).waitFor();
console.log('LIVE workflow cards:',await page.locator('.ad-kpi strong').allTextContents());
await page.screenshot({path:'../artifacts/ai-adoption/measurements-live.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.screenshot({path:'../artifacts/ai-adoption/live-mobile.png',fullPage:true});
await page.setViewportSize({width:1906,height:960});
await page.locator('.ad-tabs').getByRole('button',{name:'Administration',exact:true}).click();
assert.equal(await page.getByRole('link',{name:'Open legacy recognition management'}).count(),0);
await page.getByRole('button',{name:'Review monthly awards',exact:true}).click();
await page.getByRole('heading',{name:'AI Champion of the Month',exact:true}).waitFor();
await page.goto('http://localhost:5173/admin/ai-champion/legacy',{waitUntil:'domcontentloaded'});
await page.waitForURL('**/admin/ai-champion');
await page.locator('.ad-kpi').first().waitFor();
await page.evaluate(()=>document.documentElement.classList.add('dark'));
assert.ok(await page.locator('.ad-kpi').first().evaluate(el => getComputedStyle(el).backgroundImage.includes('linear-gradient')));
await page.screenshot({path:'../artifacts/ai-adoption/radai-dark.png',fullPage:true});
assert.deepEqual(errors,[]);assert.deepEqual(apiFailures,[]);
console.log('PASS: live reporting, all reference sections, monthly award preview/review, workforce eligibility and teams, 90-day window and mobile layout; server writes blocked');
}finally{await browser.close();}
