import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { prepareOpportunityPreview } from '../fixtures/sales-opportunity-preview-api';
import { proposalReviewPdf } from '../fixtures/sales-proposal-pdf.fixture';

const workspace = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const preview = page => page.getByRole('dialog', { name: 'File preview', exact: true });
const details = page => page.getByRole('complementary', { name: 'Document details', exact: true });
const filename = (page, name = 'Engineering_scope.pdf') => workspace(page).getByRole('button', { name, exact: true });
const canvas = page => preview(page).locator('.sppdf-raster-host canvas');
const close = page => preview(page).getByRole('button', { name: 'Close preview', exact: true }).click();

async function rendered(page, name = 'Engineering_scope.pdf', title = 'Engineering scope fixture', pages = 3) {
  await expect(preview(page)).toBeVisible();
  await expect(preview(page).getByRole('region', { name: 'File PDF pages', exact: true })).toBeVisible();
  await expect(canvas(page)).toBeVisible({ timeout: 50000 });
  await expect(canvas(page)).toHaveAttribute('aria-label', `${name}, page 1 of ${pages}`);
  await expect(preview(page).locator('.sppdf-text-layer')).toContainText(title);
  expect(await canvas(page).evaluate(element => element.width > 0 && element.height > 0)).toBe(true);
}

test('double-clicking a file row or filename renders actual protected PDF bytes', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  const fileRow = workspace(page).getByRole('row').filter({ has: page.getByRole('button', { name: 'Engineering_scope.pdf', exact: true }) });
  await fileRow.getByRole('cell').nth(3).dblclick(); // Version cell; inline classification/tag controls have their own actions.
  await rendered(page);
  await preview(page).getByRole('button', { name: 'Go to page 2', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('aria-label', 'Engineering_scope.pdf, page 2 of 3');
  await expect(preview(page).locator('.sppdf-text-layer')).toContainText('Scope of services');
  expect(fixture.downloads.map(item => item.id)).toEqual([fixture.file('first').id]);
  await close(page);
  await filename(page).dblclick();
  await rendered(page);
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('keyboard and explicit Preview preserve selected file and filter after closing', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  const search = workspace(page).getByRole('textbox', { name: 'Search loaded files', exact: true });
  await search.fill('Engineering');
  await filename(page).click();
  await expect(details(page).getByRole('button', { name: 'Preview', exact: true })).toBeEnabled();
  await expect(preview(page)).not.toBeVisible();
  expect(fixture.downloads).toHaveLength(0);
  await filename(page).focus();
  await filename(page).press('Enter');
  await rendered(page);
  await preview(page).press('Escape');
  await expect(preview(page)).not.toBeVisible();
  await expect(filename(page)).toBeFocused();
  await expect(search).toHaveValue('Engineering');
  await expect(workspace(page).getByRole('row').filter({ has: page.getByRole('button', { name: 'Engineering_scope.pdf', exact: true }) })).toHaveAttribute('aria-selected', 'true');
  await details(page).getByRole('button', { name: 'Preview', exact: true }).click();
  await rendered(page);
  await close(page);
  await expect(details(page).getByRole('button', { name: 'Preview', exact: true })).toBeFocused();
  await expect(search).toHaveValue('Engineering');
  expect(state.pageErrors).toEqual([]);
});

test('missing export permission blocks preview bytes and keeps the selected file readable', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  fixture.detailPatches[fixture.file('first').id] = { can_download: false };
  await filename(page).click();
  await expect(details(page).getByRole('button', { name: 'Preview', exact: true })).toBeDisabled();
  await filename(page).dblclick();
  await expect(preview(page)).toContainText(/permission|access|unavailable/i);
  await expect(canvas(page)).toHaveCount(0);
  expect(fixture.downloads).toHaveLength(0);
  await close(page);
  await expect(details(page)).toContainText('Engineering_scope.pdf');
  expect(state.pageErrors).toEqual([]);
});

test('denied bytes cannot become a preview and an explicit retry can recover access', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  fixture.downloadStatuses[fixture.file('first').id] = 403;
  await filename(page).dblclick();
  await expect(preview(page).getByRole('alert')).toContainText(/permission|access/i);
  await expect(canvas(page)).toHaveCount(0);
  fixture.downloadStatuses[fixture.file('first').id] = 200;
  await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await rendered(page);
  expect(fixture.downloads.map(item => item.id)).toEqual([fixture.file('first').id, fixture.file('first').id]);
  expect(state.pageErrors).toEqual([]);
});

test('revoked download access clears an already rendered PDF until preview is explicitly retried', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  await filename(page).dblclick();
  await rendered(page);
  fixture.downloadStatuses[fixture.file('first').id] = 403;
  await preview(page).getByRole('button', { name: 'Download', exact: true }).click();
  await expect(preview(page).getByRole('alert')).toContainText(/permission|access/i);
  await expect(canvas(page)).toHaveCount(0);
  await expect(preview(page).getByRole('region', { name: 'File PDF pages', exact: true })).toHaveCount(0);
  await expect(preview(page).getByRole('button', { name: 'Download', exact: true })).toBeDisabled();
  fixture.downloadStatuses[fixture.file('first').id] = 200;
  await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await rendered(page);
  expect(fixture.downloads.map(item => item.id)).toEqual(Array(3).fill(fixture.file('first').id));
  expect(state.pageErrors).toEqual([]);
});

test('failed preview transfer retains the file and retries the same scoped download', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  fixture.downloadStatuses[fixture.file('first').id] = 503;
  await filename(page).dblclick();
  await expect(preview(page).getByRole('alert')).toContainText('temporarily unavailable');
  await expect(preview(page)).toContainText('Engineering_scope.pdf');
  fixture.downloadStatuses[fixture.file('first').id] = 200;
  await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await rendered(page);
  expect(fixture.downloads.map(item => item.path)).toEqual(Array(2).fill(`/api/v1/sales/deals/opportunity-0/workspace/folders/proposal/files/${fixture.file('first').id}/download/`));
  expect(state.pageErrors).toEqual([]);
});

test('unsupported active content is not fetched automatically or executed', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  await filename(page, 'Client_page.html').dblclick();
  await expect(preview(page)).toContainText(/not supported|not available|unsupported/i);
  expect(fixture.downloads).toHaveLength(0);
  await expect(preview(page).locator('iframe, object, embed')).toHaveCount(0);
  expect(await page.evaluate(() => window.previewContentExecuted)).toBeUndefined();
  const download = page.waitForEvent('download');
  await preview(page).getByRole('button', { name: 'Download', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('Client_page.html');
  expect(fixture.downloads.map(item => item.id)).toEqual([fixture.file('active').id]);
  expect(await page.evaluate(() => window.previewContentExecuted)).toBeUndefined();
  expect(state.pageErrors).toEqual([]);
});

test('plain text stays literal and a supported raster image renders safely', async ({ page }) => {
  const { state } = await prepareOpportunityPreview(page);
  await filename(page, 'Review_notes.txt').dblclick();
  await expect(preview(page)).toContainText('<script>window.previewContentExecuted = true</script>');
  expect(await page.evaluate(() => window.previewContentExecuted)).toBeUndefined();
  await expect(preview(page).locator('script, iframe, object, embed')).toHaveCount(0);
  await close(page);
  await filename(page, 'Site_diagram.png').dblclick();
  const image = preview(page).getByRole('img', { name: 'Preview of Site_diagram.png', exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
  expect(state.pageErrors).toEqual([]);
});

test('invalid PDF bytes show a usable error and can be replaced on explicit retry', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  fixture.bytes[fixture.file('first').id] = Buffer.from('%PDF-1.4\nThis file has no pages or cross-reference table.');
  await filename(page).dblclick();
  await expect(preview(page).getByRole('button', { name: 'Retry preview', exact: true })).toBeVisible({ timeout: 50000 });
  await expect(canvas(page)).toHaveCount(0);
  delete fixture.bytes[fixture.file('first').id];
  await preview(page).getByRole('button', { name: 'Retry preview', exact: true }).click();
  await rendered(page);
  expect(state.pageErrors).toEqual([]);
});

test('metadata from another folder cannot authorize downloading preview bytes', async ({ page }) => {
  const { fixture, state } = await prepareOpportunityPreview(page);
  fixture.detailPatches[fixture.file('first').id] = { folder_key: 'award' };
  await filename(page).dblclick();
  await expect(preview(page).getByRole('alert')).toContainText(/verified|unavailable|match/i);
  await expect(canvas(page)).toHaveCount(0);
  expect(fixture.downloads).toHaveLength(0);
  expect(state.pageErrors).toEqual([]);
});

test('closing a pending preview and switching files cannot render the late old PDF', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { fixture, state } = await prepareOpportunityPreview(page);
  fixture.downloadHolds[fixture.file('first').id] = hold;
  await filename(page).dblclick();
  await expect.poll(() => fixture.downloads.length).toBe(1);
  await close(page);
  await expect.poll(() => fixture.abortedDownloads.includes(fixture.file('first').id)).toBe(true);
  await filename(page, 'Updated_scope.pdf').dblclick();
  await rendered(page, 'Updated_scope.pdf', 'Updated scope fixture', 2);
  release();
  await expect(preview(page).locator('.sppdf-text-layer')).toContainText('Updated scope fixture');
  await expect(preview(page).locator('.sppdf-text-layer')).not.toContainText('Engineering scope fixture');
  expect(state.pageErrors).toEqual([]);
});

test('folder navigation after closing a pending preview clears its old file context', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { fixture, state } = await prepareOpportunityPreview(page);
  fixture.downloadHolds[fixture.file('first').id] = hold;
  await filename(page).dblclick();
  await expect.poll(() => fixture.downloads.length).toBe(1);
  await preview(page).press('Escape');
  await expect.poll(() => fixture.abortedDownloads.includes(fixture.file('first').id)).toBe(true);
  await workspace(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  release();
  await expect(preview(page)).not.toBeVisible();
  await expect(details(page)).toContainText('Select a document');
  await expect(workspace(page)).toContainText('No files in this folder yet.');
  expect(state.pageErrors).toEqual([]);
});

test('provider switch cannot replace its new preview with a late private response', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { fixture, state } = await prepareOpportunityPreview(page, { sharepointReady: true });
  fixture.downloadHolds[fixture.file('first').id] = hold;
  fixture.bytes[fixture.file('first', 'sharepoint').id] = proposalReviewPdf({ title: 'SharePoint source fixture', pages: 3 });
  await filename(page).dblclick();
  await expect.poll(() => fixture.downloads.length).toBe(1);
  await close(page);
  await expect.poll(() => fixture.abortedDownloads.includes(fixture.file('first').id)).toBe(true);
  await workspace(page).getByRole('combobox', { name: 'Document storage', exact: true }).selectOption('sharepoint');
  await filename(page).dblclick();
  await rendered(page, 'Engineering_scope.pdf', 'SharePoint source fixture');
  release();
  await expect(preview(page).locator('.sppdf-text-layer')).toContainText('SharePoint source fixture');
  expect(fixture.downloads.map(item => item.id)).toEqual([fixture.file('first').id, fixture.file('first', 'sharepoint').id]);
  expect(state.pageErrors).toEqual([]);
});

test('actual application shell shows an accessible PDF preview on desktop and mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const { state } = await prepareOpportunityPreview(page, { realShell: true });
  await filename(page).dblclick();
  await rendered(page);
  await expect(preview(page).getByRole('button', { name: 'Close preview', exact: true })).toBeInViewport();
  const bounds = await preview(page).boundingBox();
  expect(Math.abs(bounds.x + bounds.width / 2 - 793)).toBeLessThan(2);
  await page.screenshot({ path: testInfo.outputPath('file-preview-desktop.png'), fullPage: true });
  const desktopAudit = await new AxeBuilder({ page }).include('[aria-label="File preview"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(desktopAudit.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas(page)).toBeVisible();
  await expect(preview(page).getByRole('button', { name: 'Close preview', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('file-preview-mobile.png'), fullPage: true });
  const mobileAudit = await new AxeBuilder({ page }).include('[aria-label="File preview"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(mobileAudit.violations).toEqual([]);
  await close(page);
  await expect(details(page)).toContainText('Engineering_scope.pdf');
  expect(state.pageErrors).toEqual([]);
});
