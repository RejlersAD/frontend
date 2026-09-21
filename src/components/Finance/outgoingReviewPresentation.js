const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const STATUS_LABELS = { pending: 'Pending', paid: 'Paid', partial: 'Partially paid', overdue: 'Overdue', cancelled: 'Cancelled', credit_note: 'Credit note' };

export const outgoingReviewStatus = value => Object.prototype.hasOwnProperty.call(STATUS_LABELS, value) ? STATUS_LABELS[value] : text(value)?.replaceAll('_', ' ') || 'Not recorded';
export const outgoingReviewTone = value => value === 'paid' ? 'success' : value === 'overdue' ? 'danger' : value === 'partial' ? 'warning' : value === 'pending' ? 'pending' : 'neutral';
export const outgoingReviewCurrency = value => /^[A-Z]{3}$/.test(text(value)?.toUpperCase() || '') ? text(value).toUpperCase() : null;
// An explicitly unknown calculated balance must not fall back to an imported balance.
export const outgoingReviewBalance = invoice => Object.prototype.hasOwnProperty.call(invoice || {}, 'calculated_receivable_balance') ? invoice.calculated_receivable_balance : invoice?.balance_to_be_received;

export function outgoingReviewNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function outgoingReviewMoney(value, currency) {
  const unit = outgoingReviewCurrency(currency);
  if (!unit || outgoingReviewNumber(value) === null) return '—';
  const decimal = String(value).trim().replace(/^([+-]?)\./, '$10.');
  const parts = decimal.match(/^([+-]?)(\d+)(?:\.(\d*))?$/);
  if (!parts) return '—';
  const fraction = (parts[3] || '').padEnd(3, '0');
  let cents = BigInt(parts[2]) * 100n + BigInt(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1n;
  const sign = parts[1] === '-' && cents > 0n ? '-' : '';
  return `${unit} ${sign}${(cents / 100n).toLocaleString('en-GB')}.${String(cents % 100n).padStart(2, '0')}`;
}

export function outgoingReviewDateValue(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (dateOnly && (date.getFullYear() !== Number(dateOnly[1]) || date.getMonth() !== Number(dateOnly[2]) - 1 || date.getDate() !== Number(dateOnly[3]))) return null;
  return date;
}

export function outgoingReviewDate(value, withTime = false) {
  const date = outgoingReviewDateValue(value);
  if (!date) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime && value.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(date);
}

export function outgoingReviewTotal(invoice) {
  if (Object.prototype.hasOwnProperty.call(invoice || {}, 'calculated_receivable_balance')) return { label: 'Invoice amount', value: invoice.invoice_amount ?? null };
  if (outgoingReviewNumber(invoice?.grand_total) !== null) return { label: 'Invoice total', value: invoice.grand_total };
  return { label: 'Invoice amount', value: invoice?.invoice_amount ?? null };
}

export function outgoingReviewTimeline(invoice) {
  return [
    { id: 'invoice-date', label: 'Invoice date', date: invoice?.invoice_date },
    { id: 'sent-date', label: 'Invoice sent', date: invoice?.invoice_sent_date },
    { id: 'payment-date', label: 'Recorded payment date', date: invoice?.payment_date },
  ].filter(entry => outgoingReviewDateValue(entry.date))
    .sort((left, right) => outgoingReviewDateValue(left.date) - outgoingReviewDateValue(right.date));
}

export function outgoingReviewSuggestion(invoice, now = new Date()) {
  const balance = outgoingReviewNumber(outgoingReviewBalance(invoice));
  if (!outgoingReviewCurrency(invoice?.currency) || balance === null) return { title: 'Complete the invoice record', detail: 'Check the currency and recorded balance before planning collection.' };
  if (['cancelled', 'credit_note'].includes(invoice?.payment_status)) return { title: 'Review the adjustment', detail: 'Check the recorded cancellation or credit note and supporting documents.' };
  if (invoice?.payment_status === 'paid' && balance > 0) return { title: 'Review the settlement details', detail: 'The recorded paid status and remaining balance need to be reconciled.' };
  if (balance <= 0) return { title: 'Review closure details', detail: 'Check the recorded payment details and supporting documents.' };
  const due = outgoingReviewDateValue(invoice?.due_date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (due && due < today) return { title: 'Review the overdue balance', detail: 'Confirm the outstanding amount and collection next steps with the finance / project contact.' };
  if (!outgoingReviewDateValue(invoice?.invoice_sent_date)) return { title: 'Confirm invoice delivery', detail: 'Check whether the customer has received this invoice.' };
  return { title: 'Review collection timing', detail: due ? 'Confirm the next steps against the recorded due date.' : 'Confirm the due date before planning the next collection step.' };
}

export function outgoingReviewAttachmentUrl(attachment) {
  for (const value of [attachment?.file_url, attachment?.file]) {
    const candidate = text(value);
    if (!candidate || [...candidate].some(character => character === '\\' || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) continue;
    if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
    try {
      const parsed = new URL(candidate);
      if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) return candidate;
    } catch { /* A missing or invalid storage link remains unavailable. */ }
  }
  return null;
}

export function outgoingReviewEmail(value, invoiceNumber) {
  const email = text(value);
  if (!email || !/^[A-Za-z0-9.!$%&'*+\-/=_`{|}~]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(email)) return null;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Invoice ${text(invoiceNumber) || 'review'}`)}`;
}
