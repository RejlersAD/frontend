import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRecommendationPayload } from '../src/pages/Procurement/recommendationFormPayload.js';

const blankLine = () => ({ description: '', quantity: '1', unit: 'EA', unit_price: '', total: '0.00' });
const pricedLine = (description, overrides = {}) => ({ description, quantity: '2', unit: 'EA', unit_price: '100.00', total: '200.00', ...overrides });

test('cleared optional values persist as null while blank text and zero amounts remain explicit', () => {
  const payload = prepareRecommendationPayload({
    issued_date: '', total_price: '', net_total_excl_vat: '', estimated_budget: '', vendor: '',
    price_remarks: '', supplier_name: '', vendor_selection_reason: '', po_number_reference: '',
  });
  for (const key of ['issued_date', 'total_price', 'net_total_excl_vat', 'estimated_budget', 'vendor']) assert.equal(payload[key], null);
  for (const key of ['price_remarks', 'supplier_name', 'vendor_selection_reason', 'po_number_reference']) assert.equal(payload[key], '');
  assert.equal(prepareRecommendationPayload({ total_price: 0 }).total_price, 0);
  assert.equal(prepareRecommendationPayload({ total_price: '0.00' }).total_price, '0.00');
});

test('native project saves normalize the writable CSV and preserve matching enterprise selections', () => {
  const project = { project_id: 17, project_number: '5901001', project_name: 'Enterprise project', source: 'enterprise' };
  const source = { project: ' 5901001, PRJ-02, 5901001 ', project_numbers: ['STALE'], project_details: [project] };
  const result = prepareRecommendationPayload(source);
  assert.equal(result.project, '5901001, PRJ-02');
  assert.equal('project_numbers' in result, false);
  assert.deepEqual(result.project_details, [project, { type: 'project', project_number: 'PRJ-02', value: 'PRJ-02' }]);
  assert.equal(result.project_details[0], project);
  assert.equal(source.project, ' 5901001, PRJ-02, 5901001 ');
  assert.deepEqual(source.project_numbers, ['STALE']);
});

test('cleared project CSV removes explicit references without changing unrelated evidence or amounts', () => {
  const record = { project: '', project_details: [{ project_number: 'OLD-1', project_id: 17 }],
    total_price: '2100.00', price_remarks_data: { signed_approval_evidence: { signatures: { pm: true } } } };
  const result = prepareRecommendationPayload(record);
  assert.equal(result.project, '');
  assert.deepEqual(result.project_details, []);
  assert.equal(result.total_price, record.total_price);
  assert.deepEqual(result.price_remarks_data, record.price_remarks_data);
});

test('project payload never truncates overlong input before server validation or mutates a failed-save retry', () => {
  const source = Object.freeze({ project: `${'A'.repeat(190)}, ${'B'.repeat(30)}`, project_details: Object.freeze([]) });
  const first = prepareRecommendationPayload(source);
  assert.equal(first.project, source.project);
  assert.deepEqual(prepareRecommendationPayload(source), first);
  assert.equal(first.project.length, 222);
});

test('omits a blank row and keeps VAT, supplier and budget aligned to the retained row', () => {
  const result = prepareRecommendationPayload({
    items: [blankLine(), pricedLine('Engineering services')],
    price_remarks_data: { line_details: [
      { vat_rate: '', vendor_id: '', budget: null },
      { vat_rate: '5', vendor_id: 'selected', budget: '250' },
    ] },
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].description, 'Engineering services');
  assert.deepEqual(result.price_remarks_data.line_details, [{ vat_rate: '5', vendor_id: 'selected', budget: '250' }]);
});

test('compacts blank rows between and after complete rows, including old item aliases', () => {
  const result = prepareRecommendationPayload({
    items: [pricedLine('First'), { item: ' ', qty: 1, price: 0, unit: ' ea ' }, pricedLine('Second'), {}],
    price_remarks_data: { line_details: [{ note: 'first' }, {}, { note: 'second' }, {}] },
  });
  assert.deepEqual(result.items.map((item) => item.description), ['First', 'Second']);
  assert.deepEqual(result.price_remarks_data.line_details, [{ note: 'first' }, { note: 'second' }]);
});

test('unconfirmed VAT preserves legacy zero tax while supplier and budget clearing stay explicit', () => {
  const result = prepareRecommendationPayload({
    items: [pricedLine('Zero-rated service', { vat_rate: '0', vendor_id: '', budget: null })],
    price_remarks_data: { line_details: [{ vat_rate: '5', vendor_id: 'old', budget: '500', evidence: 'quote.pdf' }] },
  });
  assert.deepEqual(result.price_remarks_data.line_details, [{ vat_rate: '0', vendor_id: '', budget: null, evidence: 'quote.pdf' }]);
  assert.equal('vat_rate' in result.items[0], false);
  assert.equal('vendor_id' in result.items[0], false);
  assert.equal('budget' in result.items[0], false);
});

test('does not drop partial rows or malformed rows that need backend validation', () => {
  const retainedItems = [
    { description: '', quantity: '2', unit_price: '' },
    { description: '', quantity: '1', unit_price: '5' },
    { description: '', quantity: '1.0', unit_price: '0' },
    { description: '', quantity: '1', unit_price: '0.00' },
    { description: 'A required service', quantity: '', unit_price: '' },
    { description: '', quantity: '1', unit_price: '', total: '2052.00' },
    { description: '', quantity: '', unit_price: '', total: 'invalid' },
    null, 'invalid item', [],
  ];
  assert.deepEqual(prepareRecommendationPayload({ items: retainedItems }).items, retainedItems);
});

test('partial pricing preserves blank fields and recorded line and request amounts', () => {
  const record = { items: [{ description: '', quantity: '', unit_price: '100.00', total: '2052.00' }],
    total_price: '2154.60', net_total_excl_vat: '2052.00', vat_basis: 'exclusive', _vatPricingChanged: false };
  const payload = prepareRecommendationPayload(record);
  assert.deepEqual(payload.items, record.items);
  assert.equal(payload.total_price, record.total_price);
  assert.equal(payload.net_total_excl_vat, record.net_total_excl_vat);
  assert.equal('vat_basis' in payload, false);
});

test('meaningful unit, code, discount and line metadata preserve rows and metadata alignment', () => {
  const retained = [
    { ...blankLine(), code: 'SERVICE-001' },
    { ...blankLine(), sku: 'SERVICE-002' },
    { ...blankLine(), unit: 'LS' },
    { ...blankLine(), discount: '5.00' },
    { ...blankLine(), line_discount: 'invalid' },
    { ...blankLine(), discount_amount: '-1' },
    { ...blankLine(), budget: 0, vendor_id: '21', vat_rate: '0' },
    { ...blankLine() },
  ];
  const payload = prepareRecommendationPayload({ items: [blankLine(), ...retained], price_remarks_data: {
    line_details: [{}, ...retained.map((_, index) => index === retained.length - 1 ? { budget: '25', note: 'Awaiting quote' } : {})],
  } });
  assert.equal(payload.items.length, retained.length);
  assert.equal(payload.items[0].code, 'SERVICE-001');
  assert.deepEqual(payload.price_remarks_data.line_details[6], { budget: 0, vendor_id: '21', vat_rate: '0' });
  assert.deepEqual(payload.price_remarks_data.line_details[7], { budget: '25', note: 'Awaiting quote' });
  assert.equal(payload.items[7].quantity, '1');
  assert.equal(payload.items[7].unit_price, '');
});

test('recognizes the backend blank-row cases without treating zero quantity as blank', () => {
  const result = prepareRecommendationPayload({ items: [
    {}, { description: ' ', quantity: null, unit_price: null },
    { quantity: '', unit_price: '' }, { quantity: true, unit_price: false },
    { quantity: 0, unit_price: 0 },
  ] });
  assert.deepEqual(result.items, [{ quantity: 0, unit_price: 0 }]);
});

test('preserves unconfirmed legacy financial values, budget and evidence exactly', () => {
  const legacy = {
    pr_number: 'LEGACY-001', items: [], total_price: '6180.00', net_total_excl_vat: '6000.00',
    estimated_budget: '10000.00', currency: 'AED',
    price_remarks_data: { discount_amount: '180.00', cost_center: 'CC-001', approval_table_labels: { 1: 'L0' } },
  };
  const result = prepareRecommendationPayload(legacy);
  assert.equal(result.total_price, '6180.00');
  assert.equal(result.net_total_excl_vat, '6000.00');
  assert.equal(result.estimated_budget, '10000.00');
  assert.equal(result.currency, 'AED');
  assert.deepEqual(result.price_remarks_data, { ...legacy.price_remarks_data, line_details: [] });
});

test('does not infer confirmation from legacy line VAT metadata', () => {
  const result = prepareRecommendationPayload({
    items: [pricedLine('Service', { vat_rate: '5' })], total_price: '200.00',
    net_total_excl_vat: '200.00', estimated_budget: '300.00', currency: 'USD',
    price_remarks_data: { net_total_aed: '734.50', aed_exchange_rate: '3.6725' },
  });
  assert.equal(result.total_price, '200.00');
  assert.equal(result.net_total_excl_vat, '200.00');
  assert.equal(result.items[0].total, '200.00');
  assert.equal(result.currency, 'USD');
  assert.equal(result.price_remarks_data.net_total_aed, '734.50');
});

test('keeps amounts if all editing rows are blank and omits orphaned line metadata', () => {
  const result = prepareRecommendationPayload({
    items: [blankLine()], total_price: '900.00', net_total_excl_vat: '900.00', estimated_budget: '1500',
    price_remarks_data: { line_details: [{ vendor_id: '' }, { stale: true }] },
  });
  assert.deepEqual(result.items, []);
  assert.deepEqual(result.price_remarks_data.line_details, []);
  assert.equal(result.total_price, '900.00');
  assert.equal(result.estimated_budget, '1500');
});

test('preserves unrelated metadata and supplied workflow labels', () => {
  const workflow = [
    { user_id: 931, approval_label: 'L0-PRO', name: 'Reviewer' },
    { user_id: 45, approval_label: 'L4', name: 'Approver' },
    { user_id: null, approval_label: 'Unassigned' },
  ];
  const result = prepareRecommendationPayload({
    items: [], approval_workflow_config: [{ user_id: 8 }],
    price_remarks_data: { selection_type: 'competitive_shortlist', payment_terms: 'Net 45', approval_table_labels: { 8: 'Old' } },
  }, workflow);
  assert.deepEqual(result.approval_workflow_config, workflow);
  assert.deepEqual(result.price_remarks_data.approval_table_labels, { 931: 'L0-PRO', 45: 'L4' });
  assert.equal(result.price_remarks_data.selection_type, 'competitive_shortlist');
  assert.equal(result.price_remarks_data.payment_terms, 'Net 45');
});

test('only clears workflow labels when an explicit empty workflow is supplied', () => {
  const source = { approval_workflow_config: [{ user_id: 1 }], price_remarks_data: { approval_table_labels: { 1: 'L0' } } };
  assert.deepEqual(prepareRecommendationPayload(source), source);
  const cleared = prepareRecommendationPayload(source, []);
  assert.deepEqual(cleared.approval_workflow_config, []);
  assert.deepEqual(cleared.price_remarks_data.approval_table_labels, {});
});

test('does not mutate editing state, metadata or workflow supplied by the caller', () => {
  const source = Object.freeze({
    items: Object.freeze([Object.freeze(blankLine()), Object.freeze(pricedLine('Retained', { vat_rate: '5' }))]),
    price_remarks_data: Object.freeze({
      selection_type: 'single_source',
      line_details: Object.freeze([Object.freeze({ budget: '' }), Object.freeze({ budget: '300' })]),
    }),
  });
  const before = JSON.stringify(source);
  const result = prepareRecommendationPayload(source, Object.freeze([Object.freeze({ user_id: 1, approval_label: 'L0' })]));
  assert.equal(JSON.stringify(source), before);
  assert.notEqual(result, source);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.price_remarks_data.line_details, [{ budget: '300', vat_rate: '5' }]);
});

test('passes a malformed items value through for API validation without discarding metadata', () => {
  const source = { items: 'invalid', price_remarks_data: { line_details: [{ budget: '100' }] } };
  assert.deepEqual(prepareRecommendationPayload(source), source);
});
