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
print('CHECK_AUTH:'+json.dumps({'profileId':str(p.pk),'token':str(AccessToken.for_user(p.user)),'user':{'id':str(p.user_id),'email':p.user.email,'is_superuser':p.user.is_superuser}}))`;
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
  let recover = false;
  const photoResponses=[];page.on('response',r=>{if(r.url().includes('/my-profile-photo/')) photoResponses.push({status:r.status(),type:r.headers()['content-type']});});
  await page.route('**/users/employees/my-profile-photo/**', route => recover ? route.continue() : route.fulfill({status:503, contentType:'application/json', body:'{"detail":"Simulated temporary photo failure"}'}));
  await page.route('**/employee_photos/**', route => route.abort());
  await page.goto('http://localhost:5173/profile', {waitUntil:'domcontentloaded'});
  const avatars = 'header button[aria-haspopup="menu"] img, aside img[alt="Profile"]';
  await page.waitForFunction(selector => { const images = [...document.querySelectorAll(selector)]; return images.length === 2 && images.every(img => img.style.display === 'none'); }, avatars);
  recover = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(selector => { const images = [...document.querySelectorAll(selector)]; return images.length === 2 && images.every(img => img.src.startsWith('blob:') && img.naturalWidth > 0 && getComputedStyle(img).display !== 'none'); }, avatars, {timeout:20000}).catch(async error=>{console.log('Photo recovery diagnostics',photoResponses,await page.locator(avatars).evaluateAll(images=>images.map(img=>({blob:img.src.startsWith('blob:'),width:img.naturalWidth,display:getComputedStyle(img).display}))),await page.evaluate(()=>document.visibilityState));throw error;});
  await page.waitForFunction(() => { const image = document.querySelector('.epw-avatar img'); return image?.naturalWidth > 0 && image.src === document.querySelector('header button[aria-haspopup="menu"] img')?.src; });
  const urls = await page.locator(avatars).evaluateAll(images => images.map(img => img.src));
  assert.equal(urls[0], urls[1]);
  const oldUrl = urls[0];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(({selector, oldUrl}) => [...document.querySelectorAll(selector)].every(img => img.src !== oldUrl && img.naturalWidth > 0 && getComputedStyle(img).display !== 'none'), {selector:avatars, oldUrl});
  await page.screenshot({path:'../artifacts/profile-workspace/shell-photo-sync-fixed.png', fullPage:true});
  await page.goto(`http://localhost:5173/admin/users/${auth.profileId}`, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => { const image = document.querySelector('.user-detail-avatar img, .ud-avatar img'); const shell = document.querySelector('header button[aria-haspopup="menu"] img'); return image?.naturalWidth > 0 && image.src.startsWith('blob:') && image.src === shell?.src; });
  await page.screenshot({path:'../artifacts/profile-workspace/user-detail-photo-sync-fixed.png', fullPage:true});
  await page.goto('http://localhost:5173/hr/employees', {waitUntil:'domcontentloaded'});
  await page.getByPlaceholder('Search employee ID, name, email, department, manager, location or role', {exact:false}).fill(email);
  const employeeRow = page.locator('tbody tr').filter({hasText:email}).first();
  await employeeRow.waitFor();
  await employeeRow.locator('img').waitFor();
  await employeeRow.click();
  const employeeDialog = page.getByRole('dialog', {name:/employee profile/});
  await employeeDialog.waitFor();
  await page.waitForFunction(() => {
    const shell = document.querySelector('header button[aria-haspopup="menu"] img');
    const drawer = document.querySelector('[role="dialog"][aria-label$="employee profile"] img');
    const row = document.querySelector('tbody tr img');
    return shell?.src.startsWith('blob:') && drawer?.naturalWidth > 0 && row?.naturalWidth > 0 && drawer.src === shell.src && row.src === shell.src;
  });
  const beforeUploadRefresh = await employeeDialog.locator('img').first().getAttribute('src');
  await page.evaluate(() => window.dispatchEvent(new Event('radai:profile-photo-changed')));
  await page.waitForFunction(previous => {
    const shell = document.querySelector('header button[aria-haspopup="menu"] img');
    const drawer = document.querySelector('[role="dialog"][aria-label$="employee profile"] img');
    return drawer?.naturalWidth > 0 && drawer.src !== previous && drawer.src === shell?.src;
  }, beforeUploadRefresh);
  await page.screenshot({path:'../artifacts/profile-workspace/hr-employee-drawer-photo-sync-fixed.png', fullPage:true});
  await page.goto('http://localhost:5173/admin/ai-champion', {waitUntil:'domcontentloaded'});
  await page.locator('.ad-tabs').getByRole('button', {name:'AI Champion', exact:true}).click();
  await page.waitForFunction(() => {
    const shell = document.querySelector('header button[aria-haspopup="menu"] img');
    const photos = [...document.querySelectorAll('.mc-avatar img[alt^="Firaol"]')];
    return photos.length >= 2 && photos.every(img => img.naturalWidth > 0 && img.src === shell?.src && img.src.startsWith('blob:'));
  });
  await page.screenshot({path:'../artifacts/profile-workspace/champion-photo-sync-fixed.png', fullPage:true});
  assert.deepEqual(errors, []);
  console.log('PASS: Champion cards/candidate list, HR employee drawer/list, Employee Profile and User Details share the shell photo; header/sidebar recover from failed images, share authenticated photo, and refresh together on return to app; server writes blocked');
} finally { await browser.close(); }
