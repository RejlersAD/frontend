import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blocksProblem, blocksToDoc, docToBlocks, sameBlocks, textMatches, wordCount,
} from '../src/pages/Sales/proposalDocumentModel.js';

const cite = [{ file: 'ITT.pdf', page: 3 }];
const stored = [
  { type: 'part', text: 'METHOD STATEMENT' },
  { type: 'heading', text: 'Scope of services', level: 2 },
  { type: 'paragraph', text: 'Rejlers will deliver the FEED.', citations: cite },
  { type: 'bullets', text: 'The scope includes:', items: ['Process review', 'Design basis'], citations: cite },
  { type: 'table', text: '', columns: ['Deliverable', 'Status'], rows: [['Design basis', 'In review']], citations: [] },
];

test('stored blocks survive the editor round trip with their refs', () => {
  const blocks = docToBlocks(blocksToDoc(stored));
  assert.deepEqual(blocks, [
    { type: 'part', text: 'METHOD STATEMENT', ref: 0 },
    { type: 'heading', text: 'Scope of services', level: 2, ref: 1 },
    { type: 'paragraph', text: 'Rejlers will deliver the FEED.', ref: 2 },
    { type: 'bullets', text: 'The scope includes:', items: ['Process review', 'Design basis'], ref: 3 },
    { type: 'table', text: '', columns: ['Deliverable', 'Status'], rows: [['Design basis', 'In review']], ref: 4 },
  ]);
  assert.equal(sameBlocks(stored, blocks), true);
});

test('edited and new content: reworded keeps ref, new has none, empty paragraphs dropped', () => {
  const doc = blocksToDoc(stored);
  doc.content[2].content = [{ type: 'text', text: 'Rejlers will  deliver the FEED study.' }];
  doc.content.splice(3, 0, { type: 'paragraph', attrs: { ref: null, role: null }, content: [{ type: 'text', text: 'New reviewer text.' }] });
  doc.content.push({ type: 'paragraph', attrs: { ref: null, role: null }, content: [] });
  const blocks = docToBlocks(doc);
  assert.deepEqual(blocks[2], { type: 'paragraph', text: 'Rejlers will deliver the FEED study.', ref: 2 });
  assert.deepEqual(blocks[3], { type: 'paragraph', text: 'New reviewer text.' });
  assert.equal(blocks.length, 6);
  assert.equal(sameBlocks(stored, blocks), false);
});

test('an introduction separated from its list becomes its own paragraph', () => {
  const doc = blocksToDoc(stored);
  const at = doc.content.findIndex((node) => node.attrs?.role === 'intro');
  doc.content.splice(at + 1, 0, { type: 'paragraph', attrs: { ref: null, role: null }, content: [{ type: 'text', text: 'Inserted.' }] });
  const blocks = docToBlocks(doc);
  assert.deepEqual(blocks.slice(3, 6).map((block) => block.type), ['paragraph', 'paragraph', 'bullets']);
  assert.equal(blocks[5].text, '');
});

test('a new table takes its header row as columns', () => {
  const doc = { type: 'doc', content: [{ type: 'table', attrs: { ref: null }, content: [
    { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] }] },
    { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [] }] }] },
  ] }] };
  assert.deepEqual(docToBlocks(doc), [{ type: 'table', text: '', columns: ['Item'], rows: [['']] }]);
});

test('problems mirror the server limits', () => {
  assert.match(blocksProblem([{ type: 'part', text: 'X', ref: 0 }]), /at least one/);
  assert.match(blocksProblem([{ type: 'paragraph', text: 'a <b>b</b>' }]), /markup/);
  assert.match(blocksProblem([{ type: 'table', text: '', columns: ['A', ''], rows: [['', '']] }]), /column needs a name/);
  assert.match(blocksProblem([{ type: 'table', text: '', columns: 'ABCDEFGHI'.split(''), rows: [[]] }]), /8 columns/);
  assert.equal(blocksProblem(docToBlocks(blocksToDoc(stored))), '');
});

test('word count and search positions', () => {
  assert.equal(wordCount([{ type: 'paragraph', text: 'one two' }, { type: 'bullets', text: '', items: ['three'] }]), 3);
  assert.deepEqual(textMatches([{ text: 'Design basis and design review', start: 10 }], 'design'), [{ from: 10, to: 16 }, { from: 27, to: 33 }]);
  assert.deepEqual(textMatches([{ text: 'abc', start: 1 }], ''), []);
});

test('reviewer formatting, numbered and nested lists and header-less tables round-trip', () => {
  const formatted = [
    { type: 'heading', text: 'Overview', level: 1, align: 'center' },
    { type: 'paragraph', text: 'Bold and red text', align: 'justify', indent: { left: 18, first: -9 },
      runs: [{ text: 'Bold', bold: true }, { text: ' and ' }, { text: 'red text', color: '#C00000', size: 12, font: 'Calibri', highlight: '#FFFF00' }] },
    { type: 'bullets', text: '', items: ['One', 'Detail', 'Two'], markers: ['number', 'bullet', 'number'], levels: [0, 1, 0],
      item_runs: [null, [{ text: 'Detail', italic: true }], null] },
    { type: 'table', text: '', header: false, columns: ['', ''], rows: [['From:', 'Rejlers']], cell_runs: { '0:0': [{ text: 'From:', bold: true }] } },
  ];
  const blocks = docToBlocks(blocksToDoc(formatted));
  assert.deepEqual(blocks.map((block) => Object.fromEntries(Object.entries(block).filter(([key]) => key !== 'ref'))), formatted);
  assert.deepEqual(blocks.map((block) => block.ref), [0, 1, 2, 3]);
  assert.equal(sameBlocks(formatted, blocks), true);
});

test('unformatted runs collapse to plain text', () => {
  const doc = blocksToDoc([{ type: 'paragraph', text: 'plain', runs: [{ text: 'plain' }] }]);
  assert.deepEqual(docToBlocks(doc), [{ type: 'paragraph', text: 'plain', ref: 0 }]);
});
