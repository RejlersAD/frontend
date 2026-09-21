import test from 'node:test';
import assert from 'node:assert/strict';
import { receivableAlert, receivableChartRows, receivableCollectionRoute, receivableCustomer, receivableCustomerRows, receivableMetricNote, receivableNumber, receivableRawValue, receivableValue, receivablesCsv } from '../src/components/Finance/financeReceivablesPresentation.js';
import { receivablesFixture } from './check-receivables-dashboard-fixtures.mjs';

test('recorded subtotals remain visible without treating unknown balances as zero', () => {
  assert.equal(receivableValue({ amount: null, known_amount: '100.25', partial: true }), 100.25);
  assert.equal(receivableValue({ amount: null, known_amount: null, partial: true }), null);
  assert.equal(receivableValue({ amount: '0.00', known_amount: '0.00', partial: false }), 0);
  assert.equal(receivableValue({ amount: null, known_amount: '100', partial: false }), null);
  assert.equal(receivableMetricNote({ amount: null, known_amount: null, count: null, partial: true }), 'Balance not available');
  assert.match(receivableMetricNote({ count: 226, missing_count: 1, partial: true }), /1 balance missing/);
});

test('recorded decimal amounts retain cents beyond JavaScript integer precision', () => {
  const metric = { amount: '9999999999999999.99', partial: false };
  assert.equal(receivableNumber(receivableRawValue(metric)), '9,999,999,999,999,999.99');
  assert.equal(receivableNumber('12345.00'), '12,345');
  assert.equal(receivableNumber('12345.60'), '12,345.60');
});

test('customer and priority drilldowns retain the original currency and company scope', () => {
  const filters = { currency: 'USD', company: 'North & South' };
  const priority = new URL(receivableCollectionRoute(filters), 'http://local.test');
  assert.equal(priority.searchParams.get('queue'), 'overdue');
  assert.equal(priority.searchParams.get('currency'), 'USD');
  assert.equal(priority.searchParams.get('company'), 'North & South');
  const customer = new URL(receivableCollectionRoute(filters, ' Customer A '), 'http://local.test');
  assert.equal(customer.searchParams.get('queue'), 'open');
  assert.equal(customer.searchParams.get('company'), 'Customer A');
  assert.equal(customer.searchParams.get('currency'), 'USD');
  assert.equal(customer.searchParams.has('account'), false);
});

test('customer names, charts, alerts and exports use COMPANY even when account is blank or different', () => {
  assert.equal(receivableCustomer({ company: ' Example Ltd ', account: '' }), 'Example Ltd');
  assert.equal(receivableCustomer({ company: 'Example Ltd', account: 'Accounting code' }), 'Example Ltd');
  assert.equal(receivableCustomer({ company: ' ', account: 'Accounting code' }), 'Customer not recorded');
  const data = { currency: 'AED', sources: { receivables: { status: 'available' } },
    kpis: { overdue: { amount: '25' } },
    customers: [{ company: ' Example Ltd ', account: 'Accounting code', amount: '25', buckets: { over90: { amount: '25' } } }],
    priority_invoices: [{ company: ' Example Ltd ', account: 'Accounting code', invoice_number: 'INV-COMPANY' }] };
  assert.equal(receivableCustomerRows(data)[0].customer, 'Example Ltd');
  assert.equal(receivableChartRows(data).customers[0].company, 'Example Ltd');
  assert.match(receivableAlert(data).detail, /^Example Ltd represents/);
  assert.ok(receivablesCsv(data).includes('"INV-COMPANY","Example Ltd"'));
  assert.ok(!receivablesCsv(data).includes('Accounting code'));
});

test('missing due dates cannot produce an all-clear collection alert', () => {
  const data = { sources: { receivables: { status: 'available', unknown_due_date_count: 2 } }, kpis: { overdue: { amount: '0', partial: false } }, customers: [] };
  assert.match(receivableAlert(data).title, /2 invoices need due dates/);
  data.sources.receivables.unknown_due_date_count = 0;
  assert.match(receivableAlert(data).title, /No overdue balances/);
});

test('unknown-date invoices stay in ageing even when every affected balance is missing', () => {
  const missing = { amount: null, known_amount: null, count: 1, partial: true, missing_count: 1 };
  const empty = { amount: '0', known_amount: '0', count: 0, partial: false, missing_count: 0 };
  const data = { sources: { receivables: { status: 'incomplete' } }, customers: [{ account: 'Unknown date', ...missing, buckets: { unknown_due_date: missing } }], ageing: [{ id: 'unknown_due_date', label: 'Unknown', receivables: missing, payables: empty }] };
  assert.equal(receivableCustomerRows(data)[0].unknown_due_date_count, 1);
  assert.equal(receivableChartRows(data).ageing.length, 1);
  data.ageing[0].receivables = empty;
  assert.equal(receivableChartRows(data).ageing.length, 0);
});

test('restricted customer sources never create customer rows', () => {
  assert.deepEqual(receivableCustomerRows({ sources: { receivables: { status: 'restricted' } }, customers: [{ account: 'Hidden', amount: '10' }] }), []);
});

test('report exports every customer and discloses partial amounts and the date basis', () => {
  const data = receivablesFixture('partial').data;
  data.customers.push({ ...data.customers[0], company: '=HYPERLINK("unsafe")' });
  const report = receivablesCsv(data);
  assert.match(report, /Current recorded balances; not a historical balance sheet/);
  assert.match(report, /Missing balances/);
  assert.match(report, /Recorded amount/);
  assert.match(report, /"Yes"/);
  assert.ok(report.includes('"\'=HYPERLINK(""unsafe"")"'));
});

test('workbook export retains exact totals, full workbook scope and original currency basis', () => {
  const data = receivablesFixture('partial').data;
  data.currency = 'USD';
  data.filters.company = 'Selected company';
  data.workbook_summary = { status: 'available', invoice_count: 4404,
    source: { file_name: '=unsafe.xlsx', sheet: 'External Invoice', snapshot_at: '2026-09-21T00:00:00Z' },
    totals: { invoice_amount: '315481678.41', invoice_amount_aed: '466151390.16', actual_payment_received: '285759742.00', project_count: 496 },
    payment_status: [{ label: 'Paid', count: 3895 }, { label: 'Cancelled', count: 368 }, { label: 'Pending', count: 58 }, { label: 'New', count: 34 }, { label: 'Other statuses', count: 49 }],
  };
  const report = receivablesCsv(data);
  assert.match(report, /Entire source workbook; unaffected by dashboard/);
  assert.ok(report.includes('"Total amount - L","315481678.41","Original workbook currencies; no conversion"'));
  assert.ok(report.includes('"Total amount in AED - M","466151390.16","AED; recorded numeric subtotal"'));
  assert.ok(report.includes('"Total amount received - AA","285759742.00","Original workbook currencies; no conversion"'));
  assert.ok(report.includes('"Total projects","496"'));
  assert.ok(report.includes('"Total workbook invoice rows","4404"'));
  assert.ok(report.includes('"Workbook file","\'=unsafe.xlsx"'));
});

test('restricted or unavailable workbook summaries export no workbook values', () => {
  const data = receivablesFixture('partial').data;
  for (const status of ['restricted', 'unavailable']) {
    data.workbook_summary = { status, totals: { invoice_amount: '123456789.91' } };
    assert.ok(!receivablesCsv(data).includes('123456789.91'));
    assert.ok(!receivablesCsv(data).includes('Workbook metric'));
  }
  data.workbook_summary.status = 'available';
  data.sources.receivables.status = 'restricted';
  assert.ok(!receivablesCsv(data).includes('123456789.91'));
});
