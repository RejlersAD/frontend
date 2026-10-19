import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';

const dialog = page => page.getByRole('dialog', { name: 'Record Go / No-Go Decision', exact: true });
const reason = page => dialog(page).getByRole('textbox', { name: 'Edit justification', exact: true });
const choose = (page, name) => dialog(page).getByRole('radio', { name }).click();
const save = page => dialog(page).getByRole('button', { name: 'Save Decision', exact: true });
const row = (page, index) => page.locator('.sor-table-scroll').getByRole('button', { name: `Q-${102101 + index}`, exact: true });
const selected = page => page.getByRole('complementary', { name: 'Opportunity details', exact: true });

async function openDecision(page, index = 0) {
  await row(page, index).click();
  await page.getByRole('button', { name: 'Close record', exact: true }).click();
  await selected(page).getByRole('button', { name: 'Record Go / No-Go', exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}

async function prepare(page, configuration = {}) {
  const state = await prepareRegister(page, {
    realShell: configuration.realShell,
    records: [opportunity(0, { stage: 'qualified', opportunity_type: configuration.type ?? 'tender', estimated_value: '10000.00', currency: 'AED' }), opportunity(1, { stage: 'qualified', opportunity_type: 'rfq' })],
  });
  const fixture = { aiRequests: [], decisions: [], completed: [], aborted: [], status: 200, hold: null, text: 'The saved scope supports this pursuit, subject to confirming delivery capacity.', responsePatch: null, ...configuration };
  page.on('requestfailed', request => { if (request.url().endsWith('/bid-decision-justification/')) fixture.aborted.push(request.postDataJSON()); });
  await page.route('**/api/v1/sales/deals/*/bid-decision*/', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const id = path.split('/deals/')[1].split('/')[0];
    const payload = request.postDataJSON();
    const record = state.records.find(item => item.id === id);
    if (path.endsWith('/bid-decision/')) {
      fixture.decisions.push({ id, payload });
      const result = { ...record, stage: payload.decision === 'no_bid' ? 'no_bid' : 'proposal', bid_decision: payload.decision, bid_decision_reason: payload.reason };
      state.records = state.records.map(item => item.id === id ? result : item);
      return route.fulfill({ json: result });
    }
    const attempt = { id, payload };
    fixture.aiRequests.push(attempt);
    const response = fixture.responsePatch || { text: fixture.text, source_context: { opportunity_id: id, opportunity_type: record.opportunity_type, opportunity_type_label: record.opportunity_type === 'rfq' ? 'RFQ' : record.opportunity_type === 'tender' ? 'Tender' : 'Not provided', decision: payload.decision, mode: payload.text.trim() ? 'rewrite' : 'draft', updated_at: record.updated_at } };
    const status = fixture.status;
    if (fixture.hold) await fixture.hold;
    await route.fulfill({ status, json: status === 200 ? response : { detail: status === 403 ? 'AI assistance permission denied.' : status === 409 ? 'The saved opportunity changed. Review its details before trying again.' : 'AI assistance is not configured. Your text is retained.', code: 'synthetic_ai_unavailable' } });
    fixture.completed.push(attempt);
  });
  await openDecision(page);
  return { fixture, state };
}


test('choosing Go drafts without saving and explicit save records reviewed wording', async ({ page }) => {
  const { fixture, state } = await prepare(page);
  await expect(save(page)).toBeDisabled();
  await choose(page, 'Go Pursue Go submission');
  await expect(dialog(page).locator('.sbd-source')).toHaveText('Backend AI');
  expect(fixture.aiRequests).toHaveLength(1);
  expect(fixture.aiRequests[0].payload.decision).toBe('bid');
  expect(fixture.decisions).toHaveLength(0);
  await dialog(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await reason(page).fill('Reviewed scope and capacity; proceed subject to confirming the client inputs.');
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(fixture.decisions).toEqual([{ id: 'opportunity-0', payload: { decision: 'bid', reason: 'Reviewed scope and capacity; proceed subject to confirming the client inputs.' } }]);
  expect(state.pageErrors).toEqual([]);
});

for (const status of [403, 409, 503]) test(`AI ${status} retains an editable record draft and retry can recover`, async ({ page }) => {
  const { fixture } = await prepare(page, { status });
  await choose(page, 'No-Go Decline this pursuit');
  await expect(dialog(page)).toContainText('Backend AI unavailable');
  await expect(dialog(page).locator('.sbd-source')).toHaveText('Record-based draft');
  await expect(save(page)).toBeEnabled();
  await dialog(page).getByRole('button', { name: 'Edit', exact: true }).click();
  await reason(page).fill('Manual rationale retained for review after the provider failed.');
  expect(fixture.decisions).toHaveLength(0);
  fixture.status = 200;
  await dialog(page).getByRole('button', { name: 'Regenerate', exact: true }).click();
  await expect(dialog(page).locator('.sbd-source')).toHaveText('Backend AI');
  expect(fixture.aiRequests[1].payload.decision).toBe('no_bid');
});

test('wrong-source AI cannot replace the current decision draft', async ({ page }) => {
  const { fixture } = await prepare(page, { responsePatch: { text: 'FOREIGN RESPONSE MUST NOT APPEAR', source_context: { opportunity_id: 'foreign', decision: 'bid', mode: 'rewrite' } } });
  await choose(page, 'Go Pursue Go submission');
  await expect(dialog(page)).toContainText('Backend AI unavailable');
  await expect(dialog(page)).not.toContainText('FOREIGN RESPONSE');
  expect(fixture.decisions).toHaveLength(0);
});

test('a changed decision ignores late output and cannot save while generation is pending', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { fixture } = await prepare(page, { hold, text: 'OLD GO RESPONSE MUST NOT APPEAR' });
  await choose(page, 'Go Pursue Go submission');
  await expect.poll(() => fixture.aiRequests.length).toBe(1);
  await expect(save(page)).toBeDisabled();
  fixture.hold = null;
  fixture.text = 'No-bid wording for the newly selected decision, subject to final review.';
  await choose(page, 'No-Go Decline this pursuit');
  await expect(dialog(page).locator('.sbd-source')).toHaveText('Backend AI');
  release();
  await expect.poll(() => fixture.completed.length).toBe(2);
  await expect(dialog(page)).not.toContainText('OLD GO RESPONSE');
  await save(page).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(fixture.decisions[0].payload).toEqual({ decision: 'no_bid', reason: 'No-Go wording for the newly selected decision, subject to final review.' });
});

test('closing a pending draft fences output from another opportunity', async ({ page }) => {
  let release;
  const hold = new Promise(resolve => { release = resolve; });
  const { fixture } = await prepare(page, { hold, text: 'OLD OPPORTUNITY RESPONSE MUST NOT APPEAR' });
  await choose(page, 'Go Pursue Go submission');
  await expect.poll(() => fixture.aiRequests.length).toBe(1);
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await openDecision(page, 1);
  release();
  await expect.poll(() => fixture.completed.length).toBe(1);
  await expect(save(page)).toBeDisabled();
  await expect(dialog(page)).not.toContainText('OLD OPPORTUNITY RESPONSE');
});

test('redesigned bid dialog is accessible at desktop and mobile widths', async ({ page }) => {
  await prepare(page, { realShell: true });
  await choose(page, 'Go Pursue Go submission');
  await expect(save(page)).toBeEnabled();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).include('.sbd-dialog').analyze()).violations).toEqual([]);
    expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});
