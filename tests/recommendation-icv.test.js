import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationIcv, selectedRecommendationVendor } from '../src/pages/Procurement/recommendationIcv.js';
import { hydrateRecommendationReferences } from '../src/pages/Procurement/recommendationFormState.js';

const shortlist = [
  { vendor_id: 21, name: 'First supplier', icv_percentage: null },
  { vendor_id: 22, name: 'Preferred supplier', icv_percentage: '65.00' },
];

test('ICV follows the chosen supplier independent of shortlist order and ID representation', () => {
  for (const vendor of [22, '22', { id: 22 }]) {
    assert.equal(recommendationIcv({ vendor, selected_vendors: shortlist }, { live: true }), '65%');
  }
  assert.equal(recommendationIcv({ vendor: 21, selected_vendors: [...shortlist].reverse() }), '');
  assert.equal(recommendationIcv({ selected_vendors: shortlist }), '');
  assert.equal(recommendationIcv({ vendor: 99, supplier_name: 'Preferred supplier', selected_vendors: shortlist }), '');
});

test('reload and live master details supply ICV when a shortlist snapshot is incomplete', () => {
  const record = { vendor: 22, selected_vendors: [{ vendor_id: 22, name: 'Preferred supplier' }], vendor_details: { id: 22, name: 'Preferred supplier', icv_percentage: '65.00' } };
  assert.equal(recommendationIcv(record), '65%');
  const hydrated = hydrateRecommendationReferences(record);
  assert.equal(recommendationIcv({ vendor: 22, ...hydrated }, { live: true }), '65%');
  assert.equal(selectedRecommendationVendor(record, [{ id: 22, icv_percentage: 70 }]).icv_percentage, 70);
  assert.equal(recommendationIcv({ ...record, vendor_details: { id: 21, icv_percentage: 80 } }), '');
});

test('an empty current master ICV does not reuse an outdated shortlist percentage', () => {
  const record = { vendor: 22, selected_vendors: shortlist, vendor_details: { id: 22, icv_percentage: null } };
  assert.equal(recommendationIcv(record, { live: true }), '');
  assert.equal(recommendationIcv({ vendor: 22, ...hydrateRecommendationReferences(record) }, { live: true }), '');
  const legacyRecord = { ...record, selected_vendors: [{ vendor_id: 22, icv_value: '65' }] };
  assert.equal(recommendationIcv(legacyRecord), '');
  assert.equal(recommendationIcv({ vendor: 22, ...hydrateRecommendationReferences(legacyRecord) }), '');
});

test('zero is a recorded ICV and percentages are formatted consistently', () => {
  for (const value of [0, '0', '0.00', '0%']) {
    assert.equal(recommendationIcv({ vendor: 22, vendor_details: { id: 22, icv_percentage: value } }), '0%');
  }
  assert.equal(recommendationIcv({ vendor: 22, selected_vendors: [{ vendor_id: 22, icv_value: '65%' }] }), '65%');
});

test('captured import ICV is preserved until an explicit supplier change clears it', () => {
  const record = { vendor: 22, selected_vendors: shortlist, price_remarks_data: { icv: '42%' } };
  assert.equal(recommendationIcv(record), '42%');
  assert.equal(recommendationIcv({ ...record, price_remarks_data: { icv: '' } }), '65%');
  assert.equal(recommendationIcv({ ...record, vendor: 21, price_remarks_data: { icv: '' } }), '');
  assert.equal(recommendationIcv({ price_remarks_data: { icv: 0 } }), '0%');
  assert.equal(recommendationIcv({ supplier_name: 'Imported supplier', price_remarks_data: { icv: 'Not applicable' } }, { live: true }), 'Not applicable');
});

test('a recorded supplier name resolves its matching legacy snapshot without inventing a link', () => {
  const record = { supplier_name: ' Preferred supplier ', selected_vendors: shortlist };
  assert.equal(recommendationIcv(record), '65%');
  assert.equal(record.vendor, undefined);
});
