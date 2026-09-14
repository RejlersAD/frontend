export const INVOICE_QUEUES = [
  { id: 'all', label: 'All' },
  { id: 'review', label: 'Needs review' },
  { id: 'exceptions', label: 'Exceptions' },
  { id: 'unmatched', label: 'Unmatched' },
  { id: 'ready', label: 'Ready for approval' },
  { id: 'payment_ready', label: 'Payment ready' },
];

export const INVOICE_LABELS = {
  ocr_review: 'OCR review', ready_for_matching: 'Matching', procurement_review: 'PO review',
  finance_review: 'Finance review', approved_for_payment: 'Payment ready', rejected: 'Rejected', closed: 'Closed',
  unmatched: 'Unmatched', auto_matched: 'Auto matched', manual_matched: 'PO linked', exception: 'Exception', verified: 'Matched',
  not_scheduled: 'Not scheduled', scheduled: 'Scheduled', partial: 'Partially paid', paid: 'Paid', on_hold: 'On hold', cancelled: 'Cancelled',
};
export const INITIAL_INVOICE_FILTERS = { search: '', match: '', workflow: '', due: '', currency: '', vendor: '', payment: '' };
const REVIEW_STATES = ['ocr_review', 'ready_for_matching', 'procurement_review', 'finance_review'];
const DAY = 86400000;

export function invoiceTone(value) {
  if (['verified', 'approved_for_payment', 'paid', 'closed'].includes(value)) return 'green';
  if (['exception', 'rejected', 'on_hold', 'cancelled'].includes(value)) return 'red';
  if (['manual_matched', 'auto_matched', 'procurement_review', 'partial'].includes(value)) return 'amber';
  if (['ocr_review', 'ready_for_matching', 'finance_review', 'scheduled'].includes(value)) return 'blue';
  return 'neutral';
}

export function invoiceNumber(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function invoiceMoney(value, currency) {
  const number = invoiceNumber(value);
  if (number === null) return '—';
  const amount = number.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency || 'Currency not recorded'} ${amount}`;
}

function dayValue(value) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === text ? parsed : null;
}

function todayValue(now) {
  const date = new Date(now);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function invoiceDate(value) {
  const day = dayValue(value);
  return day === null ? '—' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(day);
}

export function isOpenPayable(invoice) {
  return !['paid', 'cancelled'].includes(invoice.payment_status)
    && !['closed', 'rejected'].includes(invoice.procurement_status);
}

export function invoiceOverdue(invoice, now = Date.now()) {
  const due = dayValue(invoice.due_date);
  return isOpenPayable(invoice) && due !== null && due < todayValue(now);
}

export function invoiceAge(invoice, now = Date.now()) {
  const received = dayValue(invoice.received_date) ?? dayValue(invoice.created_at);
  return received === null ? null : Math.max(0, Math.floor((todayValue(now) - received) / DAY));
}

export function inInvoiceQueue(invoice, queue) {
  switch (queue) {
    case 'review': return isOpenPayable(invoice) && REVIEW_STATES.includes(invoice.procurement_status);
    case 'exceptions': return invoice.match_status === 'exception' || ['rejected'].includes(invoice.procurement_status) || invoice.payment_status === 'on_hold';
    case 'unmatched': return isOpenPayable(invoice) && invoice.match_status === 'unmatched';
    case 'ready': return isOpenPayable(invoice) && invoice.payment_status !== 'on_hold' && invoice.procurement_status === 'finance_review' && invoice.match_status === 'verified' && invoice.manual_review_required === false;
    case 'payment_ready': return isOpenPayable(invoice) && invoice.procurement_status === 'approved_for_payment' && invoice.payment_status !== 'on_hold' && invoice.match_status !== 'exception';
    default: return true;
  }
}

export function invoiceRisk(invoice, now = Date.now()) {
  if (invoiceOverdue(invoice, now)) return { tone: 'red', label: 'Overdue' };
  if (inInvoiceQueue(invoice, 'exceptions')) return { tone: 'red', label: 'Exception' };
  if (inInvoiceQueue(invoice, 'review') || inInvoiceQueue(invoice, 'unmatched')) return { tone: 'amber', label: 'Review required' };
  if (['verified', 'approved_for_payment', 'paid'].some(value => [invoice.match_status, invoice.procurement_status, invoice.payment_status].includes(value))) return { tone: 'green', label: 'No recorded exception' };
  return { tone: 'neutral', label: 'Not assessed' };
}

export function invoiceMetrics(invoices, now = Date.now()) {
  return { ...Object.fromEntries(INVOICE_QUEUES.map(({ id }) => [id, invoices.filter(invoice => inInvoiceQueue(invoice, id)).length])),
    overdue: invoices.filter(invoice => invoiceOverdue(invoice, now)).length };
}

export function filterInvoices(invoices, filters = INITIAL_INVOICE_FILTERS, queue = 'all', now = Date.now()) {
  const query = (filters.search || '').trim().toLowerCase();
  return invoices.filter(invoice => {
    if (!inInvoiceQueue(invoice, queue)) return false;
    if (query && ![invoice.invoice_number, invoice.vendor_name, invoice.vendor_master_name, invoice.po_reference_text, invoice.tracking_id].some(value => String(value || '').toLowerCase().includes(query))) return false;
    if (filters.match && invoice.match_status !== filters.match) return false;
    if (filters.workflow && invoice.procurement_status !== filters.workflow) return false;
    if (filters.currency && invoice.currency !== filters.currency) return false;
    if (filters.vendor && (invoice.vendor_master_name || invoice.vendor_name) !== filters.vendor) return false;
    if (filters.payment && invoice.payment_status !== filters.payment) return false;
    const due = dayValue(invoice.due_date);
    if (filters.due === 'overdue') return invoiceOverdue(invoice, now);
    if (filters.due === 'today') return isOpenPayable(invoice) && due === todayValue(now);
    if (filters.due === 'week') return isOpenPayable(invoice) && due !== null && due >= todayValue(now) && due <= todayValue(now) + 7 * DAY;
    if (filters.due === 'not_set') return due === null;
    return true;
  });
}

export function sortInvoices(invoices, key, direction = 'asc') {
  if (!key) return invoices;
  return [...invoices].sort((left, right) => {
    const a = key === 'total_amount' ? invoiceNumber(left[key]) : key === 'vendor_master_name' ? left.vendor_master_name || left.vendor_name : left[key];
    const b = key === 'total_amount' ? invoiceNumber(right[key]) : key === 'vendor_master_name' ? right.vendor_master_name || right.vendor_name : right[key];
    if (a === null || a === undefined || a === '') return b == null || b === '' ? 0 : 1;
    if (b === null || b === undefined || b === '') return -1;
    const comparison = typeof a === 'number' ? a - b : String(a).localeCompare(String(b), 'en', { numeric: true });
    return comparison * (direction === 'desc' ? -1 : 1);
  });
}

// Always request the same authenticated endpoint; never follow arbitrary next URLs.
export async function loadInvoiceRegister(fetchPage) {
  const rows = new Map();
  for (let page = 1; page <= 1000; page += 1) {
    const data = await fetchPage({ page, page_size: 500 });
    const result = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(result)) throw new Error('The invoice register returned an unexpected response. Please refresh.');
    const previousCount = rows.size;
    result.forEach(invoice => { if (invoice?.id != null) rows.set(String(invoice.id), invoice); });
    if (Array.isArray(data)) return [...rows.values()];
    if (!data.next) {
      const total = invoiceNumber(data.count);
      if (total !== null && total !== rows.size) throw new Error('The invoice register changed or returned incomplete records. Please refresh.');
      return [...rows.values()];
    }
    if (rows.size === previousCount) throw new Error('The invoice register could not finish loading. Please refresh.');
  }
  throw new Error('The invoice register is too large to load. Contact your finance administrator.');
}

export function invoicesCsv(invoices) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const headings = ['Invoice', 'Tracking ID', 'Supplier', 'PO reference', 'Invoice date', 'Due date', 'Currency', 'Total', 'Matching', 'Workflow', 'Payment'];
  return '\uFEFF' + [headings, ...invoices.map(invoice => [invoice.invoice_number, invoice.tracking_id, invoice.vendor_master_name || invoice.vendor_name,
    invoice.po_reference_text, invoice.invoice_date, invoice.due_date, invoice.currency, invoice.total_amount,
    INVOICE_LABELS[invoice.match_status] || invoice.match_status, INVOICE_LABELS[invoice.procurement_status] || invoice.procurement_status,
    INVOICE_LABELS[invoice.payment_status] || invoice.payment_status])].map(row => row.map(cell).join(',')).join('\r\n');
}
