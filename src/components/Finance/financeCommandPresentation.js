export const financeNumber = value => {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const financeCount = value => {
  const number = financeNumber(value);
  return number !== null && Number.isInteger(number) && number >= 0 ? number : null;
};

export function financeMoney(value, currency, compact = false) {
  const number = financeNumber(value);
  if (number === null) return '—';
  const code = currency === 'UNSPECIFIED' || !currency ? 'Unspecified' : currency;
  if (compact && Math.abs(number) >= 1000000) return `${code} ${(number / 1000000).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (compact && Math.abs(number) >= 1000) return `${code} ${(number / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })}K`;
  return `${code} ${number.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function financeDate(value, withTime = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value));
}

export const financeRoute = route => ['/finance/incoming-invoices', '/finance/outgoing-invoices'].includes(route) ? route : null;
export const sourceReadable = source => ['available', 'incomplete'].includes(source?.status) && Array.isArray(source?.by_currency);
export function financeTrend(data, currency) {
  const trend = data?.trends;
  if (!trend || !['available', 'ready'].includes(trend.status)) return trend || { status: 'unavailable', series: [] };
  const scoped = trend.by_currency?.find(row => row.currency === currency);
  if (scoped) return scoped;
  if (trend.currency === currency && currency && currency !== 'UNSPECIFIED') return trend;
  return { status: 'unavailable', series: [], reason: 'Trend values are not recorded for the selected original currency.' };
}
export function currencyBalance(source, currency) {
  if (!sourceReadable(source)) return { status: source?.status || 'unavailable', outstanding: null, overdue: null, invoice_count: null, buckets: [] };
  if (!currency) return { status: 'unavailable', outstanding: null, overdue: null, invoice_count: source.open_count === 0 ? 0 : null, buckets: [] };
  const row = source.by_currency.find(item => item.currency === currency);
  if (!row && source.missing_currency_count > 0) return { status: 'incomplete', missing_currency_count: source.missing_currency_count, outstanding: null, overdue: null, invoice_count: null, buckets: [] };
  if (!row) return { status: 'available', outstanding: 0, overdue: 0, invoice_count: 0, buckets: [], oldest_due_date: null };
  return row.status === 'available' ? row : { ...row, outstanding: null, overdue: null };
}

export function currencyPositions(data) {
  return (data?.currencies || []).map(currency => {
    const ar = currencyBalance(data.sources?.receivables, currency);
    const ap = currencyBalance(data.sources?.payables, currency);
    const a = financeNumber(ar.outstanding); const b = financeNumber(ap.outstanding);
    const recordedNet = data.by_currency?.find(row => row.currency === currency);
    const net = recordedNet?.status === 'available' && a !== null && b !== null ? financeNumber(recordedNet.net_invoice_exposure) : null;
    const dates = [ar.oldest_due_date, ap.oldest_due_date].filter(value => value && Number.isFinite(Date.parse(value))).sort();
    return { currency, receivables: a, payables: b, net, oldest_due_date: dates[0] || null };
  });
}

export function sourceMessage(source, fallback = 'Source not connected') {
  if (source?.status === 'restricted') return 'Access restricted';
  if (source?.status === 'error') return 'Source temporarily unavailable';
  if (source?.status === 'incomplete') {
    const balances = financeCount(source.missing_balance_count);
    const currencies = financeCount(source.missing_currency_count);
    const issues = [];
    if (balances > 0) issues.push(`${balances} invoice ${balances === 1 ? 'balance' : 'balances'} missing`);
    if (currencies > 0) issues.push(`${currencies} invoice ${currencies === 1 ? 'currency' : 'currencies'} missing`);
    return issues.join(' · ') || 'Some balances are not recorded';
  }
  return source?.reason || fallback;
}

export function financeKpis(data, currency) {
  const arSource = data?.sources?.receivables; const apSource = data?.sources?.payables;
  const ar = currencyBalance(arSource, currency); const ap = currencyBalance(apSource, currency);
  const arCount = financeCount(ar.invoice_count); const apCount = financeCount(ap.invoice_count);
  const arIssue = ar.status === 'incomplete' ? sourceMessage(ar) : null;
  const apIssue = ap.status === 'incomplete' ? sourceMessage(ap) : null;
  const invoiceNote = (count, source, issue) => count === null ? sourceMessage(source) : `${count} open ${count === 1 ? 'invoice' : 'invoices'}${issue ? ` · ${issue}` : ''}`;
  const missingReason = issue => `${issue}. Totals are withheld until the missing balances or currencies are recorded in the invoice register.`;
  const overdueBuckets = (ar.buckets || []).filter(row => ['days_1_30', 'days_31_60', 'days_61_90', 'over90'].includes(row.id));
  const overdueCount = ar.status === 'available' && overdueBuckets.every(row => financeCount(row.count) !== null) ? overdueBuckets.reduce((total, row) => total + financeCount(row.count), 0) : null;
  const unavailable = id => data?.unavailable_metrics?.find(metric => metric.id === id)?.reason;
  return [
    { id: 'cash', label: 'Cash position', value: null, text: '—', tone: 'green', note: 'Treasury source not connected', reason: unavailable('cash_position') || 'Approved bank or treasury balances are not connected.' },
    { id: 'receivables', label: 'Receivables outstanding', value: ar.outstanding, text: financeMoney(ar.outstanding, currency, true), tone: 'blue', note: invoiceNote(arCount, arSource, arIssue), reason: arIssue ? missingReason(arIssue) : 'Recorded outstanding customer balances in the selected original currency.' },
    { id: 'payables', label: 'Payables outstanding', value: ap.outstanding, text: financeMoney(ap.outstanding, currency, true), tone: 'slate', note: invoiceNote(apCount, apSource, apIssue), reason: apIssue ? missingReason(apIssue) : 'Recorded supplier invoice totals less recorded paid amounts, in the selected original currency.' },
    { id: 'working_capital', label: 'Net working capital', value: null, text: '—', tone: 'green', note: 'Full balance sheet not connected', reason: unavailable('net_working_capital') || 'Other current assets and liabilities are not connected. Net invoice exposure appears separately below.' },
    { id: 'overdue', label: 'Overdue exposure', value: ar.overdue, text: financeMoney(ar.overdue, currency, true), tone: 'red', note: overdueCount === null ? arIssue || sourceMessage(arSource) : `${overdueCount} receivables past due`, reason: arIssue ? missingReason(arIssue) : 'Outstanding receivables with an invoice due date before the reporting date; invoice payment dates are not approval SLAs.' },
  ];
}

export function financeProcesses(data) {
  const process = data?.process;
  const available = process?.status === 'available';
  const count = key => available ? financeCount(process.counts?.[key]) : null;
  const rate = key => {
    const metric = process?.metrics?.find(item => item.id === key);
    const value = available ? financeNumber(metric?.percentage) : null;
    return financeCount(metric?.denominator) > 0 && value !== null && value >= 0 && value <= 100 ? value : null;
  };
  const ar = data?.sources?.receivables;
  const arCount = sourceReadable(ar) ? financeCount(ar.open_count) : null;
  const total = sourceReadable(ar) ? financeCount(ar.invoice_count) : null;
  return [
    { id: 'incoming', label: 'Incoming invoices', count: count('review'), suffix: 'need review', percentage: rate('review'), tone: 'amber', route: financeRoute(process?.route), action: 'Open', definition: 'Share of active supplier invoices in OCR, matching, procurement or finance review.' },
    { id: 'outgoing', label: 'Outgoing invoices', count: arCount, suffix: 'outstanding', percentage: arCount !== null && total > 0 && arCount <= total ? arCount / total * 100 : null, tone: 'red', route: financeRoute(ar?.route), action: 'Open', definition: 'Unsettled customer invoices as a share of the visible customer invoice register, across currencies.' },
    { id: 'exceptions', label: 'Matching exceptions', count: count('exception'), suffix: 'exceptions', percentage: rate('exception'), tone: 'amber', route: financeRoute(process?.route), action: 'Review', definition: 'Share of active supplier invoices with a recorded matching exception; not personal approval assignments.' },
    { id: 'payment', label: 'Payment readiness', count: count('ready_for_payment'), suffix: 'ready', percentage: rate('ready_for_payment'), tone: 'green', route: financeRoute(process?.route), action: 'Prepare', definition: 'Share of active supplier invoices approved for payment without a hold or matching exception.' },
  ];
}

export function financeControls(data) {
  const process = data?.process;
  const metric = process?.metrics?.find(item => item.id === 'verified');
  const match = process?.status === 'available' && financeCount(metric?.denominator) > 0 ? financeNumber(metric?.percentage) : null;
  return [
    { id: 'forecast', label: 'Cash forecast accuracy', value: '—', percentage: null, note: 'Forecast not connected', tone: 'green', definition: 'Requires an approved cash forecast and observed cash outcomes.' },
    { id: 'dso', label: 'DSO (days)', value: '—', percentage: null, note: 'Sales period not connected', tone: 'amber', definition: 'Requires approved sales and average receivables for a defined reporting period.' },
    { id: 'match', label: 'Invoice match rate', value: match !== null && match >= 0 && match <= 100 ? `${Math.round(match)}%` : '—', percentage: match !== null && match >= 0 && match <= 100 ? match : null, note: 'Verified / active A/P invoices', tone: 'green', definition: 'Recorded verified matches as a share of active supplier invoices. A linked purchase order alone is not a verified match.' },
    { id: 'close', label: 'Month-end close', value: '—', percentage: null, note: 'Close calendar not connected', tone: 'blue', definition: 'Requires a recorded close checklist, deadlines and completion evidence.' },
  ];
}

export function financeCoverage(data) {
  const sources = [data?.sources?.receivables, data?.sources?.payables];
  if (!sources.every(sourceReadable)) return null;
  const counts = sources.map(source => source.balance_coverage);
  if (!counts.every(row => financeCount(row?.known_count) !== null && financeCount(row?.total_count) !== null && Number(row.known_count) <= Number(row.total_count))) return null;
  const total = counts.reduce((sum, row) => sum + financeCount(row.total_count), 0);
  const known = counts.reduce((sum, row) => sum + financeCount(row.known_count), 0);
  if (total === 0) return null;
  // Only an entirely recorded cohort may display 100%, even after rounding.
  return known === total ? 100 : Math.min(99.9, Math.round(known / total * 1000) / 10);
}
