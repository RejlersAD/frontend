import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

const root = 'https://rejlerssverige.sharepoint.com/sites/TeamADSalesBidding/Delade%20dokument/General/Myynti/Opportunities';
const panel = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const uploadTo = (page, folder) => panel(page).getByRole('button', { name: `Upload to ${folder}`, exact: true });
const uploadUuid = body => body.match(/name="upload_request_id"\r\n\r\n([^\r]+)/)[1];
const tagEditor = (page, folder) => panel(page).getByRole('form', { name: `Edit ${folder} tag`, exact: true });
const rowButton = (page, id) => page.locator('.sor-table-scroll').getByRole('button', { name: `Q-${102101 + id}`, exact: true });
const ready = (id = 'opportunity-0', patch = {}) => ({
  opportunity_id: id, deal_code: 'Q-102101', status: 'ready', message: '', web_url: `${root}/Q-102101`, can_manage: true, can_upload: true, can_edit_tags: true, max_upload_bytes: 10485760,
  folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, tag: '', tag_token: `${id}:${folder.key}:initial`, item_count: 0, web_url: `${root}/Q-102101/${folder.name}` })), ...patch,
});
const file = (id = 'one', name = 'Engineering scope.pdf') => ({ id, name, size: 1024, modified_at: '2026-10-01T08:00:00Z', web_url: `${root}/Q-102101/Tender/${name}` });

async function setup(page, configuration = {}) {
  const fixture = { workspaceStatus: 200, workspacePatch: {}, uploadStatus: 201, uploads: [], files: [file()], filesStatus: 200, tags: {}, tagStatus: 200, tagWrites: [], ...configuration };
  const workspace = id => {
    const response = ready(id, fixture.workspacePatch);
    return { ...response, folders: response.folders.map(folder => ({ ...folder, ...(fixture.tags[`${id}:${folder.key}`] || {}) })) };
  };
  const state = await prepareRegister(page, {
    records: [opportunity(0), opportunity(1, { owner: 12, owner_name: 'Omar Ali', submission_due_date: '2026-10-02' })],
    ...configuration,
    workspaceHandler: async route => {
      const url = new URL(route.request().url());
      const id = url.pathname.split('/deals/')[1].split('/')[0];
      if (url.pathname.endsWith('/workspace/')) {
        if (fixture.workspaceHold?.[id]) await fixture.workspaceHold[id];
        return route.fulfill({ status: fixture.workspaceStatus, json: fixture.workspaceStatus === 200 ? workspace(id) : { detail: 'Workspace access denied.' } });
      }
      if (url.pathname.endsWith('/tag/')) {
        const key = url.pathname.split('/folders/')[1].split('/')[0];
        const body = route.request().postDataJSON();
        fixture.tagWrites.push({ id, key, body });
        if (fixture.tagStatus !== 200) return route.fulfill({ status: fixture.tagStatus, json: { detail: fixture.tagStatus === 409 ? 'The saved tag changed. Refresh before saving.' : fixture.tagStatus === 403 ? 'You no longer have permission to edit this tag.' : 'Tag service unavailable. Your text is retained.' } });
        const current = { tag: body.tag.trim(), tag_token: `${id}:${key}:saved-${fixture.tagWrites.length}` };
        fixture.tags[`${id}:${key}`] = current;
        return route.fulfill({ json: { folder_key: key, tag: current.tag, expected_token: current.tag_token, replayed: false } });
      }
      if (url.pathname.endsWith('/setup/')) { fixture.workspacePatch = { ...fixture.workspacePatch, status: 'pending' }; return route.fulfill({ json: ready(id, fixture.workspacePatch) }); }
      if (url.pathname.endsWith('/files/')) {
        if (fixture.filesHold) await fixture.filesHold;
        return route.fulfill({ status: fixture.filesStatus, json: fixture.filesStatus === 200 ? { files: url.searchParams.get('cursor') ? [file('two', 'Clarification.pdf')] : fixture.files, item_count: fixture.files.length, next_cursor: fixture.nextCursor && !url.searchParams.get('cursor') ? 'cursor-two' : null } : { detail: 'Files access denied.' } });
      }
      if (url.pathname.endsWith('/upload/')) {
        const body = route.request().postDataBuffer().toString();
        const name = body.match(/filename="([^"]+)"/)[1];
        fixture.uploads.push({ body, path: url.pathname, name });
        if (fixture.uploadHolds?.[name]) await fixture.uploadHolds[name];
        const status = fixture.uploadStatuses?.[name] || fixture.uploadStatus;
        return route.fulfill({ status, json: status < 300 ? file(`upload-${fixture.uploads.length}`, name) : { detail: status === 403 ? 'You do not have permission to upload this file.' : 'SharePoint is temporarily unavailable. Retry this file.' } });
      }
      return route.fulfill({ status: 400, json: { detail: 'Unexpected workspace action' } });
    },
  });
  if (configuration.entry) return { fixture, state };
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
  await expect(panel(page).getByRole('columnheader')).toHaveText(['Folder', 'Purpose', 'Tag', 'Items', 'Action']);
  await expect(panel(page).getByRole('textbox', { name: 'Search workspace folders', exact: true })).toHaveCount(0);
  await expect(panel(page).getByRole('button', { name: 'Upload files', exact: true })).toHaveCount(0);
  for (const folder of WORKSPACE_FOLDERS) {
    const row = panel(page).getByRole('row').filter({ has: page.getByRole('button', { name: `Upload to ${folder.name}`, exact: true }) });
    await expect(row.getByRole('cell')).toHaveCount(5);
    await expect(row.getByRole('cell').nth(1)).toHaveText(folder.purpose);
    await expect(uploadTo(page, folder.name)).toBeEnabled();
    await expect(uploadTo(page, folder.name)).toHaveText('Upload');
  }
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
  const { fixture } = await setup(page, { workspacePatch: { status: 'not_configured', web_url: '', can_manage: false, can_upload: false, folders: [] } });
  await expect(panel(page)).toContainText('administrator setup');
  await expect(panel(page)).toContainText('Item counts unavailable');
  await expect(uploadTo(page, 'Tender')).toBeEnabled();
  await expect(panel(page).getByRole('link', { name: 'Open SharePoint' })).toHaveCount(0);
  await expect(panel(page).locator('.sow-count')).toHaveText(['—', '—', '—', '—', '—', '—']);
  await uploadTo(page, 'Tender').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog).toContainText('administrator setup');
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('tender');
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'blocked.pdf', mimeType: 'application/pdf', buffer: Buffer.from('retained blocked file') });
  await expect(dialog.getByRole('button', { name: 'Upload file', exact: true })).toBeDisabled();
  await dialog.locator('form').evaluate(form => form.requestSubmit());
  await expect(dialog).toContainText('Selected: blocked.pdf');
  expect(fixture.uploads).toEqual([]);
});

test('malformed ready workspace is unavailable and cannot expose unsafe links', async ({ page }) => {
  await setup(page, { workspacePatch: { folders: [], web_url: 'https://evil.example.test' } });
  await expect(panel(page).getByRole('alert')).toContainText('could not be verified');
  await expect(uploadTo(page, 'Tender')).toBeEnabled();
  await expect(panel(page).getByRole('link')).toHaveCount(0);
});

test('read-only workspace can browse empty folders and recover a failed listing', async ({ page }) => {
  const { fixture } = await setup(page, { workspacePatch: { can_upload: false, can_manage: false }, filesStatus: 503, files: [] });
  await expect(uploadTo(page, 'Tender')).toBeEnabled();
  await uploadTo(page, 'Tender').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('tender');
  await expect(dialog).toContainText('read-only');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
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
  await uploadTo(page, 'Proposal').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('proposal');
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic document') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(dialog).toContainText('Selected: review.pdf');
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('proposal');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await uploadTo(page, 'Proposal').click();
  await expect(dialog).toContainText('Selected: review.pdf');
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('proposal');
  fixture.uploadStatus = 201;
  await dialog.getByRole('button', { name: 'Retry upload' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(panel(page)).toContainText('review.pdf uploaded to Proposal in SharePoint.');
  expect(fixture.uploads).toHaveLength(2);
  expect(fixture.uploads[0].path).toContain('/proposal/upload/');
  expect(uploadUuid(fixture.uploads[1].body)).toBe(uploadUuid(fixture.uploads[0].body));
  for (const attempt of fixture.uploads) expect(attempt.body).toContain('synthetic document');
});

test('different row and storage destinations retain the file and start new upload identities', async ({ page }) => {
  const { fixture, state } = await setup(page, { uploadStatus: 503, workspacePatch: { radai_storage: {
    status: 'ready', can_upload: true, max_upload_bytes: null, automatic_compression: 'lossless_if_smaller',
    folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, item_count: 0 })),
  } } });
  await panel(page).getByRole('combobox', { name: 'Document storage', exact: true }).selectOption('sharepoint');
  await uploadTo(page, 'Tender').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('tender');
  await expect(dialog.getByLabel('Save to')).toHaveValue('sharepoint');
  await expect(dialog).not.toContainText('Automatic lossless compression');
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'destination-review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('same retained document bytes') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await uploadTo(page, 'Award').click();
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('award');
  await expect(dialog.getByLabel('Save to')).toHaveValue('sharepoint');
  await expect(dialog).toContainText('Selected: destination-review.pdf');
  await dialog.getByRole('button', { name: /^(Upload file|Retry upload)$/ }).click();
  await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await panel(page).getByRole('combobox', { name: 'Document storage', exact: true }).selectOption('radai');
  await uploadTo(page, 'Award').click();
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('award');
  await expect(dialog.getByLabel('Save to')).toHaveValue('radai');
  await expect(dialog).toContainText('Automatic lossless compression when it reduces file size. Downloads retain the original data.');
  await expect(dialog).toContainText('Selected: destination-review.pdf');
  fixture.uploadStatus = 201;
  await dialog.getByRole('button', { name: /^(Upload file|Retry upload)$/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(panel(page)).toContainText('destination-review.pdf uploaded to Award in RADAI.');
  expect(fixture.uploads.map(attempt => attempt.path.split('/folders/')[1])).toEqual(['tender/upload/', 'award/upload/', 'award/upload/']);
  expect(new Set(fixture.uploads.map(attempt => uploadUuid(attempt.body))).size).toBe(3);
  expect(fixture.uploads[0].body).not.toContain('name="storage"');
  expect(fixture.uploads[1].body).not.toContain('name="storage"');
  expect(fixture.uploads[2].body).toContain('name="storage"\r\n\r\nradai');
  for (const attempt of fixture.uploads) expect(attempt.body).toContain('same retained document bytes');
  expect(state.pageErrors).toEqual([]);
});

test('empty file is retained with usable validation and no upload request', async ({ page }) => {
  const { fixture } = await setup(page);
  await uploadTo(page, 'Correspondence').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.from('') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('nonempty');
  expect(fixture.uploads).toHaveLength(0);
});

test('mixed files above the old limit retain independent retries and skip completed uploads', async ({ page }) => {
  const { fixture, state } = await setup(page, { workspacePatch: { max_upload_bytes: null }, uploadStatuses: { 'scope.pdf': 503 } });
  await uploadTo(page, 'Tender').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog.getByLabel('File', { exact: true })).toHaveAttribute('multiple', '');
  await expect(dialog.getByLabel('File', { exact: true })).not.toHaveAttribute('accept', /.+/);
  await expect(dialog).not.toContainText('Maximum file size');
  await dialog.getByLabel('File', { exact: true }).setInputFiles([
    { name: 'model.dwg', mimeType: 'application/octet-stream', buffer: Buffer.alloc(11 * 1024 * 1024, 65) },
    { name: 'scope.pdf', mimeType: 'application/pdf', buffer: Buffer.from('scope source bytes') },
    { name: 'quantities.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('spreadsheet source bytes') },
  ]);
  await dialog.getByRole('button', { name: 'Upload 3 files', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Retry upload', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('listitem', { name: 'model.dwg', exact: true })).toContainText('Uploaded to Tender');
  await expect(dialog.getByRole('listitem', { name: 'quantities.xlsx', exact: true })).toContainText('Uploaded to Tender');
  await expect(dialog.getByRole('listitem', { name: 'scope.pdf', exact: true })).toContainText('Needs retry');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await uploadTo(page, 'Tender').click();
  fixture.uploadStatuses['scope.pdf'] = 201;
  await dialog.getByRole('button', { name: 'Retry upload', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(fixture.uploads.map(attempt => attempt.name)).toEqual(['model.dwg', 'scope.pdf', 'quantities.xlsx', 'scope.pdf']);
  expect(new Set(fixture.uploads.slice(0, 3).map(attempt => uploadUuid(attempt.body))).size).toBe(3);
  expect(uploadUuid(fixture.uploads[1].body)).toBe(uploadUuid(fixture.uploads[3].body));
  expect(fixture.uploads.every(attempt => attempt.path.endsWith('/tender/upload/'))).toBe(true);
  expect(fixture.uploads[0].body.length).toBeGreaterThan(11 * 1024 * 1024);
  expect(state.pageErrors).toEqual([]);
});

test('changing a partial queue destination leaves completed files in their original folder', async ({ page }) => {
  const { fixture } = await setup(page, { uploadStatuses: { 'pending.csv': 503 } });
  await uploadTo(page, 'Tender').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('File', { exact: true }).setInputFiles([
    { name: 'saved.txt', mimeType: 'text/plain', buffer: Buffer.from('saved original') },
    { name: 'pending.csv', mimeType: 'text/csv', buffer: Buffer.from('retained original') },
  ]);
  await dialog.getByRole('button', { name: 'Upload 2 files', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Retry upload', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await uploadTo(page, 'Award').click();
  await expect(dialog).toContainText('Review the new destination: Award');
  await expect(dialog.getByRole('listitem', { name: 'saved.txt', exact: true })).toContainText('Uploaded to Tender');
  await expect(dialog.getByRole('listitem', { name: 'pending.csv', exact: true })).toContainText('Waiting');
  expect(fixture.uploads).toHaveLength(2);
  fixture.uploadStatuses['pending.csv'] = 201;
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(fixture.uploads.map(attempt => [attempt.name, attempt.path.split('/folders/')[1]])).toEqual([
    ['saved.txt', 'tender/upload/'], ['pending.csv', 'tender/upload/'], ['pending.csv', 'award/upload/'],
  ]);
  expect(uploadUuid(fixture.uploads[1].body)).not.toBe(uploadUuid(fixture.uploads[2].body));
  expect(fixture.uploads[2].body).toContain('retained original');
});

test('a configured per-file limit retains invalid files while valid queue entries can upload', async ({ page }) => {
  const { fixture } = await setup(page, { workspacePatch: { max_upload_bytes: 1024 } });
  await uploadTo(page, 'Proposal').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog).toContainText('Maximum file size: 1.0 KB.');
  await dialog.getByLabel('File', { exact: true }).setInputFiles([
    { name: 'too-large.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(2048) },
    { name: 'valid.txt', mimeType: 'text/plain', buffer: Buffer.from('valid original') },
  ]);
  await dialog.getByRole('button', { name: 'Upload 2 files', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Retry upload', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('listitem', { name: 'too-large.bin', exact: true })).toContainText('exceeds the maximum');
  await expect(dialog.getByRole('listitem', { name: 'valid.txt', exact: true })).toContainText('Uploaded');
  expect(fixture.uploads.map(attempt => attempt.name)).toEqual(['valid.txt']);
  await dialog.getByRole('button', { name: 'Remove too-large.bin', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Upload file', exact: true })).toBeDisabled();
  expect(fixture.uploads).toHaveLength(1);
});

test('permission denial stops a batch and retains unsent files for an explicit retry', async ({ page }) => {
  const { fixture } = await setup(page, { uploadStatus: 403 });
  await uploadTo(page, 'Internal').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('File', { exact: true }).setInputFiles([
    { name: 'first.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('first original') },
    { name: 'second.zip', mimeType: 'application/zip', buffer: Buffer.from('second original') },
  ]);
  await dialog.getByRole('button', { name: 'Upload 2 files', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('permission');
  await expect(dialog.getByRole('listitem', { name: 'second.zip', exact: true })).toContainText('Waiting');
  expect(fixture.uploads.map(attempt => attempt.name)).toEqual(['first.docx']);
  fixture.uploadStatus = 201;
  await dialog.getByRole('button', { name: 'Retry remaining files', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(fixture.uploads.map(attempt => attempt.name)).toEqual(['first.docx', 'first.docx', 'second.zip']);
  expect(uploadUuid(fixture.uploads[0].body)).toBe(uploadUuid(fixture.uploads[1].body));
});

test('completed transfer remains processing and stopping preserves unsent queue entries', async ({ page }) => {
  await page.addInitScript(() => {
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      if (body instanceof FormData && body.get('upload_request_id')) window.workspaceUploadTransport = this;
      return send.call(this, body);
    };
  });
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { fixture } = await setup(page, { uploadHolds: { 'first.pdf': hold } });
  await uploadTo(page, 'Tender').click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('File', { exact: true }).setInputFiles([
    { name: 'first.pdf', mimeType: 'application/pdf', buffer: Buffer.from('first original') },
    { name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('second original') },
  ]);
  await dialog.getByRole('button', { name: 'Upload 2 files', exact: true }).click();
  await expect.poll(() => fixture.uploads.length).toBe(1);
  await page.evaluate(() => window.workspaceUploadTransport.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 50, total: 100 })));
  await expect(dialog.getByRole('listitem', { name: 'first.pdf', exact: true })).toContainText('Uploading 50%');
  await page.evaluate(() => window.workspaceUploadTransport.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 100, total: 100 })));
  await expect(dialog.getByRole('listitem', { name: 'first.pdf', exact: true })).toContainText('Processing on the server');
  await expect(dialog.getByRole('progressbar', { name: 'Upload progress for first.pdf', exact: true })).toHaveAttribute('value', '100');
  await expect(dialog.getByRole('listitem', { name: 'first.pdf', exact: true })).not.toContainText('Uploaded');
  await dialog.getByRole('button', { name: 'Stop after this file', exact: true }).click();
  release();
  await expect(dialog).toContainText('Upload paused');
  await expect(dialog.getByRole('listitem', { name: 'first.pdf', exact: true })).toContainText('Uploaded to Tender');
  await expect(dialog.getByRole('listitem', { name: 'second.txt', exact: true })).toContainText('Waiting');
  expect(fixture.uploads).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(fixture.uploads.map(attempt => attempt.name)).toEqual(['first.pdf', 'second.txt']);
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

test('custom folder tags persist across refresh and storage providers and can be cleared', async ({ page }) => {
  const { fixture, state } = await setup(page, { workspacePatch: { radai_storage: {
    status: 'ready', can_upload: true, max_upload_bytes: 10485760,
    folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, item_count: 0 })),
  } } });
  const storage = panel(page).getByRole('combobox', { name: 'Document storage', exact: true });
  await storage.selectOption('sharepoint');
  await panel(page).getByRole('button', { name: 'Add tag for Tender', exact: true }).click();
  const editor = tagEditor(page, 'Tender');
  await expect(editor.getByRole('textbox', { name: 'Tag for Tender', exact: true })).toHaveAttribute('maxlength', '64');
  await editor.getByRole('textbox').fill('Client clarification');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true })).toHaveText('Client clarification');
  await storage.selectOption('radai');
  await expect(panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true })).toHaveText('Client clarification');
  await panel(page).getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true })).toHaveText('Client clarification');
  await panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true }).click();
  await editor.getByRole('textbox').fill('Unsaved local edit');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true })).toHaveText('Client clarification');
  expect(fixture.tagWrites).toHaveLength(1);
  await panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true }).click();
  await editor.getByRole('textbox').fill('');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Add tag for Tender', exact: true })).toBeVisible();
  await storage.selectOption('sharepoint');
  await panel(page).getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Add tag for Tender', exact: true })).toBeVisible();
  expect(fixture.tagWrites.map(write => write.body)).toEqual([
    { tag: 'Client clarification', expected_token: 'opportunity-0:tender:initial' },
    { tag: '', expected_token: 'opportunity-0:tender:saved-1' },
  ]);
  await expect(panel(page).locator('.sow-count')).toHaveText(['0', '0', '0', '0', '0', '0']);
  expect(state.requests.filter(request => request.method !== 'GET').map(request => request.path)).toEqual([
    '/api/v1/sales/deals/opportunity-0/workspace/folders/tender/tag/',
    '/api/v1/sales/deals/opportunity-0/workspace/folders/tender/tag/',
  ]);
  expect(state.pageErrors).toEqual([]);
});

test('tag conflict refresh retains draft and a failed retry keeps the refreshed token', async ({ page }) => {
  const { fixture, state } = await setup(page, { tags: { 'opportunity-0:tender': { tag: 'Original label', tag_token: 'tender-v1' } }, tagStatus: 409 });
  await panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true }).click();
  const editor = tagEditor(page, 'Tender');
  await editor.getByRole('textbox').fill('Reviewed client scope');
  fixture.tags['opportunity-0:tender'] = { tag: 'Concurrent saved label', tag_token: 'tender-v2' };
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('changed');
  await expect(editor.getByRole('textbox')).toHaveValue('Reviewed client scope');
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await editor.getByRole('button', { name: 'Refresh tag', exact: true }).click();
  await expect(editor.getByRole('status')).toContainText('Concurrent saved label');
  await expect(editor.getByRole('textbox')).toHaveValue('Reviewed client scope');
  expect(fixture.tagWrites).toHaveLength(1);
  fixture.tagStatus = 503;
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('unavailable');
  await expect(editor.getByRole('textbox')).toHaveValue('Reviewed client scope');
  fixture.tagStatus = 200;
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true })).toHaveText('Reviewed client scope');
  expect(fixture.tagWrites.map(write => write.body)).toEqual([
    { tag: 'Reviewed client scope', expected_token: 'tender-v1' },
    { tag: 'Reviewed client scope', expected_token: 'tender-v2' },
    { tag: 'Reviewed client scope', expected_token: 'tender-v2' },
  ]);
  expect(state.pageErrors).toEqual([]);
});

test('denied tag saves retain text and revoked edit access keeps the saved label read-only', async ({ page }) => {
  const { fixture, state } = await setup(page, { tags: { 'opportunity-0:tender': { tag: 'Existing label', tag_token: 'tender-v1' } }, tagStatus: 403 });
  await panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true }).click();
  const editor = tagEditor(page, 'Tender');
  await editor.getByRole('textbox').fill('Retain denied draft');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('permission');
  await expect(editor.getByRole('textbox')).toHaveValue('Retain denied draft');
  fixture.workspacePatch.can_edit_tags = false;
  await panel(page).getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await expect(editor.getByRole('textbox')).toHaveValue('Retain denied draft');
  await expect(editor.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await editor.evaluate(form => form.requestSubmit());
  expect(fixture.tagWrites).toHaveLength(1);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: /^(Add|Edit) tag for / })).toHaveCount(0);
  await expect(panel(page)).toContainText('Existing label');
  expect(fixture.tags['opportunity-0:tender'].tag).toBe('Existing label');
  expect(state.pageErrors).toEqual([]);
});

test('folder overview table remains usable in the actual desktop and mobile shell', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1586, height: 992 });
  const { state } = await setup(page, { realShell: true, entry: '/sales/opportunities?record=opportunity-0&workspace=1&folder=tender',
    tags: { 'opportunity-0:tender': { tag: 'Client clarification', tag_token: 'tender-v1' } },
    files: [{ ...file(), id: 'radai-00000000-0000-4000-8000-000000000001', storage_provider: 'radai' }],
    workspacePatch: { max_upload_bytes: null, radai_storage: { status: 'ready', can_upload: true, max_upload_bytes: null, automatic_compression: 'lossless_if_smaller', folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, item_count: 0 })) } },
  });
  await panel(page).getByRole('button', { name: 'Workspace overview', exact: true }).click();
  await expect(panel(page).getByRole('table', { name: 'Workspace folders', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('columnheader')).toHaveText(['Folder', 'Purpose', 'Tag', 'Items', 'Action']);
  await expect(panel(page).getByRole('textbox', { name: 'Search workspace folders', exact: true })).toHaveCount(0);
  await expect(panel(page).getByRole('button', { name: 'Upload files', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Primary navigation', exact: true })).toBeVisible();
  await expect(page.locator('#application-sidebar')).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Edit tag for Tender', exact: true })).toHaveText('Client clarification');
  await expect(panel(page).getByRole('button', { name: 'Add tag for Award', exact: true })).toBeVisible();
  await expect(uploadTo(page, 'Award')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('folder-overview-desktop.png'), fullPage: true });
  const audit = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await panel(page).getByRole('table', { name: 'Workspace folders', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('folder-overview-mobile.png'), fullPage: true });
  await uploadTo(page, 'Award').scrollIntoViewIfNeeded();
  await expect(uploadTo(page, 'Award')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('folder-overview-mobile-actions.png'), fullPage: true });
  await uploadTo(page, 'Award').click();
  const uploadDialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(uploadDialog.getByLabel('Destination folder')).toHaveValue('award');
  await expect(uploadDialog).toContainText('Automatic lossless compression when it reduces file size.');
  await expect(uploadDialog).not.toContainText('Maximum file size');
  await uploadDialog.getByLabel('File', { exact: true }).setInputFiles([
    { name: 'engineering-model.dwg', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic model') },
    { name: 'commercial-proposal.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic proposal') },
  ]);
  await expect(uploadDialog.getByRole('listitem')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('upload-queue-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1586, height: 992 });
  const dialogBounds = await uploadDialog.boundingBox();
  expect(Math.abs(dialogBounds.x + dialogBounds.width / 2 - 1586 / 2)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('upload-queue-desktop.png'), fullPage: true });
  const uploadAudit = await new AxeBuilder({ page }).include('.sow-upload-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(uploadAudit.violations).toEqual([]);
  expect(state.pageErrors).toEqual([]);
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
