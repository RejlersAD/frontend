import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * A4 pagination for the canvas editor. The document stays one editor; every paragraph, heading,
 * list item or table row that would cross the bottom margin of a page is pushed to the top of the
 * next page (a padding decoration), and the sheet draws a page, header, footer and gap per page.
 * A single block taller than a page cannot be split and runs over the page end.
 */
export const PAGE = { width: 794, height: 1123, gap: 24, top: 112, bottom: 100, side: 72 };
const STRIDE = PAGE.height + PAGE.gap;
const contentStart = (page) => page * STRIDE + PAGE.top;
const contentEnd = (page) => page * STRIDE + PAGE.height - PAGE.bottom;

export const paginationKey = new PluginKey('proposalPagination');

export const Pagination = Extension.create({
  name: 'proposalPagination',
  addProseMirrorPlugins: () => [new Plugin({
    key: paginationKey,
    state: {
      init: () => new Map(),
      apply(tr, breaks) {
        const next = tr.getMeta(paginationKey);
        if (next) return next;
        if (!tr.docChanged || !breaks.size) return breaks;
        const mapped = new Map();
        breaks.forEach((size, pos) => {
          const result = tr.mapping.mapResult(pos);
          if (!result.deleted) mapped.set(result.pos, size);
        });
        return mapped;
      },
    },
    props: {
      decorations(state) {
        const breaks = paginationKey.getState(state);
        const decorations = [];
        breaks.forEach((size, pos) => {
          const node = state.doc.nodeAt(pos);
          if (!node) return;
          const row = node.type.name === 'tableRow';
          decorations.push(Decoration.node(pos, pos + node.nodeSize, row
            ? { class: 'spde-page-break', style: `--spde-break: ${size}px` }
            : { class: 'spde-page-break', style: `padding-top: ${size}px` }));
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  })],
});

/** Units that can start a new page, in document order: rows of tables, items of lists, other blocks. */
function units(doc) {
  const found = [];
  doc.forEach((node, offset) => {
    if (node.type.name === 'table' || node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      node.forEach((child, childOffset) => found.push(offset + 1 + childOffset));
    } else {
      found.push(offset);
    }
  });
  return found;
}

/**
 * Measure the rendered blocks and place page breaks. Returns { pages, changed }; dispatches the new
 * breaks when `apply` is true and they differ from the current ones.
 */
export function paginate(editor, sheet, zoom, apply = true) {
  if (!editor || editor.isDestroyed || !sheet) return null;
  const { view, state } = editor;
  const current = paginationKey.getState(state) || new Map();
  const origin = sheet.getBoundingClientRect().top;
  const breaks = new Map();
  let appliedBefore = 0;
  let added = 0;
  let bottom = PAGE.top;
  for (const pos of units(state.doc)) {
    const element = view.nodeDOM(pos);
    if (!(element instanceof HTMLElement)) continue;
    const rect = element.getBoundingClientRect();
    const own = current.get(pos) || 0;
    const naturalTop = (rect.top - origin) / zoom - appliedBefore;
    const height = Math.max(0, rect.height / zoom - own);
    appliedBefore += own;
    const top = naturalTop + added;
    const page = Math.max(0, Math.floor(top / STRIDE));
    let shift = 0;
    if (top < contentStart(page)) shift = contentStart(page) - top;
    else if (top >= contentEnd(page) || (top + height > contentEnd(page) && top > contentStart(page) + 1)) shift = contentStart(page + 1) - top;
    if (shift > 0.5) {
      const rounded = Math.round(shift);
      breaks.set(pos, rounded);
      added += rounded;
    }
    bottom = Math.max(bottom, top + shift + height);
  }
  const pages = Math.max(1, Math.floor((bottom - 1) / STRIDE) + 1);
  const changed = breaks.size !== current.size || [...breaks].some(([pos, size]) => Math.abs((current.get(pos) || 0) - size) > 1);
  if (changed && apply) view.dispatch(state.tr.setMeta(paginationKey, breaks).setMeta('addToHistory', false));
  return { pages, changed };
}
