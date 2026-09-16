import { test, expect } from '@playwright/test';
import { recommendationFormHarness, formRecordId } from '../fixtures/purchase-recommendation-form.fixture';
import { recommendationPdfImportHarness, syntheticApprovedPdf } from '../fixtures/purchase-recommendation-pdf-import.fixture';

test.setTimeout(120000);
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } });
const saves = state => state.requests.filter(({ method, path }) => ['POST', 'PATCH'].includes(method) && /^\/api\/v1\/procurement\/requisitions\/(?:[^/]+\/)?$/.test(path));
const pricing = page => page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Supplier & pricing/ }).click();
const baseRecord = {
  status: 'approved', total_price: '100.00', net_total_excl_vat: '100.00', currency: 'USD',
  items: [{ description: 'Recorded signed service', quantity: '1', unit: 'LS', unit_price: '100.00', total: '100.00' }],
  price_remarks_data: { signed_document_verification: { signed_off: true, document_sha256: 'original-signed-document' } },
};
const open = async (page, record = {}) => {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') });
  const state = await recommendationFormHarness(page, { edit: true, record: { ...baseRecord, ...record } });
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible();
  await pricing(page);
  return state;
};
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]); };

test('unconfirmed existing financial values remain exact on open and ordinary edit/save', async ({ page }) => {
  const record = { total_price: '115.00', net_total_excl_vat: '100.00', price_remarks_data: { ...baseRecord.price_remarks_data, line_details: [{ vat_rate: '15' }] } };
  const state = await open(page, record);
  await expect(page.getByRole('combobox', { name: 'VAT price basis' })).toHaveValue('unconfirmed');
  await expect(page.locator('.prf-sp-grand-total')).toContainText('115.00');
  await expect(page.getByLabel('Recommendation totals')).toContainText('VAT not confirmed');
  await page.clock.runFor(35000);
  expect(saves(state)).toEqual([]);
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Recorded signed service, clarified');
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => saves(state).length).toBe(1);
  expect(Number(saves(state)[0].body.total_price)).toBe(115);
  expect(Number(saves(state)[0].body.net_total_excl_vat)).toBe(100);
  expect(saves(state)[0].body).not.toHaveProperty('vat_basis');
  expect(saves(state)[0].body).not.toHaveProperty('entered_amount');
  expect(state.record.price_remarks_data.line_details).toEqual([{ vat_rate: '15' }]);
  expect(state.record.price_remarks_data.signed_document_verification).toEqual(baseRecord.price_remarks_data.signed_document_verification);
  clean(state);
});

for (const [basis, net, tax, gross] of [['exclusive', 100, 5, 105], ['inclusive', 95.24, 4.76, 100], ['none', 100, 0, 100]]) {
  test(`explicit ${basis} choice previews then saves once, and reopening never compounds VAT`, async ({ page }) => {
    const state = await open(page);
    await page.getByRole('combobox', { name: 'VAT price basis' }).selectOption(basis);
    const totals = page.getByLabel('Recommendation totals');
    await expect(totals).toContainText(net.toFixed(2));
    await expect(totals).toContainText(tax.toFixed(2));
    await expect(page.locator('.prf-sp-grand-total')).toContainText(gross.toFixed(2));
    if (basis === 'inclusive') await page.screenshot({ path: '../artifacts/pr-vat-inclusive-review.png' });
    await expect(page.getByRole('complementary', { name: 'Live purchase recommendation preview' })).toContainText(`USD ${gross.toFixed(2)}`);
    await page.clock.runFor(35000);
    expect(saves(state)).toEqual([]);
    expect(Number(state.record.total_price)).toBe(100);
    await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
    await expect.poll(() => saves(state).length).toBe(1);
    expect(saves(state)[0].body).toMatchObject({ vat_basis: basis, entered_amount: 100, total_price: gross, net_total_excl_vat: net });
    expect(state.record.status).toBe('approved');
    expect(state.record.items[0].unit_price).toBe('100.00');
    expect(state.record.price_remarks_data.signed_document_verification).toEqual(baseRecord.price_remarks_data.signed_document_verification);
    await page.goto(`/procurement/requisitions/${formRecordId}/edit`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible();
    await pricing(page);
    await expect(page.getByRole('combobox', { name: 'VAT price basis' })).toHaveValue(basis);
    await expect(page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true })).toHaveValue('100.00');
    await expect(page.locator('.prf-sp-grand-total')).toContainText(gross.toFixed(2));
    await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
    await expect.poll(() => saves(state).length).toBe(2);
    expect(saves(state)[1].body).not.toHaveProperty('vat_basis');
    expect(Number(state.record.total_price)).toBe(gross);
    clean(state);
  });
}

test('changing an unconfirmed price requires VAT choice before a financial save', async ({ page }) => {
  const state = await open(page);
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('200');
  await page.clock.runFor(35000);
  expect(saves(state)).toEqual([]);
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect(page.locator('.prf-error-banner')).toContainText('Confirm whether the entered price includes VAT');
  expect(saves(state)).toEqual([]);
  expect(Number(state.record.total_price)).toBe(100);
  clean(state);
});

test('signed PDF import retains source price unless the reviewer explicitly confirms VAT', async ({ page }) => {
  const state = await recommendationPdfImportHarness(page, { extracted: { net_total: '100.00' }, documentSignedOff: true, approvalDetection: { approval_date: '2026-09-15' } });
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'More recommendation actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Import signed PDF', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import Approved PR PDF' });
  await dialog.locator('input[type=file]').setInputFiles(syntheticApprovedPdf);
  await dialog.getByRole('button', { name: 'Preview OCR', exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: 'VAT price basis' })).toHaveValue('unconfirmed');
  await expect(dialog.getByRole('spinbutton', { name: 'Entered price', exact: true })).toHaveValue('100.00');
  await expect(dialog.getByLabel('Reviewed recommendation totals')).toHaveCount(0);
  await dialog.getByRole('combobox', { name: 'VAT price basis' }).selectOption('inclusive');
  await expect(dialog.getByLabel('Reviewed recommendation totals')).toContainText('95.24');
  await expect(dialog.getByLabel('Reviewed recommendation totals')).toContainText('4.76');
  expect(state.saveRequests).toEqual([]);
  await dialog.getByRole('button', { name: 'Create reviewed PR', exact: true }).click();
  await expect.poll(() => state.saveRequests.length).toBe(1);
  expect(JSON.parse(state.saveRequests[0].manual_overrides)).toMatchObject({ vat_basis: 'inclusive', entered_amount: '100.00', net_total: '100.00' });
  expect(state.saveRequests[0].file.filename).toBe(syntheticApprovedPdf.name);
  clean(state);
});
