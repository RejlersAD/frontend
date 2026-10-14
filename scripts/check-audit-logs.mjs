import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const bundle = await build({
  stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import AuditLogsTab from './src/components/admin/AuditLogsTab';createRoot(document.getElementById('root')).render(<AuditLogsTab />);`, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, outfile: 'audit-check.js', format: 'iife', jsx: 'automatic',
  plugins: [{ name: 'audit-api', setup(builder) {
    builder.onLoad({ filter: /services[\\/]api\.service\.js$/ }, () => ({ loader: 'js', contents: `
      export const apiClientLongTimeout = {};
      export default { get: async (url, {params}) => {
        window.auditRequests ??= []; window.auditRequests.push({url, params});
        if (Object.values(params).includes('all')) throw Error('Invalid filter choice');
        if (window.auditOffline) throw Error('Network unavailable');
        return {data: {count: 42, summary: {total:42,today:30,failed:12}, results: Array.from({length:Math.min(params.page_size,42-(params.page-1)*params.page_size)}, (_, index) => ({
          id: params.page * 20 + index, user_email:'auditor@example.test',
          action:params.action || 'update', resource_type:params.resource_type || 'Role',
          resource_repr:'Engineering role', timestamp:new Date().toISOString(),
          success:params.success ?? true, resource_id:index === 1 ? '11111111-1111-4111-8111-111111111111' : null, metadata:index === 0 ? {target_id:12345} : {}
        }))}};
      }};` }));
  } }],
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div class="admin-console"><div id="root"></div></div>');
  await page.addStyleTag({content: readFileSync('src/pages/AdminDashboard.css', 'utf8').replace(/^@import.*$/gm, '') + readFileSync('src/components/admin/AuditLogsTab.css', 'utf8')});
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByText('Engineering role', { exact: true }).first().waitFor();
  assert.equal(await page.locator('tbody tr').count(), 20);
  assert.equal(await page.locator('.audit-card-value').first().innerText(), '42');
  assert.equal(await page.locator('.audit-card-value').first().evaluate(el => getComputedStyle(el).fontSize), '28px');
  assert.equal(await page.locator('.audit-card').first().evaluate(el => getComputedStyle(el).justifyContent), 'flex-start');
  await page.screenshot({path:'../artifacts/admin-console/audit-finished.png', fullPage:true});
  const lastParams = () => page.evaluate(() => window.auditRequests.at(-1).params);
  assert.deepEqual(await lastParams(), { page: 1, page_size: 20 });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForFunction(() => window.auditRequests.at(-1).params.page === 2);
  await page.getByLabel('Action Type').selectOption('login');
  await page.waitForFunction(() => window.auditRequests.at(-1).params.action === 'login');
  assert.equal((await lastParams()).page, 1);
  await page.getByLabel('Resource Type').selectOption('Role');
  await page.getByLabel('Status', { exact: true }).selectOption('false');
  await page.waitForFunction(() => window.auditRequests.at(-1).params.success === false);
  assert.deepEqual(await lastParams(), { page: 1, page_size: 20, action: 'login', resource_type: 'Role', success: false });
  for (const label of ['Action Type', 'Resource Type', 'Status']) await page.getByLabel(label, { exact: true }).selectOption('all');
  await page.waitForFunction(() => Object.keys(window.auditRequests.at(-1).params).length === 2);
  await page.getByRole('button', { name: /Today/ }).click();
  await page.waitForFunction(() => window.auditRequests.at(-1).params.scope === 'today');
  await page.getByRole('button', { name: /Failed Actions/ }).click();
  await page.waitForFunction(() => window.auditRequests.at(-1).params.scope === 'failed');
  await page.getByRole('button', { name: /Total Logs/ }).click();
  await page.getByLabel('Rows per page').selectOption('10');
  await page.getByRole('button', { name: 'Page 5', exact:true }).click();
  await page.waitForFunction(() => window.auditRequests.at(-1).params.page === 5);
  assert.equal(await page.locator('tbody tr').count(), 2);
  assert.equal(await page.getByRole('button', {name:'Next', exact:true}).isDisabled(), true);
  await page.getByRole('button', {name:/View details for/}).first().click();
  await page.getByRole('dialog').waitFor();
  assert.match(await page.getByRole('dialog').innerText(), /Engineering role/);
  assert.equal(await page.getByRole('dialog').getByText('12345', {exact:true}).count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', {name:'Clear filters'}).click();
  await page.getByLabel('Rows per page').selectOption('20');
  await page.getByRole('button', {name:/View details for/}).nth(1).click();
  assert.equal(await page.getByRole('dialog').getByText('11111111-1111-4111-8111-111111111111', {exact:true}).count(), 1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name:/View details for/}).nth(2).click();
  assert.equal(await page.getByRole('dialog').getByText('No target ID saved for this event', {exact:true}).count(), 1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.auditOffline = true; });
  await page.getByLabel('Action Type').selectOption('update');
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('tbody tr').count(), 0);
  assert.equal(await page.getByText('admin@radai.ae', { exact: true }).count(), 0);
  assert.equal(await page.getByText('No Audit Logs Found', { exact: true }).count(), 0);
  await page.evaluate(() => { window.auditOffline = false; });
  await page.getByLabel('Action Type').selectOption('all');
  await page.getByText('Engineering role', { exact: true }).first().waitFor();
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Passed: default filters, Axios payload, pagination, selected filters, false status, reset to All, failure without sample data, and retry.');
} finally { await browser.close(); }
