import { test, expect } from '@playwright/test';
import process from 'node:process';
import { readFileSync } from 'node:fs';

const buhasa = JSON.parse(readFileSync(new URL('../../src/config/buhasa_codelists.json', import.meta.url), 'utf8'));

test.setTimeout(Number(process.env.S3D_TEST_TIMEOUT_MS || 240000));
const jobId = '00000000-0000-4000-8000-000000000456';
const setId = '00000000-0000-4000-8000-000000000789';
const projectId = '00000000-0000-4000-8000-000000000123';

async function prepare(page, withCodelists = false) {
  const state = { run: false, failReview: false, review: '', selections: {}, lastCandidate: '' };
  const decision = () => ({
    id: 'decision-1', job_id: jobId, workbook_set_id: setId,
    pdf_component_name: 'GATE VALVE', nominal_size: '2', pressure_rating: '150', material_grade: 'A105',
    sub_type: 'Gate', end_connection: 'BW', state: 'ambiguous', review_decision: state.review,
    final_commodity_code: state.review ? 'VLV-B' : '',
    ...(withCodelists ? { discriminators_matched: { codelists: { profile: 'BUHASA', selections: state.selections,
      attributes: Object.fromEntries(['EndPreparation', 'FlangeFacing'].map(category => [category, state.selections[category]
        ? { raw: category === 'EndPreparation' ? 'THD' : 'unknown facing', status: 'RESOLVED', ...state.selections[category], candidates: [state.selections[category]] }
        : { raw: category === 'EndPreparation' ? 'THD' : 'unknown facing', status: category === 'EndPreparation' ? 'AMBIGUOUS' : 'UNMAPPED_CODELIST', candidates: category === 'EndPreparation' ? buhasa.EndPreparation.filter(entry => ['MTE', 'FTE'].includes(entry.shortDesc)) : [] }])),
      differences: ['Differs by: ScheduleThickness [5 vs 10]'],
    } } } : {}),
    candidates: ['VLV-A', 'VLV-B'].map(commodity_code => ({ commodity_code, ranking_score: 0.8,
      ...(withCodelists ? { candidate_id: `${commodity_code}-row`, codelists: { ScheduleThickness: { values: [commodity_code === 'VLV-A' ? '5' : '10'], codes: [commodity_code === 'VLV-A' ? 5 : 10] } } } : {}),
      discriminators: { size: { values: ['2'], matched: true }, pressure: { values: ['150'], matched: true },
        material: { values: ['A105'], matched: true }, end_connection: { values: ['BW'], matched: true } } })),
  });
  const reference = { id: setId, version_label: 'Synthetic Rev A', is_active: true, is_parsed: true,
    schema_valid: true, match_file_hash: 'a'.repeat(64), spec_file_hash: 'b'.repeat(64), cat_file_hash: 'c'.repeat(64) };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith(`/paper-spec/jobs/${jobId}/`)) return route.fulfill({ json: {
      id: jobId, status: 'completed', project_id: projectId, reference_workbook_set: state.run ? setId : null,
      document_meta: { original_filename: 'Synthetic.pdf', total_pages: 1 },
    } });
    if (path.endsWith('/matching/sets/')) return route.fulfill({ json: { items: [reference] } });
    if (path.endsWith('/matching-run/')) {
      expect(request.postDataJSON()).toEqual({ job_id: jobId, workbook_set_id: setId, codelist_profile: 'BUHASA' });
      state.run = true;
      return route.fulfill({ json: { summary: { ambiguous: 1 } } });
    }
    if (path.endsWith('/matching-decisions/')) return route.fulfill({ json: { items: state.run ? [decision()] : [] } });
    if (path.endsWith('/matching-decision-review/')) {
      if (state.failReview) return route.fulfill({ status: 403, json: { detail: 'Review access denied.' } });
      const payload = request.postDataJSON();
      if (payload.review_decision === 'normalized') {
        Object.assign(state.selections, payload.codelist_selections);
        state.review = '';
        return route.fulfill({ json: decision() });
      }
      expect(payload.final_commodity_code).toBe('VLV-B');
      if (withCodelists) state.lastCandidate = payload.candidate_id;
      state.review = payload.review_decision;
      return route.fulfill({ json: decision() });
    }
    if (path.endsWith('/matching-set-freeze/')) {
      reference.frozen_at = '2026-10-20T10:00:00Z';
      return route.fulfill({ json: reference });
    }
    if (path.endsWith('/workbook/')) return route.fulfill({ json: { sheets: [], workbook: 'spec' } });
    return route.fulfill({ json: { items: [], results: [], unread_count: 0 } });
  });
  const entry = `/engineering/digitization/smart-plant-3d?screen=preview&job=${jobId}`;
  await page.goto(`/tests/fixtures/s3d-builder-shell.html?entry=${encodeURIComponent(entry)}`);
  await expect(page.getByRole('button', { name: 'Run Matching', exact: true })).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Run Matching', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match review queue' })).toBeVisible();
  return state;
}

test('matching run requires candidate selection, persists approval and freezes reference', async ({ page }) => {
  await prepare(page);
  await expect(page.getByRole('tab', { name: 'Matching', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await page.getByLabel('Candidate for GATE VALVE').selectOption('VLV-B');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Review: approved · VLV-B')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh decisions' }).click();
  await expect(page.getByText('Review: approved · VLV-B')).toBeVisible();
  await expect(page.getByText(`MATCH SHA-256: ${'a'.repeat(64)}`)).toBeVisible();
  await page.getByRole('button', { name: 'Freeze reference set', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reference frozen', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Re-parse', exact: true })).toBeDisabled();
});

test('denied review keeps pending state and selected evidence', async ({ page }) => {
  const state = await prepare(page);
  state.failReview = true;
  await page.getByLabel('Candidate for GATE VALVE').selectOption('VLV-B');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Review access denied.');
  await expect(page.getByText('Review: pending', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Candidate for GATE VALVE')).toHaveValue('VLV-B');
});

test('remap dialog saves an explicitly entered commodity', async ({ page }) => {
  await prepare(page);
  await page.getByRole('button', { name: 'Remap', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Commodity code', { exact: true }).fill('VLV-B');
  await page.getByRole('button', { name: 'Save remap' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('Review: remapped · VLV-B')).toBeVisible();
});

test('BUHASA unmapped and ambiguous values use canonical selectors before row approval', async ({ page }) => {
  const state = await prepare(page, true);
  await expect(page.getByText('Controlled release is blocked until all supplied codelist values are resolved.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await expect(page.getByText('Differs by: ScheduleThickness [5 vs 10]')).toBeVisible();
  await page.getByRole('button', { name: 'Choose canonical FlangeFacing', exact: true }).click();
  await page.getByRole('combobox', { name: 'Canonical FlangeFacing for GATE VALVE' }).fill('RF');
  await page.getByRole('option', { name: 'Raised face (5)', exact: true }).click();
  await expect(page.getByText('FlangeFacing: Raised face (5) · RESOLVED', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Choose canonical EndPreparation', exact: true }).click();
  await page.getByRole('combobox', { name: 'Canonical EndPreparation for GATE VALVE' }).fill('MTE');
  await page.getByRole('option', { name: /^MTE \(331\)/ }).click();
  await expect(page.getByText('EndPreparation: MTE (331) · RESOLVED', { exact: true })).toBeVisible();
  await page.getByLabel('Candidate for GATE VALVE').selectOption('VLV-B-row');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Review: approved · VLV-B')).toBeVisible();
  expect(state.lastCandidate).toBe('VLV-B-row');
  await page.getByRole('button', { name: 'Refresh decisions' }).click();
  await expect(page.getByText('FlangeFacing: Raised face (5) · RESOLVED', { exact: true })).toBeVisible();
});
