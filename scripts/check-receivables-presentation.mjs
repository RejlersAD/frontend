import test from 'node:test';
import assert from 'node:assert/strict';
import { RECEIVABLE_KPIS, receivableAlert, receivableAmountBasis, receivableChartRows, receivableCollectionRoute, receivableCustomer, receivableCustomerRows, receivableInvoiceRoute, receivableMetricNote, receivableNumber, receivableRawValue, receivableValue, receivablesCsv, workbookCurrencyLabel } from '../src/components/Finance/financeReceivablesPresentation.js';
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
  assert.equal(priority.searchParams.get('queue'), 'all');
  assert.equal(priority.searchParams.get('payment_status'), 'overdue');
  assert.equal(priority.searchParams.get('currency'), 'USD');
  assert.equal(priority.searchParams.get('company'), 'North & South');
  const customer = new URL(receivableCollectionRoute(filters, ' Customer A '), 'http://local.test');
  assert.equal(customer.searchParams.get('queue'), 'open');
  assert.equal(customer.searchParams.has('payment_status'), false);
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
    customers: [{ company: ' Example Ltd ', account: 'Accounting code', amount: '25', overdue: { amount: '25' }, buckets: { over90: { amount: '25' } } }],
    priority_invoices: [{ company: ' Example Ltd ', account: 'Accounting code', invoice_number: 'INV-COMPANY' }] };
  assert.equal(receivableCustomerRows(data)[0].customer, 'Example Ltd');
  assert.equal(receivableChartRows(data).customers[0].company, 'Example Ltd');
  assert.match(receivableAlert(data).detail, /^Example Ltd represents/);
  assert.ok(receivablesCsv(data).includes('"INV-COMPANY","Example Ltd"'));
  assert.ok(!receivablesCsv(data).includes('Accounting code'));
});

test('signed and zero KPI amounts remain visible and signed overdue does not imply missing data', () => {
  assert.equal(receivableNumber(receivableRawValue({ amount: '-561255.06', partial: false })), '-561,255.06');
  assert.equal(receivableValue({ amount: '0.00', count: 5, partial: false }), 0);
  const data = { currency: 'AED', sources: { receivables: { status: 'available' } }, kpis: { overdue: { amount: '-20', partial: false } }, customers: [{ company: 'Signed Customer', overdue: { amount: '-20' } }] };
  assert.match(receivableAlert(data).title, /No positive overdue balances/);
  data.customers.push({ company: 'Positive Customer', overdue: { amount: '100' } });
  data.kpis.overdue.amount = '80';
  assert.doesNotMatch(receivableAlert(data).title, /100%|125%/);
});

test('collection alerts use recorded Overdue amounts independently of due-date ageing', () => {
  const data = { currency: 'AED', sources: { receivables: { status: 'available', unknown_due_date_count: 1 } },
    kpis: { overdue: { amount: '300', partial: false } },
    customers: [
      { company: 'Old Pending Customer', overdue: { amount: '0' }, buckets: { over90: { amount: '900' } } },
      { company: 'Future Overdue Customer', overdue: { amount: '100' }, buckets: { current: { amount: '100' } } },
      { company: 'Undated Overdue Customer', overdue: { amount: '200' }, buckets: { unknown_due_date: { amount: '200' } } },
    ] };
  assert.match(receivableAlert(data).title, /2 customers drive 100% of overdue exposure/);
  assert.match(receivableAlert(data).detail, /Undated Overdue Customer represents AED 200/);
  data.sources.receivables.unknown_due_date_count = 0;
  data.kpis.overdue.amount = '0';
  data.customers = data.customers.slice(0, 1);
  assert.match(receivableAlert(data).title, /No overdue balances/);
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

test('report formula explanations follow the backend definitions with status and Due Date fallbacks', () => {
  const data = receivablesFixture().data;
  data.definitions.unpaid = 'Authoritative unpaid formula supplied by the invoice register.';
  assert.match(receivablesCsv(data), /Authoritative unpaid formula supplied by the invoice register/);
  delete data.definitions;
  const report = receivablesCsv(data);
  assert.match(report, /Payment status New, Overdue, Pending or Partial/);
  assert.match(report, /recorded payment status is Overdue, regardless of their due date/);
  assert.match(report, /more than 30 days past the Due Date/);
  assert.match(report, /more than 60 days past the Due Date/);
  assert.match(report, /more than 90 days past the Due Date/);
});

test('60+ days is displayed and exported between 30+ and 90+ using the server amount', () => {
  assert.deepEqual(RECEIVABLE_KPIS.map(([id]) => id), ['unpaid', 'overdue', 'over30', 'over60', 'over90']);
  const data = receivablesFixture().data;
  data.kpis.over60.amount = '1846363.06';
  assert.match(receivablesCsv(data), /"Overdue 60\+ days","1846363.06"/);
});

test('recorded AED reporting is identified independently from original invoice currencies', () => {
  const data = receivablesFixture().data;
  data.amount_basis = 'recorded_aed';
  assert.match(receivableAmountBasis(data), /Inv Amt\. \(AED\).*all original invoice currencies/);
  assert.match(receivablesCsv(data), /Reporting amount basis.*recorded Inv Amt\. \(AED\)/);
  assert.equal(receivableMetricNote(data.kpis.overdue, data.amount_basis), 'recorded AED amounts');
  data.amount_basis = 'original_currency';
  assert.equal(receivableMetricNote(data.kpis.overdue, data.amount_basis), 'in original currency');
  assert.match(receivableAmountBasis(data), /selected original invoice currency/);
});

test('source invoice IDs never become operational invoice routes', () => {
  assert.equal(receivableInvoiceRoute({ id: 'source:12', invoice_route: null, source_snapshot: true }), null);
  assert.equal(receivableInvoiceRoute({ id: 'source:12' }), null);
  assert.equal(receivableInvoiceRoute({ id: 12, invoice_route: null }), null);
  assert.equal(receivableInvoiceRoute({ id: 12 }), '/finance/outgoing-invoices/12');
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
  assert.ok(report.includes('"Total workbook invoice rows","466151390.16","4404"'));
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

test('workbook currency labels distinguish recorded codes, missing labels and conflicts', () => {
  assert.equal(workbookCurrencyLabel({ currency: 'EUR', currency_status: 'recorded' }), 'EUR (Euro)');
  for (const currency of ['AED', 'USD', 'SEK', 'GBP']) assert.equal(workbookCurrencyLabel({ currency, currency_status: 'recorded' }), currency);
  assert.equal(workbookCurrencyLabel({ currency: null, currency_status: 'not_recorded' }), 'Currency not recorded');
  for (const currency_status of ['conflict', 'error', 'unrecognized']) assert.equal(workbookCurrencyLabel({ currency: null, currency_status }), 'Currency needs review');
});

test('workbook currency export preserves independent L and AA amounts and explicit rounding', () => {
  const data = receivablesFixture().data;
  const report = receivablesCsv(data);
  for (const row of data.workbook_summary.currency_breakdown) assert.ok(report.includes(`"${workbookCurrencyLabel(row)}","${row.invoice_amount}","${row.actual_payment_received}"`));
  assert.match(report, /Each amount uses its own cell currency label and Inv\. CUR/);
  assert.ok(report.includes('"Currency not recorded","3146096.40","2428132.15"'));
  assert.ok(report.includes('"Currency needs review","674340.40","475467.22"'));
  assert.doesNotMatch(report, /Currency rounding adjustment/);
  data.workbook_summary.currency_rounding_adjustment = { invoice_amount: '0.01', actual_payment_received: '-0.01' };
  data.workbook_summary.currency_breakdown.push({ currency: 'GBP', currency_status: 'recorded', invoice_amount: '9999999999999999.99', actual_payment_received: null });
  const adjusted = receivablesCsv(data);
  assert.ok(adjusted.includes('"Currency rounding adjustment","0.01","\'-0.01"'));
  assert.ok(adjusted.includes('"GBP","9999999999999999.99",""'));
});

test('workbook currency export never fabricates absent groups or leaks restricted stale groups', () => {
  const data = receivablesFixture().data;
  delete data.workbook_summary.currency_breakdown;
  let report = receivablesCsv(data);
  assert.doesNotMatch(report, /Workbook currency|Currency needs review|Currency not recorded/);
  assert.match(report, /315481678\.41/);
  data.workbook_summary.currency_breakdown = [{ currency: 'EUR', invoice_amount: '123456789.91', actual_payment_received: '99999999.99' }];
  for (const status of ['restricted', 'unavailable']) {
    data.workbook_summary.status = status; report = receivablesCsv(data);
    assert.doesNotMatch(report, /123456789\.91|99999999\.99|Workbook currency/);
  }
});

test('payment status export includes comparable AED subtotals, exclusion counts and the full total', () => {
  const data = receivablesFixture().data;
  const report = receivablesCsv(data);
  assert.ok(report.includes('"Workbook payment status","Amount (AED)","Invoice rows","Missing or invalid amount cells"'));
  assert.ok(report.includes('"Paid","412405138.81","3895","2"'));
  assert.ok(report.includes('"Cancelled","39497085.61","368","5"'));
  assert.ok(report.includes('"Pending","6401792.89","58","0"'));
  assert.ok(report.includes('"New","2257559.79","34","0"'));
  assert.ok(report.includes('"Other statuses","5589813.06","49","0"'));
  assert.ok(report.includes('"Total workbook invoice rows","466151390.16","4404"'));
  assert.doesNotMatch(report, /Payment status rounding adjustment/);
  data.workbook_summary.payment_status_rounding_adjustment = '0.02';
  assert.ok(receivablesCsv(data).includes('"Payment status rounding adjustment (AED)","0.02"'));
});
