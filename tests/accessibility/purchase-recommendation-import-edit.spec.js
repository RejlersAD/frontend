import { test, expect } from '@playwright/test';
import { recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture';

test.setTimeout(90000);
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } });
const saves = state => state.requests.filter(({ method, path }) => ['POST', 'PATCH'].includes(method) && /^\/api\/v1\/procurement\/requisitions\/(?:[^/]+\/)?$/.test(path));
const step = (page, name) => page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: new RegExp(name) }).click();
const workflow = [
  { role: 'PM', step: 1, user_name: 'Recorded Project Manager', user_id: '110', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { role: 'MOE', step: 2, user_name: 'Recorded Engineering Manager', user_id: null, status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { role: 'MOP', step: 3, user_name: 'Recorded Projects Manager', user_id: '112', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
  { role: 'VP', step: 4, user_name: 'Recorded VP', user_id: '113', status: 'approved', approved_at: '2026-01-29T12:00:00Z', external: true, source: 'signed_purchase_requisition_pdf' },
];
const imported = status => ({
  status, project_department: '5901142-SARB PRODUCED WATER TREATMENT PROJECT', project_details: [],
  supplier_name: 'AVEVA Software Middle East FZ-LLC', preferred_supplier_if_any: 'AVEVA Software Middle East FZ-LLC', supplier_business_id: '', selected_vendors: [], vendor: null, vendor_selection_reason: '',
  product_service: 'Provision of software credits', description_reason: 'Supply of software credits', price_description: 'Software credits',
  total_price: '2052.00', net_total_excl_vat: '2052.00', currency: 'USD',
  estimated_budget: null, price_remarks: 'Budget > 6,182.14 USD',
  items: [{ description: 'Supply of software credits', total: '2052.00', currency: 'USD', remarks: 'Budget > 6,182.14 USD' }],
  approval_workflow_config: status === 'draft' ? [] : workflow,
  price_remarks_data: {
    import_source: 'signed_pr_pdf', net_total_aed: '',
    signed_document_verification: { signed_off: status !== 'draft', source_approval_rows: workflow.map((entry, index) => status === 'draft' && index === 3 ? { ...entry, status: 'not_recorded', approved_at: null } : entry) },
    signed_approval_evidence: { signatures: { pm: true, moe: true, mop: true, vp: status !== 'draft' } },
    approval_table_labels: { 110: 'PM' },
  },
});
const open = async (page, record, prepare) => {
  await page.clock.install({ time: new Date('2026-09-15T08:00:00Z') });
  const state = await recommendationFormHarness(page, { edit: true, record, prepare });
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible();
  return state;
};
const assertIsolated = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]); };

test('partial line details save and submit without changing recorded amounts', async ({ page }) => {
  const item = { description: '', quantity: '', unit_price: '', total: '2052.00' };
  const state = await open(page, { total_price: '2052.00', net_total_excl_vat: '2052.00', items: [item] });
  await step(page, 'Supplier & pricing');
  await expect(page.getByRole('textbox', { name: 'Line item 1 description', exact: true })).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true })).toHaveValue('');
  await expect(page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true })).toHaveValue('');
  await expect(page.locator('.prf-sp-line-total')).toHaveText('2,052.00');
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await expect.poll(() => saves(state).length).toBe(1);
  expect(state.record.items[0]).toEqual(item);
  expect(Number(state.record.total_price)).toBe(2052);
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click();
  await expect(page.getByText(/Project workflow:|Internal workflow:|Select any active RADAI employee as a Level 1 approver/)).toHaveCount(0);
  await expect(page.locator('.prf-required')).toHaveText('Ready for review');
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click();
  await expect.poll(() => state.submissions.length).toBe(1);
  expect(state.record.items[0]).toEqual(item);
  expect(Number(state.record.total_price)).toBe(2052);
  assertIsolated(state);
});

test('clearing quantity preserves amounts until explicitly saved and zero quantity can be submitted', async ({ page }) => {
  const state = await open(page, { vat_basis: 'none', total_price: '1050.00', net_total_excl_vat: '1050.00', items: [
    { description: 'Optional quantity', quantity: '1', unit_price: '1000.00', total: '1000.00' },
    { description: 'Retained service', quantity: '1', unit_price: '50.00', total: '50.00' },
  ] });
  await step(page, 'Supplier & pricing');
  const quantity = page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true });
  await quantity.fill('');
  await page.clock.runFor(1500);
  expect(saves(state)).toEqual([]);
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await expect.poll(() => saves(state).length).toBe(1);
  expect(saves(state)[0].body.vat_basis).toBe('none');
  expect(saves(state)[0].body.entered_amount).toBe(1050);
  expect(state.record.items[0]).toMatchObject({ quantity: '', total: '1000.00' });
  expect(Number(state.record.total_price)).toBe(1050);
  await expect(page.locator('.prf-sp-grand-total')).toContainText('1,050.00');
  await quantity.fill('0');
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('');
  await page.getByRole('combobox', { name: 'VAT price basis' }).selectOption('none');
  await expect(quantity).toHaveAttribute('min', '0');
  await expect(page.locator('.prf-sp-grand-total')).toContainText('50.00');
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click();
  await expect(page.locator('.prf-required')).toHaveText('Ready for review');
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click();
  await expect.poll(() => state.submissions.length).toBe(1);
  expect(state.record.items[0]).toMatchObject({ description: '', quantity: '0', total: '0.00' });
  expect(Number(state.record.total_price)).toBe(50);
  assertIsolated(state);
});

test('editing an incomplete price explicitly saves confirmed VAT and preserves the discounted header', async ({ page }) => {
  const state = await open(page, {
    vat_basis: 'exclusive', total_price: '105.00', net_total_excl_vat: '100.00',
    price_remarks_data: { discount_amount: '10.00' },
    items: [{ description: 'Quantity pending', quantity: '', unit_price: '25.00', total: '' }],
  });
  await step(page, 'Supplier & pricing');
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('30');
  await expect(page.locator('.prf-sp-grand-total')).toContainText('105.00');
  await page.clock.runFor(35000);
  expect(saves(state)).toEqual([]);
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await expect.poll(() => saves(state).length).toBe(1);
  expect(saves(state)[0].body).toMatchObject({
    vat_basis: 'exclusive', entered_amount: 110, total_price: 105, net_total_excl_vat: 100,
  });
  expect(state.record.items[0]).toMatchObject({ quantity: '', unit_price: '30', total: '' });
  expect(Number(state.record.total_price)).toBe(105);
  expect(Number(state.record.net_total_excl_vat)).toBe(100);
  await expect(page.locator('.prf-save-state')).toHaveText('Draft saved');
  assertIsolated(state);
});

test('clearing the final optional line keeps recorded header money instead of totaling an empty list', async ({ page }) => {
  const state = await open(page, {
    vat_basis: 'exclusive', total_price: '105.00', net_total_excl_vat: '100.00',
    price_remarks_data: { discount_amount: '10.00' },
    items: [{ description: '', quantity: '2', unit_price: '', total: '' }],
  });
  await step(page, 'Supplier & pricing');
  await page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true }).fill('');
  await expect(page.locator('.prf-sp-grand-total')).toContainText('105.00');
  await page.clock.runFor(35000);
  expect(saves(state)).toEqual([]);
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await expect.poll(() => saves(state).length).toBe(1);
  expect(saves(state)[0].body).toMatchObject({
    vat_basis: 'exclusive', entered_amount: 110, total_price: 105, net_total_excl_vat: 100, items: [],
  });
  expect(state.record.items).toEqual([]);
  expect(Number(state.record.total_price)).toBe(105);
  expect(Number(state.record.net_total_excl_vat)).toBe(100);
  await expect(page.locator('.prf-save-state')).toHaveText('Draft saved');
  assertIsolated(state);
});

for (const status of ['draft', 'approved']) {
  test(`a signed ${status} import keeps recorded fields and approvals without mount autosave`, async ({ page }) => {
    const record = imported(status);
    const state = await open(page, record);
    await expect(page.getByRole('textbox', { name: 'Edit selected project or department', exact: true })).toHaveValue(record.project_department);
    await page.clock.runFor(35000);
    expect(saves(state)).toEqual([]);
    await expect(page.locator('.prf-save-state')).toHaveText('Existing recommendation');
    await expect(page.locator('.prf-required')).toHaveText('Ready for review');
    await step(page, 'Supplier & pricing');
    await expect(page.locator('.prf-sp-selected-supplier .prf-sp-supplier-name')).toHaveText(record.supplier_name);
    await expect(page.getByRole('combobox', { name: /^Preferred supplier/ })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: /^Preferred supplier/ }).locator('option:checked')).toHaveText(record.supplier_name);
    await expect(page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true })).toHaveValue('1');
    await expect(page.getByRole('textbox', { name: 'Line item 1 unit', exact: true })).toHaveValue('LS');
    await expect(page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true })).toHaveValue('2052.00');
    await expect(page.locator('.prf-sp-grand-total')).toContainText('2,052.00');
    await expect(page.locator('.prf-sp-grand-total')).toContainText('USD');
    if (status === 'approved') await page.screenshot({ path: '../artifacts/pr-imported-edit-pricing.png' });
    await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Supply of software credits, clarified');
    await page.clock.runFor(35000);
    expect(saves(state)).toEqual([]);
    await step(page, 'Approval');
    const history = page.locator('[aria-label="Recorded approval history"]');
    await expect(history).toContainText('Recorded Engineering Manager');
    await expect(history).toContainText(status === 'draft' ? 'not recorded' : 'approved');
    await expect(page.getByRole('textbox', { name: 'Add Level 1 approver', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit for approval', exact: true })).toHaveCount(0);
    if (status === 'approved') await page.screenshot({ path: '../artifacts/pr-imported-edit-approval-history.png' });
    await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
    await expect.poll(() => saves(state).length).toBe(1);
    expect(saves(state)[0].body).not.toHaveProperty('approval_workflow_config');
    await expect(page.locator('.prf-save-state')).toHaveText('Changes saved');
    expect(state.record.status).toBe(status);
    expect(Number(state.record.total_price)).toBe(2052);
    expect(Number(state.record.net_total_excl_vat)).toBe(2052);
    expect(state.record.currency).toBe('USD');
    expect(state.record.supplier_name).toBe(record.supplier_name);
    expect(state.record.vendor).toBeNull();
    expect(state.record.selected_vendors).toEqual([]);
    expect(state.record.project_department).toBe(record.project_department);
    expect(state.record.project_details[0]).not.toHaveProperty('project_id');
    expect(state.record.items[0]).toMatchObject({ description: 'Supply of software credits, clarified', quantity: '1', unit: 'LS', unit_price: '2052.00', total: '2052.00' });
    expect(state.record.approval_workflow_config).toEqual(record.approval_workflow_config);
    expect(state.record.price_remarks_data.signed_document_verification).toEqual(record.price_remarks_data.signed_document_verification);
    expect(state.record.price_remarks_data.signed_approval_evidence).toEqual(record.price_remarks_data.signed_approval_evidence);
    expect(state.record.price_remarks_data.approval_table_labels).toEqual(record.price_remarks_data.approval_table_labels);
    expect(state.submissions).toEqual([]);
    assertIsolated(state);
  });
}

test('a draft preserves financial values until VAT is confirmed and explicitly saved', async ({ page }) => {
  const state = await open(page);
  await page.clock.runFor(35000);
  expect(saves(state)).toEqual([]);
  await step(page, 'Supplier & pricing');
  await page.getByRole('spinbutton', { name: 'Line item 1 quantity', exact: true }).fill('2');
  await page.getByRole('combobox', { name: 'VAT price basis' }).selectOption('none');
  await page.clock.runFor(1500);
  expect(saves(state)).toEqual([]);
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await expect.poll(() => saves(state).length).toBe(1);
  expect(Number(state.record.total_price)).toBe(800000);
  expect(Number(state.record.items[0].total)).toBe(800000);
  await expect(page.locator('.prf-save-state')).toHaveText('Draft saved');
  assertIsolated(state);
});

test('inconsistent saved line arithmetic stays visible and is never autosaved until pricing is repaired', async ({ page }) => {
  const state = await open(page, { total_price: '2052.00', net_total_excl_vat: '2052.00', currency: 'USD', items: [{ description: 'Recorded service', quantity: '2', unit_price: '1000.00', total: '2052.00' }] });
  await step(page, 'Supplier & pricing');
  await expect(page.locator('.prf-sp-grand-total')).toContainText('2,052.00');
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Clarified recorded service');
  await page.clock.runFor(35000);
  expect(saves(state)).toEqual([]);
  await expect(page.locator('.prf-error-banner')).toContainText('Line item 1 total must equal quantity multiplied by unit price.');
  await page.getByRole('spinbutton', { name: 'Line item 1 unit price', exact: true }).fill('1026');
  await page.getByRole('combobox', { name: 'VAT price basis' }).selectOption('none');
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await page.clock.runFor(1500);
  await expect.poll(() => saves(state).length).toBe(1);
  expect(Number(state.record.total_price)).toBe(2052);
  expect(Number(state.record.items[0].total)).toBe(2052);
  await expect(page.locator('.prf-save-state')).toHaveText('Draft saved');
  assertIsolated(state);
});

test('autosave displays the server field error and saves successfully after the next user edit', async ({ page }) => {
  const detail = 'Line item 1 total must equal quantity multiplied by unit price.';
  const state = await open(page, undefined, state => { state.saveError = { items: [detail] }; });
  await step(page, 'Supplier & pricing');
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Clarified engineering package');
  await page.clock.runFor(1500);
  await expect.poll(() => saves(state).length).toBe(1);
  await expect(page.locator('.prf-error-banner')).toHaveText(`Line items: ${detail}`);
  await expect(page.locator('.prf-sp-error').filter({ hasText: detail })).toBeVisible();
  await page.clock.runFor(35000);
  expect(saves(state)).toHaveLength(1);
  state.saveError = null;
  await page.getByRole('textbox', { name: 'Line item 1 description', exact: true }).fill('Final engineering package');
  await page.clock.runFor(1500);
  await expect.poll(() => saves(state).length).toBe(2);
  await expect(page.locator('.prf-error-banner')).toHaveCount(0);
  assertIsolated(state);
});
