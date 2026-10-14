import test from 'node:test';
import assert from 'node:assert/strict';
import { projectNumbersForSelection, requisitionProjectNumbers, requisitionProjectReference, purchaseOrderProjectSelections, withPurchaseOrderProjects } from '../src/pages/Procurement/purchaseOrderProjects.js';

const requisition = { project: '5901056', project_details: [
  { project_number: '5901142', project_name: 'Water project' },
  { project_code: '5901086', project_name: 'Plant modifications' },
  { code: '5901056', project_name: 'Engineering' },
] };

test('all three PR project numbers retain order and are separated by comma and space', () => {
  assert.equal(requisitionProjectReference(requisition), '5901142, 5901086, 5901056');
  assert.equal(requisitionProjectReference({ project: 'LEGACY-001' }), 'LEGACY-001');
});

test('selecting a primary project from the PR retains the complete number list', () => {
  for (const number of requisitionProjectNumbers(requisition)) {
    assert.equal(projectNumbersForSelection(requisition, number), '5901142, 5901086, 5901056');
  }
  assert.equal(projectNumbersForSelection(requisition, 'OTHER-001'), 'OTHER-001');
});

test('project references omit missing codes and duplicates without inventing codes from descriptions or IDs', () => {
  assert.deepEqual(requisitionProjectNumbers({ project_details: [
    null, {}, { project_id: 'not-a-project-number', project_name: 'Number 123 in a title' },
    { project_number: ' PR-001 ' }, { project_code: 'pr-001' }, { code: '0000123' },
  ] }), ['PR-001', '0000123']);
  assert.equal(requisitionProjectReference(null), '');
  assert.equal(projectNumbersForSelection(null, 'PR-001'), 'PR-001');
});

test('historical PR labels retain all three seven-digit project codes without shorter package references', () => {
  const labels = ['5901142-Water treatment project', 'T31 Plant Modifications (MOCs) Package 5901086', 'Remote operation (NEB) (10522 & 10523), 5901056'];
  const legacy = { project: '', project_details: labels.map(label => ({ label, value: label, source: 'historical' })) };
  assert.equal(requisitionProjectReference(legacy), '5901142, 5901086, 5901056');
  assert.equal(requisitionProjectReference({ project_department: labels.join('; ') }), '5901142, 5901086, 5901056');
  assert.deepEqual(requisitionProjectNumbers({ project_details: [{ label: '10522 / T31 / 12345678 / A1234567 / 1234567Z' }] }), []);
  assert.deepEqual(requisitionProjectNumbers({ project_details: [{ project_number: 'PR-001', label: 'Reference 5901142' }] }), ['PR-001']);
});

test('multiple selections keep order, avoid duplicates, and retain unrelated contact data', () => {
  const projects = [{ id: 1, project_number: 'PR-001', project_name: 'First', enterprise_project: 12 }, { id: 2, project_number: '0000123', project_name: 'Second' }];
  const form = { project: 1, enterprise_project: 12, project_number: 'PR-001', contact_persons: { purchase_summary: 'Keep me' } };
  const selected = purchaseOrderProjectSelections(form, projects);
  const updated = withPurchaseOrderProjects(form, [...selected, { project_number: '0000123', project_id: 2 }, { project_number: 'pr-001' }]);
  assert.equal(updated.project_number, 'PR-001, 0000123');
  assert.equal(updated.project, 1);
  assert.equal(updated.enterprise_project, 12);
  assert.equal(updated.contact_persons.purchase_summary, 'Keep me');
  assert.equal(updated.contact_persons.project_selections.length, 2);
  assert.equal(form.project_number, 'PR-001');
});

test('removing a primary project selects the next known project and removing all clears both links', () => {
  const form = { project: 1, enterprise_project: 12, project_number: 'PR-001, 0000123', contact_persons: { project_selections: [
    { project_number: 'PR-001', project_id: 1, enterprise_project: 12 }, { project_number: '0000123', project_id: 2, enterprise_project: 13 },
  ] } };
  const selected = purchaseOrderProjectSelections(form);
  const removedFirst = withPurchaseOrderProjects(form, selected.slice(1));
  assert.equal(removedFirst.project, 2);
  assert.equal(removedFirst.enterprise_project, 13);
  const cleared = withPurchaseOrderProjects(removedFirst, []);
  assert.equal(cleared.project_number, '');
  assert.equal(cleared.project, '');
  assert.equal(cleared.enterprise_project, null);
  assert.deepEqual(cleared.contact_persons.project_selections, []);
});
