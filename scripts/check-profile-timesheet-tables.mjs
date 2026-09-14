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
  const historyResponse = page.waitForResponse(response => response.url().includes('/timesheet/user/') && new URL(response.url()).searchParams.has('from') && new URL(response.url()).searchParams.get('from') !== new URL(response.url()).searchParams.get('to') && response.status()===200);
  await page.getByRole('button',{name:'Work & Attendance',exact:true}).click();
  const response = await historyResponse;
  const history = await response.json();
  await page.getByRole('table',{name:'Daily Activity',exact:true}).waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.profile-timesheet-scroll table')].every(table=>table.getAttribute('aria-busy')==='false'));
  assert.equal(await page.locator('.profile-timesheet-tables table').count(),2);
  assert.equal(await page.getByRole('navigation',{name:'Employee profile sections'}).getByRole('button',{name:'Attendance',exact:true}).count(),0);
  assert.equal(await page.getByRole('navigation',{name:'Employee profile sections'}).getByRole('button',{name:'Timesheet',exact:true}).count(),0);
  const activityTable = page.getByRole('table',{name:'Daily Activity',exact:true});
  const attendanceTable = page.getByRole('table',{name:'Daily Attendance',exact:true});
  assert.equal(await activityTable.getByRole('columnheader',{name:'Punches',exact:true}).count(),1);
  assert.equal(await activityTable.getByRole('columnheader',{name:'Status',exact:true}).count(),0);
  assert.equal(await attendanceTable.getByRole('columnheader',{name:'Status',exact:true}).count(),1);
  assert.equal(await attendanceTable.getByRole('columnheader',{name:'Punches',exact:true}).count(),0);

  assert.equal(await page.getByRole('table',{name:'Daily Attendance',exact:true}).locator('tbody tr').count(),Math.max(1,(history.rows || []).length));
  if (history.rows?.length) assert.ok((await page.getByRole('table',{name:'Daily Attendance',exact:true}).innerText()).includes(history.rows[0].date));
  const lookup = new URL(response.url()).searchParams;
  assert.ok(lookup.get('email') || lookup.get('employee_code') || lookup.get('user_id'));
  const attendancePeriod = await page.getByRole('group',{name:'Daily Attendance period'}).innerText();
  const dayRequest = page.waitForRequest(request => request.url().includes('/timesheet/user/') && new URL(request.url()).searchParams.get('from') === new URL(request.url()).searchParams.get('to'));
  await page.getByRole('button',{name:'Previous day',exact:true}).click();
  const dayQuery = new URL((await dayRequest).url()).searchParams;
  assert.equal(dayQuery.get('from'),dayQuery.get('to'));
  assert.equal(await page.getByRole('group',{name:'Daily Attendance period'}).innerText(),attendancePeriod);
  const activityPeriod = await page.getByRole('group',{name:'Daily Activity period'}).innerText();
  const monthRequest = page.waitForRequest(request => request.url().includes('/timesheet/user/') && new URL(request.url()).searchParams.get('from') !== new URL(request.url()).searchParams.get('to'));
  await page.getByRole('button',{name:'Previous month',exact:true}).click();
  const monthQuery = new URL((await monthRequest).url()).searchParams;
  assert.ok(monthQuery.get('from').endsWith('-01'));
  assert.equal(await page.getByRole('group',{name:'Daily Activity period'}).innerText(),activityPeriod);
  await page.getByRole('button',{name:'Next day',exact:true}).click();
  await page.getByRole('button',{name:'Next month',exact:true}).click();
  assert.equal(await page.getByRole('group',{name:'Daily Attendance period'}).innerText(),attendancePeriod);
  await page.waitForFunction(()=>[...document.querySelectorAll('.profile-timesheet-scroll table')].every(table=>table.getAttribute('aria-busy')==='false'));
  if (history.rows?.length) {
    await attendanceTable.getByRole('button',{name:`View activity for ${history.rows[0].date}`,exact:true}).click();
    assert.equal(await attendanceTable.getByRole('button',{name:`View activity for ${history.rows[0].date}`,exact:true}).getAttribute('aria-pressed'),'true');
    if (await page.getByRole('button',{name:'Back to today',exact:true}).isEnabled()) await page.getByRole('button',{name:'Back to today',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Back to today',exact:true}).isDisabled(),true);
  }
  await page.locator('.profile-timesheet-tables').screenshot({path:'../artifacts/profile-workspace/profile-timesheet-tables.png'});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  for (const legacy of ['timesheet','attendance']) {
    await page.goto(`http://localhost:5173/profile?tab=${legacy}`,{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Work & Attendance',exact:true}).waitFor();
    assert.equal(await page.getByRole('navigation',{name:'Employee profile sections'}).getByRole('button',{name:'Work & Attendance',exact:true}).getAttribute('aria-current'),'page');
  }
  assert.deepEqual(errors,[]);
  await page.unrouteAll({behavior:'wait'});
  console.log('PASS: exactly two tables, HR history endpoint row parity, employee lookup, mobile overflow; real writes blocked.');
} finally {await browser.close();}
