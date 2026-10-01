import { forecastDifference, forecastNumber } from './salesForecastWorkspace.js';

const MISSING = '—';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const text = value => typeof value === 'string' ? value.trim() : '';
const decimal = value => forecastDifference(value, '0') !== null;

// Stay within the authorized service; response-provided next URLs are data only.
export async function loadFrameworkRegister(fetchPage) {
  const rows = [], seen = new Set();
  let expected;
  for (let page = 1; page <= 200; page += 1) {
    const data = await fetchPage({ page, page_size: 100, ordering: '-created_at' });
    const batch = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(batch)) throw new Error('Frameworks could not be loaded completely. Please refresh.');
    if (data.count !== undefined && (!Number.isInteger(data.count) || data.count < 0)) {
      throw new Error('Frameworks could not be loaded completely. Please refresh.');
    }
    if (expected === undefined && Number.isInteger(data.count)) expected = data.count;
    if (Number.isInteger(data.count) && expected !== data.count) {
      throw new Error('Frameworks changed while loading. Please refresh.');
    }
    for (const row of batch) {
      if (!row?.id || seen.has(String(row.id))) throw new Error('Frameworks changed while loading. Please refresh.');
      seen.add(String(row.id));
      rows.push(row);
    }
    if (!data.next) {
      if (expected !== undefined && rows.length !== expected) throw new Error('Frameworks changed while loading. Please refresh.');
      return { results: rows, count: rows.length };
    }
    if (!batch.length) break;
  }
  throw new Error('Frameworks could not be loaded completely. Please refresh.');
}

export function frameworkLabel(value) {
  return text(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || MISSING;
}

export function frameworkOwner(row) {
  return text(row?.owner_name) || (row?.owner ? 'Name unavailable' : 'Unassigned');
}

// Remaining is the API's ceiling less commitments, NOT availability after reservations.
export function frameworkRemaining(row) {
  return decimal(row?.remaining_value) ? row.remaining_value : null;
}

export function frameworkMoney(value, currency, { compact = false, decimals } = {}) {
  if (!decimal(value)) return MISSING;
  const fraction = String(value).split('.')[1]?.replace(/0+$/, '') || '';
  const places = decimals ?? (compact ? 2 : Math.min(fraction.length, 20));
  let amount = forecastNumber(value, { compact, decimals: places });
  if (compact && decimals === undefined) amount = amount.replace(/\.00k$/, 'k').replace(/(\.\d*[1-9])0+k$/, '$1k').replace(/\.00$/, '');
  return text(currency) ? `${text(currency)} ${amount}` : `${amount} (currency not recorded)`;
}

function validDate(value) {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    ? { year: yearText, month, day: dayText } : null;
}

export function frameworkDate(value) {
  const date = validDate(value);
  return date ? `${date.day} ${MONTHS[date.month - 1]} ${date.year}` : MISSING;
}

export function filterFrameworks(rows, { query = '', status = 'all', client = '', owner = '', currency = '' } = {}) {
  const term = text(query).toLocaleLowerCase();
  return (Array.isArray(rows) ? rows : []).filter(row => row
    && (status === 'all' || row.status === status)
    && (!client || String(row.client) === String(client))
    && (!owner || (owner === 'unassigned' ? !row.owner : String(row.owner) === String(owner)))
    && (!currency || row.currency === currency)
    && (!term || [row.framework_number, row.title, row.client_name, frameworkOwner(row), frameworkLabel(row.status)]
      .some(value => String(value || '').toLocaleLowerCase().includes(term))));
}

const compareText = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'en', { numeric: true, sensitivity: 'base' });

export function sortFrameworks(rows, key = 'agreement', direction = 'asc') {
  const descending = direction === 'desc' ? -1 : 1;
  const moneyKey = ['remaining', 'remaining_value', 'ceiling_value', 'committed_value', 'invoiced_value'].includes(key);
  const value = row => {
    if (key === 'agreement') return row.framework_number || row.title;
    if (key === 'client') return row.client_name;
    if (key === 'owner') return frameworkOwner(row);
    if (key === 'status') return frameworkLabel(row.status);
    if (key === 'remaining') return frameworkRemaining(row);
    if (key === 'expiry_date' || key === 'effective_date') return validDate(row[key]) ? row[key] : null;
    return row[key];
  };
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const left = value(a), right = value(b);
    const leftMissing = moneyKey ? !decimal(left) : left === null || left === undefined || left === '';
    const rightMissing = moneyKey ? !decimal(right) : right === null || right === undefined || right === '';
    // Unknown dates/amounts stay at the end in both directions.
    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
    let comparison = 0;
    if (!leftMissing && moneyKey) {
      // Group currencies before comparing amounts; there is no FX conversion contract.
      comparison = compareText(text(a.currency), text(b.currency));
      if (!comparison) {
        const difference = forecastDifference(left, right);
        comparison = difference === '0' ? 0 : difference.startsWith('-') ? -1 : 1;
      }
    } else if (!leftMissing) comparison = compareText(left, right);
    return comparison * descending || compareText(a.framework_number, b.framework_number) || compareText(a.id, b.id);
  });
}
