import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_INVOICE_FILTERS, filterInvoices, inInvoiceQueue, invoiceAge, invoiceDate,
  invoiceMetrics, invoiceMoney, invoiceNumber, invoiceOverdue, invoicesCsv,
  loadInvoiceRegister, sortInvoices,
} from '../src/components/Finance/incomingInvoiceRegister.js';

const NOW = new Date(2026, 8, 14, 12).getTime();
const invoice = (overrides = {}) => ({ id: 1, invoice_number: 'INV-001', vendor_name: 'Supplier one', currency: 'AED',
  total_amount: '1000.00', procurement_status: 'ocr_review', match_status: 'unmatched', payment_status: 'not_scheduled',
  manual_review_required: true, due_date: '2026-09-13', received_date: '2026-09-11', ...overrides });

test('only verified, reviewed finance invoices qualify for approval; settled or held invoices never do', () => {
  const ready = invoice({ procurement_status: 'finance_review', match_status: 'verified', manual_review_required: false });
  assert.equal(inInvoiceQueue(ready, 'ready'), true);
  for (const change of [{ match_status: 'manual_matched' }, { match_status: 'auto_matched' }, { manual_review_required: true }, { manual_review_required: undefined }, { payment_status: 'paid' }, { payment_status: 'on_hold' }, { payment_status: 'cancelled' }]) {
    assert.equal(inInvoiceQueue({ ...ready, ...change }, 'ready'), false);
  }
});

test('tab counts and filtered queue memberships use the same complete cohort', () => {
  const data = [invoice(), invoice({ id: 2, procurement_status: 'ready_for_matching' }), invoice({ id: 3, procurement_status: 'approved_for_payment', match_status: 'verified' }), invoice({ id: 4, match_status: 'exception' })];
  const stats = invoiceMetrics(data, NOW);
  for (const queue of ['all', 'review', 'ready', 'exceptions', 'payment_ready', 'unmatched']) assert.equal(stats[queue], filterInvoices(data, INITIAL_INVOICE_FILTERS, queue, NOW).length);
  assert.equal(stats.review, 3);
  assert.equal(stats.payment_ready, 1);
});

test('due-date overdue excludes terminal invoices and treats the due date as payable through that day', () => {
  assert.equal(invoiceOverdue(invoice(), NOW), true);
  assert.equal(invoiceOverdue(invoice({ due_date: '2026-09-14' }), NOW), false);
  for (const change of [{ due_date: null }, { due_date: '2026-02-31' }, { due_date: 'invalid' }, { payment_status: 'paid' }, { payment_status: 'cancelled' }, { procurement_status: 'closed' }, { procurement_status: 'rejected' }]) assert.equal(invoiceOverdue(invoice(change), NOW), false);
  assert.equal(invoiceAge(invoice(), NOW), 3);
  assert.equal(invoiceAge(invoice({ received_date: null, created_at: '2026-09-12T23:00:00Z' }), NOW), 2);
  assert.equal(invoiceAge(invoice({ received_date: null }), NOW), null);
});

test('zero remains real, malformed amounts are unknown and missing currency is explicit', () => {
  for (const value of [null, undefined, '', ' ', false, [], {}, NaN, Infinity]) {
    assert.equal(invoiceNumber(value), null);
    assert.equal(invoiceMoney(value, 'AED'), '—');
  }
  assert.equal(invoiceMoney(0, 'USD'), 'USD 0.00');
  assert.equal(invoiceMoney('1420.15', ''), 'Currency not recorded 1,420.15');
  assert.equal(invoiceDate('2026-02-31'), '—');
  assert.equal(invoiceDate('2026-09-14'), '14 Sept 2026');
});

test('search and all combined filters use real invoice fields, including PO and tracking IDs', () => {
  const data = [invoice({ tracking_id: 'RAD-99', po_reference_text: 'PO-123' }), invoice({ id: 2, vendor_master_name: 'Master Supplier', currency: 'USD', match_status: 'verified', due_date: null })];
  for (const search of ['INV-001', 'supplier one', 'rad-99', 'po-123']) assert.equal(filterInvoices(data, { ...INITIAL_INVOICE_FILTERS, search, currency: 'AED' }).length, 1);
  assert.equal(filterInvoices(data, { ...INITIAL_INVOICE_FILTERS, vendor: 'Master Supplier', match: 'verified', currency: 'USD', due: 'not_set' }).length, 1);
  assert.equal(filterInvoices(data, { ...INITIAL_INVOICE_FILTERS, due: 'overdue' }, 'all', NOW).length, 1);
  assert.equal(filterInvoices(data, { ...INITIAL_INVOICE_FILTERS, workflow: 'finance_review' }).length, 0);
});

test('sorting preserves rows, orders numeric totals and keeps missing values last both ways', () => {
  const data = [invoice({ id: 1, total_amount: '10' }), invoice({ id: 2, total_amount: null }), invoice({ id: 3, total_amount: '2' })];
  assert.deepEqual(sortInvoices(data, 'total_amount').map(row => row.id), [3, 1, 2]);
  assert.deepEqual(sortInvoices(data, 'total_amount', 'desc').map(row => row.id), [1, 3, 2]);
  assert.deepEqual(data.map(row => row.id), [1, 2, 3]);
});

test('register loader traverses fixed-endpoint pages and deduplicates stable IDs', async () => {
  const calls = [];
  const result = await loadInvoiceRegister(async params => {
    calls.push(params);
    return params.page === 1 ? { count: 3, next: 'https://irrelevant.invalid/next', results: [invoice(), invoice({ id: 2 })] }
      : { count: 3, next: null, results: [invoice({ id: 2 }), invoice({ id: 3 })] };
  });
  assert.equal(result.length, 3);
  assert.deepEqual(calls, [{ page: 1, page_size: 500 }, { page: 2, page_size: 500 }]);
  assert.deepEqual(await loadInvoiceRegister(async () => []), []);
});

test('register refuses partial totals, repeated pages, invalid response or second-page failure', async () => {
  await assert.rejects(loadInvoiceRegister(async () => ({ count: 3, next: null, results: [invoice()] })), /incomplete/);
  await assert.rejects(loadInvoiceRegister(async () => ({ count: 3, next: '?page=2', results: [invoice()] })), /finish loading/);
  await assert.rejects(loadInvoiceRegister(async () => ({ detail: 'unexpected' })), /unexpected/);
  await assert.rejects(loadInvoiceRegister(async ({ page }) => { if (page === 2) throw new Error('network failed'); return { count: 2, next: '?page=2', results: [invoice()] }; }), /network failed/);
});

test('CSV retains currency and quoting while neutralizing spreadsheet formulas', () => {
  const csv = invoicesCsv([invoice({ invoice_number: '=SUM(A1)', vendor_name: 'Supplier "one", Ltd', total_amount: 0, currency: 'EUR' })]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=SUM(A1)"'));
  assert.ok(csv.includes('"Supplier ""one"", Ltd"'));
  assert.ok(csv.includes('"EUR","0"'));
});
