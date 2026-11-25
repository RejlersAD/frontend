/**
 * Pure conversion between stored Technical Proposal section blocks and the editor document (Tiptap /
 * ProseMirror JSON). Structured blocks stay the source of truth; the server re-renders the PDF and
 * Word file from them, including reviewer formatting:
 *   runs        character formatting [{ text, bold, italic, underline, strike, font, size, color, highlight }]
 *   align       left | center | right | justify          indent  { left, first } in points
 *   bullets     markers ('bullet'|'number'), levels (0-2), item_runs
 *   table       header (false = no header row), column_runs, cell_runs { "row:column": runs }
 *
 * `ref` links an editor node to the stored block it came from, so reworded sourced content keeps its
 * tender citations on save; nodes without `ref` are reviewer-written. An optional block introduction
 * (`text` on bullets/tables) is shown as a paragraph with `role: 'intro'` directly before the list.
 */

const RUN_FLAGS = ['bold', 'italic', 'underline', 'strike'];
const PT = /^(\d+(?:\.\d+)?)pt$/;

// --- runs <-> marks ----------------------------------------------------------------------------

function marksFor(run) {
  const marks = RUN_FLAGS.filter((flag) => run[flag]).map((type) => ({ type }));
  const style = {};
  if (run.font) style.fontFamily = run.font;
  if (run.size) style.fontSize = `${run.size}pt`;
  if (run.color) style.color = run.color;
  if (Object.keys(style).length) marks.push({ type: 'textStyle', attrs: { fontFamily: null, fontSize: null, color: null, ...style } });
  if (run.highlight) marks.push({ type: 'highlight', attrs: { color: run.highlight } });
  return marks;
}

function inline(text, runs) {
  const source = runs?.length ? runs : (text ? [{ text }] : []);
  return source.filter((run) => run.text).map((run) => {
    const marks = marksFor(run);
    return marks.length ? { type: 'text', text: run.text, marks } : { type: 'text', text: run.text };
  });
}

const upper = (value) => (typeof value === 'string' ? value.toUpperCase() : value);

/** Runs of a textblock, in a fixed key order; null when nothing is formatted. Also the plain text. */
export function readRuns(node) {
  const runs = [];
  for (const child of node?.content || []) {
    if (child.type !== 'text' || !child.text) continue;
    const run = { text: child.text.replace(/\s+/g, ' ') };
    const marks = child.marks || [];
    for (const flag of RUN_FLAGS) if (marks.some((mark) => mark.type === flag)) run[flag] = true;
    const style = marks.find((mark) => mark.type === 'textStyle')?.attrs || {};
    if (style.fontFamily) run.font = String(style.fontFamily).replace(/["']/g, '').split(',')[0].trim();
    const size = PT.exec(String(style.fontSize || ''));
    if (size) run.size = Number(size[1]);
    if (/^#[0-9a-f]{6}$/i.test(style.color || '')) run.color = upper(style.color);
    const highlight = marks.find((mark) => mark.type === 'highlight')?.attrs?.color;
    if (/^#[0-9a-f]{6}$/i.test(highlight || '')) run.highlight = upper(highlight);
    const last = runs[runs.length - 1];
    const same = last && JSON.stringify({ ...last, text: '' }) === JSON.stringify({ ...run, text: '' });
    if (same) last.text += run.text; else runs.push(run);
  }
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, '');
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
  }
  const kept = runs.filter((run) => run.text);
  const text = kept.map((run) => run.text).join('');
  return { text, runs: kept.some((run) => Object.keys(run).length > 1) ? kept : null };
}

// --- blocks -> document ------------------------------------------------------------------------

const blockAttrs = (block) => ({
  textAlign: block.align || null,
  indentLeft: block.indent?.left || null,
  indentFirst: block.indent?.first || null,
});
const paragraph = (text, runs, attrs = {}) => ({
  type: 'paragraph',
  attrs: { ref: null, role: null, textAlign: null, indentLeft: null, indentFirst: null, ...attrs },
  content: inline(text, runs),
});

function buildLists(items, ref) {
  // items: [{ text, runs, level, marker }] -> sibling list nodes (a marker change at level 0 starts a new list).
  const lists = [];
  let index = 0;
  const build = (level) => {
    const marker = items[index].marker;
    const list = { type: marker === 'number' ? 'orderedList' : 'bulletList', attrs: { ref: level === 0 ? ref : null }, content: [] };
    while (index < items.length && items[index].level >= level) {
      const item = items[index];
      if (item.level === level && item.marker !== marker && list.content.length) break;
      if (item.level > level) {
        const parent = list.content[list.content.length - 1];
        if (parent) parent.content.push(build(level + 1)); else list.content.push({ type: 'listItem', content: [paragraph('', null), build(level + 1)] });
        continue;
      }
      list.content.push({ type: 'listItem', content: [paragraph(item.text, item.runs)] });
      index += 1;
    }
    return list;
  };
  while (index < items.length) lists.push(build(0));
  return lists;
}

const cellNode = (type, text, runs) => ({ type, content: [paragraph(text, runs)] });

export function blocksToDoc(blocks = []) {
  const content = [];
  blocks.forEach((block, ref) => {
    const intro = () => {
      if (block.text) content.push(paragraph(block.text, block.runs, { ref, role: 'intro', ...blockAttrs(block) }));
    };
    if (block.type === 'part') {
      content.push({ type: 'proposalPart', attrs: { ref, text: block.text || '' } });
    } else if (block.type === 'heading') {
      const level = [1, 2, 3].includes(block.level) ? block.level : 2;
      content.push({ type: 'heading', attrs: { ref, role: null, level, ...blockAttrs(block) }, content: inline(block.text, block.runs) });
    } else if (block.type === 'paragraph') {
      content.push(paragraph(block.text, block.runs, { ref, ...blockAttrs(block) }));
    } else if (block.type === 'bullets') {
      intro();
      const values = block.items?.length ? block.items : [''];
      const items = values.map((text, index) => ({
        text, runs: block.item_runs?.[index] || null,
        level: Math.min(2, Math.max(0, block.levels?.[index] || 0)),
        marker: block.markers?.[index] === 'number' ? 'number' : 'bullet',
      }));
      if (items[0].level) items[0].level = 0;
      content.push(...buildLists(items, ref));
    } else if (block.type === 'table') {
      intro();
      const header = block.header !== false;
      const width = Math.max(block.columns?.length || 0, ...(block.rows || []).map((row) => row.length), 1);
      const pad = (row) => Array.from({ length: width }, (_, index) => row[index] || '');
      const rows = (block.rows?.length ? block.rows : [[]]).map((row, r) => ({
        type: 'tableRow', content: pad(row).map((value, c) => cellNode('tableCell', value, block.cell_runs?.[`${r}:${c}`])),
      }));
      content.push({
        type: 'table', attrs: { ref },
        content: header
          ? [{ type: 'tableRow', content: pad(block.columns || []).map((value, c) => cellNode('tableHeader', value, block.column_runs?.[c])) }, ...rows]
          : rows,
      });
    }
  });
  if (!content.length || content[content.length - 1].type !== 'paragraph') content.push(paragraph('', null));
  return { type: 'doc', content };
}

// --- document -> blocks ------------------------------------------------------------------------

/** Plain text of a node; blocks inside it (list items, cells) are joined by a space. */
export function nodeText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'proposalPart') return node.attrs?.text || '';
  return (node.content || []).map(nodeText).filter(Boolean).join(node.type === 'paragraph' || node.type === 'heading' ? '' : ' ');
}

const refOf = (node) => (Number.isInteger(node?.attrs?.ref) ? node.attrs.ref : null);
const LIST_TYPES = ['bulletList', 'orderedList'];

/** Stored form of a textblock: { text, runs? } plus alignment and indent when set. */
function textFields(node) {
  const { text, runs } = readRuns(node);
  const fields = { text };
  if (runs) fields.runs = runs;
  const align = node.attrs?.textAlign;
  if (['left', 'center', 'right', 'justify'].includes(align)) fields.align = align;
  const left = Number(node.attrs?.indentLeft) || 0;
  const first = Number(node.attrs?.indentFirst) || 0;
  if (left || first) fields.indent = { left, first };
  return fields;
}

function flattenList(list, level, items) {
  for (const item of list.content || []) {
    const [first, ...rest] = item.content || [];
    const { text, runs } = readRuns(first);
    if (text) items.push({ text, runs, level: Math.min(level, 2), marker: list.type === 'orderedList' ? 'number' : 'bullet' });
    for (const child of rest) if (LIST_TYPES.includes(child.type)) flattenList(child, level + 1, items);
  }
  return items;
}

function listBlock(lists, intro, ref) {
  const items = lists.flatMap((list) => flattenList(list, 0, []));
  if (!items.length) return intro?.text ? withRef(null, { type: 'paragraph', ...intro }) : null;
  const block = { type: 'bullets', text: intro?.text || '', items: items.map((item) => item.text) };
  if (intro?.runs) block.runs = intro.runs;
  if (items.some((item) => item.runs)) block.item_runs = items.map((item) => item.runs);
  if (items.some((item) => item.marker === 'number')) block.markers = items.map((item) => item.marker);
  if (items.some((item) => item.level)) block.levels = items.map((item) => item.level);
  if (intro?.align) block.align = intro.align;
  if (intro?.indent) block.indent = intro.indent;
  return withRef(ref, block);
}

function tableBlock(node, intro) {
  const rows = node.content || [];
  const header = rows.length > 0 && (rows[0].content || []).length > 0 && rows[0].content.every((cell) => cell.type === 'tableHeader');
  const read = (row) => (row.content || []).map((cell) => readRuns(cell.content?.[0]));
  const body = (header ? rows.slice(1) : rows).map(read);
  const width = Math.max(header ? (rows[0].content || []).length : 0, ...body.map((row) => row.length), 1);
  const block = { type: 'table', text: intro?.text || '' };
  if (intro?.runs) block.runs = intro.runs;
  if (header) {
    const columns = read(rows[0]);
    block.columns = columns.map((cell) => cell.text);
    if (columns.some((cell) => cell.runs)) block.column_runs = columns.map((cell) => cell.runs);
  } else {
    block.header = false;
    block.columns = Array.from({ length: width }, () => '');
  }
  const cells = body.length ? body : [Array.from({ length: width }, () => ({ text: '', runs: null }))];
  block.rows = cells.map((row) => row.map((cell) => cell.text));
  const formatted = {};
  cells.forEach((row, r) => row.forEach((cell, c) => { if (cell.runs) formatted[`${r}:${c}`] = cell.runs; }));
  if (Object.keys(formatted).length) block.cell_runs = formatted;
  if (intro?.align) block.align = intro.align;
  if (intro?.indent) block.indent = intro.indent;
  return withRef(refOf(node), block);
}

function withRef(ref, record) {
  return ref === null ? record : { ...record, ref };
}

export function docToBlocks(doc) {
  const nodes = doc?.content || [];
  const blocks = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const ref = refOf(node);
    if (node.type === 'proposalPart') {
      blocks.push(withRef(ref, { type: 'part', text: node.attrs.text }));
    } else if (node.type === 'heading') {
      const fields = textFields(node);
      if (fields.text) blocks.push(withRef(ref, { type: 'heading', level: [1, 2, 3].includes(node.attrs?.level) ? node.attrs.level : 2, ...fields }));
    } else if (node.type === 'paragraph') {
      const fields = textFields(node);
      const next = nodes[index + 1];
      // An introduction stays with its list or table while both still come from the same block.
      if (node.attrs?.role === 'intro' && ref !== null && next && refOf(next) === ref && (LIST_TYPES.includes(next.type) || next.type === 'table')) {
        if (next.type === 'table') {
          blocks.push(tableBlock(next, fields));
          index += 1;
        } else {
          const lists = [next];
          index += collectLists(nodes, index + 1, ref, lists);
          blocks.push(listBlock(lists, fields, ref));
        }
      } else if (fields.text) {
        blocks.push(withRef(ref, { type: 'paragraph', ...fields }));
      }
    } else if (LIST_TYPES.includes(node.type)) {
      const lists = [node];
      index += collectLists(nodes, index, ref, lists) - 1;
      const block = listBlock(lists, null, ref);
      if (block) blocks.push(block);
    } else if (node.type === 'table') {
      blocks.push(tableBlock(node, null));
    }
  }
  return blocks.filter(Boolean);
}

/** Adds the following sibling lists that belong to the same stored block; returns how many nodes it covers. */
function collectLists(nodes, start, ref, lists) {
  let count = 1;
  while (ref !== null && LIST_TYPES.includes(nodes[start + count]?.type) && refOf(nodes[start + count]) === ref) {
    lists.push(nodes[start + count]);
    count += 1;
  }
  return count;
}

/** Same comparison the server makes: normalised payloads. */
export function sameBlocks(original, edited) {
  return JSON.stringify(docToBlocks(blocksToDoc(original))) === JSON.stringify(edited);
}

const LIMITS = { paragraph: 4000, item: 1000, heading: 200, cell: 600, column: 120, columns: 8, rows: 300, items: 100, blocks: 400 };
const MARKUP = /<\s*[a-zA-Z/!?]/;

/** First problem that would stop the server accepting the blocks, or ''. */
export function blocksProblem(blocks) {
  if (!blocks.some((block) => block.type !== 'part')) return 'Keep at least one paragraph, list, table or heading.';
  if (blocks.length > LIMITS.blocks) return `Keep the section under ${LIMITS.blocks} blocks.`;
  for (const [index, block] of blocks.entries()) {
    const at = `Block ${index + 1}`;
    const texts = [block.text || '', ...(block.items || []), ...(block.columns || []), ...(block.rows || []).flat()];
    if (texts.some((value) => MARKUP.test(value))) return `${at}: use plain text without markup.`;
    if (block.type === 'heading' && block.text.length > LIMITS.heading) return `${at}: the heading is longer than ${LIMITS.heading} characters.`;
    if ((block.text || '').length > LIMITS.paragraph) return `${at}: the paragraph is longer than ${LIMITS.paragraph} characters.`;
    if (block.type === 'bullets') {
      if (block.items.length > LIMITS.items) return `${at}: a list has at most ${LIMITS.items} items.`;
      if (block.items.some((item) => item.length > LIMITS.item)) return `${at}: a list item is longer than ${LIMITS.item} characters.`;
    }
    if (block.type === 'table') {
      if (block.columns.length > LIMITS.columns) return `${at}: a table has at most ${LIMITS.columns} columns.`;
      if (block.header !== false && block.columns.some((column) => !column)) return `${at}: every table column needs a name in the header row.`;
      if (block.columns.some((column) => column.length > LIMITS.column)) return `${at}: a column name is longer than ${LIMITS.column} characters.`;
      if (block.rows.length > LIMITS.rows) return `${at}: a table has at most ${LIMITS.rows} rows.`;
      if (block.rows.flat().some((value) => value.length > LIMITS.cell)) return `${at}: a table cell is longer than ${LIMITS.cell} characters.`;
    }
  }
  return '';
}

export function wordCount(blocks) {
  return blocks.reduce((total, block) => {
    const texts = [block.text || '', ...(block.items || []), ...(block.columns || []), ...(block.rows || []).flat()];
    return total + texts.reduce((sum, value) => sum + (value.match(/\S+/g)?.length || 0), 0);
  }, 0);
}

/** Positions of `query` inside each text block: [{ from, to }] (case-insensitive, within one block). */
export function textMatches(textBlocks, query) {
  const needle = query.toLowerCase();
  if (!needle) return [];
  const matches = [];
  for (const { text: value, start } of textBlocks) {
    const haystack = value.toLowerCase();
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
      matches.push({ from: start + at, to: start + at + needle.length });
    }
  }
  return matches;
}

export const FONTS = ['Arial', 'Arial Narrow', 'Calibri', 'Cambria', 'Courier New', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Verdana'];
export const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 36];
