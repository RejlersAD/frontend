import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { prepareOpportunityPreview } from '../fixtures/sales-opportunity-preview-api';
import { officeSources, officeWorkbook } from '../fixtures/sales-office-files';

const workspace = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const preview = page => page.getByRole('dialog', { name: 'File preview', exact: true });
const details = page => page.getByRole('complementary', { name: 'Document details', exact: true });
const filename = (page, name) => workspace(page).getByRole('button', { name, exact: true });
const close = page => preview(page).getByRole('button', { name: 'Close preview', exact: true }).click();
const wordFrame = page => preview(page).frameLocator('iframe[title="Word document content"]');
const messageFrame = page => preview(page).frameLocator('iframe[title="Message content"]');

async function prepare(page, options = {}) {
  const externalRequests = [];
  page.on('request', request => {
    if (request.url().startsWith('https://preview-external.example/')) externalRequests.push(request.url());
  });
  const result = await prepareOpportunityPreview(page, { sources: officeSources(), ...options });
  return { ...result, externalRequests };
}

async function rendered(page, key) {
  if (key === 'workbook') {
    await expect(preview(page).getByRole('combobox', { name: 'Workbook sheet', exact: true })).toBeVisible({ timeout: 45000 });
    await expect(preview(page).getByRole('table', { name: 'Estimate', exact: true })).toContainText('Cached zero');
  } else if (key === 'document') {
    await expect(preview(page).getByRole('region', { name: 'Word document preview', exact: true })).toBeVisible({ timeout: 45000 });
    await expect(wordFrame(page).getByRole('heading', { name: 'Engineering scope document', exact: true })).toBeVisible();
  } else if (key === 'message') {
    await expect(preview(page).getByRole('region', { name: 'Outlook message preview', exact: true })).toContainText('Please review the synthetic scope.', { timeout: 45000 });
  } else {
    await expect(messageFrame(page).getByRole('heading', { name: 'Client clarification', exact: true })).toBeVisible({ timeout: 45000 });
  }
}

async function auditPreview(page) {
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa'];
  const outer = await new AxeBuilder({ page }).include('[aria-label="File preview"]').setLegacyMode().options({ iframes: false }).withTags(tags).analyze();
  expect(outer.violations).toEqual([]);
  // The real document frame intentionally forbids scripts. Axe's scheduled
  // callbacks cannot run there. Audit its actual sanitized DOM separately at
  // the rendered frame dimensions; the outer scan still checks frame labeling.
  for (const element of await preview(page).locator('iframe').all()) {
    const bounds = await element.boundingBox();
    const frame = await (await element.elementHandle()).contentFrame();
    const html = await frame.locator('html').evaluate(node => node.outerHTML);
    const documentPage = await page.context().newPage();
    try {
      await documentPage.setViewportSize({ width: Math.max(1, Math.round(bounds.width)), height: Math.max(1, Math.round(bounds.height)) });
      await documentPage.route('**/*', route => route.abort());
      await documentPage.setContent(html, { waitUntil: 'domcontentloaded' });
      const content = await new AxeBuilder({ page: documentPage }).withTags(tags).analyze();
      expect(content.violations).toEqual([]);
    } finally { await documentPage.close(); }
  }
}

test('real workbook sheets preserve saved zero and distinguish formulas without saved results', async ({ page }) => {
  const { fixture, state, externalRequests } = await prepare(page);
  await filename(page, fixture.file('workbook').name).dblclick();
  await rendered(page, 'workbook');
  const table = preview(page).getByRole('table', { name: 'Estimate', exact: true });
  await expect(table.getByRole('row').filter({ hasText: 'Cached zero' })).toContainText('0.00');
  await expect(table.getByRole('row').filter({ hasText: 'Uncached formula' })).toContainText('No saved result');
  await expect(preview(page)).toContainText(/saved.*values|values.*saved/i);
  await expect(preview(page)).toContainText(/not recalculated/i);
  await expect(table.getByRole('columnheader', { name: 'A', exact: true })).toBeVisible();
  await expect(table.getByRole('rowheader', { name: '2', exact: true })).toBeVisible();
  await expect(table.locator('a[href]')).toHaveCount(0);
  await preview(page).getByRole('combobox', { name: 'Workbook sheet', exact: true }).selectOption({ label: 'Notes' });
  await expect(preview(page).getByRole('table', { name: 'Notes', exact: true })).toContainText('Second sheet content');
  await expect(preview(page)).toContainText('<script>window.officePreviewExecuted=true</script>');
  expect(await page.evaluate(() => window.officePreviewExecuted)).toBeUndefined();
  expect(fixture.downloads.map(item => item.id)).toEqual([fixture.file('workbook').id]);
  expect(externalRequests).toEqual([]);
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('workbook row navigation displays the requested source rows and resets on sheet selection', async ({ page }) => {
  const sources = officeSources();
  sources[0].bytes = officeWorkbook({ rows: 205 });
  const { fixture, state } = await prepare(page, { sources });
  await filename(page, fixture.file('workbook').name).dblclick();
  await rendered(page, 'workbook');
  const table = preview(page).getByRole('table', { name: 'Estimate', exact: true });
  await expect(table.getByRole('cell', { name: 'Estimate row 101', exact: true })).toHaveCount(0);
  await preview(page).getByRole('button', { name: 'Next rows', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'Estimate row 101', exact: true })).toBeVisible();
  await expect(table).not.toContainText('Cached zero');
  await preview(page).getByRole('button', { name: 'Next rows', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'Estimate row 205', exact: true })).toBeVisible();
  await expect(preview(page).getByRole('button', { name: 'Next rows', exact: true })).toBeDisabled();
  await preview(page).getByRole('button', { name: 'Previous rows', exact: true }).click();
  await expect(table.getByRole('cell', { name: 'Estimate row 101', exact: true })).toBeVisible();
  await preview(page).getByRole('combobox', { name: 'Workbook sheet', exact: true }).selectOption({ label: 'Notes' });
  await expect(preview(page).getByRole('table', { name: 'Notes', exact: true })).toContainText('Second sheet content');
  await expect(preview(page).getByRole('button', { name: 'Previous rows', exact: true })).toBeDisabled();
  expect(state.pageErrors).toEqual([]);
});

test('large worksheet previews disclose the omitted rows and columns while retaining the original download', async ({ page }) => {
  const sources = officeSources();
  sources[0].bytes = officeWorkbook({ rows: 2002 });
  const { fixture, state } = await prepare(page, { sources });
  const file = fixture.file('workbook');
  await filename(page, file.name).dblclick();
  await rendered(page, 'workbook');
  await expect(preview(page)).toContainText('This sheet is larger than the preview.');
  await expect(preview(page)).toContainText(/2002 rows/);
  await expect(preview(page).getByRole('table').getByRole('row')).toHaveCount(101);
  await expect(preview(page).getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
  await close(page);
  fixture.bytes[file.id] = officeWorkbook({ columns: 101 });
  await filename(page, file.name).dblclick();
  await rendered(page, 'workbook');
  await expect(preview(page)).toContainText('This sheet is larger than the preview.');
  await expect(preview(page)).toContainText(/101 columns/);
  await expect(preview(page).getByRole('table').getByRole('columnheader')).toHaveCount(101);
  await expect(preview(page).getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
  expect(state.pageErrors).toEqual([]);
});

test('Word preview renders real headings tables and embedded images without active links or external requests', async ({ page }) => {
  const { fixture, state, externalRequests } = await prepare(page);
  await filename(page, fixture.file('document').name).dblclick();
  await rendered(page, 'document');
  const frame = wordFrame(page);
  await expect(frame.getByRole('table')).toContainText('Design report');
  await expect(frame.getByRole('table')).toContainText('Process team');
  const image = frame.getByRole('img', { name: 'Embedded diagram', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  await expect(frame.locator('body')).toContainText('Unsafe link label');
  await expect(frame.locator('body')).toContainText('Remote link label');
  await expect(frame.locator('script, iframe, object, embed, form, a[href]')).toHaveCount(0);
  await expect(preview(page).locator('iframe[title="Word document content"]')).toHaveAttribute('sandbox', 'allow-same-origin');
  expect(await page.evaluate(() => window.officePreviewExecuted)).toBeUndefined();
  expect(externalRequests).toEqual([]);
  await frame.getByRole('heading', { name: 'Engineering scope document', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(preview(page)).not.toBeVisible();
  await expect(filename(page, fixture.file('document').name)).toBeFocused();
  expect(state.pageErrors).toEqual([]);
});

test('real Outlook MSG exposes its envelope literal body and attachment inventory without opening attachments', async ({ page }) => {
  const { fixture, state, externalRequests } = await prepare(page);
  await filename(page, fixture.file('message').name).dblclick();
  await rendered(page, 'message');
  const region = preview(page).getByRole('region', { name: 'Outlook message preview', exact: true });
  for (const text of ['Synthetic bid clarification', 'Synthetic sender', 'sender@example.invalid', 'Proposal reviewer', 'reviewer@example.invalid', 'Copied reviewer', 'copy@example.invalid', 'Scope_attachment.txt']) await expect(region).toContainText(text);
  await expect(region).toContainText('<script>window.officePreviewExecuted=true</script>');
  await expect(region).toContainText(/28\s*B/);
  await expect(region.locator('a[href], script, iframe, object, embed')).toHaveCount(0);
  expect(await page.evaluate(() => window.officePreviewExecuted)).toBeUndefined();
  expect(fixture.downloads).toHaveLength(1);
  expect(externalRequests).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('rich MSG body is passive and cannot fetch trackers scripts frames or external links', async ({ page }) => {
  const { fixture, state, externalRequests } = await prepare(page);
  await filename(page, fixture.file('htmlmessage').name).dblclick();
  await rendered(page, 'htmlmessage');
  const frame = messageFrame(page);
  await expect(frame.locator('body')).toContainText('Review the attached scope before submission.');
  await expect(frame.locator('body')).toContainText('Unsafe mail link');
  await expect(frame.locator('body')).toContainText('Remote mail link');
  await expect(frame.locator('script, iframe, object, embed, form, a[href], img[src^="http"]')).toHaveCount(0);
  await expect(preview(page).locator('iframe[title="Message content"]')).toHaveAttribute('sandbox', 'allow-same-origin');
  expect(await page.evaluate(() => window.officePreviewExecuted)).toBeUndefined();
  expect(externalRequests).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

for (const key of ['workbook', 'document', 'message']) {
  test(`invalid ${key} bytes show a recoverable error and explicit retry reads the original file`, async ({ page }) => {
    const { fixture, state } = await prepare(page);
    const file = fixture.file(key);
    fixture.bytes[file.id] = key === 'message' ? Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]) : Buffer.from('PK\u0003\u0004Malformed Office archive');
    await filename(page, file.name).dblclick();
    await expect(preview(page).getByRole('alert')).toBeVisible();
    await expect(preview(page).getByRole('button', { name: 'Retry preview', exact: true })).toBeVisible();
    delete fixture.bytes[file.id];
    await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
    await rendered(page, key);
    expect(fixture.downloads.map(item => item.id)).toEqual([file.id, file.id]);
    expect(state.pageErrors).toEqual([]);
  });
}

test('workbook preview requires current export access before any bytes are loaded', async ({ page }) => {
  const { fixture, state } = await prepare(page);
  const file = fixture.file('workbook');
  fixture.detailPatches[file.id] = { can_download: false };
  await filename(page, file.name).dblclick();
  await expect(preview(page).getByRole('alert')).toContainText(/access|permission/i);
  await expect(preview(page).getByRole('table')).toHaveCount(0);
  expect(fixture.downloads).toEqual([]);
  fixture.detailPatches[file.id] = { can_download: true };
  await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await rendered(page, 'workbook');
  expect(fixture.downloads.map(item => item.id)).toEqual([file.id]);
  expect(state.pageErrors).toEqual([]);
});

test('a denied fresh download removes rendered Word content until an explicit authorized retry', async ({ page }) => {
  const { fixture, state } = await prepare(page);
  const file = fixture.file('document');
  await filename(page, file.name).dblclick();
  await rendered(page, 'document');
  fixture.downloadStatuses[file.id] = 403;
  await preview(page).getByRole('button', { name: 'Download', exact: true }).click();
  await expect(preview(page).getByRole('alert')).toContainText(/access|permission/i);
  await expect(preview(page).locator('iframe')).toHaveCount(0);
  await expect(preview(page).getByRole('button', { name: 'Download', exact: true })).toBeDisabled();
  fixture.downloadStatuses[file.id] = 200;
  await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await rendered(page, 'document');
  expect(fixture.downloads.map(item => item.id)).toEqual(Array(3).fill(file.id));
  expect(state.pageErrors).toEqual([]);
});

test('failed message transfer retains its context and retries only the same scoped file', async ({ page }) => {
  const { fixture, state } = await prepare(page);
  const file = fixture.file('message');
  fixture.downloadStatuses[file.id] = 503;
  await filename(page, file.name).dblclick();
  await expect(preview(page).getByRole('alert')).toContainText('temporarily unavailable');
  await expect(preview(page)).toContainText(file.name);
  fixture.downloadStatuses[file.id] = 200;
  await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await rendered(page, 'message');
  expect(fixture.downloads.map(item => item.id)).toEqual([file.id, file.id]);
  expect(state.pageErrors).toEqual([]);
});

test('closing a pending workbook aborts it and a late response cannot replace the new Word preview', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { fixture, state } = await prepare(page);
  const workbook = fixture.file('workbook');
  fixture.downloadHolds[workbook.id] = hold;
  await filename(page, workbook.name).dblclick();
  await expect.poll(() => fixture.downloads.length).toBe(1);
  await close(page);
  await expect.poll(() => fixture.abortedDownloads.includes(workbook.id)).toBe(true);
  await filename(page, fixture.file('document').name).dblclick();
  await rendered(page, 'document');
  release();
  await expect(preview(page).getByRole('table', { name: 'Estimate', exact: true })).toHaveCount(0);
  await expect(wordFrame(page).getByRole('heading', { name: 'Engineering scope document', exact: true })).toBeVisible();
  expect(state.pageErrors).toEqual([]);
});

test('closing while its parser worker is starting terminates that worker and later files still render', async ({ page }) => {
  let release;
  let held = false;
  const hold = new Promise(resolve => { release = resolve; });
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.officeWorkers = { created: 0, terminated: 0 };
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options);
        this.isOfficePreview = options?.name === 'Opportunity file preview';
        if (this.isOfficePreview) window.officeWorkers.created += 1;
      }
      terminate() {
        if (this.isOfficePreview) window.officeWorkers.terminated += 1;
        return super.terminate();
      }
    };
  });
  const { fixture, state } = await prepare(page);
  await page.route(/\/salesOfficePreview\.worker\.js(?:\?|$)/, async route => {
    if (!held) { held = true; await hold; }
    await route.continue().catch(() => {});
  });
  await filename(page, fixture.file('workbook').name).dblclick();
  await expect.poll(() => page.evaluate(() => window.officeWorkers.created)).toBe(1);
  await expect.poll(() => held).toBe(true);
  await expect(preview(page).getByRole('status')).toContainText(/loading|preparing/i);
  await close(page);
  await expect.poll(() => page.evaluate(() => window.officeWorkers.terminated)).toBe(1);
  release();
  await filename(page, fixture.file('document').name).dblclick();
  await rendered(page, 'document');
  await expect.poll(() => page.evaluate(() => window.officeWorkers.created)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.officeWorkers.terminated)).toBe(2);
  expect(state.pageErrors).toEqual([]);
});

for (const [key, screenshot] of [['workbook', 'excel'], ['document', 'word'], ['htmlmessage', 'outlook']]) {
  test(`actual application shell keeps ${screenshot} preview accessible on desktop and mobile`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1586, height: 992 });
    const { fixture, state } = await prepare(page, { realShell: true });
    await filename(page, fixture.file(key).name).dblclick();
    await rendered(page, key);
    await page.screenshot({ path: testInfo.outputPath(`${screenshot}-preview-desktop.png`), fullPage: true });
    await auditPreview(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(preview(page).getByRole('button', { name: 'Close preview', exact: true })).toBeInViewport();
    await rendered(page, key);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${screenshot}-preview-mobile.png`), fullPage: true });
    await auditPreview(page);
    await close(page);
    await expect(details(page)).toContainText(fixture.file(key).name);
    expect(state.pageErrors).toEqual([]);
  });
}
