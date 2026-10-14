import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeRegisterRecord } from '../src/pages/Procurement/procurementRegisterModel.js';
import { recommendationPresentation, recommendationWorkload } from '../src/pages/Procurement/recommendationPresentation.js';

const now = new Date('2026-09-15T12:00:00Z');
const record = (raw = {}) => normalizeRegisterRecord({
  id: 'pr-1', pr_number: 'RAD-PRJ-PR-0001_2026', status: 'draft', issued_by: 42,
  requester_name: 'Project Requester', product_service: 'Engineering tools', description_reason: 'Deliver the engineering package.',
  total_price: '1000', currency: 'AED', vendor: 'supplier-1',
  vendor_details: { id: 'supplier-1', name: 'Supplier One', status: 'active' },
  created_at: '2026-09-01T09:00:00Z', updated_at: '2026-09-15T09:00:00Z', ...raw,
}, 'purchaseRequisitions', 42, now);

test('presentation retains the exact eight decision slots, six readiness slots and five lifecycle stages', () => {
  const presented = recommendationPresentation(record());
  assert.deepEqual([...presented.decisionLeft, ...presented.decisionRight].map(([label]) => label), [
    'Need', 'Sourcing method', 'Quotes evaluated', 'Selected supplier', 'Selection reason', 'Savings vs budget', 'Budget code', 'Funding status',
  ]);
  assert.deepEqual(presented.readiness.map(check => check.label), [
    'Scope & quantity', 'Supplier compliance', 'Commercial evaluation', 'Budget validation', 'Required attachments', 'Conflict declaration',
  ]);
  assert.deepEqual(presented.lifecycle.map(step => step.label), ['Draft', 'Technical review', 'Commercial review', 'Approved', 'PO conversion']);
});

test('active vendor, a budget amount and attachments do not imply unavailable approvals', () => {
  const presented = recommendationPresentation(record({
    estimated_budget: '2000', management_approval: true,
    attachments: [{ filename: 'proposal.pdf' }], management_approval_evidence: [{ filename: 'signature.pdf' }],
  }));
  const checks = Object.fromEntries(presented.readiness.map(check => [check.label, check]));
  for (const label of ['Supplier compliance', 'Budget validation', 'Required attachments', 'Conflict declaration']) {
    assert.equal(checks[label].value, 'Not recorded');
    assert.equal(checks[label].ready, null);
  }
  assert.equal(Object.fromEntries(presented.decisionRight)['Funding status'], 'Not recorded');
  assert.equal(Object.fromEntries(presented.decisionRight)['Savings vs budget'], 'Not recorded');
});

test('recorded supplier audit is labelled as an audit without claiming full supplier compliance', () => {
  const presented = recommendationPresentation(record({ vendor_details: { id: 'supplier-1', status: 'active', audit_status: 'Passed', last_audit_date: '2026-09-10' } }));
  assert.deepEqual(presented.readiness.find(check => check.label === 'Supplier compliance'), { label: 'Supplier compliance', value: 'Audit: Passed', ready: null });
});

test('supplier shortlist is not a set of evaluated quotations', () => {
  const shortlist = [{ vendor_id: 'a', vendor_name: 'A' }, { vendor_id: 'b', vendor_name: 'B' }];
  const unknown = Object.fromEntries(recommendationPresentation(record({ selected_vendors: shortlist })).decisionLeft);
  assert.equal(unknown['Quotes evaluated'], 'Not recorded');
  assert.equal(unknown['Sourcing method'], 'Not recorded');
  const present = recommendationPresentation(record({
    selected_vendors: shortlist, single_source_justification: 'Compatibility requirement.',
    price_remarks_data: { comparative_prices: [{ vendor: 'A', price: 1000 }, { vendor: 'B', price: 2000 }, { vendor: 'Missing quotation' }], budget_allocation: 'BUD-ENG-001' },
  }));
  assert.equal(Object.fromEntries(present.decisionLeft)['Quotes evaluated'], '2 prices recorded');
  assert.equal(Object.fromEntries(present.decisionLeft)['Sourcing method'], 'Single-source justification recorded');
  assert.equal(Object.fromEntries(present.decisionRight)['Budget code'], 'BUD-ENG-001');
});

test('same-basis AED savings are calculated without mixing currencies or guessing imported percentage units', () => {
  const decision = raw => Object.fromEntries(recommendationPresentation(record(raw)).decisionRight)['Savings vs budget'];
  assert.equal(decision({ currency: 'USD', total_price: '100', estimated_budget: '200' }), 'Not recorded');
  assert.equal(decision({ price_remarks_data: { budget_in_aed: '20000', amount_excl_vat_aed: '18000' } }), 'AED 2,000 (10%)');
  assert.equal(decision({ price_remarks_data: { procurement_register: { '%Savings from Budget': 0.15 } } }), '0.15 (source)');
  assert.equal(decision({ price_remarks_data: { procurement_register: { '%Savings from Budget': '15%' } } }), '15% (source)');
  assert.equal(decision({ price_remarks_data: { budget_in_aed: '0', amount_excl_vat_aed: '0' } }), 'Not recorded');
});

test('scope and quantity require recorded line quantities, not a price-only fallback item', () => {
  const check = raw => recommendationPresentation(record(raw)).readiness[0];
  assert.equal(check({}).ready, null);
  assert.equal(check({ items: [{ description: 'Service hours', quantity: '0' }] }).ready, false);
  assert.equal(check({ items: [{ description: 'Service hours', quantity: '24' }] }).ready, true);
});

test('missing technical and commercial mappings remain unknown even when the PR is approved', () => {
  const presented = recommendationPresentation(record({ status: 'approved', approved_at: '2026-09-14T10:00:00Z', approval_workflow_config: [{ stage: 'Level 1', role: 'Project Manager', user_id: 43, status: 'approved', approved_at: '2026-09-14T10:00:00Z' }] }));
  assert.equal(presented.lifecycle[1].state, 'unknown');
  assert.equal(presented.lifecycle[2].state, 'unknown');
  assert.equal(presented.lifecycle[3].state, 'complete');
  assert.equal(presented.readiness[2].ready, null);
});

test('explicit review phases aggregate actual stage decisions and preserve rejections', () => {
  const workflow = [
    { level: 1, stage: 'Technical review', user_id: 42, status: 'approved', approved_at: '2026-09-10T09:00:00Z' },
    { level: 2, stage: 'Commercial review', user_id: 43, status: 'pending' },
  ];
  const presented = recommendationPresentation(record({ status: 'in_review', approval_workflow_config: workflow }));
  assert.equal(presented.lifecycle[1].state, 'complete');
  assert.equal(presented.lifecycle[1].date, '2026-09-10T09:00:00Z');
  assert.equal(presented.lifecycle[2].state, 'active');
  const rejected = recommendationPresentation(record({ status: 'rejected', approval_workflow_config: [{ ...workflow[1], status: 'rejected', rejected_at: '2026-09-14T09:00:00Z' }] }));
  assert.equal(rejected.lifecycle[2].state, 'rejected');
  assert.equal(rejected.readiness[2].ready, false);
  const incomplete = recommendationPresentation(record({ status: 'rejected', approval_workflow_config: [
    { stage: 'Commercial review A', user_id: 42, status: 'not_recorded' },
    { stage: 'Commercial review B', user_id: 43, status: 'rejected' },
  ] }));
  assert.equal(incomplete.lifecycle[2].state, 'rejected');
});

test('converted imported recommendations preserve missing approvals and conversion dates', () => {
  const presented = recommendationPresentation(record({ status: 'converted', linked_po_id: 'po-1', approval_workflow_config: [{ stage: 'Technical review', user_id: 42, status: 'not_recorded' }] }));
  assert.equal(presented.lifecycle[0].state, 'unknown');
  assert.equal(presented.lifecycle[1].state, 'unknown');
  assert.equal(presented.lifecycle[3].state, 'unknown');
  assert.equal(presented.lifecycle[4].state, 'complete');
  assert.equal(presented.lifecycle[4].date, null);
});

test('workload does not substitute record creation, issue date or latest update for event timestamps', () => {
  const workload = recommendationWorkload([record({ status: 'converted', linked_po_id: 'po-1', issued_date: '2026-09-01', approved_at: '2026-09-14T09:00:00Z' })], now);
  assert.equal(workload.medianCycleDays, null);
  assert.equal(workload.convertedThisMonth, null);
  assert.equal(workload.approvalCycleMissingCount, 1);
  assert.equal(workload.conversionDateMissingCount, 1);
});

test('workload median uses valid timestamp pairs and reports sample coverage', () => {
  const workload = recommendationWorkload([
    record({ status: 'approved', submitted_at: '2026-09-01T09:00:00Z', approved_at: '2026-09-03T09:00:00Z' }),
    record({ status: 'approved', submitted_at: '2026-09-01T09:00:00Z', approved_at: '2026-09-05T09:00:00Z' }),
    record({ status: 'approved', submitted_at: '2026-09-02T09:00:00Z', approved_at: '2026-09-01T09:00:00Z' }),
    record({ status: 'approved', submitted_at: '2026-02-30T09:00:00Z', approved_at: '2026-09-01T09:00:00Z' }),
    record({ status: 'approved', submitted_at: '2026-09-14T09:00:00Z', approved_at: '2026-10-01T09:00:00Z' }),
  ], now);
  assert.equal(workload.medianCycleDays, 3);
  assert.equal(workload.approvalCycleSampleSize, 2);
  assert.equal(workload.approvalCycleMissingCount, 3);
});

test('monthly conversion total is unavailable when any converted record lacks its event date', () => {
  const dated = record({ status: 'converted', converted_at: '2026-09-02T09:00:00Z' });
  const earlier = record({ status: 'converted', converted_at: '2026-08-02T09:00:00Z' });
  assert.equal(recommendationWorkload([dated, earlier], now).convertedThisMonth, 1);
  const partial = recommendationWorkload([dated, record({ status: 'converted' })], now);
  assert.equal(partial.convertedThisMonth, null);
  assert.equal(partial.convertedKnownThisMonth, 1);
  assert.equal(recommendationWorkload([record()], now).convertedThisMonth, 0);
});

test('technical and commercial workload counts use explicit active stage roles with unknown coverage preserved', () => {
  const technical = record({ status: 'in_review', approval_workflow_config: [{ stage: 'Engineering review', user_id: 42, status: 'pending' }] });
  const commercial = record({ status: 'in_review', approval_workflow_config: [{ stage: 'Financial review', user_id: 42, status: 'pending' }] });
  const unknown = record({ status: 'in_review', approval_workflow_config: [{ stage: 'Level 1', role: 'Project Manager', user_id: 42, status: 'pending' }] });
  const complete = recommendationWorkload([technical, commercial, record()], now);
  assert.equal(complete.technicalReviewCount, 1);
  assert.equal(complete.commercialReviewCount, 1);
  const partial = recommendationWorkload([technical, commercial, unknown], now);
  assert.equal(partial.technicalReviewCount, null);
  assert.equal(partial.commercialReviewCount, null);
  assert.equal(partial.knownTechnicalReviewCount, 1);
  assert.equal(partial.unclassifiedReviewCount, 1);
});
