import dictionary from '../config/buhasa_codelists.json';
import aliases from '../config/buhasa_codelist_aliases.json';

export const BUHASA_CATEGORIES = ['EndPreparation', 'FlangeFacing', 'PressureRating', 'ScheduleThickness', 'MaterialsGrade', 'BoltType'];
export const buhasaSummary = { entries: Object.values(dictionary).reduce((sum, rows) => sum + rows.length, 0), sheets: Object.keys(dictionary).length };
export const codelistLabel = entry => `${entry.shortDesc} (${entry.code})${entry.parents?.length ? ` · ${entry.parents.map(parent => parent.shortDesc).join(' / ')}` : ''}`;
export const codelistOptions = category => dictionary[category] || [];

// Preview aid only. The server resolves and validates persisted matching evidence.
export function resolveBuhasaAttribute(category, value, { catalog = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return { status: 'NOT_SUPPLIED', candidates: [], confidence: 0 };
  const candidates = catalog && /^\d+(\.0)?$/.test(raw)
    ? codelistOptions(category).filter(entry => entry.code === Number(raw))
    : aliases[category]?.[raw.toUpperCase()] || codelistOptions(category).filter(entry => entry.shortDesc.toLowerCase() === raw.toLowerCase());
  return { status: candidates.length === 1 ? 'RESOLVED' : candidates.length ? 'AMBIGUOUS' : 'UNMAPPED_CODELIST', candidates,
    confidence: candidates.length === 1 ? 1 : candidates.length ? 0.5 : 0,
    ...(candidates.length === 1 ? { shortDesc: candidates[0].shortDesc, code: candidates[0].code } : {}) };
}
