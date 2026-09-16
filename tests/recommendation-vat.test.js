import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCompleteRecommendationPricing, recommendationEnteredAmount, recommendationVat } from '../src/pages/Procurement/recommendationVat.js';
import { prepareRecommendationPayload } from '../src/pages/Procurement/recommendationFormPayload.js';

test('unconfirmed records retain recorded amounts even when they imply a different VAT rate', () => {
  for (const total_price of ['2052.00', '2154.60', '2359.80']) {
    const record = { net_total_excl_vat: '2052.00', total_price, items: [{ quantity: 1, unit_price: '3000', vat_rate: '15' }] };
    assert.equal(recommendationVat(record).totalAmount, Number(total_price));
    assert.equal(recommendationVat(record).vatRate, null);
    const saved = prepareRecommendationPayload(record);
    assert.equal(saved.net_total_excl_vat, '2052.00');
    assert.equal(saved.total_price, total_price);
    assert.equal('vat_basis' in saved, false);
    assert.equal('entered_amount' in saved, false);
    assert.deepEqual(saved.price_remarks_data.line_details, [{ vat_rate: '15' }]);
  }
});

for (const [basis, entered, net, gross, tax] of [
  ['exclusive', '100.00', '100.00', '105.00', 5],
  ['inclusive', '100.00', '95.24', '100.00', 4.76],
  ['inclusive', '0.10', '0.10', '0.10', 0],
  ['none', '100.00', '100.00', '100.00', 0],
]) test(`explicit ${basis} confirmation of ${entered} saves canonical values without compounding`, () => {
  const record = { vat_basis: basis, _vatPricingChanged: true, _vatEnteredAmount: entered,
    net_total_excl_vat: net, total_price: gross,
    items: [{ description: 'Service', quantity: 1, unit_price: entered, total: entered }],
  };
  const saved = prepareRecommendationPayload(record);
  assert.equal(saved.net_total_excl_vat, net);
  assert.equal(saved.total_price, gross);
  assert.equal(saved.entered_amount, entered);
  assert.equal(saved.vat_basis, basis);
  assert.equal(recommendationVat(saved).taxAmount, tax);
  assert.equal(saved.items[0].unit_price, entered);
  assert.equal('_vatPricingChanged' in saved, false);
  assert.equal('_vatEnteredAmount' in saved, false);
  const ordinarySave = prepareRecommendationPayload({ ...saved, _vatPricingChanged: false });
  assert.equal(ordinarySave.total_price, gross);
  assert.equal('vat_basis' in ordinarySave, false);
});

test('opening a previously confirmed record does not submit a new financial confirmation', () => {
  const record = { vat_basis: 'exclusive', _vatPricingChanged: false, net_total_excl_vat: '100.00', total_price: '100.00', price_remarks_data: {} };
  const saved = prepareRecommendationPayload(record);
  assert.equal(saved.total_price, '100.00');
  assert.equal('vat_basis' in saved, false);
  assert.equal('entered_amount' in saved, false);
  assert.equal(recommendationVat(record).totalAmount, 100);
});

test('confirmation uses the entered subtotal without removing a legacy discount twice', () => {
  assert.equal(recommendationEnteredAmount({ total_price: '100.00', net_total_excl_vat: null }), 100);
  assert.equal(recommendationEnteredAmount({ net_total_excl_vat: '90.00', price_remarks_data: { discount_amount: '10.00' } }), 100);
  assert.equal(recommendationEnteredAmount({ vat_basis: 'inclusive', total_price: '100.00', net_total_excl_vat: '95.24' }), 100);
});

test('partial line pricing falls back to the recorded request amount without treating blanks as zero', () => {
  for (const items of [
    [{ quantity: '', unit_price: 100, total: '2052.00' }],
    [{ quantity: 1, unit_price: '', total: '2052.00' }],
    [{ quantity: 1, unit_price: 100, total: '100.00' }, { quantity: '', unit_price: '', total: '1952.00' }],
  ]) {
    assert.equal(items.every(hasCompleteRecommendationPricing), false);
    assert.equal(recommendationEnteredAmount({ items, net_total_excl_vat: '2052.00', total_price: '2154.60' }), 2052);
    assert.equal(recommendationEnteredAmount({ items, vat_basis: 'inclusive', net_total_excl_vat: '2052.00', total_price: '2154.60' }), 2154.6);
    assert.equal(recommendationEnteredAmount({ items }), null);
  }
  assert.equal(hasCompleteRecommendationPricing({ quantity: 0, unit_price: 100 }), true);
  assert.equal(recommendationEnteredAmount({ items: [{ quantity: 0, unit_price: 100 }] }), 0);
});

test('editing operands to partial pricing resends a confirmed VAT basis and preserves request amounts', () => {
  const record = { items: [{ description: '', quantity: '', unit_price: '100.00', total: '2052.00' }],
    vat_basis: 'exclusive', _vatPricingChanged: true, net_total_excl_vat: '2052.00', total_price: '2154.60' };
  const payload = prepareRecommendationPayload(record);
  assert.equal(payload.vat_basis, 'exclusive');
  assert.equal(payload.entered_amount, 2052);
  assert.equal(payload.net_total_excl_vat, '2052.00');
  assert.equal(payload.total_price, '2154.60');
  assert.deepEqual(payload.items, record.items);
});

test('VAT confirmation leaves original PDF references and signed approval evidence intact', () => {
  const attachments = [{ type: 'signed_purchase_requisition_pdf', sha256: 'original-bytes', content_url: '/source/content/' }];
  const verification = { signed_off: true, document_sha256: 'original-bytes', source_approval_rows: [{ name: 'Signer', status: 'approved' }] };
  const record = { vat_basis: 'exclusive', net_total_excl_vat: '2052.00', total_price: '2052.00', attachments, price_remarks_data: { signed_document_verification: verification } };
  const saved = prepareRecommendationPayload(record);
  assert.equal(saved.total_price, '2154.60');
  assert.equal(saved.attachments, attachments);
  assert.equal(saved.price_remarks_data.signed_document_verification, verification);
  assert.equal(record.total_price, '2052.00');
});
