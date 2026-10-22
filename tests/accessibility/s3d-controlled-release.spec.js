import { test, expect } from '@playwright/test';
import process from 'node:process';
import { Buffer } from 'node:buffer';

test.setTimeout(Number(process.env.S3D_TEST_TIMEOUT_MS || 240000));
const jobId = '00000000-0000-4000-8000-000000000456';
const draftId = '00000000-0000-4000-8000-000000000111';
const releaseId = '00000000-0000-4000-8000-000000000222';
const attemptId = '00000000-0000-4000-8000-000000000333';

async function prepare(page, options = {}) {
  const state = { items: [], current_manifest: { input_sha256: 'revision-1' },
    blockers: ['Persist validation for both workbooks before freezing.'], validation: null, attempts: [], events: [], ...options };
  await page.route('**/api/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith(`/paper-spec/jobs/${jobId}/`)) return route.fulfill({ json: {
      id: jobId, project_id: null, status: 'completed', document_meta: { original_filename: 'Synthetic.pdf', total_pages: 1 },
    } });
    if (path.endsWith('/releases/')) {
      if (request.method() === 'POST') {
        const draft = { id: draftId, state: 'draft', manifest: { ...state.current_manifest }, created_at: '2026-10-20T10:00:00Z' };
        state.items.unshift(draft);
        return route.fulfill({ status: 201, json: draft });
      }
      return route.fulfill({ json: { ...state, can_freeze: state.blockers.length === 0,
        pilot_targets: [{ id: 'disposable-test', label: 'Disposable pilot', sp3d_version: 'Agreed version', import_profile: 'Piping pilot' }] } });
    }
    if (path.endsWith('/releases/validate/')) {
      state.validation = { id: 'validation-1', input_sha256: state.current_manifest.input_sha256, error_count: 0, results: { issues_total: 0 } };
      state.blockers = state.noAuthority ? ['Release authority is not configured.'] : [];
      return route.fulfill({ status: 201, json: state.validation });
    }
    if (path.endsWith(`/releases/${draftId}/freeze/`)) {
      if (state.denyFreeze) return route.fulfill({ status: 409, json: { error: 'Release blocked.', blockers: ['Validation is stale; validate the current inputs again.'] } });
      const frozen = { id: releaseId, state: 'frozen', manifest: { ...state.current_manifest, spec_sha256: 'a'.repeat(64), cat_sha256: 'b'.repeat(64) }, created_at: '2026-10-20T10:01:00Z' };
      state.items.unshift(frozen);
      state.events.unshift({ id: 'event-1', event: 'release_frozen', created_at: frozen.created_at, author: 11 });
      return route.fulfill({ json: frozen });
    }
    if (path.endsWith('/release-history/')) return route.fulfill({ json: { events: state.events, validations: state.validation ? [state.validation] : [] } });
    if (path.endsWith('/export-spec/')) {
      expect(url.searchParams.get('draft')).toBeNull();
      expect(url.searchParams.get('release_id')).toBe(releaseId);
      return route.fulfill({ contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Buffer.from('synthetic frozen workbook') });
    }
    if (path.endsWith('/import-attempts/')) {
      if (request.method() === 'POST') {
        expect(request.postData()).toContain('release_id');
        expect(request.postData()).toContain(releaseId);
        expect(request.headers()['content-type']).toContain('multipart/form-data');
        const attempt = { id: attemptId, release_id: releaseId, status: 'failed', sp3d_version: 'Agreed version', import_profile: 'Piping pilot', disposable_target: 'disposable-test', rejection_count: 2, report_name: 'rejections.txt', report_sha256: 'c'.repeat(64), measurements: { import_failures: 2 } };
        state.attempts.unshift(attempt);
        return route.fulfill({ status: 201, json: attempt });
      }
      return route.fulfill({ json: { items: state.attempts } });
    }
    if (path.endsWith('/workbook/')) return route.fulfill({ json: { sheets: [], workbook: 'spec' } });
    return route.fulfill({ json: { items: [], results: [], unread_count: 0 } });
  });
  const entry = `/engineering/digitization/smart-plant-3d?screen=preview&job=${jobId}`;
  await page.goto(`/tests/fixtures/s3d-builder-shell.html?entry=${encodeURIComponent(entry)}`);
  await page.getByRole('tab', { name: 'Release & pilot', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Controlled release', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create release draft', exact: true })).toBeEnabled();
  return state;
}

async function freeze(page) {
  await page.getByRole('button', { name: 'Create release draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Create release draft completed.');
  await page.getByRole('button', { name: 'Validate both workbooks', exact: true }).click();
  await expect(page.getByText('Errors: 0 · Findings: 0')).toBeVisible();
  await page.getByRole('button', { name: 'Freeze release', exact: true }).click();
}

test('validate/freeze downloads original released file and blocks it after edits', async ({ page }) => {
  const state = await prepare(page);
  await expect(page.getByRole('button', { name: 'Released SPEC', exact: true })).toBeDisabled();
  await freeze(page);
  await expect(page.getByText('Current status: Frozen release available')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Released SPEC', exact: true }).click();
  expect((await download).suggestedFilename()).toBe(`RELEASED_${releaseId}_SPEC.xlsx`);
  state.current_manifest = { input_sha256: 'revision-2' };
  state.items.find(item => item.state === 'frozen').invalidated = true;
  state.blockers = ['Validation is stale; validate the current inputs again.'];
  await page.getByRole('button', { name: 'Refresh release state', exact: true }).click();
  await expect(page.getByText('Current status: Draft / release required')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Released SPEC', exact: true })).toBeDisabled();
});

test('unconfigured authority and stale validation expose explicit blockers', async ({ page }) => {
  const state = await prepare(page, { noAuthority: true });
  await page.getByRole('button', { name: 'Create release draft', exact: true }).click();
  await page.getByRole('button', { name: 'Validate both workbooks', exact: true }).click();
  await expect(page.getByText('Release authority is not configured.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Freeze release', exact: true })).toBeDisabled();
  state.noAuthority = false; state.blockers = []; state.denyFreeze = true;
  await page.getByRole('button', { name: 'Refresh release state', exact: true }).click();
  await page.getByRole('button', { name: 'Freeze release', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Validation is stale');
  await expect(page.getByRole('button', { name: 'Released CAT', exact: true })).toBeDisabled();
});

test('frozen release accepts target rejection report without claiming import execution', async ({ page }) => {
  await prepare(page);
  await freeze(page);
  await expect(page.getByText('Current status: Frozen release available')).toBeVisible();
  await page.getByRole('combobox', { name: 'Disposable target', exact: true }).selectOption('disposable-test');
  await page.getByRole('combobox', { name: 'Import result', exact: true }).selectOption('failed');
  await page.getByLabel('Rejection count', { exact: true }).fill('2');
  await page.getByLabel('Target report', { exact: true }).setInputFiles({ name: 'rejections.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic rejection report') });
  await page.getByRole('button', { name: 'Record import attempt', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'failed · Agreed version · Piping pilot' })).toBeVisible();
  await expect(page.getByText('Rejected: 2 · Target: disposable-test')).toBeVisible();
});
