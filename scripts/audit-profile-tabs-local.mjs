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
  await page.goto('http://localhost:5173/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Organization', exact: true }).waitFor().catch(async error => {
    await page.screenshot({ path: '../artifacts/profile-workspace/live-failure.png', fullPage: true });
    console.log('Page errors:', errors, 'Page URL:', page.url(), 'Headings:', await page.locator('h1,h2,h3').allTextContents());
    throw error;
  });
  const results = [];
  const reminder = page.getByRole('button', { name: 'Dismiss approval reminder for 10 minutes' });
  if (await reminder.isVisible()) await reminder.click();
  await mkdir('../artifacts/profile-tabs-audit', { recursive: true });
  for (const width of [1672, 390]) {
    await page.setViewportSize({ width, height: 941 });
    for (let i = 0; i < 15; i++) {
      if (process.env.PROFILE_AUDIT_TABS && !process.env.PROFILE_AUDIT_TABS.split(',').map(Number).includes(i)) continue;
      const button = page.locator('.epw-primary-nav button').nth(i);
      const name = await button.innerText();
      await button.click();
      await page.waitForTimeout(1600);
      const section = page.locator('.epw-active-section');
      await page.waitForFunction(() => {
        const el = document.querySelector('.epw-active-section');
        return el && el.innerText.trim() && !/^Loading[^\n]*[.…]*$/.test(el.innerText.trim());
      });
      assert.equal(await button.getAttribute('aria-current'), 'page', `${name} is selected`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} fits ${width}px`);
      if (i > 0) {
        const panelRadii = await section.locator('.bg-white.rounded-xl, .bg-white.rounded-2xl, .bg-white.rounded-lg').evaluateAll(elements => elements.filter(el => !el.matches('button, input, select, textarea, a')).map(el => getComputedStyle(el).borderRadius));
        assert.ok(panelRadii.every(radius => radius === '8px'), `${name}: consistent panel corners ${panelRadii.join(",")}`);
      }
      if (i === 9) assert.equal(await section.locator('.epw-metric').count(), 4, 'Performance uses shared summary cards');
      if (i === 1) {
        const padding = await section.locator('input.pl-10, select.pl-10').evaluateAll(elements => elements.map(el => parseFloat(getComputedStyle(el).paddingLeft)));
        assert.ok(padding.every(value => value >= 36), 'Profile fields reserve space for icons');
      }
      const data = await section.evaluate(el => ({text:el.innerText.slice(0,1800), headings:[...el.querySelectorAll('h1,h2,h3')].map(x=>x.innerText), overflow:document.documentElement.scrollWidth>innerWidth+1, cards:[...el.querySelectorAll('[class*="rounded"]')].slice(0,8).map(x=>({classes:x.className,radius:getComputedStyle(x).borderRadius,padding:getComputedStyle(x).padding}))}));
      await section.screenshot({ path: `../artifacts/profile-tabs-audit/${width}-${i}.png` });
      results.push({width,name,...data});
    }
  }
  const {writeFile} = await import('node:fs/promises');
  await writeFile('../artifacts/profile-tabs-audit/results.json', JSON.stringify({results,errors},null,2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({tabs:results.map(({width,name,overflow,headings})=>({width,name,overflow,headings})),errors}));
} finally { await browser.close(); }
