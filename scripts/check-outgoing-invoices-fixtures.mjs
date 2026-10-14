// Synthetic receivables only. Decimal strings keep original currencies and missing values explicit.
export const OUTGOING_CHECK_TIME = '2026-09-14T09:00:00.000Z';
export const outgoingUser = { id: 7001, first_name: 'Alex', last_name: 'Morgan', email: 'alex.morgan@example.test', is_superuser: true, is_staff: true, roles: [{ code: 'super_admin', name: 'Super Administrator' }] };
const statuses = ['pending', 'overdue', 'partial', 'paid', 'pending', 'cancelled', 'credit_note'];
const statusLabels = { pending: 'Pending', overdue: 'Overdue', partial: 'Partially Paid', paid: 'Paid', cancelled: 'Cancelled', credit_note: 'Credit Note' };
const customers = ['Northshore Energy', 'Atlas Infrastructure', 'Gulf Water Services', 'Orion Engineering', 'Rejlers Group'];

export function outgoingRows() {
  return Array.from({ length: 16 }, (_, index) => {
    const id = 201 + index, payment_status = statuses[index % statuses.length], currency = ['AED', 'USD', 'AED', 'EUR'][index % 4];
    const total = 105000 + index * 5250, settled = ['paid', 'cancelled', 'credit_note'].includes(payment_status), paid = payment_status === 'paid' ? total : payment_status === 'partial' ? 21000 : 0;
    const dueDate = index === 4 ? null : !settled && index !== 15 ? ['2026-06-01', '2026-08-20', '2026-07-20', '2026-08-31'][index % 4] : '2026-09-18';
    return {
      id, invoice_number: `AR-SYN-${id}`, category: index % 5 === 4 ? 'internal' : 'external', category_label: index % 5 === 4 ? 'Internal (Rejlers Group)' : 'External (Customer)',
      account: customers[index % customers.length], company: index % 5 === 4 ? 'Rejlers Finland' : '', rad_project_no: `RAD-26-${301 + index}`, project_id: `PROJECT-${301 + index}`, project_name: ['Water treatment upgrade', 'Industrial power distribution', 'Pipeline integrity study', 'Transport design package'][index % 4],
      invoice_date: `2026-09-${String(14 - index % 12).padStart(2, '0')}`, invoice_sent_date: index % 4 ? '2026-09-05' : null,
      due_date: dueDate, payment_date: payment_status === 'paid' ? '2026-09-10' : null, payment_terms: '30 days',
      currency, ppc_value: String(total / 1.05), retention: '0.00', invoice_amount: String(total / 1.05), invoice_amount_aed: null, amount_excl_vat: String(total / 1.05), grand_total: `${total}.00`, balance_to_be_received: `${settled ? 0 : total - paid}.00`, actual_payment_received: `${paid}.00`, paid_amount_excl_vat: null,
      payment_status, payment_status_label: statusLabels[payment_status], days_overdue: dueDate && dueDate < '2026-09-14' && !settled ? Math.round((Date.parse('2026-09-14') - Date.parse(dueDate)) / 86400000) : null,
      bank_reference_code: payment_status === 'paid' ? `BANK-SYN-${id}` : '', customer_inv_reference: `CLIENT-REF-${id}`, credit_note_ref: payment_status === 'credit_note' ? `CN-SYN-${id}` : '', contract_clause: 'Clause 12.2', finance_pm_email: 'finance.owner@example.test', pm: ['Jordan Lee', 'Sam Taylor', 'Avery Chen'][index % 3],
      details: 'Verified synthetic design services milestone for isolated browser checks.', remarks: index === 1 ? 'Customer asked for supporting delivery evidence.' : '', sent_by: '', sent_to_account: '',
      created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-14T06:00:00Z', created_by: 7001,
      attachments_count: index === 0 ? 1 : 0, attachments: index === 0 ? [{ id: 801, original_filename: 'AR-SYN-201.pdf', content_type: 'application/pdf', size_bytes: 2048, uploaded_at: '2026-09-02T08:00:00Z', uploaded_by_email: 'alex.morgan@example.test', file_url: null, file: null }] : [],
    };
  });
}

export function outgoingFixture(variant = 'full') {
  const rows = outgoingRows();
  if (variant === 'empty') return { rows: [] };
  if (variant === 'zero') return { rows: [{ ...rows[0], grand_total: '0.00', invoice_amount: '0.00', amount_excl_vat: '0.00', balance_to_be_received: '0.00', actual_payment_received: '0.00', payment_status: 'paid', payment_status_label: 'Paid' }] };
  if (variant === 'missing') return { rows: [{ ...rows[0], currency: '', grand_total: null, invoice_amount: null, amount_excl_vat: null, balance_to_be_received: null, actual_payment_received: null, due_date: null, invoice_sent_date: null, pm: '', attachments: [], attachments_count: 0 }] };
  if (variant === 'missing_currency') return { rows: [{ ...rows[0], currency: '' }] };
  if (variant === 'settled_currency') return { rows: rows.map(row => row.currency === 'EUR' ? { ...row, payment_status: 'paid', payment_status_label: 'Paid', balance_to_be_received: '0.00' } : row.id === 202 ? { ...row, balance_to_be_received: null } : row) };
  if (variant === 'zero_unknown_total') return { rows: [{ ...rows[0], grand_total: null, balance_to_be_received: '0.00' }] };
  if (variant === 'readonly') return { rows, capabilities: { create: false, import: false, export: false } };
  if (variant === 'export_denied') return { rows, capabilities: { create: true, import: true, export: false } };
  if (variant === 'capabilities_missing') return { rows, capabilities: null };
  if (variant === 'error' || variant === 'forbidden') return { rows: [], failure: variant === 'forbidden' ? 403 : 503 };
  return { rows };
}

export function filterOutgoingRows(rows, params) {
  const value = key => params.get(key) || '';
  let filtered = rows.filter(row => {
    if (value('category') && row.category !== value('category')) return false;
    if (value('payment_status') && row.payment_status !== value('payment_status')) return false;
    if (value('currency') && row.currency !== value('currency')) return false;
    if (value('company') && row.company !== value('company')) return false;
    if (value('pm') && row.pm !== value('pm')) return false;
    if (value('queue') && value('queue') !== 'all' && !inOutgoingQueue(row, value('queue'))) return false;
    if (value('ageing') && (!inOutgoingQueue(row, 'open') || outgoingAge(row) !== value('ageing'))) return false;
    if (value('due_from') && (!row.due_date || row.due_date < value('due_from'))) return false;
    if (value('due_to') && (!row.due_date || row.due_date > value('due_to'))) return false;
    if (value('account') && !row.account.toLowerCase().includes(value('account').toLowerCase())) return false;
    if (value('project') && ![row.rad_project_no, row.project_name, row.project_id].join(' ').toLowerCase().includes(value('project').toLowerCase())) return false;
    if (value('project_exact') && String(row.rad_project_no || '').trim().toUpperCase() !== value('project_exact').trim().toUpperCase()) return false;
    if (value('search') && ![row.invoice_number, row.account, row.company, row.rad_project_no, row.project_name, row.project_id, row.customer_inv_reference, row.bank_reference_code, row.pm, row.finance_pm_email].join(' ').toLowerCase().includes(value('search').toLowerCase())) return false;
    if (value('date_from') && row.invoice_date < value('date_from')) return false;
    if (value('date_to') && row.invoice_date > value('date_to')) return false;
    return true;
  });
  const order = value('ordering') || '-invoice_date,-id';
  const fields = order.split(',');
  filtered = filtered.toSorted((left, right) => {
    for (const item of fields) { const descending = item.startsWith('-'), field = item.replace(/^-/, ''); let difference = String(left[field] ?? '').localeCompare(String(right[field] ?? ''), 'en', { numeric: true }); if (difference) return descending ? -difference : difference; }
    return 0;
  });
  return filtered;
}

const amount = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const today = '2026-09-14';
export function inOutgoingQueue(row, queue) {
  const balance = amount(row.balance_to_be_received), inactive = ['paid', 'cancelled', 'credit_note'].includes(row.payment_status);
  const open = !inactive && (balance === null || balance > 0);
  return ({ all: true, open, overdue: open && Boolean(row.due_date) && row.due_date < today, due_soon: open && Boolean(row.due_date) && row.due_date >= today && row.due_date <= '2026-09-20', partial: open && (row.payment_status === 'partial' || amount(row.actual_payment_received) > 0), paid: !['cancelled', 'credit_note'].includes(row.payment_status) && (row.payment_status === 'paid' || (balance === 0 && amount(row.grand_total) > 0)) })[queue] ?? false;
}
function outgoingAge(row) {
  if (!row.due_date) return 'unknown_due_date';
  const days = (Date.parse(today) - Date.parse(row.due_date)) / 86400000;
  return days <= 0 ? 'current' : days <= 30 ? 'days_1_30' : days <= 60 ? 'days_31_60' : days <= 90 ? 'days_61_90' : 'over90';
}
export function outgoingSummary(rows, params = new URLSearchParams()) {
  const baseParams = new URLSearchParams(params); baseParams.delete('queue'); baseParams.delete('page'); baseParams.delete('page_size');
  const scope = filterOutgoingRows(rows, baseParams), open = scope.filter(row => inOutgoingQueue(row, 'open'));
  const currencies = [...new Set(scope.map(row => row.currency || 'UNSPECIFIED'))].sort();
  const buckets = [{ id: 'current', label: 'Current' }, { id: 'days_1_30', label: '1–30 days' }, { id: 'days_31_60', label: '31–60 days' }, { id: 'days_61_90', label: '61–90 days' }, { id: 'over90', label: 'Over 90 days' }, { id: 'unknown_due_date', label: 'Due date unknown' }];
  const by_currency = [...new Set(open.map(row => row.currency || 'UNSPECIFIED'))].sort().map(currency => {
    const selected = open.filter(row => (row.currency || 'UNSPECIFIED') === currency), missing = selected.filter(row => amount(row.balance_to_be_received) === null).length, missingCurrency = currency === 'UNSPECIFIED' ? selected.length : 0, incomplete = missing > 0 || missingCurrency > 0;
    const sum = chosen => incomplete ? null : chosen.reduce((total, row) => total + amount(row.balance_to_be_received), 0).toFixed(2);
    return { currency, status: incomplete ? 'incomplete' : 'available', outstanding: sum(selected), overdue: sum(selected.filter(row => inOutgoingQueue(row, 'overdue'))), due_30d: sum(selected.filter(row => row.due_date >= today && row.due_date <= '2026-10-14')), invoice_count: selected.length, overdue_count: selected.filter(row => inOutgoingQueue(row, 'overdue')).length, partial_count: selected.filter(row => inOutgoingQueue(row, 'partial')).length, missing_balance_count: missing, missing_currency_count: missingCurrency, unknown_due_date_count: selected.filter(row => !row.due_date).length, oldest_due_date: selected.map(row => row.due_date).filter(Boolean).sort()[0] || null, buckets: buckets.map(bucket => { const matching = selected.filter(row => outgoingAge(row) === bucket.id); return { ...bucket, amount: sum(matching), count: matching.length }; }) };
  });
  const missing = open.filter(row => amount(row.balance_to_be_received) === null).length, missingCurrency = open.filter(row => !row.currency).length;
  const options = key => [...new Set(scope.map(row => row[key]).filter(Boolean))].sort().map(value => ({ value, count: scope.filter(row => row[key] === value).length }));
  const companies = options('company'), projectManagers = options('pm');
  return { schema_version: '1.0', capabilities: { create: true, import: true, export: true }, generated_at: OUTGOING_CHECK_TIME, source_updated_at: scope.length ? OUTGOING_CHECK_TIME : null, source_timestamp_kind: 'record_updated_at', as_of_date: today, due_soon_through: '2026-09-20', selected_queue: params.get('queue') || 'all', filtered_count: filterOutgoingRows(rows, params).length, counts: Object.fromEntries(['all', 'open', 'overdue', 'due_soon', 'partial', 'paid'].map(queue => [queue, scope.filter(row => inOutgoingQueue(row, queue)).length])), currencies,
    collection_health: { status: missing || missingCurrency ? 'incomplete' : 'available', source: 'Customer invoice register', route: '/finance/outgoing-invoices', reason: null, invoice_count: scope.length, open_count: open.length, overdue_count: open.filter(row => inOutgoingQueue(row, 'overdue')).length, over60_count: open.filter(row => ['days_61_90', 'over90'].includes(outgoingAge(row))).length, missing_balance_count: missing, missing_currency_count: missingCurrency, unknown_due_date_count: open.filter(row => !row.due_date).length, oldest_due_date: open.map(row => row.due_date).filter(Boolean).sort()[0] || null, source_updated_at: OUTGOING_CHECK_TIME, source_timestamp_kind: 'record_updated_at', balance_coverage: { known_count: open.length - missing, total_count: open.length, percentage: open.length ? (open.length - missing) / open.length * 100 : null, definition: 'Unsettled invoice records with a known recorded balance.' }, by_currency },
    filter_options: { companies, project_managers: projectManagers, companies_count: companies.length, project_managers_count: projectManagers.length, truncated: { companies: false, project_managers: false } },
    unavailable_metrics: ['dso', 'promises', 'disputes', 'contacted'].map(id => ({ id, value: null, status: 'unavailable', reason: 'This measure is not connected to the invoice register.' })), scope: { label: 'Authorized outgoing invoices', currency_conversion_applied: false } };
}
