import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProjectNumbers, recommendationProjectNumbers, reconcileRecommendationProjectDetails } from '../src/pages/Procurement/recommendationProjectNumbers.js';

test('comma-separated project codes retain spelling and order while whitespace and duplicates are removed', () => {
  assert.equal(normalizeProjectNumbers(' 005901, PRJ-02, , 005901, prj-02, Dept-HSE '), '005901, PRJ-02, Dept-HSE');
  assert.equal(normalizeProjectNumbers([' 5901001, 5901002 ', '5901001', 5901003, null]), '5901001, 5901002, 5901003');
});

test('blank or malformed references cannot manufacture project numbers', () => {
  for (const value of ['', ', ,', null, undefined, {}, true, Infinity]) {
    assert.equal(normalizeProjectNumbers(value), '');
  }
});

test('canonical project numbers supersede legacy fields including an explicitly cleared list', () => {
  const legacy = { project_details: [{ project_number: 'OLD-1' }], project: 'OLD-2', price_remarks_data: { project_numbers: ['OLD-3'] } };
  assert.deepEqual(recommendationProjectNumbers({ ...legacy, project_numbers: [' NEW-1 ', 'NEW-2', 'new-1'] }), ['NEW-1', 'NEW-2']);
  assert.deepEqual(recommendationProjectNumbers({ ...legacy, project_numbers: [] }), []);
  assert.deepEqual(recommendationProjectNumbers({ ...legacy, project_numbers: '' }), []);
});

test('explicit selected project references remain available without parsing names or creating IDs', () => {
  const record = { project_details: [
    { project_id: 17, project_number: '5901001', label: 'Project 9999999' },
    { project_code: 'PRJ-02, PRJ-03' },
    { code: 'prj-02' },
    { value: '5901004 - Name only', label: '5901005' },
    null,
  ], price_remarks_data: { project_numbers: ['OLD-1'] } };
  const before = JSON.stringify(record);
  assert.deepEqual(recommendationProjectNumbers(record), ['5901001', 'PRJ-02', 'PRJ-03']);
  assert.equal(JSON.stringify(record), before);
  assert.deepEqual(recommendationProjectNumbers({ project_department: '5901004 - Display text', project_details: [{ label: '5901005' }] }), []);
});

test('legacy explicit project fields and import metadata retain multiple project codes', () => {
  assert.deepEqual(recommendationProjectNumbers({ project: '5901001', price_remarks_data: { project_numbers: ['5901001', '5901002'] } }), ['5901001', '5901002']);
  assert.deepEqual(recommendationProjectNumbers({ project_number: 'PRJ-01, PRJ-02' }), ['PRJ-01', 'PRJ-02']);
  assert.deepEqual(recommendationProjectNumbers(null), []);
});

test('editing CSV retains matching canonical identities and names while adding only explicit new references', () => {
  const enterprise = Object.freeze({ project_id: 17, project_number: '5901001', project_name: 'Selected enterprise project', source: 'enterprise', value: 'Selected enterprise project (5901001)' });
  const removed = { project_number: 'OLD-2', project_name: 'Removed custom project', source: 'custom' };
  const recordedName = Object.freeze({ value: 'Recorded department', source: 'recorded' });
  const internal = Object.freeze({ type: 'internal', value: 'Internal / General' });
  const details = Object.freeze([enterprise, removed, recordedName, internal]);
  const result = reconcileRecommendationProjectDetails('5901001, PRJ-NEW, prj-new', details);
  assert.deepEqual(result, [enterprise, recordedName, internal, { type: 'project', project_number: 'PRJ-NEW', value: 'PRJ-NEW' }]);
  assert.equal(result[0], enterprise);
  assert.equal(details[1], removed);
  assert.equal('project_id' in result[3], false);
  assert.equal('project_name' in result[3], false);
});

test('clearing numbers removes explicit codes but retains existing name-only and internal references', () => {
  const nameOnly = { value: 'Source department', source: 'recorded' };
  const internal = { type: 'internal', value: 'Internal / General' };
  assert.deepEqual(reconcileRecommendationProjectDetails('', [{ project_code: 'P-1', project_id: 19 }, nameOnly, internal]), [nameOnly, internal]);
});
