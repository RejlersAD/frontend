import { outgoingReviewMoney, outgoingReviewNumber } from './outgoingReviewPresentation.js';

export const OUTGOING_QUEUES = [
  ['open', 'All open'], ['overdue', 'Overdue'], ['due_soon', 'Due this week'],
  ['partial', 'Partially paid'], ['disputed', 'Disputed'], ['paid', 'Settled'],
];
export const OUTGOING_FILTERS = { search: '', company: '', pm: '', ageing: '', payment_status: '', currency: '', category: '', account: '', project: '', date_from: '', date_to: '' };
export const OUTGOING_AGES = [['current', 'Current'], ['days_1_30', '1–30 days overdue'], ['days_31_60', '31–60 days overdue'], ['days_61_90', '61–90 days overdue'], ['over90', 'Over 90 days overdue'], ['unknown_due_date', 'Due date missing']];
export const outgoingNumber = outgoingReviewNumber;
export const outgoingCurrency = value => /^[A-Z]{3}$/.test(String(value || '').trim().toUpperCase()) ? String(value).trim().toUpperCase() : null;
export const outgoingMoney = outgoingReviewMoney;
export function outgoingCollectionCurrency(summary, currency) {
  const health = summary?.collection_health;
  const recorded = health?.by_currency?.find(row => row.currency === currency);
  if (recorded) return recorded;
  if (!outgoingCurrency(currency) || !['available', 'incomplete'].includes(health?.status) || health.missing_currency_count !== 0 || !Array.isArray(health.by_currency)) return null;
  return { currency, status: 'available', outstanding: '0.00', overdue: '0.00', invoice_count: 0,
    buckets: OUTGOING_AGES.map(([id, label]) => ({ id, label, count: 0, amount: '0.00' })) };
}
export const outgoingDate = (value, time = false) => {
  if (!value) return '—';
  const date = new Date(time ? value : `${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-GB', time ? { dateStyle: 'medium', timeStyle: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};
export const outgoingToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
export function outgoingState(invoice, today = outgoingToday()) {
  const balance = outgoingNumber(invoice.balance_to_be_received);
  const status = invoice.payment_status;
  if (status === 'cancelled') return { label: 'Cancelled', tone: 'muted', age: 'Closed', next: 'View invoice' };
  if (status === 'credit_note') return { label: 'Credit note', tone: 'blue', age: 'Credit note', next: 'Review credit' };
  if (status === 'paid' && balance > 0) return { label: 'Check settlement', tone: 'amber', age: 'Check balance', next: 'Reconcile payment' };
  if (status === 'paid' || (balance === 0 && outgoingNumber(invoice.grand_total) > 0)) return { label: 'Settled', tone: 'green', age: 'Settled', next: 'View payment details' };
  if (balance === 0) return { label: 'Zero balance', tone: 'muted', age: 'Check settlement', next: 'Confirm settlement' };
  if (balance !== null && balance < 0) return { label: 'Credit balance', tone: 'blue', age: 'Credit balance', next: 'Review balance' };
  const due = invoice.due_date ? new Date(`${String(invoice.due_date).slice(0, 10)}T00:00:00Z`).getTime() : NaN;
  const now = new Date(`${today}T00:00:00Z`).getTime();
  const days = Number.isFinite(due) && Number.isFinite(now) ? Math.floor((now - due) / 86400000) : null;
  if (balance === null) return { label: 'Balance missing', tone: 'amber', age: days > 0 ? `${days}d past due` : 'Check balance', next: 'Confirm balance' };
  if (days > 0 && balance > 0) return { label: 'Overdue', tone: 'red', age: `${days}d overdue`, next: 'Review overdue balance' };
  if (status === 'partial' || outgoingNumber(invoice.actual_payment_received) > 0) return { label: 'Partially paid', tone: 'amber', age: days === null ? 'No due date' : days === 0 ? 'Due today' : `Due in ${-days}d`, next: 'Review remaining balance' };
  return { label: 'Pending', tone: 'blue', age: days === null ? 'No due date' : days === 0 ? 'Due today' : `Due in ${-days}d`, next: days === null ? 'Confirm due date' : 'Review invoice' };
}
const csvCell = value => {
  const raw = String(value ?? ''); const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
export function outgoingCsv(rows, today) {
  const data = [['Invoice', 'Customer', 'Company', 'Project', 'Invoice date', 'Due date', 'Currency', 'Outstanding', 'Payment status', 'Collection status', 'Project manager', 'Suggested next action'], ...rows.map(row => {
    const state = outgoingState(row, today);
    return [row.invoice_number, row.account, row.company, row.project_name || row.rad_project_no || row.project_id, row.invoice_date, row.due_date, outgoingCurrency(row.currency), outgoingNumber(row.balance_to_be_received) === null ? '' : row.balance_to_be_received, row.payment_status, state.label, row.pm, state.next];
  })];
  return '\uFEFF' + data.map(row => row.map(csvCell).join(',')).join('\r\n');
}
// Fetch each page from the same authorized endpoint; never follow server-supplied URLs.
export async function loadOutgoingExport(list, filters) {
  const rows = []; const ids = new Set(); let expected = null;
  for (let page = 1; page <= 10000; page += 1) {
    const data = await list({ ...filters, page, page_size: 200 });
    if (!Array.isArray(data?.results) || !Number.isInteger(data.count) || data.count < 0) throw new Error('The invoice export returned an invalid register.');
    if (expected === null) expected = data.count;
    if (data.count !== expected) throw new Error('The register changed during export. Refresh and try again.');
    for (const row of data.results) {
      if (row.id == null || ids.has(String(row.id))) throw new Error('The invoice export returned duplicate records. Refresh and try again.');
      ids.add(String(row.id)); rows.push(row);
    }
    if (rows.length === expected) return rows;
    if (!data.next || !data.results.length || rows.length > expected) throw new Error('The complete invoice register could not be exported.');
  }
  throw new Error('The invoice export exceeded the supported register size.');
}
