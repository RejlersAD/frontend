import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

const workspace = page => page.getByRole('region', { name: 'Opportunity document workspace', exact: true });
const details = page => page.getByRole('complementary', { name: 'Document details', exact: true });
const root = 'https://rejlerssverige.sharepoint.com/sites/TeamADSalesBidding/Delade%20dokument/General/Myynti/Opportunities/Q-102101';
const files = [
  ['technical', 'Technical_Proposal.docx', 2516582, '0.3', 'checkout'],
  ['commercial', 'Commercial_Proposal.xlsx', 188416, '0.2', 'published'],
  ['deliverables', 'Deliverables_Register.xlsx', 98304, null, null],
  ['schedule', 'Execution_Schedule.pdf', 655360, null, null],
  ['cover', 'Proposal_Cover_Letter.docx', 79872, '0.1', null],
  ['clarifications', 'Clarifications_Register.xlsx', 114688, '0.2', null],
].map(([id, name, size, version, publication_level]) => ({
  id, name, size, version, publication_level, is_folder: false,
  modified_at: '2026-10-01T05:20:00Z', web_url: `${root}/Proposal/${name}`,
}));

async function prepare(page, { ready = false, canUpload = ready, title = 'FEED Engineering Services' } = {}) {
  const state = await prepareRegister(page, {
    realShell: true, entry: '/sales/opportunities?record=opportunity-0&workspace=1&folder=proposal',
    records: [opportunity(0, { deal_name: title, submission_due_date: '2026-10-09' })],
    workspaceHandler: async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/workspace/')) return route.fulfill({ json: {
        opportunity_id: 'opportunity-0', deal_code: 'Q-102101', status: ready ? 'ready' : 'not_configured',
        can_manage: ready, can_upload: canUpload, web_url: ready ? root : '', max_upload_bytes: 10485760,
        folders: WORKSPACE_FOLDERS.map(folder => ({ ...folder, item_count: ready ? (folder.key === 'proposal' ? 6 : 0) : null, web_url: ready ? `${root}/${folder.name}` : '' })),
      } });
      if (path.endsWith('/versions/')) return route.fulfill({ json: {
        file_id: 'technical', versions: [
          { id: '0.3', size: 2516582, modified_at: '2026-10-01T05:20:00Z', modified_by: 'Aisha Noor', is_current: true },
          { id: '0.2', size: 2150400, modified_at: '2026-09-30T11:10:00Z', modified_by: 'Omar Ali', is_current: false },
          { id: '0.1', size: 2097152, modified_at: '2026-09-29T06:00:00Z', modified_by: null, is_current: false },
        ], next_cursor: null,
      } });
      if (path.endsWith('/files/')) return route.fulfill({ json: { folder_key: 'proposal', files, item_count: files.length, next_cursor: null } });
      if (path.includes('/files/')) return route.fulfill({ json: { ...files[0], folder_key: 'proposal', created_by: 'Aisha Noor', modified_by: 'Proposal contributor', can_download: true, max_download_bytes: 52428800 } });
      return route.fulfill({ status: 400, json: { detail: 'Unexpected synthetic write.' } });
    },
  });
  await expect(workspace(page)).toBeVisible();
  await expect(workspace(page).getByRole('status').first()).toContainText(ready ? 'Workspace ready' : 'SharePoint setup required');
  return state;
}

test('unconfigured real shell keeps six folders navigable and Upload visible without sending files', async ({ page }) => {
  const state = await prepare(page);
  for (const folder of WORKSPACE_FOLDERS) {
    const button = workspace(page).getByRole('button', { name: `Open ${folder.name}`, exact: true });
    await expect(button).toBeEnabled(); await button.click();
    await expect(button).toHaveAttribute('aria-current', 'page');
  }
  await expect(workspace(page).getByRole('table', { name: 'Uploaded files' })).toBeVisible();
  await expect(details(page)).toBeVisible();
  const upload = workspace(page).getByRole('button', { name: 'Upload files', exact: true });
  await expect(upload).toBeEnabled(); await upload.click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/setup|connection/i);
  await expect(dialog.getByRole('button', { name: 'Upload file', exact: true })).toBeDisabled();
  await dialog.getByLabel('File', { exact: true }).setInputFiles({ name: 'retained.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic file remains in this browser') });
  await expect(dialog).toContainText('retained.pdf');
  await dialog.locator('form').evaluate(form => form.requestSubmit());
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('retained.pdf');
  await dialog.getByRole('button', { name: 'Close upload' }).click();
  await workspace(page).getByRole('button', { name: 'New folder', exact: true }).click();
  const folderDialog = page.getByRole('dialog', { name: 'New folder', exact: true });
  await expect(folderDialog).toContainText('administrator setup');
  await expect(folderDialog.getByRole('link')).toHaveCount(0);
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
  expect(state.requests.filter(request => request.path.includes('/folders/'))).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('read-only ready real shell shows upload reason while retaining readable documents', async ({ page }) => {
  const state = await prepare(page, { ready: true, canUpload: false });
  await expect(workspace(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true })).toBeVisible();
  await workspace(page).getByRole('button', { name: 'Upload files', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Upload opportunity file' });
  await expect(dialog).toContainText(/permission|access/i);
  await expect(dialog.getByRole('button', { name: 'Upload file', exact: true })).toBeDisabled();
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
});

test('New folder is an explicit SharePoint handoff, without a simulated folder creation', async ({ page }) => {
  const state = await prepare(page, { ready: true });
  await workspace(page).getByRole('button', { name: 'New folder', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'SharePoint' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/SharePoint/);
  await expect(dialog.getByRole('link')).toHaveAttribute('href', `${root}/Proposal`);
  expect(state.requests.filter(request => request.method !== 'GET')).toEqual([]);
});

test('long opportunity title and copied-code feedback do not displace folder/upload controls', async ({ page }) => {
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await prepare(page, { title: 'Reminder for Tender - Tender Code Tender_38699 on OQ Tawreed Portal' });
  const locationBefore = await workspace(page).locator('.sow-location').boundingBox();
  await page.getByRole('button', { name: 'Copy VF code' }).click();
  await expect(page.getByText('VF code copied.', { exact: true })).toBeAttached();
  const locationAfter = await workspace(page).locator('.sow-location').boundingBox();
  expect(locationAfter.y).toBeCloseTo(locationBefore.y, 0);
  await expect(workspace(page).getByRole('button', { name: 'Upload files', exact: true })).toBeInViewport();
  await expect(workspace(page).getByRole('button', { name: 'Open Award', exact: true })).toBeInViewport();
});

test('1024px shared shell can scroll the stacked explorer and reach document actions', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await prepare(page, { ready: true });
  await workspace(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
  const download = details(page).getByRole('button', { name: 'Download', exact: true });
  await download.scrollIntoViewIfNeeded();
  await expect(download).toBeInViewport();
  const upload = workspace(page).getByRole('button', { name: 'Upload files', exact: true });
  await upload.scrollIntoViewIfNeeded();
  await expect(upload).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

for (const ready of [false, true]) for (const width of [390, 1366, 1586, 1920]) {
  test(`real shell ${ready ? 'ready' : 'unconfigured'} workspace at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 1920 ? 960 : 992 });
    const state = await prepare(page, { ready });
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    if (width > 1000) await expect(page.locator('#application-sidebar')).toBeVisible();
    await expect(workspace(page).getByRole('button', { name: 'Upload files', exact: true })).toBeVisible();
    await expect(workspace(page).getByRole('button', { name: 'New folder', exact: true })).toBeVisible();
    await expect(workspace(page).getByRole('table', { name: 'Uploaded files' })).toBeVisible();
    if (ready) {
      await workspace(page).getByRole('button', { name: 'Technical_Proposal.docx', exact: true }).click();
      await expect(details(page)).toContainText('Proposal contributor');
      await expect(details(page)).toContainText('0.3');
    }
    await expect(details(page)).toBeVisible();
    const geometry = await page.evaluate(() => {
      const upload = [...document.querySelectorAll('.sow-workspace button')].find(button => button.textContent.trim() === 'Upload files');
      const folder = document.querySelector('.sod-folders button[aria-label="Open Proposal"]');
      const table = document.querySelector('.sod-table-scroll table');
      const panes = document.querySelector('.sod-explorer');
      const fileName = table.querySelector('td button');
      const cell = table.querySelector('td');
      return {
        pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth,
        uploadFont: getComputedStyle(upload).fontSize, uploadColor: getComputedStyle(upload).backgroundColor,
        folderFont: folder && getComputedStyle(folder).fontSize,
        tableFont: table && getComputedStyle(table).fontSize,
        cellFont: cell && getComputedStyle(cell).fontSize,
        fileFont: fileName && getComputedStyle(fileName).fontSize,
        columns: panes && getComputedStyle(panes).gridTemplateColumns,
        paneBounds: [...panes.children].filter(element => element.tagName !== 'DIALOG').map(element => ({ top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom })),
      };
    });
    await testInfo.attach('computed-layout', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath(`workspace-${ready ? 'ready' : 'unconfigured'}-${width}.png`), fullPage: true });
    expect(geometry.pageScroll).toBeLessThanOrEqual(geometry.pageWidth + 1);
    expect(geometry.uploadFont).toBe('14px');
    expect(geometry.uploadColor).toBe('rgb(75, 22, 255)');
    expect(geometry.folderFont).toBe('14px');
    expect(geometry.tableFont).toBe('14px');
    if (ready) { expect(geometry.cellFont).toBe('14px'); expect(geometry.fileFont).toBe('14px'); }
    if (width > 1000) {
      expect(geometry.columns.split(' ')).toHaveLength(3);
      for (const bounds of geometry.paneBounds) expect(bounds.bottom).toBeLessThanOrEqual(page.viewportSize().height);
      await expect(workspace(page).getByRole('button', { name: 'Upload files', exact: true })).toBeInViewport();
      await expect(workspace(page).getByRole('button', { name: 'New folder', exact: true })).toBeInViewport();
      await expect(workspace(page).getByRole('button', { name: 'Open Award', exact: true })).toBeInViewport();
    }
    if (width === 1586) {
      const results = await new AxeBuilder({ page }).include('.sor-workspace').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(results.violations).toEqual([]);
    }
    expect(state.pageErrors).toEqual([]);
  });
}
