export const DEPARTMENTS = [
  { id: 'engineering', label: 'Engineering', description: 'Technical delivery and reviews' },
  { id: 'finance', label: 'Finance', description: 'Receivables and invoice control' },
  { id: 'hr', label: 'Human Resources', description: 'People and workforce capacity' },
  { id: 'sales', label: 'Sales', description: 'Opportunities and commercial pipeline' },
  { id: 'project_control', label: 'Project Control', description: 'Delivery, cost and schedule' },
  { id: 'procurement', label: 'Procurement', description: 'Commitments and supply continuity' },
  { id: 'qhse', label: 'QHSE', description: 'Quality, safety and compliance' },
];

export const STATUS_LABELS = {
  available: 'Reported', partial: 'Partial coverage', unavailable: 'Not available',
  restricted: 'Restricted', error: 'Source unavailable',
};

export function formatNumber(value, options = {}) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, ...options }).format(Number(value));
}

export function formatMetric(metric) {
  if (!['available', 'partial'].includes(metric.status)) return '—';
  if (metric.by_currency?.length) return null;
  const number = formatNumber(metric.value);
  if (number === '—') return number;
  return metric.unit === 'percent' ? `${number}%` : number;
}

export function formatDate(value, withTime = false) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-GB', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

// Only route links within the authenticated app; never accept external API-provided destinations.
export function internalRoute(route) {
  return typeof route === 'string' && /^\/(?!\/)/.test(route)
    && ![...route].some(character => character === '\\' || character.charCodeAt(0) <= 32) ? route : null;
}

export function validateExecutiveReport(data) {
  if (data?.schema_version !== '1.0' || !Array.isArray(data.kpis)
    || !Array.isArray(data.departments) || !Array.isArray(data.actions)
    || !data.scope || !data.portfolio || !data.generated_at) {
    throw new Error('The executive report could not be read. Refresh to try again.');
  }
  return data;
}

export function requestError(error) {
  const status = error.response?.status;
  if (status === 403) return { title: 'Executive access required', detail: 'Your account does not have access to the executive overview. Your administrator can assign executive viewing access and the relevant department permissions.' };
  if (status === 401) return { title: 'Please sign in again', detail: 'Your session has expired. Sign in to view the executive overview.' };
  return { title: 'Overview could not be loaded', detail: status === 404
    ? 'Executive reporting is not available on this server yet. Please try again after the application is updated.'
    : 'We could not retrieve the latest report. Refresh to try again. No performance figures are being shown.' };
}
