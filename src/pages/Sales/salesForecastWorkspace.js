const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MISSING = '—';

// Keep pagination inside the existing authorized service; response URLs are data.
export async function loadForecastRegister(fetchPage) {
  const rows = [], seen = new Set();
  let expected;
  for (let page = 1; page <= 200; page += 1) {
    const data = await fetchPage({ page, page_size: 100, ordering: '-forecast_date,-id' });
    const batch = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(batch)) throw new Error('Forecasts could not be loaded completely. Please refresh.');
    if (expected === undefined && Number.isInteger(data.count)) expected = data.count;
    if (Number.isInteger(data.count) && (data.count < 0 || expected !== data.count)) {
      throw new Error('Forecasts changed while loading. Please refresh.');
    }
    for (const row of batch) {
      if (!row?.id || seen.has(String(row.id))) throw new Error('Forecasts changed while loading. Please refresh.');
      seen.add(String(row.id));
      rows.push(row);
    }
    if (!data.next) {
      if (expected !== undefined && rows.length !== expected) throw new Error('Forecasts changed while loading. Please refresh.');
      return { results: rows, count: rows.length };
    }
    if (!batch.length) break;
  }
  throw new Error('Forecasts could not be loaded completely. Please refresh.');
}

function dateParts(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  if (!year || month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1] ? { year: yearText, month, day: dayText } : null;
}

function periodParts(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})(?:-(?:Q([1-4])|(0[1-9]|1[0-2])))?$/.exec(value);
  if (match && Number(match[1]) > 0) {
    return { year: match[1], quarter: match[2] ? Number(match[2]) : null, month: match[3] ? Number(match[3]) : null };
  }
  return dateParts(value);
}

export function forecastPeriodLabel(value) {
  const period = periodParts(value);
  if (!period) return typeof value === 'string' && value ? value : MISSING;
  if (period.quarter) return `Q${period.quarter} ${period.year}`;
  if (period.day) return `${period.day} ${MONTHS[period.month - 1]} ${period.year}`;
  return period.month ? `${MONTHS[period.month - 1]} ${period.year}` : period.year;
}

export function forecastMonths(value) {
  const period = periodParts(value);
  if (!period) return [];
  const first = period.month || (period.quarter ? (period.quarter - 1) * 3 + 1 : 1);
  const count = period.month ? 1 : period.quarter ? 3 : 12;
  return Array.from({ length: count }, (_, index) => {
    const month = first + index;
    return { key: `${period.year}-${String(month).padStart(2, '0')}`, label: `${MONTHS[month - 1]} ${period.year}` };
  });
}

function decimal(value) {
  if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) return null;
  if (!['string', 'number', 'bigint'].includes(typeof value)) return null;
  const text = String(value);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return { coefficient: BigInt(`${whole}${fraction}`), scale: fraction.length };
}

const power = value => 10n ** BigInt(value);

function roundedMagnitude(value, places, shift = 0) {
  const magnitude = value.coefficient < 0n ? -value.coefficient : value.coefficient;
  const exponent = places - value.scale - shift;
  if (exponent >= 0) return magnitude * power(exponent);
  const divisor = power(-exponent);
  return (magnitude + divisor / 2n) / divisor;
}

// Never coerce decimal money through Number, including differences and rounding.
export function forecastNumber(value, { compact = false, decimals = 0 } = {}) {
  const parsed = decimal(value);
  if (!parsed) return MISSING;
  const places = Number.isInteger(decimals) && decimals >= 0 && decimals <= 20 ? decimals : 0;
  const magnitude = parsed.coefficient < 0n ? -parsed.coefficient : parsed.coefficient;
  let shift = 0, suffix = '';
  if (compact) {
    for (const [candidate, unit] of [[12, 't'], [9, 'b'], [6, 'm'], [3, 'k']]) {
      if (magnitude >= power(parsed.scale + candidate)) {
        shift = candidate;
        suffix = unit;
        break;
      }
    }
  }
  const rounded = roundedMagnitude(parsed, places, shift);
  const digits = rounded.toString().padStart(places + 1, '0');
  const whole = places ? digits.slice(0, -places) : digits;
  const fraction = places ? `.${digits.slice(-places)}` : '';
  const sign = parsed.coefficient < 0n && rounded !== 0n ? '-' : '';
  return `${sign}${BigInt(whole).toLocaleString('en-GB')}${fraction}${suffix}`;
}

export function forecastDifference(left, right) {
  const a = decimal(left), b = decimal(right);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  const result = a.coefficient * power(scale - a.scale) - b.coefficient * power(scale - b.scale);
  const negative = result < 0n;
  const digits = (negative ? -result : result).toString().padStart(scale + 1, '0');
  const text = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits;
  return `${negative ? '-' : ''}${text || '0'}`;
}

export function scenarioField(scenario) {
  if (scenario === 'base') return 'predicted_revenue';
  if (scenario === 'best') return 'best_case';
  if (scenario === 'worst') return 'worst_case';
  return null;
}

export function forecastScenarioValue(record, scenario = 'base') {
  const field = scenarioField(scenario);
  return field ? record?.[field] ?? null : null;
}

export function forecastSnapshotLabel(record) {
  const date = dateParts(record?.forecast_date);
  return date ? `${date.day} ${MONTHS[date.month - 1]} ${date.year}` : 'Date unavailable';
}

export function samePeriodSnapshots(rows, period) {
  if (typeof period !== 'string' || !period) return [];
  return (Array.isArray(rows) ? rows : [])
    .filter(row => row?.forecast_period === period)
    .sort((a, b) => {
      const aDate = dateParts(a.forecast_date) ? a.forecast_date : '';
      const bDate = dateParts(b.forecast_date) ? b.forecast_date : '';
      return bDate.localeCompare(aDate) || String(b.id || '').localeCompare(String(a.id || ''));
    });
}

// These are current snapshot-contract gaps, not new required approval policy.
export function forecastReviewInputs(record) {
  if (!record) return [];
  return [
    { key: 'currency', source: 'Forecast snapshot', input: 'Currency', impact: 'Commercial amounts', tab: 'revenue', detail: 'Currency is not recorded on this snapshot.' },
    { key: 'delivery-phasing', source: 'Forecast snapshot', input: 'Delivery phasing', impact: 'Monthly revenue and hours', tab: 'revenue', detail: 'Monthly delivery phasing is not recorded.' },
    { key: 'capacity', source: 'Forecast snapshot', input: 'Capacity', impact: 'Monthly workload gap', tab: 'workload', detail: 'Monthly capacity is not recorded.' },
    { key: 'margin-target', source: 'Forecast snapshot', input: 'Margin target', impact: 'Commercial performance', tab: 'performance', detail: 'Margin and target are not recorded.' },
  ];
}
