import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptFilterMonth, receiptRecentActivity } from '../src/components/Procurement/goodsReceiptPresentation.js';

test('month selection describes only a complete calendar month, including leap years', () => {
  assert.equal(receiptFilterMonth({ received_from: '2026-09-01', received_to: '2026-09-30' }), '2026-09');
  assert.equal(receiptFilterMonth({ received_from: '2028-02-01', received_to: '2028-02-29' }), '2028-02');
  assert.equal(receiptFilterMonth({ received_from: '2026-09-05', received_to: '2026-10-20' }), '');
  assert.equal(receiptFilterMonth({ received_from: '2026-09-01', received_to: '2026-10-20' }), '');
  assert.equal(receiptFilterMonth({ received_from: '2026-09-01', received_to: '' }), '');
  assert.equal(receiptFilterMonth({}), '');
});

test('activity uses recorded decisions and creation timestamps without inventing evidence events', () => {
  const receipt = { id: 'r1', receipt_number: 'TEST-GR-1', created_at: '2026-09-20T09:00:00Z', updated_at: '2026-09-28T12:00:00Z', attachments: ['note.pdf'], workflow_history: [
    { action: 'accept', at: '2026-09-22T10:00:00Z' },
    { action: 'metadata_update', at: '2026-09-28T12:00:00Z' },
    { action: 'reject_delivery', at: 'invalid date' },
    null,
  ] };
  const events = receiptRecentActivity([receipt]);
  assert.deepEqual(events.map(event => event.label), ['Receipt accepted · TEST-GR-1', 'Receipt recorded · TEST-GR-1']);
  assert.equal(events[0].receipt, receipt);
  assert.equal(events[0].tone, 'green');
});

test('confirmation projection and history describe one event even with equivalent time zones', () => {
  const events = receiptRecentActivity([{ id: 'r1', receipt_number: 'TEST-GR-1', confirmation: { confirmed_at: '2026-09-28T12:00:00+04:00' }, workflow_history: [{ action: 'confirm_delivery', at: '2026-09-28T08:00:00Z' }] }]);
  assert.equal(events.length, 1);
  assert.equal(events[0].label, 'Delivery confirmed · TEST-GR-1');
});

test('activity sorts across visible receipts and never guesses absent timestamps from receipt dates', () => {
  const events = receiptRecentActivity([
    { id: 'r1', created_at: '2026-09-20T10:00:00Z' },
    { id: 'r2', receipt_date: '2026-09-28', updated_at: '2026-09-28T10:00:00Z' },
    { id: 'r3', created_at: '2026-09-24T10:00:00Z', workflow_history: [{ action: 'reject_delivery', at: '2026-09-25T10:00:00Z' }] },
    { id: 'r4', created_at: '2026-09-26T10:00:00Z', workflow_history: 'malformed' },
  ]);
  assert.deepEqual(events.map(event => event.receipt.id), ['r4', 'r3', 'r3']);
  assert.equal(events[1].tone, 'red');
  assert.deepEqual(receiptRecentActivity([{ id: 'r5', created_at: '2026-09-28', workflow_history: [] }]), []);
});
