import { test, expect } from '@playwright/test';
import { formRecordId } from '../fixtures/purchase-recommendation-form.fixture.js';
import { originalVersion, reopenedVersion, rejectionReason, requester, revisionHarness } from '../fixtures/purchase-requisition-revision.fixture.js';
import { mixedSizePdf } from '../fixtures/mixed-size-pdf.fixture.js';

test.setTimeout(90000);
test.use({ serviceWorkers: 'block', viewport: { width: 1672, height: 941 } });
const edit = page => page.getByRole('button', { name: 'Edit and resubmit', exact: true });
const product = page => page.getByRole('textbox', { name: 'Product / service', exact: true });
const assertIsolated = state => { expect(state.pageErrors).toEqual([]); expect(state.unknown).toEqual([]); };

test('rejected requester reopens, corrects and sends a new approval round using fresh versions', async ({ page }) => {
  const state = await revisionHarness(page);
  await expect(page.getByRole('region', { name: 'Revise rejected recommendation' })).toContainText(rejectionReason);
  await page.screenshot({ path: '../.codex-temp/pr-resubmission-20260924/rejected-review.png', fullPage: true });
  await edit(page).click();
  await expect(product(page)).toBeVisible();
  expect(state.reopens).toEqual([{ expected_updated_at: originalVersion }]);
  expect(state.submissions).toEqual([]);
  await expect(page.getByRole('region', { name: 'Previous approval rounds' })).toContainText(rejectionReason);
  await page.screenshot({ path: '../.codex-temp/pr-resubmission-20260924/reopened-draft.png', fullPage: true });
  expect(state.record.approval_workflow_config.every(stage => stage.status === 'pending' && !stage.signature)).toBe(true);
  await product(page).fill('Corrected delivery scope after rejection');
  await page.getByRole('button', { name: 'Send for Approval', exact: true }).first().click();
  await page.getByRole('dialog', { name: 'Confirm action', exact: true }).getByRole('button', { name: 'Yes', exact: true }).click();
  await expect.poll(() => state.submissions.length).toBe(1);
  const patch = state.requests.find(request => request.method === 'PATCH' && request.path.endsWith(`/${formRecordId}/`));
  expect(patch.body.expected_updated_at).toBe(reopenedVersion);
  expect(state.submissions[0].expected_updated_at).toBe(state.record.updated_at);
  expect(state.record.status).toBe('submitted');
  expect(state.record.price_remarks_data.approval_revision_history[0].approval_workflow_config[0].signature).toBe('recorded historical signature');
  await expect(page).toHaveURL(/\/requisitions$/);
  assertIsolated(state);
});

test('direct edit link requires explicit reopening and does not autosave rejected content', async ({ page }) => {
  const state = await revisionHarness(page, { initialPath: `/procurement/requisitions/${formRecordId}/edit` });
  await expect(edit(page)).toBeVisible();
  await expect(product(page)).toHaveCount(0);
  expect(state.requests.filter(request => ['PATCH', 'POST'].includes(request.method))).toEqual([]);
  await edit(page).click();
  await expect(product(page)).toBeVisible();
  expect(state.reopens).toHaveLength(1);
  assertIsolated(state);
});

test('register provides Edit and resubmit for eligible rejected requests', async ({ page }) => {
  const state = await revisionHarness(page, { initialPath: '/procurement/requisitions' });
  await page.getByRole('button', { name: `Actions for ${state.record.pr_number}`, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit and resubmit', exact: true }).click();
  await expect(edit(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${formRecordId}/edit$`));
  assertIsolated(state);
});

test('server-denied capability hides reopen and register edit even for a client administrator', async ({ page }) => {
  const state = await revisionHarness(page, { actor: { ...requester, is_superuser: true }, record: { can_reopen: false } });
  await expect(page.getByRole('region', { name: 'Revise rejected recommendation' })).toContainText('You do not have access');
  await expect(edit(page)).toHaveCount(0);
  await page.goto('/procurement/requisitions');
  await page.getByRole('button', { name: `Actions for ${state.record.pr_number}`, exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /Edit/ })).toHaveCount(0);
  expect(state.reopens).toHaveLength(0);
  assertIsolated(state);
});

test('stale reopen requires explicit reload before editing the new rejected version', async ({ page }) => {
  const state = await revisionHarness(page);
  await expect(edit(page)).toBeVisible();
  state.record = { ...state.record, updated_at: '2026-09-24T09:00:00.987654Z', rejection_reason: 'A newer rejection reason must be reviewed.' };
  await edit(page).click();
  await expect(page.getByRole('alert')).toContainText('changed since you opened');
  await expect(edit(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Reload latest version', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Revise rejected recommendation' })).toContainText(state.record.rejection_reason);
  await expect(edit(page)).toBeEnabled();
  expect(state.reopens).toHaveLength(1);
  await edit(page).click();
  await expect(product(page)).toBeVisible();
  expect(state.reopens[1].expected_updated_at).toBe('2026-09-24T09:00:00.987654Z');
  assertIsolated(state);
});

test('failed reopen retains rejection and allows retry without duplicate pending requests', async ({ page }) => {
  const state = await revisionHarness(page);
  state.reopenError = { status: 403, body: { detail: 'Your edit permission was removed.' } };
  await edit(page).click();
  await expect(page.getByRole('alert')).toContainText('Your edit permission was removed.');
  await expect(page.getByRole('region', { name: 'Revise rejected recommendation' })).toContainText(rejectionReason);
  expect(state.record.status).toBe('rejected');
  state.reopenError = null;
  let release;
  state.waitForReopen = new Promise(resolve => { release = resolve; });
  await edit(page).click();
  await expect(page.getByRole('button', { name: 'Opening draft...', exact: true })).toBeDisabled();
  expect(state.reopens).toHaveLength(2);
  release();
  await expect(product(page)).toBeVisible();
  assertIsolated(state);
});

for (const action of ['approve', 'reject']) test(`stale ${action} sends the review token and blocks a previous-round decision`, async ({ page }) => {
  const state = await revisionHarness(page, { signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=', record: {
    status: 'submitted', can_reopen: false, can_approve: true,
    approval_workflow_config: [{ level: 0, role: 'Procurement', user_id: requester.id, user_name: requester.full_name, status: 'pending' }],
    price_remarks_data: { approval_revision_history: [{ round: 1, rejection_reason: rejectionReason }] },
  } });
  const decisions = [];
  await page.route(`**/api/v1/procurement/requisitions/${formRecordId}/process_dynamic_${action === 'approve' ? 'approval' : 'rejection'}/`, async route => {
    decisions.push(route.request().postDataJSON());
    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'stale_requisition', error: 'This approval round changed. Reload the latest version.' }) });
  });
  if (action === 'approve') await page.getByRole('button', { name: 'Approve', exact: true }).click();
  else {
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.getByPlaceholder('Enter a detailed reason for rejecting this purchase requisition...').fill('The corrected delivery scope is still incomplete.');
    await page.getByRole('button', { name: 'Confirm Rejection', exact: true }).click();
  }
  await expect(page.getByRole('alert').filter({ hasText: 'Reload and review' })).toContainText('This approval round changed.');
  expect(decisions).toHaveLength(1);
  expect(decisions[0].expected_updated_at).toBe(originalVersion);
  if (action === 'reject') {
    await expect(page.getByPlaceholder('Enter a detailed reason for rejecting this purchase requisition...')).toHaveValue('The corrected delivery scope is still incomplete.');
    await expect(page.getByRole('button', { name: 'Confirm Rejection', exact: true })).toBeDisabled();
  }
  await expect(page).toHaveURL(new RegExp(`${formRecordId}$`));
  expect(state.record.status).toBe('submitted');
  assertIsolated(state);
});

test('revised drafts preview current content and retain old source separately without signed import', async ({ page }) => {
  const state = await revisionHarness(page, {
    prepare: fixture => { fixture.originalContent['/api/v1/procurement/requisitions/source-fixture.pdf'] = { body: mixedSizePdf(1) }; },
    record: { price_remarks_data: { import_source: 'signed_pr_pdf' }, attachments: [{ type: 'signed_purchase_requisition_pdf', filename: 'previous-round.pdf', url: '/api/v1/procurement/requisitions/source-fixture.pdf' }] },
  });
  await edit(page).click();
  await expect(product(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send for Approval', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Previous round source: previous-round.pdf', exact: true })).toBeVisible();
  await product(page).fill('A revised requirement visible in the current document');
  const preview = page.getByRole('complementary', { name: 'Live purchase recommendation preview', exact: true });
  await expect(preview).toContainText('A revised requirement visible in the current document');
  await page.getByRole('navigation', { name: 'Recommendation steps' }).getByRole('button', { name: /Documents/ }).click();
  await expect(page.getByText('Attach Signed / Approved PR PDF', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Attach supporting documents', { exact: true })).toHaveCount(1);
  await page.goto('/procurement/requisitions');
  await page.getByRole('button', { name: `Actions for ${state.record.pr_number}`, exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Attach signed PDF', exact: true })).toHaveCount(0);
  assertIsolated(state);
});
