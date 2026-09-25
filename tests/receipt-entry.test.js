import test from 'node:test';
import assert from 'node:assert/strict';
import { localReceiptDate, receivingLinePreview, receiptOperation } from '../src/pages/Procurement/receiptHandoff.js';

test('receipt preview accounts for accepted and pending quantities before this delivery', () => {
  const line = { accepted: '4', pending: '1', available: '5' };
  assert.deepEqual(receivingLinePreview(line, '2.5'), { previouslyReceived: '5', balance: '2.5', status: 'Partial', awaitingConfirmation: true });
  assert.deepEqual(receivingLinePreview(line, '5'), { previouslyReceived: '5', balance: '0', status: 'Complete', awaitingConfirmation: true });
  assert.equal(receivingLinePreview({ accepted: '10', pending: '0', available: '0' }).awaitingConfirmation, false);
  assert.equal(receivingLinePreview({ accepted: '0', pending: '0', available: '10' }).status, 'Not received');
});

test('decimal preview preserves tiny remaining values and large quantities', () => {
  const line = { accepted: '9007199254740993.1', pending: '0.2', available: '0.300000000000000001' };
  assert.deepEqual(receivingLinePreview(line, '0.3'), { previouslyReceived: '9007199254740993.3', balance: '0.000000000000000001', status: 'Partial', awaitingConfirmation: true });
  assert.equal(receivingLinePreview(line, '0.300000000000000001').status, 'Complete');
  assert.equal(receivingLinePreview(line, '0.300000000000000002').balance, null);
  assert.equal(receivingLinePreview({ accepted: '200.00', pending: '0.00', available: '800.00' }, '125.25').balance, '674.75');
});

test('invalid input and unavailable balances never produce a complete or invented preview', () => {
  for (const entered of ['-1', 'invalid', 'Infinity']) {
    assert.equal(receivingLinePreview({ accepted: '0', pending: '0', available: '10' }, entered).status, null);
  }
  assert.equal(receivingLinePreview({ accepted: '1', available: '10' }, '2').balance, null);
});

test('receipt date uses local calendar fields and a changed date has a new retry identity', () => {
  assert.equal(localReceiptDate(new Date(2026, 8, 24, 0, 15)), '2026-09-24');
  const first = receiptOperation(null, { receipt_date: '2026-09-23' }, () => 'first');
  assert.equal(receiptOperation(first, { receipt_date: '2026-09-23' }, () => 'second'), first);
  assert.equal(receiptOperation(first, { receipt_date: '2026-09-22' }, () => 'second').key, 'second');
});
