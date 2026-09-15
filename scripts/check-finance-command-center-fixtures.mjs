// Synthetic aggregate records only; no production balances, organisations or personal data.
export const FINANCE_CHECK_TIME = '2026-09-14T09:00:00.000Z';
export const financeUser = { id: 601, username: 'alex.morgan', first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', is_staff: true, is_superuser: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] };
const bucketLabels = [['current', 'Not past due'], ['days_1_30', '1–30 days'], ['days_31_60', '31–60 days'], ['days_61_90', '61–90 days'], ['over90', 'Over 90 days'], ['unknown_due_date', 'Due date unknown']];
function group(currency, amounts) {
  const buckets = bucketLabels.map(([id, label], index) => ({ id, label, amount: Number(amounts[index] || 0).toFixed(2), count: amounts[index] > 0 ? 1 : 0 }));
  return { currency, status: 'available', invoice_count: buckets.reduce((total, bucket) => total + bucket.count, 0), missing_balance_count: 0, missing_currency_count: 0, unknown_due_date_count: buckets[5].count,
    oldest_due_date: amounts[4] > 0 ? '2026-06-01' : amounts[3] > 0 ? '2026-07-01' : amounts[2] > 0 ? '2026-08-01' : amounts[1] > 0 ? '2026-09-01' : null,
    outstanding: amounts.reduce((sum, value) => sum + value, 0).toFixed(2), overdue: amounts.slice(1, 5).reduce((sum, value) => sum + value, 0).toFixed(2), due_30d: amounts[0].toFixed(2), buckets };
}
const coverageDefinition = 'Recorded balance completeness among unsettled positive-or-unknown invoice balances; this is not overall data quality.';
function source(kind, groups = []) {
  const open = groups.reduce((total, item) => total + item.invoice_count, 0);
  return { status: 'available', source: kind === 'receivables' ? 'Customer invoice register' : 'Supplier invoice register', route: kind === 'receivables' ? '/finance/outgoing-invoices' : '/finance/incoming-invoices', reason: null,
    invoice_count: open, open_count: open, overdue_count: groups.reduce((total, item) => total + item.buckets.slice(1, 5).reduce((sum, bucket) => sum + bucket.count, 0), 0),
    over60_count: groups.reduce((total, item) => total + item.buckets.slice(3, 5).reduce((sum, bucket) => sum + bucket.count, 0), 0), missing_balance_count: 0, missing_currency_count: 0,
    unknown_due_date_count: groups.reduce((total, item) => total + item.unknown_due_date_count, 0), oldest_due_date: groups.map(item => item.oldest_due_date).filter(Boolean).sort()[0] || null,
    source_updated_at: FINANCE_CHECK_TIME, source_timestamp_kind: 'record_updated_at', balance_coverage: { known_count: open, total_count: open, percentage: open ? 100 : null, definition: coverageDefinition }, by_currency: groups };
}
const processLabels = { review: 'Invoices needing review', unmatched: 'Unmatched invoices', exception: 'Matching exceptions', ready_for_payment: 'Ready for payment', verified: 'Verified matches', on_hold: 'Invoices on hold' };
function processData(empty = false) {
  const counts = empty ? { eligible_count: 0, review: 0, unmatched: 0, exception: 0, ready_for_payment: 0, verified: 0, on_hold: 0 } : { eligible_count: 7, review: 5, unmatched: 2, exception: 2, ready_for_payment: 2, verified: 3, on_hold: 1 };
  return { status: 'available', counts, denominator: counts.eligible_count, route: '/finance/incoming-invoices', definition: 'Active supplier invoices excluding paid, cancelled, rejected and closed records. Queue counts overlap; verified matching does not imply payment approval.',
    metrics: Object.entries(processLabels).map(([id, label]) => ({ id, label, count: counts[id], percentage: counts.eligible_count ? counts[id] / counts.eligible_count * 100 : null, denominator: counts.eligible_count })) };
}
function unavailableSource(kind, status) {
  const result = source(kind); result.status = status; result.reason = status === 'restricted' ? 'You do not have access to this invoice register.' : 'Synthetic source could not be read.';
  if (status === 'restricted') result.route = null;
  for (const field of ['invoice_count', 'open_count', 'overdue_count', 'over60_count', 'unknown_due_date_count', 'missing_balance_count', 'missing_currency_count']) result[field] = null;
  result.source_updated_at = null; result.source_timestamp_kind = null;
  result.balance_coverage = { known_count: null, total_count: null, percentage: null, definition: coverageDefinition };
  return result;
}
function fullData() {
  const receivables = source('receivables', [group('AED', [60000, 20000, 15000, 10000, 10000, 10000]), group('USD', [20000, 10000, 0, 0, 0, 0])]);
  const payables = source('payables', [group('AED', [50000, 20000, 10000, 0, 0, 0]), group('USD', [25000, 10000, 0, 0, 0, 0]), group('EUR', [23000, 0, 0, 0, 0, 0])]);
  payables.invoice_count += 1; // One active zero-value invoice belongs to the workflow cohort, not positive-balance ageing.
  const process = processData();
  const actions = [{ id: 'receivables_overdue', label: 'Review overdue receivables', count: receivables.overdue_count, route: receivables.route, reason: 'Unsettled customer invoices have contractual due dates in the past.' },
    ...['review', 'exception', 'unmatched', 'ready_for_payment', 'on_hold'].map(id => ({ id: `payables_${id}`, label: processLabels[id], count: process.counts[id], route: payables.route, reason: 'Recorded supplier invoice workflow queue; review the authoritative register.' }))]
    .map(action => ({ ...action, owner: null, due_date: null, scope: 'all_currencies', can_decide: false }));
  return { schema_version: '1.0', generated_at: FINANCE_CHECK_TIME, as_of_date: '2026-09-14', status: 'available', currency_conversion_applied: false, currencies: ['AED', 'EUR', 'USD'],
    scope: { label: 'Authorized invoice registers', consolidated: false, description: 'Current operational snapshot.' }, sources: { receivables, payables },
    by_currency: [{ currency: 'AED', status: 'available', net_invoice_exposure: '45000.00' }, { currency: 'EUR', status: 'available', net_invoice_exposure: '-23000.00' }, { currency: 'USD', status: 'available', net_invoice_exposure: '-5000.00' }],
    net_invoice_exposure_definition: 'Recorded receivables less payables in the same original currency; not cash or net working capital.', process,
    actions, action_count: actions.length, actions_truncated: false, actions_definition: 'Aggregate workflow queues across all currencies; counts can overlap. These are not personal approval assignments.',
    trends: { status: 'unavailable', series: [], reason: 'Historical balance snapshots and an approved cash-flow series are not connected.' },
    unavailable_metrics: ['cash_position', 'net_working_capital', 'dso', 'forecast'].map(id => ({ id, status: 'unavailable', value: null, reason: 'Approved financial source not connected.' })) };
}
export function financeFixture(name = 'full') {
  const data = fullData(); let failure = null;
  if (name === 'empty' || name === 'zero') {
    data.sources = { receivables: source('receivables'), payables: source('payables') }; data.currencies = []; data.by_currency = []; data.process = processData(true); data.actions = []; data.action_count = 0;
    if (name === 'zero') { data.sources.receivables.invoice_count = 2; data.sources.payables.invoice_count = 3; }
  }
  if (name === 'incomplete') {
    data.status = 'incomplete'; const selected = data.sources.receivables; selected.status = 'incomplete'; selected.missing_balance_count = 1; selected.balance_coverage.known_count -= 1; selected.balance_coverage.percentage = selected.balance_coverage.known_count / selected.balance_coverage.total_count * 100;
    const usd = selected.by_currency.find(item => item.currency === 'USD'); usd.status = 'incomplete'; usd.missing_balance_count = 1; usd.outstanding = null; usd.overdue = null; usd.due_30d = null; for (const bucket of usd.buckets) bucket.amount = null;
    const net = data.by_currency.find(item => item.currency === 'USD'); net.status = 'unavailable'; net.net_invoice_exposure = null;
  }
  if (name === 'unknown-currency') {
    data.status = 'incomplete'; const selected = data.sources.receivables;
    selected.status = 'incomplete'; selected.missing_currency_count = 1; selected.invoice_count += 1; selected.open_count += 1;
    selected.balance_coverage.known_count += 1; selected.balance_coverage.total_count += 1;
    const unknown = group('UNSPECIFIED', [100, 0, 0, 0, 0, 0]); unknown.status = 'incomplete'; unknown.missing_currency_count = 1;
    unknown.outstanding = null; unknown.overdue = null; unknown.due_30d = null; for (const bucket of unknown.buckets) bucket.amount = null;
    selected.by_currency.push(unknown); data.currencies.push('UNSPECIFIED'); data.by_currency.push({ currency: 'UNSPECIFIED', status: 'unavailable', net_invoice_exposure: null });
    for (const row of data.by_currency) { row.status = 'unavailable'; row.net_invoice_exposure = null; }
  }
  if (name === 'receivables-restricted' || name === 'payables-error' || name === 'both-restricted') {
    const keys = name === 'both-restricted' ? ['receivables', 'payables'] : [name.split('-')[0]]; const status = name === 'payables-error' ? 'error' : 'restricted';
    data.status = keys.length === 2 ? 'restricted' : 'partial';
    for (const key of keys) { data.sources[key] = unavailableSource(key, status); data.actions = data.actions.filter(action => !action.id.startsWith(key)); }
    data.action_count = data.actions.length; for (const row of data.by_currency) { row.status = 'unavailable'; row.net_invoice_exposure = null; }
    if (keys.includes('payables')) { data.process = { ...processData(), status, route: status === 'restricted' ? null : '/finance/incoming-invoices', denominator: null, metrics: [], counts: Object.fromEntries(Object.keys(processData().counts).map(key => [key, null])) }; }
    data.currencies = [...new Set(Object.values(data.sources).flatMap(item => item.by_currency.map(row => row.currency)))].sort(); data.by_currency = data.by_currency.filter(row => data.currencies.includes(row.currency));
  }
  if (name === 'error' || name === 'forbidden') failure = name === 'forbidden' ? 403 : 503;
  return { data, failure };
}
