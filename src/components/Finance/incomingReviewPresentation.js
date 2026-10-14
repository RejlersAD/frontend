const presentText = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const records = value => Array.isArray(value) ? value.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];

const STATUS_LABELS = {
  ocr_review: 'OCR review', ready_for_matching: 'Ready for matching', procurement_review: 'Procurement review',
  finance_review: 'Finance review', approved_for_payment: 'Approved for payment', rejected: 'Rejected', closed: 'Closed',
  unmatched: 'Unmatched', auto_matched: 'Automatically matched', manual_matched: 'Manually matched', exception: 'Matching exception',
  verified: 'Verified', not_scheduled: 'Not scheduled', scheduled: 'Scheduled', partial: 'Partially paid', paid: 'Paid',
  on_hold: 'On hold', cancelled: 'Cancelled',
};
export const incomingStatusLabel = value => Object.prototype.hasOwnProperty.call(STATUS_LABELS, value) ? STATUS_LABELS[value]
  : presentText(value)?.replaceAll('_', ' ') || 'Not recorded';

export const incomingStatusTone = value => ['verified', 'approved_for_payment', 'paid', 'closed'].includes(value) ? 'success'
  : ['exception', 'rejected', 'on_hold'].includes(value) ? 'warning'
    : ['procurement_review', 'finance_review', 'partial', 'scheduled'].includes(value) ? 'pending' : 'neutral';

export function incomingNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function incomingMoney(value, currency) {
  const number = incomingNumber(value);
  if (number === null) return '—';
  return `${presentText(currency)?.toUpperCase() || 'Unspecified'} ${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number)}`;
}

export function incomingOutstanding(invoice) {
  const total = incomingNumber(invoice?.total_amount);
  const paid = incomingNumber(invoice?.paid_amount);
  return total === null || paid === null ? null : Math.max(0, Math.round((total - paid) * 100) / 100);
}

const timestamp = value => typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

export function incomingDate(value, withTime = false) {
  const parsed = timestamp(value);
  if (parsed === null) return 'Not recorded';
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12) : new Date(parsed);
  if (dateOnly && (date.getFullYear() !== Number(dateOnly[1]) || date.getMonth() !== Number(dateOnly[2]) - 1 || date.getDate() !== Number(dateOnly[3]))) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime && !dateOnly ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date);
}

export const incomingAllocationEvaluated = allocation => [allocation?.match_evidence?.evaluated_at, allocation?.matched_at, allocation?.verified_at]
  .some(value => timestamp(value) !== null);

const checkState = (allocations, fields, needsLineEvidence = false) => {
  const evaluated = allocations.filter(allocation => incomingAllocationEvaluated(allocation)
    && (!needsLineEvidence || records(allocation.match_evidence?.line_checks).length > 0));
  if (evaluated.some(allocation => fields.some(field => allocation[field] === false))) return { status: 'Exception', tone: 'warning' };
  if (allocations.length && evaluated.length === allocations.length && evaluated.every(allocation => fields.every(field => allocation[field] === true))) {
    return { status: 'Checked', tone: 'success' };
  }
  return { status: 'Not checked', tone: 'neutral' };
};

export function incomingMatching(invoice) {
  const allocations = records(invoice?.po_allocations);
  const references = [...new Set(allocations.map(allocation => presentText(allocation.purchase_order_number)).filter(Boolean))];
  const receipts = [...new Set(allocations.flatMap(allocation => Array.isArray(allocation.receipt_numbers) ? allocation.receipt_numbers : [])
    .map(presentText).filter(Boolean))];
  const po = checkState(allocations, ['vendor_matched', 'currency_matched', 'amount_within_tolerance']);
  const required = allocations.filter(allocation => allocation.receipt_required !== false);
  let receipt = checkState(required, ['receipt_quantities_matched'], true);
  if (allocations.length && !required.length) receipt = { status: 'Not required', tone: 'neutral' };
  else if (allocations.some(allocation => incomingAllocationEvaluated(allocation)
    && Array.isArray(allocation.exception_codes) && allocation.exception_codes.some(code => ['missing_accepted_receipt', 'invoice_quantity_exceeds_receipt'].includes(code)))) {
    receipt = { status: 'Exception', tone: 'warning' };
  } else if (receipt.tone === 'success' && !receipts.length) receipt = { status: 'Not checked', tone: 'neutral' };
  const lineCount = Array.isArray(invoice?.structured_line_items) ? invoice.structured_line_items.length : null;
  return {
    allocations,
    rows: [
      { id: 'purchase-order', label: 'Purchase order', ...po,
        detail: references.length ? references.join(', ') : allocations.length ? `${allocations.length} recorded allocation(s)`
          : Array.isArray(invoice?.po_allocations) ? 'No confirmed PO allocation' : 'PO allocation evidence not recorded' },
      { id: 'receipt', label: 'Goods / service receipt', ...receipt,
        detail: receipts.length ? receipts.join(', ') : 'No receipt reference recorded' },
      { id: 'invoice', label: 'Invoice line check', ...checkState(allocations, ['line_items_matched'], true),
        detail: lineCount === null ? 'Invoice lines not recorded' : `${lineCount} structured invoice ${lineCount === 1 ? 'line' : 'lines'}` },
    ],
  };
}

export function incomingActivity(invoice) {
  return records(invoice?.audit_logs).map((log, index) => ({
    id: log.id ?? `entry-${index}`,
    title: presentText(log.description) || incomingStatusLabel(log.action),
    timestamp: log.timestamp,
  })).sort((left, right) => (timestamp(right.timestamp) ?? -Infinity) - (timestamp(left.timestamp) ?? -Infinity));
}

export function incomingCanResolveMatch(invoice) {
  return records(invoice?.po_allocations).length > 0
    && !['closed', 'rejected'].includes(invoice?.procurement_status)
    && !['paid', 'cancelled'].includes(invoice?.payment_status)
    && ['unmatched', 'exception', 'manual_matched', 'auto_matched'].includes(invoice?.match_status);
}
