import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

const root = 'https://rejlerssverige.sharepoint.com/sites/TeamADSalesBidding/Delade%20dokument/General/Myynti/Opportunities/Q-102101';
const region = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const detailPanel = page => page.getByRole('complementary', { name: 'Document details', exact: true });
const row = page => page.locator('.sor-table-scroll tbody tr').filter({ hasText: 'Q-102101' });
const files = [
  { id: 'technical', name: 'Technical_Proposal.docx', size: 2516582, version: '0.3', publication_level: 'checkout', modified_at: '2026-10-01T05:20:00Z', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'commercial', name: 'Commercial_Proposal.xlsx', size: 188416, version: '1.0', publication_level: 'published', modified_at: '2026-09-30T12:45:00Z' },
  { id: 'deliverables', name: 'Deliverables_Register.xlsx', size: 98304, version: null, publication_level: null, modified_at: '2026-09-30T10:10:00Z' },
  { id: 'schedule', name: 'Execution_Schedule.pdf', size: 655360, version: null, publication_level: null, modified_at: '2026-09-30T07:30:00Z' },
  { id: 'cover', name: 'Proposal_Cover_Letter.docx', size: 79872, version: '0.1', publication_level: null, modified_at: '2026-09-29T11:20:00Z' },
  { id: 'clarifications', name: 'Clarifications_Register.xlsx', size: 114688, version: '0.2', publication_level: null, modified_at: '2026-10-01T04:45:00Z' },
].map(file => ({ ...file, is_folder: false, web_url: `${root}/Proposal/${file.name}` }));

async function setup(page, configuration = {}) {
  const state = { files, workspaceStatus: 200, listStatus: 200, detailStatus: 200, versionsStatus: 200, downloadStatus: 200, uploadStatus: 201, nextCursor: false, uploads: [], ...configuration };
  const fixture = await prepareRegister(page, { records: [opportunity(0, { deal_name: 'FEED Engineering Services', submission_due_date: '2026-10-09' }), opportunity(1)], ...configuration, workspaceHandler: async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    const id = path.split('/deals/')[1].split('/')[0];
    const folder = path.split('/folders/')[1]?.split('/')[0];
    if (path.endsWith('/workspace/')) return route.fulfill({ status: state.workspaceStatus, json: state.workspaceStatus === 200 ? { opportunity_id: id, status: 'ready', folders: WORKSPACE_FOLDERS.map(item => ({ ...item, item_count: item.key === 'proposal' ? state.files.length : 0, web_url: `${root}/${item.name}` })), web_url: root, can_upload: true, can_manage: true, max_upload_bytes: 10485760, ...state.workspacePatch } : { detail: 'Workspace denied.' } });
    if (path.endsWith('/files/')) { if (state.listHold) await state.listHold; return route.fulfill({ status: state.listStatus, json: state.listStatus === 200 ? { folder_key: folder, files: folder === 'proposal' ? state.files : [], item_count: folder === 'proposal' ? state.files.length : 0, next_cursor: state.nextCursor && !url.searchParams.get('cursor') ? 'next-page' : null } : { detail: 'Folder listing failed.' } }); }
    if (path.endsWith('/versions/')) { if (state.versionsHold) await state.versionsHold; const fileId = path.split('/files/')[1].split('/')[0]; return route.fulfill({ status: state.versionsStatus, json: state.versionsStatus === 200 ? { file_id: fileId, versions: [{ id: '0.3', modified_at: '2026-10-01T05:20:00Z', modified_by: 'Aisha Noor', size: 2516582, is_current: true }, { id: '0.2', modified_at: '2026-09-30T11:10:00Z', modified_by: 'Omar Ali', size: 2150400, is_current: false }, { id: '0.1', modified_at: '2026-09-29T06:00:00Z', modified_by: null, size: 2097152, is_current: false }], next_cursor: state.versionsCursor && !url.searchParams.get('cursor') ? 'older-page' : null } : { detail: 'Versions unavailable.' } }); }
    if (path.endsWith('/download/')) { if (state.downloadHold) await state.downloadHold; return state.downloadStatus === 200 ? route.fulfill({ contentType: 'application/octet-stream', headers: state.downloadHeaders || {}, body: Buffer.from('synthetic downloaded document') }) : route.fulfill({ status: state.downloadStatus, json: { detail: 'Download unavailable.' } }); }
    if (path.includes('/files/')) { const fileId = path.split('/files/')[1].split('/')[0]; if (state.detailHolds?.[fileId]) await state.detailHolds[fileId]; const selected = state.files.find(file => file.id === fileId); return route.fulfill({ status: state.detailStatus, json: state.detailStatus === 200 ? { ...selected, folder_key: folder, created_by: 'Aisha Noor', modified_by: 'Proposal contributor', can_download: true, max_download_bytes: 52428800, ...state.detailPatch } : { detail: 'Document unavailable.' } }); }
    if (path.endsWith('/upload/')) { state.uploads.push(route.request().postDataBuffer().toString()); return route.fulfill({ status: state.uploadStatus, json: state.uploadStatus < 300 ? files[0] : { detail: 'Provider temporarily unavailable.' } }); }
    return route.fulfill({ status: 400, json: { detail: 'Unexpected test action.' } });
  } });
  if (!configuration.entry) { await page.getByRole('button', { name: 'Filters and table settings' }).click(); await page.locator('summary').filter({ hasText: /^\s*More\s*$/ }).click(); await page.getByRole('button', { name: 'Hide register summary' }).click(); await row(page).getByRole('button', { name: 'Q-102101', exact: true }).click(); }
  return { state, fixture };
}
async function openProposal(page) { await region(page).getByRole('button', { name: 'Open Proposal', exact: true }).click(); await expect(region(page).getByRole('table', { name: 'Uploaded files' })).toBeVisible(); }

test('double click opens full workspace and Back preserves register filters and selection', async ({ page }) => {
  const { fixture } = await setup(page);
  await page.getByRole('textbox', { name: 'Search opportunities' }).fill('FEED');
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await row(page).getByRole('cell').nth(2).dblclick();
  await expect(page.getByRole('button', { name: 'Back to register', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Workspace', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Opportunity register', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Back to register', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search opportunities' })).toHaveValue('FEED');
  await expect(row(page)).toHaveAttribute('aria-selected', 'true');
  expect(fixture.pageErrors).toEqual([]);
});

test('Workspace click opens explorer; Proposal shows real metadata and version details', async ({ page }) => {
  await setup(page);
  await page.getByRole('tab', { name: 'Workspace', exact: true }).click();
  await openProposal(page);
  await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  await expect(detailPanel(page)).toContainText('Proposal contributor');
  await expect(detailPanel(page)).toContainText('0.3');
  await expect(detailPanel(page)).toContainText('Checked out');
  await expect(detailPanel(page)).not.toContainText('In review');
  await expect(detailPanel(page).getByRole('link', { name: 'Open document' })).toHaveAttribute('href', `${root}/Proposal/Technical_Proposal.docx`);
  await detailPanel(page).getByRole('tab', { name: 'Versions', exact: true }).click();
  await expect(detailPanel(page)).toContainText('Omar Ali');
  await expect(detailPanel(page)).toContainText('0.1');
  await detailPanel(page).getByRole('button', { name: 'Close document details' }).click();
  await expect(detailPanel(page)).toContainText('Select a document');
});

test('direct workspace link opens selected folder and back remains usable on denial', async ({ page }) => {
  await setup(page, { entry: '/sales/opportunities?record=opportunity-0&workspace=1&folder=proposal' });
  await expect(region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Opportunity record', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to register', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search opportunities' })).toBeVisible();
});

test('unavailable direct-linked record still offers Back to register', async ({ page }) => {
  await setup(page, { entry: '/sales/opportunities?record=opportunity-0&workspace=1', detailStatuses: { 'opportunity-0': 403 } });
  await expect(page.getByRole('complementary', { name: 'Opportunity details', exact: true })).toContainText('could not be loaded');
  await page.getByRole('button', { name: 'Back to register', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Search opportunities' })).toBeVisible();
});

test('missing source metadata is unavailable and download denial removes stale actions', async ({ page }) => {
  const { state } = await setup(page, { detailPatch: { version: null, publication_level: null, created_by: null, modified_by: null } });
  await openProposal(page); await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  await expect(detailPanel(page).locator('.sod-facts')).toContainText('Not available');
  state.downloadStatus = 403;
  await detailPanel(page).getByRole('button', { name: 'Download', exact: true }).click();
  await expect(detailPanel(page).getByRole('alert')).toContainText('permission');
  await expect(detailPanel(page).getByRole('link', { name: 'Open document' })).toHaveCount(0);
  await expect(detailPanel(page).getByRole('button', { name: 'Download', exact: true })).toHaveCount(0);
});

test('download returns an authenticated attachment with selected filename', async ({ page }) => {
  await setup(page); await openProposal(page); await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await detailPanel(page).getByRole('button', { name: 'Download', exact: true }).click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('Technical_Proposal.docx');
});

test('download uses current response filename when SharePoint renamed the selected file', async ({ page }) => {
  await setup(page, { downloadHeaders: { 'content-disposition': "attachment; filename*=UTF-8''R%C3%A9vis%C3%A9e_Proposal.pdf" } });
  await openProposal(page); await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await detailPanel(page).getByRole('button', { name: 'Download', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('Révisée_Proposal.pdf');
});

test('switching files fences late metadata responses', async ({ page }) => {
  let release; const held = new Promise(resolve => { release = resolve; });
  await setup(page, { detailHolds: { technical: held } }); await openProposal(page);
  await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  await expect(detailPanel(page)).toContainText('Loading document details');
  await region(page).getByRole('button', { name: 'Commercial_Proposal.xlsx', exact: true }).click();
  await expect(detailPanel(page)).toContainText('Published'); release();
  await expect(detailPanel(page).getByRole('link', { name: 'Open document' })).toHaveAttribute('href', `${root}/Proposal/Commercial_Proposal.xlsx`);
});

test('denied pagination clears old files and document actions', async ({ page }) => {
  const { state } = await setup(page, { nextCursor: true }); await openProposal(page);
  await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  await expect(detailPanel(page).getByRole('link', { name: 'Open document' })).toBeVisible();
  state.listStatus = 403; await region(page).getByRole('button', { name: 'Load more files' }).click();
  await expect(region(page).getByRole('alert')).toContainText('permission');
  await expect(region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true })).toHaveCount(0);
  await expect(detailPanel(page)).toContainText('Select a document');
});

test('slow version history can recover after a denied download without a stuck spinner', async ({ page }) => {
  let release; const held = new Promise(resolve => { release = resolve; });
  const { state } = await setup(page, { versionsHold: held, downloadStatus: 403 }); await openProposal(page);
  await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  await expect(detailPanel(page)).toContainText('Loading versions');
  await detailPanel(page).getByRole('button', { name: 'Download', exact: true }).click();
  await expect(detailPanel(page).getByRole('alert')).toContainText('permission');
  state.versionsHold = null; state.downloadStatus = 200; release();
  await detailPanel(page).getByRole('button', { name: 'Retry details', exact: true }).click();
  await expect(detailPanel(page)).toContainText('0.3');
  await expect(detailPanel(page)).not.toContainText('Loading versions');
  await expect(detailPanel(page).getByRole('button', { name: 'Download', exact: true })).toBeEnabled();
});

test('switching folder while versions load cannot expose a previous document', async ({ page }) => {
  let release; const held = new Promise(resolve => { release = resolve; });
  const { state } = await setup(page, { versionsHold: held }); await openProposal(page);
  await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  await expect(detailPanel(page)).toContainText('Loading versions');
  await region(page).getByRole('button', { name: 'Open Tender', exact: true }).click();
  state.versionsHold = null; release();
  await expect(detailPanel(page)).toContainText('Select a document');
  await expect(region(page)).toContainText('No files in this folder yet.');
});

test('file search filter and sort use loaded items and nested folders open SharePoint', async ({ page }) => {
  await setup(page, { nextCursor: true, files: [...files, { id: 'nested', name: 'Supporting files', is_folder: true, web_url: `${root}/Proposal/Supporting` }] }); await openProposal(page);
  await expect(region(page)).toContainText('Search, filters and sorting apply to loaded items.');
  await region(page).getByRole('textbox', { name: 'Search loaded files' }).fill('Technical');
  await expect(region(page).getByRole('button', { name: 'Commercial_Proposal.xlsx', exact: true })).toHaveCount(0);
  await region(page).getByRole('textbox', { name: 'Search loaded files' }).fill('');
  await region(page).getByRole('button', { name: 'Filter files' }).click(); await region(page).getByRole('combobox', { name: 'File type filter' }).selectOption('folder');
  await expect(region(page).getByRole('link', { name: 'Supporting files' })).toHaveAttribute('href', `${root}/Proposal/Supporting`);
  await region(page).getByRole('combobox', { name: 'File type filter' }).selectOption('file');
  await region(page).getByRole('button', { name: 'Name', exact: true }).click();
  await expect(region(page).locator('tbody tr').first()).toContainText('Clarifications_Register.xlsx');
});

test('upload retry retains original file UUID and target folder inside explorer', async ({ page }) => {
  const { state } = await setup(page, { uploadStatus: 503 }); await openProposal(page);
  await region(page).getByRole('button', { name: 'Upload files' }).click(); const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog.getByLabel('Destination folder')).toHaveValue('proposal');
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic document') });
  await dialog.getByRole('button', { name: 'Upload file', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('temporarily unavailable');
  state.uploadStatus = 201; await dialog.getByRole('button', { name: 'Retry upload' }).click(); await expect(dialog).not.toBeVisible();
  const uuid = body => body.match(/name="upload_request_id"\r\n\r\n([^\r]+)/)[1]; expect(uuid(state.uploads[0])).toBe(uuid(state.uploads[1]));
  await expect(region(page)).toContainText('review.pdf uploaded to Proposal in SharePoint.');
});

test('workspace overview restores six folders without losing opportunity selection', async ({ page }) => {
  await setup(page); await openProposal(page); await region(page).getByRole('button', { name: 'Workspace overview' }).click();
  await expect(region(page).getByRole('table', { name: 'Workspace folders' })).toBeVisible();
  await expect(row(page)).toHaveAttribute('aria-selected', 'true');
});

for (const width of [390, 1366, 1920]) test(`document reference fits ${width}px and existing sidebar`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1040 }); await setup(page); await openProposal(page);
  if (width > 1000) await page.addStyleTag({ content: '#root { margin-left: 227px; width: calc(100% - 227px); }' });
  await region(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click(); await expect(detailPanel(page)).toContainText('Proposal contributor');
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
  await page.screenshot({ path: testInfo.outputPath(`documents-${width}.png`), fullPage: true });
  if (width === 1920) { const result = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(result.violations).toEqual([]); }
});
