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
// Company is the customer identity. Blank and conflicting legacy accounts are deliberate regressions.
const legacyAccounts = ['', 'LEGACY-SHARED-ACCOUNT', 'LEGACY-SHARED-ACCOUNT', 'LEGACY-UK-ACCOUNT', 'LEGACY-BUSINESS-ACCOUNT'];
const dates = ['2026-10-01', '2026-09-07', '2026-08-07', '2026-07-08', '2026-05-11', null];
const months = Array.from({ length: 12 }, (_, index) => new Date(Date.UTC(2025, 9 + index, 1)).toISOString().slice(0, 7));
const sum = rows => rows.reduce((total, row) => total + Number(row.amount || 0), 0);
const metric = rows => ({ amount: rows.some(row => row.amount === null) ? null : sum(rows).toFixed(2), known_amount: rows.length && rows.every(row => row.amount === null) ? null : sum(rows).toFixed(2), count: rows.length, missing_count: rows.filter(row => row.amount === null).length, partial: rows.some(row => row.amount === null) });
const unavailable = () => ({ amount: null, known_amount: null, count: null, missing_count: null, partial: true });
const decimal = value => value === null || value === undefined ? null : Number(value).toFixed(2);
const excluded = ['cancelled', 'credit_note'];
const statusLabels = { new: 'New', pending: 'Pending', partial: 'Partially Paid', paid: 'Paid', overdue: 'Overdue' };
const daysPastDue = (date, asOf) => date ? Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(date)) / 86400000)) : null;
const bucketFor = (date, asOf) => { const days = daysPastDue(date, asOf); return days === null ? 'unknown_due_date' : days === 0 ? 'current' : days <= 30 ? 'days_1_30' : days <= 60 ? 'days_31_60' : days <= 90 ? 'days_61_90' : 'over90'; };

// Workbook aggregates deliberately differ from the scoped synthetic invoice API.
// This catches accidental reuse of live currency/customer filters for the full file.
export function workbookSummaryFixture(status = 'available') {
  if (status !== 'available') return { schema_version: '1.0', status, reason: status === 'restricted' ? 'Access to the full invoice workbook is required.' : 'The invoice workbook summary is unavailable.', source: null, invoice_count: null, totals: null, coverage: {}, payment_status: [], other_statuses: [], project_excluded_rows: null, currency_basis: 'mixed_original', currency_breakdown: [], currency_rounding_adjustment: {} };
  const currencyRows = [
    ['AED', 'recorded', '256727607.14', '236869176.92', 2020, 1829],
    ['EUR', 'recorded', '13008426.71', '9592153.57', 1707, 1462],
    ['SEK', 'recorded', '219000.00', '219000.00', 1, 1],
    ['USD', 'recorded', '41706207.76', '36175812.14', 639, 549],
    [null, 'conflict', '674340.40', '475467.22', 11, 10],
    [null, 'not_recorded', '3146096.40', '2428132.15', 19, 14],
  ].map(([currency, currency_status, invoice_amount, actual_payment_received, invoiceCount, receiptCount]) => {
    const unknown = currency_status === 'not_recorded';
    return { currency, currency_status, invoice_amount, actual_payment_received,
      row_counts: { invoice_amount: invoiceCount + (unknown ? 7 : 0), actual_payment_received: receiptCount + (unknown ? 539 : 0) },
      coverage: { invoice_amount: { numeric_count: invoiceCount, blank_count: unknown ? 5 : 0, text_count: unknown ? 2 : 0, error_count: 0 }, actual_payment_received: { numeric_count: receiptCount, blank_count: unknown ? 527 : 0, text_count: unknown ? 12 : 0, error_count: 0 } },
      exact_amounts: { invoice_amount, actual_payment_received } };
  });
  return {
    schema_version: '1.0', status, source: { file_name: 'Synthetic invoice workbook.xlsx', sheet: 'External Invoice ', first_row: 6, last_row: 4409, snapshot_at: RECEIVABLES_CHECK_TIME, sha256: 'a'.repeat(64), scope: 'full_workbook', currency_method: 'strict_agreement_or_single_source', currency_column: 'AE', currency_header: 'Inv. CUR' },
    invoice_count: 4404, totals: { invoice_amount: '315481678.41', invoice_amount_aed: '466151390.16', actual_payment_received: '285759742.00', project_count: 496 },
    coverage: {
      invoice_amount: { numeric_count: 4397, blank_count: 5, text_count: 2, error_count: 0 },
      invoice_amount_aed: { numeric_count: 4397, blank_count: 5, text_count: 0, error_count: 2 },
      actual_payment_received: { numeric_count: 3865, blank_count: 527, text_count: 12, error_count: 0 },
    },
    payment_status: [
      ['paid', 'Paid', 3895, '412405138.81', 3893, 0, 2], ['cancelled', 'Cancelled', 368, '39497085.61', 363, 5, 0],
      ['pending', 'Pending', 58, '6401792.89', 58, 0, 0], ['new', 'New', 34, '2257559.79', 34, 0, 0], ['other', 'Other statuses', 49, '5589813.06', 49, 0, 0],
    ].map(([id, label, count, amount_aed, numeric_count, blank_count, error_count]) => ({ id, label, count, amount_aed, exact_amount_aed: amount_aed, amount_coverage: { numeric_count, blank_count, text_count: 0, error_count } })),
    payment_status_rounding_adjustment: '0.00',
    other_statuses: [{ label: 'Partially paid', count: 30 }, { label: 'Overdue', count: 19 }], project_excluded_rows: 37, currency_basis: 'mixed_original',
    currency_breakdown: currencyRows, currency_rounding_adjustment: { invoice_amount: '0.00', actual_payment_received: '0.00' },
  };
}

function sourceInvoice(row) {
  const status = row.payment_status || (row.paid ? 'paid' : 'pending');
  const invoiceAmount = Object.hasOwn(row, 'invoice_amount') ? row.invoice_amount : row.amount;
  const receipt = Object.hasOwn(row, 'actual_payment_received') ? row.actual_payment_received : row.paid ? invoiceAmount : 0;
  const balance = invoiceAmount === null ? null : Number(invoiceAmount) - Number(receipt ?? 0);
  return {
    ...row, invoice_amount: decimal(invoiceAmount), actual_payment_received: decimal(receipt), amount: balance,
    invoice_amount_aed: Object.hasOwn(row, 'invoice_amount_aed') ? decimal(row.invoice_amount_aed) : decimal(invoiceAmount),
    // Non-Partial records deliberately carry conflicting Y values; only Partial uses Y.
    balance_to_be_received: decimal(row.balance_to_be_received ?? 987654.32),
    invoice_sent_date: row.invoice_date ? new Date(Date.parse(row.invoice_date) + 86400000).toISOString().slice(0, 10) : null,
    project_name: row.project_name || 'Synthetic engineering delivery', payment_terms: row.payment_terms || '30 days',
    pm: row.owner || null, payment_status: status, payment_status_label: statusLabels[status] || status,
    payment_date: Number(receipt) > 0 ? '2026-09-18' : null, remarks: row.remarks || 'Synthetic invoice source record',
  };
}

export function formulaInvoiceSources() {
  return [
    { id: 901, company: 'Formula Customer', invoice_amount: 10000, actual_payment_received: 2500, balance_to_be_received: 6200, payment_status: 'partial', due_date: '2026-05-01' },
    { id: 902, company: 'Blank Receipt Ltd', invoice_amount: 2000, actual_payment_received: null, payment_status: 'overdue', due_date: '2026-09-10' },
    { id: 903, company: 'Missing Invoice Ltd', invoice_amount: null, actual_payment_received: 100, grand_total: '9000.00', due_date: '2026-08-01' },
    { id: 904, company: 'Settled Example', invoice_amount: 3000, actual_payment_received: 3000, payment_status: 'new', due_date: '2026-07-01' },
    { id: 905, company: 'Overpaid Example', invoice_amount: 1000, actual_payment_received: 1250, due_date: '2026-07-01' },
    { id: 906, company: 'Paid Status Example', invoice_amount: 8000, actual_payment_received: 1000, payment_status: 'paid', due_date: '2026-07-01' },
    { id: 907, company: 'Cancelled Example', invoice_amount: 500, actual_payment_received: 0, payment_status: 'cancelled', due_date: '2026-07-01' },
    { id: 908, company: 'Credit Note Example', invoice_amount: 700, actual_payment_received: 0, payment_status: 'credit_note', due_date: '2026-07-01' },
  ].map(row => sourceInvoice({ account: 'LEGACY-FORMULA', invoice_date: '2026-04-01', invoice_number: `SYN-FORMULA-${row.id}`, owner: 'Alex Morgan', ...row }));
}

function invoices() {
  return customerRows.flatMap(([company, amounts], customerIndex) => amounts.flatMap((amount, bucketIndex) => amount ? [sourceInvoice({ id: 100 + customerIndex * 10 + bucketIndex, company, account: legacyAccounts[customerIndex], amount, payment_status: bucketIndex === 0 ? 'pending' : 'overdue', bucket: bucketLabels[bucketIndex][0], due_date: bucketIndex === 4 ? ['2026-05-11', '2026-02-05', '2025-12-13'][customerIndex] : dates[bucketIndex], invoice_date: bucketIndex === 4 ? ['2026-04-01', '2026-01-01', '2025-11-01'][customerIndex] : ['2026-09-01', '2026-08-01', '2026-07-01', '2026-06-01', null, null][bucketIndex], invoice_number: `SYN-2026-${customerIndex + 1}${bucketIndex}`, owner: customerIndex % 2 ? 'Alex Morgan' : null })] : []));
}

function sourceRecords(name, currency) {
  if (name === 'workbook') return [
    { id: 'source:921', currency: 'USD', invoice_amount: 1000, invoice_amount_aed: 3672.50, payment_status: 'overdue', source_row: 6 },
    { id: 'source:922', currency: 'AED', invoice_amount: 1000, invoice_amount_aed: 1000, payment_status: 'overdue', source_row: 7 },
    { id: 'source:923', currency: 'EUR', invoice_amount: 200, invoice_amount_aed: 834.05, payment_status: 'pending', source_row: 8 },
  ].filter(row => currency === 'AED' || row.currency === currency).map(row => sourceInvoice({ ...row, company: 'Workbook Customer', invoice_number: `WORKBOOK-${row.source_row}`, invoice_date: '2026-04-01', due_date: '2026-05-01', actual_payment_received: 0, balance_to_be_received: 0, actual_payment_currency: row.currency, invoice_route: null, source_snapshot: true }));
  let rows = name === 'formula' ? formulaInvoiceSources() : name === 'signed' ? [
    { id: 911, company: 'Positive Customer', invoice_amount: 100, actual_payment_received: 100, payment_status: 'overdue' },
    { id: 912, company: 'Negative Customer', invoice_amount: -150, actual_payment_received: 50, payment_status: 'overdue' },
    { id: 913, company: 'Zero Customer', invoice_amount: 0, actual_payment_received: 0, payment_status: 'new' },
  ].map(row => sourceInvoice({ ...row, invoice_number: `SIGNED-${row.id}`, invoice_date: '2026-09-01', due_date: '2026-05-01' })) : invoices();
  if (name === 'partial') rows.push(sourceInvoice({ id: 999, company: 'Stripe Inc.', account: '', invoice_amount: null, payment_status: 'overdue', grand_total: '12000.00', due_date: '2026-04-01', invoice_date: '2026-03-01', invoice_number: 'SYN-MISSING-001', owner: null }));
  if (currency === 'USD') rows = rows.filter(row => row.company === 'Business Tech').map(row => sourceInvoice({ ...row, invoice_amount: row.invoice_amount === null ? null : Number(row.invoice_amount) / 3, actual_payment_received: row.actual_payment_received === null ? null : Number(row.actual_payment_received) / 3, invoice_amount_aed: null }));
  if (currency === 'USD') rows.push(sourceInvoice({ id: 750, company: 'Business Tech', account: legacyAccounts[4], amount: 1100, invoice_date: '2026-08-01', due_date: '2026-08-28', invoice_number: 'SYN-USD-PAID-001', paid: true, invoice_amount_aed: null }));
  if (currency === 'AED' && !['formula', 'signed'].includes(name)) rows.push(...months.map((month, index) => sourceInvoice({ id: 600 + index, company: 'Stripe Inc.', account: '', amount: 9000 + index * 4000, invoice_date: `${month}-01`, due_date: `${month}-28`, invoice_number: `SYN-PAID-${String(index + 1).padStart(2, '0')}`, paid: true })));
  if (name === 'missing-company') rows = [{ ...rows[0], company: '', account: 'LEGACY-ONLY-ACCOUNT' }];
  return name === 'empty' || currency === 'EUR' ? [] : rows.filter(row => !excluded.includes(row.payment_status));
}

// Invoice-date cohorts are separate from the existing receivables balance DTO.
// Keep original finance fixtures intact while exercising the executive presentation.
export function invoicePerformanceFixture(name = 'full', params = {}) {
  const currency = params.currency || 'AED', company = params.company || '', asOf = params.as_of || '2026-09-21';
  const [year, month] = asOf.split('-').map(Number);
  const monthAt = offset => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
  const periodMonths = Array.from({ length: 12 }, (_, index) => monthAt(index - 11));
  const futureMonths = Array.from({ length: 12 }, (_, index) => monthAt(index + 1));
  const unknownRate = () => ({ value: null, status: 'unavailable', unit: 'percent' });
  const definitions = {
    invoiced: 'Invoiced revenue is recorded Invoice Amount in its original currency, grouped by invoice issue month. This is invoice value, not recognised accounting revenue. No currency conversion is applied.',
    received: 'Current cumulative Actual Payment Received against invoices issued in each month. Missing receipts remain unknown. This is not cash collected during that month.',
    outstanding: 'Sum of max(Invoice Amount minus Actual Payment Received, 0) per invoice. Paid-labelled invoices are included. Missing values remain unknown.',
    collection_rate: 'Recorded receipts divided by invoiced value for the same invoice-date cohort; both must be complete and invoiced value positive.',
    period: 'Monthly invoice-date cohorts. YTD means 1 January through the selected cutoff. Current receipts do not reconstruct historical cash flows.',
    estimate: 'Illustrative estimate from the average invoiced value of the three completed calendar months, repeated for the next 12 months. Not an approved Finance forecast.',
    margin: 'Only Finance-approved recognised revenue and matching operating costs establish operating margin.',
    plan: 'Only Finance-approved budget and forecast on the same invoice-value basis and original currency are used.',
    scope: 'Complete authorised external invoice register, including paid invoices; cancelled and credit-note invoices are excluded.',
  };
  const empty = status => ({
    schema_version: '1.0', status, reason: status === 'restricted' ? 'Read access to customer invoices is required.' : 'No dated external customer invoices are available in this currency and scope.',
    currency, company, as_of_date: asOf, period_basis: 'calendar_year', basis: 'invoice_date', currency_conversion_applied: false,
    source_updated_at: status === 'restricted' ? null : RECEIVABLES_CHECK_TIME,
    source: { kind: 'customer_invoice_register', label: 'Authorised customer invoice register', route: status === 'restricted' ? null : '/finance/outgoing-invoices' },
    kpis: { monthly_invoiced: unavailable(), ytd_invoiced: unavailable(), ytd_received: unavailable(), ytd_outstanding: unavailable(), collection_rate: unknownRate() },
    monthly: [], forecast: { status: 'unavailable', rows: [], method: null, basis_months: [], description: definitions.estimate },
    budget: { status: 'unavailable', rows: [], description: definitions.plan }, operating_margin: { status: 'unavailable', rows: [], description: definitions.margin },
    coverage: {}, definitions,
  });
  if (name === 'restricted' || name === 'performance-restricted') return empty('restricted');
  if (name === 'performance-unavailable') return empty('unavailable');
  let records = sourceRecords(name, currency).filter(row => !company || row.company === company);
  if (name === 'performance-zero') records = records.map(row => ({ ...row, invoice_amount: '0.00', actual_payment_received: '0.00' }));
  if (name === 'performance-missing') records = records.map(row => row.invoice_date?.startsWith(monthAt(0)) ? { ...row, invoice_amount: null, actual_payment_received: null } : row);
  const eligible = records.filter(row => row.invoice_date && row.invoice_date <= asOf);
  if (!eligible.length) return empty('unavailable');
  const result = empty('available');
  const totals = rows => {
    const invoiced = metric(rows.map(row => ({ amount: row.invoice_amount === null ? null : Number(row.invoice_amount) })));
    const received = metric(rows.map(row => ({ amount: row.actual_payment_received === null ? null : Number(row.actual_payment_received) })));
    const outstanding = metric(rows.map(row => ({ amount: row.invoice_amount === null || row.actual_payment_received === null ? null : Math.max(Number(row.invoice_amount) - Number(row.actual_payment_received), 0) })));
    const rate = invoiced.amount !== null && received.amount !== null && Number(invoiced.amount) > 0 ? { value: Number((Number(received.amount) / Number(invoiced.amount) * 100).toFixed(2)), status: 'available', unit: 'percent' } : unknownRate();
    return { invoiced, received, outstanding, collection_rate: rate };
  };
  result.monthly = periodMonths.map(period => ({ month: period, ...totals(eligible.filter(row => row.invoice_date.startsWith(period))), partial_period: period === monthAt(0), budget: null, forecast: null, operating_margin: null }));
  const ytd = totals(eligible.filter(row => row.invoice_date.startsWith(String(year))));
  result.kpis = { monthly_invoiced: result.monthly.at(-1).invoiced, ytd_invoiced: ytd.invoiced, ytd_received: ytd.received, ytd_outstanding: ytd.outstanding, collection_rate: ytd.collection_rate };
  result.coverage = {
    source_row_count: records.length, eligible_invoice_count: eligible.length, excluded_internal_count: 0, excluded_cancelled_count: 0, excluded_credit_note_count: 0,
    missing_invoice_date_count: records.filter(row => !row.invoice_date).length, future_invoice_date_count: records.filter(row => row.invoice_date > asOf).length,
    outside_window_count: eligible.filter(row => !periodMonths.includes(row.invoice_date.slice(0, 7))).length,
    missing_invoice_amount_count: eligible.filter(row => row.invoice_amount === null).length, missing_receipt_count: eligible.filter(row => row.actual_payment_received === null).length,
    overpaid_invoice_count: eligible.filter(row => row.invoice_amount !== null && row.actual_payment_received !== null && Number(row.actual_payment_received) > Number(row.invoice_amount)).length,
    negative_invoice_amount_count: 0, negative_receipt_count: 0,
    first_invoice_date: eligible.map(row => row.invoice_date).sort()[0], last_invoice_date: eligible.map(row => row.invoice_date).sort().at(-1),
  };
  const incomplete = ['missing_invoice_date_count', 'missing_invoice_amount_count', 'missing_receipt_count'].some(key => result.coverage[key]);
  result.status = incomplete ? 'partial' : 'available';
  result.reason = incomplete ? 'Missing source values remain unknown; see coverage.' : null;
  const baseline = result.monthly.slice(-4, -1);
  if (baseline.every(row => row.invoiced.amount !== null) && result.coverage.first_invoice_date <= `${baseline[0].month}-01`) {
    const average = baseline.reduce((total, row) => total + Number(row.invoiced.amount), 0) / 3;
    if (average > 0) result.forecast = { status: 'estimated', rows: futureMonths.map(period => ({ month: period, value: decimal(average) })), method: 'three_completed_calendar_month_average', basis_months: baseline.map(row => row.month), partial: false, description: definitions.estimate };
  }
  if (name === 'performance-approved' || name === 'performance-unapproved') {
    const status = name === 'performance-approved' ? 'approved' : 'unavailable';
    result.monthly = result.monthly.map((row, index) => ({ ...row, budget: decimal(100000 + index * 1000), operating_margin: 20 }));
    result.budget = { status, rows: result.monthly.map(row => ({ month: row.month, value: row.budget })), description: definitions.plan };
    result.operating_margin = { status, rows: result.monthly.map(row => ({ month: row.month, value: 20, recognised_revenue: '100000.00', operating_costs: '80000.00', actual_through: row.month === monthAt(0) ? asOf : new Date(Date.UTC(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7)), 0)).toISOString().slice(0, 10) })), description: definitions.margin };
    result.forecast = { status, rows: futureMonths.map(period => ({ month: period, value: '125000.00' })), method: 'finance_approved_invoice_forecast', basis_months: [], partial: false, description: definitions.plan };
  }
  return result;
}

export function receivablesFixture(name = 'full', params = {}) {
  const currency = params.currency || 'AED';
  const company = params.company || '';
  const asOf = params.as_of || '2026-09-21';
  const records = sourceRecords(name, currency).filter(row => !company || row.company === company);
  const rows = records.filter(row => ['new', 'overdue', 'pending', 'partial'].includes(row.payment_status))
    .map(row => ({ ...row, amount: row.payment_status === 'partial' ? row.balance_to_be_received === null ? null : Number(row.balance_to_be_received) : name === 'workbook' && currency === 'AED' ? Number(row.invoice_amount_aed) : row.invoice_amount === null ? null : Number(row.invoice_amount), bucket: bucketFor(row.due_date, asOf) }));
  const missing = rows.filter(row => row.amount === null).length;
  const overdue = rows.filter(row => row.payment_status === 'overdue');
  const periodMonths = months.slice(-Number(params.months || 12));
  const receipts = records.map(row => ({ invoice_date: row.invoice_date, amount: Number(row.actual_payment_received ?? 0) }));
  const customers = [...new Set(rows.map(row => row.company))].map(company => {
    const selected = rows.filter(row => row.company === company);
    return { company, customer: company || 'Customer not recorded', account: company || 'Customer not recorded', ...metric(selected), overdue: metric(selected.filter(row => row.payment_status === 'overdue')), share_percentage: sum(rows) ? sum(selected) / sum(rows) * 100 : 0,
      buckets: Object.fromEntries(bucketLabels.map(([id]) => [id, metric(selected.filter(row => row.bucket === id))])) };
  }).sort((left, right) => Number(right.known_amount) - Number(left.known_amount));
  const payableRows = [15000, 18000, 12000, 6000, 4500, 0].flatMap((amount, index) => amount && !company && currency === 'AED' ? [{ amount, bucket: bucketLabels[index][0], due_date: dates[index] }] : []);
  const data = {
    schema_version: '1.0', generated_at: RECEIVABLES_CHECK_TIME, source_updated_at: RECEIVABLES_CHECK_TIME, as_of_date: asOf, currency, currency_conversion_applied: false,
    workbook_summary: workbookSummaryFixture(name === 'restricted' || name === 'workbook-restricted' ? 'restricted' : name === 'workbook-unavailable' ? 'unavailable' : 'available'),
    invoice_performance: invoicePerformanceFixture(name, params),
    filters: { companies: name === 'formula' ? formulaInvoiceSources().filter(row => !excluded.includes(row.payment_status)).map(row => row.company) : customerRows.map(row => row[0]), currencies: ['AED', 'EUR', 'USD'], company, months: Number(params.months || 12) },
    sources: { receivables: { status: missing ? 'incomplete' : 'available', reason: missing ? `${missing} invoice amount is missing; recorded subtotals exclude it.` : null, route: '/finance/outgoing-invoices', invoice_count: records.length, open_count: rows.length, missing_balance_count: missing, unknown_due_date_count: rows.filter(row => !row.due_date).length, source_updated_at: RECEIVABLES_CHECK_TIME }, payables: { status: 'available', reason: null, route: '/finance/incoming-invoices', invoice_count: payableRows.length, open_count: payableRows.length, missing_balance_count: 0, unknown_due_date_count: 0, source_updated_at: RECEIVABLES_CHECK_TIME } },
    kpis: { unpaid: metric(rows), overdue: metric(overdue), over30: metric(rows.filter(row => ['days_31_60', 'days_61_90', 'over90'].includes(row.bucket))), over60: metric(rows.filter(row => ['days_61_90', 'over90'].includes(row.bucket))), over90: metric(rows.filter(row => row.bucket === 'over90')) },
    customers,
    priority_invoices: [...overdue].sort((left, right) => String(left.due_date || '9999').localeCompare(String(right.due_date || '9999')) || Number(right.amount) - Number(left.amount)).slice(0, 5).map(row => ({ id: row.id, company: row.company, customer: row.company || 'Customer not recorded', account: row.account, invoice_number: row.invoice_number, due_date: row.due_date, days_overdue: daysPastDue(row.due_date, asOf), payment_status: row.payment_status, invoice_amount: row.invoice_amount, actual_payment_received: row.actual_payment_received, balance_to_be_received: row.balance_to_be_received, balance: decimal(row.amount), owner: row.owner })),
    priority_invoice_count: rows.length,
    ageing: bucketLabels.map(([id, label]) => ({ id, label, receivables: metric(rows.filter(row => row.bucket === id)), payables: metric(payableRows.filter(row => row.bucket === id)) })),
    overdue_by_month: periodMonths.map(month => ({ month, receivables: metric(overdue.filter(row => row.due_date?.startsWith(month))), payables: metric(payableRows.filter(row => row.bucket !== 'current' && row.due_date?.startsWith(month))) })),
    paid_unpaid_by_month: periodMonths.map(month => ({ month, paid: metric(receipts.filter(row => row.invoice_date?.startsWith(month))), unpaid: metric(rows.filter(row => row.invoice_date?.startsWith(month))) })),
    chart_exclusions: { receivables: { overdue_outside_window: overdue.filter(row => row.due_date && !periodMonths.includes(row.due_date.slice(0, 7))).length, overdue_due_date_unknown: overdue.filter(row => !row.due_date).length, invoice_date_unknown: records.filter(row => !row.invoice_date).length, invoice_date_outside_window: records.filter(row => !periodMonths.includes(row.invoice_date?.slice(0, 7))).length }, payables: { overdue_outside_window: 0, invoice_date_unknown: 0, invoice_date_outside_window: 0 } },
    definitions: {
      unpaid: 'Invoice Amount (L) for payment status New, Overdue or Pending, plus Balance to be received (Y) for Partial. Signed and zero amounts are retained; missing source amounts remain unknown. Other payment statuses are excluded.',
      overdue: 'Invoice Amount (L) for recorded payment status Overdue, regardless of Due Date.',
      over30: 'Unpaid balances more than 30 days past the Due Date, relative to the selected as-of date.',
      over60: 'Unpaid balances more than 60 days past the Due Date, relative to the selected as-of date.',
      over90: 'Unpaid balances more than 90 days past the Due Date, relative to the selected as-of date.',
      overdue_by_month: 'Current overdue balances grouped by invoice due month; not historical balance snapshots.',
      paid_unpaid_by_month: 'Recorded receipts and current unpaid balances grouped by invoice issue month; not cash-flow history.',
    },
  };
  if (name === 'workbook') {
    data.amount_basis = currency === 'AED' ? 'recorded_aed' : 'original_currency';
    Object.assign(data.sources.receivables, { mode: 'workbook', file_name: 'Verified source invoices.xlsx', sheet_name: 'External Invoice', snapshot_id: 1, route: null });
    data.filters.companies = ['Workbook Customer'];
    data.priority_invoices = data.priority_invoices.map(row => ({ ...row, invoice_route: null, source_snapshot: true, source_row: records.find(record => record.id === row.id).source_row }));
    data.definitions.overdue = currency === 'AED' ? 'Recorded Inv Amt. (AED) for payment status Overdue across all original invoice currencies.' : data.definitions.overdue;
  }
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
  const currency = params.currency || 'AED', company = params.company || '', asOf = params.as_of || '2026-09-21';
  const records = name === 'register-empty' ? [] : sourceRecords(name, currency).filter(row => (!company || row.company === company) && (!params.payment_status || row.payment_status === params.payment_status));
  const rows = records.map(row => {
    return { ...row, customer: row.company || 'Customer not recorded', currency: row.currency || currency,
      amount: row.invoice_amount, amount_home: row.invoice_amount_aed,
      days_overdue: row.payment_status === 'paid' ? 0 : daysPastDue(row.due_date, asOf),
      amount_due_home: currency === 'AED' ? decimal(row.amount) : row.amount === 0 ? '0.00' : null,
      amount_basis: row.invoice_amount === null ? 'not_recorded' : 'invoice_amount',
      amount_due_home_basis: currency !== 'AED' && row.amount === 0 ? 'zero_calculated_balance' : currency === 'AED' ? 'invoice_amount_less_actual_payment_received' : 'not_recorded_for_foreign_currency' };
  });
  const ordering = params.ordering || '-invoice_date', descending = ordering.startsWith('-'), key = ordering.replace(/^-/, '');
  const monetary = ['amount', 'amount_home', 'amount_due_home', 'invoice_amount', 'invoice_amount_aed', 'actual_payment_received', 'days_overdue'].includes(key);
  rows.sort((left, right) => {
    const a = left[key], b = right[key];
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    const order = monetary ? Number(a) - Number(b) : String(a).localeCompare(String(b));
    return (descending ? -order : order) || left.id - right.id;
  });
  const page = Number(params.page || 1), pageSize = Number(params.page_size || 8), pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const columnMetric = key => ({ ...metric(rows.map(row => ({ amount: key === 'actual_payment_received' ? Number(row[key] ?? 0) : row[key] === null ? null : Number(row[key]) }))), currency: ['amount', 'actual_payment_received'].includes(key) ? currency : 'AED' });
  const totals = Object.fromEntries(['amount', 'amount_home', 'amount_due_home', 'actual_payment_received'].map(key => [key, columnMetric(key)]));
  const partial = Object.values(totals).some(item => item.partial);
  const data = {
    schema_version: '1.0', status: partial ? 'incomplete' : 'available', currency, home_currency: 'AED', as_of_date: asOf, ordering, filters: { company, currency, as_of: asOf },
    source: { status: partial ? 'incomplete' : 'available', reason: partial ? 'Some invoice amounts are missing; totals retain recorded subtotals.' : null, route: '/finance/outgoing-invoices', source_updated_at: RECEIVABLES_CHECK_TIME },
    pagination: { page, page_size: pageSize, count: rows.length, pages, has_next: page < pages, has_previous: page > 1 }, rows: rows.slice((page - 1) * pageSize, page * pageSize),
    totals,
    definitions: { scope: 'All matching customer invoices, including settled records; cancelled and credit notes excluded.', amount: 'Invoice Amount from column L; no stored-balance or grand-total fallback.', amount_home: 'Persisted Inv Amt. (AED) from column M; no new FX conversion.', amount_due_home: 'Signed Invoice Amount (L) minus Actual Payment Received (AA) for AED invoices. Blank AA means zero and missing L remains unknown; no FX conversion.', actual_payment_received: 'Recorded column AA; missing receipt cells stay blank, while their contribution to totals is zero.', totals: 'Grand totals cover all filtered rows, not only this page.' },
  };
  if (name === 'workbook') {
    Object.assign(data.source, { mode: 'workbook', file_name: 'Verified source invoices.xlsx', sheet_name: 'External Invoice', snapshot_id: 1, route: null });
    data.amount_basis = currency === 'AED' ? 'recorded_aed' : 'original_currency';
    data.definitions.totals = 'Grand totals cover all filtered source rows. Original currency totals remain separate; Inv Amt. (AED) is the recorded AED subtotal.';
    if (new Set(records.map(row => row.currency)).size > 1) for (const key of ['amount', 'actual_payment_received']) data.totals[key] = { ...data.totals[key], amount: null, known_amount: null, partial: true, currency: 'MIXED', reason: 'Recorded values use multiple currencies.' };
  }
  if (name === 'restricted' || name === 'register-restricted') {
    data.status = 'restricted'; data.source = { status: 'restricted', reason: 'Read access to the customer invoice register is required.', route: null, source_updated_at: null };
    data.rows = []; data.pagination = { ...data.pagination, count: null, pages: null, has_next: false, has_previous: false };
    data.totals = Object.fromEntries(Object.keys(data.totals).map(key => [key, { ...unavailable(), currency: ['amount', 'actual_payment_received'].includes(key) ? currency : 'AED' }]));
  }
  return { data, failure: ['error', 'register-error'].includes(name) ? 503 : name === 'forbidden' ? 403 : page > pages ? 404 : null };
}
