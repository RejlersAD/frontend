import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

test.setTimeout(Number(process.env.S3D_TEST_TIMEOUT_MS || 90000));
const project = { project_id: '00000000-0000-4000-8000-000000000123', name: 'Synthetic S3D project', status: 'active' };
const jobId = '00000000-0000-4000-8000-000000000456';
const source = { name: 'Piping Spec.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic test') };

async function prepare(page, options = {}) {
  const state = { errors: [], uploads: [], creates: [], jobStatus: 'processing', uploadStatus: 200, detailStatus: 200, saveStatus: 200, saved: false, ...options };
  if (!state.noProject) await page.addInitScript(project => localStorage.setItem('specCustomActiveProject', JSON.stringify(project)), project);
  page.on('pageerror', error => state.errors.push(error.message));
  const job = () => ({ id: jobId, project_id: project.project_id, status: state.jobStatus, saved_at: state.saved ? '2026-10-13T12:00:00Z' : null, progress_percent: state.jobStatus === 'completed' ? 100 : 40, current_phase: 'Reading engineering document', chunks_total: 1, chunks_done: 0, error_message: state.jobStatus === 'failed' ? 'Extraction could not read this document.' : '', document_meta: { original_filename: source.name, total_pages: 1, file_size_bytes: 100 } });
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/spec-customization/projects/')) {
      if (request.method() === 'POST') { state.creates.push(request.postDataJSON()); return route.fulfill({ status: 201, json: project }); }
      return route.fulfill({ json: { items: state.noProject ? [] : [{ ...project, metadata: { creation_source: 's3d_document_upload', original_filename: source.name } }] } });
    }
    if (path.endsWith('/paper-spec/upload/')) { state.uploads.push(request.postData()); return route.fulfill({ status: state.uploadStatus, json: state.uploadStatus === 200 ? { job: job(), document: job().document_meta } : { error: state.uploadStatus === 403 ? 'Project creation is not allowed.' : 'Upload unavailable. Try again.' } }); }
    if (path.endsWith(`/paper-spec/jobs/${jobId}/save/`)) {
      if (state.saveStatus !== 200) return route.fulfill({ status: state.saveStatus, json: { error: 'Extraction could not be saved.' } });
      state.saved = true;
      return route.fulfill({ json: job() });
    }
    if (path.endsWith(`/spec-customization/projects/${project.project_id}/jobs/`)) return route.fulfill({ json: { success: true, jobs: [{ id: jobId, document_name: source.name, status: state.jobStatus, created_at: '2026-10-13T11:00:00Z', classes_count: 1, components_count: 1, saved_at: state.saved ? '2026-10-13T12:00:00Z' : null }], current_saved_job_id: state.saved ? jobId : '', pagination: { total: 1, page_size: 25, page: 1 } } });
    if (path.endsWith(`/paper-spec/jobs/${jobId}/`)) return route.fulfill({ status: state.detailStatus, json: state.detailStatus === 200 ? job() : { detail: 'Preview unavailable. Try again.' } });
    if (path.endsWith(`/paper-spec/jobs/${jobId}/classes/`)) return route.fulfill({ json: [{ id: 'class-1', job: jobId, class_code: 'CS150', material_grade: 'A106 B', pressure_rating: '150', components_count: 1, source_pages: [1, 1], service_list: [], confidence_score: .95 }] });
    if (path.endsWith(`/paper-spec/jobs/${jobId}/workbook/`)) return route.fulfill({ json: { sheets: [], workbook: 'spec' } });
    if (path.endsWith('/notifications/unread_count/')) return route.fulfill({ json: { unread_count: 0 } });
    if (path.endsWith('/push/config/')) return route.fulfill({ json: { available: false, public_key: '' } });
    return route.fulfill({ json: { count: 0, results: [], items: [] } });
  });
  await page.goto(`/tests/fixtures/s3d-builder-shell.html${state.entry ? `?entry=${encodeURIComponent(state.entry)}` : ''}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'S3D Database Builder' })).toBeVisible({ timeout: 60000 });
  return state;
}

test('upload lets the server select a project from the file hash', async ({ page }) => {
  const state = await prepare(page, { jobStatus: 'completed' });
  await page.locator('input[type=file]').setInputFiles({ ...source, name: 'invalid.exe' });
  await expect(page.getByRole('alert')).toContainText('supported engineering document');
  await page.locator('input[type=file]').setInputFiles(source);
  expect(state.uploads).toHaveLength(0);
  expect(state.creates).toHaveLength(0);
  await expect(page.getByLabel('Project', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create project', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove Piping Spec.pdf' }).click();
  await expect(page.getByRole('button', { name: 'Extract database', exact: true })).toBeDisabled();
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Data Extraction & Integration Hub', exact: true })).toBeVisible();
  expect(state.creates).toHaveLength(0);
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0]).toContain('auto_project');
  expect(state.uploads[0]).not.toContain(project.project_id);
  expect(state.errors).toEqual([]);
});

test('one action extracts on upload and automatically opens preview after completion', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const state = await prepare(page);
  const headerBefore = await page.locator('header').first().boundingBox();
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel extraction' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'S3D Database Builder' })).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0]).toContain('auto_project');
  state.jobStatus = 'completed';
  await expect(page.getByRole('heading', { name: 'Data Extraction & Integration Hub', exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('tab', { name: 'Piping classes' }).click();
  await expect(page.getByText('CS150', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Extract with AI', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Paper Specification', exact: true })).toHaveCount(0);
  expect(await page.locator('header').first().boundingBox()).toEqual(headerBefore);
  await page.screenshot({ path: testInfo.outputPath('s3d-extracted-data-preview.png'), fullPage: true });
  await page.getByRole('button', { name: 'Upload document' }).click();
  await expect(page.getByRole('heading', { name: 'S3D Database Builder' })).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  expect(state.errors).toEqual([]);
});

test('failed upload retains source and retry handles completed deduplication', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const state = await prepare(page, { uploadStatus: 503 });
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Upload unavailable');
  await expect(page.locator('.s3db-file-row')).toContainText(source.name);
  await expect(page.getByText('Needs retry', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('s3d-upload-retry-reference.png'), fullPage: true });
  await page.getByRole('button', { name: 'View details' }).click();
  await expect(page.locator('.s3db-upload-error details')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss upload message' }).click();
  await expect(page.locator('.s3db-upload-error')).toHaveCount(0);
  await expect(page.getByText('Needs retry', { exact: true })).toBeVisible();
  state.uploadStatus = 200;
  state.jobStatus = 'completed';
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Data Extraction & Integration Hub', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Piping classes' }).click();
  await expect(page.getByText('CS150', { exact: true })).toBeVisible();
  expect(state.uploads).toHaveLength(2);
  expect(state.creates).toHaveLength(0);
  expect(state.errors).toEqual([]);
});

test('failed extraction stays on upload and preview errors support retry', async ({ page }) => {
  const state = await prepare(page);
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel extraction' })).toBeVisible();
  state.jobStatus = 'failed';
  await expect(page.getByRole('alert')).toContainText('could not read', { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'S3D Database Builder' })).toBeVisible();
  state.jobStatus = 'completed';
  state.detailStatus = 503;
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  state.detailStatus = 200;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.getByRole('tab', { name: 'Piping classes' }).click();
  await expect(page.getByText('CS150', { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('mobile upload preserves the original application shell', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await prepare(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('header').first()).toBeVisible();
  await expect(page.locator('.s3db-sidebar, .s3db-topbar')).toHaveCount(0);
  expect(await page.getByRole('heading', { name: 'S3D Database Builder' }).evaluate(element => getComputedStyle(element).fontSize)).toBe('24px');
  expect(await page.getByRole('heading', { name: /Source documents/ }).evaluate(element => getComputedStyle(element).fontSize)).toBe('18px');
  expect(await page.getByRole('button', { name: 'Extract database', exact: true }).evaluate(element => getComputedStyle(element).fontSize)).toBe('14px');
  expect(state.errors).toEqual([]);
});

test('server project selection failure retains source', async ({ page }) => {
  const state = await prepare(page, { uploadStatus: 403, jobStatus: 'completed' });
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Project creation is not allowed');
  expect(state.uploads).toHaveLength(1);
  await expect(page.locator('.s3db-file-row')).toContainText(source.name);
  state.uploadStatus = 200;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Data Extraction & Integration Hub', exact: true })).toBeVisible();
  expect(state.uploads).toHaveLength(2);
  expect(state.errors).toEqual([]);
});

test('processing job resumes after refresh without another project or upload', async ({ page }) => {
  const state = await prepare(page, { entry: `/engineering/digitization/smart-plant-3d?screen=upload&job=${jobId}` });
  await expect(page.getByRole('button', { name: 'Cancel extraction' })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Cancel extraction' })).toBeVisible();
  state.jobStatus = 'completed';
  await expect(page.getByRole('heading', { name: 'Data Extraction & Integration Hub', exact: true })).toBeVisible({ timeout: 15000 });
  expect(state.creates).toHaveLength(0);
  expect(state.uploads).toHaveLength(0);
  expect(state.errors).toEqual([]);
});

test('completed extraction requires explicit save and history survives refresh', async ({ page }) => {
  const state = await prepare(page, { jobStatus: 'completed' });
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save extracted data' })).toBeVisible();
  expect(state.saved).toBe(false);
  await page.getByRole('button', { name: 'Save extracted data' }).click();
  await expect(page.getByRole('button', { name: 'Saved to project' })).toBeVisible();
  await page.getByRole('button', { name: 'History Logs' }).click();
  await expect(page.getByRole('heading', { name: 'History Logs' })).toBeVisible();
  await expect(page.getByText(/Current saved result/)).toBeVisible();
  await page.goto(`/tests/fixtures/s3d-builder-shell.html?entry=${encodeURIComponent('/engineering/digitization/smart-plant-3d?screen=history')}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Current saved result/)).toBeVisible();
  await page.getByRole('button', { name: 'Open preview' }).click();
  await expect(page.getByRole('button', { name: 'Saved to project' })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('save failure remains retryable and never reports success', async ({ page }) => {
  const state = await prepare(page, { jobStatus: 'completed', saveStatus: 503 });
  await page.locator('input[type=file]').setInputFiles(source);
  await page.getByRole('button', { name: 'Extract database', exact: true }).click();
  await page.getByRole('button', { name: 'Save extracted data' }).click();
  await expect(page.getByRole('alert')).toContainText('Extraction could not be saved.');
  expect(state.saved).toBe(false);
  state.saveStatus = 200;
  await page.getByRole('button', { name: 'Save extracted data' }).click();
  await expect(page.getByRole('button', { name: 'Saved to project' })).toBeVisible();
  expect(state.errors).toEqual([]);
});
