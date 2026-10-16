import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPreparationOpportunities, proposalDraftFields, proposalEditPayload, proposalText } from '../src/pages/Sales/salesProposalDraft.js';
import { filterProposals, proposalBucket, proposalRowKey, proposalStatus } from '../src/pages/Sales/salesProposalRegister.js';

test('content editing preserves untouched structured evidence and normalizes only authored lists', () => {
  const saved = { scope: 'Scope', deliverables: [{ name: 'Design basis', rate: 99, cost: 123, source: { revision: 3, private: 'hidden' } }], assumptions: ['Existing assumption'], exclusions: [{ text: 'By others' }] };
  const draft = { ...proposalDraftFields(saved), assumptions: 'Reviewed assumption\nOne more', total_amount: '123.40' };
  assert.deepEqual(proposalEditPayload(draft, saved), { assumptions: ['Reviewed assumption', 'One more'], total_amount: '123.40' });
  assert.equal(proposalText(saved.deliverables), 'Design basis');
  assert.equal(JSON.stringify(proposalDraftFields(saved)).includes('hidden'), false);
  assert.equal(JSON.stringify(proposalDraftFields(saved)).includes('rate'), false);
});
test('candidate loader follows bounded local page numbers and rejects incomplete or duplicate results', async () => {
  const calls = [];
  const rows = await loadPreparationOpportunities(async ({ page }) => { calls.push(page); return { count: 2, results: [{ id: page, can_create_proposal: true }], next: page === 1 ? 'https://untrusted.example/page=2' : null }; });
  assert.deepEqual(calls, [1, 2]); assert.deepEqual(rows.map(row => row.id), [1, 2]);
  await assert.rejects(loadPreparationOpportunities(async () => ({ count: 2, results: [{ id: 1, can_create_proposal: true }], next: null })), /changed/);
  await assert.rejects(loadPreparationOpportunities(async () => ({ count: 2, results: [{ id: 1, can_create_proposal: true }], next: 'yes' })), /verified/);
});
test('preparation opportunities keep typed identity, stage label and actual opportunity owner filtering', () => {
  const row = { id: 'same', row_kind: 'preparation', owner: 3, stage: 'proposal' }, quote = { id: 'same', status: 'draft', prepared_by: 5 };
  assert.notEqual(proposalRowKey(row), proposalRowKey(quote)); assert.equal(proposalStatus(row), 'Proposal preparation'); assert.equal(proposalStatus(quote), 'Draft');
  assert.equal(proposalBucket(row), 'preparation'); assert.deepEqual(filterProposals([row, quote], { owner: '3' }), [row]);
});
