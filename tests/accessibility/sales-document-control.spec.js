import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { prepareDocumentControl, classification } from '../fixtures/sales-document-control-api';

const workspace = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const tagEditor = page => page.getByRole('form', { name: 'Custom tag for Technical_Proposal.pdf', exact: true });
const tagInput = page => page.getByRole('textbox', { name: 'Custom tag for Technical_Proposal.pdf', exact: true });
const ai = page => workspace(page).getByRole('button', { name: 'AI classify Technical_Proposal.pdf', exact: true });
const versionDialog = page => page.getByRole('dialog', { name: 'Upload new version', exact: true });
const details = page => page.getByRole('complementary', { name: 'Document details', exact: true });
const preview = page => page.getByRole('dialog', { name: 'File preview', exact: true });
const fileButton = (page, name = 'Technical_Proposal.pdf') => workspace(page).getByRole('button', { name, exact: true });
const row = page => workspace(page).getByRole('table', { name: 'Uploaded files' }).locator('tbody tr');

async function openTag(page) {
  await workspace(page).getByRole('button', { name: /^(Add|Edit) custom tag for Technical_Proposal.pdf$/ }).click();
  await expect(tagInput(page)).toBeEditable();
}
async function chooseRevision(page, bytes) {
  await fileButton(page).click();
  await details(page).getByRole('button', { name: 'Upload new version', exact: true }).click();
  await versionDialog(page).getByLabel('Revision file', { exact: true }).setInputFiles({ name: 'Revised_Proposal.pdf', mimeType: 'application/pdf', buffer: bytes });
  await versionDialog(page).getByRole('textbox', { name: 'Revision note', exact: true }).fill('Clarified engineering deliverables.');
}
async function saveRevision(page) { await versionDialog(page).getByRole('button', { name: 'Upload version', exact: true }).click(); }

test('custom tag saves inline and clears independently of Document Type without a popup', async ({ page }) => {
  const { state, requests } = await prepareDocumentControl(page);
  await expect(workspace(page).getByRole('columnheader', { name: 'Document Type' })).toBeVisible();
  await expect(workspace(page).getByRole('columnheader', { name: 'Custom Tag' })).toBeVisible();
  await expect(row(page)).toContainText('Auto'); await expect(row(page)).toContainText('Technical Proposal');
  await openTag(page); await tagInput(page).fill('Client review copy'); await tagInput(page).press('Enter');
  await expect(tagEditor(page)).toHaveCount(0); await expect(row(page)).toContainText('Client review copy');
  await expect(row(page)).toContainText('Technical Proposal'); await expect(row(page)).toContainText('Auto');
  expect(state.confirmations[0]).toMatchObject({ custom_tag: 'Client review copy', expected_revision: 1 });
  expect(state.confirmations[0]).not.toHaveProperty('document_type');
  await expect(page.getByRole('dialog', { name: 'Document type', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Document type reason' })).toHaveCount(0);
  await workspace(page).getByRole('button', { name: 'Refresh workspace', exact: true }).click();
  await expect(row(page)).toContainText('Client review copy');
  await openTag(page); await tagInput(page).fill(''); await tagInput(page).press('Enter');
  await expect(workspace(page).getByRole('button', { name: 'Add custom tag for Technical_Proposal.pdf' })).toBeVisible();
  expect(state.current.classification.custom_tag).toBe(''); expect(state.current.classification.document_type).toBe('technical_proposal');
  expect(requests.pageErrors).toEqual([]);
});

test('one click on AI queues classification and a later deliberate run gets a new UUID', async ({ page }) => {
  const { state } = await prepareDocumentControl(page);
  await ai(page).click(); await expect(row(page)).toContainText('Queued');
  expect(state.retries).toHaveLength(1); expect(state.current.classification.revision).toBe(1);
  await expect(ai(page)).toBeDisabled(); await expect(preview(page)).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Document type', exact: true })).toHaveCount(0);
  state.current.classification = { ...state.current.classification, status: 'completed', origin: 'ai', can_retry: true };
  await expect(ai(page)).toBeEnabled({ timeout: 12000 }); await expect(row(page)).toContainText('AI suggestion');
  await ai(page).click(); await expect(row(page)).toContainText('Queued'); expect(state.retries).toHaveLength(2);
  expect(state.retries[1].request_id).not.toBe(state.retries[0].request_id);
  expect(state.retries[1].expected_revision).toBe(state.retries[0].expected_revision);
});

test('AI action and completion preserve an inline tag draft and its independently saved value', async ({ page }) => {
  const { state } = await prepareDocumentControl(page);
  await fileButton(page).click(); await openTag(page); await tagInput(page).fill('Reviewed by client');
  await ai(page).click(); await expect(row(page)).toContainText('Queued');
  await expect(tagInput(page)).toHaveValue('Reviewed by client');
  await tagInput(page).press('Enter'); await expect(row(page)).toContainText('Reviewed by client');
  expect(state.confirmations[0].expected_revision).toBe(1);
  state.current.classification = { ...state.current.classification, status: 'completed', origin: 'ai', can_retry: true };
  await expect(row(page)).toContainText('AI suggestion', { timeout: 12000 });
  await expect(row(page)).toContainText('Reviewed by client'); await expect(row(page)).toHaveAttribute('aria-selected', 'true');
});

test('stale tag refresh retains free text for explicit resubmission', async ({ page }) => {
  const { state } = await prepareDocumentControl(page, { saveStatus: 409 });
  await openTag(page); await tagInput(page).fill('Reviewed signed copy'); await tagInput(page).press('Enter');
  await expect(tagEditor(page).getByRole('alert')).toContainText('changed');
  state.saveStatus = 200; state.current.classification = classification({ revision: 2, custom_tag: 'Another reviewer tag' });
  await tagEditor(page).getByRole('button', { name: 'Refresh tag' }).click();
  await expect(tagEditor(page)).toContainText('Your text is kept');
  await expect(tagInput(page)).toHaveValue('Reviewed signed copy'); await tagInput(page).press('Enter');
  await expect(tagEditor(page)).toHaveCount(0); await expect(row(page)).toContainText('Reviewed signed copy');
  expect(state.confirmations[1].expected_revision).toBe(2);
  expect(state.confirmations[1].request_id).not.toBe(state.confirmations[0].request_id);
});

test('permission denial retains custom text and revoked access disables save', async ({ page }) => {
  const { state } = await prepareDocumentControl(page, { saveStatus: 403 });
  await openTag(page); await tagInput(page).fill('Keep this tag'); await tagInput(page).press('Enter');
  await expect(tagEditor(page).getByRole('alert')).toContainText('permission');
  await expect(tagInput(page)).toHaveValue('Keep this tag');
  state.current.classification = classification({ can_edit: false, can_retry: false });
  await tagEditor(page).getByRole('button', { name: 'Refresh tag' }).click();
  await expect(tagEditor(page).getByRole('button', { name: 'Save custom tag for Technical_Proposal.pdf' })).toBeDisabled();
  await expect(tagInput(page)).toHaveValue('Keep this tag'); expect(state.confirmations).toHaveLength(1);
});

test('uncertain tag save retries the identical request without duplicating the human revision', async ({ page }) => {
  const { state } = await prepareDocumentControl(page, { abortSaveOnce: true });
  await openTag(page); await tagInput(page).fill('Engineering review'); await tagInput(page).press('Enter');
  await expect(tagEditor(page).getByRole('alert')).toBeVisible();
  await tagInput(page).press('Enter'); await expect(tagEditor(page)).toHaveCount(0);
  expect(state.confirmations).toHaveLength(2); expect(state.confirmations[1]).toEqual(state.confirmations[0]);
  expect(state.current.classification.revision).toBe(2);
});

test('uncertain one-click AI request retries its existing UUID without another job', async ({ page }) => {
  const { state } = await prepareDocumentControl(page, { abortRetryOnce: true });
  await ai(page).click(); await expect(row(page).getByRole('alert')).toBeVisible();
  await ai(page).click(); await expect(row(page)).toContainText('Queued');
  expect(state.retries).toHaveLength(2); expect(state.retries[1]).toEqual(state.retries[0]);
  expect(state.current.classification.revision).toBe(1);
});

test('failed classification retries inline and stale AI action requires an explicit refresh and click', async ({ page }) => {
  const { state } = await prepareDocumentControl(page, { saveStatus: 409, classification: { status: 'failed', ai_status: 'failed', origin: 'unclassified' } });
  await expect(row(page)).toContainText('Failed'); await ai(page).click();
  await expect(row(page).getByRole('alert')).toContainText('changed');
  state.saveStatus = 200; state.current.classification = classification({ revision: 2 });
  await row(page).getByRole('button', { name: 'Refresh classification' }).click();
  await expect(row(page)).toContainText('Click AI to classify again'); expect(state.retries).toHaveLength(1);
  await ai(page).click(); await expect(row(page)).toContainText('Queued');
  expect(state.retries[1].expected_revision).toBe(2);
});

test('inline control clicks and double clicks never select or preview the file; Escape cancels', async ({ page }) => {
  const { state } = await prepareDocumentControl(page, { classification: { custom_tag: 'Original tag' } });
  await expect(row(page)).toHaveAttribute('aria-selected', 'false');
  await openTag(page); await tagInput(page).fill('<script>safe custom text</script>'); await tagInput(page).dblclick();
  await expect(preview(page)).toHaveCount(0); await expect(row(page)).toHaveAttribute('aria-selected', 'false');
  await tagInput(page).press('Escape'); await expect(row(page)).toContainText('Original tag'); expect(state.confirmations).toHaveLength(0);
  await openTag(page); await tagInput(page).fill('<script>safe custom text</script>');
  await tagEditor(page).getByRole('button', { name: 'Save custom tag for Technical_Proposal.pdf' }).dblclick();
  await expect(row(page)).toContainText('<script>safe custom text</script>');
  await expect(preview(page)).toHaveCount(0); await expect(row(page)).toHaveAttribute('aria-selected', 'false');
  await ai(page).dblclick(); await expect(row(page)).toContainText('Queued');
  await expect(preview(page)).toHaveCount(0); expect(state.retries).toHaveLength(1);
});

test('AI permission denial is inline and read-only rows keep their tag without edit actions', async ({ page }) => {
  const { state } = await prepareDocumentControl(page, { saveStatus: 403, classification: { custom_tag: 'Read-only evidence' } });
  await ai(page).click(); await expect(row(page).getByRole('alert')).toContainText('permission');
  state.current.classification = classification({ can_edit: false, can_retry: false, custom_tag: 'Read-only evidence' });
  await row(page).getByRole('button', { name: 'Refresh classification' }).click();
  await expect(ai(page)).toBeDisabled(); await expect(row(page)).toContainText('Read-only evidence');
  await expect(row(page).getByRole('button', { name: /custom tag/ })).toHaveCount(0);
});

test('new version replaces only the current table row and history previews original bytes', async ({ page }) => {
  const { state, newBytes, first, requests } = await prepareDocumentControl(page, { classification: { custom_tag: 'Client baseline' } });
  await chooseRevision(page, newBytes); await saveRevision(page);
  await expect(versionDialog(page)).not.toBeVisible(); await expect(row(page)).toHaveCount(1);
  await expect(fileButton(page, 'Revised_Proposal.pdf')).toBeVisible(); await expect(row(page)).toContainText('Client baseline');
  await details(page).getByRole('tab', { name: 'Versions', exact: true }).click();
  await expect(details(page)).toContainText('Clarified engineering deliverables.');
  await details(page).getByRole('button', { name: 'Preview version 1', exact: true }).click();
  await expect(preview(page).locator('.sppdf-text-layer')).toContainText('Original controlled proposal', { timeout: 50000 });
  await expect(preview(page)).toContainText('Historical version 1'); expect(state.downloads.at(-1)).toBe(first.id);
  await preview(page).getByRole('button', { name: 'Close preview' }).click();
  const downloaded = page.waitForEvent('download');
  await details(page).getByRole('button', { name: 'Download version 1', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('Technical_Proposal.pdf');
  expect(state.uploads).toHaveLength(1); expect(requests.pageErrors).toEqual([]);
});

test('version upload retains file and note on storage failure and cancel, then retries same UUID', async ({ page }) => {
  const { state, newBytes } = await prepareDocumentControl(page, { uploadStatus: 503 });
  await chooseRevision(page, newBytes); await saveRevision(page);
  await expect(versionDialog(page).getByRole('alert')).toContainText('temporarily unavailable');
  await versionDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await details(page).getByRole('button', { name: 'Upload new version', exact: true }).click();
  await expect(versionDialog(page)).toContainText('Selected: Revised_Proposal.pdf');
  await expect(versionDialog(page).getByRole('textbox', { name: 'Revision note' })).toHaveValue('Clarified engineering deliverables.');
  state.uploadStatus = 201; await saveRevision(page); await expect(versionDialog(page)).not.toBeVisible();
  expect(state.uploads[1].requestId).toBe(state.uploads[0].requestId);
});

test('stale version refresh retains the file and note and uses the reviewed new head token', async ({ page }) => {
  const { state, newBytes } = await prepareDocumentControl(page, { uploadStatus: 409 });
  await chooseRevision(page, newBytes); await saveRevision(page);
  await expect(versionDialog(page).getByRole('alert')).toContainText('changed');
  state.current.head_token = 'head-changed'; state.uploadStatus = 201;
  await versionDialog(page).getByRole('button', { name: 'Refresh current version' }).click();
  await expect(versionDialog(page)).toContainText('Your file and note are kept');
  await expect(versionDialog(page)).toContainText('Selected: Revised_Proposal.pdf');
  await saveRevision(page); await expect(versionDialog(page)).not.toBeVisible();
  expect(state.uploads[1].token).toBe('head-changed'); expect(state.uploads[1].note).toBe(state.uploads[0].note);
  expect(state.uploads[1].requestId).not.toBe(state.uploads[0].requestId);
});

test('uncertain committed version retries the same UUID and creates only one revision', async ({ page }) => {
  const { state, newBytes, versions } = await prepareDocumentControl(page, { abortUploadOnce: true });
  await chooseRevision(page, newBytes); await saveRevision(page);
  await expect(versionDialog(page).getByRole('alert')).toBeVisible(); await saveRevision(page);
  await expect(versionDialog(page)).not.toBeVisible(); expect(versions).toHaveLength(2);
  expect(state.uploads[1].requestId).toBe(state.uploads[0].requestId); await expect(row(page)).toHaveCount(1);
});

test('version access denial retains input and historical preview denies fresh bytes', async ({ page }) => {
  const { state, newBytes } = await prepareDocumentControl(page, { uploadStatus: 403 });
  await chooseRevision(page, newBytes); await saveRevision(page);
  await expect(versionDialog(page).getByRole('alert')).toContainText('permission');
  await expect(versionDialog(page).getByRole('textbox', { name: 'Revision note' })).toHaveValue('Clarified engineering deliverables.');
  state.canUpload = false;
  await versionDialog(page).getByRole('button', { name: 'Refresh current version' }).click();
  await expect(versionDialog(page).getByRole('button', { name: 'Upload version', exact: true })).toBeDisabled();
  await versionDialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  state.downloadStatus = 403;
  await details(page).getByRole('button', { name: 'Preview version 1', exact: true }).click();
  await expect(preview(page).getByRole('alert')).toContainText('permission');
  await expect(preview(page).locator('canvas')).toHaveCount(0);
});

test('late classification completion cannot replace the next folder files', async ({ page }) => {
  let release; const held = new Promise(resolve => { release = resolve; });
  const { state } = await prepareDocumentControl(page, { classification: { status: 'queued' }, typeHold: held });
  await expect.poll(() => state.classificationReads.length, { timeout: 12000 }).toBeGreaterThan(0);
  await workspace(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  state.current.classification = classification({ origin: 'confirmed', revision: 4 }); release();
  await expect(row(page)).toHaveCount(0); await expect(workspace(page)).not.toContainText('Technical Proposal');
});

for (const [name, viewport] of [['desktop', { width: 1586, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`actual application shell exposes accessible type and version controls on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const { newBytes } = await prepareDocumentControl(page, { realShell: true, classification: { origin: 'ai' } });
    await fileButton(page).click(); await expect(details(page).getByRole('button', { name: 'Upload new version', exact: true })).toBeEnabled();
    const outer = await new AxeBuilder({ page }).include('.sow-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(outer.violations).toEqual([]);
    await mkdir('artifacts/sales-document-inline', { recursive: true });
    await page.screenshot({ path: `artifacts/sales-document-inline/document-types-${name}.png`, fullPage: true });
    await openTag(page); await tagInput(page).fill('Client review copy');
    const inline = await new AxeBuilder({ page }).include('.sow-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(inline.violations).toEqual([]);
    await page.screenshot({ path: `artifacts/sales-document-inline/inline-tag-${name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await tagInput(page).press('Escape');
    await chooseRevision(page, newBytes);
    const versionAudit = await new AxeBuilder({ page }).include('.sdc-version-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(versionAudit.violations).toEqual([]);
    await page.screenshot({ path: `artifacts/sales-document-inline/version-upload-${name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
