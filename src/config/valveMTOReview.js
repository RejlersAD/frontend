import { VALVE_COLUMNS } from './valveMTO.config.js';

export const REVIEW_FIELDS = [
  { key: 'area', action: 'Read the complete DRG. TITLE from the source drawing title block; use it for every valve on that sheet.' },
  { key: 'pms_class', action: 'Supply the matching project PMS: exact piping class -> material description.' },
  { key: 'rating', action: 'Supply the PMS class -> rating/facing lookup, or a legible valve annotation.' },
  { key: 'line_number', action: 'Re-extract native detail regions and verify the connected pipe, not the nearest label.' },
  { key: 'valve_tag', action: 'Read the printed valve tag. Manual valves may legitimately have no tag.' },
  { key: 'size_1', action: 'Read the valve annotation or its verified connected line size.' },
].map(field => ({ ...field, label: VALVE_COLUMNS.find(column => column.key === field.key).label }));

const ISSUE_GROUPS = [
  { key: 'quality', title: 'Drawing clarity and coverage', pattern: /resolution|clarity|quality|illegib|garbl|distort|cropp|missed|double.count|under.?count|over.?count/i,
    action: 'Re-extract the original PDF using native high-detail regions. Confirm the total against the drawing.' },
  { key: 'area', title: 'Drawing title and installation allocation', pattern: /\barea\b|DRG\.? TITLE|drawing.title|\bisland\b|\bfield\b|allocation/i,
    action: 'AREA is the source DRG. TITLE. Verify island/field quantities separately; do not infer allocation from the title.' },
  { key: 'specifications', title: 'Material class, rating and facing', pattern: /piping.class|material.class|rating|facing|\bPMS\b/i,
    action: 'Import matching project specification mappings. A symbol legend alone cannot establish material or pressure class.' },
  { key: 'association', title: 'Line connectivity, tags and sizes', pattern: /line.number|line label|line tag|valve tag|connect|proximity|\bsize/i,
    action: 'Check the valve body and connected pipe in the original high-detail region. Do not reconstruct corrupted labels.' },
  { key: 'classification', title: 'Valve classification', pattern: /valve type|unidentified|classif|symbol|PSV|control valve/i,
    action: 'Use the source-specific symbol legend; retain UNIDENTIFIED when a type cannot be confirmed.' },
  { key: 'scope', title: 'Procurement and scope', pattern: /procurement|observed|quantit|scope/i,
    action: 'Observed counts are not approved procurement quantities. Complete engineering scope and quantity review.' },
  { key: 'other', title: 'Other extraction findings', pattern: /./,
    action: 'Inspect the original evidence and resolve the reported finding before approval.' },
];

const hasValue = value => value != null && !/^(?:|unknown|unidentified|n\/a|none)$/i.test(String(value).trim());
const hasFieldValue = (row, field) => hasValue(row[field.key])
  && (field.key !== 'area' || !/^(?:island|field|combined)$/i.test(String(row.area).trim()));

export function buildValveMTOReview(rows = [], warnings = []) {
  const messages = [...new Set(warnings.filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim()))];
  const excluded = messages.filter(message => /^Excluded:/i.test(message));
  const information = messages.filter(message =>
    /^(?:Using \d+|Thin PDF text layer|Rendered \d+|Region-specific rotated OCR)/i.test(message));
  const issues = messages.filter(message => !excluded.includes(message) && !information.includes(message));
  const groups = ISSUE_GROUPS.map(group => ({
    ...group,
    messages: issues.filter(message => ISSUE_GROUPS.find(item => item.pattern.test(message)).key === group.key),
  })).filter(group => group.messages.length);
  const coverage = REVIEW_FIELDS.map(field => {
    const populated = rows.filter(row => hasFieldValue(row, field)).length;
    return { ...field, populated, missing: rows.length - populated,
      percent: rows.length ? Math.round(populated / rows.length * 100) : 0 };
  });
  const rowsWithGaps = rows.filter(row => REVIEW_FIELDS.some(field => !hasFieldValue(row, field))).length;
  const lowConfidence = rows.filter(row => /^(?:low|)$/i.test(String(row.confidence || '').trim())).length;
  return { total: rows.length, rowsWithGaps, lowConfidence, coverage, groups, excluded, information, messages };
}
