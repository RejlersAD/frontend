import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Every API call is replaced at bundle time. No application database is accessed.
const fixture = {
  database: 'default', engine: 'postgresql', can_manage: true,
  tables: [
    { name: 'public.upload_staging', row_count: 12500, row_count_is_estimate: true, managed: true, model: 'uploads.Staging', referenced_by: [], can_clear: true, can_drop: true, clear_blocked_reason: '', drop_blocked_reason: '' },
    { name: 'public.users_user', row_count: 300, row_count_is_estimate: false, managed: true, model: 'users.User', referenced_by: ['public.upload_staging'], can_clear: false, can_drop: false, clear_blocked_reason: 'Protected authentication table.', drop_blocked_reason: 'Protected authentication table.' },
    { name: 'public.archived_notes', row_count: null, row_count_is_estimate: false, managed: false, model: null, referenced_by: [], can_clear: true, can_drop: true, clear_blocked_reason: '', drop_blocked_reason: '' },
  ],
};
const bundle = await build({
  stdin: {
    contents: `import React, {useState} from 'react';import {createRoot} from 'react-dom/client';import DatabaseCleaning from './src/components/admin/DatabaseCleaning';function App(){const [active,setActive]=useState(true);window.setDatabaseActive=setActive;return <main className="admin-console"><div className="ac-main" hidden={!active}><DatabaseCleaning active={active}/></div></main>}createRoot(document.getElementById('root')).render(<App/>);`,
    resolveDir: process.cwd(), loader: 'jsx',
  },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  plugins: [{ name: 'mock-api', setup(builder) {
    builder.onLoad({ filter: /services[\\/]api\.service\.js$/ }, () => ({
      loader: 'js', contents: `
        export default {
          async get(url) {
            window.apiRequests.push({method:'GET',url});
            if(window.pauseList)await new Promise(resolve=>window.finishList=resolve);
            if(window.listError)throw window.listError;
            if(window.failList)throw {response:{status:503,data:{detail:'Database inventory unavailable.'}}};
            return {data:structuredClone(window.inventory)};
          },
          async post(url, body) {
            window.apiRequests.push({method:'POST',url,body});
            if(window.pauseMutation)await new Promise(resolve=>window.finishMutation=resolve);
            if(window.failAction)throw {response:{status:409,data:{detail:'The table is referenced by another table.',referenced_by:['new_dependency']}}};
            if(window.failNetwork)throw Error('Network disconnected');
            if(body.action==='drop')window.inventory.tables=window.inventory.tables.filter(table=>table.name!==body.table);
            else {const table=window.inventory.tables.find(table=>table.name===body.table);table.row_count=0;table.row_count_is_estimate=false;}
            return {data:{success:true,table:body.table,action:body.action,deleted_rows:body.action==='clear'?12500:null,message:body.action==='clear'?'Deleted 12,500 rows from public.upload_staging.':'Deleted table '+body.table+'.'}};
          }
        };
      `,
    }));
  } }],
});

const out = '../artifacts/database-cleaning';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<!doctype html><html lang="en"><head><title>Database cleaning checks</title></head><body style="margin:0"><div id="root"></div></body></html>');
  await page.evaluate(value => { window.inventory = value; window.apiRequests = []; window.pauseList = true; }, fixture);
  await page.addStyleTag({ content: (await readFile('src/pages/AdminDashboard.css', 'utf8')).replace(/^@import.*$/gm, '') });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole('status').getByText('Loading database tables…').waitFor();
  assert.ok(await page.getByRole('button', { name: 'Refresh tables', exact: true }).isDisabled());
  await page.evaluate(() => { window.pauseList = false; window.finishList(); });
  const table = page.getByRole('table', { name: 'Database tables', exact: true });
  const rows = table.locator('tbody tr');
  await page.getByText('12,500 (estimate)', { exact: true }).waitFor();
  assert.equal(await rows.count(), 3);
  await page.getByText('Unavailable', { exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Delete data from public.users_user', exact: true }).isDisabled());
  assert.ok(await page.getByRole('button', { name: 'Delete table public.users_user', exact: true }).isDisabled());
  await page.getByText('1 referencing table', { exact: true }).click();
  assert.equal(await rows.filter({ hasText: 'public.users_user' }).locator('details[open] li').count(), 1);

  const search = page.getByRole('textbox', { name: 'Search database tables', exact: true });
  await search.fill('uploads.staging');
  assert.equal(await rows.count(), 1);
  await search.fill('not-a-table');
  await page.getByText('No tables match your search.', { exact: true }).waitFor();
  await search.fill('');
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });

  await page.getByRole('button', { name: 'Delete data from public.upload_staging', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByText('This permanently deletes every row in this table and keeps its structure. Deleted data can only be recovered from a backup.', { exact: true }).waitFor();
  assert.ok(await dialog.getByRole('button', { name: 'Delete data', exact: true }).isDisabled());
  await page.getByLabel('Type the exact table name to confirm').fill('UPLOAD_STAGING');
  assert.ok(await dialog.getByRole('button', { name: 'Delete data', exact: true }).isDisabled());
  await page.getByLabel('Type the exact table name to confirm').fill('public.upload_staging ');
  assert.ok(await dialog.getByRole('button', { name: 'Delete data', exact: true }).isDisabled());
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal((await page.evaluate(() => window.apiRequests.filter(request => request.method === 'POST'))).length, 0);

  await page.getByRole('button', { name: 'Delete data from public.upload_staging', exact: true }).click();
  await page.getByLabel('Type the exact table name to confirm').fill('public.upload_staging');
  const accessibility = await new AxeBuilder({ page }).include('.ac-database-dialog').analyze();
  assert.deepEqual(accessibility.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) })), []);
  await page.evaluate(() => { window.pauseMutation = true; });
  await dialog.getByRole('button', { name: 'Delete data', exact: true }).click();
  await dialog.getByRole('button', { name: 'Processing…', exact: true }).waitFor();
  assert.ok(await dialog.getByRole('button', { name: 'Processing…', exact: true }).isDisabled());
  assert.ok(await dialog.getByRole('button', { name: 'Cancel', exact: true }).isDisabled());
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 1);
  await page.evaluate(() => { document.querySelector('.ac-database-dialog form').requestSubmit(); window.setDatabaseActive(false); });
  await page.waitForFunction(() => !document.querySelector('.ac-database-dialog').open);
  await page.evaluate(() => window.setDatabaseActive(true));
  await dialog.getByRole('button', { name: 'Processing…', exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.apiRequests.filter(request => request.method === 'POST'))).length, 1);
  await page.evaluate(() => { window.pauseMutation = false; window.finishMutation(); });
  await page.getByRole('status').getByText('Deleted 12,500 rows from public.upload_staging.', { exact: true }).waitFor();
  await rows.filter({ hasText: 'uploads.Staging' }).getByText('0', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.apiRequests.find(request => request.method === 'POST')), {
    method: 'POST', url: '/rbac/admin/database/tables/action/', body: { table: 'public.upload_staging', action: 'clear', confirmation: 'public.upload_staging' },
  });

  await page.getByRole('button', { name: 'Delete table public.archived_notes', exact: true }).click();
  await dialog.getByText(/Application features that use it may stop working/).waitFor();
  await page.getByLabel('Type the exact table name to confirm').fill('public.archived_notes');
  await page.screenshot({ path: `${out}/delete-table-confirmation.png`, fullPage: true });
  await dialog.getByRole('button', { name: 'Delete table', exact: true }).click();
  await page.getByRole('status').getByText('Deleted table public.archived_notes.', { exact: true }).waitFor();
  assert.equal(await rows.count(), 2);
  assert.equal(await page.getByRole('button', { name: 'Delete table public.archived_notes', exact: true }).count(), 0);

  await page.evaluate(() => { window.failAction = true; });
  await page.getByRole('button', { name: 'Delete table public.upload_staging', exact: true }).click();
  await page.getByLabel('Type the exact table name to confirm').fill('public.upload_staging');
  await dialog.getByRole('button', { name: 'Delete table', exact: true }).click();
  await dialog.getByRole('alert').getByText('The table is referenced by another table. Referenced by: new_dependency.', { exact: true }).waitFor();
  assert.equal(await rows.count(), 2);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.evaluate(() => { window.failAction = false; window.failNetwork = true; });
  await page.getByRole('button', { name: 'Delete table public.upload_staging', exact: true }).click();
  await page.getByLabel('Type the exact table name to confirm').fill('public.upload_staging');
  await dialog.getByRole('button', { name: 'Delete table', exact: true }).click();
  await dialog.getByRole('alert').getByText(/request outcome could not be confirmed/).waitFor();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.evaluate(() => { window.failNetwork = false; window.inventory.can_manage = false; });
  await page.getByRole('button', { name: 'Refresh tables', exact: true }).click();
  await page.getByText('View only. A super administrator is required to delete data or tables.', { exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Delete data from public.upload_staging', exact: true }).isDisabled());
  assert.ok(await page.getByRole('button', { name: 'Delete table public.upload_staging', exact: true }).isDisabled());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile page overflow');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: `${out}/mobile-dark.png`, fullPage: true });

  await page.evaluate(() => { window.failList = true; });
  await page.getByRole('button', { name: 'Refresh tables', exact: true }).click();
  await page.getByRole('alert').getByText(/Database inventory unavailable/).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Delete data from public.upload_staging', exact: true }).isDisabled());
  await page.evaluate(() => { window.failList = false; window.inventory.can_manage = true; });
  for (const [error, message] of [
    [{ response: { status: 404, data: '<!doctype html><title>Not Found</title>' } }, 'Database cleaning is unavailable on the connected server (404). The server needs to load the database maintenance update before tables can be shown.'],
    [{ response: { status: 401, data: {} } }, 'Your session has expired or you are not signed in (401). Sign in again to load database tables.'],
    [{ response: { status: 403, data: {} } }, 'Your account does not have permission to view database tables (403). Administrator access is required.'],
    [{ response: { status: 403, data: { detail: 'Your password has expired.' } } }, 'Your password has expired.'],
    [{ response: { status: 500, data: '<!doctype html><title>Server Error</title>' } }, 'The server could not load database tables (500). Check the backend logs, then refresh tables after the server issue is resolved.'],
    [{ isNetworkError: true, message: 'Cannot connect to server' }, 'Cannot reach the server to load database tables. Check your connection and that the backend is running, then refresh tables.'],
    [{ isTimeout: true, message: 'Request timeout - server is not responding' }, 'Loading database tables timed out. The server may be busy; wait a moment and refresh tables.'],
    [{ code: 'ECONNABORTED', message: 'timeout of 120000ms exceeded' }, 'Loading database tables timed out. The server may be busy; wait a moment and refresh tables.'],
  ]) {
    await page.evaluate(value => { window.listError = value; }, error);
    await page.getByRole('button', { name: 'Refresh tables', exact: true }).click();
    await page.getByRole('alert').getByText(message, { exact: false }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Delete data from public.upload_staging', exact: true }).isDisabled());
    assert.ok(await page.getByRole('button', { name: 'Delete table public.upload_staging', exact: true }).isDisabled());
  }
  await page.evaluate(() => { window.listError = null; });
  await page.getByRole('button', { name: 'Refresh tables', exact: true }).click();
  await page.getByRole('alert').waitFor({ state: 'hidden' });
  assert.ok(await page.getByRole('button', { name: 'Delete data from public.upload_staging', exact: true }).isEnabled());
  assert.ok(await page.getByRole('button', { name: 'Delete table public.upload_staging', exact: true }).isEnabled());
  await page.evaluate(() => { window.failList = false; window.inventory.tables = []; });
  await page.getByRole('button', { name: 'Refresh tables', exact: true }).click();
  await page.getByText('No database tables found.', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  assert.ok((await page.evaluate(() => window.apiRequests.filter(request => request.method === 'GET'))).every(request => request.url === '/rbac/admin/database/tables/'));
  console.log('Passed: API contracts, table inventory/search/counts, protected and read-only actions, typed confirmation/cancellation, modal accessibility, duplicate submission prevention, pending action across tabs, clear/drop refresh, dependency and network errors, mobile/dark layouts, unavailable and empty inventory, actionable 404/auth/server/network/timeout errors and recovery. All requests mocked.');
} finally {
  await browser.close();
}
