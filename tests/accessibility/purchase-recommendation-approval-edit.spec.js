import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { formRecordId, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture';

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
const sourceRows = [
  { step: 1, role: 'PM', user_name: 'Recorded Project Manager', user_id: '110', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { step: 2, role: 'MOE', user_name: 'Recorded Engineering Manager', user_id: null, status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { step: 3, role: 'MOP', user_name: 'Recorded Projects Manager', user_id: '112', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { step: 4, role: 'VP', user_name: '', user_id: null, status: 'not_recorded', approved_at: null, external: true, source: 'signed_purchase_requisition_pdf' },
];
const sourceRecord = () => ({
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
    ...row, user_name: body.approver_name, user_id: null,
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
const open = async (page, prepare) => {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') });
  await page.context().route('**/__fixtures/inline-approval-source.pdf', route => route.fulfill({ contentType: 'application/pdf', body: pdfBytes }));
  const state = await recommendationFormHarness(page, { edit: true, record: sourceRecord(), prepare: state => {
    state.originalContent[contentPath] = { body: pdfBytes, headers: { 'X-Frame-Options': 'DENY' } };
    state.saveSourceApproval = savedSourceResponse;
    prepare?.(state);
  } });
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
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeDisabled();
  await expect(history(page).getByRole('checkbox', { name: 'I verified this signature on the original PDF', exact: true })).not.toBeChecked();
  await expect(history(page).getByRole('link', { name: /original PDF/i })).toHaveAttribute('href', originalUrl);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  const bounds = await name.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '../artifacts/pr-approval-inline-edit-mobile.png' });
  await history(page).getByRole('button', { name: 'Cancel approval edit', exact: true }).click();
  await expect(name).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeEnabled();
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
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  expect(sourceSaves(state)[0].body).toMatchObject({ document_sha256: digest, row_index: 3, approver_name: 'Source document reviewer', signature_verified: false });
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
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  expect(sourceSaves(state)[0].body).toMatchObject({ document_sha256: digest, row_index: 3, approver_name: 'Verified source reviewer', approval_date: '2026-01-29', signature_verified: true });
  expect(sourceSaves(state)[0].body.expected_row).toEqual(sourceRows[3]);
  await expect(history(page)).toContainText('Verified source reviewer');
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(0);
  await expect(history(page)).toContainText('2026-01-29');
  await expect(page.getByRole('complementary', { name: 'Live purchase recommendation preview', exact: true }).locator('iframe')).toHaveAttribute('src', /^blob:/);
  expect(state.record.status).toBe('approved');
  expect(state.record.product_service).toBe('Recorded software credits');
  expect(ordinarySaves(state)).toEqual([]);
  await step(page, 'Request');
  await expect(page.getByRole('textbox', { name: 'Product / service', exact: true })).toHaveValue('Unsaved clarified software request');
  await step(page, 'Supplier & pricing');
  await expect(page.getByRole('textbox', { name: 'Line item 1 description', exact: true })).toHaveValue('Unsaved clarified software line');
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => ordinarySaves(state).length).toBe(1);
  const saved = ordinarySaves(state)[0].body;
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
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  await expect(history(page).getByRole('alert')).toBeVisible();
  await expect(history(page).getByRole('textbox', { name: 'Approver name', exact: true })).toHaveValue('Reviewer retained after failure');
  await expect(page.getByRole('button', { name: 'Save changes', exact: true }).first()).toBeDisabled();
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3]).toEqual(sourceRows[3]);
  state.sourceApprovalError = null;
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
  const originalVp = { ...sourceRows[3], status: 'approved', signature_verified: true, approved_at: '2026-01-29T12:00:00Z' };
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
  await history(page).getByRole('button', { name: 'Save approval record', exact: true }).click();
  await expect.poll(() => sourceSaves(state).length).toBe(1);
  expect(sourceSaves(state)[0].body).toEqual({
    document_sha256: digest, row_index: 3, expected_row: originalVp,
    approver_name: 'Previously verified source reviewer', signature_verified: false, approval_date: '',
  });
  await expect(history(page)).toContainText('Previously verified source reviewer');
  await expect(history(page).getByRole('button', { name: /^Edit .* approval record$/ })).toHaveCount(0);
  expect(state.record.status).toBe('approved');
  expect(state.record.price_remarks_data.signed_document_verification.source_approval_rows[3]).toEqual({ ...originalVp, user_name: 'Previously verified source reviewer' });
  expect(state.record.price_remarks_data.signed_approval_evidence.signatures.vp).toBe(true);
  expect(ordinarySaves(state)).toEqual([]);
  assertIsolated(state);
});
