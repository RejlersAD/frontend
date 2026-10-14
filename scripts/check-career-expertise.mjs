import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';

const email = process.env.USER_DIRECTORY_AUDIT_EMAIL;
if (!email) throw new Error('Set USER_DIRECTORY_AUDIT_EMAIL to an existing local account.');
const code = `import os,json,sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
import django
django.setup()
from apps.rbac.models import UserProfile
from rest_framework_simplejwt.tokens import AccessToken
p=UserProfile.objects.select_related('user').get(user__email=sys.argv[1])
print('CHECK_AUTH:'+json.dumps({'token':str(AccessToken.for_user(p.user)),'user':{'id':str(p.user_id),'email':p.user.email,'is_superuser':p.user.is_superuser}}))`;
const { stdout } = await promisify(execFile)('docker', ['exec', 'radai_backend_local', 'python', '-c', code, email], { maxBuffer: 1024 * 1024 });
const auth = JSON.parse(stdout.split('CHECK_AUTH:')[1].trim());
await mkdir('../artifacts/profile-workspace', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(auth => {
    localStorage.setItem('radai_access_token', auth.token);
    localStorage.setItem('radai_user_data', JSON.stringify(auth.user));
  }, auth);
  await page.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
  let savedCareer = {expertise_level:'', years_experience:4, engineering_disciplines:[], technical_skills:[], languages:[]};
  let savedPayload;
  await page.route('**/rbac/users/me/**', async route => {
    if (route.request().method() === 'PATCH') {
      savedPayload = route.request().postDataJSON();
      savedCareer = savedPayload.engineer_profile;
      return route.fulfill({json:{engineer_profile:savedCareer}});
    }
    const response = await route.fetch();
    const profile = await response.json();
    return route.fulfill({response,json:{...profile,department:'finance',engineer_profile:{...profile.engineer_profile,...savedCareer}}});
  });
  await page.goto('http://localhost:5173/profile', {waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Career Profile',exact:true}).click();
  await page.getByRole('button',{name:'Career & Expertise',exact:true}).click();
  await page.getByLabel('Career level',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Career track',{exact:true}).count(),0);
  assert.equal(await page.locator('#career-level optgroup').count(),2);
  assert.equal(await page.locator('#career-level optgroup[label=\"Corporate & Operational Support\"] option').count(),6);
  assert.equal(await page.getByRole('navigation',{name:'Career Profile sections'}).getByRole('button').count(),9);
  await page.getByLabel('Career level',{exact:true}).selectOption('corp_senior');
  await page.getByLabel('Functional areas',{exact:true}).selectOption('Finance & Accounting');
  assert.ok((await page.getByLabel('Professional skills & software',{exact:true}).boundingBox()).width > 300);
  await page.getByLabel('Professional skills & software',{exact:true}).selectOption('Microsoft Excel');
  await page.getByRole('radiogroup',{name:'Microsoft Excel proficiency',exact:true}).locator('label').nth(3).click();
  await page.getByLabel('Professional skills & software',{exact:true}).selectOption('Power BI');
  await page.getByRole('button',{name:'Remove Power BI',exact:true}).click();
  await page.getByRole('button',{name:'Save Update',exact:true}).click();
  await page.waitForFunction(()=>document.body.innerText.includes('Career profile updated!'));
  assert.equal(savedPayload.engineer_profile.expertise_level,'corp_senior');
  assert.deepEqual(savedPayload.engineer_profile.engineering_disciplines,['Finance & Accounting']);
  assert.equal(savedPayload.engineer_profile.technical_skills[0].name,'Microsoft Excel');
  await page.locator('.career-editor').screenshot({path:'../artifacts/profile-workspace/career-desktop.png'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Career Profile',exact:true}).click();
  await page.getByRole('button',{name:'Career & Expertise',exact:true}).click();
  assert.equal(await page.getByLabel('Career level',{exact:true}).inputValue(),'corp_senior');
  assert.equal(await page.getByRole('radiogroup',{name:'Microsoft Excel proficiency',exact:true}).getByRole('radio',{name:'4 stars',exact:true}).isChecked(),true);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok((await page.getByLabel('Professional skills & software',{exact:true}).boundingBox()).width > 200);
  await page.locator('.career-editor').screenshot({path:'../artifacts/profile-workspace/career-mobile.png'});
  await page.getByLabel('Career level',{exact:true}).selectOption('senior');
  assert.equal(await page.getByLabel('Career level',{exact:true}).inputValue(),'senior');
  assert.ok((await page.locator('.career-editor').innerText()).includes('Microsoft Excel'));
  await page.setViewportSize({width:1672,height:1100});
  await page.getByRole('navigation',{name:'Career Profile sections'}).getByRole('button',{name:'Personal',exact:true}).click();
  await page.getByRole('heading',{name:'Personal information',exact:true}).waitFor();
  assert.equal(await page.locator('.career-form-panel').count(),3);
  await page.locator('.career-profile-layout').screenshot({path:'../artifacts/profile-workspace/career-personal-sidebar.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: corporate department default, six corporate levels, dropdowns, removable lists, proficiency edits, sidebar, mocked save/reload, retained skills, engineering switch, and mobile overflow. Real server writes blocked.');
} finally {await browser.close();}
