import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterProposals, loadProposalRegister, proposalApproved, proposalBucket, proposalChecklist,
  proposalDeadline, proposalOwner, proposalRevision, proposalStatus, proposalSubmitted, sortProposals,
} from '../src/pages/Sales/salesProposalRegister.js';

test('register follows complete scoped pages without following response-provided URLs', async () => {
  const calls = [];
  const result = await loadProposalRegister(async params => {
    calls.push(params);
    return params.page === 1 ? { count: 2, results: [{ id: 'one' }], next: 'https://untrusted.example/other-account' }
      : { count: 2, results: [{ id: 'two' }], next: null };
  });
  assert.deepEqual(result.results.map(row => row.id), ['one', 'two']);
  assert.equal(result.count, 2);
  assert.deepEqual(calls.map(call => call.page), [1, 2]);
  assert.ok(calls.every(call => call.ordering === '-created_at,-id'));
});

test('a changing, duplicate or incomplete register fails instead of publishing a partial count', async () => {
  for (const second of [
    { count: 3, results: [{ id: 'two' }], next: null },
    { count: 2, results: [{ id: 'one' }], next: null },
    { count: 2, results: [], next: null },
  ]) await assert.rejects(() => loadProposalRegister(async ({ page }) => page === 1
    ? { count: 2, results: [{ id: 'one' }], next: '?page=2' } : second), /changed while loading/);
  await assert.rejects(() => loadProposalRegister(async () => ({ count: 1, results: null })), /incomplete response/);
});

test('submission deadline uses opportunity data and never proposal validity', () => {
  assert.equal(proposalDeadline({ submission_due_date: '2026-10-09', valid_until: '2026-12-31' }), '2026-10-09');
  assert.equal(proposalDeadline({ deal_details: { submission_due_date: '2026-10-10' }, valid_until: '2026-12-31' }), '2026-10-10');
  assert.equal(proposalDeadline({ submission_due_date: null, valid_until: '2026-12-31' }), null);
  assert.equal(proposalDeadline({ valid_until: '2026-12-31' }), null);
});

test('approval and submission badges require their recorded evidence', () => {
  const incomplete = { status: 'ready_to_submit', approved_by: 11, approved_at: null };
  assert.equal(proposalApproved(incomplete), false);
  assert.notEqual(proposalStatus(incomplete), 'Approved');
  assert.notEqual(proposalBucket(incomplete), 'approved');
  const recorded = { ...incomplete, approved_at: '2026-10-01T05:00:00Z' };
  assert.equal(proposalApproved(recorded), true);
  assert.equal(proposalStatus(recorded), 'Approved');
  assert.equal(proposalSubmitted({ status: 'submitted', submitted_version_hash: 'source-hash' }), false);
  assert.equal(proposalSubmitted({ submitted_version_hash: 'source-hash', sent_date: '2026-10-01T06:00:00Z' }), true);
});

test('internal PDF feedback and document revisions cannot manufacture Quote approval or version', () => {
  const row = { version: 2, status: 'internal_review', selected_document: { revision: 3 },
    submissions: [{ outcome: 'reviewed' }], publication_level: 'published' };
  assert.equal(proposalRevision(row), 'Rev 02');
  assert.equal(proposalApproved(row), false);
  assert.equal(proposalBucket(row), 'review');
  assert.equal(proposalChecklist(row).find(item => item.label === 'Proposal approval recorded').complete, false);
});

test('owner identity works with actual list and detail serializer shapes', () => {
  assert.equal(proposalOwner({ prepared_by_name: 'Aisha Noor' }), 'Aisha Noor');
  assert.equal(proposalOwner({ prepared_by_details: { id: 11, full_name: 'Aisha Noor' } }), 'Aisha Noor');
  assert.equal(proposalOwner({ prepared_by: null, prepared_by_details: null }), 'Unassigned');
  assert.notEqual(proposalOwner({ prepared_by: 11, prepared_by_details: { id: 11, full_name: '' } }), 'Unassigned');
});

test('recorded approval survives a deleted actor and revision zero remains a valid source revision', () => {
  assert.equal(proposalApproved({ approved_by: null, approved_at: '2026-10-01T05:00:00Z' }), true);
  assert.equal(proposalRevision({ version: 0 }), 'Rev 00');
});

test('a recorded zero estimate is not a missing value or an invented minimum-cost rule', () => {
  const recorded = proposalChecklist({ total_amount: '12500.00', estimated_cost: '0.00' });
  assert.equal(recorded.find(item => item.label === 'Price and estimate recorded').complete, true);
  const missing = proposalChecklist({ total_amount: '12500.00', estimated_cost: null });
  assert.equal(missing.find(item => item.label === 'Price and estimate recorded').complete, false);
});

test('filters combine owner, client, source deadline and canonical search values', () => {
  const rows = [
    { id: 'one', prepared_by: 11, client: 'a', status: 'internal_review', deal_code: 'VF-101',
      deal_name: 'Engineering review', client_name: 'Client A', submission_due_date: '2026-10-02' },
    { id: 'two', prepared_by: 12, client: 'a', status: 'draft', deal_code: 'VF-102',
      deal_name: 'Instrumentation review', client_name: 'Client A', submission_due_date: null, valid_until: '2026-10-02' },
    { id: 'three', prepared_by: null, client: 'b', status: 'draft', deal_code: 'VF-103',
      deal_name: 'Electrical study', client_name: 'Client B', submission_due_date: '2026-09-29' },
  ];
  assert.deepEqual(filterProposals(rows, { owner: '11', client: 'a', view: 'review', query: 'vf-101', deadline: 'week' }, '2026-10-01').map(row => row.id), ['one']);
  assert.deepEqual(filterProposals(rows, { deadline: 'missing' }, '2026-10-01').map(row => row.id), ['two']);
  assert.deepEqual(filterProposals(rows, { deadline: 'overdue', owner: 'unassigned' }, '2026-10-01').map(row => row.id), ['three']);
  assert.deepEqual(filterProposals(rows, { query: 'client b' }).map(row => row.id), ['three']);
});

test('sort is numeric for Quote revisions and keeps unavailable deadlines last without mutating the source', () => {
  const rows = [{ id: 'two', version: 2, submission_due_date: null },
    { id: 'ten', version: 10, submission_due_date: '2026-10-12' }, { id: 'one', version: 1, submission_due_date: '2026-10-09' }];
  assert.deepEqual(sortProposals(rows, 'revision', 'asc').map(row => row.id), ['one', 'two', 'ten']);
  assert.deepEqual(sortProposals(rows, 'deadline', 'desc').map(row => row.id), ['ten', 'one', 'two']);
  assert.deepEqual(rows.map(row => row.id), ['two', 'ten', 'one']);
});
