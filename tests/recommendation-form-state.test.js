import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateRecommendationItem, hydrateRecommendationReferences, preserveRecordedApprovalWorkflow, recommendationLineError } from '../src/pages/Procurement/recommendationFormState.js';
import { prepareRecommendationPayload } from '../src/pages/Procurement/recommendationFormPayload.js';

test('a signed import lump sum retains its total and source evidence while becoming editable', () => {
  const source = { description: 'Software credits', total: '2052.00', currency: 'USD', remarks: 'Recorded budget' };
  const item = hydrateRecommendationItem(source);
  assert.deepEqual(item, { ...source, quantity: '1', unit: 'LS', unit_price: '2052.00' });
  assert.equal(recommendationLineError([item]), '');
  assert.equal(source.quantity, undefined);
});

test('incomplete explicit pricing is optional and remains unchanged', () => {
  for (const source of [
    { description: 'Credits', quantity: '2', total: '2052.00' },
    { description: 'Credits', unit_price: '1000', total: '2052.00' },
    { description: '', quantity: '', unit_price: '', total: '2052.00' },
    { description: '', quantity: null, unit_price: null, total: '2052.00' },
    { description: '', quantity: '0', unit_price: '1000', total: '0.00' },
  ]) {
    assert.deepEqual(hydrateRecommendationItem(source), source);
    assert.equal(recommendationLineError([hydrateRecommendationItem(source)]), '');
  }
});

test('provided numbers must still be finite and non-negative even when other fields are omitted', () => {
  for (const field of ['quantity', 'unit_price', 'total', 'discount']) {
    for (const value of [-1, 'invalid', Infinity, 'Infinity', NaN, true, [], ' ']) {
      assert.ok(recommendationLineError([{ [field]: value }]), `${field}: ${String(value)}`);
    }
  }
  assert.ok(recommendationLineError([null]));
  assert.ok(recommendationLineError([[]]));
});

test('legacy aliases hydrate without changing the original item or amount', () => {
  assert.deepEqual(hydrateRecommendationItem({ item: 'Service', qty: 2, price: '3.00', line_total: '6.00', uom: 'HR' }), {
    item: 'Service', qty: 2, price: '3.00', line_total: '6.00', uom: 'HR',
    description: 'Service', quantity: 2, unit_price: '3.00', total: '6.00', unit: 'HR',
  });
  assert.equal(hydrateRecommendationItem({ description: 'Service', total: 'invalid' }).unit_price, undefined);
});

test('recorded project and supplier names are not assigned fabricated master IDs', () => {
  const references = hydrateRecommendationReferences({ project_department: '5901142-Recorded project', supplier_name: 'Recorded supplier', vendor: null, selected_vendors: [], project_details: [] });
  assert.deepEqual(references.project_details, [{ value: '5901142-Recorded project', label: '5901142-Recorded project', source: 'recorded', type: 'project' }]);
  assert.deepEqual(references.selected_vendors, []);
  assert.deepEqual(hydrateRecommendationReferences({ vendor: 12, supplier_name: 'Known supplier' }).selected_vendors, [{ vendor_id: 12, name: 'Known supplier' }]);
});

test('canonical references win and metadata price lines are a fallback only when items are empty', () => {
  const project = { project_id: 17, label: 'Selected project' };
  const vendor = { vendor_id: 12, name: 'Selected supplier' };
  const line = { description: 'Recorded service', total: '2052.00' };
  const record = { project_details: [project], selected_vendors: [vendor], items: [], price_remarks_data: { price_lines: [line] } };
  const hydrated = hydrateRecommendationReferences(record);
  assert.deepEqual(hydrated.project_details, [project]);
  assert.deepEqual(hydrated.selected_vendors, [vendor]);
  assert.equal(hydrated.items[0].unit_price, '2052.00');
  assert.deepEqual(record.items, []);
});

test('signed partial drafts and completed workflows preserve recorded approval data', () => {
  assert.equal(preserveRecordedApprovalWorkflow({ id: 'a', status: 'approved' }), true);
  assert.equal(preserveRecordedApprovalWorkflow({ id: 'a', status: 'draft', price_remarks_data: { import_source: 'signed_pr_pdf' } }), true);
  assert.equal(preserveRecordedApprovalWorkflow({ id: 'a', status: 'draft', approval_workflow_config: [{ external: true }] }), true);
  assert.equal(preserveRecordedApprovalWorkflow({ id: 'a', status: 'draft' }), false);
  assert.equal(preserveRecordedApprovalWorkflow(null), false);
  const workflow = [{ role: 'PM', user_name: 'Recorded approver', status: 'approved', external: true, approved_at: '2026-01-29' }];
  const metadata = { approval_table_labels: { 12: 'PM' }, signed_approval_evidence: { signatures: { pm: true } } };
  const saved = prepareRecommendationPayload({ approval_workflow_config: workflow, price_remarks_data: metadata });
  assert.deepEqual(saved.approval_workflow_config, workflow);
  assert.deepEqual(saved.price_remarks_data, metadata);
});

test('line validation rejects saved total mismatches but allows omitted totals and blank-row omission', () => {
  const item = { description: 'Service', quantity: '2', unit_price: '1026.00', total: '2052.00' };
  assert.equal(recommendationLineError([item]), '');
  assert.match(recommendationLineError([{ ...item, total: '1.00' }]), /total must equal/);
  assert.equal(recommendationLineError([{ ...item, total: '' }]), '');
  const payload = prepareRecommendationPayload({ items: [{ description: '', quantity: '1', unit_price: '', total: '0.00' }, item] });
  assert.equal(recommendationLineError(payload.items), '');
});

test('pending registration routes can be repaired until approval evidence is recorded', () => {
  for (const status of ['draft', 'submitted', 'in_review']) {
    assert.equal(preserveRecordedApprovalWorkflow({ id: 'a', status, approval_workflow_config: [] }), false);
    assert.equal(preserveRecordedApprovalWorkflow({ id: 'a', status, approval_workflow_config: [{ status: 'pending' }, { status: 'in_review' }] }), false);
    for (const stage of [{ status: 'approved' }, { status: 'rejected' }, { status: 'pending', approved_at: '2026-09-17' }, { status: 'pending', signature: 'recorded-signature' }]) {
      assert.equal(preserveRecordedApprovalWorkflow({ id: 'a', status, approval_workflow_config: [stage] }), true);
    }
  }
});

test('a reopened imported draft keeps provenance without locking its new approval round', () => {
  const record = { id: 'revision', status: 'draft', price_remarks_data: {
    import_source: 'signed_pr_pdf', approval_revision_history: [{ round: 1, rejection_reason: 'Correct the request' }],
  }, approval_workflow_config: [{ status: 'pending', user_id: 12 }] };
  assert.equal(preserveRecordedApprovalWorkflow(record), false);
  assert.equal(preserveRecordedApprovalWorkflow({ ...record, status: 'approved' }), true);
  assert.equal(preserveRecordedApprovalWorkflow({ ...record, approval_workflow_config: [{ status: 'approved', signature: 'new round evidence' }] }), true);
  assert.equal(preserveRecordedApprovalWorkflow({ ...record, price_remarks_data: { import_source: 'signed_pr_pdf' } }), true);
});


test('recorded line discounts survive validation and malformed discounts need correction', () => {
  for (const key of ['discount', 'line_discount', 'discount_amount']) {
    assert.equal(recommendationLineError([{ description: 'Discounted service', quantity: '2', unit_price: '100.00', total: '180.00', [key]: '20.00' }]), '');
    assert.match(recommendationLineError([{ description: 'Discounted service', quantity: '2', unit_price: '100.00', total: '200.00', [key]: '20.00' }]), /minus discount/);
  }
  assert.match(recommendationLineError([{ description: 'Service', quantity: 1, unit_price: 100, discount: -1 }]), /non-negative discount/);
  assert.equal(recommendationLineError([{ description: 'Service', quantity: 1, unit_price: 100, total: 100, discount: '' }]), '');
});
