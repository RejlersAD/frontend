import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { prepareProposalRegister, proposalRegisterRow } from '../fixtures/sales-proposal-register-api';

const candidates = () => Array.from({ length: 4 }, (_, index) => ({ id: `pending-${index}`, deal_code: `Q-10310${index}`, deal_name: `Go preparation ${index}`, client: `prospect-${index}`, client_name: `Prospect client ${index}`, stage: 'proposal', bid_decision: index === 1 ? 'conditional_bid' : 'bid', opportunity_type: 'tender', submission_due_date: '2026-10-30', owner: 11, owner_name: 'Aisha Noor', currency: 'AED', updated_at: '2026-10-01T06:30:00Z', has_proposal: false, can_create_proposal: index !== 2, blocked_reason: index === 2 ? 'Client is inactive. Review the client record.' : '' }));
const register = page => page.getByRole('region', { name: 'Proposal register', exact: true });
const selected = page => page.getByLabel('Selected proposal', { exact: true });
const form = page => page.getByRole('dialog', { name: 'Create proposal from opportunity', exact: true });
const candidate = page => form(page).getByRole('combobox', { name: /^Qualified opportunity/ });
const text = (page, label = 'Scope and execution approach') => form(page).getByRole('textbox', { name: new RegExp(`^${label}`) });
const ai = (page, label = 'scope and execution approach') => form(page).getByRole('button', { name: new RegExp(`^(Write|Rewrite) ${label} with AI$`) });
const ready = async page => { await expect(register(page).getByRole('button', { name: 'Prepare proposal for Q-103100', exact: true })).toBeVisible(); };

async function prepare(page, options = {}) {
  const rows = Array.from({ length: 3 }, (_, index) => proposalRegisterRow(index, index === 0 ? { status: 'draft' } : {}));
  const state = await prepareProposalRegister(page, { rows, candidates: candidates(), ...options });
  const generation = { calls: [], status: 200, hold: null, completed: [], text: 'Reviewed AI proposal content.', sourceOverride: {}, ...options.generation };
  await page.route(/\/api\/v1\/sales\/(deals\/[^/]+\/proposal-draft-field|quotes\/[^/]+\/draft-field)\/$/, async route => {
    const path = new URL(route.request().url()).pathname, payload = route.request().postDataJSON(), isQuote = path.includes('/quotes/'), id = path.split(isQuote ? '/quotes/' : '/deals/')[1].split('/')[0];
    const row = state.rows.find(item => item.id === id), opportunityId = isQuote ? row.deal : id;
    const call = { path, payload }; generation.calls.push(call);
    const hold = generation.hold; if (hold) await hold;
    const status = generation.status;
    try { await route.fulfill({ status, json: status === 200 ? { text: generation.text, source_context: { opportunity_id: opportunityId, quote_id: isQuote ? id : null, field: payload.field, mode: payload.text.trim() ? 'rewrite' : 'draft', opportunity_type: 'tender', opportunity_type_label: 'Tender', ...generation.sourceOverride } } : { detail: 'AI drafting is unavailable. Your draft is retained.' } }); } catch { /* Browser cancellation is expected in stale-response cases. */ }
    generation.completed.push(call);
  });
  return { state, generation };
}
async function openCreate(page, id = 'pending-0') {
  await page.getByRole('button', { name: 'New proposal', exact: true }).click();
  await expect(candidate(page)).toBeEnabled();
  await candidate(page).selectOption(id);
}
async function required(page) {
  await form(page).getByLabel(/^Proposal number/).fill('PROP-REVIEWED-100');
  await form(page).getByLabel(/^Valid until/).fill('2026-12-31');
  await form(page).getByLabel(/^Proposed price/).fill('1234.50');
  await form(page).getByLabel(/^Estimated delivery cost/).fill('900.25');
  await form(page).getByLabel(/^Total estimated hours/).fill('80');
  await text(page).fill('Reviewed scope.'); await text(page, 'Deliverables').fill('Design basis\nRegister');
}

test('Go opportunities appear as preparation rows without Quote identity or lifecycle actions', async ({ page }) => {
  const { state } = await prepare(page); await ready(page);
  await register(page).getByRole('button', { name: 'Prepare proposal for Q-103100', exact: true }).dblclick();
  const panel = page.getByRole('region', { name: 'Proposal preparation opportunity' });
  await expect(panel).toContainText('Proposal preparation'); await expect(panel).toContainText('Not created');
  await expect(panel.getByRole('button', { name: /Approve|Submit|Edit/ })).toHaveCount(0);
  expect(state.requests.some(item => item.path.includes('/quotes/pending-'))).toBe(false);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export', exact: true }).click(); await download;
  expect(state.exports[0].body.ids.split(',')).toEqual(state.rows.map(row => row.id));
  await register(page).getByRole('tab', { name: 'Preparation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeDisabled();
  await register(page).getByRole('button', { name: 'Prepare proposal for Q-103102', exact: true }).click();
  await expect(panel).toContainText('Client is inactive'); await expect(panel.getByRole('button', { name: 'Prepare proposal', exact: true })).toBeDisabled();
  await expect(panel.getByRole('link', { name: 'View client', exact: true })).toHaveAttribute('href', '/sales/clients?record=prospect-2');
});

test('Prepare proposal preselects an authoritative paginated Prospect candidate and removes pending row after explicit creation', async ({ page }) => {
  const { state } = await prepare(page); await ready(page);
  await register(page).getByRole('button', { name: 'Prepare proposal for Q-103103', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
  await expect(candidate(page)).toBeEnabled(); await expect(candidate(page)).toHaveValue('pending-3');
  expect(state.requests.filter(item => item.path.endsWith('/clients/'))).toEqual([]);
  expect(state.requests.some(item => item.path.endsWith('/preparation-opportunities/') && item.search.includes('pending_only=false') && item.search.includes('page=2'))).toBe(true);
  await required(page); await form(page).getByRole('button', { name: 'Create draft proposal', exact: true }).click();
  await expect(form(page)).toHaveCount(0); await expect(selected(page)).toContainText('Go preparation 3');
  await expect(register(page).getByRole('button', { name: 'Prepare proposal for Q-103103', exact: true })).toHaveCount(0);
  expect(state.mutations[0].body.client).toBe('prospect-3'); expect(state.mutations[0].body.total_amount).toBe('1234.50');
  expect(state.mutations[0].body).not.toHaveProperty('_opportunity'); expect(state.mutations[0].body).not.toHaveProperty('_editEpoch');
});

test('candidate denial and empty recovery keep manual form content', async ({ page }) => {
  const { state } = await prepare(page, { candidateStatus: 403 }); await ready(page);
  await page.getByRole('button', { name: 'New proposal', exact: true }).click();
  await expect(form(page).getByRole('alert')).toContainText('unavailable');
  await text(page).fill('Keep my unsaved scope.');
  await expect(form(page).getByRole('button', { name: 'Create draft proposal', exact: true })).toBeDisabled();
  state.candidateStatus = 200; state.candidates = [];
  await form(page).getByRole('button', { name: 'Retry opportunities' }).click();
  await expect(form(page)).toContainText('No opportunities with a Go decision');
  state.candidates = candidates(); await form(page).getByRole('button', { name: 'Refresh opportunities' }).click();
  await expect(candidate(page)).toBeEnabled(); await candidate(page).selectOption('pending-3');
  await expect(text(page)).toHaveValue('Keep my unsaved scope.');
});

test('readiness failure stays visible without hiding saved proposals and retry restores pending rows', async ({ page }) => {
  const { state } = await prepare(page, { readinessStatus: 503 });
  await expect(page.getByRole('alert')).toContainText('Preparation opportunities could not be loaded');
  await expect(register(page).getByRole('button', { name: /^Select proposal / })).toHaveCount(3);
  state.readinessStatus = 200; await page.getByRole('button', { name: 'Retry preparation opportunities' }).click(); await ready(page);
});

test('all four create fields draft or rewrite with AI, Undo works and failed creation retains reviewed text', async ({ page }) => {
  const { state, generation } = await prepare(page, { createStatuses: [400, 200] }); await openCreate(page);
  for (const label of ['Scope and execution approach', 'Deliverables', 'Assumptions', 'Exclusions']) {
    generation.text = `${label} reviewed suggestion.`; await ai(page, label.toLowerCase()).click(); await expect(text(page, label)).toHaveValue(generation.text);
  }
  expect(generation.calls.map(call => call.payload.field)).toEqual(['scope', 'deliverables', 'assumptions', 'exclusions']); expect(state.mutations).toEqual([]);
  generation.text = 'Rewritten exclusion.'; await ai(page, 'exclusions').click(); await expect(text(page, 'Exclusions')).toHaveValue(generation.text);
  await text(page, 'Exclusions').locator('..').getByRole('button', { name: 'Undo AI text' }).click();
  await expect(text(page, 'Exclusions')).toHaveValue('Exclusions reviewed suggestion.');
  await required(page); await form(page).getByRole('button', { name: 'Create draft proposal', exact: true }).click();
  await expect(form(page)).toContainText('could not be saved'); await expect(text(page, 'Exclusions')).toHaveValue('Exclusions reviewed suggestion.');
  await form(page).getByRole('button', { name: 'Create draft proposal', exact: true }).click(); await expect(form(page)).toHaveCount(0);
  expect(state.mutations.at(-1).body.assumptions).toEqual(['Assumptions reviewed suggestion.']);
});

for (const status of [403, 409, 503]) test(`AI ${status} preserves the draft and explicit retry can recover`, async ({ page }) => {
  const { generation, state } = await prepare(page); await openCreate(page); await text(page).fill('My reviewed scope.');
  generation.status = status; await ai(page).click(); await expect(form(page).getByRole('alert')).toContainText('draft is retained'); await expect(text(page)).toHaveValue('My reviewed scope.');
  generation.status = 200; await ai(page).click(); await expect(text(page)).toHaveValue(generation.text); expect(state.mutations).toEqual([]);
});

test('manual edits and sibling edit-then-restore invalidate late AI without duplicate generation', async ({ page }) => {
  const { generation } = await prepare(page); await openCreate(page); await text(page).fill('Original scope.');
  let release; generation.hold = new Promise(resolve => { release = resolve; });
  await ai(page).click(); await expect.poll(() => generation.calls.length).toBe(1); await expect(ai(page)).toBeDisabled();
  await text(page, 'Assumptions').fill('Temporary sibling draft'); await text(page, 'Assumptions').fill('');
  release(); await expect.poll(() => generation.completed.length).toBe(1); await expect(text(page)).toHaveValue('Original scope.');
  generation.hold = null; await ai(page).click(); await expect(text(page)).toHaveValue(generation.text);
  let releaseTarget; generation.hold = new Promise(resolve => { releaseTarget = resolve; });
  await ai(page).click(); await expect.poll(() => generation.calls.length).toBe(3); await text(page).fill('Manual revision wins.');
  releaseTarget(); await expect.poll(() => generation.completed.length).toBe(3); await expect(text(page)).toHaveValue('Manual revision wins.');
});

test('opportunity changes and dialog close fence obsolete AI responses', async ({ page }) => {
  const { generation } = await prepare(page); await openCreate(page); await text(page).fill('Retained for review.');
  let release; generation.hold = new Promise(resolve => { release = resolve; });
  await ai(page).click(); await expect.poll(() => generation.calls.length).toBe(1); await candidate(page).selectOption('pending-1');
  release(); await expect.poll(() => generation.completed.length).toBe(1); await expect(text(page)).toHaveValue('Retained for review.');
  let releaseClosed; generation.hold = new Promise(resolve => { releaseClosed = resolve; });
  await ai(page).click(); await expect.poll(() => generation.calls.length).toBe(2); await form(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await openCreate(page, 'pending-3'); await text(page).fill('New dialog content.'); releaseClosed();
  await expect.poll(() => generation.completed.length).toBe(2); await expect(text(page)).toHaveValue('New dialog content.');
});

test('wrong source AI results are rejected and explicit creation while AI runs saves manual content only', async ({ page }) => {
  const { generation, state } = await prepare(page); await openCreate(page); await required(page);
  generation.sourceOverride = { opportunity_id: 'other-opportunity' }; await ai(page).click();
  await expect(form(page).getByRole('alert')).toContainText('could not be verified'); await expect(text(page)).toHaveValue('Reviewed scope.');
  generation.sourceOverride = {}; let release; generation.hold = new Promise(resolve => { release = resolve; });
  await ai(page).click(); await expect.poll(() => generation.calls.length).toBe(2);
  await form(page).getByRole('button', { name: 'Create draft proposal', exact: true }).click(); await expect(form(page)).toHaveCount(0);
  release(); await expect.poll(() => generation.completed.length).toBe(2); expect(state.mutations.at(-1).body.scope).toBe('Reviewed scope.');
});

test('saved proposal content keeps structured evidence private and unchanged arrays out of failed and retried saves', async ({ page }) => {
  const rows = [proposalRegisterRow(0, { status: 'draft', deliverables: [{ name: 'Design basis', rate: 123, cost: 987, metadata: { hidden: 'private-evidence' } }], exclusions: [{ text: 'By others', internal: 'private-exclusion' }] })];
  const { state, generation } = await prepare(page, { rows, patchStatuses: { [rows[0].id]: [403, 200] } });
  await expect(selected(page).getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
  await selected(page).getByRole('tab', { name: 'Preparation', exact: true }).click();
  await selected(page).getByRole('button', { name: 'Edit proposal content', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Proposal record', exact: true });
  await expect(editor.getByRole('textbox', { name: 'Deliverables', exact: true })).toHaveValue('Design basis');
  await editor.getByRole('button', { name: 'Rewrite scope with AI', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Scope', exact: true })).toHaveValue(generation.text);
  expect(generation.calls[0].path).toContain(`/quotes/${rows[0].id}/draft-field/`);
  expect(JSON.stringify(generation.calls[0].payload)).not.toMatch(/private|987|123|metadata|internal/);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(editor).toContainText('draft is retained');
  await expect(editor.getByRole('textbox', { name: 'Scope', exact: true })).toHaveValue(generation.text);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(state.mutations.every(mutation => !Object.hasOwn(mutation.body, 'deliverables') && !Object.hasOwn(mutation.body, 'exclusions'))).toBe(true);
  expect(state.rows[0].deliverables).toEqual(rows[0].deliverables);
});

test('saved form submission cancels pending generation and persists only explicit edited arrays', async ({ page }) => {
  const { state, generation } = await prepare(page); await selected(page).getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Proposal record', exact: true });
  await editor.getByRole('textbox', { name: 'Assumptions', exact: true }).fill('Reviewed assumption\nSecond assumption');
  let release; generation.hold = new Promise(resolve => { release = resolve; });
  await editor.getByRole('button', { name: 'Rewrite scope with AI', exact: true }).click(); await expect.poll(() => generation.calls.length).toBe(1);
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'Scope', exact: true })).toHaveCount(0); release(); await expect.poll(() => generation.completed.length).toBe(1);
  expect(state.mutations[0].body.assumptions).toEqual(['Reviewed assumption', 'Second assumption']); expect(state.mutations[0].body).not.toHaveProperty('scope');
});

test('real shell preparation and four AI fields remain accessible at desktop and mobile widths', async ({ page }, testInfo) => {
  test.setTimeout(120000); await page.setViewportSize({ width: 1366, height: 900 });
  const { state } = await prepare(page, { entry: '/sales/proposals' }); await ready(page);
  await register(page).getByRole('button', { name: 'Prepare proposal for Q-103100', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Proposal preparation opportunity' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('preparation-register-desktop.png'), fullPage: true });
  const registerAudit = await new AxeBuilder({ page }).include('.spg-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(registerAudit.violations).toEqual([]);
  await openCreate(page); await required(page);
  for (const [name, viewport] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await page.setViewportSize(viewport); await ai(page).scrollIntoViewIfNeeded(); await expect(ai(page)).toBeInViewport();
    const audit = await new AxeBuilder({ page }).include('[aria-labelledby="sales-action-title"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(audit.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`proposal-content-${name}.png`), fullPage: true });
  }
  expect(state.pageErrors).toEqual([]);
});
