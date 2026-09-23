import { internalRoute } from './executivePresentation';
import { revenueNumber } from './portfolioRevenuePresentation';

export const RECORDED_INVOICE_STATUSES = new Set(['available', 'partial', 'incomplete']);
export const INVOICE_TOTALS = [['invoice_amount', 'Recorded invoiced'], ['actual_payment_received', 'Recorded receipts'], ['calculated_receivable_balance', 'Outstanding balance']];
export const recordedMetricValue = metric => RECORDED_INVOICE_STATUSES.has(metric?.status) ? metric.value ?? metric.known_value ?? null : null;
export const recordedMetricNote = metric => metric?.value == null && revenueNumber(metric?.known_value) !== null ? `Known subtotal${metric.missing_count ? ` · ${metric.missing_count} missing values` : ''}` : metric?.missing_count ? `${metric.missing_count} missing values` : recordedMetricValue(metric) === null ? 'Not reported' : 'Recorded source amount';
export const recordedCurrency = value => /^[A-Z]{3}$/.test(String(value || '')) ? value : 'Unspecified currency';
export function portfolioSourceRoute(value) {
  const route = internalRoute(value);
  if (!route) return null;
  const pathname = route.split(/[?#]/, 1)[0];
  return /^\/(?:projects|finance\/outgoing-invoices(?:\/[^/]+)?|procurement\/(?:projects(?:\/[^/]+)?|orders|requisitions)|sales\/(?:opportunities|project-handovers)|qhse(?:\/[^?]*)?)\/?$/.test(pathname) ? route : null;
}
