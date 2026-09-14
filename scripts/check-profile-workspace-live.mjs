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
  const reminder = page.getByRole('button', { name: 'Dismiss approval reminder for 10 minutes' });
  await reminder.waitFor({ timeout: 8000 }).catch(() => {});
  if (await reminder.isVisible()) await reminder.click();
  assert.equal(await page.locator('.epw-primary-nav button').count(), 14);
  assert.equal(await page.locator('.epw-signal').count(), 4);
  assert.equal(await page.getByText('Basic Salary', { exact: true }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '../artifacts/profile-workspace/desktop.png', fullPage: true });
  assert.equal(await page.getByRole('button', { name: 'More', exact: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(650);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '../artifacts/profile-workspace/mobile.png', fullPage: true });
  await page.locator('.main-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.screenshot({ path: '../artifacts/profile-workspace/mobile-lower.png', fullPage: true });
  await page.locator('.main-content').evaluate(element => { element.scrollTop = 0; });
  await page.getByRole('button', { name: 'My Signature', exact: true }).click();
  assert.equal(await page.locator('.epw-menu').count(), 0);
  await page.locator('.epw-primary-nav').getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('heading', { name: 'Organization', exact: true }).waitFor();
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.getByRole('button', { name: 'Update personal details', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search reporting manager employees' }).waitFor();
  await page.waitForFunction(() => document.querySelector('option[value="sales"]') && [...document.querySelectorAll('select')].some(select => select.id && select.options.length > 1));
  assert.ok(await page.locator('option[value="sales"]').count() > 0);
  assert.deepEqual(errors, []);
  console.log('PASS: live profile, all 14 destinations, four signals, salary privacy, direct signature navigation, mobile overflow, and preserved Sales/reporting-manager fields. Server writes blocked.');
} finally { await browser.close(); }
