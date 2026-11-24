/** Pure helpers for editing one Technical Proposal section in the review canvas. */

export const EDITABLE_KINDS = ['authored', 'not_applicable'];
export const NEW_BLOCK_TYPES = [
  ['paragraph', 'Paragraph'],
  ['bullets', 'Bullet list'],
  ['heading', 'Sub-heading'],
  ['table', 'Table'],
];
const LIMITS = { paragraph: 4000, item: 1000, heading: 200, cell: 600, column: 120, reason: 500 };
const MARKUP = /<\s*[a-zA-Z/!?]/;

let sequence = 0;
const nextId = () => `row-${(sequence += 1)}`;

/** Editor rows from stored blocks; `ref` keeps the link to the original block (and its sources). */
export function toEditable(blocks = []) {
  return blocks.map((block, index) => ({
    id: nextId(),
    ref: index,
    type: block.type,
    level: block.level === 3 ? 3 : 2,
    text: block.text || '',
    items: [...(block.items || [])],
    columns: [...(block.columns || [])],
    rows: (block.rows || []).map((row) => [...row]),
    sourced: Array.isArray(block.citations) && block.citations.length > 0,
  }));
}

export function newRow(type) {
  return {
    id: nextId(), ref: null, type, level: 2, text: '',
    items: type === 'bullets' ? [''] : [],
    columns: type === 'table' ? ['Item', 'Detail'] : [],
    rows: type === 'table' ? [['', '']] : [],
    sourced: false,
  };
}

/** API payload: only the fields each block type uses. */
export function toPayload(rows) {
  return rows.map((row) => {
    const base = { type: row.type, ...(row.ref === null ? {} : { ref: row.ref }) };
    if (row.type === 'part') return { ...base, text: row.text };
    if (row.type === 'heading') return { ...base, text: row.text.trim(), level: row.level };
    if (row.type === 'paragraph') return { ...base, text: row.text.trim() };
    if (row.type === 'bullets') return { ...base, text: row.text.trim(), items: row.items.map((item) => item.trim()) };
    return {
      ...base,
      text: row.text.trim(),
      columns: row.columns.map((value) => value.trim()),
      rows: row.rows.map((cells) => cells.map((cell) => cell.trim())),
    };
  });
}

export function isDirty(blocks, rows) {
  return JSON.stringify(toPayload(toEditable(blocks))) !== JSON.stringify(toPayload(rows));
}

const tooLong = (value, limit) => value.trim().length > limit;
const hasMarkup = (value) => MARKUP.test(value);

/** First problem a reviewer must fix before saving, or ''. Mirrors the server rules. */
export function editProblem(rows, reason) {
  if (!rows.some((row) => row.type !== 'part')) return 'Keep at least one paragraph, list, table or sub-heading.';
  for (const [index, row] of rows.entries()) {
    const at = `Block ${index + 1}`;
    const texts = [row.text, ...row.items, ...row.columns, ...row.rows.flat()];
    if (texts.some(hasMarkup)) return `${at}: use plain text without markup.`;
    if (row.type === 'paragraph' && !row.text.trim()) return `${at}: the paragraph is empty.`;
    if (row.type === 'heading' && !row.text.trim()) return `${at}: the sub-heading is empty.`;
    if (row.type === 'bullets' && (!row.items.length || row.items.some((item) => !item.trim()))) {
      return `${at}: remove empty bullet items.`;
    }
    if (row.type === 'table' && (!row.columns.length || row.columns.some((c) => !c.trim()) || !row.rows.length)) {
      return `${at}: a table needs named columns and at least one row.`;
    }
    if ((row.type === 'paragraph' && tooLong(row.text, LIMITS.paragraph))
      || (row.type === 'heading' && tooLong(row.text, LIMITS.heading))
      || row.items.some((item) => tooLong(item, LIMITS.item))
      || row.rows.flat().some((cell) => tooLong(cell, LIMITS.cell))
      || row.columns.some((column) => tooLong(column, LIMITS.column))) {
      return `${at}: the text is too long.`;
    }
  }
  if (!reason.trim()) return 'Add a reason for the edit.';
  if (reason.length > LIMITS.reason) return `Keep the reason under ${LIMITS.reason} characters.`;
  return '';
}

export function moveRow(rows, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Section shown on a PDF page (pages are [first, last] in the latest render). */
export function sectionForPage(sections, page) {
  return sections.find((section) => Array.isArray(section.pages)
    && page >= section.pages[0] && page <= section.pages[1]) || null;
}

export function editableSections(content) {
  return (content?.sections || []).filter((section) => EDITABLE_KINDS.includes(section.kind));
}
