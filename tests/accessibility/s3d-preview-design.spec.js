import { test, expect } from '@playwright/test';
import { jsPDF } from 'jspdf';
import { readFileSync } from 'node:fs';

const dictionary = JSON.parse(readFileSync(new URL('../../src/config/buhasa_codelists.json', import.meta.url), 'utf8'));
const canonical = (category, short) => dictionary[category].find(entry => entry.shortDesc === short);
const highlight = { page: 1, table_id: 'T6', bbox: [0.08, 0.25, 0.92, 0.4], coordinate_space: 'normalized' };
const resolved = entry => ({ raw: entry.shortDesc, status: 'RESOLVED', candidates: [entry], shortDesc: entry.shortDesc, code: entry.code });

function detailEvidence(state, id) {
  const attributes = { EndPreparation: state.resolvedDetails ? resolved(canonical('EndPreparation', 'MTE')) : { raw: 'THD', status: 'AMBIGUOUS', candidates: ['MTE', 'FTE'].map(value => canonical('EndPreparation', value)) },
    FlangeFacing: resolved(canonical('FlangeFacing', 'Raised face')), PressureRating: resolved(canonical('PressureRating', '150')),
    MaterialsGrade: resolved(canonical('MaterialsGrade', 'Alloy 20 (UNS N08020)')), ScheduleThickness: { raw: '', status: 'NOT_SUPPLIED', candidates: [] }, BoltType: { raw: '', status: 'NOT_SUPPLIED', candidates: [] } };
  for (const [category, entry] of Object.entries(state.canonical[id] || {})) attributes[category] = resolved(entry);
  return { codelists: { profile: 'BUHASA', attributes, selections: state.canonical[id] || {} } };
}

const jobId = '00000000-0000-4000-8000-000000000456';
const projectId = '00000000-0000-4000-8000-000000000123';
const names = ['Gate valve', 'Flange', 'Elbow', 'Reducer', 'Globe valve', 'Tee', 'Check valve', 'Flange', 'Elbow', 'Reducer', 'Ball valve', 'Strainer'];
const cells = { ComponentName: 'Gate valve', FirstSizeFrom: '2 in', Schedule: 'SCH 40', MaterialGrade: 'ASTM A216 WCB', PressureRating: 'Class 150', EndConnection: 'RF', SpecName: 'CS150', ShortCode: 'GAT' };

function sourcePdf() {
  const pdf = new jsPDF();
  for (let p = 1; p <= 2; p++) {
    if (p > 1) pdf.addPage();
    pdf.setTextColor('#102b56'); pdf.setFontSize(22); pdf.text('REJLERS', 15, 21);
    pdf.setFontSize(8); pdf.text('Synthetic test reference — not an engineering specification', 15, 29);
    pdf.setFontSize(13); pdf.text('PIPING MATERIAL SPECIFICATION — CS150', 35, 48);
    pdf.setFontSize(11); pdf.text('6.0  VALVES', 15, 64);
    pdf.setFontSize(10); pdf.text('Table 6 — Valve list (CS150)', 15, 76);
    const columns = [15, 34, 104, 130, 155, 185, 198];
    const rows = [['Item', 'Description', 'Size', 'Rating', 'Material', 'End'], ...names.map((name, i) => [`6.${i + 8}`, name, '2 in', '150', 'A216 WCB', 'RF'])];
    rows.forEach((row, index) => {
      const y = 81 + index * 10;
      pdf.setDrawColor('#aab6c6');
      row.forEach((value, c) => { pdf.rect(columns[c], y, columns[c + 1] - columns[c], 10); pdf.setFontSize(8); pdf.text(value, columns[c] + 2, y + 6); });
    });
    pdf.text(`Page ${p} of 2`, 170, 280);
  }
  return Buffer.from(pdf.output('arraybuffer'));
}

async function prepare(page, options = {}) {
  const state = { saves: [], reviews: [], errors: [], failSave: false, failReview: false, review: '', canonical: {}, sources: {}, ...options };
  page.on('pageerror', error => state.errors.push(error.message));
  const decisions = () => names.map((name, i) => {
    const id = `decision-${i}`;
    const evidence = options.buhasaDetails ? detailEvidence(state, id) : {};
    if (state.sources[id]) evidence.source_reference = state.sources[id];
    const candidates = options.buhasaDetails ? [0, 1].map(index => ({ candidate_id: `row-${index}`, commodity_code: index ? 'GAT-150-WCB-NPT' : 'GAT-150-WCB-RF', description: index ? 'Alternate threaded end / schedule' : 'Male threaded end', ranking_score: 0.8,
      discriminators: { size: { requested: '2 in', values: ['2 in'], matched: true } },
      codelists: { EndPreparation: { values: [index && !state.resolvedDetails ? '441' : '331'], codes: [index && !state.resolvedDetails ? 441 : 331] }, FlangeFacing: { values: ['5'], codes: [5] },
        PressureRating: { values: ['35'], codes: [35] }, MaterialsGrade: { values: ['40001'], codes: [40001] }, ScheduleThickness: { values: [index ? '50' : '40'], codes: [index ? 50 : 40] } } }))
      .filter(candidate => Object.entries(state.canonical[id] || {}).every(([category, entry]) => candidate.codelists[category]?.codes.includes(entry.code)))
      : [{ commodity_code: 'GAT-150-WCB-RF', description: 'Gate valve, 2 in, Class 150, ASTM A216 WCB, RF', ranking_score: 0.8, discriminators: { end_connection: { matched: false } } }, { commodity_code: 'GAT-150-WCB-NPT', description: 'Gate valve, 2 in, Class 150, ASTM A216 WCB, NPT', ranking_score: 0.6 }];
    return { id, pdf_component_name: name, nominal_size: '2 in', pressure_rating: 'Class 150', material_grade: 'ASTM A216 WCB', end_connection: 'RF',
      state: i % 3 === 1 ? 'unmatched' : 'ambiguous', review_decision: i === 0 ? state.review : '', final_commodity_code: i === 0 && state.review === 'approved' ? 'GAT-150-WCB-RF' : '', discriminators_matched: evidence, candidates: i % 3 === 1 ? [] : candidates };
  });
  await page.route('**/synthetic-reference.pdf', route => state.failPdf ? route.fulfill({ status: 404, body: 'Source not found' }) : route.fulfill({ contentType: 'application/pdf', body: sourcePdf() }));
  await page.route('**/api/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith(`/paper-spec/jobs/${jobId}/`)) return route.fulfill({ json: { id: jobId, project_id: projectId, status: 'completed', extraction_completeness: options.emptyResult ? { state: 'empty', has_components: false } : undefined, document_meta: { original_filename: '0500867-SP-00-LA-0076_C2_PMS.pdf', total_pages: 2, file_url: options.noSource ? null : '/synthetic-reference.pdf' } } });
    if (path.endsWith('/matching-decisions/')) return state.failMatches ? route.fulfill({ status: 404, contentType: 'text/html', body: '<!DOCTYPE html><html>Missing matching route</html>' }) : route.fulfill({ json: { items: decisions() } });
    if (path.endsWith('/releases/')) return route.fulfill({ status: 404, contentType: 'text/html', body: '<!DOCTYPE html><html>Missing release route</html>' });
    if (path.endsWith('/matching-decision-review/')) {
      if (state.failReview) return route.fulfill({ status: 403, json: { detail: 'Review access denied.' } });
      const payload = request.postDataJSON(); state.reviews.push(payload);
      if (payload.review_decision === 'normalized') {
        state.canonical[payload.decision_id] = { ...state.canonical[payload.decision_id], ...payload.codelist_selections };
        state.review = '';
      } else {
        state.review = payload.review_decision;
        if (payload.source_reference) state.sources[payload.decision_id] = payload.source_reference;
      }
      return route.fulfill({ json: decisions()[Number(payload.decision_id.split('-')[1])] });
    }
    if (path.endsWith('/workbook/batch-save/')) {
      state.saves.push(request.postDataJSON());
      return route.fulfill({ status: state.failSave ? 503 : 200, json: state.failSave ? { error: 'Workbook changes could not be saved.' } : { saved_count: 1 } });
    }
    if (path.endsWith('/workbook/validate/')) return route.fulfill({ json: { issues_total: 1, issues: [{ row_key: 'comp:0', sheet_name: 'PipingCommodityFilter', severity: 'high', column_name: 'FirstSizeFrom', message: 'Size requires engineering review.' }] } });
    if (path.endsWith('/workbook/') && options.emptyResult) return route.fulfill({ json: { workbook: 'spec', sheets: [{ name: 'CustomInterfaces', headers: ['Description'], row_count: 1, rows: [{ row_key: 'tpl:1', cells: { Description: 'Static template definition' }, source: {} }] }] } });
    if (path.endsWith('/workbook/')) return route.fulfill({ json: { workbook: 'spec', sheets: [{ name: 'PipingCommodityFilter', row_count: 12, headers: Object.keys(cells), rows: names.map((name, i) => ({ row_key: `comp:${i}`, cells: { ...cells, ComponentName: name }, source: { component_id: `component-${i}`, class_id: 'class-1', class_code: `SP-${String(24 + i).padStart(3, '0')}`, reference: state.sources[`decision-${i}`] || (options.highlight && i === 0 ? highlight : undefined) }, match_decision: { id: `decision-${i}` }, provenance: { ComponentName: 'extracted' } })) }] } });
    if (path.endsWith(`/jobs/${jobId}/classes/`)) return route.fulfill({ json: [{ id: 'class-1', class_code: 'CS150', source_pages: [1] }] });
    if (path.endsWith('/classes/class-1/')) return route.fulfill({ json: { id: 'class-1', class_code: 'CS150', source_pages: [1], components: names.map((name, i) => ({ id: `component-${i}`, component_type: name, description: `${name.toUpperCase()}, 2 IN, CL150, WCB, RF` })) } });
    if (path.endsWith('/save/')) return route.fulfill({ json: { id: jobId, project_id: projectId, status: 'completed', saved_at: '2026-10-20T12:00:00Z' } });
    return route.fulfill({ json: { items: [], results: [], unread_count: 0 } });
  });
  await page.goto(`/tests/fixtures/s3d-builder-shell.html?entry=${encodeURIComponent(`/engineering/digitization/smart-plant-3d?screen=preview&job=${jobId}`)}`);
  await expect(page.getByRole('heading', { name: 'Review Queue', exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.s3d-queue tbody tr')).toHaveCount(options.emptyResult ? 0 : 12);
  return state;
}

test('desktop review design retains shell, saves mapped cells and explicitly approves a candidate', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  const state = await prepare(page);
  const sidebar = await page.locator('aside').first().boundingBox();
  const header = await page.locator('header').first().boundingBox();
  await expect(page.getByRole('img', { name: /PMS.pdf, page 1/ })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Confirm match', exact: true })).toBeDisabled();
  await page.getByRole('radio').first().check();
  const mainBounds = await page.locator('main').boundingBox();
  const actionBounds = await page.locator('.s3d-record-actions').boundingBox();
  const statusBounds = await page.locator('.s3d-workspace-footer').boundingBox();
  expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(mainBounds.y + mainBounds.height);
  expect(statusBounds.y + statusBounds.height).toBeLessThanOrEqual(mainBounds.y + mainBounds.height + 1);
  await page.screenshot({ path: testInfo.outputPath('s3d-preview-desktop.png'), fullPage: true });
  const panels = await page.locator('.s3d-review-columns > section').evaluateAll(elements => elements.map(element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })));
  expect(panels[0].y).toBe(panels[1].y); expect(panels[1].y).toBe(panels[2].y);
  expect(panels[0].x).toBeLessThan(panels[1].x); expect(panels[1].x).toBeLessThan(panels[2].x);
  await page.getByLabel('Size', { exact: true }).fill('3 in');
  await page.getByLabel('Rating', { exact: true }).click();
  await expect.poll(() => state.saves.length).toBe(1);
  expect(state.saves[0]).toEqual({ cells: [{ workbook: 'spec', sheet_name: 'PipingCommodityFilter', row_key: 'comp:0', column_name: 'FirstSizeFrom', value: '3 in' }] });
  await page.getByRole('button', { name: 'Confirm match', exact: true }).click();
  await expect(page.locator('.s3d-record-title')).toContainText('Approved');
  expect(state.reviews[0]).toEqual({ decision_id: 'decision-0', review_decision: 'approved', final_commodity_code: 'GAT-150-WCB-RF', source_reference: { page: 1 } });
  await page.getByRole('button', { name: 'Next source page', exact: true }).click();
  await expect(page.getByRole('img', { name: /PMS.pdf, page 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in source', exact: true }).click();
  await expect(page.locator('.s3d-zoom-control')).toContainText('110%');
  await page.getByRole('tab', { name: 'Validation', exact: true }).click();
  await page.getByRole('button', { name: 'Validate workbook', exact: true }).click();
  await expect(page.locator('.s3d-validation')).toContainText('Size requires engineering review.');
  expect(await page.locator('aside').first().boundingBox()).toEqual(sidebar);
  expect(await page.locator('header').first().boundingBox()).toEqual(header);
  expect(state.errors).toEqual([]);
});

test('mobile and tablet stack panels without changing the shell or overflowing', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await prepare(page, { noSource: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('s3d-preview-mobile.png'), fullPage: true });
  await expect(page.getByRole('heading', { name: 'Source preview unavailable' })).toBeAttached();
  await page.getByRole('searchbox', { name: 'Search records' }).fill('Strainer');
  await expect(page.locator('.s3d-queue tbody tr')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Search records' }).fill('does not exist');
  await expect(page.getByText('No records match your search.')).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole('searchbox', { name: 'Search records' }).clear();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1100);
  await page.screenshot({ path: testInfo.outputPath('s3d-preview-tablet.png'), fullPage: true });
  expect(state.errors).toEqual([]);
});

test('failed cell save keeps the editable draft and blocks tab navigation until retry succeeds', async ({ page }) => {
  const state = await prepare(page, { failSave: true });
  await page.getByLabel('Size', { exact: true }).fill('3 in');
  await page.getByRole('tab', { name: 'Release & pilot', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Workbook changes could not be saved.');
  await expect(page.getByRole('tab', { name: 'Workbook canvas', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Size', { exact: true })).toHaveValue('3 in');
  state.failSave = false;
  await page.getByRole('button', { name: 'Save extracted data', exact: true }).click();
  await expect(page.locator('.s3d-save-indicator')).toHaveText('Saved');
  await expect(page.getByRole('button', { name: 'Saved to project', exact: true })).toBeDisabled();
  expect(state.errors).toEqual([]);
});

test('denied candidate review preserves selection and workbook grid remains available', async ({ page }) => {
  const state = await prepare(page, { failReview: true });
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Confirm match', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Review access denied.');
  await expect(page.getByRole('radio').first()).toBeChecked();
  await expect(page.locator('.s3d-record-title')).toContainText('Ambiguous match');
  expect(state.reviews).toHaveLength(0);
  await page.getByRole('combobox', { name: 'Workbook section' }).selectOption('__grid__');
  await expect(page.getByRole('button', { name: 'Back to review workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to review workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Review Queue', exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('unavailable matching route and missing PDF explain the failure and recover on retry', async ({ page }) => {
  const state = await prepare(page, { failMatches: true, failPdf: true });
  await expect(page.locator('.s3d-inline-error')).toContainText('matching API is unavailable');
  await expect(page.locator('.s3d-evidence [role=alert]')).toContainText('source PDF was not found');
  state.failMatches = false;
  state.failPdf = false;
  await page.locator('.s3d-inline-error').getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Retry source preview', exact: true }).click();
  await expect(page.locator('.s3d-inline-error')).toHaveCount(0);
  await expect(page.locator('.s3d-record-title')).toContainText('Ambiguous match');
  await expect(page.getByRole('img', { name: /PMS.pdf, page 1/ })).toBeVisible({ timeout: 60000 });
  expect(state.errors).toEqual([]);
});

test('missing release route shows a concise actionable error instead of an HTML page', async ({ page }) => {
  const state = await prepare(page, { noSource: true });
  await page.getByRole('tab', { name: 'Release & pilot', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('release workflow is unavailable');
  await expect(page.getByRole('alert')).not.toContainText('<!DOCTYPE');
  await expect(page.getByText('Release evidence could not be loaded.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh release state', exact: true })).toBeEnabled();
  expect(state.errors).toEqual([]);
});

test('historical empty extraction shows recovery guidance and keeps static template rows out of the extracted queue', async ({ page }) => {
  const state = await prepare(page, { emptyResult: true, noSource: true });
  await expect(page.getByRole('alert')).toContainText('This extraction produced no component records');
  await expect(page.getByText('No components extracted', { exact: true })).toBeVisible();
  await expect(page.getByText('Extraction complete', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save extracted data', exact: true })).toBeDisabled();
  await expect(page.locator('.s3d-queue')).not.toContainText('Static template definition');
  await page.getByRole('button', { name: 'CAT', exact: true }).click();
  await expect(page.locator('.s3d-queue tbody tr')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Workbook section' }).selectOption('CustomInterfaces');
  await expect(page.locator('.s3d-queue tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toBeEnabled();
  expect(state.errors).toEqual([]);
});

test('canonical properties filter real dictionary values and confirmation saves highlighted provenance', async ({ page }) => {
  const state = await prepare(page, { buhasaDetails: true, highlight: true });
  await expect(page.getByRole('img', { name: /PMS.pdf, page 1/ })).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('combobox', { name: 'Flange facing', exact: true })).toHaveValue('Raised face (5)');
  await expect(page.getByRole('combobox', { name: 'Rating', exact: true })).toHaveValue('150 (35)');
  await expect(page.locator('.s3d-diff-badge--match').filter({ hasText: 'Size: 2 in' }).first()).toBeVisible();
  await expect(page.locator('.s3d-diff-message').filter({ hasText: 'source THD (ambiguous)' }).first()).toBeVisible();
  const facing = page.getByRole('combobox', { name: 'Flange facing', exact: true });
  await facing.fill('this is not a standard facing');
  await expect(page.getByText('No canonical values found. Search text cannot be saved.')).toBeVisible();
  await facing.press('Escape');
  await expect(facing).toHaveValue('Raised face (5)');
  expect(state.reviews).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Confirm match', exact: true })).toBeDisabled();
  const end = page.getByRole('combobox', { name: 'End connection', exact: true });
  await end.fill('MTE');
  await page.getByRole('option', { name: /^MTE \(331\)/ }).click();
  await expect(end).toHaveValue('MTE (331)');
  const schedule = page.getByRole('combobox', { name: 'Schedule', exact: true });
  await schedule.fill('S-40');
  await page.getByRole('option', { name: /^S-40 \(40\)/ }).click();
  await expect(schedule).toHaveValue('S-40 (40)');
  expect(state.reviews[1].codelist_selections.ScheduleThickness.code).toBe(40);
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Confirm match', exact: true }).click();
  await expect(page.getByText('Source evidence linked', { exact: true })).toBeVisible();
  await expect(page.getByText('Source linked', { exact: true })).toBeVisible();
  expect(state.reviews.at(-1).source_reference).toEqual(highlight);
  expect(state.reviews.at(-1).candidate_id).toBe('row-0');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Schedule', exact: true })).toHaveValue('S-40 (40)', { timeout: 60000 });
  await expect(page.getByText('Source evidence linked', { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('detail hotkeys select, clear, confirm and advance without carrying a prior page box', async ({ page }) => {
  const state = await prepare(page, { buhasaDetails: true, resolvedDetails: true, highlight: true });
  await expect(page.getByRole('img', { name: /PMS.pdf, page 1/ })).toBeVisible({ timeout: 60000 });
  const pane = page.getByRole('region', { name: 'Record details', exact: true });
  await pane.focus(); await pane.press('2');
  await expect(page.getByRole('radio').nth(1)).toBeChecked();
  await pane.press('Escape');
  await expect(page.locator('.s3d-candidate input:checked')).toHaveCount(0);
  const material = page.getByRole('combobox', { name: 'Material', exact: true });
  await material.fill('123');
  await expect(page.locator('.s3d-candidate input:checked')).toHaveCount(0);
  await material.press('Escape');
  expect(state.reviews).toHaveLength(0);
  await page.getByRole('button', { name: 'Next source page', exact: true }).click();
  await expect(page.getByRole('img', { name: /PMS.pdf, page 2/ })).toBeVisible();
  await pane.focus(); await pane.press('2'); await pane.press('Control+Enter');
  await expect(page.locator('.s3d-record-title')).toContainText('SP-025');
  expect(state.reviews).toHaveLength(1);
  expect(state.reviews[0].candidate_id).toBe('row-1');
  expect(state.reviews[0].source_reference).toEqual({ page: 2 });
  await page.locator('.s3d-queue tbody tr').first().getByRole('button').click();
  await expect(page.getByText('Source evidence linked', { exact: true })).toBeVisible();
  expect(state.errors).toEqual([]);
});

test('failed keyboard confirmation retains the record, selection and unlinked source', async ({ page }) => {
  const state = await prepare(page, { buhasaDetails: true, resolvedDetails: true, failReview: true });
  const pane = page.getByRole('region', { name: 'Record details', exact: true });
  await pane.focus(); await pane.press('1'); await pane.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Review access denied.');
  await expect(page.locator('.s3d-record-title')).toContainText('SP-024');
  await expect(page.getByRole('radio').first()).toBeChecked();
  await expect(page.getByText('Source evidence linked', { exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
