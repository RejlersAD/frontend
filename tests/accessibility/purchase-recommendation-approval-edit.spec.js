import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { formActor, formRecordId, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture';

test.setTimeout(90000);
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } });
const contentPath = `/api/v1/procurement/requisitions/${formRecordId}/uploaded-documents/0/content/`;
const originalUrl = 'http://127.0.0.1:5173/__fixtures/inline-approval-source.pdf';
const fixturePdf = () => {
  const stream = 'BT /F1 16 Tf 40 750 Td (Original signed approval evidence) Tj 0 -35 Td (PM signed   MOE signed   MOP signed   VP signature to review) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  return `${pdf}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
};
const pdfBytes = fixturePdf();
const digest = createHash('sha256').update(pdfBytes).digest('hex');
const originalVersion = '2026-09-15T07:00:00.123456Z';
const sourceRows = [
  { step: 1, role: 'PM', user_name: 'Recorded Project Manager', user_id: '110', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { step: 2, role: 'MOE', user_name: 'Recorded Engineering Manager', user_id: null, status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { step: 3, role: 'MOP', user_name: 'Recorded Projects Manager', user_id: '112', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { step: 4, role: 'VP', user_name: '', user_id: null, status: 'not_recorded', approved_at: null, external: true, source: 'signed_purchase_requisition_pdf' },
];
const sourceRecord = () => ({
  updated_at: originalVersion,
  status: 'draft', product_service: 'Recorded software credits', description_reason: 'Supply of software credits', price_description: 'Software credits',
  total_price: '2052.00', net_total_excl_vat: '2052.00', currency: 'USD',
  items: [{ description: 'Supply of software credits', quantity: '1', unit: 'LS', unit_price: '2052.00', total: '2052.00' }],
  approval_workflow_config: [],
  attachments: [{ filename: 'inline-approval-source.pdf', type: 'signed_purchase_requisition_pdf', document_type: 'signed_purchase_requisition_pdf', url: originalUrl, content_url: contentPath, sha256: digest, signature_verified: false }],
  price_remarks_data: {
    import_source: 'signed_pr_pdf',
    signed_document_verification: { document_sha256: digest, signed_off: false, source_approval_rows: structuredClone(sourceRows) },
    signed_approval_evidence: { signatures: { pm: true, moe: true, mop: true, vp: false }, manual_signature_overrides: ['pm', 'moe', 'mop'] },
  },
});
// Model only the response contract. Backend signature/authorization rules are
// tested separately; these fixtures cannot reach a real requisition or PDF.
const savedSourceResponse = (body, record) => {
  const rows = record.price_remarks_data.signed_document_verification.source_approval_rows.map((row, index) => index === body.row_index ? {
    ...row, user_name: body.approver_name, user_id: null, approval_label: body.approval_label, special_note: body.special_note,
    status: body.signature_verified ? 'approved' : row.status,
    approved_at: body.signature_verified ? `${body.approval_date}T12:00:00Z` : row.approved_at,
  } : row);
  const complete = rows.every(row => row.status === 'approved');
  return {
    ...record, status: complete ? 'approved' : record.status,
    approval_workflow_config: complete ? rows : record.approval_workflow_config,
    attachments: record.attachments.map(attachment => ({ ...attachment, signature_verified: complete })),
    price_remarks_data: {
      ...record.price_remarks_data,
      signed_document_verification: { ...record.price_remarks_data.signed_document_verification, source_approval_rows: rows, signed_off: complete },
      signed_approval_evidence: { ...record.price_remarks_data.signed_approval_evidence, signatures: { pm: true, moe: true, mop: true, vp: complete }, manual_signature_overrides: complete ? ['pm', 'moe', 'mop', 'vp'] : ['pm', 'moe', 'mop'] },
    },
  };
};
const history = page => page.locator('[aria-label="Recorded approval history"]');
const step = (page, name) => page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: new RegExp(name) }).click();
const sourceSaves = state => state.requests.filter(request => request.method === 'POST' && request.path.endsWith('/source-approvals/'));
const ordinarySaves = state => state.requests.filter(request => request.method === 'PATCH' && request.path.endsWith(`/${formRecordId}/`));
const assertIsolated = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]); expect(state.submissions).toEqual([]); };
const open = async (page, prepare, options = {}) => {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') });
  await page.context().route('**/__fixtures/inline-approval-source.pdf', route => route.fulfill({ contentType: 'application/pdf', body: pdfBytes }));
  const state = await recommendationFormHarness(page, { edit: true, concurrency: true, record: sourceRecord(), ...options, prepare: state => {
    state.originalContent[contentPath] = { body: pdfBytes, headers: { 'X-Frame-Options': 'DENY' } };
    state.saveSourceApproval = savedSourceResponse;
    prepare?.(state);
  } });
  if (options.initialPath) {
    await expect(page.getByRole('heading', { name: state.record.pr_number, exact: true, level: 1 })).toBeVisible();
    return state;
  }
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible();
  await step(page, 'Approval');
  await expect(history(page).getByRole('button', { name: 'Edit VP approval record', exact: true })).toBeVisible();
  return state;
};

test('only an incomplete source approval offers inline editing and cancel leaves the record unchanged on mobile', async ({ page }) => {
  const state = await open(page);
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  const name = history(page).getByRole('textbox', { name: 'Approver name', exact: true });
  await name.fill('Draft reviewer name');
  await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
  await expect(history(page).getByRole('checkbox', { name: 'I verified this signature on the original PDF', exact: true })).not.toBeChecked();
  await expect(history(page).getByRole('link', { name: /original PDF/i })).toHaveAttribute('href', originalUrl);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const bounds = await name.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '../artifacts/pr-approval-inline-edit-mobile.png' });
  await history(page).getByRole('button', { name: 'Cancel approval edit', exact: true }).click();
  await expect(name).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled();
  await page.clock.runFor(35000);
  expect(sourceSaves(state)).toEqual([]);
  expect(ordinarySaves(state)).toEqual([]);
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3]).toEqual(sourceRows[3]);
  assertIsolated(state);
});

test('saving an approver name alone does not verify the signature or approve the PR', async ({ page }) => {
  const state = await open(page);
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  await history(page).getByRole('textbox', { name: 'Approver name', exact: true }).fill('Source document reviewer');
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected against the original signed document.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  expect(sourceSaves(state)[0].body).toMatchObject({ expected_updated_at: originalVersion, document_sha256: digest, row_index: 3, approver_name: 'Source document reviewer', signature_verified: false });
  expect(sourceSaves(state)[0].body.expected_row).toEqual(sourceRows[3]);
  expect(sourceSaves(state)[0].body).not.toHaveProperty('approval_workflow_config');
  await expect(history(page)).toContainText('Source document reviewer');
  await expect(history(page).getByRole('button', { name: 'Edit VP approval record', exact: true })).toBeVisible();
  expect(state.record.status).toBe('draft');
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3]).toMatchObject({ user_name: 'Source document reviewer', status: 'not_recorded', approved_at: null });
  expect(state.record.price_remarks_data.signed_approval_evidence.signatures.vp).toBe(false);
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});

test('verified source completion refreshes history while retaining unsaved form fields and later save preserves the new evidence', async ({ page }) => {
  const state = await open(page);
  await step(page, 'Request');
  await page.getByRole('textbox', { name: 'Product / service', exact: true }).fill('Unsaved clarified software request');
  await step(page, 'Supplier & pricing');
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Unsaved clarified software line');
  await step(page, 'Approval');
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  await history(page).getByRole('textbox', { name: 'Approver name', exact: true }).fill('Verified source reviewer');
  await history(page).getByRole('checkbox', { name: 'I verified this signature on the original PDF', exact: true }).check();
  await history(page).getByLabel('Approval date', { exact: true }).fill('2026-01-29');
  await page.screenshot({ path: '../artifacts/pr-approval-inline-edit-desktop.png' });
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected against the original signed document.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  expect(sourceSaves(state)[0].body).toMatchObject({ document_sha256: digest, row_index: 3, approver_name: 'Verified source reviewer', approval_date: '2026-01-29', signature_verified: true });
  expect(sourceSaves(state)[0].body.expected_row).toEqual(sourceRows[3]);
  await expect(history(page)).toContainText('Verified source reviewer');
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(0);
  await expect(history(page)).toContainText('2026-01-29');
  await expect(page.getByRole('complementary', { name: 'Live purchase recommendation preview', exact: true }).locator('iframe')).toHaveAttribute('src', /^blob:/);
  expect(state.record.status).toBe('approved');
  const sourceSavedVersion = state.record.updated_at;
  expect(sourceSavedVersion).not.toBe(originalVersion);
  expect(state.record.product_service).toBe('Recorded software credits');
  expect(ordinarySaves(state)).toEqual([]);
  await step(page, 'Request');
  await expect(page.getByRole('textbox', { name: 'Product / service', exact: true })).toHaveValue('Unsaved clarified software request');
  await step(page, 'Supplier & pricing');
  await expect(page.getByRole('textbox', { name: 'Line item 1 description', exact: true })).toHaveValue('Unsaved clarified software line');
  await page.getByRole('button', { name: 'Save', exact: true }).first().click();
  await expect.poll(() => ordinarySaves(state).length).toBe(1);
  const saved = ordinarySaves(state)[0].body;
  expect(saved.expected_updated_at).toBe(sourceSavedVersion);
  expect(saved).not.toHaveProperty('approval_workflow_config');
  expect(saved.price_remarks_data.signed_document_verification.source_approval_rows[3]).toMatchObject({ user_name: 'Verified source reviewer', status: 'approved' });
  expect(saved.price_remarks_data.signed_approval_evidence.signatures.vp).toBe(true);
  expect(state.record.product_service).toBe('Unsaved clarified software request');
  expect(state.record.items[0].description).toBe('Unsaved clarified software line');
  expect(state.record.approval_workflow_config[3]).toMatchObject({ user_name: 'Verified source reviewer', status: 'approved' });
  await step(page, 'Approval');
  await expect(history(page)).toContainText('Verified source reviewer');
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(0);
  assertIsolated(state);
});

test('a failed source-approval request keeps entered values and retries without a workflow PATCH', async ({ page }) => {
  const state = await open(page, state => { state.sourceApprovalError = 'network'; });
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  await history(page).getByRole('textbox', { name: 'Approver name', exact: true }).fill('Reviewer retained after failure');
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected against the original signed document.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  await expect(history(page).getByRole('alert')).toBeVisible();
  await expect(history(page).getByRole('textbox', { name: 'Approver name', exact: true })).toHaveValue('Reviewer retained after failure');
  await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3]).toEqual(sourceRows[3]);
  state.sourceApprovalError = null;
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected against the original signed document.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(2);
  await expect(history(page).getByRole('textbox', { name: 'Approver name', exact: true })).toHaveCount(0);
  await expect(history(page)).toContainText('Reviewer retained after failure');
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});

test('a concurrently changed source row is not overwritten by a stale inline edit', async ({ page }) => {
  const state = await open(page);
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  await history(page).getByRole('textbox', { name: 'Approver name', exact: true }).fill('Stale editor name');
  state.record.price_remarks_data.signed_document_verification.source_approval_rows[3] = { ...sourceRows[3], user_name: 'Concurrent reviewer name' };
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected against the original signed document.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  expect(sourceSaves(state)[0].body.expected_row).toEqual(sourceRows[3]);
  await expect(history(page).getByRole('alert')).toContainText('This approval record changed. Reload it before editing.');
  await expect(history(page).getByRole('textbox', { name: 'Approver name', exact: true })).toHaveValue('Stale editor name');
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3].user_name).toBe('Concurrent reviewer name');
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});

test('adding a missing name to an already verified source row preserves its existing approval and date', async ({ page }) => {
  const originalVp = { ...sourceRows[3], user_name: 'Unknown', status: 'approved', signature_verified: true, approved_at: '2026-01-29T12:00:00Z' };
  const state = await open(page, state => {
    const rows = [...structuredClone(sourceRows.slice(0, 3)), originalVp];
    state.record = {
      ...state.record, status: 'approved', approval_workflow_config: rows,
      attachments: state.record.attachments.map(document => ({ ...document, signature_verified: true })),
      price_remarks_data: {
        ...state.record.price_remarks_data,
        signed_document_verification: { ...state.record.price_remarks_data.signed_document_verification, signed_off: true, source_approval_rows: rows },
        signed_approval_evidence: { signatures: { pm: true, moe: true, mop: true, vp: true }, manual_signature_overrides: ['pm', 'moe', 'mop', 'vp'] },
      },
    };
    state.records = [state.record];
  });
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(1);
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  const verified = history(page).getByRole('checkbox', { name: 'I verified this signature on the original PDF', exact: true });
  await expect(verified).toBeChecked();
  await expect(verified).toBeDisabled();
  await expect(history(page).getByLabel('Approval date', { exact: true })).toHaveValue('2026-01-29');
  await expect(history(page).getByLabel('Approval date', { exact: true })).toBeDisabled();
  await history(page).getByRole('textbox', { name: 'Approver name', exact: true }).fill('Previously verified source reviewer');
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected against the original signed document.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  expect(sourceSaves(state)[0].body).toEqual({
    expected_updated_at: originalVersion,
    document_sha256: digest, row_index: 3, expected_row: originalVp,
    approver_name: 'Previously verified source reviewer', approval_label: '', special_note: 'Corrected against the original signed document.', signature_verified: false, approval_date: '',
  });
  await expect(history(page)).toContainText('Previously verified source reviewer');
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(0);
  expect(state.record.status).toBe('approved');
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3]).toEqual({ ...originalVp, user_name: 'Previously verified source reviewer', approval_label: '', special_note: 'Corrected against the original signed document.' });
  expect(state.record.price_remarks_data.signed_approval_evidence.signatures.vp).toBe(true);
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});

test('a changed recommendation blocks source approval without blessing newer commercial fields or discarding local edits', async ({ page }) => {
  const state = await open(page);
  await step(page, 'Request');
  const product = page.getByRole('textbox', { name: 'Product / service', exact: true });
  await product.fill('My unsaved source clarification');
  await step(page, 'Approval');
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  const name = history(page).getByRole('textbox', { name: 'Approver name', exact: true });
  await name.fill('My source reviewer');
  state.record = { ...state.record, product_service: 'Another requester changed the requirement', updated_at: '2026-09-15T09:00:00.654321Z' };
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected against the original signed document.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Your edits are still here' })).toBeVisible();
  expect(sourceSaves(state)[0].body.expected_updated_at).toBe(originalVersion);
  await expect(name).toHaveValue('My source reviewer');
  await expect(history(page).getByRole('button', { name: 'Save approval record', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
  expect(state.record.product_service).toBe('Another requester changed the requirement');
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3]).toEqual(sourceRows[3]);
  await history(page).getByRole('button', { name: 'Cancel approval edit', exact: true }).click();
  await step(page, 'Request');
  await expect(product).toHaveValue('My unsaved source clarification');
  await page.getByRole('button', { name: 'Reload latest version', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirm action', exact: true }).getByRole('button', { name: 'Keep my edits', exact: true }).click();
  await expect(product).toHaveValue('My unsaved source clarification');
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});

const sourceReview = () => ({ approval_labels: { pm: '1', vp: '4' }, additional_approver: { name: 'Saved Additional Reviewer', approval_label: '5', signature_verified: true } });
const detailPath = `/procurement/requisitions/${formRecordId}`;
const ribbon = page => page.getByRole('region', { name: 'Approval history', exact: true });
const sourceReviewSaves = state => state.requests.filter(request => request.method === 'POST' && request.path.endsWith('/source-review/'));

test('saved detail shows Additional, all project numbers and Richa Level 0 without manufacturing approval authority', async ({ page }) => {
  const state = await open(page, state => {
    state.record.source_approval_review = sourceReview();
    state.record.project_numbers = ['PRJ-001', 'PRJ-002', 'DPT-03'];
  }, { initialPath: detailPath });
  const rows = ribbon(page).getByRole('listitem');
  await expect(rows).toHaveCount(6);
  await expect(rows.first()).toContainText('Richa Hannah Thomas');
  await expect(rows.first()).toContainText('Level 0');
  await expect(rows.first()).toContainText('Not recorded');
  await expect(rows.first()).not.toContainText('Approved');
  const additional = rows.filter({ hasText: 'Saved Additional Reviewer' });
  await expect(additional).toContainText('Level 5');
  await expect(additional).toContainText('Signature verified');
  await expect(additional).not.toContainText('Approved');
  const bounds = await ribbon(page).boundingBox();
  for (const row of await rows.all()) {
    const box = await row.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(941);
  }
  await expect(page.locator('dl').filter({ hasText: 'Project numbers' }).first()).toContainText('PRJ-001, PRJ-002, DPT-03');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
  expect(state.record.approval_workflow_config).toEqual([]);
  await page.screenshot({ path: '../artifacts/procurement-saved-approvers-projects-20260925/saved-approval-ribbon.png' });
  assertIsolated(state);
});

test('saved detail corrects an unknown signed approver name and level only with a special note, retaining failed mobile edits', async ({ page }) => {
  const originalVp = { ...sourceRows[3], user_name: 'Unknown approver', status: 'approved', signature_verified: true, approved_at: '2026-01-29T12:00:00Z' };
  const state = await open(page, state => {
    state.record.price_remarks_data.signed_document_verification.source_approval_rows[3] = originalVp;
    state.record.status = 'approved';
    state.sourceApprovalError = 'network';
  }, { initialPath: detailPath });
  await page.setViewportSize({ width: 390, height: 844 });
  await ribbon(page).getByRole('button', { name: 'Review source approvers', exact: true }).click();
  await history(page).getByRole('button', { name: 'Edit VP approval record', exact: true }).click();
  const name = history(page).getByRole('textbox', { name: 'Approver name', exact: true });
  const level = history(page).getByRole('textbox', { name: 'Level', exact: true });
  const note = history(page).getByRole('textbox', { name: 'Special note', exact: true });
  await name.fill('Identified Source Reviewer');
  await level.fill('4');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect(history(page).getByRole('alert')).toContainText('special note');
  expect(sourceSaves(state)).toHaveLength(0);
  await note.fill('The original PDF identifies this previously unreadable reviewer.');
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  await expect(history(page).getByRole('alert')).toBeVisible();
  await expect(name).toHaveValue('Identified Source Reviewer');
  await expect(level).toHaveValue('4');
  await expect(note).toHaveValue('The original PDF identifies this previously unreadable reviewer.');
  await expect(history(page).getByRole('checkbox')).toBeChecked();
  await expect(history(page).getByRole('checkbox')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await note.scrollIntoViewIfNeeded();
  expect((await history(page).getByRole('button', { name: 'Save approval record', exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: '../artifacts/procurement-saved-approvers-projects-20260925/unknown-approver-mobile.png' });
  state.sourceApprovalError = null;
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect(name).toHaveCount(0);
  expect(sourceSaves(state)[1].body).toMatchObject({ row_index: 3, expected_row: originalVp, approval_label: '4', signature_verified: false, approval_date: '' });
  const saved = state.record.price_remarks_data.signed_document_verification.source_approval_rows[3];
  expect(saved.approved_at).toBe(originalVp.approved_at);
  await expect(ribbon(page)).toContainText('Identified Source Reviewer');
  await expect(ribbon(page)).toContainText('Level 4');
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});

test('saved Additional review requires a correction note and round trips independently of canonical signatures and workflow', async ({ page }) => {
  const before = sourceReview();
  const state = await open(page, state => {
    state.record.source_approval_review = structuredClone(before);
    state.saveSourceReview = (body, record) => ({ ...record, source_approval_review: body.source_approval_review });
    state.sourceReviewError = 'network';
  }, { initialPath: detailPath });
  const canonicalBefore = structuredClone(state.record.price_remarks_data.signed_document_verification);
  await ribbon(page).getByRole('button', { name: 'Review source approvers', exact: true }).click();
  await history(page).getByRole('button', { name: 'Edit Additional approval record', exact: true }).click();
  const name = history(page).getByRole('textbox', { name: 'Approver name', exact: true });
  await name.fill('Corrected Additional Reviewer');
  await history(page).getByRole('textbox', { name: 'Level', exact: true }).fill('6');
  await expect(history(page).getByRole('checkbox')).not.toBeChecked();
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect(history(page).getByRole('alert')).toContainText('special note');
  expect(sourceReviewSaves(state)).toHaveLength(0);
  await history(page).getByRole('textbox', { name: 'Special note', exact: true }).fill('Corrected the extra source signer and level against the original.');
  await history(page).getByRole('checkbox').check();
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceReviewSaves(state).length).toBe(1);
  await expect(history(page).getByRole('alert')).toBeVisible();
  await expect(name).toHaveValue('Corrected Additional Reviewer');
  await expect(history(page).getByRole('checkbox')).toBeChecked();
  state.sourceReviewError = null;
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect(name).toHaveCount(0);
  expect(sourceReviewSaves(state)[1].body).toMatchObject({ document_sha256: digest, expected_updated_at: originalVersion, expected_source_approval_review: before,
    source_approval_review: { approval_labels: before.approval_labels, additional_approver: { name: 'Corrected Additional Reviewer', approval_label: '6', signature_verified: true, special_note: 'Corrected the extra source signer and level against the original.' } } });
  expect(state.record.price_remarks_data.signed_document_verification).toEqual(canonicalBefore);
  expect(state.record.approval_workflow_config).toEqual([]);
  await page.reload();
  await expect(ribbon(page)).toContainText('Corrected Additional Reviewer');
  await expect(ribbon(page)).toContainText('Level 6');
  await expect(ribbon(page)).toContainText('Signature verified');
  expect(sourceSaves(state)).toEqual([]);
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});

test('read-only saved detail shows source annotations without offering approver correction controls', async ({ page }) => {
  const state = await open(page, state => { state.record.source_approval_review = sourceReview(); }, {
    initialPath: detailPath, actor: { ...formActor, is_superuser: false, module_actions: { procurement_requisitions: ['read'], procurement_orders: ['read'] } },
  });
  await ribbon(page).getByRole('button', { name: 'Review source approvers', exact: true }).click();
  await expect(history(page)).toContainText('Saved Additional Reviewer');
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(0);
  expect(sourceSaves(state)).toEqual([]);
  expect(sourceReviewSaves(state)).toEqual([]);
  assertIsolated(state);
});
