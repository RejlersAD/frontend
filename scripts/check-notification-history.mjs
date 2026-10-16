import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import postcss from 'postcss';

const out = '../.codex-temp/notification-history-status-20260925';
await mkdir(out, { recursive: true });
const bundle = await build({
  stdin: { contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {MemoryRouter,Routes,Route} from 'react-router-dom';import Admin from './src/pages/AdminDashboard';
    let state={auth:{isAuthenticated:true,user:{id:1,is_superuser:true}},rbac:{currentUser:{roles:[]}}};const listeners=new Set();
    const store={getState:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},dispatch:()=>{}};
    window.switchAccount=(id,authenticated=true)=>{state={...state,auth:{isAuthenticated:authenticated,user:id?{id,is_superuser:true}:null},rbac:{currentUser:{roles:[]}}};listeners.forEach(fn=>fn());};
    createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/admin/dashboard']}><Routes><Route path="/admin/dashboard" element={<Admin/>}/></Routes></MemoryRouter></Provider>);
  `, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, loader: { '.css': 'empty' }, format: 'iife', jsx: 'automatic', define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'synthetic-api', setup(builder) {
    builder.onLoad({ filter: /services[\\/]api\.service\.js$/ }, () => ({ contents: `export default {get:async(path,config={})=>{window.apiCalls.push({path,params:config.params,method:'GET'});if(path==='/rbac/analytics/notification-history/'){window.historyCalls.push(config.params);return {data:await window.historyResponder(config.params)}}return {data:path.includes('latest')?{}:path.includes('overview')?{environment:'Test'}:[]}},post:()=>{throw Error('Unexpected write')},patch:()=>{throw Error('Unexpected write')},delete:()=>{throw Error('Unexpected write')}};`, loader: 'js' }));
    builder.onLoad({ filter: /store[\\/]slices[\\/]rbacSlice\.js$/ }, () => ({ contents: 'export const fetchCurrentUser=()=>({type:"fixture"});export const fetchUserStats=fetchCurrentUser;', loader: 'js' }));
    builder.onLoad({ filter: /services[\\/]rbac\.service\.js$/ }, () => ({ contents: 'export default {};', loader: 'js' }));
  } }],
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1512, height: 982 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>');
  const sharedStyles = postcss.parse(await readFile('src/index.css', 'utf8')).nodes.filter(node => node.type === 'rule' && [':root', '.dark'].includes(node.selector)).map(node => node.toString()).join('\n');
  await page.addStyleTag({ content: sharedStyles });
  for (const path of ['src/pages/AdminDashboard.css', 'src/components/admin/NotificationHistoryTab.css']) await page.addStyleTag({ content: (await readFile(path, 'utf8')).replace(/^@import.*$/gm, '') });
  await page.evaluate(() => {
    window.apiCalls = []; window.historyCalls = [];
    const events = [
      ['notification', 'recorded', 'Notification created', 'Recorded'],
      ['email', 'sent', 'Email send', 'Email send recorded'],
      ['teams', 'sent', 'Teams send', 'Teams request accepted'],
      ['web_push', 'failed', 'Push send failed', 'Failed'],
      ['notification', 'read', 'Notification read', 'Marked read'],
      ['web_push', 'skipped', 'Push send skipped', 'Skipped'],
      ['other', 'unknown', 'Other event', 'Unknown'],
      ['notification', 'archived', 'Notification archived', 'Archived'],
    ];
    window.rows = Array.from({ length: 52 }, (_, index) => {
      const [channel, outcome, event_label, outcome_label] = events[index % events.length];
      const delivery_status = channel === 'notification' ? 'not_applicable' : channel === 'other' ? 'unknown' : outcome;
      const delivery_status_label = delivery_status === 'not_applicable' ? 'Not applicable' : outcome_label;
      const read_status = index % 3 === 0 ? 'read' : 'unread';
      const row = { id: String(index + 1), timestamp: '2026-09-25T06:30:00Z', notification_id: index + 1000, recipient: index === 6 ? null : { id: 31, name: 'Example Recipient', username: 'example.recipient', email: 'recipient@example.test' }, category: index === 6 ? null : 'APPROVAL', action: 'created', event_label, channel, outcome, outcome_label, delivery_status, delivery_status_label, read_status, read_status_label: read_status === 'read' ? 'Marked read' : 'Unread', reason_label: outcome === 'failed' ? 'Push request failed' : null, title: 'SECRET TITLE', message: 'SECRET MESSAGE', details: { url: 'SECRET URL', token: 'SECRET TOKEN' } };
      if (index === 6) for (const key of ['delivery_status', 'delivery_status_label', 'read_status', 'read_status_label']) delete row[key];
      if (index === 14) Object.assign(row, { delivery_status: 'unsupported', delivery_status_label: 'SECRET DELIVERY', read_status: 'unsupported', read_status_label: 'SECRET READ' });
      return row;
    });
    window.defaultHistory = params => {
      let rows = window.rows.filter(row => (!params.channel || row.channel === params.channel) && (!params.outcome || row.outcome === params.outcome) && (!params.search || String(row.notification_id).includes(params.search) || row.recipient?.name.toLowerCase().includes(params.search.toLowerCase())));
      return { count: rows.length, next: null, previous: null, timezone: 'Asia/Dubai', results: rows.slice((params.page - 1) * params.page_size, params.page * params.page_size) };
    };
    window.historyResponder = async params => window.defaultHistory(params);
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const check = async (name, fn) => { await fn(); results.push(name); console.log(`PASS ${name}`); };
  const tab = page.getByRole('tab', { name: 'Notification Logs History', exact: true });
  const section = page.locator('.ac-notification-history');
  const lastParams = () => page.evaluate(() => window.historyCalls.at(-1));
  const filterSearch = async value => { await page.getByRole('searchbox', { name: 'Recipient or notification ID' }).fill(value); await section.getByRole('button', { name: 'Search', exact: true }).click(); };
  const waitParams = expected => page.waitForFunction(expected => Object.entries(expected).every(([key, value]) => window.historyCalls.at(-1)?.[key] === value), expected);

  await check('System Health tab reachable; inactive history never fetches', async () => {
    await page.getByRole('heading', { name: 'System Health', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 8);
    assert.equal(await page.evaluate(() => window.historyCalls.length), 0);
    await tab.click(); await section.getByText('1–25 of 52 events', { exact: true }).waitFor();
    assert.deepEqual(await lastParams(), { hours: 24, page: 1, page_size: 25 });
    assert.equal(await section.locator('tbody tr').count(), 25);
    assert.equal(await tab.getAttribute('aria-selected'), 'true');
  });
  await check('Recorded outcomes and safe inert details; Escape restores focus', async () => {
    assert.equal(await section.locator('tbody tr td:nth-child(8)').getByText('Teams request accepted', { exact: true }).count(), 3);
    assert.equal(await section.getByText('Delivered', { exact: true }).count(), 0);
    const view = section.getByRole('button', { name: 'View event 4', exact: true });
    await view.click(); const dialog = page.getByRole('dialog', { name: 'Notification event details' });
    await dialog.getByText('Push request failed', { exact: true }).waitFor();
    assert.equal(await dialog.locator('pre,a').count(), 0);
    assert.equal(await dialog.getByRole('button').count(), 1);
    assert.equal(await section.getByText(/SECRET/).count(), 0);
    assert.ok((await dialog.textContent()).includes('10:30:00'));
    await page.screenshot({ path: `${out}/details-desktop.png`, fullPage: true });
    await page.keyboard.press('Escape'); assert.equal(await view.evaluate(node => node === document.activeElement), true);
    await section.getByRole('button', { name: 'View event 7', exact: true }).click();
    await dialog.getByText('Other event', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
  });
  await check('Delivery and Read Status replace Event with independent current read state', async () => {
    assert.deepEqual(await section.getByRole('columnheader').allTextContents(), ['Time', 'Recipient', 'Notification ID', 'Category', 'Channel', 'Delivery Status', 'Read Status', 'Outcome', 'Details']);
    assert.equal(await section.getByRole('columnheader', { name: 'Event', exact: true }).count(), 0);
    const statusCells = async eventId => section.locator('tbody tr').filter({ has: page.getByRole('button', { name: `View event ${eventId}`, exact: true }) }).locator('td').allTextContents();
    const lifecycle = await statusCells(1);
    assert.deepEqual(lifecycle.slice(5, 8), ['Not applicable', 'Marked read', 'Recorded']);
    const email = await statusCells(2);
    assert.deepEqual(email.slice(5, 8), ['Email send recorded', 'Unread', 'Email send recorded']);
    const failed = await statusCells(4);
    assert.deepEqual(failed.slice(5, 8), ['Failed', 'Marked read', 'Failed']);
    const readEvent = await statusCells(5);
    assert.deepEqual(readEvent.slice(5, 8), ['Not applicable', 'Unread', 'Marked read']);
    for (const eventId of [7, 15]) assert.deepEqual((await statusCells(eventId)).slice(5, 7), ['Unknown', 'Unknown']);
    assert.equal(await section.getByText(/SECRET/).count(), 0);
  });
  await check('Refresh updates current Read Status in both the row and open details without mutation', async () => {
    await filterSearch('1001');
    await section.getByRole('button', { name: 'View event 2', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Notification event details' });
    const readDetail = dialog.locator('dt:has-text("Read Status") + dd');
    assert.equal(await readDetail.textContent(), 'Unread');
    await page.evaluate(() => { Object.assign(window.rows[1], { read_status: 'read', read_status_label: 'Marked read' }); });
    await page.getByRole('button', { name: 'Refresh', exact: true }).evaluate(node => node.click());
    await dialog.getByText('Marked read', { exact: true }).waitFor();
    assert.equal(await section.locator('tbody tr td:nth-child(7)').textContent(), 'Marked read');
    assert.equal(await section.locator('tbody tr td:nth-child(6)').textContent(), 'Email send recorded');
    assert.equal(await dialog.locator('dt:has-text("Delivery Status") + dd').textContent(), 'Email send recorded');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { Object.assign(window.rows[1], { read_status: 'unread', read_status_label: 'Unread' }); });
    await section.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await section.locator('tbody tr').nth(24).waitFor();
  });
  await check('Server search/channel/outcome and pagination sizes reset page', async () => {
    await section.getByRole('button', { name: 'Next', exact: true }).click(); await waitParams({ page: 2 });
    await section.getByText('26–50 of 52 events', { exact: true }).waitFor();
    await page.getByLabel('Channel', { exact: true }).selectOption('web_push'); await waitParams({ page: 1, channel: 'web_push' });
    await page.getByLabel('Outcome', { exact: true }).selectOption('failed'); await waitParams({ outcome: 'failed' });
    await section.getByText('1–7 of 7 events', { exact: true }).waitFor();
    await filterSearch('1003'); await waitParams({ search: '1003', channel: 'web_push', outcome: 'failed' });
    await section.getByText('1–1 of 1 events', { exact: true }).waitFor();
    await section.getByRole('button', { name: 'Clear filters', exact: true }).first().click();
    await section.getByText('1–25 of 52 events', { exact: true }).waitFor();
    await page.getByLabel('Rows per page', { exact: true }).selectOption('50'); await waitParams({ page_size: 50, page: 1 });
    await section.getByText('1–50 of 52 events', { exact: true }).waitFor();
    await page.getByLabel('Rows per page', { exact: true }).selectOption('100'); await section.getByText('1–52 of 52 events', { exact: true }).waitFor();
    assert.equal(await section.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
    await page.getByLabel('Rows per page', { exact: true }).selectOption('25');
  });
  await check('Parent time range and Refresh reload history; period resets page', async () => {
    await section.getByRole('button', { name: 'Next', exact: true }).click(); await waitParams({ page: 2 });
    await page.getByLabel('Activity time range').selectOption('168'); await waitParams({ hours: 168, page: 1 });
    await page.getByLabel('Activity time range').selectOption('720'); await waitParams({ hours: 720, page: 1 });
    const count = await page.evaluate(() => window.historyCalls.length);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForFunction(count => window.historyCalls.length > count, count);
  });
  await check('No results preserve filters; clear recovers', async () => {
    await filterSearch('missing-recipient'); await section.getByText('No notification events match these filters.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox').inputValue(), 'missing-recipient');
    await section.getByRole('button', { name: 'Clear filters', exact: true }).last().click();
    await section.getByText('1–25 of 52 events', { exact: true }).waitFor();
  });
  await check('Refresh failure retains prior results and filters; safe retry', async () => {
    await page.getByLabel('Channel', { exact: true }).selectOption('email'); await section.getByText('1–7 of 7 events', { exact: true }).waitFor();
    await page.evaluate(() => { window.historyResponder = async () => { throw { response: { status: 500, data: { detail: { private: 'SECRET FAILURE' } } } }; }; });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await section.getByRole('alert').waitFor();
    assert.ok((await section.getByRole('alert').textContent()).includes('Previous results are shown'));
    assert.equal(await section.locator('tbody tr').count(), 7);
    assert.equal(await section.getByText(/SECRET FAILURE/).count(), 0);
    await page.evaluate(() => { window.historyResponder = async params => window.defaultHistory(params); });
    await section.getByRole('button', { name: 'Retry', exact: true }).click(); await section.getByRole('alert').waitFor({ state: 'hidden' });
    assert.equal(await page.getByLabel('Channel', { exact: true }).inputValue(), 'email');
  });
  await check('Denied refresh clears previous records and details; retry retains filters', async () => {
    await section.getByRole('button', { name: 'View event 2', exact: true }).click();
    await page.evaluate(() => { window.historyResponder = async () => { throw { response: { status: 403 } }; }; });
    await page.getByRole('button', { name: 'Refresh', exact: true }).evaluate(node => node.click());
    await section.getByText('You do not have access to notification history.', { exact: true }).waitFor();
    assert.equal(await section.locator('tbody tr').count(), 0);
    assert.equal(await page.getByRole('dialog', { name: 'Notification event details' }).count(), 0);
    assert.equal(await page.getByLabel('Channel', { exact: true }).inputValue(), 'email');
    await page.evaluate(() => { window.historyResponder = async params => window.defaultHistory(params); });
    await section.getByRole('button', { name: 'Retry', exact: true }).click(); await section.getByText('1–7 of 7 events', { exact: true }).waitFor();
    await section.getByRole('button', { name: 'Clear filters', exact: true }).click();
  });
  await check('Slow old-filter response cannot replace a newer result', async () => {
    await page.evaluate(() => { window.historyResponder = params => params.search === 'old' ? new Promise(resolve => { window.resolveOld = () => resolve(window.defaultHistory({ ...params, search: '' })); }) : Promise.resolve(window.defaultHistory(params)); });
    await filterSearch('old'); await page.waitForFunction(() => !!window.resolveOld);
    await filterSearch('1003'); await section.getByText('1–1 of 1 events', { exact: true }).waitFor();
    await page.evaluate(() => window.resolveOld());
    await page.waitForTimeout(100);
    assert.equal(await section.locator('tbody tr').count(), 1);
    assert.equal(await section.getByText('1003', { exact: true }).count(), 1);
  });
  await check('Late success cannot restore rows after a newer denied search', async () => {
    await page.evaluate(() => { window.historyResponder = params => params.search === 'waiting' ? new Promise(resolve => { window.resolveBeforeDenied = () => resolve(window.defaultHistory({ ...params, search: '' })); }) : Promise.reject({ response: { status: 403 } }); });
    await filterSearch('waiting'); await page.waitForFunction(() => !!window.resolveBeforeDenied);
    await filterSearch('denied'); await section.getByText('You do not have access to notification history.', { exact: true }).waitFor();
    await page.evaluate(() => window.resolveBeforeDenied()); await page.waitForTimeout(100);
    assert.equal(await section.locator('tbody tr').count(), 0);
    assert.equal(await page.getByRole('searchbox').inputValue(), 'denied');
    await page.evaluate(() => { window.historyResponder = async params => window.defaultHistory(params); });
    await filterSearch('1003'); await section.getByText('1–1 of 1 events', { exact: true }).waitFor();
  });
  await check('Account change removes old content/details and ignores late responses', async () => {
    await section.getByRole('button', { name: 'View event 4', exact: true }).click();
    await page.evaluate(() => { window.historyResponder = () => new Promise(resolve => { window.resolvePreviousAccount = () => resolve(window.defaultHistory({ page: 1, page_size: 25 })); }); });
    await page.getByRole('button', { name: 'Refresh', exact: true }).evaluate(node => node.click()); await page.waitForFunction(() => !!window.resolvePreviousAccount);
    await page.evaluate(() => { window.historyResponder = async () => ({ count: 1, results: [{ ...window.rows[0], id: 'new-account', recipient: { name: 'Second account recipient' } }], timezone: 'UTC' }); window.switchAccount(2); });
    await section.getByText('Second account recipient', { exact: true }).waitFor();
    assert.equal(await page.getByRole('searchbox').inputValue(), '');
    assert.equal(await section.getByText('Example Recipient', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('dialog', { name: 'Notification event details' }).count(), 0);
    await page.evaluate(() => window.resolvePreviousAccount()); await page.waitForTimeout(100);
    assert.equal(await section.getByText('Second account recipient', { exact: true }).count(), 1);
  });
  await check('Inactive-account response cannot restore unmounted history', async () => {
    await page.evaluate(() => { window.historyResponder = () => new Promise(resolve => { window.resolveInactiveAccount = () => resolve(window.defaultHistory({ page: 1, page_size: 25 })); }); });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await page.waitForFunction(() => !!window.resolveInactiveAccount);
    await page.evaluate(() => window.switchAccount(null, false)); await section.waitFor({ state: 'hidden' });
    await page.evaluate(() => window.resolveInactiveAccount()); await page.waitForTimeout(100);
    assert.equal(await page.getByText('Example Recipient', { exact: true }).count(), 0);
    await page.evaluate(() => { window.historyResponder = async params => window.defaultHistory(params); window.switchAccount(3); });
    await section.getByText('1–25 of 52 events', { exact: true }).waitFor();
  });
  await check('Shrinking page results recover page one; empty period is explicit', async () => {
    await section.getByRole('button', { name: 'Next', exact: true }).click(); await waitParams({ page: 2 });
    await page.evaluate(() => { window.historyResponder = async params => { if (params.page > 1) throw { response: { status: 404 } }; return window.defaultHistory(params); }; });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await waitParams({ page: 1 });
    await section.getByText('1–25 of 52 events', { exact: true }).waitFor();
    await page.evaluate(() => { window.historyResponder = async () => ({ count: 0, results: [], timezone: 'UTC' }); });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await section.getByText('No notification events recorded in this period.', { exact: true }).waitFor();
    await page.evaluate(() => { window.historyResponder = async params => window.defaultHistory(params); });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click(); await section.getByText('1–25 of 52 events', { exact: true }).waitFor();
  });
  await check('Desktop/mobile/dark layout and keyboard focus preserve shell', async () => {
    await page.screenshot({ path: `${out}/history-desktop.png`, fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    assert.equal(await section.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(15, 23, 42)');
    await page.screenshot({ path: `${out}/history-dark.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await tab.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${out}/history-mobile-dark.png`, fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    await section.getByRole('button', { name: 'View event 1', exact: true }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `${out}/details-mobile.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await section.locator('.ac-table-scroll').evaluate(node => { node.scrollLeft = 0; });
    await page.getByRole('searchbox').focus(); assert.equal(await page.getByRole('searchbox').evaluate(node => getComputedStyle(node).outlineWidth), '2px');
    await page.screenshot({ path: `${out}/history-mobile.png`, fullPage: true });
  });
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => window.apiCalls.some(call => call.method !== 'GET')), false);
  await writeFile(`${out}/browser-results.json`, JSON.stringify({ passed: results.length, results, pageErrors: errors, apiWrites: 0 }, null, 2));
  console.log(`${results.length} Notification History browser checks passed; zero page errors and API writes.`);
} finally { await browser.close(); }
