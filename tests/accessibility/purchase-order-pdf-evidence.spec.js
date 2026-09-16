import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { orderFormHarness } from '../fixtures/purchase-order-form.fixture';

test.setTimeout(90000);
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } });
const previewPath = '/api/v1/procurement/po-documents/preview_signed_pdf/';
const employeePath = '/api/v1/procurement/po-documents/approval-employees/';
const importPath = '/api/v1/procurement/po-documents/import_signed_pdf/';
const modal = page => page.getByRole('dialog', { name: 'Import Signed Purchase Order PDF', exact: true });
const approver = page => modal(page).getByRole('combobox', { name: 'Approved by', exact: true });
const position = page => modal(page).getByRole('textbox', { name: 'Approver title', exact: true });
const approvalDate = page => modal(page).getByLabel('Approval date', { exact: true });
const signature = page => modal(page).getByRole('checkbox', { name: 'Approval signature is visible', exact: true });
const stamp = page => modal(page).getByRole('checkbox', { name: 'Company stamp is visible', exact: true });
const employeeSearch = approver;
const requestBodies = (state, path) => state.requests.filter(request => request.path === path).map(request => request.body);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function pdfFile(name) {
  const stream = `BT /F1 15 Tf 40 750 Td (${name}) Tj 0 -35 Td (Synthetic purchase order approval evidence) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(value => `${String(value).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return { name, mimeType: 'application/pdf', buffer: Buffer.from(pdf) };
}
const candidates = (name = 'Extracted source reviewer', title = 'Extracted Operations Manager', date = '2026-01-29') => ({
  approval_evidence: {
    approved_by_name: name, approved_by_title: title, approved_date: date,
    signature_detected: true, stamp_detected: true, page: 1, issues: [],
    signature_verified: false, stamp_verified: false,
  },
});
const choose = (page, filename) => modal(page).locator('input[type="file"]').setInputFiles(pdfFile(filename));
const open = async (page, prepare) => {
  const state = await orderFormHarness(page, { path: '/procurement/orders', prepare });
  await expect(page.getByRole('heading', { name: 'Purchase Orders', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More purchase order actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click();
  await expect(modal(page)).toBeVisible();
  return state;
};
const noPersistentWrite = state => expect(state.acceptedWrites).toEqual([]);
const isolated = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]); };

test('PDF evidence prefill remains unconfirmed and HR selection fills the name and position before manual approval import', async ({ page }) => {
  const state = await open(page, state => {
    state.poPdfPreviews['source-po.pdf'] = { data: candidates() };
    state.approvalEmployees = [{ id: 'hr-17', name: 'Nora Hassan', position: 'Vice President Operations', employee_number: 'EMP-017' }];
  });
  await choose(page, 'source-po.pdf');
  await expect(approver(page)).toHaveValue('Extracted source reviewer');
  await expect(position(page)).toHaveValue('Extracted Operations Manager');
  await expect(approvalDate(page)).toHaveValue('2026-01-29');
  await expect(signature(page)).not.toBeChecked();
  await expect(stamp(page)).not.toBeChecked();
  await expect(modal(page)).toContainText('Signature candidate found on page 1. Confirm it in the PDF.');
  await expect(modal(page)).toContainText('Company stamp candidate found on page 1. Confirm it in the PDF.');
  await expect(modal(page).locator('iframe')).toHaveAttribute('src', /^blob:/);
  for (const target of [modal(page).getByRole('heading', { name: 'Import Signed Purchase Order PDF', exact: true }), modal(page).locator('iframe')]) {
    const bounds = await target.boundingBox();
    const hitBelongsToDialog = await modal(page).evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), { x: bounds.x + 3, y: bounds.y + Math.min(12, bounds.height / 2) });
    expect(hitBelongsToDialog, 'The dialog header and PDF left edge must remain above the application sidebar').toBe(true);
  }
  expect(requestBodies(state, previewPath)).toEqual([{ file: { filename: 'source-po.pdf' } }]);
  noPersistentWrite(state);
  await employeeSearch(page).fill('Nora');
  await expect(modal(page).getByRole('listbox', { name: 'HR Master employees', exact: true }).getByRole('option', { name: /Nora Hassan/ })).toBeVisible();
  await employeeSearch(page).press('ArrowDown');
  await employeeSearch(page).press('Enter');
  await expect(approver(page)).toHaveValue('Nora Hassan');
  await expect(position(page)).toHaveValue('Vice President Operations');
  await expect(signature(page)).not.toBeChecked();
  await expect(stamp(page)).not.toBeChecked();
  expect(state.requests.some(request => request.path === employeePath && request.query.search === 'Nora')).toBe(true);
  await signature(page).check();
  await stamp(page).check();
  // Chrome's native PDF compositor can paint after the iframe and form are
  // ready; allow the original page to appear in the visual review artifact.
  await page.waitForTimeout(1800);
  await page.screenshot({ path: '../artifacts/po-pdf-approval-evidence-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await approver(page).scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: '../artifacts/po-pdf-approval-evidence-mobile.png' });
  await modal(page).getByRole('button', { name: 'Upload signed PDF', exact: true }).click();
  await expect.poll(() => state.acceptedWrites.length).toBe(1);
  expect(state.acceptedWrites[0]).toMatchObject({ path: importPath, method: 'POST', body: {
    file: { filename: 'source-po.pdf' }, approved_by_name: 'Nora Hassan', approved_by_title: 'Vice President Operations',
    approved_date: '2026-01-29', signature_verified: true, stamp_verified: true,
  } });
  await expect(modal(page)).toContainText('Signed PO PDF saved');
  isolated(state);
});

test('extraction and HR lookup errors leave manual name, position and approval import available', async ({ page }) => {
  const state = await open(page, state => {
    state.poPdfPreviews['unreadable-po.pdf'] = { error: { detail: 'Synthetic approval extraction unavailable.' } };
    state.approvalEmployeesError = { detail: 'Synthetic HR lookup unavailable.' };
  });
  await choose(page, 'unreadable-po.pdf');
  await expect.poll(() => state.poPdfPreviewDelivered['unreadable-po.pdf']).toBe(true);
  await expect(modal(page).getByRole('alert')).toContainText('Synthetic approval extraction unavailable.');
  await employeeSearch(page).fill('Manual');
  await expect.poll(() => state.requests.some(request => request.path === employeePath && request.query.search === 'Manual')).toBe(true);
  await expect(modal(page)).toContainText('HR employee search is unavailable. You can enter the name and position manually.');
  await expect(approver(page)).toBeEnabled();
  await expect(position(page)).toBeEnabled();
  await approver(page).fill('Manually confirmed source approver');
  await position(page).fill('Engineering Manager');
  await approvalDate(page).fill('2026-02-10');
  await signature(page).check();
  await stamp(page).check();
  await page.setViewportSize({ width: 390, height: 844 });
  const field = await position(page).boundingBox();
  expect(field.x).toBeGreaterThanOrEqual(0);
  expect(field.x + field.width).toBeLessThanOrEqual(390);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: '../artifacts/po-pdf-approval-evidence-mobile.png' });
  noPersistentWrite(state);
  await modal(page).getByRole('button', { name: 'Upload signed PDF', exact: true }).click();
  await expect.poll(() => state.acceptedWrites.length).toBe(1);
  expect(state.acceptedWrites[0].body).toMatchObject({
    approved_by_name: 'Manually confirmed source approver', approved_by_title: 'Engineering Manager',
    approved_date: '2026-02-10', signature_verified: true, stamp_verified: true,
  });
  isolated(state);
});

test('replacing a PDF resets prior confirmations and ignores the older extraction response', async ({ page }) => {
  const old = deferred();
  const state = await open(page, state => {
    state.poPdfPreviews['old-po.pdf'] = { data: candidates('Old extracted approver', 'Old position', '2025-01-01'), wait: old.promise };
    state.poPdfPreviews['current-po.pdf'] = { data: candidates('Current source approver', 'Current position', '2026-02-10') };
  });
  await choose(page, 'old-po.pdf');
  await expect.poll(() => requestBodies(state, previewPath).length).toBe(1);
  await approver(page).fill('Confirmed old approver');
  await position(page).fill('Confirmed old position');
  await approvalDate(page).fill('2025-01-01');
  await signature(page).check();
  await stamp(page).check();
  await choose(page, 'current-po.pdf');
  await expect(approver(page)).toHaveValue('Current source approver');
  await expect(position(page)).toHaveValue('Current position');
  await expect(approvalDate(page)).toHaveValue('2026-02-10');
  await expect(signature(page)).not.toBeChecked();
  await expect(stamp(page)).not.toBeChecked();
  old.resolve();
  await expect.poll(() => state.poPdfPreviewDelivered['old-po.pdf']).toBe(true);
  await expect(approver(page)).toHaveValue('Current source approver');
  await expect(position(page)).toHaveValue('Current position');
  await expect(approvalDate(page)).toHaveValue('2026-02-10');
  noPersistentWrite(state);
  await modal(page).getByRole('button', { name: 'Upload signed PDF', exact: true }).click();
  await expect.poll(() => state.acceptedWrites.length).toBe(1);
  expect(state.acceptedWrites[0].body).toMatchObject({ file: { filename: 'current-po.pdf' },
    approved_by_name: 'Current source approver', approved_by_title: 'Current position', approved_date: '2026-02-10',
    signature_verified: false, stamp_verified: false,
  });
  isolated(state);
});

test('late extraction of the selected PDF does not overwrite fields already edited manually', async ({ page }) => {
  const pending = deferred();
  const state = await open(page, state => {
    state.poPdfPreviews['slow-po.pdf'] = { data: candidates(), wait: pending.promise };
  });
  await choose(page, 'slow-po.pdf');
  await expect.poll(() => requestBodies(state, previewPath).length).toBe(1);
  await approver(page).fill('Manually reviewed approver');
  await position(page).fill('Manually reviewed position');
  await approvalDate(page).fill('2026-03-05');
  pending.resolve();
  await expect.poll(() => state.poPdfPreviewDelivered['slow-po.pdf']).toBe(true);
  await expect(approver(page)).toHaveValue('Manually reviewed approver');
  await expect(position(page)).toHaveValue('Manually reviewed position');
  await expect(approvalDate(page)).toHaveValue('2026-03-05');
  await expect(signature(page)).not.toBeChecked();
  await expect(stamp(page)).not.toBeChecked();
  noPersistentWrite(state);
  isolated(state);
});
