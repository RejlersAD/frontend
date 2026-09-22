import assert from 'node:assert/strict';
import { overviewModel } from '../src/pages/Executive/overviewPresentation.js';
import { reportFixture } from './check-executive-fixtures.mjs';
import { invoicePerformanceFixture, receivablesFixture } from './check-receivables-dashboard-fixtures.mjs';

const report = reportFixture('full');
const revenue = model => model.cards.find(card => card.id === 'revenue');
const dataset = (name = 'full', currency = 'AED') => receivablesFixture(name, { currency }).data;
const model = (name = 'full', currency = 'AED', mode = 'monthly', month = '') => overviewModel(report, currency, dataset(name, currency), mode, month);
const near = (actual, expected, label) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 0.02, `${label}: expected ${expected}, got ${actual}`);

const monthly = model();
assert.equal(revenue(monthly).label, 'Invoiced revenue');
assert.equal(revenue(monthly).metric.value, 120329, 'Monthly card includes the recorded paid and unpaid invoices');
assert.equal(monthly.performance.rows.at(-1).invoiced, 120329);
assert.equal(monthly.performance.rows.at(-1).received, 53000);
assert.equal(monthly.performance.rows.at(-1).outstanding, 67329);
near(monthly.performance.rows.at(-1).collection_rate, 44.05, 'Monthly rate uses the same invoice cohort');
assert.equal(monthly.performance.rows.length, 12, 'Monthly chart retains rolling invoice history');
assert.ok(monthly.performance.rows.every(row => row.budget === null && row.operating_margin === null), 'Unavailable finance overlays are absent');
assert.equal(monthly.forecast.basis, 'estimated');
assert.equal(monthly.forecast.rows.length, 12);

const ytd = model('full', 'AED', 'ytd');
assert.equal(revenue(ytd).metric.value, 684845);
assert.equal(ytd.performance.rows.at(-1).invoiced, 684845, 'YTD totals are aggregated exactly once');
assert.equal(ytd.performance.rows.at(-1).received, 333000);
near(ytd.performance.rows.at(-1).collection_rate, 48.62, 'YTD rate is total receipts divided by total invoice value');
assert.ok(ytd.performance.rows.every(row => row.month.startsWith('2026-')), 'Calendar YTD excludes previous-year amounts');

const august = model('full', 'AED', 'monthly', '2026-08');
assert.equal(revenue(august).metric.value, 75908, 'Selected month drives the revenue card');
assert.equal(august.performance.rows.at(-1).month, '2026-08', 'Selected month is the chart cutoff');
assert.equal(model('full', 'AED', 'ytd', '2026-08').performance.rows.at(-1).invoiced, 564516, 'Selected YTD ends at the chosen month');

const usd = model('full', 'USD');
assert.equal(revenue(usd).metric.value, 5000, 'Currency filtering changes values without converting currencies');
assert.equal(usd.performance.rows.at(-1).received, 0, 'A recorded zero receipt is still known');
assert.equal(usd.performance.rows.at(-1).collection_rate, 0, 'A zero collection rate remains zero');
assert.equal(usd.forecast.rows.length, 0, 'Insufficient source history cannot establish an estimate');
const mismatch = overviewModel(report, 'USD', dataset());
assert.equal(revenue(mismatch).metric.value, null, 'An AED source cannot be relabeled USD');
assert.equal(mismatch.performance.rows.length, 0);

const zero = model('performance-zero');
assert.equal(revenue(zero).metric.value, 0);
assert.ok(zero.performance.rows.every(row => row.invoiced === 0 && row.received === 0 && row.outstanding === 0));
assert.ok(zero.performance.rows.every(row => row.collection_rate === null), 'Zero denominator leaves collection rate unknown');
const missing = model('performance-missing');
assert.equal(revenue(missing).metric.value, null, 'A wholly missing selected cohort stays unavailable');
for (const field of ['invoiced', 'received', 'outstanding', 'collection_rate']) assert.equal(missing.performance.rows.at(-1)[field], null, `${field} does not fabricate zero from missing input`);
const partial = model('partial', 'AED', 'ytd');
assert.equal(revenue(partial).metric.status, 'partial');
assert.match(revenue(partial).value, /\*$/, 'Known partial revenue subtotals are visibly marked');
assert.match(revenue(partial).note, /known subtotal/i);
assert.equal(partial.performance.rows.at(-1).invoiced, null, 'A partial subtotal is not plotted as a complete YTD amount');
assert.equal(partial.performance.rows.at(-1).collection_rate, null, 'An incomplete denominator does not produce a collection ratio');

const partialWorkbook = dataset();
const aedWorkbook = partialWorkbook.workbook_summary.currency_breakdown.find(row => row.currency === 'AED');
const workbookCards = [['total_amount', 'invoice_amount'], ['amount_received', 'actual_payment_received']];
for (const [, field] of workbookCards) aedWorkbook.coverage[field] = { numeric_count: 2, blank_count: 1, text_count: 0, error_count: 0 };
const incompleteWorkbookModel = overviewModel(report, 'AED', partialWorkbook);
for (const [id, field] of workbookCards) {
  const card = incompleteWorkbookModel.cards.find(item => item.id === id);
  assert.equal(card.metric.value, Number(aedWorkbook[field]), `${id} preserves the recorded original-currency subtotal`);
  assert.equal(card.metric.status, 'partial');
  assert.match(card.value, /\*$/, `${id} visibly marks excluded missing workbook cells`);
  assert.match(card.note, /known subtotal/i, `${id} explains incomplete coverage next to the amount`);
}
const otherCurrencyBefore = model('full', 'USD');
const otherCurrencyAfter = overviewModel(report, 'USD', partialWorkbook);
for (const [id] of workbookCards) assert.deepEqual(otherCurrencyAfter.cards.find(card => card.id === id), otherCurrencyBefore.cards.find(card => card.id === id), `${id}: AED coverage does not change USD workbook cards`);
for (const [, field] of workbookCards) aedWorkbook[field] = '0.00';
const knownZeroWorkbook = overviewModel(report, 'AED', partialWorkbook);
for (const [id] of workbookCards) assert.equal(knownZeroWorkbook.cards.find(card => card.id === id).value, 'AED 0*', `${id} retains a known zero subtotal with incomplete coverage`);
for (const [, field] of workbookCards) aedWorkbook[field] = null;
const unknownWorkbook = overviewModel(report, 'AED', partialWorkbook);
for (const [id] of workbookCards) assert.equal(unknownWorkbook.cards.find(card => card.id === id).value, '—', `${id} never marks missing amounts as known subtotals`);

for (const name of ['restricted', 'empty', 'performance-unavailable']) {
  const unavailable = model(name);
  assert.equal(revenue(unavailable).metric.value, null, `${name} does not use an unrelated revenue fallback`);
  assert.equal(unavailable.performance.rows.length, 0);
  assert.equal(unavailable.forecast.rows.length, 0);
}

const approved = model('performance-approved');
assert.ok(approved.performance.rows.some(row => row.budget !== null && row.operating_margin !== null));
assert.equal(approved.forecast.basis, 'approved');
assert.equal(approved.forecast.rows[0].value, 125000);
const unapproved = model('performance-unapproved');
assert.ok(unapproved.performance.rows.every(row => row.budget === null && row.operating_margin === null), 'Populated unapproved fields are not treated as approved inputs');
assert.equal(unapproved.forecast.rows.length, 0);

const weightedData = dataset();
const base = invoicePerformanceFixture();
const amount = value => ({ amount: value.toFixed(2), known_amount: value.toFixed(2), count: 1, missing_count: 0, partial: false });
weightedData.invoice_performance = {
  ...base, as_of_date: '2026-02-28',
  monthly: [
    { month: '2026-01', invoiced: amount(1000), received: amount(100), outstanding: amount(900), collection_rate: { value: 10, status: 'available', unit: 'percent' }, budget: '500.00', operating_margin: 10 },
    { month: '2026-02', invoiced: amount(3000), received: amount(2700), outstanding: amount(300), collection_rate: { value: 90, status: 'available', unit: 'percent' }, budget: '600.00', operating_margin: 50 },
  ],
  budget: { status: 'approved', rows: [{ month: '2026-01', value: '500.00' }, { month: '2026-02', value: '600.00' }] },
  operating_margin: { status: 'approved', rows: [
    { month: '2026-01', value: 10, recognised_revenue: '100.00', operating_costs: '90.00', actual_through: '2026-01-31' },
    { month: '2026-02', value: 50, recognised_revenue: '900.00', operating_costs: '450.00', actual_through: '2026-02-28' },
  ] },
};
const weighted = overviewModel(report, 'AED', weightedData, 'ytd', '2026-02');
assert.equal(revenue(weighted).metric.value, 4000, 'Selected period values come from its cohort instead of stale latest KPI totals');
near(weighted.performance.rows.at(-1).collection_rate, 70, 'Period collection rate is weighted by invoice value');
near(weighted.performance.rows.at(-1).operating_margin, 46, 'Period operating margin uses approved recognised revenue and costs');
assert.equal(weighted.performance.rows.at(-1).budget, 1100, 'Only approved complete budget amounts are accumulated');
const incompleteActuals = structuredClone(weightedData);
incompleteActuals.invoice_performance.operating_margin.rows[1].actual_through = '2026-02-10';
assert.equal(overviewModel(report, 'AED', incompleteActuals, 'ytd', '2026-02').performance.rows.at(-1).operating_margin, null, 'YTD margin requires Finance actuals through the selected invoice-period cutoff');

console.log('PASS: invoice performance presentation, partial workbook subtotal labels, monthly/YTD periods, month cutoff, currency isolation, zero/missing/restricted data, weighted rates, and Finance approval gates.');
