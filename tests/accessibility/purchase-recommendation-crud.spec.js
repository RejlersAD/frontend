import { test, expect } from '@playwright/test';
import { recommendationHarness } from '../fixtures/purchase-recommendations.fixture';
import { formRecordId, recommendationFormHarness } from '../fixtures/purchase-recommendation-form.fixture';

test.setTimeout(90000);
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } });
const id = value => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const details = page => page.getByRole('complementary', { name: 'Recommendation details', exact: true });
const clean = state => { expect(state.unknown).toEqual([]); expect(state.pageErrors).toEqual([]); };
const load = async page => {
  await expect(page.getByRole('heading', { name: 'Purchase Recommendations', exact: true })).toBeVisible();
  await expect(details(page)).toHaveAttribute('aria-busy', 'false');
};

test('native and uploaded PR Preview selects the existing details panel without opening a page or dialog', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true, prepare: state => {
    const attachments = [{ type: 'signed_purchase_requisition_pdf', filename: 'signed-pr.pdf', url: '/media/synthetic-signed-pr.pdf' }];
    state.details[id(204)].attachments = attachments;
    state.props.requisitions.find(record => record.id === id(204)).attachments = attachments;
  } });
  await load(page);
  for (const index of [7, 4, 6]) {
    const number = `RAD-PRJ-PR-${String(index).padStart(4, '0')}_2026`;
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: `Select ${number}`, exact: true }) });
    await row.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(details(page)).toHaveAttribute('aria-busy', 'false');
    await expect(details(page).getByRole('heading', { name: number, exact: true })).toBeVisible();
    await expect(details(page)).toBeFocused();
    await expect(page).toHaveURL(/\/procurement\/requisitions$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    if (index === 4) await expect(details(page).getByRole('link', { name: 'Open original PDF', exact: true })).toHaveAttribute('href', '/media/synthetic-signed-pr.pdf');
  }
  expect(state.requests.filter(request => request.method !== 'GET' && !request.path.includes('/ai-champion/'))).toEqual([]);
  clean(state);
});

test('PR delete cancellation and protected errors retain the record; successful deletion refreshes the panel once', async ({ page }) => {
  const targetId = id(207), number = 'RAD-PRJ-PR-0007_2026';
  const state = await recommendationHarness(page, { realApp: true });
  await load(page);
  const startDelete = async () => {
    await page.getByRole('button', { name: `Actions for ${number}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Delete recommendation', exact: true }).click();
    return page.getByRole('dialog', { name: 'Confirm action', exact: true });
  };
  await (await startDelete()).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(state.deleted).toEqual([]);
  state.deleteErrors[targetId] = 'A linked purchase order must be unlinked before deleting this recommendation.';
  await (await startDelete()).getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText(state.deleteErrors[targetId], { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: `Select ${number}`, exact: true })).toBeVisible();
  expect(state.deleted).toEqual([]);
  delete state.deleteErrors[targetId];
  await (await startDelete()).getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => state.deleted).toEqual([targetId]);
  await expect(page.getByRole('button', { name: `Select ${number}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(details(page)).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await load(page);
  await expect(page.getByRole('button', { name: `Select ${number}`, exact: true })).toHaveCount(0);
  clean(state);
});

test('signed PR save clears optional text and preserves historical supplier reason and approval evidence', async ({ page }) => {
  const verification = { signed_off: true, source_approval_rows: [] };
  const state = await recommendationFormHarness(page, { edit: true, record: {
    status: 'approved', price_remarks: 'Old negotiation text', vendor_selection_reason: 'Old supplier reason',
    price_remarks_data: { import_source: 'signed_pr_pdf', signed_document_verification: verification, negotiation_remarks: 'Obsolete imported negotiation text' },
  } });
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Supplier & pricing/ }).click();
  await page.getByRole('textbox', { name: /^Negotiation outcome/ }).fill('');
  await expect(page.getByRole('textbox', { name: /^Reason for supplier selection/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save changes', exact: true }).first().click();
  await expect.poll(() => state.requests.filter(request => request.method === 'PATCH').length).toBe(1);
  expect(state.record.price_remarks).toBe('');
  expect(state.record.vendor_selection_reason).toBe('Old supplier reason');
  expect(state.record.status).toBe('approved');
  expect(state.record.price_remarks_data.signed_document_verification).toEqual(verification);
  expect(state.submissions).toEqual([]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Supplier & pricing/ }).click();
  await expect(page.getByRole('textbox', { name: /^Negotiation outcome/ })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: /^Reason for supplier selection/ })).toHaveCount(0);
  clean(state);
});

test('switching from PR Edit to New within the application clears the prior record and cannot patch it', async ({ page }) => {
  const state = await recommendationFormHarness(page, { edit: true });
  await expect(page.getByRole('heading', { name: 'Edit purchase recommendation', exact: true })).toBeVisible();
  await page.evaluate(() => { history.pushState({}, '', '/procurement/requisitions/new'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByRole('heading', { name: 'Create purchase recommendation', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'PR number', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Product / service', exact: true })).toHaveValue('');
  await page.getByRole('textbox', { name: 'PR number', exact: true }).fill('RAD-PRJ-PR-9002_2026');
  await page.getByRole('button', { name: 'Save draft', exact: true }).first().click();
  await expect.poll(() => state.requests.filter(request => request.path === '/api/v1/procurement/requisitions/' && request.method === 'POST').length).toBe(1);
  expect(state.requests.filter(request => request.method === 'PATCH' && request.path.endsWith(`/${formRecordId}/`))).toEqual([]);
  clean(state);
});

test('a read-only PR owner can preview but cannot create, edit, delete, or convert records', async ({ page }) => {
  const state = await recommendationHarness(page, { realApp: true, prepare: state => {
    state.actor.is_superuser = false;
    state.actor.module_actions = { procurement_requisitions: ['read'], procurement_orders: ['read'] };
  } });
  await load(page);
  await expect(page.getByRole('button', { name: 'New recommendation', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Actions for RAD-PRJ-PR-0007_2026', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Preview recommendation', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Edit recommendation', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Delete recommendation', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Select RAD-PRJ-PR-0004_2026', exact: true }).click();
  await expect(details(page)).toHaveAttribute('aria-busy', 'false');
  await expect(details(page).getByRole('button', { name: 'Create purchase order', exact: true })).toHaveCount(0);
  clean(state);
});
