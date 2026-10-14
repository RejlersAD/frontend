import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareProposalRegister, proposalRegisterId, proposalRegisterRow } from '../fixtures/sales-proposal-register-api';

const register = page => page.getByRole('region', { name: 'Proposal register', exact: true });
const selected = page => page.getByLabel('Selected proposal', { exact: true });
const selectRow = (page, index) => register(page).getByRole('button', {
  name: `Select proposal ${proposalRegisterRow(index).quote_number} revision ${proposalRegisterRow(index).version}`, exact: true,
});
const recordRows = page => register(page).locator('tbody tr').filter({ has: page.getByRole('button', { name: /^Select proposal / }) });
const dialog = (page, name) => page.getByRole('dialog', { name, exact: true });

async function ready(page) {
  await expect(recordRows(page)).toHaveCount(6);
  await expect(selected(page)).toContainText('FEED Engineering Services');
  await expect(selected(page).getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
  await expect(selected(page)).toContainText('Technical_Proposal.pdf');
}

test('reference register uses real shell, six readable rows and balanced selected workspace', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  const state = await prepareProposalRegister(page);
  await ready(page);
  await expect(register(page).getByRole('tab', { name: 'All', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(register(page)).toContainText('1–6 of 6');
  await expect(selected(page).getByRole('tab', { name: 'Summary', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: testInfo.outputPath('proposal-register-reference-1586.png'), fullPage: true });
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const node = document.querySelector(selector), rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    const reg = document.querySelector('[aria-label="Proposal register"]');
    const cell = reg.querySelector('tbody td');
    const rowButton = reg.querySelector('tbody button');
    const pageBox = box('.spg-page');
    return { main: box('main.main-content'), page: pageBox, register: box('[aria-label="Proposal register"]'),
      workspace: box('[aria-label="Selected proposal"]'), header: box('header:has(nav[aria-label="Primary navigation"])'),
      notice: box('.spg-workspace-content .spg-notice'), footer: box('.spg-workspace-footer'),
      codeClipped: [...reg.querySelectorAll('tbody .spg-col-code span')].some(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        const cell = node.closest('td'), style = getComputedStyle(cell);
        return range.getBoundingClientRect().width > cell.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) + 1;
      }),
      rowHeights: [...reg.querySelectorAll('tbody tr')].map(row => row.getBoundingClientRect().height),
      codeFont: getComputedStyle(cell).fontSize,
      cellFont: getComputedStyle(reg.querySelector('tbody .spg-col-deadline')).fontSize,
      rowFont: getComputedStyle(rowButton).fontSize,
      family: getComputedStyle(document.querySelector('.spg-page')).fontFamily,
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.header.height).toBe(56);
  expect(geometry.main.x).toBeGreaterThanOrEqual(249);
  expect(geometry.main.x).toBeLessThanOrEqual(251);
  expect(geometry.workspace.width / geometry.register.width).toBeGreaterThan(.93);
  expect(geometry.workspace.width / geometry.register.width).toBeLessThan(1.08);
  for (const height of geometry.rowHeights) expect(height).toBeGreaterThanOrEqual(65);
  for (const height of geometry.rowHeights) expect(height).toBeLessThanOrEqual(70);
  expect(geometry.cellFont).toBe('14px');
  expect(geometry.codeFont).toBe('16px');
  expect(geometry.rowFont).toBe('16px');
  expect(geometry.family).toContain('Roboto');
  expect(geometry.register.bottom).toBeLessThanOrEqual(992);
  expect(geometry.workspace.bottom).toBeLessThanOrEqual(992);
  expect(geometry.notice.bottom).toBeLessThanOrEqual(geometry.footer.y);
  expect(geometry.codeClipped).toBe(false);
  const accessibility = await new AxeBuilder({ page }).include('.spg-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('status, owner and text filters use all paginated API rows and reset predictably', async ({ page }) => {
  const state = await prepareProposalRegister(page);
  await ready(page);
  expect(state.requests.filter(item => item.path.endsWith('/quotes/') && item.method === 'GET').length).toBeGreaterThanOrEqual(2);
  await register(page).getByRole('tab', { name: 'Draft', exact: true }).click();
  await expect(recordRows(page)).toHaveCount(2);
  await register(page).getByRole('tab', { name: 'In review', exact: true }).click();
  await expect(recordRows(page)).toHaveCount(2);
  await register(page).getByRole('tab', { name: 'Approved', exact: true }).click();
  await expect(recordRows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Piping Stress Analysis');
  await register(page).getByRole('tab', { name: 'All', exact: true }).click();
  await register(page).getByRole('combobox', { name: 'Owner', exact: true }).selectOption('12');
  await expect(recordRows(page)).toHaveCount(3);
  await register(page).getByLabel('Search proposals', { exact: true }).fill('Instrumentation');
  await expect(recordRows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Instrumentation Upgrade');
  await register(page).getByLabel('Search proposals', { exact: true }).fill('no such proposal');
  await expect(recordRows(page)).toHaveCount(0);
  expect(state.mutations).toEqual([]);
});

test('paging, sorting and column selection retain stable proposal identity', async ({ page }) => {
  await prepareProposalRegister(page, { rows: Array.from({ length: 13 }, (_, index) => proposalRegisterRow(index)) });
  await register(page).getByLabel('Columns', { exact: true }).click();
  await register(page).getByLabel('Rows per page', { exact: true }).selectOption('5');
  await register(page).getByLabel('Columns', { exact: true }).click();
  await expect(recordRows(page)).toHaveCount(5);
  const firstPage = await recordRows(page).allTextContents();
  await register(page).getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(recordRows(page)).toHaveCount(5);
  expect(await recordRows(page).allTextContents()).not.toEqual(firstPage);
  await register(page).getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(recordRows(page)).toHaveText(firstPage);
  await register(page).getByRole('button', { name: 'Sort by VF code', exact: true }).click();
  expect(await recordRows(page).allTextContents()).not.toEqual(firstPage);
  await register(page).getByLabel('Columns', { exact: true }).click();
  await expect(register(page).locator('thead .spg-col-deadline')).toHaveCount(1);
  await register(page).getByRole('checkbox', { name: 'Deadline', exact: true }).uncheck();
  await expect(register(page).locator('thead .spg-col-deadline')).toHaveCount(0);
  await register(page).getByRole('checkbox', { name: 'Deadline', exact: true }).check();
  await expect(register(page).locator('thead .spg-col-deadline')).toHaveCount(1);
});

test('late proposal details cannot overwrite the next selection and denied details clear evidence', async ({ page }) => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  const state = await prepareProposalRegister(page, { detailHolds: { [proposalRegisterId(1)]: held } });
  await ready(page);
  await selectRow(page, 1).click();
  await selectRow(page, 4).click();
  await expect(selected(page)).toContainText('Process Safety Study');
  release();
  await expect(selected(page)).not.toContainText('Electrical Design Review');
  state.detailStatuses[proposalRegisterId(5)] = 403;
  await selectRow(page, 5).click();
  await expect(selected(page)).toContainText('no longer available');
  await expect(selected(page)).not.toContainText('Engineering design and execution approach');
  expect(state.mutations).toEqual([]);
});

test('draft creation inherits the opportunity client and retains all input after validation failure', async ({ page }) => {
  const state = await prepareProposalRegister(page, { createStatuses: [400, 200] });
  await ready(page);
  await page.getByRole('button', { name: 'New proposal', exact: true }).click();
  const form = dialog(page, 'Create proposal from opportunity');
  await form.getByLabel('Qualified opportunity', { exact: false }).selectOption('opportunity-1');
  await form.getByLabel(/^Proposal number/).fill('TEST-PROPOSAL-500');
  await form.getByLabel(/^Valid until/).fill('2026-12-20');
  await form.getByLabel(/^Proposed price/).fill('275000.50');
  await form.getByLabel(/^Estimated delivery cost/).fill('190000.25');
  await form.getByLabel(/^Total estimated hours/).fill('1250');
  await form.getByLabel(/^Scope and execution approach/).fill('Retain this engineering scope after the failed save.');
  await form.getByRole('textbox', { name: /^Deliverables/ }).fill('Design basis\nEquipment register');
  await form.getByRole('button', { name: 'Create draft proposal', exact: true }).click();
  await expect(form).toContainText('could not be saved');
  await expect(form.getByLabel(/^Scope and execution approach/)).toHaveValue('Retain this engineering scope after the failed save.');
  await form.getByRole('button', { name: 'Create draft proposal', exact: true }).click();
  await expect(form).toHaveCount(0);
  const payload = state.mutations.filter(item => item.action === 'create').at(-1).body;
  expect(payload.client).toBe('client-1');
  expect(payload.status).toBe('draft');
  expect(payload.version).toBe(1);
  expect(payload.deliverables).toEqual(['Design basis', 'Equipment register']);
  expect(payload.total_amount).toBe('275000.50');
});

test('existing edit dialog retains failed changes and submitted proposals remain locked', async ({ page }) => {
  const state = await prepareProposalRegister(page, { patchStatuses: { [proposalRegisterId(0)]: [400, 200] } });
  await ready(page);
  await selected(page).getByRole('button', { name: 'Edit', exact: true }).click();
  const record = page.getByRole('dialog');
  await record.getByRole('textbox', { name: 'Scope', exact: true }).fill('Changed scope, retained after failure.');
  await record.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(record.getByRole('textbox', { name: 'Scope', exact: true })).toHaveValue('Changed scope, retained after failure.');
  await expect(record.getByText('Changes could not be saved. Your draft is retained.', { exact: true })).toBeVisible();
  await record.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(record.getByRole('textbox', { name: 'Scope', exact: true })).toHaveCount(0);
  await record.getByRole('button', { name: 'Close record', exact: true }).click();
  await selectRow(page, 3).click();
  await expect(selected(page).getByRole('button', { name: 'Edit', exact: true })).toBeDisabled();
  expect(state.mutations.filter(item => item.action === 'edit')).toHaveLength(2);
});

test('guarded export sends selected scope to the server and reports permission denial', async ({ page }) => {
  const state = await prepareProposalRegister(page);
  await ready(page);
  await register(page).getByRole('button', { name: 'Sort by VF code', exact: true }).click();
  const orderedLabels = await register(page).getByRole('button', { name: /^Select proposal / }).evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
  const orderedIds = orderedLabels.map(label => state.rows.find(row => label === `Select proposal ${row.quote_number} revision ${row.version}`).id);
  const orderedDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await orderedDownloadPromise;
  expect(state.exports.at(-1).body).toEqual({ ids: orderedIds.join(',') });
  await register(page).getByLabel('Search proposals', { exact: true }).fill('FEED');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('proposal-register.csv');
  expect(state.exports.at(-1).body).toEqual({ ids: proposalRegisterId(0) });
  state.exportStatus = 403;
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/export|permission/i);
});

test('proposal, PDF review and file versions stay distinct and internal feedback does not approve', async ({ page }) => {
  const state = await prepareProposalRegister(page, { reviewSubmissions: [{ id: 'internal-feedback-1', outcome: 'reviewed',
    note: 'Internal review complete.', actor: { id: 11, name: 'Aisha Noor' }, created_at: '2026-10-01T05:00:00Z' }] });
  await ready(page);
  await expect(selected(page).locator('.spg-revision')).toHaveText('Revision 02');
  await expect(selected(page).getByRole('row', { name: /Technical_Proposal.pdf/ })).toContainText('PDF rev 03');
  await expect(selected(page).getByRole('row', { name: /Commercial_Proposal.xlsx/ })).toContainText('v1');
  await expect(selected(page).locator('.spg-status')).toHaveText('In review');
  await expect(selected(page).getByRole('button', { name: 'Prepare submission', exact: true })).toBeDisabled();
  await expect(selected(page)).toContainText('09 Oct 2026');
  await expect(selected(page)).not.toContainText('31 Dec 2026');
  await expect(selected(page).getByText('Supporting documents (4)', { exact: true })).toBeVisible();
  await selected(page).getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(selected(page).getByRole('row', { name: /Commercial_Proposal.xlsx/ })).toContainText('Opportunity attachment');
  await expect(selected(page)).toContainText('RADAI attachments belong to the opportunity');
  await selected(page).getByRole('tab', { name: 'Approvals', exact: true }).click();
  await expect(selected(page)).toContainText('No proposal approval is recorded.');
  expect(state.mutations).toEqual([]);
});

test('governed approval and client submission retain failed input and recorded evidence', async ({ page }) => {
  const id = proposalRegisterId(0);
  const state = await prepareProposalRegister(page, { approveStatuses: { [id]: [403, 200] }, submitStatuses: { [id]: [503, 200] } });
  await ready(page);
  await selected(page).getByRole('button', { name: 'Review approvals', exact: true }).click();
  await selected(page).getByRole('button', { name: 'Review and approve', exact: true }).click();
  const approval = dialog(page, 'Review and approve proposal');
  await approval.getByRole('textbox', { name: 'Approval comment', exact: true }).fill('Retain the actual approval comment.');
  await approval.getByRole('button', { name: 'Approve proposal', exact: true }).click();
  await expect(approval).toContainText('not eligible');
  await expect(approval.getByRole('textbox', { name: 'Approval comment', exact: true })).toHaveValue('Retain the actual approval comment.');
  expect(state.rows[0].approved_at).toBeNull();
  await approval.getByRole('button', { name: 'Approve proposal', exact: true }).click();
  await expect(approval).toHaveCount(0);
  await expect(selected(page).locator('.spg-status')).toHaveText('Approved');
  await selected(page).getByRole('button', { name: 'Prepare submission', exact: true }).click();
  const submission = dialog(page, 'Submit proposal to client');
  await submission.getByLabel(/^Client recipient/).fill('recipient@example.test');
  await submission.getByLabel(/^Submission evidence or reference/).fill('Synthetic receipt 500');
  await submission.getByRole('button', { name: 'Record submission', exact: true }).click();
  await expect(submission).toContainText('could not be recorded');
  await expect(submission.getByLabel(/^Client recipient/)).toHaveValue('recipient@example.test');
  await expect(submission.getByLabel(/^Submission evidence or reference/)).toHaveValue('Synthetic receipt 500');
  await submission.getByRole('button', { name: 'Record submission', exact: true }).click();
  await expect(submission).toHaveCount(0);
  await selected(page).getByRole('tab', { name: 'Submission', exact: true }).click();
  await expect(selected(page)).toContainText('recipient@example.test');
  await expect(selected(page)).toContainText('Synthetic receipt 500');
  await expect(selected(page).getByRole('button', { name: 'Edit', exact: true })).toBeDisabled();
  expect(state.mutations.filter(item => item.action === 'approve')).toHaveLength(2);
  expect(state.mutations.filter(item => item.action === 'submit')).toHaveLength(2);
});

test('preview navigation returns to the same selected proposal with unchanged shell dimensions', async ({ page }) => {
  const state = await prepareProposalRegister(page);
  await ready(page);
  const shell = () => page.evaluate(() => ({ left: document.querySelector('main.main-content').getBoundingClientRect().x,
    header: document.querySelector('header:has(nav[aria-label="Primary navigation"])').getBoundingClientRect().height }));
  const before = await shell();
  await selected(page).getByRole('tab', { name: 'Documents', exact: true }).click();
  await selected(page).getByRole('link', { name: 'Preview & comment', exact: true }).first().click();
  await expect(page.locator('.sppdf-raster-host canvas')).toBeVisible({ timeout: 50000 });
  expect(await shell()).toEqual(before);
  await page.getByRole('link', { name: 'Back to proposals', exact: true }).click();
  await expect(selected(page)).toContainText('FEED Engineering Services');
  await expect(selectRow(page, 0)).toBeVisible();
  expect(await shell()).toEqual(before);
  expect(state.pageErrors).toEqual([]);
});

test('failed register retries honestly and an empty register invents no proposals or approval counts', async ({ page }) => {
  const state = await prepareProposalRegister(page, { listStatus: 503, entry: '/sales/proposals' });
  await expect(register(page)).toContainText('Proposals unavailable');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  state.listStatus = 200;
  await page.getByRole('button', { name: 'Retry loading', exact: true }).click();
  await ready(page);
  state.rows = [];
  await register(page).getByLabel('Columns', { exact: true }).click();
  await page.getByRole('button', { name: 'Refresh proposals', exact: true }).click();
  await expect(register(page)).toContainText('No proposals yet');
  await expect(register(page)).toContainText('0 proposals');
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  expect(state.mutations).toEqual([]);
});

test('client and missing-deadline filters never substitute proposal validity for the deadline', async ({ page }) => {
  const rows = Array.from({ length: 6 }, (_, index) => proposalRegisterRow(index));
  rows[1].submission_due_date = null;
  rows[1].deal_details.submission_due_date = null;
  await prepareProposalRegister(page, { rows });
  await ready(page);
  await register(page).getByRole('button', { name: 'Proposal filters', exact: true }).click();
  await register(page).getByLabel('Client', { exact: true }).selectOption('client-2');
  await expect(recordRows(page)).toHaveCount(2);
  await register(page).getByLabel('Deadline filter', { exact: true }).selectOption('missing');
  await expect(recordRows(page)).toHaveCount(1);
  await expect(register(page)).toContainText('Electrical Design Review');
  await selectRow(page, 1).click();
  await expect(selected(page).locator('.spg-facts').filter({ hasText: 'Submission deadline' })).toContainText('Not provided');
  await expect(selected(page).locator('.spg-facts').filter({ hasText: 'Submission deadline' })).not.toContainText('31 Dec');
});

test('intermediate 1024px workspace contains tabs and facts without obscuring submission', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1024, height: 960 });
  await prepareProposalRegister(page);
  await ready(page);
  const geometry = await selected(page).evaluate(node => {
    const workspace = node.getBoundingClientRect();
    return { right: workspace.right, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
      tabs: [...node.querySelectorAll('.spg-workspace-tabs button')].map(tab => ({ name: tab.textContent, right: tab.getBoundingClientRect().right })),
      facts: [...node.querySelectorAll('.spg-facts div')].map(fact => {
        const label = fact.querySelector('dt'), value = fact.querySelector('dd').getBoundingClientRect();
        const textRange = document.createRange(); textRange.selectNodeContents(label);
        return { name: label.textContent, overlap: [...textRange.getClientRects()].some(rect =>
          rect.right > value.left + 1 && rect.left < value.right - 1 && rect.bottom > value.top + 1 && value.bottom > rect.top + 1) };
      }) };
  });
  await page.screenshot({ path: testInfo.outputPath('proposal-register-1024.png'), fullPage: true });
  await testInfo.attach('intermediate-layout', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport + 1);
  for (const tab of geometry.tabs) expect(tab.right, `${tab.name} tab`).toBeLessThanOrEqual(geometry.right);
  expect(geometry.facts.filter(fact => fact.overlap)).toEqual([]);
  await selected(page).getByRole('tab', { name: 'Submission', exact: true }).click();
  await expect(selected(page).getByRole('heading', { name: 'Client submission', exact: true })).toBeVisible();
  await selected(page).getByRole('tab', { name: 'Documents', exact: true }).click();
  const upload = selected(page).getByRole('link', { name: 'Upload files', exact: true });
  await upload.click({ trial: true });
  await expect(upload).toBeInViewport();
  await expect(upload).toHaveAttribute('href', /opportunities.*record=opportunity-1/);
});

for (const width of [1920, 1366, 390]) test(`proposal register controls remain reachable at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 960 });
  const state = await prepareProposalRegister(page);
  await ready(page);
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.width + 1);
  await selected(page).getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(selected(page).getByRole('link', { name: 'Preview & comment', exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`proposal-register-${width}.png`), fullPage: true });
  expect(state.pageErrors).toEqual([]);
});
