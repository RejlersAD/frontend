export const REVENUE_REPORTED = new Set(['available', 'partial']);

export function revenueNumber(value) {
  const text = value == null ? '' : String(value).trim();
  if (!/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function plainDecimal(value) {
  const raw = String(value).trim();
  if (!/e/i.test(raw)) return raw;
  const [coefficient, exponent] = raw.toLowerCase().split('e');
  const negative = coefficient.startsWith('-');
  const [whole, fraction = ''] = coefficient.replace(/^-/, '').split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  const expanded = point <= 0 ? `0.${'0'.repeat(Math.min(400, -point))}${digits}` : point >= digits.length ? digits + '0'.repeat(Math.min(400, point - digits.length)) : `${digits.slice(0, point)}.${digits.slice(point)}`;
  return (negative ? '-' : '') + expanded;
}

// Use decimal strings for displayed finance figures; floating point is only used for chart geometry.
export function revenueDecimal(value) {
  if (revenueNumber(value) === null) return '—';
  const [whole, fraction = ''] = plainDecimal(value).split('.');
  const tail = fraction.replace(/0+$/, '');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (tail ? `.${tail}` : '');
}

export function revenueMoney(value) {
  if (revenueNumber(value) === null) return '—';
  const raw = plainDecimal(value);
  const negative = raw.startsWith('-');
  const [whole, fraction = ''] = raw.replace(/^-/, '').split('.');
  let cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (Number(fraction[2] || 0) >= 5) cents += 1n;
  const digits = cents.toString().padStart(3, '0');
  return `${negative && cents > 0n ? '-' : ''}${digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${digits.slice(-2)}`;
}

export function revenueCompact(value) {
  const number = revenueNumber(value);
  return number === null ? '—' : new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(number);
}

export function revenuePercent(value) {
  const number = revenueNumber(value);
  return number === null ? '—' : `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(number)}%`;
}

export function revenueMonth(value) {
  if (!value) return 'Not reported';
  const date = new Date(`${String(value).slice(0, 7)}-01T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? 'Not reported' : new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function revenueMetricNote(metric) {
  if (!metric) return 'Not reported';
  if (metric.status === 'restricted') return 'Access restricted';
  if (metric.status === 'error') return 'Source unavailable';
  if (metric.basis === 'mixed_comparison_periods') return 'Comparison dates differ; total withheld';
  if (metric.basis === 'unknown_comparison_period') return 'Comparison dates missing; total withheld';
  if (metric.status === 'partial' || metric.status === 'incomplete') {
    return `${Number(metric.missing_count) > 0 ? `${revenueDecimal(metric.missing_count)} missing values` : 'Partial coverage'}${metric.basis === 'cached_workbook_summary' ? ' · Workbook report total' : ''}`;
  }
  return REVENUE_REPORTED.has(metric.status) ? 'Reported in AED' : 'Not reported';
}

export function revenueIdentity(row) {
  return [row.project_code, row.subproject_code].filter(Boolean).join(' / ') || 'Project not identified';
}
