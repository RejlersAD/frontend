/**
 * Pure conversion between stored Technical Proposal section blocks and the editor document (Tiptap /
 * ProseMirror JSON). Structured blocks stay the source of truth: the editor only offers what the
 * Rejlers renderer can rebuild (chapters, sub-headings, paragraphs, bullet lists, tables).
 *
 * `ref` links an editor node to the stored block it came from, so reworded sourced content keeps its
 * tender citations on save; nodes without `ref` are reviewer-written. An optional block introduction
 * (`text` on bullets/tables) is shown as a paragraph with `role: 'intro'` directly before the list.
 */

const text = (value) => (value ? [{ type: 'text', text: value }] : []);
const paragraph = (value, attrs = {}) => ({ type: 'paragraph', attrs: { ref: null, role: null, ...attrs }, content: text(value) });
const cell = (type, value) => ({ type, content: [paragraph(value)] });

export function blocksToDoc(blocks = []) {
  const content = [];
  blocks.forEach((block, ref) => {
    if (block.type === 'part') {
      content.push({ type: 'proposalPart', attrs: { ref, text: block.text || '' } });
    } else if (block.type === 'heading') {
      content.push({ type: 'heading', attrs: { ref, level: block.level === 3 ? 3 : 2 }, content: text(block.text) });
    } else if (block.type === 'paragraph') {
      content.push(paragraph(block.text, { ref }));
    } else if (block.type === 'bullets') {
      if (block.text) content.push(paragraph(block.text, { ref, role: 'intro' }));
      content.push({
        type: 'bulletList', attrs: { ref },
        content: (block.items?.length ? block.items : ['']).map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
      });
    } else if (block.type === 'table') {
      if (block.text) content.push(paragraph(block.text, { ref, role: 'intro' }));
      const columns = block.columns?.length ? block.columns : [''];
      content.push({
        type: 'table', attrs: { ref },
        content: [
          { type: 'tableRow', content: columns.map((column) => cell('tableHeader', column)) },
          ...(block.rows?.length ? block.rows : [[]]).map((row) => ({
            type: 'tableRow', content: columns.map((_, index) => cell('tableCell', row[index] || '')),
          })),
        ],
      });
    }
  });
  if (!content.length || content[content.length - 1].type !== 'paragraph') content.push(paragraph(''));
  return { type: 'doc', content };
}

/** Plain text of a node; blocks inside it (list items, cells) are joined by a space. */
export function nodeText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'proposalPart') return node.attrs?.text || '';
  return (node.content || []).map(nodeText).filter(Boolean).join(node.type === 'paragraph' || node.type === 'heading' ? '' : ' ');
}

const clean = (value) => value.replace(/\s+/g, ' ').trim();
const refOf = (node) => (Number.isInteger(node.attrs?.ref) ? node.attrs.ref : null);
const withRef = (ref, record) => (ref === null ? record : { ...record, ref });

export function docToBlocks(doc) {
  const nodes = doc?.content || [];
  const blocks = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const ref = refOf(node);
    if (node.type === 'proposalPart') {
      blocks.push(withRef(ref, { type: 'part', text: node.attrs.text }));
    } else if (node.type === 'heading') {
      const value = clean(nodeText(node));
      if (value) blocks.push(withRef(ref, { type: 'heading', text: value, level: node.attrs?.level === 3 ? 3 : 2 }));
    } else if (node.type === 'paragraph') {
      const value = clean(nodeText(node));
      const next = nodes[index + 1];
      // An introduction stays with its list or table while both still come from the same block.
      if (node.attrs?.role === 'intro' && ref !== null && next && ['bulletList', 'table'].includes(next.type) && refOf(next) === ref) {
        blocks.push(listOrTable(next, value));
        index += 1;
      } else if (value) {
        blocks.push(withRef(ref, { type: 'paragraph', text: value }));
      }
    } else if (node.type === 'bulletList' || node.type === 'table') {
      const block = listOrTable(node, '');
      if (block) blocks.push(block);
    }
  }
  return blocks.filter(Boolean);
}

function listOrTable(node, intro) {
  const ref = refOf(node);
  if (node.type === 'bulletList') {
    const items = (node.content || []).map((item) => clean(nodeText(item))).filter(Boolean);
    return items.length ? withRef(ref, { type: 'bullets', text: intro, items }) : (intro ? withRef(null, { type: 'paragraph', text: intro }) : null);
  }
  const rows = (node.content || []).map((row) => (row.content || []).map((item) => clean(nodeText(item))));
  const [columns = [], ...body] = rows;
  return withRef(ref, { type: 'table', text: intro, columns, rows: body.length ? body : [columns.map(() => '')] });
}

/** Same comparison the server makes: normalised payloads. */
export function sameBlocks(original, edited) {
  return JSON.stringify(docToBlocks(blocksToDoc(original))) === JSON.stringify(edited);
}

const LIMITS = { paragraph: 4000, item: 1000, heading: 200, cell: 600, column: 120, columns: 8, rows: 300, items: 100, blocks: 400 };
const MARKUP = /<\s*[a-zA-Z/!?]/;

/** First problem that would stop the server accepting the blocks, or ''. */
export function blocksProblem(blocks) {
  if (!blocks.some((block) => block.type !== 'part')) return 'Keep at least one paragraph, list, table or sub-heading.';
  if (blocks.length > LIMITS.blocks) return `Keep the section under ${LIMITS.blocks} blocks.`;
  for (const [index, block] of blocks.entries()) {
    const at = `Block ${index + 1}`;
    const texts = [block.text || '', ...(block.items || []), ...(block.columns || []), ...(block.rows || []).flat()];
    if (texts.some((value) => MARKUP.test(value))) return `${at}: use plain text without markup.`;
    if (block.type === 'heading' && block.text.length > LIMITS.heading) return `${at}: the sub-heading is longer than ${LIMITS.heading} characters.`;
    if ((block.text || '').length > LIMITS.paragraph) return `${at}: the paragraph is longer than ${LIMITS.paragraph} characters.`;
    if (block.type === 'bullets') {
      if (block.items.length > LIMITS.items) return `${at}: a list has at most ${LIMITS.items} items.`;
      if (block.items.some((item) => item.length > LIMITS.item)) return `${at}: a list item is longer than ${LIMITS.item} characters.`;
    }
    if (block.type === 'table') {
      if (block.columns.length > LIMITS.columns) return `${at}: a table has at most ${LIMITS.columns} columns.`;
      if (block.columns.some((column) => !column)) return `${at}: every table column needs a name in the header row.`;
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
