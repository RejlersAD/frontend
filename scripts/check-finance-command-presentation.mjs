import test from 'node:test';
import assert from 'node:assert/strict';
import { currencyBalance, currencyPositions, financeControls, financeCount, financeCoverage, financeKpis, financeMoney, financeNumber, financeProcesses, financeRoute, financeTrend, sourceMessage } from '../src/components/Finance/financeCommandPresentation.js';

const source = (rows = [], overrides = {}) => ({ status: 'available', by_currency: rows, invoice_count: 10, open_count: 2, missing_currency_count: 0,
  balance_coverage: { known_count: 2, total_count: 2 }, route: '/finance/outgoing-invoices', ...overrides });
const row = (currency = 'AED', amount = '100') => ({ currency, status: 'available', outstanding: amount, overdue: '10', invoice_count: 2,
  buckets: [{ id: 'current', count: 1, amount: '90' }, { id: 'days_1_30', count: 1, amount: '10' }], oldest_due_date: '2026-09-01' });

test('missing amounts never become observed zero; formatting retains original currencies', () => {
  for (const input of [null, undefined, '', ' ', [], {}, false, true, NaN, Infinity]) { assert.equal(financeNumber(input), null); assert.equal(financeMoney(input, 'AED'), '—'); }
  assert.equal(financeMoney(0, 'EUR'), 'EUR 0.00');
  assert.equal(financeMoney(42600000, 'AED', true), 'AED 42.60M');
  assert.equal(financeMoney(-1234.5, 'USD'), 'USD -1,234.50');
  assert.equal(financeCount(-1), null);
});

test('absent currency means zero only in successful sources with known original currencies', () => {
  assert.equal(currencyBalance(source(), 'AED').outstanding, 0);
  assert.equal(currencyBalance(source(), '').outstanding, null);
  for (const status of ['restricted', 'error', 'unavailable']) assert.equal(currencyBalance(source([], { status }), 'AED').outstanding, null);
  assert.equal(currencyBalance(source([], { status: 'incomplete', missing_currency_count: 1 }), 'AED').outstanding, null);
});

test('incomplete currency totals are withheld while a complete other currency stays visible', () => {
  const input = source([row(), { ...row('USD'), status: 'incomplete', outstanding: '999' }], { status: 'incomplete' });
  assert.equal(currencyBalance(input, 'AED').outstanding, '100');
  assert.equal(currencyBalance(input, 'USD').outstanding, null);
  assert.equal(currencyBalance(input, 'USD').overdue, null);
});

test('net exposure requires both readable currencies and a recorded available aggregate', () => {
  const data = { currencies: ['AED', 'EUR'], sources: { receivables: source([row()]), payables: source([row('AED', '120'), row('EUR', '40')]) },
    by_currency: [{ currency: 'AED', status: 'available', net_invoice_exposure: '-20' }, { currency: 'EUR', status: 'available', net_invoice_exposure: '-40' }] };
  assert.deepEqual(currencyPositions(data).map(item => item.net), [-20, -40]);
  assert.equal(currencyPositions(data)[1].receivables, 0);
  data.sources.receivables.status = 'restricted';
  assert.equal(currencyPositions(data)[0].net, null);
  assert.equal(currencyPositions(data)[0].receivables, null);
});

test('invoice exposure is never substituted for cash or net working capital', () => {
  const cards = financeKpis({ sources: { receivables: source([row()]), payables: source([row()]) } }, 'AED');
  assert.equal(cards.find(card => card.id === 'cash').value, null);
  assert.equal(cards.find(card => card.id === 'working_capital').value, null);
  assert.equal(cards.find(card => card.id === 'receivables').text, 'AED 100.00');
  assert.equal(cards.find(card => card.id === 'overdue').note, '1 receivables past due');
});

test('process percentages require an available source and valid recorded denominator', () => {
  const data = { process: { status: 'available', denominator: 10, counts: { review: 3, exception: 0, ready_for_payment: 2 },
    metrics: [{ id: 'review', percentage: 30, denominator: 10 }, { id: 'exception', percentage: 0, denominator: 10 }, { id: 'verified', percentage: 40, denominator: 10 }] }, sources: { receivables: source() } };
  assert.equal(financeProcesses(data)[0].percentage, 30);
  assert.equal(financeProcesses(data)[2].percentage, 0);
  assert.equal(financeProcesses(data)[1].percentage, 20);
  assert.equal(financeControls(data)[2].value, '40%');
  data.process.metrics[0].denominator = 0;
  assert.equal(financeProcesses(data)[0].percentage, null);
  data.process.metrics[2].denominator = null;
  assert.equal(financeControls(data)[2].value, '—');
  data.process.status = 'restricted';
  assert.equal(financeProcesses(data)[0].count, null);
  assert.equal(financeControls(data)[2].value, '—');
});

test('coverage measures known balances in a real positive cohort only', () => {
  const data = { sources: { receivables: source(), payables: source([], { status: 'incomplete', balance_coverage: { known_count: 1, total_count: 2 } }) } };
  assert.equal(financeCoverage(data), 75);
  data.sources.payables.status = 'restricted'; assert.equal(financeCoverage(data), null);
  const empty = source([], { balance_coverage: { known_count: 0, total_count: 0 } });
  assert.equal(financeCoverage({ sources: { receivables: empty, payables: empty } }), null);
});

test('one missing balance never rounds up to complete coverage', () => {
  const empty = source([], { balance_coverage: { known_count: 0, total_count: 0 } });
  const receivables = source([], { status: 'incomplete', balance_coverage: { known_count: 244, total_count: 245 } });
  const data = { sources: { receivables, payables: empty } };
  assert.equal(financeCoverage(data), 99.6);
  receivables.balance_coverage = { known_count: 2000, total_count: 2001 };
  assert.equal(financeCoverage(data), 99.9);
  receivables.balance_coverage.known_count = 2001;
  assert.equal(financeCoverage(data), 100);
  receivables.balance_coverage.known_count = 2002;
  assert.equal(financeCoverage(data), null);
});

test('incomplete cards explain the selected currency gap and keep known invoice counts', () => {
  const incomplete = { ...row(), status: 'incomplete', outstanding: null, overdue: null, invoice_count: 226, missing_balance_count: 1 };
  const data = { sources: { receivables: source([incomplete, row('EUR')], { status: 'incomplete', missing_balance_count: 1 }), payables: source([]) } };
  const cards = financeKpis(data, 'AED');
  const ar = cards.find(card => card.id === 'receivables');
  const overdue = cards.find(card => card.id === 'overdue');
  assert.equal(ar.text, '—');
  assert.equal(ar.note, '226 open invoices · 1 invoice balance missing');
  assert.match(ar.reason, /Totals are withheld/);
  assert.equal(overdue.text, '—');
  assert.equal(overdue.note, '1 invoice balance missing');
  assert.equal(overdue.reason, ar.reason);
  assert.equal(cards.find(card => card.id === 'payables').text, 'AED 0.00');
  assert.equal(financeKpis(data, 'EUR').find(card => card.id === 'receivables').note, '2 open invoices');
  data.sources.payables = data.sources.receivables;
  assert.equal(financeKpis(data, 'AED').find(card => card.id === 'payables').note, ar.note);
  assert.equal(sourceMessage({ status: 'incomplete', missing_balance_count: 2, missing_currency_count: 1 }), '2 invoice balances missing · 1 invoice currency missing');
  data.sources.receivables = source([], { status: 'incomplete', missing_balance_count: 0, missing_currency_count: 1 });
  const unknownCurrency = financeKpis(data, 'AED').find(card => card.id === 'overdue');
  assert.equal(unknownCurrency.note, '1 invoice currency missing');
  assert.match(unknownCurrency.reason, /^1 invoice currency missing\./);
});

test('financial drilldowns only use the two authorized register route shapes', () => {
  for (const route of ['https://example.com', '//example.com', '/api/v1/finance/invoices', '/admin/users', 'javascript:alert(1)', null]) assert.equal(financeRoute(route), null);
  assert.equal(financeRoute('/finance/incoming-invoices'), '/finance/incoming-invoices');
});

test('historical series require explicit currency scope before rendering', () => {
  const data = { trends: { status: 'available', currency: 'AED', series: [{ month: '2026-09', cash_actual: 50 }] } };
  assert.equal(financeTrend(data, 'AED').series.length, 1);
  assert.equal(financeTrend(data, 'EUR').status, 'unavailable');
  delete data.trends.currency;
  assert.equal(financeTrend(data, 'AED').series.length, 0);
});
