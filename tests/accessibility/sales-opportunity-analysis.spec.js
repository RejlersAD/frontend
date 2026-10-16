import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';

const pane = page => page.getByRole('region', { name: 'Opportunity analysis', exact: true });
const citation = { text: 'The client requires a technical inspection proposal.', excerpt: 'Technical inspection proposal is required.',
  name: 'Invitation.eml', location: 'Email body, part 1', source_id: 1, date: '', kind: 'brief' };
const ready = id => ({ opportunity_id: id, id: `analysis-${id}`, status: 'partial', stale: false,
  ai_ready: true, updated_at: '2026-10-15T08:00:00Z', counts: { total: 501, ready: 500, partial: 1, chunks_total: 600, chunks_done: 600 },
  coverage_note: 'One scanned page needs OCR.', result: {
    sections: { brief: [citation], client_need: [citation], next_step: [citation], submission: [citation], risk: [citation], action: [citation],
      deadline: [{ ...citation, date: '2026-12-01', text: 'Submit the technical proposal by 1 December.' }] },
    item_counts: { risk: 1, action: 1 }, relationships: [{ kind: 'shared_reference', reference: 'RFQ-2026-100', sources: [{ name: 'Invitation.eml' }, { name: 'Scope.pdf' }] }], deadline_dates: ['2026-12-01'],
  } });

async function setup(page, { status = 'partial', denied = false, noMatch = false, realShell = false } = {}) {
  const state = await prepareRegister(page, { realShell, records: [opportunity(0), opportunity(1)] });
  const requests = [];
  await page.route('**/api/v1/sales/deals/*/analysis/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.pathname.split('/deals/')[1].split('/')[0];
    requests.push({ method: request.method(), id, path: url.pathname });
    if (denied) return route.fulfill({ status: 403, json: { detail: 'Analysis export access denied.' } });
    const payload = ready(noMatch ? 'other-opportunity' : id);
    if (url.pathname.endsWith('/sources/')) return route.fulfill({ json: { ...payload, sources: [{ id: 1, name: 'Scanned scope.pdf', provider: 'radai', status: 'partial', diagnostic: status === 'failed' ? '' : 'some_pages_have_no_text', analysis_error: status === 'failed' ? 'invalid_evidence' : '', claims: status === 'failed' ? [] : [citation] }], next_offset: null } });
    return route.fulfill({ json: { ...payload, status, ...(status === 'queued' ? { result: {}, counts: { total: 501, chunks_total: 600, chunks_done: 42 } } : {}),
      ...(status === 'failed' ? { error_code: 'no_verified_source_results', counts: { total: 3, ready: 0, partial: 3, chunks_total: 3, chunks_done: 0, chunks_failed: 3 },
        result: { sections: Object.fromEntries(Object.keys(payload.result.sections).map(key => [key, []])), item_counts: { risk: 0, action: 0 }, relationships: payload.result.relationships } } : {}) } });
  });
  await page.locator('.sor-table-scroll').getByRole('button', { name: 'Q-102101', exact: true }).click();
  await page.getByRole('button', { name: 'Close record', exact: true }).click();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  return { state, requests };
}

test('Analysis presents a cited executive brief, requirements, dates, relationships and downloadable deliverable', async ({ page }) => {
  const { state } = await setup(page);
  await expect(pane(page).getByRole('heading', { name: 'What is this opportunity?', exact: true })).toBeVisible();
  await expect(pane(page)).toContainText('Partial analysis');
  await pane(page).getByRole('button', { name: 'Sources', exact: true }).click();
  await expect(pane(page)).toContainText('501 sources inventoried');
  await pane(page).getByRole('button', { name: 'Brief', exact: true }).click();
  await expect(pane(page)).toContainText('RFQ-2026-100');
  await pane(page).locator('summary').first().click();
  await expect(pane(page).locator('blockquote').first()).toContainText('Technical inspection proposal is required.');
  await pane(page).getByRole('button', { name: 'Submissions', exact: true }).click();
  await expect(pane(page).getByRole('heading', { name: 'What do we need to submit?' })).toBeVisible();
  await pane(page).getByRole('button', { name: 'Timeline', exact: true }).click();
  await expect(pane(page)).toContainText('2026-12-01');
  const download = page.waitForEvent('download');
  await pane(page).getByRole('button', { name: 'Download brief', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('Q-102101-analysis.md');
  expect(state.pageErrors).toEqual([]);
});

test('source coverage exposes partial extraction and supports evidence inspection', async ({ page }) => {
  await setup(page);
  await pane(page).getByRole('button', { name: 'Sources', exact: true }).click();
  await expect(pane(page)).toContainText('Scanned scope.pdf');
  await expect(pane(page)).toContainText('some pages have no text');
  await pane(page).locator('.soa-sources summary').click();
  await expect(pane(page).locator('.soa-sources blockquote')).toBeVisible();
});

test('background processing is honest and hides unverified brief output', async ({ page }) => {
  await setup(page, { status: 'queued' });
  await expect(pane(page)).toContainText('42 of 600 text sections analyzed');
  await expect(pane(page)).toContainText('Building your executive brief');
  await expect(pane(page).getByRole('button', { name: 'Download brief' })).toBeDisabled();
});

test('failed AI analysis shows an actionable error instead of empty success findings', async ({ page }) => {
  await setup(page, { status: 'failed' });
  await expect(pane(page)).toContainText('3 text sections failed AI analysis');
  await expect(pane(page)).not.toContainText('Not established from the analyzed sources');
  await expect(pane(page).getByRole('button', { name: 'Download brief' })).toBeDisabled();
  await pane(page).getByRole('button', { name: 'Review source coverage' }).click();
  await expect(pane(page)).toContainText('AI findings could not be verified against this source.');
  await expect(pane(page).getByRole('button', { name: 'Retry incomplete sources' })).toBeEnabled();
});

test('new source changes automatically queue refresh and hide the prior brief', async ({ page }) => {
  await setup(page);
  await expect(pane(page)).toContainText(citation.text);
  let posts = 0;
  await page.route('**/api/v1/sales/deals/*/analysis/', async route => {
    const request = route.request();
    const payload = ready('opportunity-0');
    if (request.method() === 'POST') posts++;
    return route.fulfill({ json: { ...payload, stale: request.method() !== 'POST', status: 'queued',
      result: {}, counts: { total: 502, chunks_total: 0, chunks_done: 0 } } });
  });
  await expect.poll(() => posts, { timeout: 25000 }).toBeGreaterThan(0);
  await expect(pane(page)).toContainText('Building your executive brief');
  await expect(pane(page)).not.toContainText(citation.text);
});

test('denied and wrong-opportunity responses show errors without leaking cached findings', async ({ page }) => {
  await setup(page, { denied: true });
  await expect(pane(page).getByRole('alert')).toContainText('Analysis export access denied.');
  await expect(pane(page)).not.toContainText(citation.text);
  await page.unroute('**/api/v1/sales/deals/*/analysis/**');
  await page.route('**/api/v1/sales/deals/*/analysis/**', route => route.fulfill({ json: ready('wrong-record') }));
  await pane(page).getByRole('button', { name: 'Try again' }).click();
  await expect(pane(page).getByRole('alert')).toContainText('does not match this opportunity');
});

test('keyboard tab navigation and responsive Analysis remain accessible', async ({ page }) => {
  await setup(page);
  await expect(pane(page).getByRole('heading', { name: 'What is this opportunity?', exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.soa').analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('tab', { name: 'Analysis', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Activity', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Analysis', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(pane(page)).toBeVisible();
  expect(await pane(page).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await pane(page).screenshot({ path: 'artifacts/opportunity-analysis/analysis-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await pane(page).screenshot({ path: 'artifacts/opportunity-analysis/analysis-desktop.png' });
});
