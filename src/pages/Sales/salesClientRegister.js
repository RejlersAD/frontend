export const clientLabel = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
export const clientIndustry = value => ({ oil_gas: 'Oil & Gas', petrochemical: 'Petrochemical', power_generation: 'Power Generation', water_treatment: 'Water Treatment', manufacturing: 'Manufacturing', construction: 'Construction', government: 'Government', other: 'Other' })[value] || clientLabel(value) || '—';
export const clientOwner = row => row?.account_manager_name || row?.account_manager_details?.full_name || [row?.account_manager_details?.first_name, row?.account_manager_details?.last_name].filter(Boolean).join(' ') || row?.account_manager_details?.username || (row?.account_manager ? 'Name unavailable' : 'Unassigned');

// Follow page numbers through the existing service, never response-provided URLs.
export async function loadClientPages(fetchPage) {
  const rows = [], seen = new Set();
  let expected;
  for (let page = 1; page <= 200; page += 1) {
    const data = await fetchPage({ page, page_size: 100, ordering: '-created_at,-id' });
    const batch = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(batch)) throw new Error('Records could not be loaded completely. Please refresh.');
    if (expected === undefined && Number.isInteger(data.count)) expected = data.count;
    if (Number.isInteger(data.count) && expected !== data.count) throw new Error('Records changed while loading. Please refresh.');
    for (const row of batch) {
      if (!row?.id || seen.has(String(row.id))) throw new Error('Records changed while loading. Please refresh.');
      seen.add(String(row.id)); rows.push(row);
    }
    if (!data.next) {
      if (expected !== undefined && rows.length !== expected) throw new Error('Records changed while loading. Please refresh.');
      return { results: rows, count: rows.length };
    }
    if (!batch.length) break;
  }
  throw new Error('Records could not be loaded completely. Please refresh.');
}

export function filterClients(rows, { query = '', status = 'all', country = '', owner = '', industry = '' }) {
  const term = query.trim().toLocaleLowerCase();
  return rows.filter(row => (status === 'all' || row.status === status)
    && (!country || row.country === country)
    && (!owner || (owner === 'unassigned' ? !row.account_manager : String(row.account_manager) === owner))
    && (!industry || row.industry_type === industry)
    && (!term || [row.company_name, row.legal_name, row.client_code, row.website, row.email, clientIndustry(row.industry_type), clientOwner(row)].some(value => String(value || '').toLocaleLowerCase().includes(term))));
}

export function sortClients(rows, key, direction) {
  const value = row => key === 'client' ? row.company_name : key === 'industry' ? clientIndustry(row.industry_type) : key === 'owner' ? clientOwner(row) : row[key];
  return [...rows].sort((a, b) => String(value(a) || '').localeCompare(String(value(b) || ''), undefined, { numeric: true, sensitivity: 'base' }) * (direction === 'desc' ? -1 : 1));
}
