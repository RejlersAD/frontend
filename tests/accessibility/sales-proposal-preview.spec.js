import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareProposalReview, currentDocumentId, olderDocumentId } from '../fixtures/sales-proposal-review-api';

const pdf = page => page.getByRole('region', { name: 'Proposal PDF pages' });
const review = page => page.getByRole('complementary', { name: 'Proposal review comments' });
const mainCanvas = page => page.locator('.sppdf-raster-host canvas');
async function ready(page) {
  await expect(mainCanvas(page)).toBeVisible({ timeout: 50000 });
  await expect(page.getByLabel('Page number', { exact: true })).toHaveValue('1');
}

test('reference layout uses real PDF, selected text anchors and the existing application shell', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const state = await prepareProposalReview(page);
  await ready(page);
  await pdf(page).getByRole('button', { name: 'Go to page 2', exact: true }).click();
  await expect(page.getByLabel('Page number', { exact: true })).toHaveValue('2');
  await expect(page.locator('.sppdf-text-layer')).toContainText('Scope of services');
  await review(page).getByRole('button', { name: 'Go to comment 1', exact: true }).click();
  await expect(review(page)).toContainText('civil / structural engineering');
  await expect(review(page).getByRole('tab', { name: /^Open/ })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: testInfo.outputPath('proposal-review-reference-1586.png'), fullPage: true });
  await review(page).locator('article').filter({ hasText: 'civil / structural engineering' }).getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Reply to Engineering lead', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('proposal-review-reply-1586.png'), fullPage: true });
  const geometry = await page.evaluate(() => {
    const boxes = ['.spr-page', '.sppdf-navigation', '.spr-review'].map(selector => {
      const node = document.querySelector(selector); return node ? { selector, width: node.getBoundingClientRect().width } : { selector };
    });
    return { width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, boxes,
      font: getComputedStyle(document.querySelector('.spr-page')).fontFamily };
  });
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.font).toContain('Sales Proposal Roboto');
  expect(geometry.boxes.find(item => item.selector === '.spr-review').width).toBeGreaterThanOrEqual(380);
  const axe = await new AxeBuilder({ page }).include('.spr-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('proposal register opens the PDF review and returns to the selected proposal', async ({ page }) => {
  const state = await prepareProposalReview(page, { entry: '/sales/proposals' });
  await page.getByLabel('Selected proposal', { exact: true }).getByRole('tab', { name: 'Documents', exact: true }).click();
  await page.getByRole('link', { name: 'Preview & comment', exact: true }).first().click();
  await ready(page);
  await expect(page.getByRole('heading', { name: 'FEED Engineering Services', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to proposals', exact: true }).click();
  const record = page.getByLabel('Selected proposal', { exact: true });
  await expect(record).toBeVisible();
  await expect(record).toContainText('FEED Engineering Services');
  await record.getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(record.getByRole('link', { name: 'Preview & comment', exact: true }).first()).toHaveAttribute('href', '/sales/proposals/proposal-one/preview');
  expect(state.pageErrors).toEqual([]);
});

test('real outline and thumbnails navigate pages and zoom without fetching another source', async ({ page }) => {
  const state = await prepareProposalReview(page);
  await ready(page);
  await pdf(page).getByRole('tab', { name: 'Outline', exact: true }).click();
  await pdf(page).getByRole('button', { name: /Scope of services/ }).click();
  await expect(page.getByLabel('Page number', { exact: true })).toHaveValue('2');
  await expect(page.locator('.sppdf-text-layer')).toContainText('Engineering scope');
  const before = await mainCanvas(page).evaluate(canvas => canvas.getBoundingClientRect().width);
  await page.getByLabel('PDF zoom', { exact: true }).selectOption('1.25');
  await expect.poll(async () => mainCanvas(page).evaluate(canvas => canvas.getBoundingClientRect().width)).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Fit PDF width', exact: true }).click();
  await expect(page.getByLabel('PDF zoom', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByLabel('Page number', { exact: true })).toHaveValue('3');
  expect(state.requests.filter(item => item.path.endsWith('/content/'))).toHaveLength(1);
  expect(state.pageErrors).toEqual([]);
});

test('historical revision shows its own discussion and cannot create new feedback', async ({ page }) => {
  const state = await prepareProposalReview(page);
  await ready(page);
  await page.getByLabel('Add a comment', { exact: true }).fill('Keep my current revision draft');
  await page.getByLabel('Document revision', { exact: true }).selectOption(olderDocumentId);
  await expect(review(page)).toContainText('Earlier revisions are read-only');
  await expect(page.getByRole('button', { name: 'Add comment', exact: true })).toBeDisabled();
  await expect(review(page)).not.toContainText('civil / structural engineering');
  await page.getByLabel('Document revision', { exact: true }).selectOption(currentDocumentId);
  await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue('Keep my current revision draft');
  expect(state.mutations).toEqual([]);
});

test('comment retry preserves text, document, version and request identity', async ({ page }) => {
  const state = await prepareProposalReview(page, { mutationStatuses: { comment: [503, 200] } });
  await ready(page);
  await page.getByRole('button', { name: 'Add comment', exact: true }).click();
  await page.getByLabel('Add a comment', { exact: true }).fill('Please confirm the mechanical interfaces.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(review(page).getByRole('alert')).toContainText('input is retained');
  await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue('Please confirm the mechanical interfaces.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(review(page)).toContainText('Comment saved.');
  await expect(page.getByLabel('Add a comment', { exact: true })).toBeEmpty();
  expect(state.mutations).toHaveLength(2);
  expect(state.mutations[0].body).toEqual(state.mutations[1].body);
  expect(state.mutations[0].path).toContain(currentDocumentId);
  expect(state.mutations[0].body.page_number).toBe(1);
});

test('stale review refresh retains draft and uses the refreshed version', async ({ page }) => {
  const state = await prepareProposalReview(page, { mutationStatuses: { comment: [409, 200] } });
  await ready(page);
  await page.getByLabel('Add a comment', { exact: true }).fill('Keep this comment through a concurrent change.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh review, keep my draft' })).toBeVisible();
  state.documents[0].feedback_version = 4;
  await page.getByRole('button', { name: 'Refresh review, keep my draft' }).click();
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue('Keep this comment through a concurrent change.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(review(page)).toContainText('Comment saved.');
  expect(state.mutations[1].body.expected_version).toBe(4);
  expect(state.mutations[1].body.request_id).not.toBe(state.mutations[0].body.request_id);
});

test('replies, resolved filtering and review submission persist without approval or client submission', async ({ page }) => {
  const state = await prepareProposalReview(page);
  await ready(page);
  const thread = review(page).locator('article').filter({ hasText: 'civil / structural engineering' });
  await thread.getByRole('button', { name: 'Reply', exact: true }).click();
  await page.getByRole('textbox', { name: /Reply to/ }).fill('Civil engineering is included in the revised scope.');
  await page.getByRole('button', { name: 'Post reply', exact: true }).click();
  await expect(review(page)).toContainText('Civil engineering is included in the revised scope.');
  await thread.getByRole('button', { name: 'Resolve', exact: true }).click();
  await expect(review(page)).toContainText('Comment resolved.');
  await review(page).getByRole('tab', { name: /^Resolved/ }).click();
  await expect(review(page)).toContainText('civil / structural engineering');
  await page.getByLabel('Review decision', { exact: true }).selectOption('request_changes');
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(review(page)).toContainText('Internal review submitted.');
  expect(state.submissions).toHaveLength(1);
  expect(state.submissions[0].outcome).toBe('request_changes');
  expect(state.quote.status).toBe('internal_review');
  expect(state.requests.some(item => /\/(approve|send_to_client)\/$/.test(item.path))).toBe(false);
});

test('server capability denial blocks forced comment submission and original download', async ({ page }) => {
  const state = await prepareProposalReview(page, { capabilities: { can_preview: false, can_download: false, can_bind: false,
    can_comment: false, can_resolve: false, can_submit: false, deny_reason: 'You have read-only access to this review.' } });
  await expect(page.getByRole('heading', { name: 'PDF preview unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add comment', exact: true })).toBeDisabled();
  await page.locator('.spr-composer').evaluate(form => form.requestSubmit());
  expect(state.mutations).toEqual([]);
  expect(state.requests.some(item => item.path.endsWith('/content/'))).toBe(false);
});

test('empty proposal can upload with no fixed size cap and bind a private PDF with retained retry', async ({ page }) => {
  const state = await prepareProposalReview(page, { documents: [], maxUploadBytes: null, mutationStatuses: { bind: [503, 200] } });
  await expect(page.getByRole('heading', { name: 'No proposal PDF selected' })).toBeVisible();
  await page.getByRole('button', { name: 'Select PDF', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Select proposal PDF' });
  await dialog.getByLabel('PDF source', { exact: true }).selectOption('upload');
  await dialog.getByLabel('PDF file', { exact: true }).setInputFiles({ name: 'Uploaded_review.pdf', mimeType: 'application/pdf', buffer: state.pdf });
  await dialog.getByRole('button', { name: 'Use this PDF', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('input is retained');
  await expect(dialog).toContainText('Uploaded_review.pdf');
  await dialog.getByRole('button', { name: 'Use this PDF', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(mainCanvas(page)).toBeVisible({ timeout: 25000 });
  expect(state.uploads).toHaveLength(1);
  expect(state.mutations).toHaveLength(2);
  expect(state.mutations[0].body).toEqual(state.mutations[1].body);
  expect(state.mutations[0].body.expected_document_id).toBeNull();
  expect(state.requests.some(item => item.path.endsWith('/setup/'))).toBe(false);
});

test('proposal upload preserves the selected PDF when a configured size cap rejects it', async ({ page }) => {
  const state = await prepareProposalReview(page, { documents: [], maxUploadBytes: 10 });
  await page.getByRole('button', { name: 'Select PDF', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Select proposal PDF' });
  await dialog.getByLabel('PDF source', { exact: true }).selectOption('upload');
  await dialog.getByLabel('PDF file', { exact: true }).setInputFiles({ name: 'Retained.pdf', mimeType: 'application/pdf', buffer: state.pdf });
  await dialog.getByRole('button', { name: 'Use this PDF', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('larger than the permitted upload size');
  await expect(dialog).toContainText('Retained.pdf');
  expect(state.uploads).toHaveLength(0);
  expect(state.mutations).toHaveLength(0);
});

test('original download uses authenticated content and the server filename', async ({ page }) => {
  const state = await prepareProposalReview(page);
  await ready(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('Proposal_Review_Rev02.pdf');
  expect(state.requests.filter(item => item.path.endsWith('/download/'))).toHaveLength(1);
  expect(state.mutations).toEqual([]);
});

test('PDF failure keeps comments readable and offers a successful retry', async ({ page }) => {
  const state = await prepareProposalReview(page, { contentStatus: 503 });
  await expect(page.getByRole('button', { name: 'Retry PDF', exact: true })).toBeVisible();
  await expect(review(page)).toContainText('civil / structural engineering');
  state.contentStatus = 200;
  await page.getByRole('button', { name: 'Retry PDF', exact: true }).click();
  await expect(mainCanvas(page)).toBeVisible({ timeout: 25000 });
  expect(state.mutations).toEqual([]);
});

test('actual PDF text selection creates a normalized page anchor that survives zoom', async ({ page }) => {
  const state = await prepareProposalReview(page);
  await ready(page);
  await pdf(page).getByRole('button', { name: 'Go to page 2', exact: true }).click();
  const selectScope = async () => {
    const span = page.locator('.sppdf-text-layer span').filter({ hasText: 'The services include process, piping, electrical' }).first();
    await expect(span).toBeAttached();
    await span.evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      node.closest('.sppdf-paper').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    await expect(page.locator('.spr-composer-anchor')).toContainText('The services include process');
  };
  await selectScope();
  const initialWidth = await mainCanvas(page).evaluate(canvas => canvas.getBoundingClientRect().width);
  await page.getByLabel('PDF zoom', { exact: true }).selectOption('1.5');
  await expect.poll(() => mainCanvas(page).evaluate(canvas => canvas.getBoundingClientRect().width)).toBeGreaterThan(initialWidth * 1.2);
  await selectScope();
  await page.getByLabel('Add a comment', { exact: true }).fill('Review this selected engineering scope.');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(review(page)).toContainText('Comment saved.');
  const payload = state.mutations[0].body;
  expect(payload.page_number).toBe(2);
  expect(payload.anchor.quote).toContain('The services include process');
  expect(payload.anchor.rects.length).toBeGreaterThan(0);
  for (const rectangle of payload.anchor.rects) {
    expect(rectangle.x).toBeGreaterThanOrEqual(0); expect(rectangle.y).toBeGreaterThanOrEqual(0);
    expect(rectangle.width).toBeGreaterThan(0); expect(rectangle.height).toBeGreaterThan(0);
    expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(1.000001);
    expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(1.000001);
  }
});

test('late old-revision PDF cannot replace the current document', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const state = await prepareProposalReview(page, { contentHolds: { [olderDocumentId]: hold } });
  await ready(page);
  await page.getByLabel('Document revision', { exact: true }).selectOption(olderDocumentId);
  await expect.poll(() => state.requests.some(item => item.path.includes(olderDocumentId) && item.path.endsWith('/content/'))).toBe(true);
  await page.getByLabel('Document revision', { exact: true }).selectOption(currentDocumentId);
  release();
  await expect(mainCanvas(page)).toBeVisible({ timeout: 25000 });
  await expect(page.getByLabel('Document revision', { exact: true })).toHaveValue(currentDocumentId);
  await expect(review(page)).toContainText('civil / structural engineering');
  expect(state.mutations).toEqual([]);
});

test('revoked review access clears displayed evidence and retry restores the retained draft', async ({ page }) => {
  const state = await prepareProposalReview(page, { mutationStatuses: { comment: [403] } });
  await ready(page);
  await page.getByLabel('Add a comment', { exact: true }).fill('Retain this draft while access is checked.');
  state.reviewStatus = 403;
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry review', exact: true })).toBeVisible();
  await expect(mainCanvas(page)).toHaveCount(0);
  await expect(review(page)).not.toContainText('civil / structural engineering');
  state.reviewStatus = 200;
  await page.getByRole('button', { name: 'Retry review', exact: true }).click();
  await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue('Retain this draft while access is checked.');
  expect(state.mutations).toHaveLength(1);
});

for (const width of [1366, 390]) test(`proposal review remains usable without document overflow at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const state = await prepareProposalReview(page);
  await expect(mainCanvas(page)).toBeAttached({ timeout: 30000 });
  await expect(review(page).getByRole('heading', { name: 'Review comments' })).toBeAttached();
  const bounds = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
  await page.screenshot({ path: testInfo.outputPath(`proposal-review-${width}.png`), fullPage: true });
  if (width === 390) {
    await review(page).getByRole('heading', { name: 'Review comments' }).scrollIntoViewIfNeeded();
    await expect(review(page).getByRole('heading', { name: 'Review comments' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit review', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Submit review', exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('proposal-review-mobile-comments.png'), fullPage: true });
  }
  expect(state.pageErrors).toEqual([]);
});
