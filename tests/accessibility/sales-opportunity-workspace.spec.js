import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

const root = 'https://rejlerssverige.sharepoint.com/sites/TeamADSalesBidding/Delade%20dokument/General/Myynti/Opportunities';
const panel = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const uploadButton = page => panel(page).getByRole('button', { name: 'Upload files', exact: true });
async function openUpload(page, folder) {
  await panel(page).getByRole('button', { name: `Open ${folder}`, exact: true }).click();
  await uploadButton(page).click();
  // An existing retry queue keeps its destination until the user changes it.
  await page.getByRole('dialog', { name: 'Upload opportunity file' }).getByLabel('Destination folder').selectOption(WORKSPACE_FOLDERS.find(item => item.name === folder).key);
  const storage = panel(page).getByRole('combobox', { name: 'Document storage', exact: true });
  if (await storage.count()) await page.getByRole('dialog', { name: 'Upload opportunity file' }).getByLabel('Save to').selectOption(await storage.inputValue());
}
const uploadUuid = body => body.match(/name="upload_request_id"\r\n\r\n([^\r]+)/)[1];
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
  await rowButton(page, 0).dblclick();
  return { fixture, state };
}

test('ready explorer uses actual code, six folders, files and paginated browsing', async ({ page }) => {
  const { state } = await setup(page, { nextCursor: true });
  await expect(panel(page).locator('.sow-status')).toHaveText('Workspace ready');
  const folders = panel(page).getByRole('navigation', { name: 'Opportunity folders', exact: true });
  await expect(folders.getByRole('button')).toHaveCount(6);
  for (const folder of WORKSPACE_FOLDERS) await expect(folders.getByRole('button', { name: `Open ${folder.name}`, exact: true })).toBeVisible();
  await expect(panel(page).getByRole('table', { name: 'Uploaded files' })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Workspace overview', exact: true })).toHaveCount(0);
  await expect(uploadButton(page)).toBeEnabled();
  await panel(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  await expect(panel(page).getByRole('region', { name: 'Tender documents', exact: true }).getByRole('link', { name: 'Open SharePoint', exact: true })).toHaveAttribute('href', `${root}/Q-102101/Tender`);
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
  await expect(uploadButton(page)).toBeEnabled();
  await expect(panel(page).getByRole('link', { name: 'Open SharePoint' })).toHaveCount(0);
  await expect(panel(page).locator('.sod-folder-count')).toHaveText(['—', '—', '—', '—', '—', '—']);
  await openUpload(page, 'Tender');
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
  await expect(uploadButton(page)).toBeEnabled();
  await expect(panel(page).getByRole('link')).toHaveCount(0);
});

test('read-only workspace can browse empty folders and recover a failed listing', async ({ page }) => {
  const { fixture } = await setup(page, { workspacePatch: { can_upload: false, can_manage: false }, filesStatus: 503, files: [] });
  await expect(uploadButton(page)).toBeEnabled();
  await openUpload(page, 'Tender');
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
  await expect(panel(page).locator('.sow-status')).toHaveText('Workspace ready');
  const geometry = await page.evaluate(() => {
    const workspace = document.querySelector('.sow-workspace');
    return { pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth, width: workspace.clientWidth, scroll: workspace.scrollWidth, left: workspace.getBoundingClientRect().left };
  });
  expect(geometry.pageScroll).toBeLessThanOrEqual(geometry.pageWidth + 1);
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.left).toBeGreaterThanOrEqual(227);
  expect(geometry.width).toBeGreaterThan(900);
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
  await openUpload(page, 'Proposal');
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('proposal');
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic document') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(dialog).toContainText('Selected: review.pdf');
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('proposal');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await openUpload(page, 'Proposal');
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

test('explicit folder and storage changes retain the file and start new upload identities', async ({ page }) => {
  const { fixture, state } = await setup(page, { uploadStatus: 503, workspacePatch: { radai_storage: {
    status: 'ready', can_upload: true, max_upload_bytes: null, automatic_compression: 'lossless_if_smaller',
    folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, item_count: 0 })),
  } } });
  await panel(page).getByRole('combobox', { name: 'Document storage', exact: true }).selectOption('sharepoint');
  await openUpload(page, 'Tender');
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('tender');
  await expect(dialog.getByLabel('Save to')).toHaveValue('sharepoint');
  await expect(dialog).not.toContainText('Automatic lossless compression');
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'destination-review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('same retained document bytes') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await openUpload(page, 'Award');
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('award');
  await expect(dialog.getByLabel('Save to')).toHaveValue('sharepoint');
  await expect(dialog).toContainText('Selected: destination-review.pdf');
  await dialog.getByRole('button', { name: /^(Upload file|Retry upload)$/ }).click();
  await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await panel(page).getByRole('combobox', { name: 'Document storage', exact: true }).selectOption('radai');
  await openUpload(page, 'Award');
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
  await openUpload(page, 'Correspondence');
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.from('') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('nonempty');
  expect(fixture.uploads).toHaveLength(0);
});

test('mixed files above the old limit retain independent retries and skip completed uploads', async ({ page }) => {
  const { fixture, state } = await setup(page, { workspacePatch: { max_upload_bytes: null }, uploadStatuses: { 'scope.pdf': 503 } });
  await openUpload(page, 'Tender');
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
  await openUpload(page, 'Tender');
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
  await openUpload(page, 'Tender');
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await dialog.getByLabel('File', { exact: true }).setInputFiles([
    { name: 'saved.txt', mimeType: 'text/plain', buffer: Buffer.from('saved original') },
    { name: 'pending.csv', mimeType: 'text/csv', buffer: Buffer.from('retained original') },
  ]);
  await dialog.getByRole('button', { name: 'Upload 2 files', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Retry upload', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close upload', exact: true }).click();
  await openUpload(page, 'Award');
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('award');
  await expect(dialog).toContainText('Completed uploads stay in their original folder.');
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
  await openUpload(page, 'Proposal');
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
  await openUpload(page, 'Internal');
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
  await openUpload(page, 'Tender');
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
  await expect(panel(page).locator('.sow-status')).toHaveText('Workspace queued');
  expect(fixture.workspacePatch.status).toBe('pending');
  await page.getByRole('button', { name: 'Back to register', exact: true }).click();
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
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Engineering scope.pdf', exact: true })).toHaveCount(0);
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

test('document explorer and upload queue remain usable in the actual desktop and mobile shell', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1586, height: 992 });
  const { state } = await setup(page, { realShell: true, entry: '/sales/opportunities?record=opportunity-0&workspace=1&folder=tender',
    tags: { 'opportunity-0:tender': { tag: 'Client clarification', tag_token: 'tender-v1' } },
    files: [{ ...file(), id: 'radai-00000000-0000-4000-8000-000000000001', storage_provider: 'radai' }],
    workspacePatch: { max_upload_bytes: null, radai_storage: { status: 'ready', can_upload: true, max_upload_bytes: null, automatic_compression: 'lossless_if_smaller', folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, item_count: 0 })) } },
  });
  await expect(panel(page).getByRole('table', { name: 'Uploaded files', exact: true })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Workspace overview', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Primary navigation', exact: true })).toBeVisible();
  await expect(page.locator('#application-sidebar')).toBeVisible();
  await expect(uploadButton(page)).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('document-explorer-desktop.png'), fullPage: true });
  const audit = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await uploadButton(page).scrollIntoViewIfNeeded();
  await expect(uploadButton(page)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('document-explorer-mobile.png'), fullPage: true });
  await openUpload(page, 'Award');
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
  await expect(panel(page).locator('.sow-status')).toHaveText('Workspace ready');
  const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  await page.screenshot({ path: testInfo.outputPath(`workspace-${width}.png`), fullPage: true });
  if (width === 1920) {
    const audit = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
  }
});
