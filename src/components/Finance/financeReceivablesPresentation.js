import { financeCount, financeDate, financeNumber } from './financeCommandPresentation.js';
import { outgoingReviewMoney } from './outgoingReviewPresentation.js';

export const RECEIVABLE_AGES = [
  ['current', 'Current'], ['days_1_30', '1–30'], ['days_31_60', '31–60'],
  ['days_61_90', '61–90'], ['over90', '91+'],
];
export const RECEIVABLE_KPIS = [
  ['unpaid', 'Unpaid invoices', 'blue'], ['overdue', 'Overdue amount', 'cyan'],
  ['over30', 'Overdue 30+ days', 'amber'], ['over60', 'Overdue 60+ days', 'orange'], ['over90', 'Overdue 90+ days', 'red'],
];
export const RECEIVABLE_DEFINITIONS = {
  unpaid: 'Payment status New, Overdue, Pending or Partial. Partial invoices contribute only their remaining balance to be received. Signed and zero amounts are retained.',
  overdue: 'Amounts for invoices whose recorded payment status is Overdue, regardless of their due date.',
  over30: 'Unpaid balances more than 30 days past the Due Date, relative to the selected as-of date.',
  over60: 'Unpaid balances more than 60 days past the Due Date, relative to the selected as-of date.',
  over90: 'Unpaid balances more than 90 days past the Due Date, relative to the selected as-of date.',
};
export const receivablesToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
export const receivableRawValue = metric => {
  if (!metric || typeof metric !== 'object') return financeNumber(metric) === null ? null : metric;
  if (financeNumber(metric.amount) !== null) return metric.amount;
  return metric.partial === true && financeNumber(metric.known_amount) !== null ? metric.known_amount : null;
};
export const receivableValue = metric => financeNumber(receivableRawValue(metric));
// Reuse the register's decimal-safe formatter; chart coordinates alone use Number.
export const receivableNumber = value => outgoingReviewMoney(value, 'AED').replace(/^AED /, '').replace(/\.00$/, '');
export const receivableMoney = (value, currency) => financeNumber(value) === null ? '—' : `${currency === 'UNSPECIFIED' ? 'Unspecified' : currency || ''} ${receivableNumber(value)}`.trim();
export const receivableDate = value => value ? financeDate(String(value).slice(0, 10)) : 'Not recorded';
export const receivableCustomer = row => String(row?.company ?? '').trim() || 'Customer not recorded';
export const receivableReadable = source => ['available', 'incomplete'].includes(source?.status);
export const receivableInvoiceRoute = row => row?.source_snapshot || String(row?.id || '').startsWith('source:')
  ? row.invoice_route || null
  : row && Object.hasOwn(row, 'invoice_route') ? row.invoice_route
    : row?.id === undefined || row?.id === null ? null : `/finance/outgoing-invoices/${encodeURIComponent(row.id)}`;
export const receivableAmountBasis = data => data?.amount_basis === 'recorded_aed'
  ? 'AED invoice amounts use recorded Inv Amt. (AED) values across all original invoice currencies. No live exchange-rate conversion is applied.'
  : 'Amounts use the selected original invoice currency. No currency conversion is applied.';
export function receivableMetricNote(metric, amountBasis = 'original_currency') {
  if (financeCount(metric?.count) === null && receivableValue(metric) === null) return 'Balance not available';
  if (metric?.partial) {
    const missing = financeCount(metric.missing_count);
    return missing > 0 ? `Recorded amount · ${missing} ${missing === 1 ? 'balance' : 'balances'} missing` : 'Recorded amount · incomplete data';
  }
  return receivableValue(metric) === null ? 'Balance not available' : amountBasis === 'recorded_aed' ? 'recorded AED amounts' : 'in original currency';
}
export function receivableCustomerRows(data) {
  if (!receivableReadable(data?.sources?.receivables)) return [];
  return (data?.customers || []).map(row => ({
    ...row, company: String(row.company ?? '').trim(), customer: receivableCustomer(row), amount: receivableValue(row),
    display_amount: receivableRawValue(row),
    buckets: Object.fromEntries([...RECEIVABLE_AGES, ['unknown_due_date', 'Unknown']].map(([id]) => [id, receivableValue(row.buckets?.[id])])),
    bucket_display: Object.fromEntries([...RECEIVABLE_AGES, ['unknown_due_date', 'Unknown']].map(([id]) => [id, receivableRawValue(row.buckets?.[id])])),
    bucket_metrics: row.buckets,
    unknown_due_date_count: financeCount(row.buckets?.unknown_due_date?.count) ?? 0,
    share: financeNumber(row.share_percentage),
  })).sort((a, b) => (b.amount ?? -Infinity) - (a.amount ?? -Infinity));
}
export function receivableChartRows(data) {
  const customers = receivableCustomerRows(data);
  return {
    customers: customers.slice(0, 5),
    ageing: (data?.ageing || []).filter(row => row.id !== 'unknown_due_date' || row.receivables?.count > 0 || row.payables?.count > 0).map(row => ({ id: row.id, label: row.label, invoices: receivableValue(row.receivables), bills: receivableValue(row.payables) })),
    overdue: (data?.overdue_by_month || []).map(row => ({ month: row.month, invoices: receivableValue(row.receivables), bills: receivableValue(row.payables) })),
    payments: (data?.paid_unpaid_by_month || []).map(row => ({ month: row.month, paid: receivableValue(row.paid), unpaid: receivableValue(row.unpaid) })),
  };
}
export function receivableCollectionRoute(filters = {}, company = '') {
  const customer = company.trim();
  const query = new URLSearchParams({ queue: customer ? 'open' : 'all' });
  if (!customer) query.set('payment_status', 'overdue');
  if (filters.currency) query.set('currency', filters.currency);
  if (customer || filters.company) query.set('company', customer || filters.company);
  return `/finance/outgoing-invoices?${query.toString()}`;
}
export function receivableAlert(data) {
  if (!receivableReadable(data?.sources?.receivables)) return {
    title: data?.sources?.receivables?.status === 'restricted' ? 'Receivables access is restricted' : 'Receivables are unavailable',
    detail: data?.sources?.receivables?.reason || 'Refresh to load the customer invoice register.',
  };
  const overdue = data.kpis?.overdue;
  const unknownDueDates = financeCount(data.sources?.receivables?.unknown_due_date_count);
  const recordedCustomers = (data.customers || []).map(row => ({ customer: receivableCustomer(row), value: receivableValue(row.overdue) }));
  const customers = recordedCustomers.filter(row => row.value > 0).sort((a, b) => b.value - a.value);
  if (!customers.length && unknownDueDates > 0) return { title: `${unknownDueDates} ${unknownDueDates === 1 ? 'invoice needs a due date' : 'invoices need due dates'}`, detail: 'Record the missing due dates to assess 30+, 60+ and 90+ day ageing. Recorded Overdue payment statuses still contribute to the overdue amount.' };
  if (!customers.length && receivableValue(overdue) < 0 && !overdue?.partial) return { title: 'No positive overdue balances in this view', detail: 'The overdue amount includes recorded negative amounts. Review the invoice register for the signed balances.' };
  if (!customers.length) return { title: receivableValue(overdue) === 0 && !overdue?.partial ? 'No overdue balances in this view' : 'Complete the missing balances to assess overdue exposure', detail: receivableValue(overdue) === 0 && !overdue?.partial ? 'Keep track of upcoming payments in the collection queue.' : 'Recorded invoice amounts remain visible; missing balances are excluded from subtotals.' };
  const top = customers.slice(0, 5);
  const total = receivableValue(overdue);
  const signed = recordedCustomers.some(row => row.value < 0);
  const share = total > 0 && !signed ? Math.min(100, top.reduce((sum, row) => sum + row.value, 0) / total * 100) : null;
  const percentage = share === null ? '' : `${share === 100 ? '100' : Math.min(99.9, Math.round(share * 10) / 10)}% of `;
  return {
    title: `${top.length} ${top.length === 1 ? 'customer drives' : 'customers drive'} ${percentage}${overdue?.partial ? 'recorded ' : ''}overdue exposure`,
    detail: `${top[0].customer} represents ${receivableMoney(top[0].value, data.currency)} and requires action.`,
  };
}

const csvCell = value => {
  const text = String(value ?? '');
  return `"${(/^[\s]*[=+\-@\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
};
export const workbookCurrencyLabel = row => row.currency === 'EUR' ? 'EUR (Euro)' : row.currency || ({ conflict: 'Currency needs review', error: 'Currency needs review', unrecognized: 'Currency needs review' }[row.currency_status] || 'Currency not recorded');
function workbookCsvRows(data) {
  const summary = data?.workbook_summary;
  if (!receivableReadable(data?.sources?.receivables) || summary?.status !== 'available') return [];
  return [
    ['Workbook summary', 'Entire source workbook; unaffected by dashboard customer, currency, period or ageing filters'],
    ['Workbook file', summary.source?.file_name], ['Workbook sheet', summary.source?.sheet],
    ['Workbook invoice rows', summary.invoice_count], ['Workbook snapshot', summary.source?.snapshot_at],
    ['Workbook basis', 'Numeric workbook subtotals; text amounts, blanks and error cells are excluded. Only column M is in AED.'],
    ['Workbook metric', 'Amount / count', 'Currency / basis'],
    ['Total amount - L', summary.totals?.invoice_amount, 'Original workbook currencies; no conversion'],
    ['Total amount in AED - M', summary.totals?.invoice_amount_aed, 'AED; recorded numeric subtotal'],
    ['Total amount received - AA', summary.totals?.actual_payment_received, 'Original workbook currencies; no conversion'],
    ['Total projects', summary.totals?.project_count, 'Distinct recorded RAD Project codes; N/A excluded'],
    ...(Array.isArray(summary.currency_breakdown) && summary.currency_breakdown.length ? [
      ['Workbook currency basis', 'Each amount uses its own cell currency label and Inv. CUR. Conflicting or missing labels remain separate; no conversion.'],
      ['Workbook currency', 'Invoice amount', 'Actual payment received'],
      ...summary.currency_breakdown.map(row => [workbookCurrencyLabel(row), row.invoice_amount, row.actual_payment_received]),
      ...(Object.values(summary.currency_rounding_adjustment || {}).some(value => Number.isFinite(Number(value)) && Number(value) !== 0) ? [['Currency rounding adjustment', summary.currency_rounding_adjustment.invoice_amount, summary.currency_rounding_adjustment.actual_payment_received]] : []),
    ] : []),
    ['Workbook payment status', 'Amount (AED)', 'Invoice rows', 'Missing or invalid amount cells'],
    ...(summary.payment_status || []).map(row => [row.label, row.amount_aed, row.count, row.amount_coverage ? ['blank_count', 'text_count', 'error_count'].reduce((sum, key) => sum + (financeCount(row.amount_coverage[key]) || 0), 0) : '']),
    ['Total workbook invoice rows', summary.totals?.invoice_amount_aed, summary.invoice_count],
    ...(Number.isFinite(Number(summary.payment_status_rounding_adjustment)) && Number(summary.payment_status_rounding_adjustment) !== 0 ? [['Payment status rounding adjustment (AED)', summary.payment_status_rounding_adjustment]] : []), [],
  ];
}
export function receivablesCsv(data) {
  const customers = receivableCustomerRows(data);
  const rows = [
    ['Accounts Receivable', data.currency], ['Ageing reference date', data.as_of_date],
    ['Reporting amount basis', receivableAmountBasis(data)],
    ...(data.sources?.receivables?.mode === 'workbook' ? [['Source workbook', data.sources.receivables.file_name], ['Source sheet', data.sources.receivables.sheet_name]] : []),
    ['Basis', 'Current recorded balances; not a historical balance sheet. Monthly charts group current balances by invoice or due month.'],
    ...RECEIVABLE_KPIS.map(([id, label]) => [`${label} formula`, data.definitions?.[id] || RECEIVABLE_DEFINITIONS[id]]),
    ['Customer / COMPANY', data.filters?.company || 'All customers'], [],
    ...workbookCsvRows(data),
    ['Metric', 'Recorded amount', 'Missing balances', 'Partial'],
    ...RECEIVABLE_KPIS.map(([id, label]) => [label, receivableRawValue(data.kpis?.[id]), data.kpis?.[id]?.missing_count, data.kpis?.[id]?.partial ? 'Yes' : 'No']), [],
    ['Customer', ...RECEIVABLE_AGES.map(([, label]) => label), 'Unknown due date', 'Amount due', 'Partial'],
    ...customers.map(row => [row.customer, ...RECEIVABLE_AGES.map(([id]) => row.bucket_display[id]), row.bucket_display.unknown_due_date, row.display_amount, row.partial ? 'Yes' : 'No']), [],
    ['Priority invoice', 'Customer', 'Due date', 'Days overdue', 'Amount due', 'Owner'],
    ...(data.priority_invoices || []).map(row => [row.invoice_number, receivableCustomer(row), row.due_date, row.days_overdue, row.balance, row.owner]),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
