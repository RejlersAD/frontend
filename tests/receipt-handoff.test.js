import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceivingLines, receiptOperation } from '../src/pages/Procurement/receiptHandoff.js';
import { invoicePoReferences, filterInvoices, invoicesCsv } from '../src/components/Finance/incomingInvoiceRegister.js';
import { receiptDisplayItems, receiptReviewStatus } from '../src/components/Procurement/goodsReceiptReviewPresentation.js';
import { receiptInspection, receiptsCsv } from '../src/components/Procurement/goodsReceiptPresentation.js';

test('quantity receipt uses server line identities and decimal balances without inventing accepted evidence', () => {
  const summary = { basis: 'quantity', lines: [{ line_id: 'line-1', description: 'Pipe', available: '0.300000000000000001' }, { line_id: 'line-2', description: 'Valve', available: '2' }] };
  assert.deepEqual(buildReceivingLines(summary, { 'line-1': { received: '0.300000000000000001', rejected: '0.1' } }), [{ line_id: 'line-1', received_qty: '0.300000000000000001', rejected_qty: '0.1' }]);
  assert.throws(() => buildReceivingLines(summary, { 'line-1': { received: '0.300000000000000002' } }), /available balance/);
});
test('service receipt carries value fields and blocks rejected values above the received amount', () => {
  const summary = { basis: 'service_value', lines: [{ line_id: 'service:total', description: 'Service', available: '500.25' }] };
  assert.deepEqual(buildReceivingLines(summary, { 'service:total': { received: '125.25', rejected: '0' } }), [{ line_id: 'service:total', received_amount: '125.25', rejected_amount: '0' }]);
  assert.throws(() => buildReceivingLines(summary, { 'service:total': { received: '10', rejected: '10.01' } }), /cannot exceed/);
  assert.throws(() => buildReceivingLines(summary, {}), /greater than zero/);
  assert.throws(() => buildReceivingLines({ basis: 'unavailable' }, {}), /unavailable/);
});
test('unchanged retry keeps operation identity, changed payload starts a different operation', () => {
  const first = receiptOperation(null, { notes: 'one', status: 'pending' }, () => 'first');
  assert.equal(receiptOperation(first, { notes: 'one', status: 'pending' }, () => 'second'), first);
  assert.equal(receiptOperation(first, { notes: 'two', status: 'pending' }, () => 'second').key, 'second');
});

test('service receipt presentation shows monetary values and does not claim pending acceptance', () => {
  const receipt = { status: 'pending', items_received: [{ basis: 'service_value', uom: 'AED', ordered_amount: '1000.00', received_amount: '125.25', accepted_amount: '125.25', rejected_amount: '0.00' }] };
  assert.equal(receiptDisplayItems(receipt)[0].received_qty, '125.25');
  assert.equal(receiptDisplayItems(receipt)[0].accepted_qty, null);
  assert.equal(receiptDisplayItems({ ...receipt, status: 'accepted' })[0].accepted_qty, '125.25');
  assert.equal(receiptDisplayItems(receipt)[0].uom, 'AED');
});
test('full or partial delivery confirmation never implies technical inspection and exports actual confirmation evidence', () => {
  const pending = { status: 'pending', status_display: 'Pending Inspection', quality_check_passed: null };
  assert.equal(receiptReviewStatus(pending).label, 'Awaiting confirmation');
  const confirmed = { ...pending, status: 'accepted', confirmation: { responsible_user_name: 'Synthetic receiver', confirmed_by_name: 'Synthetic receiver', confirmed_at: '2026-09-24T10:10:00Z' } };
  assert.equal(receiptReviewStatus(confirmed).label, 'Delivery confirmed');
  assert.equal(receiptInspection(confirmed).label, 'Not assessed');
  const partial = { ...confirmed, status: 'partial' };
  assert.equal(receiptReviewStatus(partial).label, 'Delivery partly confirmed');
  assert.equal(receiptInspection(partial).label, 'Not assessed');
  assert.equal(receiptInspection({ ...partial, visual_inspection_passed: false }).label, 'Failed');
  assert.match(receiptsCsv([partial]), /Delivery partly confirmed/);
  assert.match(receiptsCsv([partial]), /2026-09-24T10:10:00Z/);
});
test('invoice PO presentation, search and CSV prefer canonical allocations while keeping captured text searchable', () => {
  const invoice = { invoice_number: 'INV-1', po_reference_text: 'OCR-WRONG', confirmed_po_references: [{ id: 'a', po_number: 'PO-CANONICAL' }, { id: 'a', po_number: 'PO-CANONICAL' }] };
  assert.equal(invoicePoReferences(invoice), 'PO-CANONICAL');
  assert.equal(filterInvoices([invoice], { search: 'PO-CANONICAL' }).length, 1);
  assert.equal(filterInvoices([invoice], { search: 'OCR-WRONG' }).length, 1);
  assert.match(invoicesCsv([invoice]), /PO-CANONICAL/);
  assert.equal(invoicePoReferences({ po_reference_text: 'UNMATCHED' }), 'UNMATCHED');
});
