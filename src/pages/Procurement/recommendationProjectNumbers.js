const projectNumberList = (value) => {
  const values = Array.isArray(value) ? value.flatMap(projectNumberList)
    : typeof value === 'string' ? value.split(',')
      : typeof value === 'number' && Number.isFinite(value) ? [String(value)] : [];
  const seen = new Set();
  return values.map(number => number.trim()).filter((number) => {
    const key = number.toLowerCase();
    if (!number || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeProjectNumbers = value => projectNumberList(value).join(', ');

/** Keep matching selected records and unnamed/internal references intact. */
export function reconcileRecommendationProjectDetails(value, details = []) {
  const numbers = projectNumberList(value);
  const requested = new Set(numbers.map(number => number.toLowerCase()));
  const retained = (Array.isArray(details) ? details : []).filter((detail) => {
    if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return false;
    const codes = projectNumberList(detail.project_number || detail.project_code || detail.code);
    return !codes.length || detail.type === 'internal' || codes.every(code => requested.has(code.toLowerCase()));
  });
  const existing = new Set(retained.flatMap(detail => projectNumberList(
    detail.project_number || detail.project_code || detail.code,
  )).map(number => number.toLowerCase()));
  return [...retained, ...numbers.filter(number => !existing.has(number.toLowerCase())).map(number => ({
    type: 'project', project_number: number, value: number,
  }))];
}

/** Read explicit references only; display names never establish project IDs. */
export function recommendationProjectNumbers(record = {}) {
  if (!record || typeof record !== 'object') return [];
  if (Object.hasOwn(record, 'project_numbers')) return projectNumberList(record.project_numbers);
  const details = Array.isArray(record.project_details) ? record.project_details : [];
  const references = projectNumberList(details.map(detail => (
    detail?.project_number || detail?.project_code || detail?.code || ''
  )));
  if (references.length) return references;
  return projectNumberList([
    record.project_number,
    record.price_remarks_data?.project_numbers,
    record.project,
  ]);
}
