import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptNumber, receiptInspection, receiptAge, receiptDocuments, receiptsCsv, loadReceiptPages } from '../src/components/Procurement/goodsReceiptPresentation.js';

test('Receipt values distinguish known zero from absent and malformed quantities', () => {
  assert.equal(receiptNumber('0.00'), 0);
  for (const value of [null, undefined, '', ' ', false, NaN, Infinity, '12x']) assert.equal(receiptNumber(value), null);
});

test('Default flags on pending receipts do not establish a passed inspection', () => {
  const pending = { status: 'pending', quality_check_passed: true, visual_inspection_passed: true };
  assert.equal(receiptInspection(pending).label, 'Pending');
  assert.equal(receiptInspection({ ...pending, quality_check_passed: false }).label, 'Failed');
  assert.equal(receiptInspection({ ...pending, status: 'accepted' }).label, 'Recorded pass');
  assert.equal(receiptAge({ ...pending, receipt_date: '2026-09-13' }, '2026-09-14').age, '1 day');
  assert.equal(receiptAge({ ...pending, receipt_date: null }, '2026-09-14').age, 'Date not recorded');
});

test('Certificate counts count matching declarations, never unrelated uploaded names', () => {
  assert.equal(receiptDocuments({}).label, 'Not assessed');
  assert.equal(receiptDocuments({ evidence: { certificates: { status: 'missing', required_count: 2, received_count: 9, missing: ['MTC'], matched_count: 1 } } }).label, '1 of 2');
  assert.equal(receiptDocuments({ evidence: { certificates: { status: 'unassessed', required_count: null, received_count: 0, missing: [] } } }).label, 'Not assessed');
});

test('CSV protects formula prefixes and keeps absent receipt context empty', () => {
  const csv = receiptsCsv([{ receipt_number: '=SUM(1,2)', vendor_name: 'A "quoted" supplier', inspector_name: '@person' }]);
  assert.ok(csv.includes('"\'=SUM(1,2)"')); assert.ok(csv.includes('A ""quoted"" supplier')); assert.ok(csv.includes('"\'@person"')); assert.ok(!csv.includes('undefined'));
});

test('Complete export uses the authorized endpoint and rejects truncation or changed counts', async () => {
  const calls = [];
  const rows = await loadReceiptPages(async params => { calls.push(params); return params.page === 1 ? { count: 2, next: 'https://untrusted.example.test/not-followed', results: [{ id: 'a' }] } : { count: 2, next: null, results: [{ id: 'b' }] }; }, { queue: 'pending' });
  assert.deepEqual(rows.map(row => row.id), ['a', 'b']); assert.deepEqual(calls.map(call => call.page), [1, 2]); assert.ok(calls.every(call => call.queue === 'pending' && call.page_size === 200));
  for (const second of [{ count: 3, next: null, results: [{ id: 'b' }] }, { count: 2, next: null, results: [{ id: 'a' }] }, { count: 2, next: null, results: [] }]) await assert.rejects(loadReceiptPages(async ({ page }) => page === 1 ? { count: 2, next: 'next', results: [{ id: 'a' }] } : second));
  await assert.rejects(loadReceiptPages(async () => ({ count: '2', results: [] })));
});
