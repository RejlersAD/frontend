export const TYPE_LABELS = {
  procurement_project: 'Procurement project',
  purchase_requisition: 'Purchase requisition',
  purchase_order: 'Purchase order',
  invoice: 'Finance invoice',
};

export const ISSUE_LABELS = {
  no_exact_match: 'No exact project-code match',
  multiple_projects: 'Multiple project references',
  missing_po_match: 'No verified PO match',
  no_verified_po: 'PO match has exceptions',
};

export const recordKey = row => row ? `${row.record_type}:${row.id}` : '';
export const referenceText = value => Array.isArray(value) ? value.join(', ') : String(value ?? '');

export function formatMoney(amount, currency = '', compact = false) {
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(Number(amount))) return '—';
  const value = new Intl.NumberFormat('en-GB', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number(amount));
  return `${currency || ''} ${value}`.trim();
}

export function filterReconciliationRecords(rows = [], filters = {}) {
  const { search = '', type = '', issue = '', currency = '', status = 'unresolved', sort = 'value' } = filters;
  const query = search.trim().toLocaleLowerCase();
  return rows.filter(row => {
    if (type && row.record_type !== type) return false;
    if (issue && row.reason !== issue) return false;
    if (currency && row.currency !== currency) return false;
    if (status === 'exceptions' && !row.exception) return false;
    if (status === 'unresolved' && row.exception) return false;
    return !query || [row.identifier, row.title, referenceText(row.reference), TYPE_LABELS[row.record_type]]
      .some(value => String(value || '').toLocaleLowerCase().includes(query));
  }).sort((a, b) => {
    if (sort === 'newest' || sort === 'oldest') {
      const first = Date.parse(a.created_at) || 0, second = Date.parse(b.created_at) || 0;
      return (sort === 'newest' ? second - first : first - second) || recordKey(a).localeCompare(recordKey(b));
    }
    if (sort === 'identifier') return String(a.identifier || '').localeCompare(String(b.identifier || ''));
    // Amounts in different currencies are never compared as equivalent money.
    return String(a.currency || '').localeCompare(String(b.currency || ''))
      || (Number(b.amount) || 0) - (Number(a.amount) || 0)
      || recordKey(a).localeCompare(recordKey(b));
  });
}

export function reconciliationSummary(data, sessionLinked = 0) {
  const rows = data?.unresolved || [], summary = data?.summary || {};
  const totals = new Map();
  for (const row of rows) {
    if (!row.currency || row.amount === null || row.amount === undefined || !Number.isFinite(Number(row.amount))) continue;
    const existing = totals.get(row.currency) || { currency: row.currency, amount: 0, record_count: 0 };
    existing.amount = Math.round((existing.amount + Number(row.amount)) * 100) / 100;
    existing.record_count += 1;
    totals.set(row.currency, existing);
  }
  return {
    unresolved: summary.unresolved_total ?? rows.length,
    suggested: summary.suggested_record_count ?? rows.filter(row => row.suggested_projects?.length).length,
    linked: sessionLinked,
    values: summary.unresolved_amounts_by_currency ?? [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    sampleCount: summary.sample_count ?? rows.length,
    complete: summary.sample_complete ?? (summary.unresolved_total === undefined || summary.unresolved_total <= rows.length),
  };
}

export function projectCandidates(record, projects = [], search = '') {
  const suggestions = record?.suggested_projects || [];
  const byId = new Map(projects.map(project => [String(project.id), project]));
  for (const suggestion of suggestions) {
    byId.set(String(suggestion.id), { ...byId.get(String(suggestion.id)), ...suggestion });
  }
  const query = search.trim().toLocaleLowerCase();
  if (!query && suggestions.length) return suggestions.map(project => byId.get(String(project.id))).slice(0, 3);
  return [...byId.values()].filter(project => !query || [project.code, project.name, project.client_name]
    .some(value => String(value || '').toLocaleLowerCase().includes(query)))
    .sort((a, b) => String(a.code).localeCompare(String(b.code))).slice(0, 12);
}
