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

test('proposed rejection preserves available balance and only proposed accepted quantities await confirmation', () => {
  const line = { accepted: '0', pending: '0', available: '0.300001' };
  assert.deepEqual(receivingLinePreview(line, '0.300001', '0.100001'), {
    previouslyReceived: '0', balance: '0.100001', status: 'Partial', awaitingConfirmation: true,
  });
  assert.deepEqual(receivingLinePreview(line, '0.300001', '0.300001'), {
    previouslyReceived: '0', balance: '0.300001', status: 'Not received', awaitingConfirmation: false,
  });
  assert.equal(receivingLinePreview({ ...line, pending: '0.1' }, '0.3', '0.3').awaitingConfirmation, true);
  assert.equal(receivingLinePreview({ accepted: '200', pending: '100', available: '700' }, '125.25', '25.10').balance, '599.85');
});

test('rejected entries cannot conceal overdelivery or exceed delivered quantities', () => {
  const line = { accepted: '9007199254740993.1', pending: '0.2', available: '0.300001' };
  assert.equal(receivingLinePreview(line, '0.300001', '0.000001').balance, '0.000001');
  for (const [received, rejected] of [['0.300002', '0.300002'], ['0.3', '0.300001'], ['0.3', '-1'], ['0.3', 'invalid']]) {
    const result = receivingLinePreview(line, received, rejected);
    assert.equal(result.balance, null);
    assert.equal(result.status, null);
  }
});

test('receipt date uses local calendar fields and a changed date has a new retry identity', () => {
  assert.equal(localReceiptDate(new Date(2026, 8, 24, 0, 15)), '2026-09-24');
  const first = receiptOperation(null, { receipt_date: '2026-09-23' }, () => 'first');
  assert.equal(receiptOperation(first, { receipt_date: '2026-09-23' }, () => 'second'), first);
  assert.equal(receiptOperation(first, { receipt_date: '2026-09-22' }, () => 'second').key, 'second');
});
