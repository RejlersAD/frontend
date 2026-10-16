import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

const workspace = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const dialog = page => page.getByRole('dialog', { name: 'Upload opportunity file' });
const uploaded = {
  id: 'radai-00000000-0000-4000-8000-000000000001', name: 'review.pdf', size: 23,
  storage_provider: 'radai', version: '1', publication_level: null, web_url: null, is_folder: false,
  modified_at: '2026-10-01T05:20:00Z', created_by: 'Aisha Noor', modified_by: 'Aisha Noor',
};
async function prepare(page, configuration = {}) {
  const storage = { status: 'ready', can_upload: true, message: '', ...configuration.storage };
  const data = { files: [], uploadStatus: 201, uploads: [], ...configuration };
  const requests = await prepareRegister(page, {
    realShell: configuration.realShell, entry: '/sales/opportunities?record=opportunity-0&workspace=1&folder=proposal',
    records: [opportunity(0, { deal_name: 'FEED Engineering Services', submission_due_date: '2026-10-09' })],
    workspaceHandler: async route => {
      const url = new URL(route.request().url()), path = url.pathname;
      if (path.endsWith('/workspace/')) return route.fulfill({ json: {
        opportunity_id: 'opportunity-0', status: 'not_configured', web_url: '', can_upload: false,
        can_manage: false, folders: [], radai_storage: {
          ...storage, max_upload_bytes: 10485760,
          folders: WORKSPACE_FOLDERS.map(folder => ({ key: folder.key, item_count: storage.status === 'ready' ? (folder.key === 'proposal' ? data.files.length : 0) : null })),
        },
      } });
      if (path.endsWith('/upload/')) {
        data.uploads.push({ path, body: route.request().postDataBuffer().toString() });
        if (data.uploadStatus === 201) data.files = [uploaded];
        return route.fulfill({ status: data.uploadStatus, json: data.uploadStatus === 201 ? uploaded : { detail: 'The file storage is temporarily unavailable. Retry your file.' } });
      }
      if (path.endsWith('/files/')) {
        if (data.listHold) await data.listHold;
        return url.searchParams.get('storage') === 'radai'
          ? route.fulfill({ json: { folder_key: 'proposal', files: data.files, item_count: data.files.length, next_cursor: null } })
          : route.fulfill({ status: 503, json: { detail: 'SharePoint is not configured.' } });
      }
      if (path.endsWith('/versions/')) return route.fulfill({ json: { file_id: uploaded.id, versions: [{ id: '1', size: uploaded.size, modified_at: uploaded.modified_at, modified_by: 'Aisha Noor', is_current: true }], next_cursor: null } });
      if (path.endsWith('/download/')) return route.fulfill({ contentType: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="review.pdf"' }, body: Buffer.from('synthetic uploaded bytes') });
      if (path.includes(`/files/${uploaded.id}/`)) return route.fulfill({ json: { ...uploaded, folder_key: 'proposal', can_download: true, max_download_bytes: 10485760 } });
      return route.fulfill({ status: 400, json: { detail: 'Unexpected synthetic action.' } });
    },
  });
  await expect(workspace(page).getByRole('combobox', { name: 'Document storage' })).toHaveValue('radai');
  return { data, requests, storage };
}
async function pickFile(page) {
  await workspace(page).getByRole('button', { name: 'Upload files', exact: true }).click();
  await dialog(page).getByLabel('File', { exact: true }).setInputFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic uploaded bytes') });
}

test('RADAI stores, lists, opens metadata and downloads an attachment without SharePoint', async ({ page }) => {
  const { data, requests } = await prepare(page);
  await pickFile(page);
  await expect(dialog(page).getByRole('button', { name: 'Upload file', exact: true })).toBeEnabled();
  await dialog(page).getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog(page)).not.toBeVisible();
  const document = workspace(page).getByRole('button', { name: 'review.pdf', exact: true });
  await expect(document).toBeVisible(); await document.click();
  const details = page.getByRole('complementary', { name: 'Document details', exact: true });
  await expect(details).toContainText('Aisha Noor');
  await expect(details).not.toContainText('SharePoint status');
  await expect(details.getByRole('link')).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await details.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('review.pdf');
  expect(data.uploads).toHaveLength(1);
  expect(data.uploads[0].body).toContain('name="storage"\r\n\r\nradai');
  expect(requests.requests.filter(request => request.path.endsWith('/files/')).every(request => new URLSearchParams(request.search).get('storage') === 'radai')).toBe(true);
  expect(requests.requests.some(request => request.path.endsWith('/setup/'))).toBe(false);
  await expect(workspace(page).getByRole('link', { name: /SharePoint/ })).toHaveCount(0);
  expect(requests.pageErrors).toEqual([]);
});

test('RADAI retry retains the file, destination and UUID without switching provider', async ({ page }) => {
  const { data } = await prepare(page, { uploadStatus: 503 });
  await pickFile(page); await dialog(page).getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('temporarily unavailable');
  await expect(dialog(page)).toContainText('review.pdf');
  await expect(dialog(page).getByLabel('Destination folder')).toHaveValue('proposal');
  await dialog(page).getByRole('button', { name: 'Close upload' }).click();
  await workspace(page).getByRole('combobox', { name: 'Document storage' }).selectOption('sharepoint');
  await workspace(page).getByRole('button', { name: 'Upload files', exact: true }).click();
  await expect(dialog(page).getByLabel('Save to')).toHaveValue('radai');
  data.uploadStatus = 201;
  await dialog(page).getByRole('button', { name: 'Retry upload', exact: true }).click();
  await expect(dialog(page)).not.toBeVisible();
  const uuid = body => body.match(/name="upload_request_id"\r\n\r\n([^\r]+)/)[1];
  expect(data.uploads).toHaveLength(2);
  expect(uuid(data.uploads[0].body)).toBe(uuid(data.uploads[1].body));
  for (const attempt of data.uploads) { expect(attempt.path).toContain('/proposal/upload/'); expect(attempt.body).toContain('name="storage"\r\n\r\nradai'); }
});

test('read-only RADAI permission blocks the request even if a form submit is forced', async ({ page }) => {
  const { data, requests } = await prepare(page, { storage: { can_upload: false }, files: [uploaded] });
  await pickFile(page);
  await expect(dialog(page)).toContainText(/permission|read-only|access/i);
  await expect(dialog(page).getByRole('button', { name: 'Upload file', exact: true })).toBeDisabled();
  await dialog(page).locator('form').evaluate(form => form.requestSubmit());
  await expect(dialog(page)).toContainText('review.pdf');
  expect(data.uploads).toHaveLength(0);
  expect(requests.requests.filter(request => request.method !== 'GET')).toEqual([]);
});

test('unavailable RADAI storage retains the six-folder scaffold and reports unavailable files', async ({ page }) => {
  const { requests } = await prepare(page, { storage: { status: 'unavailable', can_upload: false, message: 'Private file storage is temporarily unavailable.' } });
  for (const folder of WORKSPACE_FOLDERS) await expect(workspace(page).getByRole('button', { name: `Open ${folder.name}`, exact: true })).toBeEnabled();
  await expect(workspace(page)).toContainText('temporarily unavailable');
  await expect(workspace(page)).not.toContainText('No files in this folder yet.');
  await expect(workspace(page).getByRole('table', { name: 'Uploaded files' })).toBeVisible();
  expect(requests.requests.some(request => request.path.endsWith('/files/'))).toBe(false);
});

test('switching to unconfigured SharePoint cannot render a late RADAI file response', async ({ page }) => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const { data, requests } = await prepare(page, { listHold: hold, files: [uploaded] });
  await expect.poll(() => requests.requests.some(request => request.path.endsWith('/files/'))).toBe(true);
  await workspace(page).getByRole('combobox', { name: 'Document storage' }).selectOption('sharepoint');
  data.listHold = null; release();
  await expect(workspace(page)).toContainText(/SharePoint.*setup|administrator setup/i);
  await expect(workspace(page).getByRole('button', { name: 'review.pdf', exact: true })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Document details', exact: true })).toContainText('Select a document');
});

test('real shell displays and accepts a RADAI attachment while SharePoint is unconfigured', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const { data } = await prepare(page, { realShell: true });
  await pickFile(page); await dialog(page).getByRole('button', { name: 'Upload file', exact: true }).click();
  await expect(workspace(page).getByRole('button', { name: 'review.pdf', exact: true })).toBeVisible();
  expect(data.uploads).toHaveLength(1);
  await workspace(page).getByRole('button', { name: 'review.pdf', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Document details', exact: true })).toContainText('Aisha Noor');
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('radai-files-without-sharepoint-1586.png'), fullPage: true });
});
