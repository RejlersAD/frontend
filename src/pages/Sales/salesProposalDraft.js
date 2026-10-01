export const proposalTextFields = ['scope', 'deliverables', 'assumptions', 'exclusions'];
export const proposalTextLabels = { scope: 'Scope and execution approach', deliverables: 'Deliverables', assumptions: 'Assumptions', exclusions: 'Exclusions' };
const narrativeKeys = ['title', 'name', 'description', 'document_number', 'text', 'content', 'discipline'];
const narrative = value => typeof value === 'string' ? value : value && typeof value === 'object' && !Array.isArray(value) ? narrativeKeys.filter(key => typeof value[key] === 'string').map(key => value[key]).filter(Boolean).join(' · ') : '';
export const proposalText = value => Array.isArray(value) ? value.map(narrative).filter(Boolean).join('\n') : narrative(value);
export const proposalDraftFields = values => Object.fromEntries(proposalTextFields.map(field => [field, proposalText(values[field])]));
export const proposalLines = text => String(text || '').split('\n').map(item => item.trim()).filter(Boolean);

// Unchanged JSON evidence is omitted rather than flattened back into strings.
export function proposalEditPayload(draft, saved) {
  return Object.fromEntries(Object.entries(draft).filter(([field, value]) => !proposalTextFields.includes(field) || value !== proposalText(saved[field])).map(([field, value]) => [field, proposalTextFields.includes(field) && field !== 'scope' ? proposalLines(value) : value]));
}

export async function loadPreparationOpportunities(fetchPage) {
  const rows = [], ids = new Set(); let expected;
  for (let page = 1; page <= 200; page += 1) {
    const data = await fetchPage({ page, page_size: 100 });
    if (!Array.isArray(data?.results) || !Number.isInteger(data.count) || data.count < 0) throw new Error('Opportunity choices could not be verified. Retry loading.');
    if (expected === undefined) expected = data.count;
    if (expected !== data.count) throw new Error('Opportunity choices changed while loading. Retry loading.');
    for (const row of data.results) {
      if (!row?.id || ids.has(String(row.id)) || typeof row.can_create_proposal !== 'boolean') throw new Error('Opportunity choices could not be verified. Retry loading.');
      ids.add(String(row.id)); rows.push(row);
    }
    if (!data.next) {
      if (rows.length !== expected) throw new Error('Opportunity choices changed while loading. Retry loading.');
      return rows;
    }
    if (!data.results.length) break;
  }
  throw new Error('The complete opportunity list could not be loaded. Retry or contact your administrator.');
}
