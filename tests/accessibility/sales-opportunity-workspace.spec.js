import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

const root = 'https://rejlerssverige.sharepoint.com/sites/TeamADSalesBidding/Delade%20dokument/General/Myynti/Opportunities';
const panel = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const rowButton = (page, id) => page.locator('.sor-table-scroll').getByRole('button', { name: `Q-${102101 + id}`, exact: true });
const ready = (id = 'opportunity-0', patch = {}) => ({
  opportunity_id: id, deal_code: 'Q-102101', status: 'ready', message: '', web_url: `${root}/Q-102101`, can_manage: true, can_upload: true, max_upload_bytes: 10485760,
  folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, item_count: 0, web_url: `${root}/Q-102101/${folder.name}` })), ...patch,
});
const file = (id = 'one', name = 'Engineering scope.pdf') => ({ id, name, size: 1024, modified_at: '2026-10-01T08:00:00Z', web_url: `${root}/Q-102101/Tender/${name}` });

async function setup(page, configuration = {}) {
  const fixture = { workspaceStatus: 200, workspacePatch: {}, uploadStatus: 201, uploads: [], files: [file()], filesStatus: 200, ...configuration };
  const state = await prepareRegister(page, {
    records: [opportunity(0), opportunity(1, { owner: 12, owner_name: 'Omar Ali', submission_due_date: '2026-10-02' })],
    ...configuration,
    workspaceHandler: async route => {
      const url = new URL(route.request().url());
      const id = url.pathname.split('/deals/')[1].split('/')[0];
      if (url.pathname.endsWith('/workspace/')) {
        if (fixture.workspaceHold?.[id]) await fixture.workspaceHold[id];
        return route.fulfill({ status: fixture.workspaceStatus, json: fixture.workspaceStatus === 200 ? ready(id, fixture.workspacePatch) : { detail: 'Workspace access denied.' } });
      }
      if (url.pathname.endsWith('/setup/')) { fixture.workspacePatch = { ...fixture.workspacePatch, status: 'pending' }; return route.fulfill({ json: ready(id, fixture.workspacePatch) }); }
      if (url.pathname.endsWith('/files/')) {
        if (fixture.filesHold) await fixture.filesHold;
        return route.fulfill({ status: fixture.filesStatus, json: fixture.filesStatus === 200 ? { files: url.searchParams.get('cursor') ? [file('two', 'Clarification.pdf')] : fixture.files, item_count: fixture.files.length, next_cursor: fixture.nextCursor && !url.searchParams.get('cursor') ? 'cursor-two' : null } : { detail: 'Files access denied.' } });
      }
      if (url.pathname.endsWith('/upload/')) {
        fixture.uploads.push({ body: route.request().postDataBuffer().toString(), path: url.pathname });
        return route.fulfill({ status: fixture.uploadStatus, json: fixture.uploadStatus < 300 ? file('upload', 'review.pdf') : { detail: 'SharePoint is temporarily unavailable. Retry this file.' } });
      }
      return route.fulfill({ status: 400, json: { detail: 'Unexpected workspace action' } });
    },
  });
  await page.getByRole('button', { name: 'Filters and table settings' }).click();
  await page.locator('summary').filter({ hasText: /^\s*More\s*$/ }).click();
  await page.getByRole('button', { name: 'Hide register summary' }).click();
  await rowButton(page, 0).click();
  return { fixture, state };
}

test('ready workspace uses actual code, six folders, files and paginated browsing', async ({ page }) => {
  const { state } = await setup(page, { nextCursor: true });
  await expect(panel(page).getByRole('status')).toHaveText('Workspace ready');
  await expect(panel(page).getByRole('table')).toContainText('Correspondence');
  await expect(panel(page).getByRole('link', { name: 'Open SharePoint' })).toHaveAttribute('href', `${root}/Q-102101`);
  await panel(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Engineering scope.pdf', exact: true })).toBeVisible();
  await panel(page).getByRole('button', { name: 'Load more files' }).click();
  await expect(panel(page).getByRole('button', { name: 'Clarification.pdf', exact: true })).toBeVisible();
  await panel(page).getByRole('textbox', { name: 'Search loaded files' }).fill('Clarification');
  await expect(panel(page).getByRole('button', { name: 'Engineering scope.pdf', exact: true })).toHaveCount(0);
  expect(state.pageErrors).toEqual([]);
});

test('unconfigured workspace shows unknown counts and an actionable upload explanation', async ({ page }) => {
  await setup(page, { workspacePatch: { status: 'not_configured', web_url: '', can_manage: false, can_upload: false, folders: [] } });
  await expect(panel(page)).toContainText('administrator setup');
  await expect(panel(page)).toContainText('Item counts unavailable');
  await expect(panel(page).getByRole('button', { name: 'Upload files' })).toBeEnabled();
  await expect(panel(page).getByRole('link', { name: 'Open SharePoint' })).toHaveCount(0);
  await expect(panel(page).locator('.sow-count')).toHaveText(['—', '—', '—', '—', '—', '—']);
  await panel(page).getByRole('button', { name: 'Upload files' }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog).toContainText('administrator setup');
  await expect(dialog.getByRole('button', { name: 'Upload file', exact: true })).toBeDisabled();
});

test('malformed ready workspace is unavailable and cannot expose unsafe links', async ({ page }) => {
  await setup(page, { workspacePatch: { folders: [], web_url: 'https://evil.example.test' } });
  await expect(panel(page).getByRole('alert')).toContainText('could not be verified');
  await expect(panel(page).getByRole('button', { name: 'Upload files' })).toBeEnabled();
  await expect(panel(page).getByRole('link')).toHaveCount(0);
});

test('read-only workspace can browse empty folders and recover a failed listing', async ({ page }) => {
  const { fixture } = await setup(page, { workspacePatch: { can_upload: false, can_manage: false }, filesStatus: 503, files: [] });
  await expect(panel(page).getByRole('button', { name: 'Upload files' })).toBeEnabled();
  await panel(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toContainText('Files access denied.');
  await expect(panel(page)).not.toContainText('No files in this folder yet.');
  fixture.filesStatus = 200;
  await panel(page).getByRole('button', { name: 'Retry files' }).click();
  await expect(panel(page)).toContainText('No files in this folder yet.');
});

test('workspace fits laptop content width after the existing sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await setup(page);
  await page.addStyleTag({ content: '#root { margin-left: 227px; width: calc(100% - 227px); }' });
  await expect(panel(page).getByRole('status')).toHaveText('Workspace ready');
  const geometry = await page.evaluate(() => {
    const workspace = document.querySelector('.sow-workspace');
    const shell = document.querySelector('.sor-workspace');
    return { pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth, width: workspace.clientWidth, scroll: workspace.scrollWidth, columns: getComputedStyle(shell).gridTemplateColumns.split(' ').map(parseFloat) };
  });
  expect(geometry.pageScroll).toBeLessThanOrEqual(geometry.pageWidth + 1);
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.columns).toHaveLength(2);
  expect(geometry.columns[1]).toBeGreaterThan(geometry.columns[0]);
});

test('denied refresh clears displayed files and can recover', async ({ page }) => {
  const { fixture } = await setup(page);
  await panel(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Engineering scope.pdf', exact: true })).toBeVisible();
  fixture.workspaceStatus = 403;
  await panel(page).getByRole('button', { name: 'Refresh workspace' }).click();
  await expect(panel(page).getByRole('alert')).toContainText('permission');
  await expect(panel(page).getByRole('button', { name: 'Engineering scope.pdf', exact: true })).toHaveCount(0);
  fixture.workspaceStatus = 200;
  await panel(page).getByRole('button', { name: 'Retry workspace' }).click();
  await expect(panel(page).locator('.sow-status')).toHaveText('Workspace ready');
});

test('upload retry retains selected file, folder and request ID', async ({ page }) => {
  const { fixture } = await setup(page, { uploadStatus: 503 });
  await panel(page).getByRole('button', { name: 'Upload files' }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('Destination folder').selectOption('proposal');
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic document') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(dialog).toContainText('Selected: review.pdf');
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('proposal');
  fixture.uploadStatus = 201;
  await dialog.getByRole('button', { name: 'Retry upload' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(panel(page)).toContainText('review.pdf uploaded to Proposal in SharePoint.');
  expect(fixture.uploads).toHaveLength(2);
  expect(fixture.uploads[0].path).toContain('/proposal/upload/');
  const uuid = body => body.match(/name="upload_request_id"\r\n\r\n([^\r]+)/)[1];
  expect(uuid(fixture.uploads[1].body)).toBe(uuid(fixture.uploads[0].body));
});

test('empty file is retained with usable validation and no upload request', async ({ page }) => {
  const { fixture } = await setup(page);
  await panel(page).getByRole('button', { name: 'Upload files' }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.from('') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('nonempty');
  expect(fixture.uploads).toHaveLength(0);
});

test('setup queues safely and My opportunities uses authenticated canonical owner', async ({ page }) => {
  const { fixture } = await setup(page, { workspacePatch: { status: 'not_created', can_upload: false } });
  await panel(page).getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Workspace queued');
  expect(fixture.workspacePatch.status).toBe('pending');
  await page.getByRole('button', { name: 'My opportunities', exact: true }).click();
  await expect(rowButton(page, 0)).toBeVisible();
  await expect(rowButton(page, 1)).toHaveCount(0);
});

test('a late file response cannot populate a different opportunity', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const { fixture, state } = await setup(page, { filesHold: held });
  await panel(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  await expect.poll(() => state.requests.some(request => request.path.endsWith('/tender/files/'))).toBe(true);
  await page.getByRole('button', { name: 'Back to register', exact: true }).click();
  await rowButton(page, 1).click();
  await expect(page.locator('.sor-detail-code')).toHaveText('Q-102102');
  fixture.filesHold = null; release();
  await expect(panel(page).getByRole('table')).toBeVisible();
  await expect(panel(page)).not.toContainText('Engineering scope.pdf');
});

test('edit fields lock during a pending save and failed saves retain input', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await setup(page, { patchHolds: { 'opportunity-0': held }, patchStatuses: { 'opportunity-0': 503 } });
  await page.getByRole('button', { name: 'Edit details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Opportunity record', exact: true });
  const input = dialog.getByLabel('Opportunity name', { exact: true });
  await input.fill('Retain my reviewed title');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(input).toBeDisabled();
  release();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('Retain my reviewed title');
});

for (const width of [390, 1366, 1920]) test(`workspace reference fits ${width}px with real API fixtures`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  await setup(page, { records: Array.from({ length: 8 }, (_, index) => opportunity(index, { submission_due_date: `2026-10-${String(index + 9).padStart(2, '0')}` })) });
  await expect(panel(page).getByRole('status')).toHaveText('Workspace ready');
  const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  await page.screenshot({ path: testInfo.outputPath(`workspace-${width}.png`), fullPage: true });
  if (width === 1920) {
    const audit = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
  }
});
