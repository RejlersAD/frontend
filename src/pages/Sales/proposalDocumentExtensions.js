import { Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import ListItem from '@tiptap/extension-list-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { textMatches } from './proposalDocumentModel';

/** Fixed method-statement chapter heading: shown like Heading 1, never edited. */
const ProposalPart = Node.create({
  name: 'proposalPart',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes: () => ({ ref: { default: null }, text: { default: '' } }),
  parseHTML: () => [],
  renderHTML: ({ node }) => ['h1', { class: 'spde-part', contenteditable: 'false', title: 'Chapter heading set by the proposal plan' }, node.attrs.text],
});

/** Links blocks to the stored block they came from. Never copied on Enter or taken from pasted HTML. */
const BlockRef = Extension.create({
  name: 'blockRef',
  addGlobalAttributes: () => [{
    types: ['paragraph', 'heading', 'bulletList', 'table'],
    attributes: {
      ref: { default: null, keepOnSplit: false, parseHTML: () => null, renderHTML: (attrs) => (Number.isInteger(attrs.ref) ? { 'data-ref': attrs.ref } : {}) },
      role: { default: null, keepOnSplit: false, parseHTML: () => null, renderHTML: (attrs) => (attrs.role ? { 'data-role': attrs.role } : {}) },
    },
  }],
});

const textBlocks = (doc) => {
  const blocks = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) { blocks.push({ text: node.textContent, start: pos + 1 }); return false; }
    return true;
  });
  return blocks;
};

export const searchKey = new PluginKey('proposalSearch');
export const commentKey = new PluginKey('proposalComments');

/** Find & replace highlights. State: { query, active, matches }. */
const Search = Extension.create({
  name: 'proposalSearch',
  addProseMirrorPlugins: () => [new Plugin({
    key: searchKey,
    state: {
      init: () => ({ query: '', active: 0, matches: [] }),
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(searchKey);
        const query = meta?.query ?? value.query;
        if (!meta && !tr.docChanged) return value;
        const matches = textMatches(textBlocks(state.doc), query);
        const active = Math.min(meta?.active ?? value.active, Math.max(0, matches.length - 1));
        return { query, active, matches };
      },
    },
    props: {
      decorations(state) {
        const { matches, active } = searchKey.getState(state);
        return DecorationSet.create(state.doc, matches.map((match, index) => Decoration.inline(match.from, match.to,
          { class: index === active ? 'spde-find spde-find-active' : 'spde-find' })));
      },
    },
  })],
});

/** Review comments shown on the text they quote. Meta: { quotes: [{ id, quote, resolved, selected }] }. */
const Comments = Extension.create({
  name: 'proposalComments',
  addOptions: () => ({ onSelect: null }),
  addProseMirrorPlugins() {
    const { onSelect } = this.options;
    return [new Plugin({
      key: commentKey,
      state: {
        init: () => [],
        apply: (tr, value) => tr.getMeta(commentKey) ?? value,
      },
      props: {
        decorations(state) {
          const blocks = textBlocks(state.doc);
          const decorations = [];
          for (const item of commentKey.getState(state)) {
            const quote = item.quote.replace(/\s+/g, ' ').trim();
            const [match] = quote.length >= 3 ? textMatches(blocks, quote) : [];
            if (match) {
              decorations.push(Decoration.inline(match.from, match.to, {
                class: `spde-comment${item.resolved ? ' is-resolved' : ''}${item.selected ? ' is-selected' : ''}`,
                'data-comment-id': String(item.id),
              }));
            }
          }
          return DecorationSet.create(state.doc, decorations);
        },
        handleClick(view, _pos, event) {
          const target = event.target instanceof Element ? event.target.closest('[data-comment-id]') : null;
          if (target && onSelect) onSelect(target.getAttribute('data-comment-id'));
          return false;
        },
      },
    })];
  },
});

/** Only what the Rejlers renderer can rebuild: no inline formatting, numbered lists, quotes or code. */
export function proposalExtensions({ onCommentSelect } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      bold: false, italic: false, strike: false, code: false, codeBlock: false, blockquote: false,
      horizontalRule: false, hardBreak: false, orderedList: false, listItem: false,
    }),
    ListItem.extend({ content: 'paragraph' }),
    ProposalPart,
    BlockRef,
    Table.configure({ resizable: false, allowTableNodeSelection: false }),
    TableRow,
    TableHeader.extend({ content: 'paragraph' }),
    TableCell.extend({ content: 'paragraph' }),
    Search,
    Comments.configure({ onSelect: onCommentSelect }),
  ];
}
