import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareRegister, opportunity } from '../fixtures/sales-opportunity-register-api';

const dialog = (page, name = 'Record Go / No-Go Decision') => page.getByRole('dialog', { name, exact: true });
const choose = (page, label, name) => dialog(page, name).getByRole('radio', { name: label }).click();
const save = (page, name) => dialog(page, name).getByRole('button', { name: 'Save Decision', exact: true });

const intelligence = (id) => ({
  opportunity_id: id, status: 'partial', counts: { total: 2, ready: 1, partial: 1 },
  result: { manager_review: { tender_evaluation: { opportunity_summary: {
    client_name: 'ADNOC Onshore', submission_date: '2026-11-12', project_facts: {
      scope: [{ value: 'Survey utility networks using an acoustic camera', source_file: 'SOW.pdf', source_page: 'Page 2' }],
      deliverables: [{ value: 'Submit a leak detection survey report', source_file: 'SOW.pdf', source_page: 'Page 5' }],
      payment_terms: [{ value: '100% after survey report acceptance', source_file: 'SOW.pdf', source_page: 'Page 8' }],
      submission_details: [{ value: 'Submission is at 10.58 AM today.', relative_date: '2026-11-12',
        source_file: 'Invitation.eml', source_page: 'Email body' }],
    },
  } } } },
});

async function prepare(page, records = [opportunity(0, { stage: 'qualified', opportunity_type: 'eoi',
  client_name: 'ADNOC Onshore', submission_due_date: '2026-11-12' })]) {
  const requests = { ai: [], decisions: [] };
  const state = await prepareRegister(page, { records });
  await page.route('**/api/v1/sales/deals/*/analysis/', (route) => {
    const id = new URL(route.request().url()).pathname.split('/deals/')[1].split('/')[0];
    return route.fulfill({ json: intelligence(id) });
  });
  await page.route('**/api/v1/sales/deals/*/bid-decision-justification/', (route) => {
    requests.ai.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { detail: 'AI configuration unavailable' } });
  });
  await page.route('**/api/v1/sales/deals/*/bid-decision/', (route) => {
    const payload = route.request().postDataJSON();
    const id = new URL(route.request().url()).pathname.split('/deals/')[1].split('/')[0];
    requests.decisions.push({ id, payload });
    const record = state.records.find((item) => item.id === id);
    const result = { ...record, stage: payload.decision === 'no_bid' ? 'no_bid' : 'proposal',
      bid_decision: payload.decision, bid_decision_reason: payload.reason };
    state.records = state.records.map((item) => item.id === id ? result : item);
    return route.fulfill({ json: result });
  });
  return { state, requests };
}

async function open(page, index = 0, action = 'Record Go / No-Go') {
  await page.locator('.sor-table-scroll').getByRole('button', { name: `Q-${102101 + index}`, exact: true }).click();
  await page.getByRole('button', { name: 'Close record', exact: true }).click();
  await page.getByRole('complementary', { name: 'Opportunity details', exact: true })
    .getByRole('button', { name: action, exact: true }).click();
  const name = action.startsWith('Reverse') ? 'Reverse Go / No-Go Decision' : 'Record Go / No-Go Decision';
  await expect(dialog(page, name)).toBeVisible();
  return name;
}

test('Go draft uses Opportunity Intelligence and saves without an AI request', async ({ page }) => {
  const { requests } = await prepare(page);
  const name = await open(page);
  await choose(page, 'Go Pursue submission', name);
  await expect(dialog(page, name).getByText('12 Nov 2026 · 10:58 AM (time zone not stated)')).toBeVisible();
  await expect(dialog(page, name).getByRole('textbox', { name: 'Decision Justification *' })).toContainText('Survey utility networks using an acoustic camera');
  await expect(dialog(page, name).getByRole('textbox', { name: 'Decision Justification *' })).toContainText('Submit a leak detection survey report');
  await expect(dialog(page, name)).not.toContainText('Backend AI unavailable');
  await expect(save(page, name)).toBeEnabled();
  await save(page, name).click();
  expect(requests.ai).toHaveLength(0);
  expect(requests.decisions).toHaveLength(1);
  expect(requests.decisions[0].payload.decision).toBe('bid');
  expect(requests.decisions[0].payload.reason).toContain('Survey utility networks');
});

test('No-Go requires a specific reason in the justification textbox', async ({ page }) => {
  const { requests } = await prepare(page);
  const name = await open(page);
  await choose(page, 'No-Go Decline pursuit', name);
  await expect(save(page, name)).toBeDisabled();
  await expect(dialog(page, name).getByRole('textbox', { name: 'Decision Justification *' })).not.toContainText('100% subcontracting');
  await dialog(page, name).getByRole('textbox', { name: 'Decision Justification *' })
    .fill('The survey would be fully subcontracted with no Rejlers value addition.');
  await expect(save(page, name)).toBeEnabled();
  await save(page, name).click();
  expect(requests.ai).toHaveLength(0);
  expect(requests.decisions[0].payload.decision).toBe('no_bid');
  expect(requests.decisions[0].payload.reason).toContain('fully subcontracted');
});

test('three No-Go predictions can draft an editable reason from tender evidence', async ({ page }) => {
  const { requests } = await prepare(page);
  const name = await open(page);
  const order = await dialog(page, name).locator('section[aria-label]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('aria-label')));
  expect(order.slice(0, 3)).toEqual(['Opportunity snapshot', 'Decision justification', 'Decision']);
  await expect(dialog(page, name).getByText('Decision Insights')).toHaveCount(0);
  await expect(dialog(page, name).getByText(/evidence grounding this draft/i)).toHaveCount(0);
  const options = dialog(page, name).getByRole('group', { name: 'Suggested No-Go reasons' });
  await expect(options.getByRole('button')).toHaveCount(3);
  await options.getByRole('button', { name: /Commercial and margin uncertainty/ }).click();
  const reason = dialog(page, name).getByRole('textbox', { name: 'Decision Justification *' });
  await expect(reason).toContainText('100% after survey report acceptance');
  await expect(reason).toContainText('Business prediction:');
  await choose(page, 'Go Pursue submission', name);
  await expect(reason).not.toContainText('Business prediction:');
  await options.getByRole('button', { name: /Commercial and margin uncertainty/ }).click();
  await choose(page, 'No-Go Decline pursuit', name);
  await reason.fill('The cost model confirms this payment basis falls below our target margin.');
  await save(page, name).click();
  expect(requests.decisions[0].payload.reason).toContain('target margin');
  expect(requests.ai).toHaveLength(0);
});

test('reversal remains an explicit decision action', async ({ page }) => {
  const { requests } = await prepare(page, [opportunity(0, { stage: 'proposal', bid_decision: 'bid',
    bid_decision_reason: 'Original Go decision.' })]);
  const name = await open(page, 0, 'Reverse Go / No-Go decision');
  await choose(page, 'No-Go Decline pursuit', name);
  await expect(save(page, name)).toBeDisabled();
  await dialog(page, name).getByRole('textbox', { name: 'Decision Justification *' })
    .fill('The required specialist service is outside approved delivery capability.');
  await save(page, name).click();
  expect(requests.decisions[0].payload.expected_decision).toBe('bid');
  expect(requests.ai).toHaveLength(0);
});

test('decision dialog remains accessible and fits narrow screens', async ({ page }) => {
  await prepare(page);
  const name = await open(page);
  await choose(page, 'No-Go Decline pursuit', name);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await new AxeBuilder({ page }).include('.sbd-dialog').analyze()).violations).toEqual([]);
    expect(await dialog(page, name).evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});
