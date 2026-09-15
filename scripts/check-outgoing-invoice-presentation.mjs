import assert from 'node:assert/strict';
import test from 'node:test';
import { outgoingMoney, outgoingNumber, outgoingState, outgoingCsv, outgoingCollectionCurrency, loadOutgoingExport } from '../src/components/Finance/outgoingInvoicePresentation.js';

test('Original currency amounts distinguish zero, missing and malformed values', () => {
  assert.equal(outgoingMoney('0.00', 'USD'), 'USD 0.00');
  assert.equal(outgoingMoney('-12.50', 'EUR'), 'EUR -12.50');
  for (const missing of [null, undefined, '', ' ', false, NaN, Infinity]) assert.equal(outgoingNumber(missing), null);
  for (const currency of ['', null, 'UNSPECIFIED']) assert.equal(outgoingMoney('1250.00', currency), '—');
  assert.equal(outgoingMoney(null, 'AED'), '—');
  assert.equal(outgoingMoney('9999999999999999.99', 'AED'), 'AED 9,999,999,999,999,999.99');
});

test('Collection state uses recorded balance and current contractual due date', () => {
  const row = { payment_status: 'pending', grand_total: '100.00', balance_to_be_received: '100.00', actual_payment_received: '0.00', due_date: '2026-09-13' };
  assert.equal(outgoingState(row, '2026-09-14').label, 'Overdue');
  assert.equal(outgoingState({ ...row, due_date: '2026-09-14' }, '2026-09-14').age, 'Due today');
  assert.equal(outgoingState({ ...row, balance_to_be_received: null }, '2026-09-14').label, 'Balance missing');
  assert.equal(outgoingState({ ...row, balance_to_be_received: '0.00' }, '2026-09-14').label, 'Settled');
  assert.equal(outgoingState({ ...row, balance_to_be_received: '-5.00' }, '2026-09-14').label, 'Credit balance');
  assert.equal(outgoingState({ ...row, payment_status: 'paid' }, '2026-09-14').label, 'Check settlement');
  assert.equal(outgoingState({ ...row, payment_status: 'cancelled' }, '2026-09-14').label, 'Cancelled');
  assert.equal(outgoingState({ ...row, payment_status: 'credit_note' }, '2026-09-14').label, 'Credit note');
  assert.equal(outgoingState({ ...row, actual_payment_received: '10.00', due_date: null }, '2026-09-14').label, 'Partially paid');
  assert.ok(!outgoingState({ ...row, grand_total: null, balance_to_be_received: '0.00' }, '2026-09-14').age.includes('Due in -'));
});

test('CSV escapes formula-leading values and quotes without inventing currency or balance', () => {
  const csv = outgoingCsv([{ invoice_number: '=SUM(1,2)', account: 'A "quoted" customer', currency: '', balance_to_be_received: null, pm: '@person', payment_status: 'pending' }], '2026-09-14');
  assert.ok(csv.includes('"\'=SUM(1,2)"')); assert.ok(csv.includes('A ""quoted"" customer')); assert.ok(csv.includes('"\'@person"')); assert.ok(!csv.includes('AED'));
  const precise = outgoingCsv([{ currency: 'AED', balance_to_be_received: '9999999999999999.99' }], '2026-09-14'); assert.ok(precise.includes('9999999999999999.99'));
});

test('Absent currency groups preserve zero only when original units are fully known', () => {
  const collection_health = { status: 'available', missing_currency_count: 0, by_currency: [] };
  const known = outgoingCollectionCurrency({ collection_health }, 'USD'); assert.equal(known.overdue, '0.00'); assert.equal(known.buckets.length, 6); assert.ok(known.buckets.every(bucket => bucket.amount === '0.00' && bucket.count === 0));
  for (const status of ['error', 'restricted', 'unavailable']) assert.equal(outgoingCollectionCurrency({ collection_health: { ...collection_health, status } }, 'USD'), null);
  const otherCurrencyIncomplete = { ...collection_health, status: 'incomplete', missing_balance_count: 1, by_currency: [{ currency: 'USD', status: 'incomplete', overdue: null }] };
  assert.equal(outgoingCollectionCurrency({ collection_health: otherCurrencyIncomplete }, 'EUR')?.overdue, '0.00');
  assert.equal(outgoingCollectionCurrency({ collection_health: otherCurrencyIncomplete }, 'USD')?.overdue, null);
  assert.equal(outgoingCollectionCurrency({ collection_health: { ...collection_health, missing_currency_count: 1 } }, 'USD'), null);
  assert.equal(outgoingCollectionCurrency({ collection_health }, 'UNSPECIFIED'), null);
  assert.equal(outgoingCollectionCurrency(null, 'USD'), null);
});

test('Full export traverses the authorized list endpoint and preserves every row', async () => {
  const calls = [];
  const rows = await loadOutgoingExport(async params => { calls.push(params); return params.page === 1 ? { count: 3, next: 'https://untrusted.example.test/never-followed', results: [{ id: 1 }, { id: 2 }] } : { count: 3, next: null, results: [{ id: 3 }] }; }, { queue: 'overdue', currency: 'USD' });
  assert.deepEqual(rows.map(row => row.id), [1, 2, 3]);
  assert.deepEqual(calls, [{ queue: 'overdue', currency: 'USD', page: 1, page_size: 200 }, { queue: 'overdue', currency: 'USD', page: 2, page_size: 200 }]);
});

test('Exports refuse changed totals, duplicate IDs, incomplete pages and malformed responses', async () => {
  for (const second of [{ count: 3, next: null, results: [{ id: 2 }] }, { count: 2, next: null, results: [{ id: 1 }] }, { count: 2, next: null, results: [] }]) {
    await assert.rejects(loadOutgoingExport(async ({ page }) => page === 1 ? { count: 2, next: 'next', results: [{ id: 1 }] } : second, {}));
  }
  await assert.rejects(loadOutgoingExport(async () => ({ count: '2', results: [] }), {}));
});
