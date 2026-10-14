import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';

const dialog = page => page.getByRole('dialog', { name: 'Record bid/no-bid decision', exact: true });
const reason = page => dialog(page).getByRole('textbox', { name: 'Decision justification', exact: true });
const decision = page => dialog(page).getByRole('combobox', { name: /^Decision\s*\*?$/ });
const ai = page => dialog(page).getByRole('button', { name: /^(Write|Rewrite) with AI$/ });
const row = (page, index) => page.locator('.sor-table-scroll').getByRole('button', { name: `Q-${102101 + index}`, exact: true });
const selected = page => page.getByRole('complementary', { name: 'Opportunity details', exact: true });

async function openDecision(page, index = 0) {
  await row(page, index).click();
  await selected(page).getByRole('button', { name: 'Record bid/no-bid', exact: true }).click();
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

test('AI drafts from the chosen decision and saved type without recording the decision', async ({ page }) => {
  const { fixture, state } = await prepare(page);
  await expect(decision(page)).toHaveValue('bid');
  await expect(ai(page)).toHaveAccessibleName('Write with AI');
  await ai(page).press('Enter');
  await expect(reason(page)).toHaveValue(fixture.text);
  await expect(dialog(page)).toContainText('Opportunity Type: Tender');
  await expect(decision(page)).toHaveValue('bid');
  expect(fixture.aiRequests).toEqual([{ id: 'opportunity-0', payload: { decision: 'bid', text: '' } }]);
  expect(fixture.decisions).toEqual([]);
  await reason(page).fill('Reviewed wording with our confirmed delivery conditions.');
  await dialog(page).getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(dialog(page)).not.toBeVisible();
  expect(fixture.decisions).toEqual([{ id: 'opportunity-0', payload: { decision: 'bid', reason: 'Reviewed wording with our confirmed delivery conditions.' } }]);
  expect(state.pageErrors).toEqual([]);
});

test('AI rewrites existing text for the selected decision and Undo restores the original draft', async ({ page }) => {
  const { fixture } = await prepare(page, { type: '' });
  await decision(page).selectOption('no_bid');
  await reason(page).fill('Capacity is already allocated to another project.');
  await expect(ai(page)).toHaveAccessibleName('Rewrite with AI');
  await ai(page).click();
  await expect(reason(page)).toHaveValue(fixture.text);
  await expect(dialog(page)).toContainText('Opportunity Type: Not provided');
  expect(fixture.aiRequests[0].payload).toEqual({ decision: 'no_bid', text: 'Capacity is already allocated to another project.' });
  await dialog(page).getByRole('button', { name: 'Undo AI text', exact: true }).click();
  await expect(reason(page)).toHaveValue('Capacity is already allocated to another project.');
  await expect(reason(page)).toBeFocused();
  await expect(decision(page)).toHaveValue('no_bid');
  expect(fixture.decisions).toEqual([]);
});

for (const status of [403, 409, 503]) test(`AI ${status} preserves the manual draft and allows an explicit retry`, async ({ page }) => {
  const { fixture } = await prepare(page, { status });
  await reason(page).fill('Retain my reviewed justification.');
  await ai(page).click();
  await expect(dialog(page).getByRole('alert')).toBeVisible();
  await expect(reason(page)).toHaveValue('Retain my reviewed justification.');
  await expect(reason(page)).toBeEnabled();
  expect(fixture.aiRequests).toHaveLength(1);
  fixture.status = 200;
  await ai(page).click();
  await expect(reason(page)).toHaveValue(fixture.text);
  expect(fixture.aiRequests[1].payload).toEqual(fixture.aiRequests[0].payload);
  expect(fixture.decisions).toEqual([]);
});

test('a response for another source cannot replace the justification', async ({ page }) => {
  const { fixture } = await prepare(page, { responsePatch: { text: 'Wrong source text', source_context: { opportunity_id: 'another-opportunity', decision: 'bid', mode: 'rewrite' } } });
  await reason(page).fill('Original justification.');
  await ai(page).click();
  await expect(dialog(page).getByRole('alert')).toContainText('could not be verified');
  await expect(reason(page)).toHaveValue('Original justification.');
  expect(fixture.decisions).toEqual([]);
});

test('manual editing cancels pending AI even when the user returns to the original text', async ({ page }) => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const { fixture } = await prepare(page, { hold });
  await reason(page).fill('Original text.');
  await ai(page).dblclick();
  await expect.poll(() => fixture.aiRequests.length).toBe(1);
  await expect(ai(page)).toBeDisabled();
  await reason(page).fill('Changed manually.');
  await reason(page).fill('Original text.');
  await expect.poll(() => fixture.aborted.length).toBe(1);
  release(); await expect.poll(() => fixture.completed.length).toBe(1);
  await expect(reason(page)).toHaveValue('Original text.');
  await expect(ai(page)).toBeEnabled();
  expect(fixture.decisions).toEqual([]);
});

test('changing the decision cancels old AI output while retaining the existing draft', async ({ page }) => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const { fixture } = await prepare(page, { hold });
  await reason(page).fill('My current reasoning.');
  await ai(page).click(); await expect.poll(() => fixture.aiRequests.length).toBe(1);
  await decision(page).selectOption('conditional_bid');
  await expect.poll(() => fixture.aborted.length).toBe(1);
  fixture.hold = null; release(); await expect.poll(() => fixture.completed.length).toBe(1);
  await expect(reason(page)).toHaveValue('My current reasoning.');
  await ai(page).click(); await expect(reason(page)).toHaveValue(fixture.text);
  expect(fixture.aiRequests[1].payload).toEqual({ decision: 'conditional_bid', text: 'My current reasoning.' });
  await expect(decision(page)).toHaveValue('conditional_bid');
});

test('closing and opening another opportunity cannot receive a late previous suggestion', async ({ page }) => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const { fixture } = await prepare(page, { hold });
  await ai(page).click(); await expect.poll(() => fixture.aiRequests.length).toBe(1);
  await dialog(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect.poll(() => fixture.aborted.length).toBe(1);
  await openDecision(page, 1); await reason(page).fill('Second opportunity draft.');
  fixture.hold = null; release(); await expect.poll(() => fixture.completed.length).toBe(1);
  await expect(reason(page)).toHaveValue('Second opportunity draft.');
  await ai(page).click(); await expect(reason(page)).toHaveValue(fixture.text);
  await expect(dialog(page)).toContainText('Opportunity Type: RFQ');
  expect(fixture.aiRequests[1].id).toBe('opportunity-1');
});

test('explicit decision submission cancels pending AI and records only the reviewed manual text', async ({ page }) => {
  let release; const hold = new Promise(resolve => { release = resolve; });
  const { fixture } = await prepare(page, { hold });
  await reason(page).fill('Reviewed manual reason.');
  await ai(page).click(); await expect.poll(() => fixture.aiRequests.length).toBe(1);
  await dialog(page).getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(dialog(page)).not.toBeVisible();
  await expect.poll(() => fixture.aborted.length).toBe(1);
  release(); await expect.poll(() => fixture.completed.length).toBe(1);
  expect(fixture.decisions).toEqual([{ id: 'opportunity-0', payload: { decision: 'bid', reason: 'Reviewed manual reason.' } }]);
  await expect(selected(page).getByRole('button', { name: 'Enter negotiation', exact: true })).toBeVisible();
});

test('actual application dialog keeps AI assistance accessible on desktop and mobile', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1366, height: 900 });
  const { fixture, state } = await prepare(page, { realShell: true });
  await decision(page).selectOption('conditional_bid');
  await ai(page).click(); await expect(reason(page)).toHaveValue(fixture.text);
  for (const [name, viewport] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport);
    await expect(ai(page)).toBeInViewport();
    await expect(dialog(page).getByRole('button', { name: 'Record decision', exact: true })).toBeInViewport();
    const audit = await new AxeBuilder({ page }).include('[aria-labelledby="sales-action-title"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`bid-justification-${name}.png`), fullPage: true });
  }
  expect(fixture.decisions).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});
