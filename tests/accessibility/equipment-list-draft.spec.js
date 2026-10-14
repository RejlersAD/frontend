import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';

test.use({ serviceWorkers: 'block' });

const project = { project_id: 'project-1', name: 'Synthetic process project', code: 'SYN-001' };
const item = {
  id: 'item-1', tag: 'V-101', description: 'Separator', equipment_type: 'Vessel',
  pid_no: 'PID-001', review_state: 'unreviewed',
};
const draft = (description = 'Separator', version = 1) => ({
  id: 'register-1', register_number: 'EQ-001',
  revision: { number: 1, status: 'draft', version, source_upload_id: 'upload-1', is_immutable: false },
  items: [{ ...item, description }],
});

async function open(page, { initial = draft(), failImport = false, stale = false } = {}) {
  const state = { record: initial, writes: [], unknown: [], importFails: failImport, stale };
  await page.addInitScript(value => {
    localStorage.setItem('equipmentListActiveProject', JSON.stringify(value));
    localStorage.setItem('radai_access_token', 'synthetic-token');
  }, project);
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') state.writes.push({ path, body: request.headers()['content-type']?.includes('application/json') ? request.postDataJSON() : null });
    if (path.endsWith('/project-organizer/projects/') && request.method() === 'GET') {
      await route.fulfill({ json: { items: [project] } });
    } else if (path.endsWith('/project-organizer/projects/project-1/activity/')) {
      await route.fulfill({ json: { id: 'activity-1' } });
    } else if (path.endsWith('/pid/equipment-registers/current/')) {
      await route.fulfill(state.record ? { json: state.record } : { status: 204 });
    } else if (path.endsWith('/pid/equipment-registers/register-1/changes/')) {
      await route.fulfill({ json: { changes: [] } });
    } else if (path.endsWith('/pid/equipment-registers/register-1/items/item-1/')) {
      if (state.stale) {
        state.stale = false;
        state.record = draft('Concurrent update', 2);
        await route.fulfill({ status: 409, json: { code: 'stale_revision', version: 2 } });
      } else {
        state.record = draft(request.postDataJSON().set.description, state.record.revision.version + 1);
        await route.fulfill({ json: state.record });
      }
    } else if (path.endsWith('/pid/equipment/analyze/')) {
      await route.fulfill({ json: { success: true, upload_id: 'upload-2', equipment: [{ ...item, tag: 'P-202' }], total: 1, drawing_ref: 'PID-002' } });
    } else if (path.endsWith('/pid/equipment-registers/import-extraction/')) {
      if (state.importFails) {
        state.importFails = false;
        await route.fulfill({ status: 503, json: { error: 'Temporary save failure' } });
      } else {
        state.record = { ...draft('Pump', 1), items: [{ ...item, tag: 'P-202', description: 'Pump' }], revision: { ...draft().revision, source_upload_id: 'upload-2', number: 2 } };
        await route.fulfill({ status: 201, json: state.record });
      }
    } else if (path.includes('/legends/')) {
      await route.fulfill({ json: [] });
    } else {
      state.unknown.push(`${request.method()} ${path}`);
      await route.fulfill({ status: 404, json: { error: 'Unexpected request' } });
    }
  });
  await page.goto('/tests/fixtures/equipment-list-draft.html');
  await expect(page.getByRole('heading', { name: 'Equipment List', exact: true })).toBeVisible();
  return state;
}

test('Save Draft writes the open edit with a freshness token, preserves it on conflict, and returns to the project list', async ({ page }) => {
  const state = await open(page, { stale: true });
  await page.getByRole('button', { name: 'Edit equipment' }).click();
  await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Reviewed separator');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your edits are preserved');
  await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Reviewed separator');
  expect(state.writes[0].body.expected_revision_version).toBe(1);

  await page.getByRole('button', { name: 'Back to Projects', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave Equipment List?' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay here' }).click();
  await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue('Reviewed separator');
  await page.getByRole('button', { name: 'Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reload saved register' }).click();
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  expect(state.writes[1].body.set.description).toBe('Reviewed separator');
  expect(state.writes[1].body.expected_revision_version).toBe(2);
  expect(state.writes).toHaveLength(2);
  await page.getByRole('button', { name: 'Back to Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Equipment List — Project Workspace/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('equipmentListActiveProject'))).toBeNull();
  expect(state.unknown).toEqual([]);
});

test('Save Draft does not claim success before an extraction exists', async ({ page }) => {
  const state = await open(page, { initial: null });
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Extract a P&ID before saving');
  expect(state.writes).toHaveLength(0);
  expect(state.unknown).toEqual([]);
});

test('Save Draft retries a failed extraction import without another upload', async ({ page }) => {
  const state = await open(page, { initial: null, failImport: true });
  await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
  await page.getByRole('button', { name: 'Extract and save draft' }).click();
  await expect(page.getByRole('alert')).toContainText('Temporary save failure');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  expect(state.writes.filter(write => write.path.endsWith('/pid/equipment/analyze/'))).toHaveLength(1);
  const imports = state.writes.filter(write => write.path.endsWith('/pid/equipment-registers/import-extraction/'));
  expect(imports).toHaveLength(2);
  expect(imports.map(write => write.body.source_upload_id)).toEqual(['upload-2', 'upload-2']);
  expect(state.unknown).toEqual([]);
});

test('Equipment Master shows cited relationships and exports a structured reviewable JSON model', async ({ page }) => {
  const record = draft();
  record.items[0].equipment_master = {
    schema_version: '1.0',
    attributes: { vessel_diameter: { value: '1200', unit: 'mm', evidence: 'V-101 diameter 1200 mm' } },
    relationships: {
      shutdown_valves: [{
        tag: 'SDV-8003', drawing_no: 'PID-SYN-001', filename: 'synthetic-pid.pdf',
        page: 2, evidence: 'V-101 CONNECTED TO SDV-8003', confidence: '90', review_state: 'proposed',
      }],
      cross_pid_references: [{
        tag: 'PID-2002', drawing_no: 'PID-SYN-001', page: 2,
        evidence: 'V-101 CONTINUED ON P&ID PID-2002', review_state: 'proposed',
      }],
    },
    source_documents: [{ drawing_no: 'PID-SYN-001', filename: 'synthetic-pid.pdf', page: 2 }],
    validation_findings: {
      status: 'Partial Data Extracted', missing_fields: [], recommended_sources: [],
      warnings: ['Some AI links lacked source evidence; verify the drawing.'],
    },
  };
  const state = await open(page, { initial: record });
  await expect(page.getByRole('heading', { name: 'Equipment Master relationships' })).toBeVisible();
  await expect(page.getByText('V-101 CONNECTED TO SDV-8003')).toBeVisible();
  await expect(page.getByText('PID-2002 · proposed', { exact: true })).toBeVisible();
  await expect(page.getByText('1200 mm')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Some AI links lacked source evidence' })).toBeVisible();

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export Equipment Master JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Equipment_master.json');
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.schema_version).toBe('1.0');
  expect(exported.review_state).toBe('proposed');
  expect(exported.equipment[0].equipment_master.relationships.shutdown_valves[0].page).toBe(2);
  expect(state.writes).toEqual([]);
  expect(state.unknown).toEqual([]);
});

test('Equipment Master surfaces vision provenance, extraction coverage and resolved cross-P&ID links', async ({ page }) => {
  const record = draft();
  record.items[0].equipment_master = {
    schema_version: '1.0',
    relationships: {
      shutdown_valves: [{
        tag: 'SDV-8003', drawing_no: 'PID-SYN-001', filename: 'synthetic-pid.pdf',
        page: 2, evidence: 'V-101 CONNECTED TO SDV-8003', confidence: '90', review_state: 'proposed',
        source: 'vision',
      }],
      cross_pid_references: [{
        tag: 'P-202', drawing_no: 'PID-SYN-001', page: 2,
        evidence: 'V-101 CONTINUED ON P&ID PID-2002', review_state: 'proposed',
        resolution: 'resolved_in_batch', resolved_drawing_no: 'PID-2002', resolved_filename: 'pid-2002.pdf',
      }],
    },
    extraction_coverage: {
      groups: {
        shutdown_valves: { count: 1, found: true, sources: ['vision'] },
        cross_pid_references: { count: 1, found: true, sources: ['text'] },
      },
      groups_found: 2,
      groups_total: 12,
      completeness: 2 / 12,
    },
    provenance: { text: 4, vision: 2 },
  };
  record.items.push({ ...item, id: 'item-2', tag: 'P-202', description: 'Pump', pid_no: 'PID-2002' });
  const state = await open(page, { initial: record });

  await expect(page.getByRole('heading', { name: 'Equipment Master relationships' })).toBeVisible();
  await expect(page.getByText('SDV-8003 · proposed · 90% estimated confidence')).toBeVisible();
  await expect(page.getByText('Vision', { exact: true })).toBeVisible();
  await expect(page.getByText('High', { exact: true })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Extraction coverage' })).toBeVisible();
  await expect(page.getByText('2 / 12 groups found')).toBeVisible();
  await expect(page.getByText('17% complete')).toBeVisible();
  await expect(page.getByText('shutdown valves · 1')).toBeVisible();
  await expect(page.getByText('Blank groups mean unverified, not absent.')).toBeVisible();
  await expect(page.getByText('Text-sourced: 4 · Vision-sourced: 2')).toBeVisible();

  const resolvedBadge = page.getByRole('button', { name: 'Resolved in batch', exact: true });
  await expect(resolvedBadge).toBeVisible();
  await expect(page.getByText('Resolved to PID-2002 · pid-2002.pdf')).toBeVisible();
  await resolvedBadge.click();
  await expect(page.getByRole('heading', { name: 'P-202', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export Equipment Master JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Equipment_master.json');
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.equipment[0].equipment_master.extraction_coverage.groups_total).toBe(12);
  expect(exported.equipment[0].equipment_master.provenance).toEqual({ text: 4, vision: 2 });
  expect(exported.cross_reference_index).toHaveLength(1);
  expect(exported.cross_reference_index[0]).toMatchObject({
    tag: 'V-101',
    group: 'cross_pid_references',
    related_tag: 'P-202',
    resolution: 'resolved_in_batch',
    resolved_drawing_no: 'PID-2002',
    resolved_filename: 'pid-2002.pdf',
    drawing_no: 'PID-SYN-001',
    page: 2,
  });
  expect(state.writes).toEqual([]);
  expect(state.unknown).toEqual([]);
});
