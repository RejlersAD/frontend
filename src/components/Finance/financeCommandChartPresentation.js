export const FINANCE_TREND_SERIES = [
  { key: 'cash_actual', label: 'Cash actual', kind: 'bar' },
  { key: 'working_capital_actual', label: 'Working capital actual', kind: 'line' },
  { key: 'working_capital_plan', label: 'Working capital plan', kind: 'plan' },
];

export const FINANCE_AGE_BUCKETS = [
  { id: 'current', label: 'Current' },
  { id: 'days_1_30', label: '1–30 days' },
  { id: 'days_31_60', label: '31–60 days' },
  { id: 'days_61_90', label: '61–90 days' },
  { id: 'over90', label: 'Over 90 days' },
];

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
export const financeChartCurrency = value => text(value)?.toUpperCase() || 'UNSPECIFIED';

export function financeChartNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function financeChartMoney(value, currency, compact = false) {
  const numeric = financeChartNumber(value);
  if (numeric === null) return '—';
  const number = new Intl.NumberFormat('en-GB', compact
    ? { notation: 'compact', maximumFractionDigits: 1 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
  return `${financeChartCurrency(currency)} ${number}`;
}

const empty = (status, reason) => ({ status, reason, rows: [] });

export function prepareCashTrend(trend) {
  const status = trend?.status || 'unavailable';
  if (!['available', 'ready'].includes(status)) return empty(status, text(trend?.reason));
  if (!Array.isArray(trend.series) || !trend.series.length) return empty('unavailable', text(trend?.reason) || 'No monthly cash or working capital values are recorded.');
  const byMonth = new Map();
  for (const item of trend.series) {
    const match = text(item?.month)?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
    if (!match) return empty('incomplete', 'Monthly dates need to be completed before this trend can be shown.');
    const monthIndex = Number(match[1]) * 12 + Number(match[2]) - 1;
    if (byMonth.has(monthIndex)) return empty('incomplete', 'More than one value set is recorded for the same month.');
    byMonth.set(monthIndex, Object.fromEntries(FINANCE_TREND_SERIES.map(series => [series.key, financeChartNumber(item[series.key])])));
  }
  const finalMonth = Math.max(...byMonth.keys());
  const rows = Array.from({ length: 12 }, (_, index) => {
    const monthIndex = finalMonth - 11 + index;
    const month = `${String(Math.floor(monthIndex / 12)).padStart(4, '0')}-${String((monthIndex % 12) + 1).padStart(2, '0')}`;
    return { month, ...Object.fromEntries(FINANCE_TREND_SERIES.map(series => [series.key, byMonth.get(monthIndex)?.[series.key] ?? null])) };
  });
  if (!rows.some(row => FINANCE_TREND_SERIES.some(series => row[series.key] !== null))) return empty('unavailable', 'No monthly cash or working capital values are recorded in this period.');
  return { status: 'available', rows, periodStart: rows[0].month, periodEnd: rows.at(-1).month,
    hasGaps: rows.some(row => FINANCE_TREND_SERIES.some(series => row[series.key] === null)) };
}

export function financeLineSegments(rows, key) {
  const segments = [];
  let current = [];
  rows.forEach((row, index) => {
    const value = financeChartNumber(row[key]);
    if (value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push({ index, value });
  });
  if (current.length) segments.push(current);
  return segments;
}

export function prepareReceivablesAgeing(source, currency) {
  const status = source?.status || 'unavailable';
  if (['loading', 'error', 'restricted', 'unavailable'].includes(status)) return empty(status, text(source?.reason));
  if (!['available', 'incomplete', 'ready'].includes(status) || !Array.isArray(source?.by_currency)) return empty('unavailable', 'Receivables ageing has not been reported.');
  const currencyCode = financeChartCurrency(currency);
  const groups = source.by_currency.filter(group => financeChartCurrency(group?.currency) === currencyCode);
  if (!groups.length) {
    if (status !== 'incomplete' && source.by_currency.length === 0 && source.open_count === 0) return empty('empty', 'There are no open receivables in the available source.');
    return empty('unavailable', `No receivables ageing is reported for ${currencyCode}.`);
  }
  if (groups.length !== 1) return empty('incomplete', 'The selected currency has more than one ageing total.');
  if (currencyCode === 'UNSPECIFIED') return empty('incomplete', 'Currency is not recorded for these receivables, so their amounts cannot be combined.');
  const group = groups[0];
  if (group.status !== 'available' && group.status !== 'ready') return empty(group.status || 'incomplete', 'Complete receivable balances are not available for this currency.');
  const outstanding = financeChartNumber(group.outstanding);
  if (outstanding === null || outstanding < 0 || !Array.isArray(group.buckets)) return empty('incomplete', 'Complete receivable balances are not available for this currency.');
  const bucketMap = new Map();
  for (const bucket of group.buckets) {
    if (!bucket || bucketMap.has(bucket.id)) return empty('incomplete', 'Receivables ageing buckets need to be completed.');
    bucketMap.set(bucket.id, bucket);
  }
  const expected = [...FINANCE_AGE_BUCKETS];
  if (bucketMap.has('unknown_due_date')) expected.push({ id: 'unknown_due_date', label: 'Due date unknown' });
  const rows = [];
  for (const bucket of expected) {
    const reported = bucketMap.get(bucket.id);
    const amount = financeChartNumber(reported?.amount);
    if (amount === null || amount < 0) return empty('incomplete', 'One or more ageing balances are not reported for this currency.');
    const count = financeChartNumber(reported.count);
    rows.push({ ...bucket, amount, count: count !== null && count >= 0 && Number.isInteger(count) ? count : null,
      share: outstanding > 0 ? amount / outstanding * 100 : null });
  }
  if (Math.abs(rows.reduce((sum, row) => sum + row.amount, 0) - outstanding) > 0.01) return empty('incomplete', 'The ageing buckets do not reconcile to the reported outstanding balance.');
  const shown = rows.filter(row => row.id !== 'unknown_due_date' || row.amount > 0 || row.count > 0);
  return { status: 'available', rows: shown, outstanding, currency: currencyCode, partialSource: status === 'incomplete',
    unknownDueDate: shown.some(row => row.id === 'unknown_due_date') };
}
