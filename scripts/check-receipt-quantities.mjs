import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReceiptItems, receiptLineDrafts } from '../src/pages/Procurement/receiptQuantity.js';

const po = { items: [{ id: 'line-a', description: 'Valves', quantity: '10', unit: 'EA' }, { id: 'line-b', description: 'Cable', quantity: '100', unit: 'm' }] };
test('Partial deliveries preserve entered line quantities and never aggregate mixed units', () => {
  const drafts = receiptLineDrafts(po); assert.ok(drafts.every(line => line.received_qty === ''));
  drafts[0].received_qty = '3'; drafts[0].rejected_qty = '1'; drafts[1].received_qty = '12.5'; drafts[1].rejected_qty = '0.2';
  const rows = buildReceiptItems(po, drafts);
  assert.deepEqual(rows.map(({ po_line_id, uom, ordered_qty, received_qty, rejected_qty, accepted_qty }) => ({ po_line_id, uom, ordered_qty, received_qty, rejected_qty, accepted_qty })), [
    { po_line_id: 'line-a', uom: 'EA', ordered_qty: '10', received_qty: '3', rejected_qty: '1', accepted_qty: '2' },
    { po_line_id: 'line-b', uom: 'm', ordered_qty: '100', received_qty: '12.5', rejected_qty: '0.2', accepted_qty: '12.3' },
  ]);
});
test('Unreceived lines stay omitted and decimal subtraction remains exact', () => {
  const drafts = receiptLineDrafts(po); drafts[0].received_qty = '0.3'; drafts[0].rejected_qty = '0.1';
  const rows = buildReceiptItems(po, drafts); assert.equal(rows.length, 1); assert.equal(rows[0].accepted_qty, '0.2');
});
test('Invalid and excessive rejection quantities are rejected before any submit', () => {
  assert.throws(() => buildReceiptItems(po, receiptLineDrafts(po)), /at least one/);
  for (const rejected_qty of ['4', '-1', 'NaN']) assert.throws(() => buildReceiptItems(po, [{ received_qty: '3', rejected_qty }, { received_qty: '', rejected_qty: '0' }]));
  assert.throws(() => buildReceiptItems(po, [{ received_qty: '3', rejected_qty: '0' }]), /current purchase-order/);
});
test('Missing line and fallback units require explicit input, never EA or LOT assumptions', () => {
  const noUnit = { items: [{ description: 'Uncoded material', quantity: null }] }, drafts = receiptLineDrafts(noUnit); drafts[0].received_qty = '2';
  assert.throws(() => buildReceiptItems(noUnit, drafts), /unit of measure/); drafts[0].uom = 'kg';
  assert.equal(buildReceiptItems(noUnit, drafts)[0].uom, 'kg'); assert.equal(buildReceiptItems(noUnit, drafts)[0].ordered_qty, null);
  assert.throws(() => buildReceiptItems({ title: 'Single uncoded receipt' }, [], { quantity_received: '2' }), /unit of measure/);
  assert.equal(buildReceiptItems({}, [], { quantity_received: '2', quantity_rejected: '0.5', quantity_uom: 'kg' })[0].accepted_qty, '1.5');
});
