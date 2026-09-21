// Synthetic invoice records for isolated browser checks; never application fallbacks.
export const RECEIVABLES_CHECK_TIME = '2026-09-21T09:00:00.000Z';
export const receivablesUser = { id: 601, username: 'alex.morgan', first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', is_staff: true, is_superuser: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] };
const bucketLabels = [['current', 'Current'], ['days_1_30', '1–30 days'], ['days_31_60', '31–60 days'], ['days_61_90', '61–90 days'], ['over90', 'Over 90 days'], ['unknown_due_date', 'Due date unknown']];
const customerRows = [
  ['Stripe Inc.', [0, 0, 30000, 27520, 70000, 0]],
  ['Gala SARL', [0, 0, 20000, 15116, 50000, 0]],
  ['Wozel & Co. LLP', [20000, 10000, 10417, 10000, 28983, 0]],
  ['UK & A', [32329, 16908, 15000, 9555, 0, 0]],
  ['Business Tech', [15000, 0, 0, 0, 0, 0]],
];
const dates = ['2026-10-01', '2026-09-07', '2026-08-07', '2026-07-08', '2026-05-11', null];
const months = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(2025, 9 + index, 1)).toISOString().slice(0, 7));
const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0);
const metric = rows => ({ amount: rows.some(row => row.amount === null) ? null : sum(rows).toFixed(2), known_amount: rows.length && rows.every(row => row.amount === null) ? null : sum(rows).toFixed(2), count: rows.length, missing_count: rows.filter(row => row.amount === null).length, partial: rows.some(row => row.amount === null) });
const unavailable = () => ({ amount: null, known_amount: null, count: null, missing_count: null, partial: true });

function invoices() {
  return customerRows.flatMap(([account, amounts], customerIndex) => amounts.flatMap((amount, bucketIndex) => amount ? [{ id: 100 + customerIndex * 10 + bucketIndex, account, amount, bucket: bucketLabels[bucketIndex][0], due_date: bucketIndex === 4 ? ['2026-05-11', '2026-02-05', '2025-12-13'][customerIndex] : dates[bucketIndex], invoice_date: bucketIndex === 4 ? ['2026-04-01', '2026-01-01', '2025-11-01'][customerIndex] : ['2026-09-01', '2026-08-01', '2026-07-01', '2026-06-01', null, null][bucketIndex], invoice_number: `SYN-2026-${customerIndex + 1}${bucketIndex}`, owner: customerIndex % 2 ? 'Alex Morgan' : null }] : []));
}

export function receivablesFixture(name = 'full', params = {}) {
  const currency = params.currency || 'AED';
  const company = params.company || '';
  const asOf = params.as_of || '2026-09-21';
  let rows = invoices();
  if (name === 'partial') rows.push({ id: 999, account: 'Stripe Inc.', amount: null, bucket: 'over90', due_date: '2026-04-01', invoice_date: '2026-03-01', invoice_number: 'SYN-MISSING-001', owner: null });
  if (name === 'empty' || currency === 'EUR') rows = [];
  if (currency === 'USD') rows = rows.filter(row => row.account === 'Business Tech').map(row => ({ ...row, amount: row.amount === null ? null : row.amount / 3 }));
  if (company) rows = rows.filter(row => row.account === company);
  const overdue = rows.filter(row => !['current', 'unknown_due_date'].includes(row.bucket));
  const periodMonths = months.slice(-Number(params.months || 12));
  const receipts = name === 'empty' ? [] : currency === 'USD' && (!company || company === 'Business Tech') ? [{ invoice_date: '2026-08-01', amount: 1100 }] : currency !== 'AED' || (company && company !== 'Stripe Inc.') ? [] : months.map((month, index) => ({ invoice_date: `${month}-01`, amount: 9000 + index * 4000 }));
  const customers = [...new Set(rows.map(row => row.account))].map(account => {
    const selected = rows.filter(row => row.account === account);
    return { account, ...metric(selected), overdue: metric(selected.filter(row => !['current', 'unknown_due_date'].includes(row.bucket))), share_percentage: sum(rows) ? sum(selected) / sum(rows) * 100 : 0,
      buckets: Object.fromEntries(bucketLabels.map(([id]) => [id, metric(selected.filter(row => row.bucket === id))])) };
  }).sort((left, right) => Number(right.known_amount) - Number(left.known_amount));
  const payableRows = [15000, 18000, 12000, 6000, 4500, 0].flatMap((amount, index) => amount && !company && currency === 'AED' ? [{ amount, bucket: bucketLabels[index][0], due_date: dates[index] }] : []);
  const data = {
    schema_version: '1.0', generated_at: RECEIVABLES_CHECK_TIME, source_updated_at: RECEIVABLES_CHECK_TIME, as_of_date: asOf, currency, currency_conversion_applied: false,
    filters: { companies: customerRows.map(row => row[0]), currencies: ['AED', 'EUR', 'USD'], company, months: Number(params.months || 12) },
    sources: { receivables: { status: name === 'partial' ? 'incomplete' : 'available', reason: name === 'partial' ? '1 invoice balance is missing; recorded subtotals exclude it.' : null, route: '/finance/outgoing-invoices', invoice_count: rows.length + receipts.length, open_count: rows.length, missing_balance_count: rows.filter(row => row.amount === null).length, unknown_due_date_count: 0, source_updated_at: RECEIVABLES_CHECK_TIME }, payables: { status: 'available', reason: null, route: '/finance/incoming-invoices', invoice_count: payableRows.length, open_count: payableRows.length, missing_balance_count: 0, unknown_due_date_count: 0, source_updated_at: RECEIVABLES_CHECK_TIME } },
    kpis: { unpaid: metric(rows), overdue: metric(overdue), over30: metric(overdue.filter(row => row.bucket !== 'days_1_30')), over90: metric(rows.filter(row => row.bucket === 'over90')) },
    customers,
    priority_invoices: [...overdue].sort((left, right) => left.due_date.localeCompare(right.due_date) || Number(right.amount) - Number(left.amount)).slice(0, 5).map(row => ({ id: row.id, account: row.account, invoice_number: row.invoice_number, due_date: row.due_date, days_overdue: Math.floor((Date.parse(asOf) - Date.parse(row.due_date)) / 86400000), balance: row.amount === null ? null : row.amount.toFixed(2), owner: row.owner })),
    priority_invoice_count: rows.length,
    ageing: bucketLabels.map(([id, label]) => ({ id, label, receivables: metric(rows.filter(row => row.bucket === id)), payables: metric(payableRows.filter(row => row.bucket === id)) })),
    overdue_by_month: periodMonths.map(month => ({ month, receivables: metric(overdue.filter(row => row.due_date?.startsWith(month))), payables: metric(payableRows.filter(row => row.bucket !== 'current' && row.due_date?.startsWith(month))) })),
    paid_unpaid_by_month: periodMonths.map(month => ({ month, paid: metric(receipts.filter(row => row.invoice_date.startsWith(month))), unpaid: metric(rows.filter(row => row.invoice_date?.startsWith(month))) })),
    chart_exclusions: { receivables: { overdue_outside_window: overdue.filter(row => !periodMonths.includes(row.due_date?.slice(0, 7))).length, invoice_date_unknown: 0, invoice_date_outside_window: [...rows, ...receipts].filter(row => !periodMonths.includes(row.invoice_date?.slice(0, 7))).length }, payables: { overdue_outside_window: 0, invoice_date_unknown: 0, invoice_date_outside_window: 0 } },
    definitions: {
      unpaid: 'Current positive or unknown balances on unsettled invoices in the selected original currency.',
      overdue: 'Current outstanding balances with a due date before the reporting date.',
      over30: 'Current outstanding balances more than 30 days past due.',
      over90: 'Current outstanding balances more than 90 days past due.',
      overdue_by_month: 'Current overdue balances grouped by invoice due month; not historical balance snapshots.',
      paid_unpaid_by_month: 'Recorded receipts and current unpaid balances grouped by invoice issue month; not cash-flow history.',
    },
  };
  if (company) {
    data.sources.payables = { status: 'unavailable', reason: 'Supplier invoices do not record a comparable company. Clear the company filter to compare bills.', route: '/finance/incoming-invoices', invoice_count: null, open_count: null, missing_balance_count: null, unknown_due_date_count: null, source_updated_at: null };
    for (const series of [data.ageing, data.overdue_by_month]) for (const item of series) item.payables = unavailable();
  }
  if (name === 'restricted' || name === 'payables-restricted') {
    const keys = name === 'restricted' ? ['receivables', 'payables'] : ['payables'];
    for (const key of keys) {
      data.sources[key] = { status: 'restricted', reason: 'You do not have access to this invoice register.', route: null, invoice_count: null, open_count: null, missing_balance_count: null, unknown_due_date_count: null, source_updated_at: null };
      for (const series of [data.ageing, data.overdue_by_month]) for (const item of series) item[key] = unavailable();
    }
    if (name === 'restricted') {
      data.kpis = Object.fromEntries(Object.keys(data.kpis).map(key => [key, unavailable()]));
      data.customers = []; data.priority_invoices = []; data.priority_invoice_count = null;
      data.filters.companies = []; data.filters.currencies = []; data.source_updated_at = null;
      data.paid_unpaid_by_month = data.paid_unpaid_by_month.map(row => ({ ...row, paid: unavailable(), unpaid: unavailable() }));
    }
  }
  const states = [...new Set(Object.values(data.sources).map(source => source.status))];
  data.status = states.length === 1 ? states[0] : 'partial';
  return { data, failure: name === 'error' ? 503 : name === 'forbidden' ? 403 : null };
}

export function customerInvoicesFixture(name = 'full', params = {}) {
  const currency = params.currency || 'AED', company = params.company || '';
  let records = invoices().map(row => ({ ...row, paid: false }));
  if (name === 'partial') records.push({ id: 999, account: 'Stripe Inc.', amount: null, invoice_date: '2026-03-01', due_date: '2026-04-01', invoice_number: 'SYN-MISSING-001', paid: false });
  if (currency === 'USD') records = records.filter(row => row.account === 'Business Tech').map(row => ({ ...row, amount: row.amount / 3 }));
  if (currency === 'USD') records.push({ id: 750, account: 'Business Tech', amount: 1100, invoice_date: '2026-08-01', due_date: '2026-08-28', invoice_number: 'SYN-USD-PAID-001', paid: true });
  if (currency === 'AED') records.push(...months.map((month, index) => ({ id: 600 + index, account: 'Stripe Inc.', amount: 9000 + index * 4000, invoice_date: `${month}-01`, due_date: `${month}-28`, invoice_number: `SYN-PAID-${String(index + 1).padStart(2, '0')}`, paid: true })));
  if (company) records = records.filter(row => row.account === company);
  if (['empty', 'register-empty'].includes(name) || currency === 'EUR') records = [];
  const rows = records.map(row => {
    const amount = row.amount === null ? 12000 : row.amount;
    return { id: row.id, account: row.account, company: row.account, invoice_number: row.invoice_number, invoice_date: row.invoice_date, due_date: row.due_date, payment_status: row.paid ? 'paid' : 'pending', payment_status_label: row.paid ? 'Paid' : 'Pending', currency,
      amount: amount.toFixed(2), amount_home: currency === 'AED' ? amount.toFixed(2) : null,
      amount_due_home: row.paid ? '0.00' : currency === 'AED' && row.amount !== null ? row.amount.toFixed(2) : null,
      amount_basis: 'Recorded invoice amount', amount_due_home_basis: row.paid && currency !== 'AED' ? 'zero_recorded_balance' : currency === 'AED' ? 'Recorded AED balance' : 'Home-currency due balance not recorded; no FX conversion is applied.' };
  });
  const ordering = params.ordering || '-invoice_date', descending = ordering.startsWith('-'), key = ordering.replace(/^-/, '');
  const monetary = ['amount', 'amount_home', 'amount_due_home'].includes(key);
  rows.sort((left, right) => {
    const a = left[key], b = right[key];
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    const order = monetary ? Number(a) - Number(b) : String(a).localeCompare(String(b));
    return (descending ? -order : order) || left.id - right.id;
  });
  const page = Number(params.page || 1), pageSize = Number(params.page_size || 8), pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const columnMetric = key => ({ ...metric(rows.map(row => ({ amount: row[key] === null ? null : Number(row[key]) }))), currency: key === 'amount' ? currency : 'AED' });
  const data = {
    schema_version: '1.0', status: name === 'partial' ? 'incomplete' : 'available', currency, home_currency: 'AED', ordering, filters: { company, currency },
    source: { status: name === 'partial' ? 'incomplete' : 'available', reason: name === 'partial' ? 'One balance is missing; totals retain the recorded subtotal.' : null, route: '/finance/outgoing-invoices', source_updated_at: RECEIVABLES_CHECK_TIME },
    pagination: { page, page_size: pageSize, count: rows.length, pages, has_next: page < pages, has_previous: page > 1 }, rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totals: { amount: columnMetric('amount'), amount_home: columnMetric('amount_home'), amount_due_home: columnMetric('amount_due_home') },
    definitions: { scope: 'All matching customer invoices, including settled records; cancelled and credit notes excluded.', amount: 'Recorded invoice amount in its original currency.', amount_home: 'Persisted home-currency invoice amount; no new FX conversion.', amount_due_home: 'Recorded AED due balances only; foreign-currency due values are not converted.', totals: 'Grand totals cover all filtered rows, not only this page.' },
  };
  if (name === 'restricted' || name === 'register-restricted') {
    data.status = 'restricted'; data.source = { status: 'restricted', reason: 'Read access to the customer invoice register is required.', route: null, source_updated_at: null };
    data.rows = []; data.pagination = { ...data.pagination, count: null, pages: null, has_next: false, has_previous: false };
    data.totals = Object.fromEntries(Object.keys(data.totals).map(key => [key, { ...unavailable(), currency: key === 'amount' ? currency : 'AED' }]));
  }
  return { data, failure: ['error', 'register-error'].includes(name) ? 503 : name === 'forbidden' ? 403 : page > pages ? 404 : null };
}
