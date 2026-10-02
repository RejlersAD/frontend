import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterFrameworks, frameworkDate, frameworkLabel, frameworkMoney, frameworkOwner,
  frameworkRemaining, loadFrameworkRegister, sortFrameworks,
} from '../src/pages/Sales/salesFrameworkRegister.js';

test('framework register follows authorized service page numbers and returns every page', async () => {
  const calls = [];
  const result = await loadFrameworkRegister(async params => {
    calls.push(params);
    return params.page === 1
      ? { count: 2, results: [{ id: 'one' }], next: 'https://untrusted.example/private' }
      : { count: 2, results: [{ id: 'two' }], next: null };
  });
  assert.deepEqual(result, { results: [{ id: 'one' }, { id: 'two' }], count: 2 });
  assert.deepEqual(calls, [1, 2].map(page => ({ page, page_size: 100, ordering: '-created_at' })));
  assert.deepEqual(await loadFrameworkRegister(async () => []), { results: [], count: 0 });
});

test('changed or denied pages never become a partial successful register', async () => {
  for (const second of [
    { count: 3, results: [{ id: 'two' }], next: null },
    { count: 2, results: [{ id: 'one' }], next: '?page=1' },
    { count: 2, results: [], next: null },
    { count: 2, results: [{}], next: null },
  ]) {
    await assert.rejects(() => loadFrameworkRegister(async ({ page }) => page === 1
      ? { count: 2, results: [{ id: 'one' }], next: '?page=2' } : second), /changed while loading/);
  }
  await assert.rejects(() => loadFrameworkRegister(async ({ page }) => {
    if (page === 2) throw new Error('Access denied');
    return { count: 2, results: [{ id: 'one' }], next: '?page=2' };
  }), /Access denied/);
});

test('malformed and unbounded pages fail explicitly', async () => {
  for (const response of [null, {}, { results: null }, { results: [], count: -1 }, { results: [], count: '0' }]) {
    await assert.rejects(() => loadFrameworkRegister(async () => response), /loaded completely/);
  }
  let fetched = 0;
  await assert.rejects(() => loadFrameworkRegister(async ({ page }) => {
    fetched += 1;
    return { results: [{ id: String(page) }], next: '?page=next' };
  }), /loaded completely/);
  assert.equal(fetched, 200);
});

test('remaining preserves only the recorded server amount without inventing reservation availability', () => {
  assert.equal(frameworkRemaining({ remaining_value: '1800000.00', ceiling_value: '5000000.00', committed_value: '3200000.00', active_reservations: '300000.00' }), '1800000.00');
  assert.equal(frameworkRemaining({ remaining_value: '0.00' }), '0.00');
  assert.equal(frameworkRemaining({ remaining_value: 0 }), 0);
  assert.equal(frameworkRemaining({ remaining_value: '-100.00' }), '-100.00');
  assert.equal(frameworkRemaining({ ceiling_value: '5000000.00', committed_value: '3200000.00' }), null);
  for (const value of [undefined, null, '', ' ', 'NaN', '1,000', '1e3', true, {}, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(frameworkRemaining({ remaining_value: value }), null);
  }
});

test('money keeps exact decimal digits and distinguishes missing currency and missing value', () => {
  assert.equal(frameworkMoney('9007199254740993.25', 'AED'), 'AED 9,007,199,254,740,993.25');
  assert.equal(frameworkMoney('0.00', 'AED'), 'AED 0');
  assert.equal(frameworkMoney('0.10', 'USD'), 'USD 0.1');
  assert.equal(frameworkMoney('1500000.00', 'AED', { compact: true }), 'AED 1.50m');
  assert.equal(frameworkMoney('800000.00', 'AED', { compact: true }), 'AED 800k');
  assert.equal(frameworkMoney('800500.00', 'AED', { compact: true }), 'AED 800.5k');
  assert.equal(frameworkMoney('1234.56', 'AED', { decimals: 0 }), 'AED 1,235');
  assert.equal(frameworkMoney('1500000.00', ''), '1,500,000 (currency not recorded)');
  assert.equal(frameworkMoney(null, 'AED'), '—');
  assert.equal(frameworkMoney('', 'AED'), '—');
});

test('date-only display validates the calendar without timezone conversion', () => {
  assert.equal(frameworkDate('2026-12-31'), '31 Dec 2026');
  assert.equal(frameworkDate('2024-02-29'), '29 Feb 2024');
  assert.equal(frameworkDate('2000-02-29'), '29 Feb 2000');
  for (const date of [null, undefined, '', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '0000-01-01', '2026-12-31T22:00:00Z']) {
    assert.equal(frameworkDate(date), '—', String(date));
  }
});

test('status and ownership display preserve supplied state without implied people or policy', () => {
  assert.equal(frameworkLabel('pending_signature'), 'Pending Signature');
  assert.equal(frameworkLabel('internal_review'), 'Internal Review');
  assert.equal(frameworkLabel(null), '—');
  assert.equal(frameworkOwner({ owner: 'owner-id', owner_name: '  Recorded Owner  ' }), 'Recorded Owner');
  assert.equal(frameworkOwner({ owner: 'owner-id', owner_name: '' }), 'Name unavailable');
  assert.equal(frameworkOwner({ owner: null }), 'Unassigned');
});

const rows = [
  { id: 'first', framework_number: 'FW-2', title: 'Engineering Services', client: 'client-a', client_name: 'Demo Client A', owner: 'owner-a', owner_name: 'Alice', status: 'active', currency: 'AED', expiry_date: '2026-12-31', remaining_value: '9007199254740993.25' },
  { id: 'second', framework_number: 'FW-10', title: 'Plant Support', client: 'client-b', client_name: 'Demo Client B', owner: null, status: 'draft', currency: 'AED', expiry_date: '2027-06-30', remaining_value: '9007199254740993.24' },
  { id: 'third', framework_number: 'FW-3', title: 'Design Services', client: 'client-a', client_name: 'Demo Client A', owner: 'owner-b', owner_name: 'Bob', status: 'expired', currency: 'USD', expiry_date: null, remaining_value: null },
];

test('search and facets operate on canonical framework fields without silently changing status', () => {
  assert.deepEqual(filterFrameworks(rows, { query: ' ENGINEERING ', status: 'active', client: 'client-a', owner: 'owner-a', currency: 'AED' }).map(row => row.id), ['first']);
  assert.deepEqual(filterFrameworks(rows, { query: 'client a' }).map(row => row.id), ['first', 'third']);
  assert.deepEqual(filterFrameworks(rows, { query: 'fw-10', owner: 'unassigned' }).map(row => row.id), ['second']);
  assert.deepEqual(filterFrameworks(rows, { query: 'alice' }).map(row => row.id), ['first']);
  assert.deepEqual(filterFrameworks(rows, { status: 'draft', client: 'client-a' }), []);
  assert.deepEqual(filterFrameworks(rows).map(row => row.id), ['first', 'second', 'third']);
  assert.deepEqual(filterFrameworks(null), []);
});

test('register sorting uses exact money and keeps missing amounts and dates last', () => {
  const original = rows.map(row => row.id);
  assert.deepEqual(sortFrameworks(rows, 'agreement', 'asc').map(row => row.id), ['first', 'third', 'second']);
  assert.deepEqual(sortFrameworks(rows, 'remaining', 'asc').map(row => row.id), ['second', 'first', 'third']);
  assert.deepEqual(sortFrameworks(rows, 'remaining_value', 'desc').map(row => row.id), ['first', 'second', 'third']);
  assert.deepEqual(sortFrameworks(rows, 'expiry_date', 'desc').map(row => row.id), ['second', 'first', 'third']);
  assert.deepEqual(rows.map(row => row.id), original);
});

test('monetary sorting groups currencies and retains negative and zero recorded values', () => {
  const values = [
    { id: 'usd-small', currency: 'USD', remaining_value: '1.00' },
    { id: 'aed-large', currency: 'AED', remaining_value: '1000000.00' },
    { id: 'aed-zero', currency: 'AED', remaining_value: '0.00' },
    { id: 'aed-negative', currency: 'AED', remaining_value: '-1.00' },
  ];
  assert.deepEqual(sortFrameworks(values, 'remaining').map(row => row.id), ['aed-negative', 'aed-zero', 'aed-large', 'usd-small']);
});
